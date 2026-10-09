import { useSidebarListPreview } from "./useSidebarListPreview";
import { AnimatedCollapse } from "../../shared/ui/AnimatedCollapse";
import {
  HoverSummary,
  HoverSummaryRow,
  useHoverSummary,
} from "../../shared/ui/HoverSummary";
import type { ProjectHoverSummary } from "../model/projectHoverSummary";
import { useTranslation } from "../../shared/i18n/useTranslation";
import {
  BellOff,
  ChevronRight,
  FolderPlus,
  FolderOpen,
  Internet,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Settings,
} from "../../shared/ui/icons";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useLockOverscroll } from "../../shared/hooks/useLockOverscroll";
import { useProjectDiffStats } from "../../features/source-control/hooks/useProjectDiffStats";
import { useAnimatedReorder } from "../../shared/hooks/useAnimatedReorder";
import { orderByIds } from "../../shared/lib/reorder";
import {
  loadSidebarPinnedOrder,
  reorderSidebarPins,
  saveSidebarPinnedOrder,
  subscribeSidebarPinnedOrder,
} from "../model/sidebarPinnedOrder";
import { SidebarEntryReorderContext } from "./SidebarEntryReorder";
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
import { TerminalSpinner } from "../../features/sessions/ui/TerminalSpinner";
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
import {
  loadSidebarSectionsCollapsed,
  saveSidebarSectionsCollapsed,
  subscribeSidebarSectionsCollapsed,
  type SidebarSectionId,
} from "../../features/settings/model/sidebarSections";

import { ProjectAvatar } from "./ProjectAvatar";
type ProjectListEntry = { id: string; content: ReactNode | (() => ReactNode) };

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
  expandedPaths?: ReadonlySet<string>;
  onToggleProject?: (path: string) => void;
  /** Activate the workspace after a name-triggered disclosure finishes. */
  onActivateProject?: (path: string) => void;
  canExpandProject?: (path: string) => boolean;
  renderProjectChildren?: (path: string) => ReactNode;
  onNewInProject?: (path: string) => void;
  needsApprovalPaths?: Iterable<string>;
  statsEnabled?: boolean;
  scrollable?: boolean;
  scrollRef?: Ref<HTMLDivElement>;
  matchedProjectPaths?: ReadonlySet<string>;
  searchActive?: boolean;
  /** Full project counts, independent of the current sidebar filter/preview. */
  projectSummaries?: ReadonlyMap<string, ProjectHoverSummary>;
  pinnedEntries?: ProjectListEntry[];
  recentEntries?: ProjectListEntry[];
  recentPending?: boolean;
  /** Content of the collapsible Workflows section; absent hides it. */
  workflowsSection?: ReactNode;
  onProjectHoverOpen?: (path: string) => void;
};

const PROJECT_COLLAPSE_DURATION_MS = 280;

function collapsedProjectHeaderSize(_id: string, node: HTMLElement) {
  return (
    node.querySelector<HTMLElement>("[data-project-header]")?.offsetHeight ??
    node.offsetHeight
  );
}

function updateScrollMask(element: HTMLDivElement) {
  const fade = Math.min(32, element.clientHeight / 2);
  const top = element.scrollTop > 0 ? fade : 0;
  const bottom =
    element.scrollTop + element.clientHeight < element.scrollHeight - 1
      ? fade
      : 0;
  element.style.maskImage = `linear-gradient(to bottom, transparent, black ${top}px, black calc(100% - ${bottom}px), transparent)`;
}

