import { useTranslation } from "../../shared/i18n/useTranslation";
import {
  BellOff,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Internet,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
} from "../../shared/ui/icons";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLockOverscroll } from "../../shared/hooks/useLockOverscroll";
import { useProjectDiffStats } from "../../features/source-control/hooks/useProjectDiffStats";
import { useAnimatedReorder } from "../../shared/hooks/useAnimatedReorder";
import { useTabGroupLogos } from "../../features/projects/hooks/useTabGroupLogos";
import { basename, type GitDiffStats } from "../../platform/tauri/fs";
import { formatInteger } from "../../shared/lib/numbers";
import { pathKey, projectKey } from "../../shared/lib/paths";
import {
  collectRailProjects,
  loadPinnedProjects,
  loadProjectRailOrder,
  projectRailSections,
  sameProjectPath,
  savePinnedProjects,
  saveProjectRailOrder,
  subscribeProjectPathsChanged,
  syncProjectRailOrder,
  toggleProjectPin,
  type RecentProject,
} from "../../features/projects/model/recents";
import {
  loadTabGroupColors,
  loadTabGroupCustomColors,
  loadTabGroupLabels,
  loadTabGroupMascots,
  resolveTabGroupLabel,
} from "../../features/workspace/model/tabGroups";
import {
  loadProjectGroupAssignments,
  loadProjectGroups,
  projectGroupColor,
  projectGroupIdForPath,
  updateProjectGroup,
  type ProjectGroup,
} from "../../features/projects/model/projectGroups";
import { ProjectMascot } from "../../features/projects/ui/ProjectMascot";
import { Shimmer } from "../../shared/ui/Shimmer";
import { notificationMuteStatus } from "../../features/notifications/ui/notificationMuteActions";
import { useProjectNotificationPreferences } from "../../features/notifications/hooks/useProjectNotificationPreferences";
import { useNotificationProjects } from "../../features/notifications/hooks/useNotificationProjects";
import { Popover } from "../../shared/ui/Popover";
import { OPEN_REMOTE_PROJECT_EVENT } from "../../features/connections/model/connections";
import {
  useRemoteMachineOnline,
  useRemoteMachines,
} from "../../features/connections/model/connections";
import { remoteProjectFor } from "../../features/connections/model/remoteProjects";
import { useProjectMenu } from "./useProjectMenu";

import { ProjectAvatar } from "./ProjectAvatar";
export type ProjectListProps = {
  cwd: string;
  recents: RecentProject[];
  busyPaths?: Iterable<string>;
  compact?: boolean;
  active?: boolean;
  query?: string;
  onSelectProject: (path: string) => void;
  onOpenProject: () => void;
  onRemoveProject?: (path: string, options: { purgeData: boolean }) => void;
  onOpenNotificationSettings?: (projectPath?: string) => void;
};

