import { describe, expect, it } from "vitest";
import {
  bezelDisplacement,
  bezelWidth,
  isChromiumUserAgent,
} from "./liquidGlass";

describe("liquid glass refraction", () => {
  it("leaves the flat center untouched", () => {
    expect(bezelDisplacement(150, 28, 300, 56, 28, 16)).toEqual([0, 0]);
    expect(bezelDisplacement(60, 28, 300, 56, 28, 16)).toEqual([0, 0]);
  });

  it("samples inward, strongest at the edge", () => {
    const [leftX] = bezelDisplacement(0.5, 24, 48, 48, 24, 14);
    const [rightX] = bezelDisplacement(47.5, 24, 48, 48, 24, 14);
    const [, topY] = bezelDisplacement(150, 0.5, 300, 56, 28, 16);
    const [, nearTopY] = bezelDisplacement(150, 10, 300, 56, 28, 16);
    expect(leftX).toBeGreaterThan(0.9);
    expect(rightX).toBeLessThan(-0.9);
    expect(topY).toBeGreaterThan(nearTopY);
    expect(nearTopY).toBeGreaterThan(0);
  });

  it("follows the corner curve diagonally", () => {
    const [dx, dy] = bezelDisplacement(2, 2, 300, 56, 28, 16);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0);
    expect(dx).toBeCloseTo(dy, 5);
  });

  it("keeps the bezel inside small controls", () => {
    expect(bezelWidth(48, 48)).toBeCloseTo(16.8);
    expect(bezelWidth(340, 56)).toBeCloseTo(19.6);
    expect(bezelWidth(320, 812)).toBe(24);
  });

  it("enables refraction on Chromium but not on iOS WebKit", () => {
    expect(
      isChromiumUserAgent(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
    expect(
      isChromiumUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      ),
    ).toBe(false);
    expect(
      isChromiumUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});
