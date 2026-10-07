import type { ButtonHTMLAttributes } from "react";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { useTranslation } from "../shared/i18n/useTranslation";
import { LoaderCircle, Pin, TriangleAlert } from "../shared/ui/icons";
import { formatMobileRelativeTime } from "./relativeTime";

/** One conversation on a list page: who, what state, and the latest answer. */
export function MobileSessionCard({
  session,
  projectName,
  now,
  unread,
  ...button
}: {
  session: HostSessionSummary;
  /** Omitted on a single project's page, where it would repeat the header. */
  projectName?: string;
  now: number;
  unread: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { language, t } = useTranslation();
  const running = session.status === "running";
  const state = running ? "running" : session.needsInput ? "input" : "idle";
  return (
    <button
      type="button"
      className="mobile-home-session mobile-session-card"
      data-session-id={session.id}
      data-state={state}
      {...button}
    >
      <span className="mobile-session-card-icon" aria-hidden="true">
        <HarnessIcon harness={session.harness} className="size-5" />
      </span>
      <span className="mobile-session-card-body">
        <span className="mobile-session-card-head">
          <strong>
            {sessionDisplayTitle(session.title, session.harness) ||
              t("Untitled conversation")}
          </strong>
          {session.pinned && (
            <Pin size={13} className="mobile-session-card-pin" aria-label={t("Pinned")} />
          )}
          <time dateTime={new Date(session.updatedAt).toISOString()}>
            {formatMobileRelativeTime(session.updatedAt, now, language)}
          </time>
          {unread && (
            <span
              className="mobile-unread-dot"
              role="img"
              aria-label={t("Unread reply")}
            />
          )}
        </span>
        {(state !== "idle" || projectName) && (
          <span className="mobile-session-card-meta">
            {state === "running" ? (
              <span className="mobile-session-card-state">
                <LoaderCircle size={14} className="mobile-spin" aria-hidden="true" />
                {t("Working")}
              </span>
            ) : state === "input" ? (
              <span className="mobile-session-card-state">
                <TriangleAlert size={14} aria-hidden="true" />
                {t("Needs input")}
              </span>
            ) : null}
            {state !== "idle" && projectName && (
              <span aria-hidden="true">·</span>
            )}
            {projectName && <span className="mobile-session-card-project">{projectName}</span>}
          </span>
        )}
      </span>
      {session.preview && (
        <span className="mobile-session-card-preview">{session.preview}</span>
      )}
    </button>
  );
}
