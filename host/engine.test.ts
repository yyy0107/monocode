import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SendTurnInput } from "../src/integrations/harness/core/types";
import type { HostProvider } from "./providers";
import { HostEngine, parseCommand } from "./engine";
import { HostStore } from "./store";
import { readAttachmentChunk, writeAttachmentChunk } from "./attachments";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.useRealTimers();
});

function setup(harness: "codex" | "claude" = "codex") {
  const directory = mkdtempSync(join(tmpdir(), "monocode-engine-test-"));
  const store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "Test");
  const turns: Array<{ input: SendTurnInput; finish: () => void }> = [];
  const provider: HostProvider = {
    send: vi.fn(
      (input) =>
        new Promise<void>((resolve) => {
          turns.push({ input, finish: resolve });
        }),
    ),
    cancel: vi.fn(async () => {
      turns.at(-1)?.finish();
    }),
    stop: vi.fn(async () => {
      turns.at(-1)?.finish();
    }),
    bind: vi.fn(),
    approve: vi.fn(),
    answer: vi.fn(),
  };
  // Native sources resolve inside the fixture, never in the developer's home.
  const engine = new HostEngine(store, { codex: provider, claude: provider }, undefined, {
    native: { environment: { home: join(directory, "home"), env: {} } },
  });
  const created = engine.command({
    type: "create",
    commandId: "create",
    projectId: project.id,
    harness,
    model: `${harness}:test`,
    runtimeMode: "supervised",
  });
  cleanups.push(async () => {
    await engine.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    store,
    provider,
    project,
    engine,
    turns,
    id: created.sessionId,
  };
}

