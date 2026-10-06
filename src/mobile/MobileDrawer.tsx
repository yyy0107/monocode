import { MobileListPreview } from "./MobileListPreview";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bot,
  ChevronDown,
  Folder,
  FolderPlus,
  Home,
  LoaderCircle,
  MessageSquarePlus,
  Pin,
  Settings,
} from "../shared/ui/icons";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import { prettyParent, projectKey, projectName } from "../shared/lib/paths";
import { ProjectMascot } from "../features/projects/ui/ProjectMascot";
import { resolveTabGroupColor } from "../features/workspace/model/tabGroups";
import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { useTranslation } from "../shared/i18n/useTranslation";
import type { HostConnectionStatus } from "./client";
import { MobileHostStatus } from "./MobileHostStatus";
import { formatMobileRelativeTime } from "./relativeTime";
import { sortMobileProjects, sortMobileSessions } from "./sessionList";
import type { MobileSheetPoint } from "./MobileSheet";
import {
  canPullDrawerFrom,
  canPushDrawerFrom,
  clampDrawer,
  drawerIntent,
  settleDrawerOpen,
} from "./drawerGesture";

// Mobile has no desktop appearance overrides, so projects use the same seeded
// mascot and colour desktop falls back to.
function ProjectIcon({ cwd }: { cwd: string }) {
  const seed = projectName(cwd);
  return (
    <span className="mobile-drawer-project-icon">
      <ProjectMascot
        project={seed}
        color={resolveTabGroupColor(
          projectKey(cwd),
          undefined,
          undefined,
          seed,
        )}
        className="size-4"
      />
    </span>
  );
}

interface ProjectHistory {
  sessions?: HostSessionSummary[];
  loading: boolean;
  failed: boolean;
}

interface Swipe {
  id: number;
  x: number;
  y: number;
  width: number;
  /** Translate when the touch began: -width when closed, 0 when open. */
  origin: number;
  opening: boolean;
  dragging: boolean;
  last: { x: number; t: number };
  velocity: number;
}

