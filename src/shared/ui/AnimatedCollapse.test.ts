// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnimatedCollapse } from "./AnimatedCollapse";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "./SurfaceVisibility";

let root: Root;
let container: HTMLDivElement;

function Child() {
  return createElement(
    "button",
    {
      "data-visible": useSurfaceVisibility(),
    },
    "Content",
  );
}
function render(expanded: boolean, parentVisible = true) {
  act(() =>
    root.render(
      createElement(
        SurfaceVisibilityContext.Provider,
        { value: parentVisible },
        createElement(AnimatedCollapse, {
          expanded,
          children: createElement(Child),
        }),
      ),
    ),
  );
}
const fold = () => container.querySelector<HTMLElement>(".zen-fold-item");
const child = () => container.querySelector("button");

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("does not replay motion on mount and animates both opening and closing", () => {
  render(false);
  expect(fold()).toBeNull();
  render(true);
  expect(fold()?.dataset.foldState).toBe("opening");
  act(() =>
    fold()!.dispatchEvent(new Event("animationend", { bubbles: true })),
  );
  expect(fold()?.dataset.foldState).toBe("open");
  render(false);
  expect(fold()?.dataset.foldState).toBe("closing");
  expect(child()).not.toBeNull();
  expect(fold()?.inert).toBe(true);
  expect(fold()?.getAttribute("aria-hidden")).toBe("true");
  expect(child()?.getAttribute("data-visible")).toBe("false");
  act(() =>
    fold()!.dispatchEvent(new Event("animationend", { bubbles: true })),
  );
  expect(child()).toBeNull();
  render(true);
  act(() => root.unmount());
  root = createRoot(container);
  render(true);
  expect(fold()?.dataset.foldState).toBe("open");
});

it("cancels the old closing timer on rapid reversal", () => {
  render(true);
  render(false);
  act(() => vi.advanceTimersByTime(200));
  render(true);
  expect(fold()?.dataset.foldState).toBe("opening");
  act(() => vi.advanceTimersByTime(150));
  expect(fold()?.dataset.foldState).toBe("opening");
  expect(fold()?.inert).toBe(false);
  expect(child()?.getAttribute("data-visible")).toBe("true");
  act(() => vi.advanceTimersByTime(200));
  expect(fold()?.dataset.foldState).toBe("open");
});

it("ignores nested animation events and eventually closes without animationend", () => {
  render(true);
  render(false);
  act(() =>
    child()!.dispatchEvent(new Event("animationend", { bubbles: true })),
  );
  expect(fold()?.dataset.foldState).toBe("closing");
  act(() => vi.advanceTimersByTime(350));
  expect(fold()).toBeNull();
});

it("opens and closes immediately with reduced motion", () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
      }) as MediaQueryList,
  );
  render(false);
  render(true);
  expect(fold()?.dataset.foldState).toBe("open");
  render(false);
  expect(fold()).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not expose nested surfaces while the containing view is hidden", () => {
  render(true, false);
  expect(child()?.getAttribute("data-visible")).toBe("false");
  render(true);
  expect(child()?.getAttribute("data-visible")).toBe("true");
});
