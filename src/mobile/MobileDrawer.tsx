import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronDown,
  Folder,
  FolderPlus,
  LoaderCircle,
  MessageSquarePlus,
  Settings,
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
import { sortMobileSessions } from "./sessionList";
import type { MobileSheetPoint } from "./MobileSheet";
import {
  canPullDrawerFrom,
  clampDrawer,
  drawerIntent,
  settleDrawerOpen,
} from "./drawerGesture";

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

export function MobileDrawer({
  open,
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
  onProject,
  onAddProject,
  onSession,
  onSessionActions,
  sessionActionsId,
  onNewSession,
  onSettings,
}: {
  open: boolean;
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
  onProject: (project: HostProject) => void;
  onAddProject: () => void;
  onSession: (id: string) => void;
  onSessionActions: (
    id: string,
    trigger: HTMLButtonElement,
    point?: MobileSheetPoint,
  ) => void;
  sessionActionsId?: string;
  onNewSession: () => void;
  onSettings: () => void;
}) {
  const { language, t } = useTranslation();
  const [choosingProject, setChoosingProject] = useState(!project);
  const panel = useRef<HTMLElement>(null);
  const swipe = useRef<Swipe>(undefined);
  const justDragged = useRef(false);
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
    setDrag(undefined);
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
  // Live translateX while a finger moves the drawer; undefined when settled.
  const [drag, setDrag] = useState<number>();
  const latest = useRef({ open, onOpenChange });
  latest.current = { open, onOpenChange };
  const close = () => onOpenChange(false);

  useEffect(() => {
    if (!open) {
      setChoosingProject(!project);
      return;
    }
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
    if (!project) setChoosingProject(true);
  }, [project]);

  // One gesture pipeline: a pull on the conversation opens the drawer, a push
  // on the open drawer or its backdrop closes it. The drawer follows the finger
  // and settles by distance or flick speed.
  useEffect(() => {
    const begin = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || swipe.current) return;
      const element = panel.current;
      if (!element) return;
      const { open } = latest.current;
      if (open) {
        if (!(event.target instanceof Element)) return;
        if (!event.target.closest(".mobile-drawer-backdrop")) return;
      } else if (!canPullDrawerFrom(event.target)) return;
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
        // The gesture now belongs to the drawer, not to text selection.
        window.getSelection()?.removeAllRanges();
      }
      const elapsed = event.timeStamp - current.last.t;
      if (elapsed > 0)
        current.velocity = (event.clientX - current.last.x) / elapsed;
      current.last = { x: event.clientX, t: event.timeStamp };
      setDrag(clampDrawer(current.origin + dx, current.width));
    };
    const end = (event: PointerEvent) => {
      const current = swipe.current;
      if (!current || current.id !== event.pointerId) return;
      swipe.current = undefined;
      if (!current.dragging) return;
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
      const translate = clampDrawer(
        current.origin + event.clientX - current.x,
        current.width,
      );
      const open =
        event.type === "pointercancel"
          ? latest.current.open
          : settleDrawerOpen(translate, current.width, current.velocity);
      setDrag(undefined);
      if (open !== latest.current.open) latest.current.onOpenChange(open);
    };
    document.addEventListener("pointerdown", begin, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
    return () => {
      document.removeEventListener("pointerdown", begin, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
  }, []);

  const dragging = drag !== undefined;
  const width = swipe.current?.width ?? panel.current?.offsetWidth ?? 320;
  const progress = dragging ? 1 + drag / width : open ? 1 : 0;
  const ordered = sortMobileSessions(sessions);
  const pinned = ordered.filter((item) => item.pinned);
  const recent = ordered.filter((item) => !item.pinned);
  const row = (item: HostSessionSummary) => (
    <button
      type="button"
      className="mobile-list-row mobile-session-row"
      key={item.id}
      data-session-id={item.id}
      aria-current={item.id === sessionId ? "page" : undefined}
      aria-haspopup="dialog"
      aria-expanded={sessionActionsId === item.id}
      onPointerDown={(event) => startHold(item.id, event)}
      onPointerMove={(event) => {
        const press = hold.current;
        if (!press || press.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) {
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
          justDragged.current ||
          (suppressClick.current.id === item.id &&
            Date.now() < suppressClick.current.until)
        ) {
          event.preventDefault();
          return;
        }
        onSession(item.id);
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
          ) : null}
          <span>{formatMobileRelativeTime(item.updatedAt, now, language)}</span>
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
  return (
    <div
      className="mobile-drawer-backdrop"
      data-open={open}
      data-dragging={dragging || undefined}
      inert={!open && !dragging}
      aria-hidden={!open && !dragging}
      style={{ "--mobile-drawer-progress": progress } as CSSProperties}
      onClick={(event) => {
        if (event.target === event.currentTarget && !justDragged.current)
          close();
      }}
    >
      <nav
        ref={panel}
        className="mobile-drawer"
        aria-label={t("Menu")}
        tabIndex={-1}
        style={dragging ? { transform: `translateX(${drag}px)` } : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <div className="mobile-drawer-top">
          <button
            type="button"
            className="mobile-drawer-project"
            aria-expanded={choosingProject}
            onClick={() => setChoosingProject((open) => !open)}
          >
            <Folder size={18} />
            <span>{project?.name || t("Choose a project")}</span>
            <ChevronDown size={16} />
          </button>
          <div
            className="mobile-drawer-project-region"
            data-open={choosingProject}
            inert={!choosingProject}
            aria-hidden={!choosingProject}
          >
            <div className="mobile-drawer-project-clip">
              <div className="mobile-drawer-projects" role="radiogroup">
                {projects.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={item.id === project?.id}
                    className="mobile-drawer-item"
                    key={item.id}
                    onClick={() => {
                      setChoosingProject(false);
                      if (item.id !== project?.id) onProject(item);
                    }}
                  >
                    <span className="mobile-row-text">
                      <strong>{item.name}</strong>
                      <small>{item.cwd}</small>
                    </span>
                    {item.id === project?.id && <Check size={18} />}
                  </button>
                ))}
                <button
                  type="button"
                  ref={projectTrigger}
                  className="mobile-drawer-item"
                  onClick={onAddProject}
                >
                  <FolderPlus size={18} />
                  <span>{t("Open project")}</span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-new"
            disabled={!project}
            onClick={onNewSession}
          >
            <MessageSquarePlus size={18} />
            <span>{t("New conversation")}</span>
          </button>
        </div>
        <div className="mobile-drawer-sessions">
          {loading && !sessions.length ? (
            <div className="mobile-loading">
              <LoaderCircle className="mobile-spin" size={18} />
              {t("Loading conversations…")}
            </div>
          ) : !project ? null : ordered.length ? (
            <>
              {pinned.length > 0 && (
                <>
                  <p className="mobile-section-label">{t("Pin")}</p>
                  <div className="mobile-list mobile-session-list">
                    {pinned.map(row)}
                  </div>
                </>
              )}
              {recent.length > 0 && (
                <>
                  <p className="mobile-section-label">{t("Recent")}</p>
                  <div className="mobile-list mobile-session-list">
                    {recent.map(row)}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="mobile-drawer-empty">{t("No conversations yet")}</p>
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
}
