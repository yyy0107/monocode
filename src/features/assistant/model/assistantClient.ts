import type {
  AssistantMessage,
  AssistantMessages,
  AssistantView,
} from "./assistant";
import type { RemoteAttachment } from "../../connections/model/protocol";
export type AssistantRpc = <T>(method: string, params?: object) => Promise<T>;
export function mergeAssistantMessages(
  previous: AssistantMessage[],
  incoming: AssistantMessage[],
): AssistantMessage[] {
  if (!incoming.length) return previous;
  const entries = new Map(previous.map((m) => [m.id, m]));
  let changed = false;
  for (const message of incoming)
    if ((entries.get(message.id)?.revision ?? -1) < message.revision) {
      entries.set(message.id, message);
      changed = true;
    }
  if (!changed) return previous;
  return [...entries.values()].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}
export class AssistantClient {
  private revision = 0;
  private entries: AssistantMessage[] = [];
  private outbox?: {
    commandId: string;
    text: string;
    attachments: RemoteAttachment[];
  };
  constructor(
    readonly hostKey: string,
    readonly rpc: AssistantRpc,
    private storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ) {}
  async sync(): Promise<{
    assistant: AssistantView | null;
    messages: AssistantMessage[];
  }> {
    const assistant = await this.rpc<AssistantView | null>("assistant.get");
    if (!assistant) return { assistant, messages: [] };
    let page: AssistantMessages;
    do {
      page = await this.rpc<AssistantMessages>("assistant.messages", {
        afterRevision: this.revision,
        limit: 100,
      });
      this.entries = mergeAssistantMessages(this.entries, page.entries);
      this.revision = page.nextRevision;
    } while (page.hasMore);
    return { assistant, messages: this.entries };
  }
  pending() {
    const key = `monocode.assistant-outbox:${this.hostKey}`;
    if (!this.outbox)
      try {
        const raw = this.storage?.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            typeof saved.commandId === "string" &&
            typeof saved.text === "string"
          )
            this.outbox = { ...saved, attachments: saved.attachments ?? [] };
        }
      } catch {
        /* The in-memory attempt remains retryable. */
      }
    return this.outbox;
  }
  async send(
    text: string,
    attachments: RemoteAttachment[] = [],
  ): Promise<unknown> {
    const key = `monocode.assistant-outbox:${this.hostKey}`;
    const pending = this.pending();
    if (
      pending &&
      (pending.text !== text ||
        JSON.stringify(pending.attachments) !== JSON.stringify(attachments))
    )
      throw new Error("A previous assistant message needs retrying first.");
    const command = pending ?? {
      commandId: crypto.randomUUID(),
      text,
      attachments,
    };
    this.outbox = command;
    try {
      this.storage?.setItem(key, JSON.stringify(command));
    } catch {
      /* The same call still uses one stable ID. */
    }
    const receipt = await this.rpc("assistant.send", command);
    this.outbox = undefined;
    try {
      this.storage?.removeItem(key);
    } catch {
      /* Replaying the saved ID is safe. */
    }
    return receipt;
  }
  async upload(file: File): Promise<RemoteAttachment> {
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Attachments must be at most 20 MB");
    const ref: RemoteAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      kind: file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/")
          ? "audio"
          : "file",
    };
    for (let offset = 0; offset < file.size || offset === 0;) {
      const bytes = new Uint8Array(
        await file.slice(offset, offset + 512 * 1024).arrayBuffer(),
      );
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const next = await this.rpc<{ offset: number }>("attachments.upload", {
        id: ref.id,
        offset,
        size: ref.size,
        data: btoa(binary),
      });
      if (next.offset !== offset + bytes.length)
        throw new Error("Attachment upload was incomplete");
      offset = next.offset;
      if (!file.size) break;
    }
    return ref;
  }
  readImage(messageId: string, file: RemoteAttachment): Promise<string> {
    if (file.kind !== "image") return Promise.reject(new Error("Invalid image transfer"));
    return this.readAttachment(messageId, file);
  }

  /** Base64 bytes of an attachment kept with a public assistant message. */
  async readAttachment(messageId: string, file: RemoteAttachment): Promise<string> {
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 20 * 1024 * 1024)
      throw new Error("Invalid image transfer");
    const pieces: string[] = [];
    let offset = 0;
    while (offset < file.size) {
      const chunk = await this.rpc<{ data: string; offset: number; size: number }>("attachments.read", {
        messageId, id: file.id, offset,
      });
      if (chunk.size !== file.size || chunk.offset <= offset || chunk.offset > file.size ||
          atob(chunk.data).length !== chunk.offset - offset ||
          (chunk.offset < file.size && (chunk.offset - offset) % 3 !== 0))
        throw new Error("Invalid image transfer");
      pieces.push(chunk.data);
      offset = chunk.offset;
    }
    return pieces.join("");
  }
}
