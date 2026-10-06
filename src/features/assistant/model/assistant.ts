import type { RuntimeMode, TurnOrigin } from "../../sessions/model/session";
import type {
  RemoteProvider,
  RemoteAttachment,
} from "../../connections/model/protocol";
import type { UserQuestionPrompt } from "../../sessions/model/userQuestion";

export const ASSISTANT_PERMISSIONS = [
  "catalog.read",
  "projects.read",
  "projects.open",
  "sessions.read",
  "sessions.create",
  "sessions.send",
  "sessions.configure",
  "sessions.cancel",
  "sessions.approve",
  "sessions.answer",
  "sessions.queue",
  "sessions.metadata",
  "sessions.delete",
  "orchestration.control",
  "files.read",
  "files.write",
  "git.read",
  "git.write",
  "git.publish",
] as const;
export type AssistantPermission = (typeof ASSISTANT_PERMISSIONS)[number];
export type AssistantPolicy = {
  permissions: Record<AssistantPermission, boolean>;
  allowedProjects: "all" | string[];
};
export const fullAssistantPolicy = (): AssistantPolicy => ({
  permissions: Object.fromEntries(
    ASSISTANT_PERMISSIONS.map((key) => [key, true]),
  ) as AssistantPolicy["permissions"],
  allowedProjects: "all",
});
export type AssistantLifecycle =
  | "idle"
  | "running"
  | "paused"
  | "backoff"
  | "interrupted"
  | "failed"
  | "disabled";
export type AssistantEventKind =
  "completed" | "failed" | "approval" | "question" | "interrupted";
export type SessionReference = {
  environmentId: string;
  projectId: string;
  sessionId: string;
};
export type AssistantSchedule = {
  id: string;
  enabled: boolean;
  intervalMinutes: number;
  prompt: string;
  timezone: string;
  nextRunAt: number;
};
export type AssistantWatch = {
  id: string;
  enabled: boolean;
  projectIds: string[];
  sessionIds: string[];
  eventKinds: AssistantEventKind[];
  prompt: string;
};
export const ASSISTANT_PERSONA_PRESETS = [
  "secretary",
  "partner",
  "engineer",
  "custom",
] as const;
export type AssistantPersonaPreset = (typeof ASSISTANT_PERSONA_PRESETS)[number];
export type AssistantPersona = {
  preset: AssistantPersonaPreset;
  /** Extra free-form personality and tone guidance written by the user. */
  style: string;
  /** How the assistant addresses the user. */
  userName?: string;
};
export const defaultAssistantPersona = (): AssistantPersona => ({
  preset: "secretary",
  style: "",
});
/** A one-shot follow-up the assistant promised during a conversation. */
export type AssistantReminder = {
  id: string;
  dueAt: number;
  prompt: string;
  createdAt: number;
  createdBy: string;
  rootCauseId: string;
  state: "pending" | "fired" | "cancelled";
};
/** The platform action the assistant is performing in the current turn. */
export type AssistantActivity = {
  action: string;
  projectName?: string;
  sessionTitle?: string;
  at: number;
};
export type AssistantView = {
  id: string;
  name: string;
  persona?: AssistantPersona;
  /** IANA time zone used for the assistant's sense of local time. */
  timezone?: string;
  reminders?: AssistantReminder[];
  activity?: AssistantActivity;
  revision: number;
  chatRevision: number;
  enabled: boolean;
  lifecycle: AssistantLifecycle;
  harness: RemoteProvider;
  model: string;
  modelSettings: Record<string, string>;
  runtimeMode: RuntimeMode;
  targetRuntimeMode: RuntimeMode;
  policy: AssistantPolicy;
  policyVersion: number;
  triggers: { user: boolean; event: boolean; schedule: boolean };
  schedules: AssistantSchedule[];
  watches: AssistantWatch[];
  maxAutoTurns: number;
  chainWindowMinutes: number;
  brainGeneration: number;
  nextRetryAt?: number;
  error?: string;
  backlog?: boolean;
  /** Resident memory version; absent on Hosts without assistant memory. */
  memory?: { revision: number; lines: number };
};
/** Resident memory as `assistant.memory` returns it. */
export type AssistantMemory = {
  revision: number;
  facts: AssistantMemoryFact[];
  /** Topic notes the assistant keeps; read on demand by the assistant. */
  topics: string[];
};
export type AssistantMemoryFact = {
  /** Line index in the memory document, for editing or forgetting it. */
  index: number;
  text: string;
  date?: string;
  until?: string;
  /** Superseded by a newer entry; kept for the record. */
  struck: boolean;
};
export type AssistantPatch = Partial<
  Pick<
    AssistantView,
    | "name"
    | "persona"
    | "timezone"
    | "harness"
    | "model"
    | "modelSettings"
    | "runtimeMode"
    | "targetRuntimeMode"
    | "policy"
    | "triggers"
    | "schedules"
    | "watches"
    | "maxAutoTurns"
    | "chainWindowMinutes"
  >
>;
type MessageBase = { id: string; revision: number; createdAt: number };
export type AssistantMessage = MessageBase &
  (
    | {
        kind: "user" | "assistant";
        text: string;
        streaming?: boolean;
        /** Host began processing this user input; null means still pending. */
        readAt?: number | null;
        wakeupId?: string;
        attachments?: RemoteAttachment[];
      }
    | {
        kind: "session-card";
        ref: SessionReference;
        title: string;
        projectName: string;
        harness: RemoteProvider;
        model: string;
        actionId: string;
        status:
          | "accepted"
          | "queued"
          | "running"
          | "completed"
          | "failed"
          | "unknown"
          | "unavailable";
        error?: string;
      }
    | { kind: "status"; text: string; code?: string }
    | {
        kind: "input";
        text: string;
        brainGeneration: number;
        runId: string;
        requestId: number;
        inputKind: "approval" | "question";
        question?: UserQuestionPrompt;
        resolved: boolean;
      }
  );
export type AssistantMessages = {
  revision: number;
  entries: AssistantMessage[];
  hasMore: boolean;
  nextRevision: number;
};
export type AssistantReceipt = {
  commandId: string;
  revision: number;
  messageId?: string;
  wakeupId?: string;
};
export type AssistantAction = {
  id: string;
  requestId: string;
  signature: string;
  action: string;
  input: Record<string, unknown>;
  origin: TurnOrigin;
  rootCauseId: string;
  state: "executing" | "accepted" | "completed" | "failed" | "unknown";
  result?: unknown;
  error?: string;
  targetRef?: SessionReference;
};
