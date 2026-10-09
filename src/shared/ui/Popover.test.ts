// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Popover } from "./Popover";
import { NativePopupHost } from "./NativePopupHost";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "./SurfaceVisibility";

let container: HTMLDivElement;
let host: HTMLDivElement;
let anchor: HTMLButtonElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  host = document.createElement("div");
  anchor = document.createElement("button");
  document.body.append(container, host, anchor);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  host.remove();
  anchor.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function NestedSurface() {
  return useSurfaceVisibility()
    ? createElement("span", { "data-nested-surface": "" }, "Nested surface")
    : null;
}

describe.each([false, true])(
  "animated popover with native host: %s",
  (native) => {
    const dismiss = vi.fn();
    function render(open: boolean, visible = true) {
      dismiss.mockClear();
      act(() =>
        root.render(
          createElement(
            SurfaceVisibilityContext.Provider,
            { value: visible },
            createElement(
              NativePopupHost.Provider,
              { value: native ? host : null },
              createElement(
                Popover,
                {
                  open,
                  anchor,
                  autoFocus: true,
                  tabIndex: -1,
                  onDismiss: dismiss,
                  "data-test-popover": "",
                },
                "Menu action",
                createElement(NestedSurface),
              ),
            ),
          ),
        ),
      );
    }

    it("focuses after opening becomes interactive and does not steal focus when motion completes", () => {
      // happy-dom permits focus on inert/hidden content; emulate browser focus
      // rules to catch attempts made before the opening surface is interactive.
      const focus = HTMLElement.prototype.focus;
      vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(
        function (this: HTMLElement, options) {
          if (
            this.closest("[inert]") ||
            this.parentElement?.style.visibility === "hidden"
          )
            return;
          focus.call(this, options);
        },
      );
      render(false);
      anchor.focus();
      render(true);
      expect(document.activeElement).toBe(
        document.querySelector("[data-test-popover]"),
      );
      anchor.focus();
      act(() => vi.advanceTimersByTime(200));
      expect(document.activeElement).toBe(anchor);
    });

    it("retains closing content, disables interaction and nested surfaces, then unmounts", () => {
      render(true);
      const surface = document.querySelector<HTMLElement>(
        "[data-test-popover]",
      )!;
      expect(document.querySelector("[data-nested-surface]")).not.toBeNull();
      render(false);
      expect(surface.inert).toBe(true);
      expect(surface.getAttribute("aria-hidden")).toBe("true");
      expect(surface.textContent).toBe("Menu action");
      expect(document.querySelector("[data-nested-surface]")).toBeNull();
      act(() => {
        anchor.focus();
        document.body.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(dismiss).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(anchor);
      act(() => vi.advanceTimersByTime(180));
      expect(document.querySelector("[data-test-popover]")).toBeNull();
    });

    it("reverses closing on the same surface and cancels its pending unmount", () => {
      render(true);
      const surface = document.querySelector<HTMLElement>(
        "[data-test-popover]",
      )!;
      render(false);
      act(() => vi.advanceTimersByTime(70));
      render(true);
      expect(document.querySelector("[data-test-popover]")).toBe(surface);
      expect(surface.inert).toBe(false);
      act(() => vi.advanceTimersByTime(180));
      expect(document.querySelector("[data-test-popover]")).toBe(surface);
      expect(
        surface.closest("[data-fold-state]")?.getAttribute("data-fold-state"),
      ).toBe("open");
    });

    it("closes immediately with reduced motion and suppresses hidden portals", () => {
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
      } as MediaQueryList);
      render(true);
      render(false);
      expect(document.querySelector("[data-test-popover]")).toBeNull();
      render(true);
      render(true, false);
      expect(document.querySelector("[data-test-popover]")).toBeNull();
    });
  },
);
