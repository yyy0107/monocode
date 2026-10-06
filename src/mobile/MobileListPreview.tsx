import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "../shared/i18n/useTranslation";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";

/** Each group owns its preview; extra rows retain the shared collapse lifetime. */
export function MobileListPreview({
  children,
  initialLimit = 5,
  minimumVisibleCount = initialLimit,
  batchSize = 5,
  buttonClassName = "mobile-list-more",
}: {
  children: ReactNode[];
  initialLimit?: number;
  /** Keep expanded project groups visible even when activity moves them down. */
  minimumVisibleCount?: number;
  batchSize?: number;
  buttonClassName?: string;
}) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  const id = useId();
  // Reveal whole existing batches so required rows use the same opening and
  // closing lifetime as Show more / Show less, without moving between parents.
  const previewLimit =
    initialLimit +
    Math.ceil(Math.max(0, minimumVisibleCount - initialLimit) / batchSize) *
      batchSize;
  const visibleLimit = Math.max(visibleCount, previewLimit);
  const hasMore = visibleLimit < children.length;
  const batches = Array.from(
    {
      length: Math.ceil(
        Math.max(0, children.length - initialLimit) / batchSize,
      ),
    },
    (_, index) => {
      const start = initialLimit + index * batchSize;
      return { start, rows: children.slice(start, start + batchSize) };
    },
  );
  return (
    <>
      {children.slice(0, initialLimit)}
      {children.length > initialLimit && (
        <>
          <div id={id}>
            {batches.map(({ start, rows }) => (
              <AnimatedCollapse key={start} expanded={start < visibleLimit}>
                {rows}
              </AnimatedCollapse>
            ))}
          </div>
          {(hasMore || visibleLimit > previewLimit) && (
            <button
              type="button"
              className={buttonClassName}
              aria-expanded={visibleLimit > previewLimit}
              aria-controls={id}
              onClick={() =>
                setVisibleCount(
                  hasMore ? visibleLimit + batchSize : previewLimit,
                )
              }
            >
              {t(hasMore ? "Show more items" : "Show less")}
            </button>
          )}
        </>
      )}
    </>
  );
}