const ProjectSummaryContext = createContext<{
  summaries?: ReadonlyMap<string, ProjectHoverSummary>;
  onOpen?: (path: string) => void;
  onPin?: (path: string) => void;
  restoringPinFocusPath?: { current: string | undefined };
  disabled: boolean;
}>({ disabled: false });

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
  expandedPaths,
  onToggleProject,
  onActivateProject,
  canExpandProject,
  renderProjectChildren,
  onNewInProject,
  needsApprovalPaths,
  statsEnabled,
  scrollable = true,
  scrollRef: externalScrollRef,
  matchedProjectPaths,
  searchActive: searchActiveProp,
  projectSummaries,
  pinnedEntries = [],
  recentEntries,
  recentPending = false,
  workflowsSection,
  onProjectHoverOpen,
}: ProjectListProps) {
  const { t: uiT } = useTranslation();
  const searchActive = searchActiveProp ?? !active;
  const pendingActivation = useRef<string | undefined>(undefined);
  useEffect(() => {
    // An external project selection supersedes any disclosure still entering.
    pendingActivation.current = undefined;
  }, [cwd]);
  const tree =
    !compact && expandedPaths !== undefined
      ? {
          expandedPaths,
          onToggleProject,
          onActivateProject,
          pendingActivation,
          canExpandProject,
          renderProjectChildren,
          onNewInProject,
          needsApproval: new Set([...(needsApprovalPaths ?? [])].map(pathKey)),
        }
      : undefined;
  const [railOrder, setRailOrder] = useState(loadProjectRailOrder);
  const [pinnedPaths, setPinnedPaths] = useState(loadPinnedProjects);
  const [pinnedOrder, setPinnedOrder] = useState(loadSidebarPinnedOrder);
  useEffect(
    () =>
      subscribeSidebarPinnedOrder(() => setPinnedOrder(loadSidebarPinnedOrder())),
    [],
  );
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
  const [collapsedSections, setCollapsedSections] = useState(
    loadSidebarSectionsCollapsed,
  );
  const [searchCollapsedSections, setSearchCollapsedSections] = useState<{
    query: string;
    sections: ReadonlySet<SidebarSectionId>;
  }>(() => ({ query, sections: new Set() }));
  const groupContentId = useId();
  const workflowsContentId = useId();
  useEffect(
    () =>
      subscribeSidebarSectionsCollapsed(() =>
        setCollapsedSections(loadSidebarSectionsCollapsed()),
      ),
    [],
  );
  useEffect(() => {
    setSearchCollapsedSections({ query, sections: new Set() });
  }, [query, searchActive]);
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
  useEffect(() => {
    // Project menus live outside the section's visibility context.
    projectMenu.close();
  }, [collapsedSections, searchCollapsedSections]);
  const sectionExpanded = (section: SidebarSectionId) =>
    compact ||
    !(searchActive
      ? searchCollapsedSections.query === query &&
        searchCollapsedSections.sections.has(section)
      : collapsedSections.has(section));
  const toggleSection = (section: SidebarSectionId) => {
    projectMenu.close();
    if (searchActive) {
      setSearchCollapsedSections((previous) => {
        const sections = new Set(
          previous.query === query ? previous.sections : [],
        );
        if (!sections.delete(section)) sections.add(section);
        return { query, sections };
      });
      return;
    }
    const next = new Set(collapsedSections);
    if (!next.delete(section)) next.add(section);
    saveSidebarSectionsCollapsed(next);
    setCollapsedSections(next);
  };
  const notificationPreferences = useProjectNotificationPreferences();
  const allProjects = useMemo(
    () => collectRailProjects(recents, cwd),
    [cwd, recents],
  );
  const notificationProjects = useNotificationProjects([...allProjects.keys()]);
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!scrollable) {
      element.style.maskImage = "";
      return;
    }
    updateScrollMask(element);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateScrollMask(element));
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  });
  const summaryPinFocus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const path = summaryPinFocus.current;
    if (!path) return;
    const target = [
      ...(scrollRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-project-select]",
      ) ?? []),
    ].find((button) => button.dataset.projectSelect === pathKey(path));
    target?.focus({ preventScroll: true });
    summaryPinFocus.current = undefined;
  }, [pinnedPaths]);
  const groupLogos = useTabGroupLogos();
  const muteStatuses = new Map<string, string | null>();
  for (const project of notificationProjects.projects) {
    const status = notificationMuteStatus(notificationPreferences[project.id]);
    for (const path of project.paths) muteStatuses.set(pathKey(path), status);
  }
  const sections = useMemo(() => {
    const ordered = projectRailSections(recents, cwd, railOrder, pinnedPaths);
    if (matchedProjectPaths) {
      const matches = (project: RecentProject) =>
        matchedProjectPaths.has(pathKey(project.path));
      return {
        pinned: ordered.pinned.filter(matches),
        projects: ordered.projects.filter(matches),
      };
    }
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
  }, [
    cwd,
    pinnedPaths,
    railOrder,
    recents,
    query,
    groupLabels,
    matchedProjectPaths,
  ]);
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
      grouped: projectGroups
        .map((group) => ({
          group,
          items: byGroup.get(group.id) ?? [],
        }))
        .filter(({ items }) => !searchActive || items.length > 0),
    };
  }, [projectGroupAssignments, projectGroups, sections.projects, searchActive]);
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

  const onReorderProjects = (ids: string[]) => {
    const subset = new Set(ids);
    const next = reorderSubset(railOrder, ids, subset);
    setRailOrder(next);
    saveProjectRailOrder(next);
  };

  const onReorderPins = (ids: string[]) => {
    const all = [
      ...pinnedOrder,
      ...pinnedEntries.map((entry) => `session:${entry.id}`),
      ...sections.pinned.map((item) => item.path),
    ];
    const next = reorderSidebarPins(all, ids);
    saveSidebarPinnedOrder(next);
    setPinnedOrder(next);
    onReorderProjects(ids.filter((id) => allProjects.has(pathKey(id))));
  };

  return (
    <ProjectSummaryContext.Provider
      value={{
        summaries: projectSummaries,
        onOpen: onProjectHoverOpen,
        onPin: (path) => {
          summaryPinFocus.current = path;
          toggleProjectPin(path);
        },
        restoringPinFocusPath: summaryPinFocus,
        disabled: projectMenu.isActive,
      }}
    >
      <div
        aria-label={uiT("Projects")}
        data-project-list={tree ? "tree" : compact ? "avatars" : "full"}
        className={`flex flex-col ${scrollable ? "min-h-0 flex-1" : "shrink-0"}`}
      >
        <div
          ref={(el) => {
            lockOverscroll(el);
            scrollRef.current = el;
            if (typeof externalScrollRef === "function") externalScrollRef(el);
            else if (externalScrollRef) externalScrollRef.current = el;
          }}
          className={`flex flex-col gap-1 pb-2 ${scrollable ? "min-h-0 flex-1 overflow-y-auto overscroll-none" : "shrink-0"}`}
          onScroll={
            scrollable
              ? (event) => updateScrollMask(event.currentTarget)
              : undefined
          }
        >
          {sections.pinned.length > 0 || pinnedEntries.length > 0 ? (
            <ProjectSection
              compact={compact}
              label={uiT(tree ? "Pinned items" : "Pinned")}
              expanded={sectionExpanded("pinned")}
              onToggleExpanded={() => toggleSection("pinned")}
              leadingEntries={pinnedEntries}
              itemOrder={pinnedOrder}
              items={sections.pinned}
              muteStatuses={muteStatuses}
              cwd={cwd}
              busy={busy}
              statsEnabled={statsEnabled ?? !compact}
              tree={tree}
              onReorder={onReorderPins}
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

          {recentEntries !== undefined ? (
            <ProjectSection
              compact={compact}
              label={uiT("Recent sessions")}
              section="recent"
              expanded={sectionExpanded("recent")}
              onToggleExpanded={() => toggleSection("recent")}
              leadingEntries={recentEntries}
              items={[]}
              emptyLabel={
                recentPending
                  ? undefined
                  : uiT(
                      searchActive
                        ? "No matching sessions"
                        : "Sessions you start will show up here",
                    )
              }
              muteStatuses={muteStatuses}
              cwd={cwd}
              busy={busy}
              statsEnabled={false}
              tree={tree}
              onReorder={onReorderProjects}
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
          ) : null}

          {workflowsSection && !compact ? (
            <div data-project-section="workflows" className={`shrink-0 ${tree ? "mb-1" : "mb-2"}`}>
              <ProjectSectionHeader
                label={uiT("Workflows")}
                expanded={sectionExpanded("workflows")}
                contentId={workflowsContentId}
                onToggleExpanded={() => toggleSection("workflows")}
              />
              <AnimatedCollapse
                keepMounted
                expanded={sectionExpanded("workflows")}
                motion="height"
                className="project-tree-collapse"
                durationMs={PROJECT_COLLAPSE_DURATION_MS}
              >
                <div id={workflowsContentId}>{workflowsSection}</div>
              </AnimatedCollapse>
            </div>
          ) : null}

          {projectGroups.length > 0 ? (
            <div
              data-project-section="groups"
              className={`shrink-0 ${tree ? "mb-1" : "mb-2"}`}
            >
              {compact ? null : (
                <ProjectSectionHeader
                  label={uiT("Groups")}
                  expanded={sectionExpanded("groups")}
                  contentId={groupContentId}
                  onToggleExpanded={() => toggleSection("groups")}
                  onAddGroup={(x, y) => projectMenu.createGroup(x, y)}
                />
              )}
              <AnimatedCollapse
                keepMounted
                expanded={sectionExpanded("groups")}
                motion="height"
                className="project-tree-collapse"
                durationMs={PROJECT_COLLAPSE_DURATION_MS}
              >
                <div
                  id={groupContentId}
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
                      statsEnabled={statsEnabled ?? !compact}
                      tree={tree}
                      onReorder={onReorderProjects}
                      searchActive={searchActive}
                      onSelect={onSelectProject}
                      onTogglePin={toggleProjectPin}
                      onContextMenu={onProjectContextMenu}
                      onOpenMenu={projectMenu.open}
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
              </AnimatedCollapse>
            </div>
          ) : null}

          <ProjectSection
            compact={compact}
            label={uiT("Recent projects")}
            expanded={sectionExpanded("projects")}
            onToggleExpanded={() => toggleSection("projects")}
            items={groupedProjectSections.ungrouped}
            muteStatuses={muteStatuses}
            emptyLabel={
              sections.projects.length === 0 && projectGroups.length === 0
                ? uiT(
                    query.trim() || searchActive
                      ? "No matching projects"
                      : "No projects yet",
                  )
                : undefined
            }
            onAdd={onOpenProject}
            cwd={cwd}
            busy={busy}
            statsEnabled={statsEnabled ?? !compact}
            tree={tree}
            onReorder={onReorderProjects}
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
    </ProjectSummaryContext.Provider>
  );
}

type SortableHandle = ReturnType<typeof useAnimatedReorder>;
type ProjectTree = {
  expandedPaths: ReadonlySet<string>;
  pendingActivation: { current: string | undefined };
  onToggleProject?: (path: string) => void;
  onActivateProject?: (path: string) => void;
  canExpandProject?: (path: string) => boolean;
  renderProjectChildren?: (path: string) => ReactNode;
  onNewInProject?: (path: string) => void;
  needsApproval: ReadonlySet<string>;
};

function ProjectSection({
  compact,
  hideHeader = false,
  label,
  expanded,
  onToggleExpanded,
  items,
  leadingEntries = [],
  itemOrder,
  section,
  muteStatuses,
  emptyLabel,
  onAdd,
  cwd,
  busy,
  statsEnabled,
  tree,
  onReorder,
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
  hideHeader?: boolean;
  label: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  items: RecentProject[];
  leadingEntries?: ProjectListEntry[];
  itemOrder?: string[];
  section?: "recent";
  muteStatuses: ReadonlyMap<string, string | null>;
  emptyLabel?: string;
  onAdd?: () => void;
  cwd: string;
  busy: Set<string>;
  statsEnabled: boolean;
  tree?: ProjectTree;
  onReorder: (ids: string[]) => void;
  pinned: boolean;
  searchActive: boolean;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (
    path: string,
    x: number,
    y: number,
    trigger?: HTMLElement | null,
  ) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  const contentId = useId();
  const preview = useSidebarListPreview(
    items.length + leadingEntries.length,
    String(searchActive),
    searchActive,
  );
  const rows = orderByIds<{
    id: string;
    entry?: ProjectListEntry;
    project?: RecentProject;
  }>(
    [
      ...leadingEntries.map((entry) => ({ id: `session:${entry.id}`, entry })),
      ...items.map((project) => ({ id: project.path, project })),
    ],
    itemOrder ?? [],
  ).sort((a, b) => Number(!!b.entry) - Number(!!a.entry));
  const sessionSortable = useAnimatedReorder(
    rows
      .slice(0, preview.count)
      .filter((row) => pinned && row.entry)
      .map((row) => row.id),
    onReorder,
    "y",
    undefined,
    { activationDistance: 3 },
  );
  const sortable = useAnimatedReorder(
    rows
      .slice(0, preview.count)
      .filter((row) => row.project)
      .map((row) => row.id),
    onReorder,
    "y",
    undefined,
    {
      activationDistance: 3,
      collapsedSize: tree ? collapsedProjectHeaderSize : undefined,
    },
  );
  return (
    <div
      className={compact ? "shrink-0" : `shrink-0 ${tree ? "mb-1" : "mb-2"}`}
      data-project-section={section ?? (pinned ? "pinned" : "projects")}
    >
      {compact || hideHeader ? null : (
        <ProjectSectionHeader
          label={label}
          onAdd={onAdd}
          expanded={expanded}
          contentId={contentId}
          onToggleExpanded={onToggleExpanded}
        />
      )}
      <AnimatedCollapse
        keepMounted
        expanded={compact || hideHeader || expanded}
        motion="height"
        className="project-tree-collapse"
        durationMs={PROJECT_COLLAPSE_DURATION_MS}
      >
        <div id={contentId}>
          {items.length === 0 && leadingEntries.length === 0 && emptyLabel ? (
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
            {rows
              .slice(0, preview.mountedCount)
              .map(({ id, entry, project: item }, index) => (
                <AnimatedCollapse key={id} expanded={index < preview.count}>
                  {() => {
                    if (entry)
                      return (
                        <SidebarEntry
                          entry={entry}
                          id={id}
                          sortable={pinned ? sessionSortable : undefined}
                        />
                      );
                    if (!item) return null;
                    return (
                      <ProjectCard
                        compact={compact}
                        key={item.path}
                        item={item}
                        muteStatus={
                          muteStatuses.get(pathKey(item.path)) ?? undefined
                        }
                        selected={
                          (!searchActive || !!tree) &&
                          sameProjectPath(item.path, cwd)
                        }
                        busy={isBusyPath(item.path, busy)}
                        statsEnabled={
                          statsEnabled &&
                          (!tree || sameProjectPath(item.path, cwd))
                        }
                        tree={tree}
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
                    );
                  }}
                </AnimatedCollapse>
              ))}
            {preview.button}
          </div>
        </div>
      </AnimatedCollapse>
    </div>
  );
}

function SidebarEntry({
  entry,
  id,
  sortable,
}: {
  entry: ProjectListEntry;
  id: string;
  sortable?: SortableHandle;
}) {
  const content =
    typeof entry.content === "function" ? entry.content() : entry.content;
  if (!sortable) return content;
  return (
    <SidebarEntryReorderContext.Provider
      value={{
        dragging: sortable.draggingId !== null,
        onPointerDown: (event, externalDrop) =>
          sortable.onItemPointerDown(id, event, externalDrop),
        consumeClick: sortable.consumeClick,
      }}
    >
      <div
        ref={(node) => sortable.setItemRef(id, node)}
        data-sidebar-pinned-entry={id}
        className="reorder-item sidebar-pinned-entry relative"
      >
        {content}
      </div>
    </SidebarEntryReorderContext.Provider>
  );
}

function ProjectSectionHeader({
  label,
  expanded,
  contentId,
  onToggleExpanded,
  onAdd,
  onAddGroup,
}: {
  label: string;
  expanded: boolean;
  contentId: string;
  onToggleExpanded: () => void;
  onAdd?: () => void;
  onAddGroup?: (x: number, y: number) => void;
}) {
  const { t: uiT } = useTranslation();
  return (
    <div className="flex items-center gap-1 px-3 py-0.5">
      <button
        type="button"
        data-sidebar-section-toggle
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggleExpanded}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-0.5 text-left text-xs text-foreground-subtle hover:bg-surface-hover hover:text-content"
      >
        <ChevronRight
          className="project-tree-chevron size-3 shrink-0"
        />
        <span className="truncate">{label}</span>
      </button>
      {onAddGroup ? (
        <button
          type="button"
          title={uiT("New project group")}
          aria-label={uiT("New project group")}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onAddGroup(rect.left, rect.bottom);
          }}
          className="grid size-5 shrink-0 place-items-center rounded-lg text-foreground-subtle hover:bg-surface-hover hover:text-content"
        >
          <FolderPlus className="size-3.5" />
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
  tree,
  onReorder,
  searchActive,
  onSelect,
  onTogglePin,
  onContextMenu,
  onOpenMenu,
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
  tree?: ProjectTree;
  onReorder: (ids: string[]) => void;
  searchActive: boolean;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (
    path: string,
    x: number,
    y: number,
    trigger?: HTMLElement | null,
  ) => void;
  onToggleCollapsed: () => void;
  onOpenGroupMenu: (x: number, y: number) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  const preview = useSidebarListPreview(
    items.length,
    String(searchActive),
    searchActive,
  );
  const sortable = useAnimatedReorder(
    items.slice(0, preview.count).map((item) => item.path),
    onReorder,
    "y",
    undefined,
    {
      activationDistance: 3,
      collapsedSize: tree ? collapsedProjectHeaderSize : undefined,
    },
  );
  const countLabel = uiT(
    items.length === 1 ? "{count} project" : "{count} projects",
    { count: items.length },
  );
  const expanded =
    compact || !group.collapsed || (searchActive && items.length > 0);
  const openMenu = (target: HTMLElement, x?: number, y?: number) => {
    const rect = target.getBoundingClientRect();
    onOpenGroupMenu(x ?? rect.left, y ?? rect.bottom);
  };

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg ${
        tree
          ? `mb-1 last:mb-0 ${expanded ? "bg-content/5" : ""}`
          : expanded && !compact
            ? "mb-1.5 bg-content/5"
            : ""
      }`}
      data-project-group={group.id}
      role="group"
      aria-label={group.name}
    >
      {compact ? null : (
        <div
          className="project-reorder-item group relative flex h-8 items-stretch rounded-lg px-2 opacity-65 cursor-default"
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
            aria-expanded={expanded}
            aria-label={`${group.name}, ${countLabel}`}
            title={`${group.name} · ${countLabel}`}
            onClick={searchActive ? undefined : onToggleCollapsed}
            className="flex min-w-0 flex-1 cursor-default items-center gap-2 text-left transition-[padding] duration-150 motion-reduce:transition-none group-hover:pr-6 group-has-[:focus-visible]:pr-6"
          >
            <div className="grid size-4 shrink-0 place-items-center">
              {!expanded ? (
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
              ) : null}
              <ChevronRight
                data-group-chevron
                className={`project-tree-chevron size-3.5 ${expanded ? "" : "hidden group-hover:block group-has-[:focus-visible]:block"}`}
              />
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
            className="absolute right-1 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-lg text-content/55 hover:bg-surface-hover hover:text-content group-hover:grid group-has-[:focus-visible]:grid"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      )}
      <AnimatedCollapse
        keepMounted
        expanded={expanded}
        motion={tree ? "height" : undefined}
        className={tree ? "project-tree-collapse" : undefined}
        durationMs={tree ? PROJECT_COLLAPSE_DURATION_MS : undefined}
      >
        <div
          data-project-group-items
          className={
            compact
              ? "flex flex-col items-center gap-1"
              : `flex flex-col gap-px ${tree ? "px-1 py-px" : "p-1"}`
          }
        >
          {items.slice(0, preview.mountedCount).map((item, index) => (
            <AnimatedCollapse key={item.path} expanded={index < preview.count}>
              <ProjectCard
                compact={compact}
                key={item.path}
                item={item}
                muteStatus={muteStatuses.get(pathKey(item.path)) ?? undefined}
                selected={
                  (!searchActive || !!tree) && sameProjectPath(item.path, cwd)
                }
                busy={isBusyPath(item.path, busy)}
                statsEnabled={
                  statsEnabled && (!tree || sameProjectPath(item.path, cwd))
                }
                tree={tree}
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
            </AnimatedCollapse>
          ))}
          {preview.button}
        </div>
      </AnimatedCollapse>
    </div>
  );
}

const nameClassName =
  "min-w-0 flex-1 truncate text-ui-base font-medium leading-tight";

function ProjectCard({
  compact,
  item,
  muteStatus,
  selected,
  busy,
  statsEnabled,
  tree,
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
  tree?: ProjectTree;
  pinned: boolean;
  sortable?: SortableHandle;
  onSelect: (path: string) => void;
  onTogglePin: (path: string) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  onOpenMenu: (
    path: string,
    x: number,
    y: number,
    trigger?: HTMLElement | null,
  ) => void;
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupLogos: ReturnType<typeof useTabGroupLogos>;
  groupMascots: Record<string, string>;
}) {
  const { t: uiT } = useTranslation();
  const hoverSummary = useContext(ProjectSummaryContext);
  const hover = useHoverSummary<HTMLButtonElement>({
    enabled: !hoverSummary.disabled && !sortable?.draggingId,
    interactive: true,
    onOpen: () => hoverSummary.onOpen?.(item.path),
  });
  const nameButtonRef = hover.anchorRef;
  const summary = hoverSummary.summaries?.get(pathKey(item.path));
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
  const disconnected = !!remote && (!machine || online === false);
  const connection = !remote
    ? ""
    : !machine
      ? uiT("Machine not connected on this computer")
      : online === undefined
        ? uiT("Connecting")
        : online
          ? uiT("Connected")
          : uiT("Reconnecting");
  const cardAriaLabel = projectCardAriaLabel(
    machine
      ? uiT("{project} on {machine}", { project: name, machine: machine.name })
      : name,
    stats,
    busy,
    uiT,
  );
  const labelClassName = (
    machine
      ? "min-w-0 max-w-[75%] shrink-0 truncate text-ui-base font-medium leading-tight"
      : nameClassName
  ).replace("font-medium", tree ? "font-normal" : "font-medium");
  const treeAvatar = tree ? (
    <ProjectAvatar
      path={item.path}
      busy={busy}
      colors={groupColors}
      customColors={groupCustomColors}
      logos={groupLogos}
      mascots={groupMascots}
      className="size-4"
    />
  ) : null;
  const expandable = tree?.canExpandProject?.(item.path) !== false;
  const expanded =
    expandable && (tree?.expandedPaths.has(pathKey(item.path)) ?? false);
  const needsApproval = tree?.needsApproval.has(pathKey(item.path)) ?? false;
  useEffect(() => {
    if (!expanded && tree?.pendingActivation.current === pathKey(item.path))
      tree.pendingActivation.current = undefined;
  }, [expanded, item.path, tree?.pendingActivation]);

  const header = (
    <div
      ref={tree ? undefined : (el) => sortable?.setItemRef(item.path, el)}
      data-selected={selected || undefined}
      data-project-header={tree ? "" : undefined}
      className={`${tree ? "project-tree-header project-reorder-item" : "reorder-item project-reorder-item"} group relative flex touch-none items-stretch rounded-lg ${compact ? "size-8" : "px-2 h-8"} ${
        tree
          ? selected
            ? "text-content hover:bg-surface-hover"
            : "text-content/80 hover:bg-surface-hover hover:text-content"
          : selected
            ? "bg-selection-strong text-content"
            : "opacity-65"
      } cursor-grab`}
      onPointerEnter={hover.triggerProps.onPointerEnter}
      onPointerLeave={hover.triggerProps.onPointerLeave}
      onPointerDown={(event) => {
        hover.triggerProps.onPointerDown();
        if (event.button !== 0) return;
        hover.close();
        if ((event.target as HTMLElement | null)?.closest("[data-no-drag]")) {
          return;
        }
        sortable?.onItemPointerDown(item.path, event);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement | null)?.closest("[data-no-drag]")) {
          return;
        }
        if (sortable?.consumeClick()) return;
        hover.close();
        if (
          !expanded &&
          expandable &&
          tree?.onActivateProject &&
          tree.onToggleProject
        ) {
          // Workspace/editor initialization must not block the disclosure frames.
          tree.pendingActivation.current = pathKey(item.path);
          tree.onToggleProject(item.path);
        } else {
          if (tree?.pendingActivation.current === pathKey(item.path))
            tree.pendingActivation.current = undefined;
          onSelect(item.path);
        }
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
      {tree && expandable ? (
        // Like project groups, the avatar slot doubles as the disclosure so
        // session rows can indent to the project name.
        <button
          type="button"
          data-no-drag
          aria-label={uiT(expanded ? "Collapse project" : "Expand project")}
          aria-expanded={expanded}
          title={uiT(expanded ? "Collapse project" : "Expand project")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (tree.pendingActivation.current === pathKey(item.path))
              tree.pendingActivation.current = undefined;
            tree.onToggleProject?.(item.path);
          }}
          className="grid w-4 shrink-0 place-items-center rounded-sm text-content/55 outline-none hover:text-content"
        >
          <span
            data-project-avatar
            className="project-card-logo grid size-4 place-items-center group-hover:hidden group-has-[:focus-visible]:hidden"
          >
            {treeAvatar}
          </span>
          <ChevronRight
            data-project-chevron
            className="project-tree-chevron hidden size-3.5 group-hover:block group-has-[:focus-visible]:block"
          />
        </button>
      ) : tree ? (
        <span
          data-project-avatar
          className="project-card-logo grid w-4 shrink-0 place-items-center"
        >
          {treeAvatar}
        </span>
      ) : null}
      <button
        ref={nameButtonRef}
        type="button"
        data-project-select={pathKey(item.path)}
        aria-label={
          muteStatus ? `${cardAriaLabel}, ${muteStatus}` : cardAriaLabel
        }
        aria-description={remote?.cwd ?? item.path}
        aria-current={selected ? "true" : undefined}
        aria-expanded={tree && expandable ? expanded : undefined}
        aria-haspopup="dialog"
        aria-describedby={hover.open ? hover.id : undefined}
        onFocus={() => {
          if (hoverSummary.restoringPinFocusPath?.current === item.path) return;
          hover.triggerProps.onFocus();
        }}
        onBlur={hover.triggerProps.onBlur}
        onKeyDown={hover.triggerProps.onKeyDown}
        className={
          compact
            ? "relative grid size-8 cursor-grab place-items-center"
            : `flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left ${tree ? "pl-2 group-hover:pr-12 group-has-[:focus-visible]:pr-12" : "transition-[padding] duration-150 motion-reduce:transition-none group-hover:pr-6 group-has-[:focus-visible]:pr-6"}`
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
            {tree ? null : (
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
            )}
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
            {needsApproval ? (
              <span
                role="img"
                aria-label={uiT("Needs approval")}
                title={uiT("Needs approval")}
                className="size-1.5 shrink-0 rounded-full bg-amber-400"
              />
            ) : busy ? (
              <span role="img" aria-label={uiT("Working...")}>
                <TerminalSpinner className="inline-block w-3 shrink-0 select-none text-center text-ui-sm leading-none text-brand" />
              </span>
            ) : summary?.historyState === "error" && !disconnected ? (
              <span
                role="img"
                aria-label={uiT("Couldn’t load sessions")}
                className="size-1.5 shrink-0 rounded-full bg-destructive"
              />
            ) : summary && summary.unread > 0 ? (
              <span
                role="img"
                aria-label={uiT("Unread")}
                className="size-1.5 shrink-0 rounded-full bg-sky-500"
              />
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
              aria-hidden="true"
            />
            <span
              aria-hidden="true"
              className={`absolute right-0 bottom-0 size-1.5 rounded-full ring-1 ring-background-base ${
                online
                  ? "bg-emerald-400"
                  : disconnected
                    ? "bg-destructive"
                    : "bg-content/35"
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
              aria-hidden="true"
            />
          </span>
        ) : null}
      </button>
      {compact ? null : (
        <>
          {tree?.onNewInProject ? (
            <button
              type="button"
              data-no-drag
              aria-label={uiT("New session in {project}", { project: name })}
              title={uiT("New session in {project}", { project: name })}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                tree.onNewInProject?.(item.path);
              }}
              className="absolute right-7 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-lg text-content/55 hover:bg-surface-hover hover:text-content group-hover:grid group-has-[:focus-visible]:grid"
            >
              <Plus className="size-3.5" />
            </button>
          ) : null}
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
            className="absolute right-1 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-lg text-content/55 hover:bg-surface-hover hover:text-content group-hover:grid group-has-[:focus-visible]:grid"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {tree ? null : (
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
                <PinOff className="size-3.5" />
              ) : (
                <Pin className="size-3.5" />
              )}
            </button>
          )}
        </>
      )}
      <HoverSummary
        hover={hover}
        role="dialog"
        label={uiT("Project summary for {project}", { project: name })}
        data-project-summary={pathKey(item.path)}
      >
        <div className="flex min-w-0 items-start gap-2.5 text-content">
          <ProjectAvatar
            path={item.path}
            busy={busy}
            colors={groupColors}
            customColors={groupCustomColors}
            logos={groupLogos}
            mascots={groupMascots}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0 flex-1 text-ui-caption font-medium leading-relaxed [overflow-wrap:anywhere]">
            {name}
          </span>
          <button
            type="button"
            data-no-drag
            aria-label={uiT(pinned ? "Unpin project" : "Pin project")}
            aria-pressed={pinned}
            onClick={() => {
              hover.close();
              if (hoverSummary.onPin) hoverSummary.onPin(item.path);
              else onTogglePin(item.path);
            }}
            className="grid size-6 shrink-0 place-items-center rounded-lg text-content/45 hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            {pinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
          </button>
        </div>
        {summary ? (
          <>
            <div className="mt-2 flex min-w-0 items-start gap-2 text-content/65">
              <MessageSquare
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-content/45"
              />
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                <span>
                  {uiT(
                    summary.total === 1
                      ? "{count} session"
                      : "{count} sessions",
                    {
                      count:
                        summary.total === undefined
                          ? "—"
                          : formatInteger(summary.total),
                    },
                  )}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {uiT("{count} unread", {
                    count: formatInteger(summary.unread),
                  })}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {uiT("{count} opened", {
                    count: formatInteger(summary.opened),
                  })}
                </span>
              </div>
            </div>
            {summary.historyState === "idle" ||
            summary.historyState === "loading" ? (
              <p role="status" className="mt-1.5 text-[11px] text-content/45">
                {uiT("Loading project summary…")}
              </p>
            ) : summary.historyState === "error" ? (
              <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px]">
                <p role="status" className="min-w-0 flex-1 text-foreground-subtle">
                  {uiT("Project summary unavailable")}
                </p>
                {hoverSummary.onOpen && summary.canRetry !== false ? (
                  <button
                    type="button"
                    aria-label={uiT("Retry")}
                    onClick={() => hoverSummary.onOpen?.(item.path)}
                    className="shrink-0 rounded-lg px-1.5 py-0.5 text-content/65 hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
                  >
                    {uiT("Retry")}
                  </button>
                ) : null}
              </div>
            ) : null}
            {summary.cached ? (
              <p className="mt-1 text-[11px] text-content/45">
                {uiT("Showing cached summary")}
              </p>
            ) : null}
          </>
        ) : null}
        <div className="mt-2.5 space-y-2 border-t border-content/10 pt-2.5">
          <HoverSummaryRow icon={<FolderOpen />} label={uiT("Project path")}>
            {remote?.cwd ?? item.path}
          </HoverSummaryRow>
          {remote ? (
            <HoverSummaryRow icon={<Internet />} label={uiT("Machine")}>
              <span>{machine?.name ?? uiT("another machine")}</span>
              <span className="block text-[11px] text-content/45">
                {connection}
              </span>
            </HoverSummaryRow>
          ) : null}
          {muteStatus ? (
            <HoverSummaryRow icon={<BellOff />} label={uiT("Notifications")}>
              {muteStatus}
            </HoverSummaryRow>
          ) : null}
        </div>
        <div className="mt-2.5 border-t border-content/10 pt-1.5">
          <button
            type="button"
            data-no-drag
            aria-label={uiT("Edit project")}
            onClick={() => {
              const trigger = nameButtonRef.current;
              if (!trigger) return;
              const rect = trigger.getBoundingClientRect();
              hover.close();
              onOpenMenu(item.path, rect.left, rect.bottom, trigger);
            }}
            className="-mx-1 flex w-[calc(100%+8px)] items-center gap-2 rounded-lg px-1 py-1.5 text-left text-content/75 hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            <Settings className="size-3.5 text-content/45" aria-hidden="true" />
            {uiT("Edit project")}
          </button>
        </div>
      </HoverSummary>
    </div>
  );
  return tree ? (
    <div
      ref={(el) => sortable?.setItemRef(item.path, el)}
      data-project-path={pathKey(item.path)}
      className="reorder-item relative shrink-0"
    >
      {header}
      <AnimatedCollapse
        keepMounted
        expanded={expanded && sortable?.draggingId !== item.path}
        motion="height"
        className="project-tree-collapse"
        durationMs={PROJECT_COLLAPSE_DURATION_MS}
        animateContentResize
        onEntered={() => {
          if (tree.pendingActivation.current !== pathKey(item.path)) return;
          tree.pendingActivation.current = undefined;
          tree.onActivateProject?.(item.path);
        }}
      >
        {() => (
          <div data-project-children={pathKey(item.path)}>
            {tree.renderProjectChildren?.(item.path)}
          </div>
        )}
      </AnimatedCollapse>
    </div>
  ) : (
    header
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
export function AddProjectButton({
  onOpenFolder,
}: {
  onOpenFolder: () => void;
}) {
  const { t: uiT } = useTranslation();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-ui-caption text-content/80 hover:bg-surface-hover hover:text-content";
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
        className="grid size-5 shrink-0 place-items-center rounded-lg text-foreground-subtle hover:bg-surface-hover hover:text-content aria-expanded:bg-content/8 aria-expanded:text-content"
      >
        <Plus className="size-3.5" />
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
            <FolderPlus className="size-3.5 shrink-0" />
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
            <Internet className="size-3.5 shrink-0" />
            {uiT("Open folder on a machine…")}
          </button>
        </Popover>
      ) : null}
    </>
  );
}
