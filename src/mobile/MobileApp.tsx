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
import { Streamdown } from "streamdown";
import { boundedCode } from "../features/files/editor/codeHighlightPlugin";
import { harden } from "rehype-harden";
import { defaultRehypePlugins } from "streamdown";
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Folder,
  FolderPlus,
  Globe,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Square,
  Terminal,
  X,
} from "../shared/ui/icons";
import type { Block, RuntimeMode } from "../features/sessions/model/session";
import type { AgentModel } from "../features/sessions/model/models";
import type {
  HostProject,
  HostSession,
  HostSessionSummary,
  HostCommand,
  RemoteProvider,
} from "../features/connections/model/protocol";
import {
  buildQuestionReply,
  questionAnswersComplete,
  type UserQuestionPrompt,
  type UserQuestionReply,
} from "../features/sessions/model/userQuestion";
import { MobileClient, type PendingCommand } from "./client";
import { mobileStorage } from "./storage";

const client = new MobileClient(mobileStorage);
const markdownPlugins = { code: boundedCode };
const rehypePlugins = [
  defaultRehypePlugins.raw,
  defaultRehypePlugins.sanitize,
  [
    harden,
    {
      allowedImagePrefixes: [],
      allowedLinkPrefixes: ["https://", "http://", "mailto:"],
      imageBlockPolicy: "remove",
    },
  ],
];
type View = "connection" | "projects" | "sessions" | "chat";
const modes: Record<RuntimeMode, string> = {
  supervised: "Supervised",
  "auto-accept-edits": "Auto-accept edits",
  auto: "Auto",
  "full-access": "Full access",
};
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
function Markdown({ block }: { block: Block }) {
  return (
    <div className="agent-markdown mobile-markdown">
      <Streamdown
        plugins={markdownPlugins}
        rehypePlugins={
          rehypePlugins as Parameters<typeof Streamdown>[0]["rehypePlugins"]
        }
        isAnimating={!!block.streaming}
        mode={block.streaming ? "streaming" : "static"}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {block.text}
      </Streamdown>
    </div>
  );
}

function Question({
  prompt,
  disabled,
  onAnswer,
}: {
  prompt: UserQuestionPrompt;
  disabled: boolean;
  onAnswer: (reply: UserQuestionReply) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  return (
    <section className="mobile-question">
      <h3>{prompt.title || "Input needed"}</h3>
      {prompt.questions.map((question) => (
        <fieldset key={question.id} disabled={disabled}>
          <legend>{question.prompt}</legend>
          {question.options.map((option) => (
            <label className="mobile-option" key={option.id}>
              <input
                type={question.multiSelect ? "checkbox" : "radio"}
                name={question.id}
                checked={(answers[question.id] ?? []).includes(option.id)}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [question.id]: question.multiSelect
                      ? event.target.checked
                        ? [...(previous[question.id] ?? []), option.id]
                        : (previous[question.id] ?? []).filter(
                            (id) => id !== option.id,
                          )
                      : [option.id],
                  }))
                }
              />
              <span>
                {option.label}
                {option.description && <small>{option.description}</small>}
              </span>
            </label>
          ))}
          {question.allowCustom && (
            <input
              aria-label={`Custom answer: ${question.header || question.prompt}`}
              placeholder="Your answer…"
              value={custom[question.id] ?? ""}
              onChange={(event) =>
                setCustom((previous) => ({
                  ...previous,
                  [question.id]: event.target.value,
                }))
              }
            />
          )}
        </fieldset>
      ))}
      <div className="mobile-actions">
        <button
          className="mobile-button"
          disabled={disabled}
          onClick={() => onAnswer({ kind: "skipped" })}
        >
          Skip
        </button>
        <button
          className="mobile-button mobile-primary"
          disabled={
            disabled ||
            !questionAnswersComplete(prompt.questions, answers, custom)
          }
          onClick={() =>
            onAnswer(buildQuestionReply(prompt.questions, answers, custom))
          }
        >
          Submit
        </button>
      </div>
    </section>
  );
}

