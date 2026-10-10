import { manualSessionTitle } from "../src/features/sessions/model/titlePolicy";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import type {
  CommandReceipt,
  HostDeviceInfo,
  HostProject,
  HostSession,
  HostSessionSummary,
  RemoteProvider,
  SessionSync,
} from "../src/features/connections/model/protocol";
import type { Block, LinkedWorkItem } from "../src/features/sessions/model/session";
import {
  pendingSessionInputKey as pendingInputKey,
  sessionNotificationPreview,
  sessionMessageActivityAt,
  sessionRecencyAt,
} from "../src/features/sessions/model/sessionActivity";
import { sessionNeedsInput } from "../src/features/sessions/model/session";

const CACHED_SESSIONS = 32;

export type HostDevice = HostDeviceInfo & {
  id: string;
  name: string;
  admin: boolean;
  createdAt?: number;
  lastSeen?: number;
  /** Made a request within the last {@link DEVICE_ONLINE_MS}. */
  online?: boolean;
};

/** Paired apps poll every few seconds while open. */
export const DEVICE_ONLINE_MS = 30_000;

// Crockford-style alphabet without 0/O/1/I; 32 symbols keep each byte unbiased.
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A phone-friendly device token such as `XD5J-2J3U`, typed or scanned on mobile. */
export function pairingCode(): string {
  const symbols = [...randomBytes(8)].map((byte) => PAIRING_ALPHABET[byte % 32]).join("");
  return `${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

export class HostStore {
  private transactionDepth = 0;
  onSessionSave?: (previous: HostSession | undefined, next: HostSession, event: unknown) => void;
  readonly db: DatabaseSync;
  readonly environmentId: string;
  readonly attachmentDir: string;
  // This process is the only session writer, so recently used snapshots are
  // served from memory instead of re-parsing whole transcripts. Callers must
  // treat returned values as immutable.
  private cache = new Map<string, HostSession>();
  private assistantSessions = new Map<string, boolean>();
  // Sessions holding queued messages. The summary does not carry the queue, so
  // this set lets background scans skip transcripts without parsing them.
  private queuedSessions?: Set<string>;

  constructor(path: string) {
    this.attachmentDir = join(dirname(path), "attachments");
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, cwd TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, signature TEXT NOT NULL, receipt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL REFERENCES sessions(id), revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(session_id, revision));
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS orchestration_runs (lead_id TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orchestration_commands (id TEXT PRIMARY KEY, signature TEXT NOT NULL, session_id TEXT NOT NULL, command TEXT NOT NULL, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS retired_sessions (id TEXT PRIMARY KEY);`);
    const deviceColumns = this.db.prepare("PRAGMA table_info(devices)").all();
    // `admin` marks the local desktop credential, the only one allowed to
    // manage other devices. Paired phones and SSH desktops stay ordinary.
    if (!deviceColumns.some(column => column.name === "admin")) this.db.exec("ALTER TABLE devices ADD COLUMN admin INTEGER NOT NULL DEFAULT 0");
    if (!deviceColumns.some(column => column.name === "created_at")) this.db.exec("ALTER TABLE devices ADD COLUMN created_at INTEGER");
    if (!deviceColumns.some(column => column.name === "last_seen")) this.db.exec("ALTER TABLE devices ADD COLUMN last_seen INTEGER");
    if (!deviceColumns.some(column => column.name === "model")) this.db.exec("ALTER TABLE devices ADD COLUMN model TEXT");
    if (!deviceColumns.some(column => column.name === "manufacturer")) this.db.exec("ALTER TABLE devices ADD COLUMN manufacturer TEXT");
    if (!deviceColumns.some(column => column.name === "device_type")) this.db.exec("ALTER TABLE devices ADD COLUMN device_type TEXT");
    if (!deviceColumns.some(column => column.name === "hostname")) this.db.exec("ALTER TABLE devices ADD COLUMN hostname TEXT");
    const columns = this.db.prepare("PRAGMA table_info(sessions)").all();
    if (!this.db.prepare("PRAGMA table_info(projects)").all().some(column => column.name === "kind")) this.db.exec("ALTER TABLE projects ADD COLUMN kind TEXT");
    if (!columns.some((column) => column.name === "summary"))
      this.db.exec("ALTER TABLE sessions ADD COLUMN summary TEXT");
    // `summary` follows the large `snapshot` column, so reading it from the
    // table walks every snapshot overflow page. Covering indexes keep summary
    // listings and per-session privacy checks off the snapshots entirely.
    this.db.exec(`CREATE INDEX IF NOT EXISTS sessions_project_summary ON sessions(project_id, id, summary);
      CREATE INDEX IF NOT EXISTS sessions_id_summary ON sessions(id, summary);`);
    this.db
      .prepare("INSERT OR IGNORE INTO metadata VALUES ('environmentId', ?)")
      .run(randomUUID());
    this.environmentId = String(
      this.db
        .prepare("SELECT value FROM metadata WHERE key='environmentId'")
        .get()!.value,
    );
  }

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.cache.clear();
      this.queuedSessions = undefined;
      try {
        this.db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back host transaction:", rollbackError);
      }
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  project(id: string): HostProject {
    const row = this.db.prepare("SELECT * FROM projects WHERE id=?").get(id);
    if (!row) throw new Error("Project is not registered on this machine");
    return { id: String(row.id), cwd: String(row.cwd), name: String(row.name), ...(row.kind === "assistant" ? { kind: "assistant" as const } : {}) };
  }

  projects(): HostProject[] {
    return this.db
      .prepare("SELECT * FROM projects WHERE kind IS NULL ORDER BY name")
      .all().map(row => ({ id: String(row.id), cwd: String(row.cwd), name: String(row.name) }));
  }

  addProject(cwd: string, name: string, kind?: "assistant"): HostProject {
    this.db
      .prepare("INSERT OR IGNORE INTO projects(id,cwd,name,kind) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), cwd, name, kind ?? null);
    const row = this.db
      .prepare("SELECT * FROM projects WHERE cwd=?")
      .get(cwd)!;
    return this.project(String(row.id));
  }

  private remember(value: HostSession): HostSession {
    this.cache.delete(value.session.id);
    this.cache.set(value.session.id, value);
    if (this.cache.size > CACHED_SESSIONS)
      this.cache.delete(this.cache.keys().next().value!);
    return value;
  }

  private find(id: string): HostSession | undefined {
    const cached = this.cache.get(id);
    if (cached) return this.remember(cached);
    const row = this.db
      .prepare("SELECT snapshot FROM sessions WHERE id=?")
      .get(id);
    return row
      ? this.remember(JSON.parse(String(row.snapshot)) as HostSession)
      : undefined;
  }

  session(id: string): HostSession {
    const value = this.sessionIfExists(id);
    if (!value) throw new Error("Session not found on this machine");
    return value;
  }

  sessionIfExists(id: string): HostSession | undefined {
    return this.isRetired(id) ? undefined : this.find(id);
  }

  /** Reads a session for a background scan without displacing the recently
   * used sessions that clients are reading from the cache. */
  peekSession(id: string): HostSession | undefined {
    if (this.isRetired(id)) return undefined;
    const cached = this.cache.get(id);
    if (cached) return cached;
    const row = this.db
      .prepare("SELECT snapshot FROM sessions WHERE id=?")
      .get(id);
    return row ? (JSON.parse(String(row.snapshot)) as HostSession) : undefined;
  }

  /** Whether a stored session has queued messages, without parsing it. */
  hasQueuedMessages(id: string): boolean {
    // Seeded once by a text search: JSON escapes quotes inside strings, so the
    // unescaped key only matches a non-empty queue. Saves keep it current.
    this.queuedSessions ??= new Set(
      this.db
        .prepare(`SELECT id FROM sessions WHERE instr(snapshot, '"queuedMessages":[{') > 0`)
        .all()
        .map((row) => String(row.id)),
    );
    return this.queuedSessions.has(id);
  }

  /** The public RPC privacy guard also checks retained retired rows. */
  isAssistantSession(id: string): boolean {
    // Ownership is fixed when the Host creates an assistant session, so each
    // stored session is parsed at most once instead of on every request.
    const known = this.assistantSessions.get(id);
    if (known !== undefined) return known;
    const value = this.find(id);
    // A missing id may still be created later; only remember stored rows.
    if (!value) return false;
    const owned = !!value.session.assistantOwnerId;
    this.assistantSessions.set(id, owned);
    return owned;
  }

  summaries(projectId?: string): HostSessionSummary[] {
    const rows = projectId
      ? this.db.prepare("SELECT id, summary FROM sessions WHERE project_id=?").all(projectId)
      : this.db.prepare("SELECT id, summary FROM sessions").all();
    return rows
      .map((row) => {
        const cached = row.summary
          ? (JSON.parse(String(row.summary)) as HostSessionSummary)
          : undefined;
        if (
          cached?.model &&
          cached.needsInput !== undefined &&
          cached.providerSessionId !== undefined &&
          cached.lastUserMessageAt !== undefined &&
          cached.activityAt !== undefined &&
          cached.lastReplyRevision !== undefined &&
          cached.pendingInputKey !== undefined &&
          cached.notificationPreview !== undefined &&
          !cached.nativeSession?.nativeIds &&
          !cached.nativeSession?.blockIds.length
        )
          return cached;
        const fresh = summary(this.session(String(row.id)));
        this.db.prepare("UPDATE sessions SET summary=? WHERE id=?").run(
          JSON.stringify(fresh),
          String(row.id),
        );
        return fresh;
      })
      .sort((a, b) => sessionRecencyAt(b) - sessionRecencyAt(a));
  }

  sync(id: string, revision?: number): SessionSync {
    const value = this.session(id);
    const { blockRevisions, ...snapshot } = value;
    if (revision === value.revision) return { kind: "unchanged", revision };
    if (revision === undefined || revision > value.revision || !blockRevisions)
      return { kind: "snapshot", value: snapshot };
    const {
      session: { blocks, ...session },
      ...rest
    } = snapshot;
    return {
      kind: "delta",
      base: revision,
      value: { ...rest, session },
      blockIds: blocks.map((block) => block.id),
      blocks: blocks.filter(
        (block) => (blockRevisions[block.id] ?? value.revision) > revision,
      ),
    };
  }

  sessions(projectId?: string): HostSession[] {
    const rows = projectId
      ? this.db
          .prepare("SELECT snapshot FROM sessions WHERE project_id=?")
          .all(projectId)
      : this.db.prepare("SELECT snapshot FROM sessions").all();
    return rows
      .map((row) => JSON.parse(String(row.snapshot)) as HostSession)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Returns the saved value, stamped with per-block change revisions. */
  save(input: HostSession, event: unknown): HostSession {
    return this.transaction(() => this.saveInTransaction(input, event));
  }

  private saveInTransaction(input: HostSession, event: unknown): HostSession {
    if (this.isRetired(input.session.id)) throw new Error("This legacy orchestration conversation was deleted");
    const previous = this.find(input.session.id);
    const revisions = blockRevisions(previous, input);
    const before = new Map(previous?.session.blocks.map((block) => [block.id, block]));
    const receivedReply = input.session.blocks.some((block) =>
      isReplyBlock(block) && revisions[block.id] === input.revision &&
      replyContentChanged(before.get(block.id), block),
    ) || (!!pendingInputKey(input.session, input.runId) && pendingInputKey(previous?.session, previous?.runId) !== pendingInputKey(input.session, input.runId))
      || input.lastCompletedRunId !== previous?.lastCompletedRunId;
    const value = {
      ...input,
      // Older snapshots have no creation time. Preserve their last recorded
      // timestamp when they are first written by this version of the host.
      createdAt:
        input.createdAt ?? previous?.createdAt ?? previous?.updatedAt ?? input.updatedAt,
      lastReplyRevision: receivedReply
        ? input.revision
        : (input.lastReplyRevision ?? previous?.lastReplyRevision ?? replyRevision(previous)),
      blockRevisions: revisions,
    };
    this.db
      .prepare(
        "INSERT INTO sessions (id, project_id, snapshot, summary) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot, summary=excluded.summary",
      )
      .run(
        value.session.id,
        value.projectId,
        JSON.stringify(value),
        JSON.stringify(summary(value)),
      );
    this.db
      .prepare("INSERT INTO events VALUES (?, ?, ?)")
      .run(value.session.id, value.revision, JSON.stringify(event));
    this.db
      .prepare("DELETE FROM events WHERE session_id=? AND revision<?")
      .run(value.session.id, value.revision - 2_000);
    if (value.session.queuedMessages?.length) this.queuedSessions?.add(value.session.id);
    else this.queuedSessions?.delete(value.session.id);
    this.onSessionSave?.(previous, value, event);
    return this.remember(value);
  }

  updateSession(
    id: string,
    patch: { title?: string; archived?: boolean; pinned?: boolean; linkedWorkItem?: LinkedWorkItem | null },
  ): HostSessionSummary {
    return this.transaction(() => {
      const current = this.session(id);
      if (patch.title !== undefined && (!patch.title.trim() || patch.title.length > 200))
        throw new Error("Invalid session title");
      const next = this.save(
        {
          ...current,
          revision: current.revision + 1,
          archived: patch.archived ?? current.archived,
          pinned: patch.pinned ?? current.pinned,
          session: {
            ...current.session,
            ...(patch.title === undefined ? {} : { title: patch.title.trim(), titleState: manualSessionTitle(current.session, patch.title.trim()).titleState }),
            ...(patch.linkedWorkItem === undefined
              ? {}
              : { linkedWorkItem: patch.linkedWorkItem ?? undefined }),
          },
        },
        { type: "session.metadata", patch },
      );
      return summary(next);
    });
  }

  deleteSession(id: string): void {
    this.transaction(() => {
      const current = this.session(id);
      if (current.status === "running")
        throw new Error("Stop this session before deleting it");
      this.db.prepare("DELETE FROM events WHERE session_id=?").run(id);
      this.db.prepare("DELETE FROM sessions WHERE id=?").run(id);
      this.cache.delete(id);
      this.assistantSessions.delete(id);
      this.queuedSessions?.delete(id);
    });
  }

  isRetired(id: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM retired_sessions WHERE id=?").get(id);
  }

  invalidateSession(id: string): void {
    this.cache.delete(id);
    this.queuedSessions?.delete(id);
  }

  orchestration(leadId: string): { id: string; run: import("../src/features/orchestration/model/orchestrationState").OrchestrationRun } | undefined {
    const row = this.db.prepare("SELECT id, state FROM orchestration_runs WHERE lead_id=?").get(leadId);
    return row ? { id: String(row.id), run: JSON.parse(String(row.state)) } : undefined;
  }

  orchestrationLeads(): string[] {
    return this.db.prepare("SELECT lead_id FROM orchestration_runs").all().map((row) => String(row.lead_id));
  }

  saveOrchestration(id: string, run: import("../src/features/orchestration/model/orchestrationState").OrchestrationRun): void {
    if (this.isRetired(run.leadId)) throw new Error("This legacy orchestration conversation was deleted");
    this.db.prepare("INSERT INTO orchestration_runs VALUES (?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET id=excluded.id, state=excluded.state")
      .run(run.leadId, id, JSON.stringify(run));
  }

  receipt(id: string, signature: string): CommandReceipt | undefined {
    const row = this.db.prepare("SELECT * FROM receipts WHERE id=?").get(id);
    if (!row) return undefined;
    if (row.signature !== signature)
      throw new Error("Command ID was already used with a different payload");
    return JSON.parse(String(row.receipt)) as CommandReceipt;
  }

  recordReceipt(signature: string, receipt: CommandReceipt): void {
    this.db
      .prepare("INSERT INTO receipts VALUES (?, ?, ?)")
      .run(receipt.commandId, signature, JSON.stringify(receipt));
  }

  events(
    id: string,
    after: number,
  ): { snapshot?: HostSession; events?: unknown[]; revision: number } {
    const snapshot = this.session(id);
    const rows = this.db
      .prepare(
        "SELECT revision, payload FROM events WHERE session_id=? AND revision>? ORDER BY revision",
      )
      .all(id, after);
    if (
      after > snapshot.revision ||
      (after < snapshot.revision && Number(rows[0]?.revision) !== after + 1)
    ) {
      return { snapshot, revision: snapshot.revision };
    }
    return {
      events: rows.map((row) => ({
        revision: row.revision,
        event: JSON.parse(String(row.payload)),
      })),
      revision: snapshot.revision,
    };
  }

  issueDevice(
    name: string,
    token = randomBytes(32).toString("base64url"),
  ): { id: string; token: string } {
    if (!/^[A-Za-z0-9_-]+$/.test(token))
      throw new Error("Invalid device token");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO devices (id, name, hash, created_at) VALUES (?, ?, ?, ?)")
      .run(id, name, this.hash(token), Date.now());
    return { id, token };
  }

  markAdminDevice(id: string): void {
    this.db.prepare("UPDATE devices SET admin=1 WHERE id=?").run(id);
  }

  adminToken(token: string): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM devices WHERE hash=? AND admin=1")
      .get(this.hash(token));
  }

  devices(now = Date.now()): HostDevice[] {
    return this.db
      .prepare("SELECT id, name, admin, created_at, last_seen, hash, model, manufacturer, device_type, hostname FROM devices ORDER BY created_at, name")
      .all()
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        admin: Number(row.admin) === 1,
        ...(row.model ? { model: String(row.model) } : {}),
        ...(row.manufacturer ? { manufacturer: String(row.manufacturer) } : {}),
        ...(row.device_type === "desktop" || row.device_type === "mobile" ? { deviceType: row.device_type } : {}),
        ...(row.hostname ? { hostname: String(row.hostname) } : {}),
        createdAt: row.created_at == null ? undefined : Number(row.created_at),
        lastSeen: row.last_seen == null ? undefined : Number(row.last_seen),
        online: now - (this.activeAt.get(String(row.hash)) ?? 0) < DEVICE_ONLINE_MS,
      }));
  }

  /** A client can describe only the device owning its authenticated credential. */
  updateDeviceInfo(token: string, value: unknown): void {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const info = value as Record<string, unknown>;
    const field = (value: unknown) => typeof value === "string"
      ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) : "";
    const model = field(info.model);
    const deviceType = info.deviceType === "desktop" ? "desktop" : model ? "mobile" : undefined;
    if (!deviceType) return;
    const hostname = deviceType === "desktop" ? field(info.hostname) || null : null;
    const manufacturer = field(info.manufacturer) || null;
    const hardwareModel = deviceType === "mobile" ? model : null;
    const hardwareManufacturer = deviceType === "mobile" ? manufacturer : null;
    this.db.prepare("UPDATE devices SET model=?, manufacturer=?, device_type=?, hostname=? WHERE hash=? AND (model IS NOT ? OR manufacturer IS NOT ? OR device_type IS NOT ? OR hostname IS NOT ?)")
      .run(hardwareModel, hardwareManufacturer, deviceType, hostname, this.hash(token), hardwareModel, hardwareManufacturer, deviceType, hostname);
  }

  private seenAt = new Map<string, number>();
  /** Latest request per credential hash, kept in memory for presence. */
  private activeAt = new Map<string, number>();
  /** Records presence on every request; persists activity at most once a minute. */
  touchDevice(token: string, now = Date.now()): void {
    const hash = this.hash(token);
    this.activeAt.set(hash, now);
    if (now - (this.seenAt.get(hash) ?? 0) < 60_000) return;
    this.seenAt.set(hash, now);
    this.db.prepare("UPDATE devices SET last_seen=? WHERE hash=?").run(now, hash);
  }

  revokeDevice(id: string): boolean {
    return (
      Number(
        this.db.prepare("DELETE FROM devices WHERE id=?").run(id).changes,
      ) > 0
    );
  }

  /** Lets a desktop revoke only the credential it is using. */
  revokeToken(token: string): boolean {
    return (
      Number(
        this.db
          .prepare("DELETE FROM devices WHERE hash=?")
          .run(this.hash(token)).changes,
      ) > 0
    );
  }

  authenticated(token: string): boolean {
    return !!this.db
      .prepare("SELECT id FROM devices WHERE hash=?")
      .get(this.hash(token));
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
  close(): void {
    this.db.close();
  }
}

