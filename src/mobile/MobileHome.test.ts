// @vitest-environment happy-dom
import { act, createElement, createRef, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
import { SurfaceVisibilityContext } from "../shared/ui/SurfaceVisibility";
import { MobileHome } from "./MobileHome";

const projects: HostProject[] = [
  { id: "one", name: "monocode", cwd: "/projects/monocode" },
  { id: "two", name: "monocode", cwd: "/other/monocode" },
];
const session = (
  id: string,
  projectId: string,
  updatedAt: number,
  extra: Partial<HostSessionSummary> = {},
): HostSessionSummary => ({
  id,
  projectId,
  updatedAt,
  title: id,
  harness: "codex",
  status: "idle",
  revision: 1,
  ...extra,
});
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
const defaults = {
  projects,
  hostName: "Computer",
  hostStatus: { state: "connected" as const },
  foreground: true,
  query: "",
  now: 100,
  unreadIds: new Set<string>(),
  loadSessions: async (id: string) =>
    id === "one"
      ? [
          session("old", id, 10),
          session("pin", id, 20, { pinned: true }),
          session("archive", id, 99, { archived: true }),
        ]
      : [session("new", id, 50)],
  onProject: vi.fn(),
  onSession: vi.fn(),
  onNewSession: vi.fn(),
  onSearch: vi.fn(),
  onAddProject: vi.fn(),
};
async function render(props: Partial<Parameters<typeof MobileHome>[0]> = {}) {
  await act(async () =>
    root.render(createElement(MobileHome, { ...defaults, ...props })),
  );
}
const ids = (area: string) =>
  [...node.querySelectorAll(`${area} [data-session-id]`)].map((row) =>
    row.getAttribute("data-session-id"),
  );

describe("mobile home and project history", () => {
  it("renders cached activity order before refresh, preserves it on failure and restores it on remount", async () => {
    const cache = new Map([
      ["one", [session("older", "one", 10), session("pin", "one", 1, { pinned: true })]],
      ["two", [session("latest", "two", 100)]],
    ]);
    const cachedSessions = (id: string) => cache.get(id);
    let reject!: (reason: Error) => void;
    const pending = new Promise<HostSessionSummary[]>((_resolve, fail) => { reject = fail; });
    const loadSessions = vi.fn(() => pending);
    const props = { cachedSessions, loadSessions };
    await render(props);
    expect(ids(".mobile-home-recent")).toEqual(["pin", "latest", "older"]);
    expect(node.querySelector('.mobile-loading[role="status"]')).toBeNull();
    await act(async () => reject(new Error("Offline")));
    expect(ids(".mobile-home-recent")).toEqual(["pin", "latest", "older"]);
    expect(node.querySelector('[role="alert"]')).not.toBeNull();
    act(() => root.render(null));
    await render({ ...props, projectsPage: true, loadSessions: () => new Promise(() => {}) });
    const paths = () => [...node.querySelectorAll('.mobile-home-project[title]')].map(row => row.getAttribute('title'));
    expect(paths()).toEqual([projects[1].cwd, projects[0].cwd]);
    expect(ids(".mobile-home")).toEqual([]);
  });

  it("fills newly arriving projects from cache without replacing newer live history", async () => {
    const cachedSessions = (id: string) => id === "one"
      ? [session("stale", id, 1)] : [session("cached", id, 50)];
    const loadSessions = (id: string) => id === "one"
      ? Promise.resolve([session("live", id, 100)])
      : new Promise<HostSessionSummary[]>(() => {});
    await render({ projects: [projects[0]], cachedSessions, loadSessions });
    await render({ cachedSessions, loadSessions });
    expect(ids(".mobile-home-recent")).toEqual(["live", "cached"]);
    expect(node.querySelector('.mobile-loading[role="status"]')).toBeNull();
  });

  it("holds uncached projects in loading state until their first histories arrive", async () => {
    let resolve!: (sessions: HostSessionSummary[]) => void;
    const pending = new Promise<HostSessionSummary[]>((done) => { resolve = done; });
    await render({ projectsPage: true, loadSessions: () => pending });
    expect(node.querySelectorAll('.mobile-home-project[title]')).toHaveLength(0);
    expect(node.querySelector('.mobile-home-projects [role="status"]')).not.toBeNull();
    await act(async () => resolve([]));
    expect(node.querySelectorAll('.mobile-home-project[title]')).toHaveLength(2);
    expect(node.querySelector('.mobile-loading[role="status"]')).toBeNull();
  });

  it("sorts projects by their newest visible conversation and refreshes the order", async () => {
    const owners = Array.from({ length: 7 }, (_, index) => ({
      id: `p${index}`, name: `Project ${index}`, cwd: `/p${index}`,
    }));
    let latest = 20;
    let failed = false;
    const loadSessions = async (id: string) => {
      if (id === "p6") {
        if (failed) throw new Error("Offline");
        return [session("pinned", id, 1, { pinned: true }), session("latest", id, latest)];
      }
      if (id === "p0") return [];
      return [session(id, id, Number(id.slice(1))), session(`archived-${id}`, id, 1000, { archived: true })];
    };
    await render({ projects: owners, projectsPage: true, loadSessions });
    const paths = () => [...node.querySelectorAll('.mobile-home-project[title]')].map(row => row.getAttribute('title'));
    expect(paths()).toEqual(["/p6", "/p5", "/p4", "/p3", "/p2", "/p1", "/p0"]);
    expect(node.querySelector(".mobile-home-projects .mobile-list-more")).toBeNull();
    latest = 2;
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(paths()).toEqual(["/p5", "/p4", "/p3", "/p2", "/p6", "/p1", "/p0"]);
    failed = true;
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(paths()).toEqual(["/p5", "/p4", "/p3", "/p2", "/p6", "/p1", "/p0"]);
    expect(owners.map(item => item.id)).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("opens a held conversation menu without navigating, then accepts a fresh tap", async () => {
    const onSession = vi.fn(), onSessionActions = vi.fn();
    await render({ onSession, onSessionActions });
    const row = node.querySelector<HTMLButtonElement>('[data-session-id="new"]')!;
    const touch = (type: string, x = 80) => act(() => row.dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, pointerId: 1, pointerType: "touch", clientX: x, clientY: 200,
    })));
    touch("pointerdown");
    act(() => vi.advanceTimersByTime(450));
    expect(onSessionActions).toHaveBeenCalledWith(expect.objectContaining({ id: "new", projectId: "two" }), row, { x: 80, y: 200 });
    touch("pointerup");
    act(() => row.click());
    expect(onSession).not.toHaveBeenCalled();
    touch("pointerdown"); touch("pointerup");
    act(() => row.click());
    expect(onSession).toHaveBeenCalledWith("new", projects[1]);
    onSession.mockClear(); onSessionActions.mockClear();
    touch("pointerdown"); touch("pointermove", 110);
    act(() => vi.advanceTimersByTime(500));
    touch("pointerup", 110); act(() => row.click());
    expect(onSessionActions).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
    touch("pointerdown"); touch("pointercancel");
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
    touch("pointerdown");
    await render({ inactive: true, onSession, onSessionActions });
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
  });

  it("opens pinned and project conversation actions by right click or keyboard", async () => {
    const onSession = vi.fn(), onSessionActions = vi.fn();
    await render({ onSession, onSessionActions });
    const row = node.querySelector<HTMLButtonElement>('[data-session-id="pin"]')!;
    act(() => row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 60, clientY: 100 })));
    expect(onSessionActions).toHaveBeenCalledWith(expect.objectContaining({ id: "pin", pinned: true }), row, { x: 60, y: 100 });
    await render({ project: projects[0], onSession, onSessionActions });
    const projectRow = node.querySelector<HTMLButtonElement>('[data-session-id="old"]')!;
    act(() => projectRow.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "F10", shiftKey: true })));
    expect(onSessionActions).toHaveBeenLastCalledWith(expect.objectContaining({ id: "old" }), projectRow);
    expect(onSession).not.toHaveBeenCalled();
  });

  it("reveals only five more conversations per click", async () => {
    const loadSessions = async (id: string) => id === "one"
      ? Array.from({ length: 46 }, (_, i) => session(`recent-${i}`, id, 100 - i))
      : [];
    await render({ loadSessions });
    const more = (area: string) => node.querySelector<HTMLButtonElement>(`${area} .mobile-list-more`)!;
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    for (const count of [25, 30, 35, 40, 45, 46]) {
      act(() => more(".mobile-home-recent").click());
      expect(ids(".mobile-home-recent")).toHaveLength(count);
    }
    expect(more(".mobile-home-recent").textContent).toBe("Show less");
    act(() => more(".mobile-home-recent").click());
    act(() => vi.advanceTimersByTime(350));
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    expect(more(".mobile-home-recent").textContent).toBe("Show more items");
  });

  it("filters Home by conversation status and keeps archived rows separate", async () => {
    const loadSessions = async (id: string) => id === "one"
      ? [
          session("running", id, 40, { status: "running" }),
          session("asking", id, 30, { needsInput: true }),
          session("done", id, 20, { lastCompletedRunId: "run" }),
          session("stored", id, 50, { archived: true }),
        ]
      : [];
    await render({ loadSessions });
    expect(ids(".mobile-home-recent")).toEqual(["running", "asking", "done"]);
    const trigger = node.querySelector<HTMLButtonElement>(".mobile-home-filter")!;
    const choose = (label: string) => {
      act(() => trigger.click());
      const option = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
        .find((item) => item.textContent === label)!;
      act(() => option.click());
      act(() => vi.advanceTimersByTime(400));
    };
    choose("Working");
    expect(trigger.textContent).toBe("Working");
    expect(ids(".mobile-home-recent")).toEqual(["running"]);
    choose("Needs input");
    expect(ids(".mobile-home-recent")).toEqual(["asking"]);
    choose("Completed");
    expect(ids(".mobile-home-recent")).toEqual(["done"]);
    choose("Archived");
    expect(ids(".mobile-home-recent")).toEqual(["stored"]);
    choose("All");
    expect(ids(".mobile-home-recent")).toEqual(["running", "asking", "done"]);
    await render({ project: projects[0], loadSessions });
    expect(node.querySelector(".mobile-home-filter")).toBeNull();
  });

  it("lists each conversation as a plain row with its title and state or age", async () => {
    const loadSessions = async (id: string) => id === "one"
      ? [
          session("busy", id, 40, { status: "running" }),
          session("asking", id, 30, { needsInput: true }),
          session("idle", id, 20, { pinned: true }),
        ]
      : [];
    await render({ loadSessions });
    const row = (id: string) => node.querySelector(`[data-session-id="${id}"]`)!;
    expect(row("busy").querySelector('[aria-label="Working"]')).not.toBeNull();
    expect(row("asking").querySelector('[aria-label="Needs input"]')).not.toBeNull();
    expect(row("idle").querySelector("strong")?.textContent).toBe("idle");
    expect(row("idle").querySelector("time")).not.toBeNull();
    expect(row("idle").querySelector('[aria-label="Pinned"]')).not.toBeNull();
    expect(node.querySelector(".mobile-session-card")).toBeNull();
  });

  it("searches beyond the twenty-row recent preview and resets expansion for a new project", async () => {
    const loadSessions = async (id: string) => Array.from({ length: 25 }, (_, i) => session(`${id}-${i}`, id, 100 - i));
    await render({ project: projects[0], loadSessions });
    act(() => node.querySelector<HTMLButtonElement>(".mobile-list-more")!.click());
    expect(ids(".mobile-home-recent")).toHaveLength(25);
    await render({ project: projects[1], loadSessions });
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    await render({ project: projects[1], query: "two-24", loadSessions });
    expect(ids(".mobile-home-recent")).toEqual(["two-24"]);
    expect(node.querySelector(".mobile-list-more")).toBeNull();
  });

  it("combines project history by activity, pins first, and opens the actual owning project", async () => {
    const onSession = vi.fn();
    const onProject = vi.fn();
    await render({ onSession, onProject });
    expect(ids(".mobile-home-recent")).toEqual(["pin", "new", "old"]);
    expect(node.textContent).not.toContain("archive");
    expect(node.querySelector(".mobile-home-projects")).toBeNull();
    act(() =>
      node.querySelector<HTMLButtonElement>('[data-session-id="new"]')!.click(),
    );
    expect(onSession).toHaveBeenCalledExactlyOnceWith("new", projects[1]);
    await render({ onSession, onProject, projectsPage: true });
    act(() =>
      node
        .querySelector<HTMLButtonElement>(
          '.mobile-home-project[title="/other/monocode"]',
        )!
        .click(),
    );
    expect(onProject).toHaveBeenCalledExactlyOnceWith(projects[1]);
  });

  it("filters a single project using the header query and restores rows when cleared", async () => {
    const loadSessions = vi.fn(defaults.loadSessions);
    await render({ project: projects[0], query: "old", loadSessions });
    expect(loadSessions).toHaveBeenCalledExactlyOnceWith("one");
    expect(node.querySelector(".mobile-home-projects")).toBeNull();
    expect(node.querySelector("input")).toBeNull();
    expect(ids(".mobile-home")).toEqual(["old"]);
    await render({ project: projects[0], loadSessions });
    expect(ids(".mobile-home")).toEqual(["pin", "old"]);
  });

  it("keeps successful projects usable when another fails and retries without erasing their rows", async () => {
    let failed = true;
    const loadSessions = vi.fn(async (id: string) => {
      if (id === "two" && failed) throw new Error("Offline");
      return defaults.loadSessions(id);
    });
    await render({ loadSessions });
    expect(ids(".mobile-home-recent")).toEqual(["pin", "old"]);
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(
      "Couldn’t load sessions",
    );
    failed = false;
    await act(async () =>
      node.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(),
    );
    expect(node.querySelector('[role="alert"]')).toBeNull();
    expect(ids(".mobile-home-recent")).toEqual(["pin", "new", "old"]);
  });

  it("ignores a late result from the project left behind", async () => {
    let resolve!: (value: HostSessionSummary[]) => void;
    const pending = new Promise<HostSessionSummary[]>((done) => {
      resolve = done;
    });
    const loadSessions = vi.fn((id: string) =>
      id === "one" ? pending : defaults.loadSessions(id),
    );
    await render({ project: projects[0], loadSessions });
    expect(node.textContent).toContain("Loading conversations…");
    await render({ project: projects[1], loadSessions });
    await act(async () => resolve([session("stale", "one", 200)]));
    expect(ids(".mobile-home-recent")).toEqual(["new"]);
    expect(node.textContent).not.toContain("stale");
  });

  it("pauses history polling in the background and translates labels while preserving user names", async () => {
    const loadSessions = vi.fn(defaults.loadSessions);
    await render({ loadSessions });
    await render({ loadSessions, foreground: false });
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(loadSessions).toHaveBeenCalledTimes(2);
    act(() => setUiLanguage("zh-CN"));
    expect(node.textContent).toContain("主机");
    expect(node.textContent).toContain("会话");
    expect(node.textContent).toContain("Computer");
  });
});

