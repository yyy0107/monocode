// Adapted from ZCode (Apache-2.0).
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  gitBaseDiffFiles,
  gitBaseFileDiff,
  gitCommitFileDiff,
  gitCommitFiles,
  gitDiffFiles,
  gitFileDiff,
  subscribeGitChanged,
} from "../../../platform/tauri/fs";
import {
  sessionCheckpointStatus,
  sessionCheckpointFileDiff,
  subscribeReviewChanged,
} from "../../sessions/model/checkpoint";
import {
  ReviewDiffCache,
  reviewCommit,
  reviewScopeKey,
  WORKTREE_REVIEW_SOURCES,
  type ReviewFile,
  type ReviewScope,
  type ReviewSource,
} from "./reviewDiff";

export function useReviewSource(
  cwd: string,
  source: ReviewSource,
  sessionId?: string,
) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [revision, refreshRevision] = useReducer((n: number) => n + 1, 0);
  const scope = useMemo<ReviewScope>(
    () => ({ cwd, source, sessionId }),
    [cwd, source, sessionId],
  );
  const scopeKey = reviewScopeKey(scope);
  const [index, setIndex] = useState<{
    key: string;
    revision: number;
    files: ReviewFile[] | null;
    loading: boolean;
    error?: string;
  }>({ key: "", revision: -1, files: null, loading: true });
  const [cache, setCache] = useState<ReviewDiffCache>();
  // Create the resource in the effect: StrictMode's setup/cleanup replay must not
  // leave a memoized cache permanently disposed.
  useEffect(() => {
    const next = new ReviewDiffCache((request, path) => {
      const commit = reviewCommit(request.source);
      if (commit) return gitCommitFileDiff(request.cwd, commit, path);
      switch (request.source) {
        case "session":
          return sessionCheckpointFileDiff(
            request.sessionId!,
            request.cwd,
            path,
          );
        case "uncommitted":
          return gitBaseFileDiff(request.cwd, "head", path);
        case "branch":
          return gitBaseFileDiff(request.cwd, "branch", path);
        default:
          return gitFileDiff(
            request.cwd,
            path,
            request.source === "staged" ? "staged" : "unstaged",
          );
      }
    }, redraw);
    setCache(next);
    return () => next.dispose();
  }, [cwd, sessionId]);
  const refresh = useCallback(
    (sources?: readonly ReviewSource[]) => {
      // A full refresh also reloads the selected commit, e.g. after a rebase.
      const kinds = sources ?? [...WORKTREE_REVIEW_SOURCES, "session", source];
      for (const kind of kinds)
        cache?.invalidate({ cwd, source: kind, sessionId });
      redraw();
      if (kinds.includes(source)) refreshRevision();
    },
    [cache, cwd, sessionId, source],
  );

  useEffect(() => {
    let stale = false;
    const key = scopeKey;
    // Keep this source's rows mounted during refresh so mutations do not reset
    // the scroll position or interrupt a disclosure animation.
    setIndex((previous) => ({
      key,
      revision,
      files: previous.key === key ? previous.files : null,
      loading: true,
    }));
    if (!cwd || cwd === "~" || (source === "session" && !sessionId)) {
      setIndex({ key, revision, files: [], loading: false });
      return;
    }
    const commit = reviewCommit(source);
    const request = commit
      ? gitCommitFiles(cwd, commit)
      : source === "uncommitted" || source === "branch"
        ? gitBaseDiffFiles(cwd, source === "branch" ? "branch" : "head").then(
            (diff) => diff.files,
          )
        : source === "session"
          ? sessionCheckpointStatus(sessionId!, cwd).then(
              (status) => status.files,
            )
          : gitDiffFiles(cwd).then((status) =>
              status.files
                .filter((file) =>
                  source === "staged" ? file.staged : file.unstaged,
                )
                // Index totals combine both sides for partially staged files. Wait for the exact diff counts.
                .map((file) =>
                  file.staged && file.unstaged
                    ? { ...file, additions: 0, deletions: 0 }
                    : file,
                ),
            );
    void request
      .then((files) => {
        if (!stale) setIndex({ key, revision, files, loading: false });
      })
      .catch((error: unknown) => {
        if (!stale)
          setIndex({
            key,
            revision,
            files: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => {
      stale = true;
    };
  }, [cwd, source, sessionId, scopeKey, revision]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          refresh(WORKTREE_REVIEW_SOURCES);
        });
    };
    const gitUnsubscribe = subscribeGitChanged(schedule);
    const reviewUnsubscribe = subscribeReviewChanged((id) => {
      if (!id || id === sessionId) refresh(["session"]);
    });
    const onFocus = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      gitUnsubscribe();
      reviewUnsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [refresh, sessionId]);

  const loadDiff = useCallback(
    (path: string) => cache?.load(scope, path),
    [cache, scope],
  );
  const getDiff = (path: string) => cache?.get(scope, path);
  const current = index.key === scopeKey;
  return {
    scopeKey,
    files: current ? index.files : null,
    error: current ? index.error : undefined,
    loading: !current || index.revision !== revision || index.loading,
    loadDiff,
    getDiff,
    refresh,
  };
}
