import { MobileNotes, type MobileNotesHandle } from "./MobileNotes";
import {
  appendNoteReference,
  noteSourceProject,
  type Note,
} from "../features/notes/notesText";
import { useConnectionAppearance, saveConnectionAppearance, removeConnectionAppearance } from "./connectionAppearance";
import { connectionErrorMessage } from "./connectionError";
import { MobileAssistant, type MobileAssistantHandle } from "./MobileAssistant";
import { useMobileAssistantUnread } from "./useMobileAssistantUnread";
import { resolveAssistantTarget } from "../features/assistant/model/assistantNavigation";
import { useHostQueue } from "../features/connections/ui/useHostQueue";
import {
  outgoingPlacement,
  withOutgoing,
  type OutgoingMessage,
} from "../features/connections/model/outgoing";
import { consumePlanCommand } from "../features/sessions/model/plan";
import {
  IMPLEMENT_PLAN_PROMPT,
  skipPlanDecision,
  usePlanDecision,
} from "../features/sessions/model/planDecision";
import { isCompactCommand } from "../features/sessions/model/compact";
import { MobileMessageQueue } from "./MobileMessageQueue";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type RefObject,
} from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  ArrowLeft,
  Chatting,
  ChevronDown,
  Computer,
  Folder,
  FolderPlus,
  Info,
  LoaderCircle,
  PanelLeft,
  RefreshCw,
  Search,
  X,
} from "../shared/ui/icons";
import {
  DEFAULT_RUNTIME_MODE,
  sessionDisplayTitle,
  sessionWorkCwd,
  type Attachment,
  type Block,
  type QueuedMessage,
} from "../features/sessions/model/session";
import { pendingSessionInputKey } from "../features/sessions/model/sessionActivity";
import type {
  HostProject,
  HostSession,
  HostSessionSummary,
  HostCommand,
} from "../features/connections/model/protocol";
import { MobileTranscript } from "./MobileTranscript";
import { createMobileGitSource } from "./mobileGit";
import { useMobileAppUpdates } from "./MobileAppUpdates";
import {
  configurationForSession,
  type MobileConfiguration,
} from "./MobileModelControls";
import {
  defaultConfiguration as firstConfiguration,
  defaultProviderAccount,
  loadMobileAgentDefaults,
  type MobileAgentDefaults as AgentDefaults,
} from "./agentDefaults";
import { MobileAgentDefaults } from "./MobileAgentDefaults";
import { MobileProviderAccounts } from "./MobileProviderAccounts";
import type { HostModelCatalog } from "../features/connections/model/protocol";
import {
  MobileClient,
  type PendingCommand,
  type MobileFirstMessage,
  type MobileSessionPatch,
  type Connection,
  type HostConnectionStatus,
} from "./client";
import type { MobileComposerPanel } from "./MobileComposer";
import { createMobileDraft, MobileDraftComposer } from "./MobileDraftComposer";
import { MobileSessionActions } from "./MobileSessionActions";
import { MobileSessionStatus } from "./MobileSessionStatus";
import { MeterRing } from "../features/sessions/ui/ContextMeter";
import { contextRatio } from "../features/sessions/model/contextUsage";
import { mobileContextUsage } from "./contextUsage";
import { MobileConnectionSheet } from "./MobileConnectionSheet";
import { normalizePairingCode } from "./pairing";
import { MobileSheet, SHEET_WIDTH, type MobileSheetPoint } from "./MobileSheet";
import { MobileProjectPicker } from "./MobileProjectPicker";
import { MobileDrawer } from "./MobileDrawer";
import { MobileHome } from "./MobileHome";
import { MobileHomeMenu } from "./MobileHomeMenu";
import { MobileHeaderSearch } from "./MobileHeaderSearch";
import {
  MobileSettings,
  mobileSettingsTitle,
  mobileSettingsParent,
  type MobilePreferencePanel,
  type MobileSettingsPage,
} from "./MobileSettings";
import { readLastLocation, saveLastLocation } from "./lastLocation";
import { useMobileActivity } from "./useMobileActivity";
import { MobileHostStatus } from "./MobileHostStatus";
import { MobileHostPicker } from "./MobileHostPicker";
import { MobileDeviceChips, type MobileHomeScope } from "./MobileDeviceChips";
import { useMobileHostDirectory } from "./useMobileHostDirectory";
import { MobileHostUnavailable } from "./MobileHostUnavailable";
import { loadLastOnline, saveLastOnline } from "./lastOnline";
import { useHostConnectionStatus } from "./useHostConnectionStatus";
import { useTranslation } from "../shared/i18n/useTranslation";
import { setUiLanguage, translate } from "../shared/i18n/language";
import {
  nativeProviderLabel,
  nativeSourceKey,
  nativeSyncBlocked,
  nativeSyncNotice,
  type NativeSessionAccess,
} from "../integrations/harness/core/nativeSessions";
import { readMobileAttachments } from "./attachments";
import { takeBackQueuedMessage } from "./queuedDraft";
import {
  loadFollowUpBehavior,
  saveFollowUpBehavior,
} from "../features/settings/model/settings";
import {
  applyAccentColor,
  loadAccentColor,
  loadTranscriptAnchor,
  loadTranscriptLayout,
  saveAccentColor,
  saveTranscriptAnchor,
  saveTranscriptLayout,
} from "../features/settings/model/appearance";
import {
  loadSoundsEnabled,
  saveSoundsEnabled,
} from "../features/settings/model/sounds";
import { MobileArchive } from "./MobileArchive";
import { mobileStorage } from "./storage";
import { useStableCallback } from "./useStableCallback";
import {
  applyGlassSettings,
  readGlassSettings,
  saveGlassSettings,
  type GlassSettings,
} from "./glassSettings";
import {
  applyThemePreference,
  saveThemePreference,
} from "../features/settings/model/appearance";
import { useNow } from "../shared/hooks/useNow";
import { MobilePageOverlay, MobilePageTransition, useMobileHeaderMotion, type MobileRoute } from "./MobilePageTransition";
import { MobileOverlayHostContext } from "./MobileOverlayHost";
import { MobileSheetPresence } from "./MobileSheetPresence";
import { migrateConnectionSettings } from "./connectionScope";
import { SurfaceVisibilityContext } from "../shared/ui/SurfaceVisibility";
import { dismissImageLightbox } from "../shared/ui/ImageLightbox";
import {
  showStatusToast,
  withStatusToast,
} from "../shared/ui/StatusToast";

const client = new MobileClient(mobileStorage);

/**
 * `undefined` while checking; `null` when the Host cannot verify ownership
 * (older Host or unavailable). Only a verified idle session may be written,
 * and a running Host turn already holds the shared lock.
 */
function nativeWriteBlocked(
  snapshot: HostSession | undefined,
  access: NativeSessionAccess | undefined,
): boolean {
  if (!snapshot?.session.nativeSession) return false;
  if (nativeSyncBlocked(snapshot.nativeStatus)) return true;
  return !(snapshot.status === "running" && snapshot.runId) && access?.state !== "idle";
}

function nativeAccessNotice(access: NativeSessionAccess | undefined): string {
  if (access === undefined)
    return translate("Checking whether this conversation is open elsewhere…");
  if (access.reason === "hostUnavailable")
    return translate("Unable to check native session access. Reconnect to the Host to continue.");
  const holder = access.holder;
  if (holder && access.state === "external")
    return translate(
      "Open in {provider} (pid {pid}) on the computer. Close it there to continue here.",
      { provider: nativeProviderLabel(holder.provider), pid: holder.pid },
    );
  if (holder && access.reason === "ambiguousProcess")
    return translate(
      "{provider} is running in this project (pid {pid}) on the computer and may be using this conversation. Close it to continue here.",
      { provider: nativeProviderLabel(holder.provider), pid: holder.pid },
    );
  if (access.reason === "anotherMonocode")
    return translate("MonoCode desktop is using this conversation. Try again when it finishes.");
  if (access.reason === "unsupportedPlatform")
    return translate("Native session ownership cannot be verified on this platform. Imported history is read-only.");
  return translate("Native session access could not be confirmed. Saved history keeps syncing; check other clients before continuing here.");
}
/** Confirms metadata changes that move or rename a conversation; pins show in place. */
function sessionPatchNotice(patch: MobileSessionPatch) {
  if (patch.archived === true)
    return { loading: "Archiving conversation…", success: "Conversation archived" };
  if (patch.archived === false)
    return { loading: "Restoring conversation…", success: "Conversation restored" };
  if (patch.title !== undefined)
    return { loading: "Renaming conversation…", success: "Conversation renamed" };
  return undefined;
}
const readHostImage = (path: string) => client.readBinaryFile(path);
const browseHostDirectories = (path?: string) => client.browseDirectories(path);
// Settings doubles as the connection screen before pairing.
type View = "home" | "chat" | "settings";

/** A sent message shown before the Host records it. */
type SendingMessage = {
  commandId: string;
  sessionId?: string;
  outgoing: OutgoingMessage;
  /** Stands in for a conversation the first message is still creating. */
  placeholder?: HostSession;
};
// The stock glyph packs its dots tightly; the header capsule reads better
// with wider, slightly heavier dots.
function HeaderMoreIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="4.5" r="2.25" fill="currentColor" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <circle cx="12" cy="19.5" r="2.25" fill="currentColor" />
    </svg>
  );
}
const message = (error: unknown) =>
  error instanceof Error
    ? translate(error.message)
    : translate("Unable to reach this Host.");
function IconButton({
  label,
  children,
  onClick,
  disabled,
  inactive,
  buttonRef,
}: {
  label: string;
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  inactive?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <button
      ref={buttonRef}
      className="mobile-icon-button"
      type="button"
      aria-label={t(label)}
      title={t(label)}
      onClick={onClick}
      disabled={disabled}
      inert={inactive}
      aria-hidden={inactive || undefined}
    >
      {children}
    </button>
  );
}
function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mobile-empty">
      <div className="mobile-empty-icon">{icon}</div>
      <h2>{t(title)}</h2>
      <p>{children}</p>
    </div>
  );
}
const HOME_SCOPE_KEY = "monocode.mobile.homeScope";
function loadHomeScope(): MobileHomeScope {
  try {
    return localStorage.getItem(HOME_SCOPE_KEY) === "all" ? "all" : "device";
  } catch {
    return "device";
  }
}
function saveHomeScope(scope: MobileHomeScope) {
  try {
    localStorage.setItem(HOME_SCOPE_KEY, scope);
  } catch {
    // Scope is a convenience; an unavailable store keeps the session's choice.
  }
}

