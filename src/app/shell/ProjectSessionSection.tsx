import { useSidebarListPreview } from "./useSidebarListPreview";
import { AnimatedCollapse } from "../../shared/ui/AnimatedCollapse";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { NO_BRANCH_LABEL } from "../../features/source-control/model/worktrees";
import {
  inWorktreeFocus,
  useWorktreeFocus,
} from "../../features/source-control/model/worktreeFocus";
import { OrchestrationSidebarAgents } from "../../features/orchestration/ui/OrchestrationSidebarAgents";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Clock,
  Folder,
  GitBranch,
  GitPullRequest,
  Pin,
  Share,
  Zap,
} from "../../shared/ui/icons";
import {
  Fragment,
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { MOD } from "../../platform/tauri/platform";
import { copyText } from "../../platform/tauri/clipboard";
import { resolveModel } from "../../features/sessions/model/models";
import {
  HARNESS_TITLE,
  sessionDisplayTitle,
} from "../../features/sessions/model/session";
import { ParticleText } from "../../shared/ui/ParticleText";
import { nextUnseenFinishedSessions } from "../../features/sessions/model/sessionDone";
import { orchestrationTaskLabel } from "../../features/orchestration/model/orchestrationSummary";
import {
  orderedSessionActionIds,
  pruneSessionSelection,
  toggleSessionSelection,
} from "../../features/sessions/model/sessionSelection";
import {
  paneDropFromPoint,
  setExternalPaneDrop,
} from "../../features/workspace/model/paneDrop";
import type { PaneEdge } from "../../features/workspace/model/layout";
import { suppressTextSelection } from "../../shared/lib/drag";
import {
  compareSessionSummaries,
  filterSessionsByArchive,
} from "../../features/sessions/data/sessionHistory";
import {
  buildSessionList,
  loadPinnedSessionsCollapsed,
  loadReminderSessionsCollapsed,
  savePinnedSessionsCollapsed,
  saveReminderSessionsCollapsed,
  sessionListNavigationIds,
  type SessionListEntry,
} from "../../features/sessions/model/sessionFolders";
import { LIST_PAGE_SIZE, listWindowSize } from "../../shared/lib/listWindow";
import {
  filterSessionsByHarness,
  filterSessionsByStatus,
  filterSessionsByTime,
  hasActiveSessionFilters,
  type SessionSidebarFilters,
} from "../../features/sessions/model/sessionFilters";
import type { LinkedWorkItem } from "../../features/sessions/model/session";
import type { SessionSummary } from "../../features/sessions/data/sessionStore";
import { isRemoteProjectPath } from "../../features/projects/model/recents";
import {
  ExplorerMenu,
  type ExplorerMenuItem,
} from "../../features/files/ui/ExplorerMenu";
import { HarnessIcon } from "../../features/sessions/ui/HarnessIcon";
import { prefetchGithubWorkItem } from "../../features/inbox/model/githubTasks";
import { TerminalSpinner } from "../../features/sessions/ui/TerminalSpinner";
import { Popover } from "../../shared/ui/Popover";
import {
  HoverSummary,
  HoverSummaryRow,
  useHoverSummary,
} from "../../shared/ui/HoverSummary";
import { LinkSessionWorkItemDialog } from "../../features/sessions/ui/LinkSessionWorkItemDialog";
import { sessionReminderPresets } from "../../features/sessions/ui/sessionReminderPresets";
import {
  formatReminderTime,
  reminderTime,
} from "../../features/sessions/model/sessionReminders";
import { SessionsEmpty } from "../../features/sessions/ui/SessionsEmpty";
import {
  refreshRemoteProjectSessions,
  remoteRequest,
  remoteSessionFor,
  useRemoteProjectSessions,
} from "../../features/connections/model/connections";
import { remoteProjectFor } from "../../features/connections/model/remoteProjects";

import type { SidebarProps } from "./Sidebar.types";
import { sameProjectPath } from "../../features/projects/model/recents";
import { pathKey } from "../../shared/lib/paths";

type ProjectSessionSectionProps = SidebarProps & {
  searchQuery: string;
  shortcutId?: string;
  flatPins?: boolean;
  searchActive?: boolean;
  pollRemote?: boolean;
  sessionFilters: SessionSidebarFilters;
  complete: boolean;
  activeProject?: boolean;
  dense?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onRetry?: () => void;
  onClearQuery?: () => void;
};
const REMINDERS_COLOR = "#f59e0b";
const PROJECT_SESSION_SELECTION = "monocode:project-session-selection";

/** Initial preview and each "Show more" step in a project tree. */
const TREE_PREVIEW_COUNT = 5;

function ProjectSessionSectionComponent({
  cwd,
  sessions,
  busySessionIds,
  approvalSessionIds,
  activeSessionId,
  openSessions = [],
  status,
  pending,
  onSelectSession: onSelectLocalSession,
  onSelectRemoteSession,
  onRemoteSessionDeleted,
  onSessionNavigationOrder,
  onPrefetchSession: onPrefetchLocalSession,
  onPlaceSessionOnPane: onPlaceLocalSessionOnPane,
  onRenameSession: onRenameLocalSession,
  onArchiveSession: onArchiveLocalSession,
  onArchiveSessions: onArchiveLocalSessions,
  onPinSession: onPinLocalSession,
  onPinSessions: onPinLocalSessions,
  onSetSessionLinkedWorkItem: onSetLocalSessionLinkedWorkItem,
  reminders = [],
  onSetReminders,
  onCancelReminders,
  onDeleteSession: onDeleteLocalSession,
  onDeleteSessions: onDeleteLocalSessions,
  tab,
  onOpenInboxItem,
  unseenFinishedIds: unseenFinishedIdsProp,
  linkedSessionUpdateIds = new Set(),
  searchQuery,
  searchActive = false,
  pollRemote = true,
  sessionFilters,
  activeProject = true,
  dense = true,
  shortcutId,
  flatPins = false,
  scrollRef,
  onRetry,
}: ProjectSessionSectionProps) {
  const { t: uiT } = useTranslation();
  const remoteProject = isRemoteProjectPath(cwd) || !!remoteProjectFor(cwd);
  const remote = useRemoteProjectSessions(cwd, remoteProject && pollRemote);
  const hostProject = remoteProject ? remoteProjectFor(cwd) : undefined;
  const remoteChange = async (
    sessionId: string,
    patch: {
      title?: string;
      archived?: boolean;
      pinned?: boolean;
      linkedWorkItem?: LinkedWorkItem | null;
    },
  ) => {
    if (!remote.machine || !hostProject) {
      window.alert("Connect this project's machine to change its sessions.");
      return;
    }
    try {
      await remoteRequest(remote.machine.id, "sessions.update", {
        projectId: hostProject.projectId,
        sessionId,
        ...patch,
      });
      refreshRemoteProjectSessions();
    } catch (error) {
      window.alert(`Could not update this session.\n\n${String(error)}`);
    }
  };
  const remoteDelete = async (sessionIds: readonly string[]) => {
    if (sessionIds.length === 0) return;
    if (!remote.machine || !hostProject) {
      window.alert("Connect this project's machine to delete its sessions.");
      return;
    }
    if (
      !window.confirm(
        `Delete ${sessionIds.length === 1 ? "this conversation" : `${sessionIds.length} conversations`}? This can’t be undone.`,
      )
    )
      return;
    try {
      for (const sessionId of sessionIds) {
        await remoteRequest(remote.machine.id, "sessions.delete", {
          projectId: hostProject.projectId,
          sessionId,
        });
        onRemoteSessionDeleted?.(sessionId, cwd);
      }
      refreshRemoteProjectSessions();
    } catch (error) {
      window.alert(`Could not delete this session.\n\n${String(error)}`);
      refreshRemoteProjectSessions();
    }
  };
  const onSelectSession = remoteProject
    ? (sessionId: string) =>
        (hostProject?.local &&
          remote.sessions.find((row) => row.id === sessionId)?.nativeSession) ||
        openSessions.some(
          (row) => row.id === sessionId && sameProjectPath(row.cwd, cwd),
        )
          ? onSelectLocalSession?.(sessionId)
          : onSelectRemoteSession?.(cwd, sessionId)
    : onSelectLocalSession;
  const onPrefetchSession = remoteProject ? undefined : onPrefetchLocalSession;
  const onPlaceSessionOnPane = remoteProject
    ? undefined
    : onPlaceLocalSessionOnPane;
  const onRenameSession = remoteProject
    ? (sessionId: string, title: string) => {
        void remoteChange(sessionId, { title });
      }
    : onRenameLocalSession;
  const onArchiveSession = remoteProject
    ? (sessionId: string, archived: boolean) => {
        void remoteChange(sessionId, { archived });
      }
    : onArchiveLocalSession;
  const onArchiveSessions = remoteProject
    ? (sessionIds: readonly string[], archived: boolean) => {
        void Promise.all(
          sessionIds.map((id) => remoteChange(id, { archived })),
        );
      }
    : onArchiveLocalSessions;
  const onPinSession = remoteProject
    ? (sessionId: string, pinned: boolean) => {
        void remoteChange(sessionId, { pinned });
      }
    : onPinLocalSession;
  const onPinSessions = remoteProject
    ? (sessionIds: readonly string[], pinned: boolean) => {
        void Promise.all(sessionIds.map((id) => remoteChange(id, { pinned })));
      }
    : onPinLocalSessions;
  const onDeleteSession = remoteProject
    ? (sessionId: string) => {
        void remoteDelete([sessionId]);
      }
    : onDeleteLocalSession;
  const onDeleteSessions = remoteProject
    ? (sessionIds: readonly string[]) => {
        void remoteDelete(sessionIds);
      }
    : onDeleteLocalSessions;
  const onSetSessionLinkedWorkItem = remoteProject
    ? (sessionId: string, item: LinkedWorkItem | undefined) => {
        void remoteChange(sessionId, { linkedWorkItem: item ?? null });
      }
    : onSetLocalSessionLinkedWorkItem;
  const activeRemoteId = activeSessionId
    ? (remoteSessionFor(activeSessionId) ??
      (remote.sessions.some(
        (session) => session.id === activeSessionId && session.nativeSession,
      )
        ? activeSessionId
        : undefined))
    : undefined;
  const activeListedSessionId = remoteProject
    ? activeRemoteId
    : activeSessionId;
  const listedBusySessionIds = remoteProject
    ? new Set(
        remote.sessions
          .filter(
            (session) => session.status === "running" && !session.needsInput,
          )
          .map((session) => session.id),
      )
    : busySessionIds;
  const listedApprovalSessionIds = remoteProject
    ? new Set(
        remote.sessions
          .filter((session) => session.needsInput)
          .map((session) => session.id),
      )
    : approvalSessionIds;
  const projectSessions: SessionSummary[] = useMemo(
    () =>
      remoteProject
        ? remote.sessions.map((session) => ({
            id: session.id,
            cwd,
            harness: session.harness,
            model: session.model ?? "",
            runtimeMode: session.runtimeMode ?? "supervised",
            providerSessionId: session.providerSessionId ?? undefined,
            title: session.title,
            createdAt: session.createdAt ?? session.updatedAt,
            updatedAt: session.updatedAt,
            archived: session.archived,
            pinned: session.pinned,
            linkedWorkItem: session.linkedWorkItem,
            draft: session.draft,
            repo: session.repo,
            branch: session.branch,
            worktreeCwd: session.worktreeCwd,
            nativeSession: session.nativeSession,
          }))
        : sessions,
    [remoteProject, remote.sessions, sessions, cwd],
  );
  const [now, setNow] = useState(() => Date.now());
  const sectionRef = useRef<HTMLDivElement>(null);
  const localScrollRef = useRef<HTMLDivElement>(null);
  const sessionsScrollRef = scrollRef ?? localScrollRef;
  const [sessionMenu, setSessionMenu] = useState<{
    x: number;
    y: number;
    sessionId: string;
  } | null>(null);
  const [linkingSession, setLinkingSession] = useState<SessionSummary | null>(
    null,
  );
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const contextSelectionRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [pinnedSessionsCollapsed, setPinnedSessionsCollapsed] = useState(() =>
    loadPinnedSessionsCollapsed(cwd),
  );
  const [reminderSessionsCollapsed, setReminderSessionsCollapsed] = useState(
    () => loadReminderSessionsCollapsed(cwd),
  );
  const [sessionListLimit, setSessionListLimit] = useState(LIST_PAGE_SIZE);
  const [treeSessionLimit, setTreeSessionLimit] = useState(TREE_PREVIEW_COUNT);
  const treeSessionWindow = useRef({ key: "", count: 0 });
  const loadMoreRef = useRef<HTMLLIElement>(null);
  const busyIdsRef = useRef(busySessionIds);
  const focusedSessionIdRef = useRef(activeSessionId);
  const unseenFinishedLocalRef = useRef<Set<string>>(new Set());
  if (
    busyIdsRef.current !== busySessionIds ||
    focusedSessionIdRef.current !== activeSessionId
  ) {
    unseenFinishedLocalRef.current = nextUnseenFinishedSessions({
      previousBusyIds: busyIdsRef.current,
      busyIds: busySessionIds,
      previousUnseenIds: unseenFinishedLocalRef.current,
      focusedSessionId: activeSessionId,
    });
    busyIdsRef.current = busySessionIds;
    focusedSessionIdRef.current = activeSessionId;
  }
  const unseenFinishedIds =
    unseenFinishedIdsProp ?? unseenFinishedLocalRef.current;
  // Revisits render straight from cache, so this is only ever true the first
  // time a project is opened.
  const pendingFirstLoad = remoteProject
    ? remote.pending && projectSessions.length === 0
    : pending && status !== "error" && sessions.length === 0;
  const worktreeFocus = useWorktreeFocus(cwd);
  const focusedWorktree = remoteProject ? undefined : worktreeFocus;
  const projectOpenSessions = openSessions.filter((session) =>
    sameProjectPath(session.cwd, cwd),
  );
  const listedOpenSessions = remoteProject
    ? projectOpenSessions.map((session) => {
        const hostId = remoteSessionFor(session.id);
        return hostId ? { ...session, id: hostId } : session;
      })
    : projectOpenSessions;
  const knownSessionIds = new Set(projectSessions.map((session) => session.id));
  const listedSessions = [
    ...projectSessions,
    ...listedOpenSessions.filter((session) => !knownSessionIds.has(session.id)),
  ].filter(
    (session) =>
      !session.orchestrationLeadId &&
      (shortcutId || searchActive || inWorktreeFocus(session, focusedWorktree)),
  );
  const visibleSessions = [
    ...filterSessionsByStatus(
      filterSessionsByTime(
        filterSessionsByHarness(
          filterSessionsByArchive(listedSessions, sessionFilters.showArchived),
          sessionFilters.hiddenHarnesses,
        ),
        sessionFilters.time,
        now,
      ),
      sessionFilters.status,
      listedBusySessionIds,
      listedApprovalSessionIds,
      unseenFinishedIds,
    ).filter(
      (session) =>
        !searchQuery.trim() ||
        sessionDisplayTitle(session.title, session.harness)
          .toLocaleLowerCase()
          .includes(searchQuery.trim().toLocaleLowerCase()),
    ),
  ].filter((session) => !shortcutId || session.id === shortcutId).sort(compareSessionSummaries);
  const filtersActive = hasActiveSessionFilters(sessionFilters);
  const searchNarrowed = searchActive || Boolean(searchQuery.trim());
  // Summaries for the whole project stay in `sessions` so filters still work.
  // Every group has its own five-row preview; search keeps its larger window.
  const reminderIds = new Set(reminders.map((reminder) => reminder.sessionId));
  const reminderGroup = {
    sessionIds: [...reminders]
      .sort((a, b) => a.dueAt - b.dueAt)
      .map((reminder) => reminder.sessionId),
    collapsed: reminderSessionsCollapsed,
  };
  const allUngrouped = visibleSessions.filter(
    (session) => !reminderIds.has(session.id),
  );
  const ungroupedVisible = flatPins
    ? allUngrouped
    : allUngrouped.filter((session) => !session.pinned);
  const activeUngroupedIndex = ungroupedVisible.findIndex(
    (session) => session.id === activeListedSessionId,
  );
  // Reveal five more chats per click, keeping other projects in view.
  const treePreview = !searchNarrowed;
  const previewUngroupedCount = listWindowSize(
    ungroupedVisible.length,
    TREE_PREVIEW_COUNT,
    -1,
    TREE_PREVIEW_COUNT,
  );
  const shownUngroupedCount = treePreview
    ? listWindowSize(
        ungroupedVisible.length,
        treeSessionLimit,
        -1,
        TREE_PREVIEW_COUNT,
      )
    : listWindowSize(
        ungroupedVisible.length,
        sessionListLimit,
        activeUngroupedIndex,
      );
  const shownUngrouped = ungroupedVisible.slice(0, shownUngroupedCount);
  const shownUngroupedIds = new Set(
    shownUngrouped.map((session) => session.id),
  );
  const sessionListKey = `${cwd}\0${searchActive}\0${sessionFilters.showArchived}\0${sessionFilters.time}\0${sessionFilters.hiddenHarnesses.join(",")}\0${sessionFilters.status.working}\0${sessionFilters.status.needsApproval}\0${sessionFilters.status.done}\0${searchQuery}`;
  if (treeSessionWindow.current.key !== sessionListKey)
    treeSessionWindow.current = { key: sessionListKey, count: 0 };
  // Keep revealed rows available for closing motion and prepare the next five
  // collapsed rows so their shared disclosure animates when they open.
  treeSessionWindow.current.count = treePreview
    ? Math.min(
        ungroupedVisible.length,
        Math.max(
          treeSessionWindow.current.count,
          shownUngroupedCount + TREE_PREVIEW_COUNT,
        ),
      )
    : 0;
  const mountedUngrouped = treePreview
    ? ungroupedVisible.slice(0, treeSessionWindow.current.count)
    : shownUngrouped;
  const fullSessionListEntries = buildSessionList(
    visibleSessions,
    [],
    allUngrouped,
    flatPins ? false : pinnedSessionsCollapsed,
    reminderGroup,
  );
  const groupedSessionListEntries = buildSessionList(
    visibleSessions,
    [],
    flatPins
      ? mountedUngrouped
      : [
          ...allUngrouped.filter((session) => session.pinned),
          ...mountedUngrouped,
        ],
    pinnedSessionsCollapsed,
    reminderGroup,
  );
  const sessionListEntries: SessionListEntry[] = flatPins
    ? groupedSessionListEntries.flatMap((entry): SessionListEntry[] =>
        entry.kind === "pinned"
          ? entry.sessions.map((session) => ({ kind: "session", session }))
          : [entry],
      )
    : groupedSessionListEntries;
  const sessionNavigationIds = sessionListNavigationIds(
    fullSessionListEntries,
    searchNarrowed,
  );
  const sessionNavigationKey = sessionNavigationIds.join("\0");
  useEffect(() => {
    if (activeProject && !shortcutId)
      onSessionNavigationOrder?.(sessionNavigationIds);
  }, [activeProject, shortcutId, onSessionNavigationOrder, sessionNavigationKey]);
  useEffect(() => {
    if (tab !== "sessions") {
      selectionAnchorRef.current = null;
      setSelectedSessionIds(new Set());
      return;
    }
    const available = new Set(sessionNavigationIds);
    if (
      selectionAnchorRef.current &&
      !available.has(selectionAnchorRef.current)
    ) {
      selectionAnchorRef.current = null;
    }
    setSelectedSessionIds((current) =>
      pruneSessionSelection(current, available),
    );
  }, [cwd, tab, sessionNavigationKey]);
  const hiddenSessions = shownUngroupedCount < ungroupedVisible.length;
  const hasMoreSessions = !treePreview && hiddenSessions;
  const treePreviewExpanded = shownUngroupedCount > previewUngroupedCount;
  const narrowedByUser = searchNarrowed || filtersActive;
  useEffect(() => {
    setSessionListLimit(LIST_PAGE_SIZE);
    setTreeSessionLimit(TREE_PREVIEW_COUNT);
    // The shared project tree owns its scroll position.
  }, [sessionListKey]);

  useEffect(() => {
    if (tab !== "sessions" || !hasMoreSessions) return;
    const sentinel = loadMoreRef.current;
    const root = sessionsScrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSessionListLimit((current) => current + LIST_PAGE_SIZE);
      },
      { root, rootMargin: "240px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tab, hasMoreSessions, shownUngroupedCount]);

  useEffect(() => {
    setPinnedSessionsCollapsed(loadPinnedSessionsCollapsed(cwd));
    setReminderSessionsCollapsed(loadReminderSessionsCollapsed(cwd));
  }, [cwd]);

  useEffect(() => {
    if (tab !== "sessions") return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [tab]);

  useEffect(() => {
    if (!sessionMenu) return;
    const onScroll = () => {
      closeSessionMenu();
    };
    const scrollParent = sessionsScrollRef.current ?? window;
    scrollParent.addEventListener("scroll", onScroll, true);
    return () => scrollParent.removeEventListener("scroll", onScroll, true);
  }, [sessionMenu]);

  useEffect(() => {
    if (selectedSessionIds.size === 0) return;
    const clear = () => {
      selectionAnchorRef.current = null;
      contextSelectionRef.current = false;
      setSelectedSessionIds(new Set());
      setSessionMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        !activeProject &&
        !(
          event.target instanceof Node &&
          sectionRef.current?.contains(event.target)
        )
      )
        return;
      clear();
    };
    // A pointer landing off the cards drops the selection; a menu acting on
    // it stays open, and the cards handle their own clicks.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      const el = target instanceof Element ? target : null;
      if (el?.closest("[data-popover-side]")) return;
      if (
        el &&
        sectionRef.current?.contains(el) &&
        el.closest("[data-session-card]")
      )
        return;
      clear();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [selectedSessionIds.size, activeProject]);

  useEffect(() => {
    const onOtherProjectSelection = (event: Event) => {
      if ((event as CustomEvent<string>).detail === pathKey(cwd)) return;
      selectionAnchorRef.current = null;
      contextSelectionRef.current = false;
      setSelectedSessionIds((current) => (current.size ? new Set() : current));
      setSessionMenu(null);
    };
    window.addEventListener(PROJECT_SESSION_SELECTION, onOtherProjectSelection);
    return () =>
      window.removeEventListener(
        PROJECT_SESSION_SELECTION,
        onOtherProjectSelection,
      );
  }, [cwd]);

  const announceProjectSelection = () =>
    window.dispatchEvent(
      new CustomEvent(PROJECT_SESSION_SELECTION, { detail: pathKey(cwd) }),
    );

  const menuSessionIds = sessionMenu
    ? orderedSessionActionIds(
        sessionMenu.sessionId,
        selectedSessionIds,
        sessionNavigationIds,
      )
    : [];
  const menuSessions = menuSessionIds.flatMap((sessionId) => {
    const session = listedSessions.find((entry) => entry.id === sessionId);
    return session ? [session] : [];
  });
  const multipleMenuSessions = menuSessionIds.length > 1;
  const menuReminderTimes = [
    ...new Set(
      reminders
        .filter((reminder) => menuSessionIds.includes(reminder.sessionId))
        .map((reminder) => reminder.dueAt),
    ),
  ];
  const allMenuSessionsPinned =
    menuSessions.length > 0 && menuSessions.every((session) => session.pinned);
  const allMenuSessionsArchived =
    menuSessions.length > 0 &&
    menuSessions.every((session) => session.archived);
  const sessionMenuItems: ExplorerMenuItem[] = [
    ...(onCancelReminders && menuReminderTimes.length > 0
      ? [
          {
            kind: "item" as const,
            id: "reminder:cancel",
            label: uiT("Cancel reminder"),
            description:
              menuReminderTimes.length === 1
                ? formatReminderTime(menuReminderTimes[0])
                : uiT("Multiple reminder times"),
          },
          { kind: "sep" as const },
        ]
      : []),
    ...(onPinSession || onPinSessions
      ? [
          {
            kind: "item" as const,
            id: "pin",
            label: allMenuSessionsPinned ? uiT("Unpin") : uiT("Pin"),
          },
        ]
      : []),
    ...(!multipleMenuSessions && onRenameSession
      ? [
          {
            kind: "item" as const,
            id: "rename",
            label: uiT("Rename"),
            shortcut: "F2",
          },
        ]
      : []),
    ...(!multipleMenuSessions
      ? [
          {
            kind: "item" as const,
            id: "copy-session-id",
            label: uiT("Copy session ID"),
            submenu: [
              {
                kind: "item" as const,
                id: "copy-harness-session-id",
                label: uiT("Harness session ID"),
                disabled: !menuSessions[0]?.providerSessionId,
              },
              {
                kind: "item" as const,
                id: "copy-monocode-session-id",
                label: uiT("MonoCode session ID"),
              },
            ],
          },
        ]
      : []),
    ...(!multipleMenuSessions && onSetSessionLinkedWorkItem
      ? [
          {
            kind: "item" as const,
            id: "link-work-item",
            label: menuSessions[0]?.linkedWorkItem
              ? uiT("Edit GitHub issue or PR link…")
              : uiT("Link GitHub issue or PR…"),
          },
        ]
      : []),
    {
      kind: "item",
      id: "reminder",
      label: uiT("Remind me"),
      disabled: !onSetReminders,
      submenu: sessionReminderPresets(),
    },
    ...(onArchiveSession ||
    onArchiveSessions ||
    onDeleteSession ||
    onDeleteSessions
      ? [
          { kind: "sep" as const },
          ...(onArchiveSession || onArchiveSessions
            ? [
                {
                  kind: "item" as const,
                  id: "archive",
                  label: allMenuSessionsArchived
                    ? uiT("Unarchive")
                    : uiT("Archive"),
                },
              ]
            : []),
          ...(onDeleteSession || onDeleteSessions
            ? [
                {
                  kind: "item" as const,
                  id: "delete",
                  label: uiT("Delete"),
                  shortcut: "⌫",
                  danger: true,
                },
              ]
            : []),
        ]
      : []),
  ];

  const onSessionContextMenu = (
    sessionId: string,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    announceProjectSelection();
    contextSelectionRef.current = !selectedSessionIds.has(sessionId);
    if (contextSelectionRef.current) {
      setSelectedSessionIds(new Set([sessionId]));
    }
    setSessionMenu({ x: e.clientX, y: e.clientY, sessionId });
  };

  const closeSessionMenu = () => {
    setSessionMenu(null);
    if (!contextSelectionRef.current) return;
    contextSelectionRef.current = false;
    selectionAnchorRef.current = null;
    setSelectedSessionIds(new Set());
  };

  const onSessionMenuPick = (id: string) => {
    if (!sessionMenu) return;
    const sessionId = sessionMenu.sessionId;
    const sessionIds = menuSessionIds;
    const providerSessionId = menuSessions[0]?.providerSessionId;
    const archived = allMenuSessionsArchived;
    const pinned = allMenuSessionsPinned;
    closeSessionMenu();
    if (id === "reminder:cancel") {
      onCancelReminders?.(sessionIds);
      return;
    }
    if (id.startsWith("reminder:")) {
      const dueAt = reminderTime(id);
      if (dueAt != null) {
        setReminderSessionsCollapsed(false);
        saveReminderSessionsCollapsed(cwd, false);
        onSetReminders?.(sessionIds, dueAt);
      }
      return;
    }
    if (id === "pin") {
      if (sessionIds.length > 1 && onPinSessions) {
        onPinSessions(sessionIds, !pinned);
      } else {
        for (const id of sessionIds) onPinSession?.(id, !pinned);
      }
      return;
    }
    if (id === "rename") {
      setRenamingSessionId(sessionId);
      return;
    }
    if (id === "copy-harness-session-id" || id === "copy-monocode-session-id") {
      const value =
        id === "copy-harness-session-id" ? providerSessionId : sessionId;
      if (value) {
        void copyText(value).catch((error) => {
          console.error("Failed to copy session ID:", error);
        });
      }
      return;
    }
    if (id === "link-work-item") {
      setLinkingSession(menuSessions[0] ?? null);
      return;
    }
    if (id === "archive") {
      if (sessionIds.length > 1 && onArchiveSessions) {
        onArchiveSessions(sessionIds, !archived);
      } else {
        for (const id of sessionIds) onArchiveSession?.(id, !archived);
      }
      return;
    }
    if (id === "delete") {
      if (sessionIds.length > 1 && onDeleteSessions) {
        onDeleteSessions(sessionIds);
      } else {
        for (const id of sessionIds) onDeleteSession?.(id);
      }
    }
  };

  const onSessionCardSelect = (
    sessionId: string,
    event: {
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey?: boolean;
    },
  ) => {
    announceProjectSelection();
    contextSelectionRef.current = false;
    setSessionMenu(null);
    if (event.shiftKey) {
      const visibleIds = sessionListNavigationIds(
        sessionListEntries,
        searchNarrowed,
      );
      if (
        selectionAnchorRef.current &&
        !visibleIds.includes(selectionAnchorRef.current)
      ) {
        selectionAnchorRef.current = null;
      }
      const anchor =
        selectionAnchorRef.current ?? activeListedSessionId ?? sessionId;
      const start = visibleIds.indexOf(anchor);
      const end = visibleIds.indexOf(sessionId);
      const range =
        start < 0 || end < 0
          ? [sessionId]
          : visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1);
      selectionAnchorRef.current = start < 0 ? sessionId : anchor;
      setSelectedSessionIds(
        (current) =>
          new Set(
            event.ctrlKey || event.metaKey ? [...current, ...range] : range,
          ),
      );
      return;
    }
    selectionAnchorRef.current = sessionId;
    if (event.ctrlKey || event.metaKey) {
      const next = toggleSessionSelection(selectedSessionIds, sessionId);
      if (next.size === 0) selectionAnchorRef.current = null;
      setSelectedSessionIds(next);
      return;
    }
    setSelectedSessionIds(new Set());
    // Alt-click opens the chat in a new column beside the focused one.
    if (event.altKey && !remoteProject) {
      onSelectLocalSession(sessionId, undefined, { newColumn: true });
      return;
    }
    onSelectSession(sessionId);
  };

  // Cards are memoized. Their handlers go through one stable set that calls
  // the latest version, so a sidebar render no longer re-renders every card.
  const cardHandlers = useRef({
    onSessionCardSelect,
    onOpenInboxItem,
    onPrefetchSession,
    onPlaceSessionOnPane,
    onSessionContextMenu,
    onArchiveSession,
    setRenamingSessionId,
    onDeleteSession,
  });
  cardHandlers.current = {
    onSessionCardSelect,
    onOpenInboxItem,
    onPrefetchSession,
    onPlaceSessionOnPane,
    onSessionContextMenu,
    onArchiveSession,
    setRenamingSessionId,
    onDeleteSession,
  };
  const cardActions = useMemo(
    () => ({
      select: (
        sessionId: string,
        event: {
          shiftKey: boolean;
          ctrlKey: boolean;
          metaKey: boolean;
          altKey?: boolean;
        },
      ) => cardHandlers.current.onSessionCardSelect(sessionId, event),
      openWorkItem: (item: LinkedWorkItem, sessionId: string) =>
        cardHandlers.current.onOpenInboxItem?.(item, sessionId),
      prefetch: (sessionId: string) =>
        cardHandlers.current.onPrefetchSession?.(sessionId),
      placeOnPane: (sessionId: string, targetId: string, edge: PaneEdge) =>
        cardHandlers.current.onPlaceSessionOnPane?.(sessionId, targetId, edge),
      contextMenu: (sessionId: string, e: ReactMouseEvent<HTMLDivElement>) =>
        cardHandlers.current.onSessionContextMenu(sessionId, e),
      archive: (sessionId: string, archived: boolean) =>
        cardHandlers.current.onArchiveSession?.(sessionId, archived),
      rename: (sessionId: string) =>
        cardHandlers.current.setRenamingSessionId(sessionId),
      delete: (sessionId: string) =>
        cardHandlers.current.onDeleteSession?.(sessionId),
    }),
    [],
  );

  const sessionInsertMotion = useRef<SessionInsertMotion>({
    cwd: "",
    seen: new Set(),
  });
  // Runs after the rows' mount effects: a project's first paint never animates,
  // and rows that mount later (sidebar opened, group expanded) are not new.
  useLayoutEffect(() => {
    const motion = sessionInsertMotion.current;
    motion.cwd = cwd;
    for (const session of listedSessions) motion.seen.add(session.id);
  });

  const renderSessionCard = (session: SessionSummary, compact = false) =>
    renamingSessionId === session.id && onRenameSession ? (
      <SessionRenameRow
        session={session}
        isActive={session.id === activeListedSessionId}
        needsApproval={listedApprovalSessionIds.has(session.id)}
        dense={dense}
        compact={compact}
        onCommit={(title) => {
          onRenameSession(session.id, title);
          setRenamingSessionId(null);
        }}
        onCancel={() => setRenamingSessionId(null)}
      />
    ) : (
      <SessionCard
        session={session}
        isActive={session.id === activeListedSessionId}
        isSelected={selectedSessionIds.has(session.id)}
        busy={listedBusySessionIds.has(session.id)}
        done={unseenFinishedIds.has(session.id)}
        linkedUpdate={linkedSessionUpdateIds.has(session.id)}
        needsApproval={listedApprovalSessionIds.has(session.id)}
        compact={compact}
        dense={dense}
        shortcut={!!shortcutId}
        plainTree={flatPins}
        now={now}
        onSelect={cardActions.select}
        onOpenWorkItem={
          onOpenInboxItem && !remoteProject
            ? cardActions.openWorkItem
            : undefined
        }
        onPrefetch={onPrefetchSession ? cardActions.prefetch : undefined}
        onPlaceOnPane={
          onPlaceSessionOnPane ? cardActions.placeOnPane : undefined
        }
        onContextMenu={cardActions.contextMenu}
        onArchive={onArchiveSession ? cardActions.archive : undefined}
        onRename={onRenameSession ? cardActions.rename : undefined}
        onDelete={onDeleteSession ? cardActions.delete : undefined}
      />
    );

  return (
    <div ref={sectionRef} data-project-session-section={pathKey(cwd)}>
      {!shortcutId && (status === "error" || (remoteProject && remote.error)) &&
      projectSessions.length > 0 ? (
        <p role="status" className="px-3 py-1 text-[11px] text-content/50">
          {uiT("Couldn’t load sessions")}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 text-accent"
            >
              {uiT("Retry")}
            </button>
          ) : null}
        </p>
      ) : null}
      {!shortcutId && remoteProject && remote.offline && projectSessions.length > 0 ? (
        <p role="status" className="px-3 py-1 text-[11px] text-content/50">
          {uiT("Offline — showing cached sessions")}
        </p>
      ) : null}
      {shortcutId ? (
        <div data-pinned-session-shortcut={shortcutId}>
          {visibleSessions.map((session) => (
            <Fragment key={session.id}>{renderSessionCard(session)}</Fragment>
          ))}
        </div>
      ) : !cwd || cwd === "~" ? (
        <p className="px-3 py-2 text-[12px] text-content/50">
          {uiT("No project folder")}
        </p>
      ) : (
        <div>
          {/*
              A project's first load stays deliberately blank. The listing is
              served from a covering index and resolves within a frame or two,
              so a placeholder only ever flashed — reading as a glitch rather
              than as progress. This is checked before the empty state so that
              cannot claim "No sessions yet" before the rows have landed.
            */}
          {pendingFirstLoad ? (
            <p role="status" className="px-3 py-1 text-[12px] text-content/50">
              {uiT("Loading sessions…")}
            </p>
          ) : (status === "error" || (remoteProject && remote.error)) &&
            projectSessions.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-content/50">
              {uiT("Couldn’t load sessions")}
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ml-2 text-accent"
                >
                  {uiT("Retry")}
                </button>
              ) : null}
            </p>
          ) : visibleSessions.length === 0 ? (
            // A narrowed-down result is a transient answer to what the user
            // just typed, so it stays a quiet line of text. Only the genuine
            // "this project has nothing in it" case earns the illustration.
            narrowedByUser ? (
              <p className="px-3 py-2 text-[12px] text-content/50">
                {searchNarrowed
                  ? uiT("No matching sessions")
                  : uiT("No sessions match these filters")}
              </p>
            ) : remoteProject && remote.offline ? (
              <p className="px-3 py-2 text-[12px] text-content/45">
                {uiT(
                  "This project’s machine isn’t connected on this computer.",
                )}
              </p>
            ) : (
              <SessionsEmpty
                message={uiT("Sessions you start will show up here")}
              />
            )
          ) : (
            <ul
              data-session-list
              className={`flex flex-col ${dense ? "w-full gap-[3px] px-0 py-[3px]" : "gap-px px-1 pb-1"}`}
            >
              {sessionListEntries.map((entry, index) => {
                if (entry.kind === "pinned" || entry.kind === "reminders") {
                  const isReminders = entry.kind === "reminders";
                  const expanded = searchNarrowed || !entry.collapsed;
                  const beforeUngrouped =
                    sessionListEntries[index + 1]?.kind === "session";
                  return (
                    <li
                      key={`${entry.kind}-sessions`}
                      data-pinned-sessions={isReminders ? undefined : ""}
                      data-reminder-sessions={isReminders ? "" : undefined}
                      className={`relative ${
                        !dense && (expanded || beforeUngrouped) ? "mb-1.5" : ""
                      }`}
                    >
                      <div className="overflow-hidden rounded-md bg-content/5">
                        <SessionGroupRow
                          dense={dense}
                          label={isReminders ? uiT("Reminders") : uiT("Pinned")}
                          accent={isReminders ? REMINDERS_COLOR : undefined}
                          sessions={entry.sessions}
                          expanded={expanded}
                          busy={entry.sessions.some((session) =>
                            listedBusySessionIds.has(session.id),
                          )}
                          done={entry.sessions.some((session) =>
                            unseenFinishedIds.has(session.id),
                          )}
                          needsApproval={entry.sessions.some((session) =>
                            listedApprovalSessionIds.has(session.id),
                          )}
                          groupIcon={
                            isReminders ? (
                              <Clock className="size-3.5" strokeWidth={1.75} />
                            ) : (
                              <Pin
                                className="size-3.5 text-content"
                                strokeWidth={1.75}
                              />
                            )
                          }
                          onToggle={() => {
                            if (searchNarrowed) return;
                            const collapsed = !entry.collapsed;
                            if (isReminders) {
                              setReminderSessionsCollapsed(collapsed);
                              saveReminderSessionsCollapsed(cwd, collapsed);
                              return;
                            }
                            setPinnedSessionsCollapsed(collapsed);
                            savePinnedSessionsCollapsed(cwd, collapsed);
                          }}
                        />
                        <AnimatedCollapse expanded={expanded}>
                          <ul
                            className={`flex flex-col ${dense ? "w-full gap-[3px] px-0 pt-[3px]" : "gap-px p-1"}`}
                          >
                            <SessionGroupPreview
                              sessions={entry.sessions}
                              resetKey={sessionListKey}
                              searchActive={searchNarrowed}
                              cwd={cwd}
                              motion={sessionInsertMotion}
                              renderCard={(session) => renderSessionCard(session, true)}
                            />
                          </ul>
                        </AnimatedCollapse>
                      </div>
                    </li>
                  );
                }
                if (entry.kind === "folder") return null;
                return (
                  <SessionListItem
                    key={entry.session.id}
                    session={entry.session}
                    cwd={cwd}
                    motion={sessionInsertMotion}
                    expanded={
                      treePreview
                        ? shownUngroupedIds.has(entry.session.id)
                        : undefined
                    }
                  >
                    {renderSessionCard(entry.session)}
                  </SessionListItem>
                );
              })}
              {hasMoreSessions ? (
                <li ref={loadMoreRef} aria-hidden className="h-px list-none" />
              ) : null}
              {treePreview && (hiddenSessions || treePreviewExpanded) ? (
                <li className="list-none">
                  <button
                    type="button"
                    data-session-list-toggle
                    data-tauri-drag-region="false"
                    aria-expanded={treePreviewExpanded}
                    onClick={() =>
                      setTreeSessionLimit(
                        hiddenSessions
                          ? shownUngroupedCount + TREE_PREVIEW_COUNT
                          : TREE_PREVIEW_COUNT,
                      )
                    }
                    className="flex h-8 w-full items-center rounded-md pl-8 pr-2 text-left text-[13px] text-content/45 hover:bg-content/5 hover:text-content"
                  >
                    {hiddenSessions ? uiT("Show more") : uiT("Show less")}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      )}{" "}
      {sessionMenu ? (
        <ExplorerMenu
          x={sessionMenu.x}
          y={sessionMenu.y}
          items={sessionMenuItems}
          ariaLabel={
            multipleMenuSessions
              ? uiT("{value0} selected session actions", {
                  value0: String(menuSessionIds.length),
                })
              : uiT("Session actions")
          }
          onPick={onSessionMenuPick}
          onClose={closeSessionMenu}
        />
      ) : null}
      {linkingSession ? (
        <LinkSessionWorkItemDialog
          initial={linkingSession.linkedWorkItem}
          sessionTitle={sessionDisplayTitle(
            linkingSession.title,
            linkingSession.harness,
          )}
          onSave={(item) => {
            onSetSessionLinkedWorkItem?.(linkingSession.id, item);
            setLinkingSession(null);
          }}
          onClose={() => setLinkingSession(null)}
        />
      ) : null}
    </div>
  );
}

export const ProjectSessionSection = memo(ProjectSessionSectionComponent);

function SessionGroupRow({
  label,
  accent,
  sessions,
  expanded,
  busy,
  done,
  needsApproval,
  groupIcon,
  dense = false,
  onToggle,
}: {
  label: string;
  accent?: string;
  sessions: SessionSummary[];
  expanded: boolean;
  busy: boolean;
  done: boolean;
  needsApproval: boolean;
  groupIcon: ReactNode;
  /** Project-tree rows indent their icon to the project name. */
  dense?: boolean;
  onToggle: () => void;
}) {
  const count = sessions.length;
  return (
    <button
      type="button"
      title={label}
      aria-expanded={expanded}
      data-tauri-drag-region="false"
      onClick={onToggle}
      className={`group relative flex w-full touch-none items-center gap-1.5 ${dense ? "pl-8 pr-2" : "px-2"} h-8 text-left ${
        expanded ? "rounded-md" : ""
      } ${
        expanded
          ? "text-content hover:bg-content/10"
          : "text-content/80 hover:bg-content/10 hover:text-content"
      }`}
    >
      <span
        className={`relative grid size-4 shrink-0 place-items-center ${
          accent ? "" : "text-content/50"
        }`}
        style={accent ? { color: accent } : undefined}
      >
        {expanded ? (
          groupIcon ? (
            <>
              <span className="group-hover:hidden group-focus-visible:hidden">
                {groupIcon}
              </span>
              <ChevronDown
                className="hidden size-3.5 text-content group-hover:block group-focus-visible:block"
                strokeWidth={1.75}
              />
            </>
          ) : (
            <ChevronDown className="size-3.5 text-content" strokeWidth={1.75} />
          )
        ) : (
          <>
            <span className="group-hover:hidden group-focus-visible:hidden">
              {groupIcon}
            </span>
            <ChevronRight
              className="hidden size-3.5 group-hover:block group-focus-visible:block text-content"
              strokeWidth={1.75}
            />
          </>
        )}
      </span>
      <span className="relative min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-content">
        {label}
      </span>
      <span className="relative flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-content/45">
        {!expanded && needsApproval ? (
          <CircleAlert className="size-3 text-amber-400" strokeWidth={1.75} />
        ) : !expanded && busy ? (
          <TerminalSpinner className="inline-block w-3 select-none text-center text-[11px] leading-none text-accent" />
        ) : !expanded && done ? (
          <Check className="size-3 text-emerald-400" strokeWidth={2.25} />
        ) : null}
        <span>{count}</span>
      </span>
    </button>
  );
}

const SESSION_PREFETCH_DELAY_MS = 120;
/** Rows created this recently slide in; older ones are just being listed. */
const SESSION_INSERT_WINDOW_MS = 15_000;

type SessionInsertMotion = { cwd: string; seen: Set<string> };

function SessionGroupPreview({
  sessions,
  resetKey,
  searchActive,
  cwd,
  motion,
  renderCard,
}: {
  sessions: SessionSummary[];
  resetKey: string;
  searchActive: boolean;
  cwd: string;
  motion: RefObject<SessionInsertMotion>;
  renderCard: (session: SessionSummary) => ReactNode;
}) {
  const preview = useSidebarListPreview(
    sessions.length,
    resetKey,
    searchActive,
  );
  return (
    <>
      {sessions.map((session, index) => (
        <SessionListItem
          key={session.id}
          session={session}
          cwd={cwd}
          motion={motion}
          expanded={index < preview.count}
        >
          {renderCard(session)}
        </SessionListItem>
      ))}
      {preview.button && <li className="list-none">{preview.button}</li>}
    </>
  );
}

/** List row that grows open when a new session lands, pushing rows below it down. */
function SessionListItem({
  session,
  cwd,
  motion,
  expanded,
  children,
}: {
  session: SessionSummary;
  cwd: string;
  motion: RefObject<SessionInsertMotion>;
  expanded?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // Decided once per row: effects can replay (StrictMode, reordering), and a
  // row that already slid in must not do it again.
  const played = useRef(false);
  useLayoutEffect(() => {
    if (played.current) return;
    played.current = true;
    const state = motion.current;
    const fresh =
      state.cwd === cwd &&
      !state.seen.has(session.id) &&
      (session.createdAt === 0 ||
        Date.now() - session.createdAt < SESSION_INSERT_WINDOW_MS);
    state.seen.add(session.id);
    const el = ref.current;
    const content = el?.firstElementChild;
    if (
      !fresh ||
      !el ||
      !(content instanceof HTMLElement) ||
      typeof el.animate !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // The card takes its place at once; everything below starts where it was
    // and slides down, uncovering it as it fades in.
    const offset =
      el.offsetHeight +
      (parseFloat(getComputedStyle(el.parentElement ?? el).rowGap) || 0);
    const timing = {
      duration: 380,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    };
    for (
      let node: Element | null = el;
      node && !node.hasAttribute("data-session-list");
      node = node.parentElement
    ) {
      for (
        let below = node.nextElementSibling;
        below;
        below = below.nextElementSibling
      ) {
        if (!(below instanceof HTMLElement)) continue;
        below.animate(
          [{ transform: `translateY(${-offset}px)` }, { transform: "none" }],
          // Stack with a push already in flight instead of restarting it.
          { ...timing, composite: "add" },
        );
      }
    }
    content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
  }, []);
  return (
    <li
      ref={ref}
      className={expanded === undefined ? undefined : "empty:hidden"}
    >
      {expanded === undefined ? (
        children
      ) : (
        <AnimatedCollapse expanded={expanded}>{children}</AnimatedCollapse>
      )}
    </li>
  );
}

const SessionCard = memo(function SessionCard({
  session,
  isActive,
  isSelected,
  busy,
  done,
  linkedUpdate,
  needsApproval,
  compact = false,
  dense = false,
  shortcut = false,
  plainTree = false,
  now,
  onSelect,
  onOpenWorkItem,
  onPrefetch,
  onPlaceOnPane,
  onContextMenu,
  onArchive,
  onRename,
  onDelete,
}: {
  session: SessionSummary;
  isActive: boolean;
  isSelected: boolean;
  busy: boolean;
  done: boolean;
  linkedUpdate: boolean;
  needsApproval: boolean;
  compact?: boolean;
  dense?: boolean;
  shortcut?: boolean;
  plainTree?: boolean;
  now: number;
  onSelect: (
    sessionId: string,
    event: {
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey?: boolean;
    },
  ) => void;
  onOpenWorkItem?: (item: LinkedWorkItem, sessionId: string) => void;
  onPrefetch?: (sessionId: string) => void;
  onPlaceOnPane?: (sessionId: string, targetId: string, edge: PaneEdge) => void;
  onContextMenu?: (
    sessionId: string,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => void;
  onArchive?: (sessionId: string, archived: boolean) => void;
  onRename?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const skipClickUntil = useRef(0);
  const prefetchTimer = useRef<number | null>(null);
  const orchestrationTooltipRootRef = useRef<HTMLDivElement>(null);
  const orchestrationTooltipId = useId();
  const [dragging, setDragging] = useState(false);
  const [orchestrationTooltipOpen, setOrchestrationTooltipOpen] =
    useState(false);
  const metadataHover = useHoverSummary<HTMLDivElement>({
    enabled: dense && !orchestrationTooltipOpen && !dragging,
  });
  const orchestration = session.orchestration;
  const draft = !!session.draft;
  const orchestrationExpanded =
    !dense && !!orchestration && (isActive || isSelected || busy);
  const orchestrationDone =
    orchestration?.tasks.filter((task) => task.status === "completed").length ??
    0;
  const title = sessionDisplayTitle(session.title, session.harness);
  const gitLabel = session.worktreeRemoved
    ? uiT(NO_BRANCH_LABEL)
    : formatGitLabel(session.repo, session.branch);
  const relativeTime = formatRelative(session.updatedAt, now);
  const time = relativeTime === "now" ? uiT("now") : relativeTime;
  const model =
    compact && !orchestrationExpanded
      ? null
      : resolveModel(session.harness, session.model).name;
  const statusClass = needsApproval
    ? "text-amber-400"
    : busy
      ? "text-accent"
      : done
        ? "text-emerald-400"
        : draft
          ? "text-content/55"
          : "text-content/45";
  const status = (
    <span
      className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${statusClass}`}
    >
      {needsApproval ? (
        <>
          <CircleAlert className="size-3" strokeWidth={1.75} />
          <span>
            {orchestration ? uiT("Needs input") : uiT("Need approval")}
          </span>
        </>
      ) : busy ? (
        <>
          <TerminalSpinner className="inline-block w-3 select-none text-center text-[11px] leading-none text-accent" />
          <span>{uiT("Working...")}</span>
        </>
      ) : done ? (
        <>
          <Check className="size-3" strokeWidth={2.25} />
          <span>{uiT("Done")}</span>
        </>
      ) : draft ? (
        <>
          <CircleDashed className="size-3" strokeWidth={1.75} />
          <span>{uiT("Draft")}</span>
        </>
      ) : (
        <span>{time}</span>
      )}
    </span>
  );

  const summaryModel = session.model.trim()
    ? resolveModel(session.harness, session.model).name
    : undefined;
  const summaryStatus =
    needsApproval || busy || done || draft ? (
      status
    ) : (
      <span className={`shrink-0 text-[11px] ${statusClass}`}>
        {uiT("Idle")}
      </span>
    );
  const denseStatus = needsApproval ? (
    <CircleAlert
      aria-label={orchestration ? uiT("Needs input") : uiT("Need approval")}
      className="size-3 shrink-0 text-amber-400"
    />
  ) : busy ? (
    <span role="img" aria-label={uiT("Working...")}>
      <TerminalSpinner className="w-3 shrink-0 text-center text-[11px] leading-none text-accent" />
    </span>
  ) : done ? (
    <Check
      aria-label={uiT("Done")}
      className="size-3 shrink-0 text-emerald-400"
    />
  ) : draft ? (
    <CircleDashed
      aria-label={uiT("Draft")}
      className="size-3 shrink-0 text-content/45"
    />
  ) : null;
  const linkedWorkItem = session.linkedWorkItem;
  const linkedUpdateDot = linkedUpdate ? (
    <span
      title={uiT("Linked {value0} updated since this session", {
        value0: String(linkedWorkItem?.kind === "pr" ? "PR" : "issue"),
      })}
      aria-label={uiT("Linked work item updated")}
      className="size-1.5 shrink-0 rounded-full bg-accent"
    />
  ) : null;
  const workItemBadge = linkedWorkItem ? (
    <button
      type="button"
      data-no-drag
      data-tauri-drag-region="false"
      title={uiT(
        "Open {value0} #{value1} beside this session ({value2}-click for GitHub)",
        {
          value0: String(linkedWorkItem.kind === "pr" ? "PR" : "issue"),
          value1: String(linkedWorkItem.number),
          value2: String(MOD),
        },
      )}
      aria-label={uiT("Open {value0} #{value1}", {
        value0: String(linkedWorkItem.kind === "pr" ? "PR" : "issue"),
        value1: String(linkedWorkItem.number),
      })}
      onPointerEnter={() => {
        // Hover usually precedes the click by a few hundred ms, which is
        // most of what the panel would otherwise spend waiting on GitHub.
        if (onOpenWorkItem) prefetchGithubWorkItem(session.cwd, linkedWorkItem);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.metaKey || event.ctrlKey) {
          void openUrl(linkedWorkItem.url).catch(() => undefined);
          return;
        }
        if (onOpenWorkItem) onOpenWorkItem(linkedWorkItem, session.id);
        else void openUrl(linkedWorkItem.url).catch(() => undefined);
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        void openUrl(linkedWorkItem.url).catch(() => undefined);
      }}
      className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-0.5 text-[11px] tabular-nums text-accent hover:underline"
    >
      {linkedWorkItem.kind === "pr" ? (
        <GitPullRequest className="size-3" strokeWidth={1.75} />
      ) : (
        <CircleDot className="size-3" strokeWidth={1.75} />
      )}
      <span>#{linkedWorkItem.number}</span>
    </button>
  ) : null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      metadataHover.close();
      onSelect(session.id, e);
      return;
    }
    if (e.key === "F2" && onRename) {
      e.preventDefault();
      onRename(session.id);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
      e.preventDefault();
      onDelete(session.id);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    metadataHover.close();
    if (event.button !== 0) return;
    // Warm the transcript during the press. Opening stays on click so a
    // drag-to-pane gesture does not switch conversations.
    if (prefetchTimer.current != null) {
      window.clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
    onPrefetch?.(session.id);
    if (!onPlaceOnPane) return;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let lastX = startX;
    let lastY = startY;
    handle.setPointerCapture(pointerId);
    const restoreSelection = suppressTextSelection();

    const onMove = (ev: PointerEvent) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        active = true;
        setDragging(true);
        setExternalPaneDrop({
          fromId: session.id,
          overId: null,
          edge: "left",
        });
      }
      const over = paneDropFromPoint(ev.clientX, ev.clientY);
      if (!over || over.id === session.id) {
        setExternalPaneDrop({
          fromId: session.id,
          overId: over?.id === session.id ? session.id : null,
          edge: over?.edge ?? "left",
        });
        return;
      }
      setExternalPaneDrop({
        fromId: session.id,
        overId: over.id,
        edge: over.edge,
      });
    };

    const onUp = () => finish(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      finish(false);
    };

    function finish(commit: boolean) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      restoreSelection();
      setDragging(false);
      setExternalPaneDrop(null);
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      if (!active) return;
      skipClickUntil.current = performance.now() + 400;
      if (!commit) return;
      const over = paneDropFromPoint(lastX, lastY);
      if (over && over.id !== session.id) {
        onPlaceOnPane?.(session.id, over.id, over.edge);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
  };

  useEffect(
    () => () => {
      if (prefetchTimer.current != null) {
        window.clearTimeout(prefetchTimer.current);
        prefetchTimer.current = null;
      }
    },
    [onPrefetch, session.id],
  );

  const schedulePrefetch = () => {
    if (!onPrefetch || prefetchTimer.current != null) return;
    prefetchTimer.current = window.setTimeout(() => {
      prefetchTimer.current = null;
      onPrefetch(session.id);
    }, SESSION_PREFETCH_DELAY_MS);
  };

  const cancelScheduledPrefetch = () => {
    if (prefetchTimer.current == null) return;
    window.clearTimeout(prefetchTimer.current);
    prefetchTimer.current = null;
  };

  const archiveLabel = uiT(session.archived ? "Unarchive" : "Archive");
  // Expanding an orchestration card must not move its existing header. Keep
  // the collapsed top inset and give only the new detail area extra room at
  // the bottom.
  const cardPaddingY = orchestrationExpanded
    ? compact
      ? "pb-2.5 pt-1.5"
      : "pb-2.5 pt-2"
    : compact
      ? "py-1.5"
      : "py-2";

  return (
    <div ref={metadataHover.anchorRef} className="group relative">
      <div
        title={dense ? undefined : title}
        data-session-card={session.id}
        data-orchestration-card={orchestration ? "true" : undefined}
        data-session-selected={isSelected ? "true" : undefined}
        data-tauri-drag-region="false"
        onPointerDown={onPointerDown}
        onPointerEnter={(event) => {
          schedulePrefetch();
          metadataHover.triggerProps.onPointerEnter(event);
        }}
        onPointerLeave={(event) => {
          cancelScheduledPrefetch();
          metadataHover.triggerProps.onPointerLeave(event);
        }}
        onClick={(event) => {
          metadataHover.close();
          if (performance.now() < skipClickUntil.current) return;
          onSelect(session.id, event);
        }}
        onContextMenu={
          onContextMenu
            ? (event) => {
                metadataHover.close();
                onContextMenu(session.id, event);
              }
            : undefined
        }
        className={`relative border flex w-full cursor-default select-none touch-none rounded-md text-left ${dense ? `h-8 flex-row items-center gap-1 ${shortcut ? "px-2" : compact ? "pl-[54px] pr-2" : "pl-8 pr-2"}` : `flex-col px-2.5 ${cardPaddingY}`} ${
          dragging ? "opacity-40" : ""
        } ${
          isSelected
            ? `bg-accent/15 text-content ${draft ? "border-content/30 border-dashed" : "border-transparent"}`
            : needsApproval
              ? "bg-content/20 text-content border-content/30 border-dashed"
              : isActive
                ? `bg-selection text-content ${draft ? "border-content/30 border-dashed" : "border-transparent"}`
                : draft
                  ? "border-content/25 border-dashed text-content/80 hover:bg-content/5 hover:text-content"
                  : `text-content/80 hover:text-content border-transparent ${
                      orchestrationExpanded
                        ? "bg-content/5 hover:bg-content/10"
                        : "hover:bg-content/5"
                    }`
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-current={isActive ? "true" : undefined}
          aria-pressed={isSelected}
          data-session-select={session.id}
          onKeyDown={onKeyDown}
          onFocus={metadataHover.triggerProps.onFocus}
          onBlur={metadataHover.triggerProps.onBlur}
          aria-describedby={
            dense && metadataHover.open ? metadataHover.id : undefined
          }
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            // Shift-click can trigger :focus-visible. Mouse selection should
            // only highlight the card; Tab can still focus this button.
            event.preventDefault();
            // Clear prior focus too, so shortcuts cannot target another card.
            const focused = event.currentTarget.ownerDocument.activeElement;
            if (focused instanceof HTMLElement) focused.blur();
          }}
          className={`rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${dense ? "min-w-0 flex-1" : ""}`}
        >
          {dense || (compact && !orchestrationExpanded) ? null : (
            <span className="relative flex items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <HarnessIcon
                  harness={session.harness}
                  className="size-3.5 shrink-0"
                />
                <span className="min-w-0 truncate text-[11px] text-content/50">
                  {model}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {linkedUpdateDot}
                {status}
              </span>
            </span>
          )}
          <span
            className={`relative flex min-w-0 items-center gap-1.5 ${
              dense || (compact && !orchestrationExpanded) ? "" : "mt-1"
            }`}
          >
            {dense || (compact && !orchestrationExpanded) ? (
              <span
                role="img"
                aria-label={HARNESS_TITLE[session.harness]}
                title={HARNESS_TITLE[session.harness]}
                className="flex shrink-0 items-center"
              >
                <HarnessIcon
                  harness={session.harness}
                  className="size-3.5 shrink-0"
                />
              </span>
            ) : null}
            {session.pinned && !shortcut && !plainTree ? (
              <Pin
                className="size-3 shrink-0 text-content/45"
                strokeWidth={1.75}
              />
            ) : null}
            <ParticleText
              text={title}
              className={`min-w-0 flex-1 line-clamp-1 text-[13px] leading-snug text-content ${dense ? "font-normal" : "font-semibold"}`}
            />
            {dense || (compact && !orchestrationExpanded) ? (
              <span className="flex shrink-0 items-center gap-1.5">
                {linkedUpdateDot}
                {dense ? denseStatus : status}
              </span>
            ) : null}
          </span>
        </div>
        {orchestrationExpanded ? (
          <OrchestrationSidebarAgents
            leadId={session.id}
            summary={orchestration!}
          />
        ) : null}
        <span
          className={`relative flex items-center ${dense ? "shrink-0" : "mt-1 gap-2"}`}
        >
          {!dense && gitLabel ? (
            <span
              className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-content/45"
              title={
                session.worktreeCwd
                  ? `${gitLabel}\n${session.worktreeCwd}`
                  : gitLabel
              }
            >
              <GitBranch className="size-3 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 truncate">{gitLabel}</span>
            </span>
          ) : dense ? null : (
            <span className="min-w-0 flex-1" />
          )}
          <span className="relative flex shrink-0 items-center gap-px">
            {onArchive ? (
              <button
                type="button"
                data-no-drag
                data-tauri-drag-region="false"
                title={archiveLabel}
                aria-label={`${archiveLabel} ${title}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive(session.id, !session.archived);
                }}
                className="pointer-events-none grid size-5 place-items-center rounded-md text-content/50 opacity-0 hover:bg-content/10 hover:text-content group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
              >
                <Archive className="size-3 shrink-0" strokeWidth={1.75} />
              </button>
            ) : null}
            {workItemBadge}
            {session.automationId ? (
              <span
                data-automation-icon
                role="img"
                title={uiT("Started by an automation")}
                aria-label={uiT("Started by an automation")}
                className="grid size-5 -mr-1 shrink-0 place-items-center text-amber-400"
              >
                <Zap className="size-3" strokeWidth={1.75} />
              </span>
            ) : null}
            {orchestration ? (
              <div
                ref={orchestrationTooltipRootRef}
                className="relative shrink-0"
                onMouseEnter={() => setOrchestrationTooltipOpen(true)}
                onMouseLeave={() => setOrchestrationTooltipOpen(false)}
              >
                <button
                  type="button"
                  data-no-drag
                  data-tauri-drag-region="false"
                  data-orchestration-icon
                  aria-label={uiT(
                    "Orchestrator, {value0} {value1}, {value2} done",
                    {
                      value0: String(orchestration.tasks.length),
                      value1: String(
                        orchestration.tasks.length === 1
                          ? "subagent"
                          : "subagents",
                      ),
                      value2: String(orchestrationDone),
                    },
                  )}
                  aria-describedby={
                    orchestrationTooltipOpen
                      ? orchestrationTooltipId
                      : undefined
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onFocus={() => setOrchestrationTooltipOpen(true)}
                  onBlur={() => setOrchestrationTooltipOpen(false)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOrchestrationTooltipOpen(false);
                    onSelect(session.id, event);
                  }}
                  className="grid size-5 shrink-0 place-items-center rounded-md text-fuchsia-300/65 hover:bg-content/10 hover:text-fuchsia-200/90"
                >
                  <Share className="size-3" />
                </button>
              </div>
            ) : null}
          </span>
        </span>
      </div>
      <HoverSummary hover={metadataHover} role="tooltip">
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-snug text-content [overflow-wrap:anywhere]">
            {title}
          </h3>
          {summaryStatus}
        </div>
        {summaryModel || gitLabel || session.worktreeCwd || time ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-content/10 pt-3">
            {summaryModel ? (
              <HoverSummaryRow
                icon={
                  <HarnessIcon harness={session.harness} className="size-4" />
                }
                label={uiT("Model")}
              >
                {summaryModel}
              </HoverSummaryRow>
            ) : null}
            {gitLabel ? (
              <HoverSummaryRow
                icon={<GitBranch className="size-4" />}
                label={uiT("Branch")}
              >
                {gitLabel}
              </HoverSummaryRow>
            ) : null}
            {session.worktreeCwd ? (
              <HoverSummaryRow
                icon={<Folder className="size-4" />}
                label={uiT("Working directory")}
              >
                {session.worktreeCwd}
              </HoverSummaryRow>
            ) : null}
            {time ? (
              <HoverSummaryRow
                icon={<Clock className="size-4" />}
                label={uiT("Last updated")}
              >
                {time}
              </HoverSummaryRow>
            ) : null}
          </div>
        ) : null}
      </HoverSummary>
      {orchestration && orchestrationTooltipOpen ? (
        <Popover
          anchor={orchestrationTooltipRootRef}
          side="right"
          align="end"
          width={248}
          maxHeight={320}
          role="tooltip"
          id={orchestrationTooltipId}
          className="pointer-events-none overflow-y-auto p-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-content/85">
              {uiT("Subagents")}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-content/45">
              {orchestrationDone}/{orchestration.tasks.length} {uiT("done")}
            </span>
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5">
            {orchestration.tasks.map((task) => {
              const label = orchestrationTaskLabel(task, orchestration);
              return (
                <div
                  key={task.sessionId}
                  className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1"
                >
                  <HarnessIcon
                    harness={task.harness}
                    className="size-3.5 shrink-0 opacity-75"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-content/75">
                    {task.title}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] ${
                      task.needsInput ||
                      task.status === "failed" ||
                      task.status === "blocked" ||
                      task.status === "interrupted"
                        ? "text-amber-400"
                        : label === "Working"
                          ? "text-accent"
                          : task.status === "completed"
                            ? "text-emerald-400"
                            : "text-content/45"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </Popover>
      ) : null}
    </div>
  );
});

function SessionRenameRow({
  session,
  isActive,
  needsApproval,
  dense = false,
  compact = false,
  onCommit,
  onCancel,
}: {
  session: SessionSummary;
  isActive: boolean;
  needsApproval: boolean;
  dense?: boolean;
  compact?: boolean;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const [value, setValue] = useState(() =>
    sessionDisplayTitle(session.title, session.harness),
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const finish = (success: boolean) => {
    if (finished.current) return;
    if (success) {
      const trimmed = value.trim();
      if (!trimmed) {
        onCancel();
        return;
      }
      finished.current = true;
      onCommit(trimmed);
      return;
    }
    finished.current = true;
    onCancel();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  };

  return (
    <div
      data-session-rename-row={session.id}
      className={`flex w-full rounded-md ${dense ? `h-8 items-center ${compact ? "pl-[46px] pr-2" : "pl-6 pr-2"}` : "flex-col px-2.5 py-2"} ${
        needsApproval
          ? "bg-amber-400/10 text-content"
          : isActive
            ? "bg-selection text-content"
            : "text-content/80"
      }`}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded bg-content/10 px-2 py-1 text-[13px] font-semibold leading-snug text-content outline-none ring-1 ring-accent/40"
      />
    </div>
  );
}

function formatGitLabel(repo?: string, branch?: string): string {
  if (repo && branch) return `${repo}/${branch}`;
  return branch || repo || "";
}

function formatRelative(value: number, now: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const seconds = Math.max(0, Math.round((now - value) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
