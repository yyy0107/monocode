import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { setUiLanguage, type UiLanguage } from "../../../shared/i18n/language";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ConnectionsSettings } from "../../connections/ui/ConnectionsSettings";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  ArrowDownCircle,
  Check,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Globe,
  ImagePlus,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "../../../shared/ui/icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { HarnessIcon } from "../../sessions/ui/HarnessIcon";
import {
  ColorPickerPopover,
  ColorSwatchRow,
} from "../../../shared/ui/ColorPickerPopover";
import { Popover } from "../../../shared/ui/Popover";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { NativeSessionsPanel } from "./NativeSessionsPanel";
import { JiraSettings } from "./JiraSettings";
import { GradientBlurBackground } from "./GradientBlurBackground";
import { McpSettings } from "./McpSettings";
import { InboxProviderMark } from "../../inbox/ui/InboxProviderMark";
import { RemoveProjectDialog } from "../../projects/ui/RemoveProjectDialog";
import { SettingsNav } from "../../../app/shell/SettingsRail";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import { useColorScheme } from "../../../shared/hooks/useColorScheme";
import {
  applyChatBackground,
  applyChatBackgroundEmptyOpacity,
  applyChatBackgroundSessionOpacity,
  applyChatBackgroundScope,
  applyAccentColor,
  applyBodyGlass,
  applyPopoverOpacity,
  applySidebarBlur,
  applySidebarOpacity,
  applyThemeDarkLightness,
  applyThemePreference,
  applyThemeTint,
  BODY_GLASS_DEFAULT,
  ACCENT_COLOR_DEFAULT,
  CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT,
  CHAT_BACKGROUND_OPACITY_MAX,
  CHAT_BACKGROUND_OPACITY_MIN,
  CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT,
  CHAT_BACKGROUND_SCOPE_DEFAULT,
  THEME_PREFERENCE_DEFAULT,
  chatBackgroundSrc,
  loadBodyGlass,
  loadPopoverOpacity,
  loadAccentColor,
  loadChatBackgroundEmptyOpacity,
  loadChatBackgroundPath,
  loadChatBackgroundSessionOpacity,
  loadChatBackgroundScope,
  loadNewThreadBackgroundEffect,
  loadThemeDarkLightness,
  loadThemePreference,
  loadSidebarBlur,
  loadSidebarOpacity,
  loadThemeHue,
  loadThemeSaturation,
  loadTranscriptLayout,
  loadTranscriptAnchor,
  saveBodyGlass,
  savePopoverOpacity,
  saveAccentColor,
  saveChatBackgroundEmptyOpacity,
  saveChatBackgroundPath,
  saveChatBackgroundSessionOpacity,
  saveChatBackgroundScope,
  setNewThreadBackgroundEffect,
  saveThemeDarkLightness,
  saveThemePreference,
  saveSidebarBlur,
  saveSidebarOpacity,
  saveThemeHue,
  saveThemeSaturation,
  isLightScheme,
  saveTranscriptLayout,
  saveTranscriptAnchor,
  syncNativeGlass,
  TRANSCRIPT_ANCHOR_CHANGE_EVENT,
  loadShowExcludedFiles,
  saveShowExcludedFiles,
  SHOW_EXCLUDED_FILES_DEFAULT,
  SIDEBAR_BLUR_DEFAULT,
  SIDEBAR_BLUR_MAX,
  SIDEBAR_BLUR_MIN,
  SIDEBAR_OPACITY_DEFAULT,
  SIDEBAR_OPACITY_MAX,
  SIDEBAR_OPACITY_MIN,
  POPOVER_OPACITY_DEFAULT,
  POPOVER_OPACITY_MAX,
  POPOVER_OPACITY_MIN,
  THEME_DARK_LIGHTNESS_DEFAULT,
  THEME_DARK_LIGHTNESS_MAX,
  THEME_DARK_LIGHTNESS_MIN,
  THEME_HUE_DEFAULT,
  THEME_HUE_MAX,
  THEME_HUE_MIN,
  THEME_SATURATION_DEFAULT,
  THEME_SATURATION_MAX,
  THEME_SATURATION_MIN,
  type ThemePreference,
  type ChatBackgroundScope,
  NEW_THREAD_BACKGROUND_EFFECTS,
  NEW_THREAD_BACKGROUND_EFFECT_LABELS,
  NEW_THREAD_BACKGROUND_EFFECT_DESCRIPTIONS,
  NEW_THREAD_BACKGROUND_EFFECT_DEFAULT,
  type NewThreadBackgroundEffect,
  type TranscriptLayout,
} from "../model/appearance";
import {
  pickAndSaveChatBackground,
  removeChatBackground,
} from "../../projects/model/chatBackground";
import {
  applyUiScale,
  loadUiScale,
  saveUiScale,
  subscribeUiScale,
  UI_SCALE_DEFAULT,
  UI_SCALE_PERCENTS,
} from "../model/uiScale";
import {
  getHarnessAvailabilitySnapshot,
  harnessUnavailableHint,
  isHarnessAvailable,
  probeHarnessAvailability,
  subscribeHarnessAvailability,
} from "../../../integrations/harness/core/availability";
import {
  inspectHarnessBinary,
  type HarnessBinaryInspection,
} from "../../../integrations/harness/core/child";
import {
  loadProviderBinaryPath,
  providerBinaryPathChangePending,
  saveProviderBinaryPath,
  type ConfigurableBinaryProvider,
} from "../../providers/model/providerBinaryPaths";
import {
  compareSemver,
  MINIMUM_OPENCODE_VERSION,
  parseOpenCodeVersion,
} from "../../../integrations/harness/providers/opencode/opencodeProtocol";
import { refreshHarnessCatalogs } from "../../../integrations/harness/core/registry";
import { loginHarness } from "../../../integrations/harness/core/auth";
import {
  defaultModelId,
  firstEnabledHarness,
  getModelSnapshot,
  loadDefaultModels,
  loadHiddenPickerProviders,
  loadLastModelChoice,
  modelsFor,
  resolveModel,
  saveDefaultModel,
  saveLastModelChoice,
  savePickerProviderVisible,
  subscribeModels,
} from "../../sessions/model/models";
import {
  pathKey,
  prettyCwd,
  projectKey,
  projectName,
} from "../../../shared/lib/paths";
import { revealPath } from "../../../platform/tauri/fs";
import { IS_LINUX, IS_MAC, IS_WIN } from "../../../platform/tauri/platform";
import {
  loadArchivedProjects,
  looksLikeProject,
  subscribeArchivedProjects,
  type ArchivedProject,
  type RecentProject,
} from "../../projects/model/recents";
import {
  HARNESSES,
  HARNESS_TITLE,
  sessionDisplayTitle,
  type HarnessId,
} from "../../sessions/model/session";
import {
  loadProjectProviderSettings,
  projectProvidersRevision,
  setProjectDefaultModel,
  setProjectDefaultProvider,
  setProjectProviderHidden,
  subscribeProjectProviders,
} from "../../sessions/model/projectProviders";
import {
  newProviderAccount,
  providerAccounts,
  PROVIDER_ACCOUNT_PROVIDERS,
  removeProviderAccount,
  renameProviderAccount,
  saveProviderAccount,
  subscribeProviderAccounts,
  type ProviderAccount,
  type ProviderAccountProvider,
} from "../../providers/model/providerAccounts";
import { removeProviderAccountCredentials } from "../../providers/model/providerAccountCredentials";
import {
  identityKey,
  identityOrganizationTag,
  useProviderAccountIdentities,
} from "../../providers/model/providerAccountIdentity";
import { ProviderAccountSubtitle } from "../../providers/ui/ProviderAccountSubtitle";
import {
  saveMaskEmails,
  saveShowRemainingUsage,
  useMaskEmails,
  useShowRemainingUsage,
} from "../model/displayPrefs";
import {
  accountStatus,
  accountUsageKey,
  useProviderAccountUsage,
} from "../../providers/model/accountUsage";
import { clearCachedRateLimits } from "../../providers/model/rateLimitsCache";
import {
  AccountStatusLabel,
  AccountUsageMeters,
  AccountUsageRefresh,
} from "../../providers/ui/ProviderAccountUsage";
import {
  loadSessionSidebarFilters,
  saveSessionSidebarFilters,
} from "../../sessions/model/sessionFilters";
import type { SessionSummary } from "../../sessions/data/sessionStore";
import {
  clearInboxCache,
  githubStatus,
  type GithubStatus,
} from "../../inbox/model/githubTasks";
import {
  disconnectGitlab,
  gitlabConnected,
  saveGitlabConfig,
} from "../../inbox/model/gitlab";
import {
  azureDevOpsConnected,
  disconnectAzureDevOps,
  saveAzureDevOpsConfig,
} from "../../inbox/model/azureDevOps";
import {
  disconnectLinear,
  LINEAR_CHANGE_EVENT,
  linearConnected,
  listLinearTeams,
  loadHiddenLinearTeamIds,
  notifyLinearChange,
  saveHiddenLinearTeamIds,
  saveLinearToken,
  type LinearTeam,
} from "../../inbox/model/linear";
import {
  loadTabGroupColors,
  loadTabGroupCustomColors,
  loadTabGroupLabels,
  loadTabGroupMascots,
  resolveTabGroupColor,
  resolveTabGroupLabel,
  resolveTabGroupLogo,
  resolveTabGroupMascot,
} from "../../workspace/model/tabGroups";
import { useTabGroupLogos } from "../../projects/hooks/useTabGroupLogos";
import { ProjectLogoIcon } from "../../projects/ui/ProjectLogoIcon";
import { ProjectMascot } from "../../projects/ui/ProjectMascot";
import {
  filterKeybindings,
  currentKeybindings,
  loadClaudeHooks,
  loadCloseToTray,
  loadComposerRunner,
  loadDiffViewer,
  loadFileTabMode,
  loadFollowUpBehavior,
  loadFormatOnSave,
  loadGridArcadeEnabled,
  loadLiveAgentsEnabled,
  loadMenuBarVisible,
  loadModelControls,
  loadNotesEnabled,
  loadKeybindingOverrides,
  loadQuickComposerEnabled,
  loadQuickComposerShortcut,
  loadTabAnimationsEnabled,
  saveClaudeHooks,
  saveCloseToTray,
  saveComposerRunner,
  saveDiffViewer,
  saveFileTabMode,
  saveFollowUpBehavior,
  saveFormatOnSave,
  saveGridArcadeEnabled,
  saveLiveAgentsEnabled,
  saveMenuBarVisible,
  saveModelControls,
  saveNotesEnabled,
  saveKeybindingOverride,
  validateKeybindingShortcut,
  saveQuickComposerEnabled,
  saveQuickComposerShortcut,
  subscribeKeybindings,
  subscribeMenuBarVisible,
  type KeybindingOverride,
  saveTabAnimationsEnabled,
  searchSettings,
  settingsSectionDescription,
  settingsSectionLabel,
  type DiffViewer,
  type FileTabMode,
  type FollowUpBehavior,
  type ModelControls,
  type SettingsSearchResult,
  type SettingsSectionId,
} from "../model/settings";
import { loadSoundsEnabled, playCue, saveSoundsEnabled } from "../model/sounds";
import { setQuickComposerShortcut } from "../../quick-composer/model/quickComposer";
import {
  isGlobalShortcut,
  QUICK_COMPOSER_DEFAULT_SHORTCUT,
  quickComposerShortcutLabel,
  quickComposerShortcutPreview,
  shortcutFromKeyEvent,
} from "../../quick-composer/model/quickComposerShortcut";
import {
  cachedNotificationPermission,
  loadNotificationsEnabled,
  openNotificationSettings,
  probeNotificationPermission,
  requestNotificationPermission,
  saveNotificationsEnabled,
  type NotificationPermission,
} from "../../notifications/model/notifications";
import {
  installPendingUpdate,
  readAppVersion,
  runUpdateFlow,
  type UpdaterSnapshot,
} from "../../../app/model/updater";

import { SkillsPage } from "../../skills/ui/SkillsPage";
import { ProjectNotificationSettings } from "../../notifications/ui/ProjectNotificationSettings";
import { WorktreesPage } from "../../source-control/ui/WorktreesPage";
import {
  removeWorktree,
  type RemoveWorktree,
} from "../../source-control/model/worktrees";
import type { Session } from "../../sessions/model/session";

/**
 * The `data-setting-id` Settings should reveal when it opens: one of the ids in
 * `SETTINGS_INDEX`. Inbox integrations pass their provider id.
 */
export type SettingsAnchor = string;

const settingDomId = (id: string) => `setting-${id}`;

/** The row or group Settings just jumped to, so it can flash where you landed. */
const RevealedSetting = createContext<string | null>(null);

type Props = {
  section: SettingsSectionId;
  /** Hidden or unfocused workspace views must not consume global shortcuts. */
  active?: boolean;
  /** Card to scroll to; the General page is too long to land at the top. */
  anchor?: SettingsAnchor | null;
  /** Project to focus when opening notification settings from a quick action. */
  notificationProjectPath?: string | null;
  /** Changes for each quick action, including repeated requests for one project. */
  notificationSettingsRequest?: number;
  recents?: RecentProject[];
  cwd: string;
  sessions: SessionSummary[];
  liveSessions?: Session[];
  onRemoveWorktree?: RemoveWorktree;
  onCheckWorktreeRemoval?: RemoveWorktree;
  onDeleteWorktreeSessions?: (
    sessionIds: readonly string[],
  ) => Promise<boolean>;
  onClose: () => void;
  /** Lets search jump to a setting that lives on another page. */
  onSelectSection?: (section: SettingsSectionId) => void;
  onOpenSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreProject?: (path: string) => void;
  onDeleteProject?: (path: string) => void;
  onOpenWhatsNew: (version: string) => void;
};

