import type { AssistantMessage, AssistantView } from "./assistant";

export type AssistantNotification = {
  id: string;
  revision: number;
  kind: "reply" | "input";
  text: string;
};

/** Public chat activity only; worker sessions and internal status never alert. */
export type AssistantNotificationActivity = {
  id: string;
  name: string;
  revision: number;
  latest?: AssistantNotification;
};

export function assistantNotificationActivity(
  assistant: Pick<AssistantView, "id" | "name" | "chatRevision"> | null,
  messages: readonly AssistantMessage[],
): AssistantNotificationActivity | null {
  if (!assistant) return null;
  let latest: AssistantNotification | undefined;
  for (const message of messages) {
    const eligible =
      (message.kind === "assistant" && !message.streaming &&
        (!!message.text.trim() || !!message.attachments?.length)) ||
      (message.kind === "input" && !message.resolved);
    if (!eligible || (latest && message.revision <= latest.revision)) continue;
    latest = {
      id: message.id,
      revision: message.revision,
      kind: message.kind === "input" ? "input" : "reply",
      text: "text" in message ? notificationPreview(message.text) : "",
    };
  }
  return { id: assistant.id, name: assistant.name, revision: assistant.chatRevision, latest };
}

function notificationPreview(text: string): string {
  const paragraph = text.split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim()).find(Boolean) ?? "";
  return paragraph.length > 240 ? `${paragraph.slice(0, 239)}…` : paragraph;
}

export type AssistantNotificationCursor = {
  id: string;
  revision: number;
  messageId?: string;
};

export class AssistantNotificationTracker {
  constructor(public cursor?: AssistantNotificationCursor) {}

  observe(activity: AssistantNotificationActivity | null): AssistantNotification | undefined {
    if (!activity) return;
    const previous = this.cursor;
    if (previous?.id === activity.id && previous.revision >= activity.revision) return;
    this.cursor = {
      id: activity.id,
      revision: activity.revision,
      messageId: activity.latest?.id ?? previous?.messageId,
    };
    // The first snapshot establishes a baseline, including any unfinished stream.
    if (previous?.id === activity.id && activity.latest &&
      activity.latest.revision > previous.revision &&
      activity.latest.id !== previous.messageId)
      return activity.latest;
  }
}

const fallback = new Map<string, AssistantNotificationCursor>();

/** Claim before dispatch, so reconnects, muted periods and other windows cannot replay. */
export function takeAssistantNotification(
  hostKey: string,
  activity: AssistantNotificationActivity | null,
): AssistantNotification | undefined {
  const key = `monocode.assistant-notification:${hostKey}`;
  let cursor = fallback.get(key);
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved && typeof saved.id === "string" && Number.isSafeInteger(saved.revision) &&
      saved.revision >= 0 && (!cursor || saved.id !== cursor.id || saved.revision > cursor.revision))
      cursor = saved;
  } catch { /* Use the runtime cursor when storage is unavailable. */ }
  const tracker = new AssistantNotificationTracker(cursor);
  const notice = tracker.observe(activity);
  if (tracker.cursor) {
    try {
      localStorage.setItem(key, JSON.stringify(tracker.cursor));
      fallback.delete(key);
    } catch { fallback.set(key, tracker.cursor); }
  }
  return notice;
}

const TARGET_PREFIX = "assistant:";
export const assistantNotificationTarget = (environmentId: string, windowLabel: string) =>
  `${TARGET_PREFIX}${JSON.stringify([environmentId, windowLabel])}`;
export function parseAssistantNotificationTarget(target: string) {
  if (!target.startsWith(TARGET_PREFIX)) return;
  try {
    const value = JSON.parse(target.slice(TARGET_PREFIX.length));
    if (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === "string"))
      return { environmentId: value[0] as string, windowLabel: value[1] as string };
  } catch { /* Ignore targets owned by other notification handlers. */ }
}
