// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
function render(
  expanded: boolean,
  parentVisible = true,
  durationMs?: number,
  motion?: "grid" | "height",
  options: Partial<ComponentProps<typeof AnimatedCollapse>> = {},
) {
  act(() =>
    root.render(
      createElement(
        SurfaceVisibilityContext.Provider,
        { value: parentVisible },
        createElement(AnimatedCollapse, {
          expanded,
          durationMs,
          motion,
          children: createElement(Child),
          ...options,
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

it("keeps content for a custom CSS duration and cancels its timeout on reversal", () => {
  render(true, true, 420);
  expect(fold()?.style.getPropertyValue("--collapse-duration")).toBe("420ms");
  render(false, true, 420);
  act(() => vi.advanceTimersByTime(350));
  expect(fold()?.dataset.foldState).toBe("closing");
  expect(fold()?.inert).toBe(true);
  expect(child()).not.toBeNull();
  render(true, true, 420);
  act(() => vi.advanceTimersByTime(80));
  expect(fold()?.dataset.foldState).toBe("opening");
  expect(fold()?.inert).toBe(false);
  act(() => vi.advanceTimersByTime(350));
  expect(fold()?.dataset.foldState).toBe("open");
  render(false, true, 420);
  act(() => vi.advanceTimersByTime(429));
  expect(child()).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(fold()).toBeNull();
});

it.each([undefined, 420])(
  "opens and closes immediately with reduced motion (duration: %s)",
  (durationMs) => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
        }) as MediaQueryList,
    );
    render(false, true, durationMs);
    render(true, true, durationMs);
    expect(fold()?.dataset.foldState).toBe("open");
    render(false, true, durationMs);
    expect(fold()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("does not expose nested surfaces while the containing view is hidden", () => {
  render(true, false);
  expect(child()?.getAttribute("data-visible")).toBe("false");
  render(true);
  expect(child()?.getAttribute("data-visible")).toBe("true");
});

it("does not prepare lazy content until opening and retains it through closing", () => {
  const content = vi.fn(() => createElement(Child));
  const renderLazy = (expanded: boolean) =>
    act(() =>
      root.render(
        createElement(AnimatedCollapse, { expanded, children: content }),
      ),
    );
  renderLazy(false);
  expect(content).not.toHaveBeenCalled();
  renderLazy(true);
  expect(child()).not.toBeNull();
  renderLazy(false);
  expect(fold()?.dataset.foldState).toBe("closing");
  expect(child()?.getAttribute("data-visible")).toBe("false");
  act(() => vi.advanceTimersByTime(350));
  expect(child()).toBeNull();
  content.mockClear();
  renderLazy(false);
  expect(content).not.toHaveBeenCalled();
});

it("notifies only after entering, not on mount or while opening", () => {
  const onEntered = vi.fn();
  render(true, true, undefined, undefined, { onEntered });
  expect(onEntered).not.toHaveBeenCalled();
  render(false, true, undefined, undefined, { onEntered });
  render(true, true, undefined, undefined, { onEntered });
  expect(onEntered).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(350));
  expect(onEntered).toHaveBeenCalledOnce();
  render(true, true, undefined, undefined, { onEntered });
  expect(onEntered).toHaveBeenCalledOnce();
});

describe("measured-height motion", () => {
  let itemHeight: number;
  let contentHeight: number;
  let now: number;
  let resize: () => void;
  let observe: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let animations: {
    cancel: ReturnType<typeof vi.fn>;
    onfinish: (() => void) | null;
  }[];
  let animate: ReturnType<typeof vi.spyOn>;
  const renderHeight = (
    expanded: boolean,
    options: Partial<ComponentProps<typeof AnimatedCollapse>> = {},
  ) => render(expanded, true, 220, "height", options);

  beforeEach(() => {
    itemHeight = 0;
    contentHeight = 160;
    now = 0;
    animations = [];
    observe = vi.fn();
    disconnect = vi.fn();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        return {
          height: this.classList.contains("zen-fold-item")
            ? itemHeight
            : contentHeight,
        } as DOMRect;
      },
    );
    animate = vi.spyOn(Element.prototype, "animate").mockImplementation(() => {
      const animation = {
        cancel: vi.fn(),
        onfinish: null as (() => void) | null,
        finished: Promise.resolve(),
      };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
  });

  it("does not animate on mount, retains closing content and restores auto height", () => {
    renderHeight(true);
    expect(animate).not.toHaveBeenCalled();
    itemHeight = 160;
    renderHeight(false);
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "160px" }, { height: "0px" }],
      expect.objectContaining({ duration: 220 }),
    );
    expect(child()).not.toBeNull();
    expect(fold()?.inert).toBe(true);
    expect(child()?.getAttribute("data-visible")).toBe("false");
    itemHeight = 0;
    act(() => animations[0].onfinish?.());
    expect(fold()).toBeNull();
    renderHeight(true);
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "0px" }, { height: "160px" }],
      expect.objectContaining({ duration: 220 }),
    );
    expect(observe).toHaveBeenCalledWith(fold()?.firstElementChild);
    itemHeight = 160;
    act(() => animations[1].onfinish?.());
    expect(fold()?.dataset.foldState).toBe("open");
    expect(fold()?.style.height).toBe("");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("reverses from the current visible height and cancels obsolete completion", () => {
    renderHeight(false);
    renderHeight(true);
    act(() => vi.advanceTimersByTime(50));
    itemHeight = 60;
    renderHeight(false);
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "60px" }, { height: "0px" }],
      expect.anything(),
    );
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations[0].onfinish).toBeNull();
    act(() => vi.advanceTimersByTime(50));
    itemHeight = 25;
    renderHeight(true);
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "25px" }, { height: "160px" }],
      expect.anything(),
    );
    expect(animations[1].cancel).toHaveBeenCalledOnce();
    expect(animations[1].onfinish).toBeNull();
    expect(fold()?.inert).toBe(false);
    act(() => vi.advanceTimersByTime(180));
    expect(fold()?.dataset.foldState).toBe("opening");
    act(() => vi.advanceTimersByTime(50));
    expect(fold()?.dataset.foldState).toBe("open");
  });

  it("retargets asynchronously loaded rows without jumping or extending the deadline", () => {
    renderHeight(false);
    renderHeight(true);
    act(() => resize());
    expect(animate).toHaveBeenCalledOnce();
    now = 90;
    itemHeight = 80;
    contentHeight = 320;
    act(() => resize());
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "80px" }, { height: "320px" }],
      expect.objectContaining({ duration: 130 }),
    );
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations[0].onfinish).toBeNull();
    act(() => resize());
    expect(animate).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(229));
    expect(fold()?.dataset.foldState).toBe("opening");
    itemHeight = 320;
    act(() => vi.advanceTimersByTime(1));
    expect(fold()?.dataset.foldState).toBe("open");
    expect(fold()?.style.height).toBe("");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("gives late content a full transition and extends its completion fallback", () => {
    const onEntered = vi.fn();
    const options = { animateContentResize: true, onEntered };
    contentHeight = 26;
    renderHeight(false, options);
    renderHeight(true, options);
    act(() => vi.advanceTimersByTime(210));
    now = 210;
    itemHeight = 26;
    contentHeight = 160;
    act(() => resize());
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "26px" }, { height: "160px" }],
      expect.objectContaining({ duration: 220 }),
    );
    act(() => vi.advanceTimersByTime(229));
    expect(fold()?.dataset.foldState).toBe("opening");
    expect(onEntered).not.toHaveBeenCalled();
    itemHeight = 160;
    act(() => vi.advanceTimersByTime(1));
    expect(fold()?.dataset.foldState).toBe("open");
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("retargets content arriving before an animation finish but before observer delivery", () => {
    contentHeight = 26;
    renderHeight(false, { animateContentResize: true });
    renderHeight(true, { animateContentResize: true });
    itemHeight = 26;
    contentHeight = 160;
    act(() => animations[0].onfinish?.());
    expect(fold()?.dataset.foldState).toBe("opening");
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "26px" }, { height: "160px" }],
      expect.objectContaining({ duration: 220 }),
    );
    itemHeight = 160;
    act(() => animations[1].onfinish?.());
    expect(fold()?.dataset.foldState).toBe("open");
  });

  it("smooths content loaded after entering instead of jumping to auto height", () => {
    renderHeight(true, { animateContentResize: true });
    expect(animate).not.toHaveBeenCalled();
    itemHeight = contentHeight = 320;
    act(() => resize());
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "160px" }, { height: "320px" }],
      expect.objectContaining({ duration: 220 }),
    );
    expect(fold()?.style.overflow).toBe("hidden");
    act(() => animations[0].onfinish?.());
    expect(fold()?.style.height).toBe("");
    expect(fold()?.style.overflow).toBe("");
  });

  it("prepares late DOM content before waiting for layout-observer delivery", () => {
    let mutate: () => void = () => {};
    const disconnectMutations = vi.fn();
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          mutate = callback;
        }
        observe() {}
        disconnect = disconnectMutations;
      },
    );
    renderHeight(true, { animateContentResize: true });
    itemHeight = contentHeight = 320;
    act(() => mutate());
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "160px" }, { height: "320px" }],
      expect.objectContaining({ duration: 220 }),
    );
    renderHeight(false, { animateContentResize: true });
    expect(disconnectMutations).toHaveBeenCalledOnce();
  });

  it("lets nested disclosures animate naturally rather than chasing every frame", () => {
    renderHeight(true, { animateContentResize: true });
    const nested = document.createElement("div");
    nested.className = "zen-fold-item";
    nested.dataset.foldState = "opening";
    fold()!.firstElementChild!.append(nested);
    contentHeight = itemHeight = 320;
    act(() => resize());
    expect(animate).not.toHaveBeenCalled();
    expect(fold()?.style.height).toBe("");
  });

  it("skips height animations and observers with reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    renderHeight(false);
    renderHeight(true);
    expect(fold()?.dataset.foldState).toBe("open");
    renderHeight(false);
    expect(fold()).toBeNull();
    expect(animate).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to CSS motion when Web Animations are unavailable", () => {
    Element.prototype.animate = undefined as never;
    renderHeight(false);
    renderHeight(true);
    expect(fold()?.dataset.collapseMotion).toBeUndefined();
    expect(fold()?.dataset.foldState).toBe("opening");
    expect(animate).not.toHaveBeenCalled();
    renderHeight(false);
    expect(fold()?.dataset.foldState).toBe("closing");
    act(() => vi.advanceTimersByTime(230));
    expect(fold()).toBeNull();
  });
});
