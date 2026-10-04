import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { HostEngine } from "./engine";
import { HostStore } from "./store";
import { createHostServer } from "./server";
import type { HostProvider } from "./providers";
import type { SendTurnInput } from "../src/integrations/harness/core/types";
import {
  MobileClient,
  HostRequestError,
  type RpcTransport,
} from "../src/mobile/client";
import type { MobileStorage, StorageKey } from "../src/mobile/storage";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "monocode-mobile-integration-"));
  const store = new HostStore(join(directory, "host.db"));
  let turn: SendTurnInput | undefined;
  let finish = () => {};
  const provider: HostProvider = {
    send: vi.fn((input) => {
      turn = input;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    }),
    bind: vi.fn(),
    stop: vi.fn(async () => finish()),
    cancel: vi.fn(async () => finish()),
    approve: vi.fn(),
    answer: vi.fn(),
  };
  const engine = new HostEngine(store, { codex: provider });
  const project = await engine.openProject(directory);
  const server = createHostServer(engine, ["codex"]);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const device = store.issueDevice("Mobile test", "123");
  const values = new Map<StorageKey, string>();
  const storage: MobileStorage = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
  let loseNextReceipt = false;
  const transport: RpcTransport = async (_endpoint, token, request) => {
    const response = await fetch(`${endpoint}/rpc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const result = (await response.json()) as {
      result?: unknown;
      error?: string;
    };
    if (!response.ok)
      throw new HostRequestError(result.error!, response.status);
    if (
      loseNextReceipt &&
      (request as { method: string }).method === "commands.dispatch"
    ) {
      loseNextReceipt = false;
      throw new Error("Simulated lost response");
    }
    return result.result;
  };
  const client = new MobileClient(storage, transport);
  cleanups.push(async () => {
    finish();
    await engine.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await client.connect(endpoint, device.token);
  return {
    directory,
    store,
    engine,
    project,
    client,
    provider,
    device,
    endpoint,
    transport,
    turn: () => turn!,
    finish: () => finish(),
    loseNextReceipt: () => {
      loseNextReceipt = true;
    },
  };
}

describe("mobile client against the real MonoCode Host", () => {
  it("syncs one durable queue across separate clients and retries a lost enqueue receipt without duplicates", async () => {
    const s = await setup();
    const desktopStorageValues = new Map<StorageKey, string>();
    const desktop = new MobileClient({
      get: async key => desktopStorageValues.get(key) ?? null,
      set: async (key, value) => { desktopStorageValues.set(key, value); },
      remove: async key => { desktopStorageValues.delete(key); },
    }, s.transport);
    await desktop.connect(s.endpoint, s.device.token);
    const created = await s.client.dispatch({ type: "create", commandId: "shared-create", projectId: s.project.id,
      harness: "codex", model: "codex:test", runtimeMode: "supervised" }, "first");
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(1));
    await Promise.all([
      s.client.dispatch({ type: "send", commandId: "phone-row", sessionId: created.sessionId, text: "From phone" }),
      desktop.dispatch({ type: "send", commandId: "desktop-row", sessionId: created.sessionId, text: "From desktop" }),
    ]);
    const phoneSnapshot = await s.client.session(created.sessionId);
    const desktopSnapshot = await desktop.session(created.sessionId);
    expect(phoneSnapshot.session.queuedMessages).toEqual(desktopSnapshot.session.queuedMessages);
    expect(phoneSnapshot.session.queuedMessages?.map(row => row.id).sort()).toEqual(["desktop-row", "phone-row"]);
    s.loseNextReceipt();
    await expect(s.client.dispatch({ type: "send", commandId: "lost-enqueue", sessionId: created.sessionId, text: "Lost receipt" })).rejects.toThrow("lost response");
    await s.client.retryPending();
    expect((await desktop.session(created.sessionId)).session.queuedMessages).toHaveLength(3);
    await desktop.dispatch({ type: "queue", action: "remove", commandId: "delete-phone", sessionId: created.sessionId, messageId: "phone-row" });
    expect((await s.client.session(created.sessionId)).session.queuedMessages?.map(row => row.id)).toEqual(["desktop-row", "lost-enqueue"]);
    s.finish();
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(2));
    expect(s.turn().text).toBe("From desktop");
    const synced = await s.client.session(created.sessionId);
    expect(synced.session.blocks.some(row => row.id === "desktop-row")).toBe(true);
    expect(synced.session.queuedMessages?.map(row => row.id)).toEqual(["lost-enqueue"]);
  });

  it("uploads files and delivers an attachment-only first turn with plan intent exactly once", async () => {
    const s = await setup();
    const data = Buffer.alloc(600_001, 42);
    const attachments = await s.client.uploadAttachments([
      {
        id: crypto.randomUUID(),
        name: "notes.txt",
        mimeType: "text/plain",
        kind: "file",
        size: data.length,
        data: data.toString("base64"),
      },
    ]);
    s.loseNextReceipt();
    await expect(
      s.client.dispatch(
        {
          type: "create",
          commandId: "file-plan-create",
          projectId: s.project.id,
          harness: "codex",
          model: "codex:test",
          runtimeMode: "supervised",
        },
        { text: "", attachments, intent: "plan" },
      ),
    ).rejects.toThrow("lost response");
    const receipt = await s.client.retryPending();
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(1));
    expect(s.turn().intent).toBe("plan");
    const block = (await s.client.session(receipt.sessionId)).session.blocks[0];
    expect(block.text).toBe("");
    expect(block.attachments).toHaveLength(1);
    expect(readFileSync(block.attachments![0].path!)).toEqual(data);
    expect(await s.client.sessions(s.project.id)).toHaveLength(1);
  });
  it("persists selected models and reasoning values, then applies changes to the next turn", async () => {
    const s = await setup();
    const created = await s.client.dispatch(
      {
        type: "create",
        commandId: "configured-create",
        projectId: s.project.id,
        harness: "codex",
        model: "codex:test",
        modelSettings: { reasoningEffort: "high" },
        runtimeMode: "supervised",
      },
      "First turn",
    );
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(1));
    expect(s.turn().modelSettings).toEqual({ reasoningEffort: "high" });
    s.finish();
    await vi.waitFor(() =>
      expect(s.store.session(created.sessionId).status).toBe("idle"),
    );
    await s.client.dispatch({
      type: "configure",
      commandId: "configured-model",
      sessionId: created.sessionId,
      model: "codex:another",
      modelSettings: { reasoningEffort: "low" },
      runtimeMode: "supervised",
    });
    const configured = await s.client.session(created.sessionId);
    expect(configured.session).toMatchObject({
      model: "codex:another",
      modelSettings: { reasoningEffort: "low" },
    });
    await s.client.dispatch({
      type: "send",
      commandId: "configured-followup",
      sessionId: created.sessionId,
      text: "Continue",
    });
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(2));
    expect(s.turn()).toMatchObject({
      model: "codex:another",
      modelSettings: { reasoningEffort: "low" },
    });
  });
  it("opens projects, creates a conversation, streams text, handles approvals and reloads its history", async () => {
    const s = await setup();
    expect(await s.client.projects()).toEqual([s.project]);
    expect((await s.client.openProject(s.directory)).id).toBe(s.project.id);
    const receipt = await s.client.dispatch(
      {
        type: "create",
        commandId: "create-mobile",
        projectId: s.project.id,
        harness: "codex",
        model: "codex:test",
        runtimeMode: "supervised",
      },
      "Inspect this project",
    );
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(1));
    expect((await s.client.sessions(s.project.id))[0].id).toBe(
      receipt.sessionId,
    );
    const first = await s.client.session(receipt.sessionId);
    expect(first.session.blocks[0].text).toBe("Inspect this project");
    s.turn().onEvent({ type: "message.delta", text: "I inspected " });
    s.turn().onEvent({ type: "message.delta", text: "the project." });
    s.turn().onEvent({
      type: "approval.requested",
      requestId: 7,
      title: "Run checks?",
    });
    const next = await s.client.session(receipt.sessionId);
    expect(
      next.session.blocks.some((block) =>
        block.text.includes("I inspected the project."),
      ),
    ).toBe(true);
    expect(
      next.session.blocks.find((block) => block.approval)?.approval?.requestId,
    ).toBe(7);
    await s.client.dispatch({
      type: "approve",
      commandId: "approve-mobile",
      sessionId: receipt.sessionId,
      runId: next.runId!,
      requestId: 7,
      decision: "allow",
    });
    expect(s.provider.approve).toHaveBeenCalled();
    s.finish();
    await vi.waitFor(() =>
      expect(s.store.session(receipt.sessionId).status).toBe("idle"),
    );
    expect((await s.client.session(receipt.sessionId)).status).toBe("idle");
  });
  it("retries an uncertain session creation without duplicating the conversation or first turn", async () => {
    const s = await setup();
    s.loseNextReceipt();
    await expect(
      s.client.dispatch(
        {
          type: "create",
          commandId: "lost-create",
          projectId: s.project.id,
          harness: "codex",
          model: "codex:test",
          runtimeMode: "supervised",
        },
        "Start once",
      ),
    ).rejects.toThrow("lost response");
    expect(await s.client.sessions(s.project.id)).toHaveLength(1);
    await s.client.retryPending();
    expect(await s.client.sessions(s.project.id)).toHaveLength(1);
    await vi.waitFor(() => expect(s.provider.send).toHaveBeenCalledTimes(1));
  });
  it("rejects revoked phone credentials without bypassing Host authorization", async () => {
    const s = await setup();
    s.store.revokeToken(s.device.token);
    await expect(s.client.projects()).rejects.toMatchObject({ status: 401 });
  });
});
