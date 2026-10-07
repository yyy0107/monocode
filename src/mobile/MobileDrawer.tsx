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
  Folder,
  FolderPlus,
  Home,
  LoaderCircle,
  MessageSquarePlus,
  Pin,
  Settings,
  TriangleAlert,
} from "../shared/ui/icons";
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
  open: requestedOpen,
  active = true,
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
  loadSessions,
  cachedSessions,
  onSession,
  onSessionActions,
  sessionActionsId,
  onNewSession,
  onSettings,
  onAssistant,
  assistantName,
}: {
  open: boolean;
  /** Keep the closing drawer mounted without accepting edge gestures on another page. */
  active?: boolean;
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
  /** Reads another project's conversations; the current one arrives as `sessions`. */
  loadSessions: (projectId: string) => Promise<HostSessionSummary[]>;
  cachedSessions?: (projectId: string) => HostSessionSummary[] | undefined;
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
  const open = requestedOpen && active;
  // A just-opened project can precede the next project list refresh.
  const treeProjects =
    project && !projects.some((item) => item.id === project.id)
      ? [project, ...projects]
      : projects;
  const projectIds = JSON.stringify(treeProjects.map((item) => item.id));
  const [histories, setHistories] = useState<
    Record<string, ProjectHistory | undefined>
  >(() => Object.fromEntries(treeProjects.flatMap((item) => {
    const sessions = cachedSessions?.(item.id);
    return sessions ? [[item.id, { sessions, loading: false, failed: false }]] : [];
  })));
  // Home and chat can refresh the shared cache while the drawer stays closed.
  useLayoutEffect(() => {
    const ids: string[] = JSON.parse(projectIds);
    setHistories((current) => {
      let next = current;
      for (const id of ids) {
        if (!open && current[id]) continue;
        const sessions = cachedSessions?.(id);
        if (sessions && current[id]?.sessions !== sessions)
          next = { ...next, [id]: { sessions, loading: false, failed: false } };
      }
      return next;
    });
  }, [open, projectIds, cachedSessions]);
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
  useLayoutEffect(() => {
    if (active) return;
    swipe.current = undefined;
    cancelHold();
    setDragging(false);
  }, [active]);
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
  // Every project feeds the flat Pinned and Recents lists.
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
  // One gesture pipeline: a pull on the conversation opens the drawer, a push
  // anywhere on screen closes it. The drawer follows the finger
  // and settles by distance or flick speed.
  useEffect(() => {
    if (!active) return;
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
      swipe.current = undefined;
    };
  }, [active]);

  const tree = sortMobileProjects(treeProjects, (id) =>
    id === project?.id ? sessions : (histories[id]?.sessions ?? []),
  );
  const projectHistory = (item: HostProject): ProjectHistory =>
    item.id === project?.id
      ? { sessions, loading: loading && !sessions.length, failed: false }
      : (histories[item.id] ?? { loading: true, failed: false });
  const treeLoading = !tree.some((item) => item.id === project?.id
    ? sessions.length > 0 || cachedSessions?.(item.id) !== undefined
    : histories[item.id]?.sessions !== undefined) &&
    tree.some((item) => projectHistory(item).loading);
  const ownerById = new Map(tree.map((item) => [item.id, item]));
  const allSessions = sortMobileSessions(
    tree.flatMap((item) => projectHistory(item).sessions ?? []),
  ).filter((item) => ownerById.has(item.projectId));
  const pins = allSessions.filter((item) => item.pinned);
  const recents = allSessions.filter((item) => !item.pinned);
  const failedProjects = tree.filter((item) => {
    const history = projectHistory(item);
    return history.failed && !history.sessions;
  });
  const row = (item: HostSessionSummary) => {
    const owner = ownerById.get(item.projectId)!;
    // Actions edit through the current project's summary list.
    const actionable = owner.id === project?.id;
    return (
      <button
        type="button"
        className="mobile-list-row mobile-session-row"
        key={item.id}
        data-session-id={item.id}
        data-needs-input={item.needsInput || undefined}
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
            {item.needsInput ? (
              <span className="mobile-session-attention">
                <TriangleAlert size={14} aria-hidden="true" />
                {t("Needs input")}
              </span>
            ) : item.status === "running" ? (
              <LoaderCircle size={16} className="mobile-spin" aria-label={t("Working")} />
            ) : item.pinned ? (
              <Pin size={12} aria-label={t("Pin")} />
            ) : null}
            {tree.length > 1 && (
              <span className="mobile-drawer-session-project">{owner.name}</span>
            )}
            {!item.needsInput && <span>
              {formatMobileRelativeTime(item.updatedAt, now, language)}
            </span>}
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
            <span>{t("Sessions")}</span>
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
            <span>{t("Projects")}</span>
          </button>
          <button
            type="button"
            ref={projectTrigger}
            className="mobile-drawer-item mobile-drawer-open-project"
            onClick={onAddProject}
          >
            <FolderPlus size={18} />
            <span>{t("Open project")}</span>
          </button>
          {treeLoading ? (
            <div className="mobile-loading mobile-drawer-group-status" role="status">
              <LoaderCircle size={15} className="mobile-spin" />
              {t("Loading conversations…")}
            </div>
          ) : !tree.length ? (
            <p className="mobile-drawer-empty">{t("Choose a project")}</p>
          ) : (
            <>
              {!!pins.length && (
                <section className="mobile-drawer-group" aria-label={t("Pinned")}>
                  <h2 className="mobile-drawer-heading">{t("Pinned")}</h2>
                  <div className="mobile-list mobile-session-list">
                    {pins.map(row)}
                  </div>
                </section>
              )}
              <section className="mobile-drawer-group" aria-label={t("Recents")}>
                <h2 className="mobile-drawer-heading">{t("Recents")}</h2>
                {recents.length ? (
                  <div className="mobile-list mobile-session-list">
                    <MobileListPreview
                      buttonClassName="mobile-drawer-more"
                      initialLimit={20}
                      items={recents}
                      renderItem={row}
                    />
                  </div>
                ) : (
                  <p className="mobile-drawer-empty mobile-drawer-group-status">
                    {t("No conversations yet")}
                  </p>
                )}
              </section>
              {failedProjects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mobile-drawer-empty mobile-drawer-group-status"
                  onClick={() => readHistory(item.id)}
                >
                  {t("Couldn’t load sessions")} · {item.name} · {t("Retry")}
                </button>
              ))}
            </>
          )}
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
