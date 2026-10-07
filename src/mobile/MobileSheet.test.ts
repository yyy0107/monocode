// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYBOARD_EVENT, installKeyboardMotion } from "./keyboardMotion";
import { SurfaceVisibilityContext } from "../shared/ui/SurfaceVisibility";
import { MobileSheet, type MobileSheetPoint } from "./MobileSheet";

let root: Root;
let node: HTMLDivElement;
let trigger: HTMLButtonElement;
let frames: Map<number, FrameRequestCallback>;
let disposeKeyboard: (() => void) | undefined;
function frame() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(performance.now()));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  node = document.createElement("div");
  trigger = document.createElement("button");
  document.body.append(node, trigger);
  root = createRoot(node);
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      return this.classList.contains("mobile-sheet")
        ? new DOMRect(0, 0, 220, 260)
        : new DOMRect(40, 200, 260, 44);
    },
  );
});
afterEach(() => {
  act(() => root.unmount());
  disposeKeyboard?.();
  disposeKeyboard = undefined;
  node.remove();
  trigger.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function render(
  anchorPoint?: MobileSheetPoint,
  open = true,
  overlapAnchor = false,
  constrainWidthToAnchor = false,
) {
  act(() =>
    root.render(
      createElement(
        MobileSheet,
        {
          title: "Session actions",
          open,
          overlapAnchor,
          constrainWidthToAnchor,
          placement: "anchor",
          anchor: { current: trigger },
          anchorPoint,
          width: 220,
          align: anchorPoint ? "start" : "end",
          onClose: () => {},
        },
        "Actions",
      ),
    ),
  );
  return node.querySelector<HTMLElement>(".mobile-sheet")!;
}
describe("mobile popover position", () => {
  it("opens at the long-press coordinates instead of the conversation row edge", () => {
    const sheet = render({ x: 72, y: 180 });
    expect(sheet.style.left).toBe("72px");
    expect(sheet.style.top).toBe("180px");
    expect(sheet.style.bottom).toBe("");
  });
  it("shifts left and opens above a press near the bottom right screen edge", () => {
    const sheet = render({
      x: window.innerWidth - 5,
      y: window.innerHeight - 24,
    });
    expect(sheet.style.left).toBe(`${window.innerWidth - 220 - 16}px`);
    expect(sheet.style.bottom).toBe("24px");
    expect(sheet.style.top).toBe("");
  });
  it("keeps existing button-anchored popovers in their original position", () => {
    const sheet = render();
    expect(sheet.style.left).toBe("80px");
    expect(sheet.style.top).toBe("252px");
  });
  it("follows a moving composer anchor without resize or scroll events and stops when closed", () => {
    disposeKeyboard = installKeyboardMotion();
    const keyboard = (height: number) => act(() => window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
      detail: { height, viewport: 800, duration: 200, easing: "linear" },
    })));
    keyboard(300); // Also covers mounting midway through an already active motion.
    const bounds = vi.spyOn(trigger, "getBoundingClientRect");
    const move = (bottom: number) => bounds.mockReturnValue(
      new DOMRect(40, window.innerHeight - bottom, 44, 44),
    );
    move(300);
    const sheet = render();
    expect(sheet.style.bottom).toBe("308px");
    // Keyboard dismissal moves the dock while the button keeps its size.
    keyboard(0);
    for (const bottom of [240, 140, 60]) {
      move(bottom);
      frame();
      expect(sheet.style.bottom).toBe(`${bottom + 8}px`);
    }
    // Follow reversal and horizontal layout changes as well.
    move(220);
    frame();
    expect(sheet.style.bottom).toBe("228px");
    bounds.mockReturnValue(new DOMRect(280, window.innerHeight - 220, 44, 44));
    frame();
    expect(sheet.style.left).toBe("104px");
    render(undefined, false);
    expect(frames.size).toBe(0);
    render();
    expect(frames.size).toBe(1);
    act(() => root.render(null));
    expect(frames.size).toBe(0);
  });
  it("leaves point-anchored menus fixed when their originating button moves", () => {

    const sheet = render({ x: 72, y: 180 });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 400, 44, 44));
    act(() => window.dispatchEvent(new Event("resize")));
    frame();
    expect(sheet.style.left).toBe("72px");
    expect(sheet.style.top).toBe("180px");
    expect(frames.size).toBe(0);
  });
  it("overlaps a top title trigger at its exact top, including inside the usual popup padding", () => {
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      new DOMRect(40, 10, 260, 44),
    );
    const sheet = render(undefined, true, true);
    expect(sheet.style.left).toBe("80px");
    expect(sheet.style.top).toBe("10px");
    expect(sheet.style.bottom).toBe("");
  });
  it("fits a narrow header trigger and recalculates the width when the viewport changes", () => {
    const bounds = vi
      .spyOn(trigger, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(72, 10, 176, 48));
    const sheet = render(undefined, true, true, true);
    expect(sheet.style.width).toBe("176px");
    expect(sheet.style.left).toBe("72px");
    bounds.mockReturnValue(new DOMRect(72, 10, 296, 48));
    act(() => window.dispatchEvent(new Event("resize")));
    frame();
    expect(sheet.style.width).toBe("220px");
    expect(sheet.style.left).toBe("148px");
    expect(sheet.style.top).toBe("10px");
  });
  it("returns keyboard focus to the conversation row after a point-anchored menu closes", () => {
    const sheet = render({ x: 72, y: 180 });
    expect(document.activeElement).toBe(sheet);
    act(() => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });
  it("keeps a controlled popover inert until closing finishes and handles reversal", () => {
    vi.useFakeTimers();
    render(undefined, false);
    expect(node.querySelector(".mobile-sheet")).toBeNull();
    const sheet = render(undefined, true);
    expect(
      sheet.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
    ).toBe("opening");
    expect(document.activeElement).toBe(sheet);
    render(undefined, false);
    expect(
      sheet.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
    ).toBe("closing");
    expect(sheet.closest(".mobile-sheet-backdrop")?.hasAttribute("inert")).toBe(
      true,
    );
    expect(document.activeElement).toBe(trigger);
    render(undefined, true);
    act(() => vi.advanceTimersByTime(210));
    expect(node.querySelector(".mobile-sheet")).toBe(sheet);
    expect(
      sheet.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
    ).toBe("open");
    render(undefined, false);
    act(() => vi.advanceTimersByTime(120));
    expect(node.querySelector(".mobile-sheet")).toBe(sheet);
    expect(
      sheet.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
    ).toBe("closing");
    act(() => vi.advanceTimersByTime(10));
    expect(node.querySelector(".mobile-sheet")).toBeNull();
  });
  it("closes a controlled popover immediately with reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(undefined, false);
    render(undefined, true);
    expect(
      node
        .querySelector(".mobile-sheet-backdrop")
        ?.getAttribute("data-fold-state"),
    ).toBe("open");
    render(undefined, false);
    expect(node.querySelector(".mobile-sheet")).toBeNull();
  });

  it("animates from the resolved anchor side and reverses from the visible frame", () => {
    vi.useFakeTimers();
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 700, 260, 44));
    const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null; playState: string; finished: Promise<void> }[] = [];
    const animate = vi.spyOn(Element.prototype, "animate").mockImplementation(() => {
      const animation = { cancel: vi.fn(), onfinish: null, playState: "running", finished: Promise.resolve() };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    render(undefined, false);
    const sheet = render(undefined, true);
    expect(sheet.dataset.anchorSide).toBe("top");
    expect(sheet.style.transformOrigin).toBe("right bottom");
    expect((animate.mock.calls[0][0] as Keyframe[])[0].transform).toBe("translateY(6px) scale(0.97)");
    const computedStyle = getComputedStyle;
    const visible = { transform: "matrix(0.985, 0, 0, 0.985, 0, 3)", opacity: "0.5" };
    vi.stubGlobal("getComputedStyle", (element: Element) => element === sheet ? visible : computedStyle(element));
    render(undefined, false);
    expect((animate.mock.calls[1][0] as Keyframe[])[0]).toEqual(visible);
    expect(animations[0].cancel).toHaveBeenCalled();
    expect(sheet.closest(".mobile-sheet-backdrop")?.hasAttribute("inert")).toBe(true);
    visible.transform = "matrix(0.98, 0, 0, 0.98, 0, 4)";
    visible.opacity = "0.3";
    render(undefined, true);
    expect((animate.mock.calls[2][0] as Keyframe[])[0]).toEqual(visible);
    expect(node.querySelector(".mobile-sheet")).toBe(sheet);
    animations[2].playState = "finished";
    act(() => animations[2].onfinish?.());
    expect(sheet.style.transform).toBe("");
    expect(sheet.style.opacity).toBe("");
    expect(sheet.closest<HTMLElement>(".mobile-sheet-backdrop")?.dataset.foldState).toBe("open");
  });

  it("keeps placement fixed while its visual bounds scale during opening", () => {
    const sheet = render({ x: 72, y: 180 });
    const before = { left: sheet.style.left, top: sheet.style.top, maxHeight: sheet.style.maxHeight };
    Object.defineProperties(sheet, {
      offsetWidth: { value: 220 },
      offsetHeight: { value: 260 },
    });
    vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 213, 252));
    act(() => window.dispatchEvent(new Event("resize")));
    frame();
    expect({ left: sheet.style.left, top: sheet.style.top, maxHeight: sheet.style.maxHeight }).toEqual(before);
  });
});


