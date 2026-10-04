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
  vi.unstubAllGlobals();
});
function render(anchorPoint?: MobileSheetPoint) {
  act(() =>
    root.render(
      createElement(
        MobileSheet,
        {
          title: "Session actions",
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
  it("returns keyboard focus to the conversation row after a point-anchored menu closes", () => {
    const sheet = render({ x: 72, y: 180 });
    expect(document.activeElement).toBe(sheet);
    act(() => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });
});
