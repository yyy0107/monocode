import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft } from "../shared/ui/icons";
import { useCollapseMotion } from "../shared/ui/AnimatedCollapse";
import { useTranslation } from "../shared/i18n/useTranslation";
import { placePopover, type PopoverAlign } from "../shared/lib/popover";
import { SHEET_CLOSE_MS, SHEET_MOTION_MS, useSheetDrag } from "./sheetDrag";
import { preserveInputFocus } from "./inputFocus";

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
  onBack?: () => void;
  placement?: "bottom" | "anchor";
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
  const { foldState, finish } = useCollapseMotion(
    open,
    open ? SHEET_MOTION_MS : SHEET_CLOSE_MS,
  );
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<CSSProperties>();
  useSheetDrag(dialog, placement === "bottom" && open, onClose);
  useLayoutEffect(() => {
    if (!open || placement !== "anchor") return;
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
    const resize = () => {
      insets = safeInsets(element);
      place();
    };
    // Scrolling the sheet's own list cannot move its anchor; skip measuring
    // on each of those frames.
    const scroll = (event: Event) => {
      if (event.target instanceof Node && element.contains(event.target))
        return;
      place();
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    if (trigger) observer.observe(trigger);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
    };
  }, [
    open,
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
    if (!open) return;
    const input = preserveFocus?.current;
    const keepInput = !!input && document.activeElement === input;
    const trigger = keepInput
      ? input
      : (anchor?.current ?? (document.activeElement as HTMLElement | null));
    if (!keepInput) dialog.current?.focus();
    return () => {
      if (trigger?.isConnected && document.activeElement !== trigger)
        trigger.focus({ preventScroll: true });
    };
  }, [open, anchor, preserveFocus]);
  const onKeyDown = useCallback(
    (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
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
    if (!open) return;
    const input = preserveFocus?.current;
    if (!input) return;
    // Pointer interaction keeps typing focus outside the sheet. Escape still
    // dismisses it, and an explicit Tab moves into its keyboard navigation.
    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [open, preserveFocus, onKeyDown]);
  if (!open && foldState === "closed") return null;
  return (
    <div
      ref={backdrop}
      className="mobile-sheet-backdrop"
      data-placement={placement}
      data-fold-state={foldState}
      inert={!open}
      aria-hidden={!open || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) finish();
      }}
      onPointerDownCapture={(event) =>
        preserveInputFocus(event, preserveFocus?.current)
      }
      onMouseDownCapture={(event) =>
        preserveInputFocus(event, preserveFocus?.current)
      }
      onClick={onClose}
    >
      <section
        ref={dialog}
        className="mobile-sheet"
        style={
          placement === "anchor"
            ? (position ?? { visibility: "hidden" })
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
  );
}
