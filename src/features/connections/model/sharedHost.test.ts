// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { initializeSharedHost } from "./sharedHost";
import {
  remoteProjectFor,
  ensureSharedProject,
  configureSharedHost,
} from "./remoteProjects";
import {
  getSession,
  listSessionsByProject,
  setSessionArchived,
  shouldPersistSession,
  searchSessions,
  deleteSession,
  upsertSession,
} from "../../sessions/data/sessionStore";
import { setSharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import type { HostSession } from "./protocol";
import { remoteSessionFor } from "./connections";
import { sessionUsesHost } from "./remoteProjects";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const machine = {
  id: "computer",
  environmentId: "local",
  name: "This computer",
  endpoint: "http://127.0.0.1:3774",
};
const project = { id: "project", cwd: "/home/me/repo", name: "repo" };
let value: HostSession;
beforeEach(() => {
  localStorage.clear();
  value = {
    projectId: project.id,
    revision: 1,
    status: "idle",
    createdAt: 10,
    updatedAt: 20,
    session: {
      id: "history",
      cwd: project.cwd,
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      title: "Shared chat",
      blocks: [{ id: "user", role: "user", text: "Phone message" }],
    },
  };
  vi.mocked(invoke).mockImplementation(async (command, args: any) => {
    if (command === "shared_host_prepare")
      return {
        machine,
        projects: [project],
        sessions: [{ id: "history", cwd: project.cwd }],
      };
    if (command === "remote_machines") return [machine];
    if (command === "session_delete") return;
    if (command === "session_upsert")
      return {
        id: args.session.id,
        cwd: args.session.cwd,
        title: args.session.title,
        harness: args.session.harness,
        createdAt: 1,
        updatedAt: 2,
      };
    if (command === "remote_request") {
      if (args.method === "sessions.delete") return { deleted: true };
      if (args.method === "sessions.refreshDesktopNative") return {};
      if (args.method === "projects.list") return [project];
      if (args.method === "sessions.sync") return { kind: "snapshot", value };
      if (args.method === "sessions.list")
        return [
          {
            id: "history",
            title: value.session.title,
            harness: "codex",
            model: "codex:test",
            runtimeMode: "supervised",
            updatedAt: 20,
          },
        ];
      if (args.method === "projects.open")
        return { ...project, id: "new-project", cwd: args.params.cwd };
      if (args.method === "sessions.update") {
        value.archived = args.params.archived;
        return {};
      }
    }
    throw new Error(`Unexpected local operation: ${command}`);
  });
});
afterEach(() => {
  setSharedSessionBackend();
  configureSharedHost(undefined, []);
});
it("routes desktop history, changes and search to the Host while retaining native paths", async () => {
  await initializeSharedHost();
  expect(remoteProjectFor(project.cwd)).toMatchObject({
    local: true,
    projectId: project.id,
    cwd: project.cwd,
  });
  expect((await listSessionsByProject(project.cwd))[0].id).toBe("history");
  const session = (await getSession("history"))!;
  expect(session.cwd).toBe(project.cwd);
  expect(session.blocks[0].text).toBe("Phone message");
  expect(shouldPersistSession(session)).toBe(false);
  await setSessionArchived("history", true);
  expect(value.archived).toBe(true);
  value.archived = false;
  expect(
    (await searchSessions({ query: "Phone", searchOwner: "desktop" })).hits[0]
      .blockId,
  ).toBe("user");
  expect(
    (await searchSessions({ query: "Phone", cwd: "~", searchOwner: "home" }))
      .hits[0].blockId,
  ).toBe("user");
});
it("registers a newly opened local folder on the same Host once", async () => {
  await initializeSharedHost();
  const [a, b] = await Promise.all([
    ensureSharedProject("/home/me/new"),
    ensureSharedProject("/home/me/new"),
  ]);
  expect(a).toEqual(b);
  expect(a).toMatchObject({
    local: true,
    cwd: "/home/me/new",
    environmentId: "local",
  });
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(
        ([cmd, args]: any) =>
          cmd === "remote_request" && args.method === "projects.open",
      ),
  ).toHaveLength(1);
});
it("deletes canonical history and clears legacy native references without removing recovery images", async () => {
  await initializeSharedHost();
  await deleteSession("history");
  expect(invoke).toHaveBeenCalledWith("remote_request", {
    machineId: machine.id,
    method: "sessions.delete",
    params: { projectId: project.id, sessionId: "history" },
  });
  expect(invoke).toHaveBeenCalledWith("session_delete", {
    sessionId: "history",
    imagePaths: [],
  });
});
it("rejects bootstrap failure instead of silently selecting a local runtime", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error("Host unavailable"));
  await expect(initializeSharedHost()).rejects.toThrow("Host unavailable");
});
it("shares native import history while retaining the desktop's protected native runtime", async () => {
  await initializeSharedHost();
  const session = {
    ...value.session,
    nativeSession: {
      provider: "codex" as const,
      providerSessionId: "native",
      path: "/native/history.jsonl",
      revision: "1:1",
      blockIds: ["user"],
      createdAt: 1,
      updatedAt: 2,
    },
    providerSessionId: "native",
  };
  expect(shouldPersistSession(session)).toBe(true);
  expect(sessionUsesHost(session)).toBe(false);
  expect(await upsertSession(session)).not.toBeNull();
  expect(invoke).toHaveBeenCalledWith("remote_request", {
    machineId: machine.id,
    method: "sessions.refreshDesktopNative",
    params: { sessionId: session.id, busy: false },
  });
});
it("removes deleted Host bindings before restoring a desktop workspace", async () => {
  localStorage.setItem(
    "monocode.remote-tabs.v2",
    JSON.stringify({ shell: "history" }),
  );
  vi.mocked(invoke).mockResolvedValueOnce({
    machine,
    projects: [project],
    sessions: [{ id: "history", cwd: project.cwd, deleted: true }],
  });
  await initializeSharedHost();
  expect(remoteSessionFor("shell")).toBeUndefined();
  expect(remoteSessionFor("history")).toBeUndefined();
  vi.mocked(invoke).mockRejectedValue(
    new Error("Session not found on this machine"),
  );
  expect(await getSession("history")).toBeNull();
});
