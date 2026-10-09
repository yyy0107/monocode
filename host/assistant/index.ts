import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { HostEngine } from "../engine";
import { HostControl } from "../control";
import {
  AssistantStore,
  receiveSignature,
  signature,
  wakeupSource,
  type Wakeup,
  type WakeupSource,
} from "./store";
import { importantSources } from "./events";
import { enqueueSchedules, retryDelay } from "./scheduler";
import { checkPolicy, fields, id, object, validatePolicy } from "./policy";
import { followSession, hasAssistantPermission, isExplicitlyWatchedSession, isWatchedSession, watchIncludesSession } from "../../src/features/assistant/model/assistantSessions";
import { executeAssistantAction, ASSISTANT_ACTIONS } from "./control";
import { modelsFor } from "../../src/features/sessions/model/models";
import { RUNTIME_MODES } from "../../src/features/sessions/model/session";
import {
  isRemoteProvider,
  type HostModelCatalog,
  type HostSession,
  type RemoteProvider,
  type RemoteAttachment,
} from "../../src/features/connections/model/protocol";
import {
  ASSISTANT_PERSONA_PRESETS,
  type AssistantEventKind,
  type AssistantPermission,
  type AssistantPatch,
  type AssistantMessage,
  type AssistantReceipt,
} from "../../src/features/assistant/model/assistant";
import { parseRemoteAttachments, resolveAttachments } from "../attachments";
import { rotationReason } from "./rotation";
import { searchChat, type ChatHit } from "./chatSearch";
import { matchPlaybook } from "./playbooks";
import { DIARY_TOPIC, diaryBrief, dueDiaryDays, enqueueDiaries } from "./diary";
import {
  createHabit,
  deleteHabit,
  habitWakeupText,
  updateHabit,
} from "./habits";
import {
  addMemoryEntry,
  archiveMemoryEntries,
  fitMemoryBudget,
  memoryDate,
  memoryEntry,
  memoryLines,
  memoryWithinBudget,
  topicName,
  withLineEdited,
  withoutLine,
} from "./memory";
import {
  buildBrainPrompt,
  privateReplyPart,
  STEER_PREFIX,
  replyMessageId,
  splitReply,
} from "./prompt";

