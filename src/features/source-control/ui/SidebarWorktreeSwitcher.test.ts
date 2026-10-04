// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  setWorktreeFocus,
  worktreeFocus,
  type WorktreeFocus,
} from "../model/worktreeFocus";
import { SidebarWorktreeSwitcher } from "./SidebarWorktreeSwitcher";

const { branchState, worktreeState, refreshWorktrees } = vi.hoisted(() => ({
  branchState: vi.fn(),
  worktreeState: vi.fn(),
  refreshWorktrees: vi.fn(async () => true),
}));
vi.mock("../hooks/useProjectBranches", () => ({
  useProjectBranchesState: branchState,
}));
vi.mock("../hooks/useProjectWorktrees", () => ({
  useProjectWorktrees: worktreeState,
}));
const loadedWorktrees = () => ({
  data: {
    worktrees: [
      { path: "/picker", branch: "main", isMain: true },
      { path: "/picker-a", branch: "feature-a", isMain: false },
      { path: "/picker-b", branch: "feature-b", isMain: false },
    ],
  },
  refresh: refreshWorktrees,
});
let root: Root;
let container: HTMLDivElement;
const select = vi.fn<(focus?: WorktreeFocus) => void>();
const render = async (pending = false, switchError?: string) => {
  await act(async () =>
    root.render(
      createElement(SidebarWorktreeSwitcher, {
        cwd: "/picker",
        onSelect: select,
        pending,
        switchError,
      }),
    ),
  );
};
const trigger = () =>
  container.querySelector<HTMLButtonElement>(
    '[aria-label="Switch working copy"]',
  )!;
const option = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
    (button) => button.textContent?.includes(name),
  )!;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setWorktreeFocus("/picker", undefined);
  select.mockReset();
  refreshWorktrees.mockClear();
  branchState.mockReturnValue({
    branches: { current: "main", detached: false, branches: [] },
    settled: true,
  });
  worktreeState.mockReset().mockImplementation((_cwd, enabled = true) =>
    enabled ? loadedWorktrees() : { refresh: refreshWorktrees },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("keeps an ordinary folder title without requesting Git worktrees", async () => {
  branchState.mockReturnValue({
    branches: { current: null, detached: false, branches: [] },
    settled: true,
  });
  await render();
  expect(worktreeState).toHaveBeenLastCalledWith("/picker", false);
  expect(container.textContent).toBe("picker");
  expect(trigger()).toBeNull();
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

it("waits for repository discovery before requesting worktrees", async () => {
  branchState.mockReturnValue({ branches: null, settled: false });
  await render();
  expect(worktreeState).toHaveBeenLastCalledWith("/picker", false);
  expect(trigger()).toBeNull();
  branchState.mockReturnValue({
    branches: { current: "abc1234", detached: true, branches: [] },
    settled: true,
  });
  await render();
  expect(worktreeState).toHaveBeenLastCalledWith("/picker", true);
  expect(trigger()).not.toBeNull();
});

it.each([false, true])(
  "still shows a real worktree query failure (branch lookup failed=%s)",
  async (branchLookupFailed) => {
    if (branchLookupFailed)
      branchState.mockReturnValue({ branches: null, settled: true });
    worktreeState.mockReturnValue({
      error: "Permission denied",
      refresh: refreshWorktrees,
    });
    await render();
    await act(async () => trigger().click());
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "Permission denied",
    );
  },
);

it("requests a switch without publishing the destination and permits a newer selection", async () => {
  await render();
  await act(async () => trigger().click());
  await act(async () => option("feature-a").click());
  expect(select).toHaveBeenLastCalledWith({
    path: "/picker-a",
    branch: "feature-a",
  });
  expect(worktreeFocus("/picker")).toBeUndefined();
  await render(true);
  expect(trigger().getAttribute("aria-busy")).toBe("true");
  expect(trigger().textContent).toBe("picker");
  await act(async () => trigger().click());
  await act(async () => option("feature-b").click());
  expect(select).toHaveBeenLastCalledWith({
    path: "/picker-b",
    branch: "feature-b",
  });
  expect(worktreeFocus("/picker")).toBeUndefined();
});

it("shows a switch failure in the reopened picker", async () => {
  await render();
  await render(false, "Working copy no longer exists");
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Working copy no longer exists",
  );
  expect(trigger().textContent).toBe("picker");
});

it("requests fallback from a deleted worktree once and does not retry while pending or failed", async () => {
  setWorktreeFocus("/picker", { path: "/deleted", branch: "gone" });
  await render();
  expect(select).toHaveBeenCalledExactlyOnceWith(undefined);
  await render(true);
  await render(false, "Could not switch working copy");
  expect(select).toHaveBeenCalledTimes(1);
  expect(worktreeFocus("/picker")?.path).toBe("/deleted");
});
