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

/** Share of the screen a two-stop sheet shows before it is pulled up. */
export const SHEET_HALF_SHARE = 0.5;

export type SheetDetent = "half" | "full";

/**
 * Where a two-stop sheet settles when released with its top `top` px below the
 * full-height position: a fling picks the next stop in its direction, a slow
 * release the nearest one, and a pull well below the half stop closes it.
 */
export function settleDetent(
  top: number,
  velocity: number,
  halfTop: number,
  halfHeight: number,
): SheetDetent | "dismiss" {
  if (velocity < -DISMISS_VELOCITY) return "full";
  if (velocity > DISMISS_VELOCITY) return top < halfTop ? "half" : "dismiss";
  if (top > halfTop + halfHeight * DISMISS_SHARE) return "dismiss";
  return top < halfTop / 2 ? "full" : "half";
}

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
  /** Open at half height and pull up to full screen, like a reading sheet. */
  detents = false,
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
    // Two-stop sheets rest at the half stop until pulled up; the stylesheet
    // places that stop, so only a full or dragged position is written inline.
    let detent: SheetDetent = "half";
    if (detents) element.dataset.detent = detent;
    const halfHeight = () => Math.round(window.innerHeight * SHEET_HALF_SHARE);
    const halfTop = () => Math.max(0, element.offsetHeight - halfHeight());
    const base = () => (detents && detent === "half" ? halfTop() : 0);

    const place = (top: number) => {
      element.style.transform =
        detents || top > 0 ? `translateY(${top}px)` : "";
      // The backdrop only fades once the sheet sinks below its lowest stop.
      const below = top - (detents ? halfTop() : 0);
      if (backdrop)
        backdrop.style.opacity = below > 0
          ? String(Math.max(0.35, 1 - below / (element.offsetHeight * 1.4)))
          : "";
    };
    const canStart = (target: EventTarget | null) => {
      if (closing || !(target instanceof Element)) return false;
      if (target.closest(".mobile-sheet") !== element) return false;
      if (target.closest(".mobile-sheet-grip")) return true;
      if (target.closest("input, textarea, select, [contenteditable]"))
        return false;
      // At the half stop the whole sheet is a handle: an upward pull expands it.
      if (detents && detent === "half") return true;
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
      const expandable = detents && detent === "half";
      if (!dragging) {
        if (offset < -SLOP_PX && !expandable) tracking = false;
        if (Math.abs(offset) <= SLOP_PX || (offset < 0 && !expandable)) return;
        dragging = true;
        element.style.transition = "none";
        if (backdrop) backdrop.style.transition = "none";
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastAt);
      lastY = y;
      lastAt = now;
      // Pulling upward past the top stop only gives a little.
      const top = base() + offset;
      place(top > 0 ? top : top / 6);
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
      const settled = detents
        ? settleDetent(base() + lastY - startY, velocity, halfTop(), halfHeight())
        : undefined;
      const dismiss = settled
        ? settled === "dismiss"
        : shouldDismiss(lastY - startY, velocity, height);
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
      } else if (settled && settled !== "dismiss") {
        detent = settled;
        element.dataset.detent = detent;
        place(base());
        if (detent === "half") {
          // Hand the rest position back to the stylesheet once it lands.
          const settledAt = detent;
          closeTimer = window.setTimeout(() => {
            if (detent === settledAt && !dragging) element.style.transform = "";
          }, reducedMotion ? 0 : SHEET_MOTION_MS);
        }
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
  }, [sheet, enabled, detents]);
}
