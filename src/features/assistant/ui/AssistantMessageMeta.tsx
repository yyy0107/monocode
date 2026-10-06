import { useTranslation } from "../../../shared/i18n/useTranslation";
import { CopyTurnButton } from "../../sessions/ui/CopyTurnButton";

export function AssistantMessageMeta({
  text,
  createdAt,
  read,
}: {
  text: string;
  createdAt: number;
  read?: boolean;
}) {
  const { t, language } = useTranslation();
  const date = new Date(createdAt);
  return (
    <div className="assistant-message-meta">
      <time dateTime={date.toISOString()} title={date.toLocaleString(language)}>
        {date.toLocaleTimeString(language, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
      {read !== undefined && (
        <span className="assistant-read-state" data-read={read}>
          {t(read ? "Read" : "Unread")}
        </span>
      )}
      {text && <CopyTurnButton text={text} label={t("Copy message")} />}
    </div>
  );
}
