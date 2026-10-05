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
  it("lists pinned conversations first under their project and hides archives", () => {
    render();
    expect(
      [...node.querySelectorAll(".mobile-drawer-group .mobile-session-row strong")].map(
        (el) => el.textContent,
      ),
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
    const backdrop = node.querySelector<HTMLElement>(".mobile-drawer-backdrop")!;
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
  it("keeps the Host order and tells same-name projects apart by parent", () => {
    render(true, { projects, project });
    expect(links().map((item) => item.title)).toEqual([
      "/mnt/data/Android",
      "/home/wy/Documents/Codex/monocode",
      "/projects/monocode",
    ]);
    expect(
      links().map((item) => item.querySelector("small")?.textContent),
    ).toEqual([undefined, "~/Documents/Codex", "/projects"]);
    expect(
      toggles().map((item) => item.getAttribute("aria-expanded")),
    ).toEqual(["false", "false", "true"]);
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
    render(true, { projects, project, loadSessions, onSession });
    await act(async () => toggles()[0].click());
    expect(loadSessions).toHaveBeenCalledExactlyOnceWith("android");
    const chat = node.querySelector<HTMLButtonElement>(
      '[data-session-id="android-chat"]',
    )!;
    expect(chat.hasAttribute("aria-haspopup")).toBe(false);
    act(() => chat.click());
    expect(onSession).toHaveBeenCalledExactlyOnceWith(
      "android-chat",
      projects[0],
    );
    act(() => toggles()[0].click());
    expect(toggles()[0].getAttribute("aria-expanded")).toBe("false");
    act(() => vi.advanceTimersByTime(350));
    expect(node.querySelector('[data-session-id="android-chat"]')).toBeNull();
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
    expect(ids()).toEqual([
      "chat-0",
      "chat-1",
      "chat-2",
      "chat-3",
      "chat-4",
    ]);
    act(() =>
      node.querySelector<HTMLButtonElement>(".mobile-drawer-more")!.click(),
    );
    expect(ids()).toHaveLength(8);
    expect(node.querySelector(".mobile-drawer-more")?.textContent).toBe(
      "Show less",
    );
  });
  it("opens project pages without a per-project plus, keeping a global new-conversation action", () => {
    const onProject = vi.fn();
    const onHome = vi.fn();
    const onAllProjects = vi.fn();
    const onNewSession = vi.fn();
    const onAddProject = vi.fn();
    render(true, { projects, project, onProject, onHome, onAllProjects, onNewSession, onAddProject });
    expect(node.querySelector('[aria-label="New conversation in Android"]')).toBeNull();
    act(() => links()[0].click());
    expect(onProject).toHaveBeenCalledExactlyOnceWith(projects[0]);
    expect(toggles()[0].getAttribute("aria-expanded")).toBe("false");
    act(() => node.querySelector<HTMLButtonElement>(".mobile-drawer-all-projects")!.click());
    expect(onAllProjects).toHaveBeenCalledOnce();
    act(() => [...node.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Home")!.click());
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
