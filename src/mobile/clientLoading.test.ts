import { describe, expect, it, vi } from "vitest";
import { MobileClient, type RpcTransport } from "./client";
import type { MobileStorage } from "./storage";
import type { HostSession } from "../features/connections/model/protocol";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function snapshot(revision = 1, id = "session"): HostSession {
  return {
    projectId: "project", revision, status: "idle", updatedAt: revision,
    session: {
      id, title: "Conversation", cwd: "/project", harness: "codex",
      model: "codex:test", modelSettings: {}, runtimeMode: "supervised",
      blocks: [{ id: "prompt", role: "user", text: "Visible text", attachments: [
        { id: "image", name: "photo.png", kind: "image", mimeType: "image/png", size: 3 },
      ] }],
    },
  };
}
async function setup(handler: (method: string, params: any) => unknown) {
  const values = new Map<string, string>();
  const storage: MobileStorage = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value); },
    remove: async (key) => { values.delete(key); },
  };
  const rpc: RpcTransport = vi.fn(async (endpoint, _token, request) => {
    const { method, params } = request as { method: string; params: any };
    return method === "environment.describe"
      ? { protocolVersion: 1, environmentId: endpoint, name: "Host", providers: ["codex"] }
      : handler(method, params);
  });
  const client = new MobileClient(storage, rpc);
  await client.connect("http://first-host", "123");
  return { client, rpc };
}

describe("mobile loading critical path", () => {
  it("returns text while an image download is unresolved", async () => {
    const image = deferred<any>();
    const { client } = await setup((method) => method === "attachments.read"
      ? image.promise : { kind: "snapshot", value: snapshot() });
    let result: HostSession | undefined;
    const read = client.session("session").then((value) => { result = value; });
    await vi.waitFor(() => expect(result?.session.blocks[0].text).toBe("Visible text"));
    expect(result?.session.blocks[0].attachments?.[0].data).toBeUndefined();
    const hydration = client.sessionPreviews("session");
    image.resolve({ data: "YWJj", size: 3, offset: 3 });
    await read;
    expect((await hydration)?.session.blocks[0].attachments?.[0].data).toBe("YWJj");
  });

  it("shares concurrent navigation and poll reads with one delta base", async () => {
    const sync = deferred<any>();
    const { client, rpc } = await setup(() => sync.promise);
    const first = client.session("session");
    const second = client.session("session");
    sync.resolve({ kind: "snapshot", value: snapshot() });
    expect(await first).toBe(await second);
    expect((rpc as ReturnType<typeof vi.fn>).mock.calls.filter((call) =>
      (call[2] as any).method === "sessions.sync")).toHaveLength(1);
    expect(client.cachedSession("session")).toBe(await first);
  });

  it("merges late image bytes into the newest revision without restoring removed blocks", async () => {
    const image = deferred<any>();
    let value = snapshot();
    const { client } = await setup((method) => method === "attachments.read"
      ? image.promise : { kind: "snapshot", value });
    await client.session("session");
    const hydration = client.sessionPreviews("session");
    value = snapshot(2);
    value.session.blocks[0].text = "Newer text";
    value.session.blocks.push({ id: "reply", role: "assistant", text: "New reply" });
    await client.session("session");
    image.resolve({ data: "YWJj", size: 3, offset: 3 });
    const hydrated = await hydration;
    expect(hydrated?.revision).toBe(2);
    expect(hydrated?.session.blocks.map((block) => block.text)).toEqual(["Newer text", "New reply"]);
    expect(hydrated?.session.blocks[0].attachments?.[0].data).toBe("YWJj");
    value = snapshot(3);
    value.session.blocks = [];
    await client.session("session");
    expect(client.cachedSession("session")?.session.blocks).toEqual([]);
  });

  it.each(["disconnect", "switch", "delete"] as const)("invalidates late session writes after %s", async (action) => {
    const sync = deferred<any>();
    const { client } = await setup((method) => method === "sessions.delete" ? {} : sync.promise);
    const pending = client.session("session");
    if (action === "disconnect") await client.disconnect();
    if (action === "switch") await client.connect("http://second-host", "123");
    if (action === "delete") await client.deleteSession("project", "session");
    sync.resolve({ kind: "snapshot", value: snapshot() });
    await expect(pending).rejects.toThrow();
    expect(client.cachedSession("session")).toBeUndefined();
  });

  it.each(["disconnect", "switch", "delete"] as const)("discards late image hydration after %s", async (action) => {
    const image = deferred<any>();
    const { client } = await setup((method) => method === "attachments.read" ? image.promise
      : method === "sessions.delete" ? {} : { kind: "snapshot", value: snapshot() });
    await client.session("session");
    const pending = client.sessionPreviews("session");
    if (action === "disconnect") await client.disconnect();
    if (action === "switch") await client.connect("http://second-host", "123");
    if (action === "delete") await client.deleteSession("project", "session");
    image.resolve({ data: "YWJj", size: 3, offset: 3 });
    expect(await pending).toBeUndefined();
    expect(client.cachedSession("session")).toBeUndefined();
  });

  it("reads at least the command receipt revision when an older poll is still in flight", async () => {
    const old = deferred<any>();
    let requests = 0;
    const { client } = await setup(() => ++requests === 1 ? old.promise
      : { kind: "snapshot", value: snapshot(2) });
    const poll = client.session("session");
    const afterCommand = client.session("session", 2);
    old.resolve({ kind: "snapshot", value: snapshot() });
    expect((await poll).revision).toBe(1);
    expect((await afterCommand).revision).toBe(2);
    expect(requests).toBe(2);
  });

  it("keeps frequently read sessions and evicts the least recently read snapshot", async () => {
    const { client } = await setup((_method, params) => ({ kind: "snapshot", value: snapshot(1, params.sessionId) }));
    for (let index = 0; index < 8; index++) await client.session(`session-${index}`);
    expect(client.cachedSession("session-0")).toBeDefined();
    await client.session("session-8");
    expect(client.cachedSession("session-0")).toBeDefined();
    expect(client.cachedSession("session-1")).toBeUndefined();
  });

  it("deduplicates project model discovery and reuses the catalog", async () => {
    const catalog = deferred<any>();
    const { client, rpc } = await setup(() => catalog.promise);
    const first = client.models("project");
    const second = client.models("project");
    const value = { models: {}, errors: {} };
    catalog.resolve(value);
    expect(await first).toBe(await second);
    expect(await client.models("project")).toBe(value);
    expect(client.cachedModels("project")).toBe(value);
    expect((rpc as ReturnType<typeof vi.fn>).mock.calls.filter((call) =>
      (call[2] as any).method === "models.list")).toHaveLength(1);
  });

  it("expires catalogs and retries provider errors", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      let requests = 0;
      let errors = true;
      const { client } = await setup(() => {
        requests++;
        return { models: {}, errors: errors ? { codex: "Not signed in" } : {} };
      });
      await client.models("project");
      expect(client.cachedModels("project")).toBeUndefined();
      errors = false;
      await client.models("project");
      expect(requests).toBe(2);
      now.mockReturnValue(61_000);
      expect(client.cachedModels("project")).toBeUndefined();
      await client.models("project");
      expect(requests).toBe(3);
    } finally { now.mockRestore(); }
  });
});
