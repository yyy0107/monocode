import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";

export function MobileSheet({
  title,
  onClose,
  onBack,
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <div className="mobile-sheet-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="mobile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
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
        <div className="mobile-sheet-handle" />
        <header className="mobile-sheet-header">
          {onBack && (
            <button
              type="button"
              className="mobile-icon-button"
              aria-label={t("Back")}
              onClick={onBack}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 id={id}>{t(title)}</h2>
          <button
            type="button"
            className="mobile-icon-button"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="mobile-sheet-content">{children}</div>
      </section>
    </div>
  );
}
