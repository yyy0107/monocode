import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { createServer, type AddressInfo } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
const exec = promisify(execFile);

it("starts shared Host automatically, imports history and reuses the owner and desktop credential", async () => {
  const directory = mkdtempSync(join(tmpdir(), "monocode-desktop-bootstrap-"));
  const desktop = join(directory, "desktop");
  mkdirSync(desktop);
  const legacy = new DatabaseSync(join(desktop, "monocode.db"));
  legacy.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, cwd TEXT, harness TEXT, model TEXT,
    runtime_mode TEXT, title TEXT, blocks_json TEXT, created_at INTEGER, updated_at INTEGER);
    INSERT INTO sessions VALUES ('old', '${desktop.replaceAll("'", "''")}', 'codex', 'codex:test',
      'supervised', 'Desktop history', '[{"id":"user","role":"user","text":"Old desktop message"}]', 1, 2);`);
  legacy.close();
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((done) => probe.close(() => done()));
  const run = (...args: string[]) =>
    exec(
      process.execPath,
      [
        resolve("build/host/monocode-host.mjs"),
        ...args,
        "--data-dir",
        directory,
        "--port",
        String(port),
      ],
      { timeout: 30_000 },
    );
  try {
    const first = JSON.parse(
      (await run("desktop", "--desktop-data-dir", desktop)).stdout,
    );
    const state = JSON.parse(
      readFileSync(join(directory, "running.json"), "utf8"),
    );
    expect(first.sessions).toContainEqual({ id: "old", cwd: desktop });
    expect(first.token).toHaveLength(43);
    const second = JSON.parse(
      (await run("desktop", "--desktop-data-dir", desktop)).stdout,
    );
    expect(second.token).toBe(first.token);
    expect(
      JSON.parse(readFileSync(join(directory, "running.json"), "utf8")).pid,
    ).toBe(state.pid);
    const response = await fetch(`${first.endpoint}/rpc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${first.token}` },
      body: JSON.stringify({
        version: 1,
        environmentId: first.environmentId,
        method: "sessions.sync",
        params: { sessionId: "old" },
      }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).result.value.session.blocks[0].text).toBe(
      "Old desktop message",
    );
    await fetch(`${first.endpoint}/rpc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${first.token}` },
      body: JSON.stringify({
        version: 1,
        environmentId: first.environmentId,
        method: "sessions.delete",
        params: { projectId: first.projects[0].id, sessionId: "old" },
      }),
    });
    const reopened = JSON.parse(
      (await run("desktop", "--desktop-data-dir", desktop)).stdout,
    );
    expect(reopened.sessions).toContainEqual({
      id: "old",
      cwd: desktop,
      deleted: true,
    });
  } finally {
    if (existsSync(join(directory, "running.json"))) {
      await run("stop");
      await vi.waitFor(() =>
        expect(existsSync(join(directory, "running.json"))).toBe(false),
      );
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
