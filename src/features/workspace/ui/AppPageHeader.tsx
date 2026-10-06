import { ArrowLeft, type IconComponent } from "../../../shared/ui/icons";
import { useTranslation } from "../../../shared/i18n/useTranslation";

/** Page chrome stays inside the content area, without a workspace tab strip. */
export function AppPageHeader({
  title,
  icon: Icon,
  onBack,
}: {
  title: string;
  icon: IconComponent;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-10 shrink-0 select-none items-center gap-2 border-b border-stroke px-3 text-[13px]">
      {onBack ? (
        <button
          type="button"
          aria-label={t("Back to chat")}
          title={t("Back to chat")}
          onClick={onBack}
          className="grid size-6 shrink-0 place-items-center rounded-md text-content/45 hover:bg-content/10 hover:text-content"
        >
          <ArrowLeft className="size-3.5" />
        </button>
      ) : null}
      <Icon className="size-3.5 shrink-0 text-content/45" />
      <span className="min-w-0 truncate text-content">{title}</span>
    </div>
  );
}
