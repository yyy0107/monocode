import { expect, it } from "vitest";
import { importantSources } from "./events";
import type { HostSession } from "../../src/features/connections/model/protocol";
const value = (): HostSession => ({
  projectId: "p",
  revision: 1,
  status: "running",
  updatedAt: 1,
  runId: "r",
  session: {
    id: "s",
    cwd: "/tmp/p",
    title: "Test",
    harness: "codex",
    model: "test",
    modelSettings: {},
    runtimeMode: "supervised",
    blocks: [],
  },
});
it("ignores title, delta and own-brain writes while giving completion a stable key", () => {
  const previous = value();
  const next = {
    ...previous,
    revision: 2,
    lastCompletedRunId: "r",
    status: "idle" as const,
  };
  expect(
    importantSources(previous, {
      ...previous,
      revision: 2,
      session: {
        ...previous.session,
        title: "New",
        blocks: [
          { id: "b", role: "assistant", text: "delta", streaming: true },
        ],
      },
    }),
  ).toEqual([]);
  const source = importantSources(previous, next)[0];
  expect(source).toMatchObject({ kind: "completed", eventKey: "s:done:r" });
  expect(importantSources(next, { ...next, revision: 3 })).toEqual([]);
  expect(
    importantSources(previous, {
      ...next,
      session: { ...next.session, assistantOwnerId: "a" },
    }),
  ).toEqual([]);
});
it("classifies approvals, questions and interrupted native/worker sessions independently", () => {
  const previous = value();
  const approval = {
    ...previous,
    session: {
      ...previous.session,
      orchestrationLeadId: "lead",
      blocks: [
        {
          id: "approval",
          role: "approval" as const,
          text: "Run?",
          approval: { requestId: 2, title: "Run?" },
        },
      ],
    },
  };
  expect(importantSources(previous, approval)[0]?.kind).toBe("approval");
  const question = {
    ...previous,
    session: {
      ...previous.session,
      pendingQuestion: { requestId: 3, questions: [] },
    },
  };
  expect(importantSources(previous, question)[0]?.kind).toBe("question");
  expect(
    importantSources(previous, { ...previous, status: "interrupted" })[0]?.kind,
  ).toBe("interrupted");
});

it("recognizes a failed turn even when a provider status follows its error", () => {
  const previous = value();
  const next: HostSession = {
    ...previous,
    status: "idle",
    lastCompletedRunId: "r",
    session: {
      ...previous.session,
      blocks: [
        { id: "u", role: "user", text: "Work" },
        {
          id: "e",
          role: "system",
          notice: "error",
          text: "Account unavailable",
        },
        { id: "s", role: "system", text: "Provider idle" },
      ],
    },
  };
  expect(importantSources(previous, next)[0]?.kind).toBe("failed");
  next.session.blocks.splice(1, 1);
  expect(importantSources(previous, next)[0]?.kind).toBe("completed");
});
