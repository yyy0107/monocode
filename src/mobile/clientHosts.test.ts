import { expect, it, vi } from "vitest";
import { MobileClient, type RpcTransport } from "./client";
import type { MobileStorage, StorageKey } from "./storage";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { post: vi.fn() },
}));

function memory(values = new Map<StorageKey, string>()): MobileStorage {
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => void values.set(key, value),
    remove: async (key) => void values.delete(key),
  };
}

// Each endpoint answers as its own Host.
const hosts: RpcTransport = async (endpoint) => ({
  protocolVersion: 1,
  environmentId: endpoint.includes("10.0.0.1") ? "host-a" : "host-b",
  name: endpoint.includes("10.0.0.1") ? "Linux" : "Windows",
  providers: ["codex"],
});

it("keeps every paired Host and switches between them", async () => {
  const client = new MobileClient(memory(), hosts);
  await client.connect("http://10.0.0.1:3774", "token-a");
  await client.connect("http://10.0.0.2:3774", "token-b");
  expect((await client.savedConnections()).map((host) => host.environmentId)).toEqual(["host-a", "host-b"]);
  expect(client.connection?.environmentId).toBe("host-b");

  await client.switchTo("host-a");
  expect(client.connection).toMatchObject({ environmentId: "host-a", token: "token-a" });

  await client.disconnect();
  expect((await client.savedConnections()).map((host) => host.environmentId)).toEqual(["host-b"]);
  expect(client.connection).toBeUndefined();
});

it("adopts a Host saved before multiple connections existed", async () => {
  const values = new Map<StorageKey, string>([["connection", JSON.stringify({
    endpoint: "http://10.0.0.1:3774", token: "token-a", environmentId: "host-a", name: "Linux",
  })]]);
  const client = new MobileClient(memory(values), hosts);
  await client.connect("http://10.0.0.2:3774", "token-b");
  expect((await client.savedConnections()).map((host) => host.environmentId)).toEqual(["host-a", "host-b"]);
});