export function SettingsView({
  section: requestedSection,
  active = true,
  anchor = null,
  notificationProjectPath = null,
  notificationSettingsRequest = 0,
  recents,
  cwd,
  sessions,
  liveSessions,
  onRemoveWorktree = removeWorktree,
  onCheckWorktreeRemoval,
  onDeleteWorktreeSessions,
  onClose,
  onSelectSection,
  onOpenSession,
  onArchiveSession,
  onDeleteSession,
  onRestoreProject,
  onDeleteProject,
  onOpenWhatsNew,
}: Props) {
  const { t: uiT } = useTranslation();
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const [section, setSection] = useState(requestedSection);
  const [revealed, setRevealed] = useState<string | null>(anchor);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const appearance = useAppearanceSettings();

  useEffect(() => setSection(requestedSection), [requestedSection]);

  const selectSection = useCallback(
    (next: SettingsSectionId) => {
      setSection(next);
      onSelectSection?.(next);
    },
    [onSelectSection],
  );

  useEffect(() => setRevealed(anchor), [anchor, notificationSettingsRequest]);

  // Section is a dependency so a search result on another page scrolls once
  // that page has mounted the row.
  useEffect(() => {
    if (!revealed) return;
    // A project quick action lets the project card focus itself after discovery.
    if (!(revealed === "project-notifications" && notificationProjectPath)) {
      document
        .getElementById(settingDomId(revealed))
        ?.scrollIntoView?.({ block: "center" });
    }
    const timer = window.setTimeout(() => setRevealed(null), 1800);
    return () => window.clearTimeout(timer);
  }, [revealed, section, notificationProjectPath, notificationSettingsRequest]);

  const onReveal = useCallback(
    (next: SettingsSectionId, settingId: string | null) => {
      if (next !== section) selectSection(next);
      setRevealed(settingId);
    },
    [selectSection, section],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    // Let dialogs and other Settings controls handle Escape first.
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <div
      role="region"
      aria-label={uiT("Settings")}
      data-app-settings
      className="flex min-h-0 min-w-0 flex-1 flex-col text-content"
    >
      <div className="flex h-10 shrink-0 select-none items-center border-b border-stroke">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
          <span className="shrink-0 text-content/45">{uiT("Settings")}</span>
          <span aria-hidden className="shrink-0 text-content/25">
            /
          </span>
          <span className="min-w-0 truncate text-content">
            {settingsSectionLabel(section)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pr-2">
          {section === "appearance" ? (
            <button
              type="button"
              onClick={appearance.restoreDefaults}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-content/50 hover:bg-content/10 hover:text-content"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              {uiT("Restore defaults")}
            </button>
          ) : null}
          <SettingsSearch onReveal={onReveal} />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        <SettingsNav section={section} onSelect={selectSection} />
        {section === "skills" ? (
          <SkillsPage
            key={cwd}
            cwd={cwd}
            header={
              <PageHeader
                title={settingsSectionLabel(section)}
                description={settingsSectionDescription(section)}
              />
            }
          />
        ) : (
          <RevealedSetting.Provider value={revealed}>
            <div
              ref={lockOverscroll}
              className="@container/settings min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none"
            >
              <div className="mx-auto w-full max-w-5xl px-5 py-6 pb-16 @min-[560px]/settings:px-8 @min-[560px]/settings:py-8">
                <PageHeader
                  title={settingsSectionLabel(section)}
                  description={settingsSectionDescription(section)}
                />
                {section === "general" ? (
                  <GeneralPage onOpenWhatsNew={onOpenWhatsNew} />
                ) : null}
                {section === "connections" ? <ConnectionsSettings /> : null}
                {section === "appearance" ? (
                  <AppearancePage appearance={appearance} />
                ) : null}
                {section === "chat" ? <ChatPage /> : null}
                {section === "keybindings" ? <KeybindingsPage /> : null}
                {section === "mcp" ? (
                  <McpSettings cwd={cwd} recents={recents} />
                ) : null}
                {section === "providers" ? (
                  <ProvidersPage
                    cwd={cwd}
                    recents={recents}
                    onOpenSession={onOpenSession}
                  />
                ) : null}
                {section === "worktrees" ? (
                  <WorktreesPage
                    cwd={cwd}
                    recents={recents}
                    liveSessions={liveSessions}
                    onRemove={onRemoveWorktree}
                    onCheckRemove={onCheckWorktreeRemoval}
                    onDeleteSessions={onDeleteWorktreeSessions}
                  />
                ) : null}
                {section === "inbox" ? (
                  <InboxPage
                    cwd={cwd}
                    recents={recents}
                    notificationProjectPath={notificationProjectPath}
                    notificationSettingsRequest={notificationSettingsRequest}
                  />
                ) : null}
                {section === "archive" ? (
                  <ArchivePage
                    cwd={cwd}
                    sessions={sessions}
                    onOpenSession={onOpenSession}
                    onArchiveSession={onArchiveSession}
                    onDeleteSession={onDeleteSession}
                    onRestoreProject={onRestoreProject}
                    onDeleteProject={onDeleteProject}
                  />
                ) : null}
              </div>
            </div>
          </RevealedSetting.Provider>
        )}
      </div>
    </div>
  );
}

/** Jumps to any setting by name, including ones on another page. */
function SettingsSearch({
  onReveal,
}: {
  onReveal: (section: SettingsSectionId, settingId: string | null) => void;
}) {
  const { language, t: uiT } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchSettings(query), [query, language]);
  const open = query.trim().length > 0;

  useEffect(() => setActive(0), [query]);

  const go = (result: SettingsSearchResult | undefined) => {
    if (!result) return;
    onReveal(result.section, result.settingId);
    setQuery("");
    input.current?.blur();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <label className="flex h-7 w-48 items-center gap-2 rounded-md border border-content/10 px-2 text-content/45 focus-within:border-content/20">
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
        <input
          ref={input}
          role="combobox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={uiT("Search settings")}
          aria-label={uiT("Search settings")}
          aria-expanded={open}
          aria-controls={listId}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
        />
        {query ? (
          <button
            type="button"
            aria-label={uiT("Clear settings search")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            className="grid size-4 shrink-0 place-items-center rounded text-content/45 hover:text-content"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        ) : null}
      </label>
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={300}
          maxHeight={320}
          onDismiss={(reason) => {
            setQuery("");
            if (reason === "escape") input.current?.focus();
          }}
          id={listId}
          role="listbox"
          aria-label={uiT("Settings search results")}
          className="overflow-y-auto overscroll-contain p-1"
        >
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-content/45">
              {uiT("No matching settings")}
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.section}:${result.settingId ?? "*"}`}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
                  index === active
                    ? "bg-selection text-content"
                    : "text-content hover:bg-content/5"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                <span className="shrink-0 text-[11px] text-content/40">
                  {result.settingId ? result.sectionLabel : uiT("Page")}
                </span>
              </button>
            ))
          )}
        </Popover>
      ) : null}
    </div>
  );
}

function GeneralPage({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const [soundsEnabled, setSoundsEnabled] = useState(loadSoundsEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    loadNotificationsEnabled,
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(cachedNotificationPermission);
  const [notesEnabled, setNotesEnabled] = useState(loadNotesEnabled);
  const [liveAgentsEnabled, setLiveAgentsEnabled] = useState(
    loadLiveAgentsEnabled,
  );
  const [fileTabMode, setFileTabMode] = useState<FileTabMode>(loadFileTabMode);
  const [tabAnimationsEnabled, setTabAnimationsEnabled] = useState(
    loadTabAnimationsEnabled,
  );
  const [closeToTray, setCloseToTray] = useState(loadCloseToTray);
  const [quickComposerEnabled, setQuickComposerEnabled] = useState(
    loadQuickComposerEnabled,
  );
  const [quickComposerError, setQuickComposerError] = useState<string | null>(
    null,
  );

  // The user may flip the switch in System Settings and come back: re-read
  // the OS state whenever the window regains focus while the toggle is on.
  useEffect(() => {
    if (!notificationsEnabled) return;
    const refresh = () => {
      void probeNotificationPermission().then(setNotificationPermission);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [notificationsEnabled]);

  const onSoundsEnabled = (next: boolean) => {
    saveSoundsEnabled(next);
    setSoundsEnabled(next);
  };

  const onNotificationsEnabled = (next: boolean) => {
    saveNotificationsEnabled(next);
    setNotificationsEnabled(next);
    if (!next) return;
    void requestNotificationPermission().then(setNotificationPermission);
  };

  const onNotesEnabled = (next: boolean) => {
    saveNotesEnabled(next);
    setNotesEnabled(next);
  };

  const onQuickComposerEnabled = (next: boolean) => {
    saveQuickComposerEnabled(next);
    setQuickComposerEnabled(next);
    setQuickComposerError(null);
    void setQuickComposerShortcut(next).catch((error: unknown) => {
      // Another app already owns the combination. Leave the switch where the
      // user put it so the next launch tries again, but say why it is dead.
      setQuickComposerError(String(error));
    });
  };

  const onLiveAgentsEnabled = (next: boolean) => {
    saveLiveAgentsEnabled(next);
    setLiveAgentsEnabled(next);
  };

  const onFileTabMode = (next: FileTabMode) => {
    saveFileTabMode(next);
    setFileTabMode(next);
  };

  const onTabAnimationsEnabled = (next: boolean) => {
    saveTabAnimationsEnabled(next);
    setTabAnimationsEnabled(next);
  };

  const onCloseToTray = (next: boolean) => {
    saveCloseToTray(next);
    setCloseToTray(next);
  };

  return (
    <>
      <LanguageSetting />
      <Group
        title={uiT("Alerts")}
        description={uiT(
          "How MonoCode reaches you while you are looking somewhere else.",
        )}
      >
        <Row
          id="sounds"
          label={uiT("Sounds")}
          description={uiT(
            "Short cues for project activity, finished turns, and available updates. Choose project notification categories in Inbox settings. Switches and Copy on a finished turn also play.",
          )}
        >
          <Toggle
            label={uiT("Sounds")}
            on={soundsEnabled}
            onChange={onSoundsEnabled}
          />
        </Row>
        <Row
          id="notifications"
          label={uiT("Notifications")}
          description={uiT(
            "Notify when a reminder is due, or when an agent finishes or needs input in another session or while MonoCode is in the background. Click the notification to open that session.",
          )}
        >
          {notificationsEnabled && notificationPermission === "denied" ? (
            <NotificationsBlocked />
          ) : null}
          {notificationsEnabled && notificationPermission === "unsupported" ? (
            <span className="text-[12px] text-content/45">
              {uiT("Not available on this platform")}
            </span>
          ) : null}
          <Toggle
            label={uiT("Notifications")}
            on={notificationsEnabled}
            onChange={onNotificationsEnabled}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Workspace")}
        description={uiT("How project navigation and workspace tabs behave.")}
      >
        <Row
          id="file-tabs"
          label={uiT("File tabs")}
          description={uiT(
            "Open files beside the active chat, or give each file a normal tab in the top bar. Top-bar files can still be combined into split panes.",
          )}
        >
          <Segmented
            label={uiT("File tabs")}
            value={fileTabMode}
            options={[
              { value: "pane", label: uiT("Beside chat") },
              { value: "workspace", label: uiT("Top bar") },
            ]}
            onChange={onFileTabMode}
          />
        </Row>
        <Row
          id="tab-animations"
          label={uiT("Tab animations")}
          description={uiT(
            "Animate tabs as they open and close. Turn this off for instant tab changes.",
          )}
        >
          <Toggle
            label={uiT("Tab animations")}
            on={tabAnimationsEnabled}
            onChange={onTabAnimationsEnabled}
          />
        </Row>
        <Row
          id="notes"
          label={uiT("Notes")}
          description={uiT(
            "A global markdown notebook in the activity bar. Save a finished turn from the transcript, then mention it later with @note or add it to chat.",
          )}
        >
          <Toggle
            label={uiT("Notes")}
            on={notesEnabled}
            onChange={onNotesEnabled}
          />
        </Row>
        {IS_MAC && (
          <Row
            id="quick-composer"
            label={uiT("Quick composer")}
            description={uiT(
              "Press {value0} in any app to float a prompt over it and start a session without switching to MonoCode. Change the shortcut in Keybindings. Return starts it in the background; ⌘Return starts it and brings the session forward.",
              {
                value0: String(
                  quickComposerShortcutLabel(loadQuickComposerShortcut()),
                ),
              },
            )}
          >
            {quickComposerError ? (
              <span className="text-[12px] text-content/45">
                {quickComposerError}
              </span>
            ) : null}
            <Toggle
              label={uiT("Quick composer")}
              on={quickComposerEnabled}
              onChange={onQuickComposerEnabled}
            />
          </Row>
        )}
        <Row
          id="working-agents"
          label={uiT("Working agents")}
          description={uiT(
            "Open the working agents icon in the activity bar to jump across projects. Finished turns stay until you open that session.",
          )}
        >
          <Toggle
            label={uiT("Working agents")}
            on={liveAgentsEnabled}
            onChange={onLiveAgentsEnabled}
          />
        </Row>
        {IS_WIN && (
          <Row
            id="close-to-tray"
            label={uiT("Close to tray")}
            description={uiT(
              "Closing a window hides it to the system tray instead of quitting, so running agents keep going. Reopen from the tray icon, and quit for real from its menu. Turn this off to have close end the window.",
            )}
          >
            <Toggle
              label={uiT("Close to tray")}
              on={closeToTray}
              onChange={onCloseToTray}
            />
          </Row>
        )}
      </Group>

      <Group title={uiT("About")}>
        <UpdateRow onOpenWhatsNew={onOpenWhatsNew} />
      </Group>
    </>
  );
}

function LanguageSetting() {
  const { language, t } = useTranslation();
  return (
    <Group
      title={t("Language")}
      description={t(
        "Choose the language used by MonoCode. Changes apply immediately to all windows.",
      )}
    >
      <Row
        id="ui-language"
        label={t("Interface language")}
        description={t(
          "Your choice is remembered. Agent messages, code, and project names keep their original content.",
        )}
      >
        <Segmented<UiLanguage>
          label={t("Interface language")}
          value={language}
          options={[
            { value: "en", label: "English" },
            { value: "zh-CN", label: "简体中文" },
          ]}
          onChange={setUiLanguage}
        />
      </Row>
    </Group>
  );
}

function ChatPage() {
  const { t: uiT } = useTranslation();
  const [transcriptLayout, setTranscriptLayout] =
    useState<TranscriptLayout>(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] =
    useState(loadTranscriptAnchor);
  const [followUpBehavior, setFollowUpBehavior] =
    useState<FollowUpBehavior>(loadFollowUpBehavior);
  const [modelControls, setModelControls] =
    useState<ModelControls>(loadModelControls);
  const [diffViewer, setDiffViewer] = useState<DiffViewer>(loadDiffViewer);
  const [formatOnSave, setFormatOnSave] = useState(loadFormatOnSave);
  const [composerRunner, setComposerRunner] = useState(loadComposerRunner);
  const [gridArcadeEnabled, setGridArcadeEnabled] = useState(
    loadGridArcadeEnabled,
  );

  useEffect(() => {
    const onAnchor = (event: Event) => {
      setTranscriptAnchor((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    return () => {
      window.removeEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    };
  }, []);

  const onTranscriptLayout = (next: TranscriptLayout) => {
    saveTranscriptLayout(next);
    setTranscriptLayout(next);
  };

  const onTranscriptAnchor = (next: boolean) => {
    saveTranscriptAnchor(next);
    setTranscriptAnchor(next);
  };

  const onFollowUpBehavior = (next: FollowUpBehavior) => {
    saveFollowUpBehavior(next);
    setFollowUpBehavior(next);
  };

  const onModelControls = (next: ModelControls) => {
    saveModelControls(next);
    setModelControls(next);
  };

  const onDiffViewer = (next: DiffViewer) => {
    saveDiffViewer(next);
    setDiffViewer(next);
  };

  const onFormatOnSave = (next: boolean) => {
    saveFormatOnSave(next);
    setFormatOnSave(next);
  };

  const onComposerRunner = (next: boolean) => {
    saveComposerRunner(next);
    setComposerRunner(next);
  };

  const onGridArcadeEnabled = (next: boolean) => {
    saveGridArcadeEnabled(next);
    setGridArcadeEnabled(next);
  };

  return (
    <>
      <Group
        title={uiT("Transcript")}
        description={uiT("How a conversation reads as it grows.")}
      >
        <Row
          id="transcript-layout"
          label={uiT("Transcript layout")}
          description={uiT(
            "Full width keeps user prompts as a spanning card. Chat aligns them to the right with a max width, like a messaging app.",
          )}
        >
          <Segmented
            label={uiT("Transcript layout")}
            value={transcriptLayout}
            options={[
              { value: "full", label: uiT("Full width") },
              { value: "chat", label: uiT("Chat") },
            ]}
            onChange={onTranscriptLayout}
          />
        </Row>
        <Row
          id="anchor-prompts"
          label={uiT("Anchor prompts to top")}
          description={uiT(
            "When you send, the new prompt sits at the top of the transcript and the reply grows into the space below. Turn this off to keep the classic layout, with the latest message resting on the composer.",
          )}
        >
          <Toggle
            label={uiT("Anchor prompts to top")}
            on={transcriptAnchor}
            onChange={onTranscriptAnchor}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Composer")}
        description={uiT("What the composer does with what you type.")}
      >
        <Row
          id="follow-up"
          label={uiT("Follow-up behavior")}
          description={uiT(
            "Queue follow-ups until the active turn finishes, or steer the active turn immediately.",
          )}
        >
          <Segmented
            label={uiT("Follow-up behavior")}
            value={followUpBehavior}
            options={[
              { value: "queue", label: uiT("Queue") },
              { value: "steer", label: uiT("Steer") },
            ]}
            onChange={onFollowUpBehavior}
          />
        </Row>
        <Row
          id="model-controls"
          label={uiT("Model controls")}
          description={uiT(
            "Show model options beside the picker instead of inside the model menu.",
          )}
        >
          <Segmented
            label={uiT("Model controls")}
            value={modelControls}
            options={[
              { value: "menu", label: uiT("Menu") },
              { value: "beside", label: uiT("Beside") },
            ]}
            onChange={onModelControls}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Editor")}
        description={uiT(
          "What happens when you save a file in the workspace editor.",
        )}
      >
        <Row
          id="format-on-save"
          label={uiT("Format on save")}
          description={uiT(
            "Run Prettier on supported files before writing. Off keeps the text you typed, including quote style.",
          )}
        >
          <Toggle
            label={uiT("Format on save")}
            on={formatOnSave}
            onChange={onFormatOnSave}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Code review")}
        description={uiT(
          "Where a turn's changes open when you go to read them.",
        )}
      >
        <Row
          id="diff-view"
          label={uiT("Diff view")}
          description={uiT(
            "Editor keeps working-tree changes in the file. Unified stacks every changed file in one review, with sticky headers and collapsed unchanged lines.",
          )}
        >
          <Segmented
            label={uiT("Diff view")}
            value={diffViewer}
            options={[
              { value: "editor", label: uiT("Editor") },
              { value: "unified", label: uiT("Unified") },
            ]}
            onChange={onDiffViewer}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Extras")}
        description={uiT(
          "Idle animation, and nothing else. Turn both off for a still workspace.",
        )}
      >
        <Row
          id="composer-mascot"
          label={uiT("Composer mascot")}
          description={uiT(
            "When a turn is running, the project mascot runs along the composer, bonks the scroll-to-latest button the first time, then jumps it, and sometimes grabs a coin.",
          )}
        >
          <Toggle
            label={uiT("Composer mascot")}
            on={composerRunner}
            onChange={onComposerRunner}
          />
        </Row>
        <Row
          id="empty-session-games"
          label={uiT("Empty session games")}
          description={uiT(
            "Pac-man and snake idle on the empty-session grid. Hover the band to take control of whichever is on screen. Turn this off to keep the pane still.",
          )}
        >
          <Toggle
            label={uiT("Empty session games")}
            on={gridArcadeEnabled}
            onChange={onGridArcadeEnabled}
          />
        </Row>
      </Group>
    </>
  );
}

function InboxPage({
  cwd,
  recents,
  notificationProjectPath,
  notificationSettingsRequest,
}: {
  cwd: string;
  recents?: RecentProject[];
  notificationProjectPath?: string | null;
  notificationSettingsRequest?: number;
}) {
  const { t: uiT } = useTranslation();
  const revealed = useContext(RevealedSetting);
  return (
    <>
      <div
        id={settingDomId("project-notifications")}
        data-setting-id="project-notifications"
      >
        <ProjectNotificationSettings
          cwd={cwd}
          recents={recents}
          notificationProjectPath={notificationProjectPath}
          notificationSettingsRequest={notificationSettingsRequest}
          highlighted={revealed === "project-notifications"}
        />
      </div>
      <Group
        id="github"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="github" className="size-4 shrink-0" />
            GitHub
          </span>
        }
        description={uiT(
          "Pull requests, reviews, and issues, read through the GitHub CLI.",
        )}
      >
        <GithubSettings />
      </Group>

      <Group
        id="gitlab"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="gitlab" className="size-4 shrink-0" />
            GitLab
          </span>
        }
        description={uiT(
          "Merge requests from GitLab.com or a self-managed instance.",
        )}
      >
        <GitlabSettings />
      </Group>

      <Group
        id="azuredevops"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark
              provider="azuredevops"
              className="size-4 shrink-0"
            />
            ADO
          </span>
        }
        description={uiT(
          "Pull requests and Boards work items from your ADO organization.",
        )}
      >
        <AzureDevOpsSettings />
      </Group>

      <Group
        id="jira"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="jira" className="size-4 shrink-0" />
            Jira
          </span>
        }
        description={uiT("Jira Cloud issues from the projects you pick.")}
      >
        <JiraSettings />
      </Group>

      <Group
        id="linear"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="linear" className="size-4 shrink-0" />
            Linear
          </span>
        }
        description={uiT("Issues assigned to you, from the teams you pick.")}
      >
        <LinearSettings />
      </Group>
    </>
  );
}

function GithubSettings() {
  const { t: uiT } = useTranslation();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const checkStatus = useCallback(async () => {
    const generation = ++request.current;
    setChecking(true);
    setError(null);
    try {
      const next = await githubStatus();
      if (generation === request.current) setStatus(next);
    } catch (err: unknown) {
      if (generation === request.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === request.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    return () => {
      request.current += 1;
    };
  }, [checkStatus]);

  const description = status?.connected
    ? "GitHub CLI is installed and authenticated. MonoCode uses it for GitHub inbox items."
    : status?.installed
      ? "Run gh auth login in a terminal, complete the sign-in flow, then check again."
      : "Install GitHub CLI from cli.github.com, run gh auth login in a terminal, then check again.";
  const label = checking
    ? "Checking"
    : status?.connected
      ? "Connected"
      : status?.installed
        ? "Sign in required"
        : "Not installed";

  return (
    <>
      <Row label={uiT("Connection")} description={description}>
        <span className="text-[12px] text-content/50">{label}</span>
        {!checking && !status?.installed ? (
          <SecondaryButton
            onClick={() => {
              void openUrl("https://cli.github.com/").catch(() => {});
            }}
          >
            {uiT("Installation guide")}
          </SecondaryButton>
        ) : null}
        <SecondaryButton onClick={() => void checkStatus()} disabled={checking}>
          {checking ? uiT("Checking") : uiT("Check again")}
        </SecondaryButton>
      </Row>
      {error ? (
        <p className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0">
          {error}
        </p>
      ) : null}
    </>
  );
}

function GitlabSettings() {
  const { t: uiT } = useTranslation();
  const [url, setUrl] = useState("https://gitlab.com");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gitlabConnected()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        setUrl(status.url);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await saveGitlabConfig(url, token);
      setUrl(status.url);
      setToken("");
      setConnected(status.connected);
      clearInboxCache();
    } catch (err: unknown) {
      setConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await disconnectGitlab(url);
      setConnected(false);
      setUrl(status.url);
      clearInboxCache();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row
        label={uiT("Connection")}
        description={uiT(
          "Connect GitLab.com or a self-managed GitLab instance. Use a personal access token with API access; the token is stored locally and Disconnect deletes it.",
        )}
      >
        {connected ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <span className="max-w-56 truncate text-[12px] text-content/50">
              {url}
            </span>
            <SecondaryButton
              onClick={() => void onDisconnect()}
              disabled={busy}
            >
              {uiT("Disconnect")}
            </SecondaryButton>
          </div>
        ) : (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://gitlab.com"
                aria-label={uiT("GitLab URL")}
                autoComplete="url"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSave();
                }}
                placeholder="glpat-…"
                aria-label={uiT("GitLab access token")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <SecondaryButton
              onClick={() => void onSave()}
              disabled={busy || !token.trim()}
            >
              {busy ? uiT("Saving") : uiT("Connect")}
            </SecondaryButton>
          </div>
        )}
      </Row>
      {error ? (
        <p className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0">
          {error}
        </p>
      ) : null}
    </>
  );
}

function AzureDevOpsSettings() {
  const { t: uiT } = useTranslation();
  const [url, setUrl] = useState("https://dev.azure.com/myorg");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void azureDevOpsConnected()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        if (status.url) setUrl(status.url);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await saveAzureDevOpsConfig(url, token);
      setUrl(status.url);
      setToken("");
      setConnected(status.connected);
      clearInboxCache();
    } catch (err: unknown) {
      setConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await disconnectAzureDevOps(url);
      setConnected(false);
      setUrl(status.url || url);
      clearInboxCache();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row
        label={uiT("Connection")}
        description={uiT(
          "Connect your ADO organization with a personal access token (Boards + Repos read & write for comments). The token is stored locally and Disconnect deletes it.",
        )}
      >
        {connected ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <span className="max-w-56 truncate text-[12px] text-content/50">
              {url}
            </span>
            <SecondaryButton
              onClick={() => void onDisconnect()}
              disabled={busy}
            >
              {uiT("Disconnect")}
            </SecondaryButton>
          </div>
        ) : (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://dev.azure.com/myorg"
                aria-label={uiT("Azure DevOps organization URL")}
                autoComplete="url"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSave();
                }}
                placeholder="PAT…"
                aria-label={uiT("Azure DevOps personal access token")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <SecondaryButton
              onClick={() => void onSave()}
              disabled={busy || !token.trim()}
            >
              {busy ? uiT("Saving") : uiT("Connect")}
            </SecondaryButton>
          </div>
        )}
      </Row>
      {error ? (
        <p className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0">
          {error}
        </p>
      ) : null}
    </>
  );
}

function LinearSettings() {
  const { t: uiT } = useTranslation();
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [hiddenTeamIds, setHiddenTeamIds] = useState(loadHiddenLinearTeamIds);

  const loadTeams = useCallback(async () => {
    try {
      const next = await listLinearTeams();
      setTeams(next);
    } catch {
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void linearConnected()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        if (status.connected) void loadTeams();
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadTeams]);

  // The inbox filter menu writes the same list, so follow it while both are mounted.
  useEffect(() => {
    const onChange = () => setHiddenTeamIds(loadHiddenLinearTeamIds());
    window.addEventListener(LINEAR_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LINEAR_CHANGE_EVENT, onChange);
  }, []);

  const onSave = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveLinearToken(token);
      setToken("");
      setConnected(true);
      clearInboxCache();
      notifyLinearChange();
      await loadTeams();
    } catch (err: unknown) {
      setConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectLinear();
      setConnected(false);
      setTeams([]);
      clearInboxCache();
      notifyLinearChange();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleTeam = (id: string) => {
    const next = new Set(hiddenTeamIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ids = [...next];
    setHiddenTeamIds(ids);
    saveHiddenLinearTeamIds(ids);
    clearInboxCache();
  };

  return (
    <>
      <Row
        label={uiT("API key")}
        description={uiT(
          "Create a personal API key in Linear → Settings → Security & Access. Disconnect deletes it.",
        )}
      >
        {connected ? (
          <SecondaryButton onClick={() => void onDisconnect()} disabled={busy}>
            {uiT("Disconnect")}
          </SecondaryButton>
        ) : (
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSave();
                }}
                placeholder="lin_api_…"
                aria-label={uiT("Linear API key")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <SecondaryButton
              onClick={() => void onSave()}
              disabled={busy || !token.trim()}
            >
              {busy ? uiT("Saving") : uiT("Connect")}
            </SecondaryButton>
          </div>
        )}
      </Row>
      {error ? (
        <p className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0">
          {error}
        </p>
      ) : null}
      {connected && teams.length > 0 ? (
        <div className="border-b border-content/5 px-4 py-3.5 last:border-b-0">
          <div className="text-[13px] font-medium text-content">
            {uiT("Teams")}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-content/45">
            {uiT("Unchecked teams stay out of the inbox.")}
          </p>
          <div className="-mx-2 mt-2 flex flex-col gap-0.5">
            {teams.map((team) => {
              const checked = !hiddenTeamIds.includes(team.id);
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] text-content hover:bg-content/5"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {team.name}
                    {team.key ? (
                      <span className="ml-1.5 text-content/40">{team.key}</span>
                    ) : null}
                  </span>
                  {checked ? (
                    <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

function UpdateRow({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });

  useEffect(() => {
    let cancelled = false;
    void readAppVersion().then((currentVersion) => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, currentVersion }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy =
    snapshot.phase === "checking" || snapshot.phase === "downloading";
  const hasUpdate = snapshot.phase === "available";

  const onClick = async () => {
    if (busy) return;
    if (hasUpdate) {
      await installPendingUpdate(setSnapshot);
      return;
    }
    await runUpdateFlow(true, setSnapshot);
  };

  const status =
    snapshot.phase === "available"
      ? `Version ${snapshot.availableVersion} is available.`
      : snapshot.phase === "downloading"
        ? `Downloading${snapshot.progress != null ? ` ${snapshot.progress}%` : "…"}`
        : snapshot.phase === "checking"
          ? "Checking for updates…"
          : snapshot.phase === "current"
            ? "You're on the latest version."
            : snapshot.phase === "error"
              ? (snapshot.error ?? "Update check failed.")
              : "MonoCode updates itself from the release feed.";

  return (
    <Row
      id="update"
      label={
        <span className="flex items-baseline gap-2">
          {uiT("Version")}
          <span className="font-mono text-[12px] text-content/45">
            {snapshot.currentVersion}
          </span>
        </span>
      }
      description={status}
    >
      <div className="flex items-center gap-2">
        <SecondaryButton
          onClick={() => onOpenWhatsNew(snapshot.currentVersion)}
          disabled={snapshot.currentVersion === "…"}
        >
          {uiT("What's new")}
        </SecondaryButton>
        <SecondaryButton onClick={() => void onClick()} disabled={busy}>
          {busy ? (
            <Loader className="size-3.5 animate-spin" aria-hidden />
          ) : hasUpdate ? (
            <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
          {hasUpdate ? uiT("Download") : uiT("Check for updates")}
        </SecondaryButton>
      </div>
    </Row>
  );
}

type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;

function useAppearanceSettings() {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(loadThemePreference);
  const [accentColor, setAccentColor] = useState(loadAccentColor);
  const [opacity, setOpacity] = useState(loadSidebarOpacity);
  const [popoverOpacity, setPopoverOpacity] = useState(loadPopoverOpacity);
  const [blur, setBlur] = useState(loadSidebarBlur);
  const [themeHue, setThemeHue] = useState(loadThemeHue);
  const [themeSaturation, setThemeSaturation] = useState(loadThemeSaturation);
  const [themeDarkLightness, setThemeDarkLightness] = useState(
    loadThemeDarkLightness,
  );
  const [bodyGlass, setBodyGlass] = useState(loadBodyGlass);
  const [showExcludedFiles, setShowExcludedFiles] = useState(
    loadShowExcludedFiles,
  );
  const [chatBackgroundPath, setChatBackgroundPath] = useState(
    loadChatBackgroundPath,
  );
  const [chatBackgroundEmptyOpacity, setChatBackgroundEmptyOpacity] = useState(
    loadChatBackgroundEmptyOpacity,
  );
  const [chatBackgroundSessionOpacity, setChatBackgroundSessionOpacity] =
    useState(loadChatBackgroundSessionOpacity);
  const [chatBackgroundScope, setChatBackgroundScope] =
    useState<ChatBackgroundScope>(loadChatBackgroundScope);
  const [newThreadBackgroundEffect, setBackgroundEffect] =
    useState<NewThreadBackgroundEffect>(loadNewThreadBackgroundEffect);
  const [chatBackgroundBusy, setChatBackgroundBusy] = useState(false);
  const [chatBackgroundError, setChatBackgroundError] = useState<string | null>(
    null,
  );
  const [uiScale, setUiScale] = useState(loadUiScale);

  useEffect(() => subscribeUiScale(() => setUiScale(loadUiScale())), []);

  const onThemePreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    saveThemePreference(next);
    setThemePreference(next);
  }, []);

  const onAccentColor = useCallback((value: string | null) => {
    const next = applyAccentColor(value);
    saveAccentColor(next);
    setAccentColor(next);
  }, []);

  const onOpacity = useCallback((percent: number) => {
    const next = applySidebarOpacity(percent / 100);
    saveSidebarOpacity(next);
    setOpacity(next);
  }, []);

  const onPopoverOpacity = useCallback((percent: number) => {
    const next = applyPopoverOpacity(percent / 100);
    savePopoverOpacity(next);
    setPopoverOpacity(next);
  }, []);

  const onBlur = useCallback((radius: number) => {
    const next = applySidebarBlur(radius);
    saveSidebarBlur(next);
    setBlur(next);
  }, []);

  const onTint = useCallback((hue: number, saturation: number) => {
    const next = applyThemeTint(hue, saturation);
    saveThemeHue(next.hue);
    saveThemeSaturation(next.saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, []);

  const onDarkLightness = useCallback((value: number) => {
    const next = applyThemeDarkLightness(value);
    saveThemeDarkLightness(next);
    setThemeDarkLightness(next);
  }, []);

  const onBodyGlass = useCallback((next: boolean) => {
    applyBodyGlass(next);
    saveBodyGlass(next);
    setBodyGlass(next);
    if (IS_LINUX) syncNativeGlass(isLightScheme() ? "light" : "dark");
  }, []);

  const onShowExcludedFiles = useCallback((next: boolean) => {
    saveShowExcludedFiles(next);
    setShowExcludedFiles(next);
  }, []);

  const onChooseChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      const path = await pickAndSaveChatBackground();
      if (!path) return;
      saveChatBackgroundPath(path);
      applyChatBackground(path);
      setChatBackgroundPath(path);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onClearChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      await removeChatBackground();
      saveChatBackgroundPath(null);
      applyChatBackground(null);
      setChatBackgroundPath(null);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onChatBackgroundEmptyOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundEmptyOpacity(percent / 100);
    saveChatBackgroundEmptyOpacity(next);
    setChatBackgroundEmptyOpacity(next);
  }, []);

  const onChatBackgroundSessionOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundSessionOpacity(percent / 100);
    saveChatBackgroundSessionOpacity(next);
    setChatBackgroundSessionOpacity(next);
  }, []);

  const onChatBackgroundScope = useCallback((next: ChatBackgroundScope) => {
    applyChatBackgroundScope(next);
    saveChatBackgroundScope(next);
    setChatBackgroundScope(next);
  }, []);

  const onNewThreadBackgroundEffect = useCallback(
    (next: NewThreadBackgroundEffect) => {
      setNewThreadBackgroundEffect(next);
      setBackgroundEffect(next);
    },
    [],
  );

  const onUiScale = useCallback((percent: number) => {
    const next = saveUiScale(percent / 100);
    setUiScale(next);
    void applyUiScale(next);
  }, []);

  const restoreDefaults = useCallback(() => {
    onThemePreference(THEME_PREFERENCE_DEFAULT);
    onAccentColor(ACCENT_COLOR_DEFAULT);
    onOpacity(Math.round(SIDEBAR_OPACITY_DEFAULT * 100));
    onPopoverOpacity(Math.round(POPOVER_OPACITY_DEFAULT * 100));
    onBlur(SIDEBAR_BLUR_DEFAULT);
    onTint(THEME_HUE_DEFAULT, THEME_SATURATION_DEFAULT);
    onDarkLightness(THEME_DARK_LIGHTNESS_DEFAULT);
    onBodyGlass(BODY_GLASS_DEFAULT);
    onShowExcludedFiles(SHOW_EXCLUDED_FILES_DEFAULT);
    onChatBackgroundEmptyOpacity(
      Math.round(CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundSessionOpacity(
      Math.round(CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundScope(CHAT_BACKGROUND_SCOPE_DEFAULT);
    onNewThreadBackgroundEffect(NEW_THREAD_BACKGROUND_EFFECT_DEFAULT);
    if (chatBackgroundPath) void onClearChatBackground();
    onUiScale(Math.round(UI_SCALE_DEFAULT * 100));
  }, [
    chatBackgroundPath,
    onBlur,
    onBodyGlass,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundScope,
    onNewThreadBackgroundEffect,
    onClearChatBackground,
    onAccentColor,
    onShowExcludedFiles,
    onThemePreference,
    onOpacity,
    onPopoverOpacity,
    onTint,
    onDarkLightness,
    onUiScale,
  ]);

  return {
    themePreference,
    accentColor,
    opacity,
    popoverOpacity,
    blur,
    themeHue,
    themeSaturation,
    themeDarkLightness,
    bodyGlass,
    showExcludedFiles,
    chatBackgroundPath,
    chatBackgroundEmptyOpacity,
    chatBackgroundSessionOpacity,
    chatBackgroundScope,
    newThreadBackgroundEffect,
    chatBackgroundBusy,
    chatBackgroundError,
    uiScale,
    onThemePreference,
    onAccentColor,
    onOpacity,
    onPopoverOpacity,
    onBlur,
    onTint,
    onDarkLightness,
    onBodyGlass,
    onShowExcludedFiles,
    onChooseChatBackground,
    onClearChatBackground,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundScope,
    onNewThreadBackgroundEffect,
    onUiScale,
    restoreDefaults,
  };
}

function AppearancePage({ appearance }: { appearance: AppearanceSettings }) {
  const { t: uiT } = useTranslation();
  const percent = Math.round(appearance.opacity * 100);
  const popoverPercent = Math.round(appearance.popoverOpacity * 100);
  const glassDisabled = useColorScheme() === "light";

  return (
    <>
      <Group
        title={uiT("Theme")}
        description={uiT(
          "Dark and light share the same tint, so the color settings below apply to both.",
        )}
      >
        <Row
          id="theme"
          label={uiT("Theme")}
          description={uiT("System follows the OS appearance.")}
        >
          <Segmented
            label={uiT("Theme")}
            value={appearance.themePreference}
            options={[
              { value: "system", label: uiT("System") },
              { value: "dark", label: uiT("Dark") },
              { value: "light", label: uiT("Light") },
            ]}
            onChange={appearance.onThemePreference}
          />
        </Row>
        <Row
          id="accent-color"
          label={uiT("Accent color")}
          description={uiT(
            "Used for the composer send button and your message bubbles.",
          )}
        >
          <AccentColorPicker
            value={appearance.accentColor}
            onChange={appearance.onAccentColor}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Color")}
        description={uiT(
          "Hue and saturation tint every surface. Lightness only moves the dark theme.",
        )}
      >
        <Row
          id="hue"
          label={uiT("Hue")}
          description={uiT("Base hue for accents and tinted surfaces.")}
        >
          <Slider
            label={uiT("Hue")}
            value={appearance.themeHue}
            display={`${appearance.themeHue}°`}
            min={THEME_HUE_MIN}
            max={THEME_HUE_MAX}
            onChange={(value) =>
              appearance.onTint(value, appearance.themeSaturation)
            }
          />
        </Row>
        <Row
          id="saturation"
          label={uiT("Saturation")}
          description={uiT(
            "How strongly the hue tints the interface. Zero keeps it neutral.",
          )}
        >
          <Slider
            label={uiT("Saturation")}
            value={appearance.themeSaturation}
            display={`${appearance.themeSaturation}%`}
            min={THEME_SATURATION_MIN}
            max={THEME_SATURATION_MAX}
            onChange={(value) => appearance.onTint(appearance.themeHue, value)}
          />
        </Row>
        <Row
          id="dark-lightness"
          label={uiT("Dark-mode lightness")}
          description={
            glassDisabled
              ? uiT(
                  "This only affects dark mode. Your dark-mode value is preserved.",
                )
              : uiT(
                  "Base brightness of the dark theme. Lower values are darker; zero is true black.",
                )
          }
        >
          <Slider
            label={uiT("Dark-mode lightness")}
            value={appearance.themeDarkLightness}
            display={`${appearance.themeDarkLightness}%`}
            min={THEME_DARK_LIGHTNESS_MIN}
            max={THEME_DARK_LIGHTNESS_MAX}
            onChange={appearance.onDarkLightness}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <Group
        title={uiT("Translucency")}
        description={
          glassDisabled
            ? uiT(
                "Light mode keeps the main window opaque, but Popover opacity still applies to menus, pickers, and dialogs.",
              )
            : uiT(
                "How much of the desktop shows through MonoCode. Blur costs more to composite the higher it goes.",
              )
        }
      >
        <Row
          id="sidebar-opacity"
          label={uiT("Sidebar opacity")}
          description={uiT(
            "Applies to the activity bar, sidebar and other glass panes.",
          )}
        >
          <Slider
            label={uiT("Sidebar opacity")}
            value={percent}
            display={`${percent}%`}
            min={Math.round(SIDEBAR_OPACITY_MIN * 100)}
            max={Math.round(SIDEBAR_OPACITY_MAX * 100)}
            onChange={appearance.onOpacity}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="popover-opacity"
          label={uiT("Popover opacity")}
          description={uiT(
            "How much background shows through menus, pickers, dialogs, and other popovers.",
          )}
        >
          <Slider
            label={uiT("Popover opacity")}
            value={popoverPercent}
            display={`${popoverPercent}%`}
            min={Math.round(POPOVER_OPACITY_MIN * 100)}
            max={Math.round(POPOVER_OPACITY_MAX * 100)}
            onChange={appearance.onPopoverOpacity}
          />
        </Row>
        <Row
          id="blur"
          label={uiT("Blur radius")}
          description={uiT("Background blur behind the window.")}
        >
          <Slider
            label={uiT("Blur radius")}
            value={appearance.blur}
            display={String(appearance.blur)}
            min={SIDEBAR_BLUR_MIN}
            max={SIDEBAR_BLUR_MAX}
            onChange={appearance.onBlur}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="main-pane-glass"
          label={uiT("Main pane glass")}
          description={uiT(
            "Extend the translucent treatment to the main pane behind sessions and editors.",
          )}
        >
          <Toggle
            label={uiT("Main pane glass")}
            on={appearance.bodyGlass}
            onChange={appearance.onBodyGlass}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <ChatBackgroundCard appearance={appearance} />

      <Group title={uiT("Layout")}>
        {IS_MAC ? null : <MenuBarRow />}
        <Row
          id="interface-scale"
          label={uiT("Interface scale")}
          description={uiT(
            "Zoom the whole interface. You can also use Ctrl+=, Ctrl+-, and Ctrl+0 (Cmd on macOS).",
          )}
        >
          <Select
            label={uiT("Interface scale")}
            value={String(Math.round(appearance.uiScale * 100))}
            options={UI_SCALE_PERCENTS.map((percent) => ({
              value: String(percent),
              label: `${percent}%`,
            }))}
            onChange={(value) => appearance.onUiScale(Number(value))}
          />
        </Row>
        <Row
          id="show-excluded-files"
          label={uiT("Show excluded files")}
          description={uiT(
            "Show files and folders Git excludes, such as build output and dependencies, in the explorer.",
          )}
        >
          <Toggle
            label={uiT("Show excluded files")}
            on={appearance.showExcludedFiles}
            onChange={appearance.onShowExcludedFiles}
          />
        </Row>
      </Group>
    </>
  );
}

function MenuBarRow() {
  const { t: uiT } = useTranslation();
  const visible = useSyncExternalStore(
    subscribeMenuBarVisible,
    loadMenuBarVisible,
  );
  return (
    <Row
      id="menu-bar"
      label={uiT("Menu bar")}
      description={uiT(
        "Keep File, Edit, View, Go, Terminal and Help visible above the title bar. When off, tap Alt to show it.",
      )}
    >
      <Toggle
        label={uiT("Show menu bar")}
        on={visible}
        onChange={(next) => void saveMenuBarVisible(next)}
      />
    </Row>
  );
}

function ChatBackgroundCard({
  appearance,
}: {
  appearance: AppearanceSettings;
}) {
  const { t: uiT } = useTranslation();
  const src = chatBackgroundSrc(appearance.chatBackgroundPath);
  const hasImage = Boolean(appearance.chatBackgroundPath && src);
  const emptyVisibility = Math.round(
    appearance.chatBackgroundEmptyOpacity * 100,
  );
  const sessionVisibility = Math.round(
    appearance.chatBackgroundSessionOpacity * 100,
  );
  const busy = appearance.chatBackgroundBusy;

  return (
    <Group
      id="chat-background"
      title={uiT("Chat background")}
      description={uiT(
        "An image behind your chat panes. It stays on this device.",
      )}
    >
      <div className="border-b border-content/5 p-4 last:border-b-0">
        <div className="overflow-hidden rounded-lg border border-content/10">
          {hasImage ? (
            <div
              className={`relative h-36 ${appearance.newThreadBackgroundEffect === "gradient-blur" ? "bg-background-base" : ""}`}
            >
              {appearance.newThreadBackgroundEffect === "gradient-blur" ? (
                <GradientBlurBackground
                  className="gradient-blur-preview absolute inset-0"
                  style={{ opacity: appearance.chatBackgroundEmptyOpacity }}
                />
              ) : (
                <div
                  aria-hidden
                  className="size-full bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: "var(--chat-background-image)",
                    opacity: appearance.chatBackgroundEmptyOpacity,
                  }}
                />
              )}
              <span className="pointer-events-none absolute bottom-2 left-2 text-[11px] text-content/40">
                {uiT("Empty chat preview at ")}
                {emptyVisibility}%
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 text-content/40 hover:bg-content/5 hover:text-content/70 disabled:cursor-default disabled:opacity-40"
            >
              {busy ? (
                <Loader className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-[12px]">{uiT("Choose an image")}</span>
            </button>
          )}
        </div>
        {hasImage ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <SecondaryButton
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
            >
              {busy ? (
                <Loader className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              {uiT("Change")}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => void appearance.onClearChatBackground()}
              disabled={busy}
              danger
            >
              {uiT("Remove")}
            </SecondaryButton>
          </div>
        ) : null}
        {appearance.chatBackgroundError ? (
          <p className="mt-2 text-[12px] text-red-400">
            {appearance.chatBackgroundError}
          </p>
        ) : null}
      </div>
      {hasImage ? (
        <>
          <Row
            label={uiT("Background effect")}
            description={uiT(
              NEW_THREAD_BACKGROUND_EFFECT_DESCRIPTIONS[
                appearance.newThreadBackgroundEffect
              ],
            )}
          >
            <Segmented
              label={uiT("Background effect")}
              value={appearance.newThreadBackgroundEffect}
              options={NEW_THREAD_BACKGROUND_EFFECTS.map((effect) => ({
                value: effect,
                label: uiT(NEW_THREAD_BACKGROUND_EFFECT_LABELS[effect]),
              }))}
              onChange={appearance.onNewThreadBackgroundEffect}
              optionIdPrefix="new-thread-background-effect"
            />
          </Row>
          <Row
            label={uiT("Show on")}
            description={uiT("Empty sessions only, or every conversation.")}
          >
            <Segmented
              label={uiT("Show background on")}
              value={appearance.chatBackgroundScope}
              options={[
                { value: "empty", label: uiT("Empty only") },
                { value: "all", label: uiT("All sessions") },
              ]}
              onChange={appearance.onChatBackgroundScope}
            />
          </Row>
          <Row
            label={uiT("Empty chat visibility")}
            description={uiT("Background strength before a chat has messages.")}
          >
            <Slider
              label={uiT("Empty chat background visibility")}
              value={emptyVisibility}
              display={`${emptyVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onChange={appearance.onChatBackgroundEmptyOpacity}
            />
          </Row>
          <Row
            label={uiT("Session visibility")}
            description={uiT(
              "Background strength once the conversation has messages.",
            )}
          >
            <Slider
              label={uiT("Session background visibility")}
              value={sessionVisibility}
              display={`${sessionVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onChange={appearance.onChatBackgroundSessionOpacity}
            />
          </Row>
        </>
      ) : null}
    </Group>
  );
}

type ShortcutModifier = "metaKey" | "ctrlKey" | "altKey" | "shiftKey";

function shortcutModifier(event: KeyboardEvent): ShortcutModifier | null {
  if (event.key === "Meta" || event.code.startsWith("Meta")) return "metaKey";
  if (event.key === "Control" || event.code.startsWith("Control"))
    return "ctrlKey";
  if (event.key === "Alt" || event.code.startsWith("Alt")) return "altKey";
  if (event.key === "Shift" || event.code.startsWith("Shift"))
    return "shiftKey";
  return null;
}

function ShortcutEditor({
  name,
  display,
  resetVisible,
  onApply,
  onDisable,
  onReset,
}: {
  name: string;
  display: string | null;
  resetVisible: boolean;
  onApply: (shortcut: string) => void | Promise<void>;
  onDisable: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
}) {
  const { t: uiT } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const held = useRef({
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  });

  const run = async (action: () => void | Promise<void>) => {
    setRecording(false);
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const beginRecording = () => {
    held.current = {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    };
    setPreview("");
    setError(null);
    setRecording(true);
  };

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const bare =
        !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      // An unmodified Tab leaves the recorder instead of trapping focus.
      if (bare && event.code === "Tab") {
        setRecording(false);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") {
        setRecording(false);
        setError(null);
        return;
      }
      // Delete disables, but only on its own so Cmd+Delete still records.
      if (bare && (event.code === "Backspace" || event.code === "Delete")) {
        void run(onDisable);
        return;
      }
      const modifier = shortcutModifier(event);
      if (modifier) held.current[modifier] = true;
      const modifiers = {
        metaKey: event.metaKey || held.current.metaKey,
        ctrlKey: event.ctrlKey || held.current.ctrlKey,
        altKey: event.altKey || held.current.altKey,
        shiftKey: event.shiftKey || held.current.shiftKey,
      };
      setPreview(
        quickComposerShortcutPreview(
          modifiers,
          modifier ? undefined : event.code,
          event.key,
        ),
      );
      if (modifier) return;
      const next = shortcutFromKeyEvent({ ...modifiers, code: event.code });
      if (next) void run(() => onApply(next));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const modifier = shortcutModifier(event);
      if (!modifier) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      held.current[modifier] = false;
      const modifiers = {
        metaKey: event.metaKey || held.current.metaKey,
        ctrlKey: event.ctrlKey || held.current.ctrlKey,
        altKey: event.altKey || held.current.altKey,
        shiftKey: event.shiftKey || held.current.shiftKey,
      };
      modifiers[modifier] = false;
      setPreview(quickComposerShortcutPreview(modifiers));
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [onApply, onDisable, recording]);

  return (
    <div className="relative w-40 shrink-0">
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          readOnly
          aria-label={uiT("Change {value0} shortcut", { value0: String(name) })}
          data-shortcut-recorder-active={recording ? "true" : undefined}
          aria-busy={busy || undefined}
          value={
            recording || busy ? preview || "Record…" : (display ?? "Disabled")
          }
          onFocus={beginRecording}
          onClick={beginRecording}
          onBlur={() => setRecording(false)}
          className={`h-6 w-28 shrink-0 truncate rounded-md border bg-transparent px-1.5 py-0 font-mono text-[11px] leading-none outline-none focus:border-accent ${
            busy ? "opacity-50" : ""
          } ${
            display === null
              ? "border-dashed border-content/15 text-content/35"
              : "border-content/15 text-content/80 hover:bg-content/10"
          }`}
        />
        {resetVisible ? (
          <button
            type="button"
            aria-label={uiT("Reset {value0} shortcut", {
              value0: String(name),
            })}
            disabled={busy}
            onClick={() => void run(onReset)}
            className="rounded-md px-1 py-1 text-content/35 hover:bg-content/10 hover:text-content disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : null}
      </div>
      {recording ? (
        <p
          className="pointer-events-none absolute top-1/2 right-full z-40 mr-3 -translate-y-1/2 text-[10px] whitespace-nowrap text-content/50"
          aria-live="polite"
        >
          {uiT("Del disables · Esc cancels")}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="absolute top-full left-0 z-40 mt-1.5 w-max max-w-64 rounded-md border border-content/10 bg-background-base/95 px-2 py-1 text-[11px] whitespace-nowrap text-red-400 shadow-lg"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function QuickComposerShortcutEditor() {
  const [shortcut, setShortcut] = useState(loadQuickComposerShortcut);
  const [enabled, setEnabled] = useState(loadQuickComposerEnabled);
  const apply = async (next: string) => {
    if (!isGlobalShortcut(next))
      throw new Error("Quick Composer needs ⌘ or Ctrl as a global hotkey");
    // Validate before the native call: a rejected chord must not leave the OS
    // holding a registered global hotkey that settings does not know about.
    validateKeybindingShortcut("App: Quick Composer", next);
    // Recording while the feature is off must not silently switch it back on.
    if (enabled) await setQuickComposerShortcut(true, next);
    saveQuickComposerShortcut(next);
    setShortcut(next);
  };
  const reset = async () => {
    // Reset restores the whole default state, including the enabled flag.
    validateKeybindingShortcut(
      "App: Quick Composer",
      QUICK_COMPOSER_DEFAULT_SHORTCUT,
    );
    await setQuickComposerShortcut(true, QUICK_COMPOSER_DEFAULT_SHORTCUT);
    saveQuickComposerEnabled(true);
    saveQuickComposerShortcut(QUICK_COMPOSER_DEFAULT_SHORTCUT);
    setShortcut(QUICK_COMPOSER_DEFAULT_SHORTCUT);
    setEnabled(true);
  };
  return (
    <ShortcutEditor
      name="quick composer"
      display={enabled ? quickComposerShortcutLabel(shortcut) : null}
      resetVisible={
        enabled !== true || shortcut !== QUICK_COMPOSER_DEFAULT_SHORTCUT
      }
      onApply={apply}
      onDisable={async () => {
        await setQuickComposerShortcut(false);
        saveQuickComposerEnabled(false);
        setEnabled(false);
      }}
      onReset={reset}
    />
  );
}

function KeybindingShortcutEditor({
  command,
  display,
  modified,
  onSave,
}: {
  command: string;
  display: string | null;
  modified: boolean;
  onSave: (
    command: string,
    override: KeybindingOverride,
  ) => void | Promise<void>;
}) {
  const { t: uiT } = useTranslation();
  return (
    <ShortcutEditor
      name={uiT(command)}
      display={display}
      resetVisible={modified}
      onApply={(shortcut) => onSave(command, { shortcut })}
      onDisable={() => onSave(command, { disabled: true })}
      onReset={() => onSave(command, {})}
    />
  );
}

function KeybindingsPage() {
  const { t: uiT } = useTranslation();
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState(loadKeybindingOverrides);
  useEffect(
    () => subscribeKeybindings(() => setOverrides(loadKeybindingOverrides())),
    [],
  );
  const rows = useMemo(
    () => filterKeybindings(currentKeybindings(), query),
    [query, overrides],
  );

  const save = async (command: string, override: KeybindingOverride) => {
    const next = saveKeybindingOverride(command, override);
    if (IS_MAC) await invoke("keybindings_set_overrides", { overrides: next });
  };

  return (
    <Group
      title={uiT("Shortcuts")}
      description={uiT(
        "Click a shortcut to record new keys. Press Delete while recording to disable it.",
      )}
      action={
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[12px] text-content/40 tabular-nums">
            {rows.length} {rows.length === 1 ? uiT("binding") : uiT("bindings")}
          </span>
          <label className="flex h-7 w-44 shrink-0 items-center gap-2 rounded-md border border-content/10 px-2 text-content/45 focus-within:border-content/20">
            <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={uiT("Filter")}
              aria-label={uiT("Filter keybindings")}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
            />
          </label>
        </div>
      }
    >
      <div className="flex items-center border-b border-stroke bg-content/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-content/40">
        <span className="min-w-0 flex-1">{uiT("Command")}</span>
        <span className="w-40 shrink-0">{uiT("Keybinding")}</span>
        <span className="w-28 shrink-0">{uiT("When")}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-content/45">
          {uiT("No matching bindings")}
        </p>
      ) : (
        rows.map((row) => {
          const override = overrides[row.command];
          const disabled = override?.disabled === true;
          return (
            <div
              key={uiT(row.command)}
              className="flex h-11 items-center border-b border-content/5 px-4 text-[12px] last:border-b-0"
            >
              <span
                className={`min-w-0 flex-1 truncate ${disabled ? "text-content/45" : ""}`}
              >
                {uiT(row.command)}
              </span>
              {row.command === "App: Quick Composer" ? (
                <QuickComposerShortcutEditor />
              ) : (
                <KeybindingShortcutEditor
                  command={row.command}
                  display={disabled ? null : row.keys}
                  modified={Boolean(override)}
                  onSave={save}
                />
              )}
              <span className="w-28 shrink-0 font-mono text-[11px] text-content/40">
                {uiT(row.when)}
              </span>
            </div>
          );
        })
      )}
    </Group>
  );
}

const GLOBAL_PROVIDER_SCOPE = "global";

function binaryInspectionError(
  provider: ConfigurableBinaryProvider,
  inspection: HarnessBinaryInspection,
): string | null {
  if (inspection.error) return inspection.error;
  if (
    provider === "codex" &&
    !/^codex-cli\s+\d+\.\d+\.\d+/.test(inspection.version ?? "")
  ) {
    return "Codex CLI returned an invalid version.";
  }
  if (provider === "opencode") {
    const version = parseOpenCodeVersion(inspection.version ?? "");
    if (!version) return "OpenCode CLI returned an invalid version.";
    if (compareSemver(version, MINIMUM_OPENCODE_VERSION) < 0) {
      return `OpenCode v${version} is too old. Upgrade to v${MINIMUM_OPENCODE_VERSION} or newer.`;
    }
  }
  return null;
}

function ProviderBinaryControl({
  provider,
}: {
  provider: ConfigurableBinaryProvider;
}) {
  const { t: uiT } = useTranslation();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const editInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    () => loadProviderBinaryPath(provider) ?? "",
  );
  const [overridden, setOverridden] = useState(() =>
    Boolean(loadProviderBinaryPath(provider)),
  );
  const [inspection, setInspection] = useState<
    HarnessBinaryInspection & { overridden: boolean }
  >();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const inspect = useCallback(
    async (binaryPath?: string | null) => {
      setWorking(true);
      setInspection(undefined);
      setError(null);
      setRevealError(null);
      try {
        const next = await inspectHarnessBinary(provider, binaryPath);
        setInspection({
          ...next,
          overridden: Boolean(binaryPath?.trim()),
        });
        setError(binaryInspectionError(provider, next));
        return next;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        return null;
      } finally {
        setWorking(false);
      }
    },
    [provider],
  );

  useEffect(() => {
    if (editing) editInput.current?.focus();
  }, [editing]);

  const dismiss = (restoreFocus = false) => {
    setOpen(false);
    setEditing(false);
    if (restoreFocus) queueMicrotask(() => trigger.current?.focus());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    const value = draft.trim();
    if (!value) {
      await useAuto();
      return;
    }
    const next = await inspect(value);
    if (!next) return;
    const validationError = binaryInspectionError(provider, next);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!saveProviderBinaryPath(provider, value)) {
      setInspection(undefined);
      setError("Could not save the binary path.");
      return;
    }
    setOverridden(true);
    dismiss(true);
  };

  const useAuto = async () => {
    if (working) return;
    const next = await inspect(null);
    if (!next || binaryInspectionError(provider, next)) return;
    if (!saveProviderBinaryPath(provider, null)) {
      setInspection(undefined);
      setError("Could not save the binary path.");
      return;
    }
    setDraft("");
    setOverridden(false);
    dismiss(true);
  };

  const title = HARNESS_TITLE[provider];
  const restartRequired = providerBinaryPathChangePending(provider);

  return (
    <span ref={root} className="inline-flex align-middle">
      <button
        ref={trigger}
        type="button"
        aria-label={
          restartRequired
            ? uiT("Show {value0} CLI details, restart required", {
                value0: String(title),
              })
            : uiT("Show {value0} CLI details", { value0: String(title) })
        }
        aria-expanded={open}
        aria-controls={`${provider}-binary-popover`}
        aria-haspopup="dialog"
        title={uiT("{value0} CLI path{value1}", {
          value0: String(title),
          value1: String(restartRequired ? " — restart required" : ""),
        })}
        onClick={() => {
          if (!open && !inspection && !working && !error) {
            void inspect(loadProviderBinaryPath(provider));
          }
          setOpen((value) => !value);
          setEditing(false);
        }}
        className={`grid size-6 place-items-center rounded hover:bg-content/10 focus-visible:outline-2 focus-visible:outline-accent ${
          restartRequired
            ? "text-amber-300"
            : "text-content/35 hover:text-content"
        }`}
      >
        <FolderOpen className="size-3.5" strokeWidth={1.75} />
      </button>
      {open ? (
        <Popover
          id={`${provider}-binary-popover`}
          role="dialog"
          aria-label={uiT("{value0} CLI details", { value0: String(title) })}
          aria-busy={working}
          tabIndex={-1}
          anchor={root}
          side="bottom"
          align="start"
          width={440}
          className="p-3"
          autoFocus
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
              ),
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          onDismiss={(reason) => dismiss(reason === "escape")}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-content">
              {title} {uiT("CLI")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-content/10 px-1.5 py-0.5 text-[10px] text-content/50">
                {uiT("Global path")}
              </span>
              <span className="rounded-full bg-content/10 px-1.5 py-0.5 text-[10px] text-content/50">
                {error
                  ? uiT("Needs attention")
                  : restartRequired
                    ? uiT("Restart required")
                    : overridden
                      ? uiT("Configured")
                      : uiT("Auto-detected")}
              </span>
            </div>
          </div>
          {editing ? (
            <form className="mt-2" onSubmit={submit}>
              <label
                htmlFor={`${provider}-binary-path`}
                className="text-[11px] text-content/50"
              >
                {uiT("CLI path")}
              </label>
              <input
                id={`${provider}-binary-path`}
                ref={editInput}
                type="text"
                value={draft}
                placeholder={inspection?.path ?? uiT("Auto-detected path")}
                disabled={working}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1.5 h-8 w-full rounded-md border border-content/10 bg-content/[0.04] px-2 font-mono text-[11px] text-content outline-none placeholder:font-sans placeholder:text-content/35 focus:border-accent/45 disabled:opacity-50"
              />
              <p className="mt-1.5 text-[10px] text-content/40">
                {uiT(
                  "Enter the absolute path to the CLI executable. Changes apply after restarting MonoCode.",
                )}
              </p>
              {error ? (
                <span
                  role="alert"
                  className="mt-1.5 block text-[11px] text-red-400"
                >
                  {error}
                </span>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <SecondaryButton
                  disabled={working}
                  onClick={() => {
                    setDraft(loadProviderBinaryPath(provider) ?? "");
                    setEditing(false);
                    queueMicrotask(() => trigger.current?.focus());
                  }}
                >
                  {uiT("Cancel")}
                </SecondaryButton>
                {overridden ? (
                  <SecondaryButton
                    disabled={working}
                    onClick={() => void useAuto()}
                  >
                    {uiT("Use auto-detected path")}
                  </SecondaryButton>
                ) : null}
                <SecondaryButton type="submit" disabled={working}>
                  {uiT("Save path")}
                </SecondaryButton>
              </div>
            </form>
          ) : (
            <>
              <div className="mt-2 rounded-md border border-content/10 bg-content/[0.03] px-2.5 py-2">
                <span className="block max-h-12 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] text-content/65">
                  {inspection?.path ??
                    (error
                      ? uiT("CLI could not be resolved")
                      : uiT("Checking the selected CLI…"))}
                </span>
                <span className="mt-1 block max-h-10 overflow-y-auto whitespace-pre-wrap break-words text-[10px] text-content/40">
                  {inspection?.version ??
                    (error
                      ? uiT("Retry to check this CLI")
                      : uiT("Checking version…"))}
                </span>
              </div>
              {error ? (
                <span
                  role="alert"
                  title={error}
                  className="mt-1.5 block max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-red-400"
                >
                  {error}
                </span>
              ) : null}
              {revealError ? (
                <span
                  role="alert"
                  className="mt-1.5 block max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-red-400"
                >
                  {uiT("Could not open the CLI location: ")}
                  {revealError}
                </span>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                {error ? (
                  <SecondaryButton
                    disabled={working}
                    aria-label={uiT("Retry {value0} {value1}", {
                      value0: String(title),
                      value1: String(
                        overridden ? "configured path" : "auto-detect",
                      ),
                    })}
                    onClick={() =>
                      void inspect(overridden ? draft.trim() || null : null)
                    }
                  >
                    <RefreshCw className="size-3.5" strokeWidth={1.75} />
                    {overridden
                      ? uiT("Retry configured path")
                      : uiT("Retry auto-detect")}
                  </SecondaryButton>
                ) : null}
                <SecondaryButton
                  aria-label={uiT("Open {value0} CLI location", {
                    value0: String(title),
                  })}
                  disabled={!inspection}
                  onClick={() => {
                    if (inspection) {
                      void revealPath(inspection.path).catch((cause) => {
                        setRevealError(
                          cause instanceof Error
                            ? cause.message
                            : String(cause),
                        );
                      });
                    }
                  }}
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.75} />
                  {uiT("Open location")}
                </SecondaryButton>
                <SecondaryButton
                  aria-label={uiT("Edit {value0} CLI path", {
                    value0: String(title),
                  })}
                  disabled={working}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3.5" strokeWidth={1.75} />
                  {uiT("Edit path")}
                </SecondaryButton>
              </div>
            </>
          )}
        </Popover>
      ) : null}
    </span>
  );
}

function ProvidersPage({
  cwd,
  recents,
  onOpenSession,
}: {
  onOpenSession?: (id: string) => void;
  cwd?: string;
  recents?: RecentProject[];
}) {
  const { t: uiT } = useTranslation();
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  useSyncExternalStore(
    subscribeHarnessAvailability,
    getHarnessAvailabilitySnapshot,
    getHarnessAvailabilitySnapshot,
  );
  const providersRevision = useSyncExternalStore(
    subscribeProjectProviders,
    projectProvidersRevision,
    projectProvidersRevision,
  );
  void providersRevision;
  const [choice, setChoice] = useState(loadLastModelChoice);
  const [defaultModels, setDefaultModels] = useState(loadDefaultModels);
  const [claudeHooks, setClaudeHooks] = useState(loadClaudeHooks);
  const [scope, setScope] = useState<string>(GLOBAL_PROVIDER_SCOPE);
  const [hiddenGlobally, setHiddenGlobally] = useState(
    loadHiddenPickerProviders,
  );

  const scopeOptions = useMemo(() => {
    const options: { value: string; label: string; icon?: ReactNode }[] = [
      {
        value: GLOBAL_PROVIDER_SCOPE,
        label: uiT("Global"),
        icon: (
          <Globe
            className="size-3.5 shrink-0 text-content/60"
            strokeWidth={1.75}
          />
        ),
      },
    ];
    const seen = new Set<string>();
    for (const path of [cwd, ...(recents ?? []).map((entry) => entry.path)]) {
      if (!path || !looksLikeProject(path)) continue;
      const key = pathKey(path);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: path,
        label: projectName(path),
        icon: <ProjectScopeIcon path={path} />,
      });
    }
    return options;
  }, [cwd, recents, uiT]);

  const project = scope === GLOBAL_PROVIDER_SCOPE ? null : scope;
  const projectSettings = project ? loadProjectProviderSettings(project) : {};
  // A project without overrides inherits the global default provider, the same
  // way `defaultSessionChoice` resolves it for new conversations.
  const effectiveDefaultHarness = project
    ? firstEnabledHarness(
        project,
        projectSettings.defaultHarness ?? choice?.harness ?? "cursor",
      )
    : (choice?.harness ?? null);

  useEffect(() => {
    void probeHarnessAvailability();
  }, []);

  useEffect(() => {
    if (!scopeOptions.some((option) => option.value === scope)) {
      setScope(GLOBAL_PROVIDER_SCOPE);
    }
  }, [scope, scopeOptions]);

  const onClaudeHooks = (next: boolean) => {
    saveClaudeHooks(next);
    setClaudeHooks(next);
  };

  const onModelChange = (harness: HarnessId, model: string) => {
    if (project) {
      setProjectDefaultModel(project, harness, model);
      return;
    }
    saveDefaultModel(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    if (choice?.harness === harness) {
      saveLastModelChoice(harness, model);
      setChoice({ harness, model });
    }
  };

  const onDefault = (harness: HarnessId, model: string) => {
    if (project) {
      setProjectDefaultProvider(project, harness, model);
      return;
    }
    saveLastModelChoice(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    setChoice({ harness, model });
  };

  const onPickerVisible = (harness: HarnessId, visible: boolean) => {
    if (project) {
      setProjectProviderHidden(project, harness, !visible);
      return;
    }
    savePickerProviderVisible(harness, visible);
    setHiddenGlobally((prev) =>
      visible
        ? prev.filter((id) => id !== harness)
        : [...new Set([...prev, harness])],
    );
  };

  return (
    <>
      <NativeSessionsPanel onOpenSession={onOpenSession} />
      <ProviderAccountsSettings />

      <UsageDisplaySettings />

      <Group
        id="agent-clis"
        title={uiT("Agent CLIs")}
        action={
          <Select
            label={uiT("Provider defaults scope")}
            value={scope}
            options={scopeOptions}
            onChange={setScope}
          />
        }
        description={
          project
            ? uiT(
                "These defaults apply to {value0} only. A provider with Show in picker off is also kept out of new conversations started in this project. CLI paths remain global for MonoCode.",
                { value0: String(projectName(project)) },
              )
            : uiT(
                "A provider is listed as installed once its CLI is found on your PATH. Uninstalled CLIs stay listed but are left out of the model picker, as are installed ones with Show in picker off. The model beside a provider is what its new conversations start with; Use by default picks the provider itself. CLI paths are global for MonoCode and apply to every project.",
              )
        }
      >
        {HARNESSES.map((harness) => {
          const inPicker = project
            ? !(projectSettings.hidden ?? []).includes(harness) &&
              !hiddenGlobally.includes(harness)
            : !hiddenGlobally.includes(harness);
          // A globally hidden provider stays out of every project's picker, so
          // the project toggle is shown locked rather than appearing to work.
          const pickerLocked =
            project != null && hiddenGlobally.includes(harness);
          const selectedModel = project
            ? (projectSettings.models?.[harness] ??
              (projectSettings.defaultHarness === harness
                ? projectSettings.defaultModel
                : undefined) ??
              defaultModels[harness] ??
              (choice?.harness === harness
                ? choice.model
                : defaultModelId(harness)))
            : (defaultModels[harness] ??
              (choice?.harness === harness
                ? choice.model
                : defaultModelId(harness)));
          const isDefault = project
            ? effectiveDefaultHarness === harness
            : choice?.harness === harness;
          return (
            <ProviderRow
              key={harness}
              harness={harness}
              selectedModel={selectedModel}
              isDefault={isDefault}
              inPicker={inPicker}
              pickerLocked={pickerLocked}
              onDefault={onDefault}
              onModelChange={onModelChange}
              onPickerVisible={(visible) => onPickerVisible(harness, visible)}
            />
          );
        })}
      </Group>

      <Group title={uiT("Advanced")}>
        <Row
          id="claude-hooks"
          label={uiT("Claude Code hooks")}
          description={uiT(
            "Run the hooks configured in your settings.json files — PreToolUse command rewrites, blocks, notifications, and the rest — just as the Claude Code CLI would. Turn this off if a hook is misbehaving and you need the session back. Takes effect on the next turn.",
          )}
        >
          <Toggle
            label={uiT("Claude Code hooks")}
            on={claudeHooks}
            onChange={onClaudeHooks}
          />
        </Row>
      </Group>
    </>
  );
}

function UsageDisplaySettings() {
  const { t: uiT } = useTranslation();
  const showRemainingUsage = useShowRemainingUsage();
  const maskEmails = useMaskEmails();
  return (
    <Group title={uiT("Usage and privacy")}>
      <Row
        id="show-remaining-usage"
        label={uiT("Show remaining usage")}
        description={uiT(
          "Fill usage meters with what is left in each limit instead of what has been used.",
        )}
      >
        <Toggle
          label={uiT("Show remaining usage")}
          on={showRemainingUsage}
          onChange={saveShowRemainingUsage}
        />
      </Row>
      <Row
        id="mask-emails"
        label={uiT("Mask account emails")}
        description={uiT(
          "Blur account emails in Settings and the usage popover until you click one, so they stay out of screenshots.",
        )}
      >
        <Toggle
          label={uiT("Mask account emails")}
          on={maskEmails}
          onChange={saveMaskEmails}
        />
      </Row>
    </Group>
  );
}

type AccountEditor = {
  provider: ProviderAccountProvider;
  accountId?: string;
  label: string;
};

function ProviderAccountsSettings() {
  const { t: uiT } = useTranslation();
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<AccountEditor | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => subscribeProviderAccounts(() => setVersion((value) => value + 1)),
    [],
  );

  const startAdd = (provider: ProviderAccountProvider) => {
    setError(null);
    setEditor({ provider, label: "" });
  };

  const startRename = (account: ProviderAccount) => {
    setError(null);
    setEditor({
      provider: account.provider,
      accountId: account.id,
      label: account.label,
    });
  };

  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !editor.label.trim() || working) return;
    const key = editor.accountId
      ? `rename:${editor.provider}:${editor.accountId}`
      : `add:${editor.provider}`;
    setWorking(key);
    setError(null);
    try {
      if (editor.accountId) {
        renameProviderAccount(editor.provider, editor.accountId, editor.label);
      } else {
        const account = newProviderAccount(editor.provider, editor.label);
        await loginHarness(editor.provider, account.id);
        saveProviderAccount(account);
      }
      setEditor(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save this account",
      );
    } finally {
      setWorking(null);
    }
  };

  const removeAccount = async (account: ProviderAccount) => {
    if (account.isDefault || working) return;
    const confirmed = await ask(
      `Remove “${account.label}”? Its stored credentials will be deleted and any running turns for this account will stop. Existing conversations stay in history, but cannot continue until you switch accounts.`,
      {
        title: `Remove ${HARNESS_TITLE[account.provider]} account`,
        kind: "warning",
        okLabel: "Remove account",
        cancelLabel: "Cancel",
      },
    );
    if (!confirmed) return;
    const key = `remove:${account.provider}:${account.id}`;
    setWorking(key);
    setError(null);
    try {
      await removeProviderAccountCredentials(account.provider, account.id);
      removeProviderAccount(account.provider, account.id);
      clearCachedRateLimits(account.provider, account.id);
      if (
        editor?.provider === account.provider &&
        editor.accountId === account.id
      ) {
        setEditor(null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove this account",
      );
    } finally {
      setWorking(null);
    }
  };

  const identities = useProviderAccountIdentities(
    PROVIDER_ACCOUNT_PROVIDERS.flatMap(providerAccounts),
    version,
  );
  const usage = useProviderAccountUsage(version);

  return (
    <Group
      id="provider-accounts"
      title={uiT("Accounts")}
      description={uiT(
        "Create isolated sign-ins for providers that support account profiles. Account switching stays available from the usage control in the footer.",
      )}
      action={<AccountUsageRefresh usage={usage} />}
    >
      {PROVIDER_ACCOUNT_PROVIDERS.map((provider) => {
        const accounts = providerAccounts(provider);
        const adding = editor?.provider === provider && !editor.accountId;
        return (
          <div
            key={provider}
            className="border-b border-content/5 last:border-b-0"
          >
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-content/[0.05] ring-1 ring-inset ring-content/[0.06]">
                  <HarnessIcon harness={provider} className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-content">
                    {HARNESS_TITLE[provider]}
                  </div>
                  <div className="mt-0.5 text-[11px] text-content/40">
                    {accounts.length}{" "}
                    {accounts.length === 1 ? uiT("account") : uiT("accounts")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => startAdd(provider)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-content/10 px-2.5 py-1 text-[12px] text-content/70 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
              >
                <Plus className="size-3.5" strokeWidth={1.75} aria-hidden />
                {uiT("Add account")}
              </button>
            </div>
            <div className="border-t border-content/5 bg-content/[0.015] pl-10">
              {accounts.map((account) => {
                const editing =
                  editor?.provider === provider &&
                  editor.accountId === account.id;
                const removing = working === `remove:${provider}:${account.id}`;
                const identity = identities[identityKey(account)];
                const orgTag = identityOrganizationTag(identity);
                const limits = usage.usage[accountUsageKey(account)];
                return editing ? (
                  <ProviderAccountEditor
                    key={account.id}
                    editor={editor}
                    working={Boolean(working)}
                    onLabel={(label) =>
                      setEditor((current) =>
                        current ? { ...current, label } : current,
                      )
                    }
                    onCancel={() => setEditor(null)}
                    onSubmit={submitEditor}
                  />
                ) : (
                  <div
                    key={account.id}
                    className="flex h-12 items-center gap-3 border-b border-content/5 px-4 py-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[12px] text-content/85">
                          {account.label}
                        </span>
                        {orgTag ? (
                          <span className="max-w-[8rem] shrink-0 truncate rounded bg-content/[0.07] px-1 text-[9px] leading-4 text-content/50">
                            {orgTag}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2.5 text-[10px]">
                        <AccountStatusLabel
                          status={accountStatus(limits, usage.now)}
                          className="shrink-0"
                        />
                        <ProviderAccountSubtitle
                          identity={identity}
                          fallback={
                            account.isDefault
                              ? "Provider CLI profile"
                              : "Isolated profile"
                          }
                          className="truncate text-content/30"
                        />
                      </div>
                    </div>
                    <AccountUsageMeters limits={limits} now={usage.now} />
                    <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                      {account.isDefault ? (
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-content/30">
                          {uiT("Default")}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        disabled={Boolean(working)}
                        aria-label={uiT("Rename {value0}", {
                          value0: String(account.label),
                        })}
                        title={uiT("Rename account")}
                        onClick={() => startRename(account)}
                        className="grid size-7 place-items-center rounded-md text-content/40 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.96] disabled:opacity-35"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </button>
                      {!account.isDefault ? (
                        <button
                          type="button"
                          disabled={Boolean(working)}
                          aria-label={uiT("Remove {value0}", {
                            value0: String(account.label),
                          })}
                          title={uiT("Remove account")}
                          onClick={() => void removeAccount(account)}
                          className="grid size-7 place-items-center rounded-md text-content/35 transition-transform duration-150 hover:bg-red-400/10 hover:text-red-400 active:scale-[0.96] disabled:opacity-35"
                        >
                          {removing ? (
                            <Loader className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {adding && editor ? (
                <ProviderAccountEditor
                  editor={editor}
                  working={Boolean(working)}
                  onLabel={(label) =>
                    setEditor((current) =>
                      current ? { ...current, label } : current,
                    )
                  }
                  onCancel={() => setEditor(null)}
                  onSubmit={submitEditor}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? (
        <p
          className="border-t border-content/5 px-4 py-2.5 text-[11px] leading-4 text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </Group>
  );
}

function ProviderAccountEditor({
  editor,
  working,
  onLabel,
  onCancel,
  onSubmit,
}: {
  editor: AccountEditor;
  working: boolean;
  onLabel: (label: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t: uiT } = useTranslation();
  const adding = !editor.accountId;
  return (
    <form
      className="flex h-12 items-center border-b border-content/5 px-4 py-2 last:border-b-0"
      onSubmit={onSubmit}
    >
      <div
        data-provider-account-editor-field
        className="flex items-center pr-1 h-8 min-w-0 flex-1 overflow-hidden rounded-md border border-content/10 bg-content/[0.04] focus-within:border-accent/45"
      >
        <label className="h-full min-w-0 flex-1">
          <span className="sr-only">{uiT("Account name")}</span>
          <input
            autoFocus
            type="text"
            maxLength={48}
            value={editor.label}
            disabled={working}
            placeholder={uiT("Work or Personal")}
            aria-label={uiT("{value0} {value1} account", {
              value0: String(adding ? "New" : "Rename"),
              value1: String(HARNESS_TITLE[editor.provider]),
            })}
            onChange={(event) => onLabel(event.target.value)}
            className="h-full w-full bg-transparent px-2.5 text-[12px] text-content outline-none placeholder:text-content/25 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={working}
          onClick={onCancel}
          className="flex h-6 shrink-0 items-center rounded-[4.5px] bg-content/[0.05] px-2.5 text-[11px] text-content/45 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.97] disabled:opacity-40"
        >
          {uiT("Cancel")}
        </button>
        <button
          type="submit"
          disabled={working || !editor.label.trim()}
          className="ml-1 flex h-6 shrink-0 items-center gap-1.5 rounded-[4.5px] bg-content px-2.5 text-[11px] font-medium text-background-base transition-transform duration-150 hover:bg-content/85 active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
        >
          {working ? <Loader className="size-3 animate-spin" /> : null}
          {adding
            ? working
              ? uiT("Waiting for browser…")
              : uiT("Sign in and add")
            : uiT("Save")}
        </button>
      </div>
    </form>
  );
}

/** The icon the activity bar shows: custom logo, else the project mascot. */
function ProjectScopeIcon({ path }: { path: string }) {
  const logos = useTabGroupLogos();
  const [colors] = useState(loadTabGroupColors);
  const [customColors] = useState(loadTabGroupCustomColors);
  const [mascots] = useState(loadTabGroupMascots);
  const key = projectKey(path);
  const name = projectName(path);
  const logoPath = resolveTabGroupLogo(key, logos);
  if (logoPath) {
    return (
      <ProjectLogoIcon
        path={logoPath}
        className="size-4 rounded-sm"
        imageClassName="size-4"
      />
    );
  }
  return (
    <ProjectMascot
      project={name}
      color={resolveTabGroupColor(key, colors, customColors, name)}
      name={resolveTabGroupMascot(key, mascots)}
      className="size-3.5"
    />
  );
}

function ProviderRow({
  harness,
  selectedModel,
  isDefault,
  inPicker,
  pickerLocked = false,
  onDefault,
  onModelChange,
  onPickerVisible,
}: {
  harness: HarnessId;
  selectedModel: string;
  isDefault: boolean;
  inPicker: boolean;
  /** Globally hidden providers cannot be turned on per project. */
  pickerLocked?: boolean;
  onDefault: (harness: HarnessId, model: string) => void;
  onModelChange: (harness: HarnessId, model: string) => void;
  onPickerVisible: (visible: boolean) => void;
}) {
  const { t: uiT } = useTranslation();
  const models = modelsFor(harness);
  const available = isHarnessAvailable(harness);
  const current =
    models.length > 0 ? resolveModel(harness, selectedModel) : null;

  useEffect(() => {
    if (!available || models.length > 0) return;
    void refreshHarnessCatalogs([harness]);
  }, [available, harness, models.length]);

  return (
    <Row
      label={
        <span className="flex items-center gap-2">
          <HarnessIcon harness={harness} className="size-4 shrink-0" />
          {HARNESS_TITLE[harness]}
          <ProviderBinaryControl provider={harness} />
          {isDefault ? (
            <span className="rounded-full bg-content/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content/60">
              {uiT("Default")}
            </span>
          ) : null}
        </span>
      }
      description={
        available
          ? uiT("{value0} {value1} available.", {
              value0: String(models.length),
              value1: String(models.length === 1 ? "model" : "models"),
            })
          : harnessUnavailableHint(harness)
      }
    >
      {current ? (
        <Select
          label={uiT("{value0} model", {
            value0: String(HARNESS_TITLE[harness]),
          })}
          value={current.id}
          onChange={(next) => onModelChange(harness, next)}
          options={models.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ) : null}
      <SecondaryButton
        onClick={() => current && onDefault(harness, current.id)}
        disabled={isDefault || !current}
      >
        {isDefault ? uiT("Default") : uiT("Use by default")}
      </SecondaryButton>
      {available ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-content/50">
            {pickerLocked ? uiT("Hidden globally") : uiT("Show in picker")}
          </span>
          <Toggle
            label={uiT("Show {value0} in the model picker", {
              value0: String(HARNESS_TITLE[harness]),
            })}
            on={inPicker}
            onChange={onPickerVisible}
            disabled={pickerLocked}
          />
        </div>
      ) : null}
    </Row>
  );
}

function useArchivedProjects(): ArchivedProject[] {
  const [items, setItems] = useState(loadArchivedProjects);
  useEffect(
    () => subscribeArchivedProjects(() => setItems(loadArchivedProjects())),
    [],
  );
  return items;
}

function archivedProjectLabel(path: string): string {
  return resolveTabGroupLabel(
    projectKey(path),
    loadTabGroupLabels(),
    projectName(path),
  );
}

function ArchivePage({
  cwd,
  sessions,
  onOpenSession,
  onArchiveSession,
  onDeleteSession,
  onRestoreProject,
  onDeleteProject,
}: {
  cwd: string;
  sessions: SessionSummary[];
  onOpenSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreProject?: (path: string) => void;
  onDeleteProject?: (path: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const [filters, setFilters] = useState(loadSessionSidebarFilters);
  const [deleting, setDeleting] = useState<ArchivedProject | null>(null);
  const archivedProjects = useArchivedProjects();
  const archived = useMemo(
    () =>
      sessions
        .filter((session) => session.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  const onShowArchived = (showArchived: boolean) => {
    const next = { ...filters, showArchived };
    saveSessionSidebarFilters(next);
    setFilters(next);
  };

  return (
    <>
      <Group
        title={uiT("Archived projects")}
        description={uiT(
          "Archive a project from the project list to keep its chats without listing it in the sidebar.",
        )}
      >
        {archivedProjects.length === 0 ? (
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {uiT("No archived projects.")}
          </p>
        ) : (
          archivedProjects.map((project) => (
            <div
              key={project.path}
              className="flex items-center gap-3 border-b border-content/5 px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">
                  {archivedProjectLabel(project.path)}
                </div>
                <div className="truncate text-[11px] text-content/40">
                  {prettyCwd(project.path)}
                </div>
              </div>
              {onRestoreProject ? (
                <SecondaryButton onClick={() => onRestoreProject(project.path)}>
                  {uiT("Restore")}
                </SecondaryButton>
              ) : null}
              {onDeleteProject ? (
                <SecondaryButton danger onClick={() => setDeleting(project)}>
                  {uiT("Delete")}
                </SecondaryButton>
              ) : null}
            </div>
          ))
        )}
      </Group>

      <Group
        title={
          looksLikeProject(cwd)
            ? uiT("Archived in {value0}", { value0: String(projectName(cwd)) })
            : uiT("Archived conversations")
        }
      >
        <Row
          id="show-archived"
          label={uiT("Show archived in the sidebar")}
          description={uiT(
            "Keep archived conversations listed alongside the active ones.",
          )}
        >
          <Toggle
            label={uiT("Show archived in the sidebar")}
            on={filters.showArchived}
            onChange={onShowArchived}
          />
        </Row>
        {!looksLikeProject(cwd) ? (
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {uiT("Open a project to see its archived conversations.")}
          </p>
        ) : archived.length === 0 ? (
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {uiT("No archived conversations in this project.")}
          </p>
        ) : (
          archived.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 border-b border-content/5 px-4 py-2.5 last:border-b-0"
            >
              <HarnessIcon
                harness={session.harness}
                className="size-3.5 shrink-0"
              />
              <button
                type="button"
                onClick={() => onOpenSession(session.id)}
                className="min-w-0 flex-1 truncate text-left text-[13px] hover:text-content"
              >
                {sessionDisplayTitle(session.title, session.harness)}
              </button>
              <span className="shrink-0 text-[11px] text-content/35 tabular-nums">
                {formatDate(session.updatedAt)}
              </span>
              <SecondaryButton
                onClick={() => onArchiveSession(session.id, false)}
              >
                {uiT("Unarchive")}
              </SecondaryButton>
              <SecondaryButton
                danger
                onClick={() => onDeleteSession(session.id)}
              >
                {uiT("Delete")}
              </SecondaryButton>
            </div>
          ))
        )}
      </Group>

      {deleting ? (
        <RemoveProjectDialog
          name={archivedProjectLabel(deleting.path)}
          path={deleting.path}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDeleteProject?.(deleting.path);
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}

function formatDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="pb-4">
      <h1 className="text-[20px] font-semibold leading-tight text-content">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-content/45">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/**
 * A titled card of related settings. Everything on a page lives in one, so a
 * page reads as a handful of topics instead of one long list of switches.
 */
function Group({
  id,
  title,
  description,
  action,
  children,
}: {
  /** Matches a `SETTINGS_INDEX` id when the whole card is the search target. */
  id?: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const revealed = useContext(RevealedSetting);
  const flash = id != null && revealed === id;

  return (
    <section
      id={id ? settingDomId(id) : undefined}
      data-setting-id={id}
      className="pt-8 first:pt-0"
    >
      <div className="flex items-end gap-4 pb-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-content">{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-content/45">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
      </div>
      <div
        className={`overflow-hidden rounded-xl border bg-content/3 transition-colors ${
          flash ? "border-accent/60" : "border-content/10"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  id,
  label,
  description,
  children,
}: {
  /** Matches a `SETTINGS_INDEX` id so search can scroll here. */
  id?: string;
  label: ReactNode;
  description?: string;
  children?: ReactNode;
}) {
  const revealed = useContext(RevealedSetting);
  const flash = id != null && revealed === id;

  return (
    <div
      id={id ? settingDomId(id) : undefined}
      data-setting-id={id}
      className={`settings-row flex items-start gap-6 border-b border-content/5 px-4 py-3.5 transition-colors last:border-b-0 ${
        flash ? "bg-accent/10" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-content">{label}</div>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-content/45">
            {description}
          </p>
        ) : null}
      </div>
      <div className="settings-row-control flex min-w-0 max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  optionIdPrefix,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  optionIdPrefix?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-grid max-w-full shrink-0 gap-0.5 rounded-md border border-content/10 p-0.5 text-[12px]"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <button
          id={
            optionIdPrefix
              ? `${optionIdPrefix}-${option.value.toLowerCase()}`
              : undefined
          }
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-w-0 rounded-[5px] px-2.5 py-1 ${
            value === option.value
              ? "bg-selection text-content"
              : "text-content/50 hover:text-content"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-56 max-w-full items-center gap-3 ${disabled ? "opacity-40" : ""}`}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        disabled={disabled}
        className="sidebar-opacity-slider min-w-0 flex-1 disabled:cursor-not-allowed"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-10 shrink-0 text-right text-[12px] text-content tabular-nums">
        {display}
      </span>
    </div>
  );
}

const ACCENT_COLOR_PRESETS = [
  "#4da3f5",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
] as const;

function AccentColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const colorIndex = value
    ? ACCENT_COLOR_PRESETS.indexOf(
        value as (typeof ACCENT_COLOR_PRESETS)[number],
      )
    : -1;
  const presetIndex = value == null ? 0 : colorIndex >= 0 ? colorIndex + 1 : -1;

  return (
    <div ref={root} className="w-48">
      <ColorSwatchRow
        colors={["var(--color-content)", ...ACCENT_COLOR_PRESETS]}
        labels={["Default", "Blue", "Violet", "Pink", "Red", "Orange", "Green"]}
        colorIndex={presetIndex >= 0 ? presetIndex : undefined}
        customColor={presetIndex < 0 ? (value ?? undefined) : undefined}
        customPickerOpen={open}
        onPickIndex={(index) => {
          setOpen(false);
          onChange(
            index === 0
              ? ACCENT_COLOR_DEFAULT
              : (ACCENT_COLOR_PRESETS[index - 1] ?? ACCENT_COLOR_PRESETS[0]),
          );
        }}
        onToggleCustom={() => setOpen((current) => !current)}
      />
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={248}
          onDismiss={() => setOpen(false)}
          className="px-2 pb-2"
        >
          <ColorPickerPopover
            value={value ?? ACCENT_COLOR_PRESETS[0]}
            onChange={onChange}
          />
        </Popover>
      ) : null}
    </div>
  );
}

