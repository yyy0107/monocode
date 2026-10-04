import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { HostStore } from "./store";
import { prepareDesktopHost } from "./desktop";

async function legacyHost(busy: boolean) {
  const directory = mkdtempSync(join(tmpdir(), "monocode-legacy-upgrade-"));
  const desktop = join(directory, "desktop");
  mkdirSync(desktop);
  const store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "repo");
  const phone = store.issueDevice("Existing phone");
  store.save(
    {
      projectId: project.id,
      revision: 1,
      updatedAt: 1,
      status: busy ? "running" : "idle",
      session: {
        id: "kept",
        cwd: directory,
        harness: "codex",
        model: "codex:test",
        modelSettings: {},
        runtimeMode: "supervised",
        title: "Existing phone chat",
        blocks: [{ id: "user", role: "user", text: "Keep this" }],
        busy,
      },
    },
    {},
  );
  let stops = 0;
  let closed = false;
  const server = createServer((request, response) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
    });
    request.on("end", () => {
      response.end("{}");
      if (JSON.parse(data).action === "stop") {
        stops++;
        store.close();
        closed = true;
        rmSync(join(directory, "running.json"));
        server.close();
        server.closeAllConnections();
      }
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  writeFileSync(
    join(directory, "running.json"),
    JSON.stringify({ pid: process.pid, port, secret: "fixture-only" }),
  );
  const cleanup = async () => {
    if (closed && existsSync(join(directory, "running.json"))) {
      const state = JSON.parse(
        readFileSync(join(directory, "running.json"), "utf8"),
      );
      try { await fetch(`http://127.0.0.1:${state.port}/lifecycle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${state.secret}` },
        body: '{"action":"stop"}',
      }); } catch { /* A stopping server may close the response socket. */ }
      for (
        let n = 0;
        n < 100 && existsSync(join(directory, "running.json"));
        n++
      )
        await new Promise((done) => setTimeout(done, 50));
      expect(existsSync(join(directory, "running.json"))).toBe(false);
    }
    if (!closed) {
      store.close();
      server.close();
      server.closeAllConnections();
    }
    rmSync(directory, { recursive: true, force: true });
  };
  return { directory, desktop, port, phone, stops: () => stops, cleanup };
}
it("updates an idle legacy Host without losing phone credentials or conversations", async () => {
  const old = await legacyHost(false);
  try {
    const prepared = await prepareDesktopHost(
      old.directory,
      old.desktop,
      resolve("build/host/monocode-host.mjs"),
      old.port,
    );
    expect(old.stops()).toBe(1);
    expect(prepared.sessions).toContainEqual({
      id: "kept",
      cwd: old.directory,
    });
    const response = await fetch(`${prepared.endpoint}/rpc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${old.phone.token}` },
      body: JSON.stringify({
        version: 1,
        environmentId: prepared.environmentId,
        method: "sessions.sync",
        params: { sessionId: "kept" },
      }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).result.value.session.blocks[0].text).toBe(
      "Keep this",
    );
  } finally {
    await old.cleanup();
  }
}, 30_000);
it("leaves a busy legacy Host running and reports a retryable upgrade condition", async () => {
  const old = await legacyHost(true);
  try {
    await expect(
      prepareDesktopHost(
        old.directory,
        old.desktop,
        resolve("build/host/monocode-host.mjs"),
        old.port,
      ),
    ).rejects.toThrow("Finish the running");
    expect(old.stops()).toBe(0);
    expect(existsSync(join(old.directory, "running.json"))).toBe(true);
  } finally {
    await old.cleanup();
  }
});
