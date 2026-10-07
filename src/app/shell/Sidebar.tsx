import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ListFilter,
  PanelLeft,
  Search,
} from "../../shared/ui/icons";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { pathKey, projectKey } from "../../shared/lib/paths";
import { basename } from "../../platform/tauri/fs";
import { useShortcutLabel } from "../commands/useCommandShortcut";
import { useDragResize } from "../../shared/hooks/useDragResize";
import { useLockOverscroll } from "../../shared/hooks/useLockOverscroll";
import { useProjectDiffStats } from "../../features/source-control/hooks/useProjectDiffStats";
import { useGitFileStatuses } from "../../features/source-control/hooks/useGitFileStatuses";
import { SidebarWorktreeSwitcher } from "../../features/source-control/ui/SidebarWorktreeSwitcher";
import { FileTree } from "../../features/files/ui/FileTree";
import { ProjectSearch } from "../../features/projects/ui/ProjectSearch";
import { SearchableProjectPicker } from "../../features/projects/ui/SearchableProjectPicker";
import { SourceControl } from "../../features/source-control/ui/SourceControl";
import {
  loadSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from "../../features/settings/model/appearance";
import {
  collectRailProjects,
  isRemoteProjectPath,
  sameProjectPath,
} from "../../features/projects/model/recents";
import {
  loadProjectTreeExpanded,
  saveProjectTreeExpanded,
  subscribeProjectTreeExpanded,
} from "../../features/projects/model/projectTree";
import {
  loadTabGroupLabels,
  resolveTabGroupLabel,
  subscribeTabGroupLabels,
} from "../../features/workspace/model/tabGroups";
import {
  filterSessionsByHarness,
  filterSessionsByStatus,
  filterSessionsByTime,
  hasActiveSessionFilters,
  harnessesInSessions,
  loadSessionSidebarFilters,
  saveSessionSidebarFilters,
  type SessionSidebarFilters,
} from "../../features/sessions/model/sessionFilters";
import {
  compareSessionSummaries,
  filterSessionsByArchive,
  mergeLiveSessionSummaries,
} from "../../features/sessions/data/sessionHistory";
import { sessionDisplayTitle } from "../../features/sessions/model/session";
import {
  cachedRemoteProjectSessionsState,
  cachedRemoteSessions,
  hasCachedRemoteProjectSessions,
  REMOTE_HISTORY_UPDATED,
  remotePendingWorktree,
  remoteSessionFor,
} from "../../features/connections/model/connections";
import {
  parseRemotePath,
  remotePath,
  remoteProjectFor,
} from "../../features/connections/model/remoteProjects";
import type { SessionSummary } from "../../features/sessions/data/sessionStore";
import { SessionFiltersMenu } from "../../features/sessions/ui/SessionFiltersMenu";
import { IconButton, WindowNavigationSpace } from "./WindowChrome";
import { SidebarTransition } from "./SidebarTransition";
import { SidebarTabs } from "./SidebarTabs";
import { ResizeHandle } from "../../shared/ui/ResizeHandle";
import { ProjectList, AddProjectButton } from "./ProjectList";
import { ProjectSessionSection } from "./ProjectSessionSection";
import { ExternalSessions } from "./ExternalSessions";
import type { SidebarProps } from "./Sidebar.types";
import {
  projectHoverSummary,
  type ProjectHoverSummary,
} from "../model/projectHoverSummary";

const NO_SESSIONS: readonly SessionSummary[] = [];

function SidebarComponent(props: SidebarProps) {
  const { t } = useTranslation();
  const {
    cwd,
    open,
    tab,
    sessions,
    recents = [],
    projectHistory = sessions,
    onNewInProject,
  } = props;
  const toggleLabel = useShortcutLabel("Toggle Sidebar", "App: Toggle Sidebar");
  const quickOpenLabel = useShortcutLabel("Quick Open", "App: Go to File");
  const [initialWidth] = useState(loadSidebarWidth);
  const resize = useDragResize({
    min: SIDEBAR_WIDTH_MIN,
    max: () => Math.min(SIDEBAR_WIDTH_MAX, Math.floor(window.innerWidth * 0.5)),
    defaultWidth: SIDEBAR_WIDTH_DEFAULT,
    initial: initialWidth,
    onCommit: saveSidebarWidth,
  });
  const [expandedPaths, setExpandedPaths] = useState(() =>
    loadProjectTreeExpanded(cwd),
  );
  const initialExpansion = useRef(expandedPaths);
  useEffect(() => {
    // Store the implicit first-use expansion so rename/removal can update it.
    // An existing empty array intentionally keeps every project collapsed.
    saveProjectTreeExpanded(initialExpansion.current);
  }, []);
  const [query, setQuery] = useState("");
  const [searchCollapse, setSearchCollapse] = useState<{
    query: string;
    paths: ReadonlySet<string>;
  }>(() => ({ query: "", paths: new Set() }));
  useEffect(() => {
    setSearchCollapse((previous) =>
      previous.query === query ? previous : { query, paths: new Set() },
    );
  }, [query]);
  const [sessionProjectPath, setSessionProjectPath] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState(loadSessionSidebarFilters);
  const [filterMenu, setFilterMenu] = useState<HTMLButtonElement | null>(
    null,
  );
  const [labels, setLabels] = useState(loadTabGroupLabels);
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [searchRevision, setSearchRevision] = useState(0);
  const [searchFailed, setSearchFailed] = useState<Set<string>>(
    () => new Set(),
  );
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const treeViewportRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [treeHeight, setTreeHeight] = useState(700);
  const treeLock = useLockOverscroll<HTMLDivElement>();
  const searchActive = tab === "sessions" && !!query.trim();
  const loadAllProjectSummaries =
    open && tab === "sessions" && props.recents !== undefined;
  const allProjects = useMemo(
    () => [...collectRailProjects(recents, cwd).values()],
    [cwd, recents],
  );
  const projects = useMemo(
    () =>
      tab === "sessions" && sessionProjectPath
        ? allProjects.filter(({ path }) =>
            sameProjectPath(path, sessionProjectPath),
          )
        : allProjects,
    [allProjects, tab, sessionProjectPath],
  );
  useEffect(() => {
    if (
      sessionProjectPath &&
      !allProjects.some(({ path }) => sameProjectPath(path, sessionProjectPath))
    )
      setSessionProjectPath(null);
  }, [allProjects, sessionProjectPath]);
  const projectPathsKey = projects
    .map((project) => pathKey(project.path))
    .join("\0");
  const loadedPaths =
    props.loadedProjectPaths ??
    new Set(!props.pending && props.status !== "error" ? [pathKey(cwd)] : []);
  const failedPaths =
    props.failedProjectPaths ??
    new Set(props.status === "error" ? [pathKey(cwd)] : []);
  const loadedPathsKey = [...loadedPaths].sort().join("\0");
  const expandedPathsKey = [...expandedPaths].sort().join("\0");
  const activationRef = useRef({ cwd, tab });
  useEffect(() => {
    const previous = activationRef.current;
    activationRef.current = { cwd, tab };
    if (
      sameProjectPath(previous.cwd, cwd) &&
      (previous.tab === tab || tab === "sessions")
    )
      return;
    if (!cwd || cwd === "~" || expandedPaths.has(pathKey(cwd))) return;
    const next = new Set(expandedPaths);
    next.add(pathKey(cwd));
    setExpandedPaths(next);
    saveProjectTreeExpanded(next);
  }, [cwd, tab]);

  useEffect(
    () =>
      subscribeProjectTreeExpanded(() =>
        setExpandedPaths(loadProjectTreeExpanded(cwd)),
      ),
    [cwd],
  );
  useEffect(
    () => subscribeTabGroupLabels(() => setLabels(loadTabGroupLabels())),
    [],
  );
  useEffect(() => {
    const updated = () => setRemoteRevision((value) => value + 1);
    window.addEventListener(REMOTE_HISTORY_UPDATED, updated);
    return () => window.removeEventListener(REMOTE_HISTORY_UPDATED, updated);
  }, []);
  useEffect(() => {
    if (
      !open ||
      props.recents !== undefined ||
      !treeViewportRef.current ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const node = treeViewportRef.current;
    const measure = () => {
      if (node.clientHeight) setTreeHeight(node.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, props.recents]);
  useEffect(() => {
    if (props.searchFocusToken && tab === "sessions" && open)
      searchInputRef.current?.focus();
  }, [props.searchFocusToken, tab, open]);
  useEffect(() => {
    if (tab !== "sessions") {
      setQuery("");
      setFilterMenu(null);
    }
  }, [tab]);
  useEffect(() => {
    if (!filterMenu) return;
    const node = treeScrollRef.current;
    const close = () => setFilterMenu(null);
    node?.addEventListener("scroll", close);
    return () => node?.removeEventListener("scroll", close);
  }, [filterMenu]);

  const expansionRequests = useRef(new Set<string>());
  useEffect(() => {
    if (!open || tab !== "sessions" || loadAllProjectSummaries) return;
    for (const project of projects) {
      const key = pathKey(project.path);
      if (
        !expandedPaths.has(key) ||
        loadedPaths.has(key) ||
        failedPaths.has(key) ||
        expansionRequests.current.has(key)
      )
        continue;
      // Remote sections own their polling lifecycle. Local loads are deduplicated by App.
      if (isRemoteProjectPath(project.path) || remoteProjectFor(project.path))
        continue;
      if (!props.onLoadProject) continue;
      expansionRequests.current.add(key);
      void props
        .onLoadProject(project.path)
        .catch(() => undefined)
        .finally(() => expansionRequests.current.delete(key));
    }
  }, [
    open,
    tab,
    loadAllProjectSummaries,
    expandedPathsKey,
    loadedPathsKey,
    projectPathsKey,
    props.onLoadProject,
  ]);

  // One queue shared across query changes keeps the actual number of requests
  // bounded, even when a user types another query while earlier reads finish.
  const searchRequests = useRef(new Set<string>());
  const searchInFlight = useRef(new Set<string>());
  const searchQueue = useRef<string[]>([]);
  const searchRunning = useRef(0);
  const searchContext = useRef({
    active: (searchActive && open) || loadAllProjectSummaries,
    onLoad: props.onLoadProject,
    onRemote: props.onPrefetchRemoteProject,
  });
  searchContext.current = {
    active: (searchActive && open) || loadAllProjectSummaries,
    onLoad: props.onLoadProject,
    onRemote: props.onPrefetchRemoteProject,
  };
  useEffect(() => {
    searchContext.current.active =
      (searchActive && open) || loadAllProjectSummaries;
    // Recent shortcuts need summaries even for projects that remain collapsed.
    // Share the bounded search loader rather than opening/polling every section.
    if ((!searchActive || !open) && !loadAllProjectSummaries) {
      searchQueue.current = [];
      searchRequests.current.clear();
      return;
    }
    searchQueue.current = projects.flatMap(({ path }) => {
      const key = pathKey(path);
      const remote = isRemoteProjectPath(path) || !!remoteProjectFor(path);
      if (
        (remote
          ? hasCachedRemoteProjectSessions(path)
          : loadedPaths.has(key)) ||
        searchRequests.current.has(key) ||
        searchInFlight.current.has(key)
      )
        return [];
      if (remote ? !props.onPrefetchRemoteProject : !props.onLoadProject)
        return [];
      return [path];
    });
    const pump = () => {
      while (
        searchContext.current.active &&
        searchRunning.current < 4 &&
        searchQueue.current.length
      ) {
        const path = searchQueue.current.shift()!;
        const key = pathKey(path);
        searchRequests.current.add(key);
        searchInFlight.current.add(key);
        searchRunning.current++;
        const loader =
          isRemoteProjectPath(path) || remoteProjectFor(path)
            ? searchContext.current.onRemote
            : searchContext.current.onLoad;
        void Promise.resolve()
          .then(() => loader?.(path))
          .then(() => {
            setSearchFailed((current) => {
              const next = new Set(current);
              next.delete(key);
              return next;
            });
          })
          .catch(() => setSearchFailed((current) => new Set(current).add(key)))
          .finally(() => {
            searchRunning.current--;
            searchInFlight.current.delete(key);
            setSearchRevision((value) => value + 1);
            pump();
          });
      }
    };
    pump();
    return () => {
      searchContext.current.active = false;
      searchQueue.current = [];
    };
  }, [
    open,
    searchActive,
    loadAllProjectSummaries,
    projectPathsKey,
    loadedPathsKey,
    searchRevision,
    props.onLoadProject,
    props.onPrefetchRemoteProject,
  ]);

  const historyByProject = useMemo(() => {
    const grouped = new Map<string, SessionSummary[]>();
    for (const row of projectHistory) {
      const key = pathKey(row.cwd);
      const mine = grouped.get(key) ?? [];
      mine.push(row);
      grouped.set(key, mine);
    }
    // Direct consumers supply only the current project's list.
    if (!props.projectHistory) grouped.set(pathKey(cwd), sessions);
    return grouped;
  }, [projectHistory, sessions, cwd, props.projectHistory]);
  // Grouped once per change: per-project filtering on every render compared
  // every open tab with every project and handed memoized sections new arrays.
  const openSessionsByProject = useMemo(() => {
    const grouped = new Map<string, SessionSummary[]>();
    for (const row of props.openSessions ?? []) {
      const key = pathKey(row.cwd);
      const mine = grouped.get(key) ?? [];
      mine.push(row);
      grouped.set(key, mine);
    }
    return grouped;
  }, [props.openSessions]);
  const projectOpenSessions = (path: string): readonly SessionSummary[] =>
    openSessionsByProject.get(pathKey(path)) ?? NO_SESSIONS;
  const projectSessionFlags = (
    flags: ReadonlySet<string> | undefined,
    path: string,
  ): Set<string> | undefined => {
    if (!flags || props.recents === undefined)
      return flags ? new Set(flags) : undefined;
    const localRows = [
      ...(historyByProject.get(pathKey(path)) ?? []),
      ...projectOpenSessions(path),
    ];
    const remote = isRemoteProjectPath(path) || !!remoteProjectFor(path);
    const scoped = new Set<string>();
    for (const row of localRows) {
      if (flags.has(row.id))
        scoped.add(remote ? (remoteSessionFor(row.id) ?? row.id) : row.id);
    }
    return scoped;
  };
  const hoverRequests = useRef(new Map<string, Promise<void>>());
  const [hoverRevision, setHoverRevision] = useState(0);
  const [hoverFailed, setHoverFailed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const hoverMounted = useRef(true);
  useEffect(() => {
    hoverMounted.current = true;
    return () => {
      hoverMounted.current = false;
    };
  }, []);
  const onProjectHoverOpen = useCallback(
    (path: string) => {
      const key = pathKey(path);
      if (hoverRequests.current.has(key)) return;
      // Recent shortcuts and expanded sections may already be loading this
      // history. Opening their summary should reuse that request.
      if (
        searchInFlight.current.has(key) ||
        expansionRequests.current.has(key)
      ) {
        setHoverRevision((value) => value + 1);
        return;
      }
      const remote = isRemoteProjectPath(path) || !!remoteProjectFor(path);
      // A known local list needs no extra read. Remote cards refresh once on
      // deliberate opening, through the same deduped cache used by pollers.
      if (!remote && loadedPaths.has(key) && !failedPaths.has(key)) return;
      const loader = remote
        ? props.onPrefetchRemoteProject
        : props.onLoadProject;
      if (!loader) return;
      setHoverFailed((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      const request = Promise.resolve()
        .then(() => loader(path))
        .then(() => {
          if (!hoverMounted.current) return;
          setSearchFailed((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
          });
        })
        .catch(() => {
          if (hoverMounted.current)
            setHoverFailed((current) => new Set(current).add(key));
        })
        .finally(() => {
          if (hoverRequests.current.get(key) !== request) return;
          hoverRequests.current.delete(key);
          if (hoverMounted.current) setHoverRevision((value) => value + 1);
        });
      hoverRequests.current.set(key, request);
      setHoverRevision((value) => value + 1);
    },
    [
      loadedPathsKey,
      failedPaths,
      props.onLoadProject,
      props.onPrefetchRemoteProject,
    ],
  );
  useEffect(() => {
    // A successful remote poll can recover an earlier one-shot hover failure.
    setHoverFailed((current) => {
      const next = new Set(current);
      for (const key of current) {
        if (!isRemoteProjectPath(key) && !remoteProjectFor(key)) continue;
        const state = cachedRemoteProjectSessionsState(key);
        if (state.loaded && !state.pending && !state.error && !state.offline)
          next.delete(key);
      }
      return next.size === current.size ? current : next;
    });
  }, [remoteRevision]);
  const projectSummaries = useMemo(() => {
    const summaries = new Map<string, ProjectHoverSummary>();
    for (const { path } of projects) {
      const key = pathKey(path);
      const remote = isRemoteProjectPath(path) || !!remoteProjectFor(path);
      const loader = remote
        ? props.onPrefetchRemoteProject
        : props.onLoadProject;
      const loaded = remote
        ? hasCachedRemoteProjectSessions(path)
        : loadedPaths.has(key);
      // Existing Sidebar consumers may have no history loader. Their unknown
      // projects still receive the basic card without an indefinite spinner.
      if (!loaded && !loader) continue;
      const remoteState = remote
        ? cachedRemoteProjectSessionsState(path)
        : undefined;
      const summary = projectHoverSummary({
        path,
        history: historyByProject.get(key) ?? [],
        openSessions: props.openSessions,
        openSessionIds: props.openSessionIds,
        unseenFinishedIds: projectSessionFlags(props.unseenFinishedIds, path),
        ...(remote
          ? {
              remoteSessions: cachedRemoteSessions(path),
              remoteSessionId: remoteSessionFor,
            }
          : {}),
        loaded,
        pending:
          hoverRequests.current.has(key) ||
          searchInFlight.current.has(key) ||
          expansionRequests.current.has(key) ||
          !!remoteState?.pending,
        failed:
          failedPaths.has(key) ||
          searchFailed.has(key) ||
          hoverFailed.has(key) ||
          !!remoteState?.error ||
          !!remoteState?.offline,
      });
      summaries.set(key, loader ? summary : { ...summary, canRetry: false });
    }
    return summaries;
  }, [
    projects,
    historyByProject,
    props.openSessions,
    props.openSessionIds,
    props.unseenFinishedIds,
    props.recents,
    loadedPathsKey,
    failedPaths,
    remoteRevision,
    searchFailed,
    searchRevision,
    hoverFailed,
    hoverRevision,
    props.onLoadProject,
    props.onPrefetchRemoteProject,
  ]);
  const matchInfo = useMemo(() => {
    const matched = new Set<string>();
    const names = new Set<string>();
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return { matched, names };
    for (const { path } of projects) {
      const key = pathKey(path);
      const label = resolveTabGroupLabel(
        projectKey(path),
        labels,
        basename(path),
      );
      const nameHit = [path, label].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      );
      if (nameHit) {
        names.add(key);
        matched.add(key);
        continue;
      }
      const remoteRows =
        isRemoteProjectPath(path) || remoteProjectFor(path)
          ? cachedRemoteSessions(path)
          : undefined;
      const rows: SessionSummary[] = remoteRows
        ? remoteRows.map((row) => ({
            ...row,
            cwd: path,
            model: row.model ?? "",
            providerSessionId: row.providerSessionId ?? undefined,
            runtimeMode: row.runtimeMode ?? "supervised",
            createdAt: row.createdAt ?? row.updatedAt,
          }))
        : (historyByProject.get(key) ?? []);
      const busy = remoteRows
        ? new Set(
            remoteRows
              .filter((row) => row.status === "running" && !row.needsInput)
              .map((row) => row.id),
          )
        : props.busySessionIds;
      const approvals = remoteRows
        ? new Set(
            remoteRows.filter((row) => row.needsInput).map((row) => row.id),
          )
        : props.approvalSessionIds;
      const filtered = filterSessionsByStatus(
        filterSessionsByTime(
          filterSessionsByHarness(
            filterSessionsByArchive(rows, filters.showArchived),
            filters.hiddenHarnesses,
          ),
          filters.time,
          Date.now(),
        ),
        filters.status,
        busy,
        approvals,
        projectSessionFlags(props.unseenFinishedIds, path) ?? new Set(),
      );
      if (
        filtered.some(
          (row) =>
            !row.orchestrationLeadId &&
            !row.workflowParentId &&
            sessionDisplayTitle(row.title, row.harness)
              .toLocaleLowerCase()
              .includes(needle),
        )
      )
        matched.add(key);
      if (failedPaths.has(key) || searchFailed.has(key)) matched.add(key);
    }
    return { matched, names };
  }, [
    query,
    projects,
    labels,
    historyByProject,
    remoteRevision,
    filters,
    props.busySessionIds,
    props.approvalSessionIds,
    props.unseenFinishedIds,
    props.openSessions,
    failedPaths,
    searchFailed,
  ]);
  const shownExpanded = useMemo(() => {
    if (!searchActive) return expandedPaths;
    const next = new Set(matchInfo.matched);
    if (searchCollapse.query === query)
      for (const key of searchCollapse.paths) next.delete(key);
    return next;
  }, [searchActive, expandedPaths, matchInfo.matched, searchCollapse, query]);
  const shownExpandedKey = [...shownExpanded].sort().join("\0");
  useEffect(() => {
    if (
      tab === "sessions" &&
      (!shownExpanded.has(pathKey(cwd)) ||
        (sessionProjectPath && !sameProjectPath(cwd, sessionProjectPath)))
    )
      props.onSessionNavigationOrder?.([]);
  }, [
    cwd,
    tab,
    shownExpandedKey,
    sessionProjectPath,
    props.onSessionNavigationOrder,
  ]);
  const summariesPending =
    open &&
    (searchActive || loadAllProjectSummaries) &&
    (searchRunning.current > 0 ||
      searchQueue.current.length > 0 ||
      projects.some(
        ({ path }) =>
          (isRemoteProjectPath(path) || remoteProjectFor(path)
            ? !hasCachedRemoteProjectSessions(path)
            : !loadedPaths.has(pathKey(path))) &&
          !searchRequests.current.has(pathKey(path)) &&
          !!(isRemoteProjectPath(path) || remoteProjectFor(path)
            ? props.onPrefetchRemoteProject
            : props.onLoadProject),
      ));
  const searchPending = searchActive && summariesPending;

  const expandProject = (path: string) => {
    const key = pathKey(path);
    if (searchActive) {
      setSearchCollapse((previous) => {
        if (previous.query !== query || !previous.paths.has(key)) return previous;
        const paths = new Set(previous.paths);
        paths.delete(key);
        return { query, paths };
      });
    }
    const next = new Set(expandedPaths);
    next.add(key);
    setExpandedPaths(next);
    saveProjectTreeExpanded(next);
  };
  const selectProject = (path: string) => {
    // A second click on an open project collapses it, like its disclosure.
    if (shownExpanded.has(pathKey(path))) {
      toggleProject(path);
      return;
    }
    if (searchActive) toggleProject(path);
    else expandProject(path);
    props.onSelectProject?.(path);
  };
  const toggleProject = (path: string) => {
    const key = pathKey(path);
    if (searchActive) {
      // Search opens matches by default; explicit folds belong only to this query.
      setSearchCollapse((previous) => {
        const paths = new Set(previous.query === query ? previous.paths : []);
        if (!paths.delete(key)) paths.add(key);
        return { query, paths };
      });
      return;
    }
    const next = new Set(expandedPaths);
    if (!next.delete(key)) next.add(key);
    setExpandedPaths(next);
    saveProjectTreeExpanded(next);
  };
  const newInProject = (path: string) => {
    expandProject(path);
    return onNewInProject
      ? onNewInProject(path)
      : sameProjectPath(path, cwd)
        ? props.onNew?.()
        : undefined;
  };

  const remoteCurrent = isRemoteProjectPath(cwd) || !!remoteProjectFor(cwd);
  const hostProject = remoteCurrent ? remoteProjectFor(cwd) : undefined;
  const activeRemoteId = props.activeSessionId
    ? remoteSessionFor(props.activeSessionId)
    : undefined;
  const remoteExecutionCwd =
    cachedRemoteSessions(cwd).find((row) => row.id === activeRemoteId)?.cwd ??
    (props.activeSessionId
      ? remotePendingWorktree(props.activeSessionId)
      : undefined) ??
    (remoteCurrent && props.gitCwd && props.gitCwd !== cwd
      ? (parseRemotePath(props.gitCwd)?.hostPath ?? props.gitCwd)
      : undefined);
  const gitRoot =
    remoteCurrent && hostProject && !hostProject.local
      ? remotePath(
          hostProject.environmentId,
          remoteExecutionCwd ?? hostProject.cwd,
        )
      : props.gitCwd || cwd;
  const changes = useProjectDiffStats(gitRoot, open);
  const additions = changes?.additions ?? 0;
  const deletions = changes?.deletions ?? 0;
  const gitStatuses = useGitFileStatuses(gitRoot, open && tab === "files");
  const workingCopyHeight = Math.min(420, treeHeight * 0.6);
  const busyPaths = projects
    .filter(
      ({ path }) =>
        (historyByProject.get(pathKey(path)) ?? []).some((row) =>
          props.busySessionIds.has(row.id),
        ) ||
        cachedRemoteSessions(path).some(
          (row) => row.status === "running" && !row.needsInput,
        ),
    )
    .map(({ path }) => path);
  const approvalPaths = projects
    .filter(
      ({ path }) =>
        (historyByProject.get(pathKey(path)) ?? []).some((row) =>
          props.approvalSessionIds.has(row.id),
        ) || cachedRemoteSessions(path).some((row) => row.needsInput),
    )
    .map(({ path }) => path);

  const renderWorkingCopy = (): ReactNode => {
    if (props.recents !== undefined && (!cwd || cwd === "~"))
      return (
        <p className="px-3 py-2 text-[12px] text-content/50">
          {t("Choose project")}
        </p>
      );
    return (
      <div
        data-project-working-copy
        className={`flex min-h-0 flex-1 flex-col ${tab === "changes" ? "overflow-y-auto" : "overflow-hidden"}`}
        style={
          props.recents === undefined
            ? { height: workingCopyHeight, maxHeight: workingCopyHeight }
            : undefined
        }
      >
        {tab === "files" ? (
          props.filesSearchOpen ? (
            <ProjectSearch
              cwd={gitRoot}
              focusToken={props.searchFocusToken}
              onOpenFile={props.onOpenFile}
              onClose={() => props.onFilesSearchOpenChange(false)}
            />
          ) : (
            <FileTree
              key={gitRoot}
              cwd={gitRoot}
              rootLabel={props.explorerRootLabel}
              onOpenFile={props.onOpenFile}
              onOpenTerminal={
                isRemoteProjectPath(cwd) ? undefined : props.onOpenTerminal
              }
              onFileMoved={props.onFileMoved}
              onFileDeleted={props.onFileDeleted}
              onSearch={props.onOpenFilesSearch}
              gitStatuses={gitStatuses}
            />
          )
        ) : (
          <div
            data-project-changes-content
            className={`flex min-h-[480px] shrink-0 flex-col ${props.recents !== undefined ? "flex-1" : ""}`}
            style={
              props.recents === undefined
                ? { height: Math.max(480, workingCopyHeight) }
                : undefined
            }
          >
            <SourceControl
              cwd={gitRoot}
              enabled={open}
              textHarness={props.textHarness}
              selectedPath={props.selectedDiffPath}
              selectedKind={props.selectedDiffKind}
              selectedSha={props.selectedCommitSha}
              onOpenFile={
                props.onOpenDiff ??
                ((file) => props.onOpenFile(file, undefined, { exact: true }))
              }
              onOpenAllChanges={props.onOpenAllChanges ?? (() => {})}
              onOpenCommit={props.onOpenCommit ?? (() => {})}
            />
          </div>
        )}
      </div>
    );
  };

  const renderChildren = (path: string, shortcutId?: string): ReactNode => {
    const current = sameProjectPath(path, cwd);
    const key = pathKey(path);
    const remote = isRemoteProjectPath(path) || !!remoteProjectFor(path);
    const openSession = (
      id: string,
      _project?: string,
      opts?: { newColumn?: boolean },
    ) =>
      opts
        ? props.onSelectSession(
            id,
            props.recents === undefined ? undefined : path,
            opts,
          )
        : props.recents === undefined
          ? props.onSelectSession(id)
          : props.onSelectSession(id, path);
    return (
      <Fragment key={key}>
      <ProjectSessionSection
        {...props}
        key={key}
        cwd={path}
        shortcutId={shortcutId}
        flatPins={props.recents !== undefined}
        sessions={historyByProject.get(key) ?? []}
        openSessions={props.openSessions && projectOpenSessions(path)}
        activeSessionId={current ? props.activeSessionId : undefined}
        activeProject={current}
        reminders={
          props.recents === undefined
            ? props.reminders
            : props.reminders?.filter((reminder) =>
                sameProjectPath(reminder.cwd, path),
              )
        }
        unseenFinishedIds={projectSessionFlags(props.unseenFinishedIds, path)}
        linkedSessionUpdateIds={projectSessionFlags(
          props.linkedSessionUpdateIds,
          path,
        )}
        complete={remote || loadedPaths.has(key)}
        pending={
          !remote &&
          !loadedPaths.has(key) &&
          !failedPaths.has(key) &&
          !searchFailed.has(key)
        }
        status={
          failedPaths.has(key) || searchFailed.has(key) ? "error" : "idle"
        }
        searchQuery={matchInfo.names.has(key) ? "" : query}
        searchActive={searchActive}
        sessionFilters={filters}
        scrollRef={treeScrollRef}
        onClearQuery={() => setQuery("")}
        dense={props.recents !== undefined}
        pollRemote={!shortcutId && open && expandedPaths.has(key)}
        onRetry={() => {
          setSearchFailed((previous) => {
            const next = new Set(previous);
            next.delete(key);
            return next;
          });
          void (
            remote
              ? props.onPrefetchRemoteProject?.(path)
              : props.onLoadProject?.(path)
          )?.catch(() =>
            setSearchFailed((current) => new Set(current).add(key)),
          );
        }}
        onNew={() => newInProject(path)}
        onSelectSession={openSession}
      />
      {shortcutId || remote || searchActive ? null : (
        <ExternalSessions projectPath={path} onOpen={openSession} />
      )}
      </Fragment>
    );
  };

  const shortcutSessions =
    props.recents === undefined
      ? []
      : projects
          .flatMap(({ path }) => {
            const remoteRows =
              isRemoteProjectPath(path) || remoteProjectFor(path)
                ? cachedRemoteSessions(path)
                : undefined;
            const storedRows: SessionSummary[] = remoteRows
              ? remoteRows.map((row) => ({
                  ...row,
                  cwd: path,
                  model: row.model ?? "",
                  providerSessionId: row.providerSessionId ?? undefined,
                  runtimeMode: row.runtimeMode ?? "supervised",
                  createdAt: row.createdAt ?? row.updatedAt,
                }))
              : (historyByProject.get(pathKey(path)) ?? []);
            const liveRows = projectOpenSessions(path)
              .map((row) =>
                remoteRows
                  ? { ...row, id: remoteSessionFor(row.id) ?? row.id }
                  : row,
              );
            const rows = mergeLiveSessionSummaries(storedRows, liveRows);
            const busy = remoteRows
              ? new Set(
                  remoteRows
                    .filter(
                      (row) => row.status === "running" && !row.needsInput,
                    )
                    .map((row) => row.id),
                )
              : props.busySessionIds;
            const approvals = remoteRows
              ? new Set(
                  remoteRows
                    .filter((row) => row.needsInput)
                    .map((row) => row.id),
                )
              : props.approvalSessionIds;
            const filtered = filterSessionsByStatus(
              filterSessionsByTime(
                filterSessionsByHarness(
                  filterSessionsByArchive(rows, filters.showArchived),
                  filters.hiddenHarnesses,
                ),
                filters.time,
                Date.now(),
              ),
              filters.status,
              busy,
              approvals,
              projectSessionFlags(props.unseenFinishedIds, path) ?? new Set(),
            );
            const needle = query.trim().toLocaleLowerCase();
            return filtered.filter(
              (row) =>
                !row.orchestrationLeadId &&
                !row.workflowParentId &&
                (!needle ||
                  matchInfo.names.has(pathKey(path)) ||
                  sessionDisplayTitle(row.title, row.harness)
                    .toLocaleLowerCase()
                    .includes(needle)),
            );
          })
          .sort(compareSessionSummaries);
  const pinnedSessions = shortcutSessions.filter((session) => session.pinned);
  const recentSessions = [...shortcutSessions].sort(
    (a, b) =>
      b.updatedAt - a.updatedAt ||
      pathKey(a.cwd).localeCompare(pathKey(b.cwd)) ||
      a.id.localeCompare(b.id),
  );

  const filterSummaries: SessionSummary[] = [...projectHistory];
  for (const { path } of projects) {
    if (!isRemoteProjectPath(path) && !remoteProjectFor(path)) continue;
    for (const row of cachedRemoteSessions(path))
      filterSummaries.push({
        ...row,
        cwd: path,
        model: row.model ?? "",
        providerSessionId: row.providerSessionId ?? undefined,
        runtimeMode: row.runtimeMode ?? "supervised",
        createdAt: row.createdAt ?? row.updatedAt,
      });
  }
  const filtersActive = hasActiveSessionFilters(filters);
  const onFilter = (event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget;
    setFilterMenu((current) => (current ? null : trigger));
  };
  const projectHeader = props.recents !== undefined;
  const showWorktreeSwitcher =
    cwd && cwd !== "~" && !remoteCurrent && props.onSelectWorkspace;
  const renderWorktreeSwitcher = (compact = false) => (
    <SidebarWorktreeSwitcher
      key={compact ? cwd : undefined}
      cwd={cwd}
      compact={compact}
      tabStats={props.worktreeTabStats}
      onSelect={props.onSelectWorkspace}
      pending={props.workspaceSwitchPending}
      switchError={props.workspaceSwitchError}
    />
  );
  return (
    <SidebarTransition
      open={open}
      width={resize.width}
      dragging={resize.dragging}
      setPaneRef={resize.setPaneRef}
      finishDrag={resize.finishDrag}
      resizeHandle={
        <ResizeHandle
          edge="right"
          dragging={resize.dragging}
          aria-label={t("Resize sidebar")}
          aria-valuenow={resize.width}
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          onPointerDown={resize.onPointerDown}
          onDoubleClick={resize.onDoubleClick}
        />
      }
    >
      <aside
        className="sidebar-glass relative flex h-full min-h-0 shrink-0 flex-col"
        style={{ width: resize.dragging ? "100%" : resize.width }}
      >
        {props.navigation}
        {!props.chromeInMenuBar ? (
          <div
            className="flex h-10 shrink-0 select-none items-center pr-2"
            data-tauri-drag-region="deep"
          >
            <WindowNavigationSpace />
            <div className="min-w-0 flex-1" />
            {props.onToggleSidebar ? (
              <IconButton label={toggleLabel} onClick={props.onToggleSidebar}>
                <PanelLeft className="size-3.5" />
              </IconButton>
            ) : null}
          </div>
        ) : null}
        <div
          data-project-header
          className={`flex h-8 min-w-0 shrink-0 items-center gap-1 ${projectHeader ? "pl-1.5" : "pl-3"} pr-2`}
        >
          {projectHeader ? (
            <div
              data-project-switcher
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <SearchableProjectPicker
                key={tab === "sessions" ? "session-scope" : "working-copy"}
                cwd={tab === "sessions" ? (sessionProjectPath ?? "") : cwd}
                railCwd={cwd}
                recents={recents}
                appearance="ghost"
                compact
                showLabel
                className="min-w-0 flex-1"
                buttonClassName="max-w-full"
                onSelectProject={(path) => {
                  if (tab === "sessions") {
                    setSessionProjectPath(path);
                    expandProject(path);
                  }
                  props.onSelectProject?.(path);
                }}
                onSelectAllProjects={
                  tab === "sessions"
                    ? () => setSessionProjectPath(null)
                    : undefined
                }
                onOpenProject={props.onOpenProject}
              />
              {showWorktreeSwitcher &&
              (tab !== "sessions" ||
                (sessionProjectPath &&
                  sameProjectPath(sessionProjectPath, cwd))) ? (
                <div
                  data-active-worktree-toolbar
                  className="flex min-w-0 max-w-[50%] items-center"
                >
                  {renderWorktreeSwitcher(true)}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {t("Projects")}
            </span>
          )}
          {props.onGoToFile ? (
            <IconButton label={quickOpenLabel} onClick={props.onGoToFile}>
              <Search className="size-3.5" />
            </IconButton>
          ) : null}
          {props.onOpenProject ? (
            <AddProjectButton onOpenFolder={props.onOpenProject} />
          ) : null}
        </div>
        <SidebarTabs
          key={pathKey(cwd)}
          tab={tab}
          onTabChange={props.onTabChange}
          additions={additions}
          deletions={deletions}
          filesLabel={props.recents !== undefined ? t("Files") : undefined}
          resizing={resize.dragging}
        />
        {tab === "sessions" ? (
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-stroke px-2">
            <div className="relative flex h-7 min-w-0 flex-1 items-center">
              <Search className="pointer-events-none absolute left-2 size-3 shrink-0 opacity-50" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                placeholder={t(
                  props.recents === undefined || sessionProjectPath
                    ? "Search conversations..."
                    : "Search projects and conversations...",
                )}
                aria-label={t(
                  props.recents === undefined || sessionProjectPath
                    ? "Search conversations"
                    : "Search projects and conversations",
                )}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setQuery("");
                  }
                }}
                className="h-full w-full min-w-0 rounded-md bg-transparent py-0 pl-7 pr-2 text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </div>
            <button
              type="button"
              title={t("Filter sessions")}
              aria-label={t("Filter sessions")}
              aria-haspopup="menu"
              aria-expanded={!!filterMenu}
              onClick={onFilter}
              className={`relative z-50 grid size-6 place-items-center rounded-md text-content/50 hover:bg-content/10 hover:text-content ${filterMenu || filtersActive ? "bg-selection text-content" : ""}`}
            >
              <ListFilter className="size-3" />
            </button>
          </div>
        ) : null}
        {!projectHeader && showWorktreeSwitcher ? (
          <div
            data-active-worktree-toolbar
            className="flex h-8 shrink-0 items-center px-3"
          >
            {renderWorktreeSwitcher()}
            <ChevronDown className="ml-auto size-3 opacity-30" />
          </div>
        ) : null}
        {searchPending ? (
          <p
            role="status"
            className="shrink-0 px-3 py-1 text-[11px] text-content/50"
          >
            {t("Searching projects…")}
          </p>
        ) : null}
        {searchActive && !searchPending && matchInfo.matched.size === 0 ? (
          <p className="px-3 py-2 text-[12px] text-content/50">
            {t("No matching sessions")}
          </p>
        ) : null}
        <div
          ref={treeViewportRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {tab !== "sessions" && props.recents !== undefined ? (
            renderWorkingCopy()
          ) : (
            <ProjectList
              cwd={cwd}
              recents={recents}
              busyPaths={busyPaths}
              needsApprovalPaths={approvalPaths}
              projectSummaries={projectSummaries}
              pinnedEntries={tab === "sessions" ? pinnedSessions.map((session) => ({
                id: JSON.stringify([pathKey(session.cwd), session.id]),
                content: () => renderChildren(session.cwd, session.id),
              })) : undefined}
              recentEntries={
                props.recents !== undefined && tab === "sessions"
                  ? recentSessions.map((session) => ({
                      id: `${pathKey(session.cwd)}:${session.id}`,
                      content: () => renderChildren(session.cwd, session.id),
                    }))
                  : undefined
              }
              recentPending={summariesPending}
              workflowsSection={tab === "sessions" ? props.workflowsSection : undefined}
              onProjectHoverOpen={
                props.onLoadProject || props.onPrefetchRemoteProject
                  ? onProjectHoverOpen
                  : undefined
              }
              expandedPaths={shownExpanded}
              onToggleProject={toggleProject}
              onActivateProject={props.onSelectProject}
              renderProjectChildren={
                tab === "sessions" ? renderChildren : renderWorkingCopy
              }
              onNewInProject={
                onNewInProject || props.onNew ? newInProject : undefined
              }
              onSelectProject={selectProject}
              onOpenProject={props.onOpenProject ?? (() => {})}
              onRemoveProject={props.onRemoveProject}
              onOpenNotificationSettings={props.onOpenNotificationSettings}
              statsEnabled={false}
              searchActive={searchActive || !!sessionProjectPath}
              matchedProjectPaths={
                searchActive
                  ? matchInfo.matched
                  : sessionProjectPath
                    ? new Set(projects.map(({ path }) => pathKey(path)))
                    : undefined
              }
              scrollRef={(node) => {
                treeScrollRef.current = node;
                treeLock(node);
              }}
            />
          )}
        </div>
        {props.footer}
        {filterMenu ? (
          <SessionFiltersMenu
            anchor={filterMenu}
            harnesses={harnessesInSessions(filterSummaries)}
            filters={filters}
            onChange={(next: SessionSidebarFilters) => {
              setFilters(next);
              saveSessionSidebarFilters(next);
            }}
            onClose={() => setFilterMenu(null)}
          />
        ) : null}
      </aside>
    </SidebarTransition>
  );
}

export const Sidebar = memo(SidebarComponent);
