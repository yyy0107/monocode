import { Suspense, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GlassBackdrop } from "../../../app/shell/GlassBackdrop";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { X } from "../../../shared/ui/icons";
import { LAYER } from "../../../shared/lib/layers";

/**
 * Settings-like app views open over the workspace instead of taking a pane,
 * like Claude Desktop. The view keeps its own layout and Escape handling (so
 * its popovers close first); the dialog only bounds it.
 */
export function AppViewDialog({
  title,
  onClose,
  topInset = 0,
  children,
}: {
  title: string;
  onClose: () => void;
  topInset?: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();

  return createPortal(
    <div
      data-app-view-dialog
      className="fixed inset-0"
      style={{ zIndex: LAYER.dialog, top: topInset }}
    >
      <div
        className="modal-backdrop absolute inset-0 bg-black/40"
        onMouseDown={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="app-view-dialog absolute left-1/2 top-1/2 isolate flex h-[min(780px,calc(100%-64px))] w-[min(1080px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-content/7 shadow-2xl"
      >
        <GlassBackdrop />
        <div className="modal-panel relative z-[1] flex min-h-0 flex-1 flex-col">
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t("Close")}
            onClick={onClose}
            className="absolute right-2 top-1.5 z-[2] grid size-7 place-items-center rounded-md text-content/45 hover:bg-content/8 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-3.5" />
          </button>
          {/* Each view opens with an h-10 header row; keep its actions clear of
              the close button. */}
          <div className="flex min-h-0 flex-1 flex-col [&>*>*:first-child]:pr-10">
            <Suspense
              fallback={
                <div
                  role="status"
                  className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-content/45"
                >
                  {t("Loading…")}
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
