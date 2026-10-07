import { expect, it, vi } from "vitest";
import { AssistantClient, mergeAssistantMessages } from "./assistantClient";
import type { AssistantMessage } from "./assistant";
const message = (id: string, revision: number): AssistantMessage => ({
  id,
  kind: "assistant",
  text: String(revision),
  revision,
  createdAt: 1,
});
it("merges repeated incremental card revisions without duplicate bubbles", () => {
  expect(
    mergeAssistantMessages(
      [message("one", 1)],
      [message("one", 3), message("one", 2)],
    ),
  ).toEqual([message("one", 3)]);
});
it("retries one stable command ID even when storage is unavailable", async () => {
  const rpc = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost reply"))
    .mockResolvedValue({ accepted: true });
  const storage = {
    getItem() {
      throw new Error("unavailable");
    },
    setItem() {
      throw new Error("unavailable");
    },
    removeItem() {},
  };
  const client = new AssistantClient("one", rpc, storage);
  await expect(client.send("hello")).rejects.toThrow(/lost reply/);
  await expect(client.send("different")).rejects.toThrow(/retrying/);
  await client.send("hello");
  expect(rpc.mock.calls[0][1]).toEqual(rpc.mock.calls[1][1]);
  expect(client.pending()).toBeUndefined();
});
it("restores an outbox after reconnect while keeping Hosts independent", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const fail = vi.fn().mockRejectedValue(new Error("offline"));
  const first = new AssistantClient("one", fail, storage);
  await expect(first.send("pending")).rejects.toThrow(/offline/);
  const rpc = vi.fn().mockResolvedValue({ accepted: true });
  const restored = new AssistantClient("one", rpc, storage),
    other = new AssistantClient("two", rpc, storage);
  expect(restored.pending()?.text).toBe("pending");
  expect(other.pending()).toBeUndefined();
  await restored.send("pending");
  expect(rpc.mock.calls[0][1]).toEqual(fail.mock.calls[0][1]);
});
it("drains message pages in order and retains its cursor across polling", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ id: "assistant" })
    .mockResolvedValueOnce({
      entries: [message("one", 1)],
      nextRevision: 1,
      hasMore: true,
    })
    .mockResolvedValueOnce({
      entries: [message("two", 2)],
      nextRevision: 2,
      hasMore: false,
    });
  const client = new AssistantClient("one", rpc);
  expect((await client.sync()).messages).toHaveLength(2);
  expect(rpc.mock.calls[2][1]).toMatchObject({ afterRevision: 1 });
});

it("reuses unchanged messages across empty and repeated incremental pages", () => {
  const first = message("one", 2), second = message("two", 3);
  const previous = [first, second];
  expect(mergeAssistantMessages(previous, [])).toBe(previous);
  expect(mergeAssistantMessages(previous, [message("one", 1), { ...second }])).toBe(previous);
  const updated = mergeAssistantMessages(previous, [message("two", 4)]);
  expect(updated).not.toBe(previous);
  expect(updated[0]).toBe(first);
  expect(updated[1]).toEqual(message("two", 4));
  expect(previous[1]).toBe(second);
});

it("reads assistant image chunks by public message without a session or Host path", async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ data: btoa("abc"), offset: 3, size: 5 })
    .mockResolvedValueOnce({ data: btoa("de"), offset: 5, size: 5 });
  const client = new AssistantClient("host", rpc);
  const file = { id: "photo", name: "photo.png", kind: "image" as const, mimeType: "image/png", size: 5 };
  expect(await client.readImage("message", file)).toBe(btoa("abcde"));
  expect(rpc.mock.calls).toEqual([
    ["attachments.read", { messageId: "message", id: "photo", offset: 0 }],
    ["attachments.read", { messageId: "message", id: "photo", offset: 3 }],
  ]);
});
it.each([
  { data: "", offset: 0, size: 5 },
  { data: btoa("abc"), offset: 3, size: 6 },
  { data: btoa("ab"), offset: 2, size: 5 },
  { data: btoa("a"), offset: 3, size: 5 },
])("rejects invalid assistant image transfer metadata (%j)", async chunk => {
  const client = new AssistantClient("host", vi.fn().mockResolvedValue(chunk));
  await expect(client.readImage("message", {
    id: "photo", name: "photo.png", kind: "image", mimeType: "image/png", size: 5,
  })).rejects.toThrow("Invalid image transfer");
});
