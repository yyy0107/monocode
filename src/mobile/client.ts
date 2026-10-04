import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  HOST_PROTOCOL_VERSION,
  REMOTE_PROVIDERS,
  applySessionSync,
  requireHostDescriptor,
  type HostDescriptor,
  type HostProject,
  type HostSession,
  type HostSessionSummary,
  type HostModelCatalog,
  type HostCommand,
  type CommandReceipt,
  type SessionSync,
  type SessionSyncResponse,
  type SessionSyncChunk,
  type RemoteAttachment,
} from "../features/connections/model/protocol";
import type { Attachment } from "../features/sessions/model/session";
import {
  MOBILE_ATTACHMENT_BYTES,
  MOBILE_ATTACHMENT_LIMIT,
} from "./attachments";
import { withRemoteAttachmentPreviews } from "../features/connections/model/remoteAttachmentPreviews";
import type { MobileStorage } from "./storage";

export type Connection = {
  endpoint: string;
  token: string;
  environmentId: string;
  name: string;
};
export type PendingCommand = {
  endpoint: string;
  environmentId: string;
  command: HostCommand;
  followup?: string | MobileFirstMessage;
};
export type MobileFirstMessage = Pick<
  Extract<HostCommand, { type: "send" }>,
  "text" | "attachments" | "intent"
>;
export type RpcTransport = (
  endpoint: string,
  token: string,
  request: object,
) => Promise<unknown>;

export function normalizeHostUrl(input: string): string {
  const url = new URL(input.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw new Error(
      "Enter the Host URL only, without credentials, a path, or query parameters.",
    );
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Use an HTTP or HTTPS Host URL.");
  return url.origin;
}

export class HostRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const nativeTransport: RpcTransport = async (
  endpoint,
  token,
  request,
) => {
  let status: number;
  let data: unknown;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url: `${endpoint}/rpc`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: request,
      connectTimeout: 10_000,
      readTimeout: 20_000,
      disableRedirects: true,
      responseType: "json",
    });
    status = response.status;
    data = response.data;
  } else if (import.meta.env.DEV) {
    const response = await fetch("/__mobile/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint, request }),
      signal: AbortSignal.timeout(20_000),
    });
    status = response.status;
    data = await response.json();
  } else {
    throw new Error("Open MonoCode on iOS or Android to connect to a Host.");
  }
  if (typeof data === "string") data = JSON.parse(data);
  if (status < 200 || status >= 300) {
    const message = (data as { error?: string })?.error;
    throw new HostRequestError(
      message || `Host request failed (${status})`,
      status,
    );
  }
  if (!data || typeof data !== "object" || !("result" in data))
    throw new Error("Invalid Host response.");
  return (data as { result: unknown }).result;
};

export class MobileClient {
  connection?: Connection;
  private snapshots = new Map<string, HostSession>();
  private dispatching = false;
  constructor(
    private readonly storage: MobileStorage,
    private readonly transport: RpcTransport = nativeTransport,
  ) {}

