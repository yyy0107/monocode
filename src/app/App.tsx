import { loadSharedAgentDefaults } from "../features/settings/model/agentPreferences";
import { selectComposerConfiguration, sessionComposerConfiguration } from "../features/sessions/model/composerConfiguration";
import { DesktopAssistantButton } from "../features/assistant/ui/DesktopAssistantButton";
import { translate } from "../shared/i18n/language";
import { usePreferenceState } from "../features/settings/model/usePreferenceState";
import {
  WorkflowAppContext,
  type WorkflowAppActions,
} from "../features/workflows/ui/workflowAppContext";
import {
  WorkflowActivityContext,
  workflowActivityIndex,
} from "../features/workflows/model/workflowActivity";
import { WorkflowSidebarSection } from "../features/workflows/ui/WorkflowSidebarSection";
import { WorkflowsView } from "../features/workflows/ui/WorkflowsView";
import { WorkflowProjectsContext } from "../features/workflows/kit/store/TabStoreProvider";
import { useTranslation } from "../shared/i18n/useTranslation";
import { DesktopAssistant } from "../features/assistant/ui/DesktopAssistant";
import {
  AppViewHost,
  AppViewRendererContext,
  type AppViewRenderer,
} from "../features/workspace/ui/AppViewHost";
import { ActivityBar, type ActivityBarProps } from "./shell/ActivityBar";
import { useUpdateStatus } from "./shell/useUpdateStatus";
import { createProjectHistoryLoader } from "./model/projectHistoryLoader";
import { contentTabTarget } from "./model/appViewNavigation";
import { SessionTitleCoordinator } from "../integrations/harness/core/titleCoordinator";
import { generateConfiguredSessionTitle } from "../features/sessions/model/titleModelClient";
import { readHarnessSessionTitle } from "../integrations/harness/core/registry";
import { manualSessionTitle } from "../features/sessions/model/titlePolicy";
import {
  questionFollowUp,
  recordQuestionAnswer,
} from "../features/sessions/model/questionHistory";
import { persistManualSessionTitle } from "../features/sessions/data/sessionStore";
import { acceptQuickLaunch } from "./model/quickLaunchSession";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import { usePageNavigation, type PageDestination } from "./hooks/usePageNavigation";
import { useMouseHistoryNavigation } from "./hooks/useMouseHistoryNavigation";
import { useIdleSessionDetach } from "./hooks/useIdleSessionDetach";
import { useEmptySessionCleanup } from "./hooks/useEmptySessionCleanup";
import {
  isDisposableEmptySession,
  pendingNewSessionDraft,
  tabHasSessionResources,
} from "./model/emptySessionCleanup";
import { HarnessEventQueue } from "./model/harnessFlush";
import {
  handleAgentApp,
  type AppSessionListing,
  type AppSessionPlacement,
} from "../features/agent-app/model/agentApp";
import { submitWithSettlement } from "./model/managedSubmission";
import {
  submitAfterProjectSync,
  type SubmissionAcceptance,
} from "./model/submissionAcceptance";
import type { CiRepairRequest } from "../features/inbox/model/ciRepair";
import { ciRepairSessions } from "../features/inbox/model/ciRepairSessions";
import {
  rebaseCiRepairs,
  trackCiRepair,
} from "../features/inbox/model/ciRepairTracking";
import { invoke } from "@tauri-apps/api/core";
import {
  orchestrationCheckoutCwd,
  orchestrationProjectCwd,
  orchestrator,
  shellPath,
  workspaceIdentity,
  type ControlOutcome,
} from "../features/orchestration/model/orchestration";
import { modelsFor } from "../features/sessions/model/models";
import { isHarnessAvailable } from "../integrations/harness/core/availability";
import {
  completeOrchestrationProposal,
  completeOrRepairOrchestrationProposal,
  orchestrationPlanningPrompt,
  orchestrationRepairPrompt,
  proposalBlock,
  withOrchestrationProposal,
  type OrchestrationProposal,
} from "../features/orchestration/model/orchestrationPlan";
import { discoverOrchestrationSettings } from "../features/orchestration/model/orchestrationCatalog";
import { hostOrchestrationClient } from "../features/orchestration/model/orchestrationClient";
import { loadRemoteSession } from "../features/connections/model/connections";
import {
  attachOrchestrationWorkers,
  consolidateOrchestrationTabs,
  prepareOrchestrationWorkerDetails,
  releaseOrchestrationWorker,
} from "../features/orchestration/model/orchestrationWorkspace";
import {
  OrchestrationActions,
  OrchestrationWorkers,
  type OrchestrationWorkerDetail,
} from "../features/orchestration/ui/OrchestrationActions";
import { flushSync } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
} from "react";
import { Sidebar } from "./shell/Sidebar";
import { SidebarRail } from "./shell/SidebarTransition";
import { SidebarMain } from "./shell/SidebarMain";
import { ApprovalToasts } from "../features/sessions/ui/ApprovalToasts";
import { HarnessUpdateNotice } from "../features/providers/ui/HarnessUpdateNotice";
import { WhatsNewDialog } from "./shell/WhatsNewDialog";
import { ProviderSignInDialog } from "../features/sessions/ui/ProviderSignInDialog";
import { WindowDragBar, WINDOW_DRAG_BAR_HEIGHT } from "./shell/WindowChrome";
import { LAYER } from "../shared/lib/layers";
import { TitlebarNavigation } from "./shell/TitlebarNavigation";
import { MENU_BAR_HEIGHT, MenuBar } from "./shell/MenuBar";
import {
  commandShortcutLabel,
  HELP_URLS,
  paletteCommands,
  type CommandHandlers,
} from "./commands/registry";
import { useCommandDispatcher } from "./commands/useCommandDispatcher";
import { QuickOpen } from "../features/search/ui/QuickOpen";
import { conversationRowsFrom } from "../features/search/model/appSearch";
import {
  DeleteSessionDialog,
  type SessionDeleteChoice,
} from "../features/sessions/ui/DeleteSessionDialog";
import {
  type WorktreeFocus,
  useWorktreeFocus,
  worktreeFocus,
} from "../features/source-control/model/worktreeFocus";
import {
  assertWorktreeFilesClosed,
  createOrchestrationWorktree,
  createWorktree,
  detachSessionWorktree,
  checkWorktreeRemoval,
  listWorktrees,
  orchestrationWorktreeBranchName,
  removeOrchestrationBranch,
  removeOrchestrationWorktree,
  removeWorktree,
  sessionInWorktree,
  worktreeSessionIds,
  type Worktree,
} from "../features/source-control/model/worktrees";
import { createTaskWorktree } from "../features/source-control/model/taskWorktree";
import {
  anchorWorktreeCreation,
  appendWorktreeCreationLog,
  completeWorktreeCreation,
  failWorktreeCreation,
  foldWorktreeCreation,
  persistWorktreeCreation,
  startWorktreeCreation,
  WORKTREE_CREATION_FOLD_MS,
} from "../features/source-control/model/worktreeCreation";
import { useProjectBranches } from "../features/source-control/hooks/useProjectBranches";
import { useInboxActivity } from "../features/inbox/hooks/useInboxUnseen";
import {
  loadSessionSidebarOpen,
  saveSessionSidebarOpen,
  type SidebarTabId,
} from "../features/settings/model/appearance";
import {
  loadProjectSidebarTab,
  saveProjectSidebarTab,
} from "../features/settings/model/projectSidebarTab";
import { HAS_NATIVE_GLASS, IS_MAC } from "../platform/tauri/platform";
import {
  applyUiScale,
  loadUiScale,
  saveUiScale,
  UI_SCALE_DEFAULT,
  zoomInUiScale,
  zoomOutUiScale,
} from "../features/settings/model/uiScale";
import { resolveZoomKeybinding } from "../features/settings/model/zoomKeybinding";
import { resolveAppShortcut } from "../features/settings/model/appShortcuts";
import { readAppVersion, runUpdateFlow } from "./model/updater";
import {
  displayAttachments,
  prepareAttachments,
} from "../features/sessions/model/attachments";
import {
  basename,
  notifyGitChanged,
  pickFolders,
  type GitFileDiffKind,
  type GitHistoryCommit,
} from "../platform/tauri/fs";
import {
  invalidateProjectFiles,
  prefetchProjectFiles,
  rememberOpenedFile,
  resolveFileOpenRequest,
  resolveOpenablePath,
} from "../features/files/model/fileIndex";
import {
  closeLeaf,
  closeSurfacePanes,
  findSurfacePane,
  firstLeafId,
  focusedFileTab,
  isolateTerminalPanes,
  appViewTitle,
  APP_PAGE_KINDS,
  isAppPageKind,
  type AppPageKind,
  isAppViewOnlyTab,
  openSessionAppView,
  openAppViewTab,
  type AppViewKind,
  isFilesystemTab,
  isCommitTab,
  leaf,
  leafIds,
  movePane,
  neighborLeafId,
  newFileTab,
  newPlanTab,
  newTab,
  newTerminalFile,
  newTerminalWorkspaceTab,
  nextTerminalTitle,
  openChangesTab,
  openCommitTab,
  newAgentTab,
  newWorkflowAgentTab,
  newWorkflowRunTab,
  openEditorTab,
  openSessionChangesTab,
  pinEditorFile,
  openTerminalTab,
  removePane,
  resetTabToSession,
  replaceLeafId,
  setSplitRatio,
  siblingLeafId,
  splitPane,
  surfacePanes,
  updateTerminalTab,
  withSurfacePanes,
  type EditorPane,
  type FilePaneTab,
  type FocusDir,
  type PaneEdge,
  type SplitDir,
  type WorkspaceTab,
} from "../features/workspace/model/layout";
import { releaseNotesForVersion } from "./model/releaseNotes";
import { orderByIds } from "../shared/lib/reorder";
import {
  addTerminalToDock,
  closeTerminalInDock,
  createProjectTerminal,
  findProjectTerminal,
  mapProjectTerminal,
  moveDockToPane,
  movePaneToDock,
  nextDockTerminalTitle,
  patchProjectTerminals,
  reorderDockTerminals,
  selectDockTerminal,
  withDockOpen,
  withDockSide,
  withDockSize,
  type DockSide,
  type ProjectTerminalDock as ProjectTerminal,
} from "../features/projects/model/projectTerminal";
import {
  insertTabBesideActive,
  removeTabFromGroup,
  tabGroupProject,
} from "../features/workspace/model/tabGroups";
import { type WindowTransferPayload } from "./model/windowTransfer";
import {
  confirmCloseTerminal,
  confirmCloseTerminals,
} from "../features/terminal/model/terminalClose";
import {
  newTerminalCwd,
  type TerminalMetaPatch,
} from "../features/terminal/model/terminalTab";
import {
  applyHarnessEvent,
  applyHarnessEvents,
  appendUser,
  appendSteerUser,
  bindHarnessSession,
  cancelHarnessTurn,
  canCompactHarnessContext,
  canRewindHarnessLastTurn,
  canSteerHarness,
  compactHarnessContext,
  rewindHarnessLastTurn,
  forgetHarnessSession,
  isLiveHarness,
  latestTurnNeedsHarnessLogin,
  probeHarnessAvailability,
  refreshHarnessCatalogs,
  registerBuiltinHarnesses,
  promoteLastAssistantToPlan,
  respondHarnessApproval,
  respondHarnessQuestion,
  keepHarnessQuestionOpen,
  runHarnessTextPrompt,
  sendHarnessTurn,
  steerHarnessTurn,
  startHarnessBridge,
  stopHarnessSession,
  stopHarnessTextPrompts,
  stopStreaming,
  pickTextHarness,
  type ApprovalDecision,
  type HarnessEvent,
  type UserQuestionReply,
} from "../integrations/harness";
import { supportsHarnessLogin } from "../integrations/harness/core/authSupport";
import {
  appendPreparingHandoff,
  appendReadyHandoff,
  buildDeterministicHandoff,
  buildHandoffComposerCard,
  chooseHandoffBrief,
  completeHandoff,
  consumeHandoff,
  HANDOFF_TITLE,
  handoffTurnCard,
  isPreparingHandoff,
  pendingHandoff,
  planComposerSwitch,
  sessionChildHarnesses,
  sessionThroughTurn,
  shouldAskOutgoingAgent,
  type HandoffComposerCard,
  userMessagesAfterHandoff,
  wrapHandoffPrompt,
} from "../features/sessions/model/handoff";
import { requestOutgoingHandoff } from "../features/sessions/model/handoffTurn";
import {
  applyBtwHarnessEvent,
  btwTurnHarness,
  buildBtwPrompt,
  replaceBtwThread,
  sealBtwResponseBlocks,
  supportsBtwHarness,
} from "../features/sessions/model/btw";

import { isEditTool } from "../integrations/harness/core/preview";
import {
  createEditedResendAttempt,
  createEditedResendCoordinator,
} from "../features/sessions/model/editLastTurn";
import {
  beginSessionTurn,
  applySessionCheckpoint,
  captureSessionCheckpoint,
  forgetSessionCheckpoint,
  flushSessionCheckpoint,
  keepSessionChanges,
  notifyReviewChanged,
  prepareSessionCheckpoint,
  sessionCheckpointCleanupSafe,
} from "../features/sessions/model/checkpoint";
import { notifyDirsChanged } from "../features/files/model/fileTree";
import {
  invalidateWatchedFiles,
  nudgeWatchedFiles,
} from "../features/files/model/fileWatch";
import {
  type EditorNavigationTarget,
  type OpenFileFn,
} from "../features/search/model/search";
import {
  defaultSessionChoice,
  mergeModelSettings,
  nativeModelId,
  preferredModelSettings,
  resolveModel,
  saveLastModelSettings,
  saveRecentModelChoice,
} from "../features/sessions/model/models";

import {
  buildPlanPrompt,
  isProviderFailureText,
  planTitle,
  planTurnKey,
  planTurnPrompt,
} from "../features/sessions/model/plan";
import {
  displayPath,
  isEqualOrInside,
  pathKey,
  projectName,
  rebasePath,
  resolveWorkspacePath,
} from "../shared/lib/paths";
import {
  rebaseProjectData,
  removeProjectData,
} from "../features/projects/model/projectData";
import {
  forgetProjectLocation,
  rememberProjectLocation,
  synchronizeProjectLocation,
} from "../features/projects/model/projectLocation";
import {
  archiveProject,
  forgetProject,
  lastProjectPath,
  loadRecents,
  isLocalProject,
  isRemoteProjectPath,
  looksLikeProject,
  normalizeProjectPath,
  projectRailItems,
  rememberProject,
  replaceProjectPath,
  sameProjectPath,
} from "../features/projects/model/recents";
import {
  applyPlaceSessionOnPane,
  filterTabsForProject,
  findOpenSessionTab,
  planWorkspaceTabClose,
  workspaceTabCwd,
  workspaceTabWorktree,
  focusedWorkspaceTabCwd,
} from "../features/workspace/model/workspaceTabGroups";
import { anchorSessionId } from "../features/workspace/model/sessionColumns";
import { AppViewDialog } from "../features/workspace/ui/AppViewDialog";
import {
  SessionHeaderActionsContext,
  type SessionHeaderActions,
} from "../features/workspace/ui/SessionHeaderActions";
import { applyAddToChatRequest } from "../features/sessions/model/addChatToWorkspace";
import { newWorkspaceSession } from "./model/newWorkspaceSession";
import {
  ADD_TO_CHAT_EVENT,
  requestAddToChat,
  type AddToChatRequest,
} from "../features/sessions/model/quoteDraft";
import { createSessionRemover } from "../features/sessions/model/sessionRemoval";
import { installNativeSessionSync } from "../features/sessions/data/nativeSessions";
import {
  providerAccountExists,
  selectedProviderAccountId,
  conversationProviderAccountId,
  supportsProviderAccounts,
  type ProviderAccountProvider,
} from "../features/providers/model/providerAccounts";
import {
  HARNESSES,
  HARNESS_LABEL,
  HARNESS_TITLE,
  canReplaceSessionTitle,
  formatSessionTitle,
  isReusableDraftSession,
  sessionNeedsInput,
  newDefaultSession,
  newSession,
  retargetSessionToProject,
  removeSessionDraft,
  sessionDisplayTitle,
  sessionDraftBlock,
  sessionWorkCwd,
  titleFromPrompt,
  type Attachment,
  type Block,
  type BtwThread,
  type ComposerTurnOptions,
  type HarnessId,
  type LinkedWorkItem,
  type ModelTarget,
  type PlanBuildTarget,
  type RuntimeMode,
  type PlanStatus,
  type SecondOpinionMeta,
  type Session,
  type UsageLimit,
  type WorkspaceMode,
} from "../features/sessions/model/session";

import {
  canDispatchQueuedHead,
  dequeueQueuedMessage,
  queuedMessageForSubmit,
} from "../features/sessions/model/messageQueue";
import {
  USAGE_LIMIT_RESUME_GRACE_MS,
  usageLimitResumeDue,
} from "../features/sessions/model/usageLimit";
import {
  fetchClaudeRateLimits,
  fetchCodexRateLimits,
} from "../features/providers/model/rateLimitsFetch";
import { exhaustedWindowResetAt } from "../features/providers/model/rateLimits";
import { dropContextWindow } from "../features/sessions/model/contextUsage";
import {
  discardDraftSessionRecord,
  deleteSession,
  getSession,
  listLinkedSessions,
  listSessionsByProject,
  persistFingerprint,
  rebaseProjectSessions,
  replaceInFlightSessions,
  saveWorkspaceSnapshot,
  setSessionArchived,
  setSessionLinkedWorkItem,
  setSessionPinned,
  shouldPersistSession,
  upsertSession,
  flushSessionWrites,
  type SessionSummary,
} from "../features/sessions/data/sessionStore";
import { rememberLoadedSession } from "../features/sessions/data/sessionCache";
import {
  TranscriptPool,
  TranscriptPoolOutlet,
} from "../features/sessions/ui/TranscriptPool";
import { syncDockBadge } from "../features/notifications/model/dockBadge";
import { liveAgentsFromSessions } from "../features/sessions/model/liveAgents";
import { hiddenApprovalNotices } from "../features/notifications/model/approvalToast";
import { useSessionReminders } from "../features/notifications/hooks/useSessionReminders";
import { ReminderNotices } from "../features/sessions/ui/ReminderNotices";
import { useUnseenFinishedSessions } from "../features/sessions/hooks/useUnseenFinishedSessions";
import { useStableSummaries } from "../features/sessions/hooks/useStableSummaries";
import {
  loadNotificationsEnabled,
  NOTIFICATION_CLICK_EVENT,
  announceSessionFinished,
  probeNotificationPermission,
  setWindowFocused,
} from "../features/notifications/model/notifications";
import { useInputNotifications } from "../features/notifications/hooks/useInputNotifications";
import { archiveFocusedSession } from "../features/sessions/model/archiveShortcut";
import {
  adjacentItemId,
  deferUnhandledEscape,
  focusedBusyAgentSessionId,
  shouldHandleListNavigation,
  shouldStopFocusedTurnOnEscape,
  tabCommand,
  tabCommandForKeybinding,
  tabCommandKeybinding,
} from "../features/workspace/model/tabKeys";
import { preparePrompt } from "../features/sessions/model/promptPreparation";
import {
  consumeOperatorCommand,
  operatorEnabledInThread,
} from "../features/sessions/model/operatorCommand";
import {
  warmNativeSkills,
  isNativeCommandPrompt,
} from "../features/skills/model/skills";
import { nativeSkillContextForSession } from "../features/sessions/model/sessionSkills";
import {
  ADD_NOTE_TO_CHAT_EVENT,
  NOTES_CHANGED_EVENT,
  composeNoteMessage,
  loadNotes,
  noteCardMeta,
  upsertNote,
  type NoteComposerCard,
} from "../features/notes";
import {
  claimDueAutomations,
  listAutomations,
  recoverAutomationRuns,
  updateAutomationRun,
  type Automation,
  type AutomationRun,
} from "../features/automations/model/automations";
import { useQuickComposerLaunches } from "../features/quick-composer/hooks/useQuickComposerLaunches";
import type { QuickLaunch } from "../features/quick-composer/model/quickComposer";
import { claimInboxAutomationRuns } from "../features/automations/model/automationEvents";
import {
  SECOND_OPINION_TITLE,
  buildSecondOpinionRequest,
  harnessForTurn,
  turnEditedFiles,
  turnUserRequest,
} from "../features/sessions/model/secondOpinion";

import { PaneTree } from "../features/workspace/ui/PaneTree";
import { SessionSurfaceActions } from "../features/workspace/ui/SessionSurfaceToolbar";
import { SessionPane } from "../features/sessions/ui/SessionPane";
import { SessionSurface } from "../features/sessions/ui/SessionSurface";
import { TerminalDockLayout } from "./shell/TerminalDockLayout";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import { SurfaceVisibilityContext } from "../shared/ui/SurfaceVisibility";
import { lazySurface } from "../shared/ui/lazySurface";
import { preloadRemoteSession } from "../features/connections/ui/RemoteSession";
import { preloadNavigationWhenIdle } from "./model/preloadNavigation";
import { requestTranscriptJump } from "../features/sessions/model/transcriptJump";
import type { SettingsAnchor } from "../features/settings/ui/SettingsView";
import {
  OPEN_CONNECTIONS_EVENT,
  OPEN_REMOTE_PROJECT_EVENT,
  REMOTE_HISTORY_UPDATED,
  cachedRemoteSessionSummary,
  knownRemoteMachine,
  prefetchRemoteProjectSessions,
  rememberRemotePendingWorktree,
  rememberRemoteSession,
  remotePendingWorktree,
  remoteTabCwd,
  remoteSessionFor,
} from "../features/connections/model/connections";
import {
  buildRemotePlan,
  remoteSessionActions,
} from "../features/connections/model/remoteSessionActions";
import { remoteSessionState } from "../features/connections/model/remoteSessionState";
import {
  remotePath,
  remoteProjectFor,
  sessionUsesHost,
  remoteSessionGitCwd,
} from "../features/connections/model/remoteProjects";
import type { HostSession } from "../features/connections/model/protocol";
import { AddRemoteProjectDialog } from "../features/connections/ui/AddRemoteProjectDialog";
import type { ConnectableInboxSource } from "../features/inbox/model/inboxFilters";
import type { InboxSessionPortal } from "../features/inbox/ui/InboxDiscussionPanel";
import { inboxAskKey, inboxAskPrompt } from "../features/inbox/model/inboxAsk";
import {
  githubWorkItemThread,
  inboxComposerCard,
  type InboxItem,
} from "../features/inbox/model/githubTasks";
import {
  linkedWorkItemFromAutomationEvent,
  linkedWorkItemFromInboxItem,
  resolveLinkedWorkItem,
} from "../features/sessions/model/sessionWorkItem";
import {
  completeLinkedWorkItemUpdateCard,
  failLinkedWorkItemUpdateCard,
  pendingLinkedWorkItemUpdateCard,
  type LinkedWorkItemUpdateCard,
} from "../features/inbox/model/linkedWorkItemActivity";
import type { LinkedSessionUpdate } from "../features/inbox/model/linkedSessionUpdates";
import { markLinkedSessionUpdateSeen } from "../features/inbox/model/linkedSessionSeen";
import { inboxTrackerDescription } from "../features/inbox/model/inboxContext";
import {
  gitlabWorkItemDetails,
  peekGitlabWorkItemDetails,
} from "../features/inbox/model/gitlab";
import {
  azureDevOpsWorkItemDetails,
  peekAzureDevOpsWorkItemDetails,
} from "../features/inbox/model/azureDevOps";
import {
  loadCloseToTray,
  loadAutosave,
  loadFileTabMode,
  loadLiveAgentsEnabled,
  loadNotesEnabled,
  loadDiffViewer,
  loadFollowUpBehavior,
  loadKeybindingOverrides,
  loadMenuBarVisible,
  loadSettingsSection,
  keybindingPressed,
  matchCustomKeybinding,
  saveSettingsSection,
  saveAutosave,
  saveMenuBarVisible,
  subscribeAutosave,
  subscribeKeybindings,
  subscribeLiveAgentsEnabled,
  subscribeMenuBarVisible,
  subscribeNotesEnabled,
  type SettingsSectionId,
  type FollowUpBehavior,
} from "../features/settings/model/settings";
import {
  handleEditorFindKey,
  openFindInActiveEditor,
  openReplaceInActiveEditor,
} from "../features/files/editor/editorSearch";

import {
  mergeHistorySummary,
  mergeProjectHistorySummary,
  replaceProjectHistory,
  historyWithLiveSessions,
  allProjectHistoryWithLiveSessions,
  summaryFromSession,
  sidebarLiveSessions,
} from "../features/sessions/data/sessionHistory";
import {
  CONTINUE_PROMPT,
  canAutoContinue,
  inFlightRefs,
  inFlightSnapshotKey,
  shouldWriteInFlightSnapshot,
} from "../features/sessions/model/inFlight";
import {
  isBlankSession,
  reconcileProjectReturn,
  type ProjectReturnMemory,
} from "../features/projects/model/projectReturn";
import {
  planProjectOpenRun,
  type ProjectOpenStep,
} from "../features/projects/model/projectOpenRun";
import {
  collectWorkspaceSnapshot,
  workspaceSnapshotKey,
} from "../features/workspace/model/workspaceSnapshot";
import type { InstalledUpdate } from "./model/updateNotice";
import {
  bindResumedSessions,
  closeBusyWindow,
  closeCurrentWindow,
  confirmReload,
  hasInFlightSessions,
  hideCurrentWindow,
  isAppQuitting,
  persistLiveTranscripts,
  persistQuitState,
  reapWindowRuntime,
  setQuitWorkspace,
  type ResumedWorkspace,
} from "./model/appLifecycle";

const SearchView = lazySurface(
  async () => {
    const module = await import("../features/search/ui/SearchView");
    return { default: module.SearchView };
  },
  { suspense: false },
);
const SettingsView = lazySurface(
  async () => {
    const module = await import("../features/settings/ui/SettingsView");
    return { default: module.SettingsView };
  },
  { suspense: false },
);
const InboxView = lazySurface(
  async () => {
    const module = await import("../features/inbox/ui/InboxView");
    return { default: module.InboxView };
  },
  { suspense: false },
);
const LinkedWorkItemPanel = lazySurface(async () => {
  const module = await import("../features/inbox/ui/InboxView");
  return { default: module.LinkedWorkItemPanel };
});
const NotesView = lazySurface(
  async () => {
    const module = await import("../features/notes/ui/NotesView");
    return { default: module.NotesView };
  },
  { suspense: false },
);
const AutomationsView = lazySurface(
  async () => {
    const module = await import("../features/automations/ui/AutomationsView");
    return { default: module.AutomationsView };
  },
  { suspense: false },
);

type LinkedWorkItemPanelState = {
  item: LinkedWorkItem;
  sessionId: string;
  cwd: string;
};

type SubmitOptions = ComposerTurnOptions & {
  ciRepair?: CiRepairRequest;
  /** Saved alongside the user turn; does not replace the submitted prompt. */
  ciContext?: string;
  secondOpinion?: SecondOpinionMeta;
  followUpBehavior?: FollowUpBehavior;
  noteCard?: NoteComposerCard;
  handoffCard?: HandoffComposerCard;
  queuedMessageId?: string;
  planBlockId?: string;
  buildTarget?: PlanBuildTarget;
  managed?: boolean;
  orchestrationRetry?: OrchestrationProposal;
  appRequestId?: string;
  onSettled?: (outcome: ControlOutcome) => void;
  /** Generate a fresh title even when this is not the session's first turn. */
  refreshTitle?: boolean;
  /** Internal guard for the retry after resolving a renamed project. */
  projectLocationReady?: boolean;
};

type Submit = (
  sessionId: string,
  text: string,
  attachments?: Attachment[],
  options?: SubmitOptions,
) => SubmissionAcceptance;

function withPlanStatus(
  session: Session,
  blockId: string,
  status: PlanStatus,
): Session {
  return {
    ...session,
    blocks: session.blocks.map((block) =>
      block.id === blockId && block.role === "plan"
        ? {
            ...block,
            plan: { ...(block.plan ?? { status: "ready" }), status },
          }
        : block,
    ),
  };
}

function lastAssistantTextInTurn(session: Session): string {
  for (let index = session.blocks.length - 1; index >= 0; index -= 1) {
    const block = session.blocks[index];
    if (block.role === "user") return "";
    if (block.role === "assistant" && block.text.trim()) return block.text;
  }
  return "";
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function sameWorktreeTabStats(
  a: ReadonlyMap<string, { tabs: number; busy: boolean }>,
  b: ReadonlyMap<string, { tabs: number; busy: boolean }>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, entry] of a) {
    const other = b.get(key);
    if (!other || other.tabs !== entry.tabs || other.busy !== entry.busy) {
      return false;
    }
  }
  return true;
}

function userTurnCards(
  noteCard: NoteComposerCard | undefined,
  secondOpinion?: SecondOpinionMeta,
) {
  if (!noteCard && !secondOpinion) return undefined;
  return {
    ...(secondOpinion ? { secondOpinion } : {}),
    ...(noteCard ? { noteCard: noteCardMeta(noteCard) } : {}),
  };
}

function withHarnessChoice(
  session: Session,
  harness: HarnessId,
  model: string,
  modelSettings: Record<string, string>,
): Session {
  return {
    ...session,
    pendingConfiguration: undefined,
    harness,
    model,
    modelSettings,
    title:
      session.blocks.length === 0
        ? HARNESS_LABEL[harness]
        : formatSessionTitle(
            harness,
            sessionDisplayTitle(session.title, session.harness),
          ),
    ...(session.model === model
      ? {}
      : { context: dropContextWindow(session.context) }),
    ...(session.harness === harness
      ? {}
      : { providerSessionId: undefined, providerAccountId: undefined }),
  };
}

function withPlanBuildTarget(
  session: Session,
  target: PlanBuildTarget,
): Session {
  const resolved = resolveModel(target.harness, target.model);
  const modelSettings = mergeModelSettings(resolved, target.modelSettings);
  const plan = planComposerSwitch(session, target.harness);
  const next = withHarnessChoice(
    session,
    target.harness,
    resolved.id,
    modelSettings,
  );

  if (plan.kind === "arm") {
    return { ...next, pendingSwitch: plan.pending };
  }
  if (plan.kind === "revert") {
    return {
      ...next,
      pendingSwitch: undefined,
      ...(plan.restoreProviderSessionId
        ? { providerSessionId: plan.restoreProviderSessionId }
        : { providerSessionId: undefined }),
      ...(plan.restoreProviderAccountId
        ? { providerAccountId: plan.restoreProviderAccountId }
        : { providerAccountId: undefined }),
    };
  }
  if (plan.kind === "empty") {
    return { ...next, pendingSwitch: undefined };
  }
  return next;
}

/** App views that open as a dialog instead of a workspace pane. */
const DIALOG_APP_VIEWS: ReadonlySet<AppViewKind> = new Set<AppViewKind>([
  "settings",
  "search",
]);

function openSessionIds(tabs: WorkspaceTab[]): Set<string> {
  const ids = new Set<string>();
  for (const tab of tabs) {
    for (const id of leafIds(tab.layout)) ids.add(id);
  }
  return ids;
}

/** Quiet period before session saves, and the longest a dirty session waits. */
const PERSIST_DEBOUNCE_MS = 650;
const PERSIST_MAX_WAIT_MS = 5_000;

function filesInWorkspaceTabs(tabs: readonly WorkspaceTab[]): FilePaneTab[] {
  return tabs.flatMap((tab) => [
    ...tab.editorPanes.flatMap((pane) => pane.files),
    ...(tab.terminalPanes ?? []).flatMap((pane) => pane.files),
  ]);
}

/** Native sheet. `window.confirm` is swallowed when a macOS menu accelerator fires. */
function confirmDiscardUnsaved(message: string): Promise<boolean> {
  return ask(message, { title: "MonoCode", kind: "warning" });
}

// Register capabilities before composer hooks choose their discovery strategy.
registerBuiltinHarnesses();

type AppProps = {
  windowTransfer?: WindowTransferPayload | null;
  resumed?: ResumedWorkspace | null;
  installedUpdate?: InstalledUpdate | null;
  history?: SessionSummary[];
  historyCwd?: string | null;
};

/** The worktree a project's workspace currently shows. */
function currentWorkspace(project: string): string {
  return worktreeFocus(project)?.path ?? project;
}

export default function App(props: AppProps) {
  return (
    <Suspense fallback={null}>
      <Workspace {...props} />
    </Suspense>
  );
}

function Workspace({
  windowTransfer = null,
  resumed = null,
  installedUpdate = null,
  history: bootHistory = [],
  historyCwd: bootHistoryCwd = null,
}: AppProps) {
  useTranslation();
  const [projectCwd, setProjectCwd] = useState(
    () =>
      windowTransfer?.projectCwd ??
      resumed?.projectCwd ??
      lastProjectPath() ??
      "~",
  );
  const [recents, setRecents] = useState(() =>
    resumed?.projectCwd && looksLikeProject(resumed.projectCwd)
      ? rememberProject(resumed.projectCwd)
      : loadRecents(),
  );
  const [seed] = useState(() => {
    const cwd = lastProjectPath() ?? "~";
    const session = newDefaultSession(cwd);
    const tab = newTab(session.id);
    return { session, tab };
  });
  const [sessions, setSessions] = useState<Session[]>(
    () => windowTransfer?.sessions ?? resumed?.sessions ?? [seed.session],
  );
  const [sessionDeleteDialog, setSessionDeleteDialog] = useState<{
    title: string;
    unusedWorktree: string;
    resolve: (choice: SessionDeleteChoice) => void;
  }>();
  const switchingWorktrees = useRef(new Map<string, string>());
  const removingWorktreePaths = useRef(new Set<string>());
  const deleteConfirmationPending = useRef(false);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(
    () => windowTransfer?.tabs ?? resumed?.tabs ?? [seed.tab],
  );
  const [projectTerminals, setProjectTerminals] = useState<ProjectTerminal[]>(
    () => windowTransfer?.projectTerminals ?? resumed?.projectTerminals ?? [],
  );
  /** Dock side a brand-new project's terminal starts with, persisted in the workspace snapshot. */
  const [lastDockSide, setLastDockSide] = useState<DockSide | null>(
    () => resumed?.lastDockSide ?? null,
  );
  const lastDockSideRef = useRef(lastDockSide);
  lastDockSideRef.current = lastDockSide;
  const [projectTerminalFocused, setProjectTerminalFocused] = useState(false);
  const [activeTabId, setActiveTabIdState] = useState(
    () => windowTransfer?.activeTabId ?? resumed?.activeTabId ?? seed.tab.id,
  );
  const [composerFocused, setComposerFocused] = useState(() => {
    if (windowTransfer) return true;
    if (!resumed) return false;
    const tab =
      resumed.tabs.find((entry) => entry.id === resumed.activeTabId) ??
      resumed.tabs[0];
    return (
      !!tab && resumed.sessions.some((session) => session.id === tab.focusedId)
    );
  });
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  /** Tab id -> project name, kept in sync with the rendered title tabs. */
  const tabProjectsRef = useRef(new Map<string, string>());
  const projectOfTab = useCallback(
    (id: string) => tabProjectsRef.current.get(id),
    [],
  );
  const [sessionSidebarOpen, setSessionSidebarOpen] = usePreferenceState(
    loadSessionSidebarOpen,
  );
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const onToggleNavigation = useCallback(
    () => setNavigationExpanded((expanded) => !expanded),
    [],
  );
  const tabCloseScope = "project" as const;
  const currentProjectDock = findProjectTerminal(projectTerminals, projectCwd);
  const dockVisible = !!currentProjectDock?.open;
  const [filesSearchOpen, setFilesSearchOpen] = useState(false);
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const [searchViewFocusToken, setSearchViewFocusToken] = useState(0);
  const [appPage, setAppPage] = useState<AppPageKind | null>(null);
  const closeAppPage = useCallback(() => {
    setAppPage(null);
    setComposerFocused(true);
  }, []);
  const [linkedWorkItemPanels, setLinkedWorkItemPanels] = useState<
    ReadonlyMap<string, LinkedWorkItemPanelState>
  >(() => new Map());
  const linkedWorkItemPanelRequest = useRef(0);
  const closeLinkedWorkItemPanel = useCallback((sessionId: string) => {
    linkedWorkItemPanelRequest.current += 1;
    setLinkedWorkItemPanels((current) => {
      if (!current.has(sessionId)) return current;
      const next = new Map(current);
      next.delete(sessionId);
      return next;
    });
  }, []);
  const [inboxAskPortal, setInboxAskPortal] =
    useState<InboxSessionPortal | null>(null);
  const openingInboxSessions = useRef(new Map<string, Promise<string>>());
  const [inspectedWorkerId, setInspectedWorkerId] = useState<string | null>(
    null,
  );
  // Set while the lead's tab is still opening; the agent tab lands on the
  // commit that brings it in.
  const [workerDetailRequest, setWorkerDetailRequest] = useState<{
    leadId: string;
    workers: OrchestrationWorkerDetail[];
  } | null>(null);
  const nativeOrchestrationRuns = useSyncExternalStore(
    orchestrator.subscribe,
    orchestrator.snapshot,
    orchestrator.snapshot,
  );
  const hostOrchestrationRuns = useSyncExternalStore(
    hostOrchestrationClient.subscribe,
    hostOrchestrationClient.snapshot,
    hostOrchestrationClient.snapshot,
  );
  const orchestrationRuns = useMemo(
    () => [...nativeOrchestrationRuns, ...hostOrchestrationRuns],
    [nativeOrchestrationRuns, hostOrchestrationRuns],
  );
  const notesEnabled = useSyncExternalStore(
    subscribeNotesEnabled,
    loadNotesEnabled,
    () => true,
  );
  const liveAgentsEnabled = useSyncExternalStore(
    subscribeLiveAgentsEnabled,
    loadLiveAgentsEnabled,
    () => true,
  );
  const menuBarPinned =
    useSyncExternalStore(subscribeMenuBarVisible, loadMenuBarVisible) &&
    !IS_MAC;
  const [updateNotice, setUpdateNotice] = useState(installedUpdate);
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);
  const [providerSignInRequest, setProviderSignInRequest] = useState<{
    key: string;
    sessionId: string;
    harness: HarnessId;
  } | null>(null);
  const seenProviderSignInRequestsRef = useRef<Set<string> | null>(null);
  const seenProviderSignInRequests =
    seenProviderSignInRequestsRef.current ??
    (seenProviderSignInRequestsRef.current = new Set(
      sessions.flatMap((session) => {
        if (
          !supportsHarnessLogin(session.harness) ||
          !latestTurnNeedsHarnessLogin(session.blocks)
        ) {
          return [];
        }
        return [providerSignInRequestKey(session)];
      }),
    ));
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>(loadSettingsSection);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(
    null,
  );
  const [notificationProjectPath, setNotificationProjectPath] = useState<
    string | null
  >(null);
  const [notificationSettingsRequest, setNotificationSettingsRequest] =
    useState(0);
  const [editorNavigations, setEditorNavigations] = useState<
    Record<
      string,
      {
        ownerSessionId?: string;
        target: EditorNavigationTarget;
      }
    >
  >({});
  const editorNavigationToken = useRef(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteToken, setPaletteToken] = useState(0);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(
    () => new Set(windowTransfer?.dirtyFileIds ?? []),
  );
  // Not carried across a window transfer the way dirty state is: the editor
  // re-lints whatever it mounts, so the counts rebuild themselves.
  const [fileErrorCounts, setFileErrorCounts] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [history, setHistory] = useState<SessionSummary[]>(() => bootHistory);
  const [, refreshRemoteTabTitles] = useState(0);
  useEffect(() => {
    const updated = () => refreshRemoteTabTitles((value) => value + 1);
    window.addEventListener(REMOTE_HISTORY_UPDATED, updated);
    return () => window.removeEventListener(REMOTE_HISTORY_UPDATED, updated);
  }, []);
  const [storedLinkedSessions, setStoredLinkedSessions] = useState<
    SessionSummary[]
  >(() => bootHistory.filter((session) => session.linkedWorkItem));
  /**
   * Projects whose rows are already in `history`. This has to be state, not a
   * ref: `sidebarCwd` is derived during render, so the frame that first shows
   * a new project must already know the listing has not arrived yet.
   */
  const btwRequestsRef = useRef(
    new Map<string, { sessionId: string; controller: AbortController }>(),
  );
  const [loadedProjects, setLoadedProjects] = useState<ReadonlySet<string>>(
    () => (bootHistoryCwd ? new Set([pathKey(bootHistoryCwd)]) : new Set()),
  );
  /** Failures stay with their project while other tree branches load. */
  const [failedProjectPaths, setFailedProjectPaths] = useState<
    ReadonlySet<string>
  >(new Set());
  const projectHistoryLoader = useRef<ReturnType<
    typeof createProjectHistoryLoader<SessionSummary>
  > | null>(null);
  if (!projectHistoryLoader.current) {
    projectHistoryLoader.current = createProjectHistoryLoader<SessionSummary>({
      list: listSessionsByProject,
      start: (cwd) =>
        setFailedProjectPaths((previous) => {
          const key = pathKey(cwd);
          if (!previous.has(key)) return previous;
          const next = new Set(previous);
          next.delete(key);
          return next;
        }),
      success: (cwd, rows, startedAt) => {
        const fetchedIds = new Set(rows.map((row) => row.id));
        setHistory((current) => {
          // A chat persisted during this read is newer than the fetched snapshot.
          // Alias reads can return the same chat under its canonical project path.
          const changed = current.filter(
            (entry) =>
              (sameProjectPath(entry.cwd, cwd) || fetchedIds.has(entry.id)) &&
              entry.updatedAt >= startedAt,
          );
          let next = replaceProjectHistory(current, cwd, rows);
          for (const entry of changed) {
            const fetched = rows.find((row) => row.id === entry.id);
            if (!fetched || fetched.updatedAt < entry.updatedAt)
              next = mergeProjectHistorySummary(next, entry);
          }
          return next;
        });
        setLoadedProjects((previous) =>
          previous.has(pathKey(cwd))
            ? previous
            : new Set(previous).add(pathKey(cwd)),
        );
      },
      failure: (cwd) =>
        setFailedProjectPaths((previous) =>
          new Set(previous).add(pathKey(cwd)),
        ),
    });
  }

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const titleCoordinator = useRef<SessionTitleCoordinator | null>(null);
  if (!titleCoordinator.current)
    titleCoordinator.current = new SessionTitleCoordinator({
      get: (id) => sessionsRef.current.find((session) => session.id === id),
      update: (id, change) => {
        const previous = sessionsRef.current;
        const next = previous.map((session) =>
          session.id === id ? change(session) : session,
        );
        if (!next.some((session, index) => session !== previous[index])) return;
        sessionsRef.current = next;
        setSessions((current) =>
          current.map((session) =>
            session.id === id ? change(session) : session,
          ),
        );
      },
      read: readHarnessSessionTitle,
      generate: (session, message) =>
        generateConfiguredSessionTitle(session.cwd, message),
    });
  useEffect(() => () => titleCoordinator.current?.close(), []);
  const titleBindings = useRef(new Map<string, string>());
  useEffect(() => {
    const present = new Set(sessions.map((session) => session.id));
    for (const id of titleBindings.current.keys())
      if (!present.has(id)) {
        titleBindings.current.delete(id);
        titleCoordinator.current!.cancel(id);
      }
    for (const session of sessions) {
      if (!session.providerSessionId || sessionUsesHost(session)) continue;
      const binding = `${session.harness}:${session.providerAccountId ?? "default"}:${session.providerSessionId}`;
      if (titleBindings.current.get(session.id) === binding) continue;
      titleBindings.current.set(session.id, binding);
      void titleCoordinator.current!.read(session.id);
    }
  }, [sessions]);

  const linkedSessionUpdatesRef = useRef<
    ReadonlyMap<string, LinkedSessionUpdate>
  >(new Map());
  const linkedWorkItemActivityFetches = useRef(new Map<string, number>());
  const queueDispatchingRef = useRef(new Set<string>());
  const usageResumingRef = useRef(new Set<string>());
  const usageResetLookups = useRef(new WeakSet<UsageLimit>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const dirtyFilesRef = useRef(dirtyFiles);
  dirtyFilesRef.current = dirtyFiles;
  const projectTerminalsRef = useRef(projectTerminals);
  projectTerminalsRef.current = projectTerminals;
  const projectTerminalFocusedRef = useRef(projectTerminalFocused);
  projectTerminalFocusedRef.current = projectTerminalFocused;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const historyForCleanupRef = useRef(history);
  historyForCleanupRef.current = history;
  const pendingTabResources = useRef(new Map<string, number>());
  const resolveTabResource = useCallback(<T,>(tabId: string, work: Promise<T>) => {
    pendingTabResources.current.set(
      tabId,
      (pendingTabResources.current.get(tabId) ?? 0) + 1,
    );
    return work.finally(() => {
      const remaining = (pendingTabResources.current.get(tabId) ?? 1) - 1;
      if (remaining) pendingTabResources.current.set(tabId, remaining);
      else pendingTabResources.current.delete(tabId);
    });
  }, []);
  const canDiscardEmptySession = useCallback((id: string) => {
    const session = sessionsRef.current.find((entry) => entry.id === id);
    return (
      !!session &&
      isDisposableEmptySession(session) &&
      !remoteSessionFor(id) &&
      !historyForCleanupRef.current.some((entry) => entry.id === id) &&
      !tabsRef.current.some((tab) =>
        leafIds(tab.layout).includes(id) &&
        (tabHasSessionResources(tab) || pendingTabResources.current.has(tab.id)),
      )
    );
  }, []);

  const projectWorktree = useWorktreeFocus(projectCwd);
  /** Tab or session id -> the workspace it was opened or moved in. A tab
   * belongs to the workspace it was opened in, whatever worktree it runs in:
   * opening a session, or moving one from its composer, never switches the
   * workspace. Unpinned tabs (restored ones) group by their own worktree. */
  // Only the default workspace's tabs were saved, so every restored tab
  // belongs to it, including one its composer moved to a worktree.
  const [restoredPins] = useState(
    () =>
      new Map(
        tabs.flatMap((tab) => {
          const project = workspaceTabCwd(tab, sessions);
          return project && !isRemoteProjectPath(project)
            ? [[tab.id, project] as const]
            : [];
        }),
      ),
  );
  const workspacePins = useRef(restoredPins);
  const tabWorkspace = useCallback(
    (tab: WorkspaceTab, list: readonly Session[]) => {
      if (isAppViewOnlyTab(tab)) return null;
      const pinnedTab = workspacePins.current.get(tab.id);
      if (pinnedTab) return pinnedTab;
      for (const id of leafIds(tab.layout)) {
        const pinned = workspacePins.current.get(id);
        if (pinned) return pinned;
      }
      return workspaceTabWorktree(tab, list);
    },
    [],
  );
  const tabWorktreeOf = useCallback(
    (tab: WorkspaceTab) => tabWorkspace(tab, sessionsRef.current),
    [tabWorkspace],
  );
  /** Saved tabs: the app reopens on each project's default workspace, so
   * tabs from other worktrees close with it instead of piling up. */
  const keepWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      const project = workspaceTabCwd(tab, sessionsRef.current);
      if (!project || isRemoteProjectPath(project)) return true;
      const workspace = tabWorkspace(tab, sessionsRef.current);
      return !workspace || sameProjectPath(workspace, project);
    },
    [tabWorkspace],
  );

  const workspaceNavigation = useWorkspaceNavigation({
    project: projectCwd,
    activeTabId,
    tabs,
    sessions,
    pins: workspacePins.current,
    tabWorkspace,
    moveSession: (id, tree, isCurrent) =>
      onWorktreeChange(id, tree, false, isCurrent),
    activateTab: (id) => {
      if (tabsRef.current.some((tab) => tab.id === id)) {
        activateTab(id, undefined, "workspace");
      } else {
        // A newly created tab has not rendered into tabsRef yet.
        setActiveTabIdState(id);
        setComposerFocused(true);
      }
    },
    createTab: (project, focus) => createWorkspaceTab(project, focus),
    canReuseBlank: canDiscardEmptySession,
  });
  // Every ordinary tab activation supersedes an unfinished workspace request,
  // including opening a session in the same tab or selecting a project.
  const setActiveTabId = useCallback(
    (id: string) => {
      workspaceNavigation.cancel();
      setAppPage(null);
      setActiveTabIdState(id);
    },
    [workspaceNavigation.cancel],
  );

  const projectCwdRef = useRef(projectCwd);
  projectCwdRef.current = projectCwd;
  const focusedAppView = tabs.find((tab) => tab.id === activeTabId);
  const activeAppView =
    appPage ??
    (focusedAppView
      ? focusedFileTab(focusedAppView)?.appView?.kind
      : undefined);
  const appViewFocusedRef = useRef(activeAppView);
  appViewFocusedRef.current = activeAppView;
  // Settings-like views open as a dialog over the workspace.
  const [appDialog, setAppDialog] = useState<AppViewKind | null>(null);
  const appDialogRef = useRef(appDialog);
  appDialogRef.current = appDialog;
  const closeAppDialog = useCallback(() => setAppDialog(null), []);
  const appPageHostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      appPage &&
      !appDialog &&
      !appPageHostRef.current?.contains(document.activeElement)
    ) {
      appPageHostRef.current?.focus({ preventScroll: true });
    }
  }, [appPage, appDialog]);

  const workspaceVisible = appPage === null;
  const inboxVisible = appPage === "inbox" && appDialog === null;
  const foregroundSurfaceRef = useRef<{
    workspaceVisible: boolean;
    inboxSessionId?: string;
  }>({ workspaceVisible: true });
  foregroundSurfaceRef.current = {
    workspaceVisible,
    inboxSessionId: inboxVisible ? inboxAskPortal?.sessionId : undefined,
  };
  const sessionNavigationIdsRef = useRef<readonly string[]>([]);
  const sessionNavigationProjectRef = useRef<string | null>(null);
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;
  const whatsNewVersionRef = useRef(whatsNewVersion);
  whatsNewVersionRef.current = whatsNewVersion;
  useEffect(() => {
    const liveSessionIds = new Set(sessions.map((session) => session.id));
    for (const [key, request] of btwRequestsRef.current) {
      if (liveSessionIds.has(request.sessionId)) continue;
      request.controller.abort();
      btwRequestsRef.current.delete(key);
    }
  }, [sessions]);

  useEffect(
    () => () => {
      for (const request of btwRequestsRef.current.values()) {
        request.controller.abort();
      }
      btwRequestsRef.current.clear();
      void stopHarnessTextPrompts();
    },
    [],
  );

  useEffect(
    () =>
      preloadNavigationWhenIdle([
        InboxView.preload,
        LinkedWorkItemPanel.preload,
        AutomationsView.preload,
        listAutomations,
        ...(notesEnabled ? [NotesView.preload, loadNotes] : []),
      ]),
    [notesEnabled],
  );

  const projectReturnRef = useRef<ProjectReturnMemory>(
    resumed?.projectReturnMemory ?? new Map(),
  );
  const readProjectReturnMemory = useCallback(() => {
    projectReturnRef.current = reconcileProjectReturn({
      memory: projectReturnRef.current,
      tabs: tabsRef.current,
      sessions: sessionsRef.current,
      activeTabId: activeTabIdRef.current,
    });
    return projectReturnRef.current;
  }, []);
  useEffect(() => {
    readProjectReturnMemory();
  }, [activeTabId, tabs, sessions, readProjectReturnMemory]);

  const navigateHistoryRef = useRef<(destination: PageDestination) => void>(() => {});
  const tabVisitNav = usePageNavigation({
    tabs,
    activeTabId,
    page: appPage,
    dialog: appDialog,
    notesEnabled,
    navigate: (destination) => navigateHistoryRef.current(destination),
  });
  const { back: onVisitBack, forward: onVisitForward, previousTabs } = tabVisitNav;
  useMouseHistoryNavigation(onVisitBack, onVisitForward);
  const turnGen = useRef(new Map<string, number>());
  const editedResends = useRef(createEditedResendCoordinator()).current;
  const lastPersisted = useRef(new Map<string, string>());
  const lastBoundProvider = useRef(new Map<string, string>());
  const lastPersistedUserBlock = useRef(new Map<string, string>());
  const inFlightSyncKey = useRef<string | null>(null);
  const sawInFlight = useRef(false);
  const workspaceSyncKey = useRef<string | null>(null);
  const workspaceSaveTimer = useRef<number | undefined>(undefined);
  const observedSessions = useRef(new Map<string, Session>());
  const pendingPersist = useRef(new Map<string, Session>());
  const persistTimer = useRef<number | undefined>(undefined);
  const persistDirtySince = useRef<number | null>(null);
  const removingSessionIds = useRef(new Set<string>());
  const loadedSessionCache = useRef(new Map<string, Session>());
  const sessionLoads = useRef(new Map<string, Promise<Session | null>>());
  const sessionLoadEpochs = useRef(new Map<string, number>());
  const openingSessionIds = useRef(new Set<string>());
  const activeSessionPrefetch = useRef<Promise<Session | null> | null>(null);
  const [transcriptPool] = useState(() => new TranscriptPool());
  // Visible output advances per frame; hidden streams keep their own cadence.
  const [harnessEvents] = useState(
    () =>
      new HarnessEventQueue(
        (sessionId) => {
          const tab = tabsRef.current.find(
            (entry) => entry.id === activeTabIdRef.current,
          );
          // Inbox owns its session surfaces outside the workspace tab tree.
          return (
            foregroundSurfaceRef.current.inboxSessionId === sessionId ||
            (foregroundSurfaceRef.current.workspaceVisible &&
              !!tab &&
              (leafIds(tab.layout).includes(sessionId) ||
                tab.editorPanes.some((pane) =>
                  pane.files.some(
                    (file) =>
                      file.id === pane.activeFileId &&
                      file.agent?.sessionId === sessionId,
                  ),
                )))
          );
        },
        (batches) => {
          const prev = sessionsRef.current;
          const next = prev.map((session) => {
            const events = batches.get(session.id);
            return events ? applyHarnessEvents(session, events) : session;
          });
          if (!next.some((session, index) => session !== prev[index])) return;
          sessionsRef.current = next;
          syncDockBadge(next);
          setSessions(next);
        },
      ),
  );
  const skipForgetSessionIds = useRef(new Set<string>());
  const importedSessionsApplied = useRef(false);
  const projectLocationSyncs = useRef(
    new Map<string, ReturnType<typeof synchronizeProjectLocation>>(),
  );
  const submitAfterProjectSyncRef = useRef<Submit>(() => false);

  useEffect(() => {
    for (const project of recents) {
      void rememberProjectLocation(project.path).catch(() => undefined);
    }
  }, [recents]);

  useEffect(() => {
    if (importedSessionsApplied.current) return;
    const imported = windowTransfer?.sessions ?? resumed?.sessions;
    if (!imported?.length) return;
    importedSessionsApplied.current = true;
    for (const session of imported) {
      observedSessions.current.set(session.id, session);
      lastPersisted.current.set(session.id, persistFingerprint(session));
      const userId = lastUserBlockId(session);
      if (userId) lastPersistedUserBlock.current.set(session.id, userId);
      if (session.providerSessionId) {
        lastBoundProvider.current.set(session.id, session.providerSessionId);
      }
    }
  }, [windowTransfer, resumed]);

  const flushHarnessEvents = harnessEvents.flush;
  const flushForegroundHarnessEvents = harnessEvents.flushForeground;

  const stopSessionForRemoval = useCallback(
    async (sessionId: string): Promise<Session | undefined> => {
      titleCoordinator.current!.cancel(sessionId);
      await orchestrator.stopForSession(sessionId);
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (!open?.busy) return open;

      turnGen.current.set(sessionId, (turnGen.current.get(sessionId) ?? 0) + 1);
      flushHarnessEvents();
      await Promise.all(
        sessionChildHarnesses(open).map((harness) =>
          cancelHarnessTurn(harness, sessionId).catch(() => undefined),
        ),
      );
      flushHarnessEvents();
      return sessionsRef.current.find((session) => session.id === sessionId);
    },
    [flushHarnessEvents],
  );

  const enqueueHarnessEvent = harnessEvents.enqueue;

  useEffect(() => {
    if (resumed?.sessions.length) bindResumedSessions(resumed.sessions);
    const stopBridge = startHarnessBridge();
    const reap = () => {
      if (isAppQuitting()) return;
      void persistQuitState(
        sessionsRef.current,
        tabsRef.current,
        activeTabIdRef.current,
        projectCwdRef.current,
        readProjectReturnMemory(),
        "unload",
        projectTerminalsRef.current,
        lastDockSideRef.current ?? undefined,
      ).finally(() => {
        void reapWindowRuntime(
          sessionsRef.current,
          tabsRef.current,
          projectTerminalsRef.current,
        );
      });
    };
    window.addEventListener("pagehide", reap);
    window.addEventListener("beforeunload", reap);
    return () => {
      window.removeEventListener("pagehide", reap);
      window.removeEventListener("beforeunload", reap);
      stopBridge();
      harnessEvents.cancelScheduled();
    };
  }, [resumed, readProjectReturnMemory, harnessEvents]);

  useEffect(() => {
    // The next new session's harness also loads at boot, so its picker is
    // ready; only once the probe confirms that CLI is installed.
    void probeHarnessAvailability().then(() => {
      const next = defaultSessionChoice(sidebarCwdRef.current).harness;
      if (isLiveHarness(next) && isHarnessAvailable(next)) {
        void refreshHarnessCatalogs([next]);
      }
    });
    // Only the harnesses already in this window. Probing every installed CLI
    // at boot left unused agents (especially Pi) running in the background.
    const harnesses = [
      ...new Set(sessionsRef.current.map((session) => session.harness)),
    ];
    void refreshHarnessCatalogs(harnesses).then(() => {
      setSessions((prev) =>
        prev.map((session) => {
          if (!isLiveHarness(session.harness)) return session;
          const resolved = resolveModel(session.harness, session.model);
          const modelSettings = mergeModelSettings(
            resolved,
            session.modelSettings,
          );
          if (
            resolved.id === session.model &&
            sameSettings(modelSettings, session.modelSettings)
          ) {
            return session;
          }
          return { ...session, model: resolved.id, modelSettings };
        }),
      );
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const active =
    sessions.find((session) => session.id === activeTab?.focusedId) ??
    sessions.find(
      (session) => activeTab && leafIds(activeTab.layout).includes(session.id),
    );
  const activeTabSessionIds = activeTab ? leafIds(activeTab.layout) : [];
  const activeLinkedWorkItemPanel = activeTab
    ? (linkedWorkItemPanels.get(activeTab.focusedId) ??
      [...linkedWorkItemPanels.values()]
        .reverse()
        .find((panel) => activeTabSessionIds.includes(panel.sessionId)) ??
      null)
    : null;

  // Panels are tab-local UI. Keep mounted panels alive while their tab is in
  // the workspace so switching away preserves the fetched issue and its UI
  // state, then discard them when their session leaves every open tab.
  useEffect(() => {
    const openSessionIds = new Set(tabs.flatMap((tab) => leafIds(tab.layout)));
    setLinkedWorkItemPanels((current) => {
      if ([...current.keys()].every((id) => openSessionIds.has(id))) {
        return current;
      }
      return new Map([...current].filter(([id]) => openSessionIds.has(id)));
    });
  }, [tabs]);

  const sessionDefaults = active ?? sessions[0];
  const [sharedAgentDefaults] = usePreferenceState(loadSharedAgentDefaults);
  const newSessionRuntimeMode = sharedAgentDefaults.runtimeMode ?? sessionDefaults?.runtimeMode;

  useEffect(() => {
    const openSessionForAddToChat = (event: Event) => {
      const detail = (event as CustomEvent<AddToChatRequest>).detail;
      if (!detail?.text) return;

      const result = applyAddToChatRequest({
        sessions: sessionsRef.current,
        tabs: tabsRef.current,
        activeTabId: activeTabIdRef.current,
        projectCwd: projectCwdRef.current,
        fallbackCwd: sessionDefaults?.cwd,
        defaultRuntimeMode: newSessionRuntimeMode,
        text: detail.text,
        mode: detail.mode,
      });
      if (!result) return;

      sessionsRef.current = result.sessions;
      tabsRef.current = result.tabs;
      setSessions(result.sessions);
      setTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      setProjectTerminalFocused(false);
      setComposerFocused(true);
    };

    window.addEventListener(ADD_TO_CHAT_EVENT, openSessionForAddToChat);
    return () =>
      window.removeEventListener(ADD_TO_CHAT_EVENT, openSessionForAddToChat);
  }, [sessionDefaults?.cwd, newSessionRuntimeMode]);

  const activeSkillContext = active
    ? nativeSkillContextForSession(active)
    : null;
  const activeSkillCwd = activeSkillContext?.cwd;

  useEffect(() => {
    if (!activeSkillContext || !activeSkillCwd) return;
    warmNativeSkills(activeSkillContext);
  }, [activeSkillCwd, active?.id, active?.harness]);

  const activeFile = activeTab ? focusedFileTab(activeTab) : undefined;
  const sidebarCwd =
    (activeFile?.appView
      ? undefined
      : (activeFile?.projectCwd ?? activeFile?.cwd)) ??
    active?.cwd ??
    (activeTab ? workspaceTabCwd(activeTab, sessions) : undefined) ??
    projectCwd;
  const sidebarCwdRef = useRef(sidebarCwd);
  sidebarCwdRef.current = sidebarCwd;
  const [sidebarTabSelection, setSidebarTabSelection] = useState<{
    project: string;
    tab: SidebarTabId;
  }>(() => ({
    project: pathKey(sidebarCwd),
    tab: loadProjectSidebarTab(sidebarCwd),
  }));
  const sidebarTab =
    sidebarTabSelection.project === pathKey(sidebarCwd)
      ? sidebarTabSelection.tab
      : loadProjectSidebarTab(sidebarCwd);
  const setSidebarTab = useCallback((tab: SidebarTabId, project?: string) => {
    const cwd = project ?? sidebarCwdRef.current;
    saveProjectSidebarTab(cwd, tab);
    setSidebarTabSelection({
      project: pathKey(cwd),
      tab,
    });
  }, []);
  const sidebarCwdKey =
    sidebarCwd && sidebarCwd !== "~" ? pathKey(sidebarCwd) : null;
  const historyFailed =
    sidebarCwdKey != null && failedProjectPaths.has(sidebarCwdKey);
  // True from the very first frame that shows a project we have never listed,
  // so the sidebar can stay blank instead of flashing "No sessions yet".
  const historyPending =
    sidebarCwdKey != null &&
    !loadedProjects.has(sidebarCwdKey) &&
    !historyFailed;
  const gitCwd =
    (activeFile?.appView ? undefined : activeFile?.cwd) ??
    (active
      ? sessionWorkCwd(active)
      : ((activeTab ? workspaceTabWorktree(activeTab, sessions) : undefined) ??
        projectWorktree?.path ??
        sidebarCwd));
  const terminalCwd = newTerminalCwd({
    activeFile: activeFile?.appView ? undefined : activeFile,
    session: active,
    fallback: gitCwd,
  });
  const gitCwdBranches = useProjectBranches(
    gitCwd,
    Boolean(gitCwd) && gitCwd !== "~" && !isRemoteProjectPath(sidebarCwd),
  );
  const explorerRootLabel =
    active?.worktreeCwd && sameProjectPath(gitCwd, sessionWorkCwd(active))
      ? active.branch || gitCwdBranches?.current || undefined
      : undefined;
  const remoteFilesProject = remoteProjectFor(sidebarCwd);
  // The host checkout the remote tab is aimed at — the attached session's
  // work path or a worktree picked before the first message.
  const remoteTabCheckout = remoteFilesProject
    ? remoteTabCwd(sidebarCwd, active?.id)
    : undefined;
  const filesCwd = remoteFilesProject && !remoteFilesProject.local
    ? isRemoteProjectPath(gitCwd)
      ? gitCwd
      : remotePath(
          remoteFilesProject.environmentId,
          remoteTabCheckout ??
            (gitCwd && gitCwd !== sidebarCwd ? gitCwd : remoteFilesProject.cwd),
        )
    : gitCwd;
  // Git follows the session's own work path (a linked worktree included),
  // never the terminal-following files cwd: a remote session working in a
  // separate worktree diffed the main checkout and showed "No file changes".
  const gitRootCwd = remoteFilesProject
    ? remoteSessionGitCwd(
        remoteFilesProject,
        gitCwd,
        sidebarCwd,
        remoteTabCheckout,
      )
    : gitCwd;
  const gitCwdRef = useRef(gitRootCwd);
  gitCwdRef.current = gitRootCwd;
  const projectBranches = useProjectBranches(
    sidebarCwd,
    Boolean(sidebarCwd) && sidebarCwd !== "~",
  );

  const nextBusySessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of sessions) {
      if (session.busy) {
        ids.add(session.id);
        if (session.orchestrationLeadId) ids.add(session.orchestrationLeadId);
      }
    }
    return ids;
  }, [sessions]);
  const busySessionIdsRef = useRef(nextBusySessionIds);
  if (!setsEqual(busySessionIdsRef.current, nextBusySessionIds)) {
    busySessionIdsRef.current = nextBusySessionIds;
  }
  const busySessionIds = busySessionIdsRef.current;

  /** Probe the active session's harness for its live model catalog whenever
   * the active harness changes. Catalogs load lazily (probing spawns a CLI
   * process) and the boot refresh runs before restored sessions land, so a
   * fresh session would otherwise show only the built-in fallback model
   * until the picker happened to be opened. Idempotent: refreshHarnessCatalogs
   * dedupes via hasLiveCatalog and its inflight map. */
  const activeHarness = active?.harness;
  useEffect(() => {
    if (!activeHarness || !isLiveHarness(activeHarness)) return;
    void refreshHarnessCatalogs([activeHarness]);
  }, [activeHarness]);

  const activeProviderSignInRequest = useMemo(() => {
    if (
      !active ||
      !supportsHarnessLogin(active.harness) ||
      !latestTurnNeedsHarnessLogin(active.blocks)
    ) {
      return null;
    }
    return {
      key: providerSignInRequestKey(active),
      sessionId: active.id,
      harness: active.harness,
    };
  }, [active]);
  useEffect(() => {
    if (!activeProviderSignInRequest) return;
    if (seenProviderSignInRequests.has(activeProviderSignInRequest.key)) {
      return;
    }
    seenProviderSignInRequests.add(activeProviderSignInRequest.key);
    setProviderSignInRequest(activeProviderSignInRequest);
  }, [activeProviderSignInRequest, seenProviderSignInRequests]);
  useEffect(() => {
    if (
      providerSignInRequest &&
      active?.id !== providerSignInRequest.sessionId
    ) {
      setProviderSignInRequest(null);
    }
  }, [active?.id, providerSignInRequest]);

  const [nextApprovalSessionIds, nextQuestionSessionIds] = useMemo(() => {
    const approvals = new Set<string>();
    const questions = new Set<string>();
    for (const session of sessions) {
      if (sessionNeedsInput(session)) {
        approvals.add(session.id);
        if (session.orchestrationLeadId) approvals.add(session.orchestrationLeadId);
        if (session.pendingQuestion) questions.add(session.id);
      }
    }
    return [approvals, questions];
  }, [sessions]);
  const approvalSessionIdsRef = useRef(nextApprovalSessionIds);
  if (!setsEqual(approvalSessionIdsRef.current, nextApprovalSessionIds)) {
    approvalSessionIdsRef.current = nextApprovalSessionIds;
  }
  const approvalSessionIds = approvalSessionIdsRef.current;
  const questionSessionIdsRef = useRef(nextQuestionSessionIds);
  if (!setsEqual(questionSessionIdsRef.current, nextQuestionSessionIds)) {
    questionSessionIdsRef.current = nextQuestionSessionIds;
  }
  const questionSessionIds = questionSessionIdsRef.current;

  const activeSessionId = inboxVisible
    ? composerFocused
      ? inboxAskPortal?.sessionId
      : undefined
    : activeAppView
      ? undefined
      : active?.id;
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  useInputNotifications(sessions, activeSessionId);

  // Cache the OS decision so a turn ending later can skip a denied banner.
  useEffect(() => {
    if (loadNotificationsEnabled()) void probeNotificationPermission();
  }, []);
  const unseenFinishedIds = useUnseenFinishedSessions(
    sessions,
    busySessionIds,
    activeSessionId,
  );

  const liveAgents = useMemo(
    () =>
      liveAgentsEnabled
        ? liveAgentsFromSessions(sessions, unseenFinishedIds)
        : [],
    [liveAgentsEnabled, sessions, unseenFinishedIds],
  );

  const hiddenApprovalToasts = useMemo(
    () =>
      hiddenApprovalNotices(
        sessions,
        workspaceVisible ? activeTabId : "",
        tabs,
        workspaceVisible && composerFocused,
      ),
    [sessions, activeTabId, tabs, composerFocused, workspaceVisible],
  );
  const [reminderNoticesHeight, setReminderNoticesHeight] = useState(0);
  const [harnessUpdateHeight, setHarnessUpdateHeight] = useState(0);

  useEffect(() => {
    syncDockBadge(sessions);
  }, [sessions]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        setWindowFocused(focused);
        if (focused) {
          flushForegroundHarnessEvents();
          syncDockBadge(sessionsRef.current);
          if (
            document.activeElement === document.body &&
            !projectTerminalFocusedRef.current &&
            !appViewFocusedRef.current
          ) {
            setComposerFocused(true);
            setComposerFocusToken((token) => token + 1);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [flushForegroundHarnessEvents]);

  useEffect(() => {
    const onVisible = () => {
      // Flush on hiding too: WebKit can suspend a pending animation frame,
      // leaving the last output stranded until another event or activation.
      flushHarnessEvents();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [flushHarnessEvents]);

  useLayoutEffect(() => {
    // Catch up only the newly visible panes before paint. Other streams keep
    // their background timer instead of adding work to this tab switch.
    flushForegroundHarnessEvents();
  }, [
    activeTabId,
    inboxVisible,
    inboxAskPortal?.sessionId,
    activeAppView,
    flushForegroundHarnessEvents,
  ]);

  useEffect(() => {
    let unlistenClose: (() => void) | undefined;
    const releaseQuit = setQuitWorkspace(
      () => sessionsRef.current,
      () => tabsRef.current,
      () => activeTabIdRef.current,
      () => projectCwdRef.current,
      () => projectTerminalsRef.current,
      readProjectReturnMemory,
      flushHarnessEvents,
      () => lastDockSideRef.current,
      keepWorkspaceTab,
    );
    void getCurrentWindow()
      .onCloseRequested((event) => {
        // Listening here makes close our job. Letting the default path run
        // calls JS `window.destroy`, which Tauri denies without a permission.
        event.preventDefault();
        const toTray = loadCloseToTray();
        if (hasInFlightSessions(sessionsRef.current)) {
          flushHarnessEvents();
          if (!toTray && !IS_MAC) {
            void closeBusyWindow();
            return;
          }
          // Not `persistQuitState`: that marks the live turns interrupted.
          void persistLiveTranscripts(sessionsRef.current);
          void hideCurrentWindow();
          return;
        }
        void persistQuitState(
          sessionsRef.current,
          tabsRef.current,
          activeTabIdRef.current,
          projectCwdRef.current,
          readProjectReturnMemory(),
          "unload",
          projectTerminalsRef.current,
          lastDockSideRef.current ?? undefined,
          keepWorkspaceTab,
        ).finally(() => {
          void (toTray ? hideCurrentWindow() : closeCurrentWindow());
        });
      })
      .then((fn) => {
        unlistenClose = fn;
      });
    return () => {
      releaseQuit();
      unlistenClose?.();
    };
  }, [flushHarnessEvents, keepWorkspaceTab, readProjectReturnMemory]);

  const refreshHistory = useCallback((cwd: string, force = false) => {
    if (isRemoteProjectPath(cwd)) return Promise.resolve();
    return projectHistoryLoader.current!.load(cwd, force);
  }, []);

  useEffect(
    () =>
      installNativeSessionSync({
        live: () => sessionsRef.current,
        changed: (session, summary, imported) => {
          loadedSessionCache.current.delete(session.id);
          lastPersisted.current.set(session.id, persistFingerprint(session));
          // Bulk imports touch many closed sessions; only an open one needs a re-render.
          if (sessionsRef.current.some((entry) => entry.id === session.id)) {
            const next = sessionsRef.current.map((entry) =>
              entry.id === session.id ? session : entry,
            );
            sessionsRef.current = next;
            setSessions(next);
          }
          setHistory((current) => mergeProjectHistorySummary(current, summary));
          if (imported) setRecents(rememberProject(session.cwd));
        },
      }),
    [],
  );

  useEffect(() => {
    void refreshHistory(sidebarCwd);
  }, [sidebarCwd, refreshHistory]);

  useEffect(() => {
    if (!inboxVisible) return;
    let cancelled = false;
    void listLinkedSessions()
      .then((rows) => {
        if (!cancelled) setStoredLinkedSessions(rows);
      })
      .catch(() => {
        // Already-loaded and live sessions still provide a useful fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [inboxVisible]);

  useEffect(() => {
    prefetchProjectFiles(gitCwd);
  }, [gitCwd]);

  const persistSession = useCallback((session: Session | undefined) => {
    if (
      !session ||
      !shouldPersistSession(session) ||
      removingSessionIds.current.has(session.id) ||
      switchingWorktrees.current.has(session.id)
    )
      return;
    const fingerprint = persistFingerprint(session);
    // Leaving a session flushes it. An unchanged one would still rewrite and
    // re-diff its whole transcript under the store lock, stalling the next load.
    if (lastPersisted.current.get(session.id) === fingerprint) return;
    void upsertSession(session)
      .then((summary) => {
        if (!summary) return;
        lastPersisted.current.set(session.id, fingerprint);
        setHistory((current) => mergeProjectHistorySummary(current, summary));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const liveIds = new Set(sessions.map((session) => session.id));
    const visibleIds = openSessionIds(tabsRef.current);
    for (const session of sessions) {
      if (
        removingSessionIds.current.has(session.id) ||
        switchingWorktrees.current.has(session.id)
      )
        continue;
      if (observedSessions.current.get(session.id) === session) continue;
      observedSessions.current.set(session.id, session);
      const parked = !visibleIds.has(session.id);
      const newlyBound =
        !!session.providerSessionId &&
        lastBoundProvider.current.get(session.id) !== session.providerSessionId;
      const lastUserId = lastUserBlockId(session);
      const newUserTurn =
        !!lastUserId &&
        lastPersistedUserBlock.current.get(session.id) !== lastUserId;
      if (newlyBound && session.providerSessionId) {
        lastBoundProvider.current.set(session.id, session.providerSessionId);
      }
      if (newUserTurn && lastUserId) {
        lastPersistedUserBlock.current.set(session.id, lastUserId);
      }
      if ((newlyBound || newUserTurn) && shouldPersistSession(session)) {
        persistSession(session);
      }
      if (
        shouldPersistSession(session) &&
        (!session.busy ||
          parked ||
          newlyBound ||
          newUserTurn ||
          !lastPersisted.current.has(session.id))
      ) {
        pendingPersist.current.set(session.id, session);
      }
    }
    for (const sessionId of observedSessions.current.keys()) {
      if (liveIds.has(sessionId)) continue;
      observedSessions.current.delete(sessionId);
      pendingPersist.current.delete(sessionId);
    }
    if (pendingPersist.current.size === 0) return;

    // Debounced, but never starved: another session streaming re-renders
    // every frame, which used to push a parked session's save out forever.
    const now = Date.now();
    persistDirtySince.current ??= now;
    const delay = Math.max(
      0,
      Math.min(
        PERSIST_DEBOUNCE_MS,
        persistDirtySince.current + PERSIST_MAX_WAIT_MS - now,
      ),
    );
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = undefined;
      persistDirtySince.current = null;
      const dirty = [...pendingPersist.current.values()];
      pendingPersist.current.clear();
      void Promise.all(
        dirty.map(async (session) => {
          if (
            removingSessionIds.current.has(session.id) ||
            switchingWorktrees.current.has(session.id)
          )
            return;
          const fingerprint = persistFingerprint(session);
          if (lastPersisted.current.get(session.id) === fingerprint) return;
          const summary = await upsertSession(session).catch(() => null);
          if (!summary) return;
          lastPersisted.current.set(session.id, fingerprint);
          setHistory((current) => mergeProjectHistorySummary(current, summary));
        }),
      );
    }, delay);
  }, [persistSession, sessions]);

  useEffect(() => () => window.clearTimeout(persistTimer.current), []);

  useEffect(() => {
    const refs = inFlightRefs(sessions, tabs);
    if (refs.length > 0) sawInFlight.current = true;
    const key = inFlightSnapshotKey(refs);
    if (
      !shouldWriteInFlightSnapshot(
        key,
        refs,
        inFlightSyncKey.current,
        sawInFlight.current,
      )
    ) {
      return;
    }
    inFlightSyncKey.current = key;
    void replaceInFlightSessions(refs).catch(() => undefined);
  }, [sessions, tabs]);

  useEffect(() => {
    if (windowTransfer) return;
    const snapshot = collectWorkspaceSnapshot(
      tabs,
      sessions,
      activeTabId,
      projectCwd,
      reconcileProjectReturn({
        memory: projectReturnRef.current,
        tabs,
        sessions,
        activeTabId,
      }),
      projectTerminals,
      lastDockSide ?? undefined,
      keepWorkspaceTab,
    );
    const key = workspaceSnapshotKey(snapshot);
    if (workspaceSyncKey.current === key) return;
    workspaceSyncKey.current = key;
    // The key is recorded as soon as a save is scheduled, so an unrelated
    // re-render (every streamed frame) must not cancel it. Only a newer
    // snapshot replaces the pending one.
    window.clearTimeout(workspaceSaveTimer.current);
    workspaceSaveTimer.current = window.setTimeout(() => {
      workspaceSaveTimer.current = undefined;
      void saveWorkspaceSnapshot(snapshot).catch(() => undefined);
    }, 250);
  }, [
    tabs,
    sessions,
    activeTabId,
    projectCwd,
    projectTerminals,
    lastDockSide,
    windowTransfer,
    keepWorkspaceTab,
    projectWorktree?.path,
    workspaceNavigation.revision,
  ]);

  useEffect(() => {
    if (lastProjectPath()) return;
    void invoke<string>("default_cwd")
      .then((cwd) => {
        if (!looksLikeProject(cwd)) return;
        setProjectCwd(cwd);
        setRecents((prev) => (prev.length > 0 ? prev : rememberProject(cwd)));
        setSessions((prev) =>
          prev.map((s) => (s.cwd === "~" ? { ...s, cwd } : s)),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        const isolated = isolateTerminalPanes(tab);
        if (isolated !== tab) changed = true;
        return isolated;
      });
      return changed ? next : prev;
    });
  }, [tabs]);

  // Tabs are views. Hidden idle sessions drop their child. A visible session
  // keeps its child for a few minutes after a turn so follow-ups stay instant,
  // then parks it and resumes on the next prompt.
  useIdleSessionDetach({
    sessions,
    sessionsRef,
    tabs,
    tabsRef,
    orchestrationRuns,
    liveAgentsEnabled,
    unseenFinishedIds,
    openingSessionIds,
    loadedSessionCache,
    skipForgetSessionIds,
    persistSession,
    setSessions,
  });

  const activateTab = useCallback(
    (
      id: string,
      paneId?: string,
      reason: "session" | "workspace" = "session",
    ) => {
      setAppPage(null);
      const tab = tabsRef.current.find((entry) => entry.id === id);
      const nextFocusedId =
        tab &&
        paneId &&
        (leafIds(tab.layout).includes(paneId) ||
          tab.editorPanes.some((entry) => entry.id === paneId) ||
          (tab.terminalPanes ?? []).some((entry) => entry.id === paneId))
          ? paneId
          : tab?.focusedId;

      if (reason === "workspace") setActiveTabIdState(id);
      else setActiveTabId(id);
      if (tab && nextFocusedId && nextFocusedId !== tab.focusedId) {
        setTabs((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? { ...entry, focusedId: nextFocusedId, diffFocused: false }
              : entry,
          ),
        );
      }

      if (tab) {
        const focusedTab = nextFocusedId
          ? { ...tab, focusedId: nextFocusedId }
          : tab;
        const cwd = focusedWorkspaceTabCwd(focusedTab, sessionsRef.current);
        if (cwd && looksLikeProject(cwd)) {
          const normalized = normalizeProjectPath(cwd);
          if (!sameProjectPath(normalized, projectCwdRef.current)) {
            setProjectCwd(normalized);
            setRecents(rememberProject(normalized));
          }
        }
      }
      setComposerFocused(
        !!nextFocusedId &&
          sessionsRef.current.some((session) => session.id === nextFocusedId),
      );
    },
    [],
  );

  const discardEmptySessionReferences = useCallback(
    (ids: ReadonlySet<string>) => {
      for (const id of ids) {
        loadedSessionCache.current.delete(id);
        openingSessionIds.current.delete(id);
        lastPersisted.current.delete(id);
        workspacePins.current.delete(id);
      }
      for (const tab of tabsRef.current) {
        if (leafIds(tab.layout).every((id) => ids.has(id)))
          workspacePins.current.delete(tab.id);
      }
      projectReturnRef.current = new Map(
        [...projectReturnRef.current].filter(([, id]) => !ids.has(id)),
      );
    },
    [],
  );

  useEmptySessionCleanup({
    tabs,
    sessions,
    activeTabId,
    enabled: workspaceVisible && !activeAppView,
    canDiscard: canDiscardEmptySession,
    setTabs,
    onDiscard: discardEmptySessionReferences,
  });

  /** `cwd` scopes group inheritance: a tab from another project starts alone. */
  const insertBeside = useCallback(
    (
      prev: WorkspaceTab[],
      tab: WorkspaceTab,
      anchorId: string | undefined,
      cwd?: string,
    ) =>
      insertTabBesideActive(prev, tab, anchorId, (id) =>
        id === tab.id ? (cwd ? projectName(cwd) : undefined) : projectOfTab(id),
      ),
    [projectOfTab],
  );

  const insertBesideActive = useCallback(
    (prev: WorkspaceTab[], tab: WorkspaceTab, cwd?: string) =>
      insertBeside(prev, tab, activeTabIdRef.current, cwd),
    [insertBeside],
  );

  const appendTab = useCallback(
    (tab: WorkspaceTab, cwd?: string) => {
      setTabs((prev) => insertBesideActive(prev, tab, cwd));
    },
    [insertBesideActive],
  );

  const onSelectProviderAccount = useCallback(
    (
      sessionId: string,
      provider: ProviderAccountProvider,
      accountId: string,
    ) => {
      const target = sessionsRef.current.find((item) => item.id === sessionId);
      if (!target || target.harness !== provider) return;
      if (conversationProviderAccountId(target) === accountId) return;

      // The Host moves its conversation to the account in place.
      if (
        sessionUsesHost(target) &&
        remoteSessionActions(sessionId)?.switchAccount(accountId)
      )
        return;

      if (target.blocks.length === 0 && !target.busy) {
        setSessions((current) =>
          current.map((session) =>
            session.id === target.id
              ? { ...session, providerAccountId: accountId }
              : session,
          ),
        );
        return;
      }

      // Provider thread ids are account-owned. Without the Host to move the
      // native records, the next turn starts a thread on the new account and
      // continues this conversation from a recap.
      if (target.busy || target.pendingSwitch || isPreparingHandoff(target))
        return;
      const history = {
        ...target,
        blocks: target.blocks.filter((block) => !block.draft),
      };
      const handedOff = history.blocks.some((block) => block.role === "user")
        ? appendReadyHandoff(
            history,
            target.harness,
            target.harness,
            buildDeterministicHandoff(history),
          )
        : history;
      void forgetHarnessSession(target.harness, target.id);
      setSessions((current) =>
        current.map((session) =>
          session.id === target.id
            ? {
                ...session,
                blocks: [
                  ...handedOff.blocks,
                  ...session.blocks.filter((block) => block.draft),
                ],
                providerAccountId: accountId,
                providerSessionId: undefined,
                nativeSession: undefined,
                usageLimit: undefined,
                context: undefined,
              }
            : session,
        ),
      );
    },
    [],
  );

  const onOpenWhatsNew = useCallback((version: string) => {
    const document = releaseNotesForVersion(version);
    if (!document) {
      void message(
        "Release notes for this version are not available in this build.",
        { title: "MonoCode" },
      );
      return;
    }
    setWhatsNewVersion(document.source.version);
  }, []);

  const createWorkspaceTab = useCallback(
    (cwd: string, focus?: WorktreeFocus) => {
      const session = {
        ...newDefaultSession(cwd, newSessionRuntimeMode),
        ...(focus && !sameProjectPath(focus.path, cwd)
          ? { worktreeCwd: focus.path, branch: focus.branch ?? undefined }
          : {}),
      };
      const tab = newTab(session.id);
      setSessions((prev) => [...prev, session]);
      appendTab(tab, cwd);
      return tab.id;
    },
    [appendTab, newSessionRuntimeMode],
  );

  const onNewInProject = useCallback(
    (cwd: string, options?: { reuseDraft?: boolean }) => {
      workspaceNavigation.cancel();
      const focus = worktreeFocus(cwd);
      const desiredWorktree =
        focus && pathKey(focus.path) !== pathKey(cwd) ? focus.path : undefined;
      const inPlace = (session: Session) =>
        sameProjectPath(session.cwd, cwd) &&
        (session.worktreeCwd ?? undefined) === desiredWorktree;
      // Composer launchers may opt into reusing an untouched draft to receive
      // their initial text. Explicit new-session actions return to an unsent
      // new conversation elsewhere instead of hiding it behind another one.
      const activeTab = tabsRef.current.find(
        (entry) => entry.id === activeTabIdRef.current,
      );
      const reusable = options?.reuseDraft
        ? sessionsRef.current.find(
            (session) => inPlace(session) && isReusableDraftSession(session),
          )
        : pendingNewSessionDraft(
            sessionsRef.current,
            tabsRef.current,
            (session) => inPlace(session) && !remoteSessionFor(session.id),
            activeTab?.focusedId,
          )?.session;
      if (reusable) {
        const hostTab = tabsRef.current.find((entry) =>
          leafIds(entry.layout).includes(reusable.id),
        );
        if (hostTab) {
          if (looksLikeProject(cwd)) {
            setProjectCwd(normalizeProjectPath(cwd));
            setRecents(rememberProject(cwd));
          }
          setSidebarTab("sessions", cwd);
          activateTab(hostTab.id, reusable.id);
          setComposerFocused(true);
          return reusable.id;
        }
      }
      const session = newWorkspaceSession(cwd, newSessionRuntimeMode);
      const tab = newTab(session.id);
      setSessions((previous) => [...previous, session]);
      appendTab(tab, cwd);
      if (looksLikeProject(cwd)) {
        setProjectCwd(normalizeProjectPath(cwd));
        setRecents(rememberProject(cwd));
      }
      setSidebarTab("sessions", cwd);
      setActiveTabId(tab.id);
      setComposerFocused(true);
      return session.id;
    },
    [
      activateTab,
      appendTab,
      newSessionRuntimeMode,
      setSidebarTab,
      workspaceNavigation.cancel,
    ],
  );

  const onNew = useCallback(
    () => onNewInProject(sidebarCwd),
    [onNewInProject, sidebarCwd],
  );

  const ensureContentTab = useCallback(
    (cwd: string) => {
      const target = contentTabTarget(
        tabsRef.current,
        sessionsRef.current,
        activeTabIdRef.current,
        cwd,
        previousTabs(),
      );
      if (target) {
        activateTab(target.id);
        return target;
      }
      let id = "";
      flushSync(() => {
        id = createWorkspaceTab(cwd);
      });
      activateTab(id);
      return tabsRef.current.find((tab) => tab.id === id)!;
    },
    [activateTab, createWorkspaceTab, previousTabs],
  );

  const onSelectRemoteSession = useCallback(
    (project: string, remoteSessionId: string) => {
      workspaceNavigation.cancel();
      setSidebarTab("sessions", project);
      if (looksLikeProject(project))
        setProjectCwd(normalizeProjectPath(project));
      const existing = tabsRef.current
        .map((tab) => ({
          tab,
          shellId: leafIds(tab.layout).find(
            (shellId) =>
              remoteSessionFor(shellId) === remoteSessionId &&
              sessionsRef.current.some(
                (session) =>
                  session.id === shellId &&
                  sameProjectPath(session.cwd, project),
              ),
          ),
        }))
        .find(({ shellId }) => shellId);
      if (existing) {
        activateTab(
          existing.tab.id,
          leafIds(existing.tab.layout).filter((id) =>
            sessionsRef.current.some((session) => session.id === id),
          ).length > 1
            ? existing.shellId
            : undefined,
        );
        return;
      }
      // Read the transcript while the new tab renders; its pane picks up this
      // request instead of starting its own after mounting.
      const remoteProject = remoteProjectFor(project);
      const machine =
        remoteProject && knownRemoteMachine(remoteProject.environmentId);
      if (machine)
        void preloadRemoteSession(machine.id, remoteSessionId).catch(
          () => undefined,
        );
      // Reserve a dedicated tab immediately. An apparently blank remote tab
      // may hold composer text or a create/upload that the host has not accepted.
      // Until the transcript arrives, the listed conversation names its own
      // agent instead of the new-conversation default.
      const listed = cachedRemoteSessionSummary(project, remoteSessionId);
      const shell = newDefaultSession(project, newSessionRuntimeMode);
      const session: Session = listed
        ? {
            ...shell,
            harness: listed.harness,
            ...(listed.model ? { model: listed.model } : {}),
            title: listed.title,
          }
        : shell;
      const tab = newTab(session.id);
      rememberRemoteSession(session.id, remoteSessionId, remoteProject);
      setSessions((prev) => [...prev, session]);
      appendTab(tab, project);
      setActiveTabId(tab.id);
    },
    [
      activateTab,
      appendTab,
      newSessionRuntimeMode,
      setSidebarTab,
      workspaceNavigation.cancel,
    ],
  );

  const onStartInboxItem = useCallback(
    async (item: InboxItem, body?: string) => {
      const start = (description?: string) => {
        const cwd =
          item.projectPath || active?.cwd || sessionDefaults?.cwd || projectCwd;
        setSidebarTab("sessions", cwd);
        const ref =
          item.provider === "linear" || item.provider === "jira"
            ? item.identifier?.trim() || `#${item.number}`
            : `#${item.number}`;
        const linkedWorkItem = linkedWorkItemFromInboxItem(item);
        const session = {
          ...newDefaultSession(cwd, newSessionRuntimeMode),
          title: `${ref} ${item.title}`,
          inboxCard: inboxComposerCard(item, description),
          ...(linkedWorkItem ? { linkedWorkItem } : {}),
        };
        const tab = newTab(session.id);
        setSessions((prev) => [...prev, session]);
        appendTab(tab, cwd);
        setActiveTabId(tab.id);
        setComposerFocused(true);
      };

      start(await inboxTrackerDescription(item, body));
    },
    [
      active?.cwd,
      appendTab,
      sessionDefaults?.cwd,
      newSessionRuntimeMode,
      projectCwd,
    ],
  );

  const onAddNoteToChat = useCallback(
    (card: NoteComposerCard) => {
      if (!card.id) return;
      const cwd =
        (card.sourceCwd && looksLikeProject(card.sourceCwd)
          ? card.sourceCwd
          : undefined) ||
        active?.cwd ||
        sessionDefaults?.cwd ||
        projectCwd;
      setSidebarTab("sessions", cwd);
      const title = card.title.trim();
      const session = {
        ...newDefaultSession(cwd, newSessionRuntimeMode),
        ...(title ? { title } : {}),
        noteCard: card,
      };
      const tab = newTab(session.id);
      setSessions((prev) => [...prev, session]);
      appendTab(tab, cwd);
      setActiveTabId(tab.id);
      setComposerFocused(true);
    },
    [
      active?.cwd,
      appendTab,
      sessionDefaults?.cwd,
      newSessionRuntimeMode,
      projectCwd,
    ],
  );

  useEffect(() => {
    const onAdd = (event: Event) => {
      const card = (event as CustomEvent<NoteComposerCard>).detail;
      if (!card?.id) return;
      onAddNoteToChat(card);
    };
    window.addEventListener(ADD_NOTE_TO_CHAT_EVENT, onAdd);
    return () => window.removeEventListener(ADD_NOTE_TO_CHAT_EVENT, onAdd);
  }, [onAddNoteToChat]);

  const onInboxCardDismiss = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId && session.inboxCard
          ? { ...session, inboxCard: undefined }
          : session,
      ),
    );
  }, []);

  const setLinkedWorkItemUpdateCard = useCallback(
    (
      sessionId: string,
      update: (
        card: LinkedWorkItemUpdateCard | undefined,
      ) => LinkedWorkItemUpdateCard | undefined,
    ) => {
      const previous = sessionsRef.current;
      const next = previous.map((session) => {
        if (session.id !== sessionId) return session;
        const card = update(session.linkedWorkItemUpdateCard);
        return card === session.linkedWorkItemUpdateCard
          ? session
          : { ...session, linkedWorkItemUpdateCard: card };
      });
      if (!next.some((session, index) => session !== previous[index])) return;
      sessionsRef.current = next;
      setSessions(next);
    },
    [],
  );

  const onLinkedWorkItemUpdateCardDismiss = useCallback(
    (sessionId: string) => {
      setLinkedWorkItemUpdateCard(sessionId, () => undefined);
    },
    [setLinkedWorkItemUpdateCard],
  );

  const onNoteCardDismiss = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId && session.noteCard
          ? { ...session, noteCard: undefined }
          : session,
      ),
    );
  }, []);

  const onHandoffCardDismiss = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId && session.handoffCard
          ? { ...session, handoffCard: undefined }
          : session,
      ),
    );
  }, []);

  const onSplit = useCallback(
    (dir: SplitDir) => {
      if (!activeTab) return;
      const session = newDefaultSession(
        sessionDefaults?.cwd ?? projectCwd,
        newSessionRuntimeMode,
      );
      setSessions((prev) => [...prev, session]);
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTab.id) return t;
          return {
            ...t,
            layout: splitPane(t.layout, t.focusedId, dir, session.id),
            focusedId: session.id,
          };
        }),
      );
      setComposerFocused(true);
    },
    [activeTab, projectCwd, sessionDefaults?.cwd, newSessionRuntimeMode],
  );

  const focusProjectTerminal = useCallback(() => {
    setProjectTerminalFocused(true);
    setComposerFocused(false);
  }, []);

  const openProjectTerminal = useCallback(
    (cwd: string) => {
      const workdir = cwd || projectCwdRef.current;
      const projectPath = projectCwdRef.current;
      if (!isLocalProject(projectPath)) return false;
      setProjectTerminals((prev) => {
        const existing = findProjectTerminal(prev, projectPath);
        const file = newTerminalFile(
          workdir,
          existing ? nextDockTerminalTitle(existing, workdir) : undefined,
          projectPath,
        );
        if (!existing) {
          return [
            ...prev,
            createProjectTerminal(
              projectPath,
              file,
              lastDockSideRef.current ?? "bottom",
            ),
          ];
        }
        return mapProjectTerminal(prev, projectPath, (dock) =>
          addTerminalToDock(dock, file),
        );
      });
      focusProjectTerminal();
      return true;
    },
    [focusProjectTerminal],
  );

  const onOpenTerminal = useCallback(
    (cwd: string, asWorkspaceTab = false, occupySessionId?: string) => {
      const workdir = cwd || terminalCwd;
      if (!isLocalProject(projectCwdRef.current) || !isLocalProject(workdir))
        return;
      if (openProjectTerminal(workdir)) return;

      if (asWorkspaceTab || !activeTab) {
        const file = newTerminalFile(workdir, undefined, sidebarCwd);
        const tab = newTerminalWorkspaceTab(file);
        appendTab(tab, sidebarCwd);
        setActiveTabId(tab.id);
        setComposerFocused(false);
        return;
      }

      const occupying = sessionsRef.current.find(
        (session) => session.id === (occupySessionId ?? activeTab.focusedId),
      );
      const occupyPaneId =
        occupying && isBlankSession(occupying) ? occupying.id : undefined;
      if (occupyPaneId && occupying) {
        lastPersisted.current.delete(occupyPaneId);
        void forgetHarnessSession(occupying.harness, occupyPaneId);
        setSessions((prev) =>
          prev.filter((session) => session.id !== occupyPaneId),
        );
      }

      const file = newTerminalFile(
        workdir,
        nextTerminalTitle(activeTab, workdir),
        sidebarCwd,
      );
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? openTerminalTab(tab, file, occupyPaneId)
            : tab,
        ),
      );
      setComposerFocused(false);
    },
    [terminalCwd, activeTab, appendTab, openProjectTerminal, sidebarCwd],
  );

  const onNewTerminal = useCallback(() => {
    onOpenTerminal(terminalCwd);
  }, [terminalCwd, onOpenTerminal]);

  const onNewTerminalInSession = useCallback(
    (sessionId: string) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      if (session?.worktreeRemoved) return;
      onOpenTerminal(
        session ? sessionWorkCwd(session) : projectCwd,
        false,
        sessionId,
      );
    },
    [onOpenTerminal, projectCwd],
  );

  const onToggleProjectTerminal = useCallback(() => {
    if (!isLocalProject(projectCwd)) return;
    const dock = findProjectTerminal(projectTerminalsRef.current, projectCwd);
    if (!dock) {
      openProjectTerminal(terminalCwd);
      return;
    }
    const nextOpen = !dock.open;
    setProjectTerminals((prev) =>
      mapProjectTerminal(prev, projectCwd, (entry) =>
        withDockOpen(entry, nextOpen),
      ),
    );
    if (nextOpen) focusProjectTerminal();
    else setProjectTerminalFocused(false);
  }, [terminalCwd, focusProjectTerminal, openProjectTerminal, projectCwd]);

  const onHideProjectTerminal = useCallback(() => {
    setProjectTerminals((prev) =>
      mapProjectTerminal(prev, projectCwdRef.current, (dock) =>
        withDockOpen(dock, false),
      ),
    );
    setProjectTerminalFocused(false);
  }, []);

  const onProjectTerminalSide = useCallback((side: DockSide) => {
    setLastDockSide(side);
    setProjectTerminals((prev) =>
      mapProjectTerminal(prev, projectCwdRef.current, (dock) =>
        withDockSide(dock, side, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      ),
    );
  }, []);

  const onProjectTerminalSize = useCallback((size: number) => {
    setProjectTerminals((prev) =>
      mapProjectTerminal(prev, projectCwdRef.current, (dock) =>
        withDockSize(dock, size, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      ),
    );
  }, []);

  const onSelectProjectTerminal = useCallback(
    (fileId: string) => {
      setProjectTerminals((prev) =>
        mapProjectTerminal(prev, projectCwdRef.current, (dock) =>
          selectDockTerminal(dock, fileId),
        ),
      );
      focusProjectTerminal();
    },
    [focusProjectTerminal],
  );

  const onReorderProjectTerminals = useCallback((ids: string[]) => {
    setProjectTerminals((prev) =>
      mapProjectTerminal(prev, projectCwdRef.current, (dock) =>
        reorderDockTerminals(dock, orderByIds(dock.pane.files, ids)),
      ),
    );
  }, []);

  const onCloseProjectTerminal = useCallback((fileId: string) => {
    const dock = findProjectTerminal(
      projectTerminalsRef.current,
      projectCwdRef.current,
    );
    const file = dock?.pane.files.find((entry) => entry.id === fileId);
    if (!file) return;
    const finishClose = () => {
      setProjectTerminals((prev) =>
        mapProjectTerminal(prev, projectCwdRef.current, (entry) =>
          closeTerminalInDock(entry, fileId),
        ),
      );
    };
    void confirmCloseTerminal(file).then((ok) => ok && finishClose());
  }, []);

  const onCloseOtherProjectTerminals = useCallback((fileId: string) => {
    const projectPath = projectCwdRef.current;
    const dock = findProjectTerminal(projectTerminalsRef.current, projectPath);
    if (!dock?.pane.files.some((file) => file.id === fileId)) return;
    const closingFiles = dock.pane.files.filter((file) => file.id !== fileId);
    if (closingFiles.length === 0) return;
    const closingIds = new Set(closingFiles.map((file) => file.id));

    const finishClose = () => {
      setProjectTerminals((prev) =>
        mapProjectTerminal(prev, projectPath, (entry) => {
          if (!entry.pane.files.some((file) => file.id === fileId)) {
            return entry;
          }
          const files = entry.pane.files.filter(
            (file) => !closingIds.has(file.id),
          );
          return {
            ...entry,
            pane: { ...entry.pane, files, activeFileId: fileId },
          };
        }),
      );
    };

    void confirmCloseTerminals(closingFiles).then((ok) => ok && finishClose());
  }, []);

  const onTerminalMetaChange = useCallback(
    (fileId: string, patch: TerminalMetaPatch) => {
      setProjectTerminals((prev) => patchProjectTerminals(prev, fileId, patch));
      setTabs((prev) =>
        prev.map((tab) => updateTerminalTab(tab, fileId, patch)),
      );
    },
    [],
  );

  const onNewTerminalTab = useCallback(() => {
    onOpenTerminal(terminalCwd, true);
  }, [terminalCwd, onOpenTerminal]);

  const onCloseTab = useCallback(
    (id: string, opts?: { confirmedTerminalIds?: string[] }) => {
      const current = tabsRef.current;
      const index = current.findIndex((t) => t.id === id);
      if (index < 0) return;
      const closePlan = planWorkspaceTabClose({
        tabs: current,
        sessions: sessionsRef.current,
        closingTabId: id,
        scope: tabCloseScope,
        worktreeOf: tabWorktreeOf,
      });
      if (closePlan.action === "keep") return;
      const closing = current[index];
      const closingFiles = [
        ...closing.editorPanes.flatMap((pane) => pane.files),
        ...(closing.terminalPanes ?? []).flatMap((pane) => pane.files),
      ];
      const unsaved = closingFiles.filter(
        (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
      );
      const confirmed = new Set(opts?.confirmedTerminalIds ?? []);
      const terminals = closingFiles.filter(
        (file) => file.terminal && !confirmed.has(file.id),
      );

      const finishClose = () => {
        const nextActiveTabId = closePlan.nextActiveTabId;
        const next = current.filter((t) => t.id !== id);
        const gone = new Set(
          leafIds(closing.layout).filter((paneId) =>
            sessionsRef.current.some((session) => session.id === paneId),
          ),
        );
        for (const sessionId of gone) {
          persistSession(sessionsRef.current.find((s) => s.id === sessionId));
          rememberRemoteSession(sessionId);
          rememberRemotePendingWorktree(sessionId);
        }
        setDirtyFiles((prev) => {
          const updated = new Set(prev);
          for (const file of closingFiles) updated.delete(file.id);
          return updated;
        });
        setTabs(next);
        if (id === activeTabIdRef.current && nextActiveTabId) {
          activateTab(nextActiveTabId);
        }
        void refreshHistory(sidebarCwd);
      };

      void (async () => {
        if (unsaved.length > 0) {
          const ok = await confirmDiscardUnsaved(
            "Close this tab with unsaved files?",
          );
          if (!ok) return;
        }
        if (terminals.length > 0) {
          const ok = await confirmCloseTerminals(terminals);
          if (!ok) return;
        }
        finishClose();
      })();
    },
    [activateTab, persistSession, refreshHistory, sidebarCwd, tabCloseScope],
  );

  const onCloseTabs = useCallback(
    (ids: string[], fallbackId: string, opts?: { confirmed?: boolean }) => {
      const current = tabsRef.current;
      const closingIds = new Set(ids);
      const closing = current.filter((tab) => closingIds.has(tab.id));
      const fallback = current.find(
        (tab) => tab.id === fallbackId && !closingIds.has(tab.id),
      );
      if (!fallback || closing.length === 0) return;

      const closingFiles = closing.flatMap((tab) => [
        ...tab.editorPanes.flatMap((pane) => pane.files),
        ...(tab.terminalPanes ?? []).flatMap((pane) => pane.files),
      ]);
      const unsaved = closingFiles.filter(
        (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
      );
      const terminals = closingFiles.filter((file) => file.terminal);

      const finishClose = () => {
        const sessionIds = new Set(
          closing.flatMap((tab) =>
            leafIds(tab.layout).filter((paneId) =>
              sessionsRef.current.some((session) => session.id === paneId),
            ),
          ),
        );
        for (const sessionId of sessionIds) {
          persistSession(
            sessionsRef.current.find((session) => session.id === sessionId),
          );
          rememberRemoteSession(sessionId);
          rememberRemotePendingWorktree(sessionId);
        }
        setDirtyFiles((prev) => {
          const next = new Set(prev);
          for (const file of closingFiles) next.delete(file.id);
          return next;
        });
        setTabs((prev) => prev.filter((tab) => !closingIds.has(tab.id)));
        if (closingIds.has(activeTabIdRef.current)) activateTab(fallback.id);
        void refreshHistory(sidebarCwd);
      };

      // The caller already confirmed unsaved files and terminals.
      if (opts?.confirmed) {
        finishClose();
        return;
      }

      void (async () => {
        if (unsaved.length > 0) {
          const ok = await confirmDiscardUnsaved(
            "Close these tabs with unsaved files?",
          );
          if (!ok) return;
        }
        if (terminals.length > 0) {
          const ok = await confirmCloseTerminals(terminals);
          if (!ok) return;
        }
        finishClose();
      })();
    },
    [activateTab, persistSession, refreshHistory, sidebarCwd],
  );

  const onCloseOtherTabs = useCallback(() => {
    const current = tabsRef.current;
    const activeId = activeTabIdRef.current;
    if (!current.some((tab) => tab.id === activeId)) return;
    onCloseTabs(
      current.filter((tab) => tab.id !== activeId).map((tab) => tab.id),
      activeId,
    );
  }, [onCloseTabs]);

  const onCloseFile = useCallback(
    (paneId: string, fileId: string) => {
      const tab = tabsRef.current.find((entry) =>
        findSurfacePane(entry, paneId),
      );
      if (!tab) return;
      const found = findSurfacePane(tab, paneId);
      if (!found) return;
      const { kind, pane } = found;
      const index = pane.files.findIndex((file) => file.id === fileId);
      if (index < 0) return;
      const file = pane.files[index];
      const needsUnsavedConfirm =
        isFilesystemTab(file) && dirtyFilesRef.current.has(fileId);

      const finishClose = () => {
        const files = pane.files.filter((entry) => entry.id !== fileId);
        let nextFocus = tab.focusedId;
        let nextLayout = tab.layout;
        let nextPanes = surfacePanes(tab, kind);
        if (files.length > 0) {
          nextFocus = paneId;
          const activeFileId =
            pane.activeFileId === fileId
              ? files[Math.min(index, files.length - 1)].id
              : pane.activeFileId;
          nextPanes = nextPanes.map((entry) =>
            entry.id === paneId ? { ...entry, files, activeFileId } : entry,
          );
        } else {
          const sibling = siblingLeafId(tab.layout, paneId);
          const withoutPane = removePane(tab.layout, paneId);
          if (!withoutPane) {
            setDirtyFiles((prev) => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            const closePlan = planWorkspaceTabClose({
              tabs: tabsRef.current,
              sessions: sessionsRef.current,
              closingTabId: tab.id,
              scope: tabCloseScope,
              worktreeOf: tabWorktreeOf,
            });
            if (closePlan.action === "close") {
              onCloseTab(
                tab.id,
                file.terminal ? { confirmedTerminalIds: [fileId] } : undefined,
              );
              return;
            }
            const seed = sessionsRef.current[0];
            const session = newSession(
              seed?.harness ?? "claude",
              file.appView ? projectCwd : file.cwd || projectCwd,
              seed?.model,
              seed?.runtimeMode,
              seed?.modelSettings,
            );
            setSessions((prev) => [...prev, session]);
            setTabs((prev) =>
              prev.map((entry) =>
                entry.id === tab.id
                  ? {
                      ...entry,
                      layout: leaf(session.id),
                      focusedId: session.id,
                      editorPanes: [],
                      terminalPanes: [],
                      diffOpen: false,
                      diffFocused: false,
                    }
                  : entry,
              ),
            );
            setComposerFocused(true);
            return;
          }
          nextLayout = withoutPane;
          nextFocus =
            tab.focusedId === paneId
              ? (sibling ?? firstLeafId(withoutPane))
              : tab.focusedId;
          nextPanes = nextPanes.filter((entry) => entry.id !== paneId);
        }

        setTabs((prev) =>
          prev.map((entry) =>
            entry.id === tab.id
              ? withSurfacePanes(
                  {
                    ...entry,
                    layout: nextLayout,
                    focusedId: nextFocus,
                  },
                  kind,
                  nextPanes,
                )
              : entry,
          ),
        );
        setDirtyFiles((prev) => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
        if (tab.id === activeTabId && files.length === 0) {
          setComposerFocused(
            sessionsRef.current.some((session) => session.id === nextFocus),
          );
        }
      };

      void (async () => {
        if (needsUnsavedConfirm) {
          const ok = await confirmDiscardUnsaved(
            `Close ${basename(file.path)} without saving?`,
          );
          if (!ok) return;
        }
        if (file.terminal) {
          const ok = await confirmCloseTerminal(file);
          if (!ok) return;
        }
        finishClose();
      })();
    },
    [activeTabId, onCloseTab, projectCwd, tabCloseScope],
  );

  useEffect(() => {
    if (!notesEnabled && appPage === "notes") closeAppPage();
  }, [notesEnabled, appPage, closeAppPage]);

  const onCloseOtherFiles = useCallback((paneId: string, fileId: string) => {
    const tab = tabsRef.current.find((entry) => findSurfacePane(entry, paneId));
    if (!tab) return;
    const found = findSurfacePane(tab, paneId);
    if (!found?.pane.files.some((file) => file.id === fileId)) return;
    const closingFiles = found.pane.files.filter((file) => file.id !== fileId);
    if (closingFiles.length === 0) return;
    const closingIds = new Set(closingFiles.map((file) => file.id));
    const unsaved = closingFiles.filter(
      (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
    );
    const terminals = closingFiles.filter((file) => file.terminal);

    const finishClose = () => {
      setTabs((prev) =>
        prev.map((entry) => {
          if (entry.id !== tab.id) return entry;
          const current = findSurfacePane(entry, paneId);
          if (!current?.pane.files.some((file) => file.id === fileId)) {
            return entry;
          }
          return withSurfacePanes(
            { ...entry, focusedId: paneId },
            current.kind,
            surfacePanes(entry, current.kind).map((pane) =>
              pane.id === paneId
                ? {
                    ...pane,
                    files: pane.files.filter(
                      (file) => !closingIds.has(file.id),
                    ),
                    activeFileId: fileId,
                  }
                : pane,
            ),
          );
        }),
      );
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        for (const id of closingIds) next.delete(id);
        return next;
      });
    };

    void (async () => {
      if (unsaved.length > 0) {
        const ok = await confirmDiscardUnsaved(
          "Close other tabs with unsaved files?",
        );
        if (!ok) return;
      }
      if (terminals.length > 0) {
        const ok = await confirmCloseTerminals(terminals);
        if (!ok) return;
      }
      finishClose();
    })();
  }, []);

  const onClearTabSession = useCallback(
    (id: string) => {
      const tab = tabs.find((entry) => entry.id === id);
      if (!tab || isBlankWorkspaceTab(tab, sessionsRef.current)) return;

      const closingFiles = [
        ...tab.editorPanes.flatMap((pane) => pane.files),
        ...(tab.terminalPanes ?? []).flatMap((pane) => pane.files),
      ];
      const unsaved = closingFiles.filter(
        (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
      );

      const oldSessionId = leafIds(tab.layout).find((paneId) =>
        sessionsRef.current.some((session) => session.id === paneId),
      );
      const oldSession = sessionsRef.current.find(
        (session) => session.id === oldSessionId,
      );
      if (!oldSession) return;

      const finishClear = () => {
        persistSession(oldSession);
        for (const shellId of leafIds(tab.layout)) {
          rememberRemoteSession(shellId);
          rememberRemotePendingWorktree(shellId);
        }

        // The blank replacement stays in the tab's worktree, so clearing the
        // last tab there does not switch the workspace back to the project.
        const workspace = tabWorkspace(tab, sessionsRef.current);
        const focus = worktreeFocus(oldSession.cwd);
        const session = {
          ...newSession(
            oldSession.harness,
            oldSession.cwd,
            oldSession.model,
            oldSession.runtimeMode,
            oldSession.modelSettings,
          ),
          ...(workspace && !sameProjectPath(workspace, oldSession.cwd)
            ? {
                worktreeCwd: workspace,
                branch:
                  (focus && sameProjectPath(focus.path, workspace)
                    ? focus.branch
                    : undefined) ??
                  (oldSession.worktreeCwd &&
                  sameProjectPath(oldSession.worktreeCwd, workspace)
                    ? oldSession.branch
                    : undefined) ??
                  undefined,
              }
            : {}),
        };

        setSessions((prev) => [...prev, session]);
        setDirtyFiles((prev) => {
          const updated = new Set(prev);
          for (const file of closingFiles) updated.delete(file.id);
          return updated;
        });
        setTabs((prev) =>
          prev.map((entry) =>
            entry.id === id ? resetTabToSession(entry, session.id) : entry,
          ),
        );
        setComposerFocused(true);
        void refreshHistory(sidebarCwd);
      };

      if (unsaved.length === 0) {
        finishClear();
        return;
      }
      void confirmDiscardUnsaved(
        "Close this conversation with unsaved files?",
      ).then((ok) => ok && finishClear());
    },
    [tabs, persistSession, refreshHistory, sidebarCwd],
  );

  const onRemoteSessionDeleted = useCallback(
    (remoteSessionId: string, project?: string) => {
      const tab = tabsRef.current.find((entry) =>
        leafIds(entry.layout).some(
          (shellId) =>
            remoteSessionFor(shellId) === remoteSessionId &&
            (!project ||
              sessionsRef.current.some(
                (session) =>
                  session.id === shellId &&
                  sameProjectPath(session.cwd, project),
              )),
        ),
      );
      if (!tab) return;
      const closePlan = planWorkspaceTabClose({
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        closingTabId: tab.id,
        scope: tabCloseScope,
        worktreeOf: tabWorktreeOf,
      });
      if (closePlan.action === "keep") onClearTabSession(tab.id);
      else onCloseTab(tab.id);
    },
    [onClearTabSession, onCloseTab, tabCloseScope],
  );

  const onCloseAllTabs = useCallback(() => {
    const tab = tabsRef.current.find(
      (entry) => entry.id === activeTabIdRef.current,
    );
    if (!tab) return;

    const seedSession = (cwd: string) => {
      const seed = sessionsRef.current[0];
      return newSession(
        seed?.harness ?? "claude",
        cwd,
        seed?.model,
        seed?.runtimeMode,
        seed?.modelSettings,
      );
    };

    // Stage one: files open in the active tab's editor panes close first.
    // Only when none are open does the command close every workspace tab.
    const editorFiles = tab.editorPanes.flatMap((pane) => pane.files);
    if (editorFiles.length > 0) {
      const remaining = closeSurfacePanes(tab, "editor");
      if (!remaining) {
        const closePlan = planWorkspaceTabClose({
          tabs: tabsRef.current,
          sessions: sessionsRef.current,
          closingTabId: tab.id,
          scope: tabCloseScope,
          worktreeOf: tabWorktreeOf,
        });
        if (closePlan.action === "close") {
          onCloseTab(tab.id);
          return;
        }
      }
      const unsaved = editorFiles.filter(
        (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
      );

      const finishClose = () => {
        let nextTab: WorkspaceTab;
        let focusesSession: boolean;
        if (remaining) {
          nextTab = remaining;
          focusesSession = sessionsRef.current.some(
            (session) => session.id === remaining.focusedId,
          );
        } else {
          // The tab held only editor panes and must stay: seed a session.
          const session = seedSession(
            editorFiles[0].appView
              ? projectCwdRef.current
              : editorFiles[0].cwd || projectCwd,
          );
          setSessions((prev) => [...prev, session]);
          nextTab = resetTabToSession(tab, session.id);
          focusesSession = true;
        }
        setTabs((prev) =>
          prev.map((entry) => (entry.id === tab.id ? nextTab : entry)),
        );
        setDirtyFiles((prev) => {
          const updated = new Set(prev);
          for (const file of editorFiles) updated.delete(file.id);
          return updated;
        });
        setComposerFocused(focusesSession);
      };

      void (async () => {
        if (unsaved.length > 0) {
          const ok = await confirmDiscardUnsaved(
            "Close all open files with unsaved changes?",
          );
          if (!ok) return;
        }
        finishClose();
      })();
      return;
    }

    // Stage two: the workspace always keeps one tab, so close every other
    // tab and reset the active one to a blank session. Every confirmation
    // runs before any tab changes, so a cancelled prompt leaves all tabs.
    const otherIds = tabsRef.current
      .filter((entry) => entry.id !== tab.id)
      .map((entry) => entry.id);
    const terminalFiles = (tab.terminalPanes ?? []).flatMap(
      (pane) => pane.files,
    );
    const closingFiles = [
      ...tabsRef.current
        .filter((entry) => otherIds.includes(entry.id))
        .flatMap((entry) => [
          ...entry.editorPanes.flatMap((pane) => pane.files),
          ...(entry.terminalPanes ?? []).flatMap((pane) => pane.files),
        ]),
      ...terminalFiles,
    ];
    const unsaved = closingFiles.filter(
      (file) => isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
    );
    const terminals = closingFiles.filter((file) => file.terminal);

    void (async () => {
      if (unsaved.length > 0) {
        const ok = await confirmDiscardUnsaved(
          "Close all tabs with unsaved files?",
        );
        if (!ok) return;
      }
      if (terminals.length > 0) {
        const ok = await confirmCloseTerminals(terminals);
        if (!ok) return;
      }
      if (otherIds.length > 0) {
        onCloseTabs(otherIds, tab.id, { confirmed: true });
      }
      const hasSession = leafIds(tab.layout).some((paneId) =>
        sessionsRef.current.some((session) => session.id === paneId),
      );
      if (hasSession) {
        // No editor files remain, so this commits without a prompt.
        onClearTabSession(tab.id);
        return;
      }
      // The tab held no session: seed one so the workspace stays usable.
      const session = seedSession(terminalFiles[0]?.cwd || projectCwd);
      setSessions((prev) => [...prev, session]);
      setTabs((prev) =>
        prev.map((entry) =>
          entry.id === tab.id ? resetTabToSession(entry, session.id) : entry,
        ),
      );
      setComposerFocused(true);
    })();
  }, [onCloseTab, onCloseTabs, onClearTabSession, projectCwd, tabCloseScope]);

  const onClosePane = useCallback(
    (sessionId?: string) => {
      // The project terminal is shared by every workspace tab in the project.
      // Keep the global close command scoped to workspace tabs and panes even
      // while the dock has focus; terminal tabs have their own close buttons.
      if (!activeTab) return;
      const focusedSurface = findSurfacePane(activeTab, activeTab.focusedId);
      if (sessionId === undefined && focusedSurface) {
        onCloseFile(focusedSurface.pane.id, focusedSurface.pane.activeFileId);
        return;
      }
      const closingId = sessionId ?? activeTab.focusedId;
      const ids = leafIds(activeTab.layout);
      const sessionIds = ids.filter((paneId) =>
        sessionsRef.current.some((session) => session.id === paneId),
      );
      if (!sessionIds.includes(closingId)) return;
      const nextTab = closeLeaf(activeTab, closingId);
      if (!nextTab || sessionIds.length === 1) {
        const closePlan = planWorkspaceTabClose({
          tabs: tabsRef.current,
          sessions: sessionsRef.current,
          closingTabId: activeTab.id,
          scope: tabCloseScope,
          worktreeOf: tabWorktreeOf,
        });
        if (closePlan.action === "keep") onClearTabSession(activeTab.id);
        else onCloseTab(activeTab.id);
        return;
      }
      persistSession(sessionsRef.current.find((s) => s.id === closingId));
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? { ...t, layout: nextTab.layout, focusedId: nextTab.focusedId }
            : t,
        ),
      );
      if (closingId === activeTab.focusedId) {
        setComposerFocused(
          nextTab &&
            sessionsRef.current.some(
              (session) => session.id === nextTab.focusedId,
            ),
        );
      }
      void refreshHistory(sidebarCwd);
    },
    [
      activeTab,
      onCloseFile,
      onCloseTab,
      onClearTabSession,
      persistSession,
      refreshHistory,
      sidebarCwd,
      tabCloseScope,
    ],
  );

  const onCloseTitleTab = useCallback(
    (id: string) => {
      const closePlan = planWorkspaceTabClose({
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        closingTabId: id,
        scope: tabCloseScope,
        worktreeOf: tabWorktreeOf,
      });
      if (closePlan.action === "keep" && id === activeTabIdRef.current) {
        onClosePane();
        return;
      }
      onCloseTab(id);
    },
    [onClosePane, onCloseTab, tabCloseScope],
  );

  /** Open tabs per workspace in the sidebar's project, keyed by worktree
   * path, so the switcher can show what each worktree still has open. */
  const nextWorktreeTabStats = useMemo(() => {
    const stats = new Map<string, { tabs: number; busy: boolean }>();
    if (!sidebarCwd || sidebarCwd === "~" || isRemoteProjectPath(sidebarCwd))
      return stats;
    for (const tab of filterTabsForProject(tabs, sessions, sidebarCwd)) {
      if (isAppViewOnlyTab(tab)) continue;
      const workspace = tabWorkspace(tab, sessions) ?? sidebarCwd;
      const key = pathKey(workspace);
      const entry = stats.get(key) ?? { tabs: 0, busy: false };
      entry.tabs += 1;
      entry.busy ||= leafIds(tab.layout).some(
        (id) => sessions.find((session) => session.id === id)?.busy,
      );
      stats.set(key, entry);
    }
    return stats;
  }, [tabs, sessions, sidebarCwd, tabWorkspace, workspaceNavigation.revision]);
  // Rebuilt on every streamed frame; the sidebar only cares when counts move.
  const worktreeTabStatsRef = useRef(nextWorktreeTabStats);
  if (
    !sameWorktreeTabStats(worktreeTabStatsRef.current, nextWorktreeTabStats)
  ) {
    worktreeTabStatsRef.current = nextWorktreeTabStats;
  }
  const worktreeTabStats = worktreeTabStatsRef.current;
  const nextDeckProjectTabs = useMemo(() => {
    // A projectless session belongs to no project, so it stands on its own
    // rather than trailing the last project's tabs.
    const active = tabs.find((tab) => tab.id === activeTabId);
    if (
      active &&
      !isAppViewOnlyTab(active) &&
      !workspaceTabCwd(active, sessions)
    )
      return [active, ...tabs.filter(isAppViewOnlyTab)];
    // Each worktree keeps its own tabs; the others stay open, just hidden.
    const worktree = projectWorktree?.path ?? projectCwd;
    return filterTabsForProject(tabs, sessions, projectCwd).filter((tab) => {
      if (tab.id === activeTabId) return true;
      const workspace = tabWorkspace(tab, sessions);
      return !workspace || sameProjectPath(workspace, worktree);
    });
  }, [
    activeTabId,
    tabs,
    sessions,
    projectCwd,
    projectWorktree?.path,
    tabWorkspace,
    workspaceNavigation.revision,
  ]);
  // Rebuilt on every streamed frame; tab navigation callbacks key off it.
  const deckProjectTabsRef = useRef(nextDeckProjectTabs);
  if (!sameItems(deckProjectTabsRef.current, nextDeckProjectTabs)) {
    deckProjectTabsRef.current = nextDeckProjectTabs;
  }
  const deckProjectTabs = deckProjectTabsRef.current;

  const onNext = useCallback(() => {
    const index = deckProjectTabs.findIndex((t) => t.id === activeTabId);
    if (index >= 0)
      activateTab(deckProjectTabs[(index + 1) % deckProjectTabs.length].id);
  }, [activateTab, activeTabId, deckProjectTabs]);

  const onPrev = useCallback(() => {
    const index = deckProjectTabs.findIndex((t) => t.id === activeTabId);
    if (index >= 0) {
      activateTab(
        deckProjectTabs[
          (index - 1 + deckProjectTabs.length) % deckProjectTabs.length
        ].id,
      );
    }
  }, [activateTab, activeTabId, deckProjectTabs]);

  const onActivate = useCallback(
    (slot: number) => {
      const tab =
        slot < 0
          ? deckProjectTabs[deckProjectTabs.length - 1]
          : deckProjectTabs[slot];
      if (tab) activateTab(tab.id);
    },
    [activateTab, deckProjectTabs],
  );

  const onFocusPane = useCallback(
    (paneId: string) => {
      if (
        tabsRef.current.find((tab) => tab.id === activeTabIdRef.current)
          ?.focusedId !== paneId
      )
        workspaceNavigation.cancel();
      setProjectTerminalFocused(false);
      if (inboxAskPortal?.sessionId === paneId) {
        setComposerFocused(true);
        return;
      }
      // Refocusing the already-focused pane must keep the same tabs array, or
      // every click inside a pane re-renders the whole workspace.
      setTabs((prev) => {
        const current = prev.find((t) => t.id === activeTabId);
        if (!current || (current.focusedId === paneId && !current.diffFocused))
          return prev;
        return prev.map((t) =>
          t === current ? { ...t, focusedId: paneId, diffFocused: false } : t,
        );
      });
      setComposerFocused(
        sessionsRef.current.some((session) => session.id === paneId),
      );
    },
    [activeTabId, inboxAskPortal],
  );

  const onOpenDiff = useCallback(
    (
      path?: string,
      session?: { sessionId: string; cwd: string },
      changeKind?: GitFileDiffKind,
      pin = false,
      options?: { exact?: boolean },
    ) => {
      void (async () => {
        const diffCwd = session?.cwd ?? gitCwdRef.current;
        const diffProjectCwd = session
          ? sessionsRef.current.find((entry) => entry.id === session.sessionId)
              ?.cwd
          : sidebarCwdRef.current;
        const target = session
          ? tabsRef.current.find((tab) =>
              leafIds(tab.layout).includes(session.sessionId),
            )
          : ensureContentTab(diffProjectCwd ?? projectCwdRef.current);
        if (!target) return;
        const ownerSessionId =
          session?.sessionId ??
          leafIds(target.layout).find((id) =>
            sessionsRef.current.some((entry) => entry.id === id),
          );
        const initialMode =
          target.surfaceMode ??
          (loadFileTabMode() === "workspace" ? "unified" : "split");
        const resolved = path
          ? options?.exact
            ? path
            : ((await resolveTabResource(
                target.id,
                resolveOpenablePath(diffCwd, path),
              )) ?? path)
          : undefined;
        if (
          !tabsRef.current.some(
            (tab) =>
              tab.id === target.id &&
              (!ownerSessionId || leafIds(tab.layout).includes(ownerSessionId)),
          )
        )
          return;
        if (resolved) rememberOpenedFile(diffCwd, resolved);
        setTabs((prev) =>
          prev.map((tab) => {
            if (
              tab.id !== target.id ||
              (ownerSessionId && !leafIds(tab.layout).includes(ownerSessionId))
            )
              return tab;
            tab = { ...tab, surfaceMode: tab.surfaceMode ?? initialMode };
            if (session) {
              return openSessionChangesTab(
                tab,
                session.cwd,
                session.sessionId,
                resolved,
                diffProjectCwd,
                pin,
              );
            }
            if (loadDiffViewer() === "unified") {
              return openChangesTab(
                tab,
                diffCwd,
                resolved,
                changeKind,
                diffProjectCwd,
              );
            }
            if (!resolved) return tab;
            return openEditorTab(
              tab,
              newFileTab(resolved, diffCwd, true, changeKind, diffProjectCwd),
              { pin },
            );
          }),
        );
        if (activeTabIdRef.current !== target.id) return;
        setSidebarTab("changes", diffProjectCwd);
        setComposerFocused(false);
      })();
    },
    [ensureContentTab],
  );

  const onOpenWorkingTreeDiff = useCallback(
    (path: string, kind?: GitFileDiffKind, pin?: boolean) =>
      onOpenDiff(path, undefined, kind, pin, { exact: true }),
    [onOpenDiff],
  );

  /** Stack one section's working-tree changes in one review, whatever the diff-view setting. */
  const onOpenAllChanges = useCallback(
    (kind: GitFileDiffKind) => {
      const target = ensureContentTab(sidebarCwdRef.current);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === target.id
            ? openChangesTab(
                {
                  ...tab,
                  surfaceMode:
                    tab.surfaceMode ??
                    (loadFileTabMode() === "workspace" ? "unified" : "split"),
                },
                gitCwdRef.current,
                undefined,
                kind,
                sidebarCwdRef.current,
              )
            : tab,
        ),
      );
      setComposerFocused(false);
    },
    [ensureContentTab],
  );

  const onOpenCommit = useCallback(
    (commit: GitHistoryCommit, pin?: boolean) => {
      const target = ensureContentTab(sidebarCwdRef.current);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === target.id
            ? openCommitTab(
                {
                  ...tab,
                  surfaceMode:
                    tab.surfaceMode ??
                    (loadFileTabMode() === "workspace" ? "unified" : "split"),
                },
                gitCwdRef.current,
                {
                  sha: commit.sha,
                  shortSha: commit.shortSha,
                  subject: commit.subject,
                },
                sidebarCwdRef.current,
                pin,
              )
            : tab,
        ),
      );
      setComposerFocused(false);
    },
    [ensureContentTab],
  );

  const onShowSourceControl = useCallback(() => {
    setSessionSidebarOpen(true);
    saveSessionSidebarOpen(true);
    setSidebarTab("changes");
  }, []);

  const onToggleChanges = useCallback(() => {
    onShowSourceControl();
  }, [onShowSourceControl]);

  const onReorderFiles = useCallback((paneId: string, ids: string[]) => {
    setTabs((prev) =>
      prev.map((tab) => {
        const found = findSurfacePane(tab, paneId);
        if (!found) return tab;
        return withSurfacePanes(
          tab,
          found.kind,
          surfacePanes(tab, found.kind).map((pane) =>
            pane.id === paneId
              ? { ...pane, files: orderByIds(pane.files, ids) }
              : pane,
          ),
        );
      }),
    );
  }, []);

  const onMovePane = useCallback(
    (fromId: string, toId: string, edge: PaneEdge) => {
      setTabs((prev) =>
        prev.map((tab) => {
          return leafIds(tab.layout).includes(fromId)
            ? {
                ...tab,
                layout: movePane(tab.layout, fromId, toId, edge),
                focusedId: fromId,
              }
            : tab;
        }),
      );
    },
    [],
  );

  /** The project dock's terminals become one pane in the split; the dock closes. */
  const onMoveDockToPane = useCallback((targetId: string, edge: PaneEdge) => {
    const projectPath = projectCwdRef.current;
    const dock = findProjectTerminal(projectTerminalsRef.current, projectPath);
    const tab = tabsRef.current.find((entry) =>
      leafIds(entry.layout).includes(targetId),
    );
    if (!dock || !tab) return;
    const moved = moveDockToPane(tab, dock, targetId, edge);
    if (!moved) return;
    const nextTabs = tabsRef.current.map((entry) =>
      entry.id === tab.id ? moved : entry,
    );
    const nextDocks = projectTerminalsRef.current.filter(
      (entry) => entry !== dock,
    );
    tabsRef.current = nextTabs;
    projectTerminalsRef.current = nextDocks;
    setTabs(nextTabs);
    setProjectTerminals(nextDocks);
    setProjectTerminalFocused(false);
  }, []);

  /** A split terminal pane returns to the project's dock, opening one if needed. */
  const onMovePaneToDock = useCallback(
    (paneId: string) => {
      const projectPath = projectCwdRef.current;
      if (!isLocalProject(projectPath)) return;
      const tab = tabsRef.current.find((entry) =>
        (entry.terminalPanes ?? []).some((pane) => pane.id === paneId),
      );
      if (!tab) return;
      const moved = movePaneToDock(
        tab,
        projectTerminalsRef.current,
        paneId,
        projectPath,
        lastDockSideRef.current ?? "bottom",
        { width: window.innerWidth, height: window.innerHeight },
      );
      if (!moved) return;
      const nextTabs = tabsRef.current.map((entry) =>
        entry.id === tab.id ? moved.tab : entry,
      );
      tabsRef.current = nextTabs;
      projectTerminalsRef.current = moved.docks;
      setTabs(nextTabs);
      setProjectTerminals(moved.docks);
      focusProjectTerminal();
    },
    [focusProjectTerminal],
  );

  const focusOpenSession = useCallback(
    (sessionId: string) => {
      const tab = findOpenSessionTab(
        tabsRef.current,
        sessionsRef.current,
        sessionId,
      );
      if (!tab) return false;
      loadedSessionCache.current.delete(sessionId);
      const multipleChats =
        leafIds(tab.layout).filter((id) =>
          sessionsRef.current.some((session) => session.id === id),
        ).length > 1;
      activateTab(tab.id, multipleChats ? sessionId : undefined);
      return true;
    },
    [activateTab],
  );

  const replaceBlankPaneWithSession = useCallback((session: Session) => {
    const tab =
      tabsRef.current.find((entry) => entry.id === activeTabIdRef.current) ??
      tabsRef.current[0];
    if (!tab) return false;

    // A blank conversation can already own open documents or an unsent draft.
    // Replacing it would transfer those surfaces to a different conversation.
    if (tabHasSessionResources(tab)) return false;

    const paneId = canDiscardEmptySession(tab.focusedId)
      ? tab.focusedId
      : leafIds(tab.layout).find((id) =>
          canDiscardEmptySession(id),
        );
    if (!paneId || paneId === session.id) return false;

    lastPersisted.current.delete(paneId);
    {
      const blank = sessionsRef.current.find((entry) => entry.id === paneId);
      if (blank) void forgetHarnessSession(blank.harness, paneId);
    }
    setSessions((prev) => {
      const next = prev.filter((entry) => entry.id !== paneId);
      return next.some((entry) => entry.id === session.id)
        ? next
        : [...next, session];
    });
    setTabs((prev) =>
      prev.map((entry) =>
        entry.id === tab.id
          ? {
              ...entry,
              layout: replaceLeafId(entry.layout, paneId, session.id),
              focusedId: session.id,
            }
          : entry,
      ),
    );
    setActiveTabId(tab.id);
    setComposerFocused(true);
    return true;
  }, []);

  const invalidateLoadedSession = useCallback((sessionId: string) => {
    openingSessionIds.current.delete(sessionId);
    loadedSessionCache.current.delete(sessionId);
    sessionLoads.current.delete(sessionId);
    sessionLoadEpochs.current.set(
      sessionId,
      (sessionLoadEpochs.current.get(sessionId) ?? 0) + 1,
    );
  }, []);

  const loadStoredSession = useCallback(
    (sessionId: string): Promise<Session | null> => {
      const cached = loadedSessionCache.current.get(sessionId);
      if (cached) {
        // The cache owns closed sessions only. Transfer this reference into
        // live state instead of retaining a stale duplicate while it changes.
        loadedSessionCache.current.delete(sessionId);
        return Promise.resolve(cached);
      }

      const pending = sessionLoads.current.get(sessionId);
      if (pending) return pending;

      const epoch = sessionLoadEpochs.current.get(sessionId) ?? 0;
      const loading = getSession(sessionId)
        .then((loaded) => {
          if (
            !loaded ||
            removingSessionIds.current.has(sessionId) ||
            (sessionLoadEpochs.current.get(sessionId) ?? 0) !== epoch
          ) {
            return null;
          }
          return loaded;
        })
        .catch(() => null);
      sessionLoads.current.set(sessionId, loading);
      void loading.then(() => {
        if (sessionLoads.current.get(sessionId) === loading) {
          sessionLoads.current.delete(sessionId);
        }
      });
      return loading;
    },
    [],
  );

  const ensureOpenSession = useCallback(
    async (sessionId: string): Promise<Session | null> => {
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (open) return open;

      openingSessionIds.current.add(sessionId);
      const restored = await loadStoredSession(sessionId);
      if (!restored || removingSessionIds.current.has(sessionId)) {
        openingSessionIds.current.delete(sessionId);
        void refreshHistory(sidebarCwd);
        return null;
      }
      loadedSessionCache.current.delete(sessionId);
      const appeared = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (appeared) return appeared;
      if (
        !sessionUsesHost(restored) &&
        !restored.worktreeRemoved &&
        restored.providerSessionId &&
        isLiveHarness(restored.harness)
      ) {
        bindHarnessSession(
          restored.harness,
          restored.id,
          restored.providerSessionId,
          sessionWorkCwd(restored),
          restored.providerAccountId,
          restored.blocks,
          restored.nativeSession,
        );
      }
      lastPersisted.current.set(restored.id, persistFingerprint(restored));
      if (!sessionsRef.current.some((session) => session.id === restored.id)) {
        const next = [...sessionsRef.current, restored];
        sessionsRef.current = next;
        setSessions(next);
      }
      return restored;
    },
    [loadStoredSession, refreshHistory, sidebarCwd],
  );

  const onPrefetchHistorySession = useCallback(
    (sessionId: string) => {
      if (
        removingSessionIds.current.has(sessionId) ||
        sessionsRef.current.some((session) => session.id === sessionId) ||
        loadedSessionCache.current.has(sessionId) ||
        sessionLoads.current.has(sessionId) ||
        activeSessionPrefetch.current
      ) {
        return;
      }
      const loading = loadStoredSession(sessionId);
      activeSessionPrefetch.current = loading;
      void loading.then((loaded) => {
        if (
          loaded &&
          !removingSessionIds.current.has(sessionId) &&
          !sessionsRef.current.some((session) => session.id === sessionId)
        ) {
          rememberLoadedSession(loadedSessionCache.current, loaded);
        }
        if (activeSessionPrefetch.current === loading) {
          activeSessionPrefetch.current = null;
        }
      });
    },
    [loadStoredSession],
  );

  const revealLinkedSessionUpdate = useCallback(
    (sessionId: string, update: LinkedSessionUpdate) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      if (!session?.linkedWorkItem) return;
      if (
        session.linkedWorkItemUpdateCard?.updatedAt === update.updatedAt &&
        session.linkedWorkItemUpdateCard.status !== "error"
      ) {
        return;
      }
      if (
        linkedWorkItemActivityFetches.current.get(sessionId) ===
        update.updatedAt
      ) {
        return;
      }
      const pending = pendingLinkedWorkItemUpdateCard(update);
      linkedWorkItemActivityFetches.current.set(sessionId, update.updatedAt);
      // A stale/error card should not remain visible while fresh details load.
      // The session itself is already open; this request stays fully detached
      // from the navigation path.
      setLinkedWorkItemUpdateCard(sessionId, (current) =>
        current?.updatedAt === update.updatedAt && current.status === "ready"
          ? current
          : undefined,
      );

      void githubWorkItemThread(
        session.cwd,
        session.linkedWorkItem.repo,
        session.linkedWorkItem.kind,
        session.linkedWorkItem.number,
        { force: true },
      ).then(
        (thread) => {
          if (
            linkedWorkItemActivityFetches.current.get(sessionId) !==
            pending.updatedAt
          ) {
            return;
          }
          linkedWorkItemActivityFetches.current.delete(sessionId);
          if (
            linkedSessionUpdatesRef.current.get(sessionId)?.updatedAt !==
            pending.updatedAt
          ) {
            return;
          }
          setLinkedWorkItemUpdateCard(sessionId, () =>
            completeLinkedWorkItemUpdateCard(pending, thread),
          );
        },
        () => {
          if (
            linkedWorkItemActivityFetches.current.get(sessionId) !==
            pending.updatedAt
          ) {
            return;
          }
          linkedWorkItemActivityFetches.current.delete(sessionId);
          if (
            linkedSessionUpdatesRef.current.get(sessionId)?.updatedAt !==
            pending.updatedAt
          ) {
            return;
          }
          setLinkedWorkItemUpdateCard(sessionId, () =>
            failLinkedWorkItemUpdateCard(pending),
          );
        },
      );
    },
    [setLinkedWorkItemUpdateCard],
  );

  const onAskInboxItem = useCallback(
    (item: InboxItem): Promise<string> => {
      const key = inboxAskKey(item);
      const pending = openingInboxSessions.current.get(key);
      if (pending) return pending;
      const opening = (async () => {
        let session = sessionsRef.current.find(
          (entry) => entry.inboxAsk?.key === key,
        );
        if (!session) {
          const candidate = item.projectPath || sidebarCwd;
          const cwd =
            candidate && candidate !== "~"
              ? candidate
              : await invoke<string>("default_cwd");
          const description =
            item.provider === "linear" || item.provider === "jira"
              ? await inboxTrackerDescription(item)
              : item.provider === "gitlab" &&
                  (item.kind === "issue" || item.kind === "pr")
                ? (
                    peekGitlabWorkItemDetails(
                      item.repo,
                      item.kind,
                      item.number,
                    ) ??
                    (await gitlabWorkItemDetails(
                      item.repo,
                      item.kind,
                      item.number,
                    ))
                  ).body
                : item.provider === "azuredevops" &&
                    (item.kind === "issue" || item.kind === "pr")
                  ? (
                      peekAzureDevOpsWorkItemDetails(
                        item.repo,
                        item.kind,
                        item.number,
                      ) ??
                      (await azureDevOpsWorkItemDetails(
                        item.repo,
                        item.kind,
                        item.number,
                      ))
                    ).body
                  : undefined;
          session = {
            ...newDefaultSession(cwd),
            title: `Ask · ${item.title}`,
            inboxAsk: {
              key,
              title: item.title,
              url: item.url,
              provider: item.provider,
              description,
            },
          };
          sessionsRef.current = [...sessionsRef.current, session];
          setSessions(sessionsRef.current);
        }
        return session.id;
      })();
      openingInboxSessions.current.set(key, opening);
      void opening.then(
        () => openingInboxSessions.current.delete(key),
        () => openingInboxSessions.current.delete(key),
      );
      return opening;
    },
    [sidebarCwd],
  );

  const onRestartInboxAsk = useCallback(
    async (item: InboxItem): Promise<string> => {
      const id = await onAskInboxItem(item);
      const current = sessionsRef.current.find((session) => session.id === id)!;
      removingSessionIds.current.add(id);
      try {
        await stopSessionForRemoval(id);
        const stopped =
          sessionsRef.current.find((session) => session.id === id) ?? current;
        await Promise.all(
          sessionChildHarnesses(stopped).map((harness) =>
            forgetHarnessSession(harness, id),
          ),
        );
        const imagePaths = stopped.blocks.flatMap((block) =>
          block.role === "image" && block.image ? [block.image.path] : [],
        );
        await deleteSession(id, imagePaths);
        const fresh = {
          ...newSession(
            stopped.harness,
            stopped.cwd,
            stopped.model,
            stopped.runtimeMode,
            stopped.modelSettings,
          ),
          title: stopped.title,
          inboxAsk: stopped.inboxAsk,
        };
        const next = sessionsRef.current.map((session) =>
          session.id === id ? fresh : session,
        );
        sessionsRef.current = next;
        setSessions(next);
        setInboxAskPortal((portal) =>
          portal?.sessionId === id
            ? { ...portal, sessionId: fresh.id }
            : portal,
        );
        return fresh.id;
      } finally {
        removingSessionIds.current.delete(id);
      }
    },
    [onAskInboxItem, stopSessionForRemoval],
  );

  useEffect(() => {
    if (!inboxAskPortal || !inboxVisible) return;
    setComposerFocused(true);
  }, [inboxAskPortal, inboxVisible]);

  const onSelectHistorySession = useCallback(
    async (
      sessionId: string,
      project?: string,
      opts?: { newColumn?: boolean },
    ) => {
      workspaceNavigation.cancel();
      let session = await ensureOpenSession(sessionId);
      if (project && session && !sameProjectPath(session.cwd, project)) return;
      if (project) setSidebarTab("sessions", project);
      if (!session || session.inboxAsk) return;
      setAppPage(null);
      const parentId =
        session.orchestrationLeadId ??
        orchestrator.forSession(sessionId)?.leadId;
      if (parentId && parentId !== sessionId) {
        setInspectedWorkerId(sessionId);
        session = await ensureOpenSession(parentId);
        if (!session) return;
      }
      if (looksLikeProject(session.cwd))
        setProjectCwd(normalizeProjectPath(session.cwd));
      const linkedUpdate = linkedSessionUpdatesRef.current.get(session.id);
      if (focusOpenSession(session.id)) {
        if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
        return;
      }
      if (replaceBlankPaneWithSession(session)) {
        if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
        return;
      }
      const workspace = tabsRef.current.find(
        (entry) => entry.id === activeTabIdRef.current,
      );
      const anchor = workspace && anchorSessionId(workspace);
      if (opts?.newColumn && workspace && anchor) {
        const opened = session.id;
        setTabs((prev) =>
          prev.map((entry) =>
            entry.id === workspace.id
              ? {
                  ...entry,
                  layout: splitPane(entry.layout, anchor, "right", opened),
                  focusedId: opened,
                  diffFocused: false,
                }
              : entry,
          ),
        );
        setComposerFocused(true);
        if (linkedUpdate) revealLinkedSessionUpdate(opened, linkedUpdate);
        return;
      }
      const tab = newTab(session.id);
      appendTab(tab, session.cwd);
      setActiveTabId(tab.id);
      setComposerFocused(true);
      if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
    },
    [
      appendTab,
      ensureOpenSession,
      focusOpenSession,
      replaceBlankPaneWithSession,
      revealLinkedSessionUpdate,
      setSidebarTab,
    ],
  );

  const openReminderSession = useCallback(
    async (sessionId: string) => {
      const session = await ensureOpenSession(sessionId);
      if (!session)
        throw new Error("This conversation is no longer available.");
      setPaletteOpen(false);
      setSidebarTab("sessions", session.cwd);
      setProjectCwd(session.cwd);
      setRecents(rememberProject(session.cwd));
      await onSelectHistorySession(sessionId);
    },
    [ensureOpenSession, onSelectHistorySession],
  );

  const ensureReminderSessionsSaved = useCallback(
    async (ids: readonly string[]) => {
      for (const id of ids) {
        const session = sessionsRef.current.find(
          (session) => session.id === id,
        );
        if (session && !(await upsertSession(session))) {
          throw new Error(
            "Send a message in this conversation before setting a reminder.",
          );
        }
      }
    },
    [],
  );

  const sessionReminders = useSessionReminders(
    openReminderSession,
    ensureReminderSessionsSaved,
    sessions
      .filter((session) => !session.inboxAsk)
      .map((session) => session.id),
  );

  const dismissNoticesForContinuedSession = useCallback(
    (sessionId: string) => {
      void sessionReminders.dismissDue(sessionId);
      const updatedAt = sessionsRef.current.find(
        (session) => session.id === sessionId,
      )?.linkedWorkItemUpdateCard?.updatedAt;
      if (updatedAt == null) return;
      markLinkedSessionUpdateSeen(sessionId, updatedAt);
      setLinkedWorkItemUpdateCard(sessionId, (card) =>
        card?.updatedAt === updatedAt ? undefined : card,
      );
    },
    [sessionReminders.dismissDue, setLinkedWorkItemUpdateCard],
  );

  const onPlaceSessionOnPane = useCallback(
    async (
      droppedId: string,
      targetId: string,
      edge: PaneEdge,
      hostProject?: string,
    ) => {
      const targetTab = tabsRef.current.find((tab) =>
        leafIds(tab.layout).includes(targetId),
      );
      if (!targetTab) return;
      // A Host session opens through a local shell, as a sidebar click does:
      // reuse the shell already showing it, or bind a new one.
      let sessionId = droppedId;
      if (hostProject) {
        const shell = sessionsRef.current.find(
          (session) =>
            remoteSessionFor(session.id) === droppedId &&
            sameProjectPath(session.cwd, hostProject),
        );
        if (shell) sessionId = shell.id;
        else {
          const created = newDefaultSession(
            hostProject,
            newSessionRuntimeMode,
          );
          rememberRemoteSession(
            created.id,
            droppedId,
            remoteProjectFor(hostProject),
          );
          sessionsRef.current = [...sessionsRef.current, created];
          setSessions(sessionsRef.current);
          sessionId = created.id;
        }
      }
      if (sessionId === targetId) return;

      const alreadyHere = leafIds(targetTab.layout).includes(sessionId);
      if (!alreadyHere) {
        const session = await ensureOpenSession(sessionId);
        if (!session) return;
      }

      const tab = tabsRef.current.find((entry) => entry.id === targetTab.id);
      if (!tab || !leafIds(tab.layout).includes(targetId)) return;

      const replaceTarget =
        !leafIds(tab.layout).includes(sessionId) &&
        canDiscardEmptySession(targetId);

      if (replaceTarget) {
        lastPersisted.current.delete(targetId);
        const blank = sessionsRef.current.find(
          (entry) => entry.id === targetId,
        );
        if (blank) void forgetHarnessSession(blank.harness, targetId);
      }

      const result = applyPlaceSessionOnPane({
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        sessionId,
        targetId,
        edge,
        replaceTarget,
        scope: tabCloseScope,
        createReplacement: (seed) =>
          newDefaultSession(
            seed?.cwd ?? projectCwdRef.current,
            seed?.runtimeMode,
          ),
      });
      if (!result) return;

      sessionsRef.current = result.sessions;
      tabsRef.current = result.tabs;
      setSessions(result.sessions);
      setTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      setProjectTerminalFocused(false);
      setComposerFocused(true);
    },
    [ensureOpenSession, newSessionRuntimeMode, tabCloseScope],
  );

  const onRenameHistorySession = useCallback(
    async (sessionId: string, displayTitle: string) => {
      const editedCwd =
        sessionsRef.current.find((session) => session.id === sessionId)?.cwd ??
        history.find((entry) => entry.id === sessionId)?.cwd ??
        sidebarCwd;
      const trimmed = displayTitle.trim();
      if (!trimmed) return;
      titleCoordinator.current!.cancel(sessionId);
      invalidateLoadedSession(sessionId);

      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (open) {
        const title = formatSessionTitle(open.harness, trimmed);
        const updated = manualSessionTitle(open, title);
        setSessions((prev) =>
          prev.map((session) => (session.id === sessionId ? updated : session)),
        );
        loadedSessionCache.current.delete(sessionId);
        await persistManualSessionTitle(updated, title).catch(() => undefined);
      } else {
        const restored = await getSession(sessionId).catch(() => null);
        if (!restored) {
          void refreshHistory(editedCwd, true);
          return;
        }
        const updated = {
          ...restored,
          ...manualSessionTitle(
            restored,
            formatSessionTitle(restored.harness, trimmed),
          ),
        };
        await persistManualSessionTitle(updated, updated.title).catch(
          () => undefined,
        );
        const saved = await upsertSession(updated).catch(() => null);
        if (saved) {
          rememberLoadedSession(loadedSessionCache.current, updated);
          lastPersisted.current.set(sessionId, persistFingerprint(updated));
        }
      }
      void refreshHistory(editedCwd, true);
    },
    [
      history,
      invalidateLoadedSession,
      persistSession,
      refreshHistory,
      sidebarCwd,
    ],
  );

  const checkOpenWorktreeFiles = useCallback((path: string) => {
    assertWorktreeFilesClosed(path, [
      ...filesInWorkspaceTabs(tabsRef.current),
      ...projectTerminalsRef.current.flatMap((dock) => dock.pane.files),
    ]);
  }, []);

  const onCheckWorktreeRemoval = useCallback(
    async (cwd: string, path: string, force: boolean) => {
      checkOpenWorktreeFiles(path);
      await checkWorktreeRemoval(cwd, path, force);
      // Re-read UI state after the native check, before deleting sessions.
      checkOpenWorktreeFiles(path);
    },
    [checkOpenWorktreeFiles],
  );

  const onRemoveWorktree = useCallback(
    async (cwd: string, path: string, force: boolean, keepSessions = false) => {
      if (removingWorktreePaths.current.has(path)) {
        throw new Error("This worktree is already being deleted.");
      }
      removingWorktreePaths.current.add(path);
      const lockedIds = new Set<string>();
      const forgottenIds = new Set<string>();
      try {
        if (
          [...switchingWorktrees.current.values()].some((target) =>
            isEqualOrInside(target, path),
          )
        ) {
          throw new Error(
            "A session is selecting this worktree. Try deleting it again once selection finishes.",
          );
        }
        await onCheckWorktreeRemoval(cwd, path, force);
        const listed = await listWorktrees(cwd);
        const tree = listed.worktrees.find(
          (entry) => pathKey(entry.path) === pathKey(path),
        );
        if (!tree) throw new Error("This worktree is no longer available.");
        const ids = worktreeSessionIds(tree, sessionsRef.current);
        if (!keepSessions && ids.length) {
          throw new Error(
            "Move or delete the sessions using this worktree first.",
          );
        }
        if (
          ids.some(
            (id) =>
              removingSessionIds.current.has(id) ||
              switchingWorktrees.current.has(id),
          )
        ) {
          throw new Error(
            "Wait for these sessions to finish changing before deleting the worktree.",
          );
        }
        for (const id of ids) {
          removingSessionIds.current.add(id);
          lockedIds.add(id);
          pendingPersist.current.delete(id);
          invalidateLoadedSession(id);
        }
        for (const id of ids) {
          await stopSessionForRemoval(id);
          const session = sessionsRef.current.find((entry) => entry.id === id);
          if (!session) continue;
          await flushSessionCheckpoint(id);
          forgottenIds.add(id);
          for (const harness of sessionChildHarnesses(session)) {
            await forgetHarnessSession(harness, id);
          }
          const latest = sessionsRef.current.find((entry) => entry.id === id);
          if (!latest) continue;
          const stopped = {
            ...stopStreaming(latest),
            busy: false,
            queueStatus: "paused" as const,
            pendingQuestion: undefined,
          };
          sessionsRef.current = sessionsRef.current.map((entry) =>
            entry.id === id ? stopped : entry,
          );
          setSessions(sessionsRef.current);
          if (shouldPersistSession(stopped)) await upsertSession(stopped);
        }
        await flushSessionWrites();
        checkOpenWorktreeFiles(path);
        const removed = await removeWorktree(cwd, path, force, keepSessions);
        const affected = new Set([...ids, ...removed.sessionIds]);
        if (isEqualOrInside(projectCwdRef.current, path)) {
          setProjectCwd(removed.projectCwd);
          setRecents(rememberProject(removed.projectCwd));
        }
        for (const id of affected) {
          invalidateLoadedSession(id);
          pendingPersist.current.delete(id);
          lastPersisted.current.delete(id);
        }
        sessionsRef.current = sessionsRef.current.map((session) =>
          affected.has(session.id)
            ? detachSessionWorktree(session, removed.projectCwd, path)
            : session,
        );
        setSessions(sessionsRef.current);
        const patchSummary = (entry: SessionSummary) =>
          affected.has(entry.id)
            ? detachSessionWorktree(entry, removed.projectCwd, path)
            : entry;
        setHistory((current) => current.map(patchSummary));
        setStoredLinkedSessions((current) => current.map(patchSummary));
        for (const id of affected) notifyReviewChanged(id);
      } catch (error) {
        // Removal may fail after idle agent processes were stopped. Rebind
        // their saved threads so the unchanged working copy can still resume.
        const kept = sessionsRef.current.filter(
          (session) => forgottenIds.has(session.id) && !session.worktreeRemoved,
        );
        bindResumedSessions(kept);
        for (const session of kept) {
          const pending = session.pendingSwitch;
          if (pending?.fromProviderSessionId) {
            bindHarnessSession(
              pending.from,
              session.id,
              pending.fromProviderSessionId,
              sessionWorkCwd(session),
              pending.fromProviderAccountId,
              session.blocks,
            );
          }
        }
        throw error;
      } finally {
        removingWorktreePaths.current.delete(path);
        for (const id of lockedIds) removingSessionIds.current.delete(id);
      }
    },
    [
      checkOpenWorktreeFiles,
      invalidateLoadedSession,
      onCheckWorktreeRemoval,
      stopSessionForRemoval,
    ],
  );

  const onRemoveHistorySession = useCallback(
    async (
      sessionId: string,
      mode: "archive" | "delete",
      skipDeleteConfirm = false,
    ): Promise<boolean> => {
      if (
        removingSessionIds.current.has(sessionId) ||
        switchingWorktrees.current.has(sessionId) ||
        deleteConfirmationPending.current
      )
        return false;
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const summary = history.find((entry) => entry.id === sessionId);
      const seed = open ?? summary;
      const label = seed
        ? sessionDisplayTitle(seed.title, seed.harness)
        : "this session";
      removingSessionIds.current.add(sessionId);
      let deleteWorktreePath: string | undefined;
      if (mode === "delete" && !skipDeleteConfirm) {
        deleteConfirmationPending.current = true;
        let unusedWorktree: string | undefined;
        if (seed?.worktreeCwd) {
          try {
            const { worktrees } = await listWorktrees(seed.cwd);
            const tree = worktrees.find(
              (entry) => pathKey(entry.path) === pathKey(seed.worktreeCwd!),
            );
            if (
              tree &&
              !tree.isMain &&
              !tree.locked &&
              tree.branch &&
              worktreeSessionIds(tree, sessionsRef.current).every(
                (id) => id === sessionId,
              )
            )
              unusedWorktree = tree.path;
          } catch {
            // A failed lookup must never offer filesystem cleanup.
          }
        }
        if (!unusedWorktree) {
          deleteConfirmationPending.current = false;
        } else {
          const choice = await new Promise<SessionDeleteChoice>((resolve) => {
            setSessionDeleteDialog({ title: label, unusedWorktree, resolve });
          });
          deleteConfirmationPending.current = false;
          if (!choice.confirmed) {
            removingSessionIds.current.delete(sessionId);
            return false;
          }
          if (choice.deleteWorktree) deleteWorktreePath = unusedWorktree;
        }
      }
      invalidateLoadedSession(sessionId);
      pendingPersist.current.delete(sessionId);
      try {
        const remover = createSessionRemover({
          mode,
          scope: tabCloseScope,
          replacement: {
            harness: seed?.harness ?? "cursor",
            cwd: seed?.cwd ?? sidebarCwd,
            model: seed?.model,
            runtimeMode: seed?.runtimeMode,
            modelSettings: open?.modelSettings,
          },
          workspace: {
            snapshot: () => ({
              tabs: tabsRef.current,
              sessions: sessionsRef.current,
              activeTabId: activeTabIdRef.current,
              dirtyFiles: dirtyFilesRef.current,
            }),
            apply: (change) => {
              if (change.type === "stopped") {
                const next = sessionsRef.current.map((session) =>
                  session.id === sessionId ? change.session : session,
                );
                sessionsRef.current = next;
                setSessions(next);
                return;
              }

              if (change.type === "orchestrationReleased") {
                const released = sessionsRef.current.map((session) =>
                  releaseOrchestrationWorker(session, change.leadId),
                );
                sessionsRef.current = released;
                setSessions(released);
                for (const [id, cached] of loadedSessionCache.current) {
                  if (
                    releaseOrchestrationWorker(cached, change.leadId) !== cached
                  )
                    invalidateLoadedSession(id);
                }
                // Pending reads may still carry the deleted lead's ownership.
                for (const id of sessionLoads.current.keys()) {
                  invalidateLoadedSession(id);
                }
                for (const [id, pending] of pendingPersist.current) {
                  pendingPersist.current.set(
                    id,
                    releaseOrchestrationWorker(pending, change.leadId),
                  );
                }
                const releaseSummary = (entry: SessionSummary) =>
                  entry.orchestrationLeadId === change.leadId
                    ? { ...entry, orchestrationLeadId: undefined }
                    : entry;
                setHistory((current) => current.map(releaseSummary));
                setStoredLinkedSessions((current) =>
                  current.map(releaseSummary),
                );
                return;
              }

              const { removal } = change;
              lastPersisted.current.delete(sessionId);
              pendingPersist.current.delete(sessionId);
              const closingFiles = filesInWorkspaceTabs(removal.closedTabs);
              setDirtyFiles((current) => {
                const next = new Set(current);
                for (const file of closingFiles) next.delete(file.id);
                return next;
              });
              sessionsRef.current = removal.sessions;
              tabsRef.current = removal.tabs;
              setSessions(removal.sessions);
              setTabs(removal.tabs);
              if (removal.activeTabId !== activeTabIdRef.current) {
                activateTab(removal.activeTabId);
              }
              const activeTab = removal.tabs.find(
                (tab) => tab.id === removal.activeTabId,
              );
              setComposerFocused(
                removal.sessions.some(
                  (session) => session.id === activeTab?.focusedId,
                ),
              );
              if (change.mode === "archive") {
                if (change.session && shouldPersistSession(change.session)) {
                  rememberLoadedSession(
                    loadedSessionCache.current,
                    change.session,
                  );
                }
                const archived =
                  change.savedSummary ??
                  summary ??
                  (change.session && summaryFromSession(change.session));
                if (archived) {
                  setHistory((current) =>
                    mergeHistorySummary(current, {
                      ...archived,
                      archived: true,
                    }),
                  );
                }
              } else {
                setHistory((current) =>
                  current.filter((entry) => entry.id !== sessionId),
                );
                void refreshHistory(seed?.cwd ?? sidebarCwd, true);
              }
            },
          },
          confirm: async (closedTabs, removalMode) => {
            const files = filesInWorkspaceTabs(closedTabs);
            const unsaved = files.some(
              (file) =>
                isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
            );
            if (
              unsaved &&
              !(await confirmDiscardUnsaved(
                `${removalMode === "archive" ? "Archive" : "Delete"} this conversation with unsaved files?`,
              ))
            )
              return false;
            const terminals = files.filter((file) => file.terminal);
            return (
              terminals.length === 0 || (await confirmCloseTerminals(terminals))
            );
          },
          stop: stopSessionForRemoval,
        });
        const removed = await remover.remove(sessionId);
        if (removed && deleteWorktreePath && seed) {
          try {
            await onRemoveWorktree(seed.cwd, deleteWorktreePath, false);
          } catch (error) {
            void message(
              `The session was deleted. Its worktree was kept.\n\n${String(error)}\n\nYou can manage it in Settings → Worktrees.`,
              { title: "MonoCode", kind: "warning" },
            );
          }
        }
        return removed;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        void message(`Could not ${mode} this conversation.\n\n${detail}`, {
          title: "MonoCode",
          kind: "error",
        });
        return false;
      } finally {
        removingSessionIds.current.delete(sessionId);
      }
    },
    [
      activateTab,
      history,
      invalidateLoadedSession,
      refreshHistory,
      sidebarCwd,
      stopSessionForRemoval,
      tabCloseScope,
      onRemoveWorktree,
    ],
  );

  const onArchiveHistorySession = useCallback(
    async (sessionId: string, archived: boolean) => {
      if (archived) return onRemoveHistorySession(sessionId, "archive");
      if (removingSessionIds.current.has(sessionId)) return false;
      try {
        await setSessionArchived(sessionId, false);
        setHistory((current) =>
          current.map((entry) =>
            entry.id === sessionId ? { ...entry, archived: false } : entry,
          ),
        );
        return true;
      } catch (error) {
        void message(
          `Could not unarchive this conversation.\n\n${String(error)}`,
          {
            title: "MonoCode",
            kind: "error",
          },
        );
        return false;
      }
    },
    [onRemoveHistorySession],
  );

  const onArchiveFocusedSession = useCallback(
    (event: KeyboardEvent) => {
      archiveFocusedSession(
        event,
        {
          activeTabId: activeTabIdRef.current,
          tabs: tabsRef.current,
          sessions: sessionsRef.current,
          projectTerminalFocused: projectTerminalFocusedRef.current,
          surfaceOpen: Boolean(
            appViewFocusedRef.current ||
            paletteOpenRef.current ||
            whatsNewVersionRef.current,
          ),
        },
        (sessionId) => {
          void onArchiveHistorySession(sessionId, true);
        },
      );
    },
    [onArchiveHistorySession],
  );

  const onPinHistorySession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      setHistory((current) => {
        const existing = current.find((entry) => entry.id === sessionId);
        if (existing) {
          return mergeProjectHistorySummary(current, { ...existing, pinned });
        }
        if (!open) return current;
        return mergeProjectHistorySummary(current, {
          ...summaryFromSession(open),
          pinned,
        });
      });
      if (open && shouldPersistSession(open)) {
        await upsertSession(open).catch(() => undefined);
      }
      await setSessionPinned(sessionId, pinned).catch(() => undefined);
    },
    [],
  );

  const onSetHistorySessionLinkedWorkItem = useCallback(
    (sessionId: string, linkedWorkItem: LinkedWorkItem | undefined) => {
      const editedCwd =
        sessionsRef.current.find((session) => session.id === sessionId)?.cwd ??
        history.find((entry) => entry.id === sessionId)?.cwd ??
        sidebarCwd;
      const previousLinkedWorkItem =
        sessionsRef.current.find((session) => session.id === sessionId)
          ?.linkedWorkItem ??
        history.find((session) => session.id === sessionId)?.linkedWorkItem;
      invalidateLoadedSession(sessionId);
      loadedSessionCache.current.delete(sessionId);

      const nextSessions = sessionsRef.current.map((session) =>
        session.id === sessionId ? { ...session, linkedWorkItem } : session,
      );
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      setHistory((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, linkedWorkItem } : session,
        ),
      );
      setStoredLinkedSessions((current) =>
        linkedWorkItem
          ? current.map((session) =>
              session.id === sessionId
                ? { ...session, linkedWorkItem }
                : session,
            )
          : current.filter((session) => session.id !== sessionId),
      );
      setLinkedWorkItemPanels((current) => {
        if (!current.has(sessionId)) return current;
        const next = new Map(current);
        next.delete(sessionId);
        return next;
      });

      void setSessionLinkedWorkItem(sessionId, linkedWorkItem).catch(
        (error) => {
          const rolledBackSessions = sessionsRef.current.map((session) =>
            session.id === sessionId &&
            session.linkedWorkItem === linkedWorkItem
              ? { ...session, linkedWorkItem: previousLinkedWorkItem }
              : session,
          );
          sessionsRef.current = rolledBackSessions;
          setSessions(rolledBackSessions);
          setHistory((current) =>
            current.map((session) =>
              session.id === sessionId &&
              session.linkedWorkItem === linkedWorkItem
                ? { ...session, linkedWorkItem: previousLinkedWorkItem }
                : session,
            ),
          );
          setStoredLinkedSessions((current) =>
            previousLinkedWorkItem
              ? current.map((session) =>
                  session.id === sessionId
                    ? {
                        ...session,
                        linkedWorkItem: previousLinkedWorkItem,
                      }
                    : session,
                )
              : current.filter((session) => session.id !== sessionId),
          );
          void refreshHistory(editedCwd, true);
          void message(
            `Could not update this conversation's GitHub link.\n\n${String(error)}`,
            { title: "MonoCode", kind: "error" },
          );
        },
      );
    },
    [history, invalidateLoadedSession, refreshHistory, sidebarCwd],
  );

  const onArchiveHistorySessions = useCallback(
    async (sessionIds: readonly string[], archived: boolean) => {
      for (const sessionId of sessionIds) {
        if (!(await onArchiveHistorySession(sessionId, archived))) break;
      }
    },
    [onArchiveHistorySession],
  );

  const onPinHistorySessions = useCallback(
    async (sessionIds: readonly string[], pinned: boolean) => {
      await Promise.all(
        sessionIds.map((sessionId) => onPinHistorySession(sessionId, pinned)),
      );
    },
    [onPinHistorySession],
  );

  const onDeleteWorktreeSessions = useCallback(
    async (sessionIds: readonly string[]): Promise<boolean> => {
      for (const sessionId of sessionIds) {
        if (!(await onRemoveHistorySession(sessionId, "delete", true))) {
          return false;
        }
      }
      return true;
    },
    [onRemoveHistorySession],
  );

  const onDeleteHistorySession = useCallback(
    (sessionId: string) => onRemoveHistorySession(sessionId, "delete"),
    [onRemoveHistorySession],
  );

  const onDeleteHistorySessions = useCallback(
    async (sessionIds: readonly string[]) => {
      if (sessionIds.length === 0) return;
      if (
        !window.confirm(
          `Delete ${sessionIds.length} selected conversations? This can’t be undone.`,
        )
      )
        return;
      for (const sessionId of sessionIds) {
        if (!(await onRemoveHistorySession(sessionId, "delete", true))) break;
      }
    },
    [onRemoveHistorySession],
  );

  const onFocusDir = useCallback(
    (dir: FocusDir) => {
      if (!activeTab) return;
      const next = neighborLeafId(activeTab.layout, activeTab.focusedId, dir);
      if (next) onFocusPane(next);
    },
    [activeTab, onFocusPane],
  );

  const onRatio = useCallback(
    (tabId: string, splitId: string, index: number, ratio: number) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, layout: setSplitRatio(t.layout, splitId, index, ratio) }
            : t,
        ),
      );
    },
    [],
  );

  const onCwdChange = useCallback(
    (sessionId: string, cwd: string) => {
      const normalized = normalizeProjectPath(cwd);
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      const previous = current?.cwd;
      // Threads stay bound to their project. Switching from the composer opens a
      // new tab instead of retargeting the conversation.
      if (
        current &&
        previous &&
        looksLikeProject(previous) &&
        !sameProjectPath(previous, normalized) &&
        !canDiscardEmptySession(current.id)
      ) {
        setProjectCwd(normalized);
        setRecents(rememberProject(normalized));
        const session = newSession(
          current.harness,
          normalized,
          current.model,
          current.runtimeMode,
          current.modelSettings,
        );
        const tab = newTab(session.id);
        setSessions((prev) => [...prev, session]);
        appendTab(tab, normalized);
        setActiveTabId(tab.id);
        setComposerFocused(true);
        return;
      }
      if (
        previous &&
        !sameProjectPath(previous, normalized) &&
        previous !== "~"
      ) {
        void keepSessionChanges(sessionId, previous).catch(() => undefined);
      }
      setProjectCwd(normalized);
      setRecents(rememberProject(normalized));
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          // A blank session moving into a project adopts its provider defaults;
          // a conversation keeps its own provider.
          const base = isBlankSession(s)
            ? retargetSessionToProject(s, normalized)
            : s;
          return {
            ...base,
            cwd: normalized,
            branch: undefined,
            worktreeCwd: undefined,
            worktreeRemoved: undefined,
            workspaceMode: undefined,
            worktreeBase: undefined,
          };
        }),
      );
      // The session's project just moved in place; a group only holds tabs that
      // share one project, so drop this tab out if it no longer matches.
      setTabs((prev) => {
        const tab = prev.find((t) => leafIds(t.layout).includes(sessionId));
        // The tab's visible project follows its focused pane; a background
        // pane changing project doesn't change what the group check should see.
        if (!tab?.groupId || tab.focusedId !== sessionId) return prev;
        const newProject = projectName(normalized);
        const othersProject = tabGroupProject(
          prev.filter((t) => t.id !== tab.id),
          tab.groupId,
          projectOfTab,
        );
        if (othersProject && newProject && othersProject !== newProject) {
          return removeTabFromGroup(prev, tab.id);
        }
        return prev;
      });
      notifyReviewChanged(sessionId);
    },
    [appendTab, projectOfTab],
  );

  const onBranchChange = useCallback(
    (sessionId: string) => {
      notifyGitChanged();
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      if (!current) return;
      void forgetHarnessSession(current.harness, sessionId);
      const next = {
        ...current,
        branch: undefined,
        providerSessionId: undefined,
        context: undefined,
      };
      sessionsRef.current = sessionsRef.current.map((s) =>
        s.id === sessionId ? next : s,
      );
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? next : s)));
      persistSession(next);
      notifyReviewChanged(sessionId);
    },
    [persistSession],
  );

  const onWorkspaceModeChange = useCallback(
    (sessionId: string, mode: WorkspaceMode, base?: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (
            session.id !== sessionId ||
            (!isBlankSession(session) &&
              !(session.workspaceMode && !session.worktreeCwd && !session.busy))
          ) {
            return session;
          }
          return mode === "worktree"
            ? base || session.worktreeBase
              ? {
                  ...session,
                  workspaceMode: "worktree",
                  worktreeBase: base || session.worktreeBase,
                }
              : session
            : {
                ...session,
                workspaceMode: undefined,
                worktreeBase: undefined,
              };
        }),
      );
    },
    [],
  );

  const onWorktreeBaseChange = useCallback(
    (sessionId: string, base: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId &&
          (isBlankSession(session) ||
            (!!session.workspaceMode &&
              !session.worktreeCwd &&
              !session.busy)) &&
          session.workspaceMode === "worktree"
            ? { ...session, worktreeBase: base }
            : session,
        ),
      );
    },
    [],
  );

  const onWorktreeChange = useCallback(
    async (
      sessionId: string,
      tree: Worktree,
      fromComposer = false,
      isCurrent: () => boolean = () => true,
    ) => {
      if (!isCurrent()) return;
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      if (
        !current ||
        current.busy ||
        removingSessionIds.current.has(sessionId) ||
        switchingWorktrees.current.has(sessionId)
      ) {
        throw new Error(
          "Wait for this session to finish before changing working copies.",
        );
      }
      if (
        !current.worktreeRemoved &&
        pathKey(sessionWorkCwd(current)) === pathKey(tree.path)
      )
        return;
      if (
        [...removingWorktreePaths.current].some((path) =>
          isEqualOrInside(tree.path, path),
        )
      ) {
        throw new Error(
          "This worktree is being deleted. Select another working copy.",
        );
      }
      if (!current.worktreeRemoved && current.queuedMessages?.length) {
        throw new Error(
          "Clear queued messages before changing working copies.",
        );
      }
      const run = orchestrator.forSession(sessionId);
      if (run && ["active", "paused"].includes(run.status)) {
        throw new Error(
          "Stop this orchestration run before changing working copies.",
        );
      }
      switchingWorktrees.current.set(sessionId, tree.path);
      pendingPersist.current.delete(sessionId);
      try {
        const listed = await listWorktrees(current.cwd);
        if (!isCurrent()) return;
        const target = listed.worktrees.find(
          (entry) =>
            pathKey(entry.path) === pathKey(tree.path) && !entry.missing,
        );
        if (!target) {
          throw new Error(
            "This worktree is no longer available. Refresh the picker.",
          );
        }
        const source = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          !source ||
          source.busy ||
          source.cwd !== current.cwd ||
          sessionWorkCwd(source) !== sessionWorkCwd(current)
        ) {
          throw new Error(
            "The session changed. Try selecting the working copy again.",
          );
        }
        const selected = sessionInWorktree(source, target);
        if (selected.id !== sessionId) {
          // Leave the original conversation, checkpoints, and live provider
          // context attached to the files they describe.
          const tab = newTab(selected.id);
          if (fromComposer)
            workspacePins.current.set(
              selected.id,
              currentWorkspace(source.cwd),
            );
          sessionsRef.current = [...sessionsRef.current, selected];
          setSessions(sessionsRef.current);
          appendTab(tab, selected.cwd);
          setActiveTabId(tab.id);
          setComposerFocused(true);
          return;
        }
        await flushSessionCheckpoint(sessionId);
        if (!isCurrent()) return;
        for (const harness of sessionChildHarnesses(source)) {
          await forgetHarnessSession(harness, sessionId);
          if (!isCurrent()) return;
        }
        const latest = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          !latest ||
          (!latest.worktreeRemoved && !isBlankSession(latest)) ||
          latest.cwd !== current.cwd ||
          sessionWorkCwd(latest) !== sessionWorkCwd(current)
        ) {
          throw new Error(
            "The session changed. Try selecting the working copy again.",
          );
        }
        const next = sessionInWorktree(latest, target);
        if (fromComposer)
          workspacePins.current.set(sessionId, currentWorkspace(latest.cwd));
        else workspacePins.current.delete(sessionId);
        if (latest.worktreeRemoved)
          await keepSessionChanges(sessionId, target.path);
        pendingPersist.current.delete(sessionId);
        if (shouldPersistSession(next)) await upsertSession(next);
        if (!isCurrent()) return;
        invalidateLoadedSession(sessionId);
        sessionsRef.current = sessionsRef.current.map((s) =>
          s.id === sessionId ? next : s,
        );
        setSessions(sessionsRef.current);
        notifyGitChanged();
        notifyReviewChanged(sessionId);
        void refreshHistory(next.cwd);
      } finally {
        switchingWorktrees.current.delete(sessionId);
      }
    },
    [appendTab, invalidateLoadedSession, refreshHistory],
  );

  const onComposerWorktreeChange = useCallback(
    (sessionId: string, tree: Worktree) =>
      onWorktreeChange(sessionId, tree, true),
    [onWorktreeChange],
  );

  const onSelectWorkspace = useCallback(
    (focus?: WorktreeFocus) => {
      setProjectCwd(sidebarCwdRef.current);
      workspaceNavigation.selectWorkspace(sidebarCwdRef.current, focus);
    },
    [workspaceNavigation.selectWorkspace],
  );

  /**
   * Open a run of folders from one snapshot, committed in a single transition.
   *
   * Planning per folder from refs would read state React has not rendered yet,
   * so the whole run is planned first and applied here in selection order.
   */
  const openProjects = useCallback(
    (paths: readonly string[]) => {
      const steps = planProjectOpenRun({
        memory: readProjectReturnMemory(),
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        activeTabId: activeTabIdRef.current,
        paths,
        canReuseBlank: canDiscardEmptySession,
      });
      const last = steps[steps.length - 1];
      if (!last) return;

      // After the early return, not before it. `pickFolders` hands back an
      // empty list when the picker is dismissed, and every path failing
      // `looksLikeProject` comes out the same way — so closing these first
      // meant cancelling a folder picker shut whatever the user had open.
      // Nothing below opens a project without also leaving one of these views.

      // At most one folder can take the blank session, and it keeps the
      // retargeting rules `onCwdChange` already owns.
      const blank = steps.find(
        (step): step is Extract<ProjectOpenStep, { action: "reuse-blank" }> =>
          step.action === "reuse-blank",
      );
      if (blank) onCwdChange(blank.sessionId, blank.path);

      const created = steps.filter(
        (step): step is Extract<ProjectOpenStep, { action: "create" }> =>
          step.action === "create",
      );
      if (created.length > 0) {
        setSessions((prev) => [
          ...prev,
          ...created.map((step) => step.session),
        ]);
        // Each tab sits beside the one before it in the run, so the folders keep
        // their selection order.
        setTabs((prev) =>
          created.reduce(
            (tabs, step) =>
              insertBeside(tabs, step.tab, step.besideTabId, step.path),
            prev,
          ),
        );
      }

      // The folder chosen last ends up focused.
      switch (last.action) {
        case "create":
          setProjectCwd(last.path);
          setActiveTabId(last.tab.id);
          setComposerFocused(true);
          break;
        case "activate":
          setProjectCwd(last.path);
          activateTab(last.tabId, last.paneId);
          break;
        case "keep":
          setProjectCwd(last.path);
          break;
        case "reuse-blank":
          // `onCwdChange` already moved to it.
          break;
      }
      // Every project opened is remembered, the one chosen last most recently.
      for (const step of steps) setRecents(rememberProject(step.path));
    },
    [activateTab, insertBeside, onCwdChange, readProjectReturnMemory],
  );

  // The caller's own feedback (a closing picker, the sidebar's project header)
  // paints first; rebuilding the workspace can be interrupted. Until it lands,
  // the previous project's content stays on screen marked as switching.
  const [projectSwitchPending, startProjectSwitch] = useTransition();
  const onSelectProject = useCallback(
    (path: string) => {
      startProjectSwitch(() => {
        workspaceNavigation.cancel();
        openProjects([path]);
        workspaceNavigation.selectProject(path);
      });
    },
    [
      openProjects,
      startProjectSwitch,
      workspaceNavigation.cancel,
      workspaceNavigation.selectProject,
    ],
  );

  const pickProject = useCallback(async () => {
    // Several folders can be taken at once; each opens as its own project, and
    // the last one selected ends up focused.
    openProjects(await pickFolders());
  }, [openProjects]);

  const onRemoveProject = useCallback(
    (path: string, options: { purgeData: boolean }) => {
      const normalized = normalizeProjectPath(path);
      projectHistoryLoader.current?.invalidate(normalized);
      setHistory((current) =>
        current.filter((session) => !sameProjectPath(session.cwd, normalized)),
      );
      setLoadedProjects((current) => {
        const next = new Set(current);
        next.delete(pathKey(normalized));
        return next;
      });
      setFailedProjectPaths((current) => {
        const next = new Set(current);
        next.delete(pathKey(normalized));
        return next;
      });
      const wasCurrent = sameProjectPath(projectCwdRef.current, normalized);
      const remaining = options.purgeData
        ? forgetProject(normalized)
        : archiveProject(normalized);
      if (options.purgeData) {
        forgetProjectLocation(normalized);
        setSidebarTabSelection((current) =>
          sameProjectPath(current.project, normalized)
            ? { project: "~", tab: loadProjectSidebarTab("~") }
            : current,
        );
      }
      setRecents(remaining);

      const tabs = tabsRef.current;
      const sessions = sessionsRef.current;
      const projectTabs = filterTabsForProject(
        tabs,
        sessions,
        normalized,
      ).filter((tab) => !isAppViewOnlyTab(tab));
      const projectTabIds = new Set(projectTabs.map((tab) => tab.id));
      const projectSessions = sessions.filter((session) =>
        sameProjectPath(session.cwd, normalized),
      );
      const projectSessionIds = new Set(
        projectSessions.map((session) => session.id),
      );

      if (options.purgeData) {
        const cachedOrLoading = new Set([
          ...loadedSessionCache.current.keys(),
          ...sessionLoads.current.keys(),
        ]);
        for (const sessionId of cachedOrLoading) {
          invalidateLoadedSession(sessionId);
        }
        for (const session of projectSessions) {
          pendingPersist.current.delete(session.id);
          if (session.busy) {
            turnGen.current.set(
              session.id,
              (turnGen.current.get(session.id) ?? 0) + 1,
            );
            for (const id of sessionChildHarnesses(session)) {
              void cancelHarnessTurn(id, session.id);
            }
          }
          for (const id of sessionChildHarnesses(session)) {
            void forgetHarnessSession(id, session.id);
          }
          lastPersisted.current.delete(session.id);
        }
        void removeProjectData(normalized);
      } else {
        for (const session of projectSessions) {
          if (session.busy) continue;
          if (shouldPersistSession(session)) {
            rememberLoadedSession(loadedSessionCache.current, session);
          }
          persistSession(session);
          pendingPersist.current.delete(session.id);
          for (const id of sessionChildHarnesses(session)) {
            void forgetHarnessSession(id, session.id);
          }
        }
      }

      let nextTabs = tabs.filter((tab) => !projectTabIds.has(tab.id));
      let nextSessions = sessions.filter((session) => {
        if (!projectSessionIds.has(session.id)) return true;
        return !options.purgeData && session.busy;
      });
      let nextActiveTabId = activeTabIdRef.current;

      if (nextTabs.length === 0) {
        const fallback = nextSessions[0];
        const session = newDefaultSession("~", fallback?.runtimeMode);
        const tab = newTab(session.id);
        nextSessions = [...nextSessions, session];
        nextTabs = [tab];
        nextActiveTabId = tab.id;
      } else if (projectTabIds.has(nextActiveTabId)) {
        nextActiveTabId = nextTabs[0]?.id ?? nextActiveTabId;
      }

      sessionsRef.current = nextSessions;
      tabsRef.current = nextTabs;
      activeTabIdRef.current = nextActiveTabId;
      setSessions(nextSessions);
      setTabs(nextTabs);
      if (nextActiveTabId !== activeTabId) {
        setActiveTabId(nextActiveTabId);
      }
      setDirtyFiles((prev) => {
        const updated = new Set(prev);
        for (const tab of projectTabs) {
          for (const file of [
            ...tab.editorPanes.flatMap((pane) => pane.files),
            ...(tab.terminalPanes ?? []).flatMap((pane) => pane.files),
          ]) {
            updated.delete(file.id);
          }
        }
        return updated;
      });
      setProjectTerminals((prev) =>
        prev.filter((dock) => !sameProjectPath(dock.projectPath, normalized)),
      );

      if (wasCurrent) {
        const next = remaining.find((item) => looksLikeProject(item.path));
        if (next) {
          onSelectProject(next.path);
          setProjectCwd(next.path);
        } else {
          setProjectCwd("~");
          setComposerFocused(true);
        }
      }
    },
    [activeTabId, invalidateLoadedSession, onSelectProject, persistSession],
  );

  const onRestoreProject = useCallback(
    (path: string) => {
      setRecents(rememberProject(path));
      onSelectProject(path);
    },
    [onSelectProject],
  );

  const onFileMoved = useCallback((from: string, to: string) => {
    invalidateProjectFiles();
    setTabs((prev) =>
      prev.map((tab) => {
        return {
          ...tab,
          editorPanes: tab.editorPanes.map((pane) => ({
            ...pane,
            files: pane.files.map((file) =>
              isFilesystemTab(file)
                ? { ...file, path: rebasePath(file.path, from, to) }
                : file,
            ),
          })),
        };
      }),
    );
  }, []);

  const applyProjectLocationChange = useCallback(
    async (from: string, to: string) => {
      projectHistoryLoader.current?.invalidate(from);
      projectHistoryLoader.current?.invalidate(to);
      await rebaseProjectSessions(from, to);
      projectHistoryLoader.current?.invalidate(from);
      projectHistoryLoader.current?.invalidate(to);
      rebaseCiRepairs(from, to);

      const nextSessions = sessionsRef.current.map((session) =>
        sameProjectPath(session.cwd, from) ? { ...session, cwd: to } : session,
      );
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      for (const [id, session] of loadedSessionCache.current) {
        if (sameProjectPath(session.cwd, from)) {
          loadedSessionCache.current.set(id, { ...session, cwd: to });
        }
      }
      for (const [id, session] of pendingPersist.current) {
        if (sameProjectPath(session.cwd, from)) {
          pendingPersist.current.set(id, { ...session, cwd: to });
        }
      }
      setHistory((current) =>
        current.map((session) =>
          sameProjectPath(session.cwd, from)
            ? { ...session, cwd: to }
            : session,
        ),
      );
      setStoredLinkedSessions((current) =>
        current.map((session) =>
          sameProjectPath(session.cwd, from)
            ? { ...session, cwd: to }
            : session,
        ),
      );
      setLoadedProjects((current) => {
        const next = new Set(current);
        next.delete(pathKey(from));
        next.delete(pathKey(to));
        if (current.has(pathKey(from))) next.add(pathKey(to));
        return next;
      });
      setFailedProjectPaths((current) => {
        const next = new Set(current);
        next.delete(pathKey(from));
        next.delete(pathKey(to));
        return next;
      });

      if (sameProjectPath(projectCwdRef.current, from)) {
        projectCwdRef.current = to;
        setProjectCwd(to);
      }
      const nextDocks = projectTerminalsRef.current.map((dock) =>
        sameProjectPath(dock.projectPath, from)
          ? { ...dock, projectPath: to }
          : dock,
      );
      projectTerminalsRef.current = nextDocks;
      setProjectTerminals(nextDocks);
      rebaseProjectData(from, to);
      setSidebarTabSelection((current) =>
        sameProjectPath(current.project, from)
          ? { ...current, project: pathKey(to) }
          : current,
      );
      setRecents(replaceProjectPath(from, to));
      onFileMoved(from, to);
      notifyDirsChanged();
    },
    [onFileMoved],
  );

  const onFileDeleted = useCallback((path: string) => {
    invalidateProjectFiles();
    const dropped = new Set<string>();
    for (const tab of tabsRef.current) {
      for (const pane of tab.editorPanes) {
        for (const file of pane.files) {
          if (isFilesystemTab(file) && isEqualOrInside(file.path, path)) {
            dropped.add(file.id);
          }
        }
      }
    }
    setTabs((prev) =>
      prev.map((tab) =>
        dropOpenFiles(tab, (filePath) => isEqualOrInside(filePath, path)),
      ),
    );
    if (dropped.size === 0) return;
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      for (const id of dropped) next.delete(id);
      return next;
    });
  }, []);

  const openOwnedFile = useCallback(
    (
      path: string,
      navigation?: Parameters<OpenFileFn>[1],
      options?: Parameters<OpenFileFn>[2],
      sessionId?: string,
    ) => {
      const source = sessionId
        ? sessionsRef.current.find((session) => session.id === sessionId)
        : undefined;
      if (sessionId && !source) return;
      const fileCwd = source ? sessionWorkCwd(source) : gitCwdRef.current;
      const fileProjectCwd = source?.cwd ?? sidebarCwdRef.current;
      // Capture the owner before resolving the path. A later session switch
      // must not redirect an in-flight link or bring the old session forward.
      const owner = source
        ? tabsRef.current.find((tab) => leafIds(tab.layout).includes(source.id))
        : ensureContentTab(fileProjectCwd);
      if (!owner) return;
      const ownerSessionId =
        source?.id ??
        leafIds(owner.layout).find((id) =>
          sessionsRef.current.some((session) => session.id === id),
        );
      const initialMode =
        owner.surfaceMode ??
        (loadFileTabMode() === "workspace" ? "unified" : "split");
      void (async () => {
        const resolved = await resolveTabResource(
          owner.id,
          resolveFileOpenRequest(fileCwd, path, options),
        );
        if (
          !tabsRef.current.some(
            (tab) =>
              tab.id === owner.id &&
              (!ownerSessionId || leafIds(tab.layout).includes(ownerSessionId)),
          )
        )
          return;
        rememberOpenedFile(fileCwd, resolved);
        const file = newFileTab(
          resolved,
          fileCwd,
          false,
          undefined,
          fileProjectCwd,
        );
        setTabs((prev) =>
          prev.map((entry) =>
            entry.id === owner.id &&
            (!ownerSessionId || leafIds(entry.layout).includes(ownerSessionId))
              ? openEditorTab(
                  { ...entry, surfaceMode: entry.surfaceMode ?? initialMode },
                  file,
                  { split: "right", pin: !!options?.pin },
                )
              : entry,
          ),
        );
        if (navigation) {
          editorNavigationToken.current += 1;
          const target = {
            path: resolved,
            ...navigation,
            token: editorNavigationToken.current,
          };
          setEditorNavigations((current) => ({
            ...current,
            [owner.id]: { ownerSessionId, target },
          }));
        }
        if (activeTabIdRef.current !== owner.id) return;
        setProjectTerminalFocused(false);
        setComposerFocused(false);
      })();
    },
    [ensureContentTab],
  );

  const onOpenFile = useCallback<OpenFileFn>(
    (path, navigation, options) => {
      setAppPage(null);
      openOwnedFile(path, navigation, options);
    },
    [openOwnedFile],
  );
  const onOpenSessionFile = useCallback(
    (path: string, sessionId: string) =>
      openOwnedFile(path, undefined, undefined, sessionId),
    [openOwnedFile],
  );

  const onOpenPlan = useCallback((sessionId: string, blockId: string) => {
    const session = sessionsRef.current.find((entry) => entry.id === sessionId);
    const block = session?.blocks.find((entry) => entry.id === blockId);
    if (!session || !block) return;
    const tab = tabsRef.current.find((entry) =>
      leafIds(entry.layout).includes(session.id),
    );
    if (!tab) return;
    const file = {
      ...newPlanTab(
        session.id,
        block.id,
        planTitle(block.text),
        sessionWorkCwd(session),
      ),
      ...(session.worktreeCwd ? { projectCwd: session.cwd } : {}),
    };
    setTabs((prev) =>
      prev.map((entry) =>
        entry.id === tab.id
          ? openEditorTab(
              {
                ...entry,
                surfaceMode:
                  entry.surfaceMode ??
                  (loadFileTabMode() === "workspace" ? "unified" : "split"),
              },
              file,
            )
          : entry,
      ),
    );
    setComposerFocused(false);
  }, []);

  const onPinFile = useCallback((fileId: string) => {
    setTabs((prev) => {
      const next = prev.map((tab) => pinEditorFile(tab, fileId));
      return next.some((tab, index) => tab !== prev[index]) ? next : prev;
    });
  }, []);

  const onFileDirtyChange = useCallback(
    (fileId: string, dirty: boolean) => {
      // An edited preview must not be replaced by the next click.
      if (dirty) onPinFile(fileId);
      setDirtyFiles((prev) => {
        if (prev.has(fileId) === dirty) return prev;
        const next = new Set(prev);
        if (dirty) next.add(fileId);
        else next.delete(fileId);
        return next;
      });
    },
    [onPinFile],
  );

  /** The editor reports 0 as it unmounts, so closed tabs drop out on their own. */
  const onFileErrorCountChange = useCallback(
    (fileId: string, count: number) => {
      setFileErrorCounts((prev) => {
        if ((prev.get(fileId) ?? 0) === count) return prev;
        const next = new Map(prev);
        if (count > 0) next.set(fileId, count);
        else next.delete(fileId);
        return next;
      });
    },
    [],
  );

  const onSelectFileSurface = useCallback((paneId: string, fileId: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        const found = findSurfacePane(tab, paneId);
        if (!found) return tab;
        return withSurfacePanes(
          { ...tab, focusedId: paneId },
          found.kind,
          surfacePanes(tab, found.kind).map((pane) =>
            pane.id === paneId ? { ...pane, activeFileId: fileId } : pane,
          ),
        );
      }),
    );
    setComposerFocused(false);
  }, []);

  const onModelChange = useCallback(
    (sessionId: string, harness: HarnessId, model: string) => {
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      if (!current) return;
      if (isPreparingHandoff(current)) return;
      const resolved = resolveModel(harness, model);
      saveRecentModelChoice(resolved.harness, resolved.id);
      const configuration = sessionComposerConfiguration(current);
      saveLastModelSettings(configuration.modelSettings, "fill");
      const modelSettings = preferredModelSettings(
        resolved,
        configuration.modelSettings,
      );
      const plan = planComposerSwitch(current, harness);
      if (plan.kind === "empty") {
        void forgetHarnessSession(plan.forget, sessionId);
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const selected = selectComposerConfiguration(s, {
            harness, model: resolved.id, modelSettings,
            runtimeMode: configuration.runtimeMode,
          });
          if (selected.pendingConfiguration) return selected;
          const next = withHarnessChoice(
            { ...s, runtimeMode: configuration.runtimeMode },
            harness,
            resolved.id,
            modelSettings,
          );
          if (plan.kind === "arm") {
            return { ...next, pendingSwitch: plan.pending };
          }
          if (plan.kind === "revert") {
            return {
              ...next,
              pendingSwitch: undefined,
              ...(plan.restoreProviderSessionId
                ? { providerSessionId: plan.restoreProviderSessionId }
                : { providerSessionId: undefined }),
              ...(plan.restoreProviderAccountId
                ? { providerAccountId: plan.restoreProviderAccountId }
                : { providerAccountId: undefined }),
            };
          }
          if (plan.kind === "empty") {
            return { ...next, pendingSwitch: undefined };
          }
          return next;
        }),
      );
    },
    [],
  );

  const onModelSettingsChange = useCallback(
    (sessionId: string, modelSettings: Record<string, string>) => {
      saveLastModelSettings(modelSettings);
      setSessions((prev) =>
        prev.map((s) => s.id === sessionId
          ? selectComposerConfiguration(s, { ...sessionComposerConfiguration(s), modelSettings })
          : s),
      );
    },
    [],
  );

  const onRuntimeModeChange = useCallback(
    (sessionId: string, runtimeMode: RuntimeMode) => {
      setSessions((prev) =>
        prev.map((s) => s.id === sessionId
          ? selectComposerConfiguration(s, { ...sessionComposerConfiguration(s), runtimeMode })
          : s),
      );
    },
    [],
  );

  const onSaveDraft = useCallback(
    (
      sessionId: string,
      text: string,
      attachments: Attachment[] = [],
      appRequestId?: string,
    ) => {
      const current = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (current && sessionUsesHost(current))
        return !!remoteSessionActions(sessionId)?.saveDraft(text, attachments);
      if (
        !current ||
        current.busy ||
        sessionDraftBlock(current) ||
        current.inboxAsk ||
        current.worktreeRemoved ||
        (!text.trim() && attachments.length === 0)
      ) {
        return false;
      }
      const placeholderTitle = canReplaceSessionTitle(
        current.title,
        current.harness,
        HARNESS_LABEL[current.harness],
      );
      const title = placeholderTitle
        ? titleFromPrompt(text, current.harness, attachments)
        : current.title;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId && !sessionDraftBlock(session)
            ? {
                ...session,
                title,
                blocks: [
                  ...session.blocks,
                  {
                    id: crypto.randomUUID(),
                    role: "user",
                    text,
                    ...(attachments.length > 0 ? { attachments } : {}),
                    draft: true,
                    startedAt: Date.now(),
                    ...(appRequestId ? { appRequestId } : {}),
                  },
                ],
              }
            : session,
        ),
      );
      return true;
    },
    [],
  );

  const onRemoveDraft = useCallback(
    (sessionId: string, draftBlockId: string) => {
      const current = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (!current) return false;
      const withoutDraft = removeSessionDraft(current, draftBlockId);
      if (!withoutDraft) return false;

      if (!shouldPersistSession(withoutDraft)) {
        pendingPersist.current.delete(sessionId);
        lastPersisted.current.delete(sessionId);
        lastPersistedUserBlock.current.delete(sessionId);
        invalidateLoadedSession(sessionId);
        setHistory((history) =>
          history.filter((session) => session.id !== sessionId),
        );
        setStoredLinkedSessions((history) =>
          history.filter((session) => session.id !== sessionId),
        );
        void discardDraftSessionRecord(sessionId).catch(() => undefined);
      }

      setSessions((sessions) =>
        sessions.map((session) =>
          session.id === sessionId
            ? (removeSessionDraft(session, draftBlockId) ?? session)
            : session,
        ),
      );
      return true;
    },
    [invalidateLoadedSession],
  );

  const submitSession = useCallback(
    (
      sessionId: string,
      text: string,
      attachments: Attachment[] = [],
      options?: SubmitOptions,
    ): SubmissionAcceptance => {
      const remote = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (remote && sessionUsesHost(remote))
        return !!remoteSessionActions(sessionId)?.submit(
          text,
          attachments,
          options,
        );
      if (["orchestrate"].includes(options?.intent ?? "")) return false;
      if (editedResends.isActive(sessionId)) return false;
      // Output already received belongs before the submitted user message.
      // Flush before reading the session too, since pending errors can settle it.
      flushHarnessEvents();
      const controlError = orchestrator.submissionError(
        sessionId,
        options?.managed,
      );
      if (controlError) {
        enqueueHarnessEvent(sessionId, { type: "status", text: controlError });
        flushHarnessEvents();
        return false;
      }
      if (options?.managed) {
        const target = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          !target ||
          target.busy ||
          target.pendingSwitch ||
          isPreparingHandoff(target) ||
          removingSessionIds.current.has(sessionId)
        ) {
          options.onSettled?.({
            status: "failed",
            text: "",
            error: "Session is unavailable or already running",
          });
          return false;
        }
      }
      if (
        removingSessionIds.current.has(sessionId) ||
        switchingWorktrees.current.has(sessionId) ||
        workspaceNavigation.isSwitching(sessionId)
      )
        return false;
      const storedCurrent = sessionsRef.current.find((s) => s.id === sessionId);
      if (options?.appRequestId && storedCurrent?.busy) return false;
      if (
        options?.ciRepair &&
        storedCurrent &&
        (storedCurrent.busy ||
          storedCurrent.pendingSwitch ||
          storedCurrent.pendingConfiguration ||
          isPreparingHandoff(storedCurrent))
      )
        return false;
      if (
        !storedCurrent ||
        storedCurrent.worktreeRemoved ||
        [...removingWorktreePaths.current].some((path) =>
          isEqualOrInside(sessionWorkCwd(storedCurrent), path),
        )
      )
        return false;
      const draftBlock = options?.draftBlockId
        ? storedCurrent.blocks.find(
            (block) =>
              block.id === options.draftBlockId &&
              block.role === "user" &&
              block.draft,
          )
        : undefined;
      if (options?.draftBlockId && !draftBlock) return false;
      const draftCleared = draftBlock
        ? {
            ...storedCurrent,
            blocks: storedCurrent.blocks.filter(
              (block) => block.id !== draftBlock.id,
            ),
          }
        : storedCurrent;
      const turnTarget = options?.buildTarget ?? draftCleared.pendingConfiguration;
      let current = turnTarget
        ? withPlanBuildTarget({
            ...draftCleared,
            runtimeMode: draftCleared.pendingConfiguration?.runtimeMode ?? draftCleared.runtimeMode,
          }, turnTarget)
        : draftCleared;
      const editedResend = options?.resendEdited
        ? createEditedResendAttempt(current, options.onResendRejected)
        : undefined;
      if (options?.resendEdited && !editedResend) return false;
      const editedProviderTurnId = editedResend?.providerTurnId;
      if (editedResend) {
        current = { ...current, blocks: editedResend.blocks };
      }
      const intent = options?.intent ?? "default";
      if (intent === "orchestrate") {
        try {
          const run = orchestrator.forSession(sessionId);
          if (run && ["active", "paused"].includes(run.status))
            throw new Error(
              "Stop the current orchestration run before preparing another proposal.",
            );
        } catch (error) {
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: error instanceof Error ? error.message : String(error),
          });
          flushHarnessEvents();
          return false;
        }
      }
      const approvedPlan = options?.planBlockId
        ? current.blocks.find(
            (block) =>
              block.id === options.planBlockId && block.role === "plan",
          )
        : undefined;
      if (intent === "build" && !approvedPlan?.text.trim()) return false;
      if (options?.queuedMessageId) {
        const mode =
          options.followUpBehavior === "steer" ? "steer" : "dispatch";
        if (!queuedMessageForSubmit(current, options.queuedMessageId, mode)) {
          return false;
        }
      }
      const noteCard =
        options && "noteCard" in options ? options.noteCard : current.noteCard;
      const handoffCard =
        options && "handoffCard" in options
          ? options.handoffCard
          : current.handoffCard;
      if (
        !text.trim() &&
        attachments.length === 0 &&
        !noteCard &&
        !handoffCard
      ) {
        return false;
      }
      if (isPreparingHandoff(current)) return false;
      saveRecentModelChoice(current.harness, current.model);
      const initialWorkCwd = sessionWorkCwd(current);
      const createDraftWorktree =
        !current.worktreeCwd && current.workspaceMode === "worktree";
      const creationId = crypto.randomUUID();
      const accountProvider = supportsProviderAccounts(current.harness)
        ? current.harness
        : undefined;
      const providerAccountId = accountProvider
        ? (conversationProviderAccountId(current) ??
          selectedProviderAccountId(accountProvider, current.cwd))
        : undefined;
      if (
        accountProvider &&
        providerAccountId &&
        !providerAccountExists(accountProvider, providerAccountId)
      ) {
        enqueueHarnessEvent(sessionId, {
          type: "session.error",
          message:
            "This conversation uses a removed provider account. Switch accounts from the usage control to start a new conversation.",
        });
        flushHarnessEvents();
        return false;
      }
      const submittedText = intent === "build" ? "Build approved plan" : text;
      const operatorCommand = consumeOperatorCommand(submittedText);
      if (
        operatorCommand.matched &&
        (intent !== "default" ||
          current.orchestrationLeadId ||
          current.inboxAsk ||
          orchestrator.run(sessionId))
      ) {
        enqueueHarnessEvent(sessionId, {
          type: "status",
          text: "Use /operator from a regular session turn, outside an orchestration run.",
        });
        flushHarnessEvents();
        return false;
      }
      const operatorAccess =
        operatorCommand.matched || operatorEnabledInThread(current.blocks);
      const promptText = operatorCommand.matched
        ? operatorCommand.text.trim() ||
          "Explain what you can do in MonoCode with the app CLI."
        : submittedText;
      const rawCommand =
        !operatorCommand.matched &&
        isNativeCommandPrompt(submittedText, current.harness);
      const ciContext = options?.ciRepair?.prompt ?? options?.ciContext;
      const harnessText =
        options?.ciRepair?.prompt ??
        (rawCommand ? submittedText : composeNoteMessage(noteCard, promptText));

      const pendingSwitch =
        current.pendingSwitch && current.pendingSwitch.from !== current.harness
          ? current.pendingSwitch
          : null;

      if (current.busy && !pendingSwitch) {
        if (
          operatorCommand.matched &&
          options?.queuedMessageId &&
          options.followUpBehavior === "steer"
        ) {
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: "/operator starts a new turn after the current turn finishes.",
          });
          flushHarnessEvents();
          return false;
        }
        const followUpBehavior =
          current.worktreePreparing ||
          intent === "plan" ||
          intent === "orchestrate" ||
          operatorCommand.matched
            ? "queue"
            : // The agent has yielded and only background work is left, which
              // may never end (a dev server). Queuing would park the message
              // behind it, so hand it to the agent now.
              current.backgroundTasks?.length
              ? "steer"
              : (options?.followUpBehavior ?? loadFollowUpBehavior());
        if (followUpBehavior === "queue") {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    inboxCard: rawCommand ? s.inboxCard : undefined,
                    noteCard: rawCommand ? s.noteCard : undefined,
                    handoffCard: rawCommand ? s.handoffCard : undefined,
                    queuedMessages: [
                      ...(s.queuedMessages ?? []),
                      {
                        id: crypto.randomUUID(),
                        text,
                        attachments,
                        noteCard,
                        handoffCard,
                        intent,
                      },
                    ],
                    queueStatus:
                      s.queueStatus === "paused" ? "paused" : "active",
                  }
                : s,
            ),
          );
          dismissNoticesForContinuedSession(sessionId);
          return true;
        }
        if (
          !isLiveHarness(current.harness) ||
          !canSteerHarness(current.harness)
        ) {
          // Harnesses that cannot steer (fx) used to drop the message on the
          // floor here, so a follow-up sent mid-turn just vanished. Say so.
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: `${current.harness} cannot take a follow-up mid-turn — wait for this turn to finish, or stop it first.`,
          });
          flushHarnessEvents();
          return false;
        }
        dismissNoticesForContinuedSession(sessionId);
        const visible = displayAttachments(attachments);
        const cards = userTurnCards(noteCard);
        const nextSessions = sessionsRef.current.map((s) => {
          if (s.id !== sessionId) return s;
          let next: Session = {
            ...s,
            inboxCard: rawCommand ? s.inboxCard : undefined,
            noteCard: rawCommand ? s.noteCard : undefined,
            handoffCard: rawCommand ? s.handoffCard : undefined,
          };
          if (options?.queuedMessageId) {
            next = dequeueQueuedMessage(next, options.queuedMessageId);
          }
          return appendSteerUser(next, submittedText, visible, cards);
        });
        sessionsRef.current = nextSessions;
        setSessions(nextSessions);
        void (async () => {
          try {
            const prepared = await prepareAttachments(attachments);
            const prompt = await preparePrompt(harnessText, {
              harness: current.harness,
              sessionId,
              cwd: initialWorkCwd,
            });
            await steerHarnessTurn({
              harness: current.harness,
              nativeSession: current.nativeSession,
              sessionId,
              cwd: initialWorkCwd,
              model: current.model,
              modelSettings: current.modelSettings,
              text: inboxAskPrompt(
                rawCommand ? undefined : current.inboxAsk,
                prompt,
              ),
              attachments: prepared,
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : `${current.harness} could not steer the active turn`;
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message,
            });
            flushHarnessEvents();
          }
        })();
        return true;
      }

      if (
        !options?.projectLocationReady &&
        looksLikeProject(current.cwd) &&
        !current.worktreeCwd
      ) {
        const key = pathKey(current.cwd);
        let sync = projectLocationSyncs.current.get(key);
        if (!sync) {
          sync = synchronizeProjectLocation(current.cwd);
          projectLocationSyncs.current.set(key, sync);
          void sync.then(
            () => projectLocationSyncs.current.delete(key),
            () => projectLocationSyncs.current.delete(key),
          );
        }
        return submitAfterProjectSync({
          cwd: current.cwd,
          sync,
          applyLocationChange: applyProjectLocationChange,
          submit: async () => {
            const accepted = await submitAfterProjectSyncRef.current(
              sessionId,
              text,
              attachments,
              { ...options, projectLocationReady: true },
            );
            if (!accepted) {
              editedResend?.reject();
              options?.onSettled?.({
                status: "failed",
                text: "",
                error:
                  "The chat became unavailable before the request could start. Try again when it is ready.",
              });
            }
            return accepted;
          },
          onError: (error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : "The project folder could not be opened.";
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message,
            });
            flushHarnessEvents();
            editedResend?.reject();
            options?.onSettled?.({
              status: "failed",
              text: "",
              error: message,
            });
          },
        });
      }

      const gen = (turnGen.current.get(sessionId) ?? 0) + 1;
      turnGen.current.set(sessionId, gen);
      const proposalId =
        intent === "orchestrate" ? crypto.randomUUID() : undefined;
      let proposalDraft: OrchestrationProposal | undefined = proposalId
        ? {
            version: 1,
            leadId: sessionId,
            cwd: current.cwd,
            checkoutCwd: initialWorkCwd,
            request: harnessText,
            author: {
              harness: current.harness,
              model: current.model,
              name: resolveModel(current.harness, current.model).name,
            },
            settings: { choices: [], maxWorkers: 2 },
            status: "planning",
            title: "Orchestration plan",
            summary: "",
            tasks: [],
          }
        : undefined;
      const isFirstTurn = current.blocks.every(
        (block) => block.draft || block.internal,
      );
      const placeholderTitle =
        canReplaceSessionTitle(
          current.title,
          current.harness,
          HARNESS_LABEL[current.harness],
        ) || !!draftBlock;
      const titleSeed =
        isFirstTurn &&
        !current.inboxCard &&
        !current.noteCard &&
        placeholderTitle
          ? titleFromPrompt(
              operatorCommand.matched ? promptText : submittedText,
              current.harness,
              attachments,
            )
          : current.title;
      const visible = displayAttachments(attachments);
      const card =
        options?.secondOpinion ??
        (handoffCard ? handoffTurnCard(handoffCard) : undefined);
      const visibleText = operatorCommand.matched
        ? promptText
        : card?.kind === "handoff"
          ? submittedText
          : card
            ? SECOND_OPINION_TITLE
            : submittedText;
      const cards = {
        ...(rawCommand ? undefined : userTurnCards(noteCard, card)),
        ...(ciContext ? { ciContext } : {}),
        ...(operatorCommand.matched ? { monocode: true } : {}),
        ...(intent === "plan" || intent === "orchestrate" ? { intent } : {}),
        ...(options?.appRequestId
          ? { appRequestId: options.appRequestId }
          : {}),
        // The orchestrator writes these turns, not the user; hide them.
        ...(options?.managed ? { internal: true } : {}),
      };
      const live = isLiveHarness(current.harness);
      const queuedHandoff =
        live && !pendingSwitch ? pendingHandoff(current) : null;

      if (pendingSwitch && current.busy) {
        void cancelHarnessTurn(pendingSwitch.from, sessionId);
      }

      dismissNoticesForContinuedSession(sessionId);
      const commitSubmittedTurn = () => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const draftRemoved = draftBlock
              ? {
                  ...s,
                  blocks: s.blocks.filter(
                    (block) => block.id !== draftBlock.id,
                  ),
                }
              : s;
            const selected = turnTarget
              ? withPlanBuildTarget({ ...draftRemoved, runtimeMode: current.runtimeMode }, turnTarget)
              : draftRemoved;
            const titled = isFirstTurn ? titleSeed : selected.title;
            let next: Session = {
              ...selected,
              providerAccountId,
              usageLimit: undefined,
              // Only a live harness reaches the creation below; otherwise the
              // preparing flags would never clear.
              worktreePreparing:
                createDraftWorktree && live
                  ? true
                  : selected.worktreePreparing,
              worktreeCreation:
                createDraftWorktree && live
                  ? startWorktreeCreation(
                      current.worktreeBase || "HEAD",
                      creationId,
                    )
                  : selected.worktreeCreation,
              inboxCard:
                rawCommand || options?.ciRepair ? s.inboxCard : undefined,
              noteCard:
                rawCommand || options?.ciRepair ? s.noteCard : undefined,
              handoffCard:
                rawCommand || options?.ciRepair ? s.handoffCard : undefined,
            };
            if (editedResend) {
              next = editedResend.replace(next);
            }
            if (approvedPlan && intent === "build") {
              next = {
                ...next,
                blocks: next.blocks.map((block) =>
                  block.id === approvedPlan.id && block.role === "plan"
                    ? {
                        ...block,
                        plan: {
                          ...(block.plan ?? { status: "ready" as const }),
                          status: "building" as const,
                          approvedText: block.text,
                        },
                      }
                    : block,
                ),
              };
            }
            if (options?.queuedMessageId) {
              next = dequeueQueuedMessage(next, options.queuedMessageId);
            }
            if (!live) {
              return {
                ...next,
                title: titled,
                pendingSwitch: undefined,
                busy: false,
                blocks: [
                  ...next.blocks,
                  {
                    id: crypto.randomUUID(),
                    role: "user",
                    text: visibleText,
                    ...(visible.length > 0 ? { attachments: visible } : {}),
                    ...cards,
                  },
                  {
                    id: crypto.randomUUID(),
                    role: "system",
                    text: `${next.harness} is not connected yet — install and sign in to that provider, then retry.`,
                    notice: "error",
                  },
                ],
              };
            }
            if (pendingSwitch) {
              const sealed = stopStreaming({
                ...next,
                title: titled,
                pendingSwitch: undefined,
              });
              return appendUser(
                appendPreparingHandoff(
                  sealed,
                  pendingSwitch.from,
                  next.harness,
                ),
                visibleText,
                visible,
                cards,
              );
            }
            return appendUser(
              { ...next, title: titled },
              visibleText,
              visible,
              cards,
            );
          }),
        );
      };
      if (!options?.resendEdited) {
        flushSync(commitSubmittedTurn);
      }
      if (createDraftWorktree && live) {
        // The creation record hangs under the message this send just committed.
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== sessionId || !session.worktreeCreation)
              return session;
            const message = [...session.blocks]
              .reverse()
              .find((block) => block.role === "user");
            return message
              ? {
                  ...session,
                  worktreeCreation: anchorWorktreeCreation(
                    session.worktreeCreation,
                    creationId,
                    message.id,
                  ),
                }
              : session;
          }),
        );
      }

      const launchTitleGeneration = (workCwd: string) => {
        if (!live) return;
        const titleMessage =
          harnessText || attachments.map((file) => file.name).join(", ");
        if ((isFirstTurn && placeholderTitle) || options?.refreshTitle)
          titleCoordinator.current!.begin(
            sessionId,
            titleMessage,
            !!options?.refreshTitle,
          );
        else void titleCoordinator.current!.read(sessionId);
        void resolveLinkedWorkItem(titleMessage, workCwd, null)
          .then((linkedWorkItem) => {
            if (!linkedWorkItem) return;
            setSessions((prev) =>
              prev.map((session) =>
                session.id === sessionId && !session.linkedWorkItem
                  ? { ...session, linkedWorkItem }
                  : session,
              ),
            );
          })
          .catch(() => undefined);
      };

      if (!live) {
        if (pendingSwitch) {
          void forgetHarnessSession(pendingSwitch.from, sessionId);
        }
        editedResend?.reject();
        options?.onSettled?.({
          status: "failed",
          text: "",
          error: "Harness is not connected",
        });
        return true;
      }
      if (editedResend && canRewindHarnessLastTurn(current.harness)) {
        editedResends.start(sessionId);
        const locked = sessionsRef.current.map((session) =>
          session.id === sessionId ? { ...session, busy: true } : session,
        );
        sessionsRef.current = locked;
        syncDockBadge(locked);
        setSessions(locked);
      }

      if (proposalId && proposalDraft) {
        const draft = proposalDraft;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  blocks: [...session.blocks, proposalBlock(proposalId, draft)],
                }
              : session,
          ),
        );
      }

      let controlOutcome: ControlOutcome = {
        status: "failed",
        text: "",
        error: "Turn did not complete",
      };
      let controlText = "";
      let proposalText = "";
      let nativeProposalText = "";
      let completedProposal: OrchestrationProposal | undefined;
      void (async () => {
        let workCwd = initialWorkCwd;
        if (createDraftWorktree) {
          const tree = await createTaskWorktree(
            current.cwd,
            current.harness,
            harnessText || attachments.map((file) => file.name).join(", "),
            current.worktreeBase || "HEAD",
            {
              id: creationId,
              onLine: (line) =>
                setSessions((prev) =>
                  prev.map((session) =>
                    session.id === sessionId && session.worktreeCreation
                      ? {
                          ...session,
                          worktreeCreation: appendWorktreeCreationLog(
                            session.worktreeCreation,
                            creationId,
                            line,
                          ),
                        }
                      : session,
                  ),
                ),
            },
            () => turnGen.current.get(sessionId) === gen,
          );
          if (!tree) {
            setSessions((prev) => prev.map((session) =>
              session.id === sessionId && session.worktreeCreation
                ? { ...session, worktreeCreation: failWorktreeCreation(session.worktreeCreation, creationId, "Worktree creation cancelled.") }
                : session,
            ));
            return;
          }
          workCwd = tree.path;
          workspacePins.current.set(sessionId, currentWorkspace(current.cwd));
          if (proposalDraft)
            proposalDraft = { ...proposalDraft, checkoutCwd: tree.path };
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id !== sessionId) return session;
              const completed = session.worktreeCreation
                ? completeWorktreeCreation(
                    session.worktreeCreation,
                    creationId,
                    tree.path,
                  )
                : undefined;
              const record = completed
                ? persistWorktreeCreation(completed)
                : undefined;
              return {
                ...session,
                worktreeCwd: tree.path,
                branch: tree.branch ?? undefined,
                workspaceMode: undefined,
                worktreeBase: undefined,
                worktreePreparing: undefined,
                worktreeCreation: completed,
                // The agent's clock starts now, not at the send, so the worktree
                // time is not counted as work. The finished record stays with its
                // message, so its log survives a reload.
                blocks: session.blocks.map((block) =>
                  block.id === session.worktreeCreation?.afterBlockId
                    ? {
                        ...block,
                        startedAt: Date.now(),
                        ...(record ? { worktreeCreation: record } : {}),
                      }
                    : block,
                ),
              };
            }),
          );
          // The log stays readable for a moment, then folds away.
          window.setTimeout(() => {
            setSessions((prev) =>
              prev.map((session) =>
                session.id === sessionId && session.worktreeCreation
                  ? {
                      ...session,
                      worktreeCreation: foldWorktreeCreation(
                        session.worktreeCreation,
                        creationId,
                      ),
                    }
                  : session,
              ),
            );
          }, WORKTREE_CREATION_FOLD_MS);
          notifyReviewChanged(sessionId);

        }
        launchTitleGeneration(workCwd);
        if (turnGen.current.get(sessionId) !== gen) return;
        if (proposalDraft && proposalId) {
          const settings = await discoverOrchestrationSettings();
          if (turnGen.current.get(sessionId) !== gen) return;
          proposalDraft = { ...proposalDraft, settings };
          const discovering = proposalDraft;
          setSessions((prev) =>
            prev.map((session) =>
              session.id === sessionId
                ? withOrchestrationProposal(session, proposalId, discovering)
                : session,
            ),
          );
        }
        let wrap = handoffCard
          ? {
              from: handoffCard.from,
              to: current.harness,
              text: handoffCard.brief,
            }
          : queuedHandoff;
        if (pendingSwitch) {
          let agentText = "";
          if (
            shouldAskOutgoingAgent(current) &&
            isLiveHarness(pendingSwitch.from)
          ) {
            try {
              agentText = await requestOutgoingHandoff({
                harness: pendingSwitch.from,
                sessionId,
                cwd: workCwd,
                model: pendingSwitch.fromModel,
                modelSettings: pendingSwitch.fromSettings,
                providerAccountId: pendingSwitch.fromProviderAccountId,
                userRequest: text,
              });
            } catch {
              agentText = "";
            }
          }
          if (turnGen.current.get(sessionId) !== gen) return;
          const latest = sessionsRef.current.find((s) => s.id === sessionId);
          const brief = chooseHandoffBrief(agentText, latest ?? current, text);
          await forgetHarnessSession(pendingSwitch.from, sessionId);
          if (turnGen.current.get(sessionId) !== gen) return;
          wrap = { from: pendingSwitch.from, to: current.harness, text: brief };
        }

        const revealHandoff = (brief: string) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId || !isPreparingHandoff(s)) return s;
              return { ...completeHandoff(s, brief), busy: true };
            }),
          );
        };

        const planEventKey = planTurnKey(gen);
        let nativePlanSeen = false;
        let providerFailureSeen = false;
        const routePlanEvent = (event: HarnessEvent): HarnessEvent | null => {
          if (event.type === "session.error") providerFailureSeen = true;
          if (proposalDraft) {
            if (event.type === "message.delta") {
              proposalText = (proposalText + event.text).slice(-200_000);
              return null;
            }
            if (event.type === "message.completed") {
              proposalText += "\n";
              return null;
            }
            if (event.type === "plan") {
              nativeProposalText = event.append
                ? nativeProposalText + event.text
                : event.text;
              return null;
            }
          }
          if (intent !== "plan") return event;
          if (event.type === "plan") {
            nativePlanSeen = true;
            return {
              ...event,
              key: planEventKey,
            };
          }
          return event;
        };

        const pendingEditedEvents: HarnessEvent[] = [];
        const applyTurnEvent = (event: HarnessEvent) => {
          orchestrator.observe(sessionId, event);
          if (options?.onSettled && event.type === "message.delta")
            controlText = (controlText + event.text).slice(-20_000);
          if (options?.onSettled && event.type === "message.completed")
            controlText += "\n";
          if (event.type === "session.error")
            controlOutcome.error = event.message;
          if (
            wrap &&
            (event.type === "session.started" ||
              event.type === "session.providerBound")
          ) {
            revealHandoff(wrap.text);
          }
          nudgeOpenEditors(event, workCwd);
          if (!orchestrator.forSession(sessionId))
            trackSessionEdits(sessionId, workCwd, event);
          const routed = routePlanEvent(event);
          if (routed) enqueueHarnessEvent(sessionId, routed);
        };
        const routeTurnEvent = (event: HarnessEvent) => {
          if (
            event.type === "session.titleUpdated" ||
            event.type === "session.titleRefreshRequested"
          ) {
            flushHarnessEvents();
            const session = sessionsRef.current.find((s) => s.id === sessionId);
            if (
              session?.harness === current.harness &&
              session.providerSessionId === event.providerSessionId &&
              (session.providerAccountId ?? "default") ===
                (providerAccountId ?? "default")
            ) {
              if (event.type === "session.titleUpdated")
                titleCoordinator.current!.native(
                  sessionId,
                  event.providerSessionId,
                  event.title,
                );
              else void titleCoordinator.current!.read(sessionId);
            }
            return;
          }
          if (turnGen.current.get(sessionId) !== gen) return;
          if (editedResend && !editedResend.isAccepted()) {
            pendingEditedEvents.push(event);
            return;
          }
          applyTurnEvent(event);
        };
        const acceptEditedResend = () => {
          if (!editedResend || editedResend.isAccepted()) return;
          flushSync(commitSubmittedTurn);
          editedResend.markAccepted();
          for (const event of pendingEditedEvents) applyTurnEvent(event);
          pendingEditedEvents.length = 0;
        };
        const recoverEditedResend = () => {
          if (!editedResend || editedResend.isAccepted()) return;
          pendingEditedEvents.length = 0;
          const previous = sessionsRef.current.find(
            (session) => session.id === sessionId,
          );
          const recovered = previous
            ? editedResend.recoverAfterFailure(previous)
            : undefined;
          flushSync(() => {
            setSessions((prev) =>
              prev.map((session) =>
                session.id === sessionId && recovered ? recovered : session,
              ),
            );
          });
        };

        if (!current.inboxAsk && !orchestrator.forSession(sessionId)) {
          await beginSessionTurn(sessionId, workCwd).catch(() => undefined);
        }
        if (turnGen.current.get(sessionId) !== gen) return;
        let buildSucceeded = false;
        try {
          const prepared = await prepareAttachments(attachments);
          const prompt =
            intent === "build" && approvedPlan
              ? buildPlanPrompt(approvedPlan.text)
              : await preparePrompt(harnessText, {
                  harness: current.harness,
                  sessionId,
                  cwd: workCwd,
                });
          const turnPrompt = proposalDraft
            ? options?.orchestrationRetry?.response
              ? orchestrationRepairPrompt({
                  ...proposalDraft,
                  error: options.orchestrationRetry.error,
                  response: options.orchestrationRetry.response,
                })
              : orchestrationPlanningPrompt(
                  prompt,
                  proposalDraft.settings,
                  proposalDraft.checkoutCwd ?? proposalDraft.cwd,
                )
            : intent === "plan" && !rawCommand
              ? planTurnPrompt(prompt)
              : prompt;
          const earlier = queuedHandoff
            ? userMessagesAfterHandoff(current)
            : [];
          if (editedResend && canRewindHarnessLastTurn(current.harness)) {
            try {
              await rewindHarnessLastTurn({
                harness: current.harness,
                nativeSession: current.nativeSession,
                sessionId,
                cwd: workCwd,
                model: current.model,
                modelSettings: current.modelSettings,
                runtimeMode: current.runtimeMode,
                ...(editedProviderTurnId
                  ? { providerTurnId: editedProviderTurnId }
                  : {}),
                onEvent: (event) => {
                  if (turnGen.current.get(sessionId) !== gen) return;
                  enqueueHarnessEvent(sessionId, event);
                },
              });
            } catch (error) {
              flushHarnessEvents();
              editedResend.reject();
              throw error;
            }
            editedResend.markProviderRewound();
            flushHarnessEvents();
            if (turnGen.current.get(sessionId) !== gen) {
              const latest = sessionsRef.current.find(
                (session) => session.id === sessionId,
              );
              if (
                !latest ||
                (!latest.busy &&
                  latest.providerSessionId === current.providerSessionId)
              ) {
                await forgetHarnessSession(current.harness, sessionId);
                if (latest) {
                  setSessions((prev) =>
                    prev.map((session) =>
                      session.id === sessionId &&
                      session.providerSessionId === current.providerSessionId
                        ? { ...session, providerSessionId: undefined }
                        : session,
                    ),
                  );
                }
              }
              recoverEditedResend();
              return;
            }
          }
          const sendTurn = (text: string, turnAttachments = prepared) =>
            sendHarnessTurn({
              harness: current.harness,
              nativeSession: current.nativeSession,
              sessionId,
              cwd: workCwd,
              model: current.model,
              modelSettings: current.modelSettings,
              providerAccountId,
              runtimeMode: current.runtimeMode,
              intent: intent === "orchestrate" ? "plan" : intent,
              // A /operator user turn enables app access for this thread;
              // orchestration leads retain their separate control access.
              controlsAgents:
                operatorAccess ||
                orchestrator.run(sessionId)?.status === "active",
              appAccess: operatorAccess,
              text,
              attachments: turnAttachments,
              ...(editedResend ? { onAccepted: acceptEditedResend } : {}),
              onEvent: routeTurnEvent,
            });
          let sendText = orchestrator.prompt(
            sessionId,
            inboxAskPrompt(
              rawCommand ? undefined : current.inboxAsk,
              wrap && !rawCommand
                ? wrapHandoffPrompt(
                    wrap.text,
                    wrap.from,
                    turnPrompt.trim() || CONTINUE_PROMPT,
                    earlier,
                  )
                : turnPrompt,
            ),
          );
          if (operatorCommand.matched) {
            const cli = `${shellPath(await invoke<string>("app_cli_path"))} app`;
            sendText += `\n\n<monocode_app>\nThe user's Operator command enables app access in this thread, including later turns without the command. You can start session tabs or split session panes right or down, list and create project worktrees, choose a new session's checkout, read and continue other project sessions, save unsent drafts, organize session folders, and read or write saved notes through its local CLI. Run \`${cli} --help\` for exact commands and JSON fields, then use it as needed for the user's request. When reading another session, start with its latest two or three user/assistant exchanges. Request older exchanges with nextBefore or a larger excerpt only if needed. The CLI uses a session credential already in your environment; never print it. New sessions inherit this session's permission mode unless runtimeMode is set explicitly. For a new session with a draft, call sessions.start with its prompt and draft:true; do not submit a seed prompt. The returned ID can be used as besideSessionId to split its pane again or moved into a folder immediately. A normal sessions.start submits its prompt but returns after acceptance, so do not wait for that agent to finish before organizing it.\n</monocode_app>`;
          }
          await sendTurn(sendText);
          acceptEditedResend();
          if (proposalDraft && !providerFailureSeen) {
            completedProposal = await completeOrRepairOrchestrationProposal(
              proposalDraft,
              nativeProposalText || proposalText,
              async (repairPrompt) => {
                proposalText = "";
                nativeProposalText = "";
                await sendTurn(repairPrompt, []);
                if (providerFailureSeen)
                  throw new Error(
                    controlOutcome.error ??
                      "The lead could not repair the proposal.",
                  );
                return nativeProposalText || proposalText;
              },
              () =>
                turnGen.current.get(sessionId) === gen &&
                !isProviderFailureText(nativeProposalText || proposalText),
            );
          }
          if (turnGen.current.get(sessionId) !== gen) return;
          if (wrap) {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s;
                const ready = isPreparingHandoff(s)
                  ? completeHandoff(s, wrap.text)
                  : s;
                // A command owns its arguments; deliver the recap with the next chat prompt.
                return rawCommand ? ready : consumeHandoff(ready);
              }),
            );
          }
          buildSucceeded = true;
        } catch (error: unknown) {
          recoverEditedResend();
          if (turnGen.current.get(sessionId) !== gen) return;
          if (wrap) revealHandoff(wrap.text);
          const message =
            error instanceof Error
              ? error.message
              : String(error) || `${current.harness} adapter failed`;
          controlOutcome.error = message;
          if (!providerFailureSeen) {
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message,
            });
          }
          providerFailureSeen = true;
        } finally {
          if (turnGen.current.get(sessionId) !== gen) return;
          flushHarnessEvents();
          controlOutcome = {
            status:
              providerFailureSeen ||
              isProviderFailureText(controlText) ||
              !buildSucceeded
                ? "failed"
                : "completed",
            text: controlText.trim(),
            ...(providerFailureSeen ? { error: controlOutcome.error } : {}),
          };
          // A failed provider can leave its process alive with a dead event
          // stream or poisoned turn state. Park it now; the next prompt will
          // reconnect and resume through a fresh transport.
          if (providerFailureSeen) {
            await stopHarnessSession(current.harness, sessionId).catch(
              () => undefined,
            );
          }
          await flushSessionCheckpoint(sessionId);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              const stopped = stopStreaming(s);
              const providerFailed =
                providerFailureSeen ||
                isProviderFailureText(lastAssistantTextInTurn(stopped));
              const finalized =
                proposalDraft && proposalId
                  ? withOrchestrationProposal(
                      stopped,
                      proposalId,
                      completedProposal && !providerFailed && buildSucceeded
                        ? completedProposal
                        : completeOrchestrationProposal(
                            proposalDraft,
                            nativeProposalText || proposalText,
                            providerFailed || !buildSucceeded
                              ? (controlOutcome.error ??
                                  "The lead could not finish planning.")
                              : undefined,
                          ),
                    )
                  : intent === "plan" && !nativePlanSeen && !providerFailed
                    ? promoteLastAssistantToPlan(stopped, planEventKey)
                    : stopped;
              return approvedPlan && intent === "build"
                ? withPlanStatus(
                    finalized,
                    approvedPlan.id,
                    buildSucceeded && !providerFailed ? "built" : "ready",
                  )
                : finalized;
            }),
          );
          // Next tick: the flush above has rendered by then, so the banner
          // quotes the reply's final text rather than the previous batch.
          window.setTimeout(() => {
            const finished = sessionsRef.current.find(
              (s) => s.id === sessionId,
            );
            const visible = sessionId === activeSessionIdRef.current;
            if (finished) void announceSessionFinished(finished, visible);
          }, 0);
          notifyReviewChanged(sessionId);
          notifyGitChanged();
          nudgeWorkspace(workCwd);
          nudgeWatchedFiles();
          window.setTimeout(() => nudgeWatchedFiles(), 150);
        }
      })()
        .catch((error: unknown) => {
          controlOutcome = {
            status: "failed",
            text: controlText,
            error: error instanceof Error ? error.message : String(error),
          };
          if (turnGen.current.get(sessionId) === gen) {
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message: controlOutcome.error!,
            });
            flushHarnessEvents();
            setSessions((prev) =>
              prev.map((session) => {
                if (session.id !== sessionId) return session;
                const stopped = {
                  ...stopStreaming(session),
                  worktreePreparing: undefined,
                  worktreeCreation:
                    session.worktreeCreation?.status === "creating"
                      ? failWorktreeCreation(
                          session.worktreeCreation,
                          session.worktreeCreation.id,
                          controlOutcome.error ?? "",
                        )
                      : session.worktreeCreation,
                };
                return proposalId && proposalDraft
                  ? withOrchestrationProposal(
                      stopped,
                      proposalId,
                      completeOrchestrationProposal(
                        proposalDraft,
                        "",
                        controlOutcome.error,
                      ),
                    )
                  : stopped;
              }),
            );
          }
        })
        .finally(() => {
          titleCoordinator.current!.settled(
            sessionId,
            turnGen.current.get(sessionId) !== gen ||
              controlOutcome.status === "cancelled",
          );
          editedResend?.reject();
          if (editedResend) editedResends.finish(sessionId);
          options?.onSettled?.(
            turnGen.current.get(sessionId) !== gen
              ? { status: "cancelled", text: controlText }
              : controlOutcome,
          );
        });
      return true;
    },
    [
      applyProjectLocationChange,
      dismissNoticesForContinuedSession,
      enqueueHarnessEvent,
      flushHarnessEvents,
    ],
  );
  submitAfterProjectSyncRef.current = submitSession;
  // Interactive callers use the immediate result to clear their composer. The
  // queued-launch receiver uses submitSession to await the actual acceptance.
  const onSubmit = useCallback(
    (...args: Parameters<Submit>): boolean => {
      // Reject before async preparation can make the composer clear its draft.
      if (workspaceNavigation.isSwitching(args[0])) return false;
      const questionAnswer = args[3]?.questionAnswer;
      if (questionAnswer) {
        const session = sessionsRef.current.find(
          (entry) => entry.id === args[0],
        );
        if (!session) return false;
        args[1] = questionFollowUp(session, questionAnswer);
        args[3] = { ...args[3], followUpBehavior: "steer" };
      }
      const recordAccepted = (accepted: boolean) => {
        if (accepted && questionAnswer)
          setSessions((sessions) =>
            sessions.map((session) =>
              session.id === args[0]
                ? recordQuestionAnswer(session, questionAnswer)
                : session,
            ),
          );
        return accepted;
      };
      const result = submitSession(...args);
      if (typeof result === "boolean") return recordAccepted(result);
      // Deferred errors have already been displayed by submitAfterProjectSync.
      void result.then(recordAccepted).catch(() => undefined);
      return true;
    },
    [submitSession],
  );

  const automationSessionReservations = useRef(new Set<string>());
  const automationRecoveryRef = useRef<Promise<void> | null>(null);
  const automationRecoveryCutoffRef = useRef(Date.now());

  const launchAutomation = useCallback(
    async (
      automation: Automation,
      run: AutomationRun,
      reveal = false,
      prompt = run.prompt ?? automation.prompt,
      sourceWorkItem?: LinkedWorkItem,
    ) => {
      let reservationId: string | undefined;
      let releaseAfterSettle = false;
      const releaseReservation = () => {
        if (!reservationId) return;
        automationSessionReservations.current.delete(reservationId);
        reservationId = undefined;
      };
      try {
        const eventRun = run.trigger === "event";
        const linkedWorkItem =
          sourceWorkItem ?? linkedWorkItemFromAutomationEvent(run);
        let session =
          automation.reuseSession && automation.lastSessionId
            ? sessionsRef.current.find(
                (entry) =>
                  entry.id === automation.lastSessionId &&
                  entry.harness === automation.harness &&
                  !entry.busy &&
                  !entry.worktreeRemoved &&
                  !automationSessionReservations.current.has(entry.id) &&
                  (automation.workspaceMode === "current"
                    ? entry.workspaceMode !== "worktree" &&
                      !entry.worktreeCwd &&
                      pathKey(entry.cwd) === pathKey(automation.cwd)
                    : automation.workspaceMode === "existing"
                      ? pathKey(sessionWorkCwd(entry)) ===
                        pathKey(automation.worktreeCwd ?? "")
                      : false),
              )
            : undefined;

        if (!session) {
          session = {
            ...newSession(
              automation.harness,
              automation.cwd,
              automation.model,
              automation.runtimeMode,
              automation.modelSettings,
            ),
            title: eventRun
              ? HARNESS_LABEL[automation.harness]
              : formatSessionTitle(automation.harness, automation.name),
            titleState: {
              source: eventRun ? ("placeholder" as const) : ("manual" as const),
              epoch: 0,
              purpose: "initial" as const,
              fallbackAttempted: false,
            },
            automationId: automation.id,
            ...(linkedWorkItem ? { linkedWorkItem } : {}),
            ...(automation.workspaceMode === "worktree"
              ? { workspaceMode: "worktree" as const, worktreeBase: "HEAD" }
              : automation.workspaceMode === "existing" &&
                  automation.worktreeCwd
                ? { worktreeCwd: automation.worktreeCwd }
                : {}),
          };
          const nextSessions = [...sessionsRef.current, session];
          sessionsRef.current = nextSessions;
          setSessions(nextSessions);
          const tab = newTab(session.id);
          appendTab(tab, automation.cwd);
          if (reveal) {
            setActiveTabId(tab.id);
            setComposerFocused(false);
          }
        } else {
          const stamped = {
            ...session,
            automationId: automation.id,
            model: automation.model,
            modelSettings: automation.modelSettings ?? {},
            runtimeMode: automation.runtimeMode,
            ...(linkedWorkItem ? { linkedWorkItem } : {}),
          };
          session = stamped;
          const nextSessions = sessionsRef.current.map((entry) =>
            entry.id === stamped.id ? stamped : entry,
          );
          sessionsRef.current = nextSessions;
          setSessions(nextSessions);
          if (reveal) {
            focusOpenSession(session.id);
          }
        }

        reservationId = session.id;
        automationSessionReservations.current.add(session.id);

        if (reveal) {
          setSidebarTab("sessions", session.cwd);
        }

        await updateAutomationRun(run.id, "running", {
          sessionId: session.id,
        });
        // From here the settlement callback owns reservation cleanup, including
        // a rejected submission that never starts an agent turn.
        releaseAfterSettle = true;
        await submitWithSettlement({
          submit: (onSettled) =>
            submitSession(session.id, prompt, [], {
              refreshTitle: eventRun,
              onSettled,
            }),
          rejectionMessage:
            "The selected agent session could not start this run.",
          onSettled: (outcome) => {
            const status =
              outcome.status === "completed"
                ? "succeeded"
                : outcome.status === "cancelled"
                  ? "cancelled"
                  : "failed";
            void updateAutomationRun(run.id, status, {
              sessionId: session.id,
              ...(outcome.error ? { error: outcome.error } : {}),
            })
              .catch(() => undefined)
              .finally(releaseReservation);
          },
        });
      } catch (reason: unknown) {
        await updateAutomationRun(run.id, "failed", {
          error: reason instanceof Error ? reason.message : String(reason),
        }).catch(() => undefined);
        throw reason;
      } finally {
        if (!releaseAfterSettle) releaseReservation();
      }
    },
    [appendTab, focusOpenSession, submitSession],
  );

  const launchQuickSession = useCallback(
    (
      launch: QuickLaunch,
      deliveryId: string,
      placement?: AppSessionPlacement,
    ) =>
      acceptQuickLaunch(
        launch,
        deliveryId,
        {
          getSessions: () => sessionsRef.current,
          updateSessions: (update) => {
            sessionsRef.current = update(sessionsRef.current);
            // Compose with submission's queued transcript updates.
            setSessions(update);
          },
          appendTab,
          placeSession: (sessionId, target, cwd) => {
            const anchor = sessionsRef.current.find(
              (session) => session.id === target.besideSessionId,
            );
            const tab = tabsRef.current.find((entry) =>
              leafIds(entry.layout).includes(target.besideSessionId),
            );
            if (!anchor || !sameProjectPath(anchor.cwd, cwd) || !tab)
              throw new Error(
                "The target session must be open in this project",
              );
            const nextTabs = tabsRef.current.map((entry) =>
              entry.id === tab.id
                ? {
                    ...entry,
                    layout: splitPane(
                      entry.layout,
                      target.besideSessionId,
                      target.direction,
                      sessionId,
                    ),
                    focusedId: launch.reveal ? sessionId : entry.focusedId,
                    diffFocused: launch.reveal ? false : entry.diffFocused,
                  }
                : entry,
            );
            tabsRef.current = nextTabs;
            setTabs(nextTabs);
            return tab.id;
          },
          setProjectCwd,
          setRecents,
          revealTab: (id, cwd) => {
            setActiveTabId(id);
            setComposerFocused(false);
            setSidebarTab("sessions", cwd);
          },
          submit: submitSession,
          saveDraft: (id, prompt, attachments, requestId) =>
            flushSync(() => onSaveDraft(id, prompt, attachments, requestId)),
        },
        placement,
      ),
    [appendTab, submitSession, onSaveDraft],
  );
  useQuickComposerLaunches(launchQuickSession);
  const launchQuickSessionRef = useRef(launchQuickSession);
  launchQuickSessionRef.current = launchQuickSession;
  const submitSessionRef = useRef(submitSession);
  submitSessionRef.current = submitSession;
  const saveDraftRef = useRef(onSaveDraft);
  saveDraftRef.current = onSaveDraft;
  const ensureOpenSessionRef = useRef(ensureOpenSession);
  ensureOpenSessionRef.current = ensureOpenSession;

  const appReceipts = useRef(
    new Map<string, { signature: string; promise: Promise<unknown> }>(),
  );

  const ensureAutomationRecovery = useCallback(() => {
    if (!automationRecoveryRef.current) {
      const recovery = (async () => {
        const pending = await recoverAutomationRuns(
          automationRecoveryCutoffRef.current,
        );
        for (const item of pending) {
          await launchAutomation(
            item.automation,
            item.run,
            false,
            item.run.prompt ?? item.automation.prompt,
          ).catch(() => undefined);
        }
      })();
      automationRecoveryRef.current = recovery.catch((error: unknown) => {
        automationRecoveryRef.current = null;
        throw error;
      });
    }
    return automationRecoveryRef.current;
  }, [launchAutomation]);

  useEffect(() => {
    let disposed = false;
    let evaluating = false;
    const evaluate = async () => {
      if (disposed || evaluating) return;
      evaluating = true;
      try {
        await ensureAutomationRecovery();
        const due = await claimDueAutomations();
        for (const item of due) {
          if (disposed) break;
          void launchAutomation(item.automation, item.run).catch(
            () => undefined,
          );
        }
      } catch {
        // Scheduling retries on the next tick; individual claimed runs record
        // launch failures in launchAutomation.
      } finally {
        evaluating = false;
      }
    };
    void evaluate();
    const timer = window.setInterval(() => void evaluate(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ensureAutomationRecovery, launchAutomation]);

  const onInboxAppeared = useCallback(
    (items: Parameters<typeof claimInboxAutomationRuns>[0]) => {
      void ensureAutomationRecovery()
        .then(() => claimInboxAutomationRuns(items))
        .then((due) => {
          for (const item of due) {
            void launchAutomation(
              item.automation,
              item.run,
              false,
              item.prompt,
              item.linkedWorkItem,
            ).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    },
    [ensureAutomationRecovery, launchAutomation],
  );

  const onUpdatePlan = useCallback(
    (sessionId: string, blockId: string, text: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (sessionUsesHost(session)) return session;
          if (session.id !== sessionId || session.busy) return session;
          return {
            ...session,
            blocks: session.blocks.map((block) => {
              if (
                block.id !== blockId ||
                block.role !== "plan" ||
                block.plan?.status === "streaming" ||
                block.plan?.status === "building" ||
                block.plan?.status === "built"
              ) {
                return block;
              }
              const originalText = block.plan?.originalText ?? block.text;
              return {
                ...block,
                text,
                plan: {
                  ...(block.plan ?? { status: "ready" as const }),
                  status: "ready" as const,
                  originalText,
                  edited: text !== originalText,
                },
              };
            }),
          };
        }),
      );
    },
    [],
  );

  const onBuildPlan = useCallback(
    (sessionId: string, blockId: string, target?: PlanBuildTarget) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      if (session && sessionUsesHost(session)) {
        buildRemotePlan(sessionId, blockId, target);
        return;
      }
      const block = session?.blocks.find((entry) => entry.id === blockId);
      if (
        !session ||
        session.busy ||
        block?.role !== "plan" ||
        !!block.orchestration ||
        !block.text.trim() ||
        block.plan?.status === "streaming" ||
        block.plan?.status === "building" ||
        block.plan?.status === "built"
      ) {
        return;
      }
      if (target && session.modelSettings) {
        saveLastModelSettings(session.modelSettings, "fill");
      }
      onSubmit(sessionId, "Build approved plan", [], {
        intent: "build",
        planBlockId: blockId,
        buildTarget: target,
      });
    },
    [onSubmit],
  );

  useEffect(() => {
    const timers: number[] = [];
    const scheduled = new Set<string>();
    for (const session of sessions) {
      // The Host owns these queues, including native conversations in local projects.
      if (sessionUsesHost(session)) continue;
      const queued = session.queuedMessages ?? [];
      if (session.busy || queued.length === 0) continue;

      if (session.queueStatus === "resuming") {
        setSessions((prev) =>
          prev.map((entry) =>
            entry.id === session.id
              ? { ...entry, queueStatus: "active" }
              : entry,
          ),
        );
        continue;
      }
      if (
        !canDispatchQueuedHead(session) ||
        queueDispatchingRef.current.has(session.id)
      ) {
        continue;
      }

      const next = queued[0];
      if (!next) continue;
      queueDispatchingRef.current.add(session.id);
      scheduled.add(session.id);
      timers.push(
        window.setTimeout(() => {
          queueDispatchingRef.current.delete(session.id);
          const latest = sessionsRef.current.find(
            (entry) => entry.id === session.id,
          );
          const head = latest?.queuedMessages?.[0];
          if (
            !latest ||
            !head ||
            head.id !== next.id ||
            !canDispatchQueuedHead(latest)
          ) {
            return;
          }
          onSubmit(session.id, head.text, head.attachments, {
            queuedMessageId: head.id,
            noteCard: head.noteCard,
            handoffCard: head.handoffCard,
            intent: head.intent,
          });
        }, 0),
      );
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      for (const id of scheduled) queueDispatchingRef.current.delete(id);
    };
  }, [onSubmit, sessions]);

  const onDeleteQueuedMessage = useCallback(
    (sessionId: string, messageId: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? dequeueQueuedMessage(session, messageId)
            : session,
        ),
      );
    },
    [],
  );

  const onQueuedMessageEditingChange = useCallback(
    (sessionId: string, messageId?: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? { ...session, editingQueuedMessageId: messageId }
            : session,
        ),
      );
    },
    [],
  );

  const onEditQueuedMessage = useCallback(
    (sessionId: string, messageId: string, text: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                queuedMessages: session.queuedMessages?.map((message) =>
                  message.id === messageId ? { ...message, text } : message,
                ),
                editingQueuedMessageId: undefined,
              }
            : session,
        ),
      );
    },
    [],
  );

  const onSteerQueuedMessage = useCallback(
    (sessionId: string, messageId: string) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      const message = session
        ? queuedMessageForSubmit(session, messageId, "steer")
        : undefined;
      if (!session || !message) return;
      if (message.intent === "orchestrate" && session.busy) {
        enqueueHarnessEvent(sessionId, {
          type: "status",
          text: "Orchestration planning will start after the current turn finishes.",
        });
        flushHarnessEvents();
        return;
      }
      onSubmit(sessionId, message.text, message.attachments, {
        followUpBehavior: "steer",
        queuedMessageId: message.id,
        noteCard: message.noteCard,
        handoffCard: message.handoffCard,
        intent: message.intent,
      });
    },
    [onSubmit, enqueueHarnessEvent, flushHarnessEvents],
  );

  const onResumeQueue = useCallback(
    (sessionId: string) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      if (
        !session ||
        session.busy ||
        session.queueStatus !== "paused" ||
        !session.queuedMessages?.length
      ) {
        return;
      }
      setSessions((prev) =>
        prev.map((entry) =>
          entry.id === sessionId
            ? { ...entry, queueStatus: "resuming" }
            : entry,
        ),
      );
      onSubmit(sessionId, CONTINUE_PROMPT, [], {
        followUpBehavior: "steer",
      });
    },
    [onSubmit],
  );

  const onUsageLimitDismiss = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId && session.usageLimit
          ? { ...session, usageLimit: undefined }
          : session,
      ),
    );
  }, []);

  const onUsageLimitResumeAtReset = useCallback(
    (sessionId: string, enabled: boolean) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId && session.usageLimit
            ? {
                ...session,
                usageLimit: { ...session.usageLimit, resumeAtReset: enabled },
              }
            : session,
        ),
      );
    },
    [],
  );

  const onUsageLimitResume = useCallback(
    (sessionId: string) => {
      const session = sessionsRef.current.find(
        (entry) => entry.id === sessionId,
      );
      if (!session?.usageLimit || session.busy) return;
      onUsageLimitDismiss(sessionId);
      onSubmit(sessionId, CONTINUE_PROMPT);
    },
    [onSubmit, onUsageLimitDismiss],
  );

  const [usageLimitTick, setUsageLimitTick] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const timers: number[] = [];
    const scheduled = new Set<string>();
    let nextCheck = Number.POSITIVE_INFINITY;
    for (const session of sessions) {
      const limit = session.usageLimit;
      if (!limit?.resumeAtReset || limit.resetsAt == null) continue;
      if (!usageLimitResumeDue(session, now)) {
        nextCheck = Math.min(
          nextCheck,
          limit.resetsAt + USAGE_LIMIT_RESUME_GRACE_MS - now,
        );
        continue;
      }
      if (usageResumingRef.current.has(session.id)) continue;
      usageResumingRef.current.add(session.id);
      scheduled.add(session.id);
      timers.push(
        window.setTimeout(() => {
          usageResumingRef.current.delete(session.id);
          const latest = sessionsRef.current.find(
            (entry) => entry.id === session.id,
          );
          if (latest && usageLimitResumeDue(latest, Date.now())) {
            onUsageLimitResume(session.id);
          }
        }, 0),
      );
    }
    if (Number.isFinite(nextCheck)) {
      // Re-check every minute at most: timers drift while the machine sleeps.
      timers.push(
        window.setTimeout(
          () => setUsageLimitTick((tick) => tick + 1),
          Math.max(1_000, Math.min(nextCheck, 60_000)),
        ),
      );
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      for (const id of scheduled) usageResumingRef.current.delete(id);
    };
  }, [onUsageLimitResume, sessions, usageLimitTick]);

  // The stream does not always say when the limit resets; ask the provider.
  useEffect(() => {
    for (const session of sessions) {
      const limit = session.usageLimit;
      if (!limit || limit.resetsAt != null) continue;
      if (usageResetLookups.current.has(limit)) continue;
      const fetchLimits =
        session.harness === "claude"
          ? fetchClaudeRateLimits
          : session.harness === "codex"
            ? fetchCodexRateLimits
            : undefined;
      if (!fetchLimits) continue;
      usageResetLookups.current.add(limit);
      void fetchLimits(session.providerAccountId).then((limits) => {
        const resetsAt = exhaustedWindowResetAt(limits);
        if (resetsAt == null) return;
        setSessions((prev) =>
          prev.map((entry) =>
            entry.id === session.id && entry.usageLimit === limit
              ? { ...entry, usageLimit: { ...limit, resetsAt } }
              : entry,
          ),
        );
      });
    }
  }, [sessions]);

  const openSessionBeside = useCallback(
    (
      sourceId: string,
      session: Session,
      cwd: string,
      focusComposer = false,
    ) => {
      const nextSessions = [...sessionsRef.current, session];
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);

      const tab = tabsRef.current.find((entry) =>
        leafIds(entry.layout).includes(sourceId),
      );
      if (tab) {
        const nextTabs = tabsRef.current.map((entry) =>
          entry.id === tab.id
            ? {
                ...entry,
                layout: splitPane(entry.layout, sourceId, "right", session.id),
                focusedId: session.id,
                diffFocused: false,
              }
            : entry,
        );
        tabsRef.current = nextTabs;
        setTabs(nextTabs);
        if (tab.id !== activeTabIdRef.current) setActiveTabId(tab.id);
      } else {
        const nextTab = newTab(session.id);
        appendTab(nextTab, cwd);
        setActiveTabId(nextTab.id);
      }

      setProjectTerminalFocused(false);
      setComposerFocused(focusComposer);
    },
    [appendTab],
  );

  const onSecondOpinion = useCallback(
    (sourceId: string, target: ModelTarget, turn: Block[]) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sourceId,
      );
      if (!source || source.worktreeRemoved) return;
      const { harness, model, modelSettings } = target;
      const cwd = sessionWorkCwd(source);
      const from = harnessForTurn(source.blocks, turn, source.harness);
      const request = buildSecondOpinionRequest({
        from,
        to: harness,
        turn,
        cwd,
      });
      const session = {
        ...newSession(harness, source.cwd, model, source.runtimeMode),
        worktreeCwd: source.worktreeCwd,
        branch: source.branch,
        modelSettings: mergeModelSettings(
          resolveModel(harness, model),
          modelSettings,
        ),
        title: formatSessionTitle(harness, SECOND_OPINION_TITLE),
        titleState: {
          source: "manual" as const,
          epoch: 0,
          purpose: "initial" as const,
          fallbackAttempted: false,
        },
      };
      openSessionBeside(sourceId, session, source.cwd);
      onSubmit(session.id, request.prompt, [], request.options);
    },
    [onSubmit, openSessionBeside],
  );
  const updateBtwThread = useCallback(
    (
      sessionId: string,
      userBlockId: string,
      threadId: string,
      update: (thread: BtwThread | undefined) => BtwThread | undefined,
    ): Session | undefined => {
      const previous = sessionsRef.current;
      let updatedSession: Session | undefined;
      const next = previous.map((session) => {
        if (session.id !== sessionId) return session;
        const blockIndex = session.blocks.findIndex(
          (block) => block.id === userBlockId && block.role === "user",
        );
        if (blockIndex < 0) return session;
        const block = session.blocks[blockIndex];
        const current = block.btwThreads?.find(
          (thread) => thread.id === threadId,
        );
        const nextThread = update(current);
        if (!nextThread) return session;
        const nextBlock = current
          ? replaceBtwThread(block, nextThread)
          : {
              ...block,
              btwThreads: [...(block.btwThreads ?? []), nextThread],
            };
        const blocks = session.blocks.slice();
        blocks[blockIndex] = nextBlock;
        updatedSession = { ...session, blocks };
        return updatedSession;
      });
      if (!updatedSession) return undefined;
      sessionsRef.current = next;
      setSessions(next);
      persistSession(updatedSession);
      return updatedSession;
    },
    [persistSession],
  );

  const removeBtwThread = useCallback(
    (
      sessionId: string,
      userBlockId: string,
      threadId: string,
    ): Session | undefined => {
      const previous = sessionsRef.current;
      let updatedSession: Session | undefined;
      const next = previous.map((session) => {
        if (session.id !== sessionId) return session;
        const blockIndex = session.blocks.findIndex(
          (block) => block.id === userBlockId && block.role === "user",
        );
        if (blockIndex < 0) return session;
        const block = session.blocks[blockIndex];
        const threads = block.btwThreads ?? [];
        if (!threads.some((thread) => thread.id === threadId)) return session;
        const nextThreads = threads.filter((thread) => thread.id !== threadId);
        const nextBlock = {
          ...block,
          btwThreads: nextThreads.length > 0 ? nextThreads : undefined,
        };
        const blocks = session.blocks.slice();
        blocks[blockIndex] = nextBlock;
        updatedSession = { ...session, blocks };
        return updatedSession;
      });
      if (!updatedSession) return undefined;
      sessionsRef.current = next;
      setSessions(next);
      persistSession(updatedSession);
      return updatedSession;
    },
    [persistSession],
  );

  const runBtwRequest = useCallback(
    (input: {
      sessionId: string;
      userBlockId: string;
      source: Session;
      thread: BtwThread;
      harness: HarnessId;
    }) => {
      const harness = input.harness;
      if (!supportsBtwHarness(harness)) return;
      const cwd = sessionWorkCwd(input.source);
      const model = nativeModelId(
        input.thread.model ?? input.source.model,
      ).trim();
      if (!cwd || cwd === "~") {
        updateBtwThread(
          input.sessionId,
          input.userBlockId,
          input.thread.id,
          (thread) =>
            thread
              ? {
                  ...thread,
                  status: "error",
                  updatedAt: Date.now(),
                  error:
                    "A project working directory is required for this question.",
                }
              : undefined,
        );
        return;
      }
      if (!model && harness === "codex") {
        updateBtwThread(
          input.sessionId,
          input.userBlockId,
          input.thread.id,
          (thread) =>
            thread
              ? {
                  ...thread,
                  status: "error",
                  updatedAt: Date.now(),
                  error: "The selected Codex model is unavailable.",
                }
              : undefined,
        );
        return;
      }

      let prompt: string;
      try {
        prompt = buildBtwPrompt({
          blocks: input.source.blocks,
          thread: input.thread,
          cwd,
        });
      } catch (error) {
        updateBtwThread(
          input.sessionId,
          input.userBlockId,
          input.thread.id,
          (thread) =>
            thread
              ? {
                  ...thread,
                  status: "error",
                  updatedAt: Date.now(),
                  error:
                    error instanceof Error
                      ? error.message
                      : "The completed turn is no longer available.",
                }
              : undefined,
        );
        return;
      }

      const key = `${input.sessionId}:${input.thread.id}`;
      btwRequestsRef.current.get(key)?.controller.abort();
      const controller = new AbortController();
      btwRequestsRef.current.set(key, {
        sessionId: input.sessionId,
        controller,
      });

      const userMessageId =
        input.thread.messages[input.thread.messages.length - 1]?.id ??
        input.thread.id;
      const responseModel = model || input.source.model;

      void runHarnessTextPrompt({
        harness,
        cwd,
        providerAccountId: input.source.providerAccountId,
        model: model || undefined,
        modelSettings: input.thread.modelSettings ?? input.source.modelSettings,
        ephemeral: false,
        threadId: input.thread.providerThreadId,
        onThreadId: (providerThreadId) => {
          if (controller.signal.aborted) return;
          updateBtwThread(
            input.sessionId,
            input.userBlockId,
            input.thread.id,
            (thread) =>
              thread && thread.providerThreadId !== providerThreadId
                ? {
                    ...thread,
                    providerThreadId,
                    updatedAt: Date.now(),
                  }
                : thread,
          );
        },
        onEvent: (event) => {
          if (controller.signal.aborted) return;
          updateBtwThread(
            input.sessionId,
            input.userBlockId,
            input.thread.id,
            (thread) =>
              thread?.status === "running"
                ? {
                    ...thread,
                    updatedAt: Date.now(),
                    pendingBlocks: applyBtwHarnessEvent(
                      thread.pendingBlocks ?? [],
                      event,
                      harness,
                      responseModel,
                      userMessageId,
                    ),
                  }
                : undefined,
          );
        },
        intent: "plan",
        prompt,
        signal: controller.signal,
      })
        .then((output) => {
          if (controller.signal.aborted) return;
          const text = output.trim();
          if (!text) {
            throw new Error(
              `${HARNESS_TITLE[harness]} returned an empty side answer.`,
            );
          }
          updateBtwThread(
            input.sessionId,
            input.userBlockId,
            input.thread.id,
            (thread) => {
              if (!thread) return undefined;
              const pendingBlocks = thread.pendingBlocks ?? [];
              const blocks =
                pendingBlocks.length > 0
                  ? sealBtwResponseBlocks(
                      pendingBlocks,
                      harness,
                      responseModel,
                      userMessageId,
                    )
                  : undefined;
              return {
                ...thread,
                status: "ready",
                updatedAt: Date.now(),
                pendingBlocks: undefined,
                messages: [
                  ...thread.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    text,
                    createdAt: Date.now(),
                    ...(blocks?.length ? { blocks } : {}),
                  },
                ],
                error: undefined,
              };
            },
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof Error
              ? error.message
              : `${HARNESS_TITLE[harness]} could not answer this side question.`;
          updateBtwThread(
            input.sessionId,
            input.userBlockId,
            input.thread.id,
            (thread) =>
              thread
                ? {
                    ...thread,
                    status: "error",
                    updatedAt: Date.now(),
                    pendingBlocks: undefined,
                    error: message,
                  }
                : undefined,
          );
        })
        .finally(() => {
          if (btwRequestsRef.current.get(key)?.controller === controller) {
            btwRequestsRef.current.delete(key);
          }
        });
    },
    [updateBtwThread],
  );

  const onBtwSubmit = useCallback(
    (
      sessionId: string,
      turn: Block[],
      threadId: string,
      messageId: string,
      text: string,
      model?: string,
      modelSettings?: Record<string, string>,
    ) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const sourceUserId = turn.find((block) => block.role === "user")?.id;
      const sourceEndBlockId = turn[turn.length - 1]?.id;
      const turnHarness = source
        ? harnessForTurn(source.blocks, turn, source.harness)
        : undefined;
      const turnModel = turn.find((block) => block.role === "user")?.turnModel
        ?.id;
      const sourceBlockEarly = source?.blocks.find(
        (block) => block.id === sourceUserId && block.role === "user",
      );
      const existingEarly = sourceBlockEarly?.btwThreads?.find(
        (thread) => thread.id === threadId,
      );
      const requestHarness = source
        ? supportsBtwHarness(turnHarness)
          ? turnHarness
          : (existingEarly?.harness ??
            btwTurnHarness(source.blocks, turn, source.harness))
        : undefined;
      if (
        !source ||
        !supportsBtwHarness(requestHarness) ||
        source.worktreeRemoved ||
        !sourceUserId ||
        !sourceEndBlockId
      ) {
        return false;
      }
      const sourceBlock = sourceBlockEarly;
      if (!sourceBlock) return false;
      const existing = existingEarly;
      const selectedModel =
        model?.trim() ||
        existing?.model ||
        turnModel ||
        nativeModelId(source.model).trim();
      const selectedModelSettings =
        modelSettings ??
        existing?.modelSettings ??
        preferredModelSettings(
          resolveModel(requestHarness!, selectedModel || source.model),
          source.modelSettings,
        );
      if (existing?.status === "running") return false;
      if (existing && existing.sourceEndBlockId !== sourceEndBlockId) {
        return false;
      }
      const now = Date.now();
      const thread: BtwThread = existing
        ? {
            ...existing,
            harness: existing.harness ?? turnHarness,
            model: selectedModel || undefined,
            modelSettings: selectedModelSettings,
            status: "running",
            updatedAt: now,
            error: undefined,
            pendingBlocks: [],
            messages: [
              ...existing.messages,
              { id: messageId, role: "user", text, createdAt: now },
            ],
          }
        : {
            id: threadId,
            sourceEndBlockId,
            createdAt: now,
            updatedAt: now,
            status: "running",
            pendingBlocks: [],
            harness: requestHarness,
            ...(selectedModel ? { model: selectedModel } : {}),
            modelSettings: selectedModelSettings,
            messages: [{ id: messageId, role: "user", text, createdAt: now }],
          };
      const updated = updateBtwThread(
        sessionId,
        sourceUserId,
        threadId,
        () => thread,
      );
      if (!updated) return false;
      runBtwRequest({
        sessionId,
        userBlockId: sourceUserId,
        source,
        thread,
        harness: thread.harness ?? requestHarness!,
      });
      return true;
    },
    [runBtwRequest, updateBtwThread],
  );

  const onBtwModelChange = useCallback(
    (
      sessionId: string,
      turn: Block[],
      threadId: string,
      model: string,
      modelSettings: Record<string, string>,
    ) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const sourceUserId = turn.find((block) => block.role === "user")?.id;
      const turnHarness = source
        ? harnessForTurn(source.blocks, turn, source.harness)
        : undefined;
      const nextModel = model.trim();
      const sourceBlock = source?.blocks.find(
        (block) => block.id === sourceUserId && block.role === "user",
      );
      const threadHarness = source
        ? (sourceBlock?.btwThreads?.find((thread) => thread.id === threadId)
            ?.harness ??
          btwTurnHarness(source.blocks, turn, source.harness) ??
          turnHarness)
        : undefined;
      if (
        !source ||
        !supportsBtwHarness(threadHarness) ||
        source.worktreeRemoved ||
        !sourceUserId ||
        !nextModel
      ) {
        return;
      }
      updateBtwThread(sessionId, sourceUserId, threadId, (thread) =>
        thread
          ? {
              ...thread,
              model: nextModel,
              modelSettings,
              updatedAt: Date.now(),
            }
          : undefined,
      );
    },
    [updateBtwThread],
  );

  const onBtwDelete = useCallback(
    (sessionId: string, turn: Block[], threadId: string) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const sourceUserId = turn.find((block) => block.role === "user")?.id;
      const turnHarness = source
        ? harnessForTurn(source.blocks, turn, source.harness)
        : undefined;
      const sourceBlock = source?.blocks.find(
        (block) => block.id === sourceUserId && block.role === "user",
      );
      const threadHarness = source
        ? (sourceBlock?.btwThreads?.find((thread) => thread.id === threadId)
            ?.harness ??
          btwTurnHarness(source.blocks, turn, source.harness) ??
          turnHarness)
        : undefined;
      if (
        !source ||
        !supportsBtwHarness(threadHarness) ||
        source.worktreeRemoved ||
        !sourceUserId
      ) {
        return;
      }
      const requestKey = `${sessionId}:${threadId}`;
      btwRequestsRef.current.get(requestKey)?.controller.abort();
      btwRequestsRef.current.delete(requestKey);
      removeBtwThread(sessionId, sourceUserId, threadId);
    },
    [removeBtwThread],
  );

  // Stopping keeps whatever the side answer had streamed, like stopping a
  // main turn, and leaves the thread ready for the next question.
  const onBtwStop = useCallback(
    (sessionId: string, turn: Block[], threadId: string) => {
      const sourceUserId = turn.find((block) => block.role === "user")?.id;
      if (!sourceUserId) return;
      const key = `${sessionId}:${threadId}`;
      btwRequestsRef.current.get(key)?.controller.abort();
      btwRequestsRef.current.delete(key);
      updateBtwThread(sessionId, sourceUserId, threadId, (thread) => {
        if (!thread || thread.status !== "running") return thread;
        const harness = thread.harness;
        const userMessageId =
          thread.messages[thread.messages.length - 1]?.id ?? thread.id;
        const pending = thread.pendingBlocks ?? [];
        const blocks =
          pending.length > 0 && harness
            ? sealBtwResponseBlocks(
                pending,
                harness,
                thread.model ?? "",
                userMessageId,
              )
            : [];
        const text = blocks
          .filter((block) => block.role === "assistant")
          .map((block) => block.text)
          .join("\n\n")
          .trim();
        const now = Date.now();
        return {
          ...thread,
          status: "ready",
          updatedAt: now,
          pendingBlocks: undefined,
          error: undefined,
          messages: blocks.length
            ? [
                ...thread.messages,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  text,
                  createdAt: now,
                  blocks,
                },
              ]
            : thread.messages,
        };
      });
    },
    [updateBtwThread],
  );

  const onBtwRetry = useCallback(
    (sessionId: string, turn: Block[], threadId: string) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const sourceUserId = turn.find((block) => block.role === "user")?.id;
      const turnHarness = source
        ? harnessForTurn(source.blocks, turn, source.harness)
        : undefined;
      const sourceBlock = source?.blocks.find(
        (block) => block.id === sourceUserId && block.role === "user",
      );
      const existing = sourceBlock?.btwThreads?.find(
        (thread) => thread.id === threadId,
      );
      const threadHarness = source
        ? (existing?.harness ??
          btwTurnHarness(source.blocks, turn, source.harness) ??
          turnHarness)
        : undefined;
      if (
        !source ||
        !supportsBtwHarness(threadHarness) ||
        source.worktreeRemoved ||
        !sourceUserId
      ) {
        return;
      }
      if (!sourceBlock || !existing || existing.status !== "error") return;
      const thread: BtwThread = {
        ...existing,
        status: "running",
        updatedAt: Date.now(),
        error: undefined,
        pendingBlocks: [],
      };
      const updated = updateBtwThread(
        sessionId,
        sourceUserId,
        threadId,
        () => thread,
      );
      if (!updated) return;
      runBtwRequest({
        sessionId,
        userBlockId: sourceUserId,
        source: updated,
        thread,
        harness: thread.harness ?? threadHarness!,
      });
    },
    [runBtwRequest, updateBtwThread],
  );

  const onHandoff = useCallback(
    (sourceId: string, target: ModelTarget, turn: Block[]) => {
      const source = sessionsRef.current.find(
        (session) => session.id === sourceId,
      );
      if (!source || source.worktreeRemoved) return;
      const { harness, model, modelSettings } = target;
      const cwd = sessionWorkCwd(source);
      const from = harnessForTurn(source.blocks, turn, source.harness);
      const sliced = sessionThroughTurn(source, turn);
      const userRequest = turnUserRequest(turn);
      const files = turnEditedFiles(sliced.blocks, cwd);
      const display = sessionDisplayTitle(source.title, source.harness);
      const session = {
        ...newSession(harness, source.cwd, model, source.runtimeMode),
        worktreeCwd: source.worktreeCwd,
        branch: source.branch,
        modelSettings: mergeModelSettings(
          resolveModel(harness, model),
          modelSettings,
        ),
        title: formatSessionTitle(
          harness,
          display === "New session" ? HANDOFF_TITLE : display,
        ),
        titleState: {
          source: "manual" as const,
          epoch: 0,
          purpose: "initial" as const,
          fallbackAttempted: false,
        },
        handoffCard: buildHandoffComposerCard({
          from,
          to: harness,
          brief: buildDeterministicHandoff(sliced),
          userRequest,
          files,
        }),
      };
      openSessionBeside(sourceId, session, source.cwd, true);
    },
    [openSessionBeside],
  );

  const autoContinueKey = sessions
    .filter(
      (session) => canAutoContinue(session) && isLiveHarness(session.harness),
    )
    .map((session) => session.id)
    .join("\n");

  useEffect(() => {
    if (!autoContinueKey) return;
    const ids = autoContinueKey.split("\n");
    // Delay past React StrictMode's dev remount so Continue is not claimed
    // against a discarded tree (sessionStorage also survives Vite reloads).
    const timer = window.setTimeout(() => {
      for (const id of ids) {
        const session = sessionsRef.current.find((entry) => entry.id === id);
        if (
          !session ||
          !canAutoContinue(session) ||
          !isLiveHarness(session.harness)
        ) {
          continue;
        }
        onSubmit(id, CONTINUE_PROMPT);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoContinueKey, onSubmit]);

  const onCompactContext = useCallback(
    (sessionId: string) => {
      const current = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (current && sessionUsesHost(current))
        return remoteSessionActions(sessionId)?.compact() ?? false;
      if (!current || current.busy || current.worktreeRemoved) return false;
      if (!canCompactHarnessContext(current.harness)) {
        const unsupported = sessionsRef.current.map((session) =>
          session.id === sessionId
            ? applyHarnessEvent(session, {
                type: "status",
                text: `${HARNESS_TITLE[current.harness]} does not support manual context compaction.`,
              })
            : session,
        );
        sessionsRef.current = unsupported;
        syncDockBadge(unsupported);
        setSessions(unsupported);
        return true;
      }

      const gen = (turnGen.current.get(sessionId) ?? 0) + 1;
      turnGen.current.set(sessionId, gen);
      const workCwd = sessionWorkCwd(current);
      const started = sessionsRef.current.map((session) =>
        session.id === sessionId
          ? applyHarnessEvent(
              { ...session, busy: true },
              { type: "status", text: "Compacting context…" },
            )
          : session,
      );
      sessionsRef.current = started;
      syncDockBadge(started);
      setSessions(started);

      void (async () => {
        try {
          await compactHarnessContext({
            harness: current.harness,
            nativeSession: current.nativeSession,
            sessionId,
            cwd: workCwd,
            model: current.model,
            modelSettings: current.modelSettings,
            providerAccountId: supportsProviderAccounts(current.harness)
              ? (conversationProviderAccountId(current) ??
                selectedProviderAccountId(current.harness, current.cwd))
              : undefined,
            runtimeMode: current.runtimeMode,
            onEvent: (event) => {
              if (turnGen.current.get(sessionId) !== gen) return;
              enqueueHarnessEvent(sessionId, event);
            },
          });
          if (turnGen.current.get(sessionId) !== gen) return;
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: "Compacted context",
          });
        } catch (error: unknown) {
          if (turnGen.current.get(sessionId) !== gen) return;
          enqueueHarnessEvent(sessionId, {
            type: "session.error",
            message:
              error instanceof Error
                ? error.message
                : `${current.harness} could not compact this context`,
          });
        } finally {
          if (turnGen.current.get(sessionId) !== gen) return;
          flushHarnessEvents();
          const finished = sessionsRef.current.map((session) =>
            session.id === sessionId ? { ...session, busy: false } : session,
          );
          sessionsRef.current = finished;
          syncDockBadge(finished);
          setSessions(finished);
        }
      })();
      return true;
    },
    [enqueueHarnessEvent, flushHarnessEvents],
  );

  const onStop = useCallback(
    (sessionId: string, managed = false) => {
      titleCoordinator.current!.cancel(sessionId);
      const remote = sessionsRef.current.find((s) => s.id === sessionId);
      if (remote && sessionUsesHost(remote)) {
        remoteSessionActions(sessionId)?.stop();
        return;
      }
      if (!managed) {
        const stopping = orchestrator.stopForSession(sessionId);
        if (stopping) {
          void stopping.catch(console.error);
          return;
        }
      }
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      turnGen.current.set(sessionId, (turnGen.current.get(sessionId) ?? 0) + 1);
      flushHarnessEvents();
      if (session) {
        for (const id of sessionChildHarnesses(session)) {
          void cancelHarnessTurn(id, sessionId);
        }
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const stopped = stopStreaming(s);
          const completed = isPreparingHandoff(stopped)
            ? completeHandoff(stopped, buildDeterministicHandoff(stopped))
            : stopped;
          const ready = { ...completed, worktreePreparing: undefined };
          return ready.queuedMessages?.length
            ? { ...ready, queueStatus: "paused" }
            : ready;
        }),
      );
      if (session) {
        notifyReviewChanged(sessionId);
        nudgeWorkspace(sessionWorkCwd(session));
        notifyGitChanged();
        nudgeWatchedFiles();
        window.setTimeout(() => nudgeWatchedFiles(), 150);
      } else {
        notifyReviewChanged(sessionId);
      }
    },
    [flushHarnessEvents],
  );

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const inTerminal = Boolean(target?.closest(".monocode-terminal"));
      const activeTabId = activeTabIdRef.current;
      const sessionId = focusedBusyAgentSessionId(
        activeTabId,
        tabsRef.current,
        sessionsRef.current,
        projectTerminalFocusedRef.current,
      );
      if (
        !sessionId ||
        !shouldStopFocusedTurnOnEscape(event, {
          inTerminal,
          focusedSessionBusy: true,
        })
      ) {
        return;
      }

      // Other surfaces (drag/reorder included) can claim Escape later in the
      // same keydown dispatch. Defer the destructive stop until every handler
      // has had a chance to preventDefault, then verify focus did not move.
      deferUnhandledEscape(event, () => {
        const stillFocusedSessionId = focusedBusyAgentSessionId(
          activeTabIdRef.current,
          tabsRef.current,
          sessionsRef.current,
          projectTerminalFocusedRef.current,
        );
        if (
          activeTabIdRef.current !== activeTabId ||
          stillFocusedSessionId !== sessionId
        ) {
          return;
        }
        onStop(sessionId);
      });
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onStop]);

  const onApproval = useCallback(
    (sessionId: string, requestId: number, decision: ApprovalDecision) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session || session.worktreeRemoved) return;
      if (sessionUsesHost(session)) {
        remoteSessionActions(sessionId)?.approve(requestId, decision);
        return;
      }
      respondHarnessApproval(session.harness, sessionId, requestId, decision);
    },
    [],
  );

  const onQuestionReply = useCallback(
    (sessionId: string, requestId: number, reply: UserQuestionReply) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session || session.worktreeRemoved) return;
      if (sessionUsesHost(session)) {
        remoteSessionActions(sessionId)?.answer(requestId, reply);
        return;
      }
      respondHarnessQuestion(session.harness, sessionId, requestId, reply);
    },
    [],
  );

  const onQuestionInteraction = useCallback(
    (sessionId: string, requestId: number) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (session && sessionUsesHost(session)) return;
      if (session && !session.worktreeRemoved)
        keepHarnessQuestionOpen(session.harness, sessionId, requestId);
    },
    [],
  );

  const onOpenApprovalSession = useCallback(
    (sessionId: string) => {
      const parentId =
        sessionsRef.current.find((session) => session.id === sessionId)
          ?.orchestrationLeadId ?? orchestrator.forSession(sessionId)?.leadId;
      if (parentId && parentId !== sessionId) {
        setInspectedWorkerId(sessionId);
        if (!focusOpenSession(parentId)) void onSelectHistorySession(parentId);
      } else if (!focusOpenSession(sessionId)) {
        void onSelectHistorySession(sessionId);
      }
    },
    [focusOpenSession, onSelectHistorySession],
  );

  useEffect(() => {
    setSessions((prev) => attachOrchestrationWorkers(prev, orchestrationRuns));
  }, [orchestrationRuns]);

  useEffect(() => {
    const next = consolidateOrchestrationTabs(
      tabs,
      activeTabId,
      orchestrationRuns,
    );
    if (next.tabs !== tabs) setTabs(next.tabs);
    if (next.activeTabId !== activeTabId) setActiveTabId(next.activeTabId);
  }, [tabs, activeTabId, orchestrationRuns]);

  useLayoutEffect(() => {
    orchestrator.bind({
      session: (id) => sessionsRef.current.find((session) => session.id === id),
      sessions: () => sessionsRef.current,
      choices: () =>
        HARNESSES.filter(isHarnessAvailable).map((harness) => ({
          harness,
          models: modelsFor(harness).map(({ id, name }) => ({ id, name })),
        })),
      createWorker: async (run, task) => {
        const projectCwd = orchestrationProjectCwd(run);
        const leadCheckoutCwd = orchestrationCheckoutCwd(run);
        const lead = sessionsRef.current.find(
          (session) => session.id === run.leadId,
        );
        if (!lead) throw new Error("Lead session is unavailable");
        const workspace =
          task.workspacePolicy === "shared"
            ? workspaceIdentity(projectCwd, leadCheckoutCwd)
            : task.workspace
              ? await listWorktrees(leadCheckoutCwd).then((listed) => {
                  const tree = listed.worktrees.find(
                    (entry) =>
                      pathKey(entry.path) ===
                      pathKey(task.workspace!.checkoutCwd),
                  );
                  if (!tree)
                    throw new Error(
                      "This worker's retained worktree is missing. Its saved changes cannot be retried automatically.",
                    );
                  return workspaceIdentity(
                    projectCwd,
                    tree.path,
                    tree.branch ?? task.workspace!.branch,
                  );
                })
              : await createOrchestrationWorktree(
                  leadCheckoutCwd,
                  orchestrationWorktreeBranchName(task.id),
                ).then((tree) =>
                  workspaceIdentity(
                    projectCwd,
                    tree.path,
                    tree.branch ?? undefined,
                  ),
                );
        const checkoutCwd = workspace.checkoutCwd;
        const scratchDir = await invoke<string>("control_attach_worker", {
          leadId: run.leadId,
          sessionId: task.sessionId,
        });
        const existing = sessionsRef.current.find(
          (session) => session.id === task.sessionId,
        );
        if (existing) {
          if (
            existing.harness !== task.harness ||
            existing.model !== task.model ||
            !sameProjectPath(existing.cwd, projectCwd) ||
            (!existing.worktreeRemoved &&
              !sameProjectPath(sessionWorkCwd(existing), checkoutCwd))
          )
            throw new Error(
              "This worker's configuration changed. Restore its approved harness, model and project before retrying.",
            );
          // The lead's runtime mode governs its agents, including across a
          // change mid-run: auto stays auto, supervised asks the lead.
          const synced = {
            ...existing,
            cwd: projectCwd,
            worktreeCwd: sameProjectPath(projectCwd, checkoutCwd)
              ? undefined
              : checkoutCwd,
            branch: workspace.branch,
            worktreeRemoved: false,
            runtimeMode: lead.runtimeMode,
            orchestrationLeadId: run.leadId,
          };
          await upsertSession(synced);
          const next = sessionsRef.current.map((session) =>
            session.id === synced.id ? synced : session,
          );
          sessionsRef.current = next;
          setSessions(next);
          return { scratchDir, workspace };
        }
        const restored = await getSession(task.sessionId);
        if (
          restored &&
          (restored.harness !== task.harness || restored.model !== task.model)
        )
          throw new Error(
            "The saved worker no longer matches its approved model. Create a new assignment.",
          );
        const fresh = {
          ...newSession(task.harness, projectCwd, task.model, lead.runtimeMode),
          ...(sameProjectPath(projectCwd, checkoutCwd)
            ? {}
            : { worktreeCwd: checkoutCwd, branch: workspace.branch }),
          ...(task.modelSettings
            ? {
                modelSettings: mergeModelSettings(
                  resolveModel(task.harness, task.model),
                  task.modelSettings,
                ),
              }
            : {}),
        };
        const base = restored
          ? {
              ...restored,
              busy: false,
              cwd: projectCwd,
              worktreeCwd: sameProjectPath(projectCwd, checkoutCwd)
                ? undefined
                : checkoutCwd,
              branch: sameProjectPath(projectCwd, checkoutCwd)
                ? undefined
                : workspace.branch,
              worktreeRemoved: false,
              runtimeMode: lead.runtimeMode,
            }
          : {
              ...fresh,
              id: task.sessionId,
              title: task.title,
            };
        const worker = { ...base, orchestrationLeadId: run.leadId };
        if (worker.providerSessionId)
          bindHarnessSession(
            worker.harness,
            worker.id,
            worker.providerSessionId,
            sessionWorkCwd(worker),
            worker.providerAccountId,
            worker.blocks,
            worker.nativeSession,
          );
        await upsertSession(worker);
        const next = [...sessionsRef.current, worker];
        sessionsRef.current = next;
        setSessions(next);
        // Workers belong to the lead's agent panel; no workspace tab is created.
        return { scratchDir, workspace };
      },
      integrateWorker: async (run, task) => {
        const fromCwd = task.workspace?.checkoutCwd;
        if (!fromCwd)
          throw new Error("This worker's isolated checkout is unavailable");
        const session = sessionsRef.current.find(
          (entry) => entry.id === task.sessionId,
        );
        if (session)
          await Promise.all(
            sessionChildHarnesses(session).map((harness) =>
              stopHarnessSession(harness, task.sessionId),
            ),
          );
        await invoke("harness_kill", { sessionId: task.sessionId });
        await invoke("control_turn_finished", { sessionId: task.sessionId });
        await flushSessionCheckpoint(task.sessionId);
        const listed = await listWorktrees(orchestrationCheckoutCwd(run));
        const workerTree = listed.worktrees.find((tree) =>
          sameProjectPath(tree.path, fromCwd),
        );
        const leadTree = listed.worktrees.find((tree) =>
          sameProjectPath(tree.path, orchestrationCheckoutCwd(run)),
        );
        if (!workerTree || !leadTree)
          throw new Error(
            "The worker or lead checkout is no longer registered. The worker worktree was kept.",
          );
        if (workerTree.head !== leadTree.head)
          throw new Error(
            "The worker or lead branch moved while this task was running. The worker worktree was kept for manual review.",
          );
        return applySessionCheckpoint(
          task.sessionId,
          fromCwd,
          orchestrationCheckoutCwd(run),
        );
      },
      cleanupWorker: async (run, task, onlyIfUnchanged) => {
        const workspace = task.workspace;
        if (!workspace || workspace.kind !== "worktree") return true;
        const path = workspace.checkoutCwd;
        await flushSessionCheckpoint(task.sessionId);
        const listed = await listWorktrees(orchestrationCheckoutCwd(run));
        const exists = listed.worktrees.some(
          (tree) => pathKey(tree.path) === pathKey(path),
        );
        if (!exists && onlyIfUnchanged) return false;
        const workerTree = listed.worktrees.find(
          (tree) => pathKey(tree.path) === pathKey(path),
        );
        const leadTree = listed.worktrees.find((tree) =>
          sameProjectPath(tree.path, orchestrationCheckoutCwd(run)),
        );
        if (
          exists &&
          (!workerTree || !leadTree || workerTree.head !== leadTree.head)
        ) {
          if (onlyIfUnchanged) return false;
          throw new Error(
            "The worker or lead branch moved before cleanup. The worker worktree was kept for manual review.",
          );
        }
        if (onlyIfUnchanged) {
          const safe = await sessionCheckpointCleanupSafe(task.sessionId, path);
          if (!safe) return false;
        } else if (exists) {
          // Re-verify immediately before destructive cleanup. The operation is
          // idempotent, so this also finishes a partially applied integration.
          await applySessionCheckpoint(
            task.sessionId,
            path,
            orchestrationCheckoutCwd(run),
          );
        }

        if (exists) {
          onStop(task.sessionId, true);
          const session = sessionsRef.current.find(
            (entry) => entry.id === task.sessionId,
          );
          if (session) {
            await Promise.all(
              sessionChildHarnesses(session).map((harness) =>
                stopHarnessSession(harness, task.sessionId),
              ),
            );
          }
          await invoke("harness_kill", { sessionId: task.sessionId });
          await invoke("control_turn_finished", {
            sessionId: task.sessionId,
          });
          await flushSessionWrites();
          checkOpenWorktreeFiles(path);
          const removed = await removeOrchestrationWorktree(
            orchestrationCheckoutCwd(run),
            path,
          );
          const affected = new Set([task.sessionId, ...removed.sessionIds]);
          sessionsRef.current = sessionsRef.current.map((session) =>
            affected.has(session.id)
              ? detachSessionWorktree(session, removed.projectCwd, path)
              : session,
          );
          setSessions(sessionsRef.current);
          const detachSummary = (entry: SessionSummary) =>
            affected.has(entry.id)
              ? detachSessionWorktree(entry, removed.projectCwd, path)
              : entry;
          setHistory((current) => current.map(detachSummary));
          setStoredLinkedSessions((current) => current.map(detachSummary));
          if (session)
            await Promise.allSettled(
              sessionChildHarnesses(session).map((harness) =>
                forgetHarnessSession(harness, task.sessionId),
              ),
            );
        } else {
          const detached = sessionsRef.current.find(
            (entry) => entry.id === task.sessionId,
          );
          if (detached && !detached.worktreeRemoved) {
            const next = detachSessionWorktree(
              detached,
              orchestrationProjectCwd(run),
              path,
            );
            sessionsRef.current = sessionsRef.current.map((entry) =>
              entry.id === task.sessionId ? next : entry,
            );
            setSessions(sessionsRef.current);
            if (shouldPersistSession(next)) await upsertSession(next);
          }
        }
        if (workspace.branch)
          await removeOrchestrationBranch(
            orchestrationCheckoutCwd(run),
            workspace.branch,
          );
        await forgetSessionCheckpoint(task.sessionId);
        notifyReviewChanged(task.sessionId);
        return true;
      },
      submit: (id, text, done) => {
        void submitWithSettlement({
          submit: (onSettled) => {
            let acceptance: SubmissionAcceptance = false;
            // Commit an immediate turn before another scheduler update. A
            // deferred submission flushes its own turn after synchronization.
            flushSync(() => {
              acceptance = submitSession(id, text, [], {
                managed: true,
                onSettled,
              });
            });
            return acceptance;
          },
          onSettled: done,
          rejectionMessage:
            "The selected agent session could not accept this turn.",
        }).catch(console.error);
      },
      steer: async (id, text) => {
        flushHarnessEvents();
        const session = sessionsRef.current.find((entry) => entry.id === id);
        if (!session) throw new Error("This agent is no longer available");
        if (!session.busy)
          throw new Error(
            "This agent is not running a turn; send it a fresh one with message.",
          );
        if (
          !isLiveHarness(session.harness) ||
          !canSteerHarness(session.harness)
        )
          throw new Error(
            `${session.harness} cannot take guidance mid-turn. Wait for the turn to finish, then use message.`,
          );
        // Record it on the worker before dispatch, so its own transcript shows
        // why it changed course even if the harness call then fails.
        const next = sessionsRef.current.map((entry) =>
          entry.id === id ? appendSteerUser(entry, text) : entry,
        );
        sessionsRef.current = next;
        setSessions(next);
        await steerHarnessTurn({
          harness: session.harness,
          sessionId: id,
          cwd: sessionWorkCwd(session),
          model: session.model,
          modelSettings: session.modelSettings,
          text,
        });
      },
      respondApproval: (id, requestId, decision) => {
        const session = sessionsRef.current.find((entry) => entry.id === id);
        if (session)
          respondHarnessApproval(session.harness, id, requestId, decision);
      },
      answerQuestion: (id, requestId, reply) => {
        const session = sessionsRef.current.find((entry) => entry.id === id);
        if (session)
          respondHarnessQuestion(session.harness, id, requestId, reply);
      },
      stop: async (id) => {
        const session = sessionsRef.current.find((entry) => entry.id === id);
        onStop(id, true);
        try {
          if (session)
            await Promise.all(
              sessionChildHarnesses(session).map((harness) =>
                stopHarnessSession(harness, id),
              ),
            );
        } finally {
          // Also reap processes left behind by a renderer reload, before the
          // corresponding session has been restored in this window.
          await invoke("harness_kill", { sessionId: id });
          await invoke("control_turn_finished", { sessionId: id });
        }
      },
    });
  }, [checkOpenWorktreeFiles, submitSession, onStop, flushHarnessEvents]);

  useEffect(() => {
    orchestrator.sync();
  }, [sessions]);

  useEffect(() => {
    const listening = listen<{
      id: string;
      namespace: string;
      sessionId: string;
      requestId: string;
      action: string;
      input: Record<string, unknown>;
    }>("monocode-control-request", ({ payload }) => {
      const handle = async () => {
        if (payload.namespace === "control") {
          return orchestrator.handle(
            payload.sessionId,
            payload.requestId,
            payload.action,
            payload.input,
          );
        }
        if (payload.namespace !== "app")
          throw new Error("Unknown CLI namespace");
        const source = sessionsRef.current.find(
          (session) => session.id === payload.sessionId,
        );
        if (
          !source ||
          source.inboxAsk ||
          source.orchestrationLeadId ||
          orchestrator.run(source.id)
        )
          throw new Error("This session cannot use the MonoCode app CLI");
        const key = `${source.id}:${payload.requestId}`;
        const signature = JSON.stringify([payload.action, payload.input]);
        const previous = appReceipts.current.get(key);
        if (previous) {
          if (previous.signature !== signature)
            throw new Error("Request ID was already used with different input");
          return previous.promise;
        }
        const promise = handleAgentApp(
          source,
          payload.requestId,
          payload.action,
          payload.input,
          {
            start: async (launch, id, placement) => {
              const open = sessionsRef.current.find(
                (session) => session.id === id,
              );
              const stored = open ? null : await getSession(id);
              const existing = open ?? stored;
              const previous = existing?.blocks.find(
                (block) => block.appRequestId === id,
              );
              if (previous) {
                if (
                  previous.text !== launch.prompt ||
                  (!launch.draft && !!previous.draft)
                )
                  throw new Error(
                    "Request ID was already used for another session launch",
                  );
                return;
              }
              if (
                existing?.blocks.some(
                  (block) => block.role === "user" && !block.draft,
                )
              )
                return;
              if (existing && sessionDraftBlock(existing))
                throw new Error("Session ID already has a different draft");
              await launchQuickSessionRef.current(launch, id, placement);
            },
            sessions: async (cwd): Promise<AppSessionListing[]> => {
              const stored = await listSessionsByProject(cwd);
              const byId = new Map<string, AppSessionListing>();
              for (const session of stored) {
                if (session.orchestrationLeadId) continue;
                byId.set(session.id, {
                  id: session.id,
                  title: session.title,
                  harness: session.harness,
                  model: session.model,
                  busy: false,
                  hasDraft: !!session.draft,
                });
              }
              for (const session of sessionsRef.current) {
                if (
                  session.orchestrationLeadId ||
                  !sameProjectPath(session.cwd, cwd)
                )
                  continue;
                byId.set(session.id, {
                  id: session.id,
                  title: session.title,
                  harness: session.harness,
                  model: session.model,
                  busy: !!session.busy,
                  hasDraft: !!sessionDraftBlock(session),
                });
              }
              return [...byId.values()];
            },
            session: async (id) => {
              const target =
                sessionsRef.current.find((session) => session.id === id) ??
                (await getSession(id));
              return target &&
                !target.orchestrationLeadId &&
                sameProjectPath(target.cwd, source.cwd)
                ? target
                : null;
            },
            send: async (id, prompt, requestId) => {
              const target = await ensureOpenSessionRef.current(id);
              if (
                !target ||
                target.orchestrationLeadId ||
                !sameProjectPath(target.cwd, source.cwd) ||
                orchestrator.run(id)
              )
                throw new Error("Session is unavailable in this project");
              const previous = target.blocks.find(
                (block) => block.appRequestId === requestId,
              );
              if (previous) {
                if (previous.text !== prompt)
                  throw new Error(
                    "Request ID was already used with another prompt",
                  );
                if (previous.draft)
                  throw new Error("Request ID belongs to an unsent draft");
                return { alreadySubmitted: true };
              }
              if (target.busy)
                throw new Error("Session is busy; try again when it finishes");
              if (sessionDraftBlock(target))
                throw new Error(
                  "Session already has a draft; send or remove it first",
                );
              const accepted = await submitSessionRef.current(id, prompt, [], {
                appRequestId: requestId,
              });
              if (!accepted)
                throw new Error("Session could not accept the follow-up");
              return { alreadySubmitted: false };
            },
            draft: async (id, prompt, requestId) => {
              const target = await ensureOpenSessionRef.current(id);
              if (
                !target ||
                target.orchestrationLeadId ||
                !sameProjectPath(target.cwd, source.cwd) ||
                orchestrator.run(id)
              )
                throw new Error("Session is unavailable in this project");
              const previous = target.blocks.find(
                (block) => block.appRequestId === requestId,
              );
              if (previous) {
                if (previous.text !== prompt)
                  throw new Error(
                    "Request ID was already used with another prompt",
                  );
                return { alreadySaved: true, draft: !!previous.draft };
              }
              if (target.busy)
                throw new Error("Session is busy; try again when it finishes");
              if (sessionDraftBlock(target))
                throw new Error(
                  "Session already has a draft; send or remove it first",
                );
              const saved = flushSync(() =>
                saveDraftRef.current(id, prompt, [], requestId),
              );
              if (!saved) throw new Error("Session could not accept a draft");
              return { alreadySaved: false, draft: true };
            },
            worktrees: (cwd) => listWorktrees(cwd),
            createWorktree: (cwd, branch, base, existing) =>
              createWorktree(cwd, branch, base, existing),
            notes: () => invoke("notes_list"),
            note: (id) => invoke("notes_get", { id }),
            saveNote: async (note) => {
              const saved = await upsertNote(note);
              window.dispatchEvent(new Event(NOTES_CHANGED_EVENT));
              return saved;
            },
          },
        );
        appReceipts.current.set(key, { signature, promise });
        void promise.catch(() => {
          if (appReceipts.current.get(key)?.promise === promise)
            appReceipts.current.delete(key);
        });
        if (appReceipts.current.size > 256) {
          const first = appReceipts.current.keys().next().value;
          if (first) appReceipts.current.delete(first);
        }
        return promise;
      };
      void handle()
        .then(
          (result) =>
            invoke("control_reply", {
              id: payload.id,
              response: { ok: true, result },
            }),
          (error: unknown) =>
            invoke("control_reply", {
              id: payload.id,
              response: {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              },
            }),
        )
        .catch(console.error);
    });
    return () => {
      void listening.then((unlisten) => unlisten());
    };
  }, []);

  const queueWorkerPanes = useCallback(
    (workers: OrchestrationWorkerDetail[]) => {
      // Finished workers are not open; load stored transcripts before the
      // tabs appear so the pane does not flash the empty state.
      void (async () => {
        const loaded = await Promise.all(
          workers
            .filter((worker) => worker.host)
            .map(async (worker) => {
              const source = worker.host!;
              const snapshot = await loadRemoteSession(
                source.machineId,
                source.sessionId,
              );
              if (
                snapshot.projectId !== source.project.projectId ||
                snapshot.session.orchestrationLeadId !== source.leadId
              )
                throw new Error(
                  "This worker does not belong to the selected orchestration run.",
                );
              return hostOrchestrationClient.desktopSession(source, snapshot);
            }),
        );
        if (loaded.length) {
          const ids = new Set(loaded.map((session) => session.id));
          const next = [
            ...sessionsRef.current.filter((session) => !ids.has(session.id)),
            ...loaded,
          ];
          sessionsRef.current = next;
          setSessions(next);
        }
        return prepareOrchestrationWorkerDetails(workers, {
          openLead: async (leadId) => {
            if (!focusOpenSession(leadId)) await onSelectHistorySession(leadId);
          },
          openWorker: ensureOpenSession,
          hasSession: (id) =>
            sessionsRef.current.some((session) => session.id === id),
        });
      })()
        .then((request) => {
          if (request?.workers.length) setWorkerDetailRequest(request);
        })
        .catch(console.error);
    },
    [ensureOpenSession, focusOpenSession, onSelectHistorySession],
  );
  const onOpenWorkerDetails = useCallback(
    (worker: OrchestrationWorkerDetail) => {
      setInspectedWorkerId(worker.sessionId);
      queueWorkerPanes([worker]);
    },
    [queueWorkerPanes],
  );
  useEffect(() => {
    if (!workerDetailRequest) return;
    const { leadId, workers } = workerDetailRequest;
    const tab = tabs.find((entry) => leafIds(entry.layout).includes(leadId));
    if (!tab) {
      // Still opening: this runs again on the commit that lands the lead. If
      // the lead never arrived at all, drop the request rather than let it
      // fire against some later tab change.
      if (!sessionsRef.current.some((entry) => entry.id === leadId)) {
        setWorkerDetailRequest(null);
      }
      return;
    }
    setWorkerDetailRequest(null);
    // Every agent of a run shares one pane, the way files do: `openEditorTab`
    // focuses an open tab, adds to the pane already beside the lead, or splits
    // one off when there is none.
    const cwd =
      sessionsRef.current.find((entry) => entry.id === leadId)?.cwd ??
      projectCwdRef.current;
    const files = workers.map((worker) =>
      newAgentTab(worker.title, cwd, {
        sessionId: worker.sessionId,
        leadId,
        harness: worker.harness,
      }),
    );
    setTabs((prev) =>
      prev.map((entry) => {
        if (entry.id !== tab.id) return entry;
        const opened = files.reduce(
          (next, file) => openEditorTab(next, file),
          entry,
        );
        // Leave the first worker focused so View agents lands on the start
        // of the run rather than the last tab added.
        return files[0] ? openEditorTab(opened, files[0]) : opened;
      }),
    );
    setActiveTabId(tab.id);
    setComposerFocused(false);
  }, [tabs, workerDetailRequest]);
  // Workflow tabs open beside their source detail tab when available,
  // otherwise beside the launching conversation like orchestration workers.
  const [workflowTabRequest, setWorkflowTabRequest] = useState<{
    parentSessionId: string;
    file: FilePaneTab;
    sourceFileId?: string;
  } | null>(null);
  useEffect(() => {
    if (!workflowTabRequest) return;
    const { parentSessionId, file, sourceFileId } = workflowTabRequest;
    const tab =
      tabs.find((entry) =>
        entry.editorPanes.some((pane) =>
          pane.files.some((file) => file.id === sourceFileId),
        ),
      ) ??
      tabs.find((entry) => leafIds(entry.layout).includes(parentSessionId));
    if (!tab) {
      if (!sessionsRef.current.some((entry) => entry.id === parentSessionId))
        setWorkflowTabRequest(null);
      return;
    }
    setWorkflowTabRequest(null);
    setTabs((prev) =>
      prev.map((entry) =>
        entry.id === tab.id
          ? openEditorTab(entry, file, { afterFileId: sourceFileId })
          : entry,
      ),
    );
    setActiveTabId(tab.id);
    setComposerFocused(false);
  }, [tabs, workflowTabRequest]);
  const [workflowComposerRequest, setWorkflowComposerRequest] = useState<{
    sessionId: string;
    prompt: string;
  } | null>(null);
  useEffect(() => {
    if (!workflowComposerRequest) return;
    if (active?.id !== workflowComposerRequest.sessionId || activeAppView)
      return;
    // Wait until the destination pane is mounted and focused so its composer
    // receives the text, including when onNewInProject reuses an empty chat.
    setWorkflowComposerRequest(null);
    requestAddToChat(workflowComposerRequest.prompt, "plain");
  }, [active?.id, activeAppView, workflowComposerRequest]);
  // Complete workflow instructions are sent once their conversation is ready.
  const [workflowSendRequest, setWorkflowSendRequest] = useState<{
    sessionId: string;
    prompt: string;
  } | null>(null);
  useEffect(() => {
    if (!workflowSendRequest) return;
    if (!sessions.some((entry) => entry.id === workflowSendRequest.sessionId))
      return;
    setWorkflowSendRequest(null);
    onSubmit(workflowSendRequest.sessionId, workflowSendRequest.prompt);
  }, [onSubmit, sessions, workflowSendRequest]);
  const workflowProjects = useMemo(
    () =>
      recents.map((project) => ({
        workspacePath: project.path,
        label: project.path.split(/[\\/]/).filter(Boolean).pop() ?? project.path,
      })),
    [recents],
  );
  const workflowActivity = useMemo(
    () => workflowActivityIndex(sessions),
    [sessions],
  );
  const workflowApp = useMemo<WorkflowAppActions>(() => {
    const openBesideParent = (
      parentSessionId: string,
      file: FilePaneTab,
      sourceFileId?: string,
    ) => {
      void (async () => {
        const hasSource = tabsRef.current.some((entry) =>
          entry.editorPanes.some((pane) =>
            pane.files.some((file) => file.id === sourceFileId),
          ),
        );
        if (!hasSource && !focusOpenSession(parentSessionId))
          await onSelectHistorySession(parentSessionId);
        setWorkflowTabRequest({ parentSessionId, file, sourceFileId });
      })().catch(console.error);
    };
    return {
      openRun: (request) =>
        openBesideParent(
          request.parentSessionId,
          newWorkflowRunTab(request.workflowName ?? "Workflow", request.cwd, {
            runId: request.runId,
            parentSessionId: request.parentSessionId,
            ...(request.toolCallId ? { toolCallId: request.toolCallId } : {}),
            ...(request.workflowName
              ? { workflowName: request.workflowName }
              : {}),
          }),
        ),
      openAgent: (request) =>
        openBesideParent(
          request.parentSessionId,
          newWorkflowAgentTab(request.title, request.cwd, {
            sessionId: request.sessionId,
            parentSessionId: request.parentSessionId,
            runId: request.runId,
          }),
          request.sourceFileId,
        ),
      openSession: (cwd, sessionId) => onSelectRemoteSession(cwd, sessionId),
      createViaChat: (cwd, prompt, options) => {
        const sessionId = onNewInProject(cwd, { reuseDraft: true });
        if (options?.send) setWorkflowSendRequest({ sessionId, prompt });
        else setWorkflowComposerRequest({ sessionId, prompt });
      },
    };
  }, [
    onNewInProject,
    focusOpenSession,
    onSelectHistorySession,
    onSelectRemoteSession,
  ]);
  const orchestrationWorkers = useMemo(
    () => ({
      selectedId: inspectedWorkerId,
      inspect: setInspectedWorkerId,
      openDetails: onOpenWorkerDetails,
    }),
    [inspectedWorkerId, onOpenWorkerDetails],
  );
  const orchestrationActions = useMemo(
    () => ({
      canControl: false,
      open: onOpenApprovalSession,
      openAgents: queueWorkerPanes,
      update: () => {},
      confirm: async () => {
        throw new Error(
          translate("Connect to the Host before controlling this run."),
        );
      },
      retry: () => {},
    }),
    [onOpenApprovalSession, queueWorkerPanes],
  );

  const onSelectLiveAgent = useCallback(
    (sessionId: string) => {
      onOpenApprovalSession(sessionId);
    },
    [onOpenApprovalSession],
  );

  tabProjectsRef.current = new Map(
    deckProjectTabs.map((tab) => [tab.id, tabProjectName(tab, sessions)]),
  );
  // `history` now spans every visited project; consumers that expect the
  // current project only get this slice.
  const projectHistory = useMemo(
    () => history.filter((entry) => sameProjectPath(entry.cwd, sidebarCwd)),
    [history, sidebarCwd],
  );

  // Quick Open's `#` mode: every project's unarchived sessions.
  const paletteSessions = useMemo(
    () =>
      paletteOpen
        ? conversationRowsFrom(
            history.filter((entry) => !entry.archived),
            sessions.filter((session) => !session.inboxAsk),
          )
        : [],
    [paletteOpen, history, sessions],
  );

  const liveSidebarHistory = useMemo(
    () =>
      historyWithLiveSessions(
        history,
        sessions,
        sidebarCwd,
        {
          ...(projectBranches?.current
            ? { branch: projectBranches.current }
            : {}),
          ...(sidebarCwd && sidebarCwd !== "~"
            ? { repo: projectName(sidebarCwd) }
            : {}),
        },
        orchestrationRuns,
      ),
    [history, projectBranches, sessions, sidebarCwd, orchestrationRuns],
  );
  const liveTreeHistory = useMemo(() => {
    return allProjectHistoryWithLiveSessions(
      history,
      sessions,
      (cwd) =>
        sameProjectPath(cwd, sidebarCwd)
          ? { branch: projectBranches?.current ?? undefined }
          : undefined,
      orchestrationRuns,
    );
  }, [history, sessions, sidebarCwd, projectBranches, orchestrationRuns]);
  const sidebarHistory = useStableSummaries(liveSidebarHistory);
  const treeHistory = useStableSummaries(liveTreeHistory);
  const {
    unseen: inboxUnseen,
    linkedSessionUpdateIds,
    linkedSessionUpdates,
  } = useInboxActivity(recents, sidebarCwd, sidebarHistory, {
    onAppeared: onInboxAppeared,
  });
  linkedSessionUpdatesRef.current = linkedSessionUpdates;
  const liveInboxRelatedSessions = useMemo(() => {
    const byId = new Map<string, SessionSummary>();
    for (const session of storedLinkedSessions) byId.set(session.id, session);
    for (const session of history) {
      if (session.linkedWorkItem) byId.set(session.id, session);
    }
    for (const session of sessions) {
      if (session.inboxAsk || !session.linkedWorkItem) continue;
      const current = byId.get(session.id);
      const summary = summaryFromSession(session);
      byId.set(
        session.id,
        current
          ? {
              ...current,
              harness: summary.harness,
              model: summary.model,
              runtimeMode: summary.runtimeMode,
              title: summary.title,
              cwd: summary.cwd,
              linkedWorkItem: summary.linkedWorkItem,
            }
          : summary,
      );
    }
    return [...byId.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
    );
  }, [history, sessions, storedLinkedSessions]);
  const inboxRelatedSessions = useStableSummaries(liveInboxRelatedSessions);
  const liveRepairSessions = useMemo(
    () => ciRepairSessions(history, sessions),
    [history, sessions],
  );
  const repairSessions = useStableSummaries(liveRepairSessions);
  const sidebarOpenSessionIds = useMemo(() => openSessionIds(tabs), [tabs]);
  const liveOpenProjectSessions = useMemo(
    () =>
      sidebarLiveSessions(sessions).map((session) =>
        summaryFromSession(session, {
          ...(sameProjectPath(session.cwd, sidebarCwd) &&
          projectBranches?.current
            ? { branch: projectBranches.current }
            : {}),
          ...(session.cwd && session.cwd !== "~"
            ? { repo: projectName(session.cwd) }
            : {}),
        }),
      ),
    [projectBranches, sessions, sidebarCwd],
  );
  const openProjectSessions = useStableSummaries(liveOpenProjectSessions);

  const onToggleSidebar = useCallback(() => {
    setSessionSidebarOpen((open) => {
      const next = !open;
      saveSessionSidebarOpen(next);
      return next;
    });
  }, []);

  const onShowProjects = useCallback(() => {
    setSessionSidebarOpen(true);
    saveSessionSidebarOpen(true);
    setSidebarTab("sessions");
    setSearchFocusToken((value) => value + 1);
  }, [setSidebarTab]);

  /** Quick Open: files by default, `>` commands, `#` sessions, `@` projects. */
  const openPalette = useCallback((query: string) => {
    setPaletteQuery(query);
    setPaletteToken((token) => token + 1);
    setPaletteOpen(true);
  }, []);
  const onGoToFile = useCallback(() => openPalette(""), [openPalette]);
  const onOpenCommandPalette = useCallback(
    () => openPalette(">"),
    [openPalette],
  );
  const onReload = useCallback(() => {
    void (async () => {
      if (!(await confirmReload(dirtyFilesRef.current.size > 0))) return;
      window.location.reload();
    })();
  }, []);

  const onFindInProject = useCallback(() => {
    setSessionSidebarOpen(true);
    saveSessionSidebarOpen(true);
    setSidebarTab("files");
    setFilesSearchOpen(true);
    setSearchFocusToken((token) => token + 1);
  }, []);

  const openAppView = useCallback(
    (kind: AppViewKind) => {
      workspaceNavigation.cancel();
      setPaletteOpen(false);
      if (isAppPageKind(kind)) {
        setAppDialog(null);
        setAppPage(kind);
        setProjectTerminalFocused(false);
        setComposerFocused(false);
        return;
      }
      if (DIALOG_APP_VIEWS.has(kind)) {
        setAppDialog(kind);
        return;
      }
      const owner = ensureContentTab(projectCwdRef.current);
      if (!owner) return;
      const initialMode =
        owner.surfaceMode ??
        (loadFileTabMode() === "workspace" ? "unified" : "split");
      let targetPaneId: string | undefined;
      flushSync(() =>
        setTabs((current) =>
          current.map((tab) => {
            if (tab.id !== owner.id) return tab;
            const next = openSessionAppView(
              { ...tab, surfaceMode: tab.surfaceMode ?? initialMode },
              kind,
            );
            targetPaneId = next.focusedId;
            return next;
          }),
        ),
      );
      activateTab(owner.id, targetPaneId);
      setProjectTerminalFocused(false);
      setComposerFocused(false);
    },
    [activateTab, ensureContentTab, workspaceNavigation.cancel],
  );

  const leaveAppView = useCallback(() => {
    const tab = tabsRef.current.find(
      (entry) => entry.id === activeTabIdRef.current,
    );
    if (!tab) return;
    for (const id of leafIds(tab.layout)) {
      if (sessionsRef.current.some((session) => session.id === id)) {
        activateTab(tab.id, id);
        return;
      }
      const pane = findSurfacePane(tab, id)?.pane;
      const file = pane?.files.find((entry) => !entry.appView);
      if (pane && file) {
        activateTab(tab.id, pane.id);
        onSelectFileSurface(pane.id, file.id);
        return;
      }
    }
    ensureContentTab(projectCwdRef.current);
  }, [activateTab, ensureContentTab, onSelectFileSurface]);

  const onOpenSearch = useCallback(() => {
    openAppView("search");
    setSearchViewFocusToken((token) => token + 1);
  }, [openAppView]);

  const [searchQueryRequest, setSearchQueryRequest] = useState<
    { query: string; token: number } | undefined
  >();
  const onSearchEverywhere = useCallback(
    (query: string) => {
      setSearchQueryRequest((previous) => ({
        query,
        token: (previous?.token ?? 0) + 1,
      }));
      onOpenSearch();
    },
    [onOpenSearch],
  );

  const onLeaveSearch = useCallback(() => {
    if (appDialogRef.current) closeAppDialog();
    else leaveAppView();
  }, [closeAppDialog, leaveAppView]);

  const onOpenInbox = useCallback(() => {
    openAppView("inbox");
  }, [openAppView]);

  const onOpenLinkedWorkItem = useCallback(
    (item: LinkedWorkItem, sessionId: string) => {
      const request = linkedWorkItemPanelRequest.current + 1;
      linkedWorkItemPanelRequest.current = request;
      setPaletteOpen(false);
      const cwd =
        sessionsRef.current.find((session) => session.id === sessionId)?.cwd ??
        history.find((session) => session.id === sessionId)?.cwd ??
        sidebarCwd;
      void onSelectHistorySession(sessionId).then(() => {
        if (linkedWorkItemPanelRequest.current !== request) return;
        if (!sessionsRef.current.some((session) => session.id === sessionId)) {
          return;
        }
        setLinkedWorkItemPanels((current) => {
          const next = new Map(current);
          // Reinsert the panel so it wins if this workspace tab contains
          // multiple sessions with remembered panels.
          next.delete(sessionId);
          next.set(sessionId, { item, sessionId, cwd });
          return next;
        });
      });
    },
    [history, onSelectHistorySession, sidebarCwd],
  );

  const onLeaveInbox = closeAppPage;

  const onOpenInboxSession = useCallback(
    (sessionId: string) => {
      const cwd =
        sessionsRef.current.find((session) => session.id === sessionId)?.cwd ??
        history.find((session) => session.id === sessionId)?.cwd;
      setSidebarTab("sessions", cwd);
      void onSelectHistorySession(sessionId);
    },
    [history, onSelectHistorySession],
  );

  const onRepairChecks = useCallback(
    async (item: InboxItem, request: CiRepairRequest, sessionId?: string) => {
      const cwd = item.projectPath;
      if (!cwd) throw new Error("Choose a local project for this PR first.");
      let session = sessionId ? await ensureOpenSession(sessionId) : undefined;
      if (
        sessionId &&
        (!session ||
          session.inboxAsk ||
          session.orchestrationLeadId ||
          !sameProjectPath(session.cwd, cwd))
      ) {
        throw new Error("Choose a chat from this project.");
      }
      if (
        session &&
        (session.busy || session.pendingSwitch || isPreparingHandoff(session))
      ) {
        throw new Error(
          "This chat is busy. Choose another chat or start a new one.",
        );
      }
      if (!session) {
        session = {
          ...newDefaultSession(cwd, newSessionRuntimeMode),
          title: `Fix CI #${item.number}: ${item.title}`,
          linkedWorkItem: linkedWorkItemFromInboxItem(item) ?? undefined,
        };
        const next = [...sessionsRef.current, session];
        sessionsRef.current = next;
        setSessions(next);
      }
      const repairSessionId = session.id;
      trackCiRepair(cwd, request, repairSessionId, (settle) =>
        onSubmit(repairSessionId, request.text, [], {
          ciRepair: request,
          noteCard: undefined,
          handoffCard: undefined,
          onSettled: (outcome) => settle(outcome.status),
        }),
      );
      setSidebarTab("sessions", cwd);
      await onSelectHistorySession(session.id);
    },
    [
      ensureOpenSession,
      onSubmit,
      onSelectHistorySession,
      newSessionRuntimeMode,
    ],
  );

  const onOpenNotes = useCallback(() => {
    if (!loadNotesEnabled()) return;
    openAppView("notes");
  }, [openAppView]);

  const onLeaveNotes = closeAppPage;

  const onOpenAutomations = useCallback(() => {
    openAppView("automations");
  }, [openAppView]);

  const onOpenWorkflows = useCallback(() => {
    openAppView("workflows");
  }, [openAppView]);

  const onLeaveAutomations = closeAppPage;

  const onOpenAutomationSession = useCallback(
    async (sessionId: string) => {
      const session = await ensureOpenSession(sessionId);
      if (!session)
        throw new Error("This conversation is no longer available.");
      setPaletteOpen(false);
      setSidebarTab("sessions", session.cwd);
      setProjectCwd(session.cwd);
      setRecents(rememberProject(session.cwd));
      await onSelectHistorySession(sessionId);
    },
    [ensureOpenSession, onSelectHistorySession],
  );

  const openSettings = useCallback(
    (section?: SettingsSectionId, anchor?: SettingsAnchor) => {
      if (section) {
        setSettingsSection(section);
        saveSettingsSection(section);
      }
      setSettingsAnchor(anchor ?? null);
      setNotificationProjectPath(null);
      openAppView("settings");
    },
    [openAppView],
  );

  const onOpenSettings = useCallback(() => openSettings(), [openSettings]);
  useEffect(() => {
    const openConnections = () => openSettings("connections");
    window.addEventListener(OPEN_CONNECTIONS_EVENT, openConnections);
    return () =>
      window.removeEventListener(OPEN_CONNECTIONS_EVENT, openConnections);
  }, [openSettings]);
  const [remoteProjectDialogOpen, setRemoteProjectDialogOpen] = useState(false);
  useEffect(() => {
    const open = () => setRemoteProjectDialogOpen(true);
    window.addEventListener(OPEN_REMOTE_PROJECT_EVENT, open);
    return () => window.removeEventListener(OPEN_REMOTE_PROJECT_EVENT, open);
  }, []);

  useEffect(() => {
    const onOpenMcp = () => openSettings("mcp");
    window.addEventListener("monocode:open-mcp-settings", onOpenMcp);
    return () =>
      window.removeEventListener("monocode:open-mcp-settings", onOpenMcp);
  }, [openSettings]);

  const onOpenNotificationSettings = useCallback(
    (path?: string) => {
      openSettings("inbox", "project-notifications");
      setNotificationProjectPath(path ?? null);
      setNotificationSettingsRequest((request) => request + 1);
    },
    [openSettings],
  );

  const onOpenInboxIntegrations = useCallback(
    (source: ConnectableInboxSource) => openSettings("inbox", source),
    [openSettings],
  );

  const onCloseSettings = useCallback(() => {
    if (appDialogRef.current) closeAppDialog();
    else leaveAppView();
  }, [closeAppDialog, leaveAppView]);

  const onSelectSettingsSection = useCallback((section: SettingsSectionId) => {
    setSettingsSection(section);
    saveSettingsSection(section);
  }, []);

  const onOpenArchivedSession = useCallback(
    (sessionId: string) => {
      void onSelectHistorySession(sessionId);
    },
    [onSelectHistorySession],
  );

  const onRailBack = onVisitBack;
  const onRailForward = onVisitForward;
  navigateHistoryRef.current = (destination) => {
    setPaletteOpen(false);
    activateTab(destination.tabId, destination.paneId);
    if (destination.fileId)
      onSelectFileSurface(destination.paneId, destination.fileId);
    setAppPage(destination.page);
    setAppDialog(destination.dialog);
    setProjectTerminalFocused(false);
    if (destination.page || destination.dialog) setComposerFocused(false);
  };

  useEffect(() => {
    if (!dockVisible) setProjectTerminalFocused(false);
  }, [dockVisible]);

  const openFilePaths = useMemo(() => {
    const paths: string[] = [];
    const seen = new Set<string>();
    for (const tab of tabs) {
      for (const pane of tab.editorPanes) {
        for (const file of pane.files) {
          if (!isFilesystemTab(file) || seen.has(file.path)) continue;
          seen.add(file.path);
          paths.push(file.path);
        }
      }
    }
    return paths;
  }, [tabs]);

  useEffect(() => {
    void invoke("set_traffic_lights_visible", { visible: true }).catch(
      () => {},
    );
  }, []);

  const onSessionNavigationOrder = useCallback(
    (ids: readonly string[]) => {
      sessionNavigationIdsRef.current = ids;
      sessionNavigationProjectRef.current = pathKey(sidebarCwd);
    },
    [sidebarCwd],
  );

  const onNavigateSessionList = useCallback(
    (delta: number, _inCurrentTab = false) => {
      const activeWorkspace = tabsRef.current.find(
        (entry) => entry.id === activeTabIdRef.current,
      );
      if (!activeWorkspace || activeWorkspace.diffFocused) return;
      const current =
        sessionsRef.current.find(
          (session) => session.id === activeWorkspace.focusedId,
        ) ??
        sessionsRef.current.find((session) =>
          leafIds(activeWorkspace.layout).includes(session.id),
        );
      if (
        !current ||
        sessionNavigationProjectRef.current !== pathKey(current.cwd)
      )
        return;
      const remoteProject =
        isRemoteProjectPath(current.cwd) || !!sessionUsesHost(current);
      const navigationId = remoteProject
        ? remoteSessionFor(current.id)
        : current.id;
      if (!navigationId) return;

      const next = adjacentItemId(
        sessionNavigationIdsRef.current,
        navigationId,
        delta,
      );
      if (!next || next === navigationId) return;
      if (remoteProject) {
        onSelectRemoteSession(current.cwd, next);
        return;
      }
      // Stepping gives no hover to warm the transcript, so load the one a
      // further step away once this switch has its own session.
      const prefetchAhead = () => {
        const ahead = adjacentItemId(
          sessionNavigationIdsRef.current,
          next,
          delta,
        );
        if (ahead && ahead !== current.id) onPrefetchHistorySession(ahead);
      };
      void onSelectHistorySession(next).then(prefetchAhead);
    },
    [onPrefetchHistorySession, onSelectHistorySession, onSelectRemoteSession],
  );

  const onNavigateProjectList = useCallback(
    (delta: number) => {
      const current = normalizeProjectPath(projectCwdRef.current);
      const ids = projectRailItems(loadRecents(), current).map(
        (project) => project.path,
      );
      const next = adjacentItemId(ids, current, delta);
      if (!next || sameProjectPath(next, current)) return;
      onSelectProject(next);
    },
    [onSelectProject],
  );

  const toggleAutosave = useCallback(() => {
    const next = saveAutosave(!loadAutosave());
    if (IS_MAC) void invoke("autosave_set_enabled", { enabled: next });
  }, []);

  const zoom = useCallback((direction: "in" | "out" | "reset") => {
    const next = saveUiScale(
      direction === "reset"
        ? UI_SCALE_DEFAULT
        : direction === "in"
          ? zoomInUiScale(loadUiScale())
          : zoomOutUiScale(loadUiScale()),
    );
    void applyUiScale(next);
  }, []);

  const commandHandlers: CommandHandlers = {
    "Tab: New": onNew,
    "Terminal: New": onNewTerminal,
    "App: New Window": () => void invoke("open_new_window").catch(() => {}),
    "App: Open Project": () => void pickProject(),
    "File: Autosave": toggleAutosave,
    "Pane: Close": appPage ? closeAppPage : () => onClosePane(),
    "Tab: Close": appPage
      ? closeAppPage
      : activeTabId
        ? () => onCloseTitleTab(activeTabId)
        : undefined,
    "Tab: Close Others": onCloseOtherTabs,
    "Tab: Close All": onCloseAllTabs,
    "Editor: Find": appPage ? undefined : () => void openFindInActiveEditor(),
    "Editor: Replace": appPage
      ? undefined
      : () => void openReplaceInActiveEditor(),
    "App: Find in Files": onFindInProject,
    "App: Command Palette": onOpenCommandPalette,
    "App: Search": onGoToFile,
    "View: Search Everywhere": () => onOpenSearch(),
    "App: Toggle Sidebar": onToggleSidebar,
    "View: Toggle Changes": onToggleChanges,
    "Terminal: Toggle Dock": onToggleProjectTerminal,
    "View: Toggle Menu Bar": IS_MAC
      ? undefined
      : () => void saveMenuBarVisible(!loadMenuBarVisible()),
    "Pane: Split Right": appPage ? undefined : () => onSplit("right"),
    "Pane: Split Down": appPage ? undefined : () => onSplit("down"),
    "View: Inbox": onOpenInbox,
    "View: Notes": notesEnabled ? onOpenNotes : undefined,
    "View: Automations": onOpenAutomations,
    "View: Workflows": onOpenWorkflows,
    "App: Settings": () => openSettings(),
    "App: Switch Model": appPage
      ? undefined
      : () => window.dispatchEvent(new Event("open_model_picker")),
    "View: Zoom In": () => zoom("in"),
    "View: Zoom Out": () => zoom("out"),
    "View: Reset Zoom": () => zoom("reset"),
    "View: Reload": onReload,
    "Tab: Back": onVisitBack,
    "Tab: Forward": onVisitForward,
    "App: Go to File": onGoToFile,
    "Tab: Next": onNext,
    "Tab: Previous": onPrev,
    "Tab: Cycle Next": onNext,
    "Tab: Cycle Previous": onPrev,
    "Tab: Activate 1–8": (slot) => onActivate(Number(slot)),
    "Tab: Activate Last": () => onActivate(-1),
    "Session: Previous": () => onNavigateSessionList(-1),
    "Session: Next": () => onNavigateSessionList(1),
    "Session: Previous in Current Tab": () => onNavigateSessionList(-1, true),
    "Session: Next in Current Tab": () => onNavigateSessionList(1, true),
    "Project: Previous": () => onNavigateProjectList(-1),
    "Project: Next": () => onNavigateProjectList(1),
    "Pane: Focus Left": appPage ? undefined : () => onFocusDir("left"),
    "Pane: Focus Right": appPage ? undefined : () => onFocusDir("right"),
    "Pane: Focus Up": appPage ? undefined : () => onFocusDir("up"),
    "Pane: Focus Down": appPage ? undefined : () => onFocusDir("down"),
    "Terminal: New Tab": onNewTerminalTab,
    "Help: Keyboard Shortcuts": () => openSettings("keybindings"),
    "Help: What's New": () =>
      void readAppVersion().then((version) => onOpenWhatsNew(version)),
    "Help: Check for Updates": () => void runUpdateFlow(true),
    ...Object.fromEntries(
      Object.entries(HELP_URLS).map(([id, url]) => [
        id,
        () => void openUrl(url).catch(console.error),
      ]),
    ),
  };
  const dispatch = useCommandDispatcher(commandHandlers);

  const actions = useRef({
    onArchiveFocusedSession,
    openSettings,
    onOpenApprovalSession,
  });
  actions.current = {
    onArchiveFocusedSession,
    openSettings,
    onOpenApprovalSession,
  };

  useEffect(() => {
    if (!IS_MAC) return;
    const applyAutosave = () => {
      void invoke("autosave_set_enabled", { enabled: loadAutosave() }).catch(console.error);
    };
    const applyKeybindings = () => {
      void invoke("keybindings_set_overrides", { overrides: loadKeybindingOverrides() }).catch(console.error);
    };
    applyAutosave();
    applyKeybindings();
    const stopAutosave = subscribeAutosave(applyAutosave);
    const stopKeybindings = subscribeKeybindings(applyKeybindings);
    return () => { stopAutosave(); stopKeybindings(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The Quick Composer recorder owns the next key combination, including
      // bindings that the workspace would normally handle in capture phase.
      if (document.querySelector('[data-shortcut-recorder-active="true"]'))
        return;
      // Never act on a chord while an IME is composing: tabCommand and the
      // editor guards already do, and the app shortcut resolver does too, so
      // this keeps the whole handler consistent for whatever is added next.
      if (e.isComposing) return;
      const customCommand = matchCustomKeybinding(e);
      const pressed = (command: string, defaultMatch: boolean) =>
        keybindingPressed(command, e, defaultMatch);
      // A rebound zoom chord may be Option-only, so it is resolved outside the
      // Cmd/Ctrl guard that only the browser-standard defaults need.
      const zoomAction = resolveZoomKeybinding(e);
      if (zoomAction) {
        e.preventDefault();
        e.stopPropagation();
        dispatch(
          zoomAction === "zoom-in"
            ? "View: Zoom In"
            : zoomAction === "zoom-out"
              ? "View: Zoom Out"
              : "View: Reset Zoom",
        );
        return;
      }
      const cmd = customCommand
        ? tabCommandForKeybinding(customCommand, e)
        : tabCommand(e);
      if (cmd && pressed(tabCommandKeybinding(cmd), !customCommand)) {
        if (cmd === "archive-session") {
          if (e.repeat) return;
          actions.current.onArchiveFocusedSession(e);
          return;
        }
        const target = e.target instanceof Element ? e.target : null;
        const listNavigation =
          cmd === "prev-session" ||
          cmd === "next-session" ||
          cmd === "prev-session-in-tab" ||
          cmd === "next-session-in-tab" ||
          cmd === "prev-project" ||
          cmd === "next-project";
        if (listNavigation) {
          const blockedTarget = Boolean(
            target?.closest(
              'input, textarea, select, [contenteditable="true"], .cm-editor, .monocode-terminal, [role="dialog"], [data-model-picker], [data-file-picker], [data-branch-picker], [data-skill-picker], [data-mention-picker], [data-app-search]',
            ),
          );
          const emptyComposerTarget = Boolean(
            target?.matches('textarea[data-composer-empty="true"]'),
          );
          const surfaceOpen =
            Boolean(appViewFocusedRef.current) ||
            paletteOpenRef.current ||
            Boolean(whatsNewVersionRef.current);
          if (
            !shouldHandleListNavigation({
              blockedTarget,
              emptyComposerTarget,
              surfaceOpen,
            })
          ) {
            return;
          }
        }
        if (
          target?.closest(".monocode-terminal") &&
          e.ctrlKey &&
          !e.metaKey &&
          (cmd === "back" ||
            cmd === "forward" ||
            /Mac|iPhone|iPad/.test(navigator.platform))
        ) {
          return;
        }
        if (
          (cmd === "split-right" || cmd === "split-down") &&
          target?.closest(".cm-editor")
        ) {
          return;
        }
        const inPicker =
          target &&
          target.closest(
            "[data-model-picker], [data-file-picker], [data-branch-picker], [data-skill-picker], [data-mention-picker], [data-app-search]",
          );
        if (inPicker && typeof cmd === "object" && "activate" in cmd) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        dispatch(
          tabCommandKeybinding(cmd),
          typeof cmd === "object" && "activate" in cmd
            ? cmd.activate
            : undefined,
        );
        return;
      }
      if (
        !appViewFocusedRef.current &&
        !(
          e.target instanceof Element &&
          e.target.closest("[data-session-drop], [data-agent-tab]")
        ) &&
        handleEditorFindKey(e)
      ) {
        e.stopPropagation();
        return;
      }
      const shortcut = resolveAppShortcut(e);
      if (shortcut) {
        if (
          shortcut === "App: Search" &&
          e.target instanceof Element &&
          e.target.closest(".monocode-terminal") &&
          e.ctrlKey &&
          !e.metaKey
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        dispatch(shortcut);
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dispatch]);

  useEffect(() => {
    // Commands with a native menu event are subscribed by useCommandDispatcher;
    // these carry a payload or open a specific place.
    const unlisten: Array<Promise<() => void>> = [
      listen<boolean>("toggle_autosave", ({ payload }) => {
        const saved = saveAutosave(payload);
        if (saved !== payload && IS_MAC) {
          void invoke("autosave_set_enabled", { enabled: saved });
        }
      }),
      listen("sidebar_opacity", () => {
        actions.current.openSettings("appearance");
      }),
      // Every window hears the click; only the one holding the session acts.
      listen<string>(NOTIFICATION_CLICK_EVENT, ({ payload: sessionId }) => {
        if (!sessionsRef.current.some((s) => s.id === sessionId)) return;
        const win = getCurrentWindow();
        // Windows leaves a minimized window minimized when it is only focused.
        void win
          .unminimize()
          .then(() => win.setFocus())
          .catch(() => {});
        actions.current.onOpenApprovalSession(sessionId);
      }),
    ];
    return () => {
      void Promise.all(unlisten).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const lastRemoteSnapshot = useRef(new Map<string, HostSession>());
  const onRemoteSnapshot = useCallback(
    (shellId: string, snapshot?: HostSession) => {
      if (!snapshot) {
        lastRemoteSnapshot.current.delete(shellId);
        setSessions((current) =>
          current.map((entry) =>
            entry.id === shellId
              ? {
                  ...entry,
                  title: "New remote session",
                  blocks: [],
                  busy: false,
                }
              : entry,
          ),
        );
        return;
      }
      if (lastRemoteSnapshot.current.get(shellId) === snapshot) return;
      lastRemoteSnapshot.current.set(shellId, snapshot);
      setSessions((current) => {
        const shell = current.find((entry) => entry.id === shellId);
        if (!shell) return current;
        const project = remoteProjectFor(shell.cwd);
        if (!project) return current;
        return current.map((entry) =>
          entry.id === shellId
            ? remoteSessionState(entry, snapshot, project)
            : entry,
        );
      });
    },
    [],
  );

  const onManageWorktrees = useCallback(
    () => openSettings("worktrees"),
    [openSettings],
  );

  const [assistantMachineId, setAssistantMachineId] = useState<string>();
  const onOpenAssistant = useCallback((machineId?: string) => {
    if (machineId) setAssistantMachineId(machineId);
    workspaceNavigation.cancel();
    setPaletteOpen(false);
    const next = openAppViewTab(tabsRef.current, "assistant");
    flushSync(() => setTabs(next.tabs));
    activateTab(next.tabId, next.paneId);
    setProjectTerminalFocused(false);
    setComposerFocused(false);
  }, [activateTab, workspaceNavigation.cancel]);

  const sessionPaneProps = {
    workspaceSwitchingSessionId: workspaceNavigation.pending
      ? active?.id
      : undefined,
    recents,
    hideProjectPicker: true,
    onFocus: onFocusPane,
    onClose: onClosePane,
    onCwdChange,
    onBranchChange,
    onWorktreeChange: onComposerWorktreeChange,
    onRemoteSnapshot,
    onWorkspaceModeChange,
    onWorktreeBaseChange,
    onManageWorktrees,
    onModelChange,
    onModelSettingsChange,
    onRuntimeModeChange,
    onSaveDraft,
    onRemoveDraft,
    onSubmit,
    onStop,
    onCompactContext,
    onDeleteQueuedMessage,
    onEditQueuedMessage,
    onQueuedMessageEditingChange,
    onSteerQueuedMessage,
    onResumeQueue,
    onUsageLimitResume,
    onUsageLimitResumeAtReset,
    onUsageLimitDismiss,
    onInboxCardDismiss,
    onLinkedWorkItemUpdateCardDismiss,
    onNoteCardDismiss,
    onHandoffCardDismiss,
    onOpenLinkedWorkItem,
    onArchiveSession: onArchiveHistorySession,
    onDeleteSession: onDeleteHistorySession,
    onApproval,
    onQuestionReply,
    onQuestionInteraction,
    onOpenFile,
    onOpenDiff,
    onOpenPlan,
    onBuildPlan,
    onSecondOpinion,
    onHandoff,
    onBtwSubmit,
    onBtwRetry,
    onBtwDelete,
    onBtwStop,
    onBtwModelChange,
    onNewTerminal: onNewTerminalInSession,
  };

  const changesPaneFiles = useMemo(() => {
    if (!activeTab) return [];
    const ids = new Set(leafIds(activeTab.layout));
    return activeTab.editorPanes.flatMap((pane) =>
      ids.has(pane.id)
        ? pane.files
            .filter((file) => file.changes || file.sessionChanges)
            .map((file) => ({ paneId: pane.id, fileId: file.id }))
        : [],
    );
  }, [activeTab]);
  const sessionHeaderActions = useMemo<SessionHeaderActions>(
    () => ({
      rename: (sessionId, title) => {
        void onRenameHistorySession(sessionId, title);
      },
      archive: (sessionId) => {
        void onArchiveHistorySession(sessionId, true);
      },
      splitRight: (sessionId) => {
        const session = newDefaultSession(
          sessionDefaults?.cwd ?? projectCwd,
          newSessionRuntimeMode,
        );
        setSessions((prev) => [...prev, session]);
        setTabs((prev) =>
          prev.map((tab) =>
            leafIds(tab.layout).includes(sessionId)
              ? {
                  ...tab,
                  layout: splitPane(tab.layout, sessionId, "right", session.id),
                  focusedId: session.id,
                  diffFocused: false,
                }
              : tab,
          ),
        );
        setComposerFocused(true);
      },
      terminalAvailable: isLocalProject(projectCwd),
      terminalOpen: dockVisible,
      toggleTerminal: onToggleProjectTerminal,
      selectProviderAccount: onSelectProviderAccount,
      manageProviderAccounts: () =>
        openSettings("providers", "provider-accounts"),
      changesOpen: changesPaneFiles.length > 0,
      toggleChanges: () => {
        if (changesPaneFiles.length === 0) {
          onOpenAllChanges("unstaged");
          return;
        }
        for (const { paneId, fileId } of changesPaneFiles)
          onCloseFile(paneId, fileId);
      },
    }),
    [
      changesPaneFiles,
      dockVisible,
      onArchiveHistorySession,
      onCloseFile,
      onOpenAllChanges,
      onRenameHistorySession,
      onSelectProviderAccount,
      onToggleProjectTerminal,
      openSettings,
      projectCwd,
      sessionDefaults?.cwd,
      newSessionRuntimeMode,
    ],
  );

  const renderAppView: AppViewRenderer = (kind, active) => {
    switch (kind) {
      case "assistant":
        return (
          <DesktopAssistant
            selectedMachineId={assistantMachineId}
            onSelectMachine={setAssistantMachineId}
            onLocalSession={onSelectHistorySession}
            onRemoteSession={onSelectRemoteSession}
          />
        );
      case "search":
        return (
          <SearchView
            open={active}
            cwd={gitCwd}
            recents={recents}
            history={projectHistory}
            sessions={sessions.filter((session) => !session.inboxAsk)}
            focusToken={searchViewFocusToken}
            queryRequest={searchQueryRequest}
            onClose={onLeaveSearch}
            onOpenFile={(path) => {
              closeAppDialog();
              onOpenFile(path);
            }}
            onOpenSession={(sessionId, blockId, query) => {
              closeAppDialog();
              if (blockId) requestTranscriptJump(sessionId, blockId, query);
              void onSelectHistorySession(sessionId);
            }}
            onOpenProject={(path) => {
              closeAppDialog();
              onSelectProject(path);
            }}
          />
        );
      case "inbox":
        return (
          <InboxView
            active={active}
            cwd={sidebarCwd}
            recents={recents}
            onClose={onLeaveInbox}
            onStart={(...args: Parameters<typeof onStartInboxItem>) =>
              onStartInboxItem(...args).then(closeAppPage)
            }
            onAsk={onAskInboxItem}
            onAskRestart={onRestartInboxAsk}
            onAskMount={setInboxAskPortal}
            sessions={inboxRelatedSessions}
            repairSessions={repairSessions}
            onRepairChecks={(...args: Parameters<typeof onRepairChecks>) =>
              onRepairChecks(...args).then(closeAppPage)
            }
            onOpenSession={(sessionId: string) => {
              closeAppPage();
              onOpenInboxSession(sessionId);
            }}
            onOpenIntegrations={onOpenInboxIntegrations}
          />
        );
      case "notes":
        return (
          <NotesView
            active={active}
            cwd={projectCwd}
            recents={recents}
            onClose={onLeaveNotes}
          />
        );
      case "automations":
        return (
          <AutomationsView
            active={active}
            cwd={projectCwd}
            recents={recents}
            onClose={onLeaveAutomations}
            onLaunch={(automation, run) => {
              closeAppPage();
              return launchAutomation(automation, run, true);
            }}
            onOpenSession={(
              ...args: Parameters<typeof onOpenAutomationSession>
            ) => {
              closeAppPage();
              return onOpenAutomationSession(...args);
            }}
          />
        );
      case "workflows":
        return <WorkflowsView cwd={projectCwd} />;
      case "settings":
        return (
          <SettingsView
            active={active}
            section={settingsSection}
            anchor={settingsAnchor}
            notificationProjectPath={notificationProjectPath}
            notificationSettingsRequest={notificationSettingsRequest}
            recents={recents}
            cwd={sidebarCwd}
            sessions={sidebarHistory}
            liveSessions={sessions}
            onRemoveWorktree={onRemoveWorktree}
            onCheckWorktreeRemoval={onCheckWorktreeRemoval}
            onDeleteWorktreeSessions={onDeleteWorktreeSessions}
            onClose={onCloseSettings}
            onSelectSection={onSelectSettingsSection}
            onOpenSession={(sessionId: string) => {
              closeAppDialog();
              onOpenArchivedSession(sessionId);
            }}
            onArchiveSession={onArchiveHistorySession}
            onDeleteSession={onDeleteHistorySession}
            onRestoreProject={onRestoreProject}
            onDeleteProject={(path) =>
              onRemoveProject(path, { purgeData: true })
            }
            onOpenWhatsNew={onOpenWhatsNew}
          />
        );
    }
  };

  // Full/split view reshapes every card of the active chat, so its toggle
  // lives in the window's top bar beside the window controls.
  const activeLeafIds = activeTab ? leafIds(activeTab.layout) : [];
  const activeSessionLeafCount = activeLeafIds.filter((id) =>
    sessions.some((session) => session.id === id),
  ).length;
  const surfaceModeToggle =
    workspaceVisible &&
    activeTab &&
    activeSessionLeafCount === 1 &&
    activeLeafIds.length > 1 ? (
      <SessionSurfaceActions
        mode={activeTab.surfaceMode ?? "split"}
        onModeChange={(surfaceMode) =>
          setTabs((current) =>
            current.map((entry) =>
              entry.id === activeTab.id ? { ...entry, surfaceMode } : entry,
            ),
          )
        }
      />
    ) : null;

  const windowLeading = (
    <DesktopAssistantButton
      active={activeAppView === "assistant"}
      selectedMachineId={assistantMachineId}
      onOpen={onOpenAssistant}
    />
  );

  const updateStatus = useUpdateStatus();
  const activityBarProps = useMemo(() => ({
    updateStatus,
    onShowProjects,
    cwd: sidebarCwd,
    recents,
    busyPaths: sessions.flatMap((session) =>
      session.busy && session.cwd ? [session.cwd] : [],
    ),
    liveAgents,
    activeSessionId: active?.id,
    onSelectAgent: onSelectLiveAgent,
    onSelectProject,
    onOpenProject: pickProject,
    onRemoveProject,
    onSearch: onGoToFile,
    onOpenInbox,
    onOpenNotes: notesEnabled ? onOpenNotes : undefined,
    onOpenSettings,
    onOpenAutomations,
    onOpenWorkflows,
    searchActive: activeAppView === "search",
    inboxActive: appPage === "inbox",
    notesActive: activeAppView === "notes",
    automationsActive: activeAppView === "automations",
    workflowsActive: activeAppView === "workflows",
    settingsActive: activeAppView === "settings",
    notesEnabled,
    inboxUnseen,
    onOpenNotificationSettings,
    updateNotice,
    onOpenWhatsNew,
    onDismissUpdate: () => setUpdateNotice(null),
  } satisfies ActivityBarProps), [
    updateStatus, onShowProjects, sidebarCwd, recents, sessions, liveAgents,
    active?.id, onSelectLiveAgent, onSelectProject, pickProject, onRemoveProject,
    onGoToFile, onOpenInbox, notesEnabled, onOpenNotes, onOpenSettings,
    onOpenAutomations, onOpenWorkflows, activeAppView, appPage, inboxUnseen,
    onOpenNotificationSettings, updateNotice, onOpenWhatsNew,
  ]);
  const sidebarNavigation = useMemo(() => (
    <div id="sidebar-navigation-menu" className="shrink-0">
      <AnimatedCollapse expanded={navigationExpanded} keepMounted>
        <ActivityBar layout="sidebar-top" {...activityBarProps} />
      </AnimatedCollapse>
    </div>
  ), [navigationExpanded, activityBarProps]);
  const titlebarNavigation = (
    <TitlebarNavigation expanded={sessionSidebarOpen && !navigationExpanded}>
      <ActivityBar layout="titlebar" {...activityBarProps} />
    </TitlebarNavigation>
  );
  const sidebarFooter = useMemo(() => (
    <ActivityBar layout="sidebar-footer" {...activityBarProps} />
  ), [activityBarProps]);
  const sidebarWorkflows = useMemo(() => (
    <WorkflowSidebarSection
      activeSessionId={active?.id}
      onOpenSession={(sessionId) => void onSelectHistorySession(sessionId)}
      onOpenWorkflows={onOpenWorkflows}
      workflowsActive={activeAppView === "workflows"}
    />
  ), [active?.id, onSelectHistorySession, onOpenWorkflows, activeAppView]);

  return (
    <WorkflowAppContext.Provider value={workflowApp}>
    <WorkflowProjectsContext.Provider value={workflowProjects}>
    <WorkflowActivityContext.Provider value={workflowActivity}>
    <OrchestrationActions.Provider value={orchestrationActions}>
      <OrchestrationWorkers.Provider value={orchestrationWorkers}>
        <AppViewRendererContext.Provider value={renderAppView}>
          <SessionHeaderActionsContext.Provider value={sessionHeaderActions}>
            <div
              className={`relative flex h-full flex-col text-content ${
                HAS_NATIVE_GLASS
                  ? "bg-background-base/40"
                  : "bg-background-base"
              }`}
              style={
                {
                  "--menu-bar-h": menuBarPinned
                    ? `${MENU_BAR_HEIGHT}px`
                    : "0px",
                } as CSSProperties
              }
            >
              <div
                data-window-chrome
                className="relative shrink-0"
                style={{ zIndex: LAYER.windowChrome }}
              >
                {!IS_MAC ? (
                  <MenuBar
                    navigationItems={titlebarNavigation}
                    handlers={commandHandlers}
                    dispatch={dispatch}
                    canGoBack={tabVisitNav.canBack}
                    canGoForward={tabVisitNav.canForward}
                    sidebarOpen={sessionSidebarOpen}
                    navigationExpanded={navigationExpanded}
                    onToggleNavigation={
                      sessionSidebarOpen ? onToggleNavigation : undefined
                    }
                    windowLeading={windowLeading}
                    windowActions={surfaceModeToggle}
                  />
                ) : null}
                {!menuBarPinned ? (
                  <WindowDragBar
                    navigationItems={titlebarNavigation}
                    canGoBack={tabVisitNav.canBack}
                    canGoForward={tabVisitNav.canForward}
                    onGoBack={onRailBack}
                    onGoForward={onRailForward}
                    onTogglePanel={onToggleSidebar}
                    panelActive={sessionSidebarOpen}
                    navigationExpanded={navigationExpanded}
                    onToggleNavigation={
                      sessionSidebarOpen ? onToggleNavigation : undefined
                    }
                    windowLeading={windowLeading}
                    windowActions={surfaceModeToggle}
                  />
                ) : null}
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <SidebarRail open={!sessionSidebarOpen}>
                  <ActivityBar
                    layout="rail"
                    chromeInMenuBar
                    {...activityBarProps}
                  />
                </SidebarRail>
                <Sidebar
                  navigation={sidebarNavigation}
                  footer={sidebarFooter}
                  workflowsSection={sidebarWorkflows}
                  recents={recents}
                  onSelectProject={onSelectProject}
                  onOpenProject={pickProject}
                  onRemoveProject={onRemoveProject}
                  onOpenNotificationSettings={onOpenNotificationSettings}
                  projectHistory={treeHistory}
                  loadedProjectPaths={loadedProjects}
                  failedProjectPaths={failedProjectPaths}
                  onLoadProject={refreshHistory}
                  onPrefetchRemoteProject={prefetchRemoteProjectSessions}
                  onNewInProject={onNewInProject}
                  cwd={sidebarCwd}
                  gitCwd={gitCwd}
                  worktreeTabStats={worktreeTabStats}
                  onSelectWorkspace={onSelectWorkspace}
                  workspaceSwitchPending={
                    workspaceNavigation.pending?.project === sidebarCwd
                  }
                  workspaceSwitchError={
                    workspaceNavigation.error?.project === sidebarCwd
                      ? workspaceNavigation.error.message
                      : undefined
                  }
                  explorerRootLabel={explorerRootLabel}
                  open={sessionSidebarOpen}
                  chromeInMenuBar
                  onToggleSidebar={onToggleSidebar}
                  tab={sidebarTab}
                  onTabChange={setSidebarTab}
                  filesSearchOpen={filesSearchOpen}
                  onFilesSearchOpenChange={setFilesSearchOpen}
                  onOpenFilesSearch={onFindInProject}
                  searchFocusToken={searchFocusToken}
                  sessions={sidebarHistory}
                  busySessionIds={busySessionIds}
                  approvalSessionIds={approvalSessionIds}
                  questionSessionIds={questionSessionIds}
                  activeSessionId={active?.id}
                  visibleSessionId={activeSessionId ?? null}
                  status={historyFailed ? "error" : "idle"}
                  pending={historyPending}
                  onSelectSession={onSelectHistorySession}
                  onSelectRemoteSession={onSelectRemoteSession}
                  onRemoteSessionDeleted={onRemoteSessionDeleted}
                  onPrefetchSession={onPrefetchHistorySession}
                  onSessionNavigationOrder={onSessionNavigationOrder}
                  onPlaceSessionOnPane={onPlaceSessionOnPane}
                  onRenameSession={onRenameHistorySession}
                  onArchiveSession={onArchiveHistorySession}
                  onArchiveSessions={onArchiveHistorySessions}
                  onPinSession={onPinHistorySession}
                  onPinSessions={onPinHistorySessions}
                  onSetSessionLinkedWorkItem={onSetHistorySessionLinkedWorkItem}
                  reminders={sessionReminders.reminders}
                  onSetReminders={sessionReminders.schedule}
                  onCancelReminders={sessionReminders.cancel}
                  onDeleteSession={onDeleteHistorySession}
                  onDeleteSessions={onDeleteHistorySessions}
                  onOpenFile={onOpenFile}
                  onOpenTerminal={onOpenTerminal}
                  onFileMoved={onFileMoved}
                  onFileDeleted={onFileDeleted}
                  onOpenDiff={onOpenWorkingTreeDiff}
                  onOpenAllChanges={onOpenAllChanges}
                  onOpenCommit={onOpenCommit}
                  selectedDiffPath={
                    activeTab
                      ? selectedChangePath(activeTab, gitCwd)
                      : undefined
                  }
                  selectedDiffKind={
                    activeTab ? selectedChangeKind(activeTab) : undefined
                  }
                  selectedCommitSha={
                    activeTab ? selectedCommitSha(activeTab) : undefined
                  }
                  textHarness={pickTextHarness(active?.harness)}
                  onNew={onNew}
                  openSessions={openProjectSessions}
                  openSessionIds={sidebarOpenSessionIds}
                  onOpenInboxItem={onOpenLinkedWorkItem}
                  onGoToFile={onGoToFile}
                  unseenFinishedIds={unseenFinishedIds}
                  linkedSessionUpdateIds={linkedSessionUpdateIds}
                />

                <SidebarMain open={sessionSidebarOpen}>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <main
                      data-project-switching={projectSwitchPending || undefined}
                      aria-busy={projectSwitchPending || undefined}
                      className="project-switch-surface relative flex min-h-0 min-w-0 flex-1"
                    >
                      {APP_PAGE_KINDS.filter(
                        (kind) => kind !== "notes" || notesEnabled,
                      ).map((kind) => (
                        <div
                          key={kind}
                          data-app-page={kind}
                          ref={appPage === kind ? appPageHostRef : undefined}
                          tabIndex={-1}
                          hidden={appPage !== kind}
                          aria-hidden={appPage !== kind}
                          inert={
                            appPage !== kind || appDialog !== null || undefined
                          }
                          className={
                            appPage === kind
                              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
                              : "hidden"
                          }
                        >
                          <AppViewHost
                            kind={kind}
                            visible={appPage === kind && appDialog === null}
                            focused={appPage === kind && appDialog === null}
                          />
                        </div>
                      ))}
                      <div
                        data-workspace-content
                        hidden={!workspaceVisible}
                        aria-hidden={!workspaceVisible}
                        inert={!workspaceVisible || undefined}
                        className={
                          workspaceVisible
                            ? "relative flex min-h-0 min-w-0 flex-1"
                            : "hidden"
                        }
                      >
                        <SurfaceVisibilityContext.Provider
                          value={workspaceVisible}
                        >
                          <TerminalDockLayout
                            projectTerminals={projectTerminals}
                            currentDock={currentProjectDock}
                            projectCwd={projectCwd}
                            workspaceVisible={workspaceVisible}
                            lastDockSide={lastDockSide}
                            focused={projectTerminalFocused}
                            onFocus={focusProjectTerminal}
                            onHide={onHideProjectTerminal}
                            onSideChange={onProjectTerminalSide}
                            onSizeCommit={onProjectTerminalSize}
                            onAddTerminal={onNewTerminal}
                            onSelectTerminal={onSelectProjectTerminal}
                            onCloseTerminal={onCloseProjectTerminal}
                            onCloseOtherTerminals={onCloseOtherProjectTerminals}
                            onReorderTerminals={onReorderProjectTerminals}
                            onTerminalMetaChange={onTerminalMetaChange}
                            onMoveToPane={onMoveDockToPane}
                          >
                            <div
                              className="relative flex min-h-0 min-w-0 flex-row"
                              style={{
                                gridArea: "main",
                              }}
                            >
                              <div className="relative min-h-0 min-w-0 flex-1">
                                {tabs.map((tab) => (
                                  <div
                                    key={tab.id}
                                    data-workspace-tab={tab.id}
                                    data-active={String(tab.id === activeTabId)}
                                    aria-hidden={tab.id !== activeTabId}
                                    className={
                                      tab.id === activeTabId
                                        ? "absolute inset-0 flex h-full min-h-0 flex-col"
                                        : "hidden"
                                    }
                                  >
                                    <div
                                      className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                                        // One card for a lone pane or a chat's
                                        // unified view; split views card each
                                        // column on a gutter (see PaneTree).
                                        tabIsOneCard(tab, sessions)
                                          ? "pane-card mb-1 mr-1"
                                          : "h-full"
                                      }`}
                                    >
                                      <PaneTree
                                        {...sessionPaneProps}
                                        visible={
                                          workspaceVisible &&
                                          tab.id === activeTabId
                                        }
                                        surfaceMode={tab.surfaceMode ?? "split"}
                                        onOpenSessionFile={onOpenSessionFile}
                                        layout={tab.layout}
                                        sessions={sessions}
                                        editorPanes={[
                                          ...tab.editorPanes,
                                          ...(tab.terminalPanes ?? []),
                                        ]}
                                        dirtyFileIds={dirtyFiles}
                                        fileErrorCounts={fileErrorCounts}
                                        focusedId={
                                          workspaceVisible &&
                                          tab.id === activeTabId &&
                                          !tab.diffFocused &&
                                          !projectTerminalFocused
                                            ? tab.focusedId
                                            : ""
                                        }
                                        addToChatSessionId={
                                          tab.id === activeTabId
                                            ? active?.id
                                            : undefined
                                        }
                                        composerFocused={
                                          workspaceVisible &&
                                          composerFocused &&
                                          !projectTerminalFocused
                                        }
                                        composerFocusToken={composerFocusToken}
                                        onSelectFile={onSelectFileSurface}
                                        onCloseFile={onCloseFile}
                                        onCloseOtherFiles={onCloseOtherFiles}
                                        onPinFile={onPinFile}
                                        onReorderFiles={onReorderFiles}
                                        onFileDirtyChange={onFileDirtyChange}
                                        onFileErrorCountChange={
                                          onFileErrorCountChange
                                        }
                                        transcriptPool={transcriptPool}
                                        onRatio={(splitId, index, ratio) =>
                                          onRatio(tab.id, splitId, index, ratio)
                                        }
                                        editorNavigation={
                                          editorNavigations[tab.id] &&
                                          (!editorNavigations[tab.id]
                                            .ownerSessionId ||
                                            leafIds(tab.layout).includes(
                                              editorNavigations[tab.id]
                                                .ownerSessionId!,
                                            ))
                                            ? editorNavigations[tab.id].target
                                            : null
                                        }
                                        onUpdatePlan={onUpdatePlan}
                                        onMovePane={onMovePane}
                                        onMovePaneToDock={onMovePaneToDock}
                                        onTerminalMetaChange={
                                          onTerminalMetaChange
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TerminalDockLayout>
                          {[...linkedWorkItemPanels.values()].map((panel) => (
                            <LinkedWorkItemPanel
                              repairSessions={repairSessions}
                              onRepairChecks={onRepairChecks}
                              onOpenSession={(sessionId) => {
                                closeLinkedWorkItemPanel(panel.sessionId);
                                onOpenInboxSession(sessionId);
                              }}
                              key={panel.sessionId}
                              target={panel.item}
                              cwd={panel.cwd}
                              recents={recents}
                              visible={
                                !activeAppView &&
                                activeLinkedWorkItemPanel?.sessionId ===
                                  panel.sessionId
                              }
                              onClose={() =>
                                closeLinkedWorkItemPanel(panel.sessionId)
                              }
                            />
                          ))}
                        </SurfaceVisibilityContext.Provider>
                      </div>
                    </main>
                  </div>
                  <div className="hidden" aria-hidden>
                    {sessions
                      .filter((session) => session.inboxAsk)
                      .map((session) => {
                        const visible =
                          inboxVisible &&
                          inboxAskPortal?.sessionId === session.id;
                        return (
                          <SessionSurface
                            key={session.id}
                            host={visible ? inboxAskPortal.host : undefined}
                          >
                            <SurfaceVisibilityContext.Provider value={visible}>
                              <SessionPane
                                {...sessionPaneProps}
                                session={session}
                                visible={visible}
                                focused={visible}
                                inSplit={false}
                                composerFocused={visible && composerFocused}
                                composerFocusToken={composerFocusToken}
                              />
                            </SurfaceVisibilityContext.Provider>
                          </SessionSurface>
                        );
                      })}
                  </div>
                </SidebarMain>
              </div>

              {paletteOpen ? (
                <QuickOpen
                  key={paletteToken}
                  open
                  cwd={filesCwd}
                  openPaths={openFilePaths}
                  initialQuery={paletteQuery}
                  commands={paletteCommands(commandHandlers)}
                  commandShortcut={commandShortcutLabel}
                  sessions={paletteSessions}
                  recents={recents}
                  currentProject={
                    looksLikeProject(sidebarCwd) ? sidebarCwd : null
                  }
                  onOpenFile={onOpenFile}
                  onRunCommand={(id) => void dispatch(id)}
                  onOpenSession={(sessionId) =>
                    void onSelectHistorySession(sessionId)
                  }
                  onOpenProject={onSelectProject}
                  onAddProject={() => void dispatch("App: Open Project")}
                  onSearchEverywhere={onSearchEverywhere}
                  onClose={() => setPaletteOpen(false)}
                />
              ) : null}

              {appDialog ? (
                <AppViewDialog
                  title={translate(appViewTitle(appDialog))}
                  onClose={closeAppDialog}
                  topInset={
                    menuBarPinned ? MENU_BAR_HEIGHT : WINDOW_DRAG_BAR_HEIGHT
                  }
                >
                  {renderAppView(appDialog, true)}
                </AppViewDialog>
              ) : null}
              {sessionDeleteDialog && (
                <DeleteSessionDialog
                  title={sessionDeleteDialog.title}
                  unusedWorktree={sessionDeleteDialog.unusedWorktree}
                  onClose={(choice) => {
                    sessionDeleteDialog.resolve(choice);
                    setSessionDeleteDialog(undefined);
                  }}
                />
              )}
              <HarnessUpdateNotice
                topOffset={
                  12 + (reminderNoticesHeight ? reminderNoticesHeight + 8 : 0)
                }
                onHeightChange={setHarnessUpdateHeight}
              />
              <ApprovalToasts
                notices={hiddenApprovalToasts}
                topOffset={
                  12 +
                  (reminderNoticesHeight ? reminderNoticesHeight + 8 : 0) +
                  (harnessUpdateHeight ? harnessUpdateHeight + 8 : 0)
                }
                onFocusSession={onOpenApprovalSession}
                onApproval={onApproval}
              />
              <ReminderNotices
                reminders={sessionReminders.due}
                error={sessionReminders.error}
                onOpen={sessionReminders.open}
                onSnooze={sessionReminders.schedule}
                onDismiss={sessionReminders.cancel}
                onRetry={sessionReminders.refresh}
                onOpenSettings={() => openSettings("general", "notifications")}
                onHeightChange={setReminderNoticesHeight}
              />
              {whatsNewVersion ? (
                <WhatsNewDialog
                  version={whatsNewVersion}
                  onClose={() => setWhatsNewVersion(null)}
                />
              ) : null}
              {remoteProjectDialogOpen ? (
                <AddRemoteProjectDialog
                  onCancel={() => setRemoteProjectDialogOpen(false)}
                  onOpen={(key) => {
                    setRemoteProjectDialogOpen(false);
                    onSelectProject(key);
                  }}
                />
              ) : null}
              {providerSignInRequest ? (
                <ProviderSignInDialog
                  key={providerSignInRequest.key}
                  harness={providerSignInRequest.harness}
                  onClose={() => setProviderSignInRequest(null)}
                />
              ) : null}
            </div>
            <TranscriptPoolOutlet pool={transcriptPool} />
          </SessionHeaderActionsContext.Provider>
        </AppViewRendererContext.Provider>
      </OrchestrationWorkers.Provider>
    </OrchestrationActions.Provider>
    </WorkflowActivityContext.Provider>
    </WorkflowProjectsContext.Provider>
    </WorkflowAppContext.Provider>
  );
}
function lastUserBlockId(session: Session): string | undefined {
  for (let i = session.blocks.length - 1; i >= 0; i--) {
    if (session.blocks[i]?.role === "user") return session.blocks[i]?.id;
  }
  return undefined;
}

function providerSignInRequestKey(session: Session): string {
  const lastBlockId = session.blocks[session.blocks.length - 1]?.id;
  return `${session.id}:${lastUserBlockId(session) ?? lastBlockId ?? "auth"}`;
}

function selectedChangePath(
  tab: WorkspaceTab,
  gitCwd?: string,
): string | undefined {
  const file = focusedFileTab(tab);
  if (!file || !isFilesystemTab(file) || !file.review) return undefined;
  return displayPath(file.path, gitCwd || file.cwd);
}

function selectedChangeKind(tab: WorkspaceTab): GitFileDiffKind | undefined {
  const file = focusedFileTab(tab);
  return file?.review ? file.changeKind : undefined;
}

function selectedCommitSha(tab: WorkspaceTab): string | undefined {
  const focused = focusedFileTab(tab);
  if (focused && isCommitTab(focused)) return focused.commit.sha;
  for (const pane of tab.editorPanes) {
    const file = pane.files.find((entry) => entry.id === pane.activeFileId);
    if (file && isCommitTab(file)) return file.commit.sha;
  }
}

function isBlankWorkspaceTab(tab: WorkspaceTab, sessions: Session[]): boolean {
  if (tab.editorPanes.some((pane) => pane.files.length > 0)) return false;
  if ((tab.terminalPanes ?? []).some((pane) => pane.files.length > 0))
    return false;
  const ids = leafIds(tab.layout);
  if (ids.length !== 1) return false;
  if (remoteSessionFor(ids[0]) || remotePendingWorktree(ids[0])) return false;
  return isBlankSession(sessions.find((entry) => entry.id === ids[0]));
}

/** Project folder name a workspace tab belongs to; empty for app-only tabs. */
function tabProjectName(tab: WorkspaceTab, sessions: Session[]): string {
  if (isAppViewOnlyTab(tab)) return "";
  const tabSessions = leafIds(tab.layout)
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is Session => session != null);
  const focused =
    sessions.find((session) => session.id === tab.focusedId) ?? tabSessions[0];
  if (focused) return projectName(focused.cwd);
  const focusedFile = focusedFileTab(tab);
  return focusedFile
    ? projectName(focusedFile.projectCwd ?? focusedFile.cwd)
    : "~";
}

function dropOpenFiles(
  tab: WorkspaceTab,
  shouldDrop: (path: string) => boolean,
): WorkspaceTab {
  let layout = tab.layout;
  let focusedId = tab.focusedId;
  const editorPanes: EditorPane[] = [];
  for (const pane of tab.editorPanes) {
    const files = pane.files.filter(
      (file) => !isFilesystemTab(file) || !shouldDrop(file.path),
    );
    if (files.length === 0) {
      const sibling = siblingLeafId(layout, pane.id);
      const withoutPane = removePane(layout, pane.id);
      if (withoutPane) {
        layout = withoutPane;
        if (focusedId === pane.id)
          focusedId = sibling ?? firstLeafId(withoutPane);
      }
      continue;
    }
    editorPanes.push({
      ...pane,
      files,
      activeFileId: files.some((file) => file.id === pane.activeFileId)
        ? pane.activeFileId
        : files[0].id,
    });
  }
  return { ...tab, layout, focusedId, editorPanes };
}

function trackSessionEdits(
  sessionId: string,
  cwd: string,
  event: HarnessEvent,
) {
  if (event.type !== "tool.started" && event.type !== "tool.updated") return;
  if (!isEditTool(event.kind, event.title, event.preview)) return;
  const paths = [
    ...(event.paths ?? []),
    ...(event.preview?.path ? [event.preview.path] : []),
  ].filter((path, index, all) => all.indexOf(path) === index);
  if (paths.length === 0 || cwd === "~") return;
  const completed =
    event.type === "tool.updated" &&
    (event.status === "completed" || event.status === "success");
  if (!completed) {
    void prepareSessionCheckpoint(sessionId, cwd, paths).catch(() => undefined);
    return;
  }
  void captureSessionCheckpoint(sessionId, cwd, paths)
    .catch(() => undefined)
    .then(() => notifyReviewChanged(sessionId));
}

function nudgeWorkspace(cwd?: string) {
  invalidateProjectFiles(cwd);
  notifyDirsChanged();
}

function nudgeOpenEditors(event: HarnessEvent, cwd: string) {
  if (event.type !== "tool.updated") return;
  const completed = event.status === "completed" || event.status === "success";

  const kind = event.kind?.trim().toLowerCase();
  if (kind === "execute" || event.preview?.kind === "shell") {
    if (!completed) return;
    nudgeWatchedFiles();
    window.setTimeout(() => nudgeWatchedFiles(), 150);
    notifyGitChanged();
    nudgeWorkspace(cwd);
    window.setTimeout(() => nudgeWorkspace(cwd), 150);
    return;
  }

  if (!isEditTool(event.kind, event.title, event.preview)) return;
  const resolved = [
    ...(event.paths ?? []),
    ...(event.preview?.path ? [event.preview.path] : []),
  ]
    .map((path) => resolveWorkspacePath(path, cwd) ?? path)
    .filter((path, index, paths) => paths.indexOf(path) === index);
  if (completed) {
    // A successful edit is authoritative. Reload it even if a startup race or
    // coarse filesystem timestamp makes the mtime appear unchanged.
    invalidateWatchedFiles(resolved.length > 0 ? resolved : undefined);
  } else if (resolved.length > 0) {
    nudgeWatchedFiles(resolved);
  }
  if (completed) {
    window.setTimeout(
      () => nudgeWatchedFiles(resolved.length > 0 ? resolved : undefined),
      150,
    );
    notifyGitChanged();
    nudgeWorkspace(cwd);
  }
}

function sameSettings(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

/** Mirrors PaneTree: only a lone pane or a single chat's unified view is one card. */
function tabIsOneCard(tab: WorkspaceTab, sessions: readonly Session[]): boolean {
  const leaves = leafIds(tab.layout);
  if (leaves.length <= 1) return true;
  const chats = leaves.filter((id) =>
    sessions.some((session) => session.id === id),
  );
  return chats.length === 1 && tab.surfaceMode === "unified";
}
