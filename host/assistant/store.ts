import { createHash, randomUUID } from "node:crypto";
import type { HostStore } from "../store";
import {
  defaultAssistantPersona,
  fullAssistantPolicy,
  type AssistantAction,
  type AssistantMessage,
  type AssistantMessages,
  type AssistantPatch,
  type AssistantReceipt,
  type AssistantView,
} from "../../src/features/assistant/model/assistant";
import { memoryLines } from "./memory";
import type { RemoteAttachment } from "../../src/features/connections/model/protocol";

export function signature(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export type AssistantRecord = AssistantView & {
  brainSessionId?: string;
  /** Context a fresh brain of this generation used on its first turn. */
  brainBaseline?: number;
  /** The memory version the brain of this generation last saw in a finished turn. */
  brainMemory?: { generation: number; revision: number };
  sourceCursor: number;
};
export type Wakeup = {
  id: string;
  kind: "user" | "event" | "schedule";
  text: string;
  rootCauseId: string;
  state:
    "pending" | "running" | "completed" | "interrupted" | "failed" | "backoff";
  createdAt: number;
  retryAt?: number;
  attempts: number;
  refs?: string[];
  attachments?: RemoteAttachment[];
  /** The habit this run belongs to, for recording its outcome. */
  habitId?: string;
  /** A user input delivered into this running wakeup by steering. */
  mergedInto?: string;
};
export type Source = {
  eventKey: string;
  sessionId: string;
  projectId: string;
  kind: string;
  rootCauseId: string;
  createdAt: number;
};
type NewMessage = AssistantMessage extends infer M
  ? M extends AssistantMessage
    ? Omit<M, "revision" | "createdAt"> & { createdAt?: number }
    : never
  : never;
export class AssistantStore {
  constructor(readonly host: HostStore) {
    host.db
      .exec(`CREATE TABLE IF NOT EXISTS assistants (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_messages (revision INTEGER PRIMARY KEY, id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assistant_messages_id ON assistant_messages(id, revision);
      CREATE TABLE IF NOT EXISTS assistant_wakeups (id TEXT PRIMARY KEY, dedupe TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_receipts (id TEXT PRIMARY KEY, signature TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_actions (request_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_sources (seq INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_chains (root TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistant_memory (name TEXT PRIMARY KEY, revision INTEGER NOT NULL, text TEXT NOT NULL);`);
  }
  /**
   * A memory document: `memory` (resident), `archive`, or `topic:<name>`.
   * Missing documents read as empty at revision 0.
   */
  memoryDoc(name: string): { text: string; revision: number } {
    const row = this.host.db
      .prepare("SELECT revision, text FROM assistant_memory WHERE name=?")
      .get(name);
    return row
      ? { text: String(row.text), revision: Number(row.revision) }
      : { text: "", revision: 0 };
  }
  /** Writes a memory document unless another writer changed it since `expected`. */
  writeMemoryDoc(name: string, text: string, expected?: number): number {
    return this.host.transaction(() => {
      const current = this.memoryDoc(name).revision;
      if (expected !== undefined && expected !== current)
        throw new Error("Memory changed elsewhere. Reload before saving.");
      this.host.db
        .prepare(
          "INSERT INTO assistant_memory VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET revision=excluded.revision, text=excluded.text",
        )
        .run(name, current + 1, text);
      return current + 1;
    });
  }
  memoryTopics(): string[] {
    return this.host.db
      .prepare(
        "SELECT name FROM assistant_memory WHERE name LIKE 'topic:%' AND text<>'' ORDER BY name",
      )
      .all()
      .map((row) => String(row.name).slice("topic:".length));
  }
  get(): AssistantRecord | null {
    const row = this.host.db
      .prepare("SELECT payload FROM assistants WHERE singleton=1")
      .get();
    if (!row) return null;
    const value: AssistantRecord = JSON.parse(String(row.payload));
    // Records written before persona and reminders existed stay readable.
    return {
      ...value,
      persona: value.persona ?? defaultAssistantPersona(),
      // The schedule zone was chosen from the user's device before this field existed.
      timezone: value.timezone ?? value.schedules?.[0]?.timezone ?? "UTC",
      reminders: value.reminders ?? [],
      habits: value.habits ?? [],
    };
  }
  view(): AssistantView | null {
    const value = this.get();
    if (!value) return null;
    const {
      brainSessionId: _brain,
      brainBaseline: _baseline,
      brainMemory: _memory,
      sourceCursor: _cursor,
      ...publicValue
    } = value;
    const sources = this.host.db
      .prepare("SELECT COUNT(*) AS count FROM assistant_sources WHERE seq>?")
      .get(value.sourceCursor)!;
    const inputs = this.host.db
      .prepare(
        "SELECT COUNT(*) AS count FROM assistant_wakeups WHERE json_extract(payload, '$.state') IN ('pending', 'backoff')",
      )
      .get()!;
    const memory = this.memoryDoc("memory");
    return {
      ...publicValue,
      backlog: Number(sources.count) > 100 || Number(inputs.count) > 100,
      memory: {
        revision: memory.revision,
        lines: memoryLines(memory.text).filter((line) => !line.struck).length,
      },
    };
  }
  initialize(patch: AssistantPatch): AssistantRecord {
    if (this.get()) throw new Error("Assistant is already configured");
    if (!patch.harness || !patch.model)
      throw new Error("Choose an agent and model");
    const value: AssistantRecord = {
      id: randomUUID(),
      name: "Assistant",
      persona: defaultAssistantPersona(),
      timezone: patch.timezone ?? patch.schedules?.[0]?.timezone ?? "UTC",
      reminders: [],
      habits: [],
      revision: 1,
      chatRevision: 0,
      enabled: true,
      lifecycle: "idle",
      harness: patch.harness,
      model: patch.model,
      modelSettings: {},
      runtimeMode: "full-access",
      targetRuntimeMode: "full-access",
      policy: fullAssistantPolicy(),
      policyVersion: 1,
      triggers: { user: true, event: true, schedule: true },
      brainGeneration: 1,
      sourceCursor: 0,
      maxAutoTurns: 8,
      chainWindowMinutes: 15,
      schedules: [
        {
          id: "hourly",
          enabled: true,
          intervalMinutes: 60,
          prompt:
            "Check unfinished tasks. Report only meaningful progress or something needing attention.",
          timezone: "UTC",
          nextRunAt: Date.now() + 3600000,
        },
      ],
      watches: [
        {
          id: "activity",
          enabled: true,
          projectIds: [],
          sessionIds: [],
          eventKinds: [
            "completed",
            "failed",
            "approval",
            "question",
            "interrupted",
          ],
          prompt:
            "Follow up on this activity according to the user's goals. Stay quiet when nothing actionable changed.",
        },
      ],
      ...patch,
    };
    this.write(value);
    return value;
  }
  write(value: AssistantRecord): void {
    this.host.db
      .prepare(
        "INSERT INTO assistants VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload",
      )
      .run(JSON.stringify(value));
  }
  update(
    patch: Partial<AssistantRecord>,
    configuration = false,
  ): AssistantRecord {
    const old = this.get();
    if (!old) throw new Error("Assistant is not configured");
    const next = {
      ...old,
      ...patch,
      revision: old.revision + (configuration ? 1 : 0),
    };
    this.write(next);
    return next;
  }
  message(input: NewMessage): AssistantMessage {
    return this.host.transaction(() => this.saveMessage(input));
  }
  private saveMessage(input: NewMessage): AssistantMessage {
    const config = this.get();
    if (!config) throw new Error("Assistant is not configured");
    const row = this.host.db
      .prepare(
        "SELECT payload FROM assistant_messages WHERE id=? ORDER BY revision DESC LIMIT 1",
      )
      .get(input.id);
    const previous: AssistantMessage | undefined = row
      ? JSON.parse(String(row.payload))
      : undefined;
    const message = {
      ...input,
      revision: config.chatRevision + 1,
      createdAt: previous?.createdAt ?? input.createdAt ?? Date.now(),
    } as AssistantMessage;
    // A newer full snapshot supersedes a partial one. Keep monotonic cursors
    // without retaining a copy of the growing reply for every stream update.
    if (previous?.kind === "assistant" && previous.streaming)
      this.host.db
        .prepare("DELETE FROM assistant_messages WHERE revision=?")
        .run(previous.revision);
    this.host.db
      .prepare("INSERT INTO assistant_messages VALUES (?, ?, ?)")
      .run(message.revision, message.id, JSON.stringify(message));
    this.write({ ...config, chatRevision: message.revision });
    return message;
  }
  messages(after = 0, limit = 50): AssistantMessages {
    if (
      !Number.isSafeInteger(after) ||
      after < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new Error("Invalid message cursor or limit");
    const rows = this.host.db
      .prepare(
        "SELECT payload FROM assistant_messages WHERE revision>? ORDER BY revision LIMIT ?",
      )
      .all(after, limit + 1);
    const entries: AssistantMessage[] = rows
      .slice(0, limit)
      .map((row) => JSON.parse(String(row.payload)));
    return {
      revision: this.get()?.chatRevision ?? 0,
      entries,
      hasMore: rows.length > limit,
      nextRevision: entries.at(-1)?.revision ?? after,
    };
  }
  latestMessages(): AssistantMessage[] {
    return this.host.db
      .prepare(
        "SELECT payload FROM assistant_messages WHERE revision IN (SELECT MAX(revision) FROM assistant_messages GROUP BY id) ORDER BY revision",
      )
      .all()
      .map((row) => JSON.parse(String(row.payload)));
  }
  receipt(id: string, sig: string): unknown | undefined {
    const row = this.host.db
      .prepare("SELECT * FROM assistant_receipts WHERE id=?")
      .get(id);
    if (!row) return undefined;
    if (row.signature !== sig)
      throw new Error("Command ID was already used with different input");
    return JSON.parse(String(row.payload));
  }
  recordReceipt(id: string, sig: string, result: unknown): void {
    this.host.db
      .prepare("INSERT INTO assistant_receipts VALUES (?, ?, ?)")
      .run(id, sig, JSON.stringify(result));
  }
  receive(
    commandId: string,
    text: string,
    attachments: RemoteAttachment[],
  ): AssistantReceipt {
    return this.host.transaction(() => {
      const sig = signature({ text, attachments }),
        existing = this.receipt(commandId, sig);
      if (existing) return existing as AssistantReceipt;
      const id = randomUUID(),
        wakeupId = randomUUID();
      this.message({
        id,
        kind: "user",
        text,
        attachments,
        wakeupId,
        readAt: null,
      });
      this.enqueue(
        {
          id: wakeupId,
          kind: "user",
          text,
          rootCauseId: wakeupId,
          state: "pending",
          createdAt: Date.now(),
          attempts: 0,
          attachments,
        },
        `user:${commandId}`,
      );
      this.resumeChains();
      const result = {
        commandId,
        messageId: id,
        wakeupId,
        revision: this.get()!.chatRevision,
      };
      this.recordReceipt(commandId, sig, result);
      return result;
    });
  }
  enqueue(value: Wakeup, dedupe: string): void {
    this.host.db
      .prepare("INSERT OR IGNORE INTO assistant_wakeups VALUES (?, ?, ?)")
      .run(value.id, dedupe, JSON.stringify(value));
  }
  wakeups(): Wakeup[] {
    return this.host.db
      .prepare("SELECT payload FROM assistant_wakeups")
      .all()
      .map((r) => JSON.parse(String(r.payload)));
  }
  wakeup(id: string): Wakeup | undefined {
    const row = this.host.db
      .prepare("SELECT payload FROM assistant_wakeups WHERE id=?")
      .get(id);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  pending(): Wakeup[] {
    return this.host.db
      .prepare(
        `SELECT payload FROM assistant_wakeups WHERE json_extract(payload,'$.state')='pending' OR (json_extract(payload,'$.state')='backoff' AND json_extract(payload,'$.retryAt')<=?) ORDER BY CASE json_extract(payload,'$.kind') WHEN 'user' THEN 0 WHEN 'event' THEN 1 ELSE 2 END, json_extract(payload,'$.createdAt') LIMIT 100`,
      )
      .all(Date.now())
      .map((r) => JSON.parse(String(r.payload)));
  }
  saveWakeup(w: Wakeup): void {
    this.host.db
      .prepare("UPDATE assistant_wakeups SET payload=? WHERE id=?")
      .run(JSON.stringify(w), w.id);
  }
  claim(id: string): Wakeup {
    return this.host.transaction(() => this.claimPending(id));
  }
  private claimPending(id: string): Wakeup {
    const wakeup = this.pending().find((w) => w.id === id);
    if (!wakeup) throw new Error("Wakeup is not pending");
    const next: Wakeup = {
      ...wakeup,
      state: "running",
      attempts: wakeup.attempts + 1,
    };
    this.saveWakeup(next);
    if (wakeup.kind === "user") {
      const message = this.latestMessages().find(
        (entry) => entry.kind === "user" && entry.wakeupId === id,
      );
      if (message?.kind === "user" && message.readAt == null)
        this.message({ ...message, readAt: Date.now() });
    }
    this.update({
      lifecycle: "running",
      nextRetryAt: undefined,
      error: undefined,
    });
    return next;
  }
  action(requestId: string): AssistantAction | undefined {
    const row = this.host.db
      .prepare("SELECT payload FROM assistant_actions WHERE request_id=?")
      .get(requestId);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  actions(): AssistantAction[] {
    return this.host.db
      .prepare("SELECT payload FROM assistant_actions")
      .all()
      .map((r) => JSON.parse(String(r.payload)));
  }
  putAction(action: AssistantAction): void {
    this.host.db
      .prepare(
        "INSERT INTO assistant_actions VALUES (?, ?) ON CONFLICT(request_id) DO UPDATE SET payload=excluded.payload",
      )
      .run(action.requestId, JSON.stringify(action));
  }
  source(value: Source): void {
    this.host.db
      .prepare(
        "INSERT OR IGNORE INTO assistant_sources(event_key,payload) VALUES (?,?)",
      )
      .run(value.eventKey, JSON.stringify(value));
  }
  sources(after: number, limit = 50): (Source & { seq: number })[] {
    return this.host.db
      .prepare(
        "SELECT seq,payload FROM assistant_sources WHERE seq>? ORDER BY seq LIMIT ?",
      )
      .all(after, limit)
      .map((r) => ({ ...JSON.parse(String(r.payload)), seq: Number(r.seq) }));
  }
  chain(root: string): { count: number; paused: boolean; startedAt: number } {
    const row = this.host.db
      .prepare("SELECT payload FROM assistant_chains WHERE root=?")
      .get(root);
    return row
      ? JSON.parse(String(row.payload))
      : { count: 0, paused: false, startedAt: Date.now() };
  }
  writeChain(root: string, value: ReturnType<AssistantStore["chain"]>): void {
    this.host.db
      .prepare(
        "INSERT INTO assistant_chains VALUES (?,?) ON CONFLICT(root) DO UPDATE SET payload=excluded.payload",
      )
      .run(root, JSON.stringify(value));
  }
  resumeChains(): void {
    for (const row of this.host.db
      .prepare(
        "SELECT root,payload FROM assistant_chains WHERE json_extract(payload,'$.paused')=1",
      )
      .all())
      this.writeChain(String(row.root), {
        ...JSON.parse(String(row.payload)),
        count: 0,
        paused: false,
        startedAt: Date.now(),
      });
  }
  finishStreaming(): void {
    this.host.transaction(() => {
      for (const message of this.latestMessages())
        if (message.kind === "assistant" && message.streaming)
          this.message({ ...message, streaming: false });
    });
  }
  recover(): void {
    this.host.transaction(() => {
      this.finishStreaming();
      let interrupted = false;
      for (const wakeup of this.wakeups())
        if (wakeup.state === "running") {
          this.saveWakeup({ ...wakeup, state: "interrupted" });
          interrupted = true;
        }
      for (const action of this.actions())
        if (action.state === "executing") {
          const row = this.host.db
            .prepare("SELECT receipt FROM receipts WHERE id=?")
            .get(`assistant:${action.id}`);
          const receipt = row
            ? (JSON.parse(String(row.receipt)) as {
                commandId: string;
                sessionId: string;
                revision: number;
              })
            : undefined;
          if (
            receipt &&
            [
              "sessions.create",
              "sessions.send",
              "sessions.configure",
              "sessions.compact",
              "sessions.cancel",
              "sessions.approve",
              "sessions.answer",
              "sessions.queue",
              "orchestration.command",
            ].includes(action.action)
          ) {
            let target;
            try {
              target = this.host.session(receipt.sessionId);
            } catch {
              /* Target may have been deleted. */
            }
            const ref = target
              ? {
                  environmentId: this.host.environmentId,
                  projectId: target.projectId,
                  sessionId: target.session.id,
                }
              : action.targetRef;
            this.putAction({
              ...action,
              state: "accepted",
              result: receipt,
              targetRef: ref,
            });
            if (
              target &&
              ref &&
              ["sessions.create", "sessions.send"].includes(action.action) &&
              !this.latestMessages().some((m) => m.id === `card:${action.id}`)
            )
              this.message({
                id: `card:${action.id}`,
                kind: "session-card",
                actionId: action.id,
                ref,
                title: target.session.title,
                projectName: this.host.project(target.projectId).name,
                harness: target.session.harness as never,
                model: target.session.model,
                status: target.status === "interrupted" ? "failed" : "accepted",
              });
          } else
            this.putAction({
              ...action,
              state: "unknown",
              error:
                "Host restarted before the operation result was recorded. Inspect its effects before continuing.",
            });
        }
      if (this.get() && (interrupted || this.get()!.lifecycle === "running"))
        this.update({
          lifecycle: "interrupted",
          error:
            "Host restarted during an assistant turn. Continue after inspecting its actions.",
        });
    });
  }
}
