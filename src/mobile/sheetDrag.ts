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

/**
 * Lets a bottom sheet follow the finger, pull up to full screen, step back
 * down, or close. Two-stop sheets rest at half height; other sheets rest at
 * their content height and switch to the full-height layout only once pulled
 * above it. Touch drags start on the grip or header; the content always keeps
 * its native scrolling gesture, including at the rest stop and list edges.
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
    delete element.dataset.expanded;
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
    let dragPlaced = false;
    let contentExpanded = false;
    let closing = false;
    /** A content-height sheet laid out at full height while pulled up. */
    let fitExpanded = false;
    let closeTimer: number | undefined;
    let moveFrame: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let geometryDirty = true;
    let height = 0;
    let viewportHeight = 0;
    let halfHeight = 0;
    let halfTop = 0;
    const viewport = window.visualViewport;
    // Two-stop sheets rest at the half stop until pulled up; the stylesheet
    // places that stop, so only a full or dragged position is written inline.
    let detent: SheetDetent = "half";
    if (detents) element.dataset.detent = detent;
    const measure = () => {
      if (!geometryDirty) return;
      height = element.offsetHeight;
      viewportHeight = window.innerHeight;
      if (detents) {
        halfHeight = Math.round(viewportHeight * SHEET_HALF_SHARE);
        halfTop = Math.max(0, height - halfHeight);
      } else if (!fitExpanded) {
        // The rest stop is the sheet's own content height.
        halfHeight = height;
        halfTop = 0;
      }
      geometryDirty = false;
    };
    const base = () => (detent === "half" ? halfTop : 0);
    // Lay a content-height sheet out at full height once, then offset it by
    // the growth so it stays where it is drawn; the drag continues from there.
    const expandFit = () => {
      if (detents || fitExpanded) return 0;
      const restHeight = height;
      fitExpanded = true;
      element.dataset.expanded = "true";
      height = element.offsetHeight;
      halfHeight = restHeight;
      halfTop = Math.max(0, height - restHeight);
      element.style.transform = `translateY(${halfTop}px)`;
      return halfTop;
    };
    const collapseFit = () => {
      if (!fitExpanded) return;
      fitExpanded = false;
      delete element.dataset.expanded;
      halfTop = 0;
      geometryDirty = true;
    };

    const place = (top: number) => {
      element.style.transform =
        detents || fitExpanded || top > 0 ? `translateY(${top}px)` : "";
      // Prepare the larger scroll viewport once before revealing it. Resizing
      // it under the finger (or on every spring frame) relays out long lists,
      // diffs and virtual editors. Keep it full-sized until landing at half.
      if (detents && top < halfTop && !contentExpanded) {
        contentExpanded = true;
        element.style.setProperty("--mobile-sheet-content-offset", "0px");
      }
      // The backdrop only fades once the sheet sinks below its lowest stop.
      const below = top - halfTop;
      if (backdrop)
        backdrop.style.opacity = below > 0
          ? String(Math.max(0.35, 1 - below / (height * 1.4)))
          : "";
    };
    const cancelMove = () => {
      if (moveFrame !== undefined) cancelAnimationFrame(moveFrame);
      moveFrame = undefined;
    };
    const placeDrag = () => {
      moveFrame = undefined;
      if (!tracking || !dragging) return;
      // Read once before writing, and only again after the observed geometry
      // changes. Content layout stays fixed while the sheet moves.
      measure();
      if (!dragPlaced) {
        dragPlaced = true;
        element.style.transition = "none";
        if (backdrop) backdrop.style.transition = "none";
      }
      let top = origin + lastY - startY;
      if (top < 0 && !detents && !fitExpanded && detent === "half") {
        origin += expandFit();
        top = origin + lastY - startY;
      }
      place(top > 0 ? top : top / 6);
    };
    const scheduleMove = () => {
      if (tracking && dragging && moveFrame === undefined)
        moveFrame = requestAnimationFrame(placeDrag);
    };
    const viewportChanged = () => {
      if (window.innerHeight === viewportHeight) return;
      geometryDirty = true;
      scheduleMove();
    };
    const stopObserving = () => {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      window.removeEventListener("resize", viewportChanged);
      viewport?.removeEventListener("resize", viewportChanged);
    };
    const observeGeometry = () => {
      if (typeof ResizeObserver !== "undefined") {
        let contentHeight: number | undefined;
        resizeObserver = new ResizeObserver((entries) => {
          if (!tracking) return;
          const entry = entries.find((entry) => entry.target === element);
          if (!entry) return;
          const borderHeight = entry.borderBoxSize?.[0]?.blockSize;
          if (borderHeight !== undefined) {
            if (Math.round(borderHeight) === height) return;
          } else {
            if (entry.contentRect.height === contentHeight) return;
            contentHeight = entry.contentRect.height;
          }
          geometryDirty = true;
          scheduleMove();
        });
        resizeObserver.observe(element, { box: "border-box" });
      }
      window.addEventListener("resize", viewportChanged);
      viewport?.addEventListener("resize", viewportChanged);
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
      cancelMove();
      stopObserving();
      geometryDirty = true;
      measure();
      origin = drawnTop();
      startY = lastY = y;
      lastAt = performance.now();
      velocity = 0;
      tracking = true;
      dragging = false;
      dragPlaced = false;
      observeGeometry();
    };
    const move = (y: number, event: Event) => {
      if (!tracking) return;
      const offset = y - startY;
      const expandable = detent === "half";
      if (!dragging) {
        if (offset < -SLOP_PX && !expandable) {
          tracking = false;
          stopObserving();
        }
        if (Math.abs(offset) <= SLOP_PX || (offset < 0 && !expandable)) return;
        dragging = true;
        if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastAt);
      lastY = y;
      lastAt = now;
      scheduleMove();
    };
    const end = () => {
      if (!tracking) return;
      // Commit the last input even when release arrives before the next frame.
      cancelMove();
      if (dragging) placeDrag();
      stopObserving();
      tracking = false;
      if (!dragging) return;
      dragging = false;
      // Resolve the release position with transitions disabled before assigning
      // the spring target. This is one style flush per release, never per move.
      getComputedStyle(element).transform;
      const reducedMotion = reducedMotionQuery().matches;
      let released = origin + lastY - startY;
      const settled = settleDetent(released, velocity, halfTop, halfHeight, detent);
      // An upward fling from a content-height sheet still below its rest stop.
      if (settled === "full" && !detents && !fitExpanded) {
        const shift = expandFit();
        origin += shift;
        released += shift;
        getComputedStyle(element).transform;
      }
      const dismiss = settled === "dismiss";
      // Settling continues the finger's speed on the shared spring; a dismiss
      // keeps the short exit that the sheet's close lifetime expects.
      const target = dismiss ? height + 24 : settled === "full" ? 0 : halfTop;
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
      } else {
        detent = settled;
        if (detents) element.dataset.detent = detent;
        place(base());
        if (detent === "half") {
          // Hand the rest position back to the stylesheet once it lands.
          const settledAt = detent;
          closeTimer = window.setTimeout(() => {
            if (detent === settledAt && !tracking) {
              element.style.transform = "";
              contentExpanded = false;
              element.style.removeProperty("--mobile-sheet-content-offset");
              collapseFit();
            }
          }, reducedMotion ? 0 : duration);
        }
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
      tracking = false;
      cancelMove();
      stopObserving();
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
