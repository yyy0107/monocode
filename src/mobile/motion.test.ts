import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOBILE_MOTION, MOBILE_SPRINGS, springDuration, springEasing } from "./motion";

const css = readFileSync("src/mobile/motion.css", "utf8");

function token(name: string) {
  return css.match(new RegExp(`--${name}:\\s*([^;]+);`, "g"))?.map((line) =>
    line.replace(/^[^:]+:\s*/, "").replace(/;$/, ""),
  );
}

describe("mobile motion tokens", () => {
  it("keeps CSS springs in sync with the generator", () => {
    for (const [name, spring] of Object.entries(MOBILE_SPRINGS)) {
      expect(token(`mobile-spring-${name}-duration`)).toEqual([
        `${springDuration(spring)}ms`,
      ]);
      expect(token(`mobile-spring-${name}`)).toContain(springEasing(spring));
    }
    expect(token("mobile-motion-press")).toEqual([`${MOBILE_MOTION.pressMs}ms`]);
    expect(token("mobile-motion-shift")).toEqual([`${MOBILE_MOTION.shiftPx}px`]);
  });

  it("settles with at most a slight overshoot", () => {
    for (const spring of Object.values(MOBILE_SPRINGS)) {
      const values = springEasing(spring).slice(7, -1).split(", ").map(Number);
      expect(values.at(-1)).toBe(1);
      expect(Math.max(...values)).toBeLessThanOrEqual(1.02);
    }
  });
});
