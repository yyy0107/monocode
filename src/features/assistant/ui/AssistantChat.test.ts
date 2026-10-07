import { SurfaceVisibilityContext } from "../../../shared/ui/SurfaceVisibility";
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantChat } from "./AssistantChat";
import { AssistantSettings } from "./AssistantSettings";
import {
  fullAssistantPolicy,
  type AssistantMessage,
  type AssistantPatch,
  type AssistantView,
} from "../model/assistant";
import { setUiLanguage } from "../../../shared/i18n/language";
import { LAYER } from "../../../shared/lib/layers";
vi.mock("./AssistantWorkerDetails", () => ({
  AssistantWorkerDetails: () => createElement("div", null, "Read-only worker"),
}));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  setUiLanguage("en");
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
function disclosure(name: string) {
  return [...node.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) =>
      b.textContent === name ||
      b.querySelector(".assistant-settings-disclosure-title")?.textContent ===
        name,
  )!;
}
async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
it("uses capability fallback without polling an old Host", async () => {
  const rpc = vi.fn(async () => ({ capabilities: [] }));
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "old",
        hostName: "Old Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  await act(async () => {
    vi.advanceTimersByTime(6000);
  });
  expect(node.textContent).toContain("Assistant is unavailable on this Host");
  expect(rpc.mock.calls).toHaveLength(1);
});
it.each([false, true])("gates shared Feishu settings on the Host capability (%s)", async (supported) => {
  const rpc = vi.fn(async (method: string) => {
    if (method === "environment.describe") return { capabilities: ["assistant.v1", ...(supported ? ["im.feishu.v1"] : [])] };
    if (method === "assistant.get") return null;
    if (method === "models.list") return { models: {}, errors: {} };
    if (method === "projects.list") return [];
    if (method === "im.get") return { configured: false, status: { state: "stopped" }, pending: 0, deliveries: [] };
    throw new Error(`Unexpected method: ${method}`);
  });
  act(() => root.render(createElement(AssistantChat, {
    hostKey: "host", hostName: "Host", rpc: rpc as any, onOpen: () => {},
  })));
  await flush();
  act(() => disclosure("Feishu").click());
  await flush();
  if (supported) {
    expect(rpc).toHaveBeenCalledWith("im.get", {});
    expect(node.textContent).toContain("Enable the assistant before connecting Feishu.");
  } else {
    expect(rpc).not.toHaveBeenCalledWith("im.get", {});
    expect(node.textContent).toContain("This Host does not support Feishu.");
  }
});
it("renders only public replies and one updated card without transcript logs", async () => {
  const card: AssistantMessage = {
    kind: "session-card",
    id: "card",
    revision: 2,
    createdAt: 1,
    ref: { environmentId: "host", projectId: "project", sessionId: "target" },
    title: "Fix test",
    projectName: "Project",
    harness: "codex",
    model: "test",
    actionId: "a",
    status: "queued",
  };
  const messages: AssistantMessage[] = [
    {
      kind: "assistant",
      id: "reply",
      revision: 1,
      createdAt: 1,
      text: "Task started",
    },
    card,
    { ...card, revision: 3, status: "running" },
  ];
  const view = {
    id: "a",
    name: "Assistant",
    lifecycle: "idle",
    revision: 1,
    enabled: true,
    triggers: { user: true, event: true, schedule: true },
    brainGeneration: 1,
    policy: fullAssistantPolicy(),
  };
  const rpc = vi.fn(async (method: string) =>
    method === "environment.describe"
      ? { capabilities: ["assistant.v1"] }
      : method === "assistant.get"
        ? { ...view }
        : method === "assistant.messages"
          ? { entries: messages, nextRevision: 3, hasMore: false }
          : method === "models.list"
            ? { models: {}, errors: {} }
            : [],
  );
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  expect(node.querySelectorAll('[data-session-id="target"]')).toHaveLength(1);
  expect(node.textContent).toContain("Task started");
  const runningStatus = node.querySelector('.assistant-card [role="status"]')!;
  expect(runningStatus.getAttribute("aria-label")).toBe("Running");
  expect(runningStatus.textContent).toBe("");
  expect(runningStatus.querySelector("svg.animate-spin")).not.toBeNull();
  expect(node.querySelectorAll(".tool-block, .reasoning-block")).toHaveLength(
    0,
  );
  expect(
    rpc.mock.calls.some(
      ([method]) => method === "events.read" || method === "sessions.sync",
    ),
  ).toBe(false);
  const cardButton = node.querySelector<HTMLButtonElement>(
    ".assistant-card button",
  )!;
  expect(cardButton.disabled).toBe(false);
  view.policy = { ...fullAssistantPolicy(), allowedProjects: [] };
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await flush();
  expect(cardButton.disabled).toBe(true);
  act(() => cardButton.click());
  expect(rpc.mock.calls.some(([method]) => method === "sessions.get")).toBe(
    false,
  );
});
it("updates one streaming bubble during a turn and settles it without interrupting history reading", async () => {
  const reply = {
    kind: "assistant",
    id: "stream",
    revision: 1,
    createdAt: 1,
    text: "Hello",
    streaming: true,
  };
  const view = {
    id: "a",
    name: "Assistant",
    lifecycle: "running",
    revision: 1,
    enabled: true,
    triggers: { user: true, event: false, schedule: false },
    brainGeneration: 1,
    policy: fullAssistantPolicy(),
  };
  const rpc = vi.fn(async (method: string) =>
    method === "environment.describe"
      ? { capabilities: ["assistant.v1"] }
      : method === "assistant.get"
        ? { ...view }
        : method === "assistant.messages"
          ? {
              entries: [{ ...reply }],
              nextRevision: reply.revision,
              hasMore: false,
            }
          : method === "models.list"
            ? { models: {}, errors: {} }
            : [],
  );
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "stream",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const bubble = node.querySelector(".assistant-message-assistant")!;
  expect(bubble.getAttribute("data-streaming")).toBe("true");
  expect(node.querySelector(".assistant-working")).toBeNull();
  const log = node.querySelector<HTMLDivElement>(".assistant-messages")!;
  Object.defineProperty(log, "scrollHeight", { value: 1000 });
  Object.defineProperty(log, "clientHeight", { value: 200 });
  log.scrollTop = 100;
  const scroll = vi.fn();
  log.scrollTo = scroll;
  act(() => log.dispatchEvent(new Event("scroll")));
  reply.text = "Hello world";
  reply.revision++;
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
  await flush();
  expect(node.querySelectorAll(".assistant-message-assistant")).toHaveLength(1);
  expect(node.querySelector(".assistant-message-assistant")).toBe(bubble);
  expect(scroll).not.toHaveBeenCalled();
  reply.streaming = false;
  reply.revision++;
  view.lifecycle = "idle";
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
  await flush();
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(bubble.hasAttribute("data-streaming")).toBe(false);
  expect(bubble.textContent).toContain("Hello world");
  expect(node.querySelector(".assistant-working")).toBeNull();
});
it("defaults to all permissions and animates permission disclosure in both directions", async () => {
  let saved: AssistantPatch | undefined;
  act(() =>
    root.render(
      createElement(AssistantSettings, {
        value: null,
        catalog: {
          models: { codex: [{ id: "test", name: "Test" }] },
          errors: {},
        },
        projects: [],
        busy: false,
        onSave: async (value) => {
          saved = value;
        },
      }),
    ),
  );
  expect(disclosure("Assistant permissions")).toBeUndefined();
  act(() => disclosure("Advanced").click());
  const button = disclosure("Assistant permissions");
  const fold = () =>
    button.closest("section")!.querySelector(":scope > .zen-fold-item");
  act(() => button.click());
  expect(fold()?.getAttribute("data-fold-state")).toBe("opening");
  const checks = [
    ...node.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ];
  expect(checks).toHaveLength(20);
  expect(checks.every((input) => input.checked)).toBe(true);
  act(() =>
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(saved?.policy).toEqual(fullAssistantPolicy());
  expect(saved?.runtimeMode).toBe("full-access");
  act(() => button.click());
  expect(fold()?.getAttribute("data-fold-state")).toBe("closing");
  expect((fold() as HTMLElement | null)?.inert).toBe(true);
  act(() => button.click());
  expect(fold()?.getAttribute("data-fold-state")).toBe("opening");
  act(() => button.click());
  act(() => vi.advanceTimersByTime(351));
  expect(fold()).toBeNull();
});
it("localizes settings and honors reduced motion", () => {
  setUiLanguage("zh-CN");
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  act(() =>
    root.render(
      createElement(AssistantSettings, {
        value: null,
        catalog: { models: {}, errors: {} },
        projects: [],
        busy: false,
        onSave: async () => {},
      }),
    ),
  );
  expect(node.textContent).toContain("权限与唤醒");
  act(() => disclosure("高级").click());
  const button = disclosure("助理权限");
  const fold = () =>
    button.closest("section")!.querySelector(":scope > .zen-fold-item");
  act(() => button.click());
  expect(fold()?.getAttribute("data-fold-state")).toBe("open");
  act(() => button.click());
  expect(fold()).toBeNull();
});

function setValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(input);
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function rename(value: string) {
  const name = [...node.querySelectorAll("label")]
    .find((l) => l.textContent?.startsWith("Assistant name"))!
    .querySelector("input")!;
  setValue(name, value);
}
function configuredView(): AssistantView {
  return {
    id: "a",
    name: "Assistant",
    revision: 1,
    chatRevision: 0,
    enabled: true,
    lifecycle: "idle",
    harness: "codex",
    model: "test",
    modelSettings: {},
    runtimeMode: "full-access",
    targetRuntimeMode: "full-access",
    policy: fullAssistantPolicy(),
    policyVersion: 1,
    triggers: { user: true, event: true, schedule: true },
    schedules: [],
    watches: [],
    maxAutoTurns: 8,
    chainWindowMinutes: 15,
    brainGeneration: 1,
  };
}
it("keeps the edited settings revision until an explicit reload after a competing save", async () => {
  let view = configuredView();
  const rpc = vi.fn(
    async (method: string, params?: Record<string, unknown>) => {
      if (method === "environment.describe")
        return { capabilities: ["assistant.v1"] };
      if (method === "assistant.get") return view;
      if (method === "assistant.messages")
        return { entries: [], nextRevision: 0, hasMore: false };
      if (method === "models.list")
        return {
          models: { codex: [{ id: "test", name: "Test" }] },
          errors: {},
        };
      if (method === "assistant.configure") {
        if (params?.expectedRevision !== view.revision)
          throw new Error("Assistant settings changed. Reload before saving.");
        return { revision: view.revision + 1 };
      }
      return [];
    },
  );
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  act(() =>
    node.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click(),
  );
  view = { ...view, revision: 2, name: "Changed elsewhere" };
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await flush();
  const submit = () => {
    rename(`Renamed ${Math.random()}`);
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
  act(submit);
  await flush();
  expect(node.querySelector('[role="alert"]')?.textContent).toContain(
    "settings changed",
  );
  expect(
    rpc.mock.calls.find(([method]) => method === "assistant.configure")?.[1]
      ?.expectedRevision,
  ).toBe(1);
  act(() =>
    [...node.querySelectorAll("button")]
      .find((b) => b.textContent === "Reload settings")!
      .click(),
  );
  act(submit);
  await flush();
  expect(
    rpc.mock.calls
      .filter(([method]) => method === "assistant.configure")
      .at(-1)?.[1]?.expectedRevision,
  ).toBe(2);
});
it("sends necessary input with its exact run and generation rather than a chat prompt", async () => {
  const input: AssistantMessage = {
    id: "approval",
    kind: "input",
    revision: 1,
    createdAt: 1,
    text: "Allow execution?",
    inputKind: "approval",
    brainGeneration: 3,
    runId: "current-run",
    requestId: 7,
    resolved: false,
  };
  const rpc = vi.fn(async (method: string, _params?: object) => {
    if (method === "environment.describe")
      return { capabilities: ["assistant.v1"] };
    if (method === "assistant.get") return configuredView();
    if (method === "assistant.messages")
      return { entries: [input], nextRevision: 1, hasMore: false };
    if (method === "models.list") return { models: {}, errors: {} };
    return [];
  });
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  act(() =>
    [...node.querySelectorAll("button")]
      .find((b) => b.textContent === "Allow")!
      .click(),
  );
  await flush();
  expect(
    rpc.mock.calls.find(([method]) => method === "assistant.respond")?.[1],
  ).toMatchObject({
    messageId: "approval",
    brainGeneration: 3,
    runId: "current-run",
    requestId: 7,
    decision: "allow",
  });
  expect(rpc.mock.calls.some(([method]) => method === "assistant.send")).toBe(
    false,
  );
});

function chatRpc(view: AssistantView, entries: AssistantMessage[] = []) {
  return vi.fn(async (method: string, _params?: object) => {
    if (method === "environment.describe")
      return { capabilities: ["assistant.v1"] };
    if (method === "assistant.get") return view;
    if (method === "assistant.messages")
      return { entries, nextRevision: entries.length, hasMore: false };
    if (method === "assistant.send") return { accepted: true };
    if (method === "models.list")
      return { models: { codex: [{ id: "test", name: "Test" }] }, errors: {} };
    return [];
  });
}
it("centers timestamps before the first message and gaps of at least five minutes without regrouping revisions", async () => {
  setUiLanguage("zh-CN");
  const start = new Date(2026, 9, 5, 14, 52).getTime();
  const messages: AssistantMessage[] = [0, 299999, 599998, 899998].map(
    (offset, index) => ({
      kind: "user",
      id: `message-${index}`,
      revision: index + 1,
      createdAt: start + offset,
      text: `Message ${index}`,
      readAt: null,
    }),
  );
  const rpc = chatRpc(configuredView(), messages);
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "dates",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const separators = () => [
    ...node.querySelectorAll<HTMLTimeElement>(".assistant-date-separator"),
  ];
  expect(separators().map((time) => time.dateTime)).toEqual([
    new Date(start).toISOString(),
    new Date(start + 899998).toISOString(),
  ]);
  expect(separators()[0].textContent).toContain("10月5日");
  expect(separators()[0].textContent).toContain("14:52");
  expect(separators()[1].nextElementSibling?.textContent).toContain(
    "Message 3",
  );
  expect(separators()[0].parentElement?.getAttribute("role")).toBe("log");
  messages[3] = {
    ...messages[3],
    revision: 5,
    readAt: start + 900000,
  } as AssistantMessage;
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await flush();
  expect(separators()).toHaveLength(2);
  expect(separators()[1].dateTime).toBe(new Date(start + 899998).toISOString());
});
it("renders assistant replies as Markdown and keeps user text literal", async () => {
  const rpc = chatRpc(configuredView(), [
    { kind: "user", id: "u", revision: 1, createdAt: 1, text: "**literal**" },
    {
      kind: "assistant",
      id: "a",
      revision: 2,
      createdAt: 2,
      text: "Done with **two** tasks",
    },
  ] as AssistantMessage[]);
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  expect(
    node.querySelector(
      '.assistant-message-assistant [data-streamdown="strong"]',
    )?.textContent,
  ).toBe("two");
  expect(
    node.querySelector(".assistant-message-user > span")?.textContent,
  ).toBe("**literal**");
});
it("quotes a reply from the desktop context menu without replacing the draft or sending early", async () => {
  const rpc = chatRpc(configuredView(), [
    {
      kind: "assistant",
      id: "reply",
      revision: 1,
      createdAt: 1,
      text: "First line\nSecond **line**",
    },
  ]);
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const field = node.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Message assistant"]',
  )!;
  act(() => setValue(field, "Please expand"));
  const bubble = node.querySelector(".assistant-message-assistant")!;
  act(() =>
    bubble.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 80,
        clientY: 100,
      }),
    ),
  );
  const menu = document.querySelector('[role="menu"][aria-label="Reply"]')!;
  expect(menu).not.toBeNull();
  expect(Number((menu.parentElement as HTMLElement).style.zIndex)).toBe(
    LAYER.popover,
  );
  act(() =>
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click(),
  );
  expect(field.value).toBe("> First line\n> Second **line**\n\nPlease expand");
  expect(document.activeElement).toBe(field);
  expect(
    document.querySelector('[role="menu"][aria-label="Reply"]'),
  ).toBeNull();
  expect(rpc.mock.calls.some(([method]) => method === "assistant.send")).toBe(
    false,
  );
  act(() =>
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await flush();
  expect(
    rpc.mock.calls.find(([method]) => method === "assistant.send")?.[1],
  ).toMatchObject({ text: "> First line\n> Second **line**\n\nPlease expand" });
});
it("closes the reply portal when its workspace page is hidden and retains the draft", async () => {
  const rpc = chatRpc(configuredView(), [
    {
      kind: "assistant",
      id: "reply",
      revision: 1,
      createdAt: 1,
      text: "Hello",
    },
  ]);
  const render = (visible: boolean) =>
    act(() =>
      root.render(
        createElement(
          SurfaceVisibilityContext.Provider,
          { value: visible },
          createElement(AssistantChat, {
            hostKey: "host",
            hostName: "Host",
            rpc: rpc as any,
            onOpen: () => {},
          }),
        ),
      ),
    );
  render(true);
  await flush();
  const field = node.querySelector<HTMLTextAreaElement>("textarea")!;
  act(() => setValue(field, "Keep draft"));
  act(() =>
    node
      .querySelector(".assistant-message-assistant")!
      .dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      ),
  );
  expect(
    document.querySelector('[role="menu"][aria-label="Reply"]'),
  ).not.toBeNull();
  render(false);
  expect(
    document.querySelector('[role="menu"][aria-label="Reply"]'),
  ).toBeNull();
  render(true);
  await flush();
  expect(node.querySelector("textarea")).toBe(field);
  expect(field.value).toBe("Keep draft");
});
it("sends on Enter but not on Shift+Enter in the desktop composer", async () => {
  const rpc = chatRpc(configuredView());
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const field = node.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Message assistant"]',
  )!;
  act(() => setValue(field, "Check progress"));
  const key = (shiftKey: boolean) =>
    act(() => {
      field.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  key(true);
  await flush();
  expect(rpc.mock.calls.some(([m]) => m === "assistant.send")).toBe(false);
  key(false);
  await flush();
  expect(rpc.mock.calls.some(([m]) => m === "assistant.send")).toBe(true);
});
it.each([false, true])("shows desktop send loading until delivery succeeds or fails (failure: %s)", async (failed) => {
  const base = chatRpc(configuredView());
  let finish!: () => void;
  let pending = new Promise<void>((resolve) => { finish = resolve; });
  let fail = failed;
  const rpc = vi.fn(async (method: string, params?: object) => {
    if (method === "assistant.send") {
      await pending;
      if (fail) throw new Error("Host disconnected");
    }
    return base(method, params);
  });
  act(() => root.render(createElement(AssistantChat, {
    hostKey: "host", hostName: "Host", rpc: rpc as any, onOpen: () => {},
  })));
  await flush();
  const field = node.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message assistant"]')!;
  act(() => setValue(field, "Send this message"));
  const send = node.querySelector<HTMLButtonElement>(".assistant-send")!;
  const expectLoading = () => {
    expect(send.getAttribute("aria-busy")).toBe("true");
    expect(send.getAttribute("aria-label")).toBe("Sending...");
    expect(send.querySelector(".animate-spin")).not.toBeNull();
    expect(send.disabled).toBe(true);
    expect(field.value).toBe("Send this message");
  };
  const expectIdle = () => {
    expect(send.getAttribute("aria-busy")).toBeNull();
    expect(send.getAttribute("aria-label")).toBe("Send");
    expect(send.querySelector(".animate-spin")).toBeNull();
  };
  act(() => send.click());
  expectLoading();
  act(() => {
    send.click();
    send.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(rpc.mock.calls.filter(([method]) => method === "assistant.send")).toHaveLength(1);
  finish();
  await flush();
  expectIdle();
  expect(field.value).toBe(failed ? "Send this message" : "");
  if (failed) {
    fail = false;
    pending = new Promise<void>((resolve) => { finish = resolve; });
    act(() => [...node.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent === "Retry message")!.click());
    expectLoading();
    finish();
    await flush();
    expectIdle();
    expect(field.value).toBe("");
  }
});
it("retains a failed send's draft and clears its saved text immediately after a successful retry", async () => {
  const key = "monocode.assistant-draft:host";
  localStorage.setItem(key, "Saved before typing");
  const base = chatRpc(configuredView());
  let fail = true;
  const rpc = vi.fn(async (method: string, params?: object) => {
    if (method === "assistant.send" && fail) throw new Error("Host disconnected");
    return base(method, params);
  });
  act(() => root.render(createElement(AssistantChat, {
    hostKey: "host", hostName: "Host", rpc: rpc as any, onOpen: () => {},
  })));
  await flush();
  const field = node.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message assistant"]')!;
  expect(field.value).toBe("Saved before typing");
  act(() => setValue(field, "Retry this exact draft"));
  const send = () => act(() => field.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter", bubbles: true, cancelable: true,
  })));
  send();
  await flush();
  expect(field.value).toBe("Retry this exact draft");
  expect(localStorage.getItem(key)).toBe("Saved before typing");
  act(() => vi.advanceTimersByTime(300));
  expect(localStorage.getItem(key)).toBe("Retry this exact draft");
  fail = false;
  act(() => [...node.querySelectorAll<HTMLButtonElement>("button")]
    .find(button => button.textContent === "Retry message")!.click());
  await flush();
  expect(field.value).toBe("");
  expect(localStorage.getItem(key)).toBe("");
  act(() => vi.advanceTimersByTime(300));
  expect(localStorage.getItem(key)).toBe("");
});
it("enables saving only for changed, valid settings", () => {
  const onSave = vi.fn(async () => {});
  act(() =>
    root.render(
      createElement(AssistantSettings, {
        value: configuredView(),
        catalog: {
          models: { codex: [{ id: "test", name: "Test" }] },
          errors: {},
        },
        projects: [],
        busy: false,
        onSave,
      }),
    ),
  );
  const save = [...node.querySelectorAll("button")].find(
    (b) => b.textContent === "Save settings",
  )!;
  expect(save.disabled).toBe(true);
  act(() => rename("Helper"));
  expect(save.disabled).toBe(false);
  act(() => disclosure("Advanced").click());
  act(() => disclosure("Assistant wakeups").click());
  const interval = node.querySelector<HTMLInputElement>(
    'input[aria-label="Interval"]',
  )!;
  act(() => setValue(interval, "0"));
  expect(interval.getAttribute("aria-invalid")).toBe("true");
  act(() => save.click());
  expect(onSave).not.toHaveBeenCalled();
  act(() => vi.runOnlyPendingTimers());
  expect(document.activeElement).toBe(interval);
  act(() => setValue(interval, "2"));
  act(() =>
    node
      .querySelector<HTMLButtonElement>('button[aria-label^="Interval unit"]')!
      .click(),
  );
  act(() =>
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((o) => o.textContent?.includes("Hours"))!
      .click(),
  );
  act(() => save.click());
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Helper",
      schedules: [expect.objectContaining({ intervalMinutes: 120 })],
    }),
  );
});
it("offers Continue inside an interruption notice", async () => {
  const rpc = chatRpc({
    ...configuredView(),
    lifecycle: "interrupted",
    error: "Host restarted while the assistant was working.",
  });
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const notice = node.querySelector('[role="alert"]')!;
  act(() =>
    [...notice.querySelectorAll("button")]
      .find((b) => b.textContent === "Continue")!
      .click(),
  );
  await flush();
  expect(
    rpc.mock.calls.find(([m]) => m === "assistant.control")?.[1],
  ).toMatchObject({ action: "resume", expectedGeneration: 1 });
});
it("explains an unsupported Host bridge and reconnects on retry", async () => {
  const base = chatRpc(configuredView());
  let rejected = false;
  const rpc = vi.fn(async (method: string, params?: object) => {
    if (method === "environment.describe" && !rejected) {
      rejected = true;
      throw "Unsupported remote operation";
    }
    return base(method, params);
  });
  act(() =>
    root.render(
      createElement(AssistantChat, {
        hostKey: "host",
        hostName: "Host",
        rpc: rpc as any,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  const notice = node.querySelector('[role="alert"]')!;
  expect(notice.textContent).toContain("Update MonoCode");
  expect(notice.textContent).not.toContain("Unsupported remote operation");
  act(() =>
    [...notice.querySelectorAll("button")]
      .find((b) => b.textContent === "Retry")!
      .click(),
  );
  await flush();
  expect(
    rpc.mock.calls.filter(([m]) => m === "environment.describe"),
  ).toHaveLength(2);
  expect(node.querySelector(".assistant-conversation")).not.toBeNull();
});

it("only acknowledges messages while the assistant page and document are visible", async () => {
  const rpc = chatRpc(configuredView(), [
    { kind: "assistant", id: "reply", revision: 1, createdAt: 1, text: "Hello" },
  ]);
  const render = (visible: boolean) => act(() => root.render(
    createElement(SurfaceVisibilityContext.Provider, { value: visible },
      createElement(AssistantChat, { hostKey: "read-host", hostName: "Host", rpc: rpc as any, onOpen: () => {} })),
  ));
  const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  try {
    render(false);
    await flush();
    expect(localStorage.getItem("monocode.assistant-read:read-host")).toBeNull();
    render(true);
    await flush();
    expect(localStorage.getItem("monocode.assistant-read:read-host")).toBeNull();
    state.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(localStorage.getItem("monocode.assistant-read:read-host")).toBe("1");
  } finally {
    state.mockRestore();
  }
});
