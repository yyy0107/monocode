// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileAssistant, type MobileAssistantHandle } from "./MobileAssistant";
import {
  fullAssistantPolicy,
  type AssistantMessage,
  type AssistantView,
} from "../features/assistant/model/assistant";
import type { AssistantRpc } from "../features/assistant/model/assistantClient";
import { setUiLanguage } from "../shared/i18n/language";

vi.mock("../features/assistant/ui/AssistantWorkerDetails", () => ({
  AssistantWorkerDetails: () => null,
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
  vi.restoreAllMocks();
});
async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}
function fixture() {
  let view: AssistantView = {
    id: "a",
    name: "Assistant",
    revision: 1,
    chatRevision: 0,
    lifecycle: "idle",
    enabled: true,
    harness: "codex",
    model: "test",
    modelSettings: {},
    runtimeMode: "full-access",
    targetRuntimeMode: "full-access",
    policy: fullAssistantPolicy(),
    policyVersion: 1,
    triggers: { user: true, event: true, schedule: true },
    schedules: [],
    watches: [
      {
        id: "activity",
        enabled: true,
        projectIds: [],
        sessionIds: [],
        eventKinds: ["completed"],
        prompt: "Follow progress",
      },
    ],
    maxAutoTurns: 8,
    chainWindowMinutes: 15,
    brainGeneration: 3,
  };
  let messages: AssistantMessage[] = [];
  let failSend = false;
  const rpc = vi.fn(async (method: string, params?: any) => {
    if (method === "environment.describe")
      return { capabilities: ["assistant.v1"] };
    if (method === "assistant.get") return view;
    if (method === "assistant.messages")
      return {
        entries: messages,
        nextRevision: messages.length,
        hasMore: false,
      };
    if (method === "models.list")
      return { models: { codex: [{ id: "test", name: "Test" }] }, errors: {} };
    if (method === "projects.list")
      return [{ id: "project", name: "Project", cwd: "/project" }];
    if (method === "assistant.configure") {
      if (params.expectedRevision !== view.revision)
        throw new Error("Assistant settings changed. Reload before saving.");
      view = { ...view, ...params.patch, revision: view.revision + 1 };
    }
    if (method === "assistant.control")
      view = {
        ...view,
        lifecycle: params.action === "pause" ? "paused" : "idle",
      };
    if (method === "assistant.send" && failSend)
      throw new Error("Host connection failed");
    if (method === "attachments.upload")
      return { offset: params.offset + atob(params.data).length };
    return {};
  });
  return {
    rpc,
    view: () => view,
    update: (patch: Partial<AssistantView>) => {
      view = { ...view, ...patch };
    },
    messages: (entries: AssistantMessage[]) => {
      messages = entries;
    },
    failSend: (fail: boolean) => {
      failSend = fail;
    },
  };
}
function button(name: string) {
  const result = [...node.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) =>
      b.getAttribute("aria-label") === name ||
      b.textContent === name ||
      b.querySelector(".assistant-settings-disclosure-title")?.textContent ===
        name,
  );
  expect(result, name).toBeDefined();
  return result!;
}
function type(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  act(() => {
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function mount() {
  const data = fixture(),
    ref = createRef<MobileAssistantHandle>(),
    close = vi.fn();
  act(() =>
    root.render(
      createElement(MobileAssistant, {
        hostKey: "host",
        hostName: "Host",
        rpc: data.rpc as AssistantRpc,
        ref,
        onOpen: () => {},
        onClose: close,
      }),
    ),
  );
  await flush();
  return { ...data, ref, close };
}
it("opens Reply on a stationary long press, cancels scrolling holds and closes with Back", async () => {
  const data = await mount();
  data.messages([
    {
      kind: "assistant",
      id: "reply",
      revision: 1,
      createdAt: 1,
      text: "A result",
    },
  ]);
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await flush();
  const bubble = node.querySelector(".assistant-message-assistant")!;
  const field = node.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Message assistant"]',
  )!;
  type(field, "Explain this");
  const pointer = (type: string, y = 100) =>
    act(() =>
      bubble.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerType: "touch",
          button: 0,
          clientX: 80,
          clientY: y,
        }),
      ),
    );
  pointer("pointerdown");
  pointer("pointermove", 130);
  act(() => vi.advanceTimersByTime(500));
  expect(node.querySelector('[role="dialog"][aria-label="Reply"]')).toBeNull();
  pointer("pointerdown");
  act(() => vi.advanceTimersByTime(449));
  expect(node.querySelector('[role="dialog"][aria-label="Reply"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(
    node.querySelector('[role="dialog"][aria-label="Reply"]'),
  ).not.toBeNull();
  pointer("pointerup");
  act(() => data.ref.current!.back());
  expect(data.close).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(400));
  expect(node.querySelector('[role="dialog"][aria-label="Reply"]')).toBeNull();
  pointer("pointerdown");
  act(() => vi.advanceTimersByTime(450));
  pointer("pointerup");
  act(() => button("Reply").click());
  expect(field.value).toBe("> A result\n\nExplain this");
  expect(document.activeElement).toBe(field);
  expect(
    data.rpc.mock.calls.some(([method]) => method === "assistant.send"),
  ).toBe(false);
});
it.each([true, false])(
  "waits for initial sync before deciding whether to show setup (configured: %s)",
  async (configured) => {
    const data = fixture();
    let resolve!: (view: AssistantView | null) => void;
    const pending = new Promise<AssistantView | null>((done) => {
      resolve = done;
    });
    const rpc: AssistantRpc = async <T>(method: string, params?: object) =>
      (method === "assistant.get"
        ? await pending
        : await data.rpc(method, params)) as T;
    act(() =>
      root.render(
        createElement(MobileAssistant, {
          hostKey: "host",
          hostName: "Host",
          rpc,
          onOpen: () => {},
        }),
      ),
    );
    await flush();
    await act(async () => vi.advanceTimersByTime(500));
    expect(node.textContent).toContain("Connecting…");
    expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
    expect(node.querySelector(".assistant-settings")).toBeNull();

    resolve(configured ? data.view() : null);
    await flush();
    if (configured) {
      expect(node.querySelector(".assistant-conversation")).not.toBeNull();
      expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
    } else {
      expect(
        node
          .querySelector(".mobile-assistant-settings-page")
          ?.getAttribute("aria-hidden"),
      ).not.toBe("true");
      expect(node.textContent).toContain("Set up assistant");
      expect(node.querySelector(".assistant-settings")).not.toBeNull();
    }
  },
);

