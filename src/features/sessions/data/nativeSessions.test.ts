// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { newSession, type Session } from "../model/session";
import type { NativeSessionFile } from "../../../integrations/harness/core/nativeSessions";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  stop: vi.fn(),
  bind: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./sessionStore", () => ({
  getSession: mocks.get,
  listSessionsByProject: mocks.list,
  upsertSession: mocks.save,
}));
vi.mock("../../../integrations/harness/core/registry", () => ({
  stopHarnessSession: mocks.stop,
  bindHarnessSession: mocks.bind,
}));
import {
  importNativeSession,
  installNativeSessionSync,
  reconcileNativeSession,
  syncNativeSessions,
  setNativeAutoSync,
  nativeSessionSnapshot,
} from "./nativeSessions";
const file: NativeSessionFile = {
  provider: "pi",
  providerSessionId: "pi-id",
  cwd: "/repo",
  path: "/pi/session.jsonl",
  revision: "1",
  modifiedAt: 100,
};
const content =
  [
    { type: "session", version: 3, id: "pi-id", cwd: "/repo" },
    {
      type: "message",
      id: "u",
      parentId: null,
      message: { role: "user", content: "hello" },
    },
    {
      type: "message",
      id: "a",
      parentId: "u",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
      },
    },
  ]
    .map((row) => JSON.stringify(row))
    .join("\n") + "\n";
let cleanup: () => void;
let stored: Session | null;
let live: Session | undefined;
let changed: ReturnType<typeof vi.fn>;
let lock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setNativeAutoSync(false);
  vi.clearAllMocks();
  stored = null;
  live = undefined;
  changed = vi.fn((session) => {
    stored = session;
  });
  lock = vi.fn(() => vi.fn());
  mocks.list.mockResolvedValue([]);
  mocks.get.mockImplementation(async () => stored);
  mocks.save.mockImplementation(async (session) => {
    stored = session;
    return { ...session, createdAt: 1, updatedAt: 2 };
  });
  mocks.stop.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation(async (command: string) => {
    if (command === "session_find_native_id")
      return (await mocks.list())?.[0]?.id ?? null;
    if (command === "native_sessions_list")
      return { sessions: [file], warnings: [] };
    if (command === "native_session_read") return content;
    if (command === "session_list_native_ids") return stored ? [stored.id] : [];
    throw new Error(command);
  });
  cleanup = installNativeSessionSync({ getLive: () => live, lock, changed });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("native session synchronization", () => {
  it("imports once and resumes the original source without duplicating an existing MonoCode session", async () => {
    mocks.list.mockResolvedValue([
      { id: "existing", providerSessionId: "pi-id", harness: "pi" },
    ]);
    stored = {
      ...newSession("pi", "/repo"),
      id: "existing",
      providerSessionId: "pi-id",
      blocks: [{ id: "local-u", role: "user", text: "hello", btwThreads: [] }],
    };
    const id = await importNativeSession(file);
    expect(id).toBe("existing");
    expect(stored?.nativeSession?.path).toBe(file.path);
    expect(mocks.bind).toHaveBeenCalledWith(
      "pi",
      "existing",
      "pi-id",
      "/repo",
      undefined,
      stored?.blocks,
      stored?.nativeSession,
    );
    expect(await importNativeSession(file)).toBe(id);
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("pins legacy Codex imports to their original default credential home", () => {
    const original = {
      ...newSession("codex", "/repo"),
      providerSessionId: "thread-id",
    };
    const imported = reconcileNativeSession(
      original,
      { ...file, provider: "codex", providerSessionId: "thread-id" },
      {
        createdAt: 1,
        blocks: [{ id: "native-codex-u", role: "user", text: "hello" }],
        modelSettings: {},
      },
    );
    expect(imported.providerAccountId).toBe("default");
  });

  it("does not overwrite running sessions, recreate deleted imports, or persist missing native writes", async () => {
    await importNativeSession(file);
    const imported = stored!;
    const local = {
      ...imported,
      blocks: [
        ...imported.blocks,
        { id: "local", role: "user" as const, text: "unsaved" },
      ],
    };
    expect(() =>
      reconcileNativeSession(
        local,
        { ...file, revision: "2" },
        { createdAt: 1, blocks: imported.blocks, modelSettings: {} },
      ),
    ).toThrow("deferred");
    live = { ...imported, busy: true };
    mocks.save.mockClear();
    await syncNativeSessions();
    expect(mocks.save).not.toHaveBeenCalled();
    live = undefined;
    stored = null;
    mocks.invoke.mockImplementation(async (command: string) =>
      command === "session_list_native_ids"
        ? [imported.id]
        : { sessions: [file], warnings: [] },
    );
    await syncNativeSessions();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retries failed persistence and releases the app guard without marking a failed import as synchronized", async () => {
    const release = vi.fn();
    lock.mockReturnValue(release);
    mocks.save.mockRejectedValueOnce(new Error("disk full"));
    await expect(importNativeSession(file)).rejects.toThrow("disk full");
    expect(changed).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(nativeSessionSnapshot().error).toContain("disk full");
    expect(await importNativeSession(file)).toBe("native-pi-pi-id");
  });
  it("syncs changed history once and pauses periodic work when disabled", async () => {
    await importNativeSession(file);
    mocks.save.mockClear();
    const newFile = { ...file, revision: "2" };
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "session_list_native_ids") return [stored!.id];
      if (command === "native_sessions_list")
        return { sessions: [newFile], warnings: [] };
      return (
        content +
        JSON.stringify({
          type: "message",
          id: "u2",
          parentId: "a",
          message: { role: "user", content: "next" },
        }) +
        "\n"
      );
    });
    setNativeAutoSync(true);
    await syncNativeSessions();
    expect(stored?.blocks.map((block) => block.text)).toEqual([
      "hello",
      "answer",
      "next",
    ]);
    expect(mocks.save).toHaveBeenCalledOnce();
    setNativeAutoSync(false);
    mocks.invoke.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
