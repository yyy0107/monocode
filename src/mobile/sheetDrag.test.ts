// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSheet } from "./MobileSheet";
import { settleDetent, useSheetDrag } from "./sheetDrag";

describe("settleDetent", () => {
  it("steps down once on a downward fling and otherwise settles at the nearest stop", () => {
    // Full stop at 0, half stop at 300, half height 500.
    expect(settleDetent(250, -0.9, 300, 500, "half")).toBe("full");
    expect(settleDetent(100, 0.9, 300, 500, "full")).toBe("half");
    expect(settleDetent(460, 0.9, 300, 500, "full")).toBe("half");
    expect(settleDetent(320, 0.9, 300, 500, "half")).toBe("dismiss");
    expect(settleDetent(120, 0, 300, 500, "full")).toBe("full");
    expect(settleDetent(200, 0, 300, 500, "full")).toBe("half");
    expect(settleDetent(420, 0, 300, 500, "half")).toBe("half");
    expect(settleDetent(460, 0, 300, 500, "half")).toBe("dismiss");
  });
});

describe("MobileSheet drag", () => {
  let root: Root;
  let node: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
  });
  afterEach(() => {
    act(() => root.unmount());
    node.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function drag(distance: number, settleMs = 300) {
    const onClose = vi.fn();
    act(() =>
      root.render(
        createElement(MobileSheet, { title: "Tool details", onClose }, "Body"),
      ),
    );
    const sheet = node.querySelector<HTMLElement>(".mobile-sheet")!;
    Object.defineProperty(sheet, "offsetHeight", { value: 500 });
    const grip = node.querySelector(".mobile-sheet-grip")!;
    const pointer = (type: string, clientY: number) =>
      new PointerEvent(type, {
        bubbles: true,
        pointerType: "mouse",
        button: 0,
        clientY,
      });
    grip.dispatchEvent(pointer("pointerdown", 100));
    vi.advanceTimersByTime(500);
    sheet.dispatchEvent(pointer("pointermove", 100 + distance / 2));
    vi.advanceTimersByTime(500);
    sheet.dispatchEvent(pointer("pointermove", 100 + distance));
    vi.advanceTimersByTime(16);
    const moved = sheet.style.transform;
    act(() => { sheet.dispatchEvent(pointer("pointerup", 100 + distance)); });
    act(() => vi.advanceTimersByTime(settleMs));
    return {
      onClose,
      moved,
      rest: sheet.style.transform,
      transition: sheet.style.transition,
      sheet,
    };
  }

  it("follows the pointer and closes after a long pull", () => {
    const { onClose, moved } = drag(220);
    expect(moved).toBe("translateY(220px)");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts one inert close at release and never restarts a CSS exit", () => {
    const { sheet, onClose } = drag(220, 0);
    const backdrop = sheet.closest<HTMLElement>(".mobile-sheet-backdrop")!;
    expect(backdrop.dataset.foldState).toBe("closing");
    expect(backdrop.hasAttribute("inert")).toBe(true);
    expect(backdrop.style.animation).toBe("none");
    expect(sheet.style.animation).toBe("none");
    expect(sheet.style.transform).toBe("translateY(524px)");
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(130));
    expect(onClose).toHaveBeenCalledOnce();
    expect(node.querySelector(".mobile-sheet")).toBeNull();
  });

  it("springs back after a short pull", () => {
    const { onClose, rest } = drag(60);
    expect(onClose).not.toHaveBeenCalled();
    expect(rest).toBe("");
  });

  it("dismisses immediately after release with reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const { onClose, transition } = drag(220, 0);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(transition).toBe("none");
  });

  it("cancels a pending dismissal when the sheet unmounts", () => {
    const { onClose } = drag(220, 0);
    expect(onClose).not.toHaveBeenCalled();
    act(() => root.render(null));
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(["mouse", "touch"])(
    "drags only the nested sheet with %s input",
    (kind) => {
      const closeSettings = vi.fn();
      const closePicker = vi.fn();
      act(() => root.render(createElement(
        MobileSheet,
        { title: "Settings", onClose: closeSettings },
        createElement(MobileSheet, { title: "Picker", onClose: closePicker }, "Options"),
      )));
      const outer = node.querySelector<HTMLElement>('[aria-label="Settings"]')!;
      const inner = node.querySelector<HTMLElement>('[aria-label="Picker"]')!;
      for (const sheet of [outer, inner])
        Object.defineProperty(sheet, "offsetHeight", { value: 500 });
      const grip = inner.querySelector(".mobile-sheet-grip")!;
      const event = (phase: "down" | "move" | "up", clientY: number) =>
        kind === "mouse"
          ? new PointerEvent(`pointer${phase}`, {
              bubbles: true, pointerType: "mouse", button: 0, clientY,
            })
          : new TouchEvent(
              { down: "touchstart", move: "touchmove", up: "touchend" }[phase],
              {
                bubbles: true, cancelable: true,
                touches: phase === "up" ? [] : [{ clientY } as Touch],
              },
            );
      grip.dispatchEvent(event("down", 100));
      act(() => vi.advanceTimersByTime(500));
      inner.dispatchEvent(event("move", 210));
      act(() => vi.advanceTimersByTime(500));
      inner.dispatchEvent(event("move", 320));
      act(() => vi.advanceTimersByTime(16));
      expect(inner.style.transform).toBe("translateY(220px)");
      expect(outer.style.transform).toBe("");
      act(() => { inner.dispatchEvent(event("up", 320)); });
      act(() => vi.advanceTimersByTime(131));
      expect(closePicker).toHaveBeenCalledOnce();
      expect(closeSettings).not.toHaveBeenCalled();
    },
  );

  describe("gesture scheduling", () => {
    function open(detents = true) {
      vi.stubGlobal("innerHeight", 1000);
      const frames = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const requestFrame = vi.fn((callback: FrameRequestCallback) => {
        frames.set(++frameId, callback);
        return frameId;
      });
      const cancelFrame = vi.fn((id: number) => frames.delete(id));
      vi.stubGlobal("requestAnimationFrame", requestFrame);
      vi.stubGlobal("cancelAnimationFrame", cancelFrame);
      const observers: {
        callback: ResizeObserverCallback;
        disconnect: ReturnType<typeof vi.fn>;
      }[] = [];
      vi.stubGlobal("ResizeObserver", class {
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(readonly callback: ResizeObserverCallback) {
          observers.push(this);
        }
      });
      const ref = createRef<HTMLElement>();
      const onClose = vi.fn();
      function Sheet({ enabled }: { enabled: boolean }) {
        useSheetDrag(ref, enabled, onClose, undefined, detents);
        return createElement("section", { ref, className: "mobile-sheet" },
          createElement("div", { className: "mobile-sheet-grip" }));
      }
      const render = (enabled: boolean) => act(() => root.render(createElement(Sheet, { enabled })));
      render(true);
      const sheet = ref.current!;
      let height = 800;
      const readHeight = vi.fn(() => height);
      Object.defineProperty(sheet, "offsetHeight", { get: readHeight });
      const pointer = (type: string, clientY: number) => {
        const event = new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerType: "mouse", button: 0, clientY,
        });
        sheet.firstElementChild!.dispatchEvent(event);
        return event;
      };
      const frame = () => {
        const callbacks = [...frames.values()];
        frames.clear();
        for (const callback of callbacks) callback(performance.now());
      };
      const resize = (newHeight: number) => {
        height = newHeight;
        const observer = observers.at(-1)!;
        observer.callback([{
          target: sheet, borderBoxSize: [{ blockSize: height }],
        } as ResizeObserverEntry], observer as unknown as ResizeObserver);
      };
      return { sheet, onClose, pointer, frame, frames, requestFrame, cancelFrame, readHeight, observers, resize, render };
    }

    it("coalesces moves, keeps native cancellation immediate, and only remeasures changed geometry", () => {
      const { sheet, pointer, frame, frames, readHeight, resize } = open();
      pointer("pointerdown", 100);
      for (const y of [125, 145, 175])
        expect(pointer("pointermove", y).defaultPrevented).toBe(true);
      expect(frames.size).toBe(1);
      expect(sheet.style.transform).toBe("");
      expect(readHeight).toHaveBeenCalledOnce();
      frame();
      expect(sheet.style.transform).toBe("translateY(375px)");
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("");
      expect(frames.size).toBe(0);
      pointer("pointermove", 180);
      pointer("pointermove", 190);
      frame();
      expect(readHeight).toHaveBeenCalledOnce();
      resize(800);
      expect(frames.size).toBe(0);
      resize(900);
      expect(frames.size).toBe(1);
      frame();
      expect(readHeight).toHaveBeenCalledTimes(2);
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      pointer("pointermove", 250);
      frame();
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      vi.stubGlobal("innerHeight", 800);
      window.dispatchEvent(new Event("resize"));
      frame();
      expect(readHeight).toHaveBeenCalledTimes(3);
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      window.dispatchEvent(new Event("resize"));
      expect(frames.size).toBe(0);
    });

    it.each(["pointerup", "pointercancel"])("flushes the last move and stops observing on %s", (release) => {
      const { sheet, pointer, frames, cancelFrame, readHeight, observers, onClose, resize } = open();
      const writeOffset = vi.spyOn(sheet.style, "setProperty");
      pointer("pointerdown", 100);
      vi.advanceTimersByTime(500);
      pointer("pointermove", 60);
      expect(frames.size).toBe(1);
      pointer(release, 60);
      expect(frames.size).toBe(0);
      expect(cancelFrame).toHaveBeenCalledOnce();
      expect(observers[0].disconnect).toHaveBeenCalledOnce();
      expect(readHeight).toHaveBeenCalledOnce();
      expect(sheet.dataset.detent).toBe("half");
      // Prepare the full viewport once, retaining it until the half stop lands.
      expect(writeOffset.mock.calls.filter(([name]) => name === "--mobile-sheet-content-offset")
        .map(([, value]) => value)).toEqual(["0px"]);
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      resize(900);
      expect(frames.size).toBe(0);
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("");
    });

    it("keeps content geometry stable through expansion, reversal and the return spring", () => {
      const { sheet, pointer, frame } = open();
      const writeOffset = vi.spyOn(sheet.style, "setProperty");
      pointer("pointerdown", 600);
      for (const y of [570, 540, 510, 480, 450, 420, 400]) {
        vi.advanceTimersByTime(100);
        pointer("pointermove", y);
        frame();
      }
      pointer("pointerup", 400);
      expect(sheet.dataset.detent).toBe("full");
      vi.advanceTimersByTime(500);
      pointer("pointerdown", 200);
      for (const y of [240, 280, 320, 360, 400]) {
        vi.advanceTimersByTime(100);
        pointer("pointermove", y);
        frame();
      }
      pointer("pointerup", 400);
      expect(sheet.dataset.detent).toBe("half");
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      // Catch the return spring and expand again before its half-size cleanup.
      sheet.getAnimations = () => [{ transitionProperty: "transform", playState: "running" } as Animation];
      vi.spyOn(window, "getComputedStyle").mockReturnValue({ transform: "matrix(1, 0, 0, 1, 0, 250)" } as CSSStyleDeclaration);
      vi.stubGlobal("DOMMatrix", class { m42 = 250; });
      pointer("pointerdown", 400);
      vi.advanceTimersByTime(16);
      pointer("pointermove", 200);
      frame();
      pointer("pointerup", 200);
      vi.advanceTimersByTime(500);
      expect(sheet.dataset.detent).toBe("full");
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("0px");
      expect(writeOffset.mock.calls.filter(([name]) => name === "--mobile-sheet-content-offset")
        .map(([, value]) => value)).toEqual(["0px"]);
    });

    it("pulls a content-height sheet up to full screen without moving it at the switch", () => {
      const { sheet, pointer, frame, readHeight } = open(false);
      // The full-height layout is 300px taller than the 500px rest height.
      readHeight.mockImplementation(() => sheet.dataset.expanded ? 800 : 500);
      pointer("pointerdown", 600);
      vi.advanceTimersByTime(100);
      pointer("pointermove", 590);
      frame();
      expect(sheet.dataset.expanded).toBe("true");
      expect(sheet.style.transform).toBe("translateY(290px)");
      for (const y of [500, 400, 300]) {
        vi.advanceTimersByTime(100);
        pointer("pointermove", y);
        frame();
      }
      pointer("pointerup", 300);
      expect(sheet.style.transform).toBe("translateY(0px)");
      vi.advanceTimersByTime(500);
      expect(sheet.dataset.expanded).toBe("true");
      pointer("pointerdown", 100);
      for (const y of [150, 250, 350]) {
        vi.advanceTimersByTime(100);
        pointer("pointermove", y);
        frame();
      }
      pointer("pointerup", 350);
      expect(sheet.style.transform).toBe("translateY(300px)");
      vi.advanceTimersByTime(500);
      expect(sheet.dataset.expanded).toBeUndefined();
      expect(sheet.style.transform).toBe("");
    });

    it("stops watching a full sheet when an upward swipe becomes native scrolling", () => {
      const { pointer, frame, frames, observers } = open(false);
      pointer("pointerdown", 600);
      for (const y of [500, 400]) {
        vi.advanceTimersByTime(100);
        pointer("pointermove", y);
        frame();
      }
      pointer("pointerup", 400);
      vi.advanceTimersByTime(500);
      pointer("pointerdown", 100);
      expect(pointer("pointermove", 75).defaultPrevented).toBe(false);
      expect(pointer("pointermove", 150).defaultPrevented).toBe(false);
      expect(frames.size).toBe(0);
      expect(observers.at(-1)!.disconnect).toHaveBeenCalledOnce();
    });

    it.each(["disable", "unmount"])("cancels pending moves and geometry observers on %s", (action) => {
      const { sheet, pointer, frame, frames, observers, render, readHeight } = open();
      pointer("pointerdown", 100);
      pointer("pointermove", 130);
      if (action === "disable") render(false);
      else act(() => root.render(null));
      expect(frames.size).toBe(0);
      expect(observers[0].disconnect).toHaveBeenCalledOnce();
      vi.stubGlobal("innerHeight", 800);
      window.dispatchEvent(new Event("resize"));
      frame();
      expect(readHeight).toHaveBeenCalledOnce();
      expect(sheet.style.transform).toBe("");
    });

    it("catches a settling sheet at its visible offset", () => {
      const { sheet, pointer, frame } = open();
      sheet.getAnimations = () => [{ transitionProperty: "transform", playState: "running" } as Animation];
      vi.spyOn(window, "getComputedStyle").mockReturnValue({ transform: "matrix(1, 0, 0, 1, 0, 120)" } as CSSStyleDeclaration);
      vi.stubGlobal("DOMMatrix", class { m42 = 120; });
      pointer("pointerdown", 100);
      pointer("pointermove", 125);
      frame();
      expect(sheet.style.transform).toBe("translateY(145px)");
    });
  });

  describe("two-stop sheets", () => {
    function open() {
      vi.stubGlobal("innerHeight", 1000);
      const onClose = vi.fn();
      act(() => root.render(createElement(MobileSheet,
        { title: "Tool details", onClose, detents: true, header: { title: "Bash", subtitle: "Completed" } },
        createElement("p", { className: "body" }, "Body"))));
      const sheet = node.querySelector<HTMLElement>(".mobile-sheet")!;
      Object.defineProperty(sheet, "offsetHeight", { value: 800 });
      const touch = (type: string, clientY: number, selector = ".mobile-sheet-header strong") => {
        const target = sheet.querySelector(selector)!;
        const event = new TouchEvent(type, {
          bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [{ clientY } as Touch],
        });
        act(() => { target.dispatchEvent(event); });
        return event;
      };
      const pull = (from: number, to: number, selector?: string) => {
        touch("touchstart", from, selector);
        act(() => vi.advanceTimersByTime(500));
        touch("touchmove", (from + to) / 2, selector);
        act(() => vi.advanceTimersByTime(500));
        touch("touchmove", to, selector);
        touch("touchend", to, selector);
      };
      return { sheet, onClose, pull, touch };
    }

    it.each([".mobile-sheet-grip", ".mobile-sheet-header strong"])(
      "opens at half height, expands from %s, and steps back down before closing",
      (selector) => {
        const { sheet, onClose, pull } = open();
        expect(sheet.dataset.detent).toBe("half");
        expect(sheet.querySelector(".mobile-sheet-header strong")?.textContent).toBe("Bash");
        pull(600, 400, selector);
        expect(sheet.dataset.detent).toBe("full");
        expect(sheet.style.transform).toBe("translateY(0px)");
        pull(300, 500, selector);
        expect(sheet.dataset.detent).toBe("half");
        act(() => vi.advanceTimersByTime(450));
        expect(sheet.style.transform).toBe("");
        expect(onClose).not.toHaveBeenCalled();
        pull(600, 800, selector);
        act(() => vi.advanceTimersByTime(200));
        expect(onClose).toHaveBeenCalledOnce();
      },
    );

    it("closes from the header button", () => {
      const { sheet, onClose, touch } = open();
      const button = '.mobile-sheet-header [aria-label="Close"]';
      touch("touchstart", 600, button);
      expect(touch("touchmove", 400, button).defaultPrevented).toBe(false);
      touch("touchend", 400, button);
      expect(sheet.dataset.detent).toBe("half");
      act(() => sheet.querySelector<HTMLButtonElement>('.mobile-sheet-header [aria-label="Close"]')!.click());
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("restores the half-height scroll viewport immediately with reduced motion", () => {
      vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
      const { sheet, pull } = open();
      pull(600, 400);
      expect(sheet.dataset.detent).toBe("full");
      expect(sheet.style.transition).toBe("none");
      pull(300, 500);
      act(() => vi.advanceTimersByTime(0));
      expect(sheet.dataset.detent).toBe("half");
      expect(sheet.style.getPropertyValue("--mobile-sheet-content-offset")).toBe("");
    });

    it.each([80, 500])("settles a full sheet at half after a quick %ipx downward swipe, then dismisses on the next swipe", (distance) => {
      const { sheet, onClose, pull, touch } = open();
      pull(600, 400);
      expect(sheet.dataset.detent).toBe("full");
      act(() => vi.advanceTimersByTime(250));
      touch("touchstart", 300);
      act(() => vi.advanceTimersByTime(16));
      touch("touchmove", 300 + distance / 2);
      act(() => vi.advanceTimersByTime(16));
      touch("touchmove", 300 + distance);
      touch("touchend", 300 + distance);
      expect(sheet.dataset.detent).toBe("half");
      expect(sheet.closest(".mobile-sheet-backdrop")?.hasAttribute("inert")).toBe(false);
      expect(sheet.style.transform).toBe("translateY(300px)");
      expect(sheet.style.transition).toContain("linear(");
      act(() => vi.advanceTimersByTime(450));
      expect(onClose).not.toHaveBeenCalled();
      expect(node.querySelector(".mobile-sheet")).toBe(sheet);
      expect(sheet.style.transform).toBe("");

      touch("touchstart", 600);
      act(() => vi.advanceTimersByTime(16));
      touch("touchmove", 640);
      act(() => vi.advanceTimersByTime(16));
      touch("touchmove", 680);
      touch("touchend", 680);
      expect(sheet.closest(".mobile-sheet-backdrop")?.hasAttribute("inert")).toBe(true);
      expect(sheet.style.transform).toBe("translateY(824px)");
      act(() => vi.advanceTimersByTime(130));
      expect(onClose).toHaveBeenCalledOnce();
      expect(node.querySelector(".mobile-sheet")).toBeNull();
    });

    it.each(["half", "full"])("leaves all content swipes to native scrolling at the %s stop", (detent) => {
      const { sheet, onClose, pull, touch } = open();
      if (detent === "full") pull(600, 400);
      act(() => vi.advanceTimersByTime(250));
      const rest = sheet.style.transform;
      for (const scrollTop of [0, 100]) {
        sheet.querySelector<HTMLElement>(".mobile-sheet-content")!.scrollTop = scrollTop;
        for (const distance of [-150, 150]) {
          touch("touchstart", 600, ".body");
          act(() => vi.advanceTimersByTime(16));
          expect(touch("touchmove", 600 + distance, ".body").defaultPrevented).toBe(false);
          touch("touchend", 600 + distance, ".body");
          act(() => vi.advanceTimersByTime(250));
          expect(sheet.dataset.detent).toBe(detent);
          expect(sheet.style.transform).toBe(rest);
        }
      }
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
