// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesktopAssistantButton } from "./DesktopAssistantButton";
import { markAssistantRead } from "../model/assistantUnread";
import type { AssistantMessage } from "../model/assistant";
import { setUiLanguage } from "../../../shared/i18n/language";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  notify: vi.fn(),
  listen: vi.fn(),
  focus: vi.fn(),
  hosts: [] as { id: string; environmentId: string; capabilities: string[] }[],
}));
vi.mock("../../notifications/model/notifications", () => ({
  NOTIFICATION_CLICK_EVENT: "monocode:notification-click", notifyApp: mocks.notify,
}));
vi.mock("../../connections/model/remoteProjects", () => ({ sharedHostMachineId: () => "local" }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ label: "main", unminimize: async () => {}, setFocus: mocks.focus }) }));
vi.mock("../../connections/model/connections", () => ({
  remoteRequest: mocks.rpc,
}));
vi.mock("../model/useDesktopAssistantHosts", () => ({
  useDesktopAssistantHosts: () => mocks.hosts,
}));
let root: Root, node: HTMLDivElement;
const onOpen = vi.fn();
const reply = (id: string, revision: number, text = id): AssistantMessage => ({
  id,
  revision,
  text,
  kind: "assistant",
  createdAt: revision,
});
let messages: Record<string, AssistantMessage[]>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  setUiLanguage("en");
  onOpen.mockClear();
  mocks.notify.mockReset();
  mocks.focus.mockReset();
  mocks.listen.mockReset().mockResolvedValue(vi.fn());
  mocks.hosts = [
    { id: "local", environmentId: "env-local", capabilities: ["assistant.v1"] },
    {
      id: "remote",
      environmentId: "env-remote",
      capabilities: ["assistant.v1"],
    },
    { id: "old", environmentId: "env-old", capabilities: [] },
  ];
  messages = { local: [], remote: [] };
  mocks.rpc.mockReset().mockImplementation(async (id, method, params) => {
    if (method === "environment.describe")
      return { capabilities: id === "old" ? [] : ["assistant.v1"] };
    if (method === "assistant.get") return { id: "assistant", name: "Personal assistant", chatRevision: Math.max(0, ...messages[id].map((m) => m.revision)) };
    const entries = messages[id].filter(
      (entry) => entry.revision > params.afterRevision,
    );
    return {
      entries,
      hasMore: false,
      nextRevision: entries.at(-1)?.revision ?? params.afterRevision,
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
async function render() {
  await act(async () =>
    root.render(
      createElement(DesktopAssistantButton, { active: false, onOpen }),
    ),
  );
}
const button = () => node.querySelector("button")!;

it("shows unseen replies and opens the latest message's Host without polling unsupported Hosts", async () => {
  messages.local = [
    reply("local-reply", 1),
    { ...reply("user", 2), kind: "user" },
  ];
  messages.remote = [reply("remote-reply", 3, "Remote task finished")];
  await render();
  expect(button().getAttribute("aria-label")).toBe(
    "Assistant, 2 unread messages",
  );
  expect(button().textContent).toBe("Remote task finished2");
  expect(
    mocks.rpc.mock.calls
      .filter(([id]) => id === "old")
      .map(([, method]) => method),
  ).toEqual(["environment.describe"]);
  act(() => button().click());
  expect(onOpen).toHaveBeenCalledWith("remote");
  // Opening is not itself a read acknowledgement: the chat must load and show it.
  expect(button().getAttribute("aria-label")).toContain("2 unread");
  act(() => markAssistantRead("env-remote", messages.remote));
  expect(button().getAttribute("aria-label")).toContain("1 unread");
  expect(button().textContent).toContain("local-reply");
  act(() => markAssistantRead("env-local", messages.local));
  expect(button().getAttribute("aria-label")).toBe("Assistant");
  expect(button().textContent).toBe("Assistant");
  expect(localStorage.getItem("monocode.assistant-read:env-local")).toBe("2");
});

it("coalesces streaming revisions and notices new content after an earlier revision was read", async () => {
  messages.local = [{ ...reply("stream", 1, "First"), streaming: true }];
  await render();
  act(() => markAssistantRead("env-local", messages.local));
  messages.local = [
    { ...reply("stream", 2, "First, then finished"), streaming: false },
  ];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(button().getAttribute("aria-label")).toContain("1 unread");
  expect(button().textContent).toContain("First, then finished");
  mocks.rpc.mockRejectedValueOnce(new Error("offline"));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(button().textContent).toContain("First, then finished");
});

it("restores read state and synchronizes acknowledgements from another window", async () => {
  messages.local = [reply("seen", 1), reply("unseen", 2)];
  localStorage.setItem("monocode.assistant-read:env-local", "1");
  await render();
  expect(button().getAttribute("aria-label")).toContain("1 unread");
  act(() => {
    localStorage.setItem("monocode.assistant-read:env-local", "2");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "monocode.assistant-read:env-local" }),
    );
  });
  expect(button().getAttribute("aria-label")).toBe("Assistant");
  act(() => button().click());
  expect(onOpen).toHaveBeenCalledWith(undefined);
});

it("shows pending questions and removes the notification when they resolve", async () => {
  const question: AssistantMessage = {
    id: "question",
    revision: 1,
    createdAt: 1,
    kind: "input",
    text: "Choose a project",
    brainGeneration: 1,
    runId: "run",
    requestId: 1,
    inputKind: "question",
    resolved: false,
  };
  messages.local = [question];
  await render();
  expect(button().textContent).toContain("Choose a project");
  messages.local = [{ ...question, revision: 2, resolved: true }];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(button().getAttribute("aria-label")).toBe("Assistant");
});

it("notifies completed replies once and opens the matching Host from a system notification", async () => {
  messages.local = [reply("history", 1)];
  await render();
  expect(mocks.notify).not.toHaveBeenCalled();
  messages.local.push({ ...reply("stream", 2), streaming: true });
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(mocks.notify).not.toHaveBeenCalled();
  messages.local = [reply("stream", 3, "Ready to review")];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('assistant:["env-local","main"]', {
    title: "MonoCode", subtitle: "Personal assistant", body: "Ready to review",
  }, false);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(mocks.notify).toHaveBeenCalledOnce();
  await act(async () => mocks.listen.mock.calls[0][1]({ payload: 'assistant:["env-remote","other-window"]' }));
  expect(onOpen).not.toHaveBeenCalled();
  await act(async () => mocks.listen.mock.calls[0][1]({ payload: 'assistant:["env-remote","main"]' }));
  expect(onOpen).toHaveBeenCalledWith("remote");
  expect(mocks.focus).toHaveBeenCalledOnce();
});

it("passes visibility only for the selected assistant Host", async () => {
  await act(async () => root.render(createElement(DesktopAssistantButton, {
    active: true, selectedMachineId: "remote", onOpen,
  })));
  messages.local = [reply("local", 1)];
  messages.remote = [reply("remote", 1)];
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(mocks.notify.mock.calls.map(([id, , visible]) => [id, visible])).toEqual([
    ['assistant:["env-local","main"]', false], ['assistant:["env-remote","main"]', true],
  ]);
});
