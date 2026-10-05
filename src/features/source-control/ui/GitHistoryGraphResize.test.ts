// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GraphResizeSash } from "./GitHistoryGraph";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render() {
  const onHeightPaint = vi.fn();
  const onHeightCommit = vi.fn();
  act(() =>
    root.render(
      createElement(GraphResizeSash, {
        height: 240,
        maxHeight: () => 400,
        onHeightPaint,
        onHeightCommit,
      }),
    ),
  );
  const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
  const capture = new Set<number>();
  handle.setPointerCapture = (id) => capture.add(id);
  handle.releasePointerCapture = (id) => capture.delete(id);
  return { handle, capture, onHeightPaint, onHeightCommit };
}

function pointer(
  target: EventTarget,
  type: string,
  clientY: number,
  pointerId = 1,
) {
  act(() =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerId,
        clientY,
      }),
    ),
  );
}

it("resizes through the shared target, ignores other pointers and commits a clamped height", () => {
  const { handle, capture, onHeightPaint, onHeightCommit } = render();
  const previousCursor = document.body.style.cursor;
  expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
  expect(handle.getAttribute("aria-valuenow")).toBe("240");
  pointer(handle, "pointerdown", 300);
  expect(
    document.documentElement.style.getPropertyValue("--resize-cursor"),
  ).toBe("row-resize");
  pointer(window, "pointermove", 260, 2);
  expect(onHeightPaint).not.toHaveBeenCalled();
  pointer(window, "pointermove", 260);
  expect(onHeightPaint).toHaveBeenLastCalledWith(280);
  pointer(window, "pointermove", 0);
  expect(onHeightPaint).toHaveBeenLastCalledWith(400);
  pointer(window, "pointerup", 0);
  expect(onHeightCommit).toHaveBeenCalledExactlyOnceWith(400);
  expect(capture.has(1)).toBe(false);
  expect(document.body.style.cursor).toBe(previousCursor);
  expect(document.documentElement.classList.contains("is-resizing")).toBe(
    false,
  );
  expect(
    document.documentElement.style.getPropertyValue("--resize-cursor"),
  ).toBe("");
});

it("retains the minimum height and double-click reset", () => {
  const { handle, onHeightPaint, onHeightCommit } = render();
  pointer(handle, "pointerdown", 300);
  pointer(window, "pointermove", 900);
  expect(onHeightPaint).toHaveBeenLastCalledWith(120);
  pointer(window, "pointerup", 900);
  expect(onHeightCommit).toHaveBeenLastCalledWith(120);
  act(() =>
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  expect(onHeightCommit).toHaveBeenLastCalledWith(240);
});