/** Lists carry the link's identity only; per-block ID arrays grow with history. */
function listedNativeLink(link: HostSession["session"]["nativeSession"]) {
  if (!link) return undefined;
  const { nativeIds: _nativeIds, ...rest } = link;
  return { ...rest, blockIds: [] };
}

export function summary(value: HostSession): HostSessionSummary {
  const lastUserMessage = value.session.blocks.findLast(
    (block) => block.role === "user" && !block.draft && !block.internal,
  );
  const sentAt = lastUserMessage?.sentAt ?? lastUserMessage?.startedAt;
  return {
    projectId: value.projectId,
    revision: value.revision,
    runId: value.runId,
    status: value.status,
    updatedAt: value.updatedAt,
    activityAt: sessionMessageActivityAt(value.session, value.status === "running") ?? null,
    lastReplyRevision: replyRevision(value),
    lastCompletedRunId: value.lastCompletedRunId ?? null,
    pendingInputKey: pendingInputKey(value.session, value.runId),
    notificationPreview: sessionNotificationPreview(value.session),
    id: value.session.id,
    cwd: value.session.cwd,
    title: value.session.title,
    titleState: value.session.titleState,
    harness: value.session.harness as RemoteProvider,
    model: value.session.model,
    runtimeMode: value.session.runtimeMode,
    providerSessionId: value.session.providerSessionId ?? null,
    createdAt: value.createdAt ?? value.updatedAt,
    lastUserMessageAt:
      sentAt !== undefined && Number.isFinite(sentAt) && sentAt > 0
        ? sentAt
        : null,
    archived: value.archived,
    pinned: value.pinned,
    linkedWorkItem: value.session.linkedWorkItem,
    needsInput: sessionNeedsInput(value.session),
    draft: value.session.blocks.some((block) => block.role === "user" && block.draft),
    nativeSession: listedNativeLink(value.session.nativeSession),
    ...(value.nativeStatus ? { nativeStatus: value.nativeStatus } : {}),
    orchestration: value.orchestration,
    orchestrationLeadId: value.session.orchestrationLeadId,
    ...(value.session.workflowParentId ? { workflowParentId: value.session.workflowParentId } : {}),
    assistantOwnerId: value.session.assistantOwnerId,
  };
}

