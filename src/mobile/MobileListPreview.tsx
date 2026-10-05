import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "../shared/i18n/useTranslation";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";

/** Each group owns its preview; extra rows retain the shared collapse lifetime. */
export function MobileListPreview({
  children,
  initialLimit = 5,
  batchSize = 5,
  buttonClassName = "mobile-list-more",
}: {
  children: ReactNode[];
  initialLimit?: number;
  batchSize?: number;
  buttonClassName?: string;
}) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  const id = useId();
  const hasMore = visibleCount < children.length;
  const batches = Array.from(
    { length: Math.ceil(Math.max(0, children.length - initialLimit) / batchSize) },
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
              <AnimatedCollapse key={start} expanded={start < visibleCount}>
                {rows}
              </AnimatedCollapse>
            ))}
          </div>
          <button
            type="button"
            className={buttonClassName}
            aria-expanded={visibleCount > initialLimit}
            aria-controls={id}
            onClick={() => setVisibleCount((current) => hasMore ? current + batchSize : initialLimit)}
          >
            {t(hasMore ? "Show more items" : "Show less")}
          </button>
        </>
      )}
    </>
  );
}
