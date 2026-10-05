import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
  applySessionSync,
  type HostCommand,
  type HostSession,
  type HostSessionSummary,
  type RemoteMachine,
  type SessionSync,
  type SessionSyncChunk,
  type SessionSyncResponse,
} from "./protocol";
import { remoteProjectFor, ensureSharedProject, sharedHostMachineId } from "./remoteProjects";
import { withRemoteAttachmentPreviews } from "./remoteAttachmentPreviews";
import { isRemoteProjectPath } from "../../projects/model/recents";

const CHANGE = "monocode:remote-machines";
export const REMOTE_HISTORY_CHANGE = "monocode:remote-history";
export const REMOTE_HISTORY_UPDATED = "monocode:remote-history-updated";
export const refreshRemoteProjectSessions = () =>
  window.dispatchEvent(new Event(REMOTE_HISTORY_CHANGE));
let cachedMachines: RemoteMachine[] = [];
let machinesLoaded = false;
let machineRequest: Promise<RemoteMachine[]> | undefined;
let machineRevision = 0;
export const OPEN_CONNECTIONS_EVENT = "monocode:open-connections";
export const OPEN_REMOTE_PROJECT_EVENT = "monocode:open-remote-project";
export const refreshRemoteMachines = () =>
  window.dispatchEvent(new Event(CHANGE));
const TAB_KEY = "monocode.remote-tabs.v2";
const WORKTREE_KEY = "monocode.remote-pending-worktrees.v1";

export function remotePendingWorktree(shellId: string): string | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(WORKTREE_KEY) ?? "{}")[
      shellId
    ];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The host checkout currently used by a remote tab. */
export function remoteTabCwd(project: string, shellId?: string): string | undefined {
  if (!shellId) return undefined;
  const sessionId = remoteSessionFor(shellId);
  return (
    (sessionId ? cachedRemoteSessionSummary(project, sessionId)?.cwd : undefined) ??
    remotePendingWorktree(shellId)
  );
}

export function rememberRemotePendingWorktree(shellId: string, path?: string) {
  try {
    const all = JSON.parse(localStorage.getItem(WORKTREE_KEY) ?? "{}");
    if (path) all[shellId] = path;
    else delete all[shellId];
    localStorage.setItem(WORKTREE_KEY, JSON.stringify(all));
  } catch {
    /* selection is restored from the host once a session exists */
  }
}

/** The host session a tab in a remote project shows; none for a new session. */
export function remoteSessionFor(shellId: string): string | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(TAB_KEY) ?? "{}")[shellId];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
export function rememberRemoteSession(shellId: string, sessionId?: string) {
  try {
    const all = JSON.parse(localStorage.getItem(TAB_KEY) ?? "{}");
    if (sessionId) all[shellId] = sessionId;
    else delete all[shellId];
    localStorage.setItem(TAB_KEY, JSON.stringify(all));
  } catch {
    /* tab selection is best effort */
  }
  window.dispatchEvent(new Event(REMOTE_HISTORY_CHANGE));
}

export function forgetDeletedRemoteBindings(ids: readonly string[]) {
  const deleted = new Set(ids);
  const bindings = JSON.parse(localStorage.getItem(TAB_KEY) ?? "{}");
  for (const [shellId, hostId] of Object.entries(bindings)) {
    if (typeof hostId === "string" && deleted.has(hostId)) delete bindings[shellId];
  }
  localStorage.setItem(TAB_KEY, JSON.stringify(bindings));
}

const pendingPrefix = (project: string, environment: string) =>
  `monocode.remote-command.v1:${JSON.stringify([project, environment])}:`;

type PendingEntry = { command: HostCommand; shellId?: string; followup?: HostCommand };
const readPendingEntry = (value: string): PendingEntry => {
  const parsed = JSON.parse(value) as PendingEntry | HostCommand;
  return "command" in parsed ? parsed : { command: parsed };
};

export const pendingRemoteFollowup = (project: string, environment: string, id: string) => {
  const value = localStorage.getItem(`${pendingPrefix(project, environment)}${id}`);
  return value ? readPendingEntry(value).followup : undefined;
};

