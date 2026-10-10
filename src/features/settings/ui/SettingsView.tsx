import { activePreferenceStore } from "../model/sharedPreferences";
import { uploadPreferenceBackground } from "../model/preferenceAssets";
import { usePreferenceState } from "../model/usePreferenceState";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { formatBuildVersion } from "../../../shared/lib/buildVersion";
import { startWindowDrag } from "../../../app/shell/startWindowDrag";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { setUiLanguage, type UiLanguage } from "../../../shared/i18n/language";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ConnectionsPage } from "../../connections/ui/ConnectionsPage";
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
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "../../../shared/ui/icons";
import { withStatusToast } from "../../../shared/ui/StatusToast";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
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
import {
  announceHarnessesRefreshed,
  hasHarnessUpdate,
  readHarnessVersions,
  type HarnessVersionInfo,
} from "../../providers/model/harnessUpdates";
import {
  runHarnessUpdate,
  type HarnessUpdateState,
} from "../../providers/ui/HarnessUpdateNotice";
import { NativeSessionsPanel } from "./NativeSessionsPanel";
import { JiraSettings } from "./JiraSettings";
import { TitleModelSettings } from "./TitleModelSettings";
import { GradientBlurBackground } from "./GradientBlurBackground";
import { McpSettings } from "./McpSettings";
import { InboxProviderMark } from "../../inbox/ui/InboxProviderMark";
import { RemoveProjectDialog } from "../../projects/ui/RemoveProjectDialog";
import { SettingsNav } from "../../../app/shell/SettingsRail";
import { Switch } from "../../workflows/kit/components/ui/switch";
import { SettingsSearchInput } from "../../workflows/kit/settings/SettingsSearchInput";
import {
} from "../../workflows/kit/settings/SettingsPageParts";
import { Input } from "../../workflows/kit/components/ui/input";
import {
  activeScheme,
  activeScope,
  applyFontSize,
  applyProfile,
  applyReducedMotion,
  CODE_FONT_PRESETS,
  CONTENT_FONT_PRESETS,
  CONTRAST_MAX,
  CONTRAST_MIN,
  DEFAULT_PROFILE,
  enableSeparateSchemes,
  FONT_SIZE_LIMITS,
  FONT_WEIGHT_LABELS,
  FONT_WEIGHTS,
  loadFontSize,
  loadSystemFonts,
  loadProfile,
  loadReducedMotion,
  loadSeparateSchemes,
  normalizeFontFamily,
  REDUCED_MOTION_DEFAULT,
  saveFontSize,
  saveProfile,
  saveReducedMotion,
  saveSeparateSchemes,
  type AppearanceProfile,
  type FontSizeKind,
  type FontWeight,
  type SystemFonts,
  type ReducedMotionPreference,
} from "../model/typography";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import { useColorScheme } from "../../../shared/hooks/useColorScheme";
import {
  applyChatBackground,
  applyChatBackgroundEmptyOpacity,
  applyChatBackgroundSessionOpacity,
  applyChatBackgroundScope,
  applyChatBackgroundArea,
  applyWindowOpacity,
  applyPanelOpacity,
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
  ACCENT_COLOR_PRESET_LABELS,
  ACCENT_COLOR_PRESETS,
  CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT,
  CHAT_BACKGROUND_OPACITY_MAX,
  CHAT_BACKGROUND_OPACITY_MIN,
  CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT,
  CHAT_BACKGROUND_SCOPE_DEFAULT,
  CHAT_BACKGROUND_AREA_DEFAULT,
  THEME_PREFERENCE_DEFAULT,
  chatBackgroundSrc,
  loadBodyGlass,
  loadPopoverOpacity,
  loadWindowOpacity,
  loadPanelOpacity,
  loadAccentColor,
  loadChatBackgroundEmptyOpacity,
  loadChatBackgroundPath,
  loadChatBackgroundSessionOpacity,
  loadChatBackgroundScope,
  loadChatBackgroundArea,
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
  saveWindowOpacity,
  savePanelOpacity,
  saveAccentColor,
  saveChatBackgroundEmptyOpacity,
  saveChatBackgroundPath,
  saveChatBackgroundSessionOpacity,
  saveChatBackgroundScope,
  saveChatBackgroundArea,
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
  WINDOW_OPACITY_DEFAULT,
  PANEL_OPACITY_DEFAULT,
  PANEL_OPACITY_MAX,
  PANEL_OPACITY_MIN,
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
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
  type ChatBackgroundArea,
  NEW_THREAD_BACKGROUND_EFFECTS,
  NEW_THREAD_BACKGROUND_EFFECT_LABELS,
  NEW_THREAD_BACKGROUND_EFFECT_DESCRIPTIONS,
  NEW_THREAD_BACKGROUND_EFFECT_DEFAULT,
  type NewThreadBackgroundEffect,
  type TranscriptLayout,
  type ColorScheme,
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
  hasFreshCatalog,
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
  providerAccounts,
  sharedProviderAccountId,
  PROVIDER_ACCOUNT_PROVIDERS,
  removeProviderAccount,
  subscribeProviderAccounts,
  type ProviderAccount,
  type ProviderAccountProvider,
} from "../../providers/model/providerAccounts";
import {
  removeProviderAccountCredentials,
  loadSharedProviderDefaults,
  setSharedProviderDefault,
  importCurrentCodexAccount,
  requireSharedAccountHost,
  loadProviderAccounts,
  addProviderAccountProfile,
  updateProviderAccountProfile,
} from "../../providers/model/providerAccountCredentials";
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
  AccountUsageRefresh,
  meterWindows,
  UsageMeter,
} from "../../providers/ui/ProviderAccountUsage";
import {
  ExplorerMenu,
  type ExplorerMenuItem,
} from "../../files/ui/ExplorerMenu";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";
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
import { scrollWithin } from "../../../shared/lib/scrollWithin";

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
      scrollWithin(document.getElementById(settingDomId(revealed)), "center");
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
      <div
        data-tauri-drag-region="deep"
        onMouseDownCapture={startWindowDrag}
        className="flex h-10 shrink-0 select-none items-center border-b border-stroke"
      >
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
              <RotateCcw className="size-3.5" />
              {uiT("Restore defaults")}
            </button>
          ) : null}
          <SettingsSearch onReveal={onReveal} />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        <SettingsNav section={section} onSelect={selectSection} />
        <div className="settings-panel m-3 ml-1 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-stroke">
          {section === "skills" ? (
            <SkillsPage
              key={cwd}
              cwd={cwd}
              agentPicker={(props) => (
                <Select label={uiT("Filter skills by agent")} {...props} />
              )}
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
                <div className="mx-auto w-full max-w-4xl px-5 py-6 pb-16 @min-[560px]/settings:px-8 @min-[560px]/settings:py-8">
                  <PageHeader
                    title={settingsSectionLabel(section)}
                    description={settingsSectionDescription(section)}
                  />
                  {section === "general" ? (
                    <GeneralPage onOpenWhatsNew={onOpenWhatsNew} />
                  ) : null}
                  {section === "connections" ? (
                    <ConnectionsPage revealed={revealed} />
                  ) : null}
                  {section === "appearance" ? (
                    <AppearancePage appearance={appearance} />
                  ) : null}
                  {section === "chat" ? <ChatPage /> : null}
                  {section === "keybindings" ? <KeybindingsPage /> : null}
                  {section === "import" ? (
                    <NativeSessionsPanel onOpenSession={onOpenSession} />
                  ) : null}
                  {section === "mcp" ? (
                    <McpSettings cwd={cwd} recents={recents} />
                  ) : null}
                  {section === "providers" ? (
                    <ProvidersPage cwd={cwd} recents={recents} />
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
      <SettingsSearchInput
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
        clearLabel={uiT("Clear settings search")}
        onClear={() => {
          setQuery("");
          input.current?.focus();
        }}
        containerClassName="w-56"
        className="h-8 rounded-lg"
      />
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
            <p className="px-2 py-1.5 text-ui-base text-foreground-subtle">
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
                className={`flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-ui-base text-foreground ${
                  index === active ? "bg-menu-hover" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                <span className="shrink-0 text-ui-sm text-foreground-subtlest">
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
  const [soundsEnabled, setSoundsEnabled] = usePreferenceState(loadSoundsEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = usePreferenceState(
    loadNotificationsEnabled,
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(cachedNotificationPermission);
  const [notesEnabled, setNotesEnabled] = usePreferenceState(loadNotesEnabled);
  const [liveAgentsEnabled, setLiveAgentsEnabled] = usePreferenceState(
    loadLiveAgentsEnabled,
  );
  const [fileTabMode, setFileTabMode] = usePreferenceState<FileTabMode>(loadFileTabMode);
  const [tabAnimationsEnabled, setTabAnimationsEnabled] = usePreferenceState(
    loadTabAnimationsEnabled,
  );
  const [closeToTray, setCloseToTray] = usePreferenceState(loadCloseToTray);
  const [quickComposerEnabled, setQuickComposerEnabled] = usePreferenceState(
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
            "Each conversation keeps its own file and page tabs. Choose the default layout; the conversation toolbar can switch it at any time.",
          )}
        >
          <Segmented
            label={uiT("File tabs")}
            value={fileTabMode}
            options={[
              { value: "pane", label: uiT("Split view") },
              { value: "workspace", label: uiT("Full view") },
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
        {(IS_WIN || IS_LINUX) && (
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
  const revealed = useContext(RevealedSetting);
  const [transcriptLayout, setTranscriptLayout] =
    usePreferenceState<TranscriptLayout>(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] =
    usePreferenceState(loadTranscriptAnchor);
  const [followUpBehavior, setFollowUpBehavior] =
    usePreferenceState<FollowUpBehavior>(loadFollowUpBehavior);
  const [modelControls, setModelControls] =
    usePreferenceState<ModelControls>(loadModelControls);
  const [diffViewer, setDiffViewer] = usePreferenceState<DiffViewer>(loadDiffViewer);
  const [formatOnSave, setFormatOnSave] = usePreferenceState(loadFormatOnSave);
  const [composerRunner, setComposerRunner] = usePreferenceState(loadComposerRunner);
  const [gridArcadeEnabled, setGridArcadeEnabled] = usePreferenceState(
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
      <Group id="title-model" title={uiT("Session titles")} description={uiT("Choose a separate API for automatic title generation.")}>
        <TitleModelSettings revealed={revealed === "title-model"} />
      </Group>
      <Group
        title={uiT("Transcript")}
        description={uiT("How a conversation reads as it grows.")}
      >
        <Row
          id="transcript-layout"
          label={uiT("Transcript layout")}
          description={uiT(
            "User messages appear as right-aligned bubbles. Full width lets longer messages use more space; Chat limits their width like a messaging app.",
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
      const status = await withStatusToast(() => saveGitlabConfig(url, token), {
        loading: uiT("Connecting to {service}…", { service: "GitLab" }),
        success: (result) => result.connected && uiT("Connected to {service}", { service: "GitLab" }),
        error: false,
      });
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
      const status = await withStatusToast(() => disconnectGitlab(url), {
        loading: uiT("Disconnecting from {service}…", { service: "GitLab" }),
        success: uiT("Disconnected from {service}", { service: "GitLab" }),
        error: false,
      });
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
      const status = await withStatusToast(() => saveAzureDevOpsConfig(url, token), {
        loading: uiT("Connecting to {service}…", { service: "Azure DevOps" }),
        success: (result) => result.connected && uiT("Connected to {service}", { service: "Azure DevOps" }),
        error: false,
      });
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
      const status = await withStatusToast(() => disconnectAzureDevOps(url), {
        loading: uiT("Disconnecting from {service}…", { service: "Azure DevOps" }),
        success: uiT("Disconnected from {service}", { service: "Azure DevOps" }),
        error: false,
      });
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
  const [hiddenTeamIds, setHiddenTeamIds] = usePreferenceState(loadHiddenLinearTeamIds);

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
      await withStatusToast(() => saveLinearToken(token), {
        loading: uiT("Connecting to {service}…", { service: "Linear" }),
        success: uiT("Connected to {service}", { service: "Linear" }),
        error: false,
      });
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
      await withStatusToast(() => disconnectLinear(), {
        loading: uiT("Disconnecting from {service}…", { service: "Linear" }),
        success: uiT("Disconnected from {service}", { service: "Linear" }),
        error: false,
      });
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
      ? `Version ${formatBuildVersion(snapshot.availableVersion ?? "")} is available.`
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
            {formatBuildVersion(snapshot.currentVersion)}
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
            <RefreshCw className="size-3.5" aria-hidden />
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
    usePreferenceState<ThemePreference>(loadThemePreference);
  const [accentColor, setAccentColor] = usePreferenceState(loadAccentColor);
  const [opacity, setOpacity] = usePreferenceState(loadSidebarOpacity);
  const [popoverOpacity, setPopoverOpacity] = usePreferenceState(loadPopoverOpacity);
  const [windowOpacity, setWindowOpacity] = usePreferenceState(loadWindowOpacity);
  const [panelOpacity, setPanelOpacity] = usePreferenceState(loadPanelOpacity);
  const [blur, setBlur] = usePreferenceState(loadSidebarBlur);
  const [themeHue, setThemeHue] = usePreferenceState(loadThemeHue);
  const [themeSaturation, setThemeSaturation] = usePreferenceState(loadThemeSaturation);
  const [themeDarkLightness, setThemeDarkLightness] = usePreferenceState(
    loadThemeDarkLightness,
  );
  const [bodyGlass, setBodyGlass] = usePreferenceState(loadBodyGlass);
  const [showExcludedFiles, setShowExcludedFiles] = usePreferenceState(
    loadShowExcludedFiles,
  );
  const [chatBackgroundPath, setChatBackgroundPath] = usePreferenceState(
    loadChatBackgroundPath,
  );
  const [chatBackgroundEmptyOpacity, setChatBackgroundEmptyOpacity] = usePreferenceState(
    loadChatBackgroundEmptyOpacity,
  );
  const [chatBackgroundSessionOpacity, setChatBackgroundSessionOpacity] =
    usePreferenceState(loadChatBackgroundSessionOpacity);
  const [chatBackgroundScope, setChatBackgroundScope] =
    usePreferenceState<ChatBackgroundScope>(loadChatBackgroundScope);
  const [chatBackgroundArea, setChatBackgroundArea] =
    usePreferenceState<ChatBackgroundArea>(loadChatBackgroundArea);
  const [newThreadBackgroundEffect, setBackgroundEffect] =
    usePreferenceState<NewThreadBackgroundEffect>(loadNewThreadBackgroundEffect);
  const [chatBackgroundBusy, setChatBackgroundBusy] = useState(false);
  const [chatBackgroundError, setChatBackgroundError] = useState<string | null>(
    null,
  );
  const [uiScale, setUiScale] = usePreferenceState(loadUiScale);
  const [fontSizes, setFontSizes] = usePreferenceState<Record<FontSizeKind, number>>(
    () => ({
      ui: loadFontSize("ui"),
      content: loadFontSize("content"),
      code: loadFontSize("code"),
    }),
  );
  const [reducedMotion, setReducedMotion] =
    usePreferenceState<ReducedMotionPreference>(loadReducedMotion);
  const [separateSchemes, setSeparateSchemes] = usePreferenceState(loadSeparateSchemes);
  const colorScheme = useColorScheme();
  const [editingScheme, setEditingScheme] = useState<ColorScheme>(activeScheme);
  const profileScope = separateSchemes ? editingScheme : "shared";
  const [profile, setProfile] = usePreferenceState<AppearanceProfile>(() =>
    loadProfile(profileScope),
  );

  useEffect(() => subscribeUiScale(() => setUiScale(loadUiScale())), []);
  // Follow the theme so the editor opens on the mode that is on screen.
  useEffect(() => setEditingScheme(colorScheme), [colorScheme]);
  useEffect(() => setProfile(loadProfile(profileScope)), [profileScope]);

  const profileRef = useRef(profile);
  profileRef.current = profile;

  /** Saves into the mode being edited; applies it when that mode is showing. */
  const updateProfile = useCallback(
    (patch: Partial<AppearanceProfile>) => {
      const next = saveProfile(profileScope, {
        ...profileRef.current,
        // Shared colour is edited by the accent/tint handlers; keep theirs.
        ...(profileScope === "shared"
          ? {
              accentColor: loadAccentColor(),
              hue: loadThemeHue(),
              saturation: loadThemeSaturation(),
            }
          : null),
        ...patch,
      });
      profileRef.current = next;
      if (profileScope === activeScope()) applyProfile(next);
      setProfile(next);
    },
    [profileScope],
  );

  /** Shows an unsaved edit while a slider is dragged; `updateProfile` saves it. */
  const previewProfile = useCallback(
    (patch: Partial<AppearanceProfile>) => {
      if (profileScope === activeScope())
        applyProfile({ ...profileRef.current, ...patch });
    },
    [profileScope],
  );

  const previewTint = useCallback(
    (hue: number, saturation: number) => {
      if (loadSeparateSchemes()) previewProfile({ hue, saturation });
      else applyThemeTint(hue, saturation);
    },
    [previewProfile],
  );

  const onThemePreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    saveThemePreference(next);
    setThemePreference(next);
  }, []);

  const onAccentColor = useCallback((value: string | null) => {
    if (loadSeparateSchemes()) {
      updateProfile({ accentColor: value });
      return;
    }
    const next = applyAccentColor(value);
    saveAccentColor(next);
    setAccentColor(next);
  }, [updateProfile]);

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

  const onWindowOpacity = useCallback((percent: number) => {
    const next = applyWindowOpacity(percent / 100);
    saveWindowOpacity(next);
    setWindowOpacity(next);
  }, []);

  const onPanelOpacity = useCallback((percent: number) => {
    const next = applyPanelOpacity(percent / 100);
    savePanelOpacity(next);
    setPanelOpacity(next);
  }, []);

  const onBlur = useCallback((radius: number) => {
    const next = applySidebarBlur(radius);
    saveSidebarBlur(next);
    setBlur(next);
  }, []);

  const onTint = useCallback((hue: number, saturation: number) => {
    if (loadSeparateSchemes()) {
      updateProfile({ hue, saturation });
      return;
    }
    const next = applyThemeTint(hue, saturation);
    saveThemeHue(next.hue);
    saveThemeSaturation(next.saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, [updateProfile]);

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
      const picked = await pickAndSaveChatBackground();
      if (!picked) return;
      const path = activePreferenceStore() ? await uploadPreferenceBackground(picked) : picked;
      saveChatBackgroundPath(path);
      applyChatBackground(path, { reload: true });
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
      if (!activePreferenceStore()) await removeChatBackground();
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

  const onChatBackgroundArea = useCallback((next: ChatBackgroundArea) => {
    applyChatBackgroundArea(next);
    saveChatBackgroundArea(next);
    setChatBackgroundArea(next);
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

  const onFontSize = useCallback((kind: FontSizeKind, value: number) => {
    const next = applyFontSize(kind, saveFontSize(kind, value));
    setFontSizes((current) => ({ ...current, [kind]: next }));
  }, []);

  const onReducedMotion = useCallback((next: ReducedMotionPreference) => {
    saveReducedMotion(next);
    applyReducedMotion(next);
    setReducedMotion(next);
  }, []);

  const onSeparateSchemes = useCallback((next: boolean) => {
    if (next) enableSeparateSchemes();
    else saveSeparateSchemes(false);
    const scope = activeScope();
    const active = loadProfile(scope);
    applyProfile(active);
    setAccentColor(loadAccentColor());
    setThemeHue(loadThemeHue());
    setThemeSaturation(loadThemeSaturation());
    setEditingScheme(activeScheme());
    setProfile(active);
    setSeparateSchemes(next);
  }, []);

  const restoreDefaults = useCallback(() => {
    for (const kind of ["ui", "content", "code"] as const)
      onFontSize(kind, FONT_SIZE_LIMITS[kind].default);
    onReducedMotion(REDUCED_MOTION_DEFAULT);
    if (loadSeparateSchemes()) onSeparateSchemes(false);
    // Typography defaults; colour defaults follow through the calls below.
    const shared = saveProfile("shared", {
      ...loadProfile("shared"),
      ...DEFAULT_PROFILE,
      accentColor: loadAccentColor(),
      hue: loadThemeHue(),
      saturation: loadThemeSaturation(),
    });
    applyProfile(shared);
    setProfile(shared);
    onThemePreference(THEME_PREFERENCE_DEFAULT);
    onAccentColor(ACCENT_COLOR_DEFAULT);
    onOpacity(Math.round(SIDEBAR_OPACITY_DEFAULT * 100));
    onPopoverOpacity(Math.round(POPOVER_OPACITY_DEFAULT * 100));
    onWindowOpacity(Math.round(WINDOW_OPACITY_DEFAULT * 100));
    onPanelOpacity(Math.round(PANEL_OPACITY_DEFAULT * 100));
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
    onChatBackgroundArea(CHAT_BACKGROUND_AREA_DEFAULT);
    onNewThreadBackgroundEffect(NEW_THREAD_BACKGROUND_EFFECT_DEFAULT);
    if (chatBackgroundPath) void onClearChatBackground();
    onUiScale(Math.round(UI_SCALE_DEFAULT * 100));
  }, [
    chatBackgroundPath,
    onFontSize,
    onReducedMotion,
    onSeparateSchemes,
    onBlur,
    onBodyGlass,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundScope,
    onChatBackgroundArea,
    onNewThreadBackgroundEffect,
    onClearChatBackground,
    onAccentColor,
    onShowExcludedFiles,
    onThemePreference,
    onOpacity,
    onPopoverOpacity,
    onWindowOpacity,
    onPanelOpacity,
    onTint,
    onDarkLightness,
    onUiScale,
  ]);

  return {
    themePreference,
    accentColor: separateSchemes ? profile.accentColor : accentColor,
    opacity,
    popoverOpacity,
    windowOpacity,
    panelOpacity,
    blur,
    themeHue: separateSchemes ? profile.hue : themeHue,
    themeSaturation: separateSchemes ? profile.saturation : themeSaturation,
    fontSizes,
    reducedMotion,
    separateSchemes,
    editingScheme,
    profile,
    onFontSize,
    onReducedMotion,
    onSeparateSchemes,
    onEditingScheme: setEditingScheme,
    updateProfile,
    previewProfile,
    previewTint,
    themeDarkLightness,
    bodyGlass,
    showExcludedFiles,
    chatBackgroundPath,
    chatBackgroundEmptyOpacity,
    chatBackgroundSessionOpacity,
    chatBackgroundScope,
    chatBackgroundArea,
    newThreadBackgroundEffect,
    chatBackgroundBusy,
    chatBackgroundError,
    uiScale,
    onThemePreference,
    onAccentColor,
    onOpacity,
    onPopoverOpacity,
    onWindowOpacity,
    onPanelOpacity,
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
    onChatBackgroundArea,
    onNewThreadBackgroundEffect,
    onUiScale,
    restoreDefaults,
  };
}

function AppearancePage({ appearance }: { appearance: AppearanceSettings }) {
  const { t: uiT } = useTranslation();
  const percent = Math.round(appearance.opacity * 100);
  const popoverPercent = Math.round(appearance.popoverOpacity * 100);
  const windowPercent = Math.round(appearance.windowOpacity * 100);
  const panelPercent = Math.round(appearance.panelOpacity * 100);
  const glassDisabled = useColorScheme() === "light";
  // Linux keeps the window opaque until Main pane glass or a lowered Window
  // opacity opts into transparency.
  const windowOpaque =
    glassDisabled ||
    (IS_LINUX && !appearance.bodyGlass && windowPercent >= 100);

  return (
    <>
      <Group
        title={uiT("Theme")}
        description={
          appearance.separateSchemes
            ? uiT(
                "Dark and light keep their own colors, fonts and contrast; edit each mode below.",
              )
            : uiT(
                "Dark and light share the same tint, so the color settings below apply to both.",
              )
        }
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
        {appearance.separateSchemes ? null : (
          <AccentRow appearance={appearance} />
        )}
      </Group>

      <TypographyCards appearance={appearance} />

      <Group
        title={uiT("Color")}
        description={uiT(
          "Hue and saturation tint every surface. Lightness only moves the dark theme.",
        )}
      >
        {appearance.separateSchemes ? null : (
          <TintRows appearance={appearance} />
        )}
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
          <LiveSlider
            label={uiT("Dark-mode lightness")}
            value={appearance.themeDarkLightness}
            format={(value) => `${value}%`}
            min={THEME_DARK_LIGHTNESS_MIN}
            max={THEME_DARK_LIGHTNESS_MAX}
            preview={applyThemeDarkLightness}
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
                "Light mode keeps the main window opaque, but Popover transparency still applies to menus, pickers, and dialogs.",
              )
            : windowOpaque
              ? uiT(
                  "On Linux the window stays opaque until Main pane glass is on or Desktop transparency is above 0%. Popover transparency still applies to menus, pickers, and dialogs.",
                )
              : uiT(
                "How much of the desktop shows through MonoCode. Blur costs more to composite the higher it goes.",
              )
        }
      >
        <Row
          id="window-opacity"
          label={uiT("Desktop transparency")}
          description={uiT(
            "How much of the desktop shows through the whole window. A full-window background keeps its strength.",
          )}
        >
          <TransparencySlider
            label={uiT("Desktop transparency")}
            opacity={windowPercent}
            minOpacity={Math.round(WINDOW_OPACITY_MIN * 100)}
            maxOpacity={Math.round(WINDOW_OPACITY_MAX * 100)}
            preview={(value) => applyWindowOpacity(value / 100)}
            onChange={appearance.onWindowOpacity}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="sidebar-opacity"
          label={uiT("Sidebar transparency")}
          description={uiT(
            "Applies to the activity bar, sidebar and other glass panes.",
          )}
        >
          <TransparencySlider
            label={uiT("Sidebar transparency")}
            opacity={percent}
            minOpacity={Math.round(SIDEBAR_OPACITY_MIN * 100)}
            maxOpacity={Math.round(SIDEBAR_OPACITY_MAX * 100)}
            preview={(value) => applySidebarOpacity(value / 100)}
            onChange={appearance.onOpacity}
            disabled={windowOpaque}
          />
        </Row>
        <Row
          id="popover-opacity"
          label={uiT("Popover transparency")}
          description={uiT(
            "How much background shows through menus, pickers, dialogs, and other popovers.",
          )}
        >
          <TransparencySlider
            label={uiT("Popover transparency")}
            opacity={popoverPercent}
            minOpacity={Math.round(POPOVER_OPACITY_MIN * 100)}
            maxOpacity={Math.round(POPOVER_OPACITY_MAX * 100)}
            preview={(value) => applyPopoverOpacity(value / 100)}
            onChange={appearance.onPopoverOpacity}
          />
        </Row>
        <Row
          id="panel-opacity"
          label={uiT("Panel transparency")}
          description={uiT(
            "Composer, settings, dialogs and menus. Higher values show more of what is behind them.",
          )}
        >
          <TransparencySlider
            label={uiT("Panel transparency")}
            opacity={panelPercent}
            minOpacity={Math.round(PANEL_OPACITY_MIN * 100)}
            maxOpacity={Math.round(PANEL_OPACITY_MAX * 100)}
            preview={(value) => applyPanelOpacity(value / 100)}
            onChange={appearance.onPanelOpacity}
          />
        </Row>
        <Row
          id="blur"
          label={uiT("Blur radius")}
          description={uiT("Background blur behind the window.")}
        >
          <LiveSlider
            label={uiT("Blur radius")}
            value={appearance.blur}
            format={String}
            min={SIDEBAR_BLUR_MIN}
            max={SIDEBAR_BLUR_MAX}
            preview={applySidebarBlur}
            onChange={appearance.onBlur}
            disabled={windowOpaque}
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

function AccentRow({ appearance }: { appearance: AppearanceSettings }) {
  const { t: uiT } = useTranslation();
  return (
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
  );
}

function TintRows({ appearance }: { appearance: AppearanceSettings }) {
  const { t: uiT } = useTranslation();
  return (
    <>
      <Row
        id="hue"
        label={uiT("Hue")}
        description={uiT("Base hue for accents and tinted surfaces.")}
      >
        <LiveSlider
          label={uiT("Hue")}
          value={appearance.themeHue}
          format={(value) => `${value}°`}
          min={THEME_HUE_MIN}
          max={THEME_HUE_MAX}
          preview={(value) =>
            appearance.previewTint(value, appearance.themeSaturation)
          }
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
        <LiveSlider
          label={uiT("Saturation")}
          value={appearance.themeSaturation}
          format={(value) => `${value}%`}
          min={THEME_SATURATION_MIN}
          max={THEME_SATURATION_MAX}
          preview={(value) => appearance.previewTint(appearance.themeHue, value)}
          onChange={(value) => appearance.onTint(appearance.themeHue, value)}
        />
      </Row>
    </>
  );
}

const CUSTOM_FONT = "__custom__";

/** Installed families, or `fallback` until/unless the backend answers. */
function useSystemFonts(
  kind: keyof SystemFonts,
  fallback: readonly string[],
): readonly string[] {
  const [fonts, setFonts] = useState<readonly string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadSystemFonts().then((fonts) => {
      const list = fonts[kind];
      if (alive && list.length > 0) setFonts(list);
    });
    return () => {
      alive = false;
    };
  }, [kind]);
  return fonts ?? fallback;
}

/** Installed font list plus a free-text family for anything else. */
function FontFamilySelect({
  label,
  value,
  defaultLabel,
  presets,
  monospace = false,
  onChange,
}: {
  label: string;
  value: string;
  defaultLabel: string;
  presets: readonly string[];
  /** Code fonts list only fixed-pitch families. */
  monospace?: boolean;
  onChange: (value: string) => void;
}) {
  const { t: uiT } = useTranslation();
  presets = useSystemFonts(monospace ? "monospace" : "all", presets);
  const isPreset = value === "" || presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(isPreset ? "" : value);
  useEffect(() => {
    if (value !== "" && !presets.includes(value)) {
      setCustom(true);
      setDraft(value);
    }
  }, [value, presets]);

  const commit = () => {
    const next = normalizeFontFamily(draft);
    setDraft(next);
    if (next !== value) onChange(next);
  };

  return (
    <>
      {custom ? (
        <Input
          size="lg"
          value={draft}
          aria-label={uiT("Custom {font}", { font: label })}
          placeholder={uiT("Font name")}
          spellCheck={false}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-36 rounded-lg"
        />
      ) : null}
      <div className="w-40">
        <Select
          label={label}
          value={custom ? CUSTOM_FONT : value}
          options={[
            { value: "", label: defaultLabel },
            ...presets.map((font) => ({ value: font, label: font })),
            { value: CUSTOM_FONT, label: uiT("Custom…") },
          ]}
          onChange={(next) => {
            if (next === CUSTOM_FONT) {
              setCustom(true);
              return;
            }
            setCustom(false);
            setDraft("");
            onChange(next);
          }}
        />
      </div>
    </>
  );
}

function FontWeightSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontWeight;
  onChange: (value: FontWeight) => void;
}) {
  const { t: uiT } = useTranslation();
  return (
    <div className="w-28">
      <Select
        label={label}
        value={String(value)}
        options={FONT_WEIGHTS.map((weight) => ({
          value: String(weight),
          label: uiT(FONT_WEIGHT_LABELS[weight]),
        }))}
        onChange={(next) => onChange(Number(next) as FontWeight)}
      />
    </div>
  );
}

/** Sizes, motion and the per-mode font/contrast card (ZCode settings cards). */
function TypographyCards({ appearance }: { appearance: AppearanceSettings }) {
  const { t: uiT } = useTranslation();
  const { profile, updateProfile } = appearance;
  const sizeRows: { kind: FontSizeKind; label: string; description: string }[] =
    [
      {
        kind: "ui",
        label: uiT("Interface font size"),
        description: uiT("Adjust the base font size of MonoCode."),
      },
      {
        kind: "content",
        label: uiT("Content font size"),
        description: uiT("Adjust the base font size of conversations and documents."),
      },
      {
        kind: "code",
        label: uiT("Code font size"),
        description: uiT(
          "Adjust the base font size of code in chat and diff views.",
        ),
      },
    ];

  return (
    <>
      <Group>
        {sizeRows.map((row) => (
          <Row
            key={row.kind}
            id={`${row.kind}-font-size`}
            label={row.label}
            description={row.description}
          >
            <FontSizeSlider
              label={row.label}
              value={appearance.fontSizes[row.kind]}
              min={FONT_SIZE_LIMITS[row.kind].min}
              max={FONT_SIZE_LIMITS[row.kind].max}
              onChange={(value) => appearance.onFontSize(row.kind, value)}
            />
          </Row>
        ))}
      </Group>

      <Group>
        <Row
          id="reduced-motion"
          label={uiT("Reduce motion")}
          description={uiT(
            "Reduce animations, or follow the system setting.",
          )}
        >
          <Segmented
            label={uiT("Reduce motion")}
            value={appearance.reducedMotion}
            options={[
              { value: "system", label: uiT("System") },
              { value: "on", label: uiT("On") },
              { value: "off", label: uiT("Off") },
            ]}
            onChange={appearance.onReducedMotion}
          />
        </Row>
        <Row
          id="separate-schemes"
          label={uiT("Separate light and dark settings")}
          description={uiT(
            "Choose colors, fonts and contrast for each mode separately.",
          )}
        >
          <Toggle
            label={uiT("Separate light and dark settings")}
            on={appearance.separateSchemes}
            onChange={appearance.onSeparateSchemes}
          />
        </Row>
      </Group>

      <Group>
        {appearance.separateSchemes ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-ui-base font-medium text-foreground">
              {uiT("Editing")}
            </span>
            <Segmented
              label={uiT("Editing")}
              value={appearance.editingScheme}
              options={[
                { value: "light", label: uiT("Light") },
                { value: "dark", label: uiT("Dark") },
              ]}
              onChange={appearance.onEditingScheme}
            />
          </div>
        ) : null}
        {appearance.separateSchemes ? (
          <>
            <AccentRow appearance={appearance} />
            <TintRows appearance={appearance} />
          </>
        ) : null}
        <Row id="ui-font-weight" label={uiT("Interface font")}>
          <FontFamilySelect
            label={uiT("Interface font")}
            value={profile.uiFont}
            defaultLabel={uiT("System")}
            presets={CONTENT_FONT_PRESETS}
            onChange={(uiFont) => updateProfile({ uiFont })}
          />
          <FontWeightSelect
            label={uiT("Interface font style")}
            value={profile.uiWeight}
            onChange={(uiWeight) => updateProfile({ uiWeight })}
          />
        </Row>
        <Row id="content-font" label={uiT("Content font")}>
          <FontFamilySelect
            label={uiT("Content font")}
            value={profile.contentFont}
            defaultLabel={uiT("Same as interface font")}
            presets={CONTENT_FONT_PRESETS}
            onChange={(contentFont) => updateProfile({ contentFont })}
          />
          <FontWeightSelect
            label={uiT("Content font style")}
            value={profile.contentWeight}
            onChange={(contentWeight) => updateProfile({ contentWeight })}
          />
        </Row>
        <Row id="code-font" label={uiT("Code font")}>
          <FontFamilySelect
            label={uiT("Code font")}
            value={profile.codeFont}
            defaultLabel={uiT("Default (Consolas)")}
            presets={CODE_FONT_PRESETS}
            monospace
            onChange={(codeFont) => updateProfile({ codeFont })}
          />
          <FontWeightSelect
            label={uiT("Code font style")}
            value={profile.codeWeight}
            onChange={(codeWeight) => updateProfile({ codeWeight })}
          />
        </Row>
        <Row id="contrast" label={uiT("Contrast")}>
          <LiveSlider
            label={uiT("Contrast")}
            value={profile.contrast}
            format={String}
            min={CONTRAST_MIN}
            max={CONTRAST_MAX}
            preview={(contrast) => appearance.previewProfile({ contrast })}
            onChange={(contrast) => updateProfile({ contrast })}
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
  const fullWindow = appearance.chatBackgroundArea === "window";

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
            label={uiT("Background area")}
            description={uiT(
              "Behind chat panes only, or across the whole window.",
            )}
          >
            <Segmented
              label={uiT("Background area")}
              value={appearance.chatBackgroundArea}
              options={[
                { value: "chat", label: uiT("Chat area") },
                { value: "window", label: uiT("Full window") },
              ]}
              onChange={appearance.onChatBackgroundArea}
            />
          </Row>
          <AnimatedCollapse expanded={!fullWindow}>
            <div className="border-t border-border">
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
            </div>
          </AnimatedCollapse>
          <Row
            label={
              fullWindow
                ? uiT("Background image strength")
                : uiT("Empty chat visibility")
            }
            description={
              fullWindow
                ? uiT(
                    "How strongly the image shows through the interface. Desktop transparency does not change it.",
                  )
                : uiT("Background strength before a chat has messages.")
            }
          >
            <LiveSlider
              label={uiT("Empty chat background visibility")}
              value={emptyVisibility}
              format={(value) => `${value}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              preview={(value) => applyChatBackgroundEmptyOpacity(value / 100)}
              onChange={appearance.onChatBackgroundEmptyOpacity}
            />
          </Row>
          <AnimatedCollapse expanded={!fullWindow}>
            <div className="border-t border-border">
              <Row
                label={uiT("Session visibility")}
                description={uiT(
                  "Background strength once the conversation has messages.",
                )}
              >
                <LiveSlider
                  label={uiT("Session background visibility")}
                  value={sessionVisibility}
                  format={(value) => `${value}%`}
                  min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
                  max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
                  preview={(value) => applyChatBackgroundSessionOpacity(value / 100)}
                  onChange={appearance.onChatBackgroundSessionOpacity}
                />
              </Row>
            </div>
          </AnimatedCollapse>
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
      setError(reason instanceof Error ? reason.message : String(reason));
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
  const [shortcut, setShortcut] = usePreferenceState(loadQuickComposerShortcut);
  const [enabled, setEnabled] = usePreferenceState(loadQuickComposerEnabled);
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
  const [overrides, setOverrides] = usePreferenceState(loadKeybindingOverrides);
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
            <Search className="size-3.5 shrink-0" />
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
        <FolderOpen className="size-3.5" />
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
                    <RefreshCw className="size-3.5" />
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
                  <ExternalLink className="size-3.5" />
                  {uiT("Open location")}
                </SecondaryButton>
                <SecondaryButton
                  aria-label={uiT("Edit {value0} CLI path", {
                    value0: String(title),
                  })}
                  disabled={working}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3.5" />
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
}: {
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
  const [choice, setChoice] = usePreferenceState(loadLastModelChoice);
  const [defaultModels, setDefaultModels] = usePreferenceState(loadDefaultModels);
  const [claudeHooks, setClaudeHooks] = usePreferenceState(loadClaudeHooks);
  const [scope, setScope] = useState<string>(GLOBAL_PROVIDER_SCOPE);
  const [hiddenGlobally, setHiddenGlobally] = usePreferenceState(
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

  const [versions, setVersions] = useState<
    Partial<Record<HarnessId, HarnessVersionInfo>>
  >({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const loadVersions = useCallback(
    async (harnesses: HarnessId[], force = false) => {
      const entries = await Promise.all(
        harnesses.map(
          async (harness) =>
            [harness, await readHarnessVersions(harness, { force })] as const,
        ),
      );
      if (!mounted.current) return;
      setVersions((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    },
    [],
  );

  useEffect(() => {
    void probeHarnessAvailability().then(() =>
      loadVersions(HARNESSES.filter((harness) => isHarnessAvailable(harness))),
    );
  }, [loadVersions]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Re-detect binaries (a CLI may have been installed or removed since the
      // last probe), then re-read versions and model catalogs of whatever is
      // installed.
      await probeHarnessAvailability({ force: true });
      const installed = HARNESSES.filter((harness) =>
        isHarnessAvailable(harness),
      );
      setVersions({});
      await Promise.all([
        loadVersions(installed, true),
        refreshHarnessCatalogs(installed, { force: true }),
      ]);
      // Other windows' model pickers keep their own stores.
      void announceHarnessesRefreshed([...HARNESSES]).catch(() => undefined);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

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
      <ProviderAccountsSettings />

      <UsageDisplaySettings />

      <Group
        id="agent-clis"
        title={uiT("Agent CLIs")}
        action={
          <div className="flex items-center gap-2">
            <SecondaryButton
              aria-label={uiT("Refresh agent CLIs")}
              aria-busy={refreshing}
              disabled={refreshing}
              onClick={() => void onRefresh()}
            >
              {refreshing ? (
                <Loader className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {refreshing ? uiT("Refreshing") : uiT("Refresh")}
            </SecondaryButton>
            <Select
              label={uiT("Provider defaults scope")}
              value={scope}
              options={scopeOptions}
              onChange={setScope}
            />
          </div>
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
              version={versions[harness]}
              onUpdated={() => void loadVersions([harness])}
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
  homeEdited?: boolean;
  importCurrent?: boolean;
  provider: ProviderAccountProvider;
  accountId?: string;
  label: string;
  dataHome?: string;
};

/** The ⋯ menu for one account row: the actions a row needs only sometimes. */
function ProviderAccountMenu({
  label,
  disabled,
  busy,
  canSignIn,
  canSetDefault,
  canRemove,
  removeLocked,
  onSignIn,
  onSetDefault,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  canSignIn: boolean;
  canSetDefault: boolean;
  canRemove: boolean;
  /** The shared default cannot be removed until another account replaces it. */
  removeLocked: boolean;
  onSignIn: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const { t: uiT } = useTranslation();
  const visible = useSurfaceVisibility();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!visible || disabled) setOpen(false);
  }, [visible, disabled]);

  const items: ExplorerMenuItem[] = [];
  if (canSignIn) {
    items.push({ kind: "item", id: "sign-in", label: uiT("Sign in again") });
  }
  if (canSetDefault) {
    items.push({
      kind: "item",
      id: "default",
      label: uiT("Use as shared default"),
    });
  }
  if (canRemove) {
    if (items.length > 0) items.push({ kind: "sep" });
    items.push({
      kind: "item",
      id: "remove",
      label: uiT("Remove account"),
      icon: <Trash2 className="size-4" />,
      danger: true,
      disabled: removeLocked,
      description: removeLocked
        ? uiT("Choose another shared default first")
        : undefined,
    });
  }
  if (items.length === 0) return null;

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={uiT("Actions for {account}", { account: label })}
        title={uiT("More actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid size-7 place-items-center rounded-md text-content/40 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.96] disabled:opacity-35"
      >
        {busy ? (
          <Loader className="size-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="size-4" />
        )}
      </button>
      {visible && open && button.current ? (
        <ExplorerMenu
          anchor={button.current}
          side="bottom"
          align="end"
          width={220}
          ariaLabel={uiT("Actions for {account}", { account: label })}
          items={items}
          onPick={(id) => {
            close();
            if (id === "sign-in") onSignIn();
            else if (id === "default") onSetDefault();
            else if (id === "remove") onRemove();
          }}
          onClose={close}
        />
      ) : null}
    </>
  );
}

export function ProviderAccountsSettings() {
  const { t: uiT } = useTranslation();
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<AccountEditor | null>(null);
  const [editorExpanded, setEditorExpanded] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [defaultsRetry, setDefaultsRetry] = useState(0);
  const [profilesReady, setProfilesReady] = useState(false);
  useEffect(() => {
    let current = true;
    void loadProviderAccounts().then(
      () => { if (current) setProfilesReady(true); },
      (reason) => {
        if (current) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => { current = false; };
  }, [defaultsRetry]);
  useEffect(() => {
    let current = true;
    setDefaultsReady(false);
    void requireSharedAccountHost()
      .then(loadSharedProviderDefaults)
      .then(
        () => {
          if (current) {
            setDefaultsReady(true);
            setDefaultsError(null);
          }
        },
        (reason) => {
          if (current)
            setDefaultsError(
              reason instanceof Error ? reason.message : String(reason),
            );
        },
      );
    return () => {
      current = false;
    };
  }, [defaultsRetry]);

  const changeSharedDefault = async (
    provider: ProviderAccountProvider,
    accountId: string,
  ) => {
    if (working || !defaultsReady) return;
    setWorking(`default:${provider}`);
    setError(null);
    try {
      await withStatusToast(() => setSharedProviderDefault(provider, accountId), {
        loading: uiT("Setting default account…"),
        success: uiT("Default account updated"),
        error: false,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(null);
    }
  };

  useEffect(
    () => subscribeProviderAccounts(() => setVersion((value) => value + 1)),
    [],
  );

  const toggleEditor = (next: AccountEditor) => {
    setError(null);
    if (
      editor?.provider === next.provider &&
      editor.accountId === next.accountId &&
      Boolean(editor.importCurrent) === Boolean(next.importCurrent)
    ) {
      setEditorExpanded((expanded) => !expanded);
      return;
    }
    setEditor(next);
    setEditorExpanded(true);
  };

  const startAdd = (provider: ProviderAccountProvider) =>
    toggleEditor({ provider, label: "", dataHome: "" });

  const startRename = (account: ProviderAccount) => {
    toggleEditor({
      provider: account.provider,
      accountId: account.id,
      label: account.label,
      dataHome: account.dataHome ?? "",
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
    const notice = editor.accountId
      ? { loading: uiT("Saving…"), success: uiT("Account saved") }
      : editor.importCurrent
        ? { loading: uiT("Importing account…"), success: uiT("Account imported") }
        : { loading: uiT("Adding account…"), success: uiT("Account added") };
    try {
      await withStatusToast(async () => {
        if (editor.accountId) {
          await updateProviderAccountProfile({
            id: editor.accountId, provider: editor.provider,
            label: editor.label, ...(editor.homeEdited ? { dataHome: editor.dataHome ?? "" } : {}),
          });
          clearCachedRateLimits(editor.provider, editor.accountId);
          setVersion((value) => value + 1);
        } else if (editor.importCurrent) {
          await importCurrentCodexAccount(editor.label);
        } else {
          await addProviderAccountProfile(editor.provider, editor.label, editor.dataHome);
        }
      }, { ...notice, error: false });
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

  const signIn = async (account: ProviderAccount) => {
    if (working) return;
    setWorking(`login:${account.provider}:${account.id}`);
    setError(null);
    try {
      await withStatusToast(() => loginHarness(account.provider, account.id), {
        loading: uiT("Signing in…"),
        success: uiT("Signed in to {account}", { account: account.label }),
        error: false,
      });
      clearCachedRateLimits(account.provider, account.id);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(null);
    }
  };

  const removeAccount = async (account: ProviderAccount) => {
    if (account.isDefault || working) return;
    const confirmed = await ask(
      uiT("Remove “{account}”? Running turns will stop. Host-managed credentials will be deleted; custom Data Homes will be kept.", { account: account.label }),
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
      await withStatusToast(
        () => removeProviderAccountCredentials(account.provider, account.id),
        { loading: uiT("Removing account…"), success: uiT("Account removed"), error: false },
      );
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

  const accounts = PROVIDER_ACCOUNT_PROVIDERS.flatMap(providerAccounts);
  const identities = useProviderAccountIdentities(accounts, version, "host");
  const usage = useProviderAccountUsage(version);

  return (
    <Group
      id="provider-accounts"
      title={uiT("Accounts")}
      description={uiT(
        "Each row is a saved CLI profile. Edit its Home or sign in directly, including the built-in profile. The badged row is the default for new conversations on desktop and phone.",
      )}
      action={<AccountUsageRefresh usage={{ ...usage, refresh: () => {
        setVersion((value) => value + 1);
        usage.refresh();
      } }} />}
    >
      {PROVIDER_ACCOUNT_PROVIDERS.map((provider) => {
        const accounts = providerAccounts(provider);
        const adding = editor?.provider === provider && !editor.accountId;
        const sharedDefault = sharedProviderAccountId(provider);
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
              {provider === "codex" && (
                <button
                  type="button"
                  disabled={Boolean(working) || !profilesReady}
                  aria-expanded={editorExpanded && adding && Boolean(editor.importCurrent)}
                  onClick={() => toggleEditor({ provider, label: "", importCurrent: true })}
                  className="shrink-0 rounded-md border border-content/10 px-2.5 py-1 text-[12px] text-content/70 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
                >
                  {uiT("Import current Codex login")}
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(working) || !profilesReady}
                aria-expanded={editorExpanded && adding && !editor.importCurrent}
                onClick={() => startAdd(provider)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-content/10 px-2.5 py-1 text-[12px] text-content/70 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden />
                {uiT("Add account")}
              </button>
            </div>
            {defaultsReady &&
              sharedDefault !== "default" &&
              !accounts.some((account) => account.id === sharedDefault) && (
                <p role="alert" className="px-4 pb-3 pl-[3.375rem] text-[11px] text-amber-400/90">
                  {uiT("Unavailable account ({account})", {
                    account: sharedDefault,
                  })}
                </p>
              )}
            <div className="bg-content/[0.015] pl-[2.375rem]">
              {accounts.map((account) => {
                const editing =
                  editor?.provider === provider &&
                  editor.accountId === account.id;
                const removing = working === `remove:${provider}:${account.id}`;
                const signingIn = working === `login:${provider}:${account.id}`;
                const identity = identities[identityKey(account)];
                const orgTag = identityOrganizationTag(identity);
                const limits = usage.usage[accountUsageKey(account)];
                const isSharedDefault =
                  defaultsReady && account.id === sharedDefault;
                // Sign-in only earns a visible button when the profile has no
                // readable login; re-signing a working one lives in the menu.
                const needsSignIn =
                  identity === null ||
                  (limits?.status === "unavailable" && !limits.error);
                const windows = meterWindows(limits);
                const dataHomeLabel = uiT("Data Home is managed by Host");
                return (
                  <Fragment key={account.id}>
                  <div className="flex items-start gap-3 border-t border-content/5 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="min-w-0 truncate text-[12px] font-medium text-content/90">
                          {account.isDefault && account.label === "Default account"
                            ? uiT("Built-in CLI profile") : account.label}
                        </span>
                        {account.isDefault && account.label !== "Default account" && (
                          <span className="shrink-0 text-[10px] text-content/45">{uiT("Built-in CLI profile")}</span>
                        )}
                        {orgTag ? (
                          <span className="max-w-[8rem] shrink-0 truncate rounded bg-content/[0.07] px-1 text-[10px] leading-4 text-content/50">
                            {orgTag}
                          </span>
                        ) : null}
                        {isSharedDefault ? (
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 text-[10px] font-medium leading-4 text-accent">
                            {uiT("Default for new conversations")}
                          </span>
                        ) : null}
                      </div>
                      <div
                        data-provider-account-identity={identityKey(account)}
                        title={uiT("Actual account")}
                        className="mt-1 min-w-0 text-[11px]"
                      >
                        <ProviderAccountSubtitle
                          identity={identity}
                          fallback={uiT(identity === undefined
                            ? "Reading account identity…"
                            : "No account identity could be read from this Home. Check the path or sign in.")}
                          className="block break-words text-content/75"
                        />
                      </div>
                      <AccountStatusLabel
                        status={accountStatus(limits, usage.now)}
                        wrap
                        className="mt-1 max-w-full text-[10px]"
                      />
                      <div title={dataHomeLabel} className="mt-0.5 truncate font-mono text-[10px] text-content/40" data-provider-account-home>
                        {dataHomeLabel}
                      </div>
                      {windows.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                          {windows.map((entry) => (
                            <UsageMeter
                              key={entry.title}
                              title={entry.title}
                              window={entry.window}
                              now={usage.now}
                              className="w-40"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {needsSignIn || signingIn ? (
                        <SecondaryButton
                          disabled={Boolean(working)}
                          aria-label={uiT("Sign in to {account}", { account: account.label })}
                          onClick={() => void signIn(account)}
                        >
                          {signingIn ? (
                            <Loader className="size-3.5 animate-spin" aria-hidden />
                          ) : null}
                          {uiT(signingIn ? "Waiting for browser…" : "Sign in")}
                        </SecondaryButton>
                      ) : null}
                      <button
                        type="button"
                        disabled={Boolean(working)}
                        aria-label={uiT("Rename {value0}", {
                          value0: String(account.label),
                        })}
                        title={uiT("Edit account and Data Home")}
                        aria-expanded={editorExpanded && editing}
                        onClick={() => startRename(account)}
                        className="grid size-7 place-items-center rounded-md text-content/40 transition-transform duration-150 hover:bg-content/10 hover:text-content active:scale-[0.96] disabled:opacity-35"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <ProviderAccountMenu
                        label={account.label}
                        disabled={Boolean(working)}
                        busy={removing}
                        canSignIn={!needsSignIn && !signingIn}
                        canSetDefault={defaultsReady && !isSharedDefault}
                        canRemove={!account.isDefault}
                        removeLocked={account.id === sharedDefault}
                        onSignIn={() => void signIn(account)}
                        onSetDefault={() =>
                          void changeSharedDefault(provider, account.id)
                        }
                        onRemove={() => void removeAccount(account)}
                      />
                    </div>
                  </div>
                  <ProviderAccountEditorDisclosure
                    editor={editorExpanded && editing ? editor : null}
                    working={Boolean(working)}
                    onLabel={label => setEditor(current => current ? { ...current, label } : current)}
                    onDataHome={dataHome => setEditor(current => current ? { ...current, dataHome, homeEdited: true } : current)}
                    onCancel={() => setEditor(null)}
                    onSubmit={submitEditor}
                  />
                  </Fragment>
                );
              })}
              <ProviderAccountEditorDisclosure
                editor={editorExpanded && adding ? editor : null}
                working={Boolean(working)}
                onLabel={(label) =>
                  setEditor((current) =>
                    current ? { ...current, label } : current,
                  )
                }
                onDataHome={dataHome => setEditor(current => current ? { ...current, dataHome, homeEdited: true } : current)}
                onCancel={() => setEditor(null)}
                onSubmit={submitEditor}
              />
            </div>
          </div>
        );
      })}
      {error ? (
        <p
          className="border-t border-content/5 px-4 py-2.5 text-[11px] leading-4 text-red-400"
          role="alert"
        >
          {uiT(error)}
          {!profilesReady && <button type="button" className="ml-2 underline" onClick={() => setDefaultsRetry(value => value + 1)}>{uiT("Retry")}</button>}
        </p>
      ) : null}
      {defaultsError && (
        <p
          role="status"
          className="border-t border-content/5 px-4 py-2.5 text-[11px] text-content/50"
        >
          {uiT(defaultsError)}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setDefaultsRetry((value) => value + 1)}
          >
            {uiT("Retry")}
          </button>
        </p>
      )}
    </Group>
  );
}

function ProviderAccountEditorDisclosure({
  editor,
  ...props
}: Omit<Parameters<typeof ProviderAccountEditor>[0], "editor"> & {
  editor: AccountEditor | null;
}) {
  const retained = useRef(editor);
  if (editor) retained.current = editor;
  return (
    <AnimatedCollapse expanded={!!editor}>
      {retained.current && (
        <ProviderAccountEditor {...props} editor={retained.current} />
      )}
    </AnimatedCollapse>
  );
}

function ProviderAccountEditor({
  editor,
  working,
  onLabel,
  onDataHome,
  onCancel,
  onSubmit,
}: {
  editor: AccountEditor;
  working: boolean;
  onLabel: (label: string) => void;
  onDataHome?: (home: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t: uiT } = useTranslation();
  const adding = !editor.accountId;
  return (
    <form
      className="border-t border-content/5 px-4 py-2"
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
              ? uiT(editor.importCurrent ? "Importing…" : "Saving…")
              : uiT(editor.importCurrent ? "Import account" : "Add account")
            : uiT("Save")}
        </button>
      </div>
      {!editor.importCurrent && <label className="mt-2 block">
        <span className="text-[11px] text-content/60">{uiT("Data Home (optional)")}</span>
        <input
          type="text"
          value={editor.dataHome ?? ""}
          disabled={working}
          aria-label={uiT("{provider} Data Home", { provider: HARNESS_TITLE[editor.provider] })}
          placeholder={editor.accountId === "default"
            ? (editor.provider === "codex" ? "~/.codex" : "~/.claude")
            : (editor.provider === "codex" ? "~/.codex-work" : "~/.claude-work")}
          onChange={event => onDataHome?.(event.target.value)}
          className="mt-1 h-8 w-full rounded-md border border-content/10 bg-content/[0.04] px-2.5 font-mono text-[12px] text-content outline-none focus:border-accent/45 disabled:opacity-50"
        />
        <span className="mt-1 block text-[10px] text-content/40">
          {uiT(editor.accountId
            ? "The current Home stays private on Host. Leave this field unchanged to keep it; editing then clearing resets it to the default Home."
            : "Leave empty to use a MonoCode-managed isolated Home.")}
          {" "}{uiT("Use an absolute path or ~/ on Host. New conversations use the updated Home.")}
        </span>
      </label>}
    </form>
  );
}

/** The icon the activity bar shows: custom logo, else the project mascot. */
function ProjectScopeIcon({ path }: { path: string }) {
  const logos = useTabGroupLogos();
  const [colors] = usePreferenceState(loadTabGroupColors);
  const [customColors] = usePreferenceState(loadTabGroupCustomColors);
  const [mascots] = usePreferenceState(loadTabGroupMascots);
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
  version,
  onUpdated,
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
  version?: HarnessVersionInfo;
  /** Re-reads the installed version once a self-update finishes. */
  onUpdated: () => void;
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
    if (!available || hasFreshCatalog(harness)) return;
    void refreshHarnessCatalogs([harness]);
  }, [available, harness]);

  const [update, setUpdate] = useState<HarnessUpdateState>({
    status: "idle",
  });
  const installed = available ? version?.installed : undefined;
  const latest = version?.latest;
  const bundledBy = available ? version?.bundledBy : undefined;
  const behind = available && hasHarnessUpdate(version);
  // A bundled copy updates only with its app, so it never gets an Update button.
  const updatable = behind && !bundledBy;
  const onUpdate = async () => {
    if (!installed || !latest || update.status === "updating") return;
    setUpdate({ status: "updating" });
    const result = await runHarnessUpdate({ harness, installed, latest });
    setUpdate(result);
    onUpdated();
  };
  const versionText: ReactNode = !installed ? null : updatable && latest ? (
    <span
      className="font-mono"
      title={uiT("Version {value0} installed, {value1} available", {
        value0: installed,
        value1: latest,
      })}
    >
      <span className="text-warning">{installed}</span>
      {" → "}
      <span className="font-medium text-success">{latest}</span>
    </span>
  ) : latest
        ? uiT("Version {value0} (latest)", { value0: installed })
        : uiT("Version {value0}", { value0: installed });
  // Saved path overrides apply on the next launch, like the CLI path editor.
  const [binaryRevision, setBinaryRevision] = useState(0);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const pendingPath = providerBinaryPathChangePending(harness)
    ? loadProviderBinaryPath(harness)
    : null;
  const newerCopy = bundledBy ? version?.newerCopy : undefined;
  const switched = newerCopy != null && pendingPath === newerCopy.path;
  const onUseCopy = async (copy: { path: string; version: string }) => {
    if (switching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const inspection = await inspectHarnessBinary(harness, copy.path);
      const problem = binaryInspectionError(harness, inspection);
      if (problem) throw new Error(problem);
      if (!saveProviderBinaryPath(harness, copy.path)) {
        throw new Error("Could not save the binary path.");
      }
      setBinaryRevision((value) => value + 1);
    } catch (cause) {
      setSwitchError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSwitching(false);
    }
  };
  const sourceText = !bundledBy
    ? null
    : switched && newerCopy
      ? uiT("Switched to {value0}. Restart MonoCode to apply.", {
          value0: newerCopy.version,
        })
      : behind
        ? uiT("Bundled with {app}; it updates with {app}.", { app: bundledBy })
        : uiT("Bundled with {app}", { app: bundledBy });
  const modelsText = available
    ? uiT("{value0} {value1} available.", {
        value0: String(models.length),
        value1: String(models.length === 1 ? "model" : "models"),
      })
    : harnessUnavailableHint(harness);

  return (
    <Row
      label={
        <span className="flex items-center gap-2">
          <HarnessIcon harness={harness} className="size-4 shrink-0" />
          {HARNESS_TITLE[harness]}
          <ProviderBinaryControl key={binaryRevision} provider={harness} />
          {isDefault ? (
            <span className="rounded-full bg-content/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content/60">
              {uiT("Default")}
            </span>
          ) : null}
        </span>
      }
      description={
        update.status === "failed" ? (
          update.error
        ) : switchError ? (
          switchError
        ) : versionText ? (
          <>
            {versionText}
            {sourceText ? ` · ${sourceText}` : null} · {modelsText}
          </>
        ) : (
          modelsText
        )
      }
    >
      {newerCopy && !switched ? (
        <SecondaryButton
          aria-label={uiT("Use {value0} {value1} at {value2}", {
            value0: String(HARNESS_TITLE[harness]),
            value1: newerCopy.version,
            value2: newerCopy.path,
          })}
          title={newerCopy.path}
          disabled={switching}
          onClick={() => void onUseCopy(newerCopy)}
        >
          {switching ? (
            <Loader className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
          )}
          {uiT("Use {value0}", { value0: newerCopy.version })}
        </SecondaryButton>
      ) : null}
      {updatable && update.status !== "updated" ? (
        <SecondaryButton
          aria-label={uiT("Update {value0}", {
            value0: String(HARNESS_TITLE[harness]),
          })}
          disabled={update.status === "updating"}
          onClick={() => void onUpdate()}
        >
          {update.status === "updating" ? (
            <Loader className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
          )}
          {update.status === "updating"
            ? uiT("Updating")
            : update.status === "failed"
              ? uiT("Retry")
              : uiT("Update")}
        </SecondaryButton>
      ) : null}
      {current ? (
        <Select
          label={uiT("{value0} model", {
            value0: String(HARNESS_TITLE[harness]),
          })}
          value={current.id}
          onChange={(next) => onModelChange(harness, next)}
          onOpen={() => {
            // Fallbacks keep models non-empty and routine refreshes skip live
            // catalogs. Explicitly opening the picker must refresh either one.
            if (available) {
              void refreshHarnessCatalogs([harness], { force: true });
            }
          }}
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
  const [items, setItems] = usePreferenceState(loadArchivedProjects);
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
  const [filters, setFilters] = usePreferenceState(loadSessionSidebarFilters);
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
    <header className="pb-6">
      <h1 className="text-ui-xl font-semibold leading-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-xl text-ui-base leading-6 text-foreground-subtle">
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
  /** Untitled groups render as a bare ZCode settings card. */
  title?: ReactNode;
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
      className={title || description || action ? "pt-8 first:pt-0" : "pt-5 first:pt-0"}
    >
      {title || description || action ? (
        <div className="flex items-end gap-4 pb-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-ui-lg font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-ui-base leading-6 text-foreground-subtle">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
        </div>
      ) : null}
      <div
        className={`settings-card overflow-hidden rounded-xl border transition-colors ${
          flash ? "border-accent/60" : "border-border"
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
  description?: ReactNode;
  children?: ReactNode;
}) {
  const revealed = useContext(RevealedSetting);
  const flash = id != null && revealed === id;

  return (
    <div
      id={id ? settingDomId(id) : undefined}
      data-setting-id={id}
      className={`settings-row flex items-center gap-6 border-t border-border px-4 py-3 transition-colors first:border-t-0 ${
        flash ? "bg-accent/10" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-ui-base font-medium text-foreground">{label}</div>
        {description ? (
          <p className="mt-0.5 text-ui-caption leading-5 text-foreground-subtle">
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
      className="inline-grid max-w-full shrink-0 gap-1 text-ui-base"
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
          className={`h-7 min-w-0 truncate rounded-full px-3 font-medium transition-colors ${
            value === option.value
              ? "bg-selection text-foreground"
              : "text-foreground-subtle hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Shows the size while dragging; applies it only on release (no re-layout per frame). */
function FontSizeSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Slider
      label={label}
      value={draft}
      display={`${draft}px`}
      min={min}
      max={max}
      onChange={setDraft}
      onCommit={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}

/** A drag held still this long previews its value; release applies it at once. */
const PREVIEW_IDLE_MS = 1000;

/**
 * Applies after the thumb rests for a second, or on release. Root-level
 * appearance variables restyle the whole window, so applying while the thumb
 * moves makes the drag stutter. Release saves once: each save is a
 * shared-preference write that re-applies every appearance setting and syncs
 * to the Host.
 */
function LiveSlider({
  label,
  value,
  format,
  min,
  max,
  preview,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  min: number;
  max: number;
  /** Applies a draft without saving it. */
  preview: (value: number) => void;
  /** Applies and saves the released value. */
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const latest = useRef({ value, draft, preview, onChange });
  latest.current = { value, draft, preview, onChange };
  const timer = useRef<number | undefined>(undefined);

  const cancelPreview = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const commit = (next: number) => {
    cancelPreview();
    if (next !== latest.current.value) latest.current.onChange(next);
    else latest.current.preview(next);
  };

  // Leaving the page mid-drag must not strand a previewed, unsaved value.
  useEffect(
    () => () => {
      cancelPreview();
      const { value, draft, onChange } = latest.current;
      if (draft !== value) onChange(draft);
    },
    [],
  );

  return (
    <Slider
      label={label}
      value={draft}
      display={format(draft)}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(next) => {
        setDraft(next);
        cancelPreview();
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          latest.current.preview(next);
        }, PREVIEW_IDLE_MS);
      }}
      onCommit={commit}
    />
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
  onCommit,
  disabled = false,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Fires once a drag or key press ends, for settings costly to apply live. */
  onCommit?: (value: number) => void;
  disabled?: boolean;
}) {
  const commit = (event: { currentTarget: HTMLInputElement }) =>
    onCommit?.(Number(event.currentTarget.value));
  return (
    <div
      className={`flex w-60 max-w-full items-center gap-4 ${disabled ? "opacity-40" : ""}`}
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
        className="settings-slider min-w-0 flex-1 disabled:cursor-not-allowed"
        style={
          {
            "--slider-fill": `${max > min ? ((value - min) / (max - min)) * 100 : 0}%`,
          } as CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className="w-10 shrink-0 text-right text-ui-base text-foreground tabular-nums">
        {display}
      </span>
    </div>
  );
}

/**
 * Presents a stored opacity percentage as transparency (100 - opacity), so
 * higher values show more of what is behind; callbacks still take opacity.
 */
function TransparencySlider({
  label,
  opacity,
  minOpacity,
  maxOpacity,
  preview,
  onChange,
  disabled,
}: {
  label: string;
  opacity: number;
  minOpacity: number;
  maxOpacity: number;
  preview: (opacity: number) => void;
  onChange: (opacity: number) => void;
  disabled?: boolean;
}) {
  return (
    <LiveSlider
      label={label}
      value={100 - opacity}
      format={(value) => `${value}%`}
      min={100 - maxOpacity}
      max={100 - minOpacity}
      preview={(value) => preview(100 - value)}
      onChange={(value) => onChange(100 - value)}
      disabled={disabled}
    />
  );
}

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
        labels={["Default", ...ACCENT_COLOR_PRESET_LABELS]}
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
    <Switch
      aria-label={label}
      checked={on}
      disabled={disabled}
      onCheckedChange={(next) => {
        onChange(next);
        playCue("switch");
      }}
    />
  );
}

/** Theme-aware dropdown for a Settings row: a trigger button opening a Popover listbox. Used instead of a native select, whose option popup is OS-rendered and unreadable in dark mode on Windows/Linux. */
function Select({
  label,
  value,
  options,
  onChange,
  onOpen,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
  onOpen?: () => void;
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
    if (open) onOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input-border bg-input pl-3 pr-2 text-left text-ui-base text-foreground outline-none transition-colors hover:border-input-border-hover focus-visible:border-input-border-focused aria-expanded:border-input-border-hover"
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
          className={`size-3.5 shrink-0 text-foreground-subtle transition-transform ${open ? "rotate-180" : ""}`}
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
                className={`flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-ui-base text-foreground ${
                  highlighted ? "bg-menu-hover" : ""
                }`}
              >
                {option.icon ? (
                  <span className="grid size-4 shrink-0 place-items-center">
                    {option.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <Check className="size-4 shrink-0 text-foreground-subtle" />
                ) : null}
              </button>
            );
          })}
        </Popover>
      ) : null}
    </div>
  );
}
