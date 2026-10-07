// @vitest-environment happy-dom
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SurfaceVisibilityContext } from "../shared/ui/SurfaceVisibility";
import { useMobileTextareaAutosize } from "./useMobileTextareaAutosize";

let root: Root;
let node: HTMLDivElement;
const observers: { notify: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
let width = 320;
function Field({ value }: { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useMobileTextareaAutosize(ref, value, { minHeight: 28, viewportHeightRatio: 0.25 });
  return createElement("textarea", { ref, value, readOnly: true });
}
function render(value: string, visible = true) {
  act(() => root.render(createElement(SurfaceVisibilityContext.Provider,
    { value: visible }, createElement(Field, { value }))));
  return node.querySelector("textarea")!;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  width = 320;
  observers.length = 0;
  vi.spyOn(HTMLTextAreaElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) {
    return this.value.length > 10 ? (width < 300 ? 120 : 72) : 24;
  });
  vi.spyOn(globalThis, "ResizeObserver").mockImplementation(function (callback) {
    const observer = {
      notify: () => callback([], {} as ResizeObserver),
      disconnect: vi.fn(), observe: vi.fn(), unobserve: vi.fn(),
    };
    observers.push(observer);
    return observer;
  });
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("grows and shrinks using one measuring node without resetting focus or rebuilding observers", () => {
  const clone = vi.spyOn(HTMLTextAreaElement.prototype, "cloneNode");
  const field = render("A multiline draft to measure");
  act(() => field.focus());
  expect(field.style.height).toBe("72px");
  // The browser has already inserted the edit before the controlled value commits.
  field.value = "An edited multiline draft to measure";
  field.setSelectionRange(3, 3);
  render("An edited multiline draft to measure");
  expect(document.activeElement).toBe(field);
  expect(field.selectionStart).toBe(3);
  render("Short");
  expect(field.style.height).toBe("28px");
  expect(clone).toHaveBeenCalledTimes(1);
  expect(observers).toHaveLength(1);
  expect(node.querySelectorAll("textarea")).toHaveLength(1);
  expect(field.style.height).not.toBe("0px");
});

it("ignores height-only observations, rewraps width changes and suspends while the page is hidden", () => {
  const reads = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get");
  const field = render("A multiline draft to measure");
  const initial = reads.mock.calls.length;
  act(() => observers[0].notify());
  expect(reads).toHaveBeenCalledTimes(initial);
  width = 240;
  act(() => observers[0].notify());
  expect(field.style.height).toBe("120px");
  render("A multiline draft to measure", false);
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  const hidden = reads.mock.calls.length;
  render("A changed draft while hidden", false);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(reads).toHaveBeenCalledTimes(hidden);
  render("A changed draft while hidden");
  expect(observers).toHaveLength(2);
  expect(field.style.height).toBe("120px");
});
