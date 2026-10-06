import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { AssistantClient, type AssistantRpc } from "../model/assistantClient";
import { compactAssistantTimeline } from "../model/assistantTimeline";
import type {
  AssistantMessage,
  AssistantPatch,
  AssistantView,
  SessionReference,
} from "../model/assistant";
import type {
  HostDescriptor,
  HostModelCatalog,
  HostProject,
  HostSessionSummary,
  RemoteAttachment,
} from "../../connections/model/protocol";
import { assistantErrorMessage } from "../model/assistantErrors";
import { REMOTE_PROVIDERS } from "../../connections/model/protocol";
import { QuestionForm } from "../../sessions/ui/QuestionForm";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { AssistantSettings } from "./AssistantSettings";
import { AssistantSessionCard } from "./AssistantSessionCard";
import { AssistantMessageMeta } from "./AssistantMessageMeta";
import { AssistantDateSeparator } from "./AssistantDateSeparator";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { AssistantWorkerDetails } from "./AssistantWorkerDetails";
import { resolveAssistantTarget } from "../model/assistantNavigation";
import { assistantActivityLabel } from "../model/assistantActivity";
import type {
  AssistantChatChrome,
  AssistantControlsProps,
} from "./AssistantChatChrome";
import {
  desktopAssistantChrome,
  DesktopAssistantMessageMenu,
} from "./DesktopAssistantChrome";
import { useAssistantReplyMenu } from "./useAssistantReplyMenu";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";
import { TranscriptPlatformContext } from "../../sessions/ui/TranscriptPlatform";
import {
  AfterTextReveal,
  useTranscriptRenderingPlatform,
} from "../../sessions/ui/useTranscriptRenderingPlatform";
import { Shimmer } from "../../../shared/ui/Shimmer";
import { Sparkles, X } from "../../../shared/ui/icons";
import "./assistant.css";

function followScrollTop(element: HTMLElement, mobile: boolean) {
  if (!mobile) return element.scrollHeight;
  const bottom = Math.max(0, element.scrollHeight - element.clientHeight);
  let latest = element.lastElementChild;
  if (latest?.matches(".assistant-working"))
    latest = latest.previousElementSibling;
  if (!latest?.matches(".assistant-message-row, .assistant-card, .assistant-input"))
    return bottom;
  const rect = latest.getBoundingClientRect();
  if (!rect.height) return bottom;
  const inset = Number.parseFloat(getComputedStyle(element).scrollPaddingTop) || 0;
  // Numeric scrollTo ignores scroll-padding. Keep the latest bubble's start
  // below the floating header even when a reply grows beyond the viewport.
  const latestTop =
    rect.top - element.getBoundingClientRect().top + element.scrollTop;
  return Math.max(0, Math.min(bottom, latestTop - inset));
}

function syncHeaderHeight(chat: HTMLElement | null, mobile: boolean) {
  const header = chat?.querySelector<HTMLElement>(mobile
    ? ".mobile-assistant-header > .mobile-header-title"
    : ".assistant-header");
  if (!chat || !header) return;
  const height = header.getBoundingClientRect().height;
  if (!height) return;
  // Leave the same gap above and below the capsule as it expands downward.
  const next = `${Math.ceil(height + (mobile ? header.offsetTop * 2 : 0))}px`;
  const property = mobile ? "--mobile-header-height" : "--assistant-header-height";
  if (chat.style.getPropertyValue(property) !== next)
    chat.style.setProperty(property, next);
}

