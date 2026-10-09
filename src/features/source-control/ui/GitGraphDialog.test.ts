// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GitHistoryGraph } from "./GitHistoryGraph";
import { gitHistory, type GitHistoryCommit } from "../../../platform/tauri/fs";
import { setUiLanguage } from "../../../shared/i18n/language";
import { saveMenuBarVisible } from "../../settings/model/settings";

const { refreshTrees, listeners, startDragging } = vi.hoisted(() => ({
  refreshTrees: vi.fn(async () => true),
  listeners: new Set<() => void>(),
  startDragging: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging }),
}));
vi.mock("../../../platform/tauri/platform", async (original) => ({
  ...(await original<typeof import("../../../platform/tauri/platform")>()),
  IS_LINUX: true,
  IS_WIN: false,
  IS_MAC: false,
}));
vi.mock("../../../platform/tauri/fs", () => ({
  gitHistory: vi.fn(),
  gitCommitFiles: vi.fn(async () => []),
  subscribeGitChanged: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
}));
vi.mock("../hooks/useProjectWorktrees", () => ({
  useProjectWorktrees: () => ({
    data: { worktrees: [{ path: "/repo/tree-a", head: "abc1234" }] },
    refresh: refreshTrees,
  }),
}));

const commit: GitHistoryCommit = {
  sha: "abc1234",
  shortSha: "abc1234",
  parents: ["parent"],
  subject: "Preserve user commit text",
  author: "My Author",
  timestamp: 1_700_000_000,
  head: true,
  refs: [
    { name: "feature/raw-name", kind: "local" },
    { name: "origin/feature/raw-name", kind: "remote" },
  ],
};
let container: HTMLDivElement;
let root: Root;
const onToggleExpanded = vi.fn();
const onOpenCommit = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setUiLanguage("en");
  listeners.clear();
  onToggleExpanded.mockClear();
  onOpenCommit.mockClear();
  refreshTrees.mockClear();
  startDragging.mockClear();
  saveMenuBarVisible(false);
  vi.mocked(gitHistory)
    .mockReset()
    .mockResolvedValue({ head: commit.sha, commits: [commit] });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setUiLanguage("en");
  saveMenuBarVisible(false);
  vi.unstubAllGlobals();
});
async function render(cwd = "/repo", enabled = true) {
  await act(async () =>
    root.render(
      createElement(GitHistoryGraph, {
        cwd,
        enabled,
        expanded: false,
        onToggleExpanded,
        onOpenCommit,
      }),
    ),
  );
}
function button(label: string) {
  return document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  )!;
}
async function open() {
  await render();
  await act(async () => button("Open Git graph").click());
}

it("uses the Settings dialog shell and drags from its header without stealing button or table interaction", async () => {
  await open();
  const shell = document.querySelector<HTMLElement>("[data-app-view-dialog]")!;
  const dialog = shell.querySelector('[role="dialog"]')!;
  expect(shell.style.top).toBe("40px");
  await act(async () => saveMenuBarVisible(true));
  expect(shell.style.top).toBe("36px");
  const header = dialog.querySelector('[data-tauri-drag-region="deep"]')!;
  const press = (target: Element) => {
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      detail: 1,
    });
    act(() => target.dispatchEvent(event));
    return event;
  };
  expect(press(header.querySelector("span")!).defaultPrevented).toBe(true);
  expect(startDragging).toHaveBeenCalledOnce();
  startDragging.mockClear();
  for (const target of [
    button("Refresh Git graph").querySelector("svg")!,
    button("Close").querySelector("svg")!,
    dialog.querySelector("tbody td")!,
  ]) {
    expect(press(target).defaultPrevented).toBe(false);
  }
  expect(startDragging).not.toHaveBeenCalled();
  await act(async () => button("Refresh Git graph").click());
  expect(refreshTrees).toHaveBeenCalledOnce();
  await act(async () => button("Close").click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("opens the complete graph from a collapsed sidebar, localizes labels, and opens commit details", async () => {
  await open();
  expect(onToggleExpanded).not.toHaveBeenCalled();
  expect(gitHistory).toHaveBeenCalledExactlyOnceWith("/repo", 500, true);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("origin/feature/raw-name");
  expect(dialog.textContent).toContain("HEAD");
  expect(
    dialog.querySelector('[title="Worktree: /repo/tree-a"]'),
  ).not.toBeNull();
  expect(dialog.querySelectorAll("th").length).toBe(5);
  await act(async () => setUiLanguage("zh-CN"));
  expect(dialog.textContent).toContain("Git 图谱");
  expect(dialog.textContent).toContain("日期");
  expect(dialog.textContent).toContain("My Author");
  expect(dialog.textContent).toContain("Preserve user commit text");
  await act(async () =>
    dialog.querySelector<HTMLButtonElement>("tbody button")!.click(),
  );
  expect(onOpenCommit).toHaveBeenCalledExactlyOnceWith(commit, true);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(button("打开 Git 图谱"));
});

it("refreshes both history and worktrees while retaining usable rows after a failure", async () => {
  await open();
  vi.mocked(gitHistory).mockRejectedValueOnce(new Error("offline"));
  await act(async () => button("Refresh Git graph").click());
  expect(refreshTrees).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "offline",
  );
  expect(document.querySelector("tbody")?.textContent).toContain(
    commit.subject,
  );
  vi.mocked(gitHistory).mockResolvedValueOnce({ head: null, commits: [] });
  await act(async () => button("Refresh Git graph").click());
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    "No commits yet",
  );
});

it("ignores an older refresh response and dismisses on Escape or repository changes", async () => {
  await open();
  let resolveOld!: (value: {
    head: string | null;
    commits: GitHistoryCommit[];
  }) => void;
  vi.mocked(gitHistory).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await act(async () => {
    for (const listener of listeners) listener();
  });
  vi.mocked(gitHistory).mockResolvedValueOnce({ head: null, commits: [] });
  await act(async () => {
    for (const listener of listeners) listener();
  });
  await act(async () => resolveOld({ head: commit.sha, commits: [commit] }));
  expect(document.querySelector("tbody")?.textContent).not.toContain(
    commit.subject,
  );
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(button("Open Git graph"));
  await act(async () => button("Open Git graph").click());
  await render("/another-repo");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await render("/repo", false);
  expect(button("Open Git graph").disabled).toBe(true);
});
