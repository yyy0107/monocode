// A send reads as one short scroll: the new message enters from below
// together with everything above it, then settles from a pending tint to full
// strength. Nothing flies out of the composer or changes shape.

const SLIDE_EASING = "cubic-bezier(.16,1,.3,1)";
const PENDING_OPACITY = 0.5;
const SETTLE_MS = 420;

/** Short sends snap, long ones still land quickly. */
function slideDuration(distance: number): number {
  return Math.round(Math.min(480, 200 + distance / 3));
}

export type PromptSlide = {
  /** The message's slide first; companion animations share its clock. */
  animations: Animation[];
  duration: number;
  easing: string;
  /** Resolves when the message lands or its motion is cancelled. */
  finished: Promise<void>;
  /** Cancels all motion; safe to call repeatedly. */
  release: () => void;
};

/**
 * Slides the sent message (its bubble and any attachments) and the content
 * above it up by `distance` on one clock. The message also fades from its
 * pending tint to full opacity.
 */
export function slidePromptIn(
  message: (HTMLElement | null | undefined)[],
  distance: number,
  earlier: HTMLElement[] = [],
): PromptSlide | undefined {
  const parts = message.filter((part): part is HTMLElement => !!part);
  if (!parts.length) return undefined;
  const dy = distance > 1 ? distance : 0;
  const duration = slideDuration(dy);
  const startTime = document.timeline?.currentTime;
  const animations: Animation[] = [];
  const animate = (element: HTMLElement, frames: Keyframe[], ms: number, easing: string) => {
    const animation = element.animate(frames, { duration: ms, easing });
    if (typeof startTime === "number") animation.startTime = startTime;
    animations.push(animation);
    return animation;
  };
  const moved = dy ? [...parts, ...earlier] : [];
  for (const element of moved) {
    animate(element, [
      { transform: `translateY(${dy.toFixed(2)}px)` },
      { transform: "translateY(0px)" },
    ], duration, SLIDE_EASING);
  }
  for (const part of parts) {
    animate(part, [
      { opacity: PENDING_OPACITY },
      { opacity: PENDING_OPACITY, offset: 0.6 },
      { opacity: 1 },
    ], SETTLE_MS, "ease-out");
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    for (const animation of animations) animation.cancel();
  };
  // The animations hold no fill, so landing needs no cleanup.
  const finished = animations[0].finished.then(() => {}, () => {});
  return { animations, duration, easing: SLIDE_EASING, finished, release };
}
