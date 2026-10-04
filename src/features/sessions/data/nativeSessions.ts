import { translate } from "../../../shared/i18n/language";
import { invoke } from "@tauri-apps/api/core";
import {
  bindHarnessSession,
  stopHarnessSession,
} from "../../../integrations/harness/core/registry";
import type {
  NativeSessionFile,
  NativeSessionAccess,
  NativeSessionProbe,
  NativeTranscript,
} from "../../../integrations/harness/core/nativeSessions";
import { parseCodexSession } from "../../../integrations/harness/providers/codex/codexSessionImport";
import { parsePiSession } from "../../../integrations/harness/providers/pi/piSessionImport";
import {
  newSession,
  sessionWorkCwd,
  titleFromPrompt,
  type Session,
} from "../model/session";
import { getSession, upsertSession, type SessionSummary } from "./sessionStore";
import { sharedSessionBackend } from "./sharedSessionBackend";

export type NativeSessionState = {
  files: NativeSessionFile[];
  access: Record<string, NativeSessionAccess>;
  warnings: string[];
  busy: boolean;
  error?: string;
  lastSynced?: number;
};
let state: NativeSessionState = {
  files: [],
  warnings: [],
  busy: false,
  access: {},
};
const listeners = new Set<() => void>();
export const nativeSessionSnapshot = () => state;
export const subscribeNativeSessions = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function publish(patch: Partial<NativeSessionState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}
export function nativeSessionAccess(
  session: Session,
): NativeSessionAccess | undefined {
  const access = state.access[session.id];
  return access?.path === session.nativeSession?.path ? access : undefined;
}
export function nativeSessionReadOnly(session: Session): boolean {
  if (!session.nativeSession) return false;
  const access = nativeSessionAccess(session);
  return (
    !access ||
    access.state !== "idle" ||
    (!session.busy && Date.now() - access.checkedAt > 15_000)
  );
}
export function nativeSessionAccessHint(session: Session): string | undefined {
  if (!nativeSessionReadOnly(session)) return undefined;
  const access = nativeSessionAccess(session);
  if (access?.state === "external")
    return translate(
      "This session is open in another CLI. History keeps syncing; close that CLI to continue here.",
    );
  if (access?.reason === "anotherMonocode")
    return translate(
      "Another MonoCode window is using this session. It will become available when that operation finishes.",
    );
  if (access?.reason === "historyPending")
    return translate(
      "Refresh the native history before continuing this session.",
    );
  if (access?.reason === "unsupportedPlatform")
    return translate(
      "Native session ownership cannot be verified on this platform. Imported history is read-only.",
    );
  if (access?.state === "unknown")
    return translate(
      "Native session ownership is unclear. History keeps syncing; close other CLIs before continuing.",
    );
  return translate("Checking native session access…");
}
function publishAccess(id: string, access: NativeSessionAccess) {
  publish({ access: { ...state.access, [id]: access } });
}

const AUTO_KEY = "monocode.nativeSessionAutoSync";
const AUTO_EVENT = "monocode:native-session-auto-sync";
let autoFallback = true;
export function nativeAutoSyncEnabled(): boolean {
  try {
    const value = localStorage.getItem(AUTO_KEY);
    return value == null ? autoFallback : value !== "false";
  } catch {
    return autoFallback;
  }
}
export function setNativeAutoSync(enabled: boolean): void {
  autoFallback = enabled;
  try {
    localStorage.setItem(AUTO_KEY, String(enabled));
  } catch {
    /* Keep the chosen preference for this window. */
  }
  window.dispatchEvent(new Event(AUTO_EVENT));
}

export function parseNativeSession(
  content: string,
  file: NativeSessionFile,
): NativeTranscript {
  return file.provider === "codex"
    ? parseCodexSession(content, file)
    : parsePiSession(content, file);
}

