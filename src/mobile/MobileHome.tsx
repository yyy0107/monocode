import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { useTranslation } from "../shared/i18n/useTranslation";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import {
  ChevronDown,
  Computer,
  Folder,
  FolderPlus,
  LoaderCircle,
  MessageSquarePlus,
  Search,
} from "../shared/ui/icons";
import type { HostConnectionStatus } from "./client";
import type { MobileSheetPoint } from "./MobileSheet";
import { MobileHostStatus } from "./MobileHostStatus";
import { MobileListPreview } from "./MobileListPreview";
import { formatMobileRelativeTime } from "./relativeTime";
import { sortMobileSessions } from "./sessionList";

interface History {
  sessions?: HostSessionSummary[];
  failed: boolean;
}

/** The same list surface serves Home, All projects and a single project. */
export function MobileHome({
  projects,
  project,
  hostName,
  hostStatus,
  foreground,
  inactive,
  query,
  now,
  unreadIds,
  loadSessions,
  onProject,
  onSession,
  onNewSession,
  onSearch,
  searchOpen = false,
  searchTrigger,
  onAddProject,
  onSessionActions,
  sessionActionsId,
  refreshKey = 0,
}: {
  projects: HostProject[];
  project?: HostProject;
  hostName: string;
  hostStatus: HostConnectionStatus;
  foreground: boolean;
  inactive?: boolean;
  query: string;
  now: number;
  unreadIds: ReadonlySet<string>;
  loadSessions: (projectId: string) => Promise<HostSessionSummary[]>;
  onProject: (project: HostProject) => void;
  onSession: (id: string, project: HostProject) => void;
  onNewSession: () => void;
  onSearch: () => void;
  searchOpen?: boolean;
  searchTrigger?: RefObject<HTMLButtonElement | null>;
  onAddProject: (trigger: HTMLButtonElement) => void;
  onSessionActions?: (session: HostSessionSummary, trigger: HTMLButtonElement, point?: MobileSheetPoint) => void;
  sessionActionsId?: string;
  refreshKey?: number;
}) {
  const { language, t } = useTranslation();
  const [histories, setHistories] = useState<Record<string, History>>({});
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [retry, setRetry] = useState(0);
  const hold = useRef<{ pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout>; moved: boolean; opened: boolean } | undefined>(undefined);
  const suppressClick = useRef<string | undefined>(undefined);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = undefined;
  };
  useEffect(() => {
    cancelHold();
    return cancelHold;
  }, [inactive, foreground, project?.id, query]);
  const owners = project ? [project] : projects;
  const idsKey = JSON.stringify(owners.map((item) => item.id));

  useEffect(() => {
    if (!foreground) return;
    const ids: string[] = JSON.parse(idsKey);
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const results = await Promise.allSettled(
        ids.map((id) => loadSessions(id)),
      );
      if (!live) return;
      setHistories((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          const id = ids[index];
          next[id] =
            result.status === "fulfilled"
              ? { sessions: result.value, failed: false }
              : { sessions: current[id]?.sessions, failed: true };
        });
        return next;
      });
      timer = setTimeout(refresh, 3_000);
    };
    void refresh();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [idsKey, foreground, loadSessions, retry, refreshKey]);

  const orderedProjects = projects
    .map((item) => ({
      project: item,
      updatedAt: (histories[item.id]?.sessions ?? []).reduce(
        (latest, session) =>
          session.archived ? latest : Math.max(latest, session.updatedAt),
        0,
      ),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => item.project);
  const ownerById = new Map(owners.map((item) => [item.id, item]));
  const needle = query.trim().toLocaleLowerCase();
  const ordered = sortMobileSessions(
    owners.flatMap((item) => histories[item.id]?.sessions ?? []),
  )
    .filter((item) => ownerById.has(item.projectId))
    .filter(
      (item) =>
        !needle ||
        `${sessionDisplayTitle(item.title, item.harness) || t("Untitled conversation")} ${ownerById.get(item.projectId)?.name}`
          .toLocaleLowerCase()
          .includes(needle),
    );
  const pins = ordered.filter((item) => item.pinned);
  const recent = ordered.filter((item) => !item.pinned);
  const loading = owners.some((item) => !histories[item.id]);
  const failed = owners.filter((item) => histories[item.id]?.failed);
  const row = (item: HostSessionSummary) => {
    const owner = ownerById.get(item.projectId)!;
    return (
      <button
        type="button"
        className="mobile-home-session"
        key={item.id}
        data-session-id={item.id}
        aria-haspopup={onSessionActions ? "dialog" : undefined}
        aria-expanded={sessionActionsId === item.id}
        onPointerDown={(event) => {
          cancelHold();
          suppressClick.current = undefined;
          if (!onSessionActions || inactive || event.button !== 0) return;
          const trigger = event.currentTarget;
          const press = {
            pointerId: event.pointerId, x: event.clientX, y: event.clientY,
            moved: false, opened: false,
            timer: setTimeout(() => {
              press.opened = true;
              suppressClick.current = item.id;
              onSessionActions(item, trigger, { x: press.x, y: press.y });
            }, 450),
          };
          hold.current = press;
        }}
        onPointerMove={(event) => {
          const press = hold.current;
          if (!press || press.pointerId !== event.pointerId) return;
          if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) {
            press.moved = true;
            clearTimeout(press.timer);
            suppressClick.current = item.id;
          }
        }}
        onPointerUp={cancelHold}
        onPointerCancel={() => {
          suppressClick.current = item.id;
          cancelHold();
        }}
        onPointerLeave={cancelHold}
        onContextMenu={(event) => {
          if (!onSessionActions || inactive) return;
          event.preventDefault();
          cancelHold();
          suppressClick.current = item.id;
          onSessionActions(item, event.currentTarget, event.clientX || event.clientY
            ? { x: event.clientX, y: event.clientY } : undefined);
        }}
        onKeyDown={(event) => {
          suppressClick.current = undefined;
          if (onSessionActions && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
            event.preventDefault();
            onSessionActions(item, event.currentTarget);
          }
        }}
        onClick={(event) => {
          if (suppressClick.current === item.id) {
            event.preventDefault();
            suppressClick.current = undefined;
            return;
          }
          onSession(item.id, owner);
        }}
      >
        <span className="mobile-home-session-text">
          <strong>
            <HarnessIcon harness={item.harness} className="size-3.5 shrink-0" />
            <span>
              {sessionDisplayTitle(item.title, item.harness) ||
                t("Untitled conversation")}
            </span>
          </strong>
          {item.status === "running" && (
            <small>
              <LoaderCircle size={13} className="mobile-spin" />
              <span>{t("Working")}</span>
            </small>
          )}
        </span>
        <time dateTime={new Date(item.updatedAt).toISOString()}>
          {formatMobileRelativeTime(item.updatedAt, now, language)}
        </time>
        {unreadIds.has(item.id) && (
          <span
            className="mobile-unread-dot"
            role="img"
            aria-label={t("Unread reply")}
          />
        )}
      </button>
    );
  };

  return (
    <main
      className="mobile-home"
      data-project={!!project}
      inert={inactive}
      aria-hidden={inactive || undefined}
    >
      <div className="mobile-home-scroll" key={project?.id ?? "all"}>
        {!project && (
          <div className="mobile-home-host">
            <Computer size={16} />
            <span>{hostName}</span>
            <MobileHostStatus status={hostStatus} />
          </div>
        )}
        {!project && !needle && (
          <section className="mobile-home-projects" aria-label={t("Projects")}>
            <h2>{t("Projects")}</h2>
            <MobileListPreview>{orderedProjects.map((item) => (
              <button
                type="button"
                className="mobile-home-project"
                key={item.id}
                title={item.cwd}
                onClick={() => onProject(item)}
              >
                <Folder size={23} />
                <span>
                  <strong>{item.name}</strong>
                </span>
              </button>
            ))}</MobileListPreview>
            <button
              type="button"
              className="mobile-home-project mobile-home-add"
              onClick={(event) => onAddProject(event.currentTarget)}
            >
              <FolderPlus size={21} />
              <span>{t("Open project")}</span>
            </button>
          </section>
        )}
        {!!pins.length && (
          <section className="mobile-home-pinned">
            <button
              type="button"
              className="mobile-home-section-toggle"
              aria-expanded={pinnedOpen}
              onClick={() => setPinnedOpen((open) => !open)}
            >
              <h2>{t("Pinned")}</h2>
              <ChevronDown size={18} />
            </button>
            <AnimatedCollapse expanded={pinnedOpen}>
              <MobileListPreview key={needle}>{pins.map(row)}</MobileListPreview>
            </AnimatedCollapse>
          </section>
        )}
        <section className="mobile-home-recent" aria-label={t("Recent")}>
          {!project && <h2>{t("Recent")}</h2>}
          <MobileListPreview key={needle} initialLimit={20}>{recent.map(row)}</MobileListPreview>
          {loading && (
            <div className="mobile-loading" role="status">
              <LoaderCircle className="mobile-spin" size={18} />
              {t("Loading conversations…")}
            </div>
          )}
          {!ordered.length && !loading && !failed.length && (
            <p className="mobile-home-empty">
              {needle
                ? t("No matching conversations")
                : t("No conversations yet")}
            </p>
          )}
          {!!failed.length && (
            <div className="mobile-home-error" role="alert">
              <span>
                {t("Couldn’t load sessions")} ·{" "}
                {failed.map((item) => item.name).join(", ")}
              </span>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                {t("Retry")}
              </button>
            </div>
          )}
        </section>
      </div>
      {!!projects.length && (
        <div className="mobile-home-dock">
          {project && (
            <button
              ref={searchTrigger}
              type="button"
              className="mobile-home-search"
              aria-label={t(searchOpen ? "Close search" : "Search conversations")}
              aria-expanded={searchOpen}
              onClick={onSearch}
            >
              <Search size={22} />
              <span>{query || t("Search conversations")}</span>
            </button>
          )}
          <button
            type="button"
            className="mobile-home-new"
            aria-label={t("New conversation")}
            onClick={onNewSession}
          >
            <MessageSquarePlus size={22} />
            <span>{t(project ? "Chat" : "New conversation")}</span>
          </button>
        </div>
      )}
    </main>
  );
}