  async restore(): Promise<boolean> {
    const saved = await this.storage.get("connection");
    if (!saved) return false;
    const connection = JSON.parse(saved) as Connection;
    this.connection = connection;
    await this.verify();
    return true;
  }
  async connect(endpoint: string, token: string): Promise<void> {
    endpoint = normalizeHostUrl(endpoint);
    token = token.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(token))
      throw new Error("Enter a valid device token from MonoCode Host.");
    const descriptor = requireHostDescriptor(
      await this.requestWith<HostDescriptor>(
        { endpoint, token },
        "environment.describe",
        { supportedProviders: REMOTE_PROVIDERS },
      ),
    );
    const pending = await this.pending();
    if (
      pending &&
      (pending.endpoint !== endpoint ||
        pending.environmentId !== descriptor.environmentId)
    )
      throw new Error(
        "Reconnect to the previous Host to resolve its pending request first.",
      );
    const connection = {
      endpoint,
      token,
      environmentId: descriptor.environmentId,
      name: descriptor.name,
    };
    await this.storage.set("connection", JSON.stringify(connection));
    this.connection = connection;
    this.snapshots.clear();
  }
  async verify(): Promise<void> {
    if (!this.connection) throw new Error("Connect to a Host first.");
    const host = requireHostDescriptor(
      await this.rpc<HostDescriptor>("environment.describe", {
        supportedProviders: REMOTE_PROVIDERS,
      }),
    );
    if (host.environmentId !== this.connection.environmentId)
      throw new Error(
        "Host identity changed. Connect to this machine again explicitly.",
      );
    if (host.name !== this.connection.name) {
      const connection = { ...this.connection, name: host.name };
      await this.storage.set("connection", JSON.stringify(connection));
      this.connection = connection;
    }
  }
  async disconnect(): Promise<void> {
    await this.storage.remove("connection");
    this.connection = undefined;
    this.snapshots.clear();
  }
  private async requestWith<T>(
    connection: Pick<Connection, "endpoint" | "token"> & Partial<Connection>,
    method: string,
    params: object,
  ): Promise<T> {
    return (await this.transport(connection.endpoint, connection.token, {
      version: HOST_PROTOCOL_VERSION,
      environmentId: connection.environmentId,
      method,
      params,
    })) as T;
  }
  rpc<T>(method: string, params: object = {}): Promise<T> {
    if (!this.connection)
      return Promise.reject(new Error("Connect to a Host first."));
    return this.requestWith<T>(this.connection, method, params);
  }
  projects() {
    return this.rpc<HostProject[]>("projects.list");
  }
  openProject(cwd: string) {
    return this.rpc<HostProject>("projects.open", { cwd: cwd.trim() });
  }
  sessions(projectId: string) {
    return this.rpc<HostSessionSummary[]>("sessions.list", { projectId });
  }
  models(projectId: string) {
    return this.rpc<HostModelCatalog>("models.list", { projectId });
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const base64 = await this.rpc<string>("workspace.run", {
      command: "read_binary_file",
      args: { path },
    });
    return Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
  }

  private async sync(
    sessionId: string,
    revision?: number,
  ): Promise<SessionSync> {
    const result = await this.rpc<SessionSyncResponse>("sessions.sync", {
      sessionId,
      revision,
    });
    if (result.kind !== "chunked") return result;
    if (
      !Number.isSafeInteger(result.length) ||
      result.length < 0 ||
      result.length > 64 * 1024 * 1024
    )
      throw new Error("Conversation is too large to load on this device.");
    let serialized = "";
    while (serialized.length < result.length) {
      const chunk = await this.rpc<SessionSyncChunk>("sessions.syncChunk", {
        sessionId,
        transfer: result.transfer,
        offset: serialized.length,
      });
      if (!chunk.data || serialized.length + chunk.data.length > result.length)
        throw new Error("Incomplete conversation response.");
      serialized += chunk.data;
    }
    return JSON.parse(serialized) as SessionSync;
  }
  async session(sessionId: string): Promise<HostSession> {
    const known = this.snapshots.get(sessionId);
    const sync = await this.sync(sessionId, known?.revision);
    let result: HostSession;
    try {
      result = applySessionSync(known, sync);
    } catch {
      result = applySessionSync(undefined, await this.sync(sessionId));
    }
    result = await withRemoteAttachmentPreviews(
      this.connection!.environmentId,
      result,
      known,
      (params) => this.rpc("attachments.read", params),
    );
    this.snapshots.delete(sessionId);
    this.snapshots.set(sessionId, result);
    if (this.snapshots.size > 8)
      this.snapshots.delete(this.snapshots.keys().next().value!);
    return result;
  }
  async pending(): Promise<PendingCommand | undefined> {
    const value = await this.storage.get("pending");
    return value ? (JSON.parse(value) as PendingCommand) : undefined;
  }
  async uploadAttachments(files: Attachment[]): Promise<RemoteAttachment[]> {
    if (files.length > MOBILE_ATTACHMENT_LIMIT)
      throw new Error("Attach up to 20 files per message.");
    if (
      files.some(
        (file) =>
          file.size > MOBILE_ATTACHMENT_BYTES || file.data === undefined,
      )
    )
      throw new Error("Each attachment must be readable and 20 MB or smaller.");
    const uploaded: RemoteAttachment[] = [];
    const chunkChars = 4 * Math.floor((512 * 1024) / 3);
    for (const file of files) {
      const data = file.data!;
      let offset = 0;
      // Empty files still need a file created on the Host.
      for (
        let index = 0;
        index < data.length || (index === 0 && !data.length);
        index += chunkChars
      ) {
        const chunk = data.slice(index, index + chunkChars);
        const expected =
          offset +
          Math.floor(chunk.length / 4) * 3 -
          (chunk.endsWith("==") ? 2 : chunk.endsWith("=") ? 1 : 0);
        let response: { offset: number };
        try {
          response = await this.rpc("attachments.upload", {
            id: file.id,
            offset,
            size: file.size,
            data: chunk,
          });
        } catch (error) {
          if (error instanceof HostRequestError) throw error;
          // The Host's offset protocol makes retrying a lost chunk receipt safe.
          response = await this.rpc("attachments.upload", {
            id: file.id,
            offset,
            size: file.size,
            data: chunk,
          });
        }
        if (response.offset !== expected)
          throw new Error("Attachment upload was interrupted. Please retry.");
        offset = response.offset;
      }
      if (offset !== file.size)
        throw new Error("Attachment upload was interrupted. Please retry.");
      const { id, name, mimeType, kind, size } = file;
      uploaded.push({ id, name, mimeType, kind, size });
    }
    return uploaded;
  }
  async dispatch(
    command: HostCommand,
    followup?: string | MobileFirstMessage,
  ): Promise<CommandReceipt> {
    if (!this.connection) throw new Error("Connect to a Host first.");
    if (this.dispatching) throw new Error("A request is already being sent.");
    this.dispatching = true;
    try {
      if (await this.pending())
        throw new Error(
          "Resolve the pending request before sending another message.",
        );
      const { endpoint, environmentId } = this.connection;
      await this.storage.set(
        "pending",
        JSON.stringify({
          endpoint,
          environmentId,
          command,
          followup,
        } satisfies PendingCommand),
      );
      return await this.flushPending();
    } finally {
      this.dispatching = false;
    }
  }
  async retryPending(): Promise<CommandReceipt> {
    if (this.dispatching) throw new Error("A request is already being sent.");
    this.dispatching = true;
    try {
      return await this.flushPending();
    } finally {
      this.dispatching = false;
    }
  }
  private async flushPending(): Promise<CommandReceipt> {
    try {
      let pending = await this.pending();
      if (!pending || !this.connection) throw new Error("No pending request.");
      if (
        pending.environmentId !== this.connection.environmentId ||
        pending.endpoint !== this.connection.endpoint
      )
        throw new Error("The pending request belongs to another Host.");
      let receipt = await this.rpc<CommandReceipt>(
        "commands.dispatch",
        pending.command,
      );
      if (pending.command.type === "create" && pending.followup) {
        // Persist the receipt-derived send before dispatch. A lost response or
        // app restart retries the exact command id, including the first turn.
        pending = {
          ...pending,
          followup: undefined,
          command: {
            ...(typeof pending.followup === "string"
              ? { text: pending.followup }
              : pending.followup),
            type: "send",
            commandId: crypto.randomUUID(),
            sessionId: receipt.sessionId,
          },
        };
        await this.storage.set("pending", JSON.stringify(pending));
        receipt = await this.rpc<CommandReceipt>(
          "commands.dispatch",
          pending.command,
        );
      }
      await this.storage.remove("pending");
      return receipt;
    } catch (error) {
      // A Host 400 is a definitive command rejection. Transport failures remain
      // journaled so a retry can ask for the same receipt instead of resending.
      if (error instanceof HostRequestError && error.status === 400)
        await this.storage.remove("pending");
      throw error;
    }
  }
}
