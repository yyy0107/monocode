import { useEffect, useMemo, useState } from "react";
import { FilePreview } from "../features/files/ui/FilePreview";
import { FileTypeIcon } from "../features/files/ui/FileTypeIcon";
import type { ToolPreview } from "../features/sessions/model/session";
import { buildUnifiedFile } from "../features/source-control/model/unifiedDiff";
import type { GitChangedFile, GitFileDiff } from "../platform/tauri/fs";
import { useTranslation } from "../shared/i18n/useTranslation";
import { ChevronRight, LoaderCircle, RefreshCw } from "../shared/ui/icons";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import type { MobileGitSource } from "./mobileGit";
import type { MobileGitIndexState } from "./useMobileGitIndex";
import { MobilePageTransition } from "./MobilePageTransition";
import { MobileSheet, MobileSheetHeader } from "./MobileSheet";
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

/** Read-only HEAD → working-copy review, with one entry per changed file. */
export function MobileGitReviewSheet({
  open,
  onExited,
  source,
  state,
  enabled,
  entry,
  onSelect,
  onBack,
  onClose,
}: {
  open: boolean;
  onExited: () => void;
  source: MobileGitSource;
  state: MobileGitIndexState;
  enabled: boolean;
  entry?: GitChangedFile;
  onSelect: (entry: GitChangedFile) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <MobileSheet
      open={open}
      onExited={onExited}
      title="Uncommitted changes"
      detents
      onClose={onClose}
    >
      <div className="mobile-sheet-pages">
        <MobilePageTransition
          slide
          visible={open}
          route={{
            key: entry?.relative ?? "changes",
            section: "chat",
            depth: entry ? 1 : 0,
          }}
        >
          {entry ? (
            <MobileGitFile
              key={entry.relative}
              source={source}
              entry={entry}
              enabled={enabled}
              onBack={onBack}
              onClose={onClose}
            />
          ) : (
            <>
              <MobileSheetHeader
                title={t("Uncommitted changes")}
                onBack={onBack}
                onClose={onClose}
              />
              <div className="mobile-sheet-page-scroll" data-mobile-page-scroll>
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
                    <RefreshButton
                      loading={state.loading}
                      disabled={!enabled}
                      onClick={state.refresh}
                    />
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
                    <button
                      type="button"
                      key={file.relative}
                      className="mobile-git-file-row"
                      disabled={!enabled}
                      onClick={() => onSelect(file)}
                    >
                      <FileTypeIcon name={file.relative} isDir={false} />
                      <span className="mobile-git-file-path">
                        {file.relative}
                      </span>
                      <MobileDiffCounts
                        additions={file.additions}
                        deletions={file.deletions}
                      />
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </MobilePageTransition>
      </div>
    </MobileSheet>
  );
}

function RefreshButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="mobile-git-refresh"
      disabled={disabled || loading}
      aria-label={t("Refresh changes")}
      onClick={onClick}
    >
      {loading ? (
        <LoaderCircle size={20} className="mobile-spin" />
      ) : (
        <RefreshCw size={20} />
      )}
    </button>
  );
}

function MobileGitFile({
  source,
  entry,
  enabled,
  onBack,
  onClose,
}: {
  source: MobileGitSource;
  entry: GitChangedFile;
  enabled: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const [revision, setRevision] = useState(0);
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
  }, [source, entry.relative, revision, visible, enabled]);
  const diff = loaded.source === source ? loaded.diff : undefined;
  const tooLarge =
    !!diff &&
    (diff.tooLarge || diff.original.length + diff.current.length > 256_000);
  const preview = useMemo<ToolPreview | undefined>(() => {
    if (!diff || diff.binary || tooLarge) return;
    const unified = buildUnifiedFile(diff.original, diff.current);
    if (!unified.additions && !unified.deletions) return;
    return {
      kind: "write",
      path: entry.relative,
      additions: unified.additions,
      deletions: unified.deletions,
      lines: unified.lines.flatMap((line) =>
        line.kind === "hunk"
          ? []
          : [
              {
                kind: line.kind,
                text: line.text,
                number:
                  (line.kind === "del" ? line.oldNumber : line.newNumber) ??
                  undefined,
              },
            ],
      ),
    };
  }, [diff, tooLarge, entry.relative]);
  return (
    <>
      <MobileSheetHeader
        title={entry.relative}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="mobile-sheet-page-scroll" data-mobile-page-scroll>
        <div className="mobile-git-file">
          <div className="mobile-git-toolbar">
            <span>{t("Diff view")}</span>
            <RefreshButton
              loading={enabled && loaded.loading}
              disabled={!enabled}
              onClick={() => setRevision((value) => value + 1)}
            />
          </div>
          {!enabled && (
            <p className="mobile-git-note">
              {t("Reconnect to refresh changes.")}
            </p>
          )}
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
          {diff?.binary ? (
            <p className="mobile-git-note">{t("Binary file changed")}</p>
          ) : tooLarge ? (
            <p className="mobile-git-note">
              {t("Diff is too large to display")}
            </p>
          ) : preview ? (
            <FilePreview preview={preview} status="accepted" variant="list" />
          ) : diff ? (
            <p className="mobile-git-note">{t("No textual diff")}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
