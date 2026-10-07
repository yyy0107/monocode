// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarMain } from "./SidebarMain";

let root: Root;
let container: HTMLDivElement;
let left: number;
let width: number;
let resize: () => void;
let reduce: boolean;
let preferenceChanged: () => void;
const motions: { cancel: ReturnType<typeof vi.fn>; onfinish?: () => void }[] =
  [];
const animate = vi.fn(
  (_frames: Keyframe[], _options?: KeyframeAnimationOptions) => {
    const motion = {
      cancel: vi.fn(),
      finished: new Promise(() => {}),
      onfinish: undefined,
    };
    motions.push(motion);
    return motion as unknown as Animation;
  },
);

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  left = 280;
  width = 720;
  reduce = false;
  motions.length = 0;
  animate.mockClear();
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    () => left,
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    () => width,
  );
  vi.spyOn(window, "matchMedia").mockImplementation(
    () =>
      ({
        get matches() {
          return reduce;
        },
        addEventListener: (_: string, callback: () => void) => {
          preferenceChanged = callback;
        },
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m41: number;
      constructor(value: string) {
        this.m41 = Number(value.slice(7, -1).split(",")[4]);
      }
    },
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(open: boolean) {
  left = open ? 280 : 48;
  width = 1000 - left;
  act(() =>
    root.render(createElement(SidebarMain, { open, children: "Conversation" })),
  );
}

it("animates only position and holds the wider surface until opening finishes", () => {
  render(true);
  expect(animate).not.toHaveBeenCalled();
  render(false);
  expect(animate.mock.calls[0]?.[0]).toEqual([
    { transform: "translateX(232px)" },
    { transform: "translateX(0)" },
  ]);
  expect(width).toBe(952);
  motions[0].onfinish?.();
  expect(motions[0].cancel).toHaveBeenCalledOnce();
  render(true);
  expect(animate.mock.calls[1]?.[0]).toEqual([
    { transform: "translateX(-232px)" },
    { transform: "translateX(0)" },
  ]);
  const surface = container.querySelector<HTMLElement>("[data-sidebar-main]")!;
  expect(surface.style.flexBasis).toBe("952px");
  motions[1].onfinish?.();
  expect(surface.style.flex).toBe("");
});

it("reverses from the current visual position without a jump", () => {
  render(true);
  render(false);
  const surface = container.querySelector<HTMLElement>("[data-sidebar-main]")!;
  surface.style.transform = "matrix(1, 0, 0, 1, 100, 0)";
  render(true);
  expect(motions[0].cancel).toHaveBeenCalledOnce();
  expect(animate.mock.calls[1]?.[0]).toEqual([
    { transform: "translateX(-132px)" },
    { transform: "translateX(0)" },
  ]);
});

it("follows the sidebar's shortened transition when reversing mid-slide", () => {
  render(true);
  render(false);
  container.querySelector<HTMLElement>("[data-sidebar-main]")!.style.transform =
    "matrix(1, 0, 0, 1, 100, 0)";
  const sidebar = document.createElement("div");
  sidebar.dataset.sidebarTransition = "";
  const clip = document.createElement("div");
  clip.className = "sidebar-transition-clip";
  clip.getAnimations = () =>
    [
      {
        transitionProperty: "transform",
        effect: {
          getTiming: () => ({
            duration: 160,
            easing: "cubic-bezier(0.2, 0.65, 0.3, 1)",
          }),
        },
      },
    ] as unknown as Animation[];
  sidebar.append(clip);
  container.prepend(sidebar);

  render(true);
  expect(animate.mock.calls[1]?.[1]).toEqual({
    duration: 160,
    easing: "cubic-bezier(0.2, 0.65, 0.3, 1)",
  });
});

it("keeps the sidebar's curve when the transition reports spec-linear easing", () => {
  render(true);
  const sidebar = document.createElement("div");
  sidebar.dataset.sidebarTransition = "";
  const clip = document.createElement("div");
  clip.className = "sidebar-transition-clip";
  // WebKit reports a CSS transition's timing function on its keyframes only.
  clip.getAnimations = () =>
    [
      {
        transitionProperty: "transform",
        effect: { getTiming: () => ({ duration: 280, easing: "linear" }) },
      },
    ] as unknown as Animation[];
  sidebar.append(clip);
  container.prepend(sidebar);

  render(false);
  expect(animate.mock.calls[0]?.[1]).toEqual({
    duration: 280,
    easing: "cubic-bezier(0.2, 0.65, 0.3, 1)",
  });
});

it("tracks direct resizing and cancels an active slide when layout changes", () => {
  render(true);
  left = 400;
  width = 600;
  resize();
  render(false);
  expect(animate.mock.calls[0]?.[0]).toEqual([
    { transform: "translateX(352px)" },
    { transform: "translateX(0)" },
  ]);
  resize();
  expect(motions[0].cancel).not.toHaveBeenCalled();
  width = 800;
  resize();
  expect(motions[0].cancel).toHaveBeenCalledOnce();
});

it("respects reduced motion and cancels a slide when the preference changes", () => {
  reduce = true;
  render(true);
  render(false);
  expect(animate).not.toHaveBeenCalled();
  reduce = false;
  render(true);
  reduce = true;
  preferenceChanged();
  expect(motions[0].cancel).toHaveBeenCalledOnce();
});

it("does not restart motion for unrelated parent updates and cancels on unmount", () => {
  render(true);
  render(false);
  render(false);
  expect(animate).toHaveBeenCalledOnce();
  act(() => root.render(null));
  expect(motions[0].cancel).toHaveBeenCalledOnce();
});
