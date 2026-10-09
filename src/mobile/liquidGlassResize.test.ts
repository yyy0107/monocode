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


it("suspends both unfocused composer lenses until an attachment animation settles", () => {
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
  const contextHeight = vi.spyOn(context, "offsetHeight", "get").mockReturnValue(70);
  const height = vi.spyOn(input, "offsetHeight", "get").mockReturnValue(131);
  composer.append(context, input);
  dispose!();
  dispose = installLiquidGlass(document.body);
  expect(document.querySelectorAll("filter")).toHaveLength(2);
  expect(context.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).not.toBe(context.style.getPropertyValue("--mobile-glass-refraction"));
  expect(composer.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  let running = true;
  composer.getAnimations = () =>
    [{ playState: running ? "running" : "finished" }] as unknown as Animation[];
  const before = encode.mock.calls.length;
  contextHeight.mockReturnValue(204);
  height.mockReturnValue(164);
  callbacks.slice(-2).forEach(resize => resize());
  vi.advanceTimersByTime(16);
  for (const card of [context, input])
    expect(card.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  // No SVG resizing/rasterization while the field has no focus, and the rear
  // card must wait for the attachment animation in its sibling input card.
  expect([...document.querySelectorAll("feImage")].map(image => image.getAttribute("height")))
    .toEqual(["70", "131"]);
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(before);
  running = false;
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(before + 2);
  for (const card of [context, input])
    expect(card.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  expect([...document.querySelectorAll("feImage")].map(image => image.getAttribute("height")))
    .toEqual(["204", "164"]);
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

it("skips solid settings sheets and releases a lens when a sheet becomes solid", async () => {
  const { encode } = fixture("plain");
  const sheet = document.createElement("section");
  sheet.className = "mobile-sheet";
  sheet.dataset.surface = "solid";
  vi.spyOn(sheet, "offsetWidth", "get").mockReturnValue(390);
  vi.spyOn(sheet, "offsetHeight", "get").mockReturnValue(760);
  document.body.append(sheet);
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(0);
  expect(encode).not.toHaveBeenCalled();

  sheet.dataset.surface = "glass";
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(1);
  expect(sheet.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  sheet.dataset.surface = "solid";
  await vi.advanceTimersByTimeAsync(32);
  expect(document.querySelectorAll("filter")).toHaveLength(0);
  expect(sheet.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
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

function inputFixture(initiallyFocused = false) {
  const result = fixture("mobile-composer mobile-composer-card");
  const input = document.createElement("div");
  input.className = "mobile-composer-input";
  input.style.borderRadius = "30px";
  const textarea = document.createElement("textarea");
  input.append(textarea);
  result.composer.append(input);
  const width = vi.spyOn(input, "offsetWidth", "get").mockReturnValue(353);
  const height = vi.spyOn(input, "offsetHeight", "get").mockReturnValue(133);
  if (initiallyFocused) textarea.focus();
  dispose!();
  dispose = installLiquidGlass(document.body);
  return { ...result, input, textarea, width, height, resize: result.callbacks.at(-1)! };
}

it.each([false, true])("suspends both stacked lenses during typing and focus transfers (initial focus: %s)", async (initiallyFocused) => {
  const { composer, input, textarea, width, height, encode, callbacks } = inputFixture(initiallyFocused);
  const context = document.createElement("div");
  context.className = "mobile-composer-context";
  context.style.borderRadius = "30px";
  const model = document.createElement("button");
  context.append(model);
  composer.prepend(context);
  const contextWidth = vi.spyOn(context, "offsetWidth", "get").mockReturnValue(353);
  const contextHeight = vi.spyOn(context, "offsetHeight", "get").mockReturnValue(173);
  dispose!();
  dispose = installLiquidGlass(document.body);
  textarea.focus();
  const before = encode.mock.calls.length;
  for (const read of [width, height, contextWidth, contextHeight]) read.mockClear();
  for (const size of [181, 205, 133]) {
    height.mockReturnValue(size);
    contextHeight.mockReturnValue(size + 40);
    for (const resize of callbacks.slice(-2)) resize();
    vi.advanceTimersByTime(120);
  }
  model.focus();
  vi.advanceTimersByTime(120);
  expect(encode).toHaveBeenCalledTimes(before);
  for (const read of [width, height, contextWidth, contextHeight]) expect(read).not.toHaveBeenCalled();
  for (const card of [input, context])
    expect(card.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  // Removal may omit focusout. The mutation observer must resume both cards.
  model.remove();
  await vi.advanceTimersByTimeAsync(32);
  for (const card of [input, context]) {
    const filter = card.style.getPropertyValue("--mobile-glass-refraction");
    expect(filter).toContain("url(");
    expect(document.querySelector(`${filter.slice(4, -1)} feImage`)?.getAttribute("height"))
      .toBe(card === input ? "133" : "173");
  }
});

it("suspends the input lens and its resize work while focused, restoring the latest size on blur", () => {
  const { input, textarea, width, height, encode, resize } = inputFixture();
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  const before = encode.mock.calls.length;
  height.mockReturnValue(151);
  resize();
  vi.advanceTimersByTime(16);
  textarea.focus();
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  width.mockClear();
  height.mockClear();
  for (const size of [169, 181]) {
    height.mockReturnValue(size);
    resize();
    vi.advanceTimersByTime(120);
  }
  expect(encode).toHaveBeenCalledTimes(before);
  expect(width).not.toHaveBeenCalled();
  expect(height).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  textarea.blur();
  vi.advanceTimersByTime(16);
  expect(document.querySelector("feImage")?.getAttribute("height")).toBe("181");
  expect(encode).toHaveBeenCalledTimes(before + 1);
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
});

it("keeps an initially focused composer suspended across refraction setting changes", () => {
  const { input, textarea, encode, width, height } = inputFixture(true);
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  expect(encode).not.toHaveBeenCalled();
  expect(width).not.toHaveBeenCalled();
  expect(height).not.toHaveBeenCalled();
  // Solid, frosted and zero-intensity liquid all use refraction = 0.
  setLiquidGlassRefraction(0);
  textarea.blur();
  vi.advanceTimersByTime(120);
  expect(encode).not.toHaveBeenCalled();
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  textarea.focus();
  setLiquidGlassRefraction(1);
  expect(encode).not.toHaveBeenCalled();
  expect(width).not.toHaveBeenCalled();
  textarea.blur();
  vi.advanceTimersByTime(16);
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
});

it("keeps focus transfers within the input card suspended and cleans up listeners on disposal", async () => {
  const { input, textarea, height, encode } = inputFixture();
  const second = document.createElement("textarea");
  input.append(second);
  textarea.focus();
  const before = encode.mock.calls.length;
  height.mockReturnValue(193);
  second.focus();
  await vi.advanceTimersByTimeAsync(120);
  expect(encode).toHaveBeenCalledTimes(before);
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toBe("");
  second.remove();
  await vi.advanceTimersByTimeAsync(32);
  expect(input.style.getPropertyValue("--mobile-glass-refraction")).toContain("url(");
  dispose!();
  dispose = undefined;
  const afterDispose = encode.mock.calls.length;
  textarea.focus();
  textarea.blur();
  await vi.advanceTimersByTimeAsync(120);
  expect(encode).toHaveBeenCalledTimes(afterDispose);
  expect(document.querySelector("filter")).toBeNull();
});

it("never attaches a question lens inside a sheet and releases one moved into a sheet", async () => {
  const { callbacks } = fixture("plain");
  const sheet = document.createElement("section");
  sheet.className = "mobile-sheet";
  sheet.dataset.surface = "solid";
  const container = document.createElement("div");
  const question = document.createElement("div");
  question.className = "mobile-shared-question";
  container.append(question);
  sheet.append(container);
  document.body.append(sheet);
  await vi.advanceTimersByTimeAsync(32);
  expect(callbacks).toHaveLength(0);
  expect(document.querySelector("filter")).toBeNull();
  document.body.append(question);
  await vi.advanceTimersByTimeAsync(32);
  expect(callbacks).toHaveLength(1);
  expect(document.querySelectorAll("filter")).toHaveLength(1);
  container.append(question);
  await vi.advanceTimersByTimeAsync(32);
  expect(callbacks).toHaveLength(1);
  expect(document.querySelector("filter")).toBeNull();
});
