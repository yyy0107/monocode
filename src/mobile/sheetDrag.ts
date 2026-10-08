import { useEffect, useRef, type RefObject } from "react";
import { reducedMotionQuery } from "../shared/lib/reducedMotion";
import { MOBILE_SPRINGS, springTransition } from "./motion";

/** Pull distance, as a share of the sheet height, that dismisses on release. */
const DISMISS_SHARE = 0.28;
/** Fling speed in px/ms that steps down or dismisses regardless of distance. */
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
 * full-height position: an upward fling expands, a downward fling steps from
 * full to half or dismisses from half, and a slow release picks the nearest
 * stop or closes below the half stop.
 */
export function settleDetent(
  top: number,
  velocity: number,
  halfTop: number,
  halfHeight: number,
  from: SheetDetent,
): SheetDetent | "dismiss" {
  if (velocity < -DISMISS_VELOCITY) return "full";
  if (velocity > DISMISS_VELOCITY) return from === "full" ? "half" : "dismiss";
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
 * back. Touch drags start on the grip or header; the content always keeps
 * its native scrolling gesture, including at the half stop and list edges.
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
    element.style.removeProperty("--mobile-sheet-content-offset");
    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.style.transition = "";
      backdrop.style.animation = "";
    }
    let startY = 0;
    /** Sheet offset when the finger landed; mid-settle catches keep it. */
    let origin = 0;
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
      if (detents)
        element.style.setProperty(
          "--mobile-sheet-content-offset",
          `${Math.max(0, Math.min(top, halfTop()))}px`,
        );
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
      if (target.closest("button, a, input, textarea, select, [contenteditable]"))
        return false;
      return !!target.closest(".mobile-sheet-header");
    };
    // While a release settles, the inline transform is the target, not where
    // the sheet is drawn; read the drawn offset so a catch does not jump.
    const drawnTop = () => {
      const settling = element
        .getAnimations?.()
        .some(
          (animation) =>
            "transitionProperty" in animation && animation.playState === "running",
        );
      return settling
        ? new DOMMatrix(getComputedStyle(element).transform).m42
        : base();
    };
    const begin = (y: number) => {
      origin = drawnTop();
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
        if (closeTimer !== undefined) window.clearTimeout(closeTimer);
        element.style.transition = "none";
        if (backdrop) backdrop.style.transition = "none";
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastAt);
      lastY = y;
      lastAt = now;
      // Pulling upward past the top stop only gives a little.
      const top = origin + offset;
      place(top > 0 ? top : top / 6);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const height = element.offsetHeight;
      const reducedMotion = reducedMotionQuery().matches;
      const released = origin + lastY - startY;
      const settled = detents
        ? settleDetent(released, velocity, halfTop(), halfHeight(), detent)
        : undefined;
      const dismiss = settled
        ? settled === "dismiss"
        : shouldDismiss(released, velocity, height);
      // Settling continues the finger's speed on the shared spring; a dismiss
      // keeps the short exit that the sheet's close lifetime expects.
      const target = dismiss
        ? height + 24
        : settled === "full" || !detents ? 0 : halfTop();
      const settle = dismiss
        ? undefined
        : springTransition(
            "transform",
            MOBILE_SPRINGS.smooth,
            target - released,
            velocity * Math.sign(target - released),
          );
      const duration = settle?.duration ?? SHEET_CLOSE_MS;
      element.style.transition = reducedMotion
        ? "none"
        : (settle?.transition ??
          `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`);
      if (backdrop)
        backdrop.style.transition = reducedMotion
          ? "none"
          : `opacity ${Math.min(duration, SHEET_MOTION_MS)}ms ease`;
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
            if (detent === settledAt && !dragging) {
              element.style.transform = "";
              element.style.removeProperty("--mobile-sheet-content-offset");
            }
          }, reducedMotion ? 0 : duration);
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
