import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  installPendingUpdate,
  probeForUpdate,
  readAppVersion,
  type UpdaterSnapshot,
} from "../model/updater";

export function isUpdateActionable(snapshot: UpdaterSnapshot): boolean {
  return snapshot.phase === "available" || snapshot.phase === "downloading";
}

/** The workspace owns one updater across all activity-bar layouts and pop-outs. */
export function useUpdateStatus() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });

  const installing = useRef(false);
  const install = useCallback(async () => {
    if (installing.current) return;
    installing.current = true;
    setSnapshot((current) => ({ ...current, phase: "downloading" }));
    try {
      await installPendingUpdate(setSnapshot);
    } finally {
      installing.current = false;
    }
  }, []);

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

  // Activity bars memoize on this object; a fresh one each render rebuilt the
  // whole sidebar on every workspace update.
  return useMemo(
    () => ({
      snapshot,
      setSnapshot,
      actionable: isUpdateActionable(snapshot),
      install,
    }),
    [snapshot, install],
  );
}

export type UpdateStatus = ReturnType<typeof useUpdateStatus>;
