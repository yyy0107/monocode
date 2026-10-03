import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
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
    turn: () => turn!,
    finish: () => finish(),
    loseNextReceipt: () => {
      loseNextReceipt = true;
    },
  };
}

describe("mobile client against the real MonoCode Host", () => {
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
