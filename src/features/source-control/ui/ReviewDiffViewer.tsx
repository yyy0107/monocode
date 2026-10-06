// Adapted from ZCode (Apache-2.0).
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { FileDiffOptions } from "@pierre/diffs";
import { FileDiff, useWorkerPool } from "@pierre/diffs/react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { useColorScheme } from "../../../shared/hooks/useColorScheme";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";
import { MessageSquarePlus, Plus } from "../../../shared/ui/icons";
import {
  reviewCommentLine,
  reviewFileMetadata,
  reviewStageAnnotations,
  type ReviewLoadedDiff,
} from "../model/reviewDiff";
import {
  DiffCommentComposer,
  type DiffCommentComposerTarget,
} from "./DiffCommentComposer";

const viewerStyle = {
  "--diffs-bg": "var(--color-background-base)",
  "--diffs-light-bg": "var(--color-background-base)",
  "--diffs-dark-bg": "var(--color-background-base)",
  "--diffs-light": "var(--color-content)",
  "--diffs-dark": "var(--color-content)",
  "--diffs-font-family":
    'Consolas, "Cascadia Mono", "Liberation Mono", ui-monospace, monospace',
  "--diffs-font-size": "12px",
} as CSSProperties;

export const ReviewDiffViewer = memo(function ReviewDiffViewer({
  path,
  relative,
  diff,
  busy,
  onStageHunk,
}: {
  path: string;
  relative: string;
  diff: ReviewLoadedDiff;
  busy: boolean;
  onStageHunk?: (pos: number) => void;
}) {
  const { t } = useTranslation();
  const themeType = useColorScheme();
  const workerPool = useWorkerPool();
  const visible = useSurfaceVisibility();
  const [comment, setComment] = useState<DiffCommentComposerTarget | null>(
    null,
  );
  const fileDiff = useMemo(
    () => reviewFileMetadata(relative, diff),
    [diff, relative],
  );
  useEffect(() => {
    setComment(null);
  }, [diff, path, visible]);
  const options = useMemo<FileDiffOptions<number>>(
    () => ({
      diffStyle: "unified",
      diffIndicators: "bars",
      disableFileHeader: true,
      hunkSeparators: fileDiff?.isPartial ? "simple" : "line-info",
      lineDiffType: "word-alt",
      maxLineDiffLength: 1000,
      tokenizeMaxLineLength: 1000,
      overflow: "scroll",
      theme: { light: "github-light", dark: "github-dark" },
      themeType,
      preferredHighlighter: "shiki-wasm",
      enableGutterUtility: visible,
    }),
    [themeType, visible, fileDiff?.isPartial],
  );
  const annotations = useMemo(
    () =>
      onStageHunk && diff.unified
        ? reviewStageAnnotations(diff.unified.lines)
        : [],
    [diff, onStageHunk],
  );

  if (diff.binary) return <Empty>{t("Binary file changed")}</Empty>;
  if (diff.tooLarge) return <Empty>{t("Diff is too large to display")}</Empty>;
  if (!diff.unified || (!diff.unified.additions && !diff.unified.deletions))
    return <Empty>{t("No textual diff")}</Empty>;
  if (!fileDiff) return <Empty>{t("Diff is too large to display")}</Empty>;

  return (
    <div data-review-diff style={viewerStyle}>
      <FileDiff<number>
        key={workerPool ? "worker" : "main"}
        fileDiff={fileDiff}
        options={options}
        style={viewerStyle}
        lineAnnotations={annotations}
        renderAnnotation={({ metadata }) => (
          <div className="flex items-center bg-content/5 px-3 py-1">
            <button
              type="button"
              disabled={busy || !visible}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-sans text-[11px] text-content/60 hover:bg-content/10 disabled:opacity-40"
              onClick={() => onStageHunk?.(metadata)}
            >
              <Plus className="size-3" />
              {t("Stage hunk")}
            </button>
          </div>
        )}
        renderGutterUtility={(getHoveredLine) => (
          <button
            type="button"
            title={t("Comment on line")}
            aria-label={t("Comment on line")}
            disabled={!visible}
            className="grid size-5 place-items-center rounded bg-content text-background-base hover:opacity-80"
            onClick={(event) => {
              const hovered = getHoveredLine();
              if (!visible || !hovered) return;
              const line = reviewCommentLine(
                diff.unified!.lines,
                hovered.side,
                hovered.lineNumber,
              );
              if (line)
                setComment({
                  line,
                  anchor: event.currentTarget.getBoundingClientRect(),
                });
            }}
          >
            <MessageSquarePlus className="size-3" />
          </button>
        )}
      />
      {visible && comment ? (
        <DiffCommentComposer
          path={path}
          target={comment}
          onDismiss={() => setComment(null)}
        />
      ) : null}
    </div>
  );
});

function Empty({ children }: { children: string }) {
  return <p className="px-4 py-4 text-[12px] text-content/45">{children}</p>;
}