/** macOS keeps the decision after the first prompt; only System Settings can flip it. Windows toasts are governed by Settings > Notifications. */
function NotificationsBlocked() {
  const { t: uiT } = useTranslation();
  return (
    <span className="flex items-center gap-2 text-[12px] text-content/45">
      {uiT("Permission needed")}
      {IS_MAC || IS_WIN ? (
        <button
          type="button"
          onClick={() => {
            void openNotificationSettings().catch(() => {});
          }}
          className="rounded-md border border-content/10 px-2 py-1 text-content/70 hover:bg-content/10 hover:text-content"
        >
          {uiT("Open System Settings")}
        </button>
      ) : null}
    </span>
  );
}

function Toggle({
  label,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        onChange(!on);
        playCue("switch");
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-accent" : "bg-content/20"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
          on ? "left-4.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Theme-aware dropdown for a Settings row: a trigger button opening a Popover listbox. Used instead of a native select, whose option popup is OS-rendered and unreadable in dark mode on Windows/Linux. */
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const activeId =
    options[active] != null ? `${listId}-opt-${active}` : undefined;

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
      return;
    }
    if (e.key === "Tab") {
      const option = options[active];
      if (option && option.value !== value) onChange(option.value);
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) pick(option.value);
    }
  };

  return (
    <div ref={root} className="relative max-w-52">
      <button
        type="button"
        ref={trigger}
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-content/10 bg-content/5 px-2 py-1 text-left text-[12px] text-content outline-none hover:border-content/20"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {selected?.icon ? (
            <span className="grid size-4 shrink-0 place-items-center">
              {selected.icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            {selected ? selected.label : value}
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-content/50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={280}
          maxHeight={320}
          autoFocus
          onDismiss={(reason) => {
            setOpen(false);
            if (reason === "escape") trigger.current?.focus();
          }}
          role="listbox"
          aria-label={label}
          aria-activedescendant={activeId}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className="overflow-y-auto overscroll-contain p-1"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const highlighted = index === active;
            return (
              <button
                key={option.value}
                ref={highlighted ? activeOption : undefined}
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
                  highlighted || isSelected
                    ? "bg-selection text-content"
                    : "text-content hover:bg-content/5"
                }`}
              >
                {option.icon ? (
                  <span className="grid size-4 shrink-0 place-items-center">
                    {option.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
                ) : null}
              </button>
            );
          })}
        </Popover>
      ) : null}
    </div>
  );
}
