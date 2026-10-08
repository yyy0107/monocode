// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "./MobileApp";
import { setUiLanguage } from "../shared/i18n/language";
import type { Block } from "../features/sessions/model/session";

const project = vi.hoisted(() => ({ id: "project", name: "Project", cwd: "/project" }));
const state = vi.hoisted(() => ({
  status: "idle" as "idle" | "running",
  blocks: [] as Block[],
}));
const snapshot = () => ({
  projectId: "project",
  revision: state.blocks.length + 1,
  updatedAt: 1,
  status: state.status,
  ...(state.status === "running" ? { runId: "turn" } : {}),
  supportsQueue: true,
  canSteer: true,
  session: {
    id: "session",
    title: "Conversation",
    harness: "codex" as const,
    cwd: "/project",
    model: "codex:test",
    modelSettings: {},
    runtimeMode: "supervised" as const,
    blocks: state.blocks,
  },
});
const healthyStatus = vi.hoisted(() => ({ state: "connected" as const }));
const deferred = vi.hoisted(() => ({
  resolve: undefined as undefined | (() => void),
  reject: undefined as undefined | ((error: Error) => void),
}));
const host = vi.hoisted(() => ({
  connection: { endpoint: "http://computer:3774", name: "Computer", environmentId: "sending-bubble" },
  getConnectionStatus: () => healthyStatus,
  hasCapability: () => false,
  subscribeConnectionStatus: () => () => {},
  restore: vi.fn(async () => true),
  verify: vi.fn(async () => {}),
  pending: vi.fn(async () => undefined),
  savedConnections: vi.fn(async () => []),
  switchTo: vi.fn(async () => undefined),
  projects: vi.fn(async () => [project]),
  sessions: vi.fn(),
  models: vi.fn(async () => ({
    models: { codex: [{ id: "codex:test", name: "Test model", harness: "codex" }] },
    errors: {},
  })),
  cachedModels: () => undefined,
  providerAccounts: vi.fn(async () => ({})),
  cachedSession: () => undefined,
  sessionPreviews: async () => undefined,
  session: vi.fn(),
  uploadAttachments: vi.fn(async () => []),
  dispatch: vi.fn(),
}));
vi.mock("./client", () => ({ MobileClient: vi.fn(function () { return host; }) }));
vi.mock("./MobileAppUpdates", () => ({ useMobileAppUpdates: () => ({}), MobileAppUpdates: () => null }));
vi.mock("./useMobileActivity", () => ({
  useMobileActivity: () => ({ unreadIds: new Set(), permission: "unsupported", enabled: false }),
}));

let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  localStorage.clear();
  setUiLanguage("en");
  state.status = "idle";
  state.blocks = [{ id: "u1", role: "user", text: "Earlier" }, { id: "a1", role: "assistant", text: "Reply" }];
  host.sessions.mockImplementation(async () => [{ ...snapshot(), id: "session", title: "Conversation", harness: "codex" }]);
  host.session.mockImplementation(async () => snapshot());
  host.dispatch.mockImplementation((command: { commandId: string; text?: string }, prompt?: { text: string }) =>
    new Promise((resolve, reject) => {
      deferred.resolve = () => {
        const text = command.text ?? prompt?.text ?? "";
        state.blocks = [...state.blocks, { id: "recorded", role: "user", text }];
        resolve({ commandId: command.commandId, sessionId: "session", revision: 9 });
      };
      deferred.reject = reject;
    }));
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function openConversationAndSend(text: string) {
  await act(async () => root.render(createElement(MobileApp)));
  await act(async () =>
    node.querySelector<HTMLButtonElement>('.mobile-home-session[data-session-id="session"]')!.click());
  await act(async () => {
    const field = node.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    node.querySelector("form.mobile-composer")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
const sendingRows = () => node.querySelectorAll('.user-message-row[data-sending="true"]');
const bubbles = () => [...node.querySelectorAll(".user-message-bubble")].map((bubble) => bubble.textContent);

describe("mobile sending bubble", () => {
  it("shows the message as sending at once and replaces it with the recorded copy", async () => {
    await openConversationAndSend("Hello there");
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    expect(sendingRows()).toHaveLength(1);
    expect(bubbles()).toEqual(["Earlier", "Hello there"]);
    expect(node.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("");

    await act(async () => deferred.resolve!());
    expect(sendingRows()).toHaveLength(0);
    expect(bubbles()).toEqual(["Earlier", "Hello there"]);
    expect(node.querySelector('[data-prompt-anchor="recorded"]')).not.toBeNull();
  });

  it("returns a failed send to the composer", async () => {
    await openConversationAndSend("Try again");
    expect(sendingRows()).toHaveLength(1);

    await act(async () => deferred.reject!(new Error("Offline")));
    expect(sendingRows()).toHaveLength(0);
    expect(bubbles()).toEqual(["Earlier"]);
    expect(node.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("Try again");
  });

  it("starts a new conversation with the message already in its transcript", async () => {
    state.blocks = [];
    host.sessions.mockImplementation(async () => []);
    await act(async () => root.render(createElement(MobileApp)));
    await act(async () =>
      node.querySelector<HTMLButtonElement>('[aria-label="New conversation"]')!.click());
    await act(async () => {
      const field = node.querySelector("textarea")!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "First");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      node.querySelector("form.mobile-composer")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(host.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "create" }), expect.anything());
    expect(sendingRows()).toHaveLength(1);
    const transcript = node.querySelector(".mobile-desktop-transcript");

    await act(async () => deferred.resolve!());
    expect(sendingRows()).toHaveLength(0);
    expect(bubbles()).toEqual(["First"]);
    // The recorded conversation reuses the transcript rather than remounting it.
    expect(node.querySelector(".mobile-desktop-transcript")).toBe(transcript);
  });

  it("leaves sends to a running conversation to its queue", async () => {
    state.status = "running";
    await openConversationAndSend("Queued");
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    expect(sendingRows()).toHaveLength(0);
  });
});
