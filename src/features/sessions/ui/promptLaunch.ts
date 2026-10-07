/** Where the composer's input surface sat when sent, in viewport pixels. */
export type PromptLaunchOrigin = {
  left: number;
  bottom: number;
  width: number;
  height: number;
  /** Visible text box inside an input surface that also contains controls. */
  textTop?: number;
  textLeft?: number;
};

// A send waits on a Host round trip; an origin older than this no longer
// matches what the reader remembers, so the bubble rises from the dock instead.
const LAUNCH_TTL_MS = 15_000;

let launch: { origin: PromptLaunchOrigin; at: number } | undefined;

/** Capture the input surface, falling back to the text field when unmarked. */
export function readPromptLaunch(element: Element | null): PromptLaunchOrigin | undefined {
  const surface = element?.closest("[data-prompt-launch-surface]") ?? element;
  const rect = surface?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return undefined;
  let textTop: number | undefined;
  let textLeft: number | undefined;
  if (element instanceof HTMLTextAreaElement && surface !== element) {
    const text = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    textTop = text.top + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0);
    textLeft = text.left + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
  }
  return {
    left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height,
    ...(textTop === undefined ? {} : { textTop, textLeft }),
  };
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

const LAUNCH_MS = 620;
const FALLBACK_MS = 420;
const TRAVEL_EASING = "cubic-bezier(.32,0,.2,1)";
const WIDTH_EASING = "cubic-bezier(.5,0,.25,1)";

export type PromptFlight = {
  /** The message's translation first; companion animations share its clock. */
  animations: Animation[];
  duration: number;
  easing: string;
  /** Resolves after landing or interruption has restored the real bubble. */
  finished: Promise<void>;
  /** Cancels motion and restores temporary styles; safe to call repeatedly. */
  release: () => void;
};

/**
 * Keep the real message at its landed size. Only an empty, out-of-flow surface
 * narrows; the text translates without scaling or rewrapping. Both motions
 * start together, with a slower contraction making the input width legible.
 */
