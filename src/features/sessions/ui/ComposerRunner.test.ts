// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ComposerRunner } from "./ComposerRunner";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps animating through transcript changes without measuring layout each frame", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(performance, "now").mockReturnValue(1000);
  let frame: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const box = document.createElement("div");
  box.dataset.composer = "";
  const measure = vi.spyOn(box, "getBoundingClientRect").mockReturnValue({
    left: 20,
    right: 320,
    top: 400,
    bottom: 480,
    width: 300,
    height: 80,
  } as DOMRect);
  document.body.append(box);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        createElement(ComposerRunner, {
          boxRef: { current: box },
          cwd: "/work/project",
          busy: true,
          onExited: vi.fn(),
        }),
      ),
    );
    const startedAt = 1000;
    for (let i = 1; i <= 5; i++) {
      box.append(document.createElement("span"));
      act(() => frame?.(startedAt + i * 16));
    }
    expect(measure).toHaveBeenCalledOnce();

    act(() => frame?.(startedAt + 120));
    expect(measure).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    host.remove();
    box.remove();
  }
});

function runnerFixture(reduced = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const media = {
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) =>
    frames.delete(frame),
  );
  let intersect: (visible: boolean) => void = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        intersect = (isIntersecting) =>
          this.callback(
            [{ target, isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      disconnect() {}
    },
  );
  const box = document.createElement("div");
  box.dataset.composer = "";
  const measure = vi.spyOn(box, "getBoundingClientRect").mockReturnValue({
    left: 20,
    right: 320,
    top: 400,
    bottom: 480,
    width: 300,
    height: 80,
  } as DOMRect);
  const host = document.createElement("div");
  document.body.append(box, host);
  const root = createRoot(host);
  const boxRef = { current: box };
  const onExited = vi.fn();
  const render = (enabled = true, busy = true) =>
    act(() =>
      root.render(
        createElement(ComposerRunner, {
          boxRef,
          cwd: "/work/project",
          busy,
          enabled,
          onExited,
        }),
      ),
    );
  const tick = (elapsed = 16) => {
    now += elapsed;
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => callbacks.forEach((callback) => callback(now)));
  };
  const dispose = () => {
    act(() => root.unmount());
    box.remove();
    host.remove();
  };
  return {
    render,
    tick,
    measure,
    frames,
    onExited,
    dispose,
    intersect: (visible: boolean) => act(() => intersect(visible)),
    media,
  };
}

it("stops hidden-tab animation and resumes at the same position without resetting the runner", () => {
  const runner = runnerFixture();
  try {
    runner.render();
    runner.tick(33);
    const sprite = document.querySelector<HTMLElement>(
      "[style*='--runner-x']",
    )!;
    const position = sprite.style.getPropertyValue("--runner-x");
    runner.render(false);
    runner.measure.mockClear();
    runner.tick(10_000);
    expect(runner.frames.size).toBe(0);
    expect(runner.measure).not.toHaveBeenCalled();
    expect(sprite.style.getPropertyValue("--runner-x")).toBe(position);
    runner.render();
    expect(runner.frames.size).toBe(1);
    expect(sprite.style.getPropertyValue("--runner-x")).toBe(position);
    expect(runner.onExited).not.toHaveBeenCalled();
  } finally {
    runner.dispose();
  }
});

it("pauses offscreen and hidden-window animation and finishes a hidden completed turn once", () => {
  const runner = runnerFixture();
  try {
    runner.render();
    runner.intersect(false);
    runner.tick(1000);
    expect(runner.frames.size).toBe(0);
    runner.intersect(true);
    expect(runner.frames.size).toBe(1);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(runner.frames.size).toBe(0);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(runner.frames.size).toBe(1);
    runner.render(false, false);
    expect(runner.frames.size).toBe(0);
    expect(runner.onExited).toHaveBeenCalledOnce();
    runner.tick(1000);
    expect(runner.onExited).toHaveBeenCalledOnce();
  } finally {
    runner.dispose();
  }
});

it("shows a static reduced-motion mascot without a permanent frame loop and still completes", () => {
  const runner = runnerFixture(true);
  try {
    runner.render();
    expect(runner.measure).toHaveBeenCalledOnce();
    expect(runner.frames.size).toBe(0);
    expect(
      document.querySelector<SVGElement>(".mascot-active")!.style
        .animationPlayState,
    ).toBe("paused");
    runner.render(true, false);
    expect(runner.frames.size).toBe(0);
    expect(runner.onExited).toHaveBeenCalledOnce();
  } finally {
    runner.dispose();
  }
});
