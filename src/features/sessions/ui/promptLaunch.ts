/** Where a composer's text sat when it was sent, in viewport pixels. */
export type PromptLaunchOrigin = {
  left: number;
  bottom: number;
  width: number;
  height: number;
};

// A send waits on a Host round trip; an origin older than this no longer
// matches what the reader remembers, so the bubble rises from the dock instead.
const LAUNCH_TTL_MS = 15_000;

let launch: { origin: PromptLaunchOrigin; at: number } | undefined;

/** Where the given composer text sits now, if it is on screen. */
export function readPromptLaunch(element: Element | null): PromptLaunchOrigin | undefined {
  const rect = element?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return undefined;
  return { left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height };
}

/** Record the composer text the next transcript prompt should fly out of. */
export function notePromptLaunch(element: Element | null) {
  const origin = readPromptLaunch(element);
  if (origin) launch = { origin, at: performance.now() };
}

/** The pending launch origin, consumed once by the prompt it introduces. */
export function takePromptLaunch(): PromptLaunchOrigin | undefined {
  const current = launch;
  launch = undefined;
  return current && performance.now() - current.at <= LAUNCH_TTL_MS
    ? current.origin
    : undefined;
}

// Sampled once per ~16ms; linear steps between samples trace the springs.
const LAUNCH_FRAME_MS = 16;
const LAUNCH_MAX_MS = 1000;
// Travel: a quick, nearly critically damped spring with a hint of overshoot.
const LAUNCH_TRAVEL_FREQUENCY = 14;
const LAUNCH_TRAVEL_DAMPING = 0.8;
// Jelly: a loose spring that stretches with travel speed and wobbles on landing.
const LAUNCH_JELLY_STIFFNESS = 1400;
const LAUNCH_JELLY_DAMPING = 0.22;
const LAUNCH_JELLY_STRETCH = 0.018;
const LAUNCH_JELLY_LIMIT = 0.12;
// Width: narrows from the composer to the bubble a little behind the travel.
const LAUNCH_WIDTH_FREQUENCY = 10;

export type LaunchFrame = { offset: number; travel: number; jelly: number; width: number };

/** Steps the travel, jelly and width springs until everything settles. */
function launchFrames(intensity: number): { frames: LaunchFrame[]; landedMs: number } {
  const step = 1 / 240;
  const travelK = LAUNCH_TRAVEL_FREQUENCY ** 2;
  const travelC = 2 * LAUNCH_TRAVEL_DAMPING * LAUNCH_TRAVEL_FREQUENCY;
  const jellyC = 2 * LAUNCH_JELLY_DAMPING * Math.sqrt(LAUNCH_JELLY_STIFFNESS);
  const widthK = LAUNCH_WIDTH_FREQUENCY ** 2;
  const widthC = 2 * LAUNCH_WIDTH_FREQUENCY;
  let travel = 0, travelV = 0, jelly = 0, jellyV = 0, width = 0, widthV = 0;
  let landedMs: number | undefined;
  const samples: Omit<LaunchFrame, "offset">[] = [];
  let ms = 0;
  for (let tick = 0; ms <= LAUNCH_MAX_MS; tick++) {
    ms = tick * step * 1000;
    if (tick % Math.round(LAUNCH_FRAME_MS / (step * 1000)) === 0) {
      samples.push({ travel, jelly, width: Math.min(width, 1) });
      const settled = Math.abs(1 - travel) < 0.002 && Math.abs(travelV) < 0.05 &&
        Math.abs(jelly) < 0.003 && Math.abs(jellyV) < 0.05 && width > 0.995;
      if (settled && samples.length > 2) break;
    }
    if (landedMs === undefined && travel > 0.97) landedMs = ms;
    travelV += (travelK * (1 - travel) - travelC * travelV) * step;
    travel += travelV * step;
    const stretch = LAUNCH_JELLY_STRETCH * intensity * travelV;
    jellyV += (LAUNCH_JELLY_STIFFNESS * (stretch - jelly) - jellyC * jellyV) * step;
    jelly = Math.max(-LAUNCH_JELLY_LIMIT, Math.min(LAUNCH_JELLY_LIMIT, jelly + jellyV * step));
    widthV += (widthK * (1 - width) - widthC * widthV) * step;
    width += widthV * step;
  }
  samples[samples.length - 1] = { travel: 1, jelly: 0, width: 1 };
  return {
    frames: samples.map((sample, index) => ({
      ...sample,
      offset: index / (samples.length - 1),
    })),
    landedMs: landedMs ?? samples.length * LAUNCH_FRAME_MS,
  };
}

