import { dirname, join, resolve, sep } from "node:path";
import { HostProviderUsage } from "./provider-usage";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { hostname, homedir } from "node:os";
import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { claimCheckoutResource, claimCheckoutWrite } from "./checkout-guards";
import {
  HOST_PROTOCOL_VERSION,
  type HostModelCatalog,
  type RemoteProvider,
} from "../src/features/connections/model/protocol";
import { HostEngine } from "./engine";
import { pairingCode } from "./store";
import { assistantErrorCode } from "./assistant/errors";
import { writeAttachmentChunk, readAttachmentChunk } from "./attachments";
import type { LinkedWorkItem } from "../src/features/sessions/model/session";
import { parseGithubWorkItemUrl } from "../src/features/sessions/model/sessionWorkItem";
import { SyncTransfers } from "./sync-transfer";
import { browseHostDirectories } from "./browse";
import { pairingHostCandidates } from "./pairing-hosts";
import {
  createHostBranch,
  hostBranches,
  switchHostBranch,
} from "./git-branches";
import {
  createHostWorktree,
  hostWorktrees,
  resolveHostWorktreeAsync,
} from "./git-worktrees";
import {
  createHostPath,
  hostFileDiff,
  hostGitAction,
  hostGitIndex,
  indexHostFiles,
  listHostFiles,
  readHostFile,
  searchHostContent,
  searchHostFiles,
  writeHostFile,
} from "./workspace";
import { WorkspaceCommands } from "./workspace-commands";
import { discoverCodexModels } from "../src/integrations/harness/providers/codex/codexCatalog";
import { discoverClaudeModels } from "../src/integrations/harness/providers/claude/claudeCatalog";
import { discoverCursorModels } from "../src/integrations/harness/providers/cursor/cursorCatalog";
import { discoverGrokModels } from "../src/integrations/harness/providers/grok/grokCatalog";
import { discoverOpenCodeModels } from "../src/integrations/harness/providers/opencode/opencodeCatalog";
import { discoverPiModels, discoverOmpModels } from "../src/integrations/harness/providers/pi/piCatalog";
import { discoverFxModels } from "../src/integrations/harness/providers/fx/fxCatalog";
import { discoverHermesModels } from "../src/integrations/harness/providers/hermes/hermesCatalog";
import { discoverAntigravityModels } from "../src/integrations/harness/providers/antigravity/antigravityCatalog";
import { setHarnessModels, type AgentModel } from "../src/features/sessions/model/models";
import {
  resolveAntigravityBinary,
  resolveClaudeBinary,
  resolveCodexBinary,
  resolveCursorBinary,
  resolveFxBinary,
  resolveGrokBinary,
  resolveHermesBinary,
  resolveOmpBinary,
  resolveOpenCodeBinary,
  resolvePiBinary,
} from "../src/integrations/harness/core/child";

const exec = promisify(execFile);
// Providers also add models server-side, without a CLI update.
const CATALOG_MAX_AGE_MS = 5 * 60_000;
const resolveBinary: Record<RemoteProvider, () => Promise<{ path: string }>> = {
  codex: () => resolveCodexBinary(),
  claude: () => resolveClaudeBinary(),
  cursor: () => resolveCursorBinary(),
  grok: () => resolveGrokBinary(),
  opencode: () => resolveOpenCodeBinary(),
  pi: () => resolvePiBinary(),
  omp: () => resolveOmpBinary(),
  fx: () => resolveFxBinary(),
  hermes: () => resolveHermesBinary(),
  antigravity: () => resolveAntigravityBinary(),
};
// A 1 MiB text file can expand to 6 MiB when JSON escapes control characters.
// Existing files.write sends both the original and replacement contents.
// A 20 MiB note image needs about 27 MiB after base64 encoding.
const MAX_BODY = 32 * 1024 * 1024;
const discoverModels: Record<RemoteProvider, (cwd: string) => Promise<AgentModel[]>> = {
  codex: discoverCodexModels,
  claude: discoverClaudeModels,
  cursor: discoverCursorModels,
  grok: discoverGrokModels,
  opencode: discoverOpenCodeModels,
  pi: discoverPiModels,
  omp: discoverOmpModels,
  fx: discoverFxModels,
  hermes: discoverHermesModels,
  antigravity: discoverAntigravityModels,
};

async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request");
  return value as Record<string, unknown>;
}

