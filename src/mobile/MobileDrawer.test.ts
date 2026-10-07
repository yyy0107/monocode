// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
import { MobileDrawer } from "./MobileDrawer";

let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
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
function render(open = true, props: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const onSession = vi.fn();
  const onSessionActions = vi.fn();
  const base: HostSessionSummary = {
    id: "recent",
    title: "Recent conversation",
    projectId: "project",
    harness: "codex",
    status: "idle",
    revision: 1,
    updatedAt: 100,
  };
  act(() =>
    root.render(
      createElement(MobileDrawer, {
        open,
        onOpenChange,
        projects: [{ id: "project", name: "Project", cwd: "/project" }],
        project: { id: "project", name: "Project", cwd: "/project" },
        sessions: [
          base,
          { ...base, id: "pinned", title: "Pinned conversation", pinned: true },
          {
            ...base,
            id: "archived",
            title: "Archived conversation",
            archived: true,
          },
        ],
        loading: false,
        unreadIds: new Set<string>(),
        now: 100,
        hostName: "Host",
        hostStatus: { state: "connected" },
        projectTrigger: { current: null },
        loadSessions: async () => [],
        onAddProject: () => {},
        onHome: () => {},
        onAllProjects: () => {},
        onProject: () => {},
        onSession,
        onSessionActions,
        onNewSession: () => {},
        onSettings: () => {},
        ...props,
      }),
    ),
  );
  return { onOpenChange, onSession, onSessionActions };
}
const row = () =>
  node.querySelector<HTMLButtonElement>('[data-session-id="recent"]')!;
