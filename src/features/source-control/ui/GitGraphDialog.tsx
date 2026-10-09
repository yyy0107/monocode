import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  gitHistory,
  subscribeGitChanged,
  type GitHistoryCommit,
} from "../../../platform/tauri/fs";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { prettyCwd } from "../../../shared/lib/paths";
import { Modal } from "../../../shared/ui/Modal";
import { FolderTree, GitBranch, RefreshCw } from "../../../shared/ui/icons";
import { useProjectWorktrees } from "../hooks/useProjectWorktrees";
import { historyItemGraph, layoutGitGraph } from "../model/gitGraph";
import "./GitGraphDialog.css";

const HISTORY_LIMIT = 500;
const ROW_HEIGHT = 44;
const LANE_SCALE = 1.5;

export function GitGraphDialog({
  cwd,
  selectedSha,
  onClose,
  onOpenCommit,
}: {
  cwd: string;
  selectedSha?: string;
  onClose: () => void;
  onOpenCommit: (commit: GitHistoryCommit) => void;
}) {
  const { t, language } = useTranslation();
  const { commits, loading, error, reload } = useGraphHistory(cwd);
  const worktrees = useProjectWorktrees(cwd);
  const contentRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const rows = useMemo(
    () => layoutGitGraph(commits).map(historyItemGraph),
    [commits],
  );
  const graphWidth = Math.max(64, ...rows.map((row) => row.width * LANE_SCALE));
  const treesByHead = useMemo(() => {
    const heads = new Map<string, string[]>();
    for (const tree of worktrees.data?.worktrees ?? []) {
      const names = heads.get(tree.head) ?? [];
      names.push(tree.path);
      heads.set(tree.head, names);
    }
    return heads;
  }, [worktrees.data]);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [language],
  );

  useEffect(() => {
    const panel = contentRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    panel.querySelector<HTMLButtonElement>("[aria-label]")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(
        panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", trapFocus);
    return () => panel.removeEventListener("keydown", trapFocus);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), worktrees.refresh()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal
      title={t("Git graph")}
      size="lg"
      minimalHeader
      fitViewport
      onClose={onClose}
      className="h-[min(820px,90dvh)]"
    >
      <div ref={contentRef} className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-stroke pl-4 pr-12">
          <GitBranch className="size-4 shrink-0 text-content/65" />
          <span className="shrink-0 text-ui-lg font-medium">
            {t("Git graph")}
          </span>
          <span
            title={cwd}
            className="ml-2 min-w-0 flex-1 truncate text-ui-sm text-content/45"
          >
            {prettyCwd(cwd)}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
            aria-label={t("Refresh Git graph")}
            title={t("Refresh Git graph")}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-content/55 hover:bg-content/5 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-hover disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${loading || refreshing ? "motion-safe:animate-spin" : ""}`}
            />
          </button>
        </header>
        {error || worktrees.error ? (
          <p
            role="alert"
            className="shrink-0 border-b border-stroke px-4 py-2 text-ui-sm text-rose-400"
          >
            {error
              ? t("Could not load Git graph")
              : t("Could not load worktrees")}
            : {error || worktrees.error}
          </p>
        ) : null}
        <div
          className="min-h-0 flex-1 overflow-auto overscroll-contain"
          aria-busy={loading}
        >
          <table
            className="git-graph-table w-full table-fixed border-collapse text-left text-ui-sm"
            style={{ minWidth: Math.max(820, graphWidth + 740) }}
          >
            <colgroup>
              <col style={{ width: graphWidth }} />
              <col />
              <col className="w-36" />
              <col className="w-32" />
              <col className="w-24" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-background-base text-content/50">
              <tr>
                {["Graph", "Description", "Date", "Author", "Commit"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="h-10 border-b border-r border-stroke px-3 font-normal last:border-r-0"
                    >
                      {t(label)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {commits.map((commit, index) => {
                const graph = rows[index]!;
                const trees = treesByHead.get(commit.sha) ?? [];
                const date = new Date(commit.timestamp * 1000);
                const validDate =
                  commit.timestamp > 0 && Number.isFinite(date.getTime());
                const selected = commit.sha === selectedSha;
                return (
                  <tr
                    key={commit.sha}
                    onClick={() => onOpenCommit(commit)}
                    className={`git-history-item cursor-pointer ${commit.head ? "is-head" : ""} ${selected ? "is-selected bg-selection" : commit.head ? "bg-content/5" : "hover:bg-content/5"}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <td className="border-r border-stroke p-0 align-middle">
                      <svg
                        aria-hidden
                        width={graph.width * LANE_SCALE}
                        height={ROW_HEIGHT}
                        className="pointer-events-none"
                      >
                        <g
                          transform={`scale(${LANE_SCALE},${ROW_HEIGHT / graph.height})`}
                        >
                          {graph.paths.map((path, i) => (
                            <path
                              key={i}
                              d={path.d}
                              fill="none"
                              stroke={path.color}
                              strokeWidth={1.5}
                              vectorEffect="non-scaling-stroke"
                              strokeLinecap="round"
                            />
                          ))}
                        </g>
                        {graph.circles.map((circle, i) => (
                          <circle
                            key={i}
                            cx={circle.cx * LANE_SCALE}
                            cy={(circle.cy * ROW_HEIGHT) / graph.height}
                            r={circle.r}
                            fill={circle.fill ?? "none"}
                            strokeWidth={circle.strokeWidth}
                          />
                        ))}
                      </svg>
                    </td>
                    <td className="px-3 py-0">
                      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                        {commit.head ? (
                          <span
                            className="git-graph-ref"
                            style={{ borderColor: graph.circleColor }}
                          >
                            HEAD
                          </span>
                        ) : null}
                        {commit.refs.map((ref) => (
                          <span
                            key={`${ref.kind}:${ref.name}`}
                            className="git-graph-ref"
                            title={ref.name}
                          >
                            <GitBranch className="size-3 shrink-0" />
                            <span className="truncate">{ref.name}</span>
                          </span>
                        ))}
                        {trees.map((path) => (
                          <span
                            key={path}
                            className="git-graph-ref text-content/70"
                            title={t("Worktree: {path}", { path })}
                          >
                            <FolderTree className="size-3 shrink-0" />
                            <span className="truncate">
                              {path
                                .replace(/\\/g, "/")
                                .split("/")
                                .filter(Boolean)
                                .at(-1) || path}
                            </span>
                          </span>
                        ))}
                        <button
                          type="button"
                          title={[commit.subject, commit.body]
                            .filter(Boolean)
                            .join("\n\n")}
                          className="min-w-20 flex-1 truncate rounded py-2 text-left text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-hover"
                        >
                          {commit.subject || commit.shortSha}
                        </button>
                      </div>
                    </td>
                    <td className="truncate px-3 py-0 tabular-nums text-content/50">
                      {validDate ? (
                        <time
                          dateTime={date.toISOString()}
                          title={date.toLocaleString(language)}
                        >
                          {dateFormat.format(date)}
                        </time>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      title={commit.author}
                      className="truncate px-3 py-0 text-content/50"
                    >
                      {commit.author || t("Unknown author")}
                    </td>
                    <td
                      title={commit.sha}
                      className="truncate px-3 py-0 font-mono text-content/50"
                    >
                      {commit.shortSha}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {commits.length === 0 ? (
            <p
              role="status"
              className="px-4 py-10 text-center text-ui-sm text-content/45"
            >
              {loading
                ? t("Loading…")
                : error
                  ? t("Could not load Git graph")
                  : t("No commits yet")}
            </p>
          ) : null}
        </div>
        {commits.length >= HISTORY_LIMIT ? (
          <p className="shrink-0 border-t border-stroke px-4 py-2 text-ui-xs text-content/45">
            {t("Showing the latest {count} commits", { count: HISTORY_LIMIT })}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Keep the last successful graph during refresh and ignore old requests. */
function useGraphHistory(cwd: string) {
  const [state, setState] = useState<{
    cwd: string;
    commits: GitHistoryCommit[];
    loading: boolean;
    error?: string;
  }>({ cwd, commits: [], loading: true });
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setState((previous) => ({
      cwd,
      commits: previous.cwd === cwd ? previous.commits : [],
      loading: true,
    }));
    try {
      const result = await gitHistory(cwd, HISTORY_LIMIT, true);
      if (id === request.current)
        setState({ cwd, commits: result.commits, loading: false });
    } catch (error) {
      if (id === request.current)
        setState((previous) => ({
          ...previous,
          loading: false,
          error: String(error),
        }));
    }
  }, [cwd]);
  useEffect(() => {
    void reload();
    const resume = () => {
      if (!document.hidden) void reload();
    };
    const unsubscribe = subscribeGitChanged(resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      request.current += 1;
      unsubscribe();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [reload]);
  return { ...state, commits: state.cwd === cwd ? state.commits : [], reload };
}
