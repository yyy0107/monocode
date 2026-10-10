import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AddressInfo } from "node:net";
import { request } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { HostEngine } from "./engine";
import { HostStore } from "./store";
import { createHostServer } from "./server";
import { HostChildBackend } from "./child-backend";
import { configureChildBackend } from "../src/integrations/harness/core/child";
import type { SendTurnInput } from "../src/integrations/harness/core/types";
import type { RemoteProvider } from "../src/features/connections/model/protocol";
import { withCheckoutRemoval } from "./checkout-guards";
import { importDesktopSessions } from "./desktop-import";

const modelProbe = vi.hoisted(() => vi.fn());
const piModelProbe = vi.hoisted(() => vi.fn());
vi.mock("../src/integrations/harness/providers/codex/codexCatalog", () => ({
  discoverCodexModels: modelProbe,
}));
vi.mock("../src/integrations/harness/providers/pi/piCatalog", () => ({
  discoverPiModels: piModelProbe,
  discoverOmpModels: vi.fn(),
}));
// Catalog tests point the host at a stand-in provider CLI.
const binaries: Partial<Record<RemoteProvider, string>> = {};
configureChildBackend(new HostChildBackend(binaries));

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllEnvs();
});

async function setup(providers: RemoteProvider[] = ["codex"], discoverProviders?: () => Promise<RemoteProvider[]>) {
  const directory = mkdtempSync(join(tmpdir(), "monocode-server-test-"));
  const store = new HostStore(join(directory, "host.db"));
  let turn: SendTurnInput | undefined;
  let finish = () => {};
  const send = vi.fn((input: SendTurnInput) => {
    turn = input;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const engine = new HostEngine(store, {
    codex: {
      send,
      stop: async () => finish(),
      cancel: async () => finish(),
      bind: () => {},
      approve: () => {},
      answer: () => {},
    },
  });
  // Follow production's canonicalization, including Windows 8.3 paths such
  // as RUNNER~1 in the CI runner's temporary directory.
  const project = await engine.openProject(directory);
  const server = createHostServer(engine, providers, undefined, discoverProviders);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (error) {
    store.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/rpc`;
  const first = store.issueDevice("Laptop");
  const second = store.issueDevice("Other computer");
  const call = async (
    method: string,
    params: unknown = {},
    token = first.token,
    overrides: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body: JSON.stringify({
        version: 1,
        environmentId: store.environmentId,
        method,
        params,
        ...overrides,
      }),
    });
    return {
      status: response.status,
      value: (await response.json()) as { result?: any; error?: string },
    };
  };
  cleanups.push(async () => {
    await engine.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    url,
    directory,
    engine,
    store,
    project,
    call,
    first,
    second,
    send,
    turn: () => turn!,
    finish: () => finish(),
  };
}

it("shares Host client state across devices and rejects a revoked client's writes and asset reads", async () => {
  const s = await setup();
  expect((await s.call("environment.describe")).value.result.capabilities).toContain("clientState.v1");
  const patch = { operationId: "preferences-rpc-1", changes: { "monocode.colorScheme": "light" } };
  const saved = await s.call("preferences.patch", patch);
  expect(saved.status).toBe(200);
  expect((await s.call("preferences.read", {}, s.second.token)).value.result).toEqual(saved.value.result);
  expect((await s.call("preferences.read", { revision: saved.value.result.revision })).value.result).toBeNull();
  expect((await s.call("preferences.patch", patch)).value.result).toEqual(saved.value.result);
  expect((await s.call("connections.patch", { operationId: "unsafe-connection", changes: { server: { id: "server", name: "Host", kind: "http", token: "secret" } } })).status).toBe(400);
  s.store.revokeToken(s.second.token);
  expect((await s.call("preferences.patch", { operationId: "revoked", changes: {} }, s.second.token)).status).toBe(401);
  expect((await s.call("workspaces.read", { kind: "desktop" }, s.second.token)).status).toBe(401);
  expect((await s.call("preferences.assets.read", {}, s.second.token)).status).toBe(401);
  expect((await s.call("preferences.read", {}, s.first.token, { environmentId: "different-host" })).status).toBe(400);
});

it("restricts Host account management to admin devices while sharing safe account metadata", async () => {
  const s = await setup();
  const request = { operationId: "add-account", provider: "codex", accountId: "work", label: "Work" };
  for (const method of ["save", "remove", "setDefault", "importCodex", "loginStart", "loginStatus"]) {
    expect((await s.call(`providerAccounts.${method}`, request, s.second.token)).value.error).toContain("Only this computer's desktop");
  }
  s.store.markAdminDevice(s.first.id);
  const saved = await s.call("providerAccounts.save", request);
  expect(saved.status).toBe(200);
  expect(saved.value.result.accounts.codex).toContainEqual(expect.objectContaining({ id: "work", label: "Work" }));
  expect((await s.call("providerAccounts.read", {}, s.second.token)).value.result).toEqual(saved.value.result);
  expect(JSON.stringify(saved.value.result)).not.toContain(s.directory);
  s.store.revokeToken(s.second.token);
  expect((await s.call("providerAccounts.read", {}, s.second.token)).status).toBe(401);
});

it("advertises notes RPC and shares CRUD and image access only with authenticated devices", async () => {
  const s = await setup();
  expect((await s.call("environment.describe")).value.result.capabilities).toContain("notes.v1");
  expect((await s.call("notes.list", {}, "bad-token")).status).toBe(401);
  expect((await s.call("notes.upsert", { note: { id: "n1", title: "Plan", body: "Text", tags: ["#Ideas"] } })).value.result.tags).toEqual(["ideas"]);
  expect((await s.call("notes.get", { id: "n1" })).value.result.title).toBe("Plan");
  expect((await s.call("notes.list", {}, s.second.token)).value.result).toHaveLength(1);
  const image = (await s.call("notes.saveImage", { noteId: "n1", name: "flow.png", data: "YQ==" })).value.result;
  expect((await s.call("notes.image", { asset: image.markdownPath })).value.result).toEqual({ mime: "image/png", data: "YQ==" });
  expect((await s.call("notes.image", { asset: "/note-assets/n1/../secret.png" })).status).toBe(400);
  expect((await s.call("notes.delete", { id: "n1" })).status).toBe(200);
  expect((await s.call("notes.get", { id: "n1" })).value.result).toBeNull();
  expect((await s.call("notes.image", { asset: image.markdownPath })).status).toBe(400);
  s.store.revokeToken(s.second.token);
  expect((await s.call("notes.list", {}, s.second.token)).status).toBe(401);
});

it("configures the title API through authenticated RPC without exposing credentials", async () => {
  const s = await setup();
  const saved = await s.call("titleModel.save", {
    enabled: true, endpoint: "https://example.com/v1/chat/completions", model: "test-model", apiKey: "private-test-key",
  });
  expect(saved.status).toBe(200);
  expect(saved.value.result).toMatchObject({ enabled: true, hasApiKey: true });
  expect(JSON.stringify(saved.value)).not.toContain("private-test-key");
  expect((await s.call("titleModel.status")).value.result).toEqual(saved.value.result);
  const generate = vi.spyOn(s.engine.titleModel, "generate").mockResolvedValue({ title: "API title", workItem: null });
  expect((await s.call("titleModel.generate", { message: "Name this" })).value.result.title).toBe("API title");
  expect(generate).toHaveBeenCalledWith("Name this");
  const generateBranch = vi.spyOn(s.engine.titleModel, "generateBranch").mockResolvedValue("fix-login");
  expect((await s.call("titleModel.generateBranch", { message: "修复登录" })).value.result).toBe("fix-login");
  expect(generateBranch).toHaveBeenCalledWith("修复登录");
  expect((await s.call("titleModel.test")).value.result.title).toBe("API title");
  expect((await s.call("titleModel.generate", { message: 42 })).value.error).toContain("Invalid title message");
  expect(s.send).not.toHaveBeenCalled();
  expect((await s.call("titleModel.status", {}, "bad-token")).status).toBe(401);
});

it("names both the branch and worktree directory before creation through RPC", async () => {
  const s = await setup();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: s.project.cwd });
  git("init", "-q");
  git("checkout", "-q", "-b", "main");
  writeFileSync(join(s.project.cwd, "file.txt"), "initial\n");
  git("add", "file.txt");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "initial");
  cleanups.push(async () => rmSync(join(s.project.cwd, "..", `${s.project.name}-worktrees`), { recursive: true, force: true }));
  vi.spyOn(s.engine.titleModel, "generateBranch").mockResolvedValue("fix-login");
  const nameParams = { projectId: s.project.id, harness: "codex", message: "修复登录" };
  const named = await s.call("git.worktreeName", nameParams);
  expect(named.value.result).toBe("mc/fix-login");
  const generated = await s.call("git.worktreeCreate", {
    projectId: s.project.id, branch: named.value.result, base: "main", existing: false,
  });
  expect(generated.value.result).toMatchObject({
    branch: "mc/fix-login", path: expect.stringMatching(/[/\\]wt-mc-fix-login$/),
    log: expect.arrayContaining(["Preparing worktree (new branch 'mc/fix-login')"]),
  });
  expect((await s.call("git.worktreeName", nameParams)).value.result).toBe("mc/fix-login-2");
  expect((await s.call("git.worktreeName", { ...nameParams, message: 42 })).status).toBe(400);
  expect((await s.call("git.worktreeName", { ...nameParams, harness: "unknown" })).status).toBe(400);
  const created = await s.call("commands.dispatch", {
    type: "create", commandId: "named-worktree-session", projectId: s.project.id,
    worktreeCwd: generated.value.result.path, harness: "codex", model: "codex:test", runtimeMode: "supervised",
  });
  expect(s.store.session(created.value.result.sessionId)).toMatchObject({
    session: { branch: "mc/fix-login", worktreeCwd: generated.value.result.path },
  });
  expect(s.store.session(created.value.result.sessionId).autoWorktreeBranch).toBeUndefined();
  expect(s.send).not.toHaveBeenCalled();
});

describe("remote host API", () => {
  it("initializes a Host-owned catalog for mobile list readers before any management call", async () => {
    const s = await setup();
    vi.stubEnv("CODEX_HOME", s.directory);
    vi.stubEnv("CLAUDE_CONFIG_DIR", s.directory);
    const listed = await s.call("providerAccounts.list", {}, s.second.token);
    expect(listed.status).toBe(200);
    expect(listed.value.result).toMatchObject({
      codex: [{ id: "default", label: "Default account" }],
      claude: [{ id: "default", label: "Default account" }],
    });
    const read = await s.call("providerAccounts.read", {}, s.second.token);
    expect(read.value.result.accounts).toEqual(listed.value.result);
    expect(read.value.result.revision).toBe(1);
  });

  it("queries account usage through authenticated RPC and rejects unknown accounts", async () => {
    const s = await setup();
    writeFileSync(join(s.directory, "desktop-owner.json"), JSON.stringify({ desktopDirectory: s.directory }));
    mkdirSync(join(s.directory, "provider-accounts"));
    writeFileSync(join(s.directory, "provider-accounts", "accounts.json"), JSON.stringify({
      codex: [{ id: "work", label: "Work", dataHome: join(s.directory, "missing-profile") }],
    }));
    expect((await s.call("environment.describe")).value.result.capabilities).toContain("providerAccounts.usage.v1");
    expect((await s.call("providerAccounts.usage", { provider: "codex", accountId: "work" }, "wrong-token")).status).toBe(401);
    const result = await s.call("providerAccounts.usage", { provider: "codex", accountId: "work" });
    expect(result.status).toBe(200);
    expect(result.value.result).toMatchObject({ provider: "codex", status: "unavailable", session: null });
    expect(JSON.stringify(result.value)).not.toContain(s.directory);
    expect((await s.call("providerAccounts.usage", { provider: "codex", accountId: "removed" })).status).toBe(400);
    expect((await s.call("providerAccounts.usage", { provider: "pi", accountId: "default" })).status).toBe(400);
  });

  it("authenticates IM management and never returns a configured bot secret", async () => {
    const s = await setup();
    await s.engine.workflows.ready;
    expect((await s.call("im.get", {}, "invalid-token")).status).toBe(401);
    const described = await s.call("environment.describe");
    expect(described.value.result.capabilities).toContain("im.feishu.v1");
    const configured = await s.call("im.configure", {
      appId: "cli_1234567890abcdef", appSecret: "private-test-secret", ownerOpenId: "ou_owner", language: "zh-CN",
    });
    expect(configured.status).toBe(200);
    expect(configured.value.result.config).toMatchObject({ enabled: false, secretConfigured: true, ownerOpenId: "ou_owner" });
    expect(JSON.stringify(configured.value)).not.toContain("private-test-secret");
    expect(JSON.stringify((await s.call("im.get")).value)).not.toContain("private-test-secret");
    expect((await s.call("im.configure", { appId: "cli_1234567890abcdef", ownerOpenId: "ou_owner", source: "im" })).status).toBe(400);
    expect((await s.call("im.get", {}, s.first.token, { environmentId: "other-host" })).status).toBe(400);
    s.store.revokeToken(s.second.token);
    expect((await s.call("im.control", { action: "disable" }, s.second.token)).status).toBe(401);
  });

  it("imports account metadata when listing, passes the selection to turns and rejects removed Host accounts", async () => {
    const s = await setup();
    await s.engine.ready;
    writeFileSync(join(s.directory, "desktop-owner.json"), JSON.stringify({ desktopDirectory: s.directory }));
    mkdirSync(join(s.directory, "provider-accounts"));
    vi.stubEnv("CODEX_HOME", s.directory);
    vi.stubEnv("CLAUDE_CONFIG_DIR", s.directory);
    const accountsFile = join(s.directory, "provider-accounts", "accounts.json");
    writeFileSync(accountsFile, JSON.stringify({ codex: [{ id: "work", label: "Work account" }], claude: [{ id: "personal", label: "Personal account" }] }));
    expect((await s.call("providerAccounts.list")).value.result).toMatchObject({
      codex: [{ id: "default", label: "Default account" }, { id: "work", label: "Work account" }],
      claude: [{ id: "default", label: "Default account" }, { id: "personal", label: "Personal account" }],
    });
    const command = { type: "create", commandId: "account-create", projectId: s.project.id,
      harness: "codex", model: "codex:test", modelSettings: { reasoningEffort: "high" },
      runtimeMode: "supervised", providerAccountId: "work" };
    const created = await s.call("commands.dispatch", command);
    expect(created.status).toBe(200);
    const id = created.value.result.sessionId;
    expect(s.store.session(id).session.providerAccountId).toBe("work");
    await s.call("commands.dispatch", { type: "send", commandId: "account-send", sessionId: id, text: "Use this account" });
    await vi.waitFor(() => expect(s.send).toHaveBeenCalledOnce());
    expect(s.turn()).toMatchObject({ providerAccountId: "work", modelSettings: { reasoningEffort: "high" } });
    s.finish();
    writeFileSync(accountsFile, "{}");
    expect((await s.call("providerAccounts.list")).value.result.codex.some((account: { id: string }) => account.id === "work")).toBe(true);
    s.store.markAdminDevice(s.first.id);
    expect((await s.call("providerAccounts.remove", { operationId: "remove-work", provider: "codex", accountId: "work" })).status).toBe(200);
    const removed = await s.call("commands.dispatch", { ...command, commandId: "removed-account-create" });
    expect(removed.status).toBe(400);
    expect(removed.value.error).toBe("This provider account is no longer available");
  });
  it("switches a started conversation's account in place, carrying its native thread", async () => {
    const s = await setup();
    await s.engine.ready;
    writeFileSync(join(s.directory, "desktop-owner.json"), JSON.stringify({ desktopDirectory: s.directory }));
    mkdirSync(join(s.directory, "provider-accounts"));
    writeFileSync(join(s.directory, "provider-accounts", "accounts.json"),
      JSON.stringify({ codex: [{ id: "work", label: "Work account" }] }));
    const defaultHome = join(s.directory, "default-codex");
    vi.stubEnv("HOME", s.directory);
    vi.stubEnv("CODEX_HOME", defaultHome);
    const threadId = "01a0bc2f-8817-7f30-ad5b-33b949fd0fe9";
    const rollout = join("sessions", "2026", "10", "09", `rollout-2026-10-09T01-02-03-${threadId}.jsonl`);
    mkdirSync(dirname(join(defaultHome, rollout)), { recursive: true });
    writeFileSync(join(defaultHome, rollout),
      `${JSON.stringify({ type: "session_meta", payload: { id: threadId, cwd: s.directory } })}\n`);
    const started = (providerSessionId: string, commandId: string) => {
      const id = s.engine.command({ type: "create", commandId, projectId: s.project.id,
        harness: "codex", model: "codex:test", runtimeMode: "supervised" }).sessionId;
      const value = s.store.session(id);
      s.store.save({ ...value, revision: value.revision + 1, session: { ...value.session, providerSessionId,
        blocks: [{ id: `${commandId}-user`, role: "user", text: "Fix the build" }] } }, { type: "test" });
      return id;
    };

    const id = started(threadId, "account-switch");
    const switched = await s.call("sessions.switchAccount", { projectId: s.project.id, sessionId: id, providerAccountId: "work" });
    expect(switched.value.result).toMatchObject({ providerAccountId: "work" });
    expect(existsSync(join(s.directory, "provider-accounts", "codex", "work", rollout))).toBe(true);
    expect(s.store.session(id).session).toMatchObject({ providerAccountId: "work", providerSessionId: threadId });
    await s.call("commands.dispatch", { type: "send", commandId: "account-switch-send", sessionId: id, text: "Continue" });
    await vi.waitFor(() => expect(s.send).toHaveBeenCalledOnce());
    expect(s.turn()).toMatchObject({ providerAccountId: "work" });
    s.finish();
    await vi.waitFor(() => expect(s.store.session(id).status).not.toBe("running"));
    const back = await s.call("sessions.switchAccount", { projectId: s.project.id, sessionId: id, providerAccountId: "default" });
    expect(back.value.result).toMatchObject({ providerAccountId: "default" });
    expect(s.store.session(id).session.providerAccountId).toBeUndefined();

    // Without native records the next turn starts a new thread from a recap.
    const missing = started("01a0bc2f-0000-7000-8000-000000000000", "account-recap");
    await s.call("sessions.switchAccount", { projectId: s.project.id, sessionId: missing, providerAccountId: "work" });
    const recapped = s.store.session(missing).session;
    expect(recapped.providerSessionId).toBeUndefined();
    expect(recapped.providerAccountId).toBe("work");
    expect(recapped.blocks.at(-1)).toMatchObject({ role: "handoff" });
  });
  it("serves unchanged session polling from the cache without reparsing snapshots or enumerating history", async () => {
    const s = await setup();
    await s.engine.ready;
    const created = s.engine.command({ type: "create", commandId: "cached-poll", projectId: s.project.id,
      harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const current = s.store.session(created.sessionId);
    const prepare = vi.spyOn(s.store.db, "prepare");
    const sessions = vi.spyOn(s.store, "sessions");
    try {
      for (let index = 0; index < 3; index++) {
        expect((await s.call("sessions.sync", { sessionId: created.sessionId, revision: current.revision })).value.result).toMatchObject({ kind: "unchanged", serverTime: expect.any(Number) });
        expect((await s.call("sessions.get", { sessionId: created.sessionId, revision: current.revision })).value.result).toBeNull();
      }
      expect(prepare.mock.calls.filter(([sql]) => sql === "SELECT snapshot FROM sessions WHERE id=?")).toHaveLength(0);
      expect(sessions).not.toHaveBeenCalled();
    } finally {
      prepare.mockRestore();
      sessions.mockRestore();
    }
  });

  it("preserves missing and retired session handling in the assistant privacy guard", async () => {
    const s = await setup();
    const created = s.engine.command({ type: "create", commandId: "privacy-retired", projectId: s.project.id,
      harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    s.store.db.prepare("INSERT INTO retired_sessions VALUES (?)").run(created.sessionId);
    for (const sessionId of ["missing", created.sessionId]) {
      expect((await s.call("environment.describe", { sessionId })).status).toBe(200);
      expect((await s.call("sessions.get", { sessionId })).value.error).toContain("Session not found");
    }
    const value = s.store.db.prepare("SELECT snapshot FROM sessions WHERE id=?").get(created.sessionId)!;
    const retired = JSON.parse(String(value.snapshot));
    retired.session.assistantOwnerId = "private-assistant";
    s.store.db.prepare("UPDATE sessions SET snapshot=? WHERE id=?").run(JSON.stringify(retired), created.sessionId);
    s.store.invalidateSession(created.sessionId);
    expect((await s.call("sessions.get", { sessionId: created.sessionId })).value.error).toContain("Assistant brain is private");
  });

  it("advertises native continuation and imports desktop native links as Host-managed", async () => {
    const s = await setup();
    const capabilities = (await s.call("environment.describe")).value.result.capabilities;
    expect(capabilities).toEqual(expect.arrayContaining([
      "sessions.nativeAccess", "sessions.refreshNative", "sessions.handoff", "nativeSources.list", "nativeSources.import", "nativeSources.syncAll",
    ]));
    expect((await s.call("nativeSources.syncAll")).value.result).toEqual({ synced: 0 });
    expect(capabilities).not.toContain("sessions.refreshDesktopNative");
    const path = join(s.directory, "monocode.db");
    const source = new DatabaseSync(path);
    source.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, cwd TEXT, harness TEXT, model TEXT,
      runtime_mode TEXT, title TEXT, blocks_json TEXT, created_at INTEGER, updated_at INTEGER,
      native_session_json TEXT, provider_session_id TEXT)`);
    const nativeSession = {
      provider: "codex", providerSessionId: "native-provider", path: join(s.directory, "native.jsonl"),
      revision: "first", blockIds: ["native-codex-0"], createdAt: 1, updatedAt: 1,
    };
    source.prepare("INSERT INTO sessions VALUES (?, ?, 'codex', 'codex:test', 'supervised', 'Native history', '[]', 1, 1, ?, ?)")
      .run("native-mirror", s.directory, JSON.stringify(nativeSession), nativeSession.providerSessionId);
    try {
      importDesktopSessions(s.store, path);
      expect((await s.call("sessions.nativeAccess", { sessionId: "native-mirror" })).value.result.path).toBe(nativeSession.path);
      expect(s.store.session("native-mirror").session.nativeSession).toMatchObject({
        mode: "managed", storage: "jsonl", nativeIds: ["native-codex-0"],
      });
      expect(s.store.session("native-mirror").nativeStatus).toMatchObject({ state: "syncing", pendingChange: true });
      expect((await s.call("sessions.refreshDesktopNative", { sessionId: "native-mirror", busy: false })).status).toBe(400);
    } finally {
      source.close();
    }
  });

  it("advertises Host orchestration and scopes persistent editor resources to the authenticated device", async () => {
    const s = await setup();
    const described = (await s.call("environment.describe")).value.result;
    expect(described.capabilities).toEqual(expect.arrayContaining(["sessions.orchestration", "resources"]));
    const path = join(s.directory, "missing-file.txt");
    expect((await s.call("resources.claim", { resourceId: "file-editor", path })).status).toBe(200);
    expect((await s.call("resources.claim", { resourceId: "file-editor", path }, s.second.token)).status).toBe(200);
    expect(s.store.db.prepare("SELECT * FROM checkout_resources").all()).toHaveLength(2);
    await s.call("resources.release", { resourceId: "file-editor" }, s.second.token);
    await expect(withCheckoutRemoval(s.store, s.directory, async () => true)).rejects.toThrow("Close files and terminals");
    await s.call("resources.release", { resourceId: "file-editor" });
    await withCheckoutRemoval(s.store, s.directory, async () => {
      expect((await s.call("resources.claim", { resourceId: "race", path })).value.error).toContain("being removed");
    });
    expect((await s.call("resources.claim", { resourceId: "bad", path: join(s.directory, "../outside.txt") })).value.error).toContain("outside");
    expect((await s.call("resources.claim", { resourceId: "bad/identity", path })).status).toBe(400);
  });

  it("keeps worker history readable while excluding it from lists and rejecting independent session actions", async () => {
    const s = await setup();
    const lead = s.engine.command({ type: "create", commandId: "lead", projectId: s.project.id, harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const worker = s.engine.command({ type: "create", commandId: "worker", projectId: s.project.id, harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const value = s.store.session(worker.sessionId);
    s.store.save({ ...value, revision: value.revision + 1, session: { ...value.session, orchestrationLeadId: lead.sessionId } }, {});
    expect((await s.call("sessions.list", { projectId: s.project.id })).value.result.map((value: { id: string }) => value.id)).toEqual([lead.sessionId]);
    expect((await s.call("sessions.activity")).value.result.sessions.map((value: { id: string }) => value.id)).toEqual([lead.sessionId]);
    expect((await s.call("sessions.get", { sessionId: worker.sessionId })).value.result.session.id).toBe(worker.sessionId);
    expect((await s.call("sessions.delete", { sessionId: worker.sessionId, projectId: s.project.id })).value.error).toContain("managed by its lead");
    expect((await s.call("commands.dispatch", { type: "send", commandId: "bypass-send", sessionId: worker.sessionId, text: "Work independently" })).value.error).toContain("managed by its lead");
    expect(s.send).not.toHaveBeenCalled();
  });

  it("guards both public workspace APIs against mutations of a managed worker checkout", async () => {
    const s = await setup(); writeFileSync(join(s.directory, "file.txt"), "worker file\n");
    const worker = s.engine.command({ type: "create", commandId: "worker-guard", projectId: s.project.id, harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const value = s.store.session(worker.sessionId);
    s.store.save({ ...value, revision: value.revision + 1, session: { ...value.session, orchestrationLeadId: "owning-lead" } }, {});
    const projectId = s.project.id;
    for (const [method, params] of [
      ["files.write", { projectId, path: "file.txt", expected: "worker file\n", content: "bypass\n" }],
      ["files.create", { projectId, parent: "", name: "new.txt", isDir: false }],
      ["git.action", { projectId, action: "stage", path: "file.txt" }],
      ["git.switch", { projectId, branch: "other" }],
      ["git.createBranch", { projectId, branch: "other" }],
      ["git.worktreeCreate", { projectId, branch: "other", base: "HEAD", existing: false }],
    ] as const) expect((await s.call(method, params)).value.error).toContain("managed by its lead");
    for (const [command, args] of [
      ["write_text_file", { path: join(s.directory, "file.txt"), content: "bypass" }],
      ["create_path", { parent: s.directory, name: "new.txt", isDir: false }],
      ["rename_path", { path: join(s.directory, "file.txt"), name: "renamed.txt" }],
      ["delete_path", { path: join(s.directory, "file.txt") }],
      ["copy_path", { from: join(s.directory, "file.txt"), destParent: s.directory }],
      ["move_path", { from: join(s.directory, "file.txt"), destParent: s.directory }],
      ["git_stage_file", { cwd: s.directory, relative: "file.txt" }],
      ["git_checkout", { cwd: s.directory, name: "other" }],
      ["git_stash", { cwd: s.directory }],
    ] as const) expect((await s.call("workspace.run", { command, args })).value.error).toContain("managed by its lead");
    expect((await s.call("files.read", { projectId, path: "file.txt" })).value.result).toBe("worker file\n");
  });

  it("returns lightweight reply activity across projects, with credential and Host identity checks", async () => {
    const s = await setup();
    const other = s.store.addProject("/activity-other-project", "Other");
    for (const project of [s.project, other])
      s.engine.command({ type: "create", commandId: `activity:${project.id}`, projectId: project.id,
        harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const listed = await s.call("sessions.activity");
    expect(listed.status).toBe(200);
    expect(listed.value.result.environmentId).toBe(s.store.environmentId);
    expect(listed.value.result.assistant).toBeNull();
    s.engine.assistant.store.initialize({ harness: "codex", model: "codex:test" });
    s.engine.assistant.store.message({ id: "assistant-reply", kind: "assistant", text: "Your reminder is ready." });
    expect((await s.call("sessions.activity")).value.result.assistant.latest).toMatchObject({
      id: "assistant-reply", kind: "reply", text: "Your reminder is ready.",
    });
    expect(new Set(listed.value.result.sessions.map((row: { projectId: string }) => row.projectId)))
      .toEqual(new Set([s.project.id, other.id]));
    for (const row of listed.value.result.sessions) {
      expect(row).toMatchObject({ lastReplyRevision: null, lastCompletedRunId: null, pendingInputKey: null });
      expect(row).not.toHaveProperty("session");
      expect(row).not.toHaveProperty("blocks");
    }
    expect((await s.call("sessions.activity", {}, s.first.token, { environmentId: "other-host" })).status).toBe(400);
    expect((await s.call("sessions.activity", {}, s.first.token, { version: 0 })).status).toBe(400);
    s.store.revokeDevice(s.first.id);
    expect((await s.call("sessions.activity")).status).toBe(401);
  });

  it("accepts a registered short token and rejects it after revocation", async () => {
    const s = await setup();
    expect((await s.call("environment.describe", {}, "123")).status).toBe(401);
    const phone = s.store.issueDevice("Phone", "123");
    expect((await s.call("environment.describe", {}, phone.token)).status).toBe(200);
    s.store.revokeDevice(phone.id);
    expect((await s.call("environment.describe", {}, phone.token)).status).toBe(401);
  });

  it("rejects a credential revoked while its request body is arriving", async () => {
    const s = await setup();
    const authenticated = vi.spyOn(s.store, "authenticated");
    const body = JSON.stringify({ version: 1, environmentId: s.store.environmentId,
      method: "commands.dispatch", params: { type: "create", commandId: "revoked-create",
        projectId: s.project.id, harness: "codex", model: "codex:test", runtimeMode: "supervised" } });
    let req: ReturnType<typeof request>;
    const response = new Promise<number | undefined>((resolve, reject) => {
      req = request(s.url, { method: "POST", headers: {
        Authorization: `Bearer ${s.first.token}`, "Content-Length": Buffer.byteLength(body),
      } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
      req.on("error", reject);
      req.write(body.slice(0, 1));
    });
    await vi.waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
    s.store.revokeToken(s.first.token);
    req!.end(body.slice(1));
    expect(await response).toBe(401);
    expect(s.store.summaries(s.project.id)).toEqual([]);
  });

  it("uploads an authenticated attachment and sends its host path to the provider", async () => {
    const s = await setup();
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const upload = { id, offset: 0, size: 5, data: Buffer.from("hello").toString("base64") };
    expect((await s.call("attachments.upload", upload, "invalid")).status).toBe(401);
    expect((await s.call("attachments.upload", upload)).value.result).toEqual({ offset: 5 });
    const created = await s.call("commands.dispatch", { type: "create", commandId: "upload-create",
      projectId: s.project.id, harness: "codex", model: "codex:test", runtimeMode: "supervised" });
    const sessionId = created.value.result.sessionId;
    const sent = await s.call("commands.dispatch", { type: "send", commandId: "upload-send",
      sessionId, text: "Read this", attachments: [{ id, name: "notes.txt",
        mimeType: "text/plain", kind: "file", size: 5 }] });
    expect(sent.status).toBe(200);
    await vi.waitFor(() => expect(s.send).toHaveBeenCalledTimes(1));
    expect(s.turn().attachments?.[0].path).toContain(id);
    s.finish();
  });
  it("applies card actions to the owning project and lists their saved state", async () => {
    const s = await setup();
    const create = await s.call("commands.dispatch", {
      type: "create",
      commandId: "card-session",
      projectId: s.project.id,
      harness: "codex",
      model: "codex:test",
      runtimeMode: "supervised",
    });
    const sessionId = create.value.result.sessionId;
    const changed = await s.call("sessions.update", {
      projectId: s.project.id,
      sessionId,
      title: "Codex · Card title",
      pinned: true,
    });
    expect(changed.status).toBe(200);
    expect((await s.call("sessions.list", { projectId: s.project.id })).value.result[0])
      .toMatchObject({ id: sessionId, title: "Codex · Card title", pinned: true, model: "codex:test" });
    expect((await s.call("sessions.update", {
      projectId: "wrong-project", sessionId, archived: true,
    })).status).not.toBe(200);
    expect((await s.call("sessions.delete", {
      projectId: "wrong-project", sessionId,
    })).status).not.toBe(200);
    expect((await s.call("sessions.delete", {
      projectId: s.project.id, sessionId,
    })).status).toBe(200);
    expect((await s.call("sessions.list", { projectId: s.project.id })).value.result).toEqual([]);
  });

  it("lists, creates, and selects registered remote worktrees through RPC", async () => {
    const s = await setup();
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: s.project.cwd });
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    git("checkout", "-q", "-b", "main");
    writeFileSync(join(s.project.cwd, ".gitignore"), "host.db*\n");
    writeFileSync(join(s.project.cwd, "file.txt"), "initial\n");
    git("add", ".gitignore", "file.txt");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-q",
      "-m",
      "initial",
    );

    const branch = await s.call("git.createBranch", {
      projectId: s.project.id,
      branch: "feature",
    });
    expect(branch.value.result.current).toBe("feature");
    expect(
      (await s.call("git.switch", { projectId: s.project.id, branch: "main" }))
        .value.result.current,
    ).toBe("main");
    // Prime the allowed-root cache before creating a checkout.
    expect((await s.call("workspace.run", { command: "list_dir", args: { path: s.project.cwd } })).status).toBe(200);
    const created = await s.call("git.worktreeCreate", {
      projectId: s.project.id,
      branch: "feature",
      base: "HEAD",
      existing: true,
    });
    expect(created.status).toBe(200);
    const tree = created.value.result;
    cleanups.push(async () =>
      rmSync(join(s.project.cwd, "..", `${s.project.name}-worktrees`), {
        recursive: true,
        force: true,
      }),
    );
    expect(tree.branch).toBe("feature");
    expect((await s.call("workspace.run", { command: "read_text_file", args: {
      path: join(tree.path, "file.txt"),
    } })).value.result).toBe("initial\n");
    expect(
      (await s.call("git.worktrees", { projectId: s.project.id })).value.result
        .worktrees,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: tree.path, branch: "feature" }),
      ]),
    );

    const opened = await s.call("commands.dispatch", {
      type: "create",
      commandId: "in-worktree",
      projectId: s.project.id,
      worktreeCwd: tree.path,
      harness: "codex",
      model: "codex:test",
      runtimeMode: "supervised",
    });
    expect(opened.status).toBe(200);
    expect(s.store.session(opened.value.result.sessionId).session.cwd).toBe(
      tree.path,
    );
    expect((await s.call("sessions.list", { projectId: s.project.id })).value.result[0])
      .toMatchObject({
        id: opened.value.result.sessionId,
        branch: "feature",
        worktreeCwd: tree.path,
        repo: s.project.name,
      });
    expect(
      (
        await s.call("commands.dispatch", {
          type: "create",
          commandId: "outside-worktree",
          projectId: s.project.id,
          worktreeCwd: tmpdir(),
          harness: "codex",
          model: "codex:test",
          runtimeMode: "supervised",
        })
      ).value.error,
    ).toContain("available worktree");

    writeFileSync(join(tree.path, "file.txt"), "changed\n");
    expect(
      (await s.call("git.diff", { projectId: s.project.id, cwd: tree.path }))
        .value.result,
    ).toContain("changed");
  });
  it("retries model discovery after a provider becomes available", async () => {
    const s = await setup();
    modelProbe.mockRejectedValueOnce(new Error("Login required"));
    modelProbe.mockResolvedValueOnce([{ id: "codex:test", name: "Test" }]);
    const first = await s.call("models.list", { projectId: s.project.id });
    expect(first.value.result.errors.codex).toBe("Login required");
    const second = await s.call("models.list", { projectId: s.project.id });
    expect(second.value.result.models.codex).toEqual([
      { id: "codex:test", name: "Test" },
    ]);
    expect(modelProbe).toHaveBeenCalledTimes(2);
  });
  it("advertises newer providers only to desktops that request them", async () => {
    const s = await setup(["codex", "cursor"]);
    expect((await s.call("environment.describe")).value.result.providers)
      .toEqual(["codex"]);
    expect((await s.call("environment.describe", {
      supportedProviders: ["codex", "cursor"],
    })).value.result.providers).toEqual(["codex", "cursor"]);
  });
  it("discovers a newly installed Pi and invalidates the model catalog without restarting", async () => {
    let available: RemoteProvider[] = ["codex"];
    const s = await setup(["codex"], async () => available);
    const binary = join(s.directory, "provider-cli");
    writeFileSync(binary, "");
    binaries.codex = binary;
    binaries.pi = binary;
    cleanups.push(async () => {
      delete binaries.codex;
      delete binaries.pi;
    });
    modelProbe.mockResolvedValue([
      { id: "codex:test", name: "Codex", harness: "codex" },
    ]);
    piModelProbe.mockResolvedValue([
      { id: "pi:test", name: "Pi model", harness: "pi" },
    ]);
    const list = async () =>
      (await s.call("models.list", { projectId: s.project.id })).value.result;
    expect((await list()).models).not.toHaveProperty("pi");
    available = ["codex", "pi"];
    expect(
      (
        await s.call("environment.describe", {
          supportedProviders: ["codex", "pi"],
        })
      ).value.result.providers,
    ).toEqual(["codex", "pi"]);
    expect((await list()).models.pi).toEqual([
      { id: "pi:test", name: "Pi model", harness: "pi" },
    ]);
    available = ["pi"];
    expect((await list()).models).not.toHaveProperty("codex");
  });
  it("re-probes models after the provider CLI is updated", async () => {
    const s = await setup();
    cleanups.push(async () => {
      delete binaries.codex;
    });
    writeFileSync(join(s.directory, "codex-1"), "");
    writeFileSync(join(s.directory, "codex-2"), "");
    binaries.codex = join(s.directory, "codex-1");
    modelProbe.mockClear();
    modelProbe.mockResolvedValueOnce([{ id: "codex:old", name: "Old" }]);
    modelProbe.mockResolvedValueOnce([{ id: "codex:new", name: "New" }]);
    const list = async () =>
      (await s.call("models.list", { projectId: s.project.id })).value.result
        .models.codex;
    expect(await list()).toEqual([{ id: "codex:old", name: "Old" }]);
    expect(await list()).toEqual([{ id: "codex:old", name: "Old" }]);
    binaries.codex = join(s.directory, "codex-2");
    expect(await list()).toEqual([{ id: "codex:new", name: "New" }]);
    expect(modelProbe).toHaveBeenCalledTimes(2);
  });
  it("serves a five-minute-old catalog while re-probing it in the background", async () => {
    const s = await setup();
    modelProbe.mockClear();
    modelProbe.mockResolvedValueOnce([{ id: "codex:old", name: "Old" }]);
    modelProbe.mockResolvedValueOnce([{ id: "codex:new", name: "New" }]);
    const list = async () =>
      (await s.call("models.list", { projectId: s.project.id })).value.result
        .models.codex;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      expect(await list()).toEqual([{ id: "codex:old", name: "Old" }]);
      vi.setSystemTime(Date.now() + 4 * 60_000);
      expect(await list()).toEqual([{ id: "codex:old", name: "Old" }]);
      vi.setSystemTime(Date.now() + 60_000);
      expect(await list()).toEqual([{ id: "codex:old", name: "Old" }]);
      await vi.waitFor(async () =>
        expect(await list()).toEqual([{ id: "codex:new", name: "New" }]));
    } finally {
      vi.useRealTimers();
    }
    expect(modelProbe).toHaveBeenCalledTimes(2);
  });
  it("lets an authenticated desktop browse host folders without reading files", async () => {
    const s = await setup();
    mkdirSync(join(s.directory, "checkout"));
    writeFileSync(join(s.directory, "private.txt"), "secret");
    const listed = await s.call("projects.browse", { path: s.directory });
    expect(listed.status).toBe(200);
    expect(listed.value.result.entries).toEqual([
      { name: "checkout", path: join(s.directory, "checkout") },
    ]);
    expect(
      (await s.call("projects.browse", { path: s.directory }, "invalid"))
        .status,
    ).toBe(401);
  });
  it("allows a different client to recover work completed while the laptop was disconnected", async () => {
    const s = await setup();
    const create = await s.call("commands.dispatch", {
      type: "create",
      commandId: "create",
      projectId: s.project.id,
      harness: "codex",
      model: "codex:test",
      runtimeMode: "supervised",
    });
    const id = create.value.result.sessionId;
    const command = {
      type: "send",
      commandId: "send",
      sessionId: id,
      text: "Work without this client",
    };
    await s.call("commands.dispatch", command);
    await vi.waitFor(() => expect(s.send).toHaveBeenCalledTimes(1));
    s.turn().onEvent({ type: "message.delta", text: "Finished on the host" });
    s.finish();
    await vi.waitFor(() => expect(s.store.session(id).status).toBe("idle"));
    const recovered = await s.call(
      "sessions.get",
      { sessionId: id },
      s.second.token,
    );
    expect(recovered.value.result.session.blocks.at(-1).text).toBe(
      "Finished on the host",
    );
    await s.call("commands.dispatch", command, s.second.token);
    expect(s.send).toHaveBeenCalledTimes(1);
  });

  it("rejects revoked devices, browser origins, and changed host identities", async () => {
    const s = await setup();
    expect((await s.call("environment.describe", {}, "invalid")).status).toBe(
      401,
    );
    expect(
      (
        await s.call(
          "environment.describe",
          {},
          s.first.token,
          {},
          { Origin: "https://untrusted.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call("projects.list", {}, s.first.token, {
          environmentId: "different-host",
        })
      ).value.error,
    ).toContain("identity changed");
    s.store.db.prepare("DELETE FROM devices WHERE id=?").run(s.first.id);
    expect((await s.call("environment.describe")).status).toBe(401);
    expect(
      (await s.call("environment.describe", {}, s.second.token)).status,
    ).toBe(200);
  });

  it("lets a desktop revoke only its own credential, keeping sessions", async () => {
    const s = await setup();
    const create = await s.call("commands.dispatch", {
      type: "create",
      commandId: "create",
      projectId: s.project.id,
      harness: "codex",
      model: "codex:test",
      runtimeMode: "supervised",
    });
    const id = create.value.result.sessionId;
    expect((await s.call("devices.revokeSelf")).value.result).toEqual({
      revoked: true,
    });
    expect((await s.call("environment.describe")).status).toBe(401);
    const other = await s.call(
      "sessions.sync",
      { sessionId: id },
      s.second.token,
    );
    expect(other.value.result.value.session.id).toBe(id);
  });

  it("limits device management to the desktop credential", async () => {
    const s = await setup();
    expect((await s.call("devices.list", {}, s.second.token)).value.error).toContain("Only this computer");
    s.store.markAdminDevice(s.first.id);
    const issued = (await s.call("devices.issue", { name: "Phone" })).value.result;
    expect(issued.token).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect((await s.call("environment.describe", {}, issued.token)).status).toBe(200);
    const listed = (await s.call("devices.list")).value.result.devices;
    expect(listed.find((device: { id: string }) => device.id === issued.id)).toMatchObject({ name: "Phone", admin: false });
    expect(listed.find((device: { id: string }) => device.id === s.first.id)).toMatchObject({ admin: true });
    expect((await s.call("devices.revoke", { deviceId: s.first.id })).value.error).toContain("cannot be revoked");
    expect((await s.call("devices.revoke", { deviceId: issued.id })).value.result).toEqual({ revoked: true });
    expect((await s.call("environment.describe", {}, issued.token)).status).toBe(401);
  });

  it("reads host files while rejecting traversal and symlink escapes", async () => {
    const s = await setup();
    writeFileSync(join(s.directory, "hello.txt"), "from host");
    expect(
      await s.call("files.read", {
        projectId: s.project.id,
        cwd: s.project.cwd,
        path: "hello.txt",
      }),
    ).toEqual({ status: 200, value: { result: "from host" } });
    expect(
      await s.call("files.write", {
        projectId: s.project.id,
        path: "hello.txt",
        expected: "from host",
        content: "edited",
      }),
    ).toEqual({ status: 200, value: { result: null } });
    expect(
      (
        await s.call("files.read", {
          projectId: s.project.id,
          path: "hello.txt",
        })
      ).value.result,
    ).toBe("edited");
    symlinkSync(
      tmpdir(),
      join(s.directory, "outside"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(
      (await s.call("files.read", { projectId: s.project.id, path: "outside" }))
        .value.error,
    ).toContain("outside");
    const sibling = `${s.directory}-outside.txt`;
    writeFileSync(sibling, "must not be exposed");
    try {
      expect(
        (await s.call("files.read", { projectId: s.project.id, path: sibling }))
          .value.error,
      ).toContain("outside");
    } finally {
      rmSync(sibling);
    }
    expect(
      (await s.call("files.read", { projectId: s.project.id, path: ".." }))
        .value.error,
    ).toContain("outside");
  });

  it("answers this app's file commands inside host projects only", async () => {
    const s = await setup();
    const outside = mkdtempSync(join(tmpdir(), "monocode-outside-"));
    cleanups.push(async () => rmSync(outside, { recursive: true, force: true }));
    const checkout = join(s.directory, "checkout");
    mkdirSync(join(checkout, "src"), { recursive: true });
    writeFileSync(join(checkout, "src", "app.ts"), "before\n");
    const project = await s.engine.openProject(checkout);
    const root = project.cwd.replace(/\\/g, "/");
    const run = async (command: string, args: Record<string, unknown>) =>
      (await s.call("workspace.run", { command, args })).value;

    expect((await run("list_dir", { path: root })).result).toEqual([
      { name: "src", path: `${root}/src`, isDir: true, ignored: false },
    ]);
    expect(
      (await run("read_text_file", { path: `${root}/src/app.ts` })).result,
    ).toBe("before\n");
    expect(
      (await run("read_binary_file", { path: `${root}/src/app.ts` })).result,
    ).toBe(Buffer.from("before\n").toString("base64"));
    await run("write_text_file", { path: `${root}/src/app.ts`, content: "after\n" });
    expect(
      (await run("read_text_file", { path: `${root}/src/app.ts` })).result,
    ).toBe("after\n");
    const [stat] = (
      await run("stat_files", { paths: [`${root}/src/app.ts`, `${root}/nope`] })
    ).result;
    expect(stat).toMatchObject({ path: `${root}/src/app.ts` });
    expect(typeof stat.mtimeMs).toBe("number");

    expect(
      (await run("create_path", { parent: root, name: "docs/a.md", isDir: false }))
        .result,
    ).toBe(`${root}/docs/a.md`);
    expect(
      (await run("create_path", { parent: root, name: "docs/a.md", isDir: false }))
        .error,
    ).toContain("already exists");
    expect(
      (await run("rename_path", { path: `${root}/docs/a.md`, name: "b.md" }))
        .result,
    ).toBe(`${root}/docs/b.md`);
    expect(
      (await run("copy_path", { from: `${root}/docs/b.md`, destParent: `${root}/docs` }))
        .result,
    ).toBe(`${root}/docs/b copy.md`);
    expect(
      (await run("move_path", { from: `${root}/docs/b.md`, destParent: `${root}/src` }))
        .result,
    ).toBe(`${root}/src/b.md`);
    await run("delete_path", { path: `${root}/docs` });
    expect(
      (await run("list_project_files", { cwd: root })).result
        .map((file: { relative: string }) => file.relative)
        .sort(),
    ).toEqual(["src/app.ts", "src/b.md"]);
    expect(
      (await s.call("files.index", { projectId: project.id, cwd: root }))
        .value.result,
    ).toEqual(["src/app.ts", "src/b.md"]);

    const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
    git("init", "-q");
    git("config", "user.name", "Host Test");
    git("config", "user.email", "host@example.test");
    git("add", "src");
    git("commit", "-qm", "initial");
    writeFileSync(join(root, "src", "app.ts"), "changed\n");
    expect((await run("search_project", { options: { cwd: root, query: "changed" } })).result.matches)
      .toContainEqual(expect.objectContaining({
        path: `${root}/src/app.ts`, relative: "src/app.ts", line: 1,
      }));
    const gitIndex = (await run("git_diff_index", { cwd: root })).result;
    expect(gitIndex.files).toContainEqual(expect.objectContaining({
      path: "src/app.ts", relative: "src/app.ts", unstaged: true,
    }));
    expect((await run("git_file_diff", { cwd: root, relative: "src/app.ts", staged: false })).result)
      .toMatchObject({ original: "after\n", current: "changed\n" });
    await run("git_stage_file", { cwd: root, relative: "src/app.ts" });
    expect((await run("git_diff_index", { cwd: root })).result.files)
      .toContainEqual(expect.objectContaining({ relative: "src/app.ts", staged: true }));
    const history = (await run("git_history", { cwd: root, limit: 10 })).result;
    expect(history.commits[0])
      .toMatchObject({ subject: "initial", head: true, author: "Host Test", authorEmail: "host@example.test" });
    expect(history.commits[0].timestamp).toBeLessThan(10_000_000_000);
    expect((await run("git_commit_files", { cwd: root, sha: history.head })).result)
      .toContainEqual(expect.objectContaining({ relative: "src/app.ts", additions: 1 }));
    expect((await run("git_commit_file_diff", {
      cwd: root, sha: history.head, relative: "src/app.ts",
    })).result).toMatchObject({ original: "", current: "after\n", status: "added" });
    writeFileSync(join(root, "src", "new.ts"), "a\nb\n");
    expect((await run("git_base_diff_files", { cwd: root, base: "head" })).result).toMatchObject({
      base: "HEAD",
      files: [
        expect.objectContaining({ relative: "src/app.ts", status: "modified", additions: 1, deletions: 1 }),
        expect.objectContaining({ relative: "src/new.ts", status: "untracked", additions: 2 }),
      ],
    });
    expect((await run("git_base_file_diff", { cwd: root, base: "head", relative: "src/app.ts" })).result)
      .toMatchObject({ original: "after\n", current: "changed\n", status: "modified" });
    expect((await run("git_base_file_diff", { cwd: root, base: "head", relative: "src/new.ts" })).result)
      .toMatchObject({ original: "", current: "a\nb\n", status: "added" });
    expect((await run("git_base_diff_files", { cwd: root, base: "nope" })).error).toBeTruthy();
    expect((await run("git_worktrees", { cwd: root })).result.worktrees)
      .toContainEqual(expect.objectContaining({ path: project.cwd, isMain: true }));

    for (const path of [outside, `${root}/../outside`, `${root}/.git/config`])
      expect((await run("read_text_file", { path })).error).toBeTruthy();
    // Read-only previews reach files outside the projects; edits do not.
    writeFileSync(join(outside, "SKILL.md"), "# Skill\n");
    expect(
      (await run("read_binary_file", { path: join(outside, "SKILL.md") })).result,
    ).toBe(Buffer.from("# Skill\n").toString("base64"));
    expect((await run("read_binary_file", { path: outside })).error).toBe(
      "Not a file",
    );
    expect(
      (await run("read_binary_file", { path: "relative.md" })).error,
    ).toBeTruthy();
    expect(
      (await run("write_text_file", { path: join(outside, "x"), content: "x" }))
        .error,
    ).toContain("outside");
    expect((await run("delete_path", { path: root })).error).toBeTruthy();
    expect((await run("rm_rf", { path: root })).error).toContain("Unsupported");
  });

  it("browses and commits changes in the host checkout", async () => {
    const s = await setup();
    const checkout = join(s.directory, "checkout");
    mkdirSync(checkout);
    const project = await s.engine.openProject(checkout);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: checkout });
    git("init", "-q");
    git("config", "user.name", "Host Test");
    git("config", "user.email", "host@example.test");
    mkdirSync(join(checkout, "src"));
    writeFileSync(join(checkout, "src", "app.ts"), "before\n");
    git("add", "--", ".");
    git("commit", "-qm", "initial");
    writeFileSync(join(checkout, "src", "app.ts"), "after\n");
    writeFileSync(join(checkout, "new.ts"), "new\n");

    const root = await s.call("files.list", {
      projectId: project.id,
      path: "",
    });
    expect(root.status).toBe(200);
    expect(root.value.result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "src", isDir: true }),
        expect.objectContaining({ name: "new.ts", isDir: false }),
      ]),
    );
    expect(
      (
        await s.call("files.search", {
          projectId: project.id,
          query: "app",
        })
      ).value.result,
    ).toEqual([expect.objectContaining({ path: "src/app.ts" })]);
    expect(
      (
        await s.call("files.searchContent", {
          projectId: project.id,
          query: "after",
        })
      ).value.result,
    ).toMatchObject({
      matches: [expect.objectContaining({ relative: "src/app.ts", line: 1 })],
      truncated: false,
    });
    expect(
      (await s.call("files.list", { projectId: project.id, path: "src" })).value
        .result[0].name,
    ).toBe("app.ts");
    expect(
      (await s.call("files.list", { projectId: project.id, path: ".." })).value
        .error,
    ).toContain("outside");
    expect(
      (
        await s.call("files.list", {
          projectId: project.id,
          cwd: s.directory,
          path: "",
        })
      ).value.error,
    ).toContain("worktree");

    const index = await s.call("git.index", { projectId: project.id });
    expect(index.value.result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relative: "src/app.ts",
          status: "modified",
          unstaged: true,
        }),
        expect.objectContaining({
          relative: "new.ts",
          status: "untracked",
          unstaged: true,
        }),
      ]),
    );
    const diff = await s.call("git.fileDiff", {
      projectId: project.id,
      path: "src/app.ts",
      staged: false,
    });
    expect(diff.value.result).toMatchObject({
      original: "before\n",
      current: "after\n",
    });
    expect(
      (
        await s.call("git.action", {
          projectId: project.id,
          action: "stage",
          path: "../escape",
        })
      ).value.error,
    ).toContain("outside");
    expect(
      (
        await s.call("git.action", {
          projectId: project.id,
          action: "stageContents",
          path: "src/app.ts",
          content: "selected\n",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.call("git.fileDiff", {
          projectId: project.id,
          path: "src/app.ts",
          staged: true,
        })
      ).value.result.current,
    ).toBe("selected\n");
    expect(
      (
        await s.call("git.action", {
          projectId: project.id,
          action: "stageAll",
        })
      ).status,
    ).toBe(200);
    const staged = await s.call("git.index", { projectId: project.id });
    expect(
      staged.value.result.files.every(
        (file: { staged: boolean }) => file.staged,
      ),
    ).toBe(true);
    expect(
      (
        await s.call("git.action", {
          projectId: project.id,
          action: "commit",
          message: "remote commit",
        })
      ).status,
    ).toBe(200);
    expect(
      (await s.call("git.index", { projectId: project.id })).value.result.files,
    ).toEqual([]);
  });
});

