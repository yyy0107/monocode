import { ArrowDownCircle, Loader } from "../../shared/ui/icons";
import { useCallback, useRef } from "react";
import { installPendingUpdate, type UpdaterSnapshot } from "../model/updater";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { formatBuildVersion } from "../../shared/lib/buildVersion";

// The sidebar row only earns its space when there is something to act on: an
// update waiting to be installed, or one already downloading. Every other phase
// — including a probe that failed — stays silent, because manual "Check for
// updates" already lives in Settings and the app menu.
export function SidebarUpdate({
  snapshot,
  onSnapshot,
  onInstall,
}: {
  snapshot: UpdaterSnapshot;
  onSnapshot: (next: UpdaterSnapshot) => void;
  onInstall?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const busy = snapshot.phase === "downloading";
  // `busy` only flips after installPendingUpdate awaits readAppVersion, so a
  // second click can still land. The ref closes that window immediately.
  const installing = useRef(false);

  const onClick = useCallback(async () => {
    if (busy || installing.current) return;
    installing.current = true;
    try {
      if (onInstall) await onInstall();
      else await installPendingUpdate(onSnapshot);
    } finally {
      installing.current = false;
    }
  }, [busy, onSnapshot, onInstall]);

  const label = busy
    ? snapshot.progress != null
      ? t("Downloading {progress}%", { progress: snapshot.progress })
      : t("Downloading…")
    : t("Update to {version}", {
        version: formatBuildVersion(snapshot.availableVersion ?? ""),
      });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
        busy
          ? "bg-content/5 text-content/75 hover:bg-content/10 hover:text-content"
          : "bg-accent/15 text-content hover:bg-accent/20"
      } disabled:cursor-default disabled:opacity-70`}
    >
      <span className="grid size-[18px] shrink-0 place-items-center">
        {busy ? (
          <Loader className="size-4 animate-spin opacity-70" aria-hidden />
        ) : (
          <ArrowDownCircle className="size-4 text-accent" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 flex items-center">
        <span className="block truncate text-[12px] font-medium leading-tight">
          {label}
        </span>
        <span className="ml-auto block text-[11px] text-content/40">
          v{formatBuildVersion(snapshot.currentVersion)}
        </span>
      </span>
    </button>
  );
}
