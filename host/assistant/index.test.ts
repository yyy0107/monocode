import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { HostStore } from "../store";
import { HostEngine } from "../engine";
import { executeAssistantAction } from "./control";
import type { HostProvider } from "../providers";
import type { SendTurnInput } from "../../src/integrations/harness/core/types";
import { fullAssistantPolicy } from "../../src/features/assistant/model/assistant";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});
async function setup(options: { steer?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "assistant-runtime-")),
    store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "Test project");
  const turns: { input: SendTurnInput; finish: () => void }[] = [];
  const provider: HostProvider = {
    send: vi.fn(
      (input) => new Promise<void>((finish) => turns.push({ input, finish })),
    ),
    stop: vi.fn(async (id) => {
      turns.filter((t) => t.input.sessionId === id).forEach((t) => t.finish());
    }),
    cancel: vi.fn(async (id) => {
      turns.filter((t) => t.input.sessionId === id).forEach((t) => t.finish());
    }),
    bind: vi.fn(),
    approve: vi.fn(),
    answer: vi.fn(),
    ...(options.steer ? { steer: vi.fn(async () => {}) } : {}),
  };
  const engine = new HostEngine(store, { codex: provider });
  cleanup.push(async () => {
    await engine.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await engine.ready;
  engine.assistant.setCatalog(
    async () => ["codex"],
    async () => ({
      models: { codex: [{ id: "test", name: "Test" }] },
      errors: {},
    }),
  );
  await engine.assistant.rpc("assistant.configure", {
    commandId: "configure",
    expectedRevision: 0,
    patch: {
      harness: "codex",
      model: "test",
      triggers: { user: true, event: false, schedule: false },
    },
  });
  const receipt = await engine.assistant.rpc("assistant.send", {
    commandId: "hello",
    text: "Inspect the projects",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  return { directory, store, project, engine, turns, provider, receipt };
}
it("keeps queued user messages unread until the assistant starts their turn", async () => {
  const { engine, turns } = await setup();
  expect(
    engine.assistant.store.latestMessages().find((m) => m.kind === "user"),
  ).toMatchObject({ readAt: expect.any(Number) });
  const receipt = (await engine.assistant.rpc("assistant.send", {
    commandId: "queued-read",
    text: "Read me next",
  })) as { messageId: string };
  const get = () =>
    engine.assistant.store
      .latestMessages()
      .find((m) => m.id === receipt.messageId);
  expect(get()).toMatchObject({ readAt: null });
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(get()).toMatchObject({ readAt: expect.any(Number) });
});
it("creates real target cards and sends trusted messages idempotently", async () => {
  const { engine, project, store } = await setup();
  const create = { projectId: project.id, harness: "codex", model: "test" };
  const receipt = (await executeAssistantAction(
    engine.assistant,
    "new-task",
    "sessions.create",
    create,
    () => true,
  )) as { sessionId: string };
  expect(
    await executeAssistantAction(
      engine.assistant,
      "new-task",
      "sessions.create",
      create,
      () => true,
    ),
  ).toEqual(receipt);
  for (let i = 0; i < 10; i++)
    await executeAssistantAction(
      engine.assistant,
      "send-task",
      "sessions.send",
      {
        projectId: project.id,
        sessionId: receipt.sessionId,
        text: "Fix this task",
      },
      () => true,
    );
  expect(
    store
      .session(receipt.sessionId)
      .session.blocks.filter((b) => b.role === "user"),
  ).toHaveLength(1);
  expect(store.session(receipt.sessionId).session.blocks[0].origin?.kind).toBe(
    "assistant",
  );
  expect(
    engine.assistant.store
      .latestMessages()
      .filter((m) => m.kind === "session-card"),
  ).toHaveLength(2);
  expect(store.projects().map((p) => p.id)).toEqual([project.id]);
});
it("uses the configured nickname and refreshes existing and queued origins without losing live output", async () => {
  const { engine, project, store, turns } = await setup();
  const rename = async (name: string) => engine.assistant.rpc("assistant.configure", {
    commandId: `name:${name}`, expectedRevision: engine.assistant.store.get()!.revision, patch: { name },
  });
  await rename("小团");
  const target = await executeAssistantAction(engine.assistant, "named-target", "sessions.create", {
    projectId: project.id, harness: "codex", model: "test",
  }, () => true) as { sessionId: string };
  for (const requestId of ["named-first", "named-queued"]) {
    await executeAssistantAction(engine.assistant, requestId, "sessions.send", {
      projectId: project.id, sessionId: target.sessionId, text: requestId,
    }, () => true);
  }
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(store.session(target.sessionId).session.blocks[0].origin?.assistantName).toBe("小团");
  turns[1].input.onEvent({ type: "message.delta", text: "In-flight progress" });
  await rename("小圆");
  await engine.assistant.tick();
  const current = store.session(target.sessionId);
  expect(current.session.blocks[0].origin?.assistantName).toBe("小圆");
  expect(current.session.queuedMessages?.[0].origin?.assistantName).toBe("小圆");
  expect(current.session.blocks.some(block => block.text === "In-flight progress")).toBe(true);
  expect(current.status).toBe("running");
  await engine.assistant.tick();
  expect(store.session(target.sessionId).revision).toBe(current.revision);
});
it("retains trusted assistant provenance when steering a running target", async () => {
  const { engine, project, store, provider, turns } = await setup();
  provider.steer = vi.fn(async () => {});
  const target = engine.command({
    type: "create",
    commandId: "steer-target",
    projectId: project.id,
    harness: "codex",
    model: "test",
    runtimeMode: "supervised",
  });
  engine.command({
    type: "send",
    commandId: "human-start-steer",
    sessionId: target.sessionId,
    text: "Work",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await executeAssistantAction(
    engine.assistant,
    "guide-target",
    "sessions.steer",
    {
      projectId: project.id,
      sessionId: target.sessionId,
      runId: store.session(target.sessionId).runId,
      text: "Focus on the failing test",
    },
    () => true,
  );
  const block = store.session(target.sessionId).session.blocks.at(-1)!;
  expect(block).toMatchObject({
    role: "user",
    text: "Focus on the failing test",
    origin: {
      kind: "assistant",
      actionId: engine.assistant.store.action("guide-target")!.id,
    },
  });
  expect(provider.steer).toHaveBeenCalledTimes(1);
});
it("revokes queued assistant sends without holding later human messages", async () => {
  const { engine, project, store, turns } = await setup();
  const created = engine.command({
    type: "create",
    commandId: "ordinary",
    projectId: project.id,
    harness: "codex",
    model: "test",
    runtimeMode: "supervised",
  });
  engine.command({
    type: "send",
    commandId: "human-start",
    sessionId: created.sessionId,
    text: "Start",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await executeAssistantAction(
    engine.assistant,
    "queued",
    "sessions.send",
    {
      projectId: project.id,
      sessionId: created.sessionId,
      text: "Assistant queued",
    },
    () => true,
  );
  engine.command({
    type: "send",
    commandId: "human-next",
    sessionId: created.sessionId,
    text: "Human next",
  });
  const policy = fullAssistantPolicy();
  policy.permissions["sessions.send"] = false;
  engine.assistant.store.update({ policy });
  turns[1].finish();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].input.text).toBe("Human next");
  expect(
    store
      .session(created.sessionId)
      .session.blocks.some(
        (b) => b.role === "user" && b.text === "Assistant queued",
      ),
  ).toBe(false);
});
it("blocks forged authors, private brains, wrong projects and revoked permissions", async () => {
  const { engine, project, store } = await setup();
  expect(() =>
    engine.command({
      type: "create",
      commandId: "assistant:forged",
      projectId: project.id,
      harness: "codex",
      model: "test",
      runtimeMode: "full-access",
    }),
  ).toThrow(/reserved/);
  expect(() =>
    engine.command({
      type: "send",
      commandId: "fake",
      sessionId: "anything",
      text: "test",
      origin: { kind: "assistant" },
    }),
  ).toThrow(/reserved/);
  const brain = engine.assistant.store.get()!.brainSessionId!;
  await expect(
    executeAssistantAction(
      engine.assistant,
      "private",
      "sessions.get",
      { projectId: store.session(brain).projectId, sessionId: brain },
      () => true,
    ),
  ).rejects.toThrow(/private/);
  const policy = fullAssistantPolicy();
  policy.permissions["sessions.create"] = false;
  engine.assistant.store.update({ policy });
  await expect(
    executeAssistantAction(
      engine.assistant,
      "denied",
      "sessions.create",
      { projectId: project.id, harness: "codex", model: "test" },
      () => true,
    ),
  ).rejects.toThrow(/Permission/);
});
it("projects replies and necessary inputs without reasoning or tool logs", async () => {
  const { engine, turns } = await setup();
  for (let i = 0; i < 20; i++)
    turns[0].input.onEvent({
      type: "reasoning.delta",
      text: "PRIVATE THOUGHTS",
    });
  turns[0].input.onEvent({ type: "message.delta", text: "Here is the result" });
  turns[0].input.onEvent({ type: "message.completed" });
  const messages = engine.assistant.store.latestMessages();
  expect(messages.filter((m) => m.kind === "assistant")).toHaveLength(1);
  expect(JSON.stringify(messages)).not.toContain("PRIVATE THOUGHTS");
  expect(JSON.stringify(messages)).toContain("Here is the result");
});
it("streams public replies before completion and finalizes the same bubble", async () => {
  const { engine, turns } = await setup();
  turns[0].input.onEvent({ type: "reasoning.delta", text: "PRIVATE" });
  turns[0].input.onEvent({ type: "message.delta", text: "Hello" });
  await vi.waitFor(() =>
    expect(engine.assistant.store.latestMessages()).toContainEqual(
      expect.objectContaining({
        kind: "assistant",
        text: "Hello",
        streaming: true,
      }),
    ),
  );
  const first = engine.assistant.store
    .latestMessages()
    .find((m) => m.kind === "assistant")!;
  turns[0].input.onEvent({ type: "message.delta", text: " world" });
  turns[0].input.onEvent({ type: "message.completed" });
  const replies = engine.assistant.store
    .latestMessages()
    .filter((m) => m.kind === "assistant");
  expect(replies).toEqual([
    expect.objectContaining({
      id: first.id,
      createdAt: first.createdAt,
      text: "Hello world",
      streaming: false,
    }),
  ]);
  expect(replies[0].revision).toBeGreaterThan(first.revision);
  expect(JSON.stringify(engine.assistant.store.messages())).not.toContain(
    "PRIVATE",
  );
});
it("retains partial output and clears streaming when a turn is cancelled", async () => {
  const { engine, turns } = await setup();
  turns[0].input.onEvent({ type: "message.delta", text: "Partial reply" });
  await vi.waitFor(() =>
    expect(engine.assistant.store.latestMessages()).toContainEqual(
      expect.objectContaining({ text: "Partial reply", streaming: true }),
    ),
  );
  await engine.assistant.rpc("assistant.control", {
    commandId: "cancel-stream",
    action: "cancelTurn",
  });
  expect(
    engine.assistant.store
      .latestMessages()
      .filter((m) => m.kind === "assistant"),
  ).toEqual([
    expect.objectContaining({ text: "Partial reply", streaming: false }),
  ]);
});
it("hides a quiet marker even when it arrives in fragments", async () => {
  const { engine, turns } = await setup();
  for (const text of ["  <", "assistant_", "quiet/>"]) {
    turns[0].input.onEvent({ type: "message.delta", text });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(
      engine.assistant.store
        .latestMessages()
        .some((m) => m.kind === "assistant"),
    ).toBe(false);
  }
  turns[0].input.onEvent({ type: "message.completed" });
  expect(
    engine.assistant.store.latestMessages().some((m) => m.kind === "assistant"),
  ).toBe(false);
});
it("does not broadcast unchanged scheduled checks", async () => {
  const { engine, turns } = await setup();
  turns[0].input.onEvent({ type: "message.delta", text: "<assistant_quiet/>" });
  turns[0].input.onEvent({ type: "message.completed" });
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.assistant.store.get()!.brainSessionId &&
        engine.store.session(engine.assistant.store.get()!.brainSessionId!)
          .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  expect(
    engine.assistant.store
      .latestMessages()
      .filter((m) => m.kind === "assistant"),
  ).toHaveLength(0);
});
it("persists pause and stops the brain without cancelling delegated sessions", async () => {
  const { engine, project, store, turns } = await setup();
  const target = (await executeAssistantAction(
    engine.assistant,
    "target",
    "sessions.create",
    { projectId: project.id, harness: "codex", model: "test" },
    () => true,
  )) as { sessionId: string };
  await executeAssistantAction(
    engine.assistant,
    "target-send",
    "sessions.send",
    {
      projectId: project.id,
      sessionId: target.sessionId,
      text: "Continue independently",
    },
    () => true,
  );
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await engine.assistant.rpc("assistant.control", {
    commandId: "pause",
    action: "pause",
  });
  expect(engine.assistant.store.get()!.lifecycle).toBe("paused");
  expect(store.session(target.sessionId).status).toBe("running");
  expect(engine.assistant.environment(target.sessionId)).toEqual({});
});
it("buffers automatic progress and discards the entire unchanged check", async () => {
  const { engine, turns } = await setup();
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  engine.assistant.store.enqueue(
    {
      id: "scheduled-check",
      kind: "schedule",
      text: "Check",
      rootCauseId: "schedule:test",
      state: "pending",
      createdAt: Date.now(),
      attempts: 0,
    },
    "scheduled-check",
  );
  await engine.assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].input.onEvent({ type: "message.delta", text: "I will check" });
  turns[1].input.onEvent({ type: "message.completed" });
  expect(
    engine.assistant.store.latestMessages().some((m) => m.kind === "assistant"),
  ).toBe(false);
  turns[1].input.onEvent({ type: "message.delta", text: "<assistant_quiet/>" });
  turns[1].input.onEvent({ type: "message.completed" });
  turns[1].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  expect(
    engine.assistant.store.latestMessages().some((m) => m.kind === "assistant"),
  ).toBe(false);
});

it("denies every declared action before effects when its permission is off", async () => {
  const { engine, project, provider } = await setup();
  const { ASSISTANT_ACTIONS } = await import("./control");
  const policy = fullAssistantPolicy();
  for (const key of Object.keys(policy.permissions))
    policy.permissions[key as keyof typeof policy.permissions] = false;
  engine.assistant.store.update({ policy });
  // Reminders and habits are governed by the scheduled-check trigger and
  // memory is the assistant's own notebook; none reaches project data.
  for (const action of ASSISTANT_ACTIONS.filter(
    (a) =>
      a !== "actions.get" &&
      !a.startsWith("reminders.") &&
      !a.startsWith("habits.") &&
      !a.startsWith("memory."),
  )) {
    const command =
      action === "git.read"
        ? "git_history"
        : action === "git.action"
          ? "git_commit"
          : action === "git.publish"
            ? "git_push"
            : "read_text_file";
    await expect(
      executeAssistantAction(
        engine.assistant,
        `deny-${action}`,
        action,
        action === "reply.attachments"
          ? { sources: [{ kind: "project-file", projectId: project.id, relativePath: "report.txt" }] }
          : { projectId: project.id, command },
        () => true,
      ),
    ).rejects.toThrow(/Permission/);
  }
  expect(provider.send).toHaveBeenCalledTimes(1);
  expect(engine.assistant.store.actions()).toEqual([]);
});
it("does not expose a saved file result after files.read is revoked", async () => {
  const { engine, project, directory } = await setup();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(directory, "note.txt"), "PRIVATE FILE DATA");
  await executeAssistantAction(
    engine.assistant,
    "read",
    "files.read",
    { projectId: project.id, args: { path: join(directory, "note.txt") } },
    () => true,
  );
  const policy = fullAssistantPolicy();
  policy.permissions["files.read"] = false;
  engine.assistant.store.update({ policy });
  await expect(
    executeAssistantAction(
      engine.assistant,
      "inspect-read",
      "actions.get",
      { requestId: "read" },
      () => true,
    ),
  ).rejects.toThrow(/Permission/);
});
it("rolls back pure database effects when the assistant acceptance or card cannot be saved", async () => {
  const { engine, project, store } = await setup();
  const target = engine.command({
    type: "create",
    commandId: "ordinary-target",
    projectId: project.id,
    harness: "codex",
    model: "test",
    runtimeMode: "supervised",
  });
  const original = store.session(target.sessionId);
  store.db.exec(
    "CREATE TRIGGER fail_acceptance BEFORE UPDATE ON assistant_actions WHEN json_extract(NEW.payload, '$.state')='completed' BEGIN SELECT RAISE(ABORT, 'acceptance failure'); END",
  );
  await expect(
    executeAssistantAction(
      engine.assistant,
      "rename-failed",
      "sessions.update",
      { projectId: project.id, sessionId: target.sessionId, title: "Changed" },
      () => true,
    ),
  ).rejects.toThrow(/acceptance failure/);
  expect(store.session(target.sessionId)).toEqual(original);
  store.db.exec(
    "DROP TRIGGER fail_acceptance; CREATE TRIGGER fail_card BEFORE INSERT ON assistant_messages WHEN json_extract(NEW.payload, '$.kind')='session-card' BEGIN SELECT RAISE(ABORT, 'card failure'); END",
  );
  const count = store.sessions().length;
  await expect(
    executeAssistantAction(
      engine.assistant,
      "create-failed",
      "sessions.create",
      { projectId: project.id, harness: "codex", model: "test" },
      () => true,
    ),
  ).rejects.toThrow(/card failure/);
  expect(store.sessions()).toHaveLength(count);
});

it("respects an external native owner and rejects stale target approvals already handled by a human", async () => {
  const { engine, project, store, provider, turns } = await setup();
  const target = engine.command({
    type: "create",
    commandId: "owned-target",
    projectId: project.id,
    harness: "codex",
    model: "test",
    runtimeMode: "supervised",
  });
  let saved = store.session(target.sessionId);
  const nativeSession = {
    provider: "codex" as const,
    providerSessionId: "native",
    path: join(project.cwd, "native.jsonl"),
    revision: "1",
    blockIds: [],
    createdAt: 1,
    updatedAt: 1,
  };
  store.save(
    {
      ...saved,
      revision: saved.revision + 1,
      session: { ...saved.session, nativeSession },
    },
    {},
  );
  vi.spyOn(engine.native, "cached").mockReturnValue({
    state: "external",
    holder: { provider: "codex", pid: 1234 },
  } as any);
  await expect(
    executeAssistantAction(
      engine.assistant,
      "native-send",
      "sessions.send",
      { projectId: project.id, sessionId: target.sessionId, text: "Work" },
      () => true,
    ),
  ).rejects.toThrow(/open in Codex/);
  expect(provider.send).toHaveBeenCalledTimes(1);
  saved = store.session(target.sessionId);
  store.save(
    {
      ...saved,
      revision: saved.revision + 1,
      session: { ...saved.session, nativeSession: undefined },
    },
    {},
  );
  engine.command({
    type: "send",
    commandId: "human-start-target",
    sessionId: target.sessionId,
    text: "Work",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].input.onEvent({
    type: "approval.requested",
    requestId: 5,
    title: "Run?",
  });
  await vi.waitFor(() =>
    expect(
      store
        .session(target.sessionId)
        .session.blocks.some((b) => b.approval?.requestId === 5),
    ).toBe(true),
  );
  const runId = store.session(target.sessionId).runId!;
  engine.command({
    type: "approve",
    commandId: "human-allow",
    sessionId: target.sessionId,
    runId,
    requestId: 5,
    decision: "allow",
  });
  await expect(
    executeAssistantAction(
      engine.assistant,
      "assistant-too-late",
      "sessions.approve",
      {
        projectId: project.id,
        sessionId: target.sessionId,
        runId,
        requestId: 5,
        decision: "deny",
      },
      () => true,
    ),
  ).rejects.toThrow(/already resolved/);
  await vi.waitFor(() => expect(provider.approve).toHaveBeenCalledTimes(1));
});
it("keeps configuration revisions stable while turns finish and rejects competing saves", async () => {
  const { engine, turns } = await setup();
  const revision = engine.assistant.store.get()!.revision;
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  expect(engine.assistant.store.get()!.revision).toBe(revision);
  const first = {
    commandId: "rename",
    expectedRevision: revision,
    patch: { name: "Helper" },
  };
  expect(await engine.assistant.rpc("assistant.configure", first)).toEqual(
    await engine.assistant.rpc("assistant.configure", first),
  );
  await expect(
    engine.assistant.rpc("assistant.configure", {
      ...first,
      commandId: "competing",
      patch: { name: "Other" },
    }),
  ).rejects.toThrow(/settings changed/);
});
it("preserves public history and creates a different brain when switching agents", async () => {
  const { engine, provider, turns } = await setup();
  const brain = engine.assistant.store.get()!.brainSessionId;
  (engine.providers as any).claude = provider;
  engine.assistant.setCatalog(
    async () => ["codex", "claude"],
    async () => ({
      models: {
        codex: [{ id: "test", name: "Test" }],
        claude: [{ id: "test", name: "Test" }],
      },
      errors: {},
    }),
  );
  await engine.assistant.rpc("assistant.configure", {
    commandId: "switch",
    expectedRevision: engine.assistant.store.get()!.revision,
    patch: { harness: "claude", model: "test" },
  });
  await engine.assistant.rpc("assistant.send", {
    commandId: "after-switch",
    text: "Continue in the new agent",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(engine.assistant.store.get()!.brainSessionId).not.toBe(brain);
  expect(turns[1].input.text).toContain("Continue in the new agent");
  expect(
    engine.assistant.store.latestMessages().filter((m) => m.kind === "user"),
  ).toHaveLength(2);
});
it("responds to necessary brain input idempotently and rejects a competing answer", async () => {
  const { engine, turns, provider } = await setup();
  turns[0].input.onEvent({
    type: "approval.requested",
    requestId: 5,
    title: "Run?",
  });
  const message = engine.assistant.store
    .latestMessages()
    .find((m) => m.kind === "input")!;
  if (message.kind !== "input") throw new Error("Missing input");
  const input = {
    commandId: "allow",
    messageId: message.id,
    brainGeneration: message.brainGeneration,
    runId: message.runId,
    requestId: message.requestId,
    decision: "allow",
  };
  const first = await engine.assistant.rpc("assistant.respond", input);
  expect(await engine.assistant.rpc("assistant.respond", input)).toEqual(first);
  await expect(
    engine.assistant.rpc("assistant.respond", {
      ...input,
      commandId: "competing",
    }),
  ).rejects.toThrow(/no longer pending/);
  await vi.waitFor(() => expect(provider.approve).toHaveBeenCalledTimes(1));
});
it("recovers more than 100 sources durably with bounded, coalesced summaries", async () => {
  const { engine, project, turns } = await setup();
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  engine.assistant.store.update({
    triggers: { user: true, event: true, schedule: false },
  });
  for (let i = 0; i < 125; i++)
    engine.assistant.store.source({
      eventKey: `event-${i}`,
      sessionId: `target-${i}`,
      projectId: project.id,
      kind: "completed",
      rootCauseId: "one-task",
      createdAt: Date.now() - 3000,
    });
  expect(engine.assistant.store.view()?.backlog).toBe(true);
  for (let batch = 0; batch < 3; batch++) {
    await engine.assistant.tick();
    await vi.waitFor(() => expect(turns).toHaveLength(batch + 2));
    expect(
      turns.at(-1)!.input.text.match(/sessionId=target-/g)?.length,
    ).toBeLessThanOrEqual(50);
    turns.at(-1)!.finish();
    await vi.waitFor(() =>
      expect(
        engine.store.session(engine.assistant.store.get()!.brainSessionId!)
          .status,
      ).toBe("idle"),
    );
  }
  await engine.assistant.tick();
  expect(engine.assistant.store.get()!.sourceCursor).toBe(125);
  expect(
    engine.assistant.store.wakeups().filter((w) => w.kind === "event"),
  ).toHaveLength(3);
  expect(engine.assistant.store.pending()).toHaveLength(0);
  expect(engine.assistant.store.view()?.backlog).toBe(false);
});
it("applies automatic chain limits and lets a deliberate user message resume them", async () => {
  const { engine, turns } = await setup();
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  const journal = engine.assistant.store;
  journal.writeChain("root", {
    count: 8,
    paused: false,
    startedAt: Date.now(),
  });
  journal.enqueue(
    {
      id: "loop",
      rootCauseId: "root",
      kind: "event",
      text: "Again",
      state: "pending",
      createdAt: Date.now(),
      attempts: 0,
    },
    "loop",
  );
  await engine.assistant.tick();
  expect(journal.chain("root").paused).toBe(true);
  expect(turns).toHaveLength(1);
  await engine.assistant.rpc("assistant.send", {
    commandId: "explicit",
    text: "Continue this task",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(journal.chain("root").paused).toBe(false);
});
it("uses backoff only when a usage rejection had no partial execution", async () => {
  const { engine, turns } = await setup();
  turns[0].input.onEvent({ type: "usage.limited" });
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  expect(engine.assistant.store.get()!.lifecycle).toBe("backoff");
  expect(engine.assistant.store.wakeups()[0].state).toBe("backoff");
  expect(engine.assistant.store.get()!.nextRetryAt).toBeGreaterThan(Date.now());
});

it("retries a known usage rejection with a new attempt receipt and clears the old limit", async () => {
  const { engine, turns } = await setup();
  const journal = engine.assistant.store;
  turns[0].input.onEvent({ type: "usage.limited" });
  turns[0].finish();
  await vi.waitFor(() =>
    expect(engine.store.session(journal.get()!.brainSessionId!).status).toBe(
      "idle",
    ),
  );
  await engine.assistant.tick();
  const wakeup = journal.wakeups()[0];
  journal.saveWakeup({ ...wakeup, retryAt: Date.now() - 1 });
  await engine.assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(
    engine.store.session(journal.get()!.brainSessionId!).session.usageLimit,
  ).toBeUndefined();
  turns[1].input.onEvent({ type: "message.delta", text: "Recovered" });
  turns[1].input.onEvent({ type: "message.completed" });
  turns[1].finish();
  await vi.waitFor(() =>
    expect(engine.store.session(journal.get()!.brainSessionId!).status).toBe(
      "idle",
    ),
  );
  await engine.assistant.tick();
  expect(journal.get()!.lifecycle).toBe("idle");
  expect(journal.wakeups()[0].state).toBe("completed");
});
it("does not automatically replay a usage rejection after partial execution", async () => {
  const { engine, turns, project } = await setup();
  await executeAssistantAction(
    engine.assistant,
    "partial",
    "sessions.create",
    { projectId: project.id, harness: "codex", model: "test" },
    () => true,
  );
  turns[0].input.onEvent({ type: "usage.limited" });
  turns[0].finish();
  await vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
  await engine.assistant.tick();
  expect(engine.assistant.store.get()!.lifecycle).toBe("interrupted");
  expect(turns).toHaveLength(1);
});
it("keeps a durably accepted target queue running when only the brain is paused", async () => {
  const { engine, project, turns, store } = await setup();
  const target = engine.command({
    type: "create",
    commandId: "paused-target",
    projectId: project.id,
    harness: "codex",
    model: "test",
    runtimeMode: "supervised",
  });
  engine.command({
    type: "send",
    commandId: "first-human",
    sessionId: target.sessionId,
    text: "First turn",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await executeAssistantAction(
    engine.assistant,
    "accepted-queue",
    "sessions.send",
    {
      projectId: project.id,
      sessionId: target.sessionId,
      text: "Accepted follow-up",
    },
    () => true,
  );
  await engine.assistant.rpc("assistant.control", {
    commandId: "pause-brain",
    action: "pause",
  });
  turns[1].finish();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].input.text).toBe("Accepted follow-up");
  expect(
    store.session(target.sessionId).session.blocks.at(-1)?.origin?.kind,
  ).toBe("assistant");
});

const idleBrain = async (engine: HostEngine) =>
  vi.waitFor(() =>
    expect(
      engine.store.session(engine.assistant.store.get()!.brainSessionId!)
        .status,
    ).toBe("idle"),
  );
it("splits a reply into ordered bubbles and only streams the last one", async () => {
  const { engine, turns } = await setup();
  const replies = () =>
    engine.assistant.store
      .latestMessages()
      .filter((m) => m.kind === "assistant");
  turns[0].input.onEvent({ type: "message.delta", text: "Got it<msg_b" });
  await vi.waitFor(() =>
    expect(replies()).toEqual([
      expect.objectContaining({ text: "Got it", streaming: true }),
    ]),
  );
  turns[0].input.onEvent({
    type: "message.delta",
    text: "reak/>Checking now",
  });
  await vi.waitFor(() =>
    expect(replies()).toEqual([
      expect.objectContaining({ text: "Got it", streaming: false }),
      expect.objectContaining({ text: "Checking now", streaming: true }),
    ]),
  );
  turns[0].input.onEvent({ type: "message.completed" });
  turns[0].finish();
  await idleBrain(engine);
  await engine.assistant.tick();
  expect(replies().map((m) => m.kind === "assistant" && m.streaming)).toEqual([
    false,
    false,
  ]);
});
it("keeps promised follow-ups idempotent and fires each due reminder once", async () => {
  const { engine } = await setup();
  const create = { delayMinutes: 30, prompt: "Check the login fix" };
  await expect(
    executeAssistantAction(
      engine.assistant,
      "remind",
      "reminders.create",
      create,
      () => true,
    ),
  ).rejects.toThrow(/disabled/);
  engine.assistant.store.update({
    triggers: { user: true, event: false, schedule: true },
  });
  const first = await executeAssistantAction(
    engine.assistant,
    "remind",
    "reminders.create",
    create,
    () => true,
  );
  expect(
    await executeAssistantAction(
      engine.assistant,
      "remind",
      "reminders.create",
      create,
      () => true,
    ),
  ).toEqual(first);
  expect(engine.assistant.store.get()!.reminders).toHaveLength(1);
  const { enqueueSchedules } = await import("./scheduler");
  const due = engine.assistant.store.get()!.reminders![0].dueAt + 1;
  enqueueSchedules(engine.assistant.store, due);
  enqueueSchedules(engine.assistant.store, due + 60000);
  const fired = engine.assistant.store
    .wakeups()
    .filter((w) => w.text.includes("Check the login fix"));
  expect(fired).toHaveLength(1);
  expect(fired[0]).toMatchObject({ kind: "schedule", state: "pending" });
  expect(engine.assistant.store.get()!.reminders![0].state).toBe("fired");
});
it("lets the user cancel a pending reminder", async () => {
  const { engine } = await setup();
  engine.assistant.store.update({
    triggers: { user: true, event: false, schedule: true },
  });
  const { reminderId } = (await executeAssistantAction(
    engine.assistant,
    "remind",
    "reminders.create",
    { delayMinutes: 5, prompt: "Look again" },
    () => true,
  )) as { reminderId: string };
  await engine.assistant.rpc("assistant.control", {
    commandId: "cancel-reminder",
    action: "cancelReminder",
    reminderId,
  });
  expect(engine.assistant.store.get()!.reminders![0].state).toBe("cancelled");
  await expect(
    engine.assistant.rpc("assistant.control", {
      commandId: "cancel-again",
      action: "cancelReminder",
      reminderId,
    }),
  ).rejects.toThrow(/not pending/);
});
it("delivers a message sent during a running user turn into that turn when steering is supported", async () => {
  const { engine, provider } = await setup({ steer: true });
  const receipt = (await engine.assistant.rpc("assistant.send", {
    commandId: "follow-up",
    text: "Also check the tests",
  })) as { messageId: string; wakeupId: string };
  expect(provider.steer).toHaveBeenCalledWith(
    expect.objectContaining({
      text: expect.stringContaining("Also check the tests"),
    }),
  );
  expect(
    engine.assistant.store
      .latestMessages()
      .find((m) => m.id === receipt.messageId),
  ).toMatchObject({ readAt: expect.any(Number) });
  expect(engine.assistant.store.wakeup(receipt.wakeupId)).toMatchObject({
    state: "completed",
  });
  expect(engine.assistant.store.pending()).toEqual([]);
});
it("keeps IM and client turns separate while merging only follow-ups from the same binding", async () => {
  const { engine, provider, turns } = await setup({ steer: true });
  const input = { commandId: "im-first", text: "From Feishu", bindingId: "owner-one" };
  const [first, duplicate] = await Promise.all([
    engine.assistant.receiveImMessage(input), engine.assistant.receiveImMessage(input),
  ]);
  expect(duplicate).toEqual(first);
  expect(engine.assistant.store.wakeup(first.wakeupId!)?.source).toEqual({ kind: "im", bindingId: "owner-one" });
  expect(provider.steer).not.toHaveBeenCalled();
  expect(engine.assistant.store.wakeup(first.wakeupId!)?.state).toBe("pending");
  await expect(engine.assistant.rpc("assistant.send", { commandId: "spoof", text: "Spoof", source: { kind: "im", bindingId: "owner-one" } })).rejects.toThrow(/Unknown input field/);
  turns[0].finish();
  await idleBrain(engine);
  await engine.assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const followup = await engine.assistant.receiveImMessage({ ...input, commandId: "im-followup", text: "Also check this" });
  expect(provider.steer).toHaveBeenCalledOnce();
  expect(engine.assistant.store.wakeup(followup.wakeupId!)).toMatchObject({ state: "completed", mergedInto: first.wakeupId });
  const otherBinding = await engine.assistant.receiveImMessage({ ...input, commandId: "im-other", bindingId: "owner-two" });
  const client = await engine.assistant.rpc("assistant.send", { commandId: "client-followup", text: "From desktop" }) as { wakeupId: string };
  expect(provider.steer).toHaveBeenCalledOnce();
  expect(engine.assistant.store.wakeup(otherBinding.wakeupId!)?.state).toBe("pending");
  expect(engine.assistant.store.wakeup(client.wakeupId)?.source).toEqual({ kind: "client" });
  turns[1].input.onEvent({ type: "message.delta", text: "Feishu reply" });
  turns[1].input.onEvent({ type: "message.completed" });
  expect(engine.assistant.store.latestMessages()).toContainEqual(expect.objectContaining({ text: "Feishu reply", wakeupId: first.wakeupId, streaming: false }));
});
it("attributes automatic replies and input requests and preserves their source when resumed", async () => {
  const { engine, turns } = await setup();
  turns[0].finish();
  await idleBrain(engine);
  await engine.assistant.tick();
  const journal = engine.assistant.store;
  journal.enqueue({ id: "automatic", kind: "schedule", text: "Check the work", rootCauseId: "schedule:test",
    state: "pending", createdAt: Date.now(), attempts: 0 }, "automatic");
  await engine.assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].input.onEvent({ type: "approval.requested", requestId: 9, title: "Confirm?" });
  expect(journal.latestMessages()).toContainEqual(expect.objectContaining({ kind: "input", wakeupId: "automatic", resolved: false }));
  turns[1].input.onEvent({ type: "message.delta", text: "A meaningful update" });
  turns[1].input.onEvent({ type: "message.completed" });
  turns[1].finish();
  await idleBrain(engine);
  await engine.assistant.tick();
  expect(journal.latestMessages()).toContainEqual(expect.objectContaining({ kind: "assistant", text: "A meaningful update", wakeupId: "automatic", streaming: false }));
  const automatic = journal.wakeup("automatic")!;
  journal.saveWakeup({ ...automatic, state: "interrupted" });
  journal.update({ lifecycle: "interrupted" });
  await engine.assistant.rpc("assistant.control", { commandId: "resume-auto", action: "resume" });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  const resumed = journal.wakeups().find((wakeup) => wakeup.id !== "automatic" && wakeup.rootCauseId === automatic.rootCauseId)!;
  expect(resumed).toMatchObject({ kind: "user", source: { kind: "automatic" } });
});
it("shows the current action as activity and clears it when the turn ends", async () => {
  const { engine, turns } = await setup();
  await executeAssistantAction(
    engine.assistant,
    "look-all",
    "projects.list",
    {},
    () => true,
  );
  expect(engine.assistant.store.get()!.activity).toMatchObject({
    action: "projects.list",
  });
  turns[0].finish();
  await idleBrain(engine);
  await engine.assistant.tick();
  expect(engine.assistant.store.get()!.activity).toBeUndefined();
});
it("validates personality settings and reads older records with defaults", async () => {
  const { engine } = await setup();
  await expect(
    engine.assistant.rpc("assistant.configure", {
      commandId: "bad-persona",
      expectedRevision: engine.assistant.store.get()!.revision,
      patch: { persona: { preset: "pirate", style: "" } },
    }),
  ).rejects.toThrow(/personality/);
  await engine.assistant.rpc("assistant.configure", {
    commandId: "persona",
    expectedRevision: engine.assistant.store.get()!.revision,
    patch: {
      persona: { preset: "partner", style: "Be playful", userName: "Wy" },
      timezone: "Asia/Shanghai",
    },
  });
  expect(engine.assistant.store.view()).toMatchObject({
    persona: { preset: "partner", userName: "Wy" },
    timezone: "Asia/Shanghai",
  });
  const {
    persona: _p,
    timezone: _t,
    reminders: _r,
    ...legacy
  } = engine.assistant.store.get()!;
  engine.assistant.store.write(legacy as never);
  expect(engine.assistant.store.get()).toMatchObject({
    persona: { preset: "secretary", style: "" },
    timezone: "UTC",
    reminders: [],
  });
});
it("rotates an oversized brain into a fresh generation briefed from the chat", async () => {
  const { engine, store, turns } = await setup();
  const first = engine.assistant.store.get()!;
  turns[0].finish();
  await vi.waitFor(() =>
    expect(store.session(first.brainSessionId!).status).toBe("idle"),
  );
  await engine.assistant.tick();
  const brain = store.session(first.brainSessionId!);
  store.save(
    {
      ...brain,
      revision: brain.revision + 1,
      session: {
        ...brain.session,
        providerSessionId: "native-1",
        context: { used: 200_000, window: 400_000 },
      },
    },
    { type: "test.context" },
  );
  await engine.assistant.rpc("assistant.send", {
    commandId: "after-growth",
    text: "Anything new?",
  });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const next = engine.assistant.store.get()!;
  expect(next.brainGeneration).toBe(first.brainGeneration + 1);
  expect(turns[1].input.sessionId).toBe(next.brainSessionId);
  expect(turns[1].input.sessionId).not.toBe(first.brainSessionId);
  expect(turns[1].input.text).toContain("<previous_conversation>");
  expect(turns[1].input.text).toContain("Inspect the projects");
  expect(turns[0].input.text).not.toContain("<previous_conversation>");
});
it("keeps memory across turns and shows it to the brain only when it changes", async () => {
  const { engine, store, turns } = await setup();
  const act = (requestId: string, action: string, input: Record<string, unknown>) =>
    executeAssistantAction(engine.assistant, requestId, action, input, () => true);
  expect(turns[0].input.text).toContain("(Empty. Nothing has been remembered yet.)");
  const fact = { fact: "Prefers pnpm; token=abc123secret" };
  const first = await act("remember", "memory.add", fact);
  expect(await act("remember", "memory.add", fact)).toEqual(first);
  await act("topic", "memory.add", { fact: "Deploys go through staging", topic: "deploys" });
  const memory = engine.assistant.store.memoryDoc("memory").text;
  expect(memory).toMatch(/^- \d{4}-\d{2}-\d{2} · Prefers pnpm; «redacted/);
  expect(memory).not.toContain("abc123secret");
  expect(JSON.stringify(engine.assistant.store.action("remember"))).not.toContain("abc123secret");
  expect(await act("search", "memory.search", { query: "staging deploys" })).toEqual([
    expect.objectContaining({ file: "topic:deploys" }),
  ]);
  const brainId = engine.assistant.store.get()!.brainSessionId!;
  const nextTurn = async (text: string, count: number) => {
    turns.at(-1)!.finish();
    await vi.waitFor(() => expect(store.session(brainId).status).toBe("idle"));
    await engine.assistant.tick();
    await engine.assistant.rpc("assistant.send", { commandId: text, text });
    await vi.waitFor(() => expect(turns).toHaveLength(count));
    return turns[count - 1].input.text;
  };
  const second = await nextTurn("What do I prefer?", 2);
  expect(second).toContain("Prefers pnpm");
  expect(second).toContain("Topic notes: deploys");
  expect(await nextTurn("Thanks", 3)).not.toContain("Your memory (current version");
});
it("lets the user read, add, edit and forget memory without overwriting newer writes", async () => {
  const { engine } = await setup();
  const rpc = engine.assistant.rpc.bind(engine.assistant);
  const read = () =>
    rpc("assistant.memory", {}) as Promise<{
      revision: number;
      facts: { index: number; text: string; struck: boolean }[];
    }>;
  expect(await read()).toEqual({ revision: 0, facts: [], topics: [] });
  await rpc("assistant.control", { commandId: "m1", action: "addMemory", fact: "Works in UTC+8" });
  let memory = await read();
  expect(memory.facts).toEqual([
    expect.objectContaining({ text: "Works in UTC+8", struck: false }),
  ]);
  expect(engine.assistant.store.view()!.memory).toEqual({ revision: 1, lines: 1 });
  const stale = memory.revision;
  await rpc("assistant.control", {
    commandId: "m2",
    action: "editMemory",
    index: memory.facts[0].index,
    fact: "Works in Asia/Shanghai",
    expectedRevision: stale,
  });
  await expect(
    rpc("assistant.control", {
      commandId: "m3",
      action: "forgetMemory",
      index: memory.facts[0].index,
      expectedRevision: stale,
    }),
  ).rejects.toThrow(/changed elsewhere/);
  memory = await read();
  expect(memory.facts.map((fact) => fact.text)).toEqual(["Works in Asia/Shanghai"]);
  await rpc("assistant.control", {
    commandId: "m4",
    action: "forgetMemory",
    index: memory.facts[0].index,
    expectedRevision: memory.revision,
  });
  expect((await read()).facts).toEqual([]);
});
it("keeps habits from the assistant and the user and records each run's outcome", async () => {
  const { engine, store, turns, project } = await setup();
  const assistant = engine.assistant;
  assistant.store.update({ triggers: { user: true, event: false, schedule: true } });
  const created = (await executeAssistantAction(
    assistant,
    "habit",
    "habits.create",
    {
      name: "PR sweep",
      prompt: "Check open PRs",
      schedule: { scheduleKind: "weekdays", time: "09:00" },
    },
    () => true,
  )) as { habitId: string; nextRunAt: number };
  expect(created.nextRunAt).toBeGreaterThan(Date.now());
  await expect(
    executeAssistantAction(
      assistant,
      "habit-bad",
      "habits.create",
      { name: "x", prompt: "y", schedule: { scheduleKind: "monthly" } },
      () => true,
    ),
  ).rejects.toThrow("scheduleKind");
  await assistant.rpc("assistant.control", {
    commandId: "pause",
    action: "updateHabit",
    habitId: created.habitId,
    habit: { enabled: false },
  });
  expect(assistant.store.get()!.habits![0]).toMatchObject({ enabled: false });
  turns[0].finish();
  const brain = assistant.store.get()!.brainSessionId!;
  await vi.waitFor(() => expect(store.session(brain).status).toBe("idle"));
  await assistant.tick();
  await assistant.rpc("assistant.control", {
    commandId: "run-now",
    action: "runHabit",
    habitId: created.habitId,
  });
  await assistant.tick();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].input.text).toContain('Your habit "PR sweep" is due');
  expect(turns[1].input.text).toContain("Habits you keep:");
  turns[1].finish();
  await vi.waitFor(() => expect(store.session(brain).status).toBe("idle"));
  await assistant.tick();
  // The fake provider says nothing, so the run had nothing worth posting.
  expect(assistant.store.get()!.habits![0]).toMatchObject({
    lastOutcome: "quiet",
    lastRunAt: expect.any(Number),
  });
  await assistant.rpc("assistant.control", {
    commandId: "run-with-file", action: "runHabit", habitId: created.habitId,
  });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  writeFileSync(join(project.cwd, "report.txt"), "A report worth sharing");
  const publication = await executeAssistantAction(assistant, "habit-report", "reply.attachments", {
    sources: [{ kind: "project-file", projectId: project.id, relativePath: "report.txt" }],
  }, () => true) as { messageId: string };
  const message = assistant.store.latestMessages().find((entry) => entry.id === publication.messageId)!;
  expect(assistant.store.wakeup(message.wakeupId!)?.source).toEqual({ kind: "automatic" });
  turns[2].input.onEvent({ type: "message.delta", text: "<assistant_quiet/>" });
  turns[2].input.onEvent({ type: "message.completed" });
  turns[2].finish();
  await idleBrain(engine);
  await assistant.tick();
  expect(assistant.store.get()!.habits![0].lastOutcome).toBe("posted");
  await assistant.rpc("assistant.control", {
    commandId: "delete",
    action: "deleteHabit",
    habitId: created.habitId,
  });
  expect(assistant.store.get()!.habits).toEqual([]);
});