/** Identifies one installed provider CLI. An update changes its real path or
 * modification time, which invalidates the models the old version reported. */
async function providerBinary(provider: RemoteProvider): Promise<string> {
  try {
    const file = await realpath((await resolveBinary[provider]()).path);
    return `${file}:${(await stat(file)).mtimeMs}`;
  } catch {
    return "missing";
  }
}

function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export function createHostServer(
  engine: HostEngine,
  providers: RemoteProvider[],
  lifecycle?: (request: IncomingMessage, response: ServerResponse) => void,
  discoverProviders?: () => Promise<RemoteProvider[]>,
) {
  const providerUsage = new HostProviderUsage(join(dirname(engine.store.attachmentDir), "desktop-owner.json"));
  let discovering: Promise<RemoteProvider[]> | undefined;
  const availableProviders = () => {
    if (!discoverProviders) return Promise.resolve(providers);
    if (!discovering)
      discovering = discoverProviders().finally(() => {
        discovering = undefined;
      });
    return discovering;
  };
  // Cached per project and provider so one failing or slow CLI never forces
  // every other provider to be probed again on the next visit.
  const catalogs = new Map<
    string,
    {
      binary: string;
      /** When the last successful probe finished; 0 while the first is pending. */
      probed: number;
      models: Promise<AgentModel[]>;
      refreshing?: Promise<void>;
    }
  >();
  const transfers = new SyncTransfers();
  const workspace = new WorkspaceCommands(
    engine.store,
    (projectId, action) => engine.withIdleProject(projectId, action),
    (path) => engine.assertWorkspaceWrite(path),
  );
  const discover = (cwd: string, provider: RemoteProvider) =>
    discoverModels[provider](cwd).then((discovered) => {
      if (discovered.length) setHarnessModels(provider, discovered);
      return discovered;
    });
  // Cached per project and provider so one failing or slow CLI never forces
  // every other provider to be probed again. An expired list keeps answering
  // while its replacement is discovered in the background.
  const providerModels = async (cwd: string, provider: RemoteProvider) => {
    const key = `${cwd}\n${provider}`;
    const binary = await providerBinary(provider);
    const cached = catalogs.get(key);
    if (cached?.binary === binary) {
      if (cached.probed && Date.now() - cached.probed >= CATALOG_MAX_AGE_MS && !cached.refreshing) {
        const next = discover(cwd, provider);
        cached.refreshing = next.then(
          () => { if (catalogs.get(key) === cached) catalogs.set(key, { binary, probed: Date.now(), models: next }); },
          () => { if (catalogs.get(key) === cached) cached.refreshing = undefined; },
        );
      }
      return cached.models;
    }
    const entry = { binary, probed: 0, models: discover(cwd, provider) };
    catalogs.set(key, entry);
    entry.models.then(
      () => { entry.probed = Date.now(); },
      () => { if (catalogs.get(key) === entry) catalogs.delete(key); },
    );
    return entry.models;
  };
  const models = async (projectId?: unknown) => {
    const cwd =
      typeof projectId === "string"
        ? engine.store.project(projectId).cwd
        : homedir();
    const available = await availableProviders();
    const result: HostModelCatalog = { models: {}, errors: {} };
    await Promise.all(
      available.map(async (provider) => {
        try {
          result.models[provider] = await providerModels(cwd, provider);
        } catch (error) {
          result.errors[provider] =
            error instanceof Error ? error.message : String(error);
        }
      }),
    );
    return result;
  };
  engine.orchestration.setCatalog(async (projectId) => {
    const catalog = await models(projectId);
    return Object.entries(catalog.models).flatMap(([harness, entries]) =>
      (entries ?? []).map((model) => ({ harness: harness as RemoteProvider, model: model.id, name: model.name })));
  });
  engine.assistant.setCatalog(availableProviders, models);
  engine.workflows.setModelSource((cwd, harness) => providerModels(cwd, harness as RemoteProvider));
  const resourceId = (token: string, value: unknown) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9_:-]{1,200}$/.test(value)) throw new Error("Invalid editor resource identity");
    return `device:${createHash("sha256").update(token).digest("hex")}:${value}`;
  };
  const mutateWorkspace = <T>(projectId: string, cwd: string, action: () => Promise<T>): Promise<T> =>
    engine.withIdleProject(projectId, async () => {
      engine.assertWorkspaceWrite(cwd);
      const release = claimCheckoutWrite(engine.store, `workspace:${randomUUID()}`, cwd);
      try { return await action(); } finally { release(); }
    });
  return createServer(
    { requestTimeout: 20_000, headersTimeout: 10_000, maxHeaderSize: 8192 },
    async (request, response) => {
      if (request.url === "/lifecycle" && lifecycle) {
        // Administration stays on loopback even when adapters are exposed.
        if (!isLoopback(request.socket.localAddress)) {
          response.writeHead(403).end();
          return;
        }
        lifecycle(request, response);
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      let assistantRequest = false;
      try {
        // Desktop native HTTP supplies credentials. This endpoint intentionally
        // accepts no browser origin and provides no permissive CORS escape hatch.
        if (
          request.headers.origin ||
          request.method !== "POST" ||
          request.url !== "/rpc"
        ) {
          response
            .writeHead(403)
            .end(
              JSON.stringify({ error: "Unsupported request origin or route" }),
            );
          return;
        }
        const token = request.headers.authorization?.match(
          /^Bearer ([A-Za-z0-9_-]+)$/,
        )?.[1];
        if (!token || !engine.store.authenticated(token)) {
          response.writeHead(401).end(
            JSON.stringify({
              error: "Device credential is invalid or revoked",
            }),
          );
          return;
        }
        const input = await body(request);
        assistantRequest = typeof input.method === "string" && input.method.startsWith("assistant.");
        // Reading a request body yields: a device may have been revoked since
        // the headers arrived. Reject it before dispatching any operation.
        if (!engine.store.authenticated(token)) {
          response.writeHead(401).end(JSON.stringify({
            error: "Device credential is invalid or revoked",
          }));
          return;
        }
        engine.store.touchDevice(token);
        if (input.version !== HOST_PROTOCOL_VERSION)
          throw new Error("Incompatible protocol version");
        await engine.ready;
        if (
          input.method !== "environment.describe" &&
          input.environmentId !== engine.store.environmentId
        )
          throw new Error(
            "Host identity changed; reconnect this machine explicitly",
          );
        const params =
          input.params &&
          typeof input.params === "object" &&
          !Array.isArray(input.params)
            ? (input.params as Record<string, unknown>)
            : {};
        if (typeof params.sessionId === "string" && engine.store.isAssistantSession(params.sessionId)) throw new Error("Assistant brain is private");
        let result: unknown;
        switch (input.method) {
          case "environment.describe":
            result = {
              protocolVersion: HOST_PROTOCOL_VERSION,
              environmentId: engine.store.environmentId,
              name: hostname(),
              platform: process.platform,
              // Older clients validate this list against Codex and Claude only.
              providers: (await availableProviders()).filter((provider) =>
                Array.isArray(params.supportedProviders)
                  ? params.supportedProviders.includes(provider)
                  : provider === "codex" || provider === "claude"
              ),
              capabilities: [
                "sessions",
                "projects.browse",
                "models.list",
                "providerAccounts.defaults",
                "providerAccounts.usage.v1",
                "skills.list",
                "notes.v1",
                "approvals",
                "questions",
                "diff",
                "git.branches",
                "git.switch",
                "git.createBranch",
                "git.worktrees",
                "git.worktreeCreate",
                "files.read",
                "files.list",
                "files.index",
                "workspace.run",
                "files.search",
                "files.searchContent",
                "files.create",
                "files.write",
                "git.index",
                "git.fileDiff",
                "git.action",
                "attachments.upload",
                "attachments.read",
                "sessions.draft",
                "sessions.plan",
                "sessions.handoff",
                "sessions.queue",
                "sessions.activity",
                "sessions.nativeAccess",
                "sessions.refreshNative",
                "nativeSources.list",
                "nativeSources.import",
                "nativeSources.syncAll",
                "sessions.orchestration",
                "assistant.v1",
                "assistant.persona",
                "im.feishu.v1",
                "resources",
                "workflows.v1",
              ],
            };
            break;
          case "projects.list":
            result = engine.store.projects();
            break;
          case "projects.browse":
            result = await browseHostDirectories(params.path);
            break;
          case "projects.open":
            result = await engine.openProject(String(params.cwd ?? ""));
            break;
          case "models.list":
            result = await models(params.projectId);
            break;
          case "providerAccounts.list":
            result = engine.providerAccounts();
            break;
          case "providerAccounts.usage":
            result = await providerUsage.read(params);
            break;
          case "titleModel.status":
            result = engine.titleModel.status();
            break;
          case "titleModel.save":
            result = engine.titleModel.save(params);
            break;
          case "titleModel.test":
            result = await engine.titleModel.generate("Explain how session titles work");
            break;
          case "titleModel.generate":
            if (typeof params.message !== "string" || params.message.length > 100_000)
              throw new Error("Invalid title message");
            result = await engine.titleModel.generate(params.message);
            break;
          case "notes.list":
            result = engine.notes.list();
            break;
          case "notes.get":
            result = engine.notes.get(params.id);
            break;
          case "notes.upsert":
            result = engine.notes.upsert(params.note);
            break;
          case "notes.delete":
            result = engine.notes.delete(params.id);
            break;
          case "notes.image":
            result = engine.notes.image(params.asset);
            break;
          case "notes.saveImage":
            result = engine.notes.saveImage(params.noteId, params.name, params.data);
            break;
          case "skills.list":
            result = await engine.listSkills(params.projectId, params.harness, params.sessionId, params.refresh === true);
            break;
          case "sessions.activity":
            result = {
              environmentId: engine.store.environmentId,
              sessions: engine.store.summaries().filter((session) => !session.orchestrationLeadId && !session.workflowParentId && !session.assistantOwnerId),
            };
            break;
          case "sessions.list": {
            const projectId = String(params.projectId ?? "");
            const project = engine.store.project(projectId);
            const summaries = engine.store.summaries(projectId).filter((session) => !session.orchestrationLeadId && !session.workflowParentId && !session.assistantOwnerId);
            const paths = [...new Set(summaries.map((session) => session.cwd ?? project.cwd))];
            const branches = new Map(await Promise.all(paths.map(async (cwd) => {
              const branch = await exec("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
                cwd, timeout: 2_000,
                windowsHide: true,
              }).then(({ stdout }) => stdout.trim()).catch(() => "");
              return [cwd, branch] as const;
            })));
            result = summaries.map((session) => ({
              ...session,
              repo: project.name,
              branch: branches.get(session.cwd ?? project.cwd) || undefined,
              worktreeCwd: session.cwd && session.cwd !== project.cwd
                ? session.cwd : undefined,
            }));
            break;
          }
          case "sessions.update": {
            const sessionId = String(params.sessionId ?? "");
            const current = engine.store.session(sessionId);
            if (current.projectId !== params.projectId)
              throw new Error("Session does not belong to this project");
            const patch: { title?: string; archived?: boolean; pinned?: boolean; linkedWorkItem?: LinkedWorkItem | null } = {};
            if (params.title !== undefined) {
              if (typeof params.title !== "string") throw new Error("Invalid session title");
              patch.title = params.title;
            }
            if (params.archived !== undefined) {
              if (typeof params.archived !== "boolean") throw new Error("Invalid archive value");
              patch.archived = params.archived;
            }
            if (params.pinned !== undefined) {
              if (typeof params.pinned !== "boolean") throw new Error("Invalid pin value");
              patch.pinned = params.pinned;
            }
            if (params.linkedWorkItem !== undefined) {
              const item = params.linkedWorkItem;
              const parsed = item && typeof item === "object" && !Array.isArray(item)
                ? parseGithubWorkItemUrl(String((item as LinkedWorkItem).url ?? ""))
                : null;
              if (item !== null && (
                typeof item !== "object" || Array.isArray(item) ||
                !parsed ||
                parsed.kind !== (item as LinkedWorkItem).kind ||
                parsed.repo !== (item as LinkedWorkItem).repo ||
                parsed.number !== (item as LinkedWorkItem).number ||
                parsed.url !== (item as LinkedWorkItem).url
              )) throw new Error("Invalid linked work item");
              patch.linkedWorkItem = item as LinkedWorkItem | null;
            }
            if (Object.keys(patch).length === 0) throw new Error("No session changes supplied");
            result = engine.updateSession(sessionId, patch);
            break;
          }
          case "sessions.nativeAccess": {
            result = await engine.nativeAccess(String(params.sessionId ?? ""));
            break;
          }
          case "sessions.refreshNative": {
            const sessionId = String(params.sessionId ?? "");
            const current = engine.store.session(sessionId);
            if (!current.session.nativeSession) throw new Error("This conversation has no native source");
            engine.nativeSessions.touch(sessionId);
            result = (await engine.nativeSessions.refresh(sessionId, { force: true })) ?? null;
            break;
          }
          case "nativeSources.list": {
            if (params.autoSync !== undefined) {
              if (typeof params.autoSync !== "boolean") throw new Error("Invalid native auto-sync setting");
              engine.nativeSessions.setAutoSync(params.autoSync);
            }
            result = await engine.nativeSessions.list(params.refresh === true);
            break;
          }
          case "nativeSources.syncAll": {
            result = { synced: await engine.nativeSessions.syncAll() };
            break;
          }
          case "nativeSources.import": {
            const value = await engine.nativeSessions.importSource(String(params.sourceId ?? ""));
            engine.nativeSessions.touch(value.session.id);
            const { blockRevisions: _revisions, ...snapshot } = value;
            result = snapshot;
            break;
          }
          case "sessions.delete": {
            const sessionId = String(params.sessionId ?? "");
            const current = engine.store.session(sessionId);
            if (current.projectId !== params.projectId)
              throw new Error("Session does not belong to this project");
            await engine.deleteSession(sessionId);
            result = { deleted: true };
            break;
          }
          case "sessions.sync": {
            const sessionId = String(params.sessionId ?? "");
            engine.nativeSessions.touch(sessionId);
            result = transfers.respond(
              sessionId,
              engine.store.sync(
                sessionId,
                Number.isSafeInteger(params.revision)
                  ? Number(params.revision)
                  : undefined,
              ),
            );
            break;
          }
          case "sessions.syncChunk":
            result = transfers.chunk(
              String(params.sessionId ?? ""),
              String(params.transfer ?? ""),
              Number(params.offset),
            );
            break;
          case "sessions.get": {
            const value = engine.store.session(String(params.sessionId ?? ""));
            result = value.revision === params.revision ? null : value;
            break;
          }
          case "events.read": {
            if (!Number.isSafeInteger(params.after) || Number(params.after) < 0)
              throw new Error("Invalid event cursor");
            result = engine.store.events(
              String(params.sessionId ?? ""),
              Number(params.after),
            );
            break;
          }
          case "commands.dispatch":
            result = engine.command(params);
            break;
          case "workflows.request":
            result = await engine.workflows.rpc(params, (projectId) => engine.store.project(projectId).cwd, (path) => {
              const target = resolve(path);
              return engine.store.projects().some((project) => target === resolve(project.cwd) || target.startsWith(`${resolve(project.cwd)}${sep}`))
                || engine.store.sessions().some((value) => value.session.worktreeCwd && resolve(value.session.worktreeCwd) === target);
            });
            break;
          case "assistant.get":
          case "assistant.configure":
          case "assistant.messages":
          case "assistant.send":
          case "assistant.control":
          case "assistant.respond":
          case "assistant.memory":
            result = await engine.assistant.rpc(input.method, params);
            break;
          case "im.get":
          case "im.configure":
          case "im.control":
            result = await engine.im.rpc(input.method, params);
            break;
          case "attachments.upload":
            result = writeAttachmentChunk(engine.store, params);
            break;
          case "attachments.read":
            result = readAttachmentChunk(engine.store, params);
            break;
          case "devices.revokeSelf":
            // Only the caller's own credential. Sessions and other devices
            // are unaffected; the host keeps running.
            result = { revoked: engine.store.revokeToken(token) };
            engine.store.db.prepare("DELETE FROM checkout_resources WHERE id LIKE ? AND owner_pid=?")
              .run(`device:${createHash("sha256").update(token).digest("hex") }:%`, process.pid);
            break;
          case "devices.pairingHosts":
            if (!engine.store.adminToken(token))
              throw new Error("Only this computer's desktop can manage devices");
            result = {
              hosts: await pairingHostCandidates({
                port: request.socket.localPort ?? 3774,
                token,
                protocolVersion: HOST_PROTOCOL_VERSION,
                environmentId: engine.store.environmentId,
              }),
            };
            break;
          case "devices.list":
          case "devices.issue":
          case "devices.revoke": {
            if (!engine.store.adminToken(token))
              throw new Error("Only this computer's desktop can manage devices");
            if (input.method === "devices.issue") {
              const name = String(params.name ?? "").trim().slice(0, 80);
              if (!name) throw new Error("Device name is required");
              result = engine.store.issueDevice(name, pairingCode());
            } else if (input.method === "devices.revoke") {
              const id = String(params.deviceId ?? "");
              const device = engine.store.devices().find(value => value.id === id);
              if (!device) throw new Error("Device not found");
              if (device.admin) throw new Error("This computer's desktop credential cannot be revoked here");
              const hash = engine.store.db.prepare("SELECT hash FROM devices WHERE id=?").get(id)?.hash;
              result = { revoked: engine.store.revokeDevice(id) };
              if (hash)
                engine.store.db.prepare("DELETE FROM checkout_resources WHERE id LIKE ? AND owner_pid=?")
                  .run(`device:${String(hash)}:%`, process.pid);
            } else {
              result = { devices: engine.store.devices() };
            }
            break;
          }
          case "resources.claim": {
            const id = resourceId(token, params.resourceId);
            const path = await workspace.resourcePath(params.path);
            if (!engine.store.authenticated(token)) throw new Error("Device credential is invalid or revoked");
            claimCheckoutResource(engine.store, id, path);
            result = { claimed: true };
            break;
          }
          case "resources.release":
            engine.store.db.prepare("DELETE FROM checkout_resources WHERE id=? AND owner_pid=?").run(resourceId(token, params.resourceId), process.pid);
            result = { released: true };
            break;
          case "git.diff": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const diff = await exec(
              "git",
              [
                "-c",
                "core.pager=cat",
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "HEAD",
                "--",
              ],
              {
                cwd: await resolveHostWorktreeAsync(project.cwd, params.cwd),
                windowsHide: true,
                timeout: 10_000,
                maxBuffer: 2 * 1024 * 1024,
              },
            );
            result = diff.stdout;
            break;
          }
          case "git.branches": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await hostBranches(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
            );
            break;
          }
          case "git.switch": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result = await mutateWorkspace(project.id, cwd, () =>
              switchHostBranch(cwd, params.branch, params.remote),
            );
            break;
          }
          case "git.createBranch": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result = await mutateWorkspace(project.id, cwd, () =>
              createHostBranch(cwd, params.branch),
            );
            break;
          }
          case "git.worktrees": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await hostWorktrees(project.cwd);
            break;
          }
          case "git.worktreeCreate": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result = await mutateWorkspace(project.id, cwd, () =>
              createHostWorktree(
                project.cwd,
                params.branch,
                params.base,
                params.existing,
                cwd,
              ),
            );
            workspace.invalidateRoots();
            break;
          }
          case "files.read": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await readHostFile(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
              params.path,
            );
            break;
          }
          case "files.list": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await listHostFiles(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
              params.path,
            );
            break;
          }
          case "files.index": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await indexHostFiles(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
            );
            break;
          }
          case "workspace.run":
            result = (await workspace.run(params.command, params.args)) ?? null;
            break;
          case "files.search": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await searchHostFiles(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
              params.query,
            );
            break;
          }
          case "files.searchContent": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await searchHostContent(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
              params,
            );
            break;
          }
          case "files.create": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result = await mutateWorkspace(project.id, cwd, () => createHostPath(
              cwd,
              params.parent,
              params.name,
              params.isDir,
            ));
            break;
          }
          case "files.write": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result =
              (await mutateWorkspace(project.id, cwd, () => writeHostFile(
                cwd,
                params.path,
                params.expected,
                params.content,
              ))) ?? null;
            break;
          }
          case "git.index": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await hostGitIndex(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
            );
            break;
          }
          case "git.fileDiff": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            result = await hostFileDiff(
              await resolveHostWorktreeAsync(project.cwd, params.cwd),
              params.path,
              params.staged === true,
            );
            break;
          }
          case "git.action": {
            const project = engine.store.project(
              String(params.projectId ?? ""),
            );
            const cwd = await resolveHostWorktreeAsync(project.cwd, params.cwd);
            result =
              (await mutateWorkspace(project.id, cwd, () =>
                hostGitAction(
                  cwd,
                  params.action,
                  params.path,
                  params.message,
                  params.content,
                ),
              )) ?? null;
            break;
          }
          default:
            throw new Error("Unsupported host method");
        }
        response.end(JSON.stringify({ result }));
      } catch (error) {
        if (!response.destroyed)
          response.writeHead(400).end(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : "Host request failed",
              ...(assistantRequest ? { code: assistantErrorCode(error) } : {}),
            }),
          );
      }
    },
  );
}
