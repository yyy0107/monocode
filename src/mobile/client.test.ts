import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MobileClient,
  normalizeHostUrl,
  HostRequestError,
  nativeTransport,
  type RpcTransport,
} from "./client";
import type { MobileStorage, StorageKey } from "./storage";
import type {
  HostSession,
  HostCommand,
} from "../features/connections/model/protocol";

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: http,
}));
const endpoint = "https://my-computer.example.ts.net";
const token = "123";
const descriptor = {
  protocolVersion: 1,
  environmentId: "host-1",
  name: "Computer",
  providers: ["codex"],
};
const receipt = { commandId: "command", sessionId: "session", revision: 1 };
function memory(): MobileStorage {
  const values = new Map<StorageKey, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}
function snapshot(revision = 1): HostSession {
  return {
    projectId: "project",
    revision,
    status: "running",
    runId: "run",
    updatedAt: 1,
    session: {
      id: "session",
      title: "Conversation",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks: [
        { id: "response", role: "assistant", text: "Hello", streaming: true },
      ],
    },
  };
}
function transport(
  handler: (
    method: string,
    params: Record<string, any>,
    request: object,
  ) => unknown,
): RpcTransport {
  return async (_endpoint, _token, request) => {
    const { method, params } = request as {
      method: string;
      params: Record<string, any>;
    };
    return method === "environment.describe"
      ? descriptor
      : handler(method, params, request);
  };
}
const send: HostCommand = {
  type: "send",
  commandId: "send-original",
  sessionId: "session",
  text: "Implement this",
};

