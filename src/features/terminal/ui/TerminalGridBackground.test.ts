// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TerminalGridBackground } from "./TerminalGridBackground";

const { arcades } = vi.hoisted(() => ({
  arcades: [] as Array<{
    step: ReturnType<typeof vi.fn>;
    takeControl: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock("../arcade/gridGames", () => ({
  SLIDE_HOLD_MS: 16_000,
  stepSlider: (index: number) => ({ index: 1 - index, dir: 1 }),
  GRID_GAMES: ["pacman", "snake"].map((id) => ({
    id,
    label: id,
    playLabel: id,
    idleDim: 0.5,
    lives: true,
    create: () => {
      let controlled = false;
      const arcade = {
        resize: vi.fn(),
        step: vi.fn(),
        takeControl: vi.fn(() => {
          controlled = true;
        }),
        releaseControl: () => {
          controlled = false;
        },
        controlled: () => controlled,
        setMode: vi.fn(),
        steer: vi.fn(),
        score: () => 0,
        lives: () => 3,
        stamp: (out: Float32Array) => {
          out[0] = 1;
        },
        fade: () => 1,
        logoPickup: () => null,
        sprites: () => [],
        speechBubble: () => null,
      };
      arcades.push(arcade);
      return arcade;
    },
  })),
}));

let root: Root;
let host: HTMLDivElement;
let now: number;
let frameId: number;
let frameCallbacks: number;
let frames: Map<number, FrameRequestCallback>;
let intersections: Map<Element, (visible: boolean) => void>;
let mediaChanged: () => void;
let reduced: boolean;
let measure: ReturnType<typeof vi.spyOn>;
const contexts: Array<{
  clearRect: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
}> = [];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  arcades.length = 0;
  contexts.length = 0;
  now = 1000;
  frameId = 0;
  frameCallbacks = 0;
  reduced = false;
  frames = new Map();
  intersections = new Map();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_event: string, callback: () => void) => {
      mediaChanged = callback;
    },
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(element: Element) {
        intersections.set(element, (isIntersecting) =>
          this.callback(
            [{ target: element, isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          ),
        );
      }
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "Path2D",
    class {
      rect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const ctx = {
      clearRect: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
    };
    contexts.push(ctx);
    return ctx as unknown as CanvasRenderingContext2D;
  });
  measure = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function () {
      const hidden = (this as HTMLElement).closest(
        '[data-pane-visible="false"]',
      );
      return { width: hidden ? 0 : 1000, height: hidden ? 0 : 192 } as DOMRect;
    });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function tick(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 33;
    const callbacks = [...frames.values()];
    frames.clear();
    frameCallbacks += callbacks.length;
    act(() => callbacks.forEach((callback) => callback(now)));
  }
}

it("bounds animation work to the displayed board when 39 tab panes stay mounted", () => {
  act(() =>
    root.render(
      createElement(
        "div",
        {},
        ...Array.from({ length: 39 }, (_, index) =>
          createElement(
            "div",
            { key: index, "data-pane-visible": String(index === 0) },
            createElement(TerminalGridBackground, { visible: index === 0 }),
          ),
        ),
      ),
    ),
  );
  measure.mockClear();
  for (const ctx of contexts) {
    ctx.clearRect.mockClear();
    ctx.stroke.mockClear();
    ctx.strokeRect.mockClear();
  }
  tick(10);
  const paints = contexts.reduce(
    (sum, ctx) => sum + ctx.clearRect.mock.calls.length,
    0,
  );
  const cellStrokes = contexts.reduce(
    (sum, ctx) => sum + ctx.strokeRect.mock.calls.length,
    0,
  );
  console.info(
    "39-pane animation work over 10 frames",
    JSON.stringify({
      frameCallbacks,
      layoutReads: measure.mock.calls.length,
      paints,
      cellStrokes,
    }),
  );
  expect(frameCallbacks).toBe(10);
  expect(measure).not.toHaveBeenCalled();
  expect(paints).toBe(10);
  expect(cellStrokes).toBe(0);
  expect(frames.size).toBe(1);
});

it("pauses hidden panes, scrolled-off backgrounds and hidden windows, preserving game state on return", () => {
  const render = (visible: boolean) =>
    act(() => root.render(createElement(TerminalGridBackground, { visible })));
  render(true);
  const grid = [...intersections.keys()][0]!;
  act(() => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(arcades[0]!.takeControl).toHaveBeenCalledOnce();
  render(false);
  const previousTicks = arcades[0]!.step.mock.calls.length;
  tick(5);
  expect(frames.size).toBe(0);
  expect(arcades[0]!.step).toHaveBeenCalledTimes(previousTicks);
  render(true);
  expect(frames.size).toBe(1);
  expect(arcades).toHaveLength(2);
  act(() => intersections.get(grid)!(false));
  tick(5);
  expect(frames.size).toBe(0);
  act(() => intersections.get(grid)!(true));
  expect(frames.size).toBe(1);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(frames.size).toBe(0);
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(frames.size).toBe(1);
  expect(arcades[0]!.takeControl).toHaveBeenCalledOnce();
});

it("paints both boards during a slide, then stops ticking the outgoing board", () => {
  act(() => root.render(createElement(TerminalGridBackground)));
  act(() =>
    host.querySelector<HTMLButtonElement>('[aria-label="snake"]')!.click(),
  );
  for (const arcade of arcades) arcade.step.mockClear();
  tick(2);
  expect(arcades[0]!.step).toHaveBeenCalledTimes(2);
  expect(arcades[1]!.step).toHaveBeenCalledTimes(2);
  tick(23);
  const previousTicks = arcades[0]!.step.mock.calls.length;
  tick(3);
  expect(arcades[0]!.step).toHaveBeenCalledTimes(previousTicks);
  expect(arcades[1]!.step).toHaveBeenCalledTimes(28);
});

it("keeps reduced-motion decoration static while explicit gameplay remains interactive", () => {
  reduced = true;
  act(() => root.render(createElement(TerminalGridBackground)));
  expect(contexts[0]!.clearRect).toHaveBeenCalled();
  expect(frames.size).toBe(0);
  act(() => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(frames.size).toBe(1);
  tick(3);
  expect(arcades[0]!.takeControl).toHaveBeenCalledOnce();
  act(() =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].at(-1)!.click(),
  );
  expect(frames.size).toBe(0);
  reduced = false;
  act(() => mediaChanged());
  expect(frames.size).toBe(1);
});