it("advertises assistant RPC, enforces device auth and hides the private brain", async () => {
  const { engine, store, project, call, first } = await setup();
  await engine.ready;
  engine.assistant.setCatalog(async () => ["codex"], async () => ({ models: { codex: [{ id: "test", name: "Test" }] }, errors: {} }));
  expect((await call("environment.describe")).value.result.capabilities)
    .toEqual(expect.arrayContaining(["assistant.v1", "assistant.history"]));
  expect((await call("assistant.get")).value.result).toBeNull();
  expect((await call("assistant.messages", { latest: true })).value.result)
    .toMatchObject({ assistant: null, entries: [], hasMore: false });
  expect((await call("assistant.memoryTopic", { topic: "deploys" })).value.result).toBeNull();
  const command = { commandId: "setup-assistant", expectedRevision: 0, patch: { harness: "codex", model: "test", triggers: { user: true, event: false, schedule: false } } };
  expect((await call("assistant.configure", command)).status).toBe(200);
  expect((await call("assistant.configure", command)).status).toBe(200);
  const topicText = "# Deploys\n\n- Use staging first\n";
  engine.assistant.store.writeMemoryDoc("topic:deploys", topicText);
  expect((await call("assistant.memory")).value.result.topics).toEqual(["deploys"]);
  expect((await call("assistant.memoryTopic", { topic: "deploys" })).value.result).toEqual({
    name: "deploys", text: topicText, revision: 1,
  });
  expect((await call("assistant.memoryTopic", { topic: "missing" })).value.result).toBeNull();
  expect((await call("assistant.memoryTopic", { topic: "../archive" })).value.error).toMatch(/topic/);
  expect((await call("assistant.memoryTopic", { topic: "archive" })).value.error).toMatch(/topic/);
  expect((await call("assistant.memoryTopic", { topic: "deploys", text: "overwrite" })).value.error).toBeTruthy();
  expect(engine.assistant.store.memoryDoc("topic:deploys")).toEqual({ text: topicText, revision: 1 });
  expect((await call("assistant.send", { commandId: "assistant-message", text: "Hello" })).status).toBe(200);
  const history = (await call("assistant.messages", { latest: true, limit: 1 })).value.result;
  expect(history.entries).toHaveLength(1);
  expect(history.assistant.id).toBe((await call("assistant.get")).value.result.id);
  expect(history.assistant).not.toHaveProperty("brainSessionId");
  for (const params of [
    { latest: false }, { latest: true, afterRevision: 0 },
    { latest: true, before: { createdAt: 1, id: "one", extra: true } },
    { before: history.nextCursor },
  ])
    expect((await call("assistant.messages", params)).value.error).toBeTruthy();
  await vi.waitFor(() => expect(engine.assistant.store.get()?.brainSessionId).toBeTruthy());
  const brain = engine.assistant.store.get()!.brainSessionId!;
  expect((await call("sessions.get", { sessionId: brain })).value.error).toMatch(/private/);
  expect((await call("sessions.list", { projectId: store.session(brain).projectId })).value.result).toEqual([]);
  expect((await call("projects.list")).value.result.map((p: any) => p.id)).toContain(project.id);
  expect((await call("projects.list")).value.result.some((p: any) => p.kind === "assistant")).toBe(false);
  expect((await call("assistant.configure", { ...command, commandId: "conflict", patch: { name: "Changed" } })).value).toMatchObject({ code: "conflict" });
  store.revokeToken(first.token);
  expect((await call("assistant.get")).status).toBe(401);
  expect((await call("assistant.messages", { latest: true })).status).toBe(401);
  expect((await call("assistant.memoryTopic", { topic: "deploys" })).status).toBe(401);
});

