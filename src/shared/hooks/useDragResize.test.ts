// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDragResize } from "./useDragResize";

let container: HTMLDivElement;
let root: Root;
let resize: ReturnType<typeof useDragResize>;
let onCommit: ReturnType<typeof vi.fn>;

function Probe() {
  resize = useDragResize({
    min: 260,
    max: () => 560,
    defaultWidth: 260,
    initial: 260,
    onCommit,
  });
  return createElement(
    "div",
    { ref: resize.setPaneRef, "data-pane": true },
    createElement("div", {
      role: "separator",
      onPointerDown: resize.onPointerDown,
    }),
  );
}

function pane() {
  return container.querySelector<HTMLElement>("[data-pane]")!;
}

function handle() {
  return container.querySelector<HTMLElement>('[role="separator"]')!;
}

function startDrag() {
  act(() =>
    handle().dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: 260,
      }),
    ),
  );
}

function pointer(type: string, clientX: number) {
  act(() =>
    window.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX })),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  onCommit = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(Probe)));
  handle().setPointerCapture = vi.fn();
  handle().releasePointerCapture = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.cursor = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pane drag resizing", () => {
  it("writes width immediately during a normal drag and commits on release", () => {
    startDrag();
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 1, clientX: 390 }),
      );
      expect(pane().style.width).toBe("390px");
      expect(resize.width).toBe(260);
    });
    expect(onCommit).not.toHaveBeenCalled();
    pointer("pointerup", 390);
    expect(resize.width).toBe(390);
    expect(resize.dragging).toBe(false);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(390);
  });

  it("keeps finishDrag stable and finishes at the last valid width", () => {
    const finishDrag = resize.finishDrag;
    document.body.style.cursor = "crosshair";
    startDrag();
    expect(resize.finishDrag).toBe(finishDrag);
    pointer("pointermove", 800);
    expect(pane().style.width).toBe("560px");
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.documentElement.classList.contains("is-resizing")).toBe(true);
    const blockedSelection = new Event("selectstart", { cancelable: true });
    window.dispatchEvent(blockedSelection);
    expect(blockedSelection.defaultPrevented).toBe(true);

    act(() => finishDrag());
    expect(resize.finishDrag).toBe(finishDrag);
    expect(resize.width).toBe(560);
    expect(resize.dragging).toBe(false);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(560);
    expect(handle().releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1);
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.documentElement.classList.contains("is-resizing")).toBe(false);
    expect(document.documentElement.classList.contains("is-reordering")).toBe(false);
    const releasedSelection = new Event("selectstart", { cancelable: true });
    window.dispatchEvent(releasedSelection);
    expect(releasedSelection.defaultPrevented).toBe(false);
  });

  it("does not commit again when finishDrag is called while idle or repeatedly", () => {
    act(() => resize.finishDrag());
    expect(onCommit).not.toHaveBeenCalled();
    startDrag();
    pointer("pointermove", 390);
    act(() => {
      resize.finishDrag();
      resize.finishDrag();
    });
    act(() => resize.finishDrag());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(390);
    expect(handle().releasePointerCapture).toHaveBeenCalledOnce();
  });

  it("ignores later pointer events after an explicit finish", () => {
    startDrag();
    pointer("pointermove", 390);
    act(() => resize.finishDrag());
    pointer("pointermove", 500);
    pointer("pointerup", 500);
    pointer("pointercancel", 500);
    expect(pane().style.width).toBe("390px");
    expect(resize.width).toBe(390);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(390);
  });
});