describe("headless session ownership", () => {
  it("reads one session for orchestration without enumerating history and preserves unflushed output", async () => {
    const { engine, store, turns, id } = setup();
    await engine.ready;
    const sessions = vi.spyOn(store, "sessions");
    expect(engine.orchestration.scheduler.submissionError(id)).toBeNull();
    expect(engine.orchestration.scheduler.submissionError("missing")).toBeNull();
    expect(sessions).not.toHaveBeenCalled();

    engine.command({ type: "send", commandId: "single-session-send", sessionId: id, text: "Work" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const started = store.session(id).revision;
    turns[0].input.onEvent({ type: "message.delta", text: "Unflushed response" });
    expect(store.session(id).revision).toBe(started);
    expect(store.session(id).session.blocks.some((block) => block.text === "Unflushed response")).toBe(false);
    expect(engine.session(id)?.session.blocks.some((block) => block.text === "Unflushed response")).toBe(true);
    expect(engine.session("missing")).toBeUndefined();
    expect(sessions).not.toHaveBeenCalled();
    sessions.mockRestore();
    turns[0].finish();
  });

  it("skips submission checks for native refreshes while still enforcing them for sends", async () => {
    const { engine, id } = setup();
    await engine.ready;
    const submission = vi.spyOn(engine.orchestration.scheduler, "submissionError").mockReturnValue("Submission is blocked");
    engine.orchestration.assertSessionWrite(id, "refresh");
    expect(submission).not.toHaveBeenCalled();
    expect(() => engine.orchestration.assertSessionWrite(id, "send")).toThrow("Submission is blocked");
    expect(submission).toHaveBeenCalledOnce();
    submission.mockRestore();
  });

  it("refreshes event-automation titles once and protects subsequent manual names", async () => {
    const { engine, store, provider, turns, id } = setup();
    provider.generateTitle = vi.fn(async () => ({ title: "New automation goal", workItem: null }));
    engine.command({ type: "send", commandId: "initial-title", sessionId: id, text: "First goal" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({ type: "session.providerBound", providerSessionId: "native" });
    turns[0].input.onEvent({ type: "session.titleUpdated", providerSessionId: "native", title: "Initial native goal" });
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    engine.command({ type: "send", commandId: "automation-title", sessionId: id, text: "New event goal", refreshTitle: true });
    await vi.waitFor(() => expect(turns).toHaveLength(2));
    await vi.waitFor(() => expect(store.session(id).session.title).toBe("codex · New automation goal"));
    turns[1].input.onEvent({ type: "session.titleUpdated", providerSessionId: "native", title: "Old native goal" });
    expect(store.session(id).session.title).toBe("codex · New automation goal");
    turns[1].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    engine.updateSession(id, { title: "My title" });
    engine.command({ type: "send", commandId: "manual-title", sessionId: id, text: "Another event", refreshTitle: true });
    await vi.waitFor(() => expect(turns).toHaveLength(3));
    turns[2].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    expect(provider.generateTitle).toHaveBeenCalledTimes(1);
    expect(store.session(id).session.title).toBe("My title");
  });
  it("persists late native title metadata after settlement without changing transcript stamps", async () => {
    const { engine, store, provider, turns, id } = setup();
    provider.readSessionTitle = vi.fn(async () => null);
    provider.generateTitle = vi.fn(async () => ({ title: "Extra request", workItem: null }));
    engine.command({ type: "send", commandId: "native-title", sessionId: id, text: "Title this conversation" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({ type: "session.providerBound", providerSessionId: "native" });
    turns[0].input.onEvent({ type: "message.delta", text: "Answer" });
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    const before = store.session(id);
    turns[0].input.onEvent({ type: "session.titleUpdated", providerSessionId: "other", title: "Wrong session" });
    turns[0].input.onEvent({ type: "session.titleUpdated", providerSessionId: "native", title: "原生标题" });
    expect(store.session(id).session.title).toBe("codex · 原生标题");
    expect(store.session(id).blockRevisions).toEqual(before.blockRevisions);
    expect(store.session(id).updatedAt).toBe(before.updatedAt);
    expect(store.session(id).status).toBe("idle");
    expect(store.summaries(before.projectId)[0].titleState?.source).toBe("native");
    expect(provider.generateTitle).not.toHaveBeenCalled();
    provider.readSessionTitle = vi.fn(async () => "Updated native title");
    turns[0].input.onEvent({ type: "session.titleRefreshRequested", providerSessionId: "native" });
    await vi.waitFor(() => expect(store.session(id).session.title).toBe("codex · Updated native title"));
    engine.updateSession(id, { title: "User title" });
    turns[0].input.onEvent({ type: "session.titleUpdated", providerSessionId: "native", title: "Later native" });
    expect(store.session(id).session.title).toBe("User title");
    expect(store.summaries(before.projectId)[0].titleState?.source).toBe("manual");
  });

  it("binds an imported provider identity on first use after the Host is already running", async () => {
    const { store, engine, id, provider, turns } = setup();
    const current = store.session(id);
    store.save({ ...current, revision: current.revision + 1,
      session: { ...current.session, providerSessionId: "imported-native", providerAccountId: "saved-account" } },
      { type: "desktop.import" });
    engine.command({ type: "send", commandId: "continue-import", sessionId: id, text: "Continue old history" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(provider.bind).toHaveBeenCalledWith(id, "imported-native", current.session.cwd, "saved-account");
    expect(turns[0].input.providerAccountId).toBe("saved-account");
    turns[0].finish();
  });
  it("persists generated PNG history, deduplicates events and enforces session ownership", async () => {
    const { engine, store, turns, id } = setup();
    engine.command({ type: "send", commandId: "paint", sessionId: id, text: "Paint" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
    const event = { type: "image.generated" as const, itemId: "paint", name: "saved.png", data: png, mimeType: "image/png" };
    turns[0].input.onEvent(event); turns[0].input.onEvent(event);
    expect(store.session(id).session.blocks.filter(block => block.role === "image")).toHaveLength(1);
    const block = store.session(id).session.blocks.find(block => block.role === "image")!;
    const file = block.attachments![0];
    expect(readAttachmentChunk(store, { sessionId: id, id: file.id, offset: 0 }).data).toBe(png);
    expect(JSON.stringify(store.session(id))).not.toContain(png);
    const other = engine.command({ type: "create", commandId: "other-image-session", projectId: store.session(id).projectId,
      harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    expect(() => readAttachmentChunk(store, { sessionId: other.sessionId, id: file.id, offset: 0 })).toThrow("not found");
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    const snapshot = store.sync(id);
    expect(snapshot.kind).toBe("snapshot");
    if (snapshot.kind === "snapshot") expect(snapshot.value.session.blocks.find(row => row.role === "image")?.attachments?.[0]?.id).toBe(file.id);
    turns[0].input.onEvent({ ...event, itemId: "late" });
    expect(readdirSync(store.attachmentDir)).toHaveLength(1);
  });

  it("shows image-save errors and removes files when database persistence fails", async () => {
    const { engine, store, turns, id } = setup();
    engine.command({ type: "send", commandId: "bad-image", sessionId: id, text: "Paint" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({ type: "image.generated", itemId: "bad", name: "bad.png", data: "AAAA" });
    expect(store.session(id).session.blocks.at(-1)?.notice).toBe("error");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(store, "save").mockImplementationOnce(() => { throw new Error("disk full"); });
    try {
      turns[0].input.onEvent({ type: "image.generated", itemId: "save-fails", name: "saved.png", data: png });
      expect(readdirSync(store.attachmentDir)).toHaveLength(0);
      await vi.waitFor(() => expect(store.session(id).status).toBe("interrupted"));
      expect(store.session(id).session.blocks.some(block => block.role === "image")).toBe(false);
    } finally { log.mockRestore(); }
  });

  it.each(["send", "compact"] as const)("clears the old draft when a normal %s starts", async (type) => {
    const { engine, store, turns, provider, id } = setup();
    provider.compact = (input) => provider.send({ ...input, text: "/compact" });
    engine.command({ type: "draft", commandId: "draft", sessionId: id, text: "Later" });
    engine.command({ type, commandId: "next", sessionId: id, text: "New work" });
    expect(store.session(id).session.blocks.some((block) => block.draft)).toBe(false);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].finish();
  });

  it("contains a persistence failure while requesting approval", async () => {
    const { engine, store, turns, provider, id } = setup();
    engine.command({ type: "send", commandId: "approval-failure", sessionId: id, text: "Work" });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(store, "save").mockImplementationOnce(() => { throw new Error("disk full"); });
    try {
      expect(() => turns[0].input.onEvent({ type: "approval.requested", requestId: 1, title: "Run?" })).not.toThrow();
      await vi.waitFor(() => expect(provider.stop).toHaveBeenCalled());
      await vi.waitFor(() => expect(store.session(id).status).toBe("interrupted"));
    } finally { log.mockRestore(); }
  });

  it("stores a remote draft with an uploaded file, then sends it in plan mode", async () => {
    const { engine, store, turns, id } = setup();
    const fileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(
      writeAttachmentChunk(store, {
        id: fileId,
        offset: 0,
        size: 5,
        data: Buffer.from("hello").toString("base64"),
      }),
    ).toEqual({ offset: 5 });
    const attachment = {
      id: fileId,
      name: "notes.txt",
      mimeType: "text/plain",
      kind: "file" as const,
      size: 5,
    };
    engine.command({
      type: "draft",
      commandId: "draft-1",
      sessionId: id,
      text: "Plan this",
      attachments: [attachment],
    });
    expect(store.session(id).session.blocks[0]).toMatchObject({
      draft: true,
      attachments: [{ name: "notes.txt" }],
    });
    expect(store.summaries(store.session(id).projectId)[0].draft).toBe(true);
    engine.command({
      type: "send",
      commandId: "send-draft",
      sessionId: id,
      text: "Plan this",
      intent: "plan",
      draftBlockId: "draft-1",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(turns[0].input).toMatchObject({
      intent: "plan",
      attachments: [{ name: "notes.txt", size: 5 }],
    });
    expect(turns[0].input.attachments?.[0].path).toContain(fileId);
    expect(store.summaries(store.session(id).projectId)[0].draft).toBe(false);
    turns[0].finish();
  });

  it.each(["codex", "claude"] as const)("passes an uploaded image to %s on an attachment-only turn", async (harness) => {
    const { engine, store, turns, id } = setup(harness);
    const fileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const image = Buffer.from("image-bytes");
    writeAttachmentChunk(store, {
      id: fileId,
      offset: 0,
      size: image.length,
      data: image.toString("base64"),
    });
    engine.command({
      type: "send",
      commandId: "image-turn",
      sessionId: id,
      text: "",
      attachments: [
        {
          id: fileId,
          name: "shot.png",
          mimeType: "image/png",
          kind: "image",
          size: image.length,
        },
      ],
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(turns[0].input.attachments?.[0]).toMatchObject({
      name: "shot.png",
      path: expect.stringContaining(fileId),
    });
    expect(turns[0].input.attachments?.[0].data).toBe(
      harness === "codex" ? undefined : image.toString("base64"),
    );
    expect(readAttachmentChunk(store, { sessionId: id, id: fileId, offset: 0 })).toEqual({
      offset: image.length, size: image.length, data: image.toString("base64"),
    });
    const other = engine.command({ type: "create", commandId: "other-session", projectId: store.session(id).projectId,
      harness: "claude", model: "claude:test", runtimeMode: "supervised" });
    expect(() => readAttachmentChunk(store, { sessionId: other.sessionId, id: fileId, offset: 0 })).toThrow();
    turns[0].finish();
  });

  it("removes a remote draft without starting the provider", () => {
    const { engine, store, provider, id } = setup();
    engine.command({
      type: "draft",
      commandId: "draft-2",
      sessionId: id,
      text: "Later",
    });
    engine.command({
      type: "removeDraft",
      commandId: "remove-2",
      sessionId: id,
      draftBlockId: "draft-2",
    });
    expect(store.session(id).session.blocks).toEqual([]);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("marks a reviewed host plan as built after its build turn", async () => {
    const { engine, store, turns, id } = setup();
    engine.command({
      type: "send",
      commandId: "plan-turn",
      sessionId: id,
      text: "Plan this",
      intent: "plan",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({ type: "plan", text: "# Steps\n\n1. Change code" });
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    const plan = store
      .session(id)
      .session.blocks.find((block) => block.role === "plan")!;
    engine.command({
      type: "send",
      commandId: "build-turn",
      sessionId: id,
      text: `Build the approved plan:\n\n${plan.text}`,
      intent: "build",
      planBlockId: plan.id,
    });
    expect(
      store.session(id).session.blocks.find((block) => block.id === plan.id)
        ?.plan?.status,
    ).toBe("building");
    await vi.waitFor(() => expect(turns).toHaveLength(2));
    turns[1].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    expect(
      store.session(id).session.blocks.find((block) => block.id === plan.id)
        ?.plan?.status,
    ).toBe("built");
  });

  it("keeps a manually renamed title when first-turn generation finishes later", async () => {
    vi.useFakeTimers();
    const { engine, store, provider, turns, id } = setup();
    let finishTitle: (title: {
      title: string;
      workItem: null;
    }) => void = () => {};
    provider.generateTitle = vi.fn(
      () =>
        new Promise((resolve) => {
          finishTitle = resolve;
        }),
    );
    engine.command({
      type: "send",
      commandId: "name-first-turn",
      sessionId: id,
      text: "Fix remote project titles",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(provider.generateTitle).toHaveBeenCalledTimes(1);
    engine.updateSession(id, { title: "codex · My own title" });
    finishTitle({ title: "Generated title", workItem: null });
    await vi.waitFor(() =>
      expect(provider.generateTitle).toHaveBeenCalledTimes(1),
    );
    expect(store.session(id).session.title).toBe("codex · My own title");
  });

  it("uses one creation timestamp and advances only updatedAt on later commands", () => {
    let now = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now++);
    try {
      const { engine, store, project, id } = setup();
      const initial = store.session(id);
      const timestamps = {
        createdAt: initial.createdAt,
        updatedAt: initial.createdAt,
        revision: 1,
      };
      expect(initial).toMatchObject(timestamps);
      expect(store.sessions(project.id)[0]).toMatchObject(timestamps);
      expect(store.summaries(project.id)[0]).toMatchObject(timestamps);

      now = initial.updatedAt + 1_000;
      engine.command({
        type: "configure",
        commandId: "configure-timestamps",
        sessionId: id,
        model: "codex:updated",
        modelSettings: {},
        runtimeMode: "supervised",
      });
      const updatedTimestamps = {
        createdAt: initial.createdAt,
        updatedAt: initial.updatedAt + 1_000,
        revision: 2,
      };
      expect(store.session(id)).toMatchObject(updatedTimestamps);
      expect(store.sessions(project.id)[0]).toMatchObject(updatedTimestamps);
      expect(store.summaries(project.id)[0]).toMatchObject(updatedTimestamps);
    } finally {
      clock.mockRestore();
    }
  });

  it("keeps remote card changes in host history and removes deleted sessions", () => {
    const { store, project, id } = setup();
    const initial = store.summaries(project.id)[0];
    expect(initial.model).toBe("codex:test");
    expect(initial.createdAt).toBe(initial.updatedAt);

    store.save(
      {
        ...store.session(id),
        revision: initial.revision + 1,
        updatedAt: initial.updatedAt + 1_000,
      },
      { type: "session.test" },
    );
    expect(store.summaries(project.id)[0]).toMatchObject({
      createdAt: initial.createdAt,
      updatedAt: initial.updatedAt + 1_000,
    });

    const updated = store.updateSession(id, {
      title: "Codex · Renamed",
      pinned: true,
      archived: true,
      linkedWorkItem: {
        kind: "issue",
        repo: "example/repo",
        number: 42,
        url: "https://github.com/example/repo/issues/42",
      },
    });
    expect(updated).toMatchObject({
      title: "Codex · Renamed",
      pinned: true,
      archived: true,
      model: "codex:test",
      linkedWorkItem: { number: 42 },
    });
    expect(store.summaries(project.id)[0]).toMatchObject({
      title: updated.title,
      pinned: true,
      archived: true,
      revision: updated.revision,
    });
    expect(store.sync(id, initial.revision)).toMatchObject({ kind: "delta" });
    store.updateSession(id, { linkedWorkItem: null });
    expect(store.summaries(project.id)[0].linkedWorkItem).toBeUndefined();

    store.deleteSession(id);
    expect(store.summaries(project.id)).toEqual([]);
    expect(() => store.session(id)).toThrow("Session not found");
  });

  it("includes the harness ID in remote summaries, including older cached rows", () => {
    const { store, project, id } = setup();
    const current = store.session(id);
    store.save(
      {
        ...current,
        revision: current.revision + 1,
        session: { ...current.session, providerSessionId: "harness-session" },
      },
      { type: "session.test" },
    );
    expect(store.summaries(project.id)[0].providerSessionId).toBe(
      "harness-session",
    );

    const legacySummary = { ...store.summaries(project.id)[0] };
    delete legacySummary.providerSessionId;
    store.db.prepare("UPDATE sessions SET summary=? WHERE id=?").run(
      JSON.stringify(legacySummary),
      id,
    );
    expect(store.summaries(project.id)[0].providerSessionId).toBe(
      "harness-session",
    );
    const repaired = store.db
      .prepare("SELECT summary FROM sessions WHERE id=?")
      .get(id)!;
    expect(JSON.parse(String(repaired.summary)).providerSessionId).toBe(
      "harness-session",
    );
  });

  it("keeps a legacy session's last known timestamp when adding creation time", () => {
    const { directory, store, project, id } = setup();
    const legacy = { ...store.session(id) };
    delete legacy.createdAt;
    store.db.prepare("UPDATE sessions SET snapshot=? WHERE id=?").run(
      JSON.stringify(legacy),
      id,
    );

    const reopened = new HostStore(join(directory, "host.db"));
    cleanups.push(() => reopened.close());
    const original = reopened.session(id);
    reopened.save(
      {
        ...original,
        revision: original.revision + 1,
        updatedAt: original.updatedAt + 1_000,
      },
      { type: "session.test" },
    );
    expect(reopened.summaries(project.id)[0]).toMatchObject({
      createdAt: original.updatedAt,
      updatedAt: original.updatedAt + 1_000,
    });
  });

  it("preserves the transaction error and invalidates cached state if rollback fails", () => {
    const { store, id } = setup();
    const cached = store.session(id);
    store.db.prepare("UPDATE sessions SET snapshot=? WHERE id=?").run(
      JSON.stringify({
        ...cached,
        session: { ...cached.session, title: "Updated" },
      }),
      id,
    );
    const exec = store.db.exec.bind(store.db);
    const rollback = vi.spyOn(store.db, "exec").mockImplementation((sql) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
      return exec(sql);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("transaction failed");
    try {
      expect(() =>
        store.transaction(() => {
          throw original;
        }),
      ).toThrow(original);
      expect(store.session(id).session.title).toBe("Updated");
    } finally {
      rollback.mockRestore();
      log.mockRestore();
      store.db.exec("ROLLBACK");
    }
  });
  it("keeps the checkout idle while a branch switch is in progress", async () => {
    const { engine, project, id, turns } = setup();
    let finishSwitch = () => {};
    const switching = engine.withIdleProject(
      project.id,
      () =>
        new Promise<void>((resolve) => {
          finishSwitch = resolve;
        }),
    );
    expect(() =>
      engine.command({
        type: "send",
        commandId: "during-switch",
        sessionId: id,
        text: "Work",
      }),
    ).toThrow("branch switch");
    expect(() =>
      engine.command({
        type: "create",
        commandId: "new-during-switch",
        projectId: project.id,
        harness: "codex",
        model: "codex:test",
        runtimeMode: "supervised",
      }),
    ).toThrow("branch switch");
    finishSwitch();
    await switching;
    engine.command({
      type: "send",
      commandId: "after-switch",
      sessionId: id,
      text: "Work",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].finish();
  });

  it("runs provider context compaction once and persists its transcript marker", async () => {
    const { engine, store, provider, id } = setup();
    let finishCompact = () => {};
    provider.compact = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCompact = resolve;
        }),
    );
    const command = { type: "compact", commandId: "compact", sessionId: id };
    const receipt = engine.command(command);
    expect(engine.command(command)).toEqual(receipt);
    await vi.waitFor(() => expect(provider.compact).toHaveBeenCalledTimes(1));
    expect(store.session(id).session.blocks).toContainEqual(
      expect.objectContaining({ text: "/compact" }),
    );
    finishCompact();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
  });

  it("persists model and permission changes for the next turn and rejects changes mid-turn", async () => {
    const { engine, store, turns, id } = setup();
    const change = {
      type: "configure",
      commandId: "settings",
      sessionId: id,
      model: "codex:new",
      modelSettings: { reasoningEffort: "high" },
      runtimeMode: "full-access",
    };
    const receipt = engine.command(change);
    expect(engine.command(change)).toEqual(receipt);
    expect(store.session(id).session).toMatchObject({
      model: "codex:new",
      modelSettings: { reasoningEffort: "high" },
      runtimeMode: "full-access",
    });
    engine.command({
      type: "send",
      commandId: "turn",
      sessionId: id,
      text: "Continue",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(turns[0].input).toMatchObject({
      model: "codex:new",
      modelSettings: { reasoningEffort: "high" },
      runtimeMode: "full-access",
    });
    expect(() => engine.command({ ...change, commandId: "later" })).toThrow(
      "current turn",
    );
    turns[0].finish();
  });
  it("keeps working with no client, persists output, and deduplicates a lost acknowledgement", async () => {
    const { engine, store, turns, provider, id } = setup();
    const command = {
      type: "send",
      commandId: "send-once",
      sessionId: id,
      text: "Do the work",
    };
    const receipt = engine.command(command);
    expect(engine.command(command)).toEqual(receipt);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(provider.send).toHaveBeenCalledTimes(1);
    const before = store.session(id).revision;
    turns[0].input.onEvent({
      type: "session.providerBound",
      providerSessionId: "provider-thread",
    });
    turns[0].input.onEvent({
      type: "message.delta",
      text: "still working while disconnected",
    });
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    expect(
      store
        .session(id)
        .session.blocks.some((block) => block.text.includes("still working")),
    ).toBe(true);
    expect(store.events(id, before).events?.length).toBeGreaterThan(1);
    expect(engine.command(command)).toEqual(receipt);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.bind).toHaveBeenCalledWith(
      id,
      "provider-thread",
      expect.any(String),
    );
    expect(() =>
      engine.command({ ...command, text: "Changed payload" }),
    ).toThrow("different payload");
  });

  it.each(["codex", "claude"] as const)(
    "keeps %s turn timing and model provenance after settlement and reconnect",
    async (harness) => {
      const { engine, store, turns, id } = setup(harness);
      engine.command({
        type: "send",
        commandId: "first-turn",
        sessionId: id,
        text: "Inspect the project",
      });
      await vi.waitFor(() => expect(turns).toHaveLength(1));
      const running = store.session(id);
      expect(running.session.blocks[0]).toMatchObject({
        id: "first-turn",
        startedAt: expect.any(Number),
        turnModel: { harness, id: `${harness}:test` },
      });
      turns[0].input.onEvent({ type: "message.delta", text: "Found it" });
      turns[0].finish();
      await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));

      const reconnected = store.sync(id);
      expect(reconnected.kind).toBe("snapshot");
      if (reconnected.kind !== "snapshot") return;
      expect(reconnected.value.session.blocks[0]).toMatchObject({
        id: "first-turn",
        startedAt: expect.any(Number),
        durationMs: expect.any(Number),
        turnModel: { harness, id: `${harness}:test` },
      });
      expect(
        reconnected.value.session.blocks[0].durationMs,
      ).toBeGreaterThanOrEqual(0);
      expect(reconnected.value.session.blocks[1].text).toBe("Found it");

      const delta = store.sync(id, running.revision);
      expect(delta.kind).toBe("delta");
      if (delta.kind === "delta")
        expect(
          delta.blocks.some(
            (block) => block.id === "first-turn" && block.durationMs != null,
          ),
        ).toBe(true);
    },
  );

  it("serializes concurrent sends and accepts only one approval decision for a run", async () => {
    const { engine, store, turns, provider, id } = setup();
    engine.command({
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work",
    });
    engine.command({ type: "send", commandId: "other-send", sessionId: id, text: "More work" });
    expect(store.session(id).session.queuedMessages?.map(row => row.text)).toEqual(["More work"]);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({
      type: "approval.requested",
      requestId: 7,
      title: "Run a command?",
    });
    const runId = store.session(id).runId!;
    const approval = {
      type: "approve",
      commandId: "approval-1",
      sessionId: id,
      runId,
      requestId: 7,
      decision: "allow",
    };
    expect(() => engine.command({ ...approval, runId: "stale" })).toThrow(
      "finished or replaced",
    );
    engine.command(approval);
    engine.command(approval);
    expect(() =>
      engine.command({
        ...approval,
        commandId: "approval-2",
        decision: "deny",
      }),
    ).toThrow("already resolved");
    expect(provider.approve).toHaveBeenCalledTimes(1);
    expect(provider.approve).toHaveBeenCalledWith(id, 7, "allow");
  });

  it("stores pending questions and rejects a second device's stale answer", async () => {
    const { engine, store, turns, provider, id } = setup();
    engine.command({
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns[0].input.onEvent({
      type: "question.asked",
      requestId: 3,
      questions: [
        {
          id: "q1",
          prompt: "Choose",
          multiSelect: false,
          allowCustom: false,
          options: [{ id: "yes", label: "Yes" }],
        },
      ],
    });
    const reply = {
      type: "answer",
      commandId: "answer",
      sessionId: id,
      runId: store.session(id).runId,
      requestId: 3,
      reply: { kind: "answered", answers: { q1: ["yes"] } },
    };
    engine.command(reply);
    expect(store.session(id).session.pendingQuestion).toBeUndefined();
    expect(() =>
      engine.command({ ...reply, commandId: "other-answer" }),
    ).toThrow("already resolved");
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it("recovers interrupted durable state without replaying an uncertain provider send", async () => {
    const { store, provider, id } = setup();
    const value = store.session(id);
    store.transaction(() =>
      store.save(
        {
          ...value,
          revision: value.revision + 1,
          status: "running",
          runId: "old-run",
          session: {
            ...value.session,
            busy: true,
            providerSessionId: "retained",
            blocks: [
              {
                id: "interrupted-turn",
                role: "user",
                text: "Work",
                startedAt: value.updatedAt - 2_000,
              },
            ],
          },
        },
        { type: "accepted" },
      ),
    );
    const recovered = new HostEngine(store, { codex: provider });
    expect(store.session(id).status).toBe("interrupted");
    expect(store.session(id).session.busy).toBe(false);
    expect(store.session(id).session.blocks[0].durationMs).toBe(2_000);
    expect(provider.send).not.toHaveBeenCalled();
    expect(provider.bind).toHaveBeenCalledWith(
      id,
      "retained",
      value.session.cwd,
    );
    await recovered.close();
  });

  it("retries a failed event write and settles the stopped turn", async () => {
    const { engine, store, turns, id } = setup();
    engine.command({
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const original = store.save.bind(store);
    let failed = false;
    vi.spyOn(store, "save").mockImplementation((value, event) => {
      if (!failed && (event as { type?: string }).type === "events") {
        failed = true;
        throw new Error("temporary storage error");
      }
      return original(value, event);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      turns[0].input.onEvent({
        type: "message.delta",
        text: "Retained output",
      });
      turns[0].finish();
      await vi.waitFor(
        () => expect(store.session(id).status).toBe("interrupted"),
        {
          timeout: 4_000,
        },
      );
      expect(
        store
          .session(id)
          .session.blocks.some((block) => block.text === "Retained output"),
      ).toBe(true);
      expect(store.session(id).session.busy).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  it("retries a failed final settlement", async () => {
    const { engine, store, turns, id } = setup();
    engine.command({
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const original = store.save.bind(store);
    let failed = false;
    vi.spyOn(store, "save").mockImplementation((value, event) => {
      if (!failed && (event as { type?: string }).type === "settled") {
        failed = true;
        throw new Error("temporary storage error");
      }
      return original(value, event);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      turns[0].finish();
      await vi.waitFor(
        () => expect(store.session(id).status).toBe("interrupted"),
        {
          timeout: 4_000,
        },
      );
      expect(store.session(id).session.busy).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  it("batches streamed output and syncs only changed blocks", async () => {
    const { engine, store, turns, id, project } = setup();
    engine.command({
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work",
    });
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const started = store.session(id).revision;
    for (let index = 0; index < 50; index++)
      turns[0].input.onEvent({
        type: "message.delta",
        text: `chunk ${index} `,
      });
    expect(store.session(id).revision).toBe(started);
    await vi.waitFor(() =>
      expect(store.session(id).revision).toBe(started + 1),
    );
    const sync = store.sync(id, started);
    expect(sync.kind).toBe("delta");
    if (sync.kind !== "delta") return;
    expect(sync.blocks.map((block) => block.role)).toEqual(["assistant"]);
    expect(sync.blockIds).toHaveLength(2);

    turns[0].input.onEvent({
      type: "approval.requested",
      requestId: 1,
      title: "Run a command?",
    });
    expect(store.session(id).revision).toBe(started + 2);

    const streamed = store.session(id).revision;
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    const settled = store.sync(id, streamed);
    if (settled.kind !== "delta") throw new Error("Expected a delta");
    expect(
      settled.blocks.some(
        (block) => block.role === "user" && block.durationMs != null,
      ),
    ).toBe(true);
    expect(store.sync(id, store.session(id).revision).kind).toBe("unchanged");
    expect(store.sync(id).kind).toBe("snapshot");
    expect(store.summaries(project.id)[0]).toMatchObject({
      id,
      status: "idle",
      title: "codex · Work",
    });
  });

  it("requires snapshot recovery when the client's event cursor is invalid", () => {
    const { store, id } = setup();
    expect(store.events(id, 100_000).snapshot?.session.id).toBe(id);
  });

  it("validates untrusted commands before execution", () => {
    expect(() =>
      parseCommand({ type: "send", commandId: "x", sessionId: "y", text: "" }),
    ).toThrow();
    expect(() =>
      parseCommand({
        type: "create",
        commandId: "x",
        projectId: "y",
        harness: "shell",
        model: "x",
        runtimeMode: "auto",
      }),
    ).toThrow();
    expect(() =>
      parseCommand({
        type: "answer",
        commandId: "x",
        sessionId: "y",
        runId: "z",
        requestId: 1,
        reply: { kind: "answered", answers: { a: [42] } },
      }),
    ).toThrow();
  });
});

describe("imported native sessions", () => {
  async function nativeSetup() {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const context = setup("claude");
    writeFileSync(join(context.directory, "desktop-owner.json"), JSON.stringify({ desktopDirectory: join(context.directory, "desktop") }));
    // Process detection spans all test workers. Synthetic CLI fixtures in other
    // suites must not accidentally own this independently imported conversation.
    const nativeId = randomUUID();
    const projects = join(context.directory, "home/.claude/projects/fixture");
    mkdirSync(projects, { recursive: true });
    const path = join(projects, `${nativeId}.jsonl`);
    const row = (uuid: string, parentUuid: string | null, type: "user" | "assistant", text: string) =>
      JSON.stringify({
        type, uuid, parentUuid, sessionId: nativeId, cwd: context.directory, timestamp: new Date(1_000).toISOString(),
        message: type === "user" ? { role: "user", content: text } : { role: "assistant", content: [{ type: "text", text }] },
      }) + "\n";
    writeFileSync(path, row("u1", null, "user", "Imported question") + row("a1", "u1", "assistant", "Imported answer"));
    const value = context.store.session(context.id);
    const nativeSession = {
      provider: "claude" as const,
      providerSessionId: nativeId,
      path,
      revision: "1",
      blockIds: [],
      nativeIds: [],
      mode: "managed" as const,
      storage: "jsonl" as const,
      createdAt: 1,
      updatedAt: 1,
    };
    context.store.save(
      { ...value, revision: value.revision + 1, session: { ...value.session, providerSessionId: nativeId, nativeSession } },
      { type: "test" },
    );
    const { nativeLockPath } = await import("./native-access");
    return { ...context, lock: nativeLockPath(context.directory, nativeSession), path, nativeId, row };
  }

  it.runIf(process.platform === "linux")("continues under the Host's lock with a strict binding, then releases it", async () => {
    const { acquireNativeLease, IN_USE_BY_MONOCODE } = await import("./native-access");
    const { engine, provider, turns, id, lock, path, store, nativeId } = await nativeSetup();
    expect(await engine.nativeAccess(id)).toMatchObject({ state: "idle" });
    engine.command({ type: "send", commandId: "native-send", sessionId: id, text: "Continue from the phone" });
    await vi.waitFor(() => expect(turns, store.session(id).session.blocks.at(-1)?.text).toHaveLength(1), { timeout: 5_000 });
    expect(provider.bind).toHaveBeenCalledWith(id, nativeId, expect.any(String), undefined, expect.objectContaining({ path }));
    expect(turns[0].input.nativeSession?.path).toBe(path);
    // Another MonoCode writer cannot start while the Host turn runs.
    await expect(acquireNativeLease(lock)).rejects.toThrow(IN_USE_BY_MONOCODE);
    expect(await engine.nativeAccess(id)).toMatchObject({ state: "idle" });
    turns[0].finish();
    await vi.waitFor(() => expect(store.session(id).status).toBe("idle"));
    // The provider is stopped right away so no idle CLI keeps owning the file.
    expect(provider.stop).toHaveBeenCalledWith(id);
    const lease = await acquireNativeLease(lock);
    await lease.release();
  }, 10_000);

  it.runIf(process.platform === "linux")("refuses to write while another MonoCode writer holds the session", async () => {
    const { acquireNativeLease } = await import("./native-access");
    const { engine, provider, id, lock, store } = await nativeSetup();
    const other = await acquireNativeLease(lock);
    try {
      expect(await engine.nativeAccess(id)).toMatchObject({ reason: "anotherMonocode" });
      // A known owner fails fast, before a turn starts.
      expect(() => engine.command({ type: "send", commandId: "blocked", sessionId: id, text: "x" })).toThrow(
        "MonoCode desktop is using this conversation",
      );
      expect(provider.send).not.toHaveBeenCalled();
      expect(store.session(id).status).toBe("idle");
    } finally {
      await other.release();
    }
  });
});

it.each(["codex", "claude"] as const)("pins the shared %s default at creation and preserves older conversations", async (harness) => {
  const { directory, engine, project, id: legacyId, store, turns } = setup(harness);
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(join(directory, "provider-accounts"));
  writeFileSync(join(directory, "desktop-owner.json"), JSON.stringify({ desktopDirectory: directory }));
  writeFileSync(join(directory, "provider-accounts/accounts.json"), JSON.stringify({ [harness]: [{ id: "work", label: "Work" }, { id: "personal", label: "Personal" }] }));
  const defaults = join(directory, "provider-accounts/defaults.json");
  writeFileSync(defaults, JSON.stringify({ [harness]: "work" }));
  const create = (commandId: string, providerAccountId?: string) => engine.command({ type: "create", commandId, projectId: project.id, harness, model: `${harness}:test`, runtimeMode: "supervised", providerAccountId });
  const following = create("following");
  expect(store.session(create("explicit-cli", "default").sessionId).session.providerAccountId).toBeUndefined();
  const explicit = create("explicit", "personal");
  expect(store.session(following.sessionId).session.providerAccountId).toBe("work");
  expect(store.session(explicit.sessionId).session.providerAccountId).toBe("personal");
  writeFileSync(defaults, JSON.stringify({ [harness]: "personal" }));
  expect(store.session(create("after-change").sessionId).session.providerAccountId).toBe("personal");
  engine.command({ type: "send", commandId: "old-named", sessionId: following.sessionId, text: "Continue" });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  expect(turns[0].input.providerAccountId).toBe("work"); turns[0].finish();
  engine.command({ type: "send", commandId: "old-cli", sessionId: legacyId, text: "Continue" });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].input.providerAccountId).toBeUndefined(); turns[1].finish();
  writeFileSync(defaults, JSON.stringify({ [harness]: "removed" }));
  expect(() => create("missing-default")).toThrow("no longer available");
  expect(store.session(create("override-broken", "work").sessionId).session.providerAccountId).toBe("work");
});