it("records phone hardware only for the authenticated device and retains it on legacy reconnects", async () => {
  const s = await setup();
  s.store.markAdminDevice(s.first.id);
  const params = { deviceId: s.first.id, deviceInfo: { model: " SM-S9280 ", manufacturer: " Samsung " } };
  expect((await s.call("environment.describe", params, s.second.token)).status).toBe(200);
  await s.call("environment.describe", {}, s.second.token);
  await s.call("environment.describe", { deviceInfo: { model: 123 } }, s.second.token);
  const devices = (await s.call("devices.list")).value.result.devices;
  expect(devices.find((device: { id: string }) => device.id === s.second.id)).toMatchObject({
    name: "Other computer", model: "SM-S9280", manufacturer: "Samsung",
  });
  expect(devices.find((device: { id: string }) => device.id === s.first.id).model).toBeUndefined();
  const reopened = new HostStore(join(s.directory, "host.db"));
  try {
    expect(reopened.devices().find(device => device.id === s.second.id)).toMatchObject({ model: "SM-S9280", manufacturer: "Samsung" });
  } finally {
    reopened.close();
  }
});

it("records desktop hostnames for the authenticated device and persists them across reconnects", async () => {
  const s = await setup();
  s.store.markAdminDevice(s.first.id);
  const info = { deviceType: "desktop", hostname: "  wy-ubuntu\u0000\n " };
  expect((await s.call("environment.describe", { deviceId: s.first.id, deviceInfo: info }, s.second.token)).status).toBe(200);
  await s.call("environment.describe", {}, s.second.token);
  const devices = (await s.call("devices.list")).value.result.devices;
  expect(devices.find((device: { id: string }) => device.id === s.second.id)).toMatchObject({
    name: "Other computer", deviceType: "desktop", hostname: "wy-ubuntu",
  });
  expect(devices.find((device: { id: string }) => device.id === s.first.id).hostname).toBeUndefined();
  const reopened = new HostStore(join(s.directory, "host.db"));
  try {
    expect(reopened.devices().find(device => device.id === s.second.id)).toMatchObject({ deviceType: "desktop", hostname: "wy-ubuntu" });
  } finally {
    reopened.close();
  }
});
