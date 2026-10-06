// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
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
    const paths = () => [...node.querySelectorAll('.mobile-home-project[title]')].map(row => row.getAttribute('title'));
    expect(paths()).toEqual([projects[1].cwd, projects[0].cwd]);
    expect(ids(".mobile-home-pinned")).toEqual(["pin"]);
    expect(ids(".mobile-home-recent")).toEqual(["latest", "older"]);
    expect(node.querySelector('.mobile-loading[role="status"]')).toBeNull();
    await act(async () => reject(new Error("Offline")));
    expect(paths()).toEqual([projects[1].cwd, projects[0].cwd]);
    expect(node.querySelector('[role="alert"]')).not.toBeNull();
    act(() => root.render(null));
    await render({ ...props, loadSessions: () => new Promise(() => {}) });
    expect(paths()).toEqual([projects[1].cwd, projects[0].cwd]);
    expect(ids(".mobile-home-recent")).toEqual(["latest", "older"]);
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
    await render({ loadSessions: () => pending });
    expect(node.querySelectorAll('.mobile-home-project[title]')).toHaveLength(0);
    expect(node.querySelector('.mobile-home-projects [role="status"]')).not.toBeNull();
    await act(async () => resolve([]));
    expect(node.querySelectorAll('.mobile-home-project[title]')).toHaveLength(2);
    expect(node.querySelector('.mobile-loading[role="status"]')).toBeNull();
  });

  it("sorts projects by their newest visible conversation before paging and refreshes the order", async () => {
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
    await render({ projects: owners, loadSessions });
    const paths = () => [...node.querySelectorAll('.mobile-home-project[title]')].map(row => row.getAttribute('title'));
    expect(paths()).toEqual(["/p6", "/p5", "/p4", "/p3", "/p2"]);
    act(() => (node.querySelector('.mobile-home-projects .mobile-list-more') as HTMLButtonElement).click());
    expect(paths()).toEqual(["/p6", "/p5", "/p4", "/p3", "/p2", "/p1", "/p0"]);
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

  it("reveals only five more projects or conversations per click", async () => {
    const manyProjects = Array.from({ length: 16 }, (_, i) => ({ id: `project-${i}`, name: `Project ${i}`, cwd: `/projects/${i}` }));
    const loadSessions = async (id: string) => id === "project-0"
      ? Array.from({ length: 46 }, (_, i) => session(`recent-${i}`, id, 100 - i))
      : [];
    await render({ projects: manyProjects, loadSessions });
    const more = (area: string) => node.querySelector<HTMLButtonElement>(`${area} .mobile-list-more`)!;
    for (const count of [10, 15, 16]) {
      act(() => more(".mobile-home-projects").click());
      expect(node.querySelectorAll(".mobile-home-project:not(.mobile-home-add)")).toHaveLength(count);
      expect(ids(".mobile-home-recent")).toHaveLength(20);
    }
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

  it("previews five projects, five pins and twenty recent conversations independently", async () => {
    const manyProjects = Array.from({ length: 7 }, (_, i) => ({ id: `project-${i}`, name: `Project ${i}`, cwd: `/projects/${i}` }));
    const loadSessions = async (id: string) => id === "project-0"
      ? [
          ...Array.from({ length: 7 }, (_, i) => session(`pin-${i}`, id, 100 - i, { pinned: true })),
          ...Array.from({ length: 23 }, (_, i) => session(`recent-${i}`, id, 100 - i)),
        ]
      : [];
    await render({ projects: manyProjects, loadSessions });
    expect(node.querySelectorAll(".mobile-home-project:not(.mobile-home-add)")).toHaveLength(5);
    expect(ids(".mobile-home-pinned")).toHaveLength(5);
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    const more = (area: string) => node.querySelector<HTMLButtonElement>(`${area} .mobile-list-more`)!;
    act(() => more(".mobile-home-projects").click());
    expect(node.querySelectorAll(".mobile-home-project:not(.mobile-home-add)")).toHaveLength(7);
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    act(() => more(".mobile-home-pinned").click());
    expect(ids(".mobile-home-pinned")).toHaveLength(7);
    expect(ids(".mobile-home-recent")).toHaveLength(20);
    act(() => more(".mobile-home-recent").click());
    expect(ids(".mobile-home-recent")).toHaveLength(23);
    act(() => more(".mobile-home-recent").click());
    expect(node.querySelector('.mobile-home-recent [data-fold-state="closing"]')?.hasAttribute("inert")).toBe(true);
    act(() => more(".mobile-home-recent").click());
    act(() => vi.advanceTimersByTime(350));
    expect(ids(".mobile-home-recent")).toHaveLength(23);
    act(() => more(".mobile-home-recent").click());
    act(() => vi.advanceTimersByTime(350));
    expect(ids(".mobile-home-recent")).toHaveLength(20);
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

  it("combines project history by activity, separates pins, and opens the actual owning project", async () => {
    const onSession = vi.fn();
    const onProject = vi.fn();
    await render({ onSession, onProject });
    expect(ids(".mobile-home-pinned")).toEqual(["pin"]);
    expect(ids(".mobile-home-recent")).toEqual(["new", "old"]);
    expect(node.textContent).not.toContain("archive");
    expect(node.querySelector(".mobile-home-project small")).toBeNull();
    act(() =>
      node.querySelector<HTMLButtonElement>('[data-session-id="new"]')!.click(),
    );
    expect(onSession).toHaveBeenCalledExactlyOnceWith("new", projects[1]);
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
    expect(ids(".mobile-home-recent")).toEqual(["old"]);
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(
      "Couldn’t load sessions",
    );
    failed = false;
    await act(async () =>
      node.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(),
    );
    expect(node.querySelector('[role="alert"]')).toBeNull();
    expect(ids(".mobile-home-recent")).toEqual(["new", "old"]);
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

  it("retains pinned content during animated closing and handles a rapid reversal", async () => {
    await render();
    const toggle = node.querySelector<HTMLButtonElement>(
      ".mobile-home-section-toggle",
    )!;
    act(() => toggle.click());
    expect(
      node
        .querySelector(".mobile-home-pinned .zen-fold-item")
        ?.getAttribute("data-fold-state"),
    ).toBe("closing");
    expect(
      node
        .querySelector(".mobile-home-pinned .zen-fold-item")
        ?.hasAttribute("inert"),
    ).toBe(true);
    expect(ids(".mobile-home-pinned")).toEqual(["pin"]);
    act(() => toggle.click());
    act(() => vi.advanceTimersByTime(350));
    expect(ids(".mobile-home-pinned")).toEqual(["pin"]);
    act(() => toggle.click());
    act(() => vi.advanceTimersByTime(350));
    expect(ids(".mobile-home-pinned")).toEqual([]);
  });

  it("pauses history polling in the background and translates labels while preserving user names", async () => {
    const loadSessions = vi.fn(defaults.loadSessions);
    await render({ loadSessions });
    await render({ loadSessions, foreground: false });
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(loadSessions).toHaveBeenCalledTimes(2);
    act(() => setUiLanguage("zh-CN"));
    expect(node.textContent).toContain("项目");
    expect(node.textContent).toContain("已置顶");
    expect(node.textContent).toContain("monocode");
  });
});
