import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  Globe,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "../shared/ui/icons";
import type { Attachment } from "../features/sessions/model/session";
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
} from "./client";
import { MobileComposer, type MobileComposerPanel } from "./MobileComposer";
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
  error instanceof Error ? error.message : "Unable to reach this Host.";
function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="mobile-icon-button"
      type="button"
      aria-label={label}
      title={label}
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
  return (
    <div className="mobile-empty">
      <div className="mobile-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function MobileApp() {
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
  const [folderPath, setFolderPath] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [pending, setPending] = useState<PendingCommand>();
  const [foreground, setForeground] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("monocode-mobile-theme") || "dark",
  );
  const navigation = useRef(0);
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
          if (live) setSnapshot(result);
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
  const send = async () => {
    if (
      !project ||
      (!draft.trim() && !attachments.length) ||
      busy ||
      pending ||
      readingAttachments ||
      snapshot?.status === "running"
    )
      return;
    if (
      !sessionId &&
      !catalog?.models[configuration.harness]?.some(
        (item) => item.id === configuration.model,
      )
    ) {
      setError(
        "No available model. Install and sign in to a provider on this Host.",
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
    setView(next);
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (composerPanel) setComposerPanel(null);
      else if (addingProject) setAddingProject(false);
      else if (view === "chat") navigate("sessions");
      else if (view === "sessions" || (view === "connection" && connected))
        navigate("projects");
      else void App.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [view, connected, addingProject, composerPanel]);

  const running = snapshot?.status === "running";
  const title =
    view === "chat"
      ? snapshot?.session.title || "New conversation"
      : view === "sessions"
        ? project?.name || "Conversations"
        : view === "projects"
          ? "Projects"
          : "Connections";
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
        <div className="mobile-header-title">
          <strong>{title}</strong>
          <span>
            {view === "chat"
              ? project?.name
              : connected
                ? client.connection?.name
                : "MonoCode"}
          </span>
        </div>
        {view === "projects" ? (
          <IconButton
            label="Open project"
            onClick={() => setAddingProject(true)}
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
            label="New conversation"
            onClick={() => void openSession()}
            disabled={busy}
          >
            <Plus size={20} />
          </IconButton>
        ) : (
          <span className="mobile-connection-dot" data-connected={connected} />
        )}
      </header>

      {(error || pollError) && (
        <div className="mobile-error" role="alert">
          <span>{error || pollError}</span>
          {connected && (
            <IconButton
              label="Reconnect"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void client
                  .verify()
                  .then(() => {
                    setError("");
                    setPollError("");
                  })
                  .catch((problem) => setError(message(problem)))
                  .finally(() => setBusy(false));
              }}
            >
              <RefreshCw size={16} />
            </IconButton>
          )}
        </div>
      )}
      {pending && connected && (
        <div className="mobile-pending" role="status">
          <span>A request is awaiting confirmation.</span>
          <button disabled={busy} onClick={() => void dispatch()}>
            Retry
          </button>
        </div>
      )}

      {view === "connection" ? (
        <main className="mobile-content mobile-connections">
          <h1>Connect to your computer</h1>
          <p className="mobile-muted">
            Continue your projects and conversations from your phone.
          </p>
          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label>
              Host URL
              <input
                type="url"
                placeholder="http://192.168.1.10:3774"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={busy || loading}
              />
            </label>
            <label>
              Device token
              <input
                type="password"
                placeholder="Paste your device token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                required
                disabled={busy || loading}
              />
            </label>
            <button
              className="mobile-button mobile-primary"
              type="submit"
              disabled={busy || loading || !url.trim() || !token.trim()}
            >
              {busy || loading ? (
                <>
                  <LoaderCircle size={16} className="mobile-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Globe size={16} />
                  Connect by URL
                </>
              )}
            </button>
          </form>
          {connected && (
            <div className="mobile-current-host">
              <span className="mobile-connection-dot" data-connected="true" />
              <div>
                <strong>{client.connection?.name}</strong>
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
                Disconnect
              </button>
            </div>
          )}
          <div className="mobile-appearance">
            <label htmlFor="mobile-theme">Appearance</label>
            <select
              id="mobile-theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
          <MobileAppUpdates state={appUpdates} />
        </main>
      ) : view === "projects" ? (
        <main className="mobile-content">
          <p className="mobile-section-label">
            Your projects <span>{projects.length}</span>
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
              Add a folder from your connected computer to get started.
              <button
                className="mobile-button"
                onClick={() => setAddingProject(true)}
              >
                <FolderPlus size={16} />
                Open project
              </button>
            </Empty>
          )}
        </main>
      ) : view === "sessions" ? (
        <main className="mobile-content">
          {loading ? (
            <div className="mobile-loading">
              <LoaderCircle className="mobile-spin" size={20} />
              Loading conversations…
            </div>
          ) : sessions.some((item) => !item.archived) ? (
            <div className="mobile-list">
              {sessions
                .filter((item) => !item.archived)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((item) => (
                  <button
                    className="mobile-list-row"
                    key={item.id}
                    onClick={() => void openSession(item.id)}
                  >
                    <span className="mobile-row-text">
                      <strong>{item.title || "Untitled conversation"}</strong>
                      <small>
                        {item.harness} ·{" "}
                        {new Date(item.updatedAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </small>
                    </span>
                    {item.status === "running" ? (
                      <LoaderCircle size={16} className="mobile-spin" />
                    ) : item.needsInput ? (
                      <span className="mobile-attention-dot" />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              icon={<MessageSquare size={28} />}
              title="No conversations yet"
            >
              Start a conversation in {project?.name}.
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
              Loading conversation…
            </div>
          ) : (
            <Empty
              icon={<MessageSquare size={30} />}
              title={
                sessionId
                  ? "Conversation unavailable"
                  : "What shall we work on?"
              }
            >
              {sessionId
                ? "Check your connection and retry."
                : `Start a conversation in ${project?.name || "your project"}.`}
            </Empty>
          )}
          <MobileComposer
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
              running ||
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
              !running &&
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
            hostName={client.connection?.name}
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
        <nav className="mobile-navigation" aria-label="Main navigation">
          <button
            className={view === "projects" ? "is-selected" : ""}
            onClick={() => navigate("projects")}
          >
            <Folder size={20} />
            <span>Projects</span>
          </button>
          <button
            className={view === "sessions" ? "is-selected" : ""}
            disabled={!project}
            onClick={() => navigate("sessions")}
          >
            <MessageSquare size={20} />
            <span>Conversations</span>
          </button>
          <button
            className={view === "connection" ? "is-selected" : ""}
            onClick={() => navigate("connection")}
          >
            <Settings size={20} />
            <span>Connections</span>
          </button>
        </nav>
      )}
      {addingProject && (
        <div className="mobile-modal-backdrop">
          <section
            className="mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-project-title"
          >
            <div className="mobile-modal-title">
              <h2 id="open-project-title">Open project</h2>
              <IconButton
                label="Close"
                disabled={busy}
                onClick={() => setAddingProject(false)}
              >
                <X size={18} />
              </IconButton>
            </div>
            <p className="mobile-muted">
              Enter a folder path on {client.connection?.name}.
            </p>
            <form
              className="mobile-form"
              onSubmit={(event) => {
                event.preventDefault();
                void addProject();
              }}
            >
              <label>
                Folder path
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
                {busy ? "Opening…" : "Open project"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
