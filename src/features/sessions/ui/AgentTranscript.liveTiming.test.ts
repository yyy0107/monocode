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
  session.blocks[0].id = "clock";
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
function noClock() {
  const footer = node.querySelector<HTMLElement>("[data-live-footer]")!;
  expect(footer.querySelector('[role="timer"]')).toBeNull();
  expect(footer.dataset.liveClock).toBeUndefined();
  expect(footer.textContent).not.toMatch(/^\d+[smh] · /);
}

it("ticks each response round and resets on new replies and completed tool batches", () => {
  update();
  tick(8);
  noClock();

  update({ type: "reasoning.delta", text: "First thought" });
  noClock();
  tick(3);
  clock("thinking", "3s");
  update({ type: "reasoning.completed" });
  noClock();

  update({ type: "tool.started", callId: "first", title: "Read file", kind: "read", status: "in_progress" });
  noClock();
  tick(2);
  clock("tool", "2s");
  update({ type: "tool.started", callId: "second", title: "Run tests", kind: "shell", status: "in_progress" });
  noClock();
  tick(2);
  clock("tool", "2s");
  update({ type: "tool.updated", callId: "second", status: "completed" });
  clock("tool", "4s");
  update({ type: "tool.updated", callId: "first", status: "completed" });
  noClock();
  tick(2);
  noClock();

  update({ type: "reasoning.delta", text: "Second thought" });
  tick(2);
  clock("thinking", "2s");
  update({ type: "reasoning.completed" });
  noClock();
  update({ type: "message.delta", text: "Here is the answer" });
  noClock();
  tick(2);
  clock("round", "2s");
  const timer = node.querySelector('[role="timer"]');
  const motion = timer?.getAttribute("data-motion");
  update({ type: "message.delta", text: ". More details" });
  clock("round", "2s");
  expect(node.querySelector('[role="timer"]')).toBe(timer);
  expect(timer?.getAttribute("data-motion")).toBe(motion);
  update({ type: "message.completed" });
  noClock();
  tick(3);
  noClock();
  update({ type: "message.delta", text: "Another response" });
  noClock();
  expect(node.querySelector(".rolling-clock-glyph")).toBeNull();
  tick(2);
  noClock();
});

it("keeps approval waits text-only without a ticking clock", () => {
  update();
  tick(50);
  update({ type: "message.delta", text: "Please approve this command" });
  tick(5);
  update({ type: "approval.requested", requestId: 7, callId: "call", title: "Run tests", kind: "shell" });
  noClock();
  const footer = node.querySelector("[data-live-footer]")!;
  expect(footer.getAttribute("data-live-phase")).toBe("waiting");
  expect(footer.textContent).toContain("Waiting for approval");
  tick(3);
  noClock();
});

it("keeps the current time readable during a digit carry and when motion is disabled", () => {
  update({ type: "reasoning.delta", text: "Thinking through the fix" });
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
