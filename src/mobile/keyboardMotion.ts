// Follows the Android soft keyboard. MainActivity reports where the keyboard
// is heading, with its duration and easing curve, as each animation starts.
// The WebView keeps its size while the keyboard rises and resizes once it has
// arrived; it resizes immediately when the keyboard lowers. Bottom controls
// close the gap with `--mobile-keyboard-lift`, which mobile.css animates on
// the same curve as the keyboard.

export interface KeyboardMotion {
  /** Keyboard height the animation ends at, in CSS pixels. */
  height: number;
  /** Height before this motion. */
  previous: number;
  duration: number;
  easing: string;
}

export const KEYBOARD_EVENT = "monocode:keyboard";
const FALLBACK_EASING = "cubic-bezier(0.2, 0, 0, 1)";

let height = 0;
let tracked = false;
const listeners = new Set<(motion: KeyboardMotion) => void>();

/** Whether the native shell reports keyboard motion. */
export const keyboardTracked = () => tracked;
export const keyboardHeight = () => height;

export function onKeyboardMotion(listener: (motion: KeyboardMotion) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Some Android skins move the keyboard on a spring that passes its target.
 * Bottom controls ride the keyboard's progress, so an overshooting curve
 * throws them above their resting place before they fall back. Clamp the
 * sampled progress to [0, 1]; the keyboard keeps its timing and the controls
 * settle once instead of bouncing.
 */
export function settledEasing(easing: string) {
  const match = /^\s*linear\((.*)\)\s*$/.exec(easing);
  if (!match) return easing;
  const stops = match[1].split(",").map((stop) =>
    stop.trim().replace(/^-?[\d.]+(?:e-?\d+)?/i, (value) =>
      String(Math.min(1, Math.max(0, Number(value)))),
    ),
  );
  return `linear(${stops.join(", ")})`;
}

function supportedEasing(easing: unknown) {
  if (typeof easing !== "string" || !easing) return FALLBACK_EASING;
  if (typeof CSS === "undefined" || !CSS.supports) return settledEasing(easing);
  return CSS.supports("transition-timing-function", easing)
    ? settledEasing(easing)
    : FALLBACK_EASING;
}

/**
 * How much of the keyboard's travel the transcript content follows. The
 * transcript keeps its distance from the bottom while pinned; otherwise its
 * scroll offset only moves when the taller viewport runs out of content.
 * `contentHeight` is the content's height once the viewport has resized.
 */
export function transcriptFollow(
  scroller: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">,
  contentHeight: number,
  delta: number,
): number {
  if (!delta) return 0;
  const { scrollTop, clientHeight } = scroller;
  const pinned = scroller.scrollHeight - scrollTop - clientHeight <= 2;
  const viewport = clientHeight - delta;
  const nextMax = Math.max(0, contentHeight - viewport);
  const shift =
    delta > 0
      ? pinned
        ? nextMax - scrollTop
        : 0
      : scrollTop - Math.min(scrollTop, nextMax);
  return Math.max(0, Math.min(1, shift / Math.abs(delta)));
}

/**
 * Height of the turn anchored after a send once the viewport changes by
 * `delta`. Its minimum height tracks the transcript viewport, so a short
 * reply's empty space shrinks under a rising keyboard instead of pushing the
 * conversation up.
 */
export function anchoredTurnHeight(
  turn: { height: number; minHeight: number; natural: number },
  delta: number,
): number {
  return Math.max(turn.natural, turn.minHeight - delta);
}

function anchoredTurnChange(scroller: HTMLElement, delta: number) {
  const turn = scroller.querySelector<HTMLElement>(".transcript-turn-anchor");
  if (!turn) return 0;
  const minHeight = parseFloat(getComputedStyle(turn).minHeight) || 0;
  if (minHeight <= 0) return 0;
  const height = turn.offsetHeight;
  // Measured once per keyboard motion, before the motion starts.
  const previous = turn.style.minHeight;
  turn.style.minHeight = "0px";
  const natural = turn.offsetHeight;
  turn.style.minHeight = previous;
  return anchoredTurnHeight({ height, minHeight, natural }, delta) - height;
}

function contentRatio(delta: number) {
  const scroller = document.querySelector<HTMLElement>(
    ".mobile-desktop-transcript > .agent-transcript",
  );
  if (!scroller) return 0;
  const style = getComputedStyle(scroller);
  const inner = scroller.firstElementChild as HTMLElement | null;
  const content =
    (inner?.offsetHeight ?? 0) +
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0) +
    anchoredTurnChange(scroller, delta);
  return transcriptFollow(scroller, content, delta);
}

export function installKeyboardMotion(root = document.documentElement) {
  const receive = (event: Event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const next = Number(detail.height);
    const viewport = Number(detail.viewport);
    if (!Number.isFinite(next) || !Number.isFinite(viewport) || viewport <= 0)
      return;
    tracked = true;
    const previous = height;
    height = Math.max(0, next);
    const duration = Math.max(0, Number(detail.duration) || 0);
    const easing = supportedEasing(detail.easing);
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    root.style.setProperty("--mobile-viewport-full", `${viewport}px`);
    root.style.setProperty(
      "--mobile-keyboard-duration",
      `${reduced ? 0 : duration}ms`,
    );
    root.style.setProperty("--mobile-keyboard-easing", easing);
    root.style.setProperty(
      "--mobile-keyboard-follow",
      String(contentRatio(height - previous)),
    );
    root.style.setProperty("--mobile-keyboard-height", `${height}px`);
    const motion = { height, previous, duration, easing };
    for (const listener of listeners) listener(motion);
  };
  // The layout already keeps the composer above the keyboard. A WebView that
  // still pans the page to reveal the focused field would lift everything a
  // second keyboard height until its resize lands, so undo any pan at rest
  // scale (pinch zoom keeps its own offset).
  const viewport = window.visualViewport;
  const unpan = () => {
    if (
      (!viewport || viewport.scale <= 1.01) &&
      ((viewport?.offsetTop ?? 0) > 0 || window.scrollY > 0)
    )
      window.scrollTo(0, 0);
  };
  window.addEventListener(KEYBOARD_EVENT, receive);
  window.addEventListener("scroll", unpan);
  viewport?.addEventListener("scroll", unpan);
  viewport?.addEventListener("resize", unpan);
  return () => {
    window.removeEventListener(KEYBOARD_EVENT, receive);
    window.removeEventListener("scroll", unpan);
    viewport?.removeEventListener("scroll", unpan);
    viewport?.removeEventListener("resize", unpan);
    tracked = false;
    height = 0;
  };
}
