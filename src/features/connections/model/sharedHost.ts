import { invoke } from "@tauri-apps/api/core";
import type {
  HostProject,
  HostSessionSummary,
  RemoteMachine,
} from "./protocol";
import {
  loadRemoteSession,
  remoteRequest,
  rememberRemoteSession,
  remoteSessionFor,
  refreshRemoteMachines,
  forgetDeletedRemoteBindings,
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
import { setSharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import type {
  SessionSummary,
  SessionSearchHit,
} from "../../sessions/data/sessionStore";

type PreparedHost = {
  machine: RemoteMachine;
  projects: HostProject[];
  sessions: { id: string; cwd: string; deleted?: boolean }[];
};

/** Awaited before workspace restore: there is no fallback to a second runtime. */
export async function initializeSharedHost(): Promise<void> {
  const prepared = await invoke<PreparedHost>("shared_host_prepare");
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
  forgetDeletedRemoteBindings(
    prepared.sessions.filter((row) => row.deleted).map((row) => row.id),
  );
  for (const row of prepared.sessions) {
    if (!row.deleted && !remoteSessionFor(row.id))
      rememberRemoteSession(row.id, row.id);
  }
  const hostId = (id: string) => remoteSessionFor(id) ?? id;
  const localSession = async (id: string) => {
    try {
      const snapshot = await loadRemoteSession(prepared.machine.id, hostId(id));
      const project = sharedProjects().find(
        (row) => row.projectId === snapshot.projectId,
      );
      if (!project) return null;
      paths.set(snapshot.session.id, project.cwd);
      paths.set(id, project.cwd);
      if (!remoteSessionFor(id)) rememberRemoteSession(id, snapshot.session.id);
      return {
        ...snapshot.session,
        busy: snapshot.session.nativeSession ? false : snapshot.session.busy,
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
    ownsSession: (id) => paths.has(id) || paths.has(hostId(id)),
    rememberSession: (id, cwd) => {
      paths.set(id, normalizeProjectPath(cwd));
    },
    mirrorNative: async (session) => {
      await remoteRequest(
        prepared.machine.id,
        "sessions.refreshDesktopNative",
        {
          sessionId: session.id,
          busy: !!session.busy,
        },
      );
      paths.set(session.id, session.cwd);
      if (!remoteSessionFor(session.id))
        rememberRemoteSession(session.id, session.id);
      configureSharedHost(
        prepared.machine.environmentId,
        await remoteRequest<HostProject[]>(
          prepared.machine.id,
          "projects.list",
        ),
        prepared.machine.id,
      );
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
