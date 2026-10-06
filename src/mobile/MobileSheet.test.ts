// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSheet, type MobileSheetPoint } from "./MobileSheet";

let root: Root;
let node: HTMLDivElement;
let trigger: HTMLButtonElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  node = document.createElement("div");
  trigger = document.createElement("button");
  document.body.append(node, trigger);
  root = createRoot(node);
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
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const frame = () => act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(performance.now()));
    });
    const bounds = vi.spyOn(trigger, "getBoundingClientRect");
    const move = (bottom: number) => bounds.mockReturnValue(
      new DOMRect(40, window.innerHeight - bottom, 44, 44),
    );
    move(300);
    const sheet = render();
    expect(sheet.style.bottom).toBe("308px");
    // Keyboard dismissal moves the dock while the button keeps its size.
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
    const requestFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    const sheet = render({ x: 72, y: 180 });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 400, 44, 44));
    act(() => window.dispatchEvent(new Event("resize")));
    expect(sheet.style.left).toBe("72px");
    expect(sheet.style.top).toBe("180px");
    expect(requestFrame).not.toHaveBeenCalled();
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
});
