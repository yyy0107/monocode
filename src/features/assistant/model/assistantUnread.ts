import type { AssistantMessage } from "./assistant";

const PREFIX = "monocode.assistant-read:";
const CHANGE = "monocode:assistant-read";
const fallback = new Map<string, number>();

export function assistantReadRevision(hostKey: string): number {
  try {
    const value = Number(localStorage.getItem(PREFIX + hostKey));
    return Math.max(
      Number.isFinite(value) ? value : 0,
      fallback.get(hostKey) ?? 0,
    );
  } catch {
    return fallback.get(hostKey) ?? 0;
  }
}

export function markAssistantRead(
  hostKey: string,
  messages: AssistantMessage[],
) {
  const revision = messages.reduce(
    (max, message) => Math.max(max, message.revision),
    0,
  );
  if (revision <= assistantReadRevision(hostKey)) return;
  try {
    localStorage.setItem(PREFIX + hostKey, String(revision));
  } catch {
    // Keep read state usable when storage is unavailable.
    fallback.set(hostKey, revision);
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function subscribeAssistantRead(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener(CHANGE, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("storage", storage);
  };
}

export function unreadAssistantMessages(
  hostKey: string,
  messages: AssistantMessage[],
) {
  const readRevision = assistantReadRevision(hostKey);
  return messages.filter(
    (message) =>
      message.revision > readRevision &&
      ((message.kind === "assistant" && !!message.text.trim()) ||
        (message.kind === "input" && !message.resolved)),
  );
}