export function ProjectList({
  cwd,
  recents,
  busyPaths,
  compact = false,
  active = true,
  query = "",
  onSelectProject,
  onOpenProject,
  onRemoveProject,
  onOpenNotificationSettings,
}: ProjectListProps) {
  const { t: uiT } = useTranslation();
  const searchActive = !active;
  const [railOrder, setRailOrder] = useState(loadProjectRailOrder);
  const [pinnedPaths, setPinnedPaths] = useState(loadPinnedProjects);
  const [groupLabels, setGroupLabels] = useState(loadTabGroupLabels);
  const [groupColors, setGroupColors] = useState(loadTabGroupColors);
  const [groupMascots, setGroupMascots] = useState(loadTabGroupMascots);
  const [groupCustomColors, setGroupCustomColors] = useState(
    loadTabGroupCustomColors,
  );
  const [projectGroups, setProjectGroups] = useState(loadProjectGroups);
  const [projectGroupAssignments, setProjectGroupAssignments] = useState(
    loadProjectGroupAssignments,
  );
  useEffect(
    () =>
      subscribeProjectPathsChanged(() => {
        setRailOrder(loadProjectRailOrder());
        setPinnedPaths(loadPinnedProjects());
        setGroupLabels(loadTabGroupLabels());
        setGroupColors(loadTabGroupColors());
        setGroupMascots(loadTabGroupMascots());
        setGroupCustomColors(loadTabGroupCustomColors());
        setProjectGroups(loadProjectGroups());
        setProjectGroupAssignments(loadProjectGroupAssignments());
      }),
    [],
  );
  const projectMenu = useProjectMenu({
    onRemoveProject,
    onOpenNotificationSettings,
  });
  const notificationPreferences = useProjectNotificationPreferences();
  const allProjects = useMemo(
    () => collectRailProjects(recents, cwd),
    [cwd, recents],
  );
  const notificationProjects = useNotificationProjects([...allProjects.keys()]);
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const groupLogos = useTabGroupLogos();
  const muteStatuses = new Map<string, string | null>();
  for (const project of notificationProjects.projects) {
    const status = notificationMuteStatus(notificationPreferences[project.id]);
    for (const path of project.paths) muteStatuses.set(pathKey(path), status);
  }
  const sections = useMemo(() => {
    const ordered = projectRailSections(recents, cwd, railOrder, pinnedPaths);
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return ordered;
    const matches = (project: RecentProject) =>
      [
        project.path,
        resolveTabGroupLabel(
          projectKey(project.path),
          groupLabels,
          basename(project.path),
        ),
      ].some((value) => value.toLocaleLowerCase().includes(needle));
    return {
      pinned: ordered.pinned.filter(matches),
      projects: ordered.projects.filter(matches),
    };
  }, [cwd, pinnedPaths, railOrder, recents, query, groupLabels]);
  const groupedProjectSections = useMemo(() => {
    const byGroup = new Map<string, RecentProject[]>(
      projectGroups.map((group) => [group.id, []]),
    );
    const ungrouped: RecentProject[] = [];
    for (const project of sections.projects) {
      const groupId = projectGroupIdForPath(
        project.path,
        projectGroupAssignments,
      );
      const items = groupId ? byGroup.get(groupId) : undefined;
      if (items) items.push(project);
      else ungrouped.push(project);
    }
    return {
      ungrouped,
      grouped: projectGroups.map((group) => ({
        group,
        items: byGroup.get(group.id) ?? [],
      })),
    };
  }, [projectGroupAssignments, projectGroups, sections.projects]);
  const busy = useMemo(() => {
    const set = new Set<string>();
    for (const path of busyPaths ?? []) set.add(path);
    return set;
  }, [busyPaths]);

  useEffect(() => {
    setRailOrder((prev) => {
      const synced = syncProjectRailOrder(prev, allProjects);
      if (synced.join("\0") === prev.join("\0")) return prev;
      saveProjectRailOrder(synced);
      return synced;
    });
  }, [allProjects]);

  useEffect(() => {
    // Saving announces the change, which reloads `pinnedPaths`.
    const pinned = loadPinnedProjects();
    const next = pinned.filter((path) => allProjects.has(path));
    if (next.length !== pinned.length) savePinnedProjects(next);
  }, [allProjects]);

  useEffect(() => {
    if (!projectMenu.isOpen) return;
    const onScroll = () => projectMenu.close();
    const scrollParent = scrollRef.current ?? window;
    scrollParent.addEventListener("scroll", onScroll, true);
    return () => scrollParent.removeEventListener("scroll", onScroll, true);
  }, [projectMenu.isOpen]);

  const onProjectContextMenu = (
    path: string,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
    projectMenu.open(path, event.clientX, event.clientY);
  };

  const reorderSubset = (
    fullOrder: string[],
    subsetOrder: string[],
    subsetPaths: Set<string>,
  ) => {
    const next: string[] = [];
    let subsetIndex = 0;
    for (const path of fullOrder) {
      if (!subsetPaths.has(path)) {
        next.push(path);
        continue;
      }
      if (subsetIndex < subsetOrder.length) {
        next.push(subsetOrder[subsetIndex++]);
      }
    }
    return next;
  };

  const onReorderPinned = (ids: string[]) => {
    const subset = new Set(sections.pinned.map((item) => item.path));
    const next = reorderSubset(railOrder, ids, subset);
    setRailOrder(next);
    saveProjectRailOrder(next);
  };

  const onReorderProjects = (ids: string[]) => {
    const subset = new Set(ids);
    const next = reorderSubset(railOrder, ids, subset);
    setRailOrder(next);
    saveProjectRailOrder(next);
  };

  const pinnedIds = sections.pinned.map((item) => item.path);
  const projectIds = groupedProjectSections.ungrouped.map((item) => item.path);
  const pinnedSortable = useAnimatedReorder(pinnedIds, onReorderPinned, "y");
  const projectSortable = useAnimatedReorder(
    projectIds,
    onReorderProjects,
    "y",
  );
  return (
    <div
      aria-label={uiT("Projects")}
      data-project-list={compact ? "avatars" : "full"}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={(el) => {
          lockOverscroll(el);
          scrollRef.current = el;
        }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-none pb-2"
      >
        {sections.pinned.length > 0 ? (
          <ProjectSection
            compact={compact}
            label={uiT("Pinned")}
            items={sections.pinned}
            muteStatuses={muteStatuses}
            cwd={cwd}
            busy={busy}
            statsEnabled={!compact}
            sortable={pinnedSortable}
            pinned
            searchActive={searchActive}
            onSelect={onSelectProject}
            onTogglePin={toggleProjectPin}
            onContextMenu={onProjectContextMenu}
            onOpenMenu={projectMenu.open}
            groupLabels={groupLabels}
            groupColors={groupColors}
            groupCustomColors={groupCustomColors}
            groupLogos={groupLogos}
            groupMascots={groupMascots}
          />
        ) : null}

        {projectGroups.length > 0 ? (
          <div className="mb-2 shrink-0">
            {compact ? null : (
              <ProjectSectionHeader
                label={uiT("Groups")}
                onAddGroup={(x, y) => projectMenu.createGroup(x, y)}
              />
            )}
            <div
              className={
                compact
                  ? "flex flex-col items-center gap-1"
                  : "flex flex-col gap-px px-2"
              }
            >
              {groupedProjectSections.grouped.map(({ group, items }) => (
                <ProjectGroupSection
                  compact={compact}
                  key={group.id}
                  group={group}
                  items={items}
                  muteStatuses={muteStatuses}
                  cwd={cwd}
                  busy={busy}
                  statsEnabled={!compact}
                  searchActive={searchActive}
                  onSelect={onSelectProject}
                  onTogglePin={toggleProjectPin}
                  onContextMenu={onProjectContextMenu}
                  onOpenMenu={projectMenu.open}
                  onReorder={onReorderProjects}
                  onToggleCollapsed={() =>
                    updateProjectGroup(group.id, (current) => ({
                      ...current,
                      collapsed: !current.collapsed,
                    }))
                  }
                  onOpenGroupMenu={(x, y) =>
                    projectMenu.openGroupMenu(group.id, x, y)
                  }
                  groupLabels={groupLabels}
                  groupColors={groupColors}
                  groupCustomColors={groupCustomColors}
                  groupLogos={groupLogos}
                  groupMascots={groupMascots}
                />
              ))}
            </div>
          </div>
        ) : null}

        <ProjectSection
          compact={compact}
          label={uiT("Projects")}
          items={groupedProjectSections.ungrouped}
          muteStatuses={muteStatuses}
          emptyLabel={
            sections.projects.length === 0 && projectGroups.length === 0
              ? uiT(query.trim() ? "No matching projects" : "No projects yet")
              : undefined
          }
          onAdd={onOpenProject}
          cwd={cwd}
          busy={busy}
          statsEnabled={!compact}
          sortable={projectSortable}
          pinned={false}
          searchActive={searchActive}
          onSelect={onSelectProject}
          onTogglePin={toggleProjectPin}
          onContextMenu={onProjectContextMenu}
          onOpenMenu={projectMenu.open}
          groupLabels={groupLabels}
          groupColors={groupColors}
          groupCustomColors={groupCustomColors}
          groupLogos={groupLogos}
          groupMascots={groupMascots}
        />
      </div>
      {projectMenu.element}
    </div>
  );
}

type SortableHandle = ReturnType<typeof useAnimatedReorder>;

function ProjectSection({
  compact,
  label,
  items,
  muteStatuses,
  emptyLabel,
  onAdd,
  cwd,
  busy,
  statsEnabled,
  sortable,
  pinned,
  searchActive,
  onSelect,
  onTogglePin,
  onContextMenu,
  onOpenMenu,
  groupLabels,
  groupColors,
  groupCustomColors,
  groupLogos,
  groupMascots,
}: {
  compact: boolean;
  label: string;
  items: RecentProject[];
  muteStatuses: ReadonlyMap<string, string | null>;
  emptyLabel?: string;
  onAdd?: () => void;
  cwd: string;
  busy: Set<string>;
  statsEnabled: boolean;
  sortable: SortableHandle;
  pinned: boolean;
  searchActive: boolean;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (path: string, x: number, y: number) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  return (
    <div className={compact ? "shrink-0" : "shrink-0 mb-2"}>
      {compact ? null : <ProjectSectionHeader label={label} onAdd={onAdd} />}
      {items.length === 0 && emptyLabel ? (
        <p className="px-4 pb-1 text-[11px] leading-tight text-content/40">
          {uiT(emptyLabel)}
        </p>
      ) : null}
      <div
        className={
          compact
            ? "flex flex-col items-center gap-1"
            : "flex flex-col gap-px px-2"
        }
      >
        {items.map((item) => (
          <ProjectCard
            compact={compact}
            key={item.path}
            item={item}
            muteStatus={muteStatuses.get(pathKey(item.path)) ?? undefined}
            selected={!searchActive && sameProjectPath(item.path, cwd)}
            busy={isBusyPath(item.path, busy)}
            statsEnabled={statsEnabled}
            pinned={pinned}
            sortable={sortable}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
            onContextMenu={onContextMenu}
            onOpenMenu={onOpenMenu}
            groupLabels={groupLabels}
            groupColors={groupColors}
            groupCustomColors={groupCustomColors}
            groupLogos={groupLogos}
            groupMascots={groupMascots}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectSectionHeader({
  label,
  onAdd,
  onAddGroup,
}: {
  label: string;
  onAdd?: () => void;
  onAddGroup?: (x: number, y: number) => void;
}) {
  const { t: uiT } = useTranslation();
  return (
    <div className="flex items-center gap-1 px-3 pb-1.5 pt-1">
      <span className="min-w-0 flex-1 truncate px-1 text-xs text-content/50">
        {label}
      </span>
      {onAddGroup ? (
        <button
          type="button"
          title={uiT("New project group")}
          aria-label={uiT("New project group")}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onAddGroup(rect.left, rect.bottom);
          }}
          className="grid size-5 shrink-0 place-items-center rounded-md text-content/50 hover:bg-content/8 hover:text-content"
        >
          <FolderPlus className="size-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
      {onAdd ? <AddProjectButton onOpenFolder={onAdd} /> : null}
    </div>
  );
}

function ProjectGroupSection({
  compact,
  group,
  items,
  muteStatuses,
  cwd,
  busy,
  statsEnabled,
  searchActive,
  onSelect,
  onTogglePin,
  onContextMenu,
  onOpenMenu,
  onReorder,
  onToggleCollapsed,
  onOpenGroupMenu,
  groupLabels,
  groupColors,
  groupCustomColors,
  groupLogos,
  groupMascots,
}: {
  compact: boolean;
  group: ProjectGroup;
  items: RecentProject[];
  muteStatuses: ReadonlyMap<string, string | null>;
  cwd: string;
  busy: Set<string>;
  statsEnabled: boolean;
  searchActive: boolean;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (path: string, x: number, y: number) => void;
  onReorder: (ids: string[]) => void;
  onToggleCollapsed: () => void;
  onOpenGroupMenu: (x: number, y: number) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  const sortable = useAnimatedReorder(
    items.map((item) => item.path),
    onReorder,
    "y",
  );
  const countLabel = uiT(
    items.length === 1 ? "{count} project" : "{count} projects",
    { count: items.length },
  );
  const expanded = compact || !group.collapsed;
  const openMenu = (target: HTMLElement, x?: number, y?: number) => {
    const rect = target.getBoundingClientRect();
    onOpenGroupMenu(x ?? rect.left, y ?? rect.bottom);
  };

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-md ${
        expanded && !compact ? "mb-1.5 bg-content/5" : ""
      }`}
      data-project-group={group.id}
      role="group"
      aria-label={group.name}
    >
      {compact ? null : (
        <div
          className="project-reorder-item group relative flex h-8 items-stretch rounded-md px-2 opacity-65 cursor-default"
          onContextMenu={(event) => {
            event.preventDefault();
            event.currentTarget
              .querySelector<HTMLButtonElement>("button")
              ?.focus();
            openMenu(event.currentTarget, event.clientX, event.clientY);
          }}
        >
          <button
            type="button"
            aria-expanded={!group.collapsed}
            aria-label={`${group.name}, ${countLabel}`}
            title={`${group.name} · ${countLabel}`}
            onClick={onToggleCollapsed}
            className="flex min-w-0 flex-1 cursor-default items-center gap-2 text-left transition-[padding] duration-150 motion-reduce:transition-none group-hover:pr-6 group-has-[:focus-visible]:pr-6"
          >
            <div className="grid size-4 shrink-0 place-items-center">
              {group.collapsed ? (
                <>
                  <span
                    data-group-mascot
                    className="grid size-4 place-items-center group-hover:hidden group-has-[:focus-visible]:hidden"
                  >
                    <ProjectMascot
                      project={group.id}
                      color={projectGroupColor(group)}
                      name={group.mascot ?? null}
                      className="size-3"
                    />
                  </span>
                  <ChevronRight
                    data-group-chevron
                    className="hidden size-3.5 group-hover:block group-has-[:focus-visible]:block"
                    strokeWidth={1.75}
                  />
                </>
              ) : (
                <ChevronDown
                  data-group-chevron
                  className="size-3.5"
                  strokeWidth={1.75}
                />
              )}
            </div>
            <span className={nameClassName}>{group.name}</span>
          </button>
          <button
            type="button"
            data-no-drag
            title={uiT("Group options")}
            aria-label={uiT("{value0} group options", {
              value0: String(group.name),
            })}
            aria-haspopup="menu"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              openMenu(event.currentTarget);
            }}
            className="absolute right-1 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-md text-content/55 hover:bg-content/8 hover:text-content group-hover:grid group-has-[:focus-visible]:grid"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
      {expanded ? (
        <div
          data-project-group-items
          className={
            compact
              ? "flex flex-col items-center gap-1"
              : "flex flex-col gap-px p-1"
          }
        >
          {items.map((item) => (
            <ProjectCard
              compact={compact}
              key={item.path}
              item={item}
              muteStatus={muteStatuses.get(pathKey(item.path)) ?? undefined}
              selected={!searchActive && sameProjectPath(item.path, cwd)}
              busy={isBusyPath(item.path, busy)}
              statsEnabled={statsEnabled}
              pinned={false}
              sortable={sortable}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onContextMenu={onContextMenu}
              onOpenMenu={onOpenMenu}
              groupLabels={groupLabels}
              groupColors={groupColors}
              groupCustomColors={groupCustomColors}
              groupLogos={groupLogos}
              groupMascots={groupMascots}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const nameClassName =
  "min-w-0 flex-1 truncate text-sm font-medium leading-tight";

function ProjectCard({
  compact,
  item,
  muteStatus,
  selected,
  busy,
  statsEnabled,
  pinned,
  sortable,
  onSelect,
  onTogglePin,
  onContextMenu,
  onOpenMenu,
  groupLabels,
  groupColors,
  groupCustomColors,
  groupLogos,
  groupMascots,
}: {
  compact: boolean;
  item: RecentProject;
  muteStatus?: string;
  selected: boolean;
  busy: boolean;
  statsEnabled: boolean;
  pinned: boolean;
  sortable: SortableHandle;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (path: string, x: number, y: number) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  const fallbackName = basename(item.path);
  const key = projectKey(item.path);
  const name = resolveTabGroupLabel(key, groupLabels, fallbackName);
  const diffEnabled = statsEnabled && Boolean(item.path) && item.path !== "~";
  const stats = useProjectDiffStats(item.path, diffEnabled);
  const files = stats?.files ?? 0;
  const additions = stats?.additions ?? 0;
  const deletions = stats?.deletions ?? 0;
  const hasChanges = files > 0 || additions > 0 || deletions > 0;
  const hostProject = remoteProjectFor(item.path);
  const remote = hostProject?.local ? undefined : hostProject;
  const { machines } = useRemoteMachines(!!remote);
  const machine = remote
    ? machines.find((entry) => entry.environmentId === remote.environmentId)
    : undefined;
  const online = useRemoteMachineOnline(machine?.id);
  const connection = !remote
    ? ""
    : !machine
      ? uiT("Machine not connected on this computer")
      : online === undefined
        ? uiT("Connecting")
        : online
          ? uiT("Connected")
          : uiT("Reconnecting");
  const cardTitle = projectCardTitle(
    remote
      ? uiT("{path} on {machine} ({connection})", {
          path: remote.cwd,
          machine: machine?.name ?? uiT("another machine"),
          connection,
        })
      : item.path,
    name,
    stats,
    busy,
    uiT,
  );
  const cardAriaLabel = projectCardAriaLabel(
    machine
      ? uiT("{project} on {machine}", { project: name, machine: machine.name })
      : name,
    stats,
    busy,
    uiT,
  );
  const labelClassName = machine
    ? "min-w-0 max-w-[75%] shrink-0 truncate text-sm font-medium leading-tight"
    : nameClassName;

  return (
    <div
      ref={(el) => sortable.setItemRef(item.path, el)}
      data-selected={selected || undefined}
      className={`reorder-item project-reorder-item group relative flex touch-none items-stretch rounded-md ${compact ? "size-8" : "px-2 h-8"} ${
        selected ? "bg-selection-strong text-content" : "opacity-65"
      } cursor-default`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement | null)?.closest("[data-no-drag]")) {
          return;
        }
        sortable.onItemPointerDown(item.path, event);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement | null)?.closest("[data-no-drag]")) {
          return;
        }
        if (sortable.consumeClick()) return;
        onSelect(item.path);
      }}
      onContextMenu={(event) => onContextMenu(item.path, event)}
      onKeyDown={(event) => {
        if (
          event.key !== "ContextMenu" &&
          !(event.shiftKey && event.key === "F10")
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        onOpenMenu(item.path, rect.left, rect.bottom);
      }}
    >
      <button
        type="button"
        title={muteStatus ? `${cardTitle}\n${muteStatus}` : cardTitle}
        aria-label={
          muteStatus ? `${cardAriaLabel}, ${muteStatus}` : cardAriaLabel
        }
        aria-current={selected ? "true" : undefined}
        className={
          compact
            ? "relative grid size-8 place-items-center"
            : "flex min-w-0 flex-1 cursor-default items-center gap-2 text-left transition-[padding] duration-150 motion-reduce:transition-none group-hover:pr-6 group-has-[:focus-visible]:pr-6"
        }
      >
        {compact ? (
          <ProjectAvatar
            path={item.path}
            busy={busy}
            colors={groupColors}
            customColors={groupCustomColors}
            logos={groupLogos}
            mascots={groupMascots}
          />
        ) : (
          <>
            <div className="project-card-logo grid size-4 shrink-0 place-items-center transition-opacity group-hover:opacity-0">
              <ProjectAvatar
                path={item.path}
                busy={busy}
                colors={groupColors}
                customColors={groupCustomColors}
                logos={groupLogos}
                mascots={groupMascots}
                className="size-4"
              />
            </div>
            {busy ? (
              <Shimmer as="span" duration={1.4} className={labelClassName}>
                {name}
              </Shimmer>
            ) : (
              <span className={labelClassName}>{name}</span>
            )}
            {machine ? (
              <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-content/45">
                {machine.name}
              </span>
            ) : null}
            {hasChanges ? (
              <span className="project-card-stats shrink-0 group-hover:hidden group-has-[:focus-visible]:hidden">
                <ProjectDiffStat additions={additions} deletions={deletions} />
              </span>
            ) : null}
          </>
        )}
        {remote ? (
          <span
            role="img"
            aria-label={connection}
            className={
              compact
                ? "absolute right-0 bottom-0 grid size-3 place-items-center text-content/60"
                : "relative grid size-4 shrink-0 place-items-center text-content/45"
            }
          >
            <Internet
              className="size-3"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span
              aria-hidden="true"
              className={`absolute right-0 bottom-0 size-1.5 rounded-full ring-1 ring-background-base ${
                online ? "bg-emerald-400" : "bg-content/35"
              }`}
            />
          </span>
        ) : null}
        {muteStatus ? (
          <span
            role="img"
            aria-label={muteStatus}
            title={muteStatus}
            className={
              compact
                ? "absolute right-0 top-0 grid size-3 place-items-center text-amber-400"
                : "grid size-4 shrink-0 place-items-center text-amber-400"
            }
          >
            <BellOff
              className="size-3.5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </span>
        ) : null}
      </button>
      {compact ? null : (
        <>
          <button
            type="button"
            data-no-drag
            title={uiT("Project options")}
            aria-label={uiT("Project options")}
            aria-haspopup="menu"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenMenu(
                item.path,
                event.detail === 0 ? rect.left : event.clientX,
                event.detail === 0 ? rect.bottom : event.clientY,
              );
            }}
            className="absolute right-1 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-md text-content/55 hover:bg-content/8 hover:text-content group-hover:grid group-has-[:focus-visible]:grid"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-no-drag
            title={pinned ? uiT("Unpin project") : uiT("Pin project")}
            aria-label={pinned ? uiT("Unpin project") : uiT("Pin project")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(item.path);
            }}
            className="absolute left-2 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-sm text-content/55 opacity-0 pointer-events-none transition-opacity hover:text-content group-hover:pointer-events-auto group-hover:opacity-100"
          >
            {pinned ? (
              <PinOff className="size-3.5" strokeWidth={1.75} />
            ) : (
              <Pin className="size-3.5" strokeWidth={1.75} />
            )}
          </button>
        </>
      )}
    </div>
  );
}

function isBusyPath(path: string, busy: Set<string>): boolean {
  for (const other of busy) {
    if (sameProjectPath(path, other)) return true;
  }
  return false;
}

function ProjectDiffStat({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  const { t: uiT } = useTranslation();
  if (additions <= 0 && deletions <= 0) return null;

  const label = [
    additions > 0 ? `+${formatInteger(additions)}` : "",
    deletions > 0 ? `-${formatInteger(deletions)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      title={uiT("{value0} uncommitted", { value0: String(label) })}
      className="flex shrink-0 items-center gap-1 font-sans text-[11px] font-semibold tabular-nums"
    >
      {additions > 0 ? (
        <span className="text-emerald-400">+{formatInteger(additions)}</span>
      ) : null}
      {deletions > 0 ? (
        <span className="text-red-400">-{formatInteger(deletions)}</span>
      ) : null}
    </span>
  );
}

function projectCardTitle(
  path: string,
  name: string,
  stats: GitDiffStats | null,
  busy: boolean,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const parts = [name, path];
  if (busy) parts.push(t("Working"));
  const files = stats?.files ?? 0;
  const additions = stats?.additions ?? 0;
  const deletions = stats?.deletions ?? 0;
  if (files > 0 || additions > 0 || deletions > 0) {
    parts.push(
      [
        files > 0
          ? t(files === 1 ? "{count} file changed" : "{count} files changed", {
              count: files,
            })
          : "",
        additions > 0 ? `+${formatInteger(additions)}` : "",
        deletions > 0 ? `-${formatInteger(deletions)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  return parts.join("\n");
}

function projectCardAriaLabel(
  name: string,
  stats: GitDiffStats | null,
  busy: boolean,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const parts = [name];
  if (busy) parts.push(t("working"));
  const files = stats?.files ?? 0;
  const additions = stats?.additions ?? 0;
  const deletions = stats?.deletions ?? 0;
  if (files > 0) {
    parts.push(
      t(files === 1 ? "{count} file changed" : "{count} files changed", {
        count: files,
      }),
    );
  }
  if (additions > 0) parts.push(`+${formatInteger(additions)}`);
  if (deletions > 0) parts.push(`-${formatInteger(deletions)}`);
  return parts.join(", ");
}

/** Adds a folder on this computer, or one on a connected machine. */
function AddProjectButton({ onOpenFolder }: { onOpenFolder: () => void }) {
  const { t: uiT } = useTranslation();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-content/80 hover:bg-content/8 hover:text-content";
  return (
    <>
      <button
        ref={anchor}
        type="button"
        title={uiT("Open project")}
        aria-label={uiT("Open project")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-5 shrink-0 place-items-center rounded-md text-content/50 hover:bg-content/8 hover:text-content aria-expanded:bg-content/8 aria-expanded:text-content"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
      </button>
      {open ? (
        <Popover
          anchor={anchor}
          align="start"
          width={230}
          onDismiss={() => setOpen(false)}
          role="menu"
          aria-label={uiT("Open project")}
          className="p-1"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onOpenFolder();
            }}
          >
            <FolderPlus className="size-3.5 shrink-0" strokeWidth={1.75} />
            {uiT("Open folder…")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(OPEN_REMOTE_PROJECT_EVENT));
            }}
          >
            <Internet className="size-3.5 shrink-0" strokeWidth={1.75} />
            {uiT("Open folder on a machine…")}
          </button>
        </Popover>
      ) : null}
    </>
  );
}
