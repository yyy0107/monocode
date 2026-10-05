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
} from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  ArrowLeft,
  Chatting,
  Computer,
  Folder,
  FolderPlus,
  LoaderCircle,
  PanelLeft,
  RefreshCw,
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
// The conversation is the home screen; projects and history live in the
// drawer. Settings doubles as the connection screen before pairing.
type View = "chat" | "settings";
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
}: {
  label: string;
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      className="mobile-icon-button"
      type="button"
      aria-label={t(label)}
      title={t(label)}
      onClick={onClick}
      disabled={disabled}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<MobileSettingsPage>("root");
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
  const acceptedQueueAttachments = useRef<Attachment[]>([]);
  const parkedDrafts = useRef<Array<{
    text: string;
    attachments: Attachment[];
    planMode: boolean;
    accepted: Attachment[];
  }>>([]);
  const [composerPanel, setComposerPanel] = useState<MobileComposerPanel>(null);
  const [sessionActionsOpen, setSessionActionsOpen] = useState(false);
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
    if (!foreground || !drawerOpen) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [foreground, drawerOpen]);

  useEffect(() => {
    if (!connected || !foreground || (view !== "chat" && !drawerOpen)) return;
    let live = true;
    const turn = navigation.current;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    setPollError("");
    const poll = async () => {
      let running = false;
      try {
        let listRunning = false;
        if (drawerOpen) {
          const [items, history] = await Promise.all([
            client.projects(),
            project ? client.sessions(project.id) : undefined,
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
    if (!connected || !environmentId || !project) return;
    saveLastLocation({
      environmentId,
      projectId: project.id,
      ...(sessionId ? { sessionId } : {}),
    });
  }, [connected, project?.id, sessionId]);

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
  // Launch and reconnect return to the last project and conversation; a
  // conversation deleted elsewhere falls back to a new one in that project.
  const restoreLocation = async (items: HostProject[]) => {
    const last = readLastLocation(client.connection?.environmentId);
    const target =
      items.find((item) => item.id === last?.projectId) ?? items[0];
    setView("chat");
    setSettingsPage("root");
    if (!target) return;
    const historyRequest = openProject(target);
    if (last?.sessionId && target.id === last.projectId) {
      const turn = navigation.current + 1;
      // History adds branch metadata with Git processes. Restore the pinned
      // conversation directly while history is prepared for the drawer.
      const sessionRequest = openSession(last.sessionId, target.id);
      const history = await historyRequest;
      if (navigation.current === turn && history &&
          !history.some((item) => item.id === last.sessionId && !item.archived))
        await openSession();
      await sessionRequest;
    } else await historyRequest;
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
      await openProject(added);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: View) => {
    navigation.current += 1;
    setLoading(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setPreferencePanel(null);
    setDrawerOpen(false);
    setSettingsPage("root");
    setView(next);
  };
  const updateSessionMetadata = async (
    patch: MobileSessionPatch,
    id = sessionId,
  ) => {
    if (!project || !id) return;
    const turn = navigation.current;
    setBusy(true);
    try {
      const summary = await client.updateSession(project.id, id, patch);
      const result = id === sessionId ? await client.session(id, summary.revision) : undefined;
      if (navigation.current === turn) {
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
      else if (view === "settings" && settingsPage !== "root")
        setSettingsPage("root");
      else if (view === "settings" && connected) navigate("chat");
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
  ]);

  const running = snapshot?.status === "running";
  const sessionActionsSummary = sessions.find(
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
  // Every view uses floating capsule controls; content scrolls beneath them.
  const floatingHeader = true;
  const title =
    view === "chat"
      ? (snapshot &&
          sessionDisplayTitle(
            snapshot.session.title,
            snapshot.session.harness,
          )) ||
        t("New conversation")
      : t(mobileSettingsTitle(settingsPage));
  // Memoized children (transcript, drawer) get handlers that keep their
  // identity, so typing in the composer does not re-render them.
  const onTranscriptCommand = useStableCallback((command: HostCommand) => {
    void dispatch(command);
  });
  const onDrawerOpenChange = useStableCallback((open: boolean) => {
    if (open) setComposerPanel(null);
    setDrawerOpen(open);
  });
  const onDrawerProject = useStableCallback((item: HostProject) => {
    void openProject(item);
  });
  const onDrawerAddProject = useStableCallback(() => {
    setError("");
    setAddingProject(true);
  });
  const onDrawerSession = useStableCallback((id?: string) => {
    void openSession(id);
  });
  const onDrawerNewSession = useStableCallback(() => {
    void openSession();
  });
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
  return (
    <div ref={appRoot} className="mobile-app" data-view={view}>
      <header className="mobile-header" data-floating={floatingHeader}>
        {view === "chat" ? (
          <IconButton
            label="Menu"
            onClick={() => {
              setComposerPanel(null);
              setDrawerOpen(true);
            }}
          >
            <PanelLeft size={22} />
          </IconButton>
        ) : connected || settingsPage !== "root" ? (
          <IconButton
            label="Back"
            onClick={() =>
              settingsPage !== "root"
                ? setSettingsPage("root")
                : navigate("chat")
            }
          >
            <ArrowLeft size={22} />
          </IconButton>
        ) : (
          <span className="mobile-header-logo">
            <img className="mobile-logo" src="/monocode.png" alt="MonoCode" />
          </span>
        )}
        <div className="mobile-header-title" data-capsule={floatingHeader}>
          <strong>{title}</strong>
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
                  <span>{client.connection.name}</span>
                  <MobileHostStatus status={hostStatus} />
                </span>
              )}
            </div>
          ) : (
            <span className="mobile-header-host">
              <span>{client.connection?.name || "MonoCode"}</span>
              {client.connection && <MobileHostStatus status={hostStatus} />}
            </span>
          )}
        </div>
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
          connected={connected}
          connection={
            client.connection
              ? {
                  name: client.connection.name,
                  endpoint: client.connection.endpoint,
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
          onDisconnect={() => {
            navigation.current += 1;
            projectGeneration.current += 1;
            setBusy(true);
            void client
              .disconnect()
              .then(() => {
                setConnected(false);
                setProjects([]);
                setProject(undefined);
                setSessions([]);
                setSnapshot(undefined);
                setSessionConfirmed(false);
                setHistoryLoading(false);
                setSessionId(undefined);
                setError("");
              })
              .catch((problem) => setError(message(problem)))
              .finally(() => setBusy(false));
          }}
          theme={theme}
          onThemeChange={setTheme}
          glass={glass}
          onGlassChange={setGlass}
          language={language}
          onLanguageChange={setUiLanguage}
          preferencePanel={preferencePanel}
          onPreferencePanelChange={setPreferencePanel}
          activity={activity}
          appUpdates={appUpdates}
        />
      ) : (
        <main className="mobile-chat">
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
                disabled={!!snapshot?.session.nativeSession || busy || !!pending || loading || !sessionConfirmed}
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

      {connected && view === "chat" && (
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
          hostName={client.connection?.name || "MonoCode"}
          hostStatus={hostStatus}
          projectTrigger={projectTrigger}
          onProject={onDrawerProject}
          onAddProject={onDrawerAddProject}
          onSession={onDrawerSession}
          sessionActionsId={sessionActionsOpen ? sessionActionsTarget : undefined}
          onSessionActions={onDrawerSessionActions}
          onNewSession={onDrawerNewSession}
          onSettings={onDrawerSettings}
        />
      )}
      {sessionActionsOpen &&
        view === "chat" &&
        (sessionActionsTarget ? sessionActionsSummary : snapshot) && (
        <MobileSessionActions
          key={sessionActionsTarget ?? sessionId ?? "draft"}
          snapshot={sessionActionsTarget ? undefined : snapshot}
          summary={sessionActionsSummary}
          anchor={sessionActionsTrigger}
          anchorPoint={sessionActionsPoint}
          disabled={busy || loading || !!pending}
          onUpdate={(patch) =>
            updateSessionMetadata(patch, sessionActionsTarget ?? sessionId)
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
            setSessionActionsTarget(undefined);
            setSessionActionsPoint(undefined);
          }}
        />
      )}
      {sessionStatusOpen && view === "chat" && snapshot && (
        <MobileSessionStatus
          snapshot={snapshot}
          catalog={catalog}
          hostName={client.connection?.name || "MonoCode"}
          hostStatus={hostStatus}
          anchor={sessionStatusTrigger}
          onClose={() => setSessionStatusOpen(false)}
        />
      )}
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
          hostName={client.connection?.name || "MonoCode"}
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
