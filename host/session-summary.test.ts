import { afterEach, describe, expect, it } from "vitest";
import type { HostSession } from "../src/features/connections/model/protocol";
import { HostStore, summary } from "./store";

function snapshot(): HostSession {
  return {
    projectId: "project",
    revision: 1,
    status: "running",
    createdAt: 50,
    updatedAt: 200,
    session: {
      id: "session",
      title: "Conversation",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks: [
        { id: "first", role: "user", text: "First", startedAt: 80 },
        { id: "last", role: "user", text: "Last", startedAt: 100 },
      ],
    },
  };
}

let store: HostStore | undefined;
afterEach(() => {
  store?.close();
  store = undefined;
});

describe("session summary send timestamps", () => {
  it("distinguishes provider input IDs reused in another run", () => {
    const first = snapshot();
    first.runId = "first-run";
    first.session.pendingQuestion = { requestId: 1, questions: [] };
    const second = { ...first, runId: "second-run" };
    expect(summary(first).pendingInputKey).toBe("first-run:question:1");
    expect(summary(second).pendingInputKey).toBe("second-run:question:1");
  });
  it("separates incoming reply revisions from outgoing messages, queue edits and metadata", () => {
    store = new HostStore(":memory:");
    const project = store.addProject("/project", "Project");
    let current = store.save(
      { ...snapshot(), projectId: project.id },
      { type: "send" },
    );
    expect(store.summaries()[0].lastReplyRevision).toBeNull();
    current = store.save(
      {
        ...current,
        revision: 2,
        session: {
          ...current.session,
          blocks: [
            ...current.session.blocks,
            {
              id: "reply",
              role: "assistant",
              text: "New reply",
              streaming: true,
            },
          ],
        },
      },
      { type: "output" },
    );
    expect(store.summaries()[0].lastReplyRevision).toBe(2);
    store.updateSession(current.session.id, { title: "Renamed", pinned: true });
    current = store.session(current.session.id);
    expect(store.summaries()[0].lastReplyRevision).toBe(2);
    current = store.save(
      {
        ...current,
        revision: current.revision + 1,
        session: {
          ...current.session,
          queuedMessages: [{ id: "queue", text: "Later", attachments: [] }],
          blocks: [
            ...current.session.blocks,
            { id: "reasoning", role: "reasoning", text: "Thinking" },
            { id: "tool", role: "tool", text: "Working" },
          ],
        },
      },
      { type: "queue" },
    );
    expect(store.summaries()[0].lastReplyRevision).toBe(2);
    current = store.save(
      {
        ...current,
        revision: current.revision + 1,
        lastCompletedRunId: "finished-run",
      },
      { type: "settled" },
    );
    expect(store.summaries()[0]).toMatchObject({
      lastReplyRevision: current.revision,
      lastCompletedRunId: "finished-run",
    });
    const finishedRevision = current.revision;
    current = store.save(
      {
        ...current,
        revision: current.revision + 1,
        status: "running",
        runId: "queued-run",
      },
      { type: "send" },
    );
    expect(store.summaries()[0]).toMatchObject({
      lastReplyRevision: finishedRevision,
      lastCompletedRunId: "finished-run",
    });
  });

  it("records new questions and approvals but does not mark their resolution as a new reply", () => {
    store = new HostStore(":memory:");
    const project = store.addProject("/project", "Project");
    let current = store.save(
      { ...snapshot(), projectId: project.id },
      { type: "send" },
    );
    current = store.save(
      {
        ...current,
        revision: 2,
        session: {
          ...current.session,
          pendingQuestion: {
            requestId: 1,
            questions: [
              {
                id: "question",
                prompt: "Continue?",
                options: [],
                multiSelect: false,
                allowCustom: false,
              },
            ],
          },
        },
      },
      { type: "question" },
    );
    expect(store.summaries()[0]).toMatchObject({
      lastReplyRevision: 2,
      pendingInputKey: "question:1",
    });
    current = store.save(
      {
        ...current,
        revision: 3,
        session: { ...current.session, pendingQuestion: undefined },
      },
      { type: "answer" },
    );
    expect(store.summaries()[0]).toMatchObject({
      lastReplyRevision: 2,
      pendingInputKey: null,
    });
    current = store.save(
      {
        ...current,
        revision: 4,
        session: {
          ...current.session,
          blocks: [
            ...current.session.blocks,
            {
              id: "approval",
              role: "approval",
              text: "Approve",
              approval: { requestId: 2 },
            },
          ],
        },
      },
      { type: "approval" },
    );
    expect(store.summaries()[0]).toMatchObject({
      lastReplyRevision: 4,
      pendingInputKey: "approval:2",
    });
  });

  it("uses the last submitted user message and ignores output, drafts and internal messages", () => {
    const value = snapshot();
    value.session.blocks.push(
      { id: "assistant", role: "assistant", text: "Output", startedAt: 150 },
      {
        id: "draft",
        role: "user",
        text: "Unsent",
        draft: true,
        startedAt: 160,
      },
      {
        id: "internal",
        role: "user",
        text: "Continue",
        internal: true,
        startedAt: 170,
      },
    );
    expect(summary(value).lastUserMessageAt).toBe(100);
    value.session.blocks.push({
      id: "steer",
      role: "user",
      text: "Correction",
      sentAt: 180,
    });
    expect(summary(value).lastUserMessageAt).toBe(180);
  });

  it("previews the latest visible answer as one truncated plain line", () => {
    const value = snapshot();
    expect(summary(value).preview).toBeUndefined();
    value.session.blocks.push(
      { id: "answer", role: "assistant", text: "## Done\n\nUpdated **two** files." },
      { id: "hidden", role: "assistant", text: "Internal note", internal: true },
    );
    expect(summary(value).preview).toBe("Done");
    value.session.blocks.push({ id: "long", role: "assistant", text: "x".repeat(400) });
    const preview = summary(value).preview!;
    expect(preview).toHaveLength(160);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("reports an unknown timestamp for legacy user messages and empty conversations", () => {
    const value = snapshot();
    for (const startedAt of [undefined, 0, NaN]) {
      value.session.blocks.push({
        id: "legacy",
        role: "user",
        text: "Legacy",
        startedAt,
      });
      expect(summary(value).lastUserMessageAt).toBeNull();
    }
    value.session.blocks = [];
    expect(summary(value).lastUserMessageAt).toBeNull();
  });

  it("keeps the persisted summary send time unchanged across output and metadata saves", () => {
    store = new HostStore(":memory:");
    const project = store.addProject("/project", "Project");
    const initial = store.save(
      { ...snapshot(), projectId: project.id },
      { type: "send" },
    );
    store.save(
      {
        ...initial,
        revision: 2,
        updatedAt: 1_000,
        session: {
          ...initial.session,
          blocks: [
            ...initial.session.blocks,
            { id: "answer", role: "assistant", text: "Streaming output" },
          ],
        },
      },
      { type: "output" },
    );
    store.updateSession(initial.session.id, { title: "Renamed" });
    expect(store.summaries(project.id)[0]).toMatchObject({
      updatedAt: 1_000,
      lastUserMessageAt: 100,
      title: "Renamed",
    });
    const current = store.session(initial.session.id);
    store.save(
      {
        ...current,
        revision: current.revision + 1,
        updatedAt: 2_000,
        session: {
          ...current.session,
          blocks: [
            ...current.session.blocks,
            {
              id: "follow-up",
              role: "user",
              text: "Follow-up",
              startedAt: 2_000,
            },
          ],
        },
      },
      { type: "send" },
    );
    expect(store.summaries(project.id)[0].lastUserMessageAt).toBe(2_000);
  });

  it.each([100, null])(
    "backfills older cached summaries once, including timestamp %s",
    (timestamp) => {
      store = new HostStore(":memory:");
      const project = store.addProject("/project", "Project");
      const value = snapshot();
      if (timestamp === null) value.session.blocks = [];
      store.save({ ...value, projectId: project.id }, { type: "legacy" });
      const legacy = { ...store.summaries(project.id)[0] };
      delete legacy.lastUserMessageAt;
      store.db
        .prepare("UPDATE sessions SET summary=? WHERE id=?")
        .run(JSON.stringify(legacy), value.session.id);
      expect(store.summaries(project.id)[0].lastUserMessageAt).toBe(timestamp);
      const repaired = store.db
        .prepare("SELECT summary FROM sessions WHERE id=?")
        .get(value.session.id)!;
      expect(JSON.parse(String(repaired.summary)).lastUserMessageAt).toBe(
        timestamp,
      );
      expect(store.summaries(project.id)[0].lastUserMessageAt).toBe(timestamp);
    },
  );
});