it("does not poll a stationary anchor and stops when native keyboard motion settles", () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  disposeKeyboard = installKeyboardMotion();
  render();
  expect(frames.size).toBe(0);
  act(() => window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
    detail: { height: 300, viewport: 800, duration: 120, easing: "linear" },
  })));
  frame();
  expect(frames.size).toBe(1);
  now = 121;
  frame();
  expect(frames.size).toBe(0);
});

it("suspends hidden surfaces and never restores focus into an inert route", () => {
  const content = (visible: boolean) => createElement(SurfaceVisibilityContext.Provider, { value: visible },
    createElement(MobileSheet, { title: "Actions", onClose: () => {}, anchor: { current: trigger } }, "Body"));
  act(() => root.render(content(true)));
  const focus = vi.spyOn(trigger, "focus");
  trigger.setAttribute("inert", "");
  act(() => root.render(content(false)));
  expect(node.querySelector(".mobile-sheet")).toBeNull();
  expect(focus).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

it("notifies exit once only after a previously open controlled sheet closes", () => {
  vi.useFakeTimers();
  const onExited = vi.fn();
  const show = (open: boolean) => act(() => root.render(createElement(MobileSheet,
    { title: "Actions", open, onClose: () => {}, onExited }, "Body")));
  show(false);
  expect(onExited).not.toHaveBeenCalled();
  show(true);
  show(false);
  expect(onExited).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(130));
  expect(onExited).toHaveBeenCalledOnce();
});


it("tracks finite ancestor motion while ignoring perpetual decorative animations", () => {
  let remaining = 80;
  trigger.getAnimations = () => [{
    playState: "running", currentTime: 0, playbackRate: 1,
    effect: { getComputedTiming: () => ({ endTime: remaining }) },
  }] as unknown as Animation[];
  render();
  expect(frames.size).toBe(1);
  frame();
  expect(frames.size).toBe(1);
  remaining = 0;
  frame();
  expect(frames.size).toBe(0);
  remaining = Infinity;
  act(() => trigger.dispatchEvent(new Event("animationstart", { bubbles: true })));
  frame();
  expect(frames.size).toBe(0);
});