/** A local turn not yet present on disk must survive a failed/partial native write. */
export function reconcileNativeSession(
  session: Session,
  file: NativeSessionFile,
  transcript: NativeTranscript,
): Session {
  if (
    session.busy ||
    session.pendingSwitch ||
    session.worktreeRemoved ||
    session.harness !== file.provider ||
    (session.providerSessionId &&
      session.providerSessionId !== file.providerSessionId)
  )
    throw new Error(
      translate("Session is running or its provider binding changed"),
    );
  if (!transcript.blocks.some((block) => block.role === "user"))
    throw new Error(translate("Native session has no user messages yet"));
  const tracked = new Set(session.nativeSession?.blockIds ?? []);
  const localUsers = session.blocks.filter(
    (block) => block.role === "user" && !tracked.has(block.id),
  );
  const nativeUsers = transcript.blocks.filter(
    (block) => block.role === "user",
  );
  const nativeTail = nativeUsers.slice(-localUsers.length);
  if (
    localUsers.length &&
    (nativeTail.length !== localUsers.length ||
      localUsers.some((block, index) => block.text !== nativeTail[index].text))
  )
    throw new Error(
      translate(
        "Local messages are not in the native session yet; synchronization deferred",
      ),
    );
  if (localUsers.length) {
    const lastUser = transcript.blocks
      .map((block) => block.role)
      .lastIndexOf("user");
    const localHasAnswer = session.blocks
      .slice(session.blocks.map((block) => block.role).lastIndexOf("user") + 1)
      .some((block) => block.role === "assistant");
    if (
      localHasAnswer &&
      !transcript.blocks
        .slice(lastUser + 1)
        .some((block) => block.role === "assistant")
    )
      throw new Error(
        translate(
          "Local messages are not in the native session yet; synchronization deferred",
        ),
      );
  }
  // Keep user-owned turn panels when the corresponding native message is reread.
  const existingUsers = session.blocks.filter((block) => block.role === "user");
  let userIndex = 0;
  const blocks = transcript.blocks.map((block) => {
    if (block.role !== "user") return block;
    const previous = existingUsers[userIndex++];
    return previous?.text === block.text ? { ...previous, ...block } : block;
  });
  return {
    ...session,
    providerSessionId: file.providerSessionId,
    providerAccountId:
      file.provider === "codex"
        ? (session.providerAccountId ?? "default")
        : session.providerAccountId,
    blocks,
    nativeSession: {
      provider: file.provider,
      providerSessionId: file.providerSessionId,
      createdAt: transcript.createdAt,
      updatedAt: file.modifiedAt,
      path: file.path,
      revision: file.revision,
      blockIds: blocks.map((block) => block.id),
    },
    model: transcript.model ?? session.model,
    modelSettings: { ...session.modelSettings, ...transcript.modelSettings },
  };
}

type Runtime = {
  getLive(id: string): Session | undefined;
  /** The app's existing operation guard also blocks submission/deletion/worktree changes. */
  lock(id: string): (() => void) | undefined;
  changed(session: Session, summary: SessionSummary, imported: boolean): void;
};
let runtime: Runtime | undefined;
let operation: Promise<unknown> = Promise.resolve();
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const next = operation.catch(() => undefined).then(run);
  operation = next;
  return next;
}

