import { afterEach, describe, expect, it } from "vitest";
import type { HostSession } from "../src/features/connections/model/protocol";
import { HostStore } from "./store";

function snapshot(projectId: string, id: string, assistantOwnerId?: string): HostSession {
  return {
    projectId,
    revision: 1,
    status: "idle",
    createdAt: 1,
    updatedAt: 2,
    session: {
      id,
      title: "Conversation",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks: [{ id: "u", role: "user", text: "Hello", startedAt: 1 }],
      ...(assistantOwnerId ? { assistantOwnerId } : {}),
    },
  };
}

let store: HostStore | undefined;
afterEach(() => {
  store?.close();
  store = undefined;
});

describe("host store reads", () => {
  it("lists summaries from covering indexes instead of session snapshots", () => {
    store = new HostStore(":memory:");
    const plan = (sql: string) =>
      store!.db
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all("x")
        .map((row) => String(row.detail))
        .join("\n");
    expect(plan("SELECT id, summary FROM sessions WHERE project_id=?")).toContain(
      "COVERING INDEX sessions_project_summary",
    );
    expect(
      store.db
        .prepare("EXPLAIN QUERY PLAN SELECT id, summary FROM sessions")
        .all()
        .map((row) => String(row.detail))
        .join("\n"),
    ).toContain("COVERING INDEX");
  });

  it("keeps the assistant privacy check exact, including ids created after a miss", () => {
    store = new HostStore(":memory:");
    const project = store.addProject("/project", "Project");
    store.save(snapshot(project.id, "plain"), { type: "send" });
    expect(store.isAssistantSession("plain")).toBe(false);
    expect(store.isAssistantSession("brain")).toBe(false);
    store.save(snapshot(project.id, "brain", "assistant"), { type: "send" });
    expect(store.isAssistantSession("brain")).toBe(true);
    expect(store.isAssistantSession("brain")).toBe(true);
    expect(store.isAssistantSession("plain")).toBe(false);
  });
});
