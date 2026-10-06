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
  hosts: [] as { id: string; environmentId: string; capabilities: string[] }[],
}));
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
    if (method === "assistant.get") return { id: "assistant" };
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
  expect(button().textContent).toContain("Remote task finished");
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
