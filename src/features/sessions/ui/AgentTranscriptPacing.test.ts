// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function tool(id: string): Block {
  return {
    id,
    role: "tool",
    text: `Run ${id}`,
    tool: { kind: "shell", status: "in_progress" },
  };
}

function render(blocks: Block[]) {
  act(() =>
    root.render(createElement(AgentTranscript, { blocks, busy: true })),
  );
}

function stages() {
  return [...container.querySelectorAll(".zen-phase-step")].map((step) =>
    step.hasAttribute("data-waiting")
      ? "waiting"
      : step.hasAttribute("data-entering")
        ? "entering"
        : "settled",
  );
}

it("paces a burst of tool calls so each enters after the one before it", () => {
  const head: Block[] = [
    { id: "user", role: "user", text: "Review the diff" },
    { id: "intro", role: "assistant", text: "Checking the repo first." },
    tool("first"),
  ];
  render(head);
  render([...head, tool("second"), tool("third"), tool("fourth")]);

  // What was on screen when the group mounted is history; the burst queues.
  expect(stages()).toEqual(["settled", "entering", "waiting", "waiting"]);

  // Later renders must not cut the queue short.
  render([...head, tool("second"), tool("third"), tool("fourth")]);
  expect(stages()).toEqual(["settled", "entering", "waiting", "waiting"]);

  act(() => vi.advanceTimersByTime(480));
  expect(stages()).toEqual(["settled", "entering", "entering", "waiting"]);

  act(() => vi.advanceTimersByTime(480));
  expect(stages()).toEqual(["settled", "entering", "entering", "entering"]);
});

it("keeps a closing phase inert until motion ends and supports rapid reopening", () => {
  render([
    { id: "user", role: "user", text: "Review the diff" },
    { id: "intro", role: "assistant", text: "Checking the repo first." },
    tool("first"),
    tool("second"),
  ]);
  const body = container.querySelector<HTMLElement>(".zen-phase-body")!;
  const toggle = body.previousElementSibling as HTMLButtonElement;
  const content = body.querySelector<HTMLElement>(".zen-fold-item")!;
  const steps = [...body.querySelectorAll(".zen-phase-step")];
  expect(steps).toHaveLength(2);

  act(() => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(content.dataset.foldState).toBe("closing");
  expect(content.inert).toBe(true);
  expect(content.getAttribute("aria-hidden")).toBe("true");
  expect([...body.querySelectorAll(".zen-phase-step")]).toEqual(steps);

  act(() => vi.advanceTimersByTime(200));
  act(() => toggle.click());
  // Passing the original close deadline must not remove reopened content.
  act(() => vi.advanceTimersByTime(150));
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(content.dataset.foldState).toBe("opening");
  expect(content.inert).toBe(false);
  expect(content.hasAttribute("aria-hidden")).toBe(false);
  expect(body.querySelector(".zen-fold-item")).toBe(content);
  expect([...body.querySelectorAll(".zen-phase-step")]).toEqual(steps);

  act(() => toggle.click());
  expect(content.dataset.foldState).toBe("closing");
  expect(body.contains(steps[0])).toBe(true);
  act(() => content.dispatchEvent(new Event("animationend", { bubbles: true })));
  expect(body.querySelector(".zen-fold-item")).toBeNull();
  expect(body.querySelector(".zen-phase-step")).toBeNull();
});

it("reveals the desktop's Chinese reply character by character through the shared renderer", () => {
  const user: Block = { id: "user", role: "user", text: "Reply in Chinese" };
  const text =
    "手机端和桌面端现在都会逐字展示中文输出，已经显示的文字不会随着后续消息重新播放。";
  render([user, { id: "reply", role: "assistant", text: "", streaming: true }]);
  render([user, { id: "reply", role: "assistant", text, streaming: true }]);
  expect(container.querySelector(".agent-markdown")?.textContent).toBe("");
  act(() => vi.advanceTimersByTime(100));
  const partial = container.querySelector(".agent-markdown")?.textContent ?? "";
  expect(partial.length).toBeGreaterThan(0);
  expect(partial.length).toBeLessThan(text.length);
  expect(text.startsWith(partial)).toBe(true);
  render([user, { id: "reply", role: "assistant", text, streaming: false }]);
  act(() => vi.advanceTimersByTime(2000));
  expect(container.querySelector(".agent-markdown")?.textContent).toBe(text);
});
