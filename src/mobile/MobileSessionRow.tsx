import type { ButtonHTMLAttributes } from "react";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { sessionRecencyAt } from "../features/sessions/model/sessionActivity";
import { useTranslation } from "../shared/i18n/useTranslation";
import { LoaderCircle, Pin, TriangleAlert } from "../shared/ui/icons";
import { formatMobileRelativeTime } from "./relativeTime";

/** One conversation in a list page: its title, then its state or age. */
export function MobileSessionRow({
  session,
  now,
  unread,
  ...button
}: {
  session: HostSessionSummary;
  now: number;
  unread: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { language, t } = useTranslation();
  const state =
    session.needsInput ? "input" : session.status === "running" ? "running" : "idle";
  return (
    <button
      type="button"
      className="mobile-home-session"
      data-session-id={session.id}
      data-state={state}
      {...button}
    >
      <strong>
        {sessionDisplayTitle(session.title, session.harness) ||
          t("Untitled conversation")}
      </strong>
      {session.pinned && (
        <Pin size={14} className="mobile-home-session-pin" aria-label={t("Pinned")} />
      )}
      {state === "running" ? (
        <span className="mobile-home-session-state" role="img" aria-label={t("Working")}>
          <LoaderCircle size={18} className="mobile-spin" aria-hidden="true" />
        </span>
      ) : state === "input" ? (
        <span className="mobile-home-session-state" role="img" aria-label={t("Needs input")}>
          <TriangleAlert size={18} aria-hidden="true" />
        </span>
      ) : (
        <time dateTime={new Date(sessionRecencyAt(session)).toISOString()}>
          {formatMobileRelativeTime(sessionRecencyAt(session), now, language)}
        </time>
      )}
      {unread && (
        <span className="mobile-unread-dot" role="img" aria-label={t("Unread reply")} />
      )}
    </button>
  );
}