export const pendingRemoteCommand = (
  project: string,
  environment: string,
  sessionId?: string | null,
  shellId?: string,
): HostCommand | undefined => {
  const prefix = pendingPrefix(project, environment);
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      const value = localStorage.getItem(key);
      if (value) {
        const entry = readPendingEntry(value);
        const command = entry.command;
        if (
          sessionId === undefined ||
          (sessionId === null
            ? command.type === "create" && (!entry.shellId || entry.shellId === shellId)
            : command.type !== "create" && command.sessionId === sessionId)
        )
          return command;
      }
    }
  }
};

// Each command owns its storage entry: a late receipt from another pane can
// never erase this pane's uncertain request. Persistence must succeed before
// dispatch; unlike preferences, silently dropping an outbox entry is unsafe.
export const savePendingRemoteCommand = (
  project: string,
  environment: string,
  command: HostCommand,
  shellId?: string,
  followup?: HostCommand,
) => {
  try {
    localStorage.setItem(
      `${pendingPrefix(project, environment)}${command.commandId}`,
      JSON.stringify({ command, shellId,
        followup: followup ?? pendingRemoteFollowup(project, environment, command.commandId),
      } satisfies PendingEntry),
    );
  } catch {
    throw new Error(
      "Cannot save your request locally. Free up app storage before sending.",
    );
  }
};
export const clearPendingRemoteCommand = (
  project: string,
  environment: string,
  commandId: string,
) =>
  localStorage.removeItem(`${pendingPrefix(project, environment)}${commandId}`);

export async function remoteRequest<T>(
  machineId: string,
  method: string,
  params: unknown = {},
): Promise<T> {
  const result = await invoke<T>("remote_request", { machineId, method, params });
  if (method === "sessions.delete" && machineId === sharedHostMachineId()) {
    // Explicit deletion clears the migration row's native worktree/reminder
    // references, without deleting the original attachment recovery files.
    await invoke("session_delete", { sessionId: (params as { sessionId: string }).sessionId, imagePaths: [] });
  }
  return result;
}

/** Reads one sync, assembling it from bounded pieces when the host chunks it. */
async function syncRemoteSession(
  machineId: string,
  sessionId: string,
  revision?: number,
): Promise<SessionSync> {
  const response = await remoteRequest<SessionSyncResponse>(
    machineId,
    "sessions.sync",
    { sessionId, revision },
  );
  if (response.kind !== "chunked") return response;
  const pieces: string[] = [];
  let offset = 0;
  while (offset < response.length) {
    const { data } = await remoteRequest<SessionSyncChunk>(
      machineId,
      "sessions.syncChunk",
      { sessionId, transfer: response.transfer, offset },
    );
    if (!data) throw new Error("Session transfer ended early");
    pieces.push(data);
    offset += data.length;
  }
  if (offset !== response.length)
    throw new Error("Session transfer has an unexpected length");
  return JSON.parse(pieces.join("")) as SessionSync;
}

/** Fetches only what changed since `known`; falls back to a full snapshot. */
export async function loadRemoteSession(
  machineId: string,
  sessionId: string,
  known?: HostSession,
): Promise<HostSession> {
  const sync = (revision?: number) =>
    syncRemoteSession(machineId, sessionId, revision);
  const update = await sync(known?.revision);
  let snapshot: HostSession;
  try {
    snapshot = applySessionSync(known, update);
  } catch {
    snapshot = applySessionSync(undefined, await sync());
  }
  return withRemoteAttachmentPreviews(machineId, snapshot, known,
    (params) => remoteRequest(machineId, "attachments.read", params));
}

/** The connected machine for an environment, from the last machine list read. */
export function knownRemoteMachine(
  environmentId: string,
): RemoteMachine | undefined {
  return cachedMachines.find((entry) => entry.environmentId === environmentId);
}

/** The connected machine for an environment, reading the list when needed. */
export async function remoteMachineFor(
  environmentId: string,
): Promise<RemoteMachine | undefined> {
  const known = knownRemoteMachine(environmentId);
  if (known || (machinesLoaded && !machineRequest)) return known;
  await readRemoteMachines();
  return knownRemoteMachine(environmentId);
}

