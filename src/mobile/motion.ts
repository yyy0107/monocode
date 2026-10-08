// Shared motion vocabulary for the mobile shell. CSS reads the same values
// from the `--mobile-motion-*` / `--mobile-spring-*` tokens in motion.css;
// motion.test.ts keeps the two in sync.

/**
 * A damped spring described the way designers tune it: `response` is the
 * undamped period in seconds (how quickly it gets there) and `damping` the
 * damping ratio (1 = no overshoot). Values near 0.85–0.95 give a settle with
 * an overshoot well under one percent.
 */
export interface Spring {
  response: number;
  damping: number;
}

export const MOBILE_SPRINGS = {
  /** Travel of small controls: switch thumbs, the leading edge of a tab indicator. */
  snappy: { response: 0.3, damping: 0.86 },
  /** Trailing edges and larger surfaces that should arrive a beat later. */
  smooth: { response: 0.36, damping: 0.9 },
  /** A pressed control returning to rest after the finger lifts. */
  release: { response: 0.26, damping: 0.8 },
} as const satisfies Record<string, Spring>;

export const MOBILE_MOTION = {
  /** Press-in feedback; it starts on touch and must not wait for the spring. */
  pressMs: 120,
  /** Color and small state feedback such as a switch track. */
  feedbackMs: 160,
  /** Content entering after a switch (tab panels, swapped labels). */
  contentInMs: 220,
  /** Content leaving; shorter than entering so the two never overlap long. */
  contentOutMs: 140,
  /** Short travel for entering and leaving content. */
  shiftPx: 8,
  /** How much a pressed control shrinks. */
  pressScale: 0.97,
} as const;

/** Residual displacement treated as settled; sub-pixel for control-sized travel. */
const SETTLE = 0.005;
const SAMPLES = 24;

function position(spring: Spring, t: number) {
  const omega = (2 * Math.PI) / spring.response;
  const zeta = spring.damping;
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const decay = zeta * omega;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    Math.exp(-decay * t) *
      (Math.cos(damped * t) + (decay / damped) * Math.sin(damped * t))
  );
}

/** Time in ms until the spring's envelope stays within SETTLE of rest. */
export function springDuration(spring: Spring): number {
  const omega = (2 * Math.PI) / spring.response;
  const zeta = Math.min(spring.damping, 0.999);
  const amplitude = 1 / Math.sqrt(1 - zeta * zeta);
  const seconds = Math.log(amplitude / SETTLE) / (zeta * omega);
  return Math.ceil((seconds * 1000) / 10) * 10;
}

/** The spring as a CSS `linear()` easing over `springDuration(spring)`. */
export function springEasing(spring: Spring): string {
  const duration = springDuration(spring) / 1000;
  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index++) {
    const value =
      index === SAMPLES ? 1 : position(spring, (duration * index) / SAMPLES);
    points.push(String(Math.round(value * 1000) / 1000));
  }
  return `linear(${points.join(", ")})`;
}
