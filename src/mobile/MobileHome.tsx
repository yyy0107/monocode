import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { useTranslation } from "../shared/i18n/useTranslation";
import { useMobilePageState } from "./mobilePageState";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import {
  Check,
  ChevronDown,
  Computer,
  Folder,
  FolderPlus,
  LoaderCircle,
  MessageSquarePlus,
  Plus,
  Search,
} from "../shared/ui/icons";
import type { HostConnectionStatus } from "./client";
import { MobileSheet, type MobileSheetPoint } from "./MobileSheet";
import { MobileHostStatus } from "./MobileHostStatus";
import { MobileListPreview } from "./MobileListPreview";
import { MobileSessionCard } from "./MobileSessionCard";
import { sortMobileProjects } from "./sessionList";
import {
  filterMobileSessions,
  MOBILE_SESSION_FILTER_LABELS,
  MOBILE_SESSION_FILTERS,
  type MobileSessionFilter,
} from "./sessionFilter";

interface History {
  sessions?: HostSessionSummary[];
  failed: boolean;
}

/** The same list surface serves Home, All projects and a single project. */
export function MobileHome({
  projects,
  project,
  projectsPage = false,
  hostName,
  hostStatus,
  foreground,
  inactive,
  query,
  now,
  unreadIds,
  loadSessions,
  cachedSessions,
  onProject,
  onSession,
  onNewSession,
  onSearch,
  searchOpen = false,
  searchTrigger,
  onAddProject,
  onHost,
  onAddConnection,
  onSessionActions,
  sessionActionsId,
  refreshKey = 0,
}: {
  projects: HostProject[];
  project?: HostProject;
  /** The project index reached from the drawer, without conversations. */
  projectsPage?: boolean;
  hostName: string;
  hostStatus: HostConnectionStatus;
  foreground: boolean;
  inactive?: boolean;
  query: string;
  now: number;
  unreadIds: ReadonlySet<string>;
  loadSessions: (projectId: string) => Promise<HostSessionSummary[]>;
  cachedSessions?: (projectId: string) => HostSessionSummary[] | undefined;
  onProject: (project: HostProject) => void;
  onSession: (id: string, project: HostProject) => void;
  onNewSession: () => void;
  onSearch: () => void;
  searchOpen?: boolean;
  searchTrigger?: RefObject<HTMLButtonElement | null>;
  onAddProject: (trigger: HTMLButtonElement) => void;
  onHost?: (trigger: HTMLButtonElement) => void;
  onAddConnection?: (trigger: HTMLButtonElement) => void;
  onSessionActions?: (session: HostSessionSummary, trigger: HTMLButtonElement, point?: MobileSheetPoint) => void;
  sessionActionsId?: string;
  refreshKey?: number;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const searchButton = useRef<HTMLButtonElement | null>(null);
  const setSearchButton = useCallback((element: HTMLButtonElement | null) => {
    if (searchTrigger && (element || searchTrigger.current === searchButton.current))
      searchTrigger.current = element;
    searchButton.current = element;
  }, [searchTrigger]);
  const owners = useMemo(() => project ? [project] : projects, [project, projects]);
  const idsKey = JSON.stringify(owners.map((item) => item.id));
  const [histories, setHistories] = useState<Record<string, History>>(() =>
    Object.fromEntries(owners.flatMap((item) => {
      const sessions = cachedSessions?.(item.id);
      return sessions ? [[item.id, { sessions, failed: false }]] : [];
    })),
  );
  const [filter, setFilter] = useMobilePageState<MobileSessionFilter>("filter", "all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const root = !project && !projectsPage;
  // Only Home offers status filters; a project page always lists everything.
  const activeFilter = root ? filter : "all";
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
  }, [inactive, foreground, visible, project?.id, query]);
  // Projects can arrive after mount or change when navigating within Home.
  // Fill only missing histories before paint; live results always take priority.
  useLayoutEffect(() => {
    const ids: string[] = JSON.parse(idsKey);
    setHistories((current) => {
      let next = current;
      for (const id of ids) {
        if (current[id]?.sessions) continue;
        const sessions = cachedSessions?.(id);
        if (sessions) next = { ...next, [id]: { sessions, failed: current[id]?.failed ?? false } };
      }
      return next;
    });
  }, [idsKey, cachedSessions]);

  useEffect(() => {
    if (!foreground || !visible) return;
    const ids: string[] = JSON.parse(idsKey);
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const results = await Promise.allSettled(
        ids.map((id) => loadSessions(id)),
      );
      if (!live) return;
      setHistories((current) => {
        let next = current;
        results.forEach((result, index) => {
          const id = ids[index];
          const sessions = result.status === "fulfilled" ? result.value : current[id]?.sessions;
          const failed = result.status === "rejected";
          if (current[id]?.sessions === sessions && current[id]?.failed === failed) return;
          if (next === current) next = { ...current };
          next[id] = { sessions, failed };
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
  }, [idsKey, foreground, visible, loadSessions, retry, refreshKey]);

  const orderedProjects = useMemo(() => sortMobileProjects(
    projects,
    (id) => histories[id]?.sessions ?? [],
  ), [projects, histories]);
  const needle = query.trim().toLocaleLowerCase();
  const matchingProjects = useMemo(() => orderedProjects.filter((item) =>
    !needle || `${item.name} ${item.cwd}`.toLocaleLowerCase().includes(needle),
  ), [orderedProjects, needle]);
  const ownerById = useMemo(() => new Map(owners.map((item) => [item.id, item])), [owners]);
  const sessions = useMemo(() => filterMobileSessions(
    owners.flatMap((item) => histories[item.id]?.sessions ?? []),
    activeFilter,
  ).filter((item) => ownerById.has(item.projectId)), [owners, ownerById, histories, activeFilter]);
  const ordered = useMemo(() => sessions.filter(
      (item) =>
        !needle ||
        `${sessionDisplayTitle(item.title, item.harness) || t("Untitled conversation")} ${ownerById.get(item.projectId)?.name}`
          .toLocaleLowerCase()
          .includes(needle),
    ), [sessions, needle, ownerById, t]);
  const loading = owners.some((item) => !histories[item.id]);
  const projectsLoading = loading && !owners.some((item) => histories[item.id]?.sessions);
  const failed = owners.filter((item) => histories[item.id]?.failed);
  const row = (item: HostSessionSummary) => {
    const owner = ownerById.get(item.projectId)!;
    return (
      <MobileSessionCard
        key={item.id}
        session={item}
        projectName={project ? undefined : owner.name}
        now={now}
        unread={unreadIds.has(item.id)}
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
      />
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
        {root && !needle && (
          <section className="mobile-home-hosts" aria-label={t("Hosts")}>
            <h2>{t("Hosts")}</h2>
            <div className="mobile-home-host-row">
              <button
                type="button"
                className="mobile-home-host"
                onClick={(event) => onHost?.(event.currentTarget)}
              >
                <Computer size={18} />
                <span>{hostName}</span>
                <MobileHostStatus status={hostStatus} />
              </button>
              {onAddConnection && (
                <button
                  type="button"
                  className="mobile-home-host-add"
                  aria-label={t("Add connection")}
                  onClick={(event) => onAddConnection(event.currentTarget)}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </section>
        )}
        {root && !needle && !projects.length && (
          <section className="mobile-home-projects" aria-label={t("Projects")}>
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
        {projectsPage && (
          <section className="mobile-home-projects" aria-label={t("Projects")}>
            {projectsLoading ? (
              <div className="mobile-loading" role="status">
                <LoaderCircle size={17} className="mobile-spin" />
                {t("Loading conversations…")}
              </div>
            ) : <MobileListPreview key={needle} stateKey={needle ? undefined : "projects"} initialLimit={50} items={matchingProjects} renderItem={(item) => (
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
                  <small>{item.cwd}</small>
                </span>
              </button>
            )} />}
            {needle ? !matchingProjects.length && (
              <p className="mobile-home-empty">{t("No matching projects")}</p>
            ) : (
              <button
                type="button"
                className="mobile-home-project mobile-home-add"
                onClick={(event) => onAddProject(event.currentTarget)}
              >
                <FolderPlus size={21} />
                <span>{t("Open project")}</span>
              </button>
            )}
          </section>
        )}
        {!projectsPage && !!projects.length && <section className="mobile-home-recent" aria-label={t("Sessions")}>
          {root && (
            <div className="mobile-home-section-head">
              <h2>{t("Sessions")}</h2>
              <button
                ref={filterTrigger}
                type="button"
                className="mobile-home-filter"
                aria-haspopup="dialog"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((open) => !open)}
              >
                <span>{t(MOBILE_SESSION_FILTER_LABELS[filter])}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <MobileListPreview key={`${needle}:${activeFilter}`} stateKey={needle ? undefined : `recent:${activeFilter}`} initialLimit={20} items={ordered} renderItem={row} />
          {loading && (
            <div className="mobile-loading" role="status">
              <LoaderCircle className="mobile-spin" size={18} />
              {t("Loading conversations…")}
            </div>
          )}
          {!ordered.length && !loading && !failed.length && (
            <p className="mobile-home-empty">
              {needle || activeFilter !== "all"
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
        </section>}
      </div>
      {root && (
        <MobileSheet
          open={filterOpen && !inactive}
          title="Filter conversations"
          placement="anchor"
          anchor={filterTrigger}
          align="end"
          side="bottom"
          width={220}
          onClose={() => setFilterOpen(false)}
        >
          {MOBILE_SESSION_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className="mobile-sheet-row"
              data-separated={option === "archived" || undefined}
              role="menuitemradio"
              aria-checked={filter === option}
              onClick={() => {
                setFilter(option);
                setFilterOpen(false);
              }}
            >
              <span className="flex-1">{t(MOBILE_SESSION_FILTER_LABELS[option])}</span>
              {filter === option && <Check size={18} />}
            </button>
          ))}
        </MobileSheet>
      )}
      {!!projects.length && !projectsPage && (
        <div className="mobile-home-dock">
          {project && (
            <button
              ref={setSearchButton}
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
