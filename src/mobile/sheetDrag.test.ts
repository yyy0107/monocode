// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSheet } from "./MobileSheet";
import { settleDetent, shouldDismiss } from "./sheetDrag";

describe("shouldDismiss", () => {
  it("closes on a long pull or a fast fling and springs back otherwise", () => {
    expect(shouldDismiss(200, 0.1, 500)).toBe(true);
    expect(shouldDismiss(40, 0.9, 500)).toBe(true);
    expect(shouldDismiss(80, 0.2, 500)).toBe(false);
    expect(shouldDismiss(-30, 2, 500)).toBe(false);
  });
});

describe("settleDetent", () => {
  it("flings to the next stop and otherwise settles at the nearest one", () => {
    // Full stop at 0, half stop at 300, half height 500.
    expect(settleDetent(250, -0.9, 300, 500)).toBe("full");
    expect(settleDetent(100, 0.9, 300, 500)).toBe("half");
    expect(settleDetent(320, 0.9, 300, 500)).toBe("dismiss");
    expect(settleDetent(120, 0, 300, 500)).toBe("full");
    expect(settleDetent(200, 0, 300, 500)).toBe("half");
    expect(settleDetent(420, 0, 300, 500)).toBe("half");
    expect(settleDetent(460, 0, 300, 500)).toBe("dismiss");
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
      expect(inner.style.transform).toBe("translateY(220px)");
      expect(outer.style.transform).toBe("");
      act(() => { inner.dispatchEvent(event("up", 320)); });
      act(() => vi.advanceTimersByTime(131));
      expect(closePicker).toHaveBeenCalledOnce();
      expect(closeSettings).not.toHaveBeenCalled();
    },
  );

  describe("two-stop sheets", () => {
    function open() {
      vi.stubGlobal("innerHeight", 1000);
      const onClose = vi.fn();
      act(() => root.render(createElement(MobileSheet,
        { title: "Tool details", onClose, detents: true, header: { title: "Bash", subtitle: "Completed" } },
        createElement("p", { className: "body" }, "Body"))));
      const sheet = node.querySelector<HTMLElement>(".mobile-sheet")!;
      Object.defineProperty(sheet, "offsetHeight", { value: 800 });
      const touch = (type: string, clientY: number) => {
        const target = sheet.querySelector(".body")!;
        act(() => { target.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [{ clientY } as Touch],
        })); });
      };
      const pull = (from: number, to: number) => {
        touch("touchstart", from);
        act(() => vi.advanceTimersByTime(500));
        touch("touchmove", (from + to) / 2);
        act(() => vi.advanceTimersByTime(500));
        touch("touchmove", to);
        touch("touchend", to);
      };
      return { sheet, onClose, pull };
    }

    it("opens at half height, expands from the body, and steps back down before closing", () => {
      const { sheet, onClose, pull } = open();
      expect(sheet.dataset.detent).toBe("half");
      expect(sheet.querySelector(".mobile-sheet-header strong")?.textContent).toBe("Bash");
      pull(600, 400);
      expect(sheet.dataset.detent).toBe("full");
      expect(sheet.style.transform).toBe("translateY(0px)");
      pull(300, 500);
      expect(sheet.dataset.detent).toBe("half");
      act(() => vi.advanceTimersByTime(250));
      expect(sheet.style.transform).toBe("");
      expect(onClose).not.toHaveBeenCalled();
      pull(600, 800);
      act(() => vi.advanceTimersByTime(200));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes from the header button", () => {
      const { sheet, onClose } = open();
      act(() => sheet.querySelector<HTMLButtonElement>('.mobile-sheet-header [aria-label="Close"]')!.click());
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