export function MobileApp() {
  const { language, t } = useTranslation();
  const appUpdates = useMobileAppUpdates();
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutTrigger = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<View>("settings");
  // List scope survives navigation, so chat controls need their own entry source.
  const [sessionEntrySource, setSessionEntrySource] = useState<"project" | "other">("other");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesPage = useRef<MobileNotesHandle>(null);
  const pageOverlayOpen = assistantOpen || notesOpen;
  const [assistantIdentity, setAssistantIdentity] = useState<{ hostId: string; name?: string }>();
  const assistantPage = useRef<MobileAssistantHandle>(null);
  const assistantRpc = useCallback(async <T,>(method: string, params?: object) => {
    const hostId = client.connection?.endpoint;
    const result = await client.rpc<T>(method, params);
    if (method === "assistant.get" && hostId && client.connection?.endpoint === hostId) {
      const name = (result as { name?: string } | null)?.name;
      setAssistantIdentity((current) => current?.hostId === hostId && current.name === name
        ? current : { hostId, name });
    }
    return result;
  }, []);
  const [homeProjectId, setHomeProjectId] = useState<string>();
  const [allProjectsPage, setAllProjectsPage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const homeMenuTrigger = useRef<HTMLButtonElement>(null);
  const settingsReturnView = useRef<View>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [homeScope, setHomeScopeState] = useState<MobileHomeScope>(loadHomeScope);
  const setHomeScope = useCallback((scope: MobileHomeScope) => {
    saveHomeScope(scope);
    setHomeScopeState(scope);
  }, []);
  const hostPickerTrigger = useRef<HTMLButtonElement>(null);
  const [settingsPage, setSettingsPage] = useState<MobileSettingsPage>("root");

  const connectionAppearance = useConnectionAppearance(client.connection?.endpoint);
  const connectionName = connectionAppearance.displayName || client.connection?.name || "MonoCode";
  const [connected, setConnected] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [savedHosts, setSavedHosts] = useState<Connection[]>([]);
  // Assistant read marks and drafts belong to the Host's conversation, not to one address.
  const assistantHostId = connected ? client.connection?.environmentId : undefined;
  const resolveNoteImage = useMemo(() => {
    const hostId = client.connection?.endpoint;
    return async (asset: string) => {
      if (client.connection?.endpoint !== hostId) throw new Error(t("Host connection changed."));
      const image = await client.noteImage(asset);
      return `data:${image.mime};base64,${image.data}`;
    };
  }, [client.connection?.endpoint, t]);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<HostProject[]>([]);
  const [projectListState, setProjectListState] = useState<"loading" | "ready" | "failed">("loading");
  const [project, setProject] = useState<HostProject>();
  const [sessions, setSessions] = useState<HostSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  // A draft keeps its page identity when its first send creates a session.
  const [chatPageKey, setChatPageKey] = useState("draft");
  const chatPageIdentity = useRef(chatPageKey);
  chatPageIdentity.current = chatPageKey;
  const [snapshot, setSnapshot] = useState<HostSession>();
  const [nativeAccessResult, setNativeAccessResult] = useState<{
    key: string;
    value: NativeSessionAccess | undefined;
  }>();
  const [sessionConfirmed, setSessionConfirmed] = useState(false);
  const [animateFrom, setAnimateFrom] = useState<string>();
  // A send shown in the transcript the moment it leaves, until the Host has
  // recorded it (or it failed and its text went back to the composer).
  const [sendingMessage, setSendingMessage] = useState<SendingMessage>();
  const sendingRef = useRef<SendingMessage>(undefined);
  sendingRef.current = sendingMessage;
  // A new conversation keeps the transcript its sending copy mounted.
  const transcriptKeys = useRef(new Map<string, string>());
  const [catalog, setCatalog] = useState<HostModelCatalog>();
  const [catalogLoading, setCatalogLoading] = useState(false);
  const draftDefaults = useRef<AgentDefaults>({});
  const draftConfigurationChanged = useRef(false);
  const [configuration, setConfiguration] = useState<MobileConfiguration>({
    harness: "codex",
    model: "",
    modelSettings: {},
    runtimeMode: "supervised",
  });
  const [draft] = useState(createMobileDraft);
  const setDraft = draft.set;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [readingAttachments, setReadingAttachments] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [followUpBehavior, setFollowUpBehavior] = useState(loadFollowUpBehavior);
  const [transcriptLayout, setTranscriptLayout] = useState(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] = useState(loadTranscriptAnchor);
  const [accentColor, setAccentColor] = useState(loadAccentColor);
  const [soundsEnabled, setSoundsEnabled] = useState(loadSoundsEnabled);
  const acceptedQueueAttachments = useRef<Attachment[]>([]);
  const parkedDrafts = useRef<Array<{
    text: string;
    attachments: Attachment[];
    planMode: boolean;
    accepted: Attachment[];
  }>>([]);
  const [composerPanel, setComposerPanel] = useState<MobileComposerPanel>(null);
  const [progressDock, setProgressDock] = useState<HTMLDivElement | null>(null);
  const [sessionActionsOpen, setSessionActionsOpen] = useState(false);
  const [homeActionSession, setHomeActionSession] = useState<HostSessionSummary>();
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [sessionActionsTarget, setSessionActionsTarget] = useState<string>();
  const [sessionActionsPoint, setSessionActionsPoint] = useState<MobileSheetPoint>();
  const [sessionStatusOpen, setSessionStatusOpen] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [addingConnection, setAddingConnection] = useState(false);
  const [preferencePanel, setPreferencePanel] =
    useState<MobilePreferencePanel>(null);
  const [busy, setBusy] = useState(false);
  // Pairing a new Host is gated separately so a slow or timed-out attempt on
  // the current Host never blocks adding another connection.
  const [pairing, setPairing] = useState(false);
  const [pairingError, setPairingError] = useState("");
  /** Each Host connection attempt bumps this; superseded attempts drop their results. */
  const hostAttempt = useRef(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [hostError, setHostError] = useState("");
  const [pollError, setPollError] = useState("");
  const [pending, setPending] = useState<PendingCommand>();
  const [foreground, setForeground] = useState(true);
  const hostStatus = useHostConnectionStatus(client, connected, foreground);
  const assistantUnreadCount = useMobileAssistantUnread(
    assistantHostId,
    assistantRpc,
    !assistantOpen && foreground &&
      connected && hostStatus.state === "connected" && client.hasCapability("assistant.v1"),
  );
  // Each paired address is its own connection, even when it reaches the same Host.
  const connectionKey = client.connection?.endpoint;
  const previousConnection = useRef(connectionKey);
  const hostScopeReady = previousConnection.current === connectionKey;
  useEffect(() => {
    if (!connected || hostStatus.state !== "connected" || !connectionKey) return;
    saveLastOnline(connectionKey);
    const timer = setInterval(() => saveLastOnline(connectionKey), 60_000);
    return () => clearInterval(timer);
  }, [connected, hostStatus.state, connectionKey]);
  const hostDrafts = useRef(new Map<string, {
    projectId: string; sessionId?: string; text: string; attachments: Attachment[];
    planMode: boolean; accepted: Attachment[]; parked: typeof parkedDrafts.current;
  }>());
  const nativeLink = snapshot?.session.nativeSession;
  const gitCwd = snapshot ? sessionWorkCwd(snapshot.session) : undefined;
  const gitSupported = client.hasCapability("git.index") && client.hasCapability("git.fileDiff");
  const gitSource = useMemo(() => hostScopeReady && snapshot?.session.id === sessionId && snapshot && gitCwd && gitSupported
    ? createMobileGitSource(client, snapshot.projectId, gitCwd) : undefined,
  [client.connection, hostScopeReady, sessionId, snapshot?.session.id, snapshot?.projectId, gitCwd, gitSupported]);
  const nativeAccessKey = nativeLink && snapshot.session.id === sessionId
    ? JSON.stringify([client.connection?.environmentId, client.connection?.endpoint,
        sessionId, nativeLink.provider, nativeSourceKey(nativeLink), nativeLink.accountId])
    : undefined;
  const checkNativeAccess = connected && foreground && !pageOverlayOpen && view === "chat";
  const nativeAccess = checkNativeAccess && nativeAccessResult?.key === nativeAccessKey
    ? nativeAccessResult?.value : undefined;
  useEffect(() => {
    setNativeAccessResult(undefined);
    if (!checkNativeAccess || !nativeAccessKey || !sessionId || !nativeLink) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const unavailable = (): NativeSessionAccess => ({
      state: "unknown", reason: "hostUnavailable", path: nativeLink.path, checkedAt: Date.now(),
    });
    const check = async () => {
      let value: NativeSessionAccess;
      try {
        const access = await client.nativeAccess(sessionId);
        value = access && access.path === nativeLink.path ? access : unavailable();
      } catch {
        value = unavailable();
      }
      if (!current) return;
      setNativeAccessResult({ key: nativeAccessKey, value });
      // One probe at a time: a slow response must not overwrite a newer owner.
      timer = setTimeout(check, 5_000);
    };
    void check();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [checkNativeAccess, nativeAccessKey]);
  const now = useNow(30_000, foreground && (drawerOpen || view === "home"));
  const [theme, setTheme] = useState(
    () => localStorage.getItem("monocode-mobile-theme") || "dark",
  );
  const [glass, setGlass] = useState<GlassSettings>(readGlassSettings);
  const navigation = useRef(0);
  const appRoot = useRef<HTMLDivElement>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const setAppRoot = useCallback((element: HTMLDivElement | null) => {
    appRoot.current = element;
    setOverlayHost(element);
  }, []);
  const header = useRef<HTMLElement>(null);
  const navigationReady = useRef(false);
  useEffect(() => { if (!loading) navigationReady.current = true; }, [loading]);
  const loadTiming = useRef<{ turn: number; id: string; start: number; cached: boolean }>(undefined);
  const queueView = useRef({ view, sessionId });
  const queueOverlayClose = useRef<(() => void) | undefined>(undefined);
  const transcriptOverlayClose = useRef<(() => void) | undefined>(undefined);
  const onTranscriptOverlayChange = useCallback((close?: () => void) => {
    transcriptOverlayClose.current = close;
    if (close) setComposerPanel(null);
  }, []);
  const onQueueOverlayChange = useCallback((close?: () => void) => {
    queueOverlayClose.current = close;
    if (close) setComposerPanel(null);
  }, []);
  queueView.current = { view, sessionId };
  const connectionTrigger = useRef<HTMLButtonElement>(null);
  const projectTrigger = useRef<HTMLButtonElement>(null);
  const sessionActionsTrigger = useRef<HTMLButtonElement>(null);
  const sessionStatusTrigger = useRef<HTMLButtonElement>(null);
  const projectGeneration = useRef(0);

  // A selected device owns the whole page, including the failure/loading state.
  // Run before paint: the client changes identity before verification can finish.
  useLayoutEffect(() => {
    if (previousConnection.current === connectionKey) return;
    const previous = previousConnection.current;
    previousConnection.current = connectionKey;
    if (previous && project && (draft.get() || attachments.length || parkedDrafts.current.length)) {
      hostDrafts.current.set(previous, { projectId: project.id, sessionId,
        text: draft.get(), attachments, planMode, accepted: acceptedQueueAttachments.current,
        parked: parkedDrafts.current });
    }
    navigation.current += 1;
    projectGeneration.current += 1;
    loadTiming.current = undefined;
    setProjects([]);
    setProjectListState("loading");
    setProject(undefined);
    setSessions([]);
    setSessionId(undefined);
    setSnapshot(undefined);
    setSessionConfirmed(false);
    setNativeAccessResult(undefined);
    setCatalog(undefined);
    setCatalogLoading(false);
    setHistoryLoading(false);
    setLoading(false);
    setDraft("");
    setAttachments([]);
    acceptedQueueAttachments.current = [];
    parkedDrafts.current = [];
    setPlanMode(false);
    setPending(undefined);
    setError("");
    setHostError("");
    setPollError("");
    setHomeProjectId(undefined);
    setAllProjectsPage(false);
    setSearchOpen(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setSessionActionsTarget(undefined);
    setHomeActionSession(undefined);
    setSessionStatusOpen(false);
    setAddingProject(false);
    setAssistantOpen(false);
    setNotesOpen(false);
    setPreferencePanel(null);
    setConnected(!!connectionKey && !client.connection?.disabled);
    setView(connectionKey ? "home" : "settings");
  }, [connectionKey]);

  useEffect(() => {
    if (!searchOpen || view !== "home") setSearchQuery("");
    if (view !== "home") setSearchOpen(false);
  }, [searchOpen, view]);

  useEffect(() => {
    const light =
      theme === "light" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: light)").matches);
    saveThemePreference(
      theme === "light" || theme === "system" ? theme : "dark",
    );
    const apply = (isLight: boolean) => {
      applyThemePreference(isLight ? "light" : "dark");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", isLight ? "#f7f7f7" : "#171717");
      if (Capacitor.isNativePlatform())
        void StatusBar.setStyle({
          style: isLight ? Style.Light : Style.Dark,
        }).catch(() => {});
    };
    apply(light);
    localStorage.setItem("monocode-mobile-theme", theme);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (theme === "system") apply(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyGlassSettings(glass);
    saveGlassSettings(glass);
  }, [glass]);

  useEffect(() => {
    let live = true;
    const attempt = ++hostAttempt.current;
    const current = () => live && hostAttempt.current === attempt;
    void (async () => {
      try {
        migrateConnectionSettings(await client.savedConnections().catch(() => []));
        const [restored, pending] = await Promise.all([client.restore(), client.pending()]);
        if (current()) setPending(pending);
        if (restored) {
          const items = await client.projects();
          if (current()) {
            setConnected(true);
            setProjects(items);
            setProjectListState("ready");
            setProject((current) => current ?? items[0]);
            setUrl((value) => value || client.connection!.endpoint);
            await restoreLocation(items);
          }
        }
      } catch (problem) {
        if (current()) {
          setHostError(message(problem));
          setUrl((value) => value || (client.connection?.endpoint ?? ""));
          if (client.connection && !client.connection.disabled) {
            setConnected(true);
            setView("home");
            setProjectListState("failed");
          }
        }
      } finally {
        if (current()) setLoading(false);
      }
    })();
    const onVisibility = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const listener = Capacitor.isNativePlatform()
      ? App.addListener("appStateChange", (state) =>
          setForeground(state.isActive),
        )
      : undefined;
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void listener?.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    if (!connected || hostStatus.state !== "connected" || !foreground || pageOverlayOpen || (view === "settings" && !drawerOpen)) return;
    let live = true;
    const turn = navigation.current;
    const hostId = client.connection?.endpoint;
    const current = () => live && navigation.current === turn && hostId === client.connection?.endpoint;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    setPollError("");
    const poll = async () => {
      let running = false;
      try {
        let listRunning = false;
        if (drawerOpen || view === "home") {
          const [items, history] = await Promise.all([
            client.projects(),
            drawerOpen && project ? client.sessions(project.id) : undefined,
          ]);
          if (current()) {
            setProjects(items);
            setProjectListState("ready");
            setProject((selected) => selected ?? items[0]);
            setHostError("");
            if (history) setSessions(history);
          }
          listRunning = !!history?.some((item) => item.status === "running");
        }
        if (view === "chat" && sessionId) {
          const result = await client.session(sessionId);
          if (current()) {
            setSnapshot((previous) =>
              previous &&
              previous.session.id === result.session.id &&
              previous.revision > result.revision
                ? previous
                : result,
            );
            setSessionConfirmed(true);
            setLoading(false);
          }
          running = result.status === "running";
        }
        if (!running && listRunning) running = true;
        if (current()) {
          failures = 0;
          setPollError("");
          const pending = await client.pending();
          if (current()) setPending(pending);
        }
      } catch (problem) {
        if (current()) {
          failures += 1;
          setPollError(message(problem));
          setProjectListState((state) => state === "ready" ? state : "failed");
        }
      }
      if (live)
        timer = setTimeout(
          poll,
          failures
            ? Math.min(30_000, 2000 * 2 ** failures)
            : running
              ? view === "chat" && sessionId && !drawerOpen
                ? 250
                : 750
              : 3000,
        );
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [
    connected,
    connectionKey,
    connectionRevision,
    hostStatus.state,
    foreground,
    pageOverlayOpen,
    view,
    drawerOpen,
    project,
    sessionId,
    snapshot?.status,
  ]);

  useLayoutEffect(() => {
    const timing = loadTiming.current;
    if (!snapshot || !timing || snapshot.session.id !== timing.id || navigation.current !== timing.turn)
      return;
    // Record committed text/layout without background-tab frame throttling.
    // Keep only the latest measure per path for local browser diagnostics.
    const name = timing.cached ? "monocode.mobile.session.cached" : "monocode.mobile.session.network";
    const end = performance.now();
    appRoot.current?.setAttribute("data-session-load-ms", (end - timing.start).toFixed(3));
    appRoot.current?.setAttribute("data-session-load-source", timing.cached ? "cache" : "network");
    appRoot.current?.setAttribute("data-session-load-stage", "commit");
    try {
      performance.clearMeasures(name);
      performance.measure(name, { start: timing.start, end });
    } catch { /* Timing support must not affect conversation rendering. */ }
    loadTiming.current = undefined;
  });

  useEffect(() => {
    if (!connected || !foreground || pageOverlayOpen || view !== "chat" || !snapshot) return;
    let live = true;
    void client.sessionPreviews(snapshot.session.id).then((result) => {
      if (live && result)
        setSnapshot((previous) =>
          previous?.session.id === result.session.id && previous.revision <= result.revision
            ? result : previous,
        );
    });
    return () => { live = false; };
  }, [connected, foreground, pageOverlayOpen, view, snapshot]);

  useEffect(() => {
    const environmentId = client.connection?.environmentId;
    if (!connected || !environmentId || !project || view !== "chat") return;
    saveLastLocation({
      environmentId,
      projectId: project.id,
      ...(sessionId ? { sessionId } : {}),
    });
  }, [connected, project?.id, sessionId, view]);

  const refreshSavedHosts = useCallback(() => {
    void client.savedConnections().then(setSavedHosts).catch(() => undefined);
  }, [client]);
  useEffect(refreshSavedHosts, [refreshSavedHosts, connectionKey, connectionRevision, connected]);
  const connect = async (credentials = { url, token }) => {
    if (pairing) return;
    setPairing(true);
    setPairingError("");
    try {
      await activateConnection(
        () => client.connect(credentials.url, normalizePairingCode(credentials.token)),
        (problem) => setPairingError(connectionErrorMessage(problem, credentials.url)),
        (host) => t("Connected to {service}", { service: host }),
      );
    } finally {
      setPairing(false);
    }
  };
  const switchHost = (endpoint: string, after?: (projects: HostProject[]) => void) => {
    // A newer switch supersedes one still loading, so a stalled Host never traps the picker.
    if (pairing) return;
    setHostPickerOpen(false);
    if (client.connection?.endpoint === endpoint && !client.connection.disabled) return;
    setDrawerOpen(false);
    void activateConnection(
      () => client.switchTo(endpoint),
      (problem) => setHostError(message(problem)),
      (host) => t("Switched to {host}", { host }),
      after,
    );
  };
  const activateConnection = async (
    open: () => Promise<void>,
    fail: (problem: unknown) => void,
    successNotice?: (host: string) => string,
    /** Continues navigation once the new Host's Home is ready. */
    after?: (projects: HostProject[]) => void,
  ) => {
    const attempt = ++hostAttempt.current;
    const current = () => hostAttempt.current === attempt;
    setBusy(true);
    setError("");
    setHostError("");
    setPollError("");
    // Connection progress and failures stay inline; only confirm a completed switch.
    try {
      await open();
      if (!current()) return;
      setLoading(false);
      const items = await client.projects();
      if (!current()) return;
      projectGeneration.current += 1;
      setProject(undefined);
      setSessionId(undefined);
      setSnapshot(undefined);
      setSessionConfirmed(false);
      setCatalog(undefined);
      setCatalogLoading(false);
      setAttachments([]);
      acceptedQueueAttachments.current = [];
      parkedDrafts.current = [];
      setPlanMode(false);
      setToken("");
      setUrl(client.connection!.endpoint);
      setProjects(items);
      setSessions([]);
      setProjectListState("ready");
      setConnected(true);
      setConnectionRevision((value) => value + 1);
      setAddingConnection(false);
      if (successNotice) showStatusToast(successNotice(client.connection?.name ?? ""), "success");
      const pending = await client.pending();
      if (!current()) return;
      setPending(pending);
      await restoreLocation(items);
      if (current()) after?.(items);
    } catch (problem) {
      if (current()) {
        fail(problem);
        setProjectListState((state) => state === "ready" ? state : "failed");
      }
    } finally {
      if (current()) setBusy(false);
      refreshSavedHosts();
    }
  };
  const openProject = async (
    item: HostProject,
    nextView: View = "chat",
  ): Promise<HostSessionSummary[] | undefined> => {
    const turn = ++navigation.current;
    const projectTurn = ++projectGeneration.current;
    setProject(item);
    setSessions(client.cachedSessions?.(item.id) ?? []);
    const defaults = loadMobileAgentDefaults(client.connection?.endpoint);
    draftDefaults.current = defaults;
    draftConfigurationChanged.current = false;
    const cachedCatalog = client.cachedModels(item.id);
    setCatalog(cachedCatalog);
    setCatalogLoading(!cachedCatalog);
    setConfiguration((cachedCatalog && firstConfiguration(cachedCatalog, defaults)) ?? {
      harness: "codex", model: "", modelSettings: {},
      runtimeMode: defaults.runtimeMode ?? DEFAULT_RUNTIME_MODE,
    });
    setSessionId(undefined);
    setChatPageKey(`draft:${item.id}:${turn}`);
    setSnapshot(undefined);
    setSessionConfirmed(false);
    setAnimateFrom(undefined);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setSessionStatusOpen(false);
    setView(nextView);
    setSessionEntrySource("other");
    setLoading(false);
    setHistoryLoading(true);
    setError("");
    // Provider discovery can launch CLIs; it is independent of history and
    // must never hold the conversation's first paint behind the slowest CLI.
    void client.models(item.id).then((catalog) => {
      if (projectGeneration.current !== projectTurn) return;
      setCatalog(catalog);
      const first = firstConfiguration(catalog, defaults);
      if (first && !draftConfigurationChanged.current) setConfiguration((current) => ({
        ...first, runtimeMode: current.runtimeMode,
      }));
    }).catch((problem) => {
      if (projectGeneration.current === projectTurn) setError(message(problem));
    }).finally(() => {
      if (projectGeneration.current === projectTurn) setCatalogLoading(false);
    });
    try {
      const history = await client.sessions(item.id);
      if (projectGeneration.current !== projectTurn) return;
      setSessions(history);
      return history;
    } catch (problem) {
      if (navigation.current === turn) setError(message(problem));
    } finally {
      if (projectGeneration.current === projectTurn) setHistoryLoading(false);
    }
  };
  // Launch opens Home. Remember the last project as the new-chat default.
  const restoreLocation = async (items: HostProject[]) => {
    const last = readLastLocation(client.connection?.environmentId);
    const target =
      items.find((item) => item.id === last?.projectId) ?? items[0];
    setView("home");
    setHomeProjectId(undefined);
    setAllProjectsPage(false);
    setSearchOpen(false);
    setSettingsPage("root");
    setProject(target);
    // Warm the likely next conversation's catalog while Home is already usable.
    // Navigation shares this in-flight request; failures are retried on entry.
    if (target) void client.models(target.id).catch(() => {});
  };
  const openSession = async (
    id?: string,
    restoredProjectId?: string,
    entrySource: "project" | "other" = "other",
  ) => {
    const start = performance.now();
    appRoot.current?.removeAttribute("data-session-load-ms");
    appRoot.current?.removeAttribute("data-session-load-source");
    const turn = ++navigation.current;
    if (id) draftConfigurationChanged.current = true;
    const known = id ? client.cachedSession(id) : undefined;
    const cached = known && (!restoredProjectId ||
      (known.projectId === restoredProjectId && !known.archived)) ? known : undefined;
    loadTiming.current = id ? { turn, id, start, cached: !!cached } : undefined;
    setSessionId(id);
    setChatPageKey((current) => id ?? (current.startsWith("draft:") ? current : `draft:${restoredProjectId ?? project?.id ?? ""}`));
    setSnapshot(cached);
    setSessionConfirmed(false);
    if (cached) setConfiguration(configurationForSession(cached));
    setAnimateFrom(undefined);
    const hostId = client.connection?.endpoint;
    const savedDraft = hostId ? hostDrafts.current.get(hostId) : undefined;
    const restoreDraft = savedDraft?.projectId === (restoredProjectId ?? project?.id) && savedDraft?.sessionId === id
      ? savedDraft : undefined;
    setDraft(restoreDraft?.text ?? "");
    setAttachments(restoreDraft?.attachments ?? []);
    acceptedQueueAttachments.current = restoreDraft?.accepted ?? [];
    parkedDrafts.current = restoreDraft?.parked ?? [];
    setPlanMode(restoreDraft?.planMode ?? false);
    if (restoreDraft && hostId) hostDrafts.current.delete(hostId);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setSessionStatusOpen(false);
    setDrawerOpen(false);
    setView("chat");
    setSessionEntrySource(entrySource);
    setLoading(!!id);
    setError("");
    if (!id) return;
    try {
      const result = await client.session(id);
      if (navigation.current === turn) {
        if (restoredProjectId && (result.projectId !== restoredProjectId || result.archived)) {
          const owner = projects.find((item) => item.id === restoredProjectId);
          if (owner) void openProject(owner);
          await openSession(undefined, undefined, entrySource);
          return;
        }
        setSnapshot((previous) => previous && previous.session.id === result.session.id &&
          previous.revision > result.revision ? previous : result);
        setSessionConfirmed(true);
        setConfiguration(configurationForSession(result));
      }
    } catch (problem) {
      if (navigation.current === turn) setError(message(problem));
    } finally {
      if (navigation.current === turn) setLoading(false);
    }
  };
  const activity = useMobileActivity(client, {
    connected,
    foreground,
    assistantVisible: assistantOpen && !notesOpen,
    visibleSession: view === "chat" && !pageOverlayOpen && !drawerOpen && !loading && sessionConfirmed && snapshot && snapshot.session.id === sessionId
      ? { id: snapshot.session.id, projectId: snapshot.projectId, revision: snapshot.revision,
          lastCompletedRunId: snapshot.lastCompletedRunId, pendingInputKey: pendingSessionInputKey(snapshot.session, snapshot.runId) }
      : undefined,
    language,
    onOpen: async (target) => {
      if (target.kind === "assistant") {
        setNotesOpen(false);
        onDrawerAssistant();
        return;
      }
      const openedAt = navigation.current;
      try {
        const items = await client.projects();
        const owningProject = items.find((item) => item.id === target.projectId);
        if (!owningProject || client.connection?.environmentId !== target.environmentId || navigation.current !== openedAt) return;
        setProjects(items);
        const projectNavigation = navigation.current + 1;
        await openProject(owningProject);
        if (navigation.current !== projectNavigation) return;
        await openSession(target.sessionId);
      } catch (problem) { setError(message(problem)); }
    },
  });
  const dispatch = useCallback(
    async (command?: HostCommand, text?: string | MobileFirstMessage) => {
      const startedAt = navigation.current;
      const startedPage = chatPageIdentity.current;
      setBusy(true);
      setError("");
      try {
        const completedCommand = command ?? (await client.pending())?.command;
        const receipt = command
          ? await client.dispatch(command, text)
          : await client.retryPending();
        setPending(undefined);
        // A recovered create/send can belong to a different project than the
        // currently visible one. Navigate to its actual owning project.
        const result = await client.session(receipt.sessionId, receipt.revision);
        const sending = sendingRef.current;
        if (completedCommand?.type === "create" && sending?.commandId === completedCommand.commandId)
          transcriptKeys.current.set(receipt.sessionId, sending.commandId);
        if (
          completedCommand?.type === "send" ||
          completedCommand?.type === "create"
        ) {
          setAnimateFrom(
            [...result.session.blocks]
              .reverse()
              .find((block) => block.role === "user")?.id,
          );
        }
        const owner = projects.find((item) => item.id === result.projectId);
        if (owner) {
          const changedProject = owner.id !== project?.id;
          setProject(owner);
          if (changedProject) {
            const projectTurn = ++projectGeneration.current;
            setCatalog(undefined);
            setCatalogLoading(true);
            try {
              const nextCatalog = await client.models(owner.id);
              if (projectGeneration.current === projectTurn) setCatalog(nextCatalog);
            } finally {
              if (projectGeneration.current === projectTurn) setCatalogLoading(false);
            }
          }
        }
        setSessionId(receipt.sessionId);
        const samePage = navigation.current === startedAt && chatPageIdentity.current === startedPage;
        if (!(samePage && queueView.current.view === "chat" &&
          (queueView.current.sessionId === receipt.sessionId ||
            (completedCommand?.type === "create" && !queueView.current.sessionId && project?.id === result.projectId))))
          setChatPageKey(receipt.sessionId);
        setSnapshot(result);
        setSessionConfirmed(true);
        setConfiguration(configurationForSession(result));
        setView("chat");
        if (
          (completedCommand?.type === "send" && !completedCommand.questionAnswer) ||
          completedCommand?.type === "create"
        ) {
          const previousDraft = parkedDrafts.current.pop();
          setDraft(previousDraft?.text ?? "");
          setAttachments(previousDraft?.attachments ?? []);
          acceptedQueueAttachments.current = previousDraft?.accepted ?? [];
          if (previousDraft) setPlanMode(previousDraft.planMode);
        }
        return receipt;
      } catch (problem) {
        setError(message(problem));
        setPending(await client.pending());
      } finally {
        setBusy(false);
      }
    },
    [projects, project?.id],
  );
  const queueRequest = useCallback(
    async (
      command: Extract<HostCommand, { type: "queue" }>,
      transient: boolean,
    ) => {
      const generation = navigation.current;
      if (!transient) {
        setBusy(true);
        setError("");
      }
      try {
        const receipt = transient
          ? await client.rpc<
              import("../features/connections/model/protocol").CommandReceipt
            >("commands.dispatch", command)
          : await client.dispatch(command);
        const result = await client.session(command.sessionId, receipt.revision);
        if (navigation.current === generation && queueView.current.view === "chat" && queueView.current.sessionId === command.sessionId) {
          setSnapshot((current) =>
            current &&
            current.session.id === result.session.id &&
            current.revision > result.revision
              ? current
              : result,
          );

        }
        if (!transient) setPending(undefined);
        return receipt;
      } catch (problem) {
        if (navigation.current === generation && queueView.current.view === "chat" && queueView.current.sessionId === command.sessionId) {
          setError(message(problem));

        }
        if (!transient) setPending(await client.pending());
        throw problem;
      } finally {
        if (!transient) setBusy(false);
      }
    },
    [],
  );
  // Messages on their way show where the Host will record them.
  const hostView = useMemo(() => {
    const message = sendingMessage;
    if (!snapshot)
      return message && !message.sessionId && project?.id === message.placeholder?.projectId
        ? message.placeholder
        : undefined;
    return withOutgoing(snapshot, message?.sessionId === snapshot.session.id ? message.outgoing : undefined);
  }, [sendingMessage, snapshot, project?.id]);
  const queue = useHostQueue(snapshot && hostView, queueRequest);
  const restoreQueuedMessage = useStableCallback(async (queued: QueuedMessage) => {
    if (!sessionId) return;
    const generation = navigation.current;
    setReadingAttachments(true);
    try {
      await takeBackQueuedMessage(queued, {
        read: (id, offset) =>
          client.rpc("attachments.read", { sessionId, id, offset }),
        remove: queue.onDelete,
        current: () => generation === navigation.current,
        pendingRemoval: async (id) => {
          const removal = (await client.pending())?.command;
          return removal?.type === "queue" &&
            removal.action === "remove" && removal.messageId === id;
        },
        restore: (restored) => {
          if (generation !== navigation.current) return;
          const text = draft.get();
          if (text.trim() || attachments.length) {
            parkedDrafts.current.push({
              text, attachments, planMode,
              accepted: acceptedQueueAttachments.current,
            });
          }
          acceptedQueueAttachments.current = queued.attachments;
          setDraft(queued.text);
          setAttachments(restored);
          setPlanMode(queued.intent === "plan");
          setComposerPanel(null);
          requestAnimationFrame(() => {
            if (generation === navigation.current)
              appRoot.current?.querySelector<HTMLTextAreaElement>('[data-page-active="true"] .mobile-composer textarea')?.focus();
          });
        },
      });
    } finally {
      setReadingAttachments(false);
    }
  });
  const send = async () => {
    const text = draft.get();
    if (
      !project ||
      (!text.trim() && !attachments.length) ||
      busy ||
      pending ||
      readingAttachments ||
      (!!sessionId && !sessionConfirmed) ||
      nativeWriteBlocked(snapshot, nativeAccess) ||
      (snapshot?.status === "running" && !snapshot.supportsQueue)
    )
      return;
    if (isCompactCommand(text)) {
      if (attachments.length) {
        setError(t("Remove attachments before compacting context."));
        return;
      }
      if (!snapshot || snapshot.status !== "idle" || !["codex", "claude", "grok", "opencode", "pi", "omp"].includes(snapshot.session.harness)) {
        setError(t("Context compaction is unavailable for this conversation."));
        return;
      }
      const generation = navigation.current;
      const receipt = await dispatch({ type: "compact", sessionId: snapshot.session.id, commandId: crypto.randomUUID() });
      if (receipt && navigation.current === generation) setDraft("");
      return;
    }
    const parsed = consumePlanCommand(text);
    if (parsed.planning && !parsed.text.trim() && !attachments.length) {
      setPlanMode(true);
      setDraft("");
      return;
    }
    if (
      !sessionId &&
      !catalog?.models[configuration.harness]?.some(
        (item) => item.id === configuration.model,
      )
    ) {
      setError(
        t(
          "No available model. Install and sign in to a provider on this Host.",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    const generation = navigation.current;
    const commandId = crypto.randomUUID();
    const sent = { text, attachments };
    // Show the message at once where the Host will record it: in the
    // transcript, or in the queue of a conversation that is busy.
    const instant = sessionId
      ? !!snapshot && snapshot.session.id === sessionId
      : !snapshot;
    if (instant) {
      const outgoing: OutgoingMessage = {
        id: commandId,
        text: parsed.text,
        startedAt: Date.now(),
        placement: sessionId ? outgoingPlacement(snapshot, followUpBehavior) : "transcript",
        ...(attachments.length ? { attachments } : {}),
      };
      const block: Block = {
        id: commandId,
        role: "user",
        text: parsed.text,
        startedAt: outgoing.startedAt,
        sending: true,
        ...(attachments.length ? { attachments } : {}),
      };
      setSendingMessage({
        commandId,
        sessionId,
        outgoing,
        ...(sessionId ? {} : {
          placeholder: {
            session: {
              id: block.id,
              harness: configuration.harness,
              model: configuration.model,
              modelSettings: configuration.modelSettings,
              runtimeMode: configuration.runtimeMode,
              title: "",
              cwd: project.cwd,
              blocks: [block],
            },
            projectId: project.id,
            revision: 0,
            status: "idle",
            updatedAt: Date.now(),
          },
        }),
      });
      if (!sessionId) setAnimateFrom(block.id);
      setDraft("");
      setAttachments([]);
    }
    let recorded = false;
    try {
      const hostId = client.connection?.endpoint;
      const providerAccountId = !sessionId
        ? defaultProviderAccount(configuration.harness, draftDefaults.current)
        : undefined;
      if (providerAccountId) {
        const accounts = await client.providerAccounts();
        if (!accounts) throw new Error(t("Provider accounts are unavailable on this Host."));
        if (!accounts[configuration.harness]?.some((account) => account.id === providerAccountId))
          throw new Error(t("This provider account is no longer available. Choose an account in Settings and start a new conversation."));
      }
      if (generation !== navigation.current || hostId !== client.connection?.endpoint) return;
      const uploaded = await client.uploadAttachments(attachments, acceptedQueueAttachments.current);
      if (generation !== navigation.current || hostId !== client.connection?.endpoint) return;
      const prompt: MobileFirstMessage = {
        text: parsed.text,
        ...(uploaded.length ? { attachments: uploaded } : {}),
        ...(planMode || parsed.planning ? { intent: "plan" } : {}),
      };
      if (sessionId) {
        recorded = !!await dispatch({
          ...prompt,
          type: "send",
          commandId,
          sessionId,
          followUpBehavior,
        });
      } else {
        recorded = !!await dispatch(
          {
            type: "create",
            commandId,
            projectId: project.id,
            harness: configuration.harness,
            model: configuration.model,
            modelSettings: configuration.modelSettings,
            ...(providerAccountId ? { providerAccountId } : {}),
            runtimeMode: configuration.runtimeMode,
          },
          prompt,
        );
      }
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
      if (instant) {
        setSendingMessage(undefined);
        // Nothing was recorded: the message goes back to the composer.
        if (!recorded && navigation.current === generation && !draft.get()) {
          setDraft(sent.text);
          setAttachments(sent.attachments);
        }
      }
    }
  };
  const addFiles = async (files: File[]) => {
    if (busy || pending || readingAttachments) return;
    const generation = navigation.current;
    setReadingAttachments(true);
    setError("");
    try {
      const added = await readMobileAttachments(files, attachments.length);
      if (generation === navigation.current)
        setAttachments((current) => [...current, ...added]);
    } catch (problem) {
      if (generation === navigation.current) setError(message(problem));
    } finally {
      setReadingAttachments(false);
    }
  };
  const addProject = async (path: string) => {
    setBusy(true);
    setError("");
    try {
      const added = await withStatusToast(async () => {
        const added = await client.openProject(path);
        setProjects(await client.projects());
        return added;
      }, { loading: t("Adding project…"), success: t("Project added"), error: false });
      setAddingProject(false);
      setDrawerOpen(false);
      openHome(added);
    } finally {
      setBusy(false);
    }
  };
  const changeSettingsPage = useStableCallback((next: MobileSettingsPage) => {
    setPreferencePanel(null);
    setAboutOpen(false);
    setSettingsPage(next);
  });
  const navigate = (next: View) => {
    setHomeMenuOpen(false);
    setAboutOpen(false);
    if (next === "settings" && view !== "settings") settingsReturnView.current = view;
    navigation.current += 1;
    setLoading(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setSessionStatusOpen(false);
    setAddingConnection(false);
    setAddingProject(false);
    setPreferencePanel(null);
    setDrawerOpen(false);
    setSettingsPage("root");
    setView(next);
  };
  const openHome = (owner?: HostProject, allProjects = false) => {
    setHomeProjectId(owner?.id);
    setAllProjectsPage(allProjects);
    setSearchOpen(false);
    navigate("home");
    if (owner) void client.models(owner.id).catch(() => {});
  };
  const updateSessionMetadata = async (
    patch: MobileSessionPatch,
    id = sessionId,
    ownerId = project?.id,
  ) => {
    if (!ownerId || !id) return;
    const turn = navigation.current;
    setBusy(true);
    try {
      const notice = sessionPatchNotice(patch);
      const summary = notice
        ? await withStatusToast(() => client.updateSession(ownerId, id, patch), {
            loading: t(notice.loading),
            success: t(notice.success),
            error: false,
          })
        : await client.updateSession(ownerId, id, patch);
      const result = view === "chat" && id === sessionId ? await client.session(id, summary.revision) : undefined;
      if (navigation.current === turn) {
        setHomeRefreshKey((value) => value + 1);
        setHomeActionSession((current) => current?.id === id ? summary : current);
        if (result) {
          setSnapshot((previous) =>
            previous && previous.revision > result.revision ? previous : result,
          );
        }
        setSessions((items) =>
          items.map((item) => (item.id === id ? summary : item)),
        );
      }
    } finally {
      setBusy(false);
    }
  };
  const deleteCurrentSession = async () => {
    if (!project || !sessionId) return;
    const turn = navigation.current;
    const id = sessionId;
    setBusy(true);
    try {
      await withStatusToast(() => client.deleteSession(project.id, id), {
        loading: t("Deleting conversation…"),
        success: t("Conversation deleted"),
        error: false,
      });
      if (navigation.current === turn) {
        navigate("chat");
        setSessions((items) => items.filter((item) => item.id !== id));
        setSessionId(undefined);
        setSnapshot(undefined);
        setDraft("");
        setAttachments([]);
        void openProject(project);
      }
    } finally {
      setBusy(false);
    }
  };
  const disconnectConnection = async (remove: boolean) => {
    navigation.current += 1;
    projectGeneration.current += 1;
    setBusy(true);
    const endpoint = client.connection?.endpoint;
    try {
      await withStatusToast(() => (remove ? client.disconnect() : client.suspend()), {
        loading: t(remove ? "Removing connection…" : "Disconnecting…"),
        success: t(remove ? "Connection removed" : "Machine disconnected"),
        error: false,
      });
      setConnected(false);
      setProjects([]);
      setProject(undefined);
      setSessions([]);
      setSnapshot(undefined);
      setSessionConfirmed(false);
      setHistoryLoading(false);
      setSessionId(undefined);
      setError("");
      setHostError("");
      setPollError("");
      if (remove && endpoint) removeConnectionAppearance(endpoint);
    } catch (problem) {
      setError(message(problem));
      throw problem;
    } finally { setBusy(false); refreshSavedHosts(); }
    // Deleting the active Host falls back to another paired one.
    const next = remove ? (await client.savedConnections())[0] : undefined;
    if (next)
      await activateConnection(() => client.switchTo(next.endpoint), (problem) => setHostError(message(problem)));
  };
  /** `manual` confirms a tapped reconnect; automatic recovery stays silent. */
  const reconnect = async (manual = false) => {
    const attempt = ++hostAttempt.current;
    const hostId = client.connection?.endpoint;
    const current = () => hostAttempt.current === attempt && client.connection?.endpoint === hostId;
    setBusy(true);
    try {
      await client.reconnect();
      if (!current()) return;
      setConnectionRevision((value) => value + 1);
      setHomeRefreshKey((value) => value + 1);
      setPreferencePanel(null);
      const items = await client.projects();
      if (!current()) return;
      setProjects(items);
      setProjectListState("ready");
      setConnected(true);
      if (manual) showStatusToast(t("Reconnected"), "success");
      if (!connected) await restoreLocation(items);
      setError("");
      setHostError("");
      setPollError("");
    } catch (problem) {
      if (current()) setHostError(message(problem));
    } finally {
      if (current()) setBusy(false);
    }
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (dismissImageLightbox()) return;
      if (hostPickerOpen) setHostPickerOpen(false);
      else if (notesOpen) {
        if (notesPage.current) notesPage.current.back();
        else setNotesOpen(false);
      }
      else if (assistantOpen) {
        if (assistantPage.current) assistantPage.current.back();
        else setAssistantOpen(false);
      }
      else if (queueOverlayClose.current) queueOverlayClose.current();
      else if (sessionStatusOpen) setSessionStatusOpen(false);
      else if (sessionActionsOpen) {
        if (!busy) setSessionActionsOpen(false);
      } else if (preferencePanel) setPreferencePanel(null);
      else if (addingConnection) {
        if (!pairing) setAddingConnection(false);
      } else if (composerPanel) setComposerPanel(null);
      else if (addingProject) {
        if (!busy) setAddingProject(false);
      } else if (drawerOpen) setDrawerOpen(false);
      else if (transcriptOverlayClose.current) transcriptOverlayClose.current();
      else if (homeMenuOpen) setHomeMenuOpen(false);
      else if (view === "home" && searchOpen) setSearchOpen(false);
      else if (view === "settings" && settingsPage !== "root")
        changeSettingsPage(mobileSettingsParent(settingsPage));
      else if (view === "settings" && client.connection) navigate(settingsReturnView.current);
      else if (view === "chat") openHome(project);
      else if (view === "home" && homeProjectId) openHome();
      else void App.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [
    assistantOpen,
    notesOpen,
    view,
    connected,
    addingConnection,
    addingProject,
    composerPanel,
    preferencePanel,
    sessionActionsOpen,
    sessionStatusOpen,
    drawerOpen,
    hostPickerOpen,
    settingsPage,
    changeSettingsPage,
    busy,
    pairing,
    homeProjectId,
    searchOpen,
    homeMenuOpen,
    project,
  ]);

  const running = snapshot?.status === "running";
  // Home and drawer rows can belong to another project, so they carry their
  // own summary; the current project's rows stay live through `sessions`.
  const sessionActionsSummary = view === "home" ? homeActionSession : sessions.find(
    (item) => item.id === sessionActionsTarget,
  ) ?? (homeActionSession?.id === sessionActionsTarget ? homeActionSession : undefined);
  const nativeReadOnly = nativeWriteBlocked(snapshot, nativeAccess);
  const skillHarness = snapshot?.session.pendingConfiguration?.harness ?? snapshot?.session.harness ?? configuration.harness;
  const skillContextKey = `${client.connection?.endpoint ?? ""}\0${project?.id ?? ""}\0${skillHarness}\0${sessionId ?? ""}\0${snapshot?.session.worktreeCwd || snapshot?.session.cwd || project?.cwd || ""}`;
  const loadSkillCatalog = useCallback((refresh = false) => {
    if (!project) return Promise.reject(new Error("Open a project first."));
    return client.skills(project.id, skillHarness, sessionId, refresh);
  }, [project?.id, skillHarness, sessionId]);
  const contextRing = loading
    ? null
    : contextRatio(mobileContextUsage(snapshot?.session, catalog));
  // Controls float above scrolling content; Home uses a plain title menu.
  const floatingHeader = true;
  const homeProject = projects.find((item) => item.id === homeProjectId);
  const route: MobileRoute = {
    key: view === "settings" ? `settings:${settingsPage}` : view === "chat" ? `chat:${chatPageKey}`
      : `home:${homeProjectId ?? (allProjectsPage ? "all" : "root")}`,
    section: view,
    // Home depths are 0–2; chat is always above every list page.
    depth: view === "settings" ? (settingsPage === "root" ? 0 : 1)
      : view === "home" ? (homeProjectId ? 2 : allProjectsPage ? 1 : 0) : 3,
  };
  useMobileHeaderMotion(header, route, navigationReady.current);
  const title =
    view === "chat"
      ? (snapshot &&
          sessionDisplayTitle(
            snapshot.session.title,
            snapshot.session.harness,
          )) ||
        t("New conversation")
      : view === "home"
        ? homeProject?.name || (allProjectsPage ? t("Projects") : "MonoCode")
        : t(mobileSettingsTitle(settingsPage));
  // Memoized children keep their handlers across shell updates.
  const onTranscriptCommand = useStableCallback(async (command: HostCommand) =>
    !!(await dispatch(command)),
  );
  // A pending question's panel can be folded away to read the conversation or
  // to type into the composer; its card in the transcript brings it back.
  const pendingQuestion = snapshot?.session.pendingQuestion;
  const pendingQuestionKey = pendingQuestion
    ? `${snapshot!.session.id}:${pendingQuestion.requestId}`
    : undefined;
  const [collapsedQuestion, setCollapsedQuestion] = useState<string>();
  const questionOpen = !!pendingQuestionKey && collapsedQuestion !== pendingQuestionKey;
  const onQuestionOpenChange = useStableCallback((open: boolean) => {
    setCollapsedQuestion(open ? undefined : pendingQuestionKey);
    const focused = document.activeElement;
    if (open && focused instanceof HTMLElement && focused.closest(".mobile-composer-dock"))
      focused.blur();
  });
  // A finished plan asks to be implemented from the composer's place. Typing
  // in the composer folds the panel away; leaving it empty brings it back.
  const planDecisionId = usePlanDecision(
    snapshot?.session.blocks,
    !!snapshot && snapshot.status !== "running" && !pendingQuestion && !nativeReadOnly,
  );
  const [collapsedPlan, setCollapsedPlan] = useState<string>();
  const planDecisionOpen = !!planDecisionId && collapsedPlan !== planDecisionId;
  useEffect(() => {
    if (!collapsedPlan) return;
    const reopen = (event: FocusEvent) => {
      if (draft.get().trim()) return;
      const next = event.relatedTarget;
      if (next instanceof Element && next.closest(".mobile-composer-dock")) return;
      setCollapsedPlan(undefined);
    };
    document.addEventListener("focusout", reopen);
    return () => document.removeEventListener("focusout", reopen);
  }, [collapsedPlan, draft]);
  const sendPlanTurn = useStableCallback((text: string, intent?: "plan") => {
    if (!snapshot || busy || pending || !sessionConfirmed) return false;
    // Implementing leaves plan mode; a revision keeps planning.
    setPlanMode(intent === "plan");
    void dispatch({ type: "send", commandId: crypto.randomUUID(),
      sessionId: snapshot.session.id, text, ...(intent ? { intent } : {}) });
  });
  const planDecision = useMemo(() => planDecisionId ? {
    blockId: planDecisionId,
    open: planDecisionOpen,
    onImplement: () => sendPlanTurn(IMPLEMENT_PLAN_PROMPT),
    onRevise: (feedback: string) => sendPlanTurn(feedback, "plan"),
    onSkip: () => skipPlanDecision(planDecisionId),
  } : undefined, [planDecisionId, planDecisionOpen, sendPlanTurn]);
  const onDrawerOpenChange = useStableCallback((open: boolean) => {
    if (open) setHomeMenuOpen(false);
    if (open) setComposerPanel(null);
    setDrawerOpen(open);
  });
  const onDrawerHost = useStableCallback(() => {
    refreshSavedHosts();
    setHostPickerOpen(true);
  });
  const probeHost = useCallback((connection: Connection) => client.probeConnection(connection), []);
  // Settings rows carry no credentials; probe the saved connection with the same address.
  const probeSavedHost = useCallback((connection: { endpoint: string }) => {
    const saved = savedHosts.find((item) => item.endpoint === connection.endpoint);
    return saved ? client.probeConnection(saved) : Promise.resolve<HostConnectionStatus>({ state: "disconnected" });
  }, [savedHosts]);
  const pairedConnections = client.connection
    ? [client.connection, ...savedHosts.filter((item) => item.endpoint !== connectionKey)]
    : savedHosts;
  // Device chips keep their paired order instead of moving the active device first.
  const deviceConnections = client.connection && savedHosts.some((item) => item.endpoint === connectionKey)
    ? savedHosts.map((item) => item.endpoint === connectionKey ? client.connection! : item)
    : pairedConnections;
  const homeOverview = view === "home" && !homeProject && !allProjectsPage;
  const remoteHosts = useMobileHostDirectory(client, pairedConnections, connectionKey,
    homeScope === "all" && homeOverview && connected && foreground && !pageOverlayOpen);
  const onRemoteSession = useStableCallback((endpoint: string, id: string, owner: HostProject) =>
    switchHost(endpoint, (items) => {
      const target = items.find((item) => item.id === owner.id);
      if (!target) return;
      void openProject(target);
      void openSession(id, target.id);
    }));
  const onRemoteProject = useStableCallback((endpoint: string, owner: HostProject) =>
    switchHost(endpoint, (items) => {
      const target = items.find((item) => item.id === owner.id);
      if (target) openHome(target);
    }));
  const forgetConnection = async (endpoint: string) => {
    if (endpoint === client.connection?.endpoint) return disconnectConnection(true);
    try {
      await withStatusToast(() => client.forget(endpoint), {
        loading: t("Removing connection…"),
        success: t("Connection removed"),
        error: false,
      });
      removeConnectionAppearance(endpoint);
    } finally {
      refreshSavedHosts();
    }
  };
  const onDrawerLoadSessions = useStableCallback((projectId: string) =>
    client.sessions(projectId),
  );
  const onCachedSessions = useStableCallback((projectId: string) =>
    client.cachedSessions?.(projectId),
  );
  // A conversation in another project opens that project with it, like a
  // restored location: history loads for the drawer while the chat opens.
  const onDrawerSession = useStableCallback((id: string, owner: HostProject) => {
    void openProject(owner);
    void openSession(id, owner.id);
  });
  const onDrawerNewSession = useStableCallback((owner: HostProject) => {
    void openProject(owner);
    void openSession();
  });
  const onDrawerHome = useStableCallback(() => openHome());
  const onDrawerAllProjects = useStableCallback(() => openHome(undefined, true));
  const onDrawerProject = useStableCallback((owner: HostProject) => openHome(owner));
  const onDrawerSessionActions = useStableCallback(
    (id: string, trigger: HTMLButtonElement, point?: MobileSheetPoint) => {
      sessionActionsTrigger.current = trigger;
      setSessionActionsTarget(id);
      setSessionActionsPoint(point);
      setSessionActionsOpen(true);
    },
  );
  const onDrawerSummaryActions = useStableCallback(
    (summary: HostSessionSummary, trigger: HTMLButtonElement, point?: MobileSheetPoint) => {
      setHomeActionSession(summary);
      onDrawerSessionActions(summary.id, trigger, point);
    },
  );
  const onDrawerSettings = useStableCallback(() => navigate("settings"));
  const onDrawerAssistant = useStableCallback(() => {
    setDrawerOpen(false);
    setComposerPanel(null);
    setSessionStatusOpen(false);
    setSessionActionsOpen(false);
    setAssistantOpen(true);
  });
  const onDrawerNotes = useStableCallback(() => {
    setDrawerOpen(false);
    setComposerPanel(null);
    setSessionStatusOpen(false);
    setSessionActionsOpen(false);
    setNotesOpen(true);
  });
  const onNoteAddToChat = useStableCallback(async (note: Note) => {
    const hostId = client.connection?.endpoint;
    const current = () => hostId && client.connection?.endpoint === hostId;
    if (view !== "chat" || !project) {
      const owner = (note.sourceCwd && noteSourceProject(note.sourceCwd)
        ? projects.find((item) => item.cwd === note.sourceCwd) ?? await client.openProject(note.sourceCwd)
        : project ?? projects[0]);
      if (!current()) throw new Error(t("Host connection changed."));
      if (!owner) throw new Error(t("Choose a project before adding a note to chat."));
      await openProject(owner);
      if (!current()) throw new Error(t("Host connection changed."));
      await openSession();
      setProjects(await client.projects());
    }
    if (!current()) throw new Error(t("Host connection changed."));
    setDraft(appendNoteReference(draft.get(), note.title, note.body));
    setNotesOpen(false);
  });
  const openAddProject = (trigger: HTMLButtonElement) => {
    projectTrigger.current = trigger;
    setError("");
    setAddingProject(true);
  };
  const toggleHomeSearch = () => {
    setHomeMenuOpen(false);
    setSearchOpen((open) => !open);
  };
  const interceptSearchOutside = (event: MouseEvent, close: boolean) => {
    if (
      view !== "home" || !searchOpen ||
      (event.target instanceof Element && event.target.closest(".mobile-header-search"))
    ) return;
    event.preventDefault();
    event.stopPropagation();
    // Keep search open through pointerdown so its matching click is consumed
    // before any underlying row or toolbar action can run.
    if (close) setSearchOpen(false);
  };
  const projectsUnavailable = projectListState === "failed" || hostStatus.state === "failed" || hostStatus.state === "disconnected";
  const projectsPending = projectListState === "loading" && !projectsUnavailable;
  // An unreachable device keeps Home's device row with a centered retry state.
  const homeUnavailable = view === "home" && !homeProject && !allProjectsPage && !!client.connection &&
    !(hostScopeReady && projects.length) && (projectsUnavailable || projectsPending);
  return (
    <MobileOverlayHostContext.Provider value={overlayHost}>
    <div
      ref={setAppRoot}
      className="mobile-app"
      data-view={view}
      onPointerDownCapture={(event) => interceptSearchOutside(event, false)}
      onClickCapture={(event) => interceptSearchOutside(event, true)}
      onContextMenuCapture={(event) => interceptSearchOutside(event, true)}
    >
      <MobilePageOverlay key={`assistant:${client.connection?.endpoint}`} open={assistantOpen && !!client.connection}>
      {client.connection && (
        <MobileAssistant
          ref={assistantPage}
          key={client.connection.endpoint}
          hostKey={client.connection.environmentId}
          hostName={connectionName}
          rpc={assistantRpc}
          foreground={foreground}
          onClose={() => setAssistantOpen(false)}
          onOpen={async ref => {
            const target = await resolveAssistantTarget(client.connection!.environmentId, ref, assistantRpc);
            if (target.session.session.orchestrationLeadId) throw new Error("Open orchestration worker details on desktop");
            await openSession(ref.sessionId, ref.projectId);
            setAssistantOpen(false);
          }}
        />
      )}
      </MobilePageOverlay>
      <MobilePageOverlay key={`notes:${client.connection?.endpoint}`} open={notesOpen && !!client.connection}>
        {client.connection && <MobileNotes ref={notesPage} client={client} hostKey={client.connection.endpoint} hostName={connectionName}
          projects={projects} onClose={() => setNotesOpen(false)} onAddToChat={onNoteAddToChat} />}
      </MobilePageOverlay>
      <SurfaceVisibilityContext.Provider value={!pageOverlayOpen}>
      <div className="mobile-assistant-background" inert={pageOverlayOpen} aria-hidden={pageOverlayOpen || undefined}>
      <header ref={header} className="mobile-header" data-floating={floatingHeader} data-project={view === "home" && !!homeProject} data-search={view === "home" && searchOpen} inert={drawerOpen || pageOverlayOpen || hostPickerOpen}>
        {view === "chat" && sessionEntrySource === "project" ? (
          <IconButton label="Back" onClick={() => openHome(projects.find((item) => item.id === project?.id))}>
            <ArrowLeft size={22} />
          </IconButton>
        ) : view === "chat" || (view === "home" && !homeProject) ? (
          <IconButton
            label="Menu"
            inactive={view === "home" && searchOpen}
            onClick={() => {
              setComposerPanel(null);
              setHomeMenuOpen(false);
              setDrawerOpen(true);
            }}
          >
            <PanelLeft size={22} />
          </IconButton>
        ) : view === "home" ? (
          <IconButton label="Back" inactive={searchOpen} onClick={() => openHome()}>
            <ArrowLeft size={22} />
          </IconButton>
        ) : client.connection || settingsPage !== "root" ? (
          <IconButton
            label="Back"
            onClick={() =>
              settingsPage !== "root"
                ? changeSettingsPage(mobileSettingsParent(settingsPage))
                : navigate(settingsReturnView.current)
            }
          >
            <ArrowLeft size={22} />
          </IconButton>
        ) : (
          <span className="mobile-header-logo">
            <img className="mobile-logo" src="/monocode.png" alt="MonoCode" />
          </span>
        )}
        {view === "home" ? homeProject ? (
          <div
            className="mobile-header-title"
            data-capsule="false"
            inert={searchOpen}
            aria-hidden={searchOpen || undefined}
          >
            <span className="mobile-project-header-text">
              <span className="mobile-project-header-name">
                <strong>{title}</strong>
              </span>
              <span className="mobile-header-host">
                <Computer size={12} aria-hidden="true" />
                <span className="mobile-project-header-host-name">{connectionName}</span>
                <MobileHostStatus status={hostStatus} dotOnly />
              </span>
            </span>
          </div>
        ) : (
          <button
            ref={homeMenuTrigger}
            type="button"
            className="mobile-header-title"
            data-capsule="false"
            inert={searchOpen}
            aria-hidden={searchOpen || undefined}
            aria-label={t("Projects")}
            aria-haspopup="dialog"
            aria-expanded={homeMenuOpen}
            onClick={() => setHomeMenuOpen((open) => !open)}
          >
            <strong>{title}</strong>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ) : <div className="mobile-header-title" data-capsule={view === "settings" ? false : floatingHeader}>
          <strong>{view === "settings" && settingsPage === "root" ? "MonoCode" : title}</strong>
          {view === "chat" ? (
            <div className="mobile-header-context">
              {project?.name && (
                <span className="mobile-header-context-item">
                  <Folder size={12} aria-hidden="true" />
                  <span>{project.name}</span>
                </span>
              )}
              {client.connection && (
                <MobileHostStatus status={hostStatus} dotOnly />
              )}
            </div>
          ) : null}
        </div>}
          <MobileHeaderSearch
            open={view === "home" && searchOpen}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onClose={() => setSearchOpen(false)}
            trigger={searchTrigger}
          />
        {/* A new conversation has nothing to act on until its first message. */}
        {view === "chat" && (snapshot || loading) ? (
          <div className="mobile-header-actions">
            {/* The computer stands in until the session reports its context
                window; then the button becomes the context ring. */}
            <IconButton
              label="Status"
              onClick={(event) => {
                // Keep the placeholder at full strength while loading.
                if (!snapshot || loading || !sessionConfirmed) return;
                sessionStatusTrigger.current = event.currentTarget;
                setComposerPanel(null);
                setSessionStatusOpen(true);
              }}
            >
              {contextRing === null ? (
                <Computer size={24} />
              ) : (
                <MeterRing ratio={contextRing} size={20} stroke={2.25} />
              )}
            </IconButton>
            <IconButton
              label="Session actions"
              onClick={(event) => {
                // Like the status button, stay visible but inert while loading.
                if (!snapshot || loading || !sessionConfirmed) return;
                sessionActionsTrigger.current = event.currentTarget;
                setSessionActionsTarget(undefined);
                setSessionActionsPoint(undefined);
                setComposerPanel(null);
                setSessionActionsOpen(true);
              }}
              disabled={busy}
            >
              <HeaderMoreIcon />
            </IconButton>
          </div>
        ) : view === "settings" && settingsPage === "root" ? (
          <IconButton buttonRef={aboutTrigger} label="About" onClick={() => setAboutOpen((open) => !open)}>
            <Info size={22} />
          </IconButton>
        ) : view === "home" && (!homeProject || searchOpen) ? (
          <IconButton buttonRef={homeProject ? undefined : searchTrigger} label={searchOpen ? "Close search" : "Search conversations"} onClick={toggleHomeSearch}>
            {searchOpen ? <X size={22} /> : <Search size={22} />}
          </IconButton>
        ) : null}
      </header>

      <div className="mobile-notices">
      {(error || hostError || pollError || hostStatus.state === "failed") &&
        !addingConnection && !homeUnavailable && (
          <div className="mobile-error" role="alert">
            <span>
              {error ||
                hostError ||
                pollError ||
                hostStatus.detail ||
                t("Connection failed")}
            </span>
            {client.connection && (
              <IconButton
                label="Reconnect"
                disabled={busy || hostStatus.state === "reconnecting"}
                onClick={() => void reconnect(true)}
              >
                <RefreshCw size={16} />
              </IconButton>
            )}
          </div>
        )}
      {pending && connected && (
        <div className="mobile-pending" role="status">
          <span>{t("A request is awaiting confirmation.")}</span>
          <button disabled={busy} onClick={() => void dispatch()}>
            {t("Retry")}
          </button>
        </div>
      )}
      </div>

      <MobilePageTransition key={`pages:${client.connection?.endpoint}`} route={route}
        animate={navigationReady.current} visible={!pageOverlayOpen}>
      {view === "settings" ? (
        <MobileSettings
          page={settingsPage}
          onPageChange={changeSettingsPage}
          connection={
            client.connection
              ? {
                  name: client.connection.name,
                  endpoint: client.connection.endpoint,
                  environmentId: client.connection.environmentId,
                  disabled: client.connection.disabled,
                }
              : undefined
          }
          hostStatus={hostStatus}
          busy={busy}
          loading={loading}
          pairing={pairing}
          addingConnection={addingConnection}
          connectionTrigger={connectionTrigger}
          onAddConnection={() => {
            setError("");
            setAddingConnection(true);
          }}
          connections={pairedConnections}
          onSwitchConnection={switchHost}
          probeConnection={probeSavedHost}
          onDisconnect={() => disconnectConnection(false)}
          onDeleteConnection={forgetConnection}
          connectionAppearance={connectionAppearance}
          onSaveConnectionAppearance={saveConnectionAppearance}
          onReconnect={() => void reconnect(true)}
          theme={theme}
          onThemeChange={setTheme}
          glass={glass}
          onGlassChange={setGlass}
          language={language}
          onLanguageChange={setUiLanguage}
          followUpBehavior={followUpBehavior}
          onFollowUpBehaviorChange={(behavior) => {
            saveFollowUpBehavior(behavior);
            setFollowUpBehavior(behavior);
          }}
          transcriptLayout={transcriptLayout}
          onTranscriptLayoutChange={(layout) => {
            saveTranscriptLayout(layout);
            setTranscriptLayout(layout);
          }}
          transcriptAnchor={transcriptAnchor}
          onTranscriptAnchorChange={(anchor) => {
            saveTranscriptAnchor(anchor);
            setTranscriptAnchor(anchor);
          }}
          accentColor={accentColor}
          onAccentColorChange={(color) => {
            saveAccentColor(color);
            setAccentColor(applyAccentColor(color));
          }}
          soundsEnabled={soundsEnabled}
          onSoundsEnabledChange={(enabled) => {
            saveSoundsEnabled(enabled);
            setSoundsEnabled(enabled);
          }}
          archive={
            <MobileArchive
              projects={projects}
              disabled={busy || !connected}
              loadSessions={onDrawerLoadSessions}
              onRestore={(session) =>
                updateSessionMetadata(
                  { archived: false },
                  session.id,
                  session.projectId,
                )
              }
            />
          }
          agentDefaults={
            <MobileAgentDefaults
              key={`${client.connection?.endpoint ?? "disconnected"}:${connected}:${connectionRevision}`}
              client={client}
              hostId={connected ? client.connection?.endpoint : undefined}
              disabled={busy || loading || !connected}
              panel={preferencePanel}
              onPanelChange={setPreferencePanel}
            />
          }
          providerAccounts={
            <MobileProviderAccounts
              key={`${client.connection?.endpoint ?? "disconnected"}:${connected}:${connectionRevision}`}
              client={client}
              hostId={client.connection?.endpoint}
              enabled={connected && hostStatus.state === "connected"}
            />
          }
          preferencePanel={preferencePanel}
          onPreferencePanelChange={setPreferencePanel}
          activity={activity}
          appUpdates={appUpdates}
        />
      ) : view === "home" ? (
        <MobileHome
          key={client.connection?.endpoint}
          projects={hostScopeReady ? projects : []}
          project={hostScopeReady ? homeProject : undefined}
          projectsPage={!homeProject && allProjectsPage}
          projectsPending={projectsPending}
          projectsUnavailable={projectsUnavailable}
          foreground={connected && hostStatus.state === "connected" && foreground && !drawerOpen && !pageOverlayOpen && !hostPickerOpen}
          inactive={drawerOpen || homeMenuOpen || addingConnection || sessionActionsOpen || hostPickerOpen}
          query={searchOpen ? searchQuery : ""}
          now={now}
          unreadIds={activity.unreadIds}
          loadSessions={onDrawerLoadSessions}
          cachedSessions={onCachedSessions}
          onProject={onDrawerProject}
          onSession={(id, owner) => {
            void openProject(owner);
            void openSession(id, owner.id, homeProject ? "project" : "other");
          }}
          refreshKey={homeRefreshKey}
          sessionActionsId={sessionActionsOpen ? sessionActionsTarget : undefined}
          onSessionActions={(summary, trigger, point) => {
            setHomeActionSession(summary);
            onDrawerSessionActions(summary.id, trigger, point);
          }}
          onSearch={toggleHomeSearch}
          searchOpen={searchOpen}
          searchTrigger={searchTrigger}
          onNewSession={() => {
            const owner = homeProject ?? projects.find((item) => item.id === project?.id) ?? projects[0];
            if (owner) {
              void openProject(owner);
              void openSession(undefined, undefined, homeProject ? "project" : "other");
            }
          }}
          onAddProject={openAddProject}
          devices={
            <MobileDeviceChips
              connections={deviceConnections}
              activeId={connectionKey}
              status={hostStatus}
              scope={homeScope}
              probing={homeOverview && foreground && !pageOverlayOpen}
              disabled={pairing}
              probe={probeHost}
              onScope={setHomeScope}
              onSwitch={switchHost}
            />
          }
          unavailable={homeUnavailable ? (
            <MobileHostUnavailable
              failed={projectsUnavailable}
              retrying={busy || hostStatus.state === "reconnecting"}
              lastOnline={loadLastOnline(connectionKey)}
              now={now}
              onRetry={() => void reconnect(true)}
            />
          ) : undefined}
          remote={remoteHosts}
          onRemoteSession={onRemoteSession}
          onRemoteProject={onRemoteProject}
        />
      ) : (
        <main className="mobile-chat" inert={drawerOpen || pageOverlayOpen || hostPickerOpen}>
          {hostView ? (
            <MobileTranscript
              key={transcriptKeys.current.get(hostView.session.id) ?? hostView.session.id}
              snapshot={hostView}
              active={!drawerOpen && !pageOverlayOpen && !hostPickerOpen}
              onOverlayChange={onTranscriptOverlayChange}
              gitSource={gitSource}
              progressDock={progressDock}
              gitEnabled={foreground && connected && hostStatus.state === "connected" && sessionConfirmed && !loading}
              animateFrom={animateFrom}
              readBinaryFile={readHostImage}
              resolveNoteImage={client.hasCapability("notes.v1") ? resolveNoteImage : undefined}
              disabled={busy || !!pending || !sessionConfirmed}
              onCommand={onTranscriptCommand}
              questionOpen={questionOpen}
              onQuestionOpenChange={onQuestionOpenChange}
              planDecision={planDecision}
            />
          ) : loading ? (
            <div className="mobile-loading">
              <LoaderCircle className="mobile-spin" size={20} />
              {t("Loading conversation…")}
            </div>
          ) : !project ? (
            <Empty icon={<Folder size={28} />} title="Open your first project">
              {t("Add a folder from your connected computer to get started.")}
              <button
                className="mobile-button"
                onClick={(event) => openAddProject(event.currentTarget)}
              >
                <FolderPlus size={16} />
                {t("Open project")}
              </button>
            </Empty>
          ) : (
            <Empty
              icon={<Chatting size={30} />}
              title={
                sessionId
                  ? "Conversation unavailable"
                  : "What shall we work on?"
              }
            >
              {sessionId
                ? t("Check your connection and retry.")
                : t("Start a conversation in {project}.", {
                    project: project?.name || t("your project"),
                  })}
            </Empty>
          )}
          {nativeReadOnly ? <p className="mobile-native-readonly" role="status">
            {nativeSyncNotice(snapshot?.nativeStatus) ?? nativeAccessNotice(nativeAccess)}
          </p> : null}
          {project && <MobileDraftComposer
            progressSlot={setProgressDock}
            compact={questionOpen || planDecisionOpen}
            onExpand={() => {
              if (questionOpen) onQuestionOpenChange(false);
              else if (planDecisionId) setCollapsedPlan(planDecisionId);
            }}
            queue={
              <MobileMessageQueue
                key={snapshot?.session.id}
                {...queue}
                onOverlayChange={onQueueOverlayChange}
                onRestore={restoreQueuedMessage}
                disabled={nativeReadOnly || busy || !!pending || loading || !sessionConfirmed}
              />
            }
            draft={draft}
            skillsContextKey={skillContextKey}
            loadSkills={loadSkillCatalog}
            canCompact={!!snapshot && snapshot.status === "idle" && !nativeReadOnly && ["codex", "claude", "grok", "opencode", "pi", "omp"].includes(snapshot.session.harness)}
            configuration={
              snapshot ? configurationForSession(snapshot) : configuration
            }
            catalog={catalog}
            catalogLoading={catalogLoading}
            lockedAgent={!!sessionId}
            allowHandoff={
              client.hasCapability("sessions.handoff") && !running
            }
            disabled={
              nativeReadOnly ||
              busy ||
              !!pending ||
              (running && !snapshot?.supportsQueue) ||
              loading ||
              (!!sessionId && !sessionConfirmed) ||
              (!!sessionId && !snapshot)
            }
            working={busy || readingAttachments}
            readingAttachments={readingAttachments}
            running={running}
            canSend={
              !nativeReadOnly &&
              !busy &&
              !pending &&
              !readingAttachments &&
              !loading &&
              (!sessionId || sessionConfirmed) &&
              (!running || !!snapshot?.supportsQueue) &&
              (sessionId
                ? !!snapshot
                : !!catalog?.models[configuration.harness]?.some(
                    (model) => model.id === configuration.model,
                  ))
            }
            canStop={!busy && !pending && sessionConfirmed && !!snapshot?.runId}
            onSend={() => void send()}
            onStop={() => {
              if (sessionId && snapshot?.runId)
                void dispatch({
                  type: "cancel",
                  commandId: crypto.randomUUID(),
                  sessionId,
                  runId: snapshot.runId,
                });
            }}
            onConfigurationChange={(next) => {
              if (!sessionId) {
                if (next.model) draftConfigurationChanged.current = true;
                setConfiguration(next);
              }
              else
                void dispatch({
                  type: "configure",
                  commandId: crypto.randomUUID(),
                  sessionId,
                  ...(snapshot && (snapshot.session.pendingConfiguration || next.harness !== snapshot.session.harness)
                    ? { harness: next.harness }
                    : {}),
                  model: next.model,
                  modelSettings: next.modelSettings,
                  runtimeMode: next.runtimeMode,
                });
            }}
            panel={composerPanel}
            onPanelChange={setComposerPanel}
            project={project}
            projects={projects}
            onProjectChange={(item) => void openProject(item, "chat")}
            attachments={attachments}
            onFiles={(files) => void addFiles(files)}
            onRemoveAttachment={(id) =>
              setAttachments((current) =>
                current.filter((item) => item.id !== id),
              )
            }
            planMode={planMode}
            onPlanModeChange={setPlanMode}
          />}
        </main>
      )}
      </MobilePageTransition>

      {!!client.connection && (
        <MobileDrawer
          key={`drawer:${client.connection?.endpoint}`}
          assistantName={connected && assistantIdentity && assistantIdentity.hostId === connectionKey ? assistantIdentity.name : undefined}
          assistantUnreadCount={assistantUnreadCount}
          onAssistant={onDrawerAssistant}
          onNotes={client.hasCapability("notes.v1") ? onDrawerNotes : undefined}
          open={drawerOpen && view !== "settings" && !pageOverlayOpen}
          active={view !== "settings" && !pageOverlayOpen}
          covered={hostPickerOpen}
          foreground={foreground && connected && hostStatus.state === "connected"}
          onOpenChange={onDrawerOpenChange}
          projects={hostScopeReady ? projects : []}
          project={hostScopeReady ? project : undefined}
          sessions={hostScopeReady ? (project && client.cachedSessions?.(project.id)) ?? sessions : []}
          sessionId={sessionId}
          loading={historyLoading}
          unreadIds={activity.unreadIds}
          now={now}
          hostName={connectionName}
          hostStatus={hostStatus}
          hostTrigger={hostPickerTrigger}
          onHost={onDrawerHost}
          projectsPending={projectsPending}
          projectsUnavailable={projectsUnavailable}
          loadSessions={onDrawerLoadSessions}
          cachedSessions={onCachedSessions}
          onHome={onDrawerHome}
          onAllProjects={onDrawerAllProjects}
          onSession={onDrawerSession}
          refreshKey={homeRefreshKey}
          sessionActionsId={sessionActionsOpen ? sessionActionsTarget : undefined}
          onSessionActions={onDrawerSummaryActions}
          onNewSession={onDrawerNewSession}
          onSettings={onDrawerSettings}
        />
      )}
      <MobileSheetPresence open={hostPickerOpen}>
        <MobileHostPicker anchor={hostPickerTrigger}
          connections={pairedConnections}
          activeId={connectionKey} status={hostStatus} switching={pairing}
          probe={probeHost} onSwitch={switchHost} onReconnect={() => { setHostPickerOpen(false); void reconnect(true); }}
          onAdd={() => {
            connectionTrigger.current = hostPickerTrigger.current;
            setHostPickerOpen(false);
            setDrawerOpen(false);
            setPairingError("");
            setAddingConnection(true);
          }}
          onManage={() => {
            setHostPickerOpen(false);
            navigate("settings");
            changeSettingsPage("connections");
          }}
          onClose={() => setHostPickerOpen(false)} />
      </MobileSheetPresence>
      <MobileSheetPresence open={sessionActionsOpen && view !== "settings" && !!(sessionActionsTarget ? sessionActionsSummary : snapshot)}>
      {(sessionActionsTarget ? sessionActionsSummary : snapshot) ? (
        <MobileSessionActions
          key={sessionActionsTarget ?? sessionId ?? "draft"}
          open={sessionActionsOpen}
          snapshot={sessionActionsTarget ? undefined : snapshot}
          summary={sessionActionsSummary}
          anchor={sessionActionsTrigger}
          anchorPoint={sessionActionsPoint}
          disabled={busy || loading || !!pending}
          onUpdate={(patch) =>
            updateSessionMetadata(patch, sessionActionsTarget ?? sessionId, sessionActionsSummary?.projectId ?? project?.id)
          }
          onDelete={sessionActionsTarget ? undefined : deleteCurrentSession}
          onMarkUnread={
            sessionActionsSummary
              ? async () => {
                  activity.markUnread(
                    sessionActionsSummary.id,
                    sessionActionsSummary.revision,
                  );
                }
              : undefined
          }
          onClose={() => {
            setSessionActionsOpen(false);
          }}
        />
      ) : null}
      </MobileSheetPresence>
      <MobileSheetPresence open={sessionStatusOpen && view === "chat" && !!snapshot}>
      {snapshot ? (
        <MobileSessionStatus
          snapshot={snapshot}
          catalog={catalog}
          hostName={connectionName}
          hostStatus={hostStatus}
          anchor={sessionStatusTrigger}
          onClose={() => setSessionStatusOpen(false)}
        />
      ) : null}
      </MobileSheetPresence>
      <MobileSheet
        open={aboutOpen && view === "settings" && settingsPage === "root"}
        title="About"
        placement="anchor"
        anchor={aboutTrigger}
        align="end"
        width={SHEET_WIDTH.list}
        onClose={() => setAboutOpen(false)}
      >
        <p className="mobile-about-version">
          MonoCode{appUpdates.installed ? ` ${appUpdates.installed.version}` : ""}
        </p>
        <button
          type="button"
          className="mobile-sheet-row"
          onClick={() => {
            setAboutOpen(false);
            changeSettingsPage("updates");
          }}
        >
          <RefreshCw size={20} />
          <span>{t("App updates")}</span>
        </button>
      </MobileSheet>
      <MobileHomeMenu
        open={homeMenuOpen && view === "home" && !drawerOpen}
        anchor={homeMenuTrigger}
        projects={hostScopeReady ? projects : []}
        projectsPending={projectsPending}
        projectsUnavailable={projectsUnavailable}
        onClose={() => setHomeMenuOpen(false)}
        onProject={onDrawerProject}
      />
      <MobileSheetPresence open={addingConnection}>
        <MobileConnectionSheet
          anchor={connectionTrigger}
          url={url}
          token={token}
          disabled={pairing}
          error={pairingError}
          onUrlChange={setUrl}
          onTokenChange={setToken}
          onConnect={() => void connect()}
          onConnectWith={(credentials) => {
            setUrl(credentials.url);
            void connect(credentials);
          }}
          onClose={() => {
            if (!pairing) {
              setAddingConnection(false);
              setToken("");
              setPairingError("");
            }
          }}
        />
      </MobileSheetPresence>
      <MobileSheetPresence open={addingProject}>
        <MobileProjectPicker
          hostName={connectionName}
          anchor={projectTrigger}
          disabled={busy}
          browseDirectories={browseHostDirectories}
          onOpen={addProject}
          onClose={() => {
            if (!busy) setAddingProject(false);
          }}
        />
      </MobileSheetPresence>
      </div>
      </SurfaceVisibilityContext.Provider>
    </div>
    </MobileOverlayHostContext.Provider>
  );
}