it("keeps setup hidden after a failed initial sync and recovers on retry", async () => {
  const data = fixture();
  let failed = false;
  const rpc: AssistantRpc = async <T>(method: string, params?: object) => {
    if (method === "assistant.get" && !failed) {
      failed = true;
      throw new Error("Host connection failed");
    }
    return (await data.rpc(method, params)) as T;
  };
  act(() =>
    root.render(
      createElement(MobileAssistant, {
        hostKey: "host",
        hostName: "Host",
        rpc,
        onOpen: () => {},
      }),
    ),
  );
  await flush();
  expect(node.textContent).toContain("Host connection failed");
  expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
  await act(async () => vi.advanceTimersByTime(2000));
  await flush();
  expect(node.querySelector(".assistant-conversation")).not.toBeNull();
  expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
});

it("handles menu, settings and exit as separate back steps while retaining the draft", async () => {
  const data = await mount();
  const composer = node.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Message assistant"]',
  )!;
  type(composer, "Continue the project");
  act(() => button("Assistant options").click());
  act(() => data.ref.current!.back());
  expect(button("Assistant options").getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(data.close).not.toHaveBeenCalled();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  const page = node.querySelector<HTMLElement>(
    ".mobile-assistant-settings-page",
  )!;
  const sheet = page.closest<HTMLElement>(".mobile-sheet")!;
  const backdrop = sheet.closest<HTMLElement>(".mobile-sheet-backdrop")!;
  expect(backdrop.getAttribute("data-placement")).toBe("bottom");
  expect(backdrop.getAttribute("data-fold-state")).toBe("opening");
  expect(sheet.getAttribute("role")).toBe("dialog");
  expect(sheet.getAttribute("aria-label")).toBe("Assistant settings");
  expect(sheet.querySelector(".mobile-sheet-grip")).not.toBeNull();
  expect(
    node.querySelector<HTMLElement>(".assistant-conversation")!.inert,
  ).toBe(true);
  act(() => data.ref.current!.back());
  expect(backdrop.getAttribute("data-fold-state")).toBe("closing");
  expect(backdrop.inert).toBe(true);
  expect(composer.value).toBe("Continue the project");
  act(() => vi.advanceTimersByTime(119));
  expect(node.querySelector(".mobile-assistant-settings-page")).toBe(page);
  act(() => vi.advanceTimersByTime(12));
  expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
  act(() => data.ref.current!.back());
  expect(data.close).toHaveBeenCalledOnce();
});
it("reopens the settings sheet during closing without losing unsaved edits", async () => {
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  const page = node.querySelector<HTMLElement>(
    ".mobile-assistant-settings-page",
  )!;
  const backdrop = page.closest<HTMLElement>(".mobile-sheet-backdrop")!;
  const name = page.querySelector<HTMLInputElement>("input:not([type])")!;
  type(name, "Unsaved assistant name");
  act(() => data.ref.current!.back());
  act(() => vi.advanceTimersByTime(60));
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  expect(node.querySelector(".mobile-assistant-settings-page")).toBe(page);
  expect(backdrop.getAttribute("data-fold-state")).toBe("opening");
  expect(backdrop.inert).toBe(false);
  expect(name.value).toBe("Unsaved assistant name");
  act(() => vi.advanceTimersByTime(211));
  expect(backdrop.getAttribute("data-fold-state")).toBe("open");
  act(() => data.ref.current!.back());
  act(() => vi.advanceTimersByTime(131));
  expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
});
it("opens and closes the settings sheet immediately with reduced motion", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  const page = node.querySelector<HTMLElement>(
    ".mobile-assistant-settings-page",
  )!;
  expect(
    page.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
  ).toBe("open");
  act(() => data.ref.current!.back());
  expect(node.querySelector(".mobile-assistant-settings-page")).toBeNull();
  expect(data.close).not.toHaveBeenCalled();
});
it("uses the current generation for lifecycle controls from the phone menu", async () => {
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Pause").click());
  await flush();
  expect(
    data.rpc.mock.calls.find(([method]) => method === "assistant.control")?.[1],
  ).toMatchObject({ action: "pause", expectedGeneration: 3 });
  act(() => button("Assistant options").click());
  act(() => button("Continue").click());
  await flush();
  expect(
    data.rpc.mock.calls
      .filter(([method]) => method === "assistant.control")
      .at(-1)?.[1],
  ).toMatchObject({ action: "resume", expectedGeneration: 3 });
});
it("retains the settings revision during polling and saves phone project switches after reload", async () => {
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  data.update({ revision: 2, name: "Other device" });
  await act(async () => vi.advanceTimersByTime(2000));
  await flush();
  const name = [...node.querySelectorAll("label")]
    .find((l) => l.textContent?.startsWith("Assistant name"))!
    .querySelector("input")!;
  type(name, "Phone helper");
  act(() => button("Save settings").click());
  await flush();
  expect(node.querySelector('[role="alert"]')?.textContent).toContain(
    "settings changed",
  );
  expect(
    data.rpc.mock.calls.find(([m]) => m === "assistant.configure")?.[1]
      .expectedRevision,
  ).toBe(1);
  act(() => button("Reload settings").click());
  act(() => button("Advanced").click());
  act(() => button("Assistant wakeups").click());
  expect(node.querySelector("select[multiple]")).toBeNull();
  const all = node.querySelector<HTMLInputElement>(
    ".assistant-watch-projects .assistant-check input",
  )!;
  expect(all.checked).toBe(true);
  expect(
    node.querySelector(".assistant-watch-projects .assistant-chip"),
  ).toBeNull();
  act(() => all.click());
  const project = node.querySelector<HTMLInputElement>(
    ".assistant-watch-projects .assistant-chip input",
  )!;
  act(() => project.click());
  act(() => button("Save settings").click());
  await flush();
  const saved = data.rpc.mock.calls
    .filter(([m]) => m === "assistant.configure")
    .at(-1)![1];
  expect(saved.expectedRevision).toBe(2);
  expect(saved.patch.watches[0].projectIds).toEqual(["project"]);
  expect(
    node.querySelector<HTMLElement>(".assistant-conversation")!.inert,
  ).toBe(false);
});
it("keeps uploaded attachments across settings and retries a failed send with the same receipt ID", async () => {
  const data = await mount();
  const fileInput = node.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [new File(["content"], "notes.txt", { type: "text/plain" })],
  });
  act(() => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
  await flush();
  expect(
    node.querySelector(".mobile-assistant-attachments")?.textContent,
  ).toContain("notes.txt");
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  act(() => data.ref.current!.back());
  act(() => vi.advanceTimersByTime(351));
  expect(
    node.querySelector(".mobile-assistant-attachments")?.textContent,
  ).toContain("notes.txt");
  data.failSend(true);
  act(() => button("Send").click());
  await flush();
  const sent = data.rpc.mock.calls.find(([m]) => m === "assistant.send")![1];
  expect(sent.attachments[0].name).toBe("notes.txt");
  data.failSend(false);
  act(() => button("Retry message").click());
  await flush();
  expect(
    data.rpc.mock.calls.filter(([m]) => m === "assistant.send").at(-1)![1]
      .commandId,
  ).toBe(sent.commandId);
  expect(
    node
      .querySelector<HTMLElement>(".mobile-assistant-attachments")
      ?.closest<HTMLElement>(".zen-fold-item")?.inert,
  ).toBe(true);
  act(() => vi.advanceTimersByTime(351));
  expect(node.querySelector(".mobile-assistant-attachments")).toBeNull();
});
it("does not pull a reader to the bottom on polling, and follows messages once back at the bottom", async () => {
  const data = await mount();
  const log = node.querySelector<HTMLElement>('[role="log"]')!;
  Object.defineProperties(log, {
    scrollHeight: { value: 1000 },
    clientHeight: { value: 300 },
  });
  log.scrollTo = vi.fn();
  log.scrollTop = 100;
  act(() => log.dispatchEvent(new Event("scroll")));
  data.messages([
    {
      kind: "assistant",
      id: "reply",
      revision: 1,
      createdAt: 1,
      text: "Progress",
    },
  ]);
  await act(async () => vi.advanceTimersByTime(2000));
  await flush();
  expect(log.scrollTo).not.toHaveBeenCalled();
  log.scrollTop = 700;
  act(() => log.dispatchEvent(new Event("scroll")));
  data.messages([
    {
      kind: "assistant",
      id: "reply",
      revision: 2,
      createdAt: 1,
      text: "Completed",
    },
  ]);
  await act(async () => vi.advanceTimersByTime(2000));
  await flush();
  expect(log.scrollTo).toHaveBeenCalledWith({ top: 1000 });
});

