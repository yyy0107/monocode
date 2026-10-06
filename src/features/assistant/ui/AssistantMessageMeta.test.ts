// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";
import { AssistantChat } from "./AssistantChat";
import { MobileAssistant } from "../../../mobile/MobileAssistant";
import { fullAssistantPolicy, type AssistantMessage } from "../model/assistant";
import { setUiLanguage } from "../../../shared/i18n/language";

vi.mock("./AssistantWorkerDetails", () => ({
  AssistantWorkerDetails: () => null,
}));
vi.mock("@capacitor/clipboard", () => ({ Clipboard: { write: vi.fn() } }));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}
const sentAt = Date.UTC(2026, 9, 5, 12, 30);
async function mount(mobile: boolean) {
  let messages: AssistantMessage[] = [
    {
      id: "user",
      kind: "user",
      revision: 1,
      createdAt: sentAt,
      text: "My draft",
      readAt: null,
    },
    {
      id: "reply",
      kind: "assistant",
      revision: 2,
      createdAt: sentAt + 5000,
      text: "**Original**\nreply",
    },
  ];
  const rpc = vi.fn(async (method: string) => {
    if (method === "environment.describe")
      return { capabilities: ["assistant.v1"] };
    if (method === "assistant.get")
      return {
        id: "a",
        name: "Assistant",
        enabled: true,
        lifecycle: "idle",
        triggers: { user: true },
        policy: fullAssistantPolicy(),
      };
    if (method === "assistant.messages")
      return {
        entries: messages,
        nextRevision: Math.max(...messages.map((m) => m.revision)),
        hasMore: false,
      };
    if (method === "models.list") return { models: {}, errors: {} };
    return [];
  });
  act(() =>
    root.render(
      createElement(mobile ? MobileAssistant : AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  return () => {
    messages = messages.map((m) =>
      m.id === "user" ? { ...m, readAt: sentAt + 6000, revision: 3 } : m,
    );
  };
}
it.each([false, true])(
  "shows Host read state and stable send time; copies only message text (mobile=%s)",
  async (mobile) => {
    const markRead = await mount(mobile);
    const user = node.querySelector(".assistant-message-row-user")!;
    expect(
      node.querySelector(".assistant-message .assistant-message-meta"),
    ).toBeNull();
    expect(user.querySelector(".assistant-read-state")?.textContent).toBe(
      "Unread",
    );
    expect(
      node.querySelector(
        ".assistant-message-row-assistant .assistant-read-state",
      ),
    ).toBeNull();
    expect(user.querySelector("time")?.dateTime).toBe(
      new Date(sentAt).toISOString(),
    );
    const copy = node.querySelector<HTMLButtonElement>(
      '.assistant-message-row-assistant button[aria-label="Copy message"]',
    )!;
    await act(async () => copy.click());
    expect(await navigator.clipboard.readText()).toBe("**Original**\nreply");
    expect(copy.getAttribute("aria-label")).toBe("Copied");
    markRead();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await flush();
    expect(user.querySelector(".assistant-read-state")?.textContent).toBe(
      "Read",
    );
    expect(user.querySelector("time")?.dateTime).toBe(
      new Date(sentAt).toISOString(),
    );
    expect(node.querySelectorAll(".assistant-message-row-user")).toHaveLength(
      1,
    );
  },
);
it("uses the native mobile clipboard and localizes receipt labels", async () => {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  const write = vi.spyOn(Clipboard, "write").mockResolvedValue();
  setUiLanguage("zh-CN");
  await mount(true);
  expect(node.querySelector(".assistant-read-state")?.textContent).toBe("未读");
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>(
        '.assistant-message-row-assistant button[aria-label="复制消息"]',
      )!
      .click(),
  );
  expect(write).toHaveBeenCalledWith({ string: "**Original**\nreply" });
  expect(
    node.querySelector(
      '.assistant-message-row-assistant button[aria-label="已复制"]',
    ),
  ).not.toBeNull();
});
it("surfaces a clipboard failure without claiming success", async () => {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.spyOn(Clipboard, "write").mockRejectedValue(
    new Error("Clipboard unavailable"),
  );
  await mount(true);
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>(
        '.assistant-message-row-assistant button[aria-label="Copy message"]',
      )!
      .click(),
  );
  expect(node.querySelector('[role="alert"]')?.textContent).toContain(
    "Clipboard unavailable",
  );
  expect(node.querySelector('button[aria-label="Copied"]')).toBeNull();
});