export function flyPromptBubble(
  bubble: HTMLElement | null,
  view: DOMRect,
  launch: PromptLaunchOrigin | undefined,
  fromBottom: number,
  viewport?: HTMLElement,
  media?: HTMLElement | null,
): PromptFlight | undefined {
  // Attachments are siblings of the caption, and image-only sends have no
  // visible bubble. Keep both on the same clock without resizing either.
  const moving = bubble ?? media;
  if (!moving) return undefined;
  const target = moving.getBoundingClientRect();
  const mediaRect = media && media !== moving ? media.getBoundingClientRect() : undefined;
  const style = getComputedStyle(moving);
  const text = launch?.textTop === undefined ? null : bubble?.querySelector<HTMLElement>(
    "[data-selectable-agent-response], :scope > span:not([aria-hidden])",
  );
  const textRect = text?.getBoundingClientRect();
  const textInset = textRect
    ? textRect.top - target.top
    : (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0);
  // The composer includes a toolbar below its text. Matching its bottom edge
  // would make the text reappear over that toolbar before starting to rise.
  const originBottom = !bubble
    ? launch?.textTop ?? launch?.bottom
    : launch?.textTop === undefined
      ? launch?.bottom
      : launch.textTop - textInset + target.height;
  const startBottom = originBottom === undefined ? fromBottom : Math.min(originBottom, view.bottom);
  const dy = startBottom - target.bottom;
  if (!(dy > 1) || !target.width || !target.height) return undefined;
  const startWidth = launch && bubble
    ? Math.max(target.width, Math.min(launch.width, target.right - view.left - 4))
    : target.width;
  const startLeft = target.right - startWidth;
  const dx = launch
    ? Math.max(view.left - startLeft, Math.min(0, launch.left - startLeft))
    : 0;
  const textInsetX = textRect
    ? textRect.left - target.left
    : (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
  const contentOffsetX = launch?.textLeft === undefined
    ? target.width - startWidth
    : launch.textLeft - target.left - dx - textInsetX;
  const reshape = !!bubble && startWidth - target.width > 1;
  // Finish every geometry/style read before starting any animation or write.
  const content = reshape ? [...moving.children].filter(
    (child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false;
      const position = getComputedStyle(child).position;
      return position !== "absolute" && position !== "fixed";
    },
  ) : [];
  const surface = reshape ? document.createElement("span") : undefined;
  if (surface) {
    surface.className = "prompt-flight-surface";
    surface.setAttribute("aria-hidden", "true");
    Object.assign(surface.style, {
      position: "absolute",
      top: `${-(parseFloat(style.borderTopWidth) || 0)}px`,
      right: `${-(parseFloat(style.borderRightWidth) || 0)}px`,
      width: `${target.width}px`,
      height: `${target.height}px`,
      boxSizing: "border-box",
      background: style.background,
      borderTop: style.borderTop,
      borderRight: style.borderRight,
      borderBottom: style.borderBottom,
      borderLeft: style.borderLeft,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      // The empty surface's width must not resize the message or transcript.
      contain: "layout style",
      pointerEvents: "none",
      zIndex: "-1",
    });
  }
  const saved = ["position", "isolation"].map(property => ({
    property,
    value: moving.style.getPropertyValue(property),
    priority: moving.style.getPropertyPriority(property),
  }));
  if (surface) {
    if (style.position === "static" || !style.position) moving.style.position = "relative";
    moving.style.isolation = "isolate";
    moving.append(surface);
  }
  const duration = launch ? LAUNCH_MS : FALLBACK_MS;
  const startTime = document.timeline?.currentTime;
  const animations: Animation[] = [];
  const animate = (element: HTMLElement, frames: Keyframe[], easing: string, ms = duration) => {
    const animation = element.animate(frames, { duration: ms, easing });
    if (typeof startTime === "number") animation.startTime = startTime;
    animations.push(animation);
    return animation;
  };
  // Suppress the original paint through WAAPI, so restoring it cannot trigger
  // the bubble's CSS background-color transition and flash on landing.
  const paint = surface ? { background: "none", borderColor: "transparent", boxShadow: "none" } : {};
  const from = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
  const flight = animate(moving, [
    { transform: from, ...paint },
    { transform: "translate(0.00px, 0.00px)", ...paint },
  ], TRAVEL_EASING);
  if (media && media !== moving) {
    animate(media, [
      { transform: from },
      { transform: "translate(0.00px, 0.00px)" },
    ], TRAVEL_EASING);
  }
  if (surface) {
    animate(surface, [{ width: `${startWidth}px` }, { width: `${target.width}px` }], WIDTH_EASING);
    for (const child of content) {
      // Separate translate preserves any transform owned by the content itself.
      animate(child, [{ translate: `${contentOffsetX}px 0px` }, { translate: "0px 0px" }], WIDTH_EASING);
    }
  }
  if (!launch) {
    animate(moving, [{ opacity: 0 }, { opacity: 1 }], "ease-out", 140);
    if (media && media !== moving) animate(media, [{ opacity: 0 }, { opacity: 1 }], "ease-out", 140);
  }

  let released = false;
  let observer: ResizeObserver | undefined;
  let resolveFinished!: () => void;
  const finished = new Promise<void>(resolve => { resolveFinished = resolve; });
  const visualViewport = window.visualViewport;
  const release = () => {
    if (released) return;
    released = true;
    observer?.disconnect();
    window.removeEventListener("resize", release);
    visualViewport?.removeEventListener("resize", release);
    visualViewport?.removeEventListener("scroll", release);
    for (const animation of animations) animation.cancel();
    surface?.remove();
    if (surface) {
      for (const { property, value, priority } of saved) {
        if (value) moving.style.setProperty(property, value, priority);
        else moving.style.removeProperty(property);
      }
    }
    resolveFinished();
  };
  void flight.finished.then(release, release);
  window.addEventListener("resize", release, { passive: true });
  visualViewport?.addEventListener("resize", release, { passive: true });
  visualViewport?.addEventListener("scroll", release, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      const rect = moving.getBoundingClientRect();
      const mediaBounds = mediaRect && media?.getBoundingClientRect();
      const bounds = viewport?.getBoundingClientRect();
      if (
        Math.abs(rect.width - target.width) > 0.5 ||
        Math.abs(rect.height - target.height) > 0.5 ||
        (mediaBounds && mediaRect && (
          Math.abs(mediaBounds.width - mediaRect.width) > 0.5 ||
          Math.abs(mediaBounds.height - mediaRect.height) > 0.5
        )) ||
        (bounds && (Math.abs(bounds.width - view.width) > 0.5 || Math.abs(bounds.height - view.height) > 0.5))
      ) release();
    });
    observer.observe(moving);
    if (media && media !== moving) observer.observe(media);
    if (viewport) observer.observe(viewport);
  }
  return { animations, duration, easing: TRAVEL_EASING, finished, release };
}
