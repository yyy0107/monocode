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

/**
 * Optional launch state. `velocity` is the speed at release in units of the
 * whole travel per second (px/s divided by the remaining distance), so a
 * gesture hands its momentum to the spring instead of starting from rest.
 */
export interface SpringLaunch {
  velocity?: number;
}

function motion(spring: Spring, velocity: number) {
  const omega = (2 * Math.PI) / spring.response;
  const zeta = Math.min(spring.damping, 0.999);
  const decay = zeta * omega;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  // Displacement from rest: d(0) = -1, d'(0) = velocity.
  const sine = (velocity - decay) / damped;
  return {
    decay,
    amplitude: Math.hypot(1, sine),
    at: (t: number) =>
      1 -
      Math.exp(-decay * t) * (Math.cos(damped * t) - sine * Math.sin(damped * t)),
  };
}

/** Time in ms until the spring's envelope stays within SETTLE of rest. */
export function springDuration(spring: Spring, launch: SpringLaunch = {}): number {
  const { decay, amplitude } = motion(spring, launch.velocity ?? 0);
  const seconds = Math.log(amplitude / SETTLE) / decay;
  return Math.ceil((seconds * 1000) / 10) * 10;
}

/**
 * The spring as a CSS `linear()` easing over `springDuration`. Surfaces bound
 * to a screen edge pass `clamp` so a fast fling stops at rest instead of
 * overshooting past the edge.
 */
export function springEasing(
  spring: Spring,
  launch: SpringLaunch & { clamp?: boolean } = {},
): string {
  const { at } = motion(spring, launch.velocity ?? 0);
  const duration = springDuration(spring, launch) / 1000;
  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index++) {
    let value = index === SAMPLES ? 1 : at((duration * index) / SAMPLES);
    if (launch.clamp) value = Math.min(1, value);
    points.push(String(Math.round(value * 1000) / 1000));
  }
  return `linear(${points.join(", ")})`;
}

/**
 * A CSS transition value that continues a released gesture: `velocity` is in
 * px/ms toward the target and `distance` the px still to travel.
 */
export function springTransition(
  property: string,
  spring: Spring,
  distance: number,
  velocity: number,
): { transition: string; duration: number } {
  // Ignore velocity pointing away from the target and cap wild flicks.
  const normalized =
    Math.abs(distance) < 1 ? 0 : Math.min(40, Math.max(0, (velocity * 1000) / Math.abs(distance)));
  const launch = { velocity: normalized, clamp: true };
  const duration = springDuration(spring, launch);
  return {
    transition: `${property} ${duration}ms ${springEasing(spring, launch)}`,
    duration,
  };
}
