import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { RefreshCw } from "../../../shared/ui/icons";
import {
  discoverNativeSessions,
  importNativeSession,
  nativeAutoSyncEnabled,
  nativeSessionSnapshot,
  setNativeAutoSync,
  subscribeNativeSessions,
  syncNativeSessions,
} from "../../sessions/data/nativeSessions";
import type { NativeSessionFile } from "../../../integrations/harness/core/nativeSessions";

export function NativeSessionsPanel({
  onOpenSession,
}: {
  onOpenSession?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(
    subscribeNativeSessions,
    nativeSessionSnapshot,
  );
  const [auto, setAuto] = useState(nativeAutoSyncEnabled);
  const [filter, setFilter] = useState<"all" | "codex" | "pi">("all");
  const [query, setQuery] = useState("");
  const [imported, setImported] = useState<Record<string, string>>({});
  const desktop = typeof isTauri === "function" && isTauri();
  useEffect(() => {
    if (desktop) void discoverNativeSessions().catch(() => undefined);
  }, [desktop]);
  const files = useMemo(
    () =>
      state.files.filter(
        (file) =>
          (filter === "all" || file.provider === filter) &&
          `${file.cwd} ${file.providerSessionId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [state.files, filter, query],
  );
  const importFile = async (file: NativeSessionFile) => {
    try {
      const id = await importNativeSession(file);
      if (id) setImported((current) => ({ ...current, [file.path]: id }));
    } catch {
      /* The shared status carries the concrete error. */
    }
  };
  return (
    <section
      data-setting-id="native-sessions"
      id="setting-native-sessions"
      className="mb-6 rounded-xl border border-border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-content">{t("Native sessions")}</h2>
        <button
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-content/5 disabled:opacity-50"
          disabled={!desktop || state.busy}
          onClick={() => void syncNativeSessions()}
        >
          <RefreshCw className="size-3.5" />
          {t("Refresh and sync")}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {t(
          "Import local Codex and Pi conversations, keep their history up to date, and continue the original session.",
        )}
      </p>
      <p className="mt-1 text-xs text-muted">
        {t(
          "Sources follow CODEX_HOME and Pi session directory settings. Images remain in the native session; imported history shows a placeholder.",
        )}
      </p>
      {!desktop ? (
        <p className="mt-3 text-sm text-muted">
          {t("Native session import is available in the desktop app.")}
        </p>
      ) : (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => {
                const value = event.target.checked;
                setAuto(value);
                setNativeAutoSync(value);
              }}
            />
            {t("Automatically sync imported sessions every 30 seconds")}
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              aria-label={t("Session provider")}
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as typeof filter)
              }
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            >
              <option value="all">{t("All providers")}</option>
              <option value="codex">Codex</option>
              <option value="pi">Pi</option>
            </select>
            <input
              aria-label={t("Search native sessions")}
              placeholder={t("Search by project or session ID")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-40 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            />
          </div>
          {state.busy ? (
            <p role="status" className="mt-3 text-sm text-muted">
              {t("Reading native sessions…")}
            </p>
          ) : null}
          {!state.busy && !files.length ? (
            <p className="mt-3 text-sm text-muted">
              {t("No native sessions found.")}
            </p>
          ) : null}
          <div className="mt-3 max-h-96 divide-y divide-border overflow-auto">
            {files.slice(0, 100).map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 text-sm">
                  <div className="truncate" title={file.cwd}>
                    {file.provider === "codex" ? "Codex" : "Pi"} · {file.cwd}
                  </div>
                  <div
                    className="truncate text-xs text-muted"
                    title={file.path}
                  >
                    {file.providerSessionId} ·{" "}
                    {new Date(file.modifiedAt).toLocaleString()}
                  </div>
                </div>
                {imported[file.path] && onOpenSession ? (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-sm hover:bg-content/5"
                    onClick={() => onOpenSession(imported[file.path])}
                  >
                    {t("Open")}
                  </button>
                ) : null}
                <button
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-sm hover:bg-content/5 disabled:opacity-50"
                  disabled={state.busy}
                  onClick={() => void importFile(file)}
                >
                  {t("Import / refresh")}
                </button>
              </div>
            ))}
          </div>
          {files.length > 100 ? (
            <p className="mt-2 text-xs text-muted">
              {t(
                "Showing the first 100 sessions. Narrow your search to find more.",
              )}
            </p>
          ) : null}
          {state.lastSynced ? (
            <p className="mt-2 text-xs text-muted">
              {t("Last sync: {time}", {
                time: new Date(state.lastSynced).toLocaleTimeString(),
              })}
            </p>
          ) : null}
          {state.error ? (
            <p
              role="alert"
              className="mt-3 whitespace-pre-wrap text-sm text-red-500"
            >
              {state.error}
            </p>
          ) : null}
          {state.warnings.length ? (
            <details className="mt-3 text-xs text-muted">
              <summary>
                {t("Some native sessions could not be read ({count})", {
                  count: state.warnings.length,
                })}
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
                {state.warnings.join("\n")}
              </pre>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
