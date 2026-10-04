import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { placePopover, type PopoverAlign } from "../shared/lib/popover";

export function MobileSheet({
  title,
  onClose,
  onBack,
  placement = "bottom",
  anchor,
  width = 420,
  align = "start",
  side = "bottom",
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  placement?: "bottom" | "anchor";
  anchor?: RefObject<HTMLElement | null>;
  width?: number;
  align?: PopoverAlign;
  side?: "top" | "bottom";
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (placement !== "anchor") return;
    const element = dialog.current;
    const trigger = anchor?.current;
    if (!element || !trigger) return;
    const viewport = window.visualViewport;
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const size = element.getBoundingClientRect();
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const clampY = (value: number) =>
        Math.max(16, Math.min(height - 16, value - offsetTop));
      const next = placePopover(
        {
          left: rect.left - offsetLeft,
          right: rect.right - offsetLeft,
          top: clampY(rect.top),
          bottom: clampY(rect.bottom),
          width: rect.width,
          height: rect.height,
        },
        { width: size.width, height: size.height },
        { width: viewportWidth, height },
        { width, side, align, gap: 8, padding: 16 },
      );
      const style: CSSProperties = {
        position: "fixed",
        left: next.left + offsetLeft,
        top: next.top == null ? undefined : next.top + offsetTop,
        bottom:
          next.bottom == null
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
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    observer.observe(trigger);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
    };
  }, [placement, anchor, width, align, side]);
  useEffect(() => {
    const trigger =
      anchor?.current ?? (document.activeElement as HTMLElement | null);
    dialog.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, [anchor]);
  return (
    <div
      className="mobile-sheet-backdrop"
      data-placement={placement}
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
        aria-modal="true"
        aria-label={t(title)}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
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
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
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
