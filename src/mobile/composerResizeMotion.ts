import { useLayoutEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "../shared/lib/reducedMotion";
import { COMPOSER_MOTION_MS } from "../features/sessions/model/composerResize";

/** Samples per motion; the compositor interpolates linearly between them. */
const STEPS = 16;
/** Attachments open and close faster than the text field grows. */
export const ATTACHMENT_RESIZE_MS = 120;

/** CSS `cubic-bezier()` as a function, solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (t: number, a: number, b: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t * t + t ** 3;
  return (x: number) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let low = 0;
    let high = 1;
    let t = x;
    for (let step = 0; step < 24; step++) {
      const current = curve(t, x1, x2);
      if (Math.abs(current - x) < 1e-5) break;
      if (current < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(t, y1, y2);
  };
}

/** Matches COMPOSER_MOTION_EASING. */
const ease = cubicBezier(0.2, 0.8, 0.2, 1);

/**
 * The composer resizes in layout at once, then glides on the compositor.
 *
 * Animating height re-lays out and re-rasterizes both glass cards (blurred
 * shadows, rims, backdrop filters) on every frame, which Android WebViews
 * render at a fraction of the display rate. Instead each card scales from its
 * bottom edge while its children are counter-scaled, so text, attachments and
 * buttons stay put while the card's top edge reveals or covers them.
 * Everything stacked above the composer rides that edge with a translation.
 */
export function useComposerResizeMotion(
  form: RefObject<HTMLElement | null>,
  compact: boolean,
  attachmentCount: number,
) {
  // The resize this change causes is observed within the same frame.
  const attachmentsChangedAt = useRef(-Infinity);
  const attachmentsMounted = useRef(false);
  useLayoutEffect(() => {
    if (!attachmentsMounted.current) {
      attachmentsMounted.current = true;
      return;
    }
    attachmentsChangedAt.current = performance.now();
  }, [attachmentCount]);
  // Compact folding animates margins and the toolbar in layout already.
  const suspendUntil = useRef(0);
  const compactMounted = useRef(false);
  useLayoutEffect(() => {
    if (!compactMounted.current) {
      compactMounted.current = true;
      return;
    }
    suspendUntil.current = performance.now() + 400;
  }, [compact]);

  useLayoutEffect(() => {
    const element = form.current;
    if (!element || typeof ResizeObserver === "undefined" || typeof element.animate !== "function") return;
    let height: number | undefined;
    let width: number | undefined;
    let running: Animation[] = [];
    let origins: [HTMLElement, string][] = [];
    const stop = () => {
      for (const animation of running) {
        animation.onfinish = null;
        animation.cancel();
      }
      running = [];
      for (const [target, origin] of origins) target.style.transformOrigin = origin;
      origins = [];
      delete element.dataset.resizeMotion;
    };
    const run = (context: HTMLElement, input: HTMLElement, from: number, to: number, duration: number) => {
      const top = input.offsetTop;
      const inputTo = to - top;
      if (inputTo < 1 || from - top < 1) return;
      // Layout reads first; every write below only touches transforms.
      const inputBottom = input.offsetHeight - input.clientTop;
      const contextChildren = [...context.children] as HTMLElement[];
      const inputChildren = ([...input.children] as HTMLElement[]).map(
        (child) => [child, inputBottom - child.offsetTop] as const,
      );
      const above: HTMLElement[] = [];
      for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling)
        if (sibling instanceof HTMLElement) above.push(sibling);

      const frames = (transform: (visible: number) => string) =>
        Array.from({ length: STEPS + 1 }, (_, index) => {
          const visible = from + (to - from) * ease(index / STEPS);
          return { offset: index / STEPS, transform: transform(visible) };
        });
      const options: KeyframeAnimationOptions = { duration, easing: "linear" };
      const animate = (target: HTMLElement, origin: string | undefined, keyframes: Keyframe[], pseudoElement?: string) => {
        if (origin !== undefined && !pseudoElement) {
          origins.push([target, target.style.transformOrigin]);
          target.style.transformOrigin = origin;
        }
        const animation = target.animate(keyframes, pseudoElement ? { ...options, pseudoElement } : options);
        void animation.finished.catch(() => undefined);
        running.push(animation);
        return animation;
      };
      element.dataset.resizeMotion = "";
      animate(context, "50% 100%", frames((visible) => `scaleY(${visible / to})`));
      // Riding the scaled top: origin at each child's own top keeps it rigid.
      for (const child of contextChildren)
        animate(child, "50% 0", frames((visible) => `scaleY(${to / visible})`));
      animate(input, "50% 100%", frames((visible) => `scaleY(${(visible - top) / inputTo})`));
      // Sharing the card's origin cancels the scale exactly: content stays put.
      for (const [child, origin] of inputChildren)
        animate(child, `50% ${origin}px`, frames((visible) => `scaleY(${inputTo / (visible - top)})`));
      const ride = frames((visible) => `translateY(${to - visible}px)`);
      for (const sibling of above) animate(sibling, undefined, ride);
      if (element.parentElement) animate(element.parentElement, undefined, ride, "::before");
      running[0]!.onfinish = stop;
    };

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      const nextHeight = box?.blockSize ?? element.offsetHeight;
      const nextWidth = box?.inlineSize ?? element.offsetWidth;
      const previousHeight = height;
      const previousWidth = width;
      height = nextHeight;
      width = nextWidth;
      const context = element.querySelector<HTMLElement>(":scope > .mobile-composer-context");
      const input = element.querySelector<HTMLElement>(":scope > .mobile-composer-input");
      if (previousHeight === undefined || previousWidth === undefined || !context || !input) return;
      // A reversal starts from what is on screen, not from the last layout.
      let from = previousHeight;
      if (running.length) {
        const scale = new DOMMatrixReadOnly(getComputedStyle(context).transform).d;
        if (Number.isFinite(scale) && scale > 0) from = previousHeight * scale;
      }
      stop();
      if (
        nextHeight < 1 ||
        Math.abs(nextWidth - previousWidth) > 0.5 ||
        Math.abs(from - nextHeight) < 1 ||
        performance.now() < suspendUntil.current ||
        prefersReducedMotion()
      )
        return;
      const fromAttachments = performance.now() - attachmentsChangedAt.current < 100;
      run(context, input, from, nextHeight, fromAttachments ? ATTACHMENT_RESIZE_MS : COMPOSER_MOTION_MS);
    });
    observer.observe(element, { box: "border-box" });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [form]);
}
