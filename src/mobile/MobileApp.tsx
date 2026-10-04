import { useHostQueue } from "../features/connections/ui/useHostQueue";
import { MobileMessageQueue } from "./MobileMessageQueue";
import {
  useCallback,
  useEffect,
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
import { MobileConnectionSheet } from "./MobileConnectionSheet";
import { MobileSheet, type MobileSheetPoint } from "./MobileSheet";
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
  const [folderPath, setFolderPath] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [addingConnection, setAddingConnection] = useState(false);
  const [preferencePanel, setPreferencePanel] =
    useState<MobilePreferencePanel>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
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
        if (await client.restore()) {
          const items = await client.projects();
          if (live) {
            setConnected(true);
            setProjects(items);
            setUrl(client.connection!.endpoint);
            await restoreLocation(items);
          }
        }
        if (live) setPending(await client.pending());
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
          if (live) {
            setProjects(items);
            if (history) setSessions(history);
          }
          listRunning = !!history?.some((item) => item.status === "running");
        }
        if (view === "chat" && sessionId) {
          const result = await client.session(sessionId);
          if (live)
            setSnapshot((previous) =>
              previous &&
              previous.session.id === result.session.id &&
              previous.revision > result.revision
                ? previous
                : result,
            );
          running = result.status === "running";
        }
        if (!running && listRunning) running = true;
        if (live) {
          failures = 0;
          setPollError("");
          setPending(await client.pending());
        }
      } catch (problem) {
        if (live) {
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
    setCatalog(undefined);
    setSessionId(undefined);
    setSnapshot(undefined);
    setAnimateFrom(undefined);
    setComposerPanel(null);
    setSessionActionsOpen(false);
    setView(nextView);
    setLoading(true);
    setError("");
    try {
      const [history, catalog] = await Promise.all([
        client.sessions(item.id),
        client.models(item.id),
      ]);
      if (projectGeneration.current !== projectTurn) return;
      setSessions(history);
      setCatalog(catalog);
      const first = firstConfiguration(catalog);
      setConfiguration(
        first ?? {
          harness: "codex",
          model: "",
          modelSettings: {},
          runtimeMode: "supervised",
        },
      );
      return history;
    } catch (problem) {
      if (navigation.current === turn) setError(message(problem));
    } finally {
      if (navigation.current === turn) setLoading(false);
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
    const turn = navigation.current + 1;
    const history = await openProject(target);
    if (
      navigation.current === turn &&
      last?.sessionId &&
      target.id === last.projectId &&
      history?.some((item) => item.id === last.sessionId && !item.archived)
    )
      await openSession(last.sessionId);
  };
  const openSession = async (id?: string) => {
    const turn = ++navigation.current;
    setSessionId(id);
    setSnapshot(undefined);
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
        setSnapshot(result);
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
    visibleSession: view === "chat" && !drawerOpen && !loading && snapshot && snapshot.session.id === sessionId
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
        const result = await client.session(receipt.sessionId);
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
        const result = await client.session(command.sessionId);
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
  const restoreQueuedMessage = async (queued: QueuedMessage) => {
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
  };
  const send = async () => {
    if (
      !project ||
      (!draft.trim() && !attachments.length) ||
      busy ||
      pending ||
      readingAttachments ||
      !!snapshot?.session.nativeSession ||
      (snapshot?.status === "running" && !snapshot.supportsQueue)
    )
      return;
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
        text: draft,
        ...(uploaded.length ? { attachments: uploaded } : {}),
        ...(planMode ? { intent: "plan" } : {}),
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
  const addProject = async () => {
    setBusy(true);
    setError("");
    try {
      const added = await client.openProject(folderPath);
      const items = await client.projects();
      setProjects(items);
      setAddingProject(false);
      setFolderPath("");
      await openProject(added);
    } catch (problem) {
      setError(message(problem));
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
      const result = id === sessionId ? await client.session(id) : undefined;
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
  const contextRing = loading ? null : contextRatio(snapshot?.session.context);
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
  const openAddProject = (trigger: HTMLButtonElement) => {
    projectTrigger.current = trigger;
    setError("");
    setAddingProject(true);
  };
  return (
    <div className="mobile-app" data-view={view}>
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
                if (!snapshot || loading) return;
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
                if (!snapshot || loading) return;
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
              disabled={busy || !!pending}
              onCommand={(command) => void dispatch(command)}
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
                disabled={!!snapshot?.session.nativeSession || busy || !!pending || loading}
              />
            }
            value={draft}
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
              (!running || !!snapshot?.supportsQueue) &&
              (!!draft.trim() || attachments.length > 0) &&
              (sessionId
                ? !!snapshot
                : !!catalog?.models[configuration.harness]?.some(
                    (model) => model.id === configuration.model,
                  ))
            }
            canStop={!busy && !pending && !!snapshot?.runId}
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
          onOpenChange={(open) => {
            if (open) setComposerPanel(null);
            setDrawerOpen(open);
          }}
          projects={projects}
          project={project}
          sessions={sessions}
          sessionId={sessionId}
          loading={loading}
          unreadIds={activity.unreadIds}
          now={now}
          hostName={client.connection?.name || "MonoCode"}
          hostStatus={hostStatus}
          projectTrigger={projectTrigger}
          onProject={(item) => void openProject(item)}
          onAddProject={() => {
            setError("");
            setAddingProject(true);
          }}
          onSession={(id) => void openSession(id)}
          sessionActionsId={sessionActionsOpen ? sessionActionsTarget : undefined}
          onSessionActions={(id, trigger, point) => {
            sessionActionsTrigger.current = trigger;
            setSessionActionsTarget(id);
            setSessionActionsPoint(point);
            setSessionActionsOpen(true);
          }}
          onNewSession={() => void openSession()}
          onSettings={() => navigate("settings")}
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
        <MobileSheet
          title="Open project"
          placement="anchor"
          anchor={projectTrigger}
          onClose={() => {
            if (!busy) setAddingProject(false);
          }}
        >
          <p className="mobile-muted">
            {t("Enter a folder path on {host}.", {
              host: client.connection?.name || "",
            })}
          </p>
          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault();
              void addProject();
            }}
          >
            <label>
              {t("Folder path")}
              <input
                autoFocus
                placeholder="/home/me/projects/my-app"
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={busy}
              />
            </label>
            {error && (
              <p className="mobile-form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="mobile-button mobile-primary"
              disabled={busy || !folderPath.trim()}
            >
              {t(busy ? "Opening…" : "Open project")}
            </button>
          </form>
        </MobileSheet>
      )}
    </div>
  );
}
