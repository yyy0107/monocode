import { afterEach, describe, expect, it, vi } from "vitest";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { HostEngine } from "../engine";
import { HostStore } from "../store";
import type { HostProvider } from "../providers";
import type { SendTurnInput } from "../../src/integrations/harness/core/types";
import { acquireNativeLease, IN_USE_BY_MONOCODE, nativeLockPath } from "../native-access";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const linux = process.platform === "linux";

function claudeRow(nativeId: string, cwd: string, uuid: string, parentUuid: string | null, type: "user" | "assistant", text: string) {
  return JSON.stringify({
    type, uuid, parentUuid, sessionId: nativeId, cwd, timestamp: new Date(1_000).toISOString(),
    message: type === "user" ? { role: "user", content: text } : { role: "assistant", content: [{ type: "text", text }] },
  }) + "\n";
}

type Turn = { input: SendTurnInput; finish: () => void };

function setup(options: { autoSync?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "monocode-native-manager-"));
  const store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "Native");
  const turns: Turn[] = [];
  const writes: Array<(input: SendTurnInput) => void> = [];
  const provider: HostProvider = {
    send: vi.fn((input) => new Promise<void>((resolve) => {
      writes.shift()?.(input);
      turns.push({ input, finish: resolve });
    })),
    cancel: vi.fn(async () => turns.at(-1)?.finish()),
    stop: vi.fn(async () => turns.at(-1)?.finish()),
    bind: vi.fn(),
    approve: vi.fn(),
    answer: vi.fn(),
    readSessionTitle: vi.fn(async () => null),
  };
  const engine = new HostEngine(store, { claude: provider, pi: provider, omp: provider }, undefined, {
    native: {
      environment: { home: join(directory, "home"), env: {} },
      pollMs: 40,
      stableMs: 20,
      stableTimeoutMs: 400,
      retryDelays: [60, 60],
    },
  });
  if (options.autoSync === false) engine.nativeSessions.setAutoSync(false);
  cleanups.push(async () => {
    await engine.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const projects = join(directory, "home/.claude/projects/fixture");
  mkdirSync(projects, { recursive: true });
  return { directory, store, project, engine, provider, turns, writes, projects };
}

/** A managed native conversation whose last applied source revision is stale. */
function imported(context: ReturnType<typeof setup>, legacy = false) {
  const nativeId = randomUUID();
  const path = join(context.projects, `${nativeId}.jsonl`);
  const row = (uuid: string, parent: string | null, type: "user" | "assistant", text: string) =>
    claudeRow(nativeId, context.directory, uuid, parent, type, text);
  writeFileSync(path, row("u1", null, "user", "Imported question") + row("a1", "u1", "assistant", "Imported answer"));
  const created = context.engine.command({
    type: "create", commandId: `create-${nativeId}`, projectId: context.project.id, harness: "claude", model: "claude:test", runtimeMode: "supervised",
  });
  const value = context.store.session(created.sessionId);
  context.store.save({
    ...value,
    revision: value.revision + 1,
    session: {
      ...value.session,
      providerSessionId: nativeId,
      blocks: [
        { id: "native-claude-u1", role: "user", text: "Imported question" },
        { id: "native-claude-a1", role: "assistant", text: "Imported answer" },
      ],
      nativeSession: {
        provider: "claude", providerSessionId: nativeId, path, revision: "old", createdAt: 1, updatedAt: 1,
        blockIds: ["native-claude-u1", "native-claude-a1"],
        ...(legacy ? {} : { mode: "managed" as const, storage: "jsonl" as const, nativeIds: ["native-claude-u1", "native-claude-a1"] }),
      },
    },
  }, { type: "test" });
  return { id: created.sessionId, nativeId, path, row };
}

const texts = (context: ReturnType<typeof setup>, id: string) =>
  context.store.session(id).session.blocks.filter((block) => block.role === "user" || block.role === "assistant").map((block) => block.text);

describe.runIf(linux)("Host-managed native sessions", () => {
  it("migrates an older client's link once at startup and catches up without text pairing", async () => {
    const context = setup();
    const { id, path, row } = imported(context, true);
    appendFileSync(path, row("u2", "a1", "user", "External question"));
    await context.engine.close();
    const restarted = new HostEngine(context.store, { claude: context.provider }, undefined, {
      native: { environment: { home: join(context.directory, "home"), env: {} }, pollMs: 40, stableMs: 20 },
    });
    try {
      // Older links tracked native record IDs in blockIds.
      expect(context.store.session(id).session.nativeSession).toMatchObject({
        mode: "managed", storage: "jsonl", nativeIds: ["native-claude-u1", "native-claude-a1"],
      });
      await vi.waitFor(() => expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" }));
      expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "External question"]);
      expect(context.store.summaries().find((value) => value.id === id)?.nativeSession).toMatchObject({ blockIds: [] });
      expect(context.store.summaries().find((value) => value.id === id)?.nativeSession?.nativeIds).toBeUndefined();
    } finally {
      await restarted.close();
    }
  });

  it("skips the write when a forced refresh finds nothing new", async () => {
    const context = setup();
    const { id } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    const before = context.store.session(id).revision;
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(context.store.session(id).revision).toBe(before);
  });

  it("keeps conversation order through opening, metadata sync and sync errors", async () => {
    const context = setup({ autoSync: false });
    const { id, path, nativeId } = imported(context);
    const before = context.store.session(id).updatedAt;
    context.engine.nativeSessions.touch(id);
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(context.store.session(id).updatedAt).toBe(before);
    appendFileSync(path, JSON.stringify({ type: "custom-title", sessionId: nativeId, customTitle: "Native title" }) + "\n");
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(context.store.session(id).session.title).toContain("Native title");
    expect(context.store.session(id).updatedAt).toBe(before);
    rmSync(path);
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(context.store.session(id).nativeStatus?.state).toBe("error");
    expect(context.store.session(id).updatedAt).toBe(before);
  });

  it("uses the source activity time when an external conversation is continued", async () => {
    const context = setup({ autoSync: false });
    const { id, path, row } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    const current = context.store.session(id);
    context.store.save({ ...current, revision: current.revision + 1, updatedAt: 1_000 }, { type: "test" });
    appendFileSync(path, row("u2", "a1", "user", "External question"));
    utimesSync(path, 2_000, 2_000);
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(texts(context, id)).toContain("External question");
    expect(context.store.session(id).updatedAt).toBe(statSync(path).mtimeMs);
  });

  it("restores maintenance-only Pi and omp imports on restart while keeping Host activity", async () => {
    const context = setup({ autoSync: false });
    const { id } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    const base = context.store.session(id);
    for (const harness of ["pi", "omp"] as const) {
      const imported = {
        ...base,
        revision: 1,
        createdAt: 1_000,
        updatedAt: 2_000,
        supportsQueue: false,
        session: {
          ...base.session,
          id: `import-${harness}`,
          harness,
          nativeSession: { ...base.session.nativeSession!, provider: harness, updatedAt: 2_000 },
        },
      };
      context.store.save(imported, { type: "desktop.import" });
      context.store.save({ ...imported, revision: 2, updatedAt: 9_000 }, { type: "queue.recovered" });
      context.store.save({ ...imported, revision: 3, updatedAt: 10_000 }, { type: "native.synced", hostTurn: false });
      const continued = { ...imported, session: { ...imported.session, id: `continued-${harness}` } };
      context.store.save(continued, { type: "desktop.import" });
      context.store.save({ ...continued, revision: 2, updatedAt: 11_000 }, { type: "send" });
      const missing = { ...imported, session: { ...imported.session, id: `missing-${harness}` } };
      context.store.save(missing, { type: "desktop.import" });
      context.store.save({ ...missing, revision: 3, updatedAt: 12_000 }, { type: "queue.recovered" });
      const unknown = { ...imported, session: { ...imported.session, id: `unknown-${harness}` } };
      context.store.save(unknown, { type: "desktop.import" });
      context.store.save({ ...unknown, revision: 2, updatedAt: 13_000 }, { type: "unknown" });
    }
    await context.engine.close();
    const restarted = new HostEngine(context.store, { claude: context.provider, pi: context.provider, omp: context.provider }, undefined, {
      native: { environment: { home: join(context.directory, "home"), env: {} } },
    });
    try {
      for (const harness of ["pi", "omp"] as const) {
        expect(context.store.session(`import-${harness}`).updatedAt).toBe(2_000);
        expect(context.store.session(`continued-${harness}`).updatedAt).toBe(11_000);
        expect(context.store.session(`missing-${harness}`).updatedAt).toBe(12_000);
        expect(context.store.session(`unknown-${harness}`).updatedAt).toBe(13_000);
        expect(context.store.summaries().find((row) => row.id === `import-${harness}`)).toMatchObject({ harness, updatedAt: 2_000 });
      }
    } finally {
      await restarted.close();
    }
  });

  it.each(["pi", "omp"] as const)("imports %s with its source dates", async (harness) => {
    const context = setup({ autoSync: false });
    const nativeId = randomUUID();
    const directory = join(context.directory, "home", harness === "pi" ? ".pi/agent/sessions/fixture" : ".omp/agent/sessions/fixture");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `fixture_${nativeId}.jsonl`);
    writeFileSync(path, [
      { type: "session", version: 3, id: nativeId, cwd: context.directory, timestamp: new Date(1_000).toISOString() },
      { type: "message", id: "u1", parentId: null, timestamp: new Date(2_000).toISOString(), message: { role: "user", content: "Original question" } },
    ].map((row) => JSON.stringify(row)).join("\n") + "\n");
    utimesSync(path, 3_000, 3_000);
    const listing = await context.engine.nativeSessions.list(true);
    const source = listing.sources.find((row) => row.provider === harness && row.providerSessionId === nativeId)!;
    expect(source).toBeDefined();
    const value = await context.engine.nativeSessions.importSource(source.sourceId);
    expect(value).toMatchObject({ createdAt: 1_000, updatedAt: 3_000_000, session: { harness } });
    await context.engine.nativeSessions.refresh(value.session.id, { force: true });
    expect(context.store.session(value.session.id).updatedAt).toBe(3_000_000);
  });

  it("takes over, catches up before sending and absorbs the turn's own records", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    // An external CLI added a turn after the desktop's last mirror.
    appendFileSync(path, row("u2", "a1", "user", "External question") + row("a2", "u2", "assistant", "External answer"));
    context.writes.push(() => appendFileSync(path, row("u3", "a2", "user", "[wrapped] Host question") + row("a3", "u3", "assistant", "Host answer")));
    context.engine.command({ type: "send", commandId: "s1", sessionId: id, text: "Host question" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(1));
    // External history lands before the running turn's prompt.
    expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "External question", "External answer", "Host question"]);
    expect(context.turns[0].input.nativeSession?.mode).toBe("managed");
    // The Host's lock is held for the turn.
    await expect(acquireNativeLease(nativeLockPath(context.directory, context.store.session(id).session.nativeSession!)))
      .rejects.toThrow(IN_USE_BY_MONOCODE);
    context.turns[0].input.onEvent({ type: "message.delta", text: "Host answer" });
    context.turns[0].finish();
    await vi.waitFor(() => expect(context.store.session(id).status).toBe("idle"));
    await vi.waitFor(() => expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" }));
    // The Host turn keeps its own blocks; the native copies (wrapped prompt) are absorbed, not duplicated.
    expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "External question", "External answer", "Host question", "Host answer"]);
    const link = context.store.session(id).session.nativeSession!;
    expect(link.nativeIds).toEqual(expect.arrayContaining(["native-claude-u3", "native-claude-a3"]));
    expect(context.store.session(id).nativeStatus?.hostTurn).toBeUndefined();
    const lease = await acquireNativeLease(nativeLockPath(context.directory, link));
    await lease.release();
  }, 10_000);

  it("picks up a provider's delayed final write during settlement", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    context.writes.push(() => appendFileSync(path, row("u2", "a1", "user", "Second")));
    context.engine.command({ type: "send", commandId: "s1", sessionId: id, text: "Second" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(1));
    context.turns[0].finish();
    setTimeout(() => appendFileSync(path, row("a2", "u2", "assistant", "Late answer")), 10);
    await vi.waitFor(() => expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" }));
    await vi.waitFor(() => expect(context.store.session(id).session.nativeSession?.nativeIds).toContain("native-claude-a2"));
    // A later external append is merged once, after the absorbed late write.
    appendFileSync(path, row("u3", "a2", "user", "External follow-up"));
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "Second", "External follow-up"]);
  }, 10_000);

  it("merges external appends found by the stat fallback without a desktop", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    context.engine.nativeSessions.touch(id);
    appendFileSync(path, row("u2", "a1", "user", "From the CLI") + row("a2", "u2", "assistant", "CLI answer"));
    // The stat fallback finds the change without any file event.
    await vi.waitFor(() => expect(texts(context, id)).toContain("CLI answer"), { timeout: 3_000 });
    expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" });
    expect(context.provider.send).not.toHaveBeenCalled();
  }, 10_000);

  it("keeps history and pauses sending on divergence, queuing new messages", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    // A rewind in the CLI starts a new branch from u1.
    appendFileSync(path, row("b1", "u1", "assistant", "Rewound answer"));
    const status = await context.engine.nativeSessions.refresh(id, { force: true });
    expect(status).toMatchObject({ state: "error", reason: "diverged" });
    expect(texts(context, id)).toEqual(["Imported question", "Imported answer"]);
    context.engine.command({ type: "send", commandId: "waits", sessionId: id, text: "Wait for me" });
    expect(context.store.session(id).session.queuedMessages?.map((message) => message.text)).toEqual(["Wait for me"]);
    expect(context.provider.send).not.toHaveBeenCalled();
  });

  it("retries a failed read automatically and dispatches the queue once writable", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    writeFileSync(path, row("u1", null, "user", "Imported question") + row("a1", "u1", "assistant", "Imported answer") + "{broken\n");
    const failed = await context.engine.nativeSessions.refresh(id, { force: true });
    expect(failed).toMatchObject({ state: "error", reason: "parseFailed" });
    expect(failed?.retryAt).toBeGreaterThan(Date.now() - 1_000);
    context.engine.command({ type: "send", commandId: "queued", sessionId: id, text: "Queued while broken" });
    expect(context.provider.send).not.toHaveBeenCalled();
    writeFileSync(path, row("u1", null, "user", "Imported question") + row("a1", "u1", "assistant", "Imported answer"));
    await vi.waitFor(() => expect(context.turns).toHaveLength(1), { timeout: 3_000 });
    expect(context.turns[0].input.text).toContain("Queued while broken");
    context.turns[0].finish();
    await vi.waitFor(() => expect(context.store.session(id).status).toBe("idle"));
  }, 10_000);

  it("defers a change seen while a turn runs to settlement, even with auto-sync off", async () => {
    const context = setup({ autoSync: false });
    const { id, path, row } = imported(context);
    context.engine.command({ type: "send", commandId: "s1", sessionId: id, text: "Running" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(1));
    appendFileSync(path, row("u2", "a1", "user", "Running"));
    const busy = await context.engine.nativeSessions.refresh(id, { force: true });
    expect(busy?.pendingChange).toBe(true);
    expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "Running"]);
    context.turns[0].finish();
    await vi.waitFor(() => expect(context.store.session(id).session.nativeSession?.nativeIds).toContain("native-claude-u2"));
    expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" });
    expect(context.store.session(id).nativeStatus?.pendingChange).toBeFalsy();
    // Auto-sync off: an idle external append waits for an explicit refresh or the next turn.
    appendFileSync(path, row("a9", "u2", "assistant", "Idle external"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(texts(context, id)).not.toContain("Idle external");
    await context.engine.nativeSessions.refresh(id, { force: true });
    expect(texts(context, id)).toContain("Idle external");
  }, 10_000);

  it("refuses a missing source without creating another provider conversation", async () => {
    const context = setup();
    const { id, path } = imported(context);
    rmSync(path);
    context.engine.command({ type: "send", commandId: "s1", sessionId: id, text: "Lost" });
    await vi.waitFor(() => expect(context.store.session(id).status).toBe("idle"));
    expect(context.provider.send).not.toHaveBeenCalled();
    expect(context.store.session(id).nativeStatus).toMatchObject({ state: "error", reason: "sourceMissing" });
  });

  it("finishes an interrupted settlement after a Host restart", async () => {
    const context = setup();
    const { id, path, row } = imported(context);
    await context.engine.nativeSessions.refresh(id, { force: true });
    // The Host stopped after its turn wrote records but before settlement absorbed them.
    appendFileSync(path, row("u2", "a1", "user", "[wrapped] Before restart"));
    const value = context.store.session(id);
    context.store.save({
      ...value,
      revision: value.revision + 1,
      session: { ...value.session, blocks: [...value.session.blocks, { id: "host-user", role: "user", text: "Before restart" }] },
      nativeStatus: { ...value.nativeStatus!, hostTurn: true },
    }, { type: "test" });
    await context.engine.close();
    const restarted = new HostEngine(context.store, { claude: context.provider }, undefined, {
      native: { environment: { home: join(context.directory, "home"), env: {} }, pollMs: 40, stableMs: 20 },
    });
    try {
      await vi.waitFor(() => expect(context.store.session(id).nativeStatus?.hostTurn).toBeUndefined());
      expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" });
      // Absorbed, not duplicated by the wrapped native copy.
      expect(texts(context, id)).toEqual(["Imported question", "Imported answer", "Before restart"]);
      expect(context.store.session(id).session.nativeSession?.nativeIds).toContain("native-claude-u2");
    } finally {
      await restarted.close();
    }
  });

  it("imports from the Host listing and never offers a bound conversation again", async () => {
    const context = setup();
    const nativeId = randomUUID();
    const path = join(context.projects, `${nativeId}.jsonl`);
    writeFileSync(path, claudeRow(nativeId, context.directory, "u1", null, "user", "Listed question"));
    const listing = await context.engine.nativeSessions.list(true);
    const source = listing.sources.find((item) => item.providerSessionId === nativeId)!;
    expect(source.boundSessionId).toBeUndefined();
    const value = await context.engine.nativeSessions.importSource(source.sourceId);
    expect(value.createdAt).toBe(1_000);
    expect(value.updatedAt).toBe(Math.trunc(statSync(path).mtimeMs));
    expect(value.session.nativeSession).toMatchObject({ mode: "managed", path, providerSessionId: nativeId });
    expect(value.nativeStatus).toMatchObject({ state: "ready" });
    expect(value.session.blocks.map((block) => block.text)).toEqual(["Listed question"]);
    expect((await context.engine.nativeSessions.list()).sources.find((item) => item.providerSessionId === nativeId)?.boundSessionId)
      .toBe(value.session.id);
    expect((await context.engine.nativeSessions.importSource(source.sourceId)).session.id).toBe(value.session.id);
    await expect(context.engine.nativeSessions.importSource("0".repeat(32))).rejects.toThrow("no longer available");
  });
});