export type PromptFlight = {
  /** The bubble's flight first, then its fade. */
  animations: Animation[];
  frames: LaunchFrame[];
  duration: number;
  /** When the bubble reaches its spot, before the landing wobble settles. */
  landedMs: number;
  /** Drops the temporary sizing; safe to call more than once. */
  release: () => void;
};

/**
 * Flies a sent prompt's bubble out of the composer text it was typed in: it
 * starts as wide as the composer, narrows to its own width on the way up, and
 * lands with a jelly wobble. Without an origin it rises from `fromBottom`.
 */
export function flyPromptBubble(
  bubble: HTMLElement,
  view: DOMRect,
  launch: PromptLaunchOrigin | undefined,
  fromBottom: number,
): PromptFlight | undefined {
  const target = bubble.getBoundingClientRect();
  // The composer may have shrunk since the send; never start below the view.
  const startBottom = launch ? Math.min(launch.bottom, view.bottom) : fromBottom;
  const dy = startBottom - target.bottom;
  if (!(dy > 1)) return undefined;
  const style = getComputedStyle(bubble);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const inset = padLeft + (parseFloat(style.paddingRight) || 0);
  // The bubble keeps its right edge, so it widens leftward toward the
  // composer text without leaving the screen.
  const startWidth = launch
    ? Math.max(target.width, Math.min(launch.width + inset, target.right - view.left - 4))
    : target.width;
  const startLeft = target.right - startWidth;
  const dx = launch
    ? Math.max(view.left - startLeft, Math.min(0, launch.left - padLeft - startLeft))
    : 0;
  // Pin the content to its final width so text never rewraps mid-flight.
  const content = [...bubble.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const reshape = startWidth - target.width > 1;
  if (reshape) {
    for (const child of content) {
      child.style.width = `${child.getBoundingClientRect().width}px`;
      if (getComputedStyle(child).display === "inline") child.style.display = "inline-block";
    }
    bubble.style.maxWidth = "none";
  }
  let released = false;
  const release = () => {
    if (released || !reshape) return;
    released = true;
    for (const child of content) {
      child.style.removeProperty("width");
      child.style.removeProperty("display");
    }
    bubble.style.removeProperty("max-width");
  };
  const { frames, landedMs } = launchFrames(Math.min(1, dy / 400));
  const duration = frames.length > 1 ? (frames.length - 1) * LAUNCH_FRAME_MS : LAUNCH_FRAME_MS;
  const flight = bubble.animate(
    frames.map(({ offset, travel, jelly, width }) => {
      const rest = 1 - travel;
      // Stretch along the flight, squash on landing; roughly keep the volume.
      const scaleY = 1 + jelly;
      const scaleX = 1 - jelly * 0.7;
      return {
        offset,
        transformOrigin: "100% 100%",
        transform: `translate(${(dx * rest).toFixed(2)}px, ${(dy * rest).toFixed(2)}px) ` +
          `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`,
        ...(reshape
          ? { width: `${(startWidth + (target.width - startWidth) * width).toFixed(2)}px` }
          : {}),
      };
    }),
    { duration, easing: "linear" },
  );
  flight.onfinish = release;
  // Text the reader just watched leave the composer is visible from the start.
  const fade = bubble.animate([{ opacity: launch ? 0.4 : 0 }, { opacity: 1 }], {
    duration: launch ? 140 : 200,
    easing: "ease-out",
  });
  return { animations: [flight, fade], frames, duration, landedMs, release };
}
