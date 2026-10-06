// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { installLiquidGlass, setLiquidGlassRefraction } from "./liquidGlass";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function fixture(className = "mobile-composer") {
  vi.useFakeTimers();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chromium/141.0");
  vi.spyOn(CSS, "supports").mockReturnValue(true);
  const callbacks: (() => void)[] = [];
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { callbacks.push(callback); }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
  const encode = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
  const composer = document.createElement("form");
  composer.className = className;
  composer.style.borderRadius = "26px";
  const width = vi.spyOn(composer, "offsetWidth", "get").mockReturnValue(311);
  const height = vi.spyOn(composer, "offsetHeight", "get").mockReturnValue(97);
  document.body.append(composer);
  setLiquidGlassRefraction(1);
  dispose = installLiquidGlass(document.body);
  return { composer, width, height, encode, callbacks, resize: callbacks[0] };
}

it("stretches the existing composer lens during resize and rasterizes only the settled size", () => {
  const { height, encode, resize } = fixture();
  expect(encode).toHaveBeenCalledOnce();
  for (const size of [90, 78, 64, 54]) {
    height.mockReturnValue(size);
    resize();
    vi.advanceTimersByTime(16);
  }
  expect(encode).toHaveBeenCalledOnce();
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("54");
  vi.advanceTimersByTime(80);
  expect(encode).toHaveBeenCalledTimes(2);
  resize();
  expect(encode).toHaveBeenCalledTimes(2);
});

it("defers composer rasterization until its transitions finish", () => {
  const { composer, height, encode, resize } = fixture();
  let running = true;
  composer.getAnimations = () =>
    [{ playState: running ? "running" : "finished" }] as unknown as Animation[];
  const before = encode.mock.calls.length;
  height.mockReturnValue(63);
  resize();
  vi.advanceTimersByTime(240);
  expect(encode).toHaveBeenCalledTimes(before);
  running = false;
  vi.advanceTimersByTime(80);
  expect(encode).toHaveBeenCalledTimes(before + 1);
});

it("cancels pending rasterization when liquid glass is disabled or disposed", () => {
  const { composer, height, encode, resize } = fixture();
  height.mockReturnValue(69);
  resize();
  setLiquidGlassRefraction(0);
  const count = encode.mock.calls.length;
  vi.advanceTimersByTime(100);
  expect(encode).toHaveBeenCalledTimes(count);
  expect(composer.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  setLiquidGlassRefraction(1);
  height.mockReturnValue(41);
  resize();
  const beforeDispose = encode.mock.calls.length;
  dispose!();
  dispose = undefined;
  vi.advanceTimersByTime(100);
  expect(encode).toHaveBeenCalledTimes(beforeDispose);
  expect(document.querySelector("filter")).toBeNull();
  expect(composer.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
});

it("keeps immediate lens updates for other glass surfaces", () => {
  const { width, height, encode, resize } = fixture("mobile-jump");
  width.mockReturnValue(51);
  height.mockReturnValue(47);
  const beforeResize = encode.mock.calls.length;
  resize();
  expect(encode).toHaveBeenCalledTimes(beforeResize + 1);
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("47");
  expect(vi.getTimerCount()).toBe(0);
});


it("gives the stacked composer cards separate lenses and defers input resizing", () => {
  const { composer, encode, callbacks } = fixture("mobile-composer mobile-composer-card");
  expect(document.querySelectorAll("filter")).toHaveLength(0);
  const context = document.createElement("div");
  context.className = "mobile-composer-context";
  const input = document.createElement("div");
  input.className = "mobile-composer-input";
  for (const element of [context, input]) {
    element.style.borderRadius = "30px";
    vi.spyOn(element, "offsetWidth", "get").mockReturnValue(327);
  }
  vi.spyOn(context, "offsetHeight", "get").mockReturnValue(70);
  const height = vi.spyOn(input, "offsetHeight", "get").mockReturnValue(131);
  composer.append(context, input);
  dispose!();
  dispose = installLiquidGlass(document.body);
  expect(document.querySelectorAll("filter")).toHaveLength(2);
  expect(context.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).not.toBe(context.style.getPropertyValue("--mobile-glass-refraction"));
  expect(composer.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  const before = encode.mock.calls.length;
  height.mockReturnValue(164);
  callbacks.at(-1)!();
  expect(encode).toHaveBeenCalledTimes(before);
  vi.advanceTimersByTime(80);
  expect(encode).toHaveBeenCalledTimes(before + 1);
});