async function discover(): Promise<NativeSessionFile[]> {
  const listing = await invoke<{
    sessions: NativeSessionFile[];
    warnings: string[];
  }>("native_sessions_list");
  publish({ files: listing.sessions, warnings: listing.warnings });
  return listing.sessions;
}
export function discoverNativeSessions(): Promise<NativeSessionFile[]> {
  return serialized(async () => {
    publish({ busy: true, error: undefined });
    try {
      return await discover();
    } catch (error) {
      publish({
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      publish({ busy: false });
    }
  });
}

async function update(
  listedFile: NativeSessionFile,
  id: string,
  imported: boolean,
  syncHistory = true,
): Promise<string | null> {
  const owner = runtime;
  if (!owner)
    throw new Error(translate("Native session synchronization is unavailable"));
  const release = owner.lock(id);
  if (!release) {
    if (imported)
      throw new Error(
        translate("Wait for the current session operation to finish"),
      );
    return null;
  }
  try {
    let current = owner.getLive(id) ?? (await getSession(id));
    const shared = sharedSessionBackend();
    if (current?.nativeSession && !current.busy && shared?.ownsSession(id)) {
      const canonical = await shared.get(id);
      if (!canonical) return null;
      current = { ...current, title: canonical.title, titleState: canonical.titleState, linkedWorkItem: canonical.linkedWorkItem };
    }
    let probe: NativeSessionProbe;
    try {
      probe = await invoke<NativeSessionProbe>("native_session_probe", {
        sessionId: id,
        path: listedFile.path,
        providerSessionId: listedFile.providerSessionId,
      });
    } catch (error) {
      publishAccess(id, {
        state: "unknown",
        reason: "unavailable",
        checkedAt: Date.now(),
        path: listedFile.path,
      });
      throw error;
    }
    const file = probe.file;
    const access = probe.access;
    // Never expose idle before the visible history has caught up to the same snapshot.
    if (access.state !== "idle") publishAccess(id, access);
    if (!syncHistory && current?.nativeSession?.revision !== file.revision) {
      if (access.state === "idle")
        publishAccess(id, {
          ...access,
          state: "checking",
          reason: "historyPending",
        });
      return current?.id ?? null;
    }
    if (!current && !imported) return null; // Deleted imports are never recreated by the timer.
    if (
      current?.nativeSession?.revision === file.revision &&
      current.nativeSession.path === file.path
    ) {
      if (shared && access.state === "idle" && !current.busy) await shared.mirrorNative(current);
      publishAccess(id, access);
      return current.id;
    }
    const content = await invoke<string>("native_session_read", {
      path: file.path,
      revision: file.revision,
    });
    const transcript = parseNativeSession(content, file);
    const fresh = {
      ...newSession(file.provider, file.cwd, transcript.model),
      id,
      providerAccountId: file.provider === "codex" ? "default" : undefined,
      title:
        transcript.title ||
        titleFromPrompt(
          transcript.blocks.find((block) => block.role === "user")?.text ?? "",
          file.provider,
        ),
    };
    const next = reconcileNativeSession(current ?? fresh, file, transcript);
    if (runtime !== owner) return null;
    if (current) await stopHarnessSession(current.harness, id);
    if (runtime !== owner) return null;
    const summary = await upsertSession(next);
    if (!summary) return null;
    bindHarnessSession(
      next.harness,
      next.id,
      file.providerSessionId,
      sessionWorkCwd(next),
      next.providerAccountId,
      next.blocks,
      next.nativeSession,
    );
    owner.changed(next, summary, imported);
    publishAccess(id, access);
    return next.id;
  } catch (error) {
    publishAccess(id, {
      state: "unknown",
      reason: "unavailable",
      checkedAt: Date.now(),
      path: listedFile.path,
    });
    throw error;
  } finally {
    release();
  }
}

export function importNativeSession(
  file: NativeSessionFile,
): Promise<string | null> {
  return serialized(async () => {
    publish({ busy: true, error: undefined });
    try {
      const existingId = await invoke<string | null>("session_find_native_id", {
        harness: file.provider,
        providerSessionId: file.providerSessionId,
      });
      return await update(
        file,
        existingId ?? `native-${file.provider}-${file.providerSessionId}`,
        true,
      );
    } catch (error) {
      publish({
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      publish({ busy: false });
    }
  });
}

export function syncNativeSessions(discoverWhenEmpty = true): Promise<void> {
  return serialized(async () => {
    if (!runtime) return;
    publish({ busy: true, error: undefined });
    try {
      const ids = await invoke<string[]>("session_list_native_ids");
      if (!ids.length && !discoverWhenEmpty) return;
      const files = await discover();
      const byPath = new Map(files.map((file) => [file.path, file]));
      const errors: string[] = [];
      for (const id of ids) {
        const current = runtime?.getLive(id) ?? (await getSession(id));
        if (!current?.nativeSession || current.busy || current.pendingSwitch)
          continue;
        const file = byPath.get(current.nativeSession.path);
        if (!file) {
          errors.push(
            `${current.title}: ${translate("Native session file is unavailable")}`,
          );
          continue;
        }

        try {
          await update(file, id, false);
        } catch (error) {
          errors.push(
            `${current.title}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      publish({
        lastSynced: Date.now(),
        error: errors.length ? errors.join("\n") : undefined,
      });
    } catch (error) {
      publish({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      publish({ busy: false });
    }
  });
}

let accessPoll: Promise<void> | undefined;
export function pollNativeSessionAccess(): Promise<void> {
  if (accessPoll) return accessPoll;
  const run = serialized(async () => {
    const owner = runtime;
    if (!owner) return;
    const ids = await invoke<string[]>("session_list_native_ids");
    for (const id of ids) {
      const current = owner.getLive(id) ?? (await getSession(id));
      if (!current?.nativeSession || runtime !== owner) continue;
      const source = current.nativeSession;
      try {
        if (current.busy) {
          const probe = await invoke<NativeSessionProbe>(
            "native_session_probe",
            {
              sessionId: id,
              ownOperationActive: true,
              path: source.path,
              providerSessionId: source.providerSessionId,
            },
          );
          // A blocked -> idle transition must wait for the active MonoCode turn to settle.
          if (
            probe.access.state !== "idle" ||
            nativeSessionAccess(current)?.state === "idle"
          )
            publishAccess(id, probe.access);
          continue;
        }
        const previous = nativeSessionAccess(current);
        const probe = await invoke<NativeSessionProbe>("native_session_probe", {
          sessionId: id,
          path: source.path,
          providerSessionId: source.providerSessionId,
        });
        const transitioning =
          previous?.state === "external" || previous?.state === "unknown";
        await update(
          probe.file,
          id,
          false,
          probe.access.state !== "idle" || transitioning,
        );
      } catch {
        publishAccess(id, {
          state: "unknown",
          reason: "unavailable",
          checkedAt: Date.now(),
          path: source.path,
        });
      }
    }
  }).catch(() => {
    if (runtime)
      for (const [id, access] of Object.entries(state.access))
        publishAccess(id, {
          ...access,
          state: "unknown",
          reason: "unavailable",
          checkedAt: Date.now(),
        });
  });
  accessPoll = run;
  void run.then(() => {
    if (accessPoll === run) accessPoll = undefined;
  });
  return run;
}

/** Install once in the desktop app; sync only imports already selected by the user. */
export function installNativeSessionSync(owner: Runtime): () => void {
  runtime = owner;
  const run = () => {
    if (nativeAutoSyncEnabled() && !state.busy) void syncNativeSessions(false);
  };
  const timer = window.setInterval(run, 30_000);
  const accessRun = () => {
    void pollNativeSessionAccess();
  };
  const accessTimer = window.setInterval(accessRun, 5_000);
  window.addEventListener("focus", accessRun);
  accessRun();
  window.addEventListener("focus", run);
  window.addEventListener(AUTO_EVENT, run);
  run();
  return () => {
    window.clearInterval(timer);
    window.clearInterval(accessTimer);
    window.removeEventListener("focus", accessRun);
    window.removeEventListener("focus", run);
    window.removeEventListener(AUTO_EVENT, run);
    if (runtime === owner) runtime = undefined;
  };
}
