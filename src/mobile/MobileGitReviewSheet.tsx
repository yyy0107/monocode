import { useEffect, useId, useState } from "react";
import type { GitChangedFile, GitFileDiff } from "../platform/tauri/fs";
import { useTranslation } from "../shared/i18n/useTranslation";
import { ChevronRight, WrapText } from "../shared/ui/icons";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import type { MobileGitSource } from "./mobileGit";
import type { MobileGitIndexState } from "./useMobileGitIndex";
import { MobileSheet } from "./MobileSheet";
import { MobileGitDiff } from "./MobileGitDiff";
import "./mobileGitReview.css";

export function MobileDiffCounts({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  return (
    <span className="mobile-git-counts">
      <span data-kind="add">+{additions}</span>
      <span data-kind="del">−{deletions}</span>
    </span>
  );
}

/** Read-only HEAD → working-copy review, expanded directly in the file list. */
export function MobileGitReviewSheet({
  open,
  onExited,
  source,
  state,
  enabled,
  onBack,
  onClose,
}: {
  open: boolean;
  onExited: () => void;
  source: MobileGitSource;
  state: MobileGitIndexState;
  enabled: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [wrap, setWrap] = useState(false);
  const title = state.index
    ? t(state.index.files.length === 1 ? "{count} file changed" : "{count} files changed", {
        count: state.index.files.length,
      })
    : t("Uncommitted changes");
  return (
    <MobileSheet
      open={open}
      onExited={onExited}
      title="Uncommitted changes"
      header={{ title, action: (
        <button
          type="button"
          className="mobile-sheet-header-button mobile-git-wrap"
          aria-label={t("Wrap lines")}
          title={t("Wrap lines")}
          aria-pressed={wrap}
          onClick={() => setWrap((value) => !value)}
        >
          <WrapText size={22} />
        </button>
      ) }}
      surface="solid"
      detents
      onBack={onBack}
      onClose={onClose}
    >
      <div className="mobile-git-review">
        <div className="mobile-git-toolbar">
          <span>
            {state.index && (
              <MobileDiffCounts
                additions={state.index.additions}
                deletions={state.index.deletions}
              />
            )}
          </span>
        </div>
        {!enabled && (
          <p className="mobile-git-note">
            {t("Reconnect to refresh changes.")}
          </p>
        )}
        {state.error && (
          <div className="mobile-git-error" role="alert">
            <strong>{t("Could not load changes.")}</strong>
            <p>{state.error}</p>
          </div>
        )}
        {!state.index && state.loading && (
          <p className="mobile-git-note" role="status">
            {t("Loading changes…")}
          </p>
        )}
        {state.index?.files.length === 0 && (
          <p className="mobile-git-note">{t("No file changes")}</p>
        )}
        {state.index?.files.map((file) => (
          <MobileGitFileRow
            key={file.relative}
            source={source}
            entry={file}
            enabled={enabled}
            wrap={wrap}
          />
        ))}
      </div>
    </MobileSheet>
  );
}

function MobileGitFileRow({
  source,
  entry,
  enabled,
  wrap,
}: {
  source: MobileGitSource;
  entry: GitChangedFile;
  enabled: boolean;
  wrap: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <div className="mobile-git-file-entry">
      <button
        type="button"
        className="mobile-git-file-row"
        disabled={!enabled && !expanded}
        aria-expanded={expanded}
        aria-controls={contentId}
        title={entry.relative}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronRight size={16} aria-hidden="true" className="mobile-git-file-chevron" />
        <span className="mobile-git-file-path"><bdi dir="ltr">{entry.relative}</bdi></span>
        <MobileDiffCounts
          additions={entry.additions}
          deletions={entry.deletions}
        />
      </button>
      <AnimatedCollapse expanded={expanded} motion="height" animateContentResize>
        <div id={contentId} className="mobile-git-file">
          <MobileGitFile source={source} entry={entry} enabled={enabled} wrap={wrap} />
        </div>
      </AnimatedCollapse>
    </div>
  );
}

function MobileGitFile({
  source,
  entry,
  enabled,
  wrap,
}: {
  source: MobileGitSource;
  entry: GitChangedFile;
  enabled: boolean;
  wrap: boolean;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const [loaded, setLoaded] = useState<{
    source: MobileGitSource;
    diff?: GitFileDiff;
    loading: boolean;
    error?: string;
  }>({ source, loading: true });
  useEffect(() => {
    if (!visible || !enabled) return;
    let current = true;
    setLoaded((previous) => ({
      source,
      diff: previous.source === source ? previous.diff : undefined,
      loading: true,
    }));
    void source
      .loadDiff(entry.relative)
      .then((diff) => {
        if (current) setLoaded({ source, diff, loading: false });
      })
      .catch((problem) => {
        if (current)
          setLoaded({
            source,
            loading: false,
            error: problem instanceof Error ? problem.message : String(problem),
          });
      });
    return () => {
      current = false;
    };
  }, [source, entry.relative, visible, enabled]);
  const diff = loaded.source === source ? loaded.diff : undefined;
  return (
    <>
      {enabled && loaded.loading && !diff && (
        <p className="mobile-git-note" role="status">
          {t("Loading changes…")}
        </p>
      )}
      {loaded.error && (
        <div className="mobile-git-error" role="alert">
          <strong>{t("Could not load diff.")}</strong>
          <p>{loaded.error}</p>
        </div>
      )}
      {diff && <MobileGitDiff diff={diff} wrap={wrap} />}
    </>
  );
}
