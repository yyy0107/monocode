import { invoke } from "@tauri-apps/api/core";
import { hostOrchestrationClient } from "../../orchestration/model/orchestrationClient";
import type {
  HostProject,
  HostSession,
  HostSessionSummary,
  RemoteMachine,
} from "./protocol";
import type {
  NativeSessionAccess,
  NativeSourceListing,
} from "../../../integrations/harness/core/nativeSessions";
import {
  loadRemoteSession,
  remoteRequest,
  rememberRemoteSession,
  remoteSessionFor,
  refreshRemoteMachines,
  forgetDeletedRemoteBindings,
  remoteSessionScopeFor,
} from "./connections";
import {
  configureSharedHost,
  ensureSharedProject,
  sharedHostEnvironment,
  sharedProjects,
} from "./remoteProjects";
import {
  normalizeProjectPath,
  knownProjectPaths,
  rememberProject,
} from "../../projects/model/recents";
import {
  OUTBOX_PREFIX,
  deleteOutboxEntries,
  loadRemoteOutbox,
  outboxEntry,
  outboxKeys,
} from "./remoteOutbox";
import { setSharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import { setRetiredSessionIds, isRetiredSession } from "../../sessions/model/retiredSessions";
import type {
  SessionSummary,
  SessionSearchHit,
} from "../../sessions/data/sessionStore";

type PreparedHost = {
  machine: RemoteMachine;
  projects: HostProject[];
  sessions: { id: string; cwd: string; deleted?: boolean }[];
  retiredSessionIds?: string[];
};

export function clearRetiredHostOutbox(environmentId: string, retired: ReadonlySet<string>): void {
  const removals: string[] = [];
  for (const key of outboxKeys()) {
    if (!key.startsWith(OUTBOX_PREFIX)) continue;
    try {
      const boundary = key.lastIndexOf("]:" );
      const scope = JSON.parse(key.slice(OUTBOX_PREFIX.length, boundary + 1));
      if (scope[1] !== environmentId) continue;
      const entry = JSON.parse(outboxEntry(key)!);
      const command = entry.command ?? entry;
      if (retired.has(command.sessionId) || retired.has(entry.shellId)) removals.push(key);
    } catch {
      // Leave unrelated or malformed requests available for normal recovery.
    }
  }
  if (removals.length) void deleteOutboxEntries(removals);
}

/** Awaited before workspace restore: there is no fallback to a second runtime. */
export async function initializeSharedHost(): Promise<void> {
  await loadRemoteOutbox();
  const prepared = await invoke<PreparedHost>("shared_host_prepare");
  const projectByPath = new Map(prepared.projects.map(project => [normalizeProjectPath(project.cwd), project]));
  // Older bindings stored only a wire ID. A saved local workspace supplies
  // positive identity evidence; an unknown alias is kept for its own Host.
  const legacyShellIds = new Set<string>();
  const workspace = await invoke<{ sessions?: { id: string; cwd: string }[] } | null>("workspace_get_snapshot").catch(() => null);
  for (const row of Array.isArray(workspace?.sessions) ? workspace.sessions : []) {
    if (typeof row.id !== "string" || typeof row.cwd !== "string" || row.cwd.startsWith("remote://")) continue;
    const project = projectByPath.get(normalizeProjectPath(row.cwd));
    const scope = remoteSessionScopeFor(row.id);
    if (!project || scope && (scope.environmentId !== prepared.machine.environmentId || scope.projectId !== project.id)) continue;
    legacyShellIds.add(row.id);
    const hostId = remoteSessionFor(row.id);
    if (hostId) rememberRemoteSession(row.id, hostId, { environmentId: prepared.machine.environmentId, projectId: project.id });
  }
  const deletedIds = [...new Set([...(prepared.retiredSessionIds ?? []), ...prepared.sessions.filter(row => row.deleted).map(row => row.id)])];
  const deletedAliases = forgetDeletedRemoteBindings(deletedIds, {
    environmentId: prepared.machine.environmentId,
    projectIds: new Set(prepared.projects.map(project => project.id)),
    legacyShellIds,
  });
  const retiredIds = [...new Set([...deletedIds, ...deletedAliases])];
  setRetiredSessionIds(retiredIds);
  hostOrchestrationClient.retire(prepared.machine.environmentId, retiredIds);
  clearRetiredHostOutbox(prepared.machine.environmentId, new Set(retiredIds));
  configureSharedHost(
    prepared.machine.environmentId,
    prepared.projects,
    prepared.machine.id,
  );
  const known = new Set(knownProjectPaths().map(normalizeProjectPath));
  for (const project of prepared.projects) {
    if (!known.has(normalizeProjectPath(project.cwd)))
      rememberProject(project.cwd);
  }
  const paths = new Map(
    prepared.sessions.map((row) => [row.id, normalizeProjectPath(row.cwd)]),
  );
  for (const row of prepared.sessions) {
    const project = projectByPath.get(normalizeProjectPath(row.cwd));
    if (!row.deleted && !remoteSessionFor(row.id) && project)
      rememberRemoteSession(row.id, row.id, { environmentId: prepared.machine.environmentId, projectId: project.id });
  }
  const hostId = (id: string) => remoteSessionFor(id) ?? id;
  const localSession = async (id: string) => {
    const scope = remoteSessionScopeFor(id);
    if (isRetiredSession(id) || scope && scope.environmentId !== prepared.machine.environmentId) return null;
    try {
      const snapshot = await loadRemoteSession(prepared.machine.id, hostId(id));
      if (scope && snapshot.projectId !== scope.projectId) return null;
      const project = sharedProjects().find(
        (row) => row.projectId === snapshot.projectId,
      );
      if (!project) return null;
      hostOrchestrationClient.bindShell({ machineId: prepared.machine.id, project }, snapshot.session.id, id);
      hostOrchestrationClient.accept({ machineId: prepared.machine.id, project }, snapshot);
      paths.set(snapshot.session.id, project.cwd);
      paths.set(id, project.cwd);
      if (!remoteSessionFor(id)) rememberRemoteSession(id, snapshot.session.id, project);
      return {
        ...snapshot.session,
        nativeSyncStatus: snapshot.nativeStatus,
        id,
        cwd: project.cwd,
        worktreeCwd:
          snapshot.session.cwd === project.cwd
            ? undefined
            : snapshot.session.cwd,
      };
    } catch (error) {
      if (String(error).includes("Session not found")) return null;
      throw error;
    }
  };
  const list = async (cwd?: string): Promise<SessionSummary[]> => {
    if (!cwd)
      configureSharedHost(
        prepared.machine.environmentId,
        await remoteRequest<HostProject[]>(
          prepared.machine.id,
          "projects.list",
        ),
        prepared.machine.id,
      );
    const projects = cwd ? [await ensureSharedProject(cwd)] : sharedProjects();
    const results = await Promise.all(
      projects.map(async (project) => {
        const rows = await remoteRequest<HostSessionSummary[]>(
          prepared.machine.id,
          "sessions.list",
          { projectId: project.projectId },
        );
        return rows.map((row) => {
          hostOrchestrationClient.accept({ machineId: prepared.machine.id, project }, row);
          paths.set(row.id, project.cwd);
          return {
            ...row,
            cwd: project.cwd,
            model: row.model ?? "",
            runtimeMode: row.runtimeMode ?? "supervised",
            providerSessionId: row.providerSessionId ?? undefined,
            createdAt: row.createdAt ?? row.updatedAt,
          } satisfies SessionSummary;
        });
      }),
    );
    return results.flat();
  };
  const searches = new Map<string, number>();
  const projectForSession = async (id: string) => {
    let cwd = paths.get(id) ?? paths.get(hostId(id));
    if (!cwd) cwd = (await localSession(id))?.cwd;
    if (!cwd) throw new Error("Conversation not found");
    return ensureSharedProject(cwd);
  };
  setSharedSessionBackend({
    ownsProject: (cwd) =>
      !!sharedHostEnvironment() && !cwd.startsWith("remote://") && cwd !== "~",
    ownsSession: (id) => {
      const scope = remoteSessionScopeFor(id);
      if (scope && scope.environmentId !== prepared.machine.environmentId) return false;
      const cwd = paths.get(id) ?? paths.get(hostId(id));
      if (scope && cwd && sharedProjects().find(project => normalizeProjectPath(project.cwd) === normalizeProjectPath(cwd))?.projectId !== scope.projectId) return false;
      return paths.has(id) || (scope?.environmentId === prepared.machine.environmentId || legacyShellIds.has(id)) && paths.has(hostId(id));
    },
    rememberSession: (id, cwd) => {
      paths.set(id, normalizeProjectPath(cwd));
    },
    list,
    get: localSession,
    update: async (id, patch) => {
      const project = await projectForSession(id);
      await remoteRequest(prepared.machine.id, "sessions.update", {
        projectId: project.projectId,
        sessionId: hostId(id),
        ...patch,
      });
    },
    delete: async (id) => {
      const project = await projectForSession(id);
      await remoteRequest(prepared.machine.id, "sessions.delete", {
        projectId: project.projectId,
        sessionId: hostId(id),
      });
    },
    native: {
      list: (options = {}) =>
        remoteRequest<NativeSourceListing>(prepared.machine.id, "nativeSources.list", {
          ...(options.refresh ? { refresh: true } : {}),
          ...(options.autoSync === undefined ? {} : { autoSync: options.autoSync }),
        }),
      import: async (sourceId) => {
        const value = await remoteRequest<HostSession>(prepared.machine.id, "nativeSources.import", { sourceId });
        const project = await ensureSharedProject(value.session.cwd);
        paths.set(value.session.id, normalizeProjectPath(project.cwd));
        if (!remoteSessionFor(value.session.id))
          rememberRemoteSession(value.session.id, value.session.id, { environmentId: prepared.machine.environmentId, projectId: value.projectId });
        rememberProject(project.cwd);
        return value.session.id;
      },
      syncAll: async () => {
        await remoteRequest(prepared.machine.id, "nativeSources.syncAll");
      },
      access: (id) =>
        remoteRequest<NativeSessionAccess | null>(prepared.machine.id, "sessions.nativeAccess", { sessionId: hostId(id) }),
    },
    cancelSearch: (owner) => {
      searches.set(owner, (searches.get(owner) ?? 0) + 1);
    },
    search: async (query, cwd, includeArchived, owner = "desktop") => {
      const version = (searches.get(owner) ?? 0) + 1;
      searches.set(owner, version);
      const hits: SessionSearchHit[] = [];
      const needle = query.toLocaleLowerCase();
      for (const row of await list(cwd)) {
        if (searches.get(owner) !== version) return [];
        if (!includeArchived && row.archived) continue;
        const common = {
          sessionId: row.id,
          cwd: row.cwd,
          harness: row.harness,
          title: row.title,
          updatedAt: row.updatedAt,
        };
        if (row.title.toLocaleLowerCase().includes(needle))
          hits.push({ kind: "conversation", preview: row.title, ...common });
        const session = await localSession(row.id);
        for (const block of session?.blocks ?? []) {
          const at = block.text.toLocaleLowerCase().indexOf(needle);
          if (at >= 0)
            hits.push({
              kind: "message",
              ...common,
              blockId: block.id,
              role: block.role,
              preview: block.text.slice(
                Math.max(0, at - 80),
                at + needle.length + 160,
              ),
            });
          if (hits.length >= 201) return hits;
        }
      }
      return hits;
    },
  });
  refreshRemoteMachines();
}
