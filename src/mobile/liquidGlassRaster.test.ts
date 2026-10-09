// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { bezelDisplacement, bezelWidth, installLiquidGlass } from "./liquidGlass";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { width: 390, height: 844, radius: 42 },
  { width: 320, height: 812, radius: 24 },
  { width: 343, height: 93, radius: 29.5 },
  { width: 48, height: 48, radius: 24 },
  { width: 31, height: 41, radius: 0 },
  { width: 131, height: 4, radius: 1.5 },
  { width: 9, height: 33, radius: 2 },
  { width: 5, height: 7, radius: 99 },
  { width: 4, height: 4, radius: 0 },
])("preserves every displacement byte for $width × $height, radius $radius", ({ width, height, radius }) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chromium/141.0");
  vi.spyOn(CSS, "supports").mockReturnValue(true);
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  const putImageData = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
  const surface = document.createElement("section");
  surface.className = "mobile-sheet";
  surface.style.borderRadius = `${radius}px`;
  vi.spyOn(surface, "offsetWidth", "get").mockReturnValue(width);
  vi.spyOn(surface, "offsetHeight", "get").mockReturnValue(height);
  document.body.append(surface);
  dispose = installLiquidGlass(document.body);

  expect(putImageData).toHaveBeenCalledOnce();
  const actual: Uint8ClampedArray = putImageData.mock.calls[0][0].data;
  const expected = new Uint8ClampedArray(width * height * 4);
  const bezel = bezelWidth(width, height);
  // The original per-pixel scalar formula is the reference, including byte
  // clamping/rounding and opaque neutral pixels outside the refraction edge.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = bezelDisplacement(x + 0.5, y + 0.5, width, height, radius, bezel);
      const i = (y * width + x) * 4;
      expected[i] = 128 + dx * 127;
      expected[i + 1] = 128 + dy * 127;
      expected[i + 2] = 128;
      expected[i + 3] = 255;
    }
  }
  expect(actual.length).toBe(expected.length);
  expect(actual.findIndex((byte, index) => byte !== expected[index])).toBe(-1);
});
