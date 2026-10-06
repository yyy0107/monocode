// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantChat } from "./AssistantChat";
import { MobileAssistant } from "../../../mobile/MobileAssistant";
import { fullAssistantPolicy, type AssistantMessage } from "../model/assistant";

vi.mock("./AssistantWorkerDetails", () => ({
  AssistantWorkerDetails: () => null,
}));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
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
async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}
const text =
  "这是一段没有空格的助理回复，应该像普通会话一样逐字显示，而不是把整批文字直接放进气泡。";
const reply = (streaming: boolean): AssistantMessage => ({
  id: "reply",
  kind: "assistant",
  text,
  streaming,
  createdAt: 1,
  revision: 1,
});
async function mount(mobile: boolean, initial: AssistantMessage[] = []) {
  let entries = initial;
  const rpc = vi.fn(async (method: string) => {
    if (method === "environment.describe")
      return { capabilities: ["assistant.v1"] };
    if (method === "assistant.get")
      return {
        id: "a",
        name: "Assistant",
        lifecycle: "running",
        enabled: true,
        triggers: { user: true },
        policy: fullAssistantPolicy(),
      };
    if (method === "assistant.messages")
      return {
        entries,
        nextRevision: entries.at(-1)?.revision ?? 0,
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
  return (next: AssistantMessage[]) => {
    entries = next;
  };
}
const shown = () =>
  node.querySelector(".assistant-markdown")?.textContent ?? "";
it.each([
  [false, true],
  [false, false],
  [true, true],
  [true, false],
])(
  "paces the first Chinese batch (mobile=%s, streaming=%s), including already completed replies",
  async (mobile, streaming) => {
    const update = await mount(mobile);
    update([reply(streaming)]);
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await flush();
    expect(shown()).toBe("");
    act(() => vi.advanceTimersByTime(100));
    expect(shown().length).toBeGreaterThan(0);
    expect(shown().length).toBeLessThan(text.length);
    expect(text.startsWith(shown())).toBe(true);
    expect(node.querySelector(".word-fading")).toBeNull();
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      await flush();
    }
    expect(shown()).toBe(text);
  },
);
it.each([false, true])(
  "shows existing history immediately and paces only later additions (mobile=%s)",
  async (mobile) => {
    const update = await mount(mobile, [reply(true)]);
    expect(shown()).toBe(text);
    const extra = "这里是后来到达的新增文字，也应该逐字展示。";
    update([{ ...reply(false), text: text + extra, revision: 2 }]);
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await flush();
    expect(shown()).toBe(text);
    act(() => vi.advanceTimersByTime(100));
    expect(shown().startsWith(text)).toBe(true);
    expect(shown().length).toBeGreaterThan(text.length);
    expect(shown().length).toBeLessThan(text.length + extra.length);
  },
);
