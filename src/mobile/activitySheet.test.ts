// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileTranscript } from "./MobileTranscript";
import type { HostSession } from "../features/connections/model/protocol";
import type { Block } from "../features/sessions/model/session";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

const edit = (id: string, path: string): Block => ({
  id,
  role: "tool",
  text: `Edited ${path}`,
  tool: {
    kind: "edit",
    title: `Edited ${path}`,
    status: "completed",
    preview: { kind: "write", path, fileName: path, additions: 2, deletions: 1 },
  },
});
const shell = (id: string, status = "completed"): Block => ({
  id,
  role: "tool",
  text: "bash npm test",
  tool: { kind: "shell", title: "bash npm test", status, detail: "npm test", preview: { kind: "shell", output: "ok" } },
});

function render(blocks: Block[], status: HostSession["status"] = "idle") {
  const node = document.createElement("div");
  node.className = "mobile-app";
  document.body.append(node);
  const snapshot: HostSession = {
    projectId: "project",
    revision: 1,
    status,
    runId: status === "running" ? "run" : undefined,
    updatedAt: 1,
    session: {
      id: "session",
      title: "Test",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks,
    },
  };
  act(() => {
    root = createRoot(node);
    root.render(createElement(MobileTranscript, { snapshot, disabled: false, onCommand: () => {} }));
  });
  return node;
}

const settledTurn: Block[] = [
  { id: "user", role: "user", text: "Fix it", startedAt: 1 },
  edit("a", "a.ts"),
  shell("b"),
  { id: "answer", role: "assistant", text: "Done." },
];
const dialog = () =>
  document.querySelector<HTMLElement>('.mobile-sheet-backdrop:not([inert]) [role="dialog"]');

describe("mobile activity sheet", () => {
  it("opens a settled group's steps in a sheet, then a step's details with a way back", () => {
    const node = render(settledTurn);
    act(() => node.querySelector<HTMLButtonElement>('[aria-label="Show the work"]')!.click());
    const group = node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!;
    expect(group.hasAttribute("aria-expanded")).toBe(false);
    expect(group.textContent).toContain("+2−1");
    act(() => group.click());
    expect(group.nextElementSibling?.getAttribute("data-open")).toBe("false");
    const steps = [...dialog()!.querySelectorAll(".mobile-activity-step")];
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("a.ts"),
      expect.stringContaining("npm test"),
    ]);
    expect(steps[0].querySelector(".mobile-activity-diff")?.textContent).toBe("+2−1");
    act(() => steps[1].querySelector("button")!.click());
    expect(dialog()?.querySelector(".mobile-tool-sheet")).not.toBeNull();
    expect(dialog()?.textContent).toContain("ok");
    const back = [...dialog()!.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.getAttribute("aria-label") === "Back")!;
    act(() => back.click());
    expect(dialog()?.querySelector(".mobile-activity-sheet")).not.toBeNull();
  });

  it("keeps a group with a pending approval inline so it can be answered", () => {
    const node = render([
      { id: "user", role: "user", text: "Fix it", startedAt: 1 },
      edit("a", "a.ts"),
      { ...shell("b", "pending"), approval: { requestId: 3 } },
    ], "running");
    expect(node.querySelector("[data-activity-sheet]")).toBeNull();
    expect([...node.querySelectorAll("button")].some((button) => button.textContent === "Allow")).toBe(true);
  });
});

describe("mobile live turn footer", () => {
  it("shows the project mascot, the current phase and the clock under the live reply", () => {
    const node = render([
      { id: "user", role: "user", text: "Fix it", startedAt: Date.now() - 65_000 },
      edit("a", "a.ts"),
      shell("b", "pending"),
    ], "running");
    const footer = node.querySelector("[data-live-footer]")!;
    expect(footer.querySelector("svg.mascot-active")).not.toBeNull();
    expect(footer.textContent).toMatch(/Running a command…1m \d+s$/);
    // The fold line names the phase; the clock lives only in the footer.
    expect(node.textContent?.match(/1m \d+s/g)).toHaveLength(1);
  });

  it("has no footer once the turn settles", () => {
    const node = render(settledTurn);
    expect(node.querySelector("[data-live-footer]")).toBeNull();
  });
});
