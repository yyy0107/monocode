import { useHostQueue } from "../features/connections/ui/useHostQueue";
import { MessageQueue } from "../features/sessions/ui/MessageQueue";
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
  ChevronRight,
  Computer,
  Folder,
  FolderPlus,
  LoaderCircle,
  MoreHorizontal,
  Internet,
  Plus,
  RefreshCw,
} from "../shared/ui/icons";
import {
  sessionDisplayTitle,
  type Attachment,
} from "../features/sessions/model/session";
import type {
  HostProject,
  HostSession,
  HostSessionSummary,
  HostCommand,
} from "../features/connections/model/protocol";
import { MobileTranscript } from "./MobileTranscript";
import { MobileAppUpdates, useMobileAppUpdates } from "./MobileAppUpdates";
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
import { MobileConnectionSheet } from "./MobileConnectionSheet";
import { MobileSelect } from "./MobileSelect";
import { MobileSheet } from "./MobileSheet";
import { formatMobileRelativeTime } from "./relativeTime";
import { MobileHostStatus } from "./MobileHostStatus";
import { useHostConnectionStatus } from "./useHostConnectionStatus";
import { useTranslation } from "../shared/i18n/useTranslation";
import { setUiLanguage, translate } from "../shared/i18n/language";
import { readMobileAttachments } from "./attachments";
import { mobileStorage } from "./storage";
import {
  applyThemePreference,
  saveThemePreference,
} from "../features/settings/model/appearance";

