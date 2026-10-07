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
  vi.advanceTimersByTime(120);
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
  vi.advanceTimersByTime(120);
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

it("coalesces other glass surface resizing and updates only the settled lens", () => {
  const { width, height, encode, resize } = fixture("mobile-jump");
  width.mockReturnValue(51);
  height.mockReturnValue(47);
  const beforeResize = encode.mock.calls.length;
  resize();
  vi.advanceTimersByTime(16);
  expect(encode).toHaveBeenCalledTimes(beforeResize);
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("47");
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(beforeResize + 1);
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
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(before + 1);
});


it("ignores perpetual child animations when settling a panel lens", () => {
  const { composer, height, encode, resize } = fixture("mobile-sheet");
  composer.getAnimations = () => [{
    playState: "running",
    effect: { getComputedTiming: () => ({ iterations: Infinity }) },
  }] as unknown as Animation[];
  const before = encode.mock.calls.length;
  height.mockReturnValue(173);
  resize();
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(before + 1);
});

it("discovers portals incrementally without rescanning streamed transcript content", async () => {
  const { composer } = fixture();
  const scanRoot = vi.spyOn(document.body, "querySelectorAll");
  const transcript = document.createElement("div");
  document.body.append(transcript);
  transcript.append(document.createTextNode("streaming"));
  transcript.className = "streaming";
  const portal = document.createElement("section");
  portal.className = "mobile-sheet";
  document.body.append(portal);
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(2);
  expect(scanRoot).not.toHaveBeenCalled();
  composer.className = "plain";
  portal.remove();
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(0);
});

it("updates lenses when header capsule eligibility changes", async () => {
  fixture();
  const header = document.createElement("header");
  header.className = "mobile-header";
  const capsule = document.createElement("button");
  header.append(capsule);
  document.body.append(header);
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(1);
  header.dataset.floating = "true";
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(2);
  capsule.dataset.capsule = "false";
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(1);
});


it("restores the original lens box on rapid resize reversal without encoding again", () => {
  const { height, encode, resize } = fixture();
  const before = encode.mock.calls.length;
  height.mockReturnValue(67);
  resize();
  vi.advanceTimersByTime(16);
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("67");
  height.mockReturnValue(97);
  resize();
  vi.advanceTimersByTime(120);
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("97");
  expect(encode).toHaveBeenCalledTimes(before);
});
