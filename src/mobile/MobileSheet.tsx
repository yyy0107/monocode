import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MobileOverlayHostContext, MobileOverlayLevelContext } from "./MobileOverlayHost";
import { SurfaceVisibilityContext, useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { keyboardMotionRemaining, onKeyboardMotion } from "./keyboardMotion";
import { ArrowLeft } from "../shared/ui/icons";
import { useCollapseMotion } from "../shared/ui/AnimatedCollapse";
import { useTranslation } from "../shared/i18n/useTranslation";
import { placePopover, type PopoverAlign } from "../shared/lib/popover";
import { SHEET_CLOSE_MS, SHEET_MOTION_MS, useSheetDrag } from "./sheetDrag";
import { preserveInputFocus, usePreserveInputFocusOnTouch } from "./inputFocus";

// Reads the resolved system-bar insets so popovers stay clear of the status
// bar, gesture area and display cutouts on edge-to-edge screens.
function safeInsets(element: HTMLElement) {
  const host = element.closest<HTMLElement>(".mobile-app");
  if (!host) return { top: 0, right: 0, bottom: 0, left: 0 };
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;" +
    "padding:var(--mobile-safe-top) var(--mobile-safe-right) var(--mobile-safe-bottom) var(--mobile-safe-left)";
  host.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

// Shared popover widths keep panels proportionate to what they hold:
// plain action menus, model settings, lists with a second line, and forms.
export const SHEET_WIDTH = {
  menu: 220,
  settings: 280,
  list: 300,
  form: 320,
} as const;

export type MobileSheetPoint = { x: number; y: number };

export function MobileSheet({
  open = true,
  title,
  onClose,
  onExited,
  onBack,
  placement = "bottom",
  anchor,
  preserveFocus,
  anchorPoint,
  width = SHEET_WIDTH.form,
  align = "start",
  side = "bottom",
  overlapAnchor = false,
  constrainWidthToAnchor = false,
  children,
}: {
  /** Keep the sheet mounted to animate both directions when controlling it. */
  open?: boolean;
  title: string;
  onClose: () => void;
  /** Release retained content after a controlled close finishes. */
  onExited?: () => void;
  onBack?: () => void;
  /** Bottom sheet, popover beside a trigger, or a centred choice dialog. */
  placement?: "bottom" | "anchor" | "dialog";
  anchor?: RefObject<HTMLElement | null>;
  /** Input to retain when a pointer opens this sheet while typing. */
  preserveFocus?: RefObject<HTMLElement | null>;
  anchorPoint?: MobileSheetPoint;
  width?: number;
  align?: PopoverAlign;
  side?: "top" | "bottom";
  /** Cover the trigger while keeping the popup top aligned with it. */
  overlapAnchor?: boolean;
  /** Keep a title menu inside its trigger's space between adjacent controls. */
  constrainWidthToAnchor?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const overlayHost = useContext(MobileOverlayHostContext);
  const overlayLevel = useContext(MobileOverlayLevelContext);
  const [dragClosing, setDragClosing] = useState(false);
  const active = open && visible && !dragClosing;
  useLayoutEffect(() => { if (open) setDragClosing(false); }, [open]);
  const { foldState, finish } = useCollapseMotion(
    active,
    active ? SHEET_MOTION_MS : SHEET_CLOSE_MS,
  );
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (foldState === "closed" && wasOpen.current) {
      wasOpen.current = false;
      onExited?.();
    }
  }, [open, foldState, onExited]);
  usePreserveInputFocusOnTouch(backdrop, preserveFocus, false, active);
  const [position, setPosition] = useState<CSSProperties>();
  useSheetDrag(dialog, placement === "bottom" && open && visible, onClose, () => setDragClosing(true));
  useLayoutEffect(() => {
    if (!active || placement !== "anchor") return;
    const element = dialog.current;
    const trigger = anchor?.current;
    if (!element || (!trigger && !anchorPoint)) return;
    const viewport = window.visualViewport;
    let insets = safeInsets(element);
    const place = () => {
      const rect = anchorPoint
        ? {
            left: anchorPoint.x,
            right: anchorPoint.x,
            top: anchorPoint.y,
            bottom: anchorPoint.y,
            width: 0,
            height: 0,
          }
        : trigger!.getBoundingClientRect();
      const size = element.getBoundingClientRect();
      // Place inside the safe region, then translate back to the viewport.
      const viewportWidth =
        (viewport?.width ?? window.innerWidth) - insets.left - insets.right;
      const height =
        (viewport?.height ?? window.innerHeight) - insets.top - insets.bottom;
      const offsetLeft = (viewport?.offsetLeft ?? 0) + insets.left;
      const offsetTop = (viewport?.offsetTop ?? 0) + insets.top;
      const clampY = (value: number) =>
        Math.max(16, Math.min(height - 16, value - offsetTop));
      const next = placePopover(
        {
          left: rect.left - offsetLeft,
          right: rect.right - offsetLeft,
          top: clampY(rect.top),
          bottom: clampY(overlapAnchor ? rect.top : rect.bottom),
          width: rect.width,
          height: rect.height,
        },
        { width: size.width, height: size.height },
        { width: viewportWidth, height },
        {
          width:
            constrainWidthToAnchor && !anchorPoint
              ? Math.min(width, rect.width)
              : width,
          side,
          align,
          gap: anchorPoint || overlapAnchor ? 0 : 8,
          padding: 16,
        },
      );
      const style: CSSProperties = {
        position: "fixed",
        left: next.left + offsetLeft,
        top: overlapAnchor
          ? Math.max(
              0,
              Math.min(rect.top - offsetTop, height - size.height - 16),
            ) + offsetTop
          : next.top == null
            ? undefined
            : next.top + offsetTop,
        bottom:
          overlapAnchor || next.bottom == null
            ? undefined
            : next.bottom + window.innerHeight - offsetTop - height,
        width: next.width,
        maxHeight: next.maxHeight,
      };
      setPosition((previous) =>
        previous?.left === style.left &&
        previous?.top === style.top &&
        previous?.bottom === style.bottom &&
        previous?.width === style.width &&
        previous?.maxHeight === style.maxHeight
          ? previous
          : style,
      );
    };
    let frame: number | undefined;
    let refreshInsets = false;
    let until = performance.now() + keyboardMotionRemaining();
    const animationRemaining = () => {
      let remaining = 0;
      // Only transforms/layout on the anchor or its ancestors move its box;
      // child spinners and other infinite animations do not keep this awake.
      for (let node: HTMLElement | null = trigger ?? null; node; node = node.parentElement) {
        for (const animation of node.getAnimations?.() ?? []) {
          if (animation.playState !== "running" && !animation.pending) continue;
          const end = animation.effect?.getComputedTiming().endTime;
          const time = animation.currentTime;
          if (typeof end === "number" && Number.isFinite(end) && typeof time === "number")
            remaining = Math.max(remaining, (end - time) / Math.abs(animation.playbackRate || 1));
        }
      }
      return remaining;
    };
    const tick = () => {
      frame = undefined;
      if (refreshInsets) {
        insets = safeInsets(element);
        refreshInsets = false;
      }
      place();
      if (trigger && !anchorPoint &&
          (performance.now() < until || animationRemaining() > 0))
        frame = requestAnimationFrame(tick);
    };
    const schedule = () => { frame ??= requestAnimationFrame(tick); };
    const resize = () => { refreshInsets = true; schedule(); };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node && element.contains(event.target))) schedule();
    };
    const motion = (event: Event) => {
      if (trigger && event.target instanceof Element && event.target.contains(trigger)) schedule();
    };
    const unsubscribe = onKeyboardMotion(({ duration }) => {
      until = performance.now() + duration;
      schedule();
    });
    place();
    if (trigger && !anchorPoint && (keyboardMotionRemaining() > 0 || animationRemaining() > 0)) schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    if (trigger) observer.observe(trigger);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    const motionEvents = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];
    for (const name of motionEvents) window.addEventListener(name, motion, true);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      for (const name of motionEvents) window.removeEventListener(name, motion, true);
    };
  }, [
    active,
    placement,
    anchor,
    anchorPoint,
    width,
    align,
    side,
    overlapAnchor,
    constrainWidthToAnchor,
  ]);
  useEffect(() => {
    if (!active) return;
    const input = preserveFocus?.current;
    const keepInput = !!input && document.activeElement === input;
    const trigger = keepInput
      ? input
      : (anchor?.current ?? (document.activeElement as HTMLElement | null));
    if (!keepInput) dialog.current?.focus();
    return () => {
      if (trigger?.isConnected && !trigger.closest("[inert], [aria-hidden=\"true\"]") && document.activeElement !== trigger)
        trigger.focus({ preventScroll: true });
    };
  }, [active, anchor, preserveFocus]);
  const onKeyDown = useCallback(
    (event: {
      key: string;
      shiftKey: boolean;
      defaultPrevented: boolean;
      preventDefault: () => void;
    }) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      const entering =
        document.activeElement === dialog.current ||
        document.activeElement === preserveFocus?.current;
      if (event.shiftKey && (document.activeElement === first || entering)) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || entering)
      ) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose, preserveFocus],
  );
  useEffect(() => {
    if (!active) return;
    const input = preserveFocus?.current;
    if (!input) return;
    // Pointer interaction keeps typing focus outside the sheet. Escape still
    // dismisses it, and an explicit Tab moves into its keyboard navigation.
    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [active, preserveFocus, onKeyDown]);
  if (!visible || (!active && foldState === "closed")) return null;
  const content = (
    <SurfaceVisibilityContext.Provider value={active}>
    <div
      ref={backdrop}
      className="mobile-sheet-backdrop"
      style={overlayLevel === undefined ? undefined : { zIndex: overlayLevel }}
      data-placement={placement}
      data-fold-state={foldState}
      inert={!active}
      aria-hidden={!active || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) finish();
      }}
      onPointerDownCapture={(event) =>
        preserveInputFocus(event, preserveFocus?.current)
      }
      onMouseDownCapture={(event) =>
        preserveInputFocus(event, preserveFocus?.current)
      }
      onClick={active ? onClose : undefined}
    >
      <section
        ref={dialog}
        className="mobile-sheet"
        style={
          placement === "anchor"
            ? (position ?? { visibility: "hidden" })
            : placement === "dialog"
              ? { width }
              : undefined
        }
        role="dialog"
        aria-modal={preserveFocus ? undefined : true}
        aria-label={t(title)}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {placement === "bottom" && (
          <div className="mobile-sheet-grip" aria-hidden="true" />
        )}
        <div className="mobile-sheet-content">
          {placement === "dialog" && (
            <h2 className="mobile-sheet-title">{t(title)}</h2>
          )}
          {onBack && (
            <button
              type="button"
              className="mobile-sheet-row mobile-sheet-back"
              aria-label={t("Back")}
              onClick={onBack}
            >
              <ArrowLeft size={20} />
              <span>{t("Back")}</span>
            </button>
          )}
          {children}
        </div>
      </section>
    </div>
    </SurfaceVisibilityContext.Provider>
  );
  return overlayHost ? createPortal(content, overlayHost) : content;
}
