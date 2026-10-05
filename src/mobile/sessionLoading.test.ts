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
  sessions: vi.fn(), models: vi.fn(), session: vi.fn(),
  cache: new Map<string, HostSession>(),
  activity: vi.fn(),
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
    models = host.models;
    session = host.session;
    cachedModels = () => undefined;
    cachedSession = (id: string) => host.cache.get(id);
    sessionPreviews = async () => undefined;
  },
}));
vi.mock("./useMobileActivity", () => ({
  useMobileActivity: (_client: unknown, options: unknown) => {
    host.activity(options);
    return { unreadIds: new Set(), permission: "unsupported", enabled: false };
  },
}));
vi.mock("./MobileAppUpdates", () => ({ useMobileAppUpdates: () => ({}) }));
vi.mock("./MobileTranscript", () => ({
  MobileTranscript: ({ snapshot, disabled }: { snapshot: HostSession; disabled: boolean }) =>
    createElement("button", { "data-transcript": true, disabled }, snapshot.session.blocks[0]?.text),
}));
vi.mock("./MobileComposer", () => ({
  MobileComposer: ({ disabled, configuration }: { disabled: boolean; configuration: { model: string } }) =>
    createElement("textarea", { disabled, "data-model": configuration.model }),
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
  host.activity.mockClear();
  host.models.mockReset().mockResolvedValue(catalog);
  host.session.mockReset().mockImplementation(async (id: string) => snapshot(id));
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
  vi.unstubAllGlobals();
});
const mount = () => act(async () => root.render(createElement(MobileApp)));
const transcript = () => node.querySelector<HTMLButtonElement>("[data-transcript]");
const composer = () => node.querySelector<HTMLTextAreaElement>("textarea")!;
const conversationLoading = () => node.querySelector(".mobile-chat > .mobile-loading");
async function open(id: string) {
  await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!.click());
  await act(async () => node.querySelector<HTMLButtonElement>(`[data-session-id="${id}"]`)!.click());
}

describe("mobile conversation loading UI", () => {
  it("shows a new conversation immediately while its drawer history loads", async () => {
    localStorage.removeItem("monocode-mobile-last");
    const history = deferred<HostSessionSummary[]>();
    host.sessions.mockReturnValue(history.promise);
    await mount();
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
    await mount();
    expect(transcript()).toBeNull();
    expect(node.querySelector(".mobile-header-title strong")?.textContent).toBe("New conversation");
    expect(composer().getAttribute("data-model")).toBe("codex:catalog-default");
    await act(async () => history.resolve([]));
    expect(host.activity.mock.calls.at(-1)![0].visibleSession).toBeUndefined();
  });

  it("restores text without waiting for the drawer's Git-backed session list", async () => {
    const history = deferred<HostSessionSummary[]>();
    host.sessions.mockReturnValue(history.promise);
    await mount();
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    await act(async () => history.resolve([{ id: "one", projectId: "project", title: "one",
      harness: "codex", status: "idle", revision: 1, updatedAt: 1 }]));
  });

  it("restores text before model discovery settles and keeps the session's own model", async () => {
    const models = deferred<HostModelCatalog>();
    host.models.mockReturnValue(models.promise);
    await mount();
    expect(transcript()?.textContent).toBe("one revision 1");
    expect(conversationLoading()).toBeNull();
    expect(composer().getAttribute("data-model")).toBe("codex:existing");
    await act(async () => models.resolve(catalog));
    expect(composer().getAttribute("data-model")).toBe("codex:existing");
  });

  it("keeps history and restored text available when model discovery fails", async () => {
    host.models.mockRejectedValue(new Error("Model discovery failed"));
    await mount();
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
    await open("two");
    expect(transcript()?.textContent).toBe("two revision 1");
    await act(async () => old.resolve(snapshot("one", 20)));
    expect(transcript()?.textContent).toBe("two revision 1");
    await act(async () => fresh.resolve(snapshot("two", 2)));
    expect(transcript()?.textContent).toBe("two revision 2");
  });
});
