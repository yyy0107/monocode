import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostStore } from "./store";
import { HostEngine } from "./engine";
import { readAttachmentChunk, writeAttachmentChunk } from "./attachments";
import type { HostProvider } from "./providers";
import type { SendTurnInput } from "../src/integrations/harness/core/types";
import {
  REMOTE_PROVIDERS,
  applySessionSync,
  type RemoteProvider,
} from "../src/features/connections/model/protocol";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
function setup(harness: RemoteProvider = "pi", steer = true) {
  const directory = mkdtempSync(join(tmpdir(), "monocode-queue-test-"));
  const store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "Queue");
  const turns: { input: SendTurnInput; finish: () => void }[] = [];
  const provider: HostProvider = {
    send: vi.fn(
      (input) =>
        new Promise<void>((finish) => {
          turns.push({ input, finish });
        }),
    ),
    ...(steer ? { steer: vi.fn(async () => {}) } : {}),
    stop: vi.fn(async () => {
      turns.at(-1)?.finish();
    }),
    cancel: vi.fn(async () => {
      turns.at(-1)?.finish();
    }),
    bind: vi.fn(),
    approve: vi.fn(),
    answer: vi.fn(),
  };
  const engine = new HostEngine(store, { [harness]: provider });
  const { sessionId: id } = engine.command({
    type: "create",
    commandId: "create",
    projectId: project.id,
    harness,
    model: `${harness}:test`,
    runtimeMode: "supervised",
  });
  const send = (commandId: string, text = commandId) =>
    engine.command({ type: "send", commandId, text, sessionId: id });
  const queue = (
    action: string,
    fields: object = {},
    commandId = crypto.randomUUID(),
  ) =>
    engine.command({
      type: "queue",
      action,
      sessionId: id,
      commandId,
      ...fields,
    });
  cleanups.push(async () => {
    await engine.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { engine, store, provider, turns, id, send, queue };
}

describe("Host owns the shared message queue", () => {
  it("shows Resume when the first queued message arrives after a usage limit", async () => {
    const s = setup(); s.send("first");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    s.turns[0].input.onEvent({ type: "usage.limited", resetsAt: Date.now() + 60_000 });
    s.send("after-limit"); s.turns[0].finish();
    await vi.waitFor(() => expect(s.store.session(s.id).status).toBe("idle"));
    expect(s.store.session(s.id).session.queueStatus).toBe("paused");
    expect(s.turns).toHaveLength(1);
    s.queue("resume");
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    expect(s.turns[1].input.text).toBe("after-limit");
  });

  it("retains an attachment-only queued entry and authorizes it only in its owning session", async () => {
    const s = setup(); s.send("first");
    const attachment = { id: crypto.randomUUID(), name: "queue.png", kind: "image", mimeType: "image/png", size: 3 };
    writeAttachmentChunk(s.store, { ...attachment, offset: 0, data: "YWJj" });
    s.engine.command({ type: "send", commandId: "image-row", sessionId: s.id, text: "", attachments: [attachment] });
    expect(readAttachmentChunk(s.store, { sessionId: s.id, id: attachment.id, offset: 0 }).data).toBe("YWJj");
    const other = s.engine.command({ type: "create", commandId: "other", projectId: s.store.session(s.id).projectId,
      harness: "pi", model: "pi:test", runtimeMode: "supervised" });
    expect(() => readAttachmentChunk(s.store, { sessionId: other.sessionId, id: attachment.id, offset: 0 })).toThrow("not found");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1)); s.turns[0].finish();
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    expect(s.turns[1].input.attachments?.[0].data).toBe("YWJj");
  });

  it("waits for in-flight steering acceptance before settlement and FIFO dispatch", async () => {
    const s = setup(); s.send("first"); s.send("steer"); s.send("next");
    let accept!: () => void;
    s.provider.steer = vi.fn(() => new Promise<void>(resolve => { accept = resolve; }));
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    s.queue("steer", { messageId: "steer", runId: s.store.session(s.id).runId });
    await vi.waitFor(() => expect(accept).toBeTypeOf("function"));
    s.turns[0].finish();
    await Promise.resolve(); await Promise.resolve();
    expect(s.store.session(s.id).status).toBe("running");
    expect(s.turns).toHaveLength(1);
    accept();
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    expect(s.turns[1].input.text).toBe("next");
    expect(s.store.session(s.id).queueSteeringId).toBeUndefined();
  });

  it("expires disconnected edit leases into a paused queue without sending the stale draft", async () => {
    const s = setup(); s.send("first"); s.send("later");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    vi.useFakeTimers();
    try {
      s.queue("hold", { messageId: "later", editor: "disconnected-phone" });
      s.turns[0].finish(); await vi.advanceTimersByTimeAsync(90_001);
      expect(s.store.session(s.id).status).toBe("idle");
      expect(s.store.session(s.id).session.editingQueuedMessageId).toBeUndefined();
      expect(s.store.session(s.id).session.queueStatus).toBe("paused");
      expect(s.turns).toHaveLength(1);
      expect(() => s.queue("edit", { messageId: "later", editor: "disconnected-phone", text: "Stale save" })).toThrow("expired");
      s.queue("release", { editor: "disconnected-phone" }); // Cancel remains safe after expiry.
      expect(s.store.session(s.id).session.queuedMessages?.[0].text).toBe("later");
    } finally { vi.useRealTimers(); }
  });

  it.each(REMOTE_PROVIDERS)(
    "serializes two clients' sends exactly once for %s",
    async (harness) => {
      const s = setup(harness);
      const firstClient = s.store.session(s.id);
      s.send("first");
      const accepted = s.send("phone");
      s.send("desktop");
      expect(s.send("phone")).toEqual(accepted);
      const synced = applySessionSync(
        firstClient,
        s.store.sync(s.id, firstClient.revision),
      );
      expect(synced.session.queuedMessages?.map((row) => row.id)).toEqual([
        "phone",
        "desktop",
      ]);
      await vi.waitFor(() => expect(s.turns).toHaveLength(1));
      const firstRun = s.store.session(s.id).runId;
      s.turns[0].finish();
      await vi.waitFor(() => expect(s.turns).toHaveLength(2));
      expect(s.store.summaries(s.store.session(s.id).projectId)[0]).toMatchObject({
        status: "running",
        lastCompletedRunId: firstRun,
      });
      expect(s.turns[1].input.text).toBe("phone");
      expect(
        s.store.session(s.id).session.queuedMessages?.map((row) => row.id),
      ).toEqual(["desktop"]);
      s.turns[1].finish();
      await vi.waitFor(() => expect(s.turns).toHaveLength(3));
      expect(s.turns[2].input.text).toBe("desktop");
      expect(s.store.session(s.id).session.queuedMessages).toBeUndefined();
      s.send("phone"); // Replayed acceptance must never enqueue or execute again.
      expect(s.turns).toHaveLength(3);
      s.turns[2].finish();
    },
  );

  it("holds an edited head on both clients, protects the lease, and dispatches the saved text", async () => {
    const s = setup();
    s.send("first");
    s.send("edit-me");
    s.send("remove-me");
    s.queue("hold", { messageId: "edit-me", editor: "phone" });
    expect(() =>
      s.queue("hold", { messageId: "edit-me", editor: "desktop" }),
    ).toThrow("another device");
    expect(() => s.queue("remove", { messageId: "edit-me" })).toThrow(
      "Finish editing",
    );
    s.queue("remove", { messageId: "remove-me" });
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    s.turns[0].finish();
    await vi.waitFor(() => expect(s.store.session(s.id).status).toBe("idle"));
    expect(s.turns).toHaveLength(1);
    s.queue("edit", {
      messageId: "edit-me",
      editor: "phone",
      text: "Saved from phone",
    });
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    expect(s.turns[1].input.text).toBe("Saved from phone");
    expect(() =>
      s.queue("edit", {
        messageId: "edit-me",
        editor: "desktop",
        text: "Stale",
      }),
    ).toThrow("not found");
  });

  it("retains queued messages after cancel and resumes once even when both clients request it", async () => {
    const s = setup();
    s.send("first");
    s.send("later");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    s.engine.command({
      type: "cancel",
      commandId: "stop",
      sessionId: s.id,
      runId: s.store.session(s.id).runId,
    });
    await vi.waitFor(() => expect(s.store.session(s.id).status).toBe("idle"));
    expect(s.store.session(s.id).session.queueStatus).toBe("paused");
    expect(s.turns).toHaveLength(1);
    s.queue("resume", {}, "resume-phone");
    expect(() => s.queue("resume", {}, "resume-desktop")).toThrow(
      "current turn",
    );
    s.queue("resume", {}, "resume-phone");
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    expect(s.turns[1].input.text).toBe("later");
  });

  it.each(["session.error", "usage.limited"] as const)(
    "pauses queued follow-ups on %s",
    async (type) => {
      const s = setup();
      s.send("first");
      s.send("later");
      await vi.waitFor(() => expect(s.turns).toHaveLength(1));
      s.turns[0].input.onEvent(
        type === "session.error"
          ? { type, message: "Provider failed" }
          : { type, resetsAt: Date.now() + 60_000 },
      );
      s.turns[0].finish();
      await vi.waitFor(() => expect(s.store.session(s.id).status).toBe("idle"));
      expect(s.store.session(s.id).session.queueStatus).toBe("paused");
      expect(s.turns).toHaveLength(1);
    },
  );

  it.each([
    "pi",
    "omp",
    "codex",
    "claude",
    "cursor",
    "opencode",
    "hermes",
  ] as const)(
    "injects a queued row through %s's steer once and rejects a stale run",
    async (harness) => {
      const s = setup(harness);
      s.send("first");
      s.send("steer-me");
      await vi.waitFor(() => expect(s.turns).toHaveLength(1));
      const runId = s.store.session(s.id).runId;
      expect(() =>
        s.queue("steer", { messageId: "steer-me", runId: "stale" }),
      ).toThrow("finished");
      const command = { messageId: "steer-me", runId };
      s.queue("steer", command, "inject");
      s.queue("steer", command, "inject");
      await vi.waitFor(() =>
        expect(s.store.session(s.id).session.queuedMessages).toBeUndefined(),
      );
      expect(s.provider.steer).toHaveBeenCalledTimes(1);
      expect(s.store.session(s.id).session.blocks.find(row => row.id === "steer-me")?.text).toBe("steer-me");
      const steered = s.store.session(s.id).session.blocks.find(row => row.id === "steer-me")!;
      expect(steered.sentAt).toBeGreaterThan(0);
      expect(steered.startedAt).toBeUndefined();
      expect(s.store.summaries(s.store.session(s.id).projectId)[0].lastUserMessageAt).toBe(steered.sentAt);
      expect(
        s.store
          .session(s.id)
          .session.blocks.filter(
            (row) => row.role === "user" && row.text === "steer-me",
          ),
      ).toHaveLength(1);
      expect(s.turns).toHaveLength(1);
    },
  );

  it("preserves unsupported or rejected steering for review instead of losing the row", async () => {
    const s = setup("grok", false);
    s.send("first");
    s.send("later");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    expect(s.store.session(s.id).canSteer).toBe(false);
    expect(() =>
      s.queue("steer", {
        messageId: "later",
        runId: s.store.session(s.id).runId,
      }),
    ).toThrow("does not support");
    s.provider.steer = vi.fn(async () => {
      throw new Error("Native steer rejected");
    });
    s.queue(
      "steer",
      { messageId: "later", runId: s.store.session(s.id).runId },
      "rejected",
    );
    await vi.waitFor(() =>
      expect(s.store.session(s.id).session.queueStatus).toBe("paused"),
    );
    expect(s.store.session(s.id).session.queuedMessages?.[0].text).toBe(
      "later",
    );
    expect(
      s.store.session(s.id).session.blocks.filter((row) => row.role === "user"),
    ).toHaveLength(1);
    s.queue(
      "steer",
      { messageId: "later", runId: s.store.session(s.id).runId },
      "rejected",
    );
    expect(s.provider.steer).toHaveBeenCalledTimes(1);
  });

  it("waits for provider cleanup before starting the next queued turn", async () => {
    const s = setup();
    s.send("first");
    s.send("later");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    let release!: () => void;
    vi.mocked(s.provider.stop).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    s.turns[0].finish();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(s.store.session(s.id).status).toBe("running");
    expect(s.turns).toHaveLength(1);
    release();
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
  });

  it("restores queue contents after a restart with automatic dispatch paused", async () => {
    const s = setup();
    s.send("first");
    s.send("later");
    await vi.waitFor(() => expect(s.turns).toHaveLength(1));
    await s.engine.close();
    const recovered = new HostEngine(s.store, { pi: s.provider });
    expect(s.store.session(s.id).session.queueStatus).toBe("paused");
    expect(s.store.session(s.id).session.queuedMessages?.[0].id).toBe("later");
    expect(s.turns).toHaveLength(1);
    recovered.command({
      type: "queue",
      action: "resume",
      commandId: "resume-after-restart",
      sessionId: s.id,
    });
    await vi.waitFor(() => expect(s.turns).toHaveLength(2));
    await recovered.close();
  });
});