/** A fresh brief quotes the last two exchanges word for word. */
const RECALL_VERBATIM = 4;
const RECALL_LIMIT = 3;
const STOP_COMMANDS = new Set(["停止", "停", "stop", "/stop"]);
/** A message that is only a stop word ends the turn instead of starting one. */
export function isStopCommand(text: string): boolean {
  return STOP_COMMANDS.has(text.trim().toLowerCase());
}
export class HostAssistant {
  readonly store: AssistantStore;
  readonly control: HostControl;
  readonly ready: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private active?: Wakeup;
  /** Retains attribution when finalizing a turn throws after clearing active. */
  private tickingWakeupId?: string;
  /** The memory version shown to the brain in the running turn, if any. */
  private injectedMemory?: { generation: number; revision: number };
  private diaryCheckedFor?: string;
  private closing = false;
  private ticking = false;
  private epoch = 0;
  private mutations: Promise<unknown> = Promise.resolve();
  /** User inputs currently being delivered into the running turn. */
  private steering = new Set<string>();
  private available: () => Promise<RemoteProvider[]>;
  private catalog: (projectId?: string) => Promise<HostModelCatalog>;
  private catalogs = new Map<
    string,
    { until: number; value: Promise<HostModelCatalog> }
  >();
  private entry?: string;
  private senderName?: string;
  constructor(
    readonly engine: HostEngine,
    providers: RemoteProvider[],
    parentReady: Promise<void>,
    options: { entry?: string; node?: string },
  ) {
    this.entry = options.entry;
    this.store = new AssistantStore(engine.store);
    this.available = async () => providers;
    this.catalog = async () => ({
      models: Object.fromEntries(providers.map((p) => [p, modelsFor(p)])),
      errors: {},
    });
    this.control = new HostControl(
      async (brain, request, action, input, authorize) => {
        const config = this.store.get();
        if (
          !config ||
          brain !== config.brainSessionId ||
          !this.active ||
          config.lifecycle !== "running" ||
          !config.enabled ||
          !authorize()
        )
          throw new Error("Assistant control is inactive");
        return executeAssistantAction(this, request, action, input, () => {
          const current = this.store.get();
          return (
            !this.closing &&
            authorize() &&
            !!current?.enabled &&
            current.lifecycle === "running" &&
            current.brainSessionId === brain &&
            !!this.active
          );
        });
      },
      { namespace: "assistant", actions: ASSISTANT_ACTIONS },
    );
    engine.authorizeAssistantQueued = (origin, project, sessionId) => {
      const current = this.store.get();
      if (!current?.enabled || current.id !== origin.assistantId) return false;
      try {
        this.checkSessionAccess("sessions.send", project, sessionId);
        return true;
      } catch {
        return false;
      }
    };
    engine.store.onSessionSave = (previous, next, event) =>
      this.observe(previous, next, event);
    this.ready = Promise.all([parentReady, this.control.ready]).then(() => {
      this.store.recover();
      this.timer = setInterval(() => {
        void this.tick().catch((error) => this.fail(error));
      }, 1000);
      this.timer.unref?.();
    });
  }
  setCatalog(
    available: () => Promise<RemoteProvider[]>,
    catalog: (projectId?: string) => Promise<HostModelCatalog>,
  ): void {
    this.available = available;
    this.catalog = catalog;
    this.catalogs.clear();
  }
  models(projectId?: string) {
    const key = projectId ?? "";
    const cached = this.catalogs.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    const value = this.catalog(projectId).catch((error) => {
      this.catalogs.delete(key);
      throw error;
    });
    this.catalogs.set(key, { until: Date.now() + 300000, value });
    return value;
  }
  providers() {
    return this.available();
  }
  environment(brain: string): Record<string, string> {
    const value = this.store.get();
    return value?.brainSessionId === brain &&
      value.enabled &&
      value.lifecycle === "running"
      ? this.control.environment(brain)
      : {};
  }
  currentWakeup(): Wakeup {
    if (!this.active) throw new Error("Assistant turn is inactive");
    return this.active;
  }
  async rpc(method: string, raw: Record<string, unknown>): Promise<unknown> {
    await this.ready;
    if (method === "assistant.get") {
      fields(raw, []);
      return this.store.view();
    }
    if (method === "assistant.messages") {
      fields(raw, ["afterRevision", "limit"]);
      return this.store.messages(
        raw.afterRevision === undefined ? 0 : Number(raw.afterRevision),
        raw.limit === undefined ? 50 : Number(raw.limit),
      );
    }
    if (method === "assistant.memory") {
      fields(raw, []);
      if (!this.store.get()) return null;
      const doc = this.store.memoryDoc("memory");
      return {
        revision: doc.revision,
        facts: memoryLines(doc.text),
        topics: this.store.memoryTopics(),
      };
    }
    if (method === "assistant.memoryTopic") {
      fields(raw, ["topic"]);
      const name = topicName(id(raw.topic, "topic", 80));
      if (!this.store.get()) return null;
      const doc = this.store.memoryDoc(`topic:${name}`);
      return doc.text ? { name, ...doc } : null;
    }
    return this.mutate(() => this.mutateRpc(method, raw));
  }
  private mutate<T>(run: () => Promise<T>): Promise<T> {
    const next = this.mutations.then(run);
    this.mutations = next.catch(() => undefined);
    return next;
  }
  /** Only the Host's authenticated IM binding may assign this trusted source. */
  async receiveImMessage(input: {
    commandId: string;
    text: string;
    attachments?: RemoteAttachment[];
    bindingId: string;
  }): Promise<AssistantReceipt> {
    await this.ready;
    fields(input, ["commandId", "text", "attachments", "bindingId"]);
    const { bindingId, ...message } = input;
    const source: WakeupSource = { kind: "im", bindingId: id(bindingId, "IM binding") };
    return this.mutate(() => this.receiveMessage(message, source));
  }
  private async receiveMessage(
    raw: Record<string, unknown>,
    source: WakeupSource,
  ): Promise<AssistantReceipt> {
    fields(raw, ["commandId", "text", "attachments"]);
    const text =
      typeof raw.text === "string" &&
      raw.text.length <= 1000000 &&
      !raw.text.includes("\0")
        ? raw.text
        : undefined;
    const attachments = parseRemoteAttachments(raw.attachments);
    if (text === undefined || (!text.trim() && !attachments.length))
      throw new Error("Write a message");
    const previous = this.store.receipt(
      id(raw.commandId),
      receiveSignature(text, attachments, source),
    );
    if (previous) return previous as AssistantReceipt;
    const config = this.store.get();
    if (this.closing || !config?.enabled || !config.triggers.user)
      throw new Error("Assistant messaging is disabled");
    if (!attachments.length && isStopCommand(text) && this.hasWorkToStop()) {
      const receipt = this.store.receive(id(raw.commandId), text, attachments, source, {
        enqueue: false,
      });
      await this.cancelTurn();
      return receipt;
    }
    resolveAttachments(this.engine.store, attachments);
    const receipt = this.store.receive(id(raw.commandId), text, attachments, source);
    // Attachments keep the queued path; provider steering differs for files.
    if (!attachments.length && receipt.wakeupId)
      await this.steerInput(receipt.wakeupId, text);
    void this.tick().catch((error) => this.fail(error));
    return receipt;
  }
  private async mutateRpc(
    method: string,
    raw: Record<string, unknown>,
  ): Promise<unknown> {
    if (method === "assistant.configure") return this.configure(raw);
    if (method === "assistant.send")
      return this.receiveMessage(raw, { kind: "client" });
    if (method === "assistant.respond") {
      fields(raw, [
        "commandId",
        "messageId",
        "brainGeneration",
        "runId",
        "requestId",
        "decision",
        "reply",
      ]);
      const commandId = id(raw.commandId),
        sig = signature({ method, raw });
      const previous = this.store.receipt(commandId, sig);
      if (previous) return previous;
      const config = this.store.get(),
        message = this.store
          .latestMessages()
          .find((m) => m.id === raw.messageId);
      if (
        !config ||
        !message ||
        message.kind !== "input" ||
        message.resolved ||
        config.brainGeneration !== raw.brainGeneration ||
        message.brainGeneration !== raw.brainGeneration ||
        message.runId !== raw.runId ||
        message.requestId !== raw.requestId
      )
        throw new Error("This input is no longer pending");
      return this.store.host.transaction(() => {
        const result = this.engine.assistantCommand({
          type: message.inputKind === "approval" ? "approve" : "answer",
          commandId: `assistant:human:${commandId}`,
          sessionId: config.brainSessionId,
          runId: raw.runId,
          requestId: raw.requestId,
          ...(message.inputKind === "approval"
            ? { decision: raw.decision }
            : { reply: raw.reply }),
        });
        this.store.recordReceipt(commandId, sig, result);
        return result;
      });
    }
    if (method === "assistant.control") {
      if (raw.action === "delegateSession") return this.delegateSession(raw);
      fields(raw, [
        "commandId",
        "action",
        "expectedGeneration",
        "reminderId",
        "fact",
        "index",
        "expectedRevision",
        "habitId",
        "habit",
      ]);
      const commandId = id(raw.commandId),
        sig = signature({ method, raw });
      const previous = this.store.receipt(commandId, sig);
      if (previous) return previous;
      const config = this.store.get();
      if (!config) throw new Error("Assistant is not configured");
      if (
        raw.expectedGeneration !== undefined &&
        raw.expectedGeneration !== config.brainGeneration
      )
        throw new Error("Assistant generation changed");
      if (
        raw.action === "addMemory" ||
        raw.action === "editMemory" ||
        raw.action === "forgetMemory"
      )
        return this.store.host.transaction(() => {
          const date = memoryDate(new Date(), config.timezone ?? "UTC");
          const doc = this.store.memoryDoc("memory");
          if (
            raw.action !== "addMemory" &&
            raw.expectedRevision !== doc.revision
          )
            throw new Error("Memory changed elsewhere. Reload before saving.");
          const index = Number(raw.index);
          if (
            raw.action !== "addMemory" &&
            !memoryLines(doc.text).some((line) => line.index === index)
          )
            throw new Error("Memory entry not found");
          let text: string, keep: string | undefined;
          if (raw.action === "forgetMemory") text = withoutLine(doc.text, index);
          else {
            const fact = id(raw.fact, "fact", 1000);
            if (raw.action === "addMemory") {
              keep = memoryEntry(fact, date);
              text = addMemoryEntry(doc.text, keep).text;
            } else {
              text = withLineEdited(doc.text, index, fact, date);
              keep = text.split("\n")[index];
            }
          }
          const fitted = fitMemoryBudget(text, keep, date);
          if (fitted.moved.length)
            this.store.writeMemoryDoc(
              "archive",
              archiveMemoryEntries(
                this.store.memoryDoc("archive").text,
                fitted.moved,
                date,
              ),
            );
          const memoryRevision = this.store.writeMemoryDoc(
            "memory",
            fitted.text,
            doc.revision,
          );
          const receipt = {
            commandId,
            revision: this.store.get()!.revision,
            memoryRevision,
          };
          this.store.recordReceipt(commandId, sig, receipt);
          return receipt;
        });
      if (
        ["createHabit", "updateHabit", "deleteHabit", "runHabit"].includes(
          String(raw.action),
        )
      )
        return this.store.host.transaction(() => {
          const current = this.store.get()!,
            habits = current.habits ?? [],
            now = Date.now(),
            timeZone = current.timezone ?? "UTC";
          if (raw.action === "createHabit")
            this.store.update({
              habits: createHabit(habits, raw.habit, now, timeZone).habits,
            });
          else {
            const habitId = id(raw.habitId, "habit ID");
            const habit = habits.find((h) => h.id === habitId);
            if (!habit) throw new Error("Habit not found");
            if (raw.action === "updateHabit")
              this.store.update({
                habits: updateHabit(habits, habitId, raw.habit, now, timeZone),
              });
            else if (raw.action === "deleteHabit")
              this.store.update({ habits: deleteHabit(habits, habitId) });
            else {
              // An extra run now; the schedule stays as it is.
              const rootCauseId = `habit:${habitId}:run:${commandId}`;
              this.store.enqueue(
                {
                  id: randomUUID(),
                  kind: "schedule",
                  text: habitWakeupText(habit),
                  rootCauseId,
                  state: "pending",
                  createdAt: now,
                  attempts: 0,
                  habitId,
                },
                rootCauseId,
              );
            }
          }
          const receipt = { commandId, revision: this.store.get()!.revision };
          this.store.recordReceipt(commandId, sig, receipt);
          return receipt;
        });
      if (raw.action === "cancelReminder") {
        const reminderId = id(raw.reminderId, "reminder ID");
        return this.store.host.transaction(() => {
          const current = this.store.get()!;
          if (
            !current.reminders?.some(
              (r) => r.id === reminderId && r.state === "pending",
            )
          )
            throw new Error("Reminder is not pending");
          this.store.update({
            reminders: current.reminders.map((r) =>
              r.id === reminderId ? { ...r, state: "cancelled" as const } : r,
            ),
          });
          const receipt = { commandId, revision: this.store.get()!.revision };
          this.store.recordReceipt(commandId, sig, receipt);
          return receipt;
        });
      }
      if (
        !["pause", "resume", "disable", "enable", "cancelTurn"].includes(
          String(raw.action),
        )
      )
        throw new Error("Unsupported assistant control");
      if (raw.action === "cancelTurn") {
        await this.cancelTurn();
        const receipt = { commandId, revision: this.store.get()!.revision };
        this.store.recordReceipt(commandId, sig, receipt);
        void this.tick().catch((error) => this.fail(error));
        return receipt;
      }
      if (["pause", "disable"].includes(String(raw.action)))
        await this.stopBrain();
      this.store.host.transaction(() => {
        const lifecycle =
          raw.action === "disable"
            ? "disabled"
            : raw.action === "pause"
              ? "paused"
              : "idle";
        this.store.update({
          enabled: raw.action !== "disable",
          lifecycle,
          error: undefined,
          nextRetryAt: undefined,
        });
        if (raw.action === "resume" || raw.action === "enable") {
          this.store.resumeChains();
          const recovery = ["interrupted", "paused", "failed"].includes(
            config.lifecycle,
          )
            ? this.store
                .wakeups()
                .filter((w) => w.state === "interrupted")
                .at(-1)
            : undefined;
          if (recovery) {
            const next = randomUUID();
            this.store.enqueue(
              {
                ...recovery,
                source: wakeupSource(recovery),
                id: next,
                kind: "user",
                state: "pending",
                text: `Explicitly resume this interrupted task. Inspect actions.get and existing sessions before doing anything. Do not replay unknown effects.\n${recovery.text}`,
                createdAt: Date.now(),
                attempts: 0,
              },
              `recovery:${next}`,
            );
            this.store.saveWakeup({ ...recovery, state: "completed" });
            this.store.writeChain(recovery.rootCauseId, {
              count: 0,
              paused: false,
              startedAt: Date.now(),
            });
          }
        }
        const receipt = { commandId, revision: this.store.get()!.revision };
        this.store.recordReceipt(commandId, sig, receipt);
      });
      void this.tick().catch((error) => this.fail(error));
      return this.store.receipt(commandId, sig);
    }
    throw new Error("Unsupported assistant RPC");
  }
  /** Human-created conversations are read-only until explicitly followed. */
  canManageSession(projectId: string, sessionId: string): boolean {
    const config = this.store.get();
    if (!config) return false;
    let session: HostSession;
    try { session = this.engine.store.session(sessionId); } catch { return false; }
    if (session.projectId !== projectId || session.session.assistantOwnerId) return false;
    if (isWatchedSession(config.policy, config.watches, projectId, sessionId) || this.store.createdSession(sessionId)) return true;
    const leadId = session.session.orchestrationLeadId;
    return !!leadId && (this.store.createdSession(leadId) ||
      (!config.policy.excludedSessionIds?.includes(sessionId) && isWatchedSession(config.policy, config.watches, projectId, leadId)));
  }
  checkSessionAccess(permission: AssistantPermission, projectId?: string, sessionId?: string): void {
    checkPolicy(this.store.get()!.policy, permission, projectId);
    if (projectId && sessionId &&
        ((permission.startsWith("sessions.") && !["sessions.read", "sessions.create"].includes(permission)) || permission === "orchestration.control") &&
        !this.canManageSession(projectId, sessionId))
      throw new Error("Conversation is read-only until the user hands it over to the assistant");
  }
  private delegateSession(raw: Record<string, unknown>): unknown {
    fields(raw, ["action", "commandId", "environmentId", "projectId", "sessionId"]);
    const commandId = id(raw.commandId);
    const sig = signature({ method: "delegateSession", raw });
    const previous = this.store.receipt(commandId, sig);
    if (previous) return previous;
    const config = this.store.get();
    if (!config?.enabled || config.lifecycle === "paused")
      throw new Error("Enable or resume the assistant before handing over a conversation.");
    if (raw.environmentId !== this.engine.store.environmentId)
      throw new Error("Wrong Host environment");
    const projectId = id(raw.projectId), sessionId = id(raw.sessionId);
    const session = this.engine.store.session(sessionId);
    if (session.projectId !== projectId) throw new Error("Session does not belong to this project");
    if (session.session.assistantOwnerId || this.engine.store.project(projectId).kind)
      throw new Error("Assistant brain is private");
    checkPolicy(config.policy, "sessions.read", projectId);
    const grants = config.policy.followedSessions ?? [];
    if (grants.length >= 10000 && !isExplicitlyWatchedSession(config.policy, projectId, sessionId))
      throw new Error("Too many delegated conversations");
    const result = this.engine.store.transaction(() => {
      const wakeupId = randomUUID();
      this.store.update({
        policy: followSession(config.policy, projectId, sessionId),
        policyVersion: config.policyVersion + 1,
        triggers: { ...config.triggers, event: true },
      }, true);
      this.store.enqueue({
        id: wakeupId, kind: "user", source: { kind: "client" },
        text: `The user handed this conversation to you: projectId=${projectId}, sessionId=${sessionId}. It is now followed and can use the permissions enabled in your settings. Read its complete history (page through sessions.get), inspect current state and continue the user's existing goals. Handle its messages, approvals and questions within your configured permissions. Do not invent a new task if the conversation is already complete.`,
        rootCauseId: wakeupId, state: "pending", createdAt: Date.now(), attempts: 0, refs: [sessionId],
      }, `delegate:${commandId}`);
      const receipt = { commandId, revision: this.store.get()!.revision, wakeupId };
      this.store.recordReceipt(commandId, sig, receipt);
      return receipt;
    });
    void this.tick().catch((error) => this.fail(error));
    return result;
  }
  private async configure(raw: Record<string, unknown>): Promise<unknown> {
    fields(raw, ["commandId", "expectedRevision", "patch"]);
    const commandId = id(raw.commandId),
      sig = signature({ method: "configure", raw });
    const previous = this.store.receipt(commandId, sig);
    if (previous) return previous;
    const patch = object(raw.patch);
    fields(patch, [
      "name",
      "persona",
      "timezone",
      "harness",
      "model",
      "modelSettings",
      "runtimeMode",
      "targetRuntimeMode",
      "policy",
      "triggers",
      "schedules",
      "watches",
      "maxAutoTurns",
      "chainWindowMinutes",
    ]);
    const current = this.store.get();
    if ((current?.revision ?? 0) !== raw.expectedRevision)
      throw new Error("Assistant settings changed. Reload before saving.");
    if (patch.name !== undefined) id(patch.name, "name", 100);
    if (patch.persona !== undefined) {
      const persona = object(patch.persona);
      fields(persona, ["preset", "style", "userName"]);
      if (
        !ASSISTANT_PERSONA_PRESETS.includes(persona.preset as never) ||
        typeof persona.style !== "string" ||
        persona.style.length > 4000 ||
        persona.style.includes("\0") ||
        (persona.userName !== undefined &&
          (typeof persona.userName !== "string" ||
            persona.userName.length > 100 ||
            persona.userName.includes("\0")))
      )
        throw new Error("Invalid personality");
    }
    if (patch.timezone !== undefined)
      new Intl.DateTimeFormat("en", {
        timeZone: id(patch.timezone, "timezone"),
      });
    if (patch.harness !== undefined && !isRemoteProvider(patch.harness))
      throw new Error("Agent is unavailable");
    if (patch.model !== undefined) id(patch.model, "model", 200);
    const harness = patch.harness ?? current?.harness;
    const model = patch.model ?? current?.model;
    if (
      (!current || harness !== current.harness || model !== current.model) &&
      (!harness ||
        !model ||
        !(await this.providers()).includes(harness as RemoteProvider) ||
        !(await this.models()).models[harness as RemoteProvider]?.some(
          (m) => m.id === model,
        ))
    )
      throw new Error("Choose an available agent and model");
    for (const key of ["runtimeMode", "targetRuntimeMode"])
      if (
        patch[key] !== undefined &&
        !RUNTIME_MODES.includes(patch[key] as never)
      )
        throw new Error("Invalid execution permission mode");
    if (patch.modelSettings !== undefined) {
      const settings = object(patch.modelSettings);
      if (
        Object.entries(settings).some(
          ([key, value]) =>
            !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key) ||
            typeof value !== "string" ||
            value.length > 128,
        )
      )
        throw new Error("Invalid model settings");
    }
    if (patch.policy !== undefined) {
      patch.policy = validatePolicy(patch.policy);
      const scope = (patch.policy as AssistantPatch["policy"])!.allowedProjects;
      if (scope !== "all")
        for (const project of scope)
          if (this.engine.store.project(project).kind)
            throw new Error("Invalid project scope");
      const followedProjects = (patch.policy as AssistantPatch["policy"])!.followedProjects;
      if (followedProjects && followedProjects !== "all")
        for (const project of followedProjects)
          if (this.engine.store.project(project).kind) throw new Error("Invalid followed projects");
      for (const ref of (patch.policy as AssistantPatch["policy"])!.followedSessions ?? []) {
        if (current && isExplicitlyWatchedSession(current.policy, ref.projectId, ref.sessionId)) continue;
        const target = this.engine.store.session(ref.sessionId);
        if (target.projectId !== ref.projectId || target.session.assistantOwnerId || this.engine.store.project(ref.projectId).kind)
          throw new Error("Invalid conversation grant");
      }
    }
    if (patch.triggers !== undefined) {
      const triggers = object(patch.triggers);
      fields(triggers, ["user", "event", "schedule"]);
      if (
        ["user", "event", "schedule"].some(
          (k) => typeof triggers[k] !== "boolean",
        )
      )
        throw new Error("Invalid triggers");
    }
    for (const [key, max] of [
      ["maxAutoTurns", 100],
      ["chainWindowMinutes", 1440],
    ] as const)
      if (
        patch[key] !== undefined &&
        (!Number.isSafeInteger(patch[key]) ||
          Number(patch[key]) < 1 ||
          Number(patch[key]) > max)
      )
        throw new Error("Invalid automatic chain limit");
    if (patch.schedules !== undefined) {
      if (!Array.isArray(patch.schedules) || patch.schedules.length > 20)
        throw new Error("Invalid schedules");
      for (const s of patch.schedules) {
        const schedule = object(s);
        fields(schedule, [
          "id",
          "enabled",
          "intervalMinutes",
          "prompt",
          "timezone",
          "nextRunAt",
        ]);
        id(schedule.id);
        id(schedule.prompt, "scheduled prompt", 10000);
        new Intl.DateTimeFormat("en", {
          timeZone: id(schedule.timezone, "timezone"),
        });
        if (
          typeof schedule.enabled !== "boolean" ||
          !Number.isSafeInteger(schedule.intervalMinutes) ||
          Number(schedule.intervalMinutes) < 1 ||
          Number(schedule.intervalMinutes) > 10080 ||
          !Number.isSafeInteger(schedule.nextRunAt) ||
          Number(schedule.nextRunAt) < 0
        )
          throw new Error("Invalid schedule");
      }
    }
    if (patch.watches !== undefined) {
      if (!Array.isArray(patch.watches) || patch.watches.length > 50)
        throw new Error("Invalid watches");
      for (const s of patch.watches) {
        const watch = object(s);
        fields(watch, [
          "id",
          "enabled",
          "projectIds",
          "sessionIds",
          "eventKinds",
          "prompt",
        ]);
        id(watch.id);
        id(watch.prompt, "watch prompt", 10000);
        if (
          typeof watch.enabled !== "boolean" ||
          !Array.isArray(watch.projectIds) ||
          !Array.isArray(watch.sessionIds) ||
          !Array.isArray(watch.eventKinds) ||
          watch.eventKinds.some(
            (k) =>
              ![
                "completed",
                "failed",
                "approval",
                "question",
                "interrupted",
              ].includes(String(k)),
          )
        )
          throw new Error("Invalid watch");
        for (const project of watch.projectIds)
          this.engine.store.project(id(project));
        for (const session of watch.sessionIds)
          this.engine.store.session(id(session));
      }
    }
    if ((this.store.get()?.revision ?? 0) !== raw.expectedRevision)
      throw new Error("Assistant settings changed. Reload before saving.");
    if (
      current &&
      ((patch.harness !== undefined && patch.harness !== current.harness) ||
        (patch.model !== undefined && patch.model !== current.model) ||
        (patch.runtimeMode !== undefined &&
          patch.runtimeMode !== current.runtimeMode) ||
        (patch.modelSettings !== undefined &&
          signature(patch.modelSettings) !== signature(current.modelSettings)))
    ) {
      await this.stopBrain();
      const now = this.store.get()!;
      this.store.update({
        brainSessionId: undefined,
        brainBaseline: undefined,
        brainGeneration: now.brainGeneration + 1,
        lifecycle: now.enabled ? "idle" : "disabled",
      });
    }
    return this.engine.store.transaction(() => {
      if (!current) this.store.initialize(patch as AssistantPatch);
      else
        this.store.update(
          {
            ...(patch as AssistantPatch),
            policyVersion:
              this.store.get()!.policyVersion + (patch.policy ? 1 : 0),
          },
          true,
        );
      const result = { commandId, revision: this.store.get()!.revision };
      this.store.recordReceipt(commandId, sig, result);
      return result;
    });
  }
  private async brain(): Promise<string | undefined> {
    const config = this.store.get()!;
    if (config.brainSessionId) return config.brainSessionId;
    const cwd = join(
      dirname(this.engine.store.attachmentDir),
      "assistant-workspace",
      config.id,
      String(config.brainGeneration),
    );
    await mkdir(cwd, { recursive: true, mode: 0o700 });
    const current = this.store.get();
    if (
      !current?.enabled ||
      current.brainGeneration !== config.brainGeneration ||
      current.harness !== config.harness ||
      ["paused", "disabled", "interrupted", "failed"].includes(
        current.lifecycle,
      )
    )
      return undefined;
    return this.engine.store.transaction(() => {
      const project = this.engine.store.addProject(
        cwd,
        "Assistant",
        "assistant",
      );
      const receipt = this.engine.assistantCommand({
        type: "create",
        commandId: `assistant:brain:${config.id}:${config.brainGeneration}`,
        projectId: project.id,
        harness: config.harness,
        model: config.model,
        runtimeMode: config.runtimeMode,
        modelSettings: config.modelSettings,
      });
      const session = this.engine.store.session(receipt.sessionId);
      this.engine.store.save(
        {
          ...session,
          revision: session.revision + 1,
          session: {
            ...session.session,
            assistantOwnerId: config.id,
            title: "Assistant",
          },
        },
        { type: "assistant.brain" },
      );
      this.store.update({ brainSessionId: receipt.sessionId });
      return receipt.sessionId;
    });
  }
  async tick(): Promise<void> {
    if (this.closing || this.ticking) return;
    this.ticking = true;
    this.tickingWakeupId = this.active?.id;
    const epoch = this.epoch;
    try {
      let config = this.store.get();
      if (config) {
        const senderName = JSON.stringify([config.id, config.name]);
        if (this.senderName !== senderName) {
          this.engine.refreshAssistantSenderName(config.id, config.name);
          this.senderName = senderName;
        }
      }
      if (
        !config?.enabled ||
        ["paused", "disabled", "interrupted", "failed"].includes(
          config.lifecycle,
        )
      )
        return;
      if (this.active) {
        const brain = this.engine.store.session(config.brainSessionId!);
        if (brain.status === "running") return;
        const wakeup = this.active;
        this.active = undefined;
        this.control.disable(config.brainSessionId!);
        // Steered follow-ups are part of the same turn as the wakeup prompt.
        const turn = brain.session.blocks.slice(
          brain.session.blocks.findLastIndex(
            (b) => b.role === "user" && !b.text.startsWith(STEER_PREFIX),
          ) + 1,
        );
        // An explicit attachment publication is meaningful even if the final
        // model text is the quiet marker (there is nothing else to add).
        let posted = this.store.latestMessages().some((message) =>
          message.kind === "assistant" && message.wakeupId === wakeup.id &&
          (!!message.text.trim() || !!message.attachments?.length));
        if (wakeup.kind !== "user") {
          const reply = turn.findLast(
            (b) => b.role === "assistant" && b.text.trim(),
          );
          if (reply)
            splitReply(reply.text).forEach((part, index) => {
              if (privateReplyPart(part, false)) return;
              posted = true;
              this.store.message({
                id: replyMessageId(config!.brainGeneration, reply.id, index),
                kind: "assistant",
                text: part,
                streaming: false,
                wakeupId: wakeup.id,
              });
            });
        }
        this.store.update({ activity: undefined });
        let error =
          turn.findLast((b) => b.notice === "error")?.text ??
          (brain.status === "interrupted"
            ? (brain.session.blocks.at(-1)?.text ??
              "Assistant turn interrupted")
            : undefined);
        const actions = this.store
          .actions()
          .filter((a) => a.origin.wakeupId === wakeup.id);
        const hasExecution =
          actions.length ||
          turn.some((b) => b.role === "tool" || b.role === "assistant");
        if (brain.session.usageLimit && !hasExecution) {
          const retryAt = Math.max(
            Date.now() + retryDelay(wakeup.attempts),
            brain.session.usageLimit.resetsAt ?? 0,
          );
          this.store.saveWakeup({ ...wakeup, state: "backoff", retryAt });
          this.store.update({
            lifecycle: "backoff",
            nextRetryAt: retryAt,
            error: error ?? "Usage limit reached",
          });
          return;
        }
        if (brain.session.usageLimit && hasExecution)
          error ??=
            "Usage limit reached after partial execution. Continue after inspecting its actions.";
        this.store.saveWakeup({
          ...wakeup,
          state: error ? "interrupted" : "completed",
        });
        if (wakeup.habitId)
          this.store.update({
            habits: (this.store.get()!.habits ?? []).map((habit) =>
              habit.id === wakeup.habitId
                ? {
                    ...habit,
                    lastRunAt: wakeup.createdAt,
                    lastOutcome: error ? "failed" : posted ? "posted" : "quiet",
                  }
                : habit,
            ),
          });
        this.store.update({
          lifecycle: error ? "interrupted" : "idle",
          error,
          // Memory shown in a finished turn is part of the brain's context now.
          ...(!error && this.injectedMemory
            ? { brainMemory: this.injectedMemory }
            : {}),
          // The first reading of a generation is the closest to an empty brain.
          ...(config.brainBaseline == null && brain.session.context?.used
            ? { brainBaseline: brain.session.context.used }
            : {}),
        });
        if (error) {
          this.store.message({
            id: randomUUID(),
            kind: "status",
            code: "interrupted",
            text: error,
            wakeupId: wakeup.id,
          });
          return;
        }
        config = this.store.get()!;
      }
      enqueueSchedules(this.store);
      // Finished days are checked once per day, not on every tick.
      const diaryDay = dueDiaryDays(Date.now(), config.timezone ?? "UTC").at(-1);
      if (diaryDay !== this.diaryCheckedFor && enqueueDiaries(this.store))
        this.diaryCheckedFor = diaryDay;
      config = this.store.get()!;
      if (config.triggers.event)
        this.engine.store.transaction(() => {
          const sources = this.store
            .sources(config!.sourceCursor, 50)
            .filter((s) => s.createdAt <= Date.now() - 2000);
          if (!sources.length) return;
          const groups = new Map<string, typeof sources>();
          for (const source of sources) {
            if (config!.policy.excludedSessionIds?.includes(source.sessionId)) continue;
            const managed = isWatchedSession(config!.policy, config!.watches, source.projectId, source.sessionId);
            const watches = config!.watches.filter((w) =>
              w.eventKinds.includes(source.kind as AssistantEventKind) &&
              watchIncludesSession(w, source.projectId, source.sessionId, managed));
            if (!hasAssistantPermission(config!.policy, "sessions.read", source.projectId) ||
                !watches.length) continue;
            const group = groups.get(source.rootCauseId) ?? [];
            group.push(source);
            groups.set(source.rootCauseId, group);
          }
          for (const [root, group] of groups) {
            const wakeupId = randomUUID();
            const prompts = new Set(
              config!.watches
                .filter(
                  (w) =>
                    w.enabled &&
                    group.some(
                      (s) =>
                        w.eventKinds.includes(s.kind as AssistantEventKind) &&
                        watchIncludesSession(w, s.projectId, s.sessionId, isWatchedSession(config!.policy, config!.watches, s.projectId, s.sessionId)),
                    ),
                )
                .map((w) => w.prompt),
            );
            this.store.enqueue(
              {
                id: wakeupId,
                kind: "event",
                text: `${[...prompts].join("\n")}\n${group.map((s) => `${s.kind}: projectId=${s.projectId}, sessionId=${s.sessionId}`).join("\n")}\nRe-read current state before acting.`,
                rootCauseId: root,
                state: "pending",
                createdAt: group[0].createdAt,
                attempts: 0,
                refs: [...new Set(group.map((s) => s.sessionId))],
              },
              `events:${group.map((s) => s.eventKey).join(":")}`,
            );
          }
          this.store.update({ sourceCursor: sources.at(-1)!.seq });
        });
      const wakeup = this.store.pending().find((w) => !this.steering.has(w.id));
      if (!wakeup) return;
      this.tickingWakeupId = wakeup.id;
      let chain = this.store.chain(wakeup.rootCauseId);
      if (
        !chain.paused &&
        Date.now() - chain.startedAt >= config.chainWindowMinutes * 60000
      )
        chain = { count: 0, paused: false, startedAt: Date.now() };
      if (
        wakeup.kind !== "user" &&
        (chain.paused || chain.count >= config.maxAutoTurns)
      ) {
        this.store.saveWakeup({ ...wakeup, state: "failed" });
        if (!chain.paused)
          this.store.message({
            id: randomUUID(),
            kind: "status",
            code: "cycle-limit",
            text: "Automatic follow-up limit reached. Send a message to continue this task.",
            wakeupId: wakeup.id,
          });
        this.store.writeChain(wakeup.rootCauseId, { ...chain, paused: true });
        return;
      }
      if (config.brainSessionId) {
        const brain = this.engine.store.session(config.brainSessionId);
        if (
          brain.status !== "running" &&
          rotationReason(brain.session, Date.now(), config.brainBaseline)
        )
          // A fresh generation is briefed from the public chat on its first turn.
          this.store.update({
            brainSessionId: undefined,
            brainBaseline: undefined,
            brainGeneration: config.brainGeneration + 1,
          });
      }
      const brainId = await this.brain();
      if (!brainId) return;
      const fresh = !this.engine.store
        .session(brainId)
        .session.blocks.some((b) => b.role === "user");
      await this.engine.refreshAssistantBrainProcess(brainId);
      config = this.store.get()!;
      if (
        epoch !== this.epoch ||
        !config.enabled ||
        ["paused", "disabled", "interrupted", "failed"].includes(
          config.lifecycle,
        )
      )
        return;
      this.active = this.store.claim(wakeup.id, this.steering);
      this.store.writeChain(wakeup.rootCauseId, {
        ...chain,
        count: chain.count + (wakeup.kind === "user" ? 0 : 1),
      });
      this.control.enable(brainId);
      const launcher = this.entry
        ? await this.control.launcher(
            join(dirname(this.engine.store.attachmentDir), "assistant-control"),
            this.entry,
          )
        : "monocode-host";
      if (
        epoch !== this.epoch ||
        !this.active ||
        !this.store.get()?.enabled ||
        this.store.get()?.lifecycle !== "running"
      )
        return;
      if (this.engine.store.session(brainId).session.usageLimit)
        this.engine.assistantCommand({
          type: "queue",
          action: "resume",
          commandId: `assistant:retry:${wakeup.id}:${this.active.attempts}`,
          sessionId: brainId,
        });
      const ledger = this.store
        .actions()
        .filter((a) => a.rootCauseId === wakeup.rootCauseId)
        .slice(-100)
        .map((a) => ({
          requestId: a.requestId,
          action: a.action,
          state: a.state,
          ...(a.targetRef &&
          (config.policy.allowedProjects === "all" ||
            config.policy.allowedProjects.includes(a.targetRef.projectId))
            ? { targetRef: a.targetRef }
            : {}),
        }));
      const memory = this.store.memoryDoc("memory");
      const seen = config.brainMemory;
      const showMemory =
        fresh ||
        seen?.generation !== config.brainGeneration ||
        seen.revision !== memory.revision;
      this.injectedMemory = showMemory
        ? { generation: config.brainGeneration, revision: memory.revision }
        : undefined;
      const messages = this.store.latestMessages();
      const playbooks = this.store.playbooks();
      const prompt = buildBrainPrompt({
        config,
        launcher,
        actions: ASSISTANT_ACTIONS,
        // The claimed wakeup also carries queued messages merged into it.
        wakeup: this.active,
        messages,
        ledger,
        now: Date.now(),
        fresh,
        ...(fresh
          ? { diary: diaryBrief(this.store.memoryDoc(`topic:${DIARY_TOPIC}`).text) }
          : {}),
        playbooks: playbooks.map(({ body: _body, ...summary }) => summary),
        ...(this.active.kind === "user"
          ? { playbook: matchPlaybook(playbooks, this.active.text) }
          : {}),
        recall: this.recall(
          messages,
          fresh,
          this.engine.store.session(brainId).createdAt,
        ),
        ...(showMemory
          ? {
              memory: {
                ...memoryWithinBudget(memory.text),
                topics: this.store.memoryTopics(),
              },
            }
          : {}),
      });
      this.engine.assistantCommand({
        type: "send",
        commandId: `assistant:wake:${wakeup.id}:${this.active.attempts}`,
        sessionId: brainId,
        text: prompt,
        attachments: this.active.attachments,
      });
    } finally {
      this.ticking = false;
    }
  }
  /**
   * Earlier chat that matches the user's input but is outside the brain's
   * context: before this brain started, or older than a fresh brief's verbatim
   * exchanges. Requires two shared words so ordinary turns stay quiet.
   */
  private recall(
    messages: AssistantMessage[],
    fresh: boolean,
    brainCreatedAt: number | undefined,
  ): ChatHit[] {
    const wakeup = this.active;
    if (wakeup?.kind !== "user") return [];
    const chat = messages.filter(
      (m) =>
        (m.kind === "user" || m.kind === "assistant") &&
        !(m.kind === "user" && m.wakeupId === wakeup.id),
    );
    const before = fresh ? chat.at(-RECALL_VERBATIM)?.createdAt : brainCreatedAt;
    if (before === undefined) return [];
    try {
      return searchChat(messages, wakeup.text, {
        timeZone: this.store.get()?.timezone ?? "UTC",
        before,
        limit: RECALL_LIMIT,
        minWords: 2,
      });
    } catch {
      return [];
    }
  }
  private observe(
    previous: HostSession | undefined,
    next: HostSession,
    _event: unknown,
  ): void {
    const config = this.store.get();
    if (!config) return;
    if (
      next.session.assistantOwnerId === config.id &&
      next.session.id === config.brainSessionId
    ) {
      const before = new Map(previous?.session.blocks.map((b) => [b.id, b]));
      for (const block of next.session.blocks) {
        const old = before.get(block.id);
        if (
          block.role !== "assistant" ||
          this.active?.kind !== "user" ||
          !block.text ||
          (old?.streaming === block.streaming && old?.text === block.text)
        )
          continue;
        const parts = splitReply(block.text, !!block.streaming),
          oldParts = old ? splitReply(old.text, !!old.streaming) : [];
        parts.forEach((part, index) => {
          // Only the final bubble of a streaming block is still growing.
          const streaming = !!block.streaming && index === parts.length - 1,
            wasStreaming = !!old?.streaming && index === oldParts.length - 1;
          // Hold possible quiet-marker prefixes until they become public text.
          if (
            privateReplyPart(part, streaming) ||
            (oldParts[index] === part && wasStreaming === streaming)
          )
            return;
          this.store.message({
            id: replyMessageId(config.brainGeneration, block.id, index),
            kind: "assistant",
            text: part,
            streaming,
            wakeupId: this.active!.id,
          });
        });
      }
      const inputs = this.store
        .latestMessages()
        .filter(
          (m): m is Extract<AssistantMessage, { kind: "input" }> =>
            m.kind === "input" && !m.resolved,
        );
      for (const input of inputs)
        if (
          input.runId !== next.runId ||
          (input.inputKind === "approval"
            ? !next.session.blocks.some(
                (b) =>
                  b.approval?.requestId === input.requestId &&
                  !b.approval.decided,
              )
            : next.session.pendingQuestion?.requestId !== input.requestId)
        )
          this.store.message({ ...input, resolved: true });
      for (const block of next.session.blocks)
        if (
          block.approval &&
          !block.approval.decided &&
          !inputs.some(
            (m) =>
              m.runId === next.runId &&
              m.requestId === block.approval!.requestId &&
              m.inputKind === "approval",
          )
        )
          this.store.message({
            id: `input:${next.runId}:approval:${block.approval.requestId}`,
            kind: "input",
            wakeupId: this.active?.id,
            text: block.text,
            brainGeneration: config.brainGeneration,
            runId: next.runId!,
            requestId: block.approval.requestId,
            inputKind: "approval",
            resolved: false,
          });
      const question = next.session.pendingQuestion;
      if (
        question &&
        !inputs.some(
          (m) =>
            m.runId === next.runId &&
            m.requestId === question.requestId &&
            m.inputKind === "question",
        )
      )
        this.store.message({
          id: `input:${next.runId}:question:${question.requestId}`,
          kind: "input",
          wakeupId: this.active?.id,
          text: question.title ?? "Assistant needs your input",
          brainGeneration: config.brainGeneration,
          runId: next.runId!,
          requestId: question.requestId,
          inputKind: "question",
          question,
          resolved: false,
        });
      return;
    }
    if (config.enabled && config.triggers.event)
      for (const source of importantSources(previous, next)) {
        let origin = [...next.session.blocks]
          .reverse()
          .find((b) => b.role === "user")?.origin;
        if (!origin && next.session.orchestrationLeadId) {
          try {
            origin = [
              ...this.engine.store.session(next.session.orchestrationLeadId)
                .session.blocks,
            ]
              .reverse()
              .find((b) => b.role === "user")?.origin;
          } catch {
            /* Lead was removed. */
          }
        }
        const root = origin
          ? this.store.wakeup(origin.wakeupId)?.rootCauseId
          : undefined;
        this.store.source({
          ...source,
          rootCauseId: root ?? source.rootCauseId,
        });
      }
    if (
      previous?.status !== next.status ||
      previous?.lastCompletedRunId !== next.lastCompletedRunId ||
      previous?.session.queuedMessages !== next.session.queuedMessages
    )
      this.refreshCards(next);
  }
  refreshCards(value?: HostSession): void {
    for (const message of this.store.latestMessages())
      if (
        message.kind === "session-card" &&
        (!value || message.ref.sessionId === value.session.id)
      ) {
        let target: HostSession | undefined;
        try {
          target = value ?? this.engine.store.session(message.ref.sessionId);
        } catch {
          /* Deleted target. */
        }
        const queued = target?.session.queuedMessages?.some(
          (q) => !q.blocked && q.origin?.actionId === message.actionId,
        );
        const blocked =
          target?.session.queuedMessages?.some(
            (q) => q.blocked && q.origin?.actionId === message.actionId,
          ) ||
          target?.session.blocks.some(
            (b) => b.id === `blocked:assistant:${message.actionId}`,
          );
        const status = !target
          ? "unavailable"
          : blocked
            ? "failed"
            : queued
              ? "queued"
              : target.status === "running"
                ? "running"
                : target.status === "interrupted"
                  ? "failed"
                  : target.lastCompletedRunId
                    ? "completed"
                    : "accepted";
        if (status !== message.status)
          this.store.message({ ...message, status });
      }
  }
  /** Delivers a user message into the running user turn, as a person would read it immediately. */
  private async steerInput(wakeupId: string, text: string): Promise<void> {
    const config = this.store.get(),
      active = this.active,
      incoming = this.store.wakeup(wakeupId);
    if (
      !config?.brainSessionId ||
      active?.kind !== "user" ||
      config.lifecycle !== "running" ||
      incoming?.state !== "pending" ||
      signature(wakeupSource(active)) !== signature(wakeupSource(incoming))
    )
      return;
    this.steering.add(wakeupId);
    try {
      if (
        !(await this.engine.assistantBrainSteer(
          config.brainSessionId,
          `${STEER_PREFIX}\n${text}`,
        )) ||
        this.active !== active
      )
        return;
      this.store.host.transaction(() => {
        const current = this.store.wakeup(wakeupId);
        if (current?.state !== "pending") return;
        this.store.saveWakeup({
          ...current,
          state: "completed",
          mergedInto: active.id,
        });
        const message = this.store
          .latestMessages()
          .find((m) => m.kind === "user" && m.wakeupId === wakeupId);
        if (message?.kind === "user" && message.readAt == null)
          this.store.message({ ...message, readAt: Date.now() });
      });
    } catch {
      /* The input stays queued for the next turn. */
    } finally {
      this.steering.delete(wakeupId);
    }
  }
  private hasWorkToStop(): boolean {
    return (
      this.store.get()?.lifecycle === "running" ||
      this.store.pending().some((w) => w.kind === "user")
    );
  }
  /** Stops the current turn and drops queued input; the assistant stays available. */
  private async cancelTurn(): Promise<void> {
    const stopped = this.active;
    await this.stopBrain();
    this.store.host.transaction(() => {
      // The user ended this turn on purpose, so a later resume must not replay it.
      const current = stopped && this.store.wakeup(stopped.id);
      if (current?.state === "interrupted")
        this.store.saveWakeup({ ...current, state: "completed" });
      this.store.discardPendingUserInput();
      this.store.finishStreaming();
      this.store.update({
        lifecycle: "idle",
        error: undefined,
        nextRetryAt: undefined,
      });
      this.store.message({
        id: randomUUID(),
        kind: "status",
        code: "stopped",
        text: "Stopped",
      });
    });
  }
  private async stopBrain(): Promise<void> {
    this.epoch++;
    const config = this.store.get();
    if (!config) return;
    this.store.update({ lifecycle: "paused", activity: undefined });
    if (config.brainSessionId) {
      this.control.disable(config.brainSessionId);
      const brain = this.engine.store.session(config.brainSessionId);
      if (brain.status === "running")
        await this.engine.stopAssistantBrain(brain.session.id);
    }
    if (this.active)
      this.store.saveWakeup({ ...this.active, state: "interrupted" });
    this.active = undefined;
    for (const message of this.store.latestMessages())
      if (message.kind === "input" && !message.resolved)
        this.store.message({ ...message, resolved: true });
  }
  private fail(error: unknown): void {
    const wakeupId = this.active?.id ?? this.tickingWakeupId;
    this.active = undefined;
    const config = this.store.get();
    if (config?.brainSessionId) this.control.disable(config.brainSessionId);
    try {
      if (config) {
        this.store.finishStreaming();
        this.store.update({
          lifecycle: "failed",
          activity: undefined,
          error: error instanceof Error ? error.message : "Assistant failed",
        });
        this.store.message({
          id: randomUUID(),
          kind: "status",
          code: "failed",
          text: error instanceof Error ? error.message : "Assistant failed",
          ...(wakeupId ? { wakeupId } : {}),
        });
      }
    } catch {
      /* Persisting failed: retain journal for recovery. */
    }
  }
  async close(): Promise<void> {
    this.closing = true;
    clearInterval(this.timer);
    await this.control.close();
    this.engine.store.onSessionSave = undefined;
  }
}
