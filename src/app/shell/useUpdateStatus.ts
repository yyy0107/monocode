import { useEffect, useState } from "react";
import {
  probeForUpdate,
  readAppVersion,
  type UpdaterSnapshot,
} from "../model/updater";

export function isUpdateActionable(snapshot: UpdaterSnapshot): boolean {
  return snapshot.phase === "available" || snapshot.phase === "downloading";
}

/** The activity bar owns the automatic update probe for the window. */
export function useUpdateStatus() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });

  // The automatic probe runs on mount whether or not it ends up rendering
  // anything, so a newly published version still surfaces on its own. The
  // snapshot lives here so update state survives opening and closing its pop-out.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const currentVersion = await readAppVersion();
      if (cancelled) return;
      setSnapshot({ phase: "checking", currentVersion });

      try {
        const update = await probeForUpdate();
        if (cancelled) return;
        if (update) {
          setSnapshot({
            phase: "available",
            currentVersion,
            availableVersion: update.version,
          });
          return;
        }
        setSnapshot({ phase: "current", currentVersion });
      } catch {
        if (cancelled) return;
        setSnapshot({ phase: "idle", currentVersion });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { snapshot, setSnapshot, actionable: isUpdateActionable(snapshot) };
}
