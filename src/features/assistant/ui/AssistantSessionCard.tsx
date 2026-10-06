import type { AssistantMessage, SessionReference } from "../model/assistant";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { ChevronRight, Folder } from "../../../shared/ui/icons";
import { HarnessIcon } from "../../sessions/ui/HarnessIcon";
import { HARNESS_TITLE, sessionDisplayTitle } from "../../sessions/model/session";
export function AssistantSessionCard({
  message,
  onOpen,
  accessible = true,
  mobile = false,
}: {
  message: Extract<AssistantMessage, { kind: "session-card" }>;
  onOpen: (ref: SessionReference) => Promise<void> | void;
  accessible?: boolean;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const title = mobile ? sessionDisplayTitle(message.title, message.harness) : message.title;
  const modelName = message.model.startsWith(`${message.harness}:`)
    ? message.model.slice(message.harness.length + 1) : message.model;
  const labels = {
    accepted: "Accepted",
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    unknown: "Needs review",
    unavailable: "Unavailable",
  };
  return (
    <article
      className="assistant-card"
      data-session-id={message.ref.sessionId}
      data-status={message.status}
    >
      <div className="assistant-card-heading">
        {!mobile && <span className="assistant-card-icon" aria-hidden="true">
          <HarnessIcon
            harness={message.harness}
            className="size-[15px]"
          />
        </span>}
        <div className="assistant-card-title">
          <strong title={title}>{title}</strong>
          <span className="assistant-card-context">
            {mobile ? <>
              <span className="assistant-card-project" title={message.projectName}>
                <Folder size={13} aria-hidden="true" />
                <span>{message.projectName}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="assistant-card-provider" role="img" aria-label={HARNESS_TITLE[message.harness]} title={HARNESS_TITLE[message.harness]}>
                <HarnessIcon harness={message.harness} className="size-3.5" />
              </span>
              <span className="assistant-card-model" title={modelName}>{modelName}</span>
            </> : <>
            {message.projectName} ·{" "}
            {HARNESS_TITLE[message.harness] ?? message.harness} ·{" "}
            {message.model}
            </>}
          </span>
        </div>
        <span role="status" className="assistant-pill">
          {t(labels[message.status])}
        </span>
      </div>
      {message.error && <p>{message.error}</p>}
      <button
        type="button"
        aria-label={mobile ? `${t("Open session")}: ${title}` : undefined}
        disabled={!accessible || message.status === "unavailable"}
        onClick={() => void onOpen(message.ref)}
      >
        {!mobile && t("Open session")}
        <ChevronRight size={mobile ? 18 : 14} aria-hidden="true" />
      </button>
    </article>
  );
}
