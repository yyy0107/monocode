import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Split } from "../../../shared/ui/icons";

/** A persistent title suffix for sessions attached to a worktree. */
export function SessionWorktreeIcon({
  session,
}: {
  session: { worktreeCwd?: string };
}) {
  const { t } = useTranslation();
  if (!session.worktreeCwd) return null;
  return (
    <span
      role="img"
      aria-label={t("Worktree")}
      title={`${t("Worktree")}\n${session.worktreeCwd}`}
      className="inline-flex shrink-0 items-center text-content/45"
    >
      <Split className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}
