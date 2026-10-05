// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostSession, HostSessionSummary, HostModelCatalog } from "../features/connections/model/protocol";
import { MobileApp } from "./MobileApp";
import { setUiLanguage } from "../shared/i18n/language";

const host = vi.hoisted(() => ({
  connection: { endpoint: "http://computer:3774", environmentId: "host", name: "Computer" },
  status: { state: "connected" as const },
  restore: vi.fn(async () => true),
  verify: vi.fn(async () => {}),
  pending: vi.fn(async () => undefined),
  projects: vi.fn(async () => [{ id: "project", cwd: "/project", name: "Project" }]),
  sessions: vi.fn(), models: vi.fn(), session: vi.fn(), dispatch: vi.fn(),
  cache: new Map<string, HostSession>(),
  activity: vi.fn(), updateSession: vi.fn(), markUnread: vi.fn(),
}));
vi.mock("./client", () => ({
  MobileClient: class {
    connection = host.connection;
    getConnectionStatus = () => host.status;
    subscribeConnectionStatus = () => () => {};
    restore = host.restore;
    verify = host.verify;
    pending = host.pending;
    projects = host.projects;
    sessions = host.sessions;
    updateSession = host.updateSession;
    models = host.models;
    session = host.session;
    dispatch = host.dispatch;
    uploadAttachments = async () => [];
    cachedModels = () => undefined;
    cachedSession = (id: string) => host.cache.get(id);
    sessionPreviews = async () => undefined;
  },
}));
vi.mock("./useMobileActivity", () => ({
  useMobileActivity: (_client: unknown, options: unknown) => {
    host.activity(options);
    return { unreadIds: new Set(), markUnread: host.markUnread, permission: "unsupported", enabled: false };
  },
}));
vi.mock("./MobileAppUpdates", () => ({ useMobileAppUpdates: () => ({}) }));
vi.mock("./MobileTranscript", () => ({
  MobileTranscript: ({ snapshot, disabled }: { snapshot: HostSession; disabled: boolean }) =>
    createElement("button", { "data-transcript": true, disabled }, snapshot.session.blocks[0]?.text),
}));
vi.mock("./MobileComposer", () => ({
  MobileComposer: ({ disabled, configuration, value, onChange, onSend, canSend, canStop, onStop }: {
    disabled: boolean; configuration: { model: string }; value: string; onChange: (value: string) => void;
    onSend: () => void; canSend: boolean; canStop: boolean; onStop: () => void;
  }) => createElement("div", {},
    createElement("textarea", { disabled, "data-model": configuration.model, value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
    createElement("button", { "data-send": true, disabled: !canSend, onClick: onSend }, "Send"),
    createElement("button", { "data-stop": true, disabled: !canStop, onClick: onStop }, "Stop")),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function snapshot(id = "one", revision = 1): HostSession {
  return {
    projectId: "project", revision, updatedAt: revision, status: "idle",
    session: { id, cwd: "/project", title: id, harness: "codex", model: "codex:existing",
      modelSettings: {}, runtimeMode: "supervised",
      blocks: [{ id: "reply", role: "assistant", text: `${id} revision ${revision}` }] },
  };
}
const catalog: HostModelCatalog = { models: { codex: [
  { id: "codex:catalog-default", harness: "codex", name: "Default" },
] }, errors: {} };
let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  host.cache.clear();
  host.projects.mockReset().mockResolvedValue([{ id: "project", cwd: "/project", name: "Project" }]);
  host.updateSession.mockReset();
  host.markUnread.mockClear();
  host.activity.mockClear();
  host.models.mockReset().mockResolvedValue(catalog);
  host.session.mockReset().mockImplementation(async (id: string) => snapshot(id));
  host.dispatch.mockReset().mockResolvedValue({ commandId: "sent", sessionId: "one", revision: 1 });
  host.sessions.mockReset().mockResolvedValue(["one", "two"].map((id) => ({
    id, projectId: "project", title: id, harness: "codex", revision: 1, updatedAt: 1, status: "idle",
  })));
  localStorage.clear();
  localStorage.setItem("monocode-mobile-last", JSON.stringify({
    environmentId: "host", projectId: "project", sessionId: "one",
  }));
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const mount = () => act(async () => root.render(createElement(MobileApp)));
const transcript = () => node.querySelector<HTMLButtonElement>("[data-transcript]");
const composer = () => node.querySelector<HTMLTextAreaElement>("textarea")!;
const conversationLoading = () => node.querySelector(".mobile-chat > .mobile-loading");
async function open(id: string) {
  const homeRow = node.querySelector<HTMLButtonElement>(`.mobile-home-session[data-session-id="${id}"]`);
  if (homeRow) {
    await act(async () => homeRow.click());
    return;
  }
  await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!.click());
  await act(async () => node.querySelector<HTMLButtonElement>(`[data-session-id="${id}"]`)!.click());
}

describe("mobile conversation loading UI", () => {
  it("edits a home conversation in its own project and animates menu dismissal", async () => {
    localStorage.removeItem("monocode-mobile-last");
    host.projects.mockResolvedValue([
      { id: "project", name: "Project", cwd: "/project" },
      { id: "other", name: "Other", cwd: "/other" },
    ]);
    let other: HostSessionSummary = { id: "other-chat", projectId: "other", title: "Other conversation", harness: "codex", status: "idle", revision: 3, updatedAt: 3 };
    host.sessions.mockImplementation(async (id: string) => id === "other" ? [other] : []);
    host.updateSession.mockImplementation(async (_project: string, _id: string, patch: object) => {
      other = { ...other, ...patch, revision: other.revision + 1 };
      return other;
    });
    await mount();
    const showMenu = async () => {
      const row = node.querySelector<HTMLButtonElement>('[data-session-id="other-chat"]')!;
      await act(async () => row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 90, clientY: 220 })));
    };
    const action = (name: string) => [...node.querySelectorAll<HTMLButtonElement>('.mobile-session-actions button')].find((button) => button.textContent === name)!;
    await showMenu();
    expect(node.querySelector('.mobile-session-menu-title')?.textContent).toBe("Other conversation");
    expect(node.querySelector('.mobile-app')?.getAttribute('data-view')).toBe('home');
    await act(async () => action("Pin").click());
    expect(host.updateSession).toHaveBeenCalledWith("other", "other-chat", { pinned: true });
    expect(node.querySelector('.mobile-home-pinned [data-session-id="other-chat"]')).not.toBeNull();
    expect(node.querySelector('.mobile-sheet-backdrop[data-fold-state="closing"]')?.hasAttribute('inert')).toBe(true);
    act(() => vi.advanceTimersByTime(150));
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    await showMenu();
    expect(action("Unpin")).toBeDefined();
    await act(async () => action("Mark as unread").click());
    expect(host.markUnread).toHaveBeenCalledWith("other-chat", 4);
    act(() => vi.advanceTimersByTime(150));
    await showMenu();
    host.updateSession.mockRejectedValueOnce(new Error("Host offline"));
    await act(async () => action("Archive").click());
    expect(node.querySelector('.mobile-session-actions [role="alert"]')?.textContent).toBe("Host offline");
    expect(node.querySelector('[data-session-id="other-chat"]')).not.toBeNull();
    await act(async () => action("Archive").click());
    expect(host.updateSession).toHaveBeenLastCalledWith("other", "other-chat", { archived: true });
    expect(node.querySelector('[data-session-id="other-chat"]')).toBeNull();
  });

  it("shows a new conversation immediately while its drawer history loads", async () => {
    localStorage.removeItem("monocode-mobile-last");
    const history = deferred<HostSessionSummary[]>();
    host.sessions.mockReturnValue(history.promise);
    await mount();
    expect(node.querySelector(".mobile-app")?.getAttribute("data-view")).toBe("home");
    expect(node.querySelector(".mobile-home-recent")?.textContent).toContain("Loading conversations…");
    await act(async () => node.querySelector<HTMLButtonElement>(".mobile-home-new")!.click());
    expect(conversationLoading()).toBeNull();
    expect(node.querySelector(".mobile-header-title strong")?.textContent).toBe("New conversation");
    expect(composer().disabled).toBe(false);
    await act(async () => history.resolve([]));
  });

  it("falls back from an archived snapshot before history settles and retains a default model", async () => {
    const history = deferred<HostSessionSummary[]>();
    const archived = { ...snapshot(), archived: true };
    host.cache.set("one", archived);
    host.session.mockResolvedValue(archived);
    host.sessions.mockReturnValue(history.promise);
    host.sessions.mockResolvedValueOnce([{ id: "one", projectId: "project", title: "one", harness: "codex", status: "idle", revision: 1, updatedAt: 1 }]);
    await mount();
    await open("one");
    expect(transcript()).toBeNull();
    expect(node.querySelector(".mobile-header-title strong")?.textContent).toBe("New conversation");
    expect(composer().getAttribute("data-model")).toBe("codex:catalog-default");
    await act(async () => history.resolve([]));
    expect(host.activity.mock.calls.at(-1)![0].visibleSession).toBeUndefined();
  });

  it("opens text without waiting for the drawer's Git-backed session list", async () => {
    const history = deferred<HostSessionSummary[]>();
    host.sessions.mockReturnValue(history.promise);
    host.sessions.mockResolvedValueOnce([{ id: "one", projectId: "project", title: "one", harness: "codex", status: "idle", revision: 1, updatedAt: 1 }]);
    await mount();
    await open("one");
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    await act(async () => history.resolve([{ id: "one", projectId: "project", title: "one",
      harness: "codex", status: "idle", revision: 1, updatedAt: 1 }]));
  });

  it("opens text before model discovery settles and keeps the session's own model", async () => {
    const models = deferred<HostModelCatalog>();
    host.models.mockReturnValue(models.promise);
    await mount();
    await open("one");
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    expect(composer().getAttribute("data-model")).toBe("codex:existing");
    await act(async () => models.resolve(catalog));
    expect(composer().getAttribute("data-model")).toBe("codex:existing");
  });

  it("keeps history and text available when model discovery fails", async () => {
    host.models.mockRejectedValue(new Error("Model discovery failed"));
    await mount();
    await open("one");
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    await open("two");
    expect(transcript()?.textContent).toBe("two revision 1");
  });

  it("renders cached text immediately, with commands and unread confirmation gated on fresh sync", async () => {
    const refresh = deferred<HostSession>();
    host.cache.set("one", snapshot());
    host.session.mockReturnValue(refresh.promise);
    await mount();
    await open("one");
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    expect(transcript()?.disabled).toBe(true);
    expect(composer().disabled).toBe(true);
    expect(host.activity.mock.calls.at(-1)![0].visibleSession).toBeUndefined();
    await act(async () => refresh.resolve(snapshot("one", 2)));
    expect(transcript()?.textContent).toBe("one revision 2");
    expect(transcript()?.disabled).toBe(false);
    expect(composer().disabled).toBe(false);
    expect(host.activity.mock.calls.at(-1)![0].visibleSession.revision).toBe(2);
  });

  it("preserves cached text but keeps commands disabled after a failed refresh", async () => {
    host.cache.set("one", snapshot());
    host.session.mockRejectedValue(new Error("Offline"));
    await mount();
    await open("one");
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(composer().disabled).toBe(true);
    expect(transcript()?.disabled).toBe(true);
    expect(host.activity.mock.calls.at(-1)![0].visibleSession).toBeUndefined();
  });

  it("ignores an older navigation response after another cached conversation opens", async () => {
    const old = deferred<HostSession>();
    const fresh = deferred<HostSession>();
    host.cache.set("one", snapshot());
    host.cache.set("two", snapshot("two"));
    host.session.mockImplementation((id: string) => id === "one" ? old.promise : fresh.promise);
    await mount();
    await open("one");
    await open("two");
    expect(transcript()?.textContent).toBe("two revision 1");
    await act(async () => old.resolve(snapshot("one", 20)));
    expect(transcript()?.textContent).toBe("two revision 1");
    await act(async () => fresh.resolve(snapshot("two", 2)));
    expect(transcript()?.textContent).toBe("two revision 2");
  });
});