function isReplyBlock(block: Block): boolean {
  return !block.internal && (
    (block.role === "assistant" && !!block.text.trim()) ||
    block.role === "image" || block.role === "plan" ||
    !!block.notice || !!(block.approval && !block.approval.decided)
  );
}

function replyContentChanged(before: Block | undefined, next: Block): boolean {
  return !before || before.role !== next.role || before.text !== next.text ||
    JSON.stringify([before.image, before.attachments, before.approval?.requestId]) !==
      JSON.stringify([next.image, next.attachments, next.approval?.requestId]);
}

function replyRevision(value?: HostSession): number | null {
  if (!value) return null;
  if (value.lastReplyRevision != null) return value.lastReplyRevision;
  return value.session.blocks.reduce<number | null>((latest, block) => isReplyBlock(block)
    ? Math.max(latest ?? 0, value.blockRevisions?.[block.id] ?? value.revision)
    : latest, null);
}

/** Unchanged blocks keep their previous stamp. Identity is the fast path;
 * values re-read from disk fall back to a structural comparison. */
export function blockRevisions(
  previous: HostSession | undefined,
  next: HostSession,
): Record<string, number> {
  const before = new Map(
    previous?.session.blocks.map((block) => [block.id, block]),
  );
  const revisions: Record<string, number> = {};
  for (const block of next.session.blocks) {
    const old = before.get(block.id);
    const stamp = previous?.blockRevisions?.[block.id];
    revisions[block.id] =
      old &&
      stamp !== undefined &&
      (old === block || JSON.stringify(old) === JSON.stringify(block))
        ? stamp
        : next.revision;
  }
  return revisions;
}