describe.runIf(linux)("lazy identity for MonoCode-started conversations", () => {
  function started(context: ReturnType<typeof setup>) {
    const created = context.engine.command({
      type: "create", commandId: "create-lazy", projectId: context.project.id, harness: "claude", model: "claude:test", runtimeMode: "supervised",
    });
    const nativeId = randomUUID();
    const path = join(context.projects, `${nativeId}.jsonl`);
    const row = (uuid: string, parent: string | null, type: "user" | "assistant", text: string) =>
      claudeRow(nativeId, context.directory, uuid, parent, type, text);
    return { id: created.sessionId, nativeId, path, row };
  }

  it("keeps warm reuse until another writer continues the conversation, then takes it over", async () => {
    const context = setup();
    const { id, nativeId, path, row } = started(context);
    context.writes.push((input) => {
      input.onEvent({ type: "session.providerBound", providerSessionId: nativeId });
      writeFileSync(path, row("u1", null, "user", "First") + row("a1", "u1", "assistant", "First answer"));
    });
    context.engine.command({ type: "send", commandId: "l1", sessionId: id, text: "First" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(1));
    context.turns[0].input.onEvent({ type: "message.delta", text: "First answer" });
    context.turns[0].finish();
    await vi.waitFor(() => expect(context.store.session(id).nativeBinding?.hostRevision).toBeTruthy());
    expect(context.store.session(id).session.nativeSession).toBeUndefined();
    expect(context.store.session(id).nativeBinding).toMatchObject({ provider: "claude", providerSessionId: nativeId, path });
    // Unchanged source: the parked process is reused, no takeover.
    context.writes.push(() => appendFileSync(path, row("u2", "a1", "user", "Second") + row("a2", "u2", "assistant", "Second answer")));
    context.engine.command({ type: "send", commandId: "l2", sessionId: id, text: "Second" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(2));
    expect(context.store.session(id).session.nativeSession).toBeUndefined();
    context.turns[1].input.onEvent({ type: "message.delta", text: "Second answer" });
    context.turns[1].finish();
    await vi.waitFor(() => expect(context.store.session(id).status).toBe("idle"));
    await vi.waitFor(() => expect(context.store.session(id).nativeBinding?.hostRevision).toMatch(new RegExp(`^${Buffer.byteLength(row("u1", null, "user", "First") + row("a1", "u1", "assistant", "First answer") + row("u2", "a1", "user", "Second") + row("a2", "u2", "assistant", "Second answer"))}:`)));
    const stops = vi.mocked(context.provider.stop).mock.calls.length;
    // The user continues in the CLI.
    appendFileSync(path, row("u3", "a2", "user", "From CLI") + row("a3", "u3", "assistant", "CLI answer"));
    context.engine.command({ type: "send", commandId: "l3", sessionId: id, text: "Back in MonoCode" });
    await vi.waitFor(() => expect(context.turns).toHaveLength(3));
    expect(vi.mocked(context.provider.stop).mock.calls.length).toBeGreaterThan(stops);
    expect(context.turns[2].input.nativeSession).toMatchObject({ mode: "managed", path });
    expect(texts(context, id)).toEqual(["First", "First answer", "Second", "Second answer", "From CLI", "CLI answer", "Back in MonoCode"]);
    expect(context.store.session(id).nativeBinding).toBeUndefined();
    context.turns[2].finish();
    await vi.waitFor(() => expect(context.store.session(id).nativeStatus).toMatchObject({ state: "ready" }));
  }, 10_000);
});
