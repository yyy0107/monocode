// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appendUser, applyHarnessEvent } from "../../../integrations/harness/core/apply";
import type { HarnessEvent } from "../../../integrations/harness/core/types";
import { setUiLanguage } from "../../../shared/i18n/language";
import { applyReducedMotion } from "../../../shared/lib/reducedMotion";
import { newSession, type Session } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";

let node: HTMLDivElement;
let root: Root;
let session: Session;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  session = appendUser(newSession("codex", "/project"), "Fix it");
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  applyReducedMotion("system");
});

function update(event?: HarnessEvent) {
  if (event) session = applyHarnessEvent(session, event);
  act(() => root.render(createElement(AgentTranscript, {
    blocks: session.blocks, busy: true, cwd: session.cwd,
    pendingQuestion: !!session.pendingQuestion,
  })));
}
function tick(seconds: number) {
  act(() => vi.advanceTimersByTime(seconds * 1000));
}
function clock(kind: string, elapsed: string) {
  const footer = node.querySelector<HTMLElement>("[data-live-footer]")!;
  expect(footer.dataset.liveClock).toBe(kind);
  expect(footer.textContent).toMatch(new RegExp(`^${elapsed} · `));
  expect(footer.textContent).not.toContain("Thought for");
}

it("switches between current thought, current tool and whole-turn clocks while ticking", () => {
  update();
  tick(8);
  clock("turn", "8s");

  update({ type: "reasoning.delta", text: "First thought" });
  clock("thinking", "1s");
  tick(3);
  clock("thinking", "3s");
  update({ type: "reasoning.completed" });
  clock("turn", "11s");

  update({ type: "tool.started", callId: "first", title: "Read file", kind: "read", status: "in_progress" });
  clock("tool", "1s");
  tick(2);
  clock("tool", "2s");
  update({ type: "tool.started", callId: "second", title: "Run tests", kind: "shell", status: "in_progress" });
  clock("tool", "1s");
  tick(2);
  clock("tool", "2s");
  update({ type: "tool.updated", callId: "second", status: "completed" });
  clock("tool", "4s");
  update({ type: "tool.updated", callId: "first", status: "completed" });
  clock("turn", "15s");

  update({ type: "reasoning.delta", text: "Second thought" });
  tick(2);
  clock("thinking", "2s");
  update({ type: "reasoning.completed" });
  update({ type: "message.delta", text: "Here is the answer" });
  clock("turn", "17s");
  tick(2);
  clock("turn", "19s");
});

it("continues updating the whole-turn clock while waiting for approval", () => {
  update();
  tick(5);
  update({ type: "approval.requested", requestId: 7, callId: "call", title: "Run tests", kind: "shell" });
  clock("turn", "5s");
  const footer = node.querySelector("[data-live-footer]")!;
  expect(footer.getAttribute("data-live-phase")).toBe("waiting");
  expect(footer.textContent).toContain("Waiting for approval");
  tick(3);
  clock("turn", "8s");
});

it("keeps the current time readable during a digit carry and when motion is disabled", () => {
  update();
  tick(9);
  const timer = node.querySelector('[role="timer"]')!;
  expect(timer.getAttribute("aria-label")).toBe("9s");
  tick(1);
  expect(node.querySelector('[role="timer"]')).toBe(timer);
  expect(timer.getAttribute("aria-label")).toBe("10s");
  expect(timer.textContent).toBe("10s");
  expect(timer.getAttribute("aria-live")).toBe("off");
  act(() => applyReducedMotion("on"));
  expect(timer.querySelector(".rolling-clock-glyph")).toBeNull();
  tick(1);
  expect(timer.getAttribute("aria-label")).toBe("11s");
  expect(timer.textContent).toBe("11s");
  expect(timer.querySelector(".rolling-clock-glyph")).toBeNull();
});
