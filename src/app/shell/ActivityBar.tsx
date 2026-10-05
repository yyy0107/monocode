import { useRef, useState, type ComponentProps } from "react";
import {
  ArrowDownCircle,
  Bot,
  Folder,
  Inbox,
  Loader,
  Search,
  Settings,
  StickyNote,
  Zap,
  type IconComponent,
} from "../../shared/ui/icons";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { useShortcutLabel } from "../commands/useCommandShortcut";
import { Popover } from "../../shared/ui/Popover";
import {
  collectRailProjects,
  type RecentProject,
} from "../../features/projects/model/recents";
import { InboxNotificationMenu } from "../../features/inbox/ui/InboxNotificationMenu";
import { LiveAgentsPreview } from "../../features/sessions/ui/LiveAgentsPreview";
import type { LiveAgent } from "../../features/sessions/model/liveAgents";
import type { InstalledUpdate } from "../model/updateNotice";
import { ProjectList } from "./ProjectList";
import { SidebarUpdate } from "./SidebarUpdate";
import { UpdateRailCard } from "./UpdateRailCard";
import { useUpdateStatus } from "./useUpdateStatus";

export type ActivityBarProps = {
  chromeInMenuBar?: boolean;
  cwd: string;
  recents: RecentProject[];
  busyPaths?: Iterable<string>;
  liveAgents?: LiveAgent[];
  activeSessionId?: string;
  onSelectProject: (path: string) => void;
  onOpenProject: () => void;
  onShowProjects?: () => void;
  onRemoveProject?: ComponentProps<typeof ProjectList>["onRemoveProject"];
  onSelectAgent?: (sessionId: string) => void;
  onSearch?: () => void;
  onOpenInbox?: () => void;
  onOpenNotes?: () => void;
  onOpenAutomations?: () => void;
  onOpenSettings?: () => void;
  onOpenNotificationSettings?: (projectPath?: string) => void;
  searchActive?: boolean;
  inboxActive?: boolean;
  notesActive?: boolean;
  automationsActive?: boolean;
  settingsActive?: boolean;
  notesEnabled?: boolean;
  inboxUnseen?: boolean;
  updateNotice?: InstalledUpdate | null;
  onOpenWhatsNew?: (version: string) => void;
  onDismissUpdate?: () => void;
};