function readRemoteMachines(): Promise<RemoteMachine[]> {
  if (machineRequest) return machineRequest;
  const revision = machineRevision;
  const request = invoke<RemoteMachine[]>("remote_machines").then((value) => {
    if (machineRevision === revision) {
      cachedMachines = Array.isArray(value) ? value : [];
      machinesLoaded = true;
    }
    return cachedMachines;
  });
  machineRequest = request;
  void request.finally(() => {
    if (machineRequest === request) machineRequest = undefined;
  }).catch(() => {});
  return request;
}

export async function connectMachine(
  name: string,
  url: string,
  token: string,
): Promise<RemoteMachine> {
  const machine = await invoke<RemoteMachine>("remote_connect", {
    name,
    url,
    token,
  });
  machineRevision++;
  cachedMachines = [
    ...cachedMachines.filter((entry) => entry.id !== machine.id),
    machine,
  ];
  machinesLoaded = true;
  window.dispatchEvent(new Event(CHANGE));
  return machine;
}

export async function disconnectMachine(machineId: string): Promise<void> {
  await invoke("remote_disconnect", { machineId });
  machineRevision++;
  cachedMachines = cachedMachines.filter((entry) => entry.id !== machineId);
  window.dispatchEvent(new Event(CHANGE));
}

export function useRemoteMachines(enabled = true): {
  machines: RemoteMachine[];
  loaded: boolean;
} {
  const [state, setState] = useState<{
    machines: RemoteMachine[];
    loaded: boolean;
  }>({ machines: cachedMachines, loaded: machinesLoaded });
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const refresh = () => {
      void readRemoteMachines()
        .then((value) => {
          if (!disposed) {
            setState({
              machines: value,
              loaded: true,
            });
          }
        })
        .catch(() => {
          // A temporary connection failure should not blank every remote
          // panel while a fresh machine list is requested.
          if (!disposed) setState({ machines: cachedMachines, loaded: true });
        });
    };
    refresh();
    window.addEventListener(CHANGE, refresh);
    return () => {
      disposed = true;
      window.removeEventListener(CHANGE, refresh);
    };
  }, [enabled]);
  return state;
}

const STATUS = "monocode:remote-machine-status";
const machineOnline = new Map<string, boolean>();
const statusWatchers = new Map<
  string,
  { count: number; timer?: ReturnType<typeof setTimeout> }
>();

/** Records whether a machine answered its latest request, for every view
 * that shows its connection state. */
export function reportRemoteMachineStatus(machineId: string, online: boolean) {
  if (machineOnline.get(machineId) === online) return;
  machineOnline.set(machineId, online);
  window.dispatchEvent(new Event(STATUS));
}

function watchMachineStatus(machineId: string): () => void {
  const existing = statusWatchers.get(machineId);
  if (existing) {
    existing.count++;
  } else {
    const watcher: { count: number; timer?: ReturnType<typeof setTimeout> } =
      { count: 1 };
    statusWatchers.set(machineId, watcher);
    let failures = 0;
    const poll = async () => {
      try {
        await remoteRequest(machineId, "environment.describe");
        failures = 0;
        reportRemoteMachineStatus(machineId, true);
      } catch {
        failures = Math.min(4, failures + 1);
        reportRemoteMachineStatus(machineId, false);
      }
      if (statusWatchers.get(machineId) === watcher)
        watcher.timer = setTimeout(
          () => void poll(),
          failures ? Math.min(30_000, 3_000 * 2 ** failures) : 15_000,
        );
    };
    void poll();
  }
  return () => {
    const watcher = statusWatchers.get(machineId);
    if (!watcher || --watcher.count > 0) return;
    clearTimeout(watcher.timer);
    statusWatchers.delete(machineId);
  };
}

/** Whether a machine is reachable; undefined until the first check returns. */
export function useRemoteMachineOnline(machineId?: string): boolean | undefined {
  const [online, setOnline] = useState(() =>
    machineId ? machineOnline.get(machineId) : undefined,
  );
  useEffect(() => {
    if (!machineId) {
      setOnline(undefined);
      return;
    }
    const update = () => setOnline(machineOnline.get(machineId));
    update();
    window.addEventListener(STATUS, update);
    const unwatch = watchMachineStatus(machineId);
    return () => {
      window.removeEventListener(STATUS, update);
      unwatch();
    };
  }, [machineId]);
  return online;
}

