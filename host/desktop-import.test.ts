import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { HostStore } from "./store";
import { importDesktopSessions } from "./desktop-import";
import { readAttachmentChunk } from "./attachments";
import { readdirSync } from "node:fs";
import { HostEngine } from "./engine";
import { vi } from "vitest";

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "monocode-shared-import-"));
  directories.push(directory);
  const path = join(directory, "desktop.db");
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, cwd TEXT, harness TEXT, model TEXT,
    model_settings TEXT, runtime_mode TEXT, title TEXT, blocks_json TEXT,
    created_at INTEGER, updated_at INTEGER, provider_session_id TEXT, provider_account_id TEXT,
    archived INTEGER, pinned INTEGER, branch TEXT, worktree_cwd TEXT)`);
  const image = join(directory, "picture.png");
  writeFileSync(image, Buffer.from("image bytes"));
  db.prepare(
    "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "legacy",
    directory,
    "codex",
    "codex:test",
    '{"reasoningEffort":"high"}',
    "supervised",
    "Original title",
    JSON.stringify([
      { id: "user", role: "user", text: "Before mobile" },
      {
        id: "image",
        role: "image",
        text: "",
        image: {
          path: image,
          name: "picture.png",
          mimeType: "image/png",
          size: 11,
        },
      },
    ]),
    100,
    200,
    "native-provider",
    "account",
    1,
    1,
    "main",
    directory,
  );
  db.close();
  return { directory, path, store: new HostStore(join(directory, "host.db")) };
}

it("preserves IDs/provider identity/metadata and makes legacy images readable on mobile", () => {
  const { path, store } = fixture();
  try {
    const before = readFileSync(path);
    expect(importDesktopSessions(store, path)).toBe(1);
    const value = store.session("legacy");
    expect(value).toMatchObject({
      revision: 1,
      status: "idle",
      createdAt: 100,
      updatedAt: 200,
      archived: true,
      pinned: true,
      session: {
        id: "legacy",
        title: "Original title",
        providerSessionId: "native-provider",
        providerAccountId: "account",
        modelSettings: { reasoningEffort: "high" },
      },
    });
    const file = value.session.blocks[1].attachments![0];
    expect(
      readAttachmentChunk(store, {
        sessionId: "legacy",
        id: file.id,
        offset: 0,
      }).data,
    ).toBe(Buffer.from("image bytes").toString("base64"));
    expect(readFileSync(path)).toEqual(before);
    expect(importDesktopSessions(store, path)).toBe(0);
    store.updateSession("legacy", { title: "Changed from phone" });
    expect(importDesktopSessions(store, path)).toBe(0);
    expect(store.session("legacy").session.title).toBe("Changed from phone");
  } finally {
    store.close();
  }
});

it("does not resurrect deleted imported history on the next startup", () => {
  const { path, store } = fixture();
  try {
    importDesktopSessions(store, path);
    store.deleteSession("legacy");
    expect(importDesktopSessions(store, path)).toBe(0);
    expect(store.sessions()).toEqual([]);
  } finally {
    store.close();
  }
});
it("refreshes imported native history without duplicating images or bypassing CLI ownership", () => {
  const { path, store } = fixture();
  const native = {
    provider: "codex",
    providerSessionId: "native-provider",
    path: "/native/session.jsonl",
    revision: "first",
    blockIds: ["user", "image"],
    createdAt: 100,
    updatedAt: 200,
  };
  const source = new DatabaseSync(path);
  source.exec("ALTER TABLE sessions ADD COLUMN native_session_json TEXT");
  source
    .prepare("UPDATE sessions SET native_session_json=?")
    .run(JSON.stringify(native));
  try {
    importDesktopSessions(store, path);
    const before = store.session("legacy").session.blocks[1].attachments![0].id;
    const blocks = JSON.parse(
      String(
        source.prepare("SELECT blocks_json FROM sessions").get()!.blocks_json,
      ),
    );
    blocks.push({ id: "external", role: "assistant", text: "From native CLI" });
    source
      .prepare("UPDATE sessions SET blocks_json=?, native_session_json=?")
      .run(
        JSON.stringify(blocks),
        JSON.stringify({ ...native, revision: "second" }),
      );
    importDesktopSessions(store, path, { id: "legacy", busy: false });
    expect(store.session("legacy").session.nativeSession?.revision).toBe(
      "second",
    );
    expect(store.session("legacy").session.blocks.at(-1)?.text).toBe(
      "From native CLI",
    );
    expect(store.session("legacy").session.blocks[1].attachments![0].id).toBe(
      before,
    );
    expect(readdirSync(store.attachmentDir)).toHaveLength(1);
    const provider = {
      send: vi.fn(),
      bind: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      approve: vi.fn(),
      answer: vi.fn(),
    };
    const engine = new HostEngine(store, { codex: provider });
    expect(provider.bind).not.toHaveBeenCalled();
    expect(() =>
      engine.command({
        type: "send",
        sessionId: "legacy",
        commandId: "phone",
        text: "Unsafe continuation",
      }),
    ).toThrow("CLI ownership");
    expect(provider.send).not.toHaveBeenCalled();
  } finally {
    source.close();
    store.close();
  }
});

it("rolls back a failed import and allows a repaired source to retry", () => {
  const { path, store, directory } = fixture();
  rmSync(join(directory, "picture.png"));
  try {
    expect(() => importDesktopSessions(store, path)).toThrow("missing image");
    expect(store.sessions()).toEqual([]);
    writeFileSync(join(directory, "picture.png"), "repaired");
    expect(importDesktopSessions(store, path)).toBe(1);
  } finally {
    store.close();
  }
});