it("pauses list refresh while the retained page is hidden", async () => {
  const loadSessions = vi.fn(defaults.loadSessions);
  const render = (visible: boolean) => act(() => root.render(
    createElement(SurfaceVisibilityContext.Provider, { value: visible },
      createElement(MobileHome, { ...defaults, loadSessions })),
  ));
  render(true);
  await act(async () => {});
  expect(loadSessions).toHaveBeenCalledTimes(2);
  render(false);
  loadSessions.mockClear();
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(loadSessions).not.toHaveBeenCalled();
  render(true);
  await act(async () => {});
  expect(loadSessions).toHaveBeenCalledTimes(2);
});

it("does not clear the next page's search anchor when the retained project exits", () => {
  const searchTrigger = createRef<HTMLButtonElement>();
  const previous = createElement(MobileHome, { ...defaults, key: "previous", foreground: false,
    project: projects[0], searchTrigger });
  const next = createElement("button", { key: "next", ref: searchTrigger, "data-next-search": true }, "Search");
  act(() => root.render(createElement(Fragment, null, previous)));
  expect(searchTrigger.current?.className).toBe("mobile-home-search");
  act(() => root.render(createElement(Fragment, null, next, previous)));
  const anchor = node.querySelector<HTMLButtonElement>("[data-next-search]");
  expect(searchTrigger.current).toBe(anchor);
  act(() => root.render(createElement(Fragment, null, next)));
  expect(searchTrigger.current).toBe(anchor);
});
