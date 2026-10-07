// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AssistantMessage } from "../features/assistant/model/assistant";
import type { AssistantRpc } from "../features/assistant/model/assistantClient";
import { markAssistantRead } from "../features/assistant/model/assistantUnread";
import { useMobileAssistantUnread } from "./useMobileAssistantUnread";

let root: Root, node: HTMLDivElement;
let messages: AssistantMessage[];
const reply = (id: string, revision: number): AssistantMessage => ({
  id, revision, createdAt: revision, kind: "assistant", text: id,
});
const rpc = vi.fn();
function Counter({ hostKey, active }: { hostKey?: string; active: boolean }) {
  return createElement("output", {}, useMobileAssistantUnread(hostKey, rpc as AssistantRpc, active));
}
const render = (hostKey = "host", active = true) => act(async () =>
  root.render(createElement(Counter, { hostKey, active })),
);
const count = () => Number(node.textContent);
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  messages = [];
  rpc.mockReset().mockImplementation(async (method, params) => {
    if (method === "assistant.get") return { id: "assistant" };
    const entries = messages.filter((entry) => entry.revision > params.afterRevision);
    return {
      entries, hasMore: false,
      nextRevision: Math.max(params.afterRevision, ...entries.map((entry) => entry.revision)),
    };
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("counts unread replies and pending questions, merging streaming revisions and read acknowledgements", async () => {
  const question: AssistantMessage = {
    id: "question", revision: 4, createdAt: 4, kind: "input", text: "Choose a project",
    brainGeneration: 1, runId: "run", requestId: 1, inputKind: "question", resolved: false,
  };
  messages = [reply("seen", 1), { ...reply("user", 2), kind: "user" }, reply("stream", 3), question];
  localStorage.setItem("monocode.assistant-read:host", "1");
  await render();
  expect(count()).toBe(2);
  expect(localStorage.getItem("monocode.assistant-read:host")).toBe("1");
  messages = [reply("stream", 5), { ...question, revision: 6, resolved: true }];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(count()).toBe(1);
  expect(rpc).toHaveBeenLastCalledWith("assistant.messages", { afterRevision: 4, limit: 100 });
  act(() => markAssistantRead("host", messages));
  expect(count()).toBe(0);
  messages = [reply("new", 7)];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(count()).toBe(1);
  act(() => {
    localStorage.setItem("monocode.assistant-read:host", "7");
    window.dispatchEvent(new StorageEvent("storage", { key: "monocode.assistant-read:host" }));
  });
  expect(count()).toBe(0);
});

it("pauses when inactive, keeps the count on failure, and refreshes when reopened", async () => {
  messages = [reply("reply", 1)];
  await render("host", false);
  expect(rpc).not.toHaveBeenCalled();
  await render();
  expect(count()).toBe(1);
  rpc.mockRejectedValueOnce(new Error("offline"));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(count()).toBe(1);
  rpc.mockClear();
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(rpc).not.toHaveBeenCalled();
  await render("host", false);
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(rpc).not.toHaveBeenCalled();
  messages.push(reply("new", 2));
  await render();
  expect(count()).toBe(2);
});

it("hides another Host's count and cancels in-flight pagination when switching", async () => {
  messages = [reply("host-a", 1)];
  await render("a");
  expect(count()).toBe(1);
  let finish!: (result: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  await render("b", false);
  expect(count()).toBe(0);
  rpc.mockClear();
  await act(async () => finish({ id: "assistant-a" }));
  expect(rpc).not.toHaveBeenCalled();
  expect(count()).toBe(0);
  messages = [reply("host-b", 1), reply("host-b-next", 2)];
  await render("b");
  expect(count()).toBe(2);
});