it("shows only the latest compact card for a repeated session", async () => {
  const data = await mount();
  const ref = { environmentId: "host", projectId: "project", sessionId: "task" };
  data.messages([1, 2, 3].map((revision) => ({
    kind: "session-card" as const, id: `card-${revision}`, revision, createdAt: revision,
    ref, title: `codex · Task ${revision}`, projectName: "Project", harness: "codex" as const,
    model: "codex:gpt-6.1-sol", actionId: `action-${revision}`, status: "completed" as const,
  })));
  await act(async () => vi.advanceTimersByTime(2000));
  await flush();
  expect(node.querySelectorAll(".assistant-card")).toHaveLength(1);
  expect(node.querySelector(".assistant-card-title strong")?.textContent).toBe("Task 3");
  expect(node.querySelector(".assistant-card button")?.getAttribute("aria-label")).toBe("Open session: Task 3");
  expect(node.querySelector(".assistant-card button")?.textContent).toBe("");
  expect(node.querySelector(".assistant-card-project")?.textContent).toBe("Project");
  expect(node.querySelector(".assistant-card-project svg")).not.toBeNull();
  expect(node.querySelector(".assistant-card-provider")?.getAttribute("aria-label")).toBe("Codex");
  expect(node.querySelector(".assistant-card-provider")?.textContent).toBe("");
  expect(node.querySelector(".assistant-card-model")?.textContent).toBe("gpt-6.1-sol");
});