export function AssistantChat({
  hostKey,
  rpc,
  onOpen,
  onClose,
  hostName,
  hostPicker,
  chrome,
}: {
  hostKey: string;
  rpc: AssistantRpc;
  onOpen: (ref: SessionReference) => Promise<void> | void;
  onClose?: () => void;
  hostName: string;
  hostPicker?: ReactNode;
  chrome?: AssistantChatChrome;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const client = useMemo(
    () =>
      new AssistantClient(
        hostKey,
        rpc,
        typeof localStorage === "undefined" ? undefined : localStorage,
      ),
    [hostKey, rpc],
  );
  // Undefined means the first sync is pending; null confirms setup is needed.
  const [assistant, setAssistant] = useState<AssistantView | null>();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const visibleMessages = useMemo(
    () => chrome ? compactAssistantTimeline(messages) : messages,
    [messages, chrome],
  );
  const latestUserMessageId = useMemo(
    () => visibleMessages.reduce<string | undefined>(
      (latest, message) => message.kind === "user" ? message.id : latest,
      undefined,
    ),
    [visibleMessages],
  );
  const replies = useMemo(
    () =>
      messages.flatMap((message) =>
        message.kind === "assistant"
          ? [{ id: message.id, text: message.text }]
          : [],
      ),
    [messages],
  );
  const renderingPlatform = useTranscriptRenderingPlatform(replies, {
    // An empty first sync is still loaded history; the first new reply animates.
    historyReady: assistant !== undefined,
  });
  const [catalog, setCatalog] = useState<HostModelCatalog>({
    models: {},
    errors: {},
  });
  const [projects, setProjects] = useState<HostProject[]>([]);
  const [supported, setSupported] = useState<boolean>();
  // Personality, local time and promised follow-ups need a newer Host.
  const [personaSupported, setPersonaSupported] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBase, setSettingsBase] = useState<AssistantView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Initial connection failures replace the loading state with a retry.
  const [connectError, setConnectError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [catalogState, setCatalogState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [catalogError, setCatalogError] = useState<string>();
  const [draft, setDraft] = useState(() => {
    try {
      return localStorage.getItem(`monocode.assistant-draft:${hostKey}`) ?? "";
    } catch {
      return "";
    }
  });
  const [retry, setRetry] = useState(() => client.pending());
  const [attachments, setAttachments] = useState<RemoteAttachment[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLElement>(null);
  const followLog = useRef(true);
  const [worker, setWorker] = useState<SessionReference>();
  const [workerOpen, setWorkerOpen] = useState(false);
  const canRead = (ref: SessionReference, current = assistant) =>
    !!current?.policy?.permissions["sessions.read"] &&
    (current.policy.allowedProjects === "all" ||
      current.policy.allowedProjects.includes(ref.projectId));
  useEffect(() => {
    if (worker && !canRead(worker)) setWorkerOpen(false);
  }, [assistant, worker]);
  const sync = async () => {
    const result = await client.sync();
    setAssistant(result.assistant);
    setMessages(result.messages);
  };
  useEffect(() => {
    let disposed = false,
      fetching = false,
      capable = false,
      catalogRequested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshDelay = 2000;
    setConnectError(undefined);
    const refresh = async () => {
      if (fetching || disposed) return;
      fetching = true;
      try {
        const next = await client.sync();
        if (disposed) return;
        setAssistant(next.assistant);
        setMessages(next.messages);
        refreshDelay = next.assistant?.lifecycle === "running" ? 250 : 2000;
        // The catalog loads once the Host has answered an assistant sync.
        if (!catalogRequested) {
          catalogRequested = true;
          void loadCatalog(() => disposed);
        }
      } catch (e) {
        if (!disposed) setError(assistantErrorMessage(e));
      } finally {
        fetching = false;
        if (!disposed && capable)
          timer = setTimeout(() => void refresh(), refreshDelay);
      }
    };
    void rpc<HostDescriptor>("environment.describe", {
      supportedProviders: REMOTE_PROVIDERS,
    })
      .then(async (descriptor) => {
        if (disposed) return;
        const available =
          descriptor.capabilities?.includes("assistant.v1") ?? false;
        setSupported(available);
        setPersonaSupported(
          descriptor.capabilities?.includes("assistant.persona") ?? false,
        );
        if (!available) return;
        capable = true;
        await refresh();
      })
      .catch((e) => {
        if (!disposed) setConnectError(assistantErrorMessage(e));
      });
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [client, rpc, attempt]);
  const loadCatalog = async (disposed: () => boolean = () => false) => {
    setCatalogState("loading");
    try {
      const [models, projects] = await Promise.all([
        rpc<HostModelCatalog>("models.list"),
        rpc<HostProject[]>("projects.list"),
      ]);
      if (disposed()) return;
      setCatalog(models);
      setProjects(projects);
      setCatalogState("ready");
    } catch (e) {
      if (disposed()) return;
      setCatalogError(assistantErrorMessage(e));
      setCatalogState("failed");
    }
  };
  const loadSessions = useCallback(
    async (projectIds: string[]) => {
      const lists = await Promise.all(
        projectIds.map((projectId) =>
          rpc<HostSessionSummary[]>("sessions.list", {
            projectId,
          }).then(
            (rows) =>
              rows.map((row) => ({
                id: row.id,
                title: row.title || row.id,
                projectId,
              })),
            () => [],
          ),
        ),
      );
      return lists.flat();
    },
    [rpc],
  );
  useEffect(() => {
    try {
      localStorage.setItem(`monocode.assistant-draft:${hostKey}`, draft);
    } catch {
      /* Draft remains usable. */
    }
  }, [hostKey, draft]);
  useLayoutEffect(() => {
    syncHeaderHeight(chat.current, !!chrome);
    const element = log.current;
    if (followLog.current && element)
      element.scrollTo?.({ top: followScrollTop(element, !!chrome) });
  }, [messages, chrome]);
  useEffect(() => {
    const element = log.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncHeaderHeight(chat.current, !!chrome);
      if (followLog.current)
        element.scrollTo?.({ top: followScrollTop(element, !!chrome) });
    });
    observer.observe(element);
    // Markdown grows between RPC updates while characters are being revealed.
    for (const child of element.children) observer.observe(child);
    const header = chat.current?.querySelector(chrome
      ? ".mobile-assistant-header > .mobile-header-title"
      : ".assistant-header");
    if (header) observer.observe(header);
    return () => observer.disconnect();
  }, [!!assistant, messages, chrome]);
  const operation = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await sync();
    } catch (e) {
      setError(assistantErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const send = (text: string, files = attachments) =>
    operation(async () => {
      try {
        followLog.current = true;
        await client.send(text, files);
        setRetry(undefined);
        setDraft("");
        setAttachments([]);
      } finally {
        setRetry(client.pending());
      }
    });
  const save = async (patch: AssistantPatch) =>
    operation(async () => {
      await rpc("assistant.configure", {
        commandId: crypto.randomUUID(),
        expectedRevision: settingsBase?.revision ?? 0,
        patch,
      });
      setSettingsOpen(false);
    });
  const open = async (ref: SessionReference) => {
    try {
      const current = await rpc<AssistantView | null>("assistant.get");
      if (!canRead(ref, current))
        throw new Error(
          "This conversation is outside the assistant's current permissions.",
        );
      const target = await resolveAssistantTarget(hostKey, ref, rpc);
      if (target.session.session.orchestrationLeadId) {
        setWorker(ref);
        setWorkerOpen(true);
      } else await onOpen(ref);
    } catch (e) {
      setError(assistantErrorMessage(e));
    }
  };
  const labels = {
    idle: "Ready",
    running: "Working",
    paused: "Paused",
    backoff: "Retrying later",
    interrupted: "Interrupted",
    failed: "Failed",
    disabled: "Disabled",
  };
  const continuable =
    !!assistant &&
    ["paused", "interrupted", "failed", "disabled"].includes(
      assistant.lifecycle,
    );
  const controls: AssistantControlsProps | undefined = assistant
    ? {
        busy,
        enabled: assistant.enabled,
        continuable,
        onToggle: () =>
          void operation(() =>
            rpc("assistant.control", {
              commandId: crypto.randomUUID(),
              action: continuable ? "resume" : "pause",
              expectedGeneration: assistant.brainGeneration,
            }),
          ),
        onDisable: () =>
          void operation(() =>
            rpc("assistant.control", {
              commandId: crypto.randomUUID(),
              action: "disable",
              expectedGeneration: assistant.brainGeneration,
            }),
          ),
        nextRetryAt: assistant.nextRetryAt,
        backlog: assistant.backlog,
      }
    : undefined;
  const openSettings = () => {
    setSettingsBase(assistant ?? null);
    setSettingsOpen((v) => !v);
  };
  const attach = (files: File[]) =>
    void operation(async () => {
      if (attachments.length + files.length > 20)
        throw new Error("At most 20 attachments are allowed");
      for (const file of files) {
        const ref = await client.upload(file);
        setAttachments((a) => [...a, ref]);
      }
    });
  const activity = assistantActivityLabel(assistant?.activity);
  const workingLabel = t(activity.key, activity.params);
  const ui = chrome ?? desktopAssistantChrome;
  const mobile = !!chrome;
  const { Header, SettingsPanel, Controls, Composer } = ui;
  const settingsCovering =
    supported === true && (settingsOpen || assistant === null);
  const replyMenu = useAssistantReplyMenu(
    mobile,
    visible && !!assistant && !settingsCovering,
  );
  const MessageMenu = ui.MessageMenu ?? DesktopAssistantMessageMenu;
  const replyDisabled =
    busy || !!retry || !assistant?.enabled || !assistant.triggers.user;
  const reply = () => {
    if (!replyMenu.menu || replyDisabled) return;
    const quote = replyMenu.menu.text
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n");
    // Let the menu restore its previous focus before opening the mobile keyboard.
    flushSync(() => {
      setDraft((previous) => `${quote}\n\n${previous}`);
      replyMenu.close();
    });
    const input = chat.current?.querySelector<HTMLTextAreaElement>(
      ".assistant-conversation textarea",
    );
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  };
  const errorNotice = (error || assistant?.error) && (
    <div className="assistant-error" role="alert">
      <span>{t(error ?? assistant!.error!)}</span>
      {settingsOpen ? (
        <button
          type="button"
          onClick={() => {
            setSettingsBase(assistant ?? null);
            setError(undefined);
          }}
        >
          {t("Reload settings")}
        </button>
      ) : !error && continuable && controls ? (
        <button type="button" disabled={busy} onClick={controls.onToggle}>
          {t("Continue")}
        </button>
      ) : error ? (
        <button
          type="button"
          className="assistant-error-dismiss"
          aria-label={t("Dismiss")}
          onClick={() => setError(undefined)}
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
  const respond = (
    message: Extract<AssistantMessage, { kind: "input" }>,
    answer: object,
  ) =>
    void operation(() =>
      rpc("assistant.respond", {
        commandId: crypto.randomUUID(),
        messageId: message.id,
        brainGeneration: message.brainGeneration,
        runId: message.runId,
        requestId: message.requestId,
        ...answer,
      }),
    );
  return (
    <TranscriptPlatformContext.Provider value={renderingPlatform}>
      <section
        ref={chat}
        className="assistant-chat bg-background-base text-content"
        aria-label={t("Assistant")}
        data-layout={mobile ? "mobile" : "desktop"}
      >
        <div
          className="assistant-heading"
          inert={settingsCovering}
          aria-hidden={settingsCovering || undefined}
        >
          <Header
            name={assistant?.name ?? t("Assistant")}
            harness={assistant?.harness}
            hostName={hostName}
            hostPicker={hostPicker}
            status={
              assistant
                ? t(labels[assistant.lifecycle])
                : t(assistant === null ? "Set up assistant" : "Connecting…")
            }
            lifecycle={assistant?.lifecycle}
            activity={assistant?.lifecycle === "running" ? workingLabel : undefined}
            settingsOpen={settingsOpen}
            busy={busy}
            onSettings={assistant ? openSettings : undefined}
            onClose={onClose}
            controls={controls}
          />
        </div>
        <div
          className="assistant-details"
          inert={settingsCovering}
          aria-hidden={settingsCovering || undefined}
        >
          <AnimatedCollapse expanded={workerOpen}>
            {worker && (
              <AssistantWorkerDetails
                target={worker}
                rpc={rpc}
                active={workerOpen && canRead(worker)}
                onClose={() => setWorkerOpen(false)}
              />
            )}
          </AnimatedCollapse>
        </div>
        {!settingsCovering && errorNotice}
        {connectError ? (
          <div className="assistant-availability" role="alert">
            <p>{t(connectError)}</p>
            <div className="assistant-availability-actions">
              <button
                type="button"
                className="assistant-primary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                {t("Retry")}
              </button>
              {onClose && (
                <button type="button" onClick={onClose}>
                  {t("Close")}
                </button>
              )}
            </div>
          </div>
        ) : supported === false ? (
          <p className="assistant-availability" role="status">
            {t("Assistant is unavailable on this Host")}
          </p>
        ) : supported === undefined || assistant === undefined ? (
          <p className="assistant-availability" role="status">
            {t("Connecting…")}
          </p>
        ) : (
          <div className="assistant-body">
            <SettingsPanel
              open={settingsCovering}
              initialSetup={!assistant}
              onClose={() => (assistant ? setSettingsOpen(false) : onClose?.())}
            >
              {settingsCovering && errorNotice}
              <AssistantSettings
                key={`${hostKey}:${settingsBase?.revision ?? "new"}`}
                value={settingsBase}
                catalog={catalog}
                catalogState={catalogState}
                catalogError={catalogError}
                onRetryCatalog={() => void loadCatalog()}
                loadSessions={loadSessions}
                projects={projects}
                busy={busy}
                onSave={save}
                onCancel={
                  mobile || !assistant
                    ? undefined
                    : () => setSettingsOpen(false)
                }
                mobile={mobile}
                Select={ui.Select}
                personaSupported={personaSupported}
                reminders={assistant?.reminders}
                memory={
                  assistant?.memory && { rpc, ...assistant.memory }
                }
                habits={
                  assistant?.habits && {
                    items: assistant.habits,
                    timeZone: assistant.timezone ?? "UTC",
                    control: async (input) => {
                      await rpc("assistant.control", {
                        commandId: crypto.randomUUID(),
                        ...input,
                      });
                      // The change is in; polling catches up if this refresh fails.
                      await sync().catch(() => {});
                    },
                  }
                }
                onCancelReminder={
                  personaSupported
                    ? (reminderId) =>
                        operation(() =>
                          rpc("assistant.control", {
                            commandId: crypto.randomUUID(),
                            action: "cancelReminder",
                            reminderId,
                          }),
                        )
                    : undefined
                }
              />
            </SettingsPanel>
            {assistant && controls && (
              <div
                className="assistant-conversation"
                inert={settingsCovering}
                aria-hidden={settingsCovering || undefined}
              >
                <Controls {...controls} />
                <div
                  ref={log}
                  className="assistant-messages"
                  role="log"
                  aria-label={t("Assistant messages")}
                  onScroll={() => {
                    replyMenu.cancelHold();
                    const element = log.current;
                    if (element)
                      followLog.current = mobile
                        ? Math.abs(
                            element.scrollTop - followScrollTop(element, true),
                          ) < 60
                        : element.scrollHeight -
                            element.scrollTop -
                            element.clientHeight <
                          60;
                  }}
                >
                  {!messages.length && (
                    <div className="assistant-welcome mobile-assistant-welcome">
                      <span aria-hidden="true">
                        <Sparkles size={28} />
                      </span>
                      <h2>{t("How can I help?")}</h2>
                      <p>
                        {t(
                          "Ask me to check progress, start a task, or follow up with your agents.",
                        )}
                      </p>
                    </div>
                  )}
                  {visibleMessages.map((message, index) => (
                    <Fragment key={message.id}>
                      <AssistantDateSeparator
                        createdAt={message.createdAt}
                        previousCreatedAt={visibleMessages[index - 1]?.createdAt}
                      />
                      {message.kind === "session-card" ? (
                        <AssistantSessionCard
                          key={message.id}
                          message={message}
                          onOpen={open}
                          accessible={canRead(message.ref)}
                          mobile={mobile}
                        />
                      ) : message.kind === "input" ? (
                        <article
                          className="assistant-input"
                          key={message.id}
                          data-resolved={message.resolved || undefined}
                        >
                          <p>{message.text}</p>
                          {message.resolved ? (
                            <small className="assistant-pill">
                              {t("Resolved")}
                            </small>
                          ) : message.inputKind === "question" &&
                            message.question ? (
                            <QuestionForm
                              prompt={message.question}
                              onReply={(_request, reply) =>
                                respond(message, { reply })
                              }
                            />
                          ) : (
                            <div className="assistant-input-actions">
                              {(["allow", "deny"] as const).map((decision) => (
                                <button
                                  type="button"
                                  key={decision}
                                  className={
                                    decision === "allow"
                                      ? "assistant-primary"
                                      : undefined
                                  }
                                  disabled={busy}
                                  onClick={() => respond(message, { decision })}
                                >
                                  {t(decision === "allow" ? "Allow" : "Deny")}
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      ) : (
                        <div
                          key={message.id}
                          className={`assistant-message-row assistant-message-row-${message.kind}`}
                        >
                          <div
                            {...(message.kind === "assistant"
                              ? replyMenu.bind(message.text)
                              : {})}
                            className={`assistant-message assistant-message-${message.kind}`}
                            data-streaming={
                              (message.kind === "assistant" &&
                                message.streaming) ||
                              undefined
                            }
                          >
                            {message.kind === "assistant" ? (
                              <AgentMarkdown
                                text={message.text}
                                streaming={message.streaming}
                                streamingKey={message.id}
                                className="assistant-markdown"
                                hardBreaks
                              />
                            ) : (
                              <span>
                                {message.kind === "status"
                                  ? t(message.text)
                                  : message.text}
                              </span>
                            )}
                            {"attachments" in message &&
                              message.attachments?.map((file) => (
                                <small
                                  className="assistant-attachment"
                                  key={file.id}
                                >
                                  {file.name}
                                </small>
                              ))}
                          </div>
                          {(message.kind === "assistant" ||
                            message.kind === "user") && (
                            <AfterTextReveal
                              entries={message.kind === "assistant" ? [message] : []}
                            >
                              <AssistantMessageMeta
                                text={message.text}
                                createdAt={message.createdAt}
                                read={
                                  message.kind === "user" &&
                                  message.id === latestUserMessageId &&
                                  message.readAt !== undefined
                                    ? message.readAt !== null
                                    : undefined
                                }
                              />
                            </AfterTextReveal>
                          )}
                        </div>
                      )}
                    </Fragment>
                  ))}
                  {!mobile && assistant.lifecycle === "running" &&
                    !messages.some(
                      (message) =>
                        message.kind === "assistant" && message.streaming,
                    ) && (
                      <div className="assistant-working" role="status">
                        <Shimmer>{workingLabel}</Shimmer>
                      </div>
                    )}
                </div>
                <Composer
                  draft={draft}
                  onDraftChange={setDraft}
                  attachments={attachments}
                  busy={busy}
                  inputDisabled={!assistant.enabled || !assistant.triggers.user}
                  attachDisabled={
                    busy ||
                    !!retry ||
                    !assistant.enabled ||
                    !assistant.triggers.user
                  }
                  sendDisabled={
                    busy ||
                    (!draft.trim() && !attachments.length) ||
                    !assistant.enabled ||
                    !assistant.triggers.user ||
                    !!retry
                  }
                  retry={!!retry}
                  onRetry={() => {
                    if (retry) void send(retry.text, retry.attachments);
                  }}
                  onAttach={attach}
                  onRemoveAttachment={(id) =>
                    setAttachments((a) => a.filter((f) => f.id !== id))
                  }
                  onSend={() => void send(draft)}
                />
              </div>
            )}
          </div>
        )}
        <MessageMenu
          open={!!replyMenu.menu}
          point={replyMenu.menu}
          disabled={replyDisabled}
          onReply={reply}
          onClose={replyMenu.close}
        />
      </section>
    </TranscriptPlatformContext.Provider>
  );
}
