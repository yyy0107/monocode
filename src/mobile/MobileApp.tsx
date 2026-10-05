import { useConnectionAppearance, saveConnectionAppearance, removeConnectionAppearance } from "./connectionAppearance";
import { useHostQueue } from "../features/connections/ui/useHostQueue";
import { consumePlanCommand } from "../features/sessions/model/plan";
import { isCompactCommand } from "../features/sessions/model/compact";
import { MobileMessageQueue } from "./MobileMessageQueue";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  LoaderCircle,
  PanelLeft,
  RefreshCw,
  Search,
  X,
} from "../shared/ui/icons";
import {
  sessionDisplayTitle,
  type Attachment,
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
import { useMobileAppUpdates } from "./MobileAppUpdates";
import {
  configurationForSession,
  firstConfiguration,
  type MobileConfiguration,
} from "./MobileModelControls";
import type { HostModelCatalog } from "../features/connections/model/protocol";
import {
  MobileClient,
  type PendingCommand,
  type MobileFirstMessage,
  type MobileSessionPatch,
} from "./client";
import { MobileComposer, type MobileComposerPanel } from "./MobileComposer";
import { MobileSessionActions } from "./MobileSessionActions";
import { MobileSessionStatus } from "./MobileSessionStatus";
import { MeterRing } from "../features/sessions/ui/ContextMeter";
import { contextRatio } from "../features/sessions/model/contextUsage";
import { mobileContextUsage } from "./contextUsage";
import { MobileConnectionSheet } from "./MobileConnectionSheet";
import type { MobileSheetPoint } from "./MobileSheet";
import { MobileProjectPicker } from "./MobileProjectPicker";
import { MobileDrawer } from "./MobileDrawer";
import { MobileHome } from "./MobileHome";
import { MobileHomeMenu } from "./MobileHomeMenu";
import { MobileHeaderSearch } from "./MobileHeaderSearch";
import {
  MobileSettings,
  mobileSettingsTitle,
  type MobilePreferencePanel,
  type MobileSettingsPage,
} from "./MobileSettings";
import { readLastLocation, saveLastLocation } from "./lastLocation";
import { useMobileActivity } from "./useMobileActivity";
import { MobileHostStatus } from "./MobileHostStatus";
import { useHostConnectionStatus } from "./useHostConnectionStatus";
import { useTranslation } from "../shared/i18n/useTranslation";
import { setUiLanguage, translate } from "../shared/i18n/language";
import { readMobileAttachments } from "./attachments";
import { takeBackQueuedMessage } from "./queuedDraft";
import {
  loadFollowUpBehavior,
  saveFollowUpBehavior,
} from "../features/settings/model/settings";
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

const client = new MobileClient(mobileStorage);

const readHostImage = (path: string) => client.readBinaryFile(path);
const browseHostDirectories = (path?: string) => client.browseDirectories(path);
// Settings doubles as the connection screen before pairing.
type View = "home" | "chat" | "settings";
// The stock glyph packs its dots tightly; the header capsule reads better
// with wider, slightly heavier dots.
function HeaderMoreIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="4.5" cy="12" r="2.25" fill="currentColor" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <circle cx="19.5" cy="12" r="2.25" fill="currentColor" />
    </svg>
  );
}
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
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
export function MobileApp() {
  const { language, t } = useTranslation();
  const appUpdates = useMobileAppUpdates();
  const [view, setView] = useState<View>("settings");
  const [homeProjectId, setHomeProjectId] = useState<string>();
  const [allProjectsPage, setAllProjectsPage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const homeMenuTrigger = useRef<HTMLButtonElement>(null);
  const settingsReturnView = useRef<View>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<MobileSettingsPage>("root");

  const connectionAppearance = useConnectionAppearance(client.connection?.environmentId);
  const connectionName = connectionAppearance.displayName || client.connection?.name || "MonoCode";
  const [connected, setConnected] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<HostProject[]>([]);
  const [project, setProject] = useState<HostProject>();
  const [sessions, setSessions] = useState<HostSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<HostSession>();
  const [sessionConfirmed, setSessionConfirmed] = useState(false);
  const [animateFrom, setAnimateFrom] = useState<string>();
  const [catalog, setCatalog] = useState<HostModelCatalog>();
  const [configuration, setConfiguration] = useState<MobileConfiguration>({
    harness: "codex",
    model: "",
    modelSettings: {},
    runtimeMode: "supervised",
  });
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [readingAttachments, setReadingAttachments] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [followUpBehavior, setFollowUpBehavior] = useState(loadFollowUpBehavior);
  const acceptedQueueAttachments = useRef<Attachment[]>([]);
  const parkedDrafts = useRef<Array<{
    text: string;
    attachments: Attachment[];
    planMode: boolean;
    accepted: Attachment[];
  }>>([]);
  const [composerPanel, setComposerPanel] = useState<MobileComposerPanel>(null);
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
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [pending, setPending] = useState<PendingCommand>();
  const [foreground, setForeground] = useState(true);
  const hostStatus = useHostConnectionStatus(client, connected, foreground);
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState(
    () => localStorage.getItem("monocode-mobile-theme") || "dark",
  );
  const [glass, setGlass] = useState<GlassSettings>(readGlassSettings);
  const navigation = useRef(0);
  const appRoot = useRef<HTMLDivElement>(null);
  const loadTiming = useRef<{ turn: number; id: string; start: number; cached: boolean }>(undefined);
  const queueView = useRef({ view, sessionId });
  const queueOverlayClose = useRef<(() => void) | undefined>(undefined);
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
    void (async () => {
      try {
        const [restored, pending] = await Promise.all([client.restore(), client.pending()]);
        if (live) setPending(pending);
        if (restored) {
          const items = await client.projects();
          if (live) {
            setConnected(true);
            setProjects(items);
            setUrl(client.connection!.endpoint);
            await restoreLocation(items);
          }
        }
      } catch (problem) {
        if (live) {
          setError(message(problem));
          setUrl(client.connection?.endpoint ?? "");
        }
      } finally {
        if (live) setLoading(false);
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
    if (!foreground || (!drawerOpen && view !== "home")) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [foreground, drawerOpen, view]);

  useEffect(() => {
    if (!connected || !foreground || (view === "settings" && !drawerOpen)) return;
    let live = true;
    const turn = navigation.current;
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
          if (live && navigation.current === turn) {
            setProjects(items);
            if (history) setSessions(history);
          }
          listRunning = !!history?.some((item) => item.status === "running");
        }
        if (view === "chat" && sessionId) {
          const result = await client.session(sessionId);
          if (live && navigation.current === turn) {
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
        if (live && navigation.current === turn) {
          failures = 0;
          setPollError("");
          setPending(await client.pending());
        }
      } catch (problem) {
        if (live && navigation.current === turn) {
          failures += 1;
          setPollError(message(problem));
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
    foreground,
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
    if (!connected || !foreground || view !== "chat" || !snapshot) return;
    let live = true;
    void client.sessionPreviews(snapshot.session.id).then((result) => {
      if (live && result)
        setSnapshot((previous) =>
          previous?.session.id === result.session.id && previous.revision <= result.revision
            ? result : previous,
        );
    });
    return () => { live = false; };
  }, [connected, foreground, view, snapshot]);

  useEffect(() => {
    const environmentId = client.connection?.environmentId;
    if (!connected || !environmentId || !project || view !== "chat") return;
    saveLastLocation({
      environmentId,
      projectId: project.id,
      ...(sessionId ? { sessionId } : {}),
    });
  }, [connected, project?.id, sessionId, view]);

  const connect = async () => {
    setBusy(true);
    setError("");
    setPollError("");
    try {
      await client.connect(url, token);
      const items = await client.projects();
      projectGeneration.current += 1;
      setProject(undefined);
      setSessionId(undefined);
      setSnapshot(undefined);
      setSessionConfirmed(false);
      setCatalog(undefined);
      setAttachments([]);
      acceptedQueueAttachments.current = [];
      parkedDrafts.current = [];
      setPlanMode(false);
      setToken("");
      setUrl(client.connection!.endpoint);
      setProjects(items);
      setConnected(true);
      setAddingConnection(false);
      setPending(await client.pending());
      await restoreLocation(items);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  };
  const openProject = async (
    item: HostProject,
    nextView: View = "chat",
  ): Promise<HostSessionSummary[] | undefined> => {
    const turn = ++navigation.current;
    const projectTurn = ++projectGeneration.current;
    setProject(item);
    setSessions([]);
    const cachedCatalog = client.cachedModels(item.id);
    setCatalog(cachedCatalog);
    setConfiguration((cachedCatalog && firstConfiguration(cachedCatalog)) ?? {
      harness: "codex", model: "", modelSettings: {}, runtimeMode: "supervised",
    });
    setSessionId(undefined);
    setSnapshot(undefined);
    setSessionConfirmed(false);
    setAnimateFrom(undefined);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setView(nextView);
    setLoading(false);
    setHistoryLoading(true);
    setError("");
    // Provider discovery can launch CLIs; it is independent of history and
    // must never hold the conversation's first paint behind the slowest CLI.
    void client.models(item.id).then((catalog) => {
      if (projectGeneration.current !== projectTurn) return;
      setCatalog(catalog);
      const first = firstConfiguration(catalog);
      if (first) setConfiguration((current) => current.model ? current : {
        ...first, runtimeMode: current.runtimeMode,
      });
    }).catch((problem) => {
      if (projectGeneration.current === projectTurn) setError(message(problem));
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
  };
  const openSession = async (id?: string, restoredProjectId?: string) => {
    const start = performance.now();
    appRoot.current?.removeAttribute("data-session-load-ms");
    appRoot.current?.removeAttribute("data-session-load-source");
    const turn = ++navigation.current;
    const known = id ? client.cachedSession(id) : undefined;
    const cached = known && (!restoredProjectId ||
      (known.projectId === restoredProjectId && !known.archived)) ? known : undefined;
    loadTiming.current = id ? { turn, id, start, cached: !!cached } : undefined;
    setSessionId(id);
    setSnapshot(cached);
    setSessionConfirmed(false);
    if (cached) setConfiguration(configurationForSession(cached));
    setAnimateFrom(undefined);
    setDraft("");
    setAttachments([]);
    acceptedQueueAttachments.current = [];
    parkedDrafts.current = [];
    setPlanMode(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setDrawerOpen(false);
    setView("chat");
    setLoading(!!id);
    setError("");
    if (!id) return;
    try {
      const result = await client.session(id);
      if (navigation.current === turn) {
        if (restoredProjectId && (result.projectId !== restoredProjectId || result.archived)) {
          await openSession();
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
    visibleSession: view === "chat" && !drawerOpen && !loading && sessionConfirmed && snapshot && snapshot.session.id === sessionId
      ? { id: snapshot.session.id, revision: snapshot.revision,
          lastCompletedRunId: snapshot.lastCompletedRunId, pendingInputKey: pendingSessionInputKey(snapshot.session, snapshot.runId) }
      : undefined,
    language,
    onOpen: async (target) => {
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
            projectGeneration.current += 1;
            setCatalog(undefined);
            setCatalog(await client.models(owner.id));
          }
        }
        setSessionId(receipt.sessionId);
        setSnapshot(result);
        setSessionConfirmed(true);
        setConfiguration(configurationForSession(result));
        setView("chat");
        if (
          completedCommand?.type === "send" ||
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
  const queue = useHostQueue(snapshot, queueRequest);
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
          if (draft.trim() || attachments.length) {
            parkedDrafts.current.push({
              text: draft, attachments, planMode,
              accepted: acceptedQueueAttachments.current,
            });
          }
          acceptedQueueAttachments.current = queued.attachments;
          setDraft(queued.text);
          setAttachments(restored);
          setPlanMode(queued.intent === "plan");
          setComposerPanel(null);
          requestAnimationFrame(() =>
            document.querySelector<HTMLTextAreaElement>(".mobile-composer textarea")?.focus(),
          );
        },
      });
    } finally {
      setReadingAttachments(false);
    }
  });
  const send = async () => {
    if (
      !project ||
      (!draft.trim() && !attachments.length) ||
      busy ||
      pending ||
      readingAttachments ||
      (!!sessionId && !sessionConfirmed) ||
      !!snapshot?.session.nativeSession ||
      (snapshot?.status === "running" && !snapshot.supportsQueue)
    )
      return;
    if (isCompactCommand(draft)) {
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
    const parsed = consumePlanCommand(draft);
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
    try {
      const uploaded = await client.uploadAttachments(attachments, acceptedQueueAttachments.current);
      const prompt: MobileFirstMessage = {
        text: parsed.text,
        ...(uploaded.length ? { attachments: uploaded } : {}),
        ...(planMode || parsed.planning ? { intent: "plan" } : {}),
      };
      if (sessionId) {
        await dispatch({
          ...prompt,
          type: "send",
          commandId: crypto.randomUUID(),
          sessionId,
          followUpBehavior,
        });
      } else {
        await dispatch(
          {
            type: "create",
            commandId: crypto.randomUUID(),
            projectId: project.id,
            harness: configuration.harness,
            model: configuration.model,
            modelSettings: configuration.modelSettings,
            runtimeMode: configuration.runtimeMode,
          },
          prompt,
        );
      }
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
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
      const added = await client.openProject(path);
      const items = await client.projects();
      setProjects(items);
      setAddingProject(false);
      setDrawerOpen(false);
      openHome(added);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: View) => {
    setHomeMenuOpen(false);
    if (next === "settings" && view !== "settings") settingsReturnView.current = view;
    navigation.current += 1;
    setLoading(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
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
      const summary = await client.updateSession(ownerId, id, patch);
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
      await client.deleteSession(project.id, id);
      if (navigation.current === turn) {
        navigate("chat");
        setSessions((items) => items.filter((item) => item.id !== id));
        setSessionId(undefined);
        setSnapshot(undefined);
        setDraft("");
        setAttachments([]);
      }
    } finally {
      setBusy(false);
    }
  };
  const disconnectConnection = async (remove: boolean) => {
    navigation.current += 1;
    projectGeneration.current += 1;
    setBusy(true);
    const environmentId = client.connection?.environmentId;
    try {
      if (remove) await client.disconnect();
      else await client.suspend();
      setConnected(false);
      setProjects([]);
      setProject(undefined);
      setSessions([]);
      setSnapshot(undefined);
      setSessionConfirmed(false);
      setHistoryLoading(false);
      setSessionId(undefined);
      setError("");
      setPollError("");
      if (remove && environmentId) removeConnectionAppearance(environmentId);
    } catch (problem) {
      setError(message(problem));
      throw problem;
    } finally { setBusy(false); }
  };
  const reconnect = async () => {
    setBusy(true);
    try {
      await client.reconnect();
      if (!connected) {
        const items = await client.projects();
        setProjects(items);
        setConnected(true);
        await restoreLocation(items);
      }
      setError("");
      setPollError("");
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (queueOverlayClose.current) queueOverlayClose.current();
      else if (sessionStatusOpen) setSessionStatusOpen(false);
      else if (sessionActionsOpen) {
        if (!busy) setSessionActionsOpen(false);
      } else if (preferencePanel) setPreferencePanel(null);
      else if (addingConnection) {
        if (!busy) setAddingConnection(false);
      } else if (composerPanel) setComposerPanel(null);
      else if (addingProject) {
        if (!busy) setAddingProject(false);
      } else if (drawerOpen) setDrawerOpen(false);
      else if (homeMenuOpen) setHomeMenuOpen(false);
      else if (view === "home" && searchOpen) setSearchOpen(false);
      else if (view === "settings" && settingsPage !== "root")
        setSettingsPage("root");
      else if (view === "settings" && connected) navigate(settingsReturnView.current);
      else if (view === "chat") openHome(project);
      else if (view === "home" && homeProjectId) openHome();
      else void App.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [
    view,
    connected,
    addingConnection,
    addingProject,
    composerPanel,
    preferencePanel,
    sessionActionsOpen,
    sessionStatusOpen,
    drawerOpen,
    settingsPage,
    busy,
    homeProjectId,
    searchOpen,
    homeMenuOpen,
    project,
  ]);

  const running = snapshot?.status === "running";
  const sessionActionsSummary = view === "home" ? homeActionSession : sessions.find(
    (item) => item.id === sessionActionsTarget,
  );
  const nativeReadOnly = !!snapshot?.session.nativeSession;
  const skillHarness = snapshot?.session.harness ?? configuration.harness;
  const skillContextKey = `${client.connection?.environmentId ?? ""}\0${project?.id ?? ""}\0${skillHarness}\0${sessionId ?? ""}\0${snapshot?.session.worktreeCwd || snapshot?.session.cwd || project?.cwd || ""}`;
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
  const title =
    view === "chat"
      ? (snapshot &&
          sessionDisplayTitle(
            snapshot.session.title,
            snapshot.session.harness,
          )) ||
        t("New conversation")
      : view === "home"
        ? homeProject?.name || (allProjectsPage ? t("All projects") : "MonoCode")
        : t(mobileSettingsTitle(settingsPage));
  // Memoized children (transcript, drawer) get handlers that keep their
  // identity, so typing in the composer does not re-render them.
  const onTranscriptCommand = useStableCallback((command: HostCommand) => {
    void dispatch(command);
  });
  const onDrawerOpenChange = useStableCallback((open: boolean) => {
    if (open) setHomeMenuOpen(false);
    if (open) setComposerPanel(null);
    setDrawerOpen(open);
  });
  const onDrawerAddProject = useStableCallback(() => {
    setError("");
    setAddingProject(true);
  });
  const onDrawerLoadSessions = useStableCallback((projectId: string) =>
    client.sessions(projectId),
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
  const onDrawerSettings = useStableCallback(() => navigate("settings"));
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
  return (
    <div
      ref={appRoot}
      className="mobile-app"
      data-view={view}
      onPointerDownCapture={(event) => interceptSearchOutside(event, false)}
      onClickCapture={(event) => interceptSearchOutside(event, true)}
      onContextMenuCapture={(event) => interceptSearchOutside(event, true)}
    >
      <header className="mobile-header" data-floating={floatingHeader} data-project={view === "home" && !!homeProject} data-search={view === "home" && searchOpen} inert={drawerOpen}>
        {view === "chat" || (view === "home" && !homeProject) ? (
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
        ) : connected || settingsPage !== "root" ? (
          <IconButton
            label="Back"
            onClick={() =>
              settingsPage !== "root"
                ? setSettingsPage("root")
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
                <MobileHostStatus status={hostStatus} />
                {hostStatus.state === "connected" && <span>{t("Connected")}</span>}
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
            aria-label={t("Home menu")}
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
              {project?.name && client.connection?.name && (
                <span
                  className="mobile-header-context-separator"
                  aria-hidden="true"
                >
                  ·
                </span>
              )}
              {client.connection?.name && (
                <span className="mobile-header-context-item">
                  <Computer size={12} aria-hidden="true" />
                  <span>{connectionName}</span>
                  <MobileHostStatus status={hostStatus} />
                </span>
              )}
            </div>
          ) : null}
        </div>}
        {view === "home" && (
          <MobileHeaderSearch
            open={searchOpen}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onClose={() => setSearchOpen(false)}
            trigger={searchTrigger}
          />
        )}
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
        ) : view === "home" && (!homeProject || searchOpen) ? (
          <IconButton buttonRef={homeProject ? undefined : searchTrigger} label={searchOpen ? "Close search" : "Search conversations"} onClick={toggleHomeSearch}>
            {searchOpen ? <X size={22} /> : <Search size={22} />}
          </IconButton>
        ) : null}
      </header>

      <div className="mobile-notices">
      {(error || pollError || hostStatus.state === "failed") &&
        !addingConnection && (
          <div className="mobile-error" role="alert">
            <span>
              {error ||
                pollError ||
                hostStatus.detail ||
                t("Connection failed")}
            </span>
            {client.connection && (
              <IconButton
                label="Reconnect"
                disabled={busy || hostStatus.state === "reconnecting"}
                onClick={() => void reconnect()}
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

      {view === "settings" ? (
        <MobileSettings
          page={settingsPage}
          onPageChange={setSettingsPage}
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
          addingConnection={addingConnection}
          connectionTrigger={connectionTrigger}
          onAddConnection={() => {
            setError("");
            setAddingConnection(true);
          }}
          onDisconnect={() => disconnectConnection(false)}
          onDeleteConnection={() => disconnectConnection(true)}
          connectionAppearance={connectionAppearance}
          onSaveConnectionAppearance={(value) => {
            if (client.connection) saveConnectionAppearance(client.connection.environmentId, value);
          }}
          onReconnect={() => void reconnect()}
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
          preferencePanel={preferencePanel}
          onPreferencePanelChange={setPreferencePanel}
          activity={activity}
          appUpdates={appUpdates}
        />
      ) : view === "home" ? (
        <MobileHome
          key={client.connection?.environmentId}
          projects={projects}
          project={homeProject}
          hostName={connectionName}
          hostStatus={hostStatus}
          foreground={foreground}
          inactive={drawerOpen || homeMenuOpen || addingConnection || sessionActionsOpen}
          query={searchOpen ? searchQuery : ""}
          now={now}
          unreadIds={activity.unreadIds}
          loadSessions={onDrawerLoadSessions}
          onProject={onDrawerProject}
          onSession={onDrawerSession}
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
            if (owner) onDrawerNewSession(owner);
          }}
          onAddProject={openAddProject}
        />
      ) : (
        <main className="mobile-chat" inert={drawerOpen}>
          {snapshot ? (
            <MobileTranscript
              key={snapshot.session.id}
              snapshot={snapshot}
              animateFrom={animateFrom}
              readBinaryFile={readHostImage}
              disabled={busy || !!pending || !sessionConfirmed}
              onCommand={onTranscriptCommand}
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
            {translate("Imported native conversations continue on the desktop.")}
          </p> : null}
          {project && <MobileComposer
            queue={
              <MobileMessageQueue
                key={snapshot?.session.id}
                {...queue}
                onOverlayChange={onQueueOverlayChange}
                onRestore={restoreQueuedMessage}
                disabled={nativeReadOnly || busy || !!pending || loading || !sessionConfirmed}
              />
            }
            value={draft}
            skillsContextKey={skillContextKey}
            loadSkills={loadSkillCatalog}
            canCompact={!!snapshot && snapshot.status === "idle" && !nativeReadOnly && ["codex", "claude", "grok", "opencode", "pi", "omp"].includes(snapshot.session.harness)}
            onChange={setDraft}
            configuration={
              snapshot ? configurationForSession(snapshot) : configuration
            }
            catalog={catalog}
            lockedAgent={!!sessionId}
            disabled={
              nativeReadOnly ||
              busy ||
              !!pending ||
              (running && !snapshot?.supportsQueue) ||
              readingAttachments ||
              loading ||
              (!!sessionId && !sessionConfirmed) ||
              (!!sessionId && !snapshot)
            }
            working={busy || readingAttachments}
            running={running}
            canSend={
              !nativeReadOnly &&
              !busy &&
              !pending &&
              !readingAttachments &&
              !loading &&
              (!sessionId || sessionConfirmed) &&
              (!running || !!snapshot?.supportsQueue) &&
              (!!draft.trim() || attachments.length > 0) &&
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
              if (!sessionId) setConfiguration(next);
              else
                void dispatch({
                  type: "configure",
                  commandId: crypto.randomUUID(),
                  sessionId,
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

      {connected && view !== "settings" && (
        <MobileDrawer
          open={drawerOpen}
          onOpenChange={onDrawerOpenChange}
          projects={projects}
          project={project}
          sessions={sessions}
          sessionId={sessionId}
          loading={historyLoading}
          unreadIds={activity.unreadIds}
          now={now}
          hostName={connectionName}
          hostStatus={hostStatus}
          projectTrigger={projectTrigger}
          loadSessions={onDrawerLoadSessions}
          onAddProject={onDrawerAddProject}
          onHome={onDrawerHome}
          onAllProjects={onDrawerAllProjects}
          onProject={onDrawerProject}
          onSession={onDrawerSession}
          sessionActionsId={sessionActionsOpen ? sessionActionsTarget : undefined}
          onSessionActions={onDrawerSessionActions}
          onNewSession={onDrawerNewSession}
          onSettings={onDrawerSettings}
        />
      )}
      {(view === "chat" || view === "home") &&
        (sessionActionsTarget ? sessionActionsSummary : snapshot) && (
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
      )}
      {sessionStatusOpen && view === "chat" && snapshot && (
        <MobileSessionStatus
          snapshot={snapshot}
          catalog={catalog}
          hostName={connectionName}
          hostStatus={hostStatus}
          anchor={sessionStatusTrigger}
          onClose={() => setSessionStatusOpen(false)}
        />
      )}
      <MobileHomeMenu
        open={homeMenuOpen && view === "home" && !drawerOpen}
        anchor={homeMenuTrigger}
        onClose={() => setHomeMenuOpen(false)}
        onAddConnection={() => {
          connectionTrigger.current = homeMenuTrigger.current;
          setHomeMenuOpen(false);
          setError("");
          setAddingConnection(true);
        }}
        onSettings={() => navigate("settings")}
      />
      {addingConnection && (
        <MobileConnectionSheet
          anchor={connectionTrigger}
          url={url}
          token={token}
          disabled={busy || loading}
          error={error}
          onUrlChange={setUrl}
          onTokenChange={setToken}
          onConnect={() => void connect()}
          onClose={() => {
            if (!busy) {
              setAddingConnection(false);
              setToken("");
              setError("");
            }
          }}
        />
      )}
      {addingProject && (
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
      )}
    </div>
  );
}