it("picks settings values from a sheet and closes it with back", async () => {
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  expect(node.querySelector(".assistant-settings select")).toBeNull();
  const trigger = () =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.getAttribute("aria-label")?.startsWith("Assistant execution permissions:"),
    )!;
  act(() => trigger().click());
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  act(() => data.ref.current!.back());
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(node.querySelector(".mobile-assistant-settings-page")).not.toBeNull();
  act(() => trigger().click());
  act(() =>
    [...document.querySelectorAll<HTMLElement>('[role="radio"]')]
      .find((r) => r.textContent === "Supervised")!
      .click(),
  );
  expect(trigger().getAttribute("aria-label")).toBe(
    "Assistant execution permissions: Supervised",
  );
  act(() => button("Save settings").click());
  await flush();
  expect(
    data.rpc.mock.calls.find(([m]) => m === "assistant.configure")?.[1].patch
      .runtimeMode,
  ).toBe("supervised");
});

it("closes only the nested settings picker on Escape", async () => {
  const data = await mount();
  act(() => button("Assistant options").click());
  act(() => button("Settings").click());
  act(() => vi.advanceTimersByTime(211));
  const page = node.querySelector<HTMLElement>(
    ".mobile-assistant-settings-page",
  )!;
  const trigger = page.querySelector<HTMLButtonElement>(
    '[aria-label="Assistant execution permissions: Full access"]',
  )!;
  act(() => trigger.click());
  const picker = node.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="Assistant execution permissions"]',
  )!;
  act(() =>
    picker.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })),
  );
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(
    page.closest(".mobile-sheet-backdrop")?.getAttribute("data-fold-state"),
  ).toBe("open");
  act(() => vi.advanceTimersByTime(131));
  expect(
    node.querySelector('[role="dialog"][aria-label="Assistant execution permissions"]'),
  ).toBeNull();
  expect(node.querySelector(".mobile-assistant-settings-page")).toBe(page);
  expect(data.close).not.toHaveBeenCalled();
});
