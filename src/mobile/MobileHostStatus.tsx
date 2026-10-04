import { useTranslation } from "../shared/i18n/useTranslation";
import type { HostConnectionStatus } from "./client";

export function MobileHostStatus({ status }: { status: HostConnectionStatus }) {
  const { t } = useTranslation();
  const label =
    status.state === "connected"
      ? "Connected"
      : status.state === "reconnecting"
        ? "Reconnecting…"
        : status.state === "disconnected"
          ? "Disconnected"
          : status.reason === "authentication"
            ? "Authentication failed"
            : status.reason === "timeout"
              ? "Connection timed out"
              : status.reason === "identity"
                ? "Host identity changed"
                : "Connection failed";
  return (
    <span
      className="mobile-host-status"
      data-state={status.state}
      role="status"
      aria-label={t(label)}
      title={status.detail || t(label)}
    >
      <span className="mobile-host-status-dot" aria-hidden="true" />
      {status.state !== "connected" && (
        <span className="mobile-host-status-label">{t(label)}</span>
      )}
    </span>
  );
}