const historyKey = (project: string) => `monocode.remote-history.v2:${project}`;

export type RemoteProjectSessions = {
  /** Undefined when this machine is not connected on this computer. */
  machine?: RemoteMachine;
  sessions: HostSessionSummary[];
  /** True after a successful response or a restored cache, including an empty list. */
  loaded: boolean;
  pending: boolean;
  error?: string;
  offline: boolean;
};

type CachedRemoteProjectSessions = Omit<RemoteProjectSessions, "machine">;
const sessionCaches = new Map<string, CachedRemoteProjectSessions>();
const sessionRequests = new Map<string, {
  identity: string;
  machineId?: string;
  promise: Promise<void>;
}>();
const sessionWatchers = new Map<string, {
  count: number;
  timer?: ReturnType<typeof setTimeout>;
}>();

const sessionProjectKey = (project: string) => remoteProjectFor(project)?.key ??
  (project.replace(/\\/g, "/").replace(/\/+$/, "") || "/");
const sessionProjectIdentity = (project: string) => {
  const remote = remoteProjectFor(project);
  return remote ? JSON.stringify([
    remote.environmentId,
    remote.local ? remote.key : remote.projectId,
  ]) : undefined;
};

function sessionCache(project: string): CachedRemoteProjectSessions {
  const key = sessionProjectKey(project);
  const known = sessionCaches.get(key);
  if (known) return known;
  let sessions: HostSessionSummary[] = [];
  let loaded = false;
  try {
    const stored = localStorage.getItem(historyKey(key)) ??
      localStorage.getItem(historyKey(project));
    if (stored !== null) {
      const value: unknown = JSON.parse(stored);
      if (Array.isArray(value)) {
        sessions = value as HostSessionSummary[];
        loaded = true;
      }
    }
  } catch {
    /* A damaged or unavailable cache does not prevent a fresh request. */
  }
  const state = { sessions, loaded, pending: false, offline: false };
  sessionCaches.set(key, state);
  return state;
}

/** The most recent successful list, even while this project is collapsed. */
export function cachedRemoteSessions(project: string): HostSessionSummary[] {
  return sessionCache(project).sessions;
}

/** Whether a complete successful list is available, including an empty cache. */
export function hasCachedRemoteProjectSessions(project: string): boolean {
  return sessionCache(project).loaded;
}

/** Read collapsed-project load/error state without starting a polling hook. */
export function cachedRemoteProjectSessionsState(
  project: string,
): Readonly<Omit<RemoteProjectSessions, "machine" | "sessions">> {
  const { sessions: _sessions, ...state } = sessionCache(project);
  const remote = remoteProjectFor(project);
  return {
    ...state,
    offline:
      (!!remote || isRemoteProjectPath(project)) &&
      (!remote || !knownRemoteMachine(remote.environmentId) || state.offline),
  };
}

export function cachedRemoteSessionSummary(project: string, sessionId: string) {
  return cachedRemoteSessions(project).find((session) => session.id === sessionId);
}

