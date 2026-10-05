// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSheet } from "./MobileSheet";
import { shouldDismiss } from "./sheetDrag";

describe("shouldDismiss", () => {
  it("closes on a long pull or a fast fling and springs back otherwise", () => {
    expect(shouldDismiss(200, 0.1, 500)).toBe(true);
    expect(shouldDismiss(40, 0.9, 500)).toBe(true);
    expect(shouldDismiss(80, 0.2, 500)).toBe(false);
    expect(shouldDismiss(-30, 2, 500)).toBe(false);
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
    sheet.dispatchEvent(pointer("pointerup", 100 + distance));
    act(() => vi.advanceTimersByTime(settleMs));
    return {
      onClose,
      moved,
      rest: sheet.style.transform,
      transition: sheet.style.transition,
    };
  }

  it("follows the pointer and closes after a long pull", () => {
    const { onClose, moved } = drag(220);
    expect(moved).toBe("translateY(220px)");
    expect(onClose).toHaveBeenCalledTimes(1);
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
});
