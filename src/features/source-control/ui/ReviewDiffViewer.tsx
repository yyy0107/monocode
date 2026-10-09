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
  // Settings → Appearance → Code font and size.
  "--diffs-font-family": "var(--font-mono)",
  "--diffs-font-size": "calc(12px * var(--code-font-scale, 1))",
  "--diffs-scrollbar-gutter-override":
    "max(8px, var(--scrollbar-min-size, 0px), calc(14px * var(--scrollbar-scale, 1)))",
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
      // The viewer's shadow root does not inherit the global scrollbar rules.
      unsafeCSS: `
        [data-code] {
          overflow-x: scroll;
          overflow-y: hidden;
          scrollbar-gutter: auto;
          scrollbar-width: auto;
          scrollbar-color: auto;
        }
        [data-code]::-webkit-scrollbar {
          width: 0;
          height: var(--diffs-scrollbar-gutter-override);
        }
        [data-code]::-webkit-scrollbar-track {
          background: color-mix(in srgb, var(--color-content) 6%, var(--diffs-bg));
        }
        [data-code]::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--color-content) ${themeType === "dark" ? 24 : 55}%, var(--diffs-bg));
          background-clip: padding-box;
          border: 1px solid transparent;
          border-radius: 9999px;
        }
        [data-code]::-webkit-scrollbar-thumb:hover {
          background-color: color-mix(in srgb, var(--color-content) ${themeType === "dark" ? 36 : 65}%, var(--diffs-bg));
        }
        @supports (-moz-appearance: none) {
          [data-code] {
            scrollbar-color: color-mix(in srgb, var(--color-content) ${themeType === "dark" ? 24 : 55}%, var(--diffs-bg))
              color-mix(in srgb, var(--color-content) 6%, var(--diffs-bg));
          }
        }
      `,
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
    <div
      className="w-full min-w-0 overflow-x-auto overflow-y-hidden"
      data-review-diff
      style={viewerStyle}
    >
      <FileDiff<number>
        key={workerPool ? "worker" : "main"}
        fileDiff={fileDiff}
        className="block min-h-full w-full"
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
  return (
    <p className="px-4 py-3 text-ui-base text-foreground-subtle">{children}</p>
  );
}
