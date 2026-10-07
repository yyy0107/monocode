import { describe, expect, it } from "vitest";
import type { Block, TaskListItem } from "./session";
import {
  buildSessionStatusPanelModel,
  focusedTaskWindow,
  sessionStatusSummary,
} from "./sessionStatusPanel";

const tasks = (id: string, items: TaskListItem[]): Block => ({
  id,
  role: "tasks",
  text: "",
  taskList: { items },
});
const agent = (id: string, status: string): Block => ({
  id,
  role: "tool",
  text: "Agent",
  tool: { kind: "Agent", title: "Agent", status },
  agentRun: { name: "Review the diff", steps: [] },
});

describe("session status panel", () => {
  it("is empty for a session with nothing to report", () => {
    expect(
      buildSessionStatusPanelModel({ blocks: [], busy: false }).hasContent,
    ).toBe(false);
  });

  it("uses the latest task list and hides a finished one once idle", () => {
    const blocks = [
      tasks("old", [{ text: "Old", status: "pending" }]),
      tasks("new", [{ text: "Done", status: "completed" }]),
    ];
    expect(
      buildSessionStatusPanelModel({ blocks, busy: true }).tasks?.[0].text,
    ).toBe("Done");
    expect(buildSessionStatusPanelModel({ blocks, busy: false }).tasks).toBe(
      null,
    );
  });

  it("lists only subagents that are still running", () => {
    const model = buildSessionStatusPanelModel({
      blocks: [agent("a", "completed"), agent("b", "in_progress")],
      busy: true,
    });
    expect(model.subagents.map((run) => run.blockId)).toEqual(["b"]);
  });

  it("ignores a zero diff and prefers the current task over git", () => {
    expect(
      buildSessionStatusPanelModel({
        blocks: [],
        busy: false,
        git: { additions: 0, deletions: 0 },
      }).git,
    ).toBe(null);
    const model = buildSessionStatusPanelModel({
      blocks: [
        tasks("t", [
          { text: "Ship", status: "completed" },
          { text: "Verify", status: "in_progress" },
        ]),
      ],
      busy: true,
      git: { additions: 3, deletions: 1 },
    });
    expect(sessionStatusSummary(model)).toEqual({
      kind: "task",
      text: "Verify",
      status: "current",
    });
    expect(sessionStatusSummary({ ...model, tasks: null })).toMatchObject({
      kind: "git",
    });
  });

  it("focuses long task lists around the active item", () => {
    const items: TaskListItem[] = Array.from({ length: 8 }, (_, i) => ({
      text: String(i),
      status: i < 4 ? "completed" : i === 4 ? "in_progress" : "pending",
    }));
    expect(focusedTaskWindow(items)).toEqual({ start: 3, end: 6 });
    expect(focusedTaskWindow(items.slice(0, 6))).toEqual({ start: 0, end: 6 });
  });

  it("keeps binary and mode-only file changes visible when no lines changed", () => {
    const model = buildSessionStatusPanelModel({ blocks: [], busy: false,
      git: { additions: 0, deletions: 0, files: 1 } });
    expect(model.hasContent).toBe(true);
    expect(sessionStatusSummary(model)).toMatchObject({ kind: "git" });
  });
});