export function MobileTranscript({
  snapshot,
  disabled,
  onCommand,
}: {
  snapshot: HostSession;
  disabled: boolean;
  onCommand: (command: HostCommand) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const node = scroller.current;
    if (node && follow.current) node.scrollTop = node.scrollHeight;
  }, [snapshot.revision]);
  const { session, runId } = snapshot;
  const blocks = session.blocks.filter(
    (block) => !block.internal && block.role !== "handoff",
  );
  return (
    <div
      className="mobile-transcript"
      ref={scroller}
      onScroll={() => {
        const node = scroller.current!;
        follow.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 100;
      }}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
    >
      {blocks.length === 0 && (
        <Empty icon={<MessageSquare size={28} />} title="Start a conversation">
          Ask your agent to work on this project.
        </Empty>
      )}
      {blocks.map((block) => (
        <article
          className={`mobile-block mobile-block-${block.role}`}
          key={block.id}
        >
          {block.role === "user" ? (
            <div className="mobile-user-message">{block.text}</div>
          ) : block.role === "tool" && !block.approval ? (
            <details className="mobile-tool">
              <summary>
                <Terminal size={15} />
                <span>{block.tool?.title || block.text || "Tool"}</span>
                <small>{block.tool?.status}</small>
              </summary>
              <pre>
                {block.tool?.detail ||
                  block.tool?.preview?.output ||
                  block.text}
              </pre>
              {block.tool?.preview?.lines && (
                <pre>
                  {block.tool.preview.lines
                    .map(
                      (line) =>
                        `${line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "} ${line.text}`,
                    )
                    .join("\n")}
                </pre>
              )}
            </details>
          ) : block.role === "reasoning" ? (
            <details className="mobile-reasoning">
              <summary>{block.streaming ? "Thinking…" : "Thoughts"}</summary>
              <Markdown block={block} />
            </details>
          ) : block.role === "approval" || block.approval ? (
            <section className="mobile-approval">
              <h3>
                {block.approval?.decided
                  ? "Approval resolved"
                  : "Approval needed"}
              </h3>
              <pre>{block.text}</pre>
              {block.approval?.decided ? (
                <small>{block.approval.decided}</small>
              ) : (
                <div className="mobile-actions">
                  {(["deny", "allow"] as const).map((decision) => (
                    <button
                      key={decision}
                      className={`mobile-button ${decision === "allow" ? "mobile-primary" : ""}`}
                      disabled={disabled || !runId || !block.approval}
                      onClick={() =>
                        onCommand({
                          type: "approve",
                          commandId: crypto.randomUUID(),
                          sessionId: session.id,
                          runId: runId!,
                          requestId: block.approval!.requestId,
                          decision,
                        })
                      }
                    >
                      {decision === "allow" ? "Allow" : "Deny"}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : block.role === "tasks" ? (
            <section className="mobile-tasks">
              {block.taskList?.items.map((task, index) => (
                <div key={task.id || index}>
                  <span>
                    {task.status === "completed"
                      ? "✓"
                      : task.status === "in_progress"
                        ? "◉"
                        : "○"}
                  </span>
                  {task.text}
                </div>
              ))}
            </section>
          ) : block.role === "image" ? (
            <p className="mobile-muted">
              {block.image?.alt || block.image?.name || "Generated image"}
            </p>
          ) : (
            <Markdown block={block} />
          )}
        </article>
      ))}
      {session.pendingQuestion && (
        <Question
          key={`${runId}:${session.pendingQuestion.requestId}`}
          prompt={session.pendingQuestion}
          disabled={disabled || !runId}
          onAnswer={(reply) =>
            onCommand({
              type: "answer",
              commandId: crypto.randomUUID(),
              sessionId: session.id,
              runId: runId!,
              requestId: session.pendingQuestion!.requestId,
              reply,
            })
          }
        />
      )}
      {snapshot.status === "running" && (
        <div className="mobile-working">
          <LoaderCircle className="mobile-spin" size={14} />
          Working…
        </div>
      )}
      {snapshot.status === "interrupted" && (
        <p className="mobile-muted">
          The previous turn was interrupted. Send a message to continue.
        </p>
      )}
    </div>
  );
}

export function MobileApp() {
  const [view, setView] = useState<View>("connection");
  const [connected, setConnected] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<HostProject[]>([]);
  const [project, setProject] = useState<HostProject>();
  const [sessions, setSessions] = useState<HostSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<HostSession>();
  const [models, setModels] = useState<AgentModel[]>([]);
  const [model, setModel] = useState("");
  const [mode, setMode] = useState<RuntimeMode>("supervised");
  const [draft, setDraft] = useState("");
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
  const textArea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const light =
      theme === "light" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: light)").matches);
    const apply = (isLight: boolean) => {
      document.documentElement.classList.toggle("theme-light", isLight);
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
              ? 750
              : 3000,
        );
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [connected, foreground, view, project, sessionId]);

  useEffect(() => {
    const area = textArea.current;
    if (area) {
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
    }
  }, [draft]);

  const connect = async () => {
    setBusy(true);
    setError("");
    setPollError("");
    try {
      await client.connect(url, token);
      const items = await client.projects();
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
  const openProject = async (item: HostProject) => {
    const turn = ++navigation.current;
    setProject(item);
    setSessions([]);
    setModels([]);
    setSessionId(undefined);
    setSnapshot(undefined);
    setView("sessions");
    setLoading(true);
    setError("");
    try {
      const [history, catalog] = await Promise.all([
        client.sessions(item.id),
        client.models(item.id),
      ]);
      if (navigation.current !== turn) return;
      const available = Object.values(catalog.models).flatMap(
        (items) => items ?? [],
      );
      setSessions(history);
      setModels(available);
      setModel(available[0]?.id ?? "");
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
    setDraft("");
    setView("chat");
    setLoading(!!id);
    setError("");
    if (!id) return;
    try {
      const result = await client.session(id);
      if (navigation.current === turn) setSnapshot(result);
    } catch (problem) {
      if (navigation.current === turn) setError(message(problem));
    } finally {
      if (navigation.current === turn) setLoading(false);
    }
  };
  const dispatch = useCallback(
    async (command?: HostCommand, text?: string) => {
      setBusy(true);
      setError("");
      try {
        const receipt = command
          ? await client.dispatch(command, text)
          : await client.retryPending();
        setPending(undefined);
        // A recovered create/send can belong to a different project than the
        // currently visible one. Navigate to its actual owning project.
        const result = await client.session(receipt.sessionId);
        const owner = projects.find((item) => item.id === result.projectId);
        if (owner) setProject(owner);
        setSessionId(receipt.sessionId);
        setSnapshot(result);
        setView("chat");
        if (!command || command.type === "send" || command.type === "create")
          setDraft("");
      } catch (problem) {
        setError(message(problem));
        setPending(await client.pending());
      } finally {
        setBusy(false);
      }
    },
    [projects],
  );
  const send = async () => {
    if (!project || !draft.trim() || busy || pending) return;
    if (sessionId) {
      await dispatch({
        type: "send",
        commandId: crypto.randomUUID(),
        sessionId,
        text: draft,
      });
    } else {
      const selected = models.find((item) => item.id === model);
      if (!selected) {
        setError(
          "No available model. Install and sign in to a provider on this Host.",
        );
        return;
      }
      await dispatch(
        {
          type: "create",
          commandId: crypto.randomUUID(),
          projectId: project.id,
          harness: selected.harness as RemoteProvider,
          model: selected.id,
          modelSettings: Object.fromEntries(
            selected.settings?.map((setting) => [setting.id, setting.value]) ??
              [],
          ),
          runtimeMode: mode,
        },
        draft,
      );
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
    setView(next);
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (addingProject) setAddingProject(false);
      else if (view === "chat") navigate("sessions");
      else if (view === "sessions" || (view === "connection" && connected))
        navigate("projects");
      else void App.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [view, connected, addingProject]);

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
          <button
            className="mobile-new-session"
            onClick={() => void openSession()}
          >
            <Plus size={18} />
            New conversation
          </button>
          <p className="mobile-section-label">
            Conversations{" "}
            <span>{sessions.filter((item) => !item.archived).length}</span>
          </p>
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
                    <span className="mobile-row-icon">
                      <MessageSquare size={20} />
                    </span>
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
          <form
            className="mobile-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {!sessionId && (
              <div className="mobile-composer-options">
                <select
                  aria-label="Model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={busy || !!pending}
                >
                  {models.length ? (
                    models.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No models available</option>
                  )}
                </select>
                <select
                  aria-label="Permissions"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as RuntimeMode)
                  }
                  disabled={busy || !!pending}
                >
                  {Object.entries(modes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mobile-composer-input">
              <textarea
                ref={textArea}
                aria-label="Message"
                placeholder={
                  running ? "Agent is working…" : "Message your agent…"
                }
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={
                  busy || !!pending || running || (!!sessionId && !snapshot)
                }
              />
              {running ? (
                <IconButton
                  label="Stop"
                  disabled={busy || !!pending || !snapshot.runId}
                  onClick={() =>
                    void dispatch({
                      type: "cancel",
                      commandId: crypto.randomUUID(),
                      sessionId: sessionId!,
                      runId: snapshot.runId!,
                    })
                  }
                >
                  <Square size={16} />
                </IconButton>
              ) : (
                <button
                  className="mobile-send"
                  type="submit"
                  aria-label="Send message"
                  disabled={
                    busy ||
                    !!pending ||
                    !draft.trim() ||
                    (!!sessionId && !snapshot) ||
                    (!sessionId && !model)
                  }
                >
                  {busy ? (
                    <LoaderCircle className="mobile-spin" size={19} />
                  ) : (
                    <ArrowUp size={21} />
                  )}
                </button>
              )}
            </div>
            <div className="mobile-composer-caption">
              <span>
                {snapshot
                  ? `${snapshot.session.harness} · ${snapshot.session.model.split(":").slice(1).join(":") || snapshot.session.model}`
                  : "Runs on your computer"}
              </span>
              <span>{snapshot ? modes[snapshot.session.runtimeMode] : ""}</span>
            </div>
          </form>
        </main>
      )}

      {connected && (
        <nav className="mobile-navigation" aria-label="Main navigation">
          <button
            className={view === "projects" ? "is-selected" : ""}
            onClick={() => navigate("projects")}
          >
            <Folder size={20} />
            <span>Projects</span>
          </button>
          <button
            className={
              view === "sessions" || view === "chat" ? "is-selected" : ""
            }
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
