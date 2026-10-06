import { useState } from "react";
import { useTranslation } from "../../shared/i18n/useTranslation";

export const SIDEBAR_PREVIEW_COUNT = 5;

/** Keep each sidebar group's reveal count independent of its siblings. */
export function useSidebarListPreview(
  total: number,
  resetKey: string,
  disabled = false,
) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState({
    key: resetKey,
    count: SIDEBAR_PREVIEW_COUNT,
    mountedCount: SIDEBAR_PREVIEW_COUNT * 2,
  });
  if (preview.key !== resetKey)
    setPreview({
      key: resetKey,
      count: SIDEBAR_PREVIEW_COUNT,
      mountedCount: SIDEBAR_PREVIEW_COUNT * 2,
    });
  const count = disabled
    ? total
    : preview.key === resetKey
      ? preview.count
      : SIDEBAR_PREVIEW_COUNT;
  // Prepare only the next page; keep previously revealed rows for closing/reversal.
  const mountedCount = Math.min(
    total,
    disabled
      ? total
      : Math.max(
          count + SIDEBAR_PREVIEW_COUNT,
          preview.key === resetKey ? preview.mountedCount : 0,
        ),
  );
  const hasMore = count < total;
  const button =
    !disabled && total > SIDEBAR_PREVIEW_COUNT ? (
      <button
        type="button"
        data-sidebar-list-toggle
        data-no-drag
        aria-expanded={count > SIDEBAR_PREVIEW_COUNT}
        onClick={() => {
          const nextCount = hasMore
            ? count + SIDEBAR_PREVIEW_COUNT
            : SIDEBAR_PREVIEW_COUNT;
          setPreview({
            key: resetKey,
            count: nextCount,
            mountedCount: Math.max(
              mountedCount,
              nextCount + SIDEBAR_PREVIEW_COUNT,
            ),
          });
        }}
        className="flex min-h-8 w-full shrink-0 items-center justify-start rounded-md pl-8 pr-2 text-[12px] text-content/45 hover:bg-content/5 hover:text-content"
      >
        {t(hasMore ? "Show more items" : "Show less")}
      </button>
    ) : null;
  return { count, mountedCount, button };
}
