// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileTranscript } from "./MobileTranscript";
import type { HostSession } from "../features/connections/model/protocol";
import type { Block } from "../features/sessions/model/session";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

function render(blocks: Block[], status: HostSession["status"] = "idle", readBinaryFile?: (path: string) => Promise<Uint8Array>) {
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
    root.render(createElement(MobileTranscript, { snapshot, disabled: false, onCommand: () => {}, readBinaryFile }));
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
const currentPage = () => dialog()!.querySelector<HTMLElement>('[data-page-active="true"]')!;
const finishNavigation = () => act(() => vi.advanceTimersByTime(240));

describe("mobile activity sheet", () => {
  it("opens a settled group's steps in a sheet, then a step's details with a way back", () => {
    const node = render(settledTurn);
    // The turn's fold line is the one tap between the answer and its steps.
    const fold = node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!;
    expect(fold.getAttribute("aria-label")).toBe("Show the work");
    expect(fold.hasAttribute("aria-expanded")).toBe(false);
    expect(fold.textContent).toContain("+2−1");
    act(() => fold.click());
    const sheet = dialog()!;
    sheet.dataset.detent = "full";
    sheet.style.transform = "translateY(0px)";
    const scroll = currentPage().querySelector<HTMLElement>("[data-mobile-page-scroll]")!;
    scroll.scrollTop = 180;
    scroll.dispatchEvent(new Event("scroll"));
    expect(node.querySelector(".mobile-session-row, .zen-phase-body")).toBeNull();
    const steps = [...dialog()!.querySelectorAll(".mobile-activity-step")];
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("a.ts"),
      expect.stringContaining("npm test"),
    ]);
    expect(steps[0].querySelector(".mobile-activity-diff")?.textContent).toBe("+2−1");
    act(() => steps[1].querySelector("button")!.click());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog()).toBe(sheet);
    expect(sheet.dataset.detent).toBe("full");
    expect(sheet.style.transform).toBe("translateY(0px)");
    expect(currentPage().style.getPropertyValue("--mobile-page-offset")).toBe("100%");
    const outgoing = sheet.querySelector('[data-page-active="false"]')!;
    expect(outgoing.hasAttribute("inert")).toBe(true);
    expect(outgoing.getAttribute("aria-hidden")).toBe("true");
    expect(dialog()?.querySelector(".mobile-tool-sheet")).not.toBeNull();
    expect(dialog()?.textContent).toContain("ok");
    finishNavigation();
    expect(sheet.querySelector(".mobile-activity-sheet")).toBeNull();
    const back = [...currentPage().querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.getAttribute("aria-label") === "Back")!;
    act(() => back.click());
    expect(dialog()).toBe(sheet);
    expect(currentPage().style.getPropertyValue("--mobile-page-offset")).toBe("-100%");
    expect(currentPage().querySelector<HTMLElement>("[data-mobile-page-scroll]")!.scrollTop).toBe(180);
    expect(sheet.querySelector(".mobile-tool-sheet")).not.toBeNull();
    finishNavigation();
    expect(sheet.querySelector(".mobile-tool-sheet")).toBeNull();
    expect(dialog()?.querySelector(".mobile-activity-sheet")).not.toBeNull();
  });

  it("reverses immediately inside the same sheet and keeps keyboard focus on the active page", () => {
    const node = render(settledTurn);
    act(() => node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!.click());
    const sheet = dialog();
    const list = currentPage();
    const step = list.querySelectorAll<HTMLButtonElement>(".mobile-activity-step > button")[1];
    act(() => step.click());
    const back = currentPage().querySelector<HTMLButtonElement>('[aria-label="Back"]')!;
    expect(document.activeElement).toBe(back);
    act(() => back.click());
    expect(currentPage()).toBe(list);
    act(() => step.click());
    expect(dialog()).toBe(sheet);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const buttons = currentPage().querySelectorAll<HTMLButtonElement>("button");
    act(() => {
      buttons[buttons.length - 1].focus();
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(buttons[0]);
    finishNavigation();
    expect(sheet!.querySelectorAll(".mobile-page-layer")).toHaveLength(1);
    expect(currentPage().querySelector(".mobile-tool-sheet")).not.toBeNull();
  });

  it("switches without retaining an outgoing page when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const node = render(settledTurn);
    act(() => node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!.click());
    const sheet = dialog();
    act(() => currentPage().querySelector<HTMLButtonElement>(".mobile-activity-step > button")!.click());
    expect(dialog()).toBe(sheet);
    expect(sheet!.querySelectorAll(".mobile-page-layer")).toHaveLength(1);
    expect(currentPage().hasAttribute("data-page-motion")).toBe(false);
    act(() => currentPage().querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());
    expect(currentPage().querySelector(".mobile-activity-sheet")).not.toBeNull();
    expect(sheet!.querySelectorAll(".mobile-page-layer")).toHaveLength(1);
  });

  it("preserves the route back to the activity list after viewing a tool's file", async () => {
    const node = render(settledTurn, "idle", async () => new TextEncoder().encode("export const value = 1;"));
    act(() => node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!.click());
    act(() => currentPage().querySelector<HTMLButtonElement>(".mobile-activity-step > button")!.click());
    finishNavigation();
    const viewFile = [...currentPage().querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "View file")!;
    await act(async () => viewFile.click());
    finishNavigation();
    expect(dialog()!.querySelector(".mobile-file-sheet")).not.toBeNull();
    act(() => dialog()!.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());
    finishNavigation();
    expect(currentPage().querySelector(".mobile-tool-sheet")).not.toBeNull();
    act(() => currentPage().querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());
    finishNavigation();
    expect(currentPage().querySelectorAll(".mobile-activity-step")).toHaveLength(2);
  });

  it("opens a live group's steps from its header while the turn runs", () => {
    const node = render([
      { id: "user", role: "user", text: "Fix it", startedAt: Date.now() },
      edit("a", "a.ts"),
      shell("b", "pending"),
    ], "running");
    const group = node.querySelector<HTMLButtonElement>("[data-activity-sheet]")!;
    expect(group.getAttribute("aria-haspopup")).toBe("dialog");
    act(() => group.click());
    const running = dialog()!.querySelectorAll(".mobile-activity-step")[1];
    expect(running.querySelector(".mobile-spin")).not.toBeNull();
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
  it("shows the project mascot and the current phase under the live reply", () => {
    const node = render([
      { id: "user", role: "user", text: "Fix it", startedAt: Date.now() - 65_000 },
      edit("a", "a.ts"),
      shell("b", "pending"),
    ], "running");
    const footer = node.querySelector("[data-live-footer]")!;
    expect(footer.querySelector("svg.mascot-active")).not.toBeNull();
    expect(footer.textContent).toBe("Edited a.ts · Running a command…");
    // The clock only shows while the agent thinks, and never on the fold line.
    expect(node.textContent).not.toMatch(/1m \d+s/);
  });

  it("has no footer once the turn settles", () => {
    const node = render(settledTurn);
    expect(node.querySelector("[data-live-footer]")).toBeNull();
  });
});