beforeEach(() => vi.clearAllMocks());
describe("mobile Host transport", () => {
  it("uses native POST /rpc without browser Origin, disables redirects, and unwraps the Host envelope", async () => {
    http.post.mockResolvedValue({ status: 200, data: { result: descriptor } });
    expect(
      await nativeTransport(endpoint, token, {
        method: "environment.describe",
      }),
    ).toEqual(descriptor);
    expect(http.post.mock.calls[0][0]).toMatchObject({
      url: `${endpoint}/rpc`,
      disableRedirects: true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    expect(http.post.mock.calls[0][0].headers).not.toHaveProperty("Origin");
  });
  it("surfaces invalid credentials and malformed responses", async () => {
    http.post.mockResolvedValue({
      status: 401,
      data: { error: "Device credential is invalid or revoked" },
    });
    await expect(nativeTransport(endpoint, token, {})).rejects.toMatchObject({
      status: 401,
    });
    http.post.mockResolvedValue({ status: 200, data: {} });
    await expect(nativeTransport(endpoint, token, {})).rejects.toThrow(
      "Invalid Host response",
    );
  });
  it("accepts HTTP and HTTPS Hosts and rejects credential/path/query URLs", () => {
    expect(normalizeHostUrl(` ${endpoint}/ `)).toBe(endpoint);
    expect(normalizeHostUrl("http://127.0.0.1:3774")).toBe(
      "http://127.0.0.1:3774",
    );
    for (const url of [
      "http://192.168.1.2:3774",
      "http://my-computer.local:3774",
      "http://host.example.com:3774",
      "http://[fd00::1]:3774",
    ])
      expect(normalizeHostUrl(` ${url}/ `)).toBe(url);
    for (const url of [
      "ftp://host",
      `${endpoint}/rpc`,
      `${endpoint}?token=secret`,
      "https://user:password@host",
      `${endpoint}#fragment`,
    ])
      expect(() => normalizeHostUrl(url)).toThrow();
  });
});

describe("mobile client synchronization", () => {
  it("applies streamed deltas without losing existing blocks and preserves unchanged snapshots", async () => {
    let value: any = { kind: "snapshot", value: snapshot() };
    const rpc = vi.fn(transport(() => value));
    const client = new MobileClient(memory(), rpc);
    await client.connect(endpoint, token);
    const first = await client.session("session");
    value = {
      kind: "delta",
      base: 1,
      value: {
        ...snapshot(2),
        session: { ...snapshot(2).session, blocks: undefined },
      },
      blockIds: ["response", "tool"],
      blocks: [{ id: "tool", role: "tool", text: "Read app.ts" }],
    };
    const next = await client.session("session");
    expect(next.session.blocks.map((block) => block.text)).toEqual([
      "Hello",
      "Read app.ts",
    ]);
    expect((rpc.mock.calls.at(-1)![2] as any).params.revision).toBe(
      first.revision,
    );
    value = { kind: "unchanged", revision: 2 };
    expect(await client.session("session")).toBe(next);
  });
  it("recovers from a missing delta base with a fresh snapshot", async () => {
    let requests = 0;
    const client = new MobileClient(
      memory(),
      transport(() =>
        ++requests === 1
          ? { kind: "delta", base: 9, value: {}, blockIds: [], blocks: [] }
          : { kind: "snapshot", value: snapshot(10) },
      ),
    );
    await client.connect(endpoint, token);
    expect((await client.session("session")).revision).toBe(10);
    expect(requests).toBe(2);
  });
  it("assembles bounded chunks and rejects a stalled transfer", async () => {
    const serialized = JSON.stringify({ kind: "snapshot", value: snapshot() });
    let stalled = false;
    const client = new MobileClient(
      memory(),
      transport((method, params) =>
        method === "sessions.sync"
          ? { kind: "chunked", length: serialized.length, transfer: "transfer" }
          : {
              data: stalled
                ? ""
                : serialized.slice(params.offset, params.offset + 25),
            },
      ),
    );
    await client.connect(endpoint, token);
    expect((await client.session("session")).session.blocks[0].text).toBe(
      "Hello",
    );
    stalled = true;
    await expect(client.session("session")).rejects.toThrow("Incomplete");
  });
  it("checks persisted Host identity on reconnect", async () => {
    const store = memory();
    await new MobileClient(
      store,
      transport(() => []),
    ).connect(endpoint, token);
    const other = new MobileClient(store, async () => ({
      ...descriptor,
      environmentId: "replacement-host",
    }));
    await expect(other.restore()).rejects.toThrow("Host identity changed");
  });
});

describe("mobile command journal", () => {
  it("retains the same command id after a lost response and restores it after app restart", async () => {
    const store = memory();
    const commands: string[] = [];
    let fail = true;
    const rpc = transport((_method, params) => {
      commands.push(params.commandId);
      if (fail)
        throw new Error("Connection lost after Host accepted the request");
      return { ...receipt, commandId: params.commandId };
    });
    const client = new MobileClient(store, rpc);
    await client.connect(endpoint, token);
    await expect(client.dispatch(send)).rejects.toThrow("Connection lost");
    expect((await client.pending())?.command.commandId).toBe("send-original");
    fail = false;
    const restored = new MobileClient(store, rpc);
    await restored.restore();
    await restored.retryPending();
    expect(commands).toEqual(["send-original", "send-original"]);
    expect(await restored.pending()).toBeUndefined();
  });
  it("journals the first message after creation and retries its receipt rather than creating another session", async () => {
    const store = memory();
    const commands: Record<string, any>[] = [];
    let fail = true;
    const client = new MobileClient(
      store,
      transport((_method, params) => {
        commands.push(params);
        if (params.type === "send" && fail) throw new Error("Lost response");
        return { ...receipt, commandId: params.commandId };
      }),
    );
    await client.connect(endpoint, token);
    await expect(
      client.dispatch(
        {
          type: "create",
          commandId: "create-original",
          projectId: "project",
          harness: "codex",
          model: "codex:test",
          runtimeMode: "supervised",
        },
        "First message",
      ),
    ).rejects.toThrow("Lost response");
    expect((await client.pending())?.command.type).toBe("send");
    fail = false;
    await client.retryPending();
    expect(commands.map((command) => command.type)).toEqual([
      "create",
      "send",
      "send",
    ]);
    expect(commands[1]).toEqual(commands[2]);
    expect(commands[2]).toMatchObject({
      sessionId: "session",
      text: "First message",
    });
  });
  it("serializes commands and refuses a different Host while a request is uncertain", async () => {
    let resolve!: (value: unknown) => void;
    const client = new MobileClient(
      memory(),
      transport(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    await client.connect(endpoint, token);
    const first = client.dispatch(send);
    await expect(
      client.dispatch({ ...send, commandId: "duplicate" }),
    ).rejects.toThrow("already being sent");
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    resolve(receipt);
    await first;
    const failing = new MobileClient(
      memory(),
      transport(() => {
        throw new Error("Offline");
      }),
    );
    await failing.connect(endpoint, token);
    await expect(failing.dispatch(send)).rejects.toThrow("Offline");
    await expect(
      failing.connect("https://another.example", token),
    ).rejects.toThrow("previous Host");
  });
  it("clears definitively rejected commands so the user can correct the request", async () => {
    const client = new MobileClient(
      memory(),
      transport(() => {
        throw new HostRequestError("Session is busy", 400);
      }),
    );
    await client.connect(endpoint, token);
    await expect(client.dispatch(send)).rejects.toThrow("Session is busy");
    expect(await client.pending()).toBeUndefined();
  });
});