/** Reads once without starting polling. Pollers and search share this request. */
export function prefetchRemoteProjectSessions(project: string): Promise<void> {
  const remote = remoteProjectFor(project);
  if (!remote) {
    if (!isRemoteProjectPath(project)) return Promise.resolve();
    const error = new Error("Remote project is not registered on this computer");
    const state = sessionCache(project);
    state.pending = false;
    state.offline = true;
    state.error = error.message;
    window.dispatchEvent(new Event(REMOTE_HISTORY_UPDATED));
    return Promise.reject(error);
  }
  const key = sessionProjectKey(project);
  const identity = sessionProjectIdentity(project)!;
  const pending = sessionRequests.get(key);
  const knownMachineId = knownRemoteMachine(remote.environmentId)?.id;
  if (pending?.identity === identity &&
      (!pending.machineId || pending.machineId === knownMachineId)) return pending.promise;
  const state = sessionCache(project);
  const request = { identity, machineId: knownMachineId, promise: Promise.resolve() };
  let unavailable = false;
  state.pending = true;
  state.error = undefined;
  request.promise = (async () => {
    try {
      const machine = await remoteMachineFor(remote.environmentId);
      if (!machine) {
        unavailable = true;
        throw new Error("Remote machine is not connected");
      }
      request.machineId = machine.id;
      const hostProject = remote.local ? await ensureSharedProject(remote.cwd) : remote;
      if (sessionRequests.get(key) !== request ||
          sessionProjectIdentity(project) !== identity ||
          knownRemoteMachine(remote.environmentId)?.id !== machine.id) return;
      const next = await remoteRequest<HostSessionSummary[]>(
        machine.id, "sessions.list", { projectId: hostProject.projectId },
      );
      // Re-registering a folder or changing its Host must not let an older
      // request overwrite the replacement project's history.
      if (sessionRequests.get(key) !== request ||
          sessionProjectIdentity(project) !== identity ||
          knownRemoteMachine(remote.environmentId)?.id !== machine.id) return;
      state.sessions = next;
      state.loaded = true;
      state.offline = false;
      state.error = undefined;
      try {
        localStorage.setItem(historyKey(key), JSON.stringify(next));
      } catch {
        /* Keep the successful in-memory cache if storage is full. */
      }
    } catch (error) {
      if (sessionRequests.get(key) === request &&
          sessionProjectIdentity(project) === identity &&
          knownRemoteMachine(remote.environmentId)?.id === request.machineId) {
        state.offline = true;
        state.error = unavailable ? undefined :
          error instanceof Error ? error.message : String(error);
      }
      throw error;
    } finally {
      if (sessionRequests.get(key) === request) {
        sessionRequests.delete(key);
        state.pending = false;
        window.dispatchEvent(new Event(REMOTE_HISTORY_UPDATED));
      }
    }
  })();
  sessionRequests.set(key, request);
  window.dispatchEvent(new Event(REMOTE_HISTORY_UPDATED));
  return request.promise;
}

function watchProjectSessions(project: string): () => void {
  const key = sessionProjectKey(project);
  let watcher = sessionWatchers.get(key);
  if (watcher) {
    watcher.count++;
  } else {
    watcher = { count: 1 };
    sessionWatchers.set(key, watcher);
    const current = watcher;
    let failures = 0;
    const poll = async () => {
      try {
        await prefetchRemoteProjectSessions(project);
        failures = 0;
      } catch {
        failures = Math.min(4, failures + 1);
      }
      if (sessionWatchers.get(key) === current)
        current.timer = setTimeout(
          () => void poll(),
          failures ? Math.min(30_000, 3_000 * 2 ** failures) : 3_000,
        );
    };
    void poll();
  }
  const current = watcher;
  return () => {
    if (sessionWatchers.get(key) !== current || --current.count > 0) return;
    clearTimeout(current.timer);
    sessionWatchers.delete(key);
  };
}

/** Lists a remote project's host sessions, keeping the last list visible
 * while the machine is unreachable. */
export function useRemoteProjectSessions(
  project: string,
  enabled = true,
): RemoteProjectSessions {
  const remote = remoteProjectFor(project);
  useRemoteMachines(enabled && !!remote);
  const machine = remote ? knownRemoteMachine(remote.environmentId) : undefined;
  const [state, setState] = useState(() => ({ ...sessionCache(project) }));
  useEffect(() => {
    const updated = () => setState({ ...sessionCache(project) });
    const refresh = () => {
      if (remoteProjectFor(project) || isRemoteProjectPath(project))
        void prefetchRemoteProjectSessions(project).catch(() => {});
    };
    updated();
    window.addEventListener(REMOTE_HISTORY_UPDATED, updated);
    window.addEventListener(REMOTE_HISTORY_CHANGE, refresh);
    window.addEventListener(CHANGE, updated);
    return () => {
      window.removeEventListener(REMOTE_HISTORY_UPDATED, updated);
      window.removeEventListener(REMOTE_HISTORY_CHANGE, refresh);
      window.removeEventListener(CHANGE, updated);
    };
  }, [project]);
  useEffect(() => {
    if (!enabled || !remote) return;
    return watchProjectSessions(project);
  }, [project, enabled, remote?.environmentId, remote?.projectId, machine?.id]);
  return {
    ...state,
    machine,
    offline: (!!remote || isRemoteProjectPath(project)) && (!machine || state.offline),
  };
}