const client = new MobileClient(mobileStorage);
const readHostImage = (path: string) => client.readBinaryFile(path);
type View = "connection" | "projects" | "sessions" | "chat";
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
  const [view, setView] = useState<View>("connection");
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
  const [composerPanel, setComposerPanel] = useState<MobileComposerPanel>(null);
  const [sessionActionsOpen, setSessionActionsOpen] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [addingConnection, setAddingConnection] = useState(false);
  const [preferencePanel, setPreferencePanel] = useState<
    "theme" | "language" | null
  >(null);
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
  const navigation = useRef(0);
  const queueView = useRef({ view, sessionId });
  queueView.current = { view, sessionId };
  const connectionTrigger = useRef<HTMLButtonElement>(null);
  const projectTrigger = useRef<HTMLButtonElement>(null);
  const sessionActionsTrigger = useRef<HTMLButtonElement>(null);
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
    let live = true;
    void (async () => {
      try {
        if (await client.restore()) {
          const items = await client.projects();
          if (live) {
            setConnected(true);
            setProjects(items);
            setView("projects");
            setUrl(client.connection!.endpoint);
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
    if (!foreground || view !== "sessions") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [foreground, view]);

  useEffect(() => {
    if (!connected || !foreground || view === "connection") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    setPollError("");
    const poll = async () => {
      let running = false;
      try {
        if (view === "projects") {
          const result = await client.projects();
          if (live) setProjects(result);
        } else if (view === "sessions" && project) {
          const result = await client.sessions(project.id);
          if (live) setSessions(result);
          running = result.some((item) => item.status === "running");
        } else if (view === "chat" && sessionId) {
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
              ? view === "chat"
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
  }, [connected, foreground, view, project, sessionId, snapshot?.status]);

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
      setPlanMode(false);
      setToken("");
      setUrl(client.connection!.endpoint);
      setProjects(items);
      setConnected(true);
      setAddingConnection(false);
      setView("projects");
      setPending(await client.pending());
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  };
  const openProject = async (
    item: HostProject,
    nextView: View = "sessions",
  ) => {
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
    } catch (problem) {
      if (navigation.current === turn) setError(message(problem));
    } finally {
      if (navigation.current === turn) setLoading(false);
    }
  };
  const openSession = async (id?: string) => {
    const turn = ++navigation.current;
    setSessionId(id);
    setSnapshot(undefined);
    setAnimateFrom(undefined);
    setDraft("");
    setAttachments([]);
    setPlanMode(false);
    setComposerPanel(null);
    setSessionActionsOpen(false);
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
          setDraft("");
          setAttachments([]);
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
  const send = async () => {
    if (
      !project ||
      (!draft.trim() && !attachments.length) ||
      busy ||
      pending ||
      readingAttachments ||
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
      const uploaded = await client.uploadAttachments(attachments);
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
    setView(next);
  };
  const updateSessionMetadata = async (patch: MobileSessionPatch) => {
    if (!project || !sessionId) return;
    const turn = navigation.current;
    const id = sessionId;
    setBusy(true);
    try {
      const summary = await client.updateSession(project.id, id, patch);
      const result = await client.session(id);
      if (navigation.current === turn) {
        setSnapshot((previous) =>
          previous && previous.revision > result.revision ? previous : result,
        );
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
        navigate("sessions");
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
        setProjects(await client.projects());
        setConnected(true);
        setView("projects");
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
      if (sessionActionsOpen) {
        if (!busy) setSessionActionsOpen(false);
      } else if (preferencePanel) setPreferencePanel(null);
      else if (addingConnection) {
        if (!busy) setAddingConnection(false);
      } else if (composerPanel) setComposerPanel(null);
      else if (addingProject) {
        if (!busy) setAddingProject(false);
      } else if (view === "chat") navigate("sessions");
      else if (view === "sessions" || (view === "connection" && connected))
        navigate("projects");
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
    busy,
  ]);

  const running = snapshot?.status === "running";
  const title =
    view === "chat"
      ? (snapshot &&
          sessionDisplayTitle(
            snapshot.session.title,
            snapshot.session.harness,
          )) ||
        t("New conversation")
      : view === "sessions"
        ? project?.name || t("Conversations")
        : view === "projects"
          ? t("Projects")
          : t("Connections");
  return (
    <div className="mobile-app">
      <header className="mobile-header">
        {view === "chat" || view === "sessions" ? (
          <IconButton
            label="Back"
            onClick={() => navigate(view === "chat" ? "sessions" : "projects")}
          >
            <ArrowLeft size={20} />
          </IconButton>
        ) : (
          <img className="mobile-logo" src="/monocode.png" alt="MonoCode" />
        )}
        <div className="mobile-header-title" data-capsule={view === "chat"}>
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
        {view === "projects" ? (
          <IconButton
            label="Open project"
            onClick={(event) => {
              projectTrigger.current = event.currentTarget;
              setAddingProject(true);
            }}
          >
            <FolderPlus size={20} />
          </IconButton>
        ) : view === "sessions" ? (
          <IconButton
            label="New conversation"
            onClick={() => void openSession()}
          >
            <Plus size={20} />
          </IconButton>
        ) : view === "chat" ? (
          <IconButton
            label="Session actions"
            onClick={(event) => {
              sessionActionsTrigger.current = event.currentTarget;
              setComposerPanel(null);
              setSessionActionsOpen(true);
            }}
            disabled={busy || loading}
          >
            <MoreHorizontal size={22} />
          </IconButton>
        ) : null}
      </header>

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

      {view === "connection" ? (
        <main className="mobile-content mobile-connections">
          <button
            className="mobile-button mobile-primary mobile-add-connection"
            ref={connectionTrigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={addingConnection}
            disabled={busy || loading}
            onClick={() => {
              setError("");
              setAddingConnection(true);
            }}
          >
            <Plus size={18} />
            {t("Add connection")}
          </button>
          {client.connection && (
            <div className="mobile-current-host">
              <div>
                <strong className="mobile-current-host-name">
                  <span>{client.connection.name}</span>
                  <MobileHostStatus status={hostStatus} />
                </strong>
                <small>{client.connection?.endpoint}</small>
              </div>
              <button
                className="mobile-button"
                disabled={busy}
                onClick={() => {
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
              >
                {t("Disconnect")}
              </button>
            </div>
          )}
          <div className="mobile-appearance">
            <label htmlFor="mobile-theme">{t("Appearance")}</label>
            <MobileSelect
              id="mobile-theme"
              label={t("Appearance")}
              value={theme}
              open={preferencePanel === "theme"}
              onOpenChange={(open) => setPreferencePanel(open ? "theme" : null)}
              onChange={setTheme}
              options={[
                { value: "dark", label: t("Dark") },
                { value: "light", label: t("Light") },
                { value: "system", label: t("System") },
              ]}
            />
          </div>
          <div className="mobile-appearance mobile-language">
            <label htmlFor="mobile-language">{t("Language")}</label>
            <MobileSelect
              id="mobile-language"
              label={t("Language")}
              value={language}
              open={preferencePanel === "language"}
              onOpenChange={(open) =>
                setPreferencePanel(open ? "language" : null)
              }
              onChange={setUiLanguage}
              options={[
                { value: "en", label: "English" },
                { value: "zh-CN", label: "简体中文" },
              ]}
            />
          </div>
          <MobileAppUpdates state={appUpdates} />
        </main>
      ) : view === "projects" ? (
        <main className="mobile-content">
          <p className="mobile-section-label">
            {t("Your projects")} <span>{projects.length}</span>
          </p>
          {projects.length ? (
            <div className="mobile-list">
              {projects.map((item) => (
                <button
                  className="mobile-list-row"
                  key={item.id}
                  onClick={() => void openProject(item)}
                >
                  <span className="mobile-row-icon">
                    <Folder size={21} />
                  </span>
                  <span className="mobile-row-text">
                    <strong>{item.name}</strong>
                    <small>{item.cwd}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <Empty icon={<Folder size={28} />} title="Open your first project">
              {t("Add a folder from your connected computer to get started.")}
              <button
                className="mobile-button"
                onClick={(event) => {
                  projectTrigger.current = event.currentTarget;
                  setAddingProject(true);
                }}
              >
                <FolderPlus size={16} />
                {t("Open project")}
              </button>
            </Empty>
          )}
        </main>
      ) : view === "sessions" ? (
        <main className="mobile-content">
          {loading ? (
            <div className="mobile-loading">
              <LoaderCircle className="mobile-spin" size={20} />
              {t("Loading conversations…")}
            </div>
          ) : sessions.some((item) => !item.archived) ? (
            <div className="mobile-list mobile-session-list">
              {sessions
                .filter((item) => !item.archived)
                .sort(
                  (a, b) =>
                    Number(!!b.pinned) - Number(!!a.pinned) ||
                    b.updatedAt - a.updatedAt,
                )
                .map((item) => (
                  <button
                    className="mobile-list-row mobile-session-row"
                    key={item.id}
                    onClick={() => void openSession(item.id)}
                  >
                    <span className="mobile-row-text">
                      <strong>
                        {sessionDisplayTitle(item.title, item.harness) ||
                          t("Untitled conversation")}
                      </strong>
                      <small>
                        {item.status === "running" ? (
                          <LoaderCircle size={16} className="mobile-spin" />
                        ) : item.needsInput ? (
                          <span className="mobile-attention-dot" />
                        ) : null}
                        <span>
                          {item.harness} ·{" "}
                          {formatMobileRelativeTime(
                            item.updatedAt,
                            now,
                            language,
                          )}
                        </span>
                      </small>
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <Empty icon={<Chatting size={28} />} title="No conversations yet">
              {t("Start a conversation in {project}.", {
                project: project?.name || t("your project"),
              })}
            </Empty>
          )}
        </main>
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
          <MobileComposer
            queue={
              <MessageQueue
                key={snapshot?.session.id}
                {...queue}
                disabled={busy || !!pending || loading}
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
          />
        </main>
      )}

      {connected && view !== "chat" && (
        <nav className="mobile-navigation" aria-label={t("Main navigation")}>
          <button
            className={view === "projects" ? "is-selected" : ""}
            onClick={() => navigate("projects")}
          >
            <Folder size={20} />
            <span>{t("Projects")}</span>
          </button>
          <button
            className={view === "sessions" ? "is-selected" : ""}
            disabled={!project}
            onClick={() => navigate("sessions")}
          >
            <Chatting size={20} />
            <span>{t("Conversations")}</span>
          </button>
          <button
            className={view === "connection" ? "is-selected" : ""}
            onClick={() => navigate("connection")}
          >
            <Internet size={20} />
            <span>{t("Connections")}</span>
          </button>
        </nav>
      )}
      {sessionActionsOpen && view === "chat" && (
        <MobileSessionActions
          key={sessionId ?? "draft"}
          snapshot={snapshot}
          anchor={sessionActionsTrigger}
          disabled={busy || loading || !!pending}
          onUpdate={updateSessionMetadata}
          onDelete={deleteCurrentSession}
          onNew={() => void openSession()}
          onClose={() => setSessionActionsOpen(false)}
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
