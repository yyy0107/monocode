import { useMemo } from "react";
import type { FileDiffOptions } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import {
  prepareReviewDiff,
  reviewFileMetadata,
} from "../features/source-control/model/reviewDiff";
import type { GitFileDiff } from "../platform/tauri/fs";
import { useColorScheme } from "../shared/hooks/useColorScheme";
import { useTranslation } from "../shared/i18n/useTranslation";

/** A continuous, wrapping diff in the file list, with no nested editor viewport. */
export function MobileGitDiff({ diff }: { diff: GitFileDiff }) {
  const { t } = useTranslation();
  const themeType = useColorScheme();
  const prepared = useMemo(
    () =>
      prepareReviewDiff({
        ...diff,
        tooLarge:
          diff.tooLarge || diff.original.length + diff.current.length > 256_000,
      }),
    [diff],
  );
  const fileDiff = useMemo(
    () => reviewFileMetadata(diff.relative, prepared),
    [diff.relative, prepared],
  );
  const options = useMemo<FileDiffOptions<undefined>>(
    () => ({
      diffStyle: "unified",
      diffIndicators: "bars",
      disableFileHeader: true,
      overflow: "wrap",
      hunkSeparators: fileDiff?.isPartial ? "simple" : "line-info",
      lineDiffType: "word-alt",
      maxLineDiffLength: 1000,
      tokenizeMaxLineLength: 1000,
      theme: { light: "pierre-light", dark: "pierre-dark" },
      themeType,
      preferredHighlighter: "shiki-wasm",
      unsafeCSS: `
      :host { border: 0; border-radius: 0; }
      [data-code] { touch-action: pan-y; }
      [data-line] { overflow-wrap: anywhere; }
      [data-line][data-line-type="change-addition"] {
        background-color: var(--mobile-diff-addition, var(--diffs-line-bg));
      }
      [data-line][data-line-type="change-deletion"] {
        background-color: var(--mobile-diff-deletion, var(--diffs-line-bg));
      }
    `,
      onPostRender(node) {
        // Pierre renders these labels inside its shadow root, outside React i18n.
        for (const label of node.shadowRoot?.querySelectorAll<HTMLElement>(
          "[data-unmodified-lines]",
        ) ?? []) {
          const count =
            label.textContent?.match(/^(\d+) unmodified lines?$/)?.[1] ??
            label.dataset.count;
          if (!count) continue;
          label.dataset.count = count;
          label.textContent = t("{count} unmodified lines", { count });
        }
        for (const button of node.shadowRoot?.querySelectorAll<HTMLElement>(
          "[data-expand-button]",
        ) ?? []) {
          const label = t(
            button.hasAttribute("data-expand-up")
              ? "Expand unmodified lines upward"
              : button.hasAttribute("data-expand-down")
                ? "Expand unmodified lines downward"
                : "Expand all",
          );
          button.setAttribute("aria-label", label);
          if (button.hasAttribute("data-expand-all-button"))
            button.textContent = label;
        }
      },
    }),
    [themeType, fileDiff?.isPartial, t],
  );

  if (prepared.binary)
    return <p className="mobile-git-note">{t("Binary file changed")}</p>;
  if (prepared.tooLarge)
    return (
      <p className="mobile-git-note">{t("Diff is too large to display")}</p>
    );
  if (
    !prepared.unified ||
    (!prepared.unified.additions && !prepared.unified.deletions)
  )
    return <p className="mobile-git-note">{t("No textual diff")}</p>;
  if (!fileDiff)
    return (
      <p className="mobile-git-note">{t("Diff is too large to display")}</p>
    );
  return (
    <div className="mobile-git-diff" data-theme={themeType}>
      <FileDiff fileDiff={fileDiff} options={options} />
    </div>
  );
}
