import { useTranslation } from "../shared/i18n/useTranslation";
import { LoaderCircle } from "../shared/ui/icons";

function formatLastOnline(at: number, now: number, language: string) {
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return new Intl.DateTimeFormat(language, sameDay ? { timeStyle: "short" } : { dateStyle: "long" })
    .format(at);
}

/** Home's body while the selected device is unreachable or still connecting. */
export function MobileHostUnavailable({ failed, retrying, lastOnline, now, onRetry }: {
  failed: boolean;
  retrying: boolean;
  lastOnline?: number;
  now: number;
  onRetry: () => void;
}) {
  const { language, t } = useTranslation();
  const spinning = retrying || !failed;
  return (
    <div className="mobile-host-unavailable" role={failed ? "alert" : "status"} aria-busy={spinning}>
      <span className="mobile-host-unavailable-spinner" data-visible={spinning} aria-hidden="true">
        <LoaderCircle size={24} className={spinning ? "mobile-spin" : undefined} />
      </span>
      <img className="mobile-host-unavailable-logo" src="/monocode.png" alt="" />
      <strong>{t(failed ? "Couldn’t connect" : "Connecting…")}</strong>
      {lastOnline !== undefined && (
        <span>{t("Last online: {time}", { time: formatLastOnline(lastOnline, now, language) })}</span>
      )}
      {failed && (
        <button type="button" disabled={retrying} onClick={onRetry}>{t("Retry")}</button>
      )}
    </div>
  );
}
