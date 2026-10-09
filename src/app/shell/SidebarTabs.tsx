import { usePreferenceState } from "../../features/settings/model/usePreferenceState";
import {
  memo,
  startTransition,
  useLayoutEffect,
  useOptimistic,
  useRef,
  type CSSProperties,
} from "react";
import {
  loadSidebarTabOrder,
  saveSidebarTabOrder,
  type SidebarTabId,
} from "../../features/settings/model/appearance";
import { useAnimatedReorder } from "../../shared/hooks/useAnimatedReorder";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { formatInteger } from "../../shared/lib/numbers";
import { prefersReducedMotion } from "../../shared/lib/reducedMotion";

const TAB_LABELS: Record<SidebarTabId, string> = {
  sessions: "Sessions",
  files: "Explorer",
  changes: "Changes",
};

type Props = {
  tab: SidebarTabId;
  onTabChange: (tab: SidebarTabId) => void;
  additions?: number;
  deletions?: number;
  filesLabel?: string;
  resizing?: boolean;
};

export const SidebarTabs = memo(function SidebarTabs({
  tab,
  onTabChange,
  additions = 0,
  deletions = 0,
  filesLabel,
  resizing = false,
}: Props) {
  const { t } = useTranslation();
  const [selectedTab, selectTab] = useOptimistic(tab);
  const cancelPendingPaint = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => cancelPendingPaint.current?.(), [tab]);
  const [tabOrder, setTabOrder] = usePreferenceState(loadSidebarTabOrder);
  const sortable = useAnimatedReorder(tabOrder, (next) => {
    setTabOrder(next);
    saveSidebarTabOrder(next);
  });

  return (
    <div
      role="tablist"
      aria-label={t("Workspace")}
      data-reordering={sortable.draggingId ? "" : undefined}
      data-resizing={resizing ? "" : undefined}
      style={{
        "--sidebar-active-tab": tabOrder.indexOf(selectedTab),
        "--sidebar-tab-count": tabOrder.length,
      } as CSSProperties}
      className="sidebar-segment mx-2 mb-1 flex h-7 shrink-0 items-center gap-px rounded-full bg-surface p-0.5"
    >
      {tabOrder.map((id) => (
        <div
          key={id}
          ref={(el) => sortable.setItemRef(id, el)}
          className="reorder-item workspace-tab relative flex min-w-0 flex-1 touch-none items-stretch"
          onPointerDown={(event) => {
            if (event.button === 0) sortable.onItemPointerDown(id, event);
          }}
        >
          <button
            type="button"
            role="tab"
            title={t(TAB_LABELS[id])}
            aria-selected={selectedTab === id}
            aria-label={
              id === "changes" && (additions || deletions)
                ? `${t("Changes")} ${additions ? `+${additions}` : ""} ${deletions ? `-${deletions}` : ""}`.trim()
                : undefined
            }
            onClick={() => {
              if (sortable.consumeClick()) return;
              cancelPendingPaint.current?.();
              startTransition(async () => {
                selectTab(id);
                if (!prefersReducedMotion()) {
                  // Transitions can still commit a cached Changes panel before
                  // the browser paints. Give the thumb a frame to start first.
                  const painted = await new Promise<boolean>((resolve) => {
                    let frame = requestAnimationFrame(() => {
                      frame = requestAnimationFrame(() => {
                        cancelPendingPaint.current = null;
                        resolve(true);
                      });
                    });
                    cancelPendingPaint.current = () => {
                      cancelAnimationFrame(frame);
                      cancelPendingPaint.current = null;
                      resolve(false);
                    };
                  });
                  if (!painted) return;
                }
                // Updates after an await need their own transition scope.
                startTransition(() => onTabChange(id));
              });
            }}
            className="surface-tab flex h-6 min-w-0 flex-1 items-center justify-center self-center px-2 text-ui-sm leading-none"
          >
            {id === "changes" && (additions || deletions) ? (
              <DiffStat additions={additions} deletions={deletions} />
            ) : (
              <span className="block truncate leading-label">
                {id === "files" && filesLabel ? filesLabel : t(TAB_LABELS[id])}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
});

function DiffStat({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  const { t } = useTranslation();
  const label = [
    additions > 0 ? `+${formatInteger(additions)}` : "",
    deletions > 0 ? `-${formatInteger(deletions)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      title={t("{value0} uncommitted", { value0: label })}
      className="flex shrink-0 items-center gap-1.5 font-sans text-[11px] font-semibold tabular-nums"
    >
      {additions > 0 ? (
        <span className="text-emerald-400">+{formatInteger(additions)}</span>
      ) : null}
      {deletions > 0 ? (
        <span className="text-red-400">-{formatInteger(deletions)}</span>
      ) : null}
    </span>
  );
}