// Memoized: the drawer stays mounted under the conversation, and typing in
// the composer must not re-render every session row.
export const MobileDrawer = memo(function MobileDrawer({
  open,
  foreground = true,
  onOpenChange,
  projects,
  project,
  sessions,
  sessionId,
  loading,
  unreadIds,
  now,
  hostName,
  hostStatus,
  projectTrigger,
  onAddProject,
  onHome,
  onAllProjects,
  onProject,
  loadSessions,
  onSession,
  onSessionActions,
  sessionActionsId,
  onNewSession,
  onSettings,
  onAssistant,
  assistantName,
}: {
  open: boolean;
  foreground?: boolean;
  onOpenChange: (open: boolean) => void;
  projects: HostProject[];
  project?: HostProject;
  sessions: HostSessionSummary[];
  sessionId?: string;
  loading: boolean;
  unreadIds: ReadonlySet<string>;
  now: number;
  hostName: string;
  hostStatus: HostConnectionStatus;
  projectTrigger: RefObject<HTMLButtonElement | null>;
  onAddProject: () => void;
  onHome: () => void;
  onAllProjects: () => void;
  onProject: (project: HostProject) => void;
  /** Reads another project's conversations; the current one arrives as `sessions`. */
  loadSessions: (projectId: string) => Promise<HostSessionSummary[]>;
  onSession: (id: string, project: HostProject) => void;
  onSessionActions: (
    id: string,
    trigger: HTMLButtonElement,
    point?: MobileSheetPoint,
  ) => void;
  sessionActionsId?: string;
  onNewSession: (project: HostProject) => void;
  onSettings: () => void;
  onAssistant?: () => void;
  assistantName?: string;
}) {
  const { language, t } = useTranslation();
  // Current and running projects open automatically; manual collapses survive
  // background refreshes while this drawer lives.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(project ? [project.id] : []),
  );
  const [histories, setHistories] = useState<
    Record<string, ProjectHistory | undefined>
  >({});
  const collapsed = useRef(new Set<string>());
  // A just-opened project can precede the next project list refresh.
  const treeProjects =
    project && !projects.some((item) => item.id === project.id)
      ? [project, ...projects]
      : projects;
  const projectIds = JSON.stringify(treeProjects.map((item) => item.id));
  const historyTurn = useRef<Record<string, number>>({});
  const panel = useRef<HTMLElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const swipe = useRef<Swipe>(undefined);
  const dragClickUntil = useRef(0);
  const hold = useRef<{
    pointerId: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
    moved: boolean;
    opened: boolean;
  }>(undefined);
  const suppressClick = useRef({ id: "", until: 0 });
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = undefined;
  };
  const showSessionActions = (
    id: string,
    trigger: HTMLButtonElement,
    point?: MobileSheetPoint,
  ) => {
    if (hold.current) {
      clearTimeout(hold.current.timer);
      hold.current.opened = true;
    }
    swipe.current = undefined;
    setDragging(false);
    onSessionActions(id, trigger, point);
  };
  useEffect(() => {
    cancelHold();
    return cancelHold;
  }, [open, project?.id]);
  const startHold = (
    id: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    cancelHold();
    suppressClick.current.until = 0;
    if (event.pointerType === "mouse" || event.button !== 0) return;
    const trigger = event.currentTarget;
    const press = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      opened: false,
      timer: setTimeout(() => {
        press.opened = true;
        suppressClick.current = { id, until: Infinity };
        showSessionActions(id, trigger, { x: press.x, y: press.y });
      }, 450),
    };
    hold.current = press;
  };
  // While a finger moves the drawer, its position is written straight to the
  // DOM: a React render per pointer move would rebuild every session row.
  const [dragging, setDragging] = useState(false);
  const follow = (translate: number, width: number) => {
    panel.current?.style.setProperty("transform", `translateX(${translate}px)`);
    backdrop.current?.style.setProperty(
      "--mobile-drawer-progress",
      String(1 + translate / width),
    );
  };
  const followRef = useRef(follow);
  followRef.current = follow;
  // Settled positions come from the stylesheet; the commit that ends a drag
  // also clears its inline position, so the transition starts from the finger.
  useLayoutEffect(() => {
    if (dragging) return;
    panel.current?.style.removeProperty("transform");
    backdrop.current?.style.setProperty(
      "--mobile-drawer-progress",
      open ? "1" : "0",
    );
  }, [open, dragging]);
  const latest = useRef({ open, onOpenChange });
  latest.current = { open, onOpenChange };
  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (
        trigger?.isConnected &&
        panel.current?.contains(document.activeElement)
      )
        trigger.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (project) {
      collapsed.current.delete(project.id);
      setExpanded((current) =>
        current.has(project.id) ? current : new Set(current).add(project.id),
      );
    }
  }, [project?.id]);
  const readHistory = useCallback(
    async (projectId: string) => {
      const turn = (historyTurn.current[projectId] ?? 0) + 1;
      historyTurn.current[projectId] = turn;
      setHistories((current) => ({
        ...current,
        [projectId]: { ...current[projectId], loading: true, failed: false },
      }));
      try {
        const sessions = await loadSessions(projectId);
        if (historyTurn.current[projectId] === turn)
          setHistories((current) => ({
            ...current,
            [projectId]: { sessions, loading: false, failed: false },
          }));
      } catch {
        if (historyTurn.current[projectId] === turn)
          setHistories((current) => ({
            ...current,
            [projectId]: {
              ...current[projectId],
              loading: false,
              failed: true,
            },
          }));
      }
    },
    [loadSessions],
  );
  // Collapsed projects need summaries too for activity order and running state.
  // The app already polls the current project's list.
  useEffect(() => {
    if (!open || !foreground) return;
    const ids: string[] = JSON.parse(projectIds);
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      await Promise.allSettled(
        ids.filter((id) => id !== project?.id).map(readHistory),
      );
      if (live) timer = setTimeout(refresh, 3_000);
    };
    void refresh();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, foreground, projectIds, project?.id, readHistory]);
  useEffect(() => {
    if (!open || !foreground) return;
    const ids: string[] = JSON.parse(projectIds);
    setExpanded((current) => {
      const running = ids.filter(
        (id) =>
          !current.has(id) &&
          !collapsed.current.has(id) &&
          (id === project?.id
            ? sessions
            : (histories[id]?.sessions ?? [])
          ).some((item) => !item.archived && item.status === "running"),
      );
      return running.length ? new Set([...current, ...running]) : current;
    });
  }, [open, foreground, projectIds, project?.id, sessions, histories]);
  const toggleProject = (item: HostProject) => {
    const opening = !expanded.has(item.id);
    if (opening) collapsed.current.delete(item.id);
    else collapsed.current.add(item.id);
    setExpanded((current) => {
      const next = new Set(current);
      if (opening) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
    if (
      opening &&
      item.id !== project?.id &&
      !histories[item.id]?.loading &&
      (!histories[item.id]?.sessions || histories[item.id]?.failed)
    )
      void readHistory(item.id);
  };

  // One gesture pipeline: a pull on the conversation opens the drawer, a push
  // anywhere on screen closes it. The drawer follows the finger
  // and settles by distance or flick speed.
  useEffect(() => {
    const begin = (event: PointerEvent) => {
      // A new touch means the previous drag produced no click to swallow.
      dragClickUntil.current = 0;
      if (event.pointerType === "mouse" || swipe.current) return;
      const element = panel.current;
      if (!element) return;
      const { open } = latest.current;
      if (!(open ? canPushDrawerFrom : canPullDrawerFrom)(event.target)) return;
      const width = element.offsetWidth;
      swipe.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        width,
        origin: open ? 0 : -width,
        opening: !open,
        dragging: false,
        last: { x: event.clientX, t: event.timeStamp },
        velocity: 0,
      };
    };
    const move = (event: PointerEvent) => {
      const current = swipe.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x;
      if (!current.dragging) {
        const intent = drawerIntent(
          dx,
          event.clientY - current.y,
          current.opening,
        );
        if (intent === "undecided") return;
        if (intent === "scroll") {
          swipe.current = undefined;
          return;
        }
        current.dragging = true;
        // The gesture now belongs to the drawer, not to text selection or a
        // pending long press on a session row.
        window.getSelection()?.removeAllRanges();
        cancelHold();
        // Drop the settle transition before the first inline position lands,
        // rather than when React next commits.
        if (backdrop.current) backdrop.current.dataset.dragging = "true";
        setDragging(true);
      }
      const elapsed = event.timeStamp - current.last.t;
      if (elapsed > 0)
        current.velocity = (event.clientX - current.last.x) / elapsed;
      current.last = { x: event.clientX, t: event.timeStamp };
      followRef.current(
        clampDrawer(current.origin + dx, current.width),
        current.width,
      );
    };
    const end = (event: PointerEvent) => {
      const current = swipe.current;
      if (!current || current.id !== event.pointerId) return;
      swipe.current = undefined;
      if (!current.dragging) return;
      // A drag may start on a button; the click that follows must not land.
      dragClickUntil.current = Date.now() + 400;
      const translate = clampDrawer(
        current.origin + event.clientX - current.x,
        current.width,
      );
      const open =
        event.type === "pointercancel"
          ? latest.current.open
          : settleDrawerOpen(translate, current.width, current.velocity);
      setDragging(false);
      if (open !== latest.current.open) latest.current.onOpenChange(open);
    };
    const swallowClick = (event: MouseEvent) => {
      if (Date.now() >= dragClickUntil.current) return;
      dragClickUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
    };
    // Once the drawer owns a drag, keep the browser from turning the same
    // touch into a scroll or navigation, which would cancel the pointer and
    // snap the drawer back mid-gesture.
    const holdTouch = (event: TouchEvent) => {
      if (swipe.current?.dragging && event.cancelable) event.preventDefault();
    };
    document.addEventListener("pointerdown", begin, true);
    document.addEventListener("touchmove", holdTouch, {
      capture: true,
      passive: false,
    });
    document.addEventListener("click", swallowClick, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
    return () => {
      document.removeEventListener("pointerdown", begin, true);
      document.removeEventListener("touchmove", holdTouch, true);
      document.removeEventListener("click", swallowClick, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
  }, []);

  const tree = sortMobileProjects(treeProjects, (id) =>
    id === project?.id ? sessions : (histories[id]?.sessions ?? []),
  );
  const minimumVisibleProjects = tree.reduce(
    (count, item, index) =>
      expanded.has(item.id) ? Math.max(count, index + 1) : count,
    5,
  );
  const duplicateNames = new Set(
    tree
      .map((item) => item.name)
      .filter((name, index, names) => names.indexOf(name) !== index),
  );
  const projectHistory = (item: HostProject): ProjectHistory =>
    item.id === project?.id
      ? { sessions, loading: loading && !sessions.length, failed: false }
      : (histories[item.id] ?? { loading: true, failed: false });
  const row = (item: HostSessionSummary, owner: HostProject) => {
    // Actions edit through the current project's summary list.
    const actionable = owner.id === project?.id;
    return (
      <button
        type="button"
        className="mobile-list-row mobile-session-row"
        key={item.id}
        data-session-id={item.id}
        aria-current={item.id === sessionId ? "page" : undefined}
        aria-haspopup={actionable ? "dialog" : undefined}
        aria-expanded={actionable ? sessionActionsId === item.id : undefined}
        onPointerDown={(event) => {
          if (actionable) startHold(item.id, event);
        }}
        onPointerMove={(event) => {
          const press = hold.current;
          if (!press || press.pointerId !== event.pointerId) return;
          if (
            Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10
          ) {
            press.moved = true;
            clearTimeout(press.timer);
          }
        }}
        onPointerUp={(event) => {
          const press = hold.current;
          if (!press || press.pointerId !== event.pointerId) return;
          if (press.moved || press.opened)
            suppressClick.current = { id: item.id, until: Date.now() + 500 };
          cancelHold();
        }}
        onPointerCancel={() => {
          suppressClick.current = { id: item.id, until: Date.now() + 500 };
          cancelHold();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!actionable) return;
          suppressClick.current = { id: item.id, until: Date.now() + 500 };
          const press = hold.current;
          const point = press
            ? { x: press.x, y: press.y }
            : event.clientX || event.clientY
              ? { x: event.clientX, y: event.clientY }
              : undefined;
          showSessionActions(item.id, event.currentTarget, point);
        }}
        onClick={(event) => {
          if (
            suppressClick.current.id === item.id &&
            Date.now() < suppressClick.current.until
          ) {
            event.preventDefault();
            return;
          }
          onSession(item.id, owner);
        }}
      >
        <span className="mobile-row-text">
          <HarnessIcon
            harness={item.harness}
            className="size-3.5 shrink-0 self-center"
          />
          <strong>
            {sessionDisplayTitle(item.title, item.harness) ||
              t("Untitled conversation")}
          </strong>
          <small>
            {item.status === "running" ? (
              <LoaderCircle size={16} className="mobile-spin" />
            ) : item.needsInput ? (
              <span className="mobile-attention-dot" />
            ) : item.pinned ? (
              <Pin size={12} aria-label={t("Pin")} />
            ) : null}
            <span>
              {formatMobileRelativeTime(item.updatedAt, now, language)}
            </span>
            {unreadIds.has(item.id) ? (
              <span
                className="mobile-unread-dot"
                role="img"
                aria-label={t("Unread reply")}
              />
            ) : null}
          </small>
        </span>
      </button>
    );
  };
  const group = (item: HostProject) => {
    const open = expanded.has(item.id);
    const history = projectHistory(item);
    const ordered = sortMobileSessions(history.sessions ?? []);
    return (
      <section
        className="mobile-drawer-group"
        key={item.id}
        data-current={item.id === project?.id || undefined}
      >
        <div className="mobile-drawer-group-head">
          <button
            type="button"
            className="mobile-drawer-project-link"
            title={item.cwd}
            onClick={() => onProject(item)}
          >
            <ProjectIcon cwd={item.cwd} />
            <span className="mobile-drawer-group-title">
              <strong>{item.name}</strong>
              {duplicateNames.has(item.name) && (
                <small className="mobile-drawer-path">
                  <bdi>{prettyParent(item.cwd)}</bdi>
                </small>
              )}
            </span>
          </button>
          <button
            type="button"
            className="mobile-drawer-group-toggle"
            aria-expanded={open}
            aria-label={t("Conversations in {project}", {
              project: item.name,
            })}
            onClick={() => toggleProject(item)}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        <AnimatedCollapse expanded={open}>
          {history.loading && !history.sessions ? (
            <div className="mobile-loading mobile-drawer-group-status">
              <LoaderCircle className="mobile-spin" size={16} />
              {t("Loading conversations…")}
            </div>
          ) : history.failed && !history.sessions ? (
            <button
              type="button"
              className="mobile-drawer-empty mobile-drawer-group-status"
              onClick={() => readHistory(item.id)}
            >
              {t("Couldn’t load sessions")} · {t("Retry")}
            </button>
          ) : ordered.length ? (
            <div className="mobile-list mobile-session-list">
              <MobileListPreview buttonClassName="mobile-drawer-more">
                {ordered.map((session) => row(session, item))}
              </MobileListPreview>
            </div>
          ) : (
            <p className="mobile-drawer-empty mobile-drawer-group-status">
              {t("No conversations yet")}
            </p>
          )}
        </AnimatedCollapse>
      </section>
    );
  };
  return (
    <div
      ref={backdrop}
      className="mobile-drawer-backdrop"
      data-open={open}
      data-dragging={dragging || undefined}
      inert={!open && !dragging}
      aria-hidden={!open && !dragging}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <nav
        ref={panel}
        className="mobile-drawer"
        aria-label={t("Menu")}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <div className="mobile-drawer-top">
          {onAssistant && (
            <button
              type="button"
              className="mobile-drawer-item"
              onClick={onAssistant}
            >
              <Bot size={18} />
              <span>{assistantName || t("Assistant")}</span>
            </button>
          )}
          <button type="button" className="mobile-drawer-item" onClick={onHome}>
            <Home size={18} />
            <span>{t("Home")}</span>
          </button>
          <button
            type="button"
            className="mobile-drawer-new"
            disabled={!project}
            onClick={() => project && onNewSession(project)}
          >
            <MessageSquarePlus size={18} />
            <span>{t("New conversation")}</span>
          </button>
        </div>
        <div className="mobile-drawer-sessions">
          <button
            type="button"
            className="mobile-drawer-item mobile-drawer-all-projects"
            onClick={onAllProjects}
          >
            <Folder size={18} />
            <span>{t("All projects")}</span>
          </button>
          {tree.length ? (
            <MobileListPreview
              buttonClassName="mobile-drawer-more"
              minimumVisibleCount={minimumVisibleProjects}
            >
              {tree.map(group)}
            </MobileListPreview>
          ) : (
            <p className="mobile-drawer-empty">{t("Choose a project")}</p>
          )}
          <button
            type="button"
            ref={projectTrigger}
            className="mobile-drawer-item mobile-drawer-open-project"
            onClick={onAddProject}
          >
            <FolderPlus size={18} />
            <span>{t("Open project")}</span>
          </button>
        </div>
        <button
          type="button"
          className="mobile-drawer-settings"
          onClick={onSettings}
        >
          <Settings size={20} />
          <span>{t("Settings")}</span>
          <span className="mobile-drawer-host">
            <span>{hostName}</span>
            <MobileHostStatus status={hostStatus} />
          </span>
        </button>
      </nav>
    </div>
  );
});