/** Window-wide destinations stay available beside every workspace pane. */
export function ActivityBar({
  chromeInMenuBar = false,
  cwd,
  recents,
  busyPaths,
  liveAgents = [],
  activeSessionId,
  onSelectProject,
  onOpenProject,
  onShowProjects,
  onRemoveProject,
  onSelectAgent,
  onSearch,
  onOpenInbox,
  onOpenNotes,
  onOpenAutomations,
  onOpenSettings,
  onOpenNotificationSettings,
  searchActive = false,
  inboxActive = false,
  notesActive = false,
  automationsActive = false,
  settingsActive = false,
  notesEnabled = true,
  inboxUnseen = false,
  updateNotice,
  onOpenWhatsNew,
  onDismissUpdate,
}: ActivityBarProps) {
  const { t } = useTranslation();
  const quickOpenLabel = useShortcutLabel("Quick Open", "App: Go to File");
  const settingsLabel = useShortcutLabel("Settings", "App: Settings");
  const [popup, setPopup] = useState<"projects" | "agents" | "updates" | null>(
    null,
  );
  const [projectQuery, setProjectQuery] = useState("");
  const [inboxMenu, setInboxMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const inboxTrigger = useRef<HTMLElement | null>(null);
  const projectsAnchor = useRef<HTMLButtonElement>(null);
  const agentsAnchor = useRef<HTMLButtonElement>(null);
  const updatesAnchor = useRef<HTMLButtonElement>(null);
  const { snapshot, setSnapshot, actionable } = useUpdateStatus();
  const showUpdates =
    actionable || Boolean(updateNotice && onOpenWhatsNew && onDismissUpdate);
  const selectProject = (path: string) => {
    setPopup(null);
    onSelectProject(path);
  };
  const listProps = {
    cwd,
    recents,
    busyPaths,
    onSelectProject: selectProject,
    onOpenProject,
    onRemoveProject,
    onOpenNotificationSettings,
  };
  const togglePopup = (next: typeof popup) => {
    setInboxMenu(null);
    if (next === "projects") setProjectQuery("");
    setPopup((value) => (value === next ? null : next));
  };

  return (
    <nav
      aria-label={t("Activity bar")}
      data-activity-bar
      className="shell-chrome sidebar-glass flex h-full w-12 shrink-0 flex-col items-center border-r border-stroke pb-1.5"
    >
      {!chromeInMenuBar ? (
        <div className="h-10 w-full shrink-0" data-tauri-drag-region="deep" />
      ) : null}
      <div className="flex shrink-0 flex-col gap-1.5 pt-1.5">
        <ActivityAction
          label={quickOpenLabel}
          icon={Search}
          active={searchActive}
          onClick={onSearch}
        />
        <ActivityAction
          label={inboxUnseen ? t("Inbox, new items") : t("Inbox")}
          icon={Inbox}
          active={inboxActive}
          dot={inboxUnseen}
          onClick={onOpenInbox}
          onOpenContextMenu={(x, y, trigger) => {
            setPopup(null);
            inboxTrigger.current = trigger;
            setInboxMenu({ x, y });
          }}
        />
        {notesEnabled ? (
          <ActivityAction
            label={t("Notes")}
            icon={StickyNote}
            active={notesActive}
            onClick={onOpenNotes}
          />
        ) : null}
        <ActivityAction
          label={t("Automations")}
          icon={Zap}
          active={automationsActive}
          onClick={onOpenAutomations}
        />
      </div>
      <div className="my-2 h-px w-7 shrink-0 bg-stroke" />
      <div className="min-h-0 flex-1" />
      <div className="flex shrink-0 flex-col gap-1.5 pt-1.5">
        <ActivityAction
          ref={projectsAnchor}
          label={t("All projects")}
          icon={Folder}
          active={popup === "projects"}
          expanded={onShowProjects ? undefined : popup === "projects"}
          onClick={onShowProjects ?? (() => togglePopup("projects"))}
        />
        {liveAgents.length > 0 ? (
          <ActivityAction
            ref={agentsAnchor}
            label={t("Working agents, {count}", { count: liveAgents.length })}
            icon={Bot}
            dot={liveAgents.some((agent) => agent.needsApproval)}
            active={popup === "agents"}
            expanded={popup === "agents"}
            onClick={() => togglePopup("agents")}
          />
        ) : null}
        {showUpdates ? (
          <ActivityAction
            ref={updatesAnchor}
            label={t("Updates")}
            icon={snapshot.phase === "downloading" ? Loader : ArrowDownCircle}
            dot
            active={popup === "updates"}
            expanded={popup === "updates"}
            onClick={() => togglePopup("updates")}
          />
        ) : null}
        <ActivityAction
          label={settingsLabel}
          icon={Settings}
          active={settingsActive}
          onClick={onOpenSettings}
        />
      </div>
      {popup === "projects" ? (
        <Popover
          anchor={projectsAnchor}
          side="right"
          align="end"
          width={280}
          maxHeight={600}
          onDismiss={(reason) => {
            setPopup(null);
            if (reason === "escape") projectsAnchor.current?.focus();
          }}
          role="dialog"
          ignore="[data-popover-side]"
          aria-label={t("All projects")}
          className="flex flex-col py-2"
        >
          <input
            autoFocus
            aria-label={t("Search projects")}
            placeholder={t("Search projects...")}
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            className="mx-2 mb-2 h-8 shrink-0 rounded-md bg-content/5 px-2 text-sm text-content outline-none focus:ring-1 focus:ring-accent/40"
          />
          <ProjectList
            {...listProps}
            query={projectQuery}
            onOpenProject={() => {
              setPopup(null);
              onOpenProject();
            }}
          />
        </Popover>
      ) : null}
      {popup === "agents" ? (
        <Popover
          anchor={agentsAnchor}
          side="right"
          align="end"
          width={280}
          maxHeight={500}
          onDismiss={(reason) => {
            setPopup(null);
            if (reason === "escape") agentsAnchor.current?.focus();
          }}
          role="dialog"
          aria-label={t("Working agents")}
          className="py-2"
        >
          <LiveAgentsPreview
            minimumAgents={1}
            agents={liveAgents}
            activeSessionId={activeSessionId}
            onSelect={(id) => {
              setPopup(null);
              onSelectAgent?.(id);
            }}
          />
        </Popover>
      ) : null}
      {popup === "updates" && showUpdates ? (
        <Popover
          anchor={updatesAnchor}
          side="right"
          align="end"
          width={280}
          onDismiss={(reason) => {
            setPopup(null);
            if (reason === "escape") updatesAnchor.current?.focus();
          }}
          role="dialog"
          aria-label={t("Updates")}
          className="flex flex-col gap-2 p-2"
        >
          {updateNotice && onOpenWhatsNew && onDismissUpdate ? (
            <UpdateRailCard
              update={updateNotice}
              onOpen={(version) => {
                setPopup(null);
                onOpenWhatsNew(version);
              }}
              onDismiss={() => {
                setPopup(null);
                onDismissUpdate();
              }}
            />
          ) : null}
          {actionable ? (
            <SidebarUpdate snapshot={snapshot} onSnapshot={setSnapshot} />
          ) : null}
        </Popover>
      ) : null}
      {inboxMenu ? (
        <InboxNotificationMenu
          {...inboxMenu}
          projectPaths={[...collectRailProjects(recents, cwd).keys()]}
          onOpenSettings={onOpenNotificationSettings}
          onClose={() => {
            setInboxMenu(null);
            inboxTrigger.current?.focus();
          }}
        />
      ) : null}
    </nav>
  );
}

function ActivityAction({
  label,
  icon: Icon,
  active = false,
  dot = false,
  expanded,
  onClick,
  onOpenContextMenu,
  ref,
}: {
  label: string;
  icon: IconComponent;
  active?: boolean;
  dot?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  onOpenContextMenu?: (x: number, y: number, trigger: HTMLElement) => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      aria-expanded={expanded}
      disabled={!onClick}
      onClick={onClick}
      onContextMenu={
        onOpenContextMenu
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.focus();
              onOpenContextMenu(
                event.clientX,
                event.clientY,
                event.currentTarget,
              );
            }
          : undefined
      }
      onKeyDown={
        onOpenContextMenu
          ? (event) => {
              if (
                event.key !== "ContextMenu" &&
                !(event.shiftKey && event.key === "F10")
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.focus();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenContextMenu(rect.right, rect.top, event.currentTarget);
            }
          : undefined
      }
      className={`relative grid size-8 shrink-0 place-items-center rounded-md ${active ? "bg-selection text-content" : "text-content/50 hover:bg-content/10 hover:text-content"} disabled:cursor-default disabled:opacity-35`}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {dot ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-1.5 rounded-full bg-accent"
        />
      ) : null}
    </button>
  );
}