function touch(type: string, y = 100, x = 100, target: Element = row()) {
  act(() =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        clientX: x,
        clientY: y,
      }),
    ),
  );
}
describe("mobile sidebar sessions", () => {
  it("finishes closing and ignores pulls while its owning page is inactive", () => {
    render();
    const panel = node.querySelector<HTMLElement>(".mobile-drawer")!;
    Object.defineProperty(panel, "offsetWidth", { value: 300 });
    touch("pointerdown", 100, 250);
    touch("pointermove", 100, 100);
    expect(panel.style.transform).toBe("translateX(-150px)");
    const { onOpenChange } = render(true, { active: false });
    expect(node.querySelector(".mobile-drawer")).toBe(panel);
    expect(panel.style.transform).toBe("");
    expect(panel.parentElement!.dataset.open).toBe("false");
    expect(panel.parentElement!.hasAttribute("inert")).toBe(true);
    const chat = document.createElement("main");
    chat.className = "mobile-chat";
    document.body.append(chat);
    touch("pointerdown", 100, 20, chat);
    touch("pointermove", 100, 250, chat);
    touch("pointerup", 100, 250, chat);
    chat.remove();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("lists pinned conversations first under their project and hides archives", () => {
    render();
    expect(
      [
        ...node.querySelectorAll(
          ".mobile-drawer-group .mobile-session-row strong",
        ),
      ].map((el) => el.textContent),
    ).toEqual(["Pinned conversation", "Recent conversation"]);
    expect(node.textContent).not.toContain("Archived conversation");
  });
  it("opens a conversation on a short tap", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    act(() => vi.advanceTimersByTime(200));
    touch("pointerup");
    act(() => row().click());
    act(() => vi.advanceTimersByTime(500));
    expect(onSession).toHaveBeenCalledWith("recent", {
      id: "project",
      name: "Project",
      cwd: "/project",
    });
    expect(onSessionActions).not.toHaveBeenCalled();
  });
  it("opens actions on a hold and suppresses the release tap, then accepts a fresh tap", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    act(() => vi.advanceTimersByTime(450));
    expect(onSessionActions).toHaveBeenCalledExactlyOnceWith("recent", row(), {
      x: 100,
      y: 100,
    });
    touch("pointerup");
    act(() => row().click());
    expect(onSession).not.toHaveBeenCalled();
    touch("pointerdown");
    touch("pointerup");
    act(() => row().click());
    expect(onSession).toHaveBeenCalledOnce();
  });
  it("leaves scroll gestures to the list without opening actions or navigating", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    touch("pointermove", 160);
    act(() => vi.advanceTimersByTime(500));
    touch("pointerup", 160);
    act(() => row().click());
    expect(onSessionActions).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
  });
  it("cancels a hold when the touch is cancelled or the drawer unmounts", () => {
    const { onSessionActions } = render();
    touch("pointerdown");
    touch("pointercancel");
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
    touch("pointerdown");
    act(() => root.render(null));
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
  });
  it("offers the same actions from a context menu without opening the conversation", () => {
    const { onSession, onSessionActions } = render();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 72,
      clientY: 112,
    });
    act(() => row().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onSessionActions).toHaveBeenCalledWith("recent", row(), {
      x: 72,
      y: 112,
    });
    expect(onSession).not.toHaveBeenCalled();
  });
  it("closes when the open panel is pushed from a session row, without opening it", () => {
    const { onOpenChange, onSession } = render();
    touch("pointerdown");
    touch("pointermove", 100, 60);
    touch("pointermove", 100, 20);
    touch("pointerup", 100, 20);
    act(() => row().click());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onSession).not.toHaveBeenCalled();
  });
  it("closes from a push that starts anywhere on screen, outside the drawer", () => {
    const { onOpenChange } = render();
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    touch("pointerdown", 100, 360, elsewhere);
    touch("pointermove", 100, 300, elsewhere);
    touch("pointermove", 100, 150, elsewhere);
    touch("pointerup", 100, 150, elsewhere);
    elsewhere.remove();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("follows a push that reverses mid-gesture and stays open", () => {
    const { onOpenChange } = render();
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const panel = node.querySelector<HTMLElement>(".mobile-drawer")!;
    touch("pointerdown", 100, 250);
    touch("pointermove", 100, 200);
    touch("pointermove", 100, 100);
    expect(panel.style.transform).toBe("translateX(-150px)");
    act(() => vi.advanceTimersByTime(100));
    touch("pointermove", 100, 230);
    expect(panel.style.transform).toBe("translateX(-20px)");
    touch("pointerup", 100, 230);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("hands the settled position back to the stylesheet when a drag ends", () => {
    render();
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const panel = node.querySelector<HTMLElement>(".mobile-drawer")!;
    const backdrop = node.querySelector<HTMLElement>(
      ".mobile-drawer-backdrop",
    )!;
    const progress = () =>
      backdrop.style.getPropertyValue("--mobile-drawer-progress");
    expect(progress()).toBe("1");
    touch("pointerdown", 100, 250);
    touch("pointermove", 100, 200);
    touch("pointermove", 100, 100);
    expect(backdrop.dataset.dragging).toBe("true");
    expect(progress()).toBe("0.5");
    act(() => vi.advanceTimersByTime(100));
    touch("pointermove", 100, 240);
    touch("pointerup", 100, 240);
    expect(backdrop.dataset.dragging).toBeUndefined();
    expect(panel.style.transform).toBe("");
    expect(progress()).toBe("1");
  });
  it("keeps the browser from claiming a touch the drawer is dragging", () => {
    render();
    const move = () => {
      const event = new Event("touchmove", { bubbles: true, cancelable: true });
      act(() => row().dispatchEvent(event));
      return event.defaultPrevented;
    };
    touch("pointerdown");
    expect(move()).toBe(false);
    touch("pointermove", 100, 60);
    expect(move()).toBe(true);
    touch("pointerup", 100, 60);
    expect(move()).toBe(false);
  });
  it("leaves pushes on a sheet above the drawer alone", () => {
    const { onOpenChange } = render();
    const sheet = document.createElement("div");
    sheet.className = "mobile-sheet-backdrop";
    document.body.append(sheet);
    touch("pointerdown", 100, 300, sheet);
    touch("pointermove", 100, 100, sheet);
    touch("pointerup", 100, 100, sheet);
    sheet.remove();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("opens when the conversation is pulled from a button", () => {
    const { onOpenChange } = render(false);
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const chat = document.createElement("main");
    chat.className = "mobile-chat";
    const tool = document.createElement("button");
    const clicked = vi.fn();
    tool.addEventListener("click", clicked);
    chat.append(tool);
    document.body.append(chat);
    touch("pointerdown", 100, 20, tool);
    touch("pointermove", 100, 80, tool);
    touch("pointermove", 100, 200, tool);
    touch("pointerup", 100, 200, tool);
    act(() => tool.click());
    chat.remove();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(clicked).not.toHaveBeenCalled();
  });
  it("leaves pulls that start in a text field alone", () => {
    const { onOpenChange } = render(false);
    const chat = document.createElement("main");
    chat.className = "mobile-chat";
    const field = document.createElement("textarea");
    chat.append(field);
    document.body.append(chat);
    touch("pointerdown", 100, 20, field);
    touch("pointermove", 100, 200, field);
    touch("pointerup", 100, 200, field);
    chat.remove();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
describe("mobile sidebar projects", () => {
  const projects = [
    { id: "android", name: "Android", cwd: "/mnt/data/Android" },
    { id: "codex", name: "monocode", cwd: "/home/wy/Documents/Codex/monocode" },
    { id: "project", name: "monocode", cwd: "/projects/monocode" },
  ];
  const project = projects[2];
  const links = () => [
    ...node.querySelectorAll<HTMLButtonElement>(".mobile-drawer-project-link"),
  ];
  const toggles = () => [
    ...node.querySelectorAll<HTMLButtonElement>(".mobile-drawer-group-toggle"),
  ];
  const toggle = (cwd: string) =>
    links()
      .find((item) => item.title === cwd)!
      .closest(".mobile-drawer-group")!
      .querySelector<HTMLButtonElement>(".mobile-drawer-group-toggle")!;
  const session = (
    projectId: string,
    updatedAt: number,
    extra: Partial<HostSessionSummary> = {},
  ): HostSessionSummary => ({
    id: `${projectId}-chat`,
    title: `${projectId} chat`,
    projectId,
    harness: "codex",
    status: "idle",
    revision: 1,
    updatedAt,
    ...extra,
  });
  it("uses cached project activity on first open and refreshes the preview when reopened", async () => {
    const cache = new Map(projects.map((owner, index) => [owner.id, [session(owner.id, index * 100)]]));
    const cachedSessions = (id: string) => cache.get(id);
    const loadSessions = vi.fn(() => new Promise<HostSessionSummary[]>(() => {}));
    const props = { projects, project: undefined, sessions: [], cachedSessions, loadSessions };
    render(true, props);
    expect(links().map((item) => item.title)).toEqual([
      projects[2].cwd, projects[1].cwd, projects[0].cwd,
    ]);
    act(() => toggle(projects[1].cwd).click());
    expect(node.querySelector('[data-session-id="codex-chat"]')).not.toBeNull();
    expect(node.querySelector('.mobile-drawer-group-status')).toBeNull();
    render(false, props);
    cache.set("android", [session("android", 500)]);
    render(true, props);
    expect(links().map((item) => item.title)).toEqual([
      projects[0].cwd, projects[2].cwd, projects[1].cwd,
    ]);
  });
  it("holds uncached project order in loading state until histories arrive", async () => {
    const responses = new Map<string, (sessions: HostSessionSummary[]) => void>();
    const loadSessions = (id: string) => new Promise<HostSessionSummary[]>((done) => { responses.set(id, done); });
    render(true, { projects, project, sessions: [], loadSessions });
    expect(links()).toHaveLength(0);
    expect(node.querySelector('.mobile-drawer-sessions .mobile-loading[role="status"]')).not.toBeNull();
    await act(async () => {
      responses.get("android")!([session("android", 10)]);
      responses.get("codex")!([session("codex", 100)]);
    });
    expect(links().map((item) => item.title)).toEqual([
      projects[1].cwd, projects[0].cwd, projects[2].cwd,
    ]);
    expect(node.querySelector('.mobile-drawer-sessions .mobile-loading[role="status"]')).toBeNull();
  });
  it("orders all projects by recent visible activity and tells same-name projects apart by parent", async () => {
    const loadSessions = vi.fn(async (id: string) =>
      id === "android"
        ? [
            session(id, 90),
            session(id, 1_000, { id: "archived", archived: true }),
          ]
        : [session(id, 200, { pinned: true })],
    );
    await act(async () => render(true, { projects, project, loadSessions }));
    expect(links().map((item) => item.title)).toEqual([
      "/home/wy/Documents/Codex/monocode",
      "/projects/monocode",
      "/mnt/data/Android",
    ]);
    expect(
      links().map((item) => item.querySelector("small")?.textContent),
    ).toEqual(["~/Documents/Codex", "/projects", undefined]);
    expect(toggles().map((item) => item.getAttribute("aria-expanded"))).toEqual(
      ["false", "true", "false"],
    );
    expect(loadSessions.mock.calls.map(([id]) => id).sort()).toEqual([
      "android",
      "codex",
    ]);
    expect(projects.map((item) => item.id)).toEqual([
      "android",
      "codex",
      "project",
    ]);
  });
  it("loads another project's conversations when it opens and opens them in that project", async () => {
    const onSession = vi.fn();
    const loadSessions = vi.fn(async (projectId: string) => [
      {
        id: "android-chat",
        title: "Android chat",
        projectId,
        harness: "codex" as const,
        status: "idle" as const,
        revision: 1,
        updatedAt: 90,
      },
    ]);
    await act(async () =>
      render(true, { projects, project, loadSessions, onSession }),
    );
    await act(async () => toggle(projects[0].cwd).click());
    expect(
      loadSessions.mock.calls.filter(([id]) => id === "android"),
    ).toHaveLength(1);
    const chat = node.querySelector<HTMLButtonElement>(
      '[data-session-id="android-chat"]',
    )!;
    expect(chat.hasAttribute("aria-haspopup")).toBe(false);
    act(() => chat.click());
    expect(onSession).toHaveBeenCalledExactlyOnceWith(
      "android-chat",
      projects[0],
    );
    act(() => toggle(projects[0].cwd).click());
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("false");
    act(() => vi.advanceTimersByTime(350));
    expect(node.querySelector('[data-session-id="android-chat"]')).toBeNull();
  });
  it("automatically expands running projects but keeps manual collapses through refreshes", async () => {
    const loadSessions = vi.fn(async (id: string) => [
      session(id, 100, {
        status: id === "android" || id === "codex" ? "running" : "idle",
        archived: id === "codex",
      }),
    ]);
    await act(async () =>
      render(true, {
        projects,
        project: undefined,
        sessions: [],
        loadSessions,
      }),
    );
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("true");
    expect(toggle(projects[1].cwd).getAttribute("aria-expanded")).toBe("false");
    expect(toggle(projects[2].cwd).getAttribute("aria-expanded")).toBe("false");
    expect(
      node.querySelector('[data-session-id="android-chat"]'),
    ).not.toBeNull();
    act(() => toggle(projects[0].cwd).click());
    expect(
      node
        .querySelector('.mobile-drawer-group [data-fold-state="closing"]')
        ?.hasAttribute("inert"),
    ).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("false");
    expect(node.querySelector('[data-session-id="android-chat"]')).toBeNull();
  });
  it("refreshes collapsed projects, preserves history on failure and stops polling while closed", async () => {
    let recent = 20;
    let running = false;
    let failed = false;
    const loadSessions = vi.fn(async (id: string) => {
      if (failed) throw new Error("Offline");
      return [
        session(id, id === "android" ? recent : 50, {
          status: id === "android" && running ? "running" : "idle",
        }),
      ];
    });
    const props = { projects, project: undefined, sessions: [], loadSessions };
    await act(async () => render(false, props));
    expect(loadSessions).not.toHaveBeenCalled();
    await act(async () => render(true, props));
    expect(links().map((item) => item.title)).toEqual([
      projects[1].cwd,
      projects[2].cwd,
      projects[0].cwd,
    ]);
    recent = 100;
    running = true;
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(links()[0].title).toBe(projects[0].cwd);
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("true");
    failed = true;
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(links()[0].title).toBe(projects[0].cwd);
    expect(
      node.querySelector('[data-session-id="android-chat"]'),
    ).not.toBeNull();
    await act(async () => render(false, props));
    loadSessions.mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(loadSessions).not.toHaveBeenCalled();
    failed = false;
    await act(async () => render(true, props));
    expect(loadSessions).toHaveBeenCalledTimes(3);
    await act(async () => render(true, { ...props, foreground: false }));
    loadSessions.mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(loadSessions).not.toHaveBeenCalled();
    await act(async () => render(true, props));
    expect(loadSessions).toHaveBeenCalledTimes(3);
  });
  it("ignores older history requests after reopening the drawer", async () => {
    let resolveOld!: (sessions: HostSessionSummary[]) => void;
    const old = new Promise<HostSessionSummary[]>((resolve) => {
      resolveOld = resolve;
    });
    const loadSessions = vi
      .fn()
      .mockReturnValueOnce(old)
      .mockResolvedValueOnce([session("android", 100, { status: "running" })]);
    const props = {
      projects: [projects[0]],
      project: undefined,
      sessions: [],
      loadSessions,
    };
    await act(async () => render(true, props));
    await act(async () => render(false, props));
    await act(async () => render(true, props));
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      resolveOld([session("android", 50, { title: "Stale history" })]),
    );
    expect(
      node.querySelector('[data-session-id="android-chat"] strong')
        ?.textContent,
    ).toBe("android chat");
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("true");
  });
  it("reveals an expanded running project beyond the five-project preview without changing time order", async () => {
    const owners = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      name: `Project ${index}`,
      cwd: `/p${index}`,
    }));
    const loadSessions = async (id: string) => [
      session(id, 100 - Number(id.slice(1)), {
        status: id === "p6" ? "running" : "idle",
      }),
    ];
    await act(async () =>
      render(true, {
        projects: owners,
        project: undefined,
        sessions: [],
        loadSessions,
      }),
    );
    expect(links().map((item) => item.title)).toEqual(
      owners.slice(0, 10).map((item) => item.cwd),
    );
    expect(toggle("/p6").getAttribute("aria-expanded")).toBe("true");
    expect(node.querySelector('[data-session-id="p6-chat"]')).not.toBeNull();
    act(() =>
      node
        .querySelector<HTMLButtonElement>(
          ".mobile-drawer-sessions > .mobile-drawer-more",
        )!
        .click(),
    );
    expect(links()).toHaveLength(12);
    act(() =>
      node
        .querySelector<HTMLButtonElement>(
          ".mobile-drawer-sessions > .mobile-drawer-more",
        )!
        .click(),
    );
    act(() => vi.advanceTimersByTime(350));
    expect(links()).toHaveLength(10);
    expect(node.querySelector('[data-session-id="p6-chat"]')).not.toBeNull();
  });
  it("shows exactly five conversations per project until Show more", () => {
    const base = {
      projectId: "project",
      harness: "codex" as const,
      status: "idle" as const,
      revision: 1,
    };
    const sessions = Array.from({ length: 8 }, (_, index) => ({
      ...base,
      id: `chat-${index}`,
      title: `Chat ${index}`,
      updatedAt: 100 - index,
    }));
    render(true, { sessions, sessionId: "chat-7" });
    const ids = () =>
      [...node.querySelectorAll(".mobile-session-row")].map((item) =>
        item.getAttribute("data-session-id"),
      );
    expect(ids()).toEqual(["chat-0", "chat-1", "chat-2", "chat-3", "chat-4"]);
    act(() =>
      node.querySelector<HTMLButtonElement>(".mobile-drawer-more")!.click(),
    );
    expect(ids()).toHaveLength(8);
    expect(node.querySelector(".mobile-drawer-more")?.textContent).toBe(
      "Show less",
    );
  });
  it("opens project pages without a per-project plus, keeping a global new-conversation action", async () => {
    const onProject = vi.fn();
    const onHome = vi.fn();
    const onAllProjects = vi.fn();
    const onNewSession = vi.fn();
    const onAddProject = vi.fn();
    await act(async () =>
      render(true, {
        projects,
        project,
        onProject,
        onHome,
        onAllProjects,
        onNewSession,
        onAddProject,
      }),
    );
    expect(
      node.querySelector('[aria-label="New conversation in Android"]'),
    ).toBeNull();
    act(() =>
      links()
        .find((item) => item.title === projects[0].cwd)!
        .click(),
    );
    expect(onProject).toHaveBeenCalledExactlyOnceWith(projects[0]);
    expect(toggle(projects[0].cwd).getAttribute("aria-expanded")).toBe("false");
    act(() =>
      node
        .querySelector<HTMLButtonElement>(".mobile-drawer-all-projects")!
        .click(),
    );
    expect(onAllProjects).toHaveBeenCalledOnce();
    act(() =>
      [...node.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Home")!
        .click(),
    );
    expect(onHome).toHaveBeenCalledOnce();
    act(() =>
      node.querySelector<HTMLButtonElement>(".mobile-drawer-new")!.click(),
    );
    expect(onNewSession).toHaveBeenLastCalledWith(project);
    const open = node.querySelector<HTMLButtonElement>(
      ".mobile-drawer-open-project",
    )!;
    expect(open.closest(".mobile-drawer-group")).toBeNull();
    act(() => open.click());
    expect(onAddProject).toHaveBeenCalledOnce();
  });
});
