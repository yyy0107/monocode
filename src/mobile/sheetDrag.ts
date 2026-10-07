import { useEffect, useRef, type RefObject } from "react";

/** Pull distance, as a share of the sheet height, that dismisses on release. */
const DISMISS_SHARE = 0.28;
/** Downward fling speed in px/ms that dismisses regardless of distance. */
const DISMISS_VELOCITY = 0.55;
/** Movement before a press counts as a drag rather than a tap or scroll. */
const SLOP_PX = 6;
/** Keep in sync with mobile-sheet animations in mobile.css. */
export const SHEET_MOTION_MS = 200;
export const SHEET_CLOSE_MS = 120;

/** Whether a release at `distance` px moving at `velocity` px/ms should close. */
export function shouldDismiss(
  distance: number,
  velocity: number,
  height: number,
): boolean {
  if (distance <= 0) return false;
  return distance > height * DISMISS_SHARE || velocity > DISMISS_VELOCITY;
}

/**
 * Lets a bottom sheet follow the finger downward and either close or spring
 * back. Drags start on the grip anywhere, or on the content while it is
 * scrolled to the top, so reading a long sheet still scrolls normally.
 */
export function useSheetDrag(
  sheet: RefObject<HTMLElement | null>,
  enabled: boolean,
  onClose: () => void,
  onDismissStart?: () => void,
) {
  const close = useRef(onClose);
  close.current = onClose;
  const dismissStart = useRef(onDismissStart);
  dismissStart.current = onDismissStart;
  useEffect(() => {
    const element = sheet.current;
    if (!enabled || !element) return;
    const backdrop = element.parentElement;
    element.style.transform = "";
    element.style.transition = "";
    element.style.animation = "";
    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.style.transition = "";
      backdrop.style.animation = "";
    }
    let startY = 0;
    let lastY = 0;
    let lastAt = 0;
    let velocity = 0;
    let tracking = false;
    let dragging = false;
    let closing = false;
    let closeTimer: number | undefined;

    const place = (offset: number) => {
      element.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
      if (backdrop)
        backdrop.style.opacity = offset > 0
          ? String(Math.max(0.35, 1 - offset / (element.offsetHeight * 1.4)))
          : "";
    };
    const canStart = (target: EventTarget | null) => {
      if (closing || !(target instanceof Element)) return false;
      if (target.closest(".mobile-sheet") !== element) return false;
      if (target.closest(".mobile-sheet-grip")) return true;
      if (target.closest("input, textarea, select, [contenteditable]"))
        return false;
      // Anything scrolled away from its top keeps the gesture for scrolling.
      for (
        let node: Element | null = target;
        node && node !== element;
        node = node.parentElement
      )
        if (node.scrollTop > 0) return false;
      return true;
    };
    const begin = (y: number) => {
      startY = lastY = y;
      lastAt = performance.now();
      velocity = 0;
      tracking = true;
      dragging = false;
    };
    const move = (y: number, event: Event) => {
      if (!tracking) return;
      const offset = y - startY;
      if (!dragging) {
        if (offset < -SLOP_PX) tracking = false;
        if (offset <= SLOP_PX) return;
        dragging = true;
        element.style.transition = "none";
        if (backdrop) backdrop.style.transition = "none";
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastAt);
      lastY = y;
      lastAt = now;
      // Pulling upward past the rest position only gives a little.
      place(offset > 0 ? offset : offset / 6);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const height = element.offsetHeight;
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const dismiss = shouldDismiss(lastY - startY, velocity, height);
      const duration = dismiss ? SHEET_CLOSE_MS : SHEET_MOTION_MS;
      element.style.transition = reducedMotion
        ? "none"
        : `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      if (backdrop)
        backdrop.style.transition = reducedMotion
          ? "none"
          : `opacity ${duration}ms ease`;
      if (dismiss) {
        closing = true;
        // The drag owns the exit from its current offset. The shared fold
        // lifetime runs concurrently; its CSS keyframes must not restart it.
        element.style.animation = "none";
        if (backdrop) backdrop.style.animation = "none";
        dismissStart.current?.();
        element.style.transform = `translateY(${height + 24}px)`;
        if (backdrop) backdrop.style.opacity = "0";
        if (reducedMotion) close.current();
        else
          closeTimer = window.setTimeout(() => close.current(), SHEET_CLOSE_MS);
      } else {
        place(0);
      }
    };

    const touchStart = (event: TouchEvent) => {
      if (event.touches.length === 1 && canStart(event.target))
        begin(event.touches[0].clientY);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return end();
      move(event.touches[0].clientY, event);
    };
    // Mouse and pen drag from the grip only; text in the sheet stays selectable.
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".mobile-sheet") !== element) return;
      if (!event.target.closest(".mobile-sheet-grip") || closing) return;
      element.setPointerCapture?.(event.pointerId);
      begin(event.clientY);
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") move(event.clientY, event);
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch") end();
    };

    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerUp);
    return () => {
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerUp);
      element.removeEventListener("pointercancel", pointerUp);
    };
  }, [sheet, enabled]);
}
