// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  installKeyboardMotion,
  settledEasing,
  transcriptFollow,
} from "./keyboardMotion";

const scroller = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
) => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

describe("transcript keyboard follow", () => {
  it("follows the whole rise when pinned to a long transcript", () => {
    expect(transcriptFollow(scroller(1200, 2000, 800), 2000, 300)).toBe(1);
  });
  it("stays put when the reader has scrolled away from the bottom", () => {
    expect(transcriptFollow(scroller(400, 2000, 800), 2000, 300)).toBe(0);
  });
  it("follows only as far as a short transcript can scroll", () => {
    // 900px of content: the 500px viewport can scroll 400px, from 100px.
    expect(transcriptFollow(scroller(100, 900, 800), 900, 300)).toBe(1);
    // 600px of content: the 500px viewport can scroll 100px, from 0.
    expect(transcriptFollow(scroller(0, 800, 800), 600, 300)).toBeCloseTo(
      1 / 3,
    );
  });
  it("lowers with the keyboard as far as the taller viewport clamps the offset", () => {
    expect(transcriptFollow(scroller(1500, 2000, 500), 2000, -300)).toBe(1);
    expect(transcriptFollow(scroller(1000, 2000, 500), 2000, -300)).toBe(0);
    expect(transcriptFollow(scroller(100, 600, 500), 600, -300)).toBeCloseTo(
      1 / 3,
    );
  });
});

describe("keyboard easing", () => {
  it("clamps an overshooting keyboard spring so controls settle once", () => {
    expect(settledEasing("linear(0.0000,0.6000,1.0800,1.0200,1.0000)")).toBe(
      "linear(0, 0.6, 1, 1, 1)",
    );
    expect(settledEasing("linear(-0.05, 0.5 40%, 1)")).toBe(
      "linear(0, 0.5 40%, 1)",
    );
  });
  it("leaves other curves unchanged", () => {
    expect(settledEasing("cubic-bezier(0.2, 0, 0, 1)")).toBe(
      "cubic-bezier(0.2, 0, 0, 1)",
    );
  });
});

describe("keyboard page pan", () => {
  it("undoes a WebView pan that would lift the composer twice", () => {
    const uninstall = installKeyboardMotion();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollY = vi.spyOn(window, "scrollY", "get");
    try {
      scrollY.mockReturnValue(0);
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).not.toHaveBeenCalled();
      scrollY.mockReturnValue(280);
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    } finally {
      uninstall();
      scrollTo.mockRestore();
      scrollY.mockRestore();
    }
  });
});
