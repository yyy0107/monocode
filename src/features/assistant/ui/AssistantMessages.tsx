import { Fragment, memo, type HTMLAttributes, type ReactNode } from "react";
import type { AssistantMessage, SessionReference } from "../model/assistant";
import { splitAssistantReply } from "../model/assistantReply";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { QuestionForm } from "../../sessions/ui/QuestionForm";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";
import { AfterTextReveal } from "../../sessions/ui/useTranscriptRenderingPlatform";
import { AssistantSessionCard } from "./AssistantSessionCard";
import {
  AssistantMessageMeta,
  AssistantMessageTime,
} from "./AssistantMessageMeta";
import { AssistantDateSeparator } from "./AssistantDateSeparator";
import { CornerDownRight } from "../../../shared/ui/icons";

type MessageActions = {
  onOpen: (ref: SessionReference) => void;
  onRespond: (
    message: Extract<AssistantMessage, { kind: "input" }>,
    answer: object,
  ) => void;
  bindReply: (
    text: string,
    replyable?: boolean,
  ) => HTMLAttributes<HTMLDivElement>;
};

const AssistantMessageRow = memo(function AssistantMessageRow({
  message,
  previousCreatedAt,
  accessible,
  mobile,
  busy,
  pending,
  onOpen,
  onRespond,
  bindReply,
}: MessageActions & {
  message: AssistantMessage;
  previousCreatedAt?: number;
  accessible: boolean;
  mobile: boolean;
  busy: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const reply = mobile && message.kind === "user"
    ? splitAssistantReply(message.text)
    : undefined;
  const time = mobile && (
    <AssistantMessageTime
      createdAt={message.createdAt}
      className="assistant-swipe-time"
    />
  );
  const wrapCard = (content: ReactNode) =>
    mobile ? (
      <div
        className={`assistant-message-row assistant-message-row-${message.kind}`}
      >
        {content}
        {time}
      </div>
    ) : (
      content
    );
  return (
    <Fragment key={message.id}>
      <AssistantDateSeparator
        createdAt={message.createdAt}
        previousCreatedAt={previousCreatedAt}
      />
      {message.kind === "session-card" ? (
        wrapCard(
          <AssistantSessionCard
            key={message.id}
            message={message}
            onOpen={onOpen}
            accessible={accessible}
            mobile={mobile}
          />,
        )
      ) : message.kind === "input" ? (
        wrapCard(
          <article
            className="assistant-input"
            key={message.id}
            data-resolved={message.resolved || undefined}
          >
            <p>{message.text}</p>
            {message.resolved ? (
              <small className="assistant-pill">{t("Resolved")}</small>
            ) : message.inputKind === "question" && message.question ? (
              <QuestionForm
                prompt={message.question}
                onReply={(_request, reply) => onRespond(message, { reply })}
              />
            ) : (
              <div className="assistant-input-actions">
                {(["allow", "deny"] as const).map((decision) => (
                  <button
                    type="button"
                    key={decision}
                    className={
                      decision === "allow" ? "assistant-primary" : undefined
                    }
                    disabled={busy}
                    onClick={() => onRespond(message, { decision })}
                  >
                    {t(decision === "allow" ? "Allow" : "Deny")}
                  </button>
                ))}
              </div>
            )}
          </article>,
        )
      ) : (
        <div
          key={message.id}
          className={`assistant-message-row assistant-message-row-${message.kind}`}
          data-reply-id={
            mobile && message.kind === "assistant" ? message.id : undefined
          }
        >
          {mobile && message.kind === "assistant" && (
            <span className="assistant-swipe-reply" aria-hidden="true">
              <CornerDownRight size={20} />
            </span>
          )}
          {reply && (
            <div className="assistant-message-reply-context" aria-label={t("Replying to")}>
              <CornerDownRight size={15} aria-hidden="true" />
              <span title={reply.quote}>{reply.quote}</span>
            </div>
          )}
          <div
            {...(message.kind === "assistant" ||
            (mobile && message.kind === "user")
              ? bindReply(message.text, message.kind === "assistant")
              : {})}
            className={`assistant-message assistant-message-${message.kind}`}
            data-streaming={
              (message.kind === "assistant" && message.streaming) || undefined
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
                {message.kind === "status" ? t(message.text) : reply?.text ?? message.text}
              </span>
            )}
            {"attachments" in message &&
              message.attachments?.map((file) => (
                <small className="assistant-attachment" key={file.id}>
                  {file.name}
                </small>
              ))}
          </div>
          {((message.kind === "assistant" && !mobile) ||
            message.kind === "user") && (
            <AfterTextReveal
              entries={message.kind === "assistant" ? [message] : []}
            >
              <AssistantMessageMeta
                text={message.text}
                createdAt={message.createdAt}
                mobile={mobile}
                read={
                  message.kind === "user" &&
                  pending &&
                  message.readAt !== undefined
                    ? message.readAt !== null
                    : undefined
                }
              />
            </AfterTextReveal>
          )}
          {time}
        </div>
      )}
    </Fragment>
  );
});

/** Draft/menu/header updates should not walk the conversation history. */
export const AssistantMessages = memo(function AssistantMessages({
  messages,
  pendingUserMessageId,
  canRead,
  allowedProjects,
  mobile,
  busy,
  ...actions
}: MessageActions & {
  messages: AssistantMessage[];
  pendingUserMessageId?: string;
  canRead: boolean;
  allowedProjects?: "all" | string[];
  mobile: boolean;
  busy: boolean;
}) {
  return messages.map((message, index) => (
    <AssistantMessageRow
      key={message.id}
      message={message}
      previousCreatedAt={messages[index - 1]?.createdAt}
      accessible={
        message.kind === "session-card" &&
        canRead &&
        (allowedProjects === "all" ||
          !!allowedProjects?.includes(message.ref.projectId))
      }
      mobile={mobile}
      busy={message.kind === "input" && busy}
      pending={message.id === pendingUserMessageId}
      {...actions}
    />
  ));
});
