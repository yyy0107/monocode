// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  gitDiffFiles,
  gitFileDiff,
  gitDiscardFile,
  gitStageFile,
  gitUnstageFile,
  gitStageContents,
  revealPath,
  type GitChangedFile,
  type GitDiffIndex,
} from "../../../platform/tauri/fs";
import { copyText } from "../../../platform/tauri/clipboard";
import {
  sessionCheckpointStatus,
  type CheckpointStatus,
} from "../../sessions/model/checkpoint";
import type { ReviewLoadedDiff } from "../model/reviewDiff";
import { GitReviewPane, type GitReviewPaneProps } from "./GitReviewPane";
import { WorkingTreeDiff } from "./WorkingTreeDiff";

vi.mock("../../../platform/tauri/fs", () => ({
  basename: (path: string) => path.split("/").pop()!,
  gitDiffFiles: vi.fn(),
  gitFileDiff: vi.fn(),
  gitDiscardFile: vi.fn(async () => {}),
  gitStageFile: vi.fn(async () => {}),
  gitUnstageFile: vi.fn(async () => {}),
  gitStageContents: vi.fn(async () => {}),
  revealPath: vi.fn(async () => {}),
  notifyGitChanged: vi.fn(),
  subscribeGitChanged: () => () => {},
}));
vi.mock("../../../platform/tauri/clipboard", () => ({
  copyText: vi.fn(async () => {}),
}));
vi.mock("../../sessions/model/checkpoint", () => ({
  sessionCheckpointStatus: vi.fn(),
  sessionCheckpointFileDiff: vi.fn(),
  subscribeReviewChanged: () => () => {},
}));
vi.mock("../../files/ui/FileTypeIcon", () => ({ FileTypeIcon: () => null }));
vi.mock("./ReviewDiffsWorkerPool", () => ({
  ReviewDiffsWorkerPool: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./ReviewDiffViewer", () => ({
  ReviewDiffViewer: ({
    diff,
    onStageHunk,
  }: {
    diff: ReviewLoadedDiff;
    onStageHunk?: (pos: number) => void;
  }) =>
    createElement(
      "div",
      { "data-diff-content": "" },
      diff.current,
      onStageHunk &&
        createElement(
          "button",
          {
            title: "Stage hunk",
            onClick: () =>
              onStageHunk(
                diff.unified!.lines.find((line) => line.pos != null)!.pos!,
              ),
          },
          "Stage hunk",
        ),
    ),
}));

// happy-dom has no layout engine. Supply deterministic dimensions to the real
// TanStack virtualizer and manually deliver resize observations after DOM changes.
const observers = new Set<TestResizeObserver>();
class TestResizeObserver {
  targets = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {
    observers.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    observers.delete(this);
  }
  deliver() {
    this.callback(
      [...this.targets]
        .filter((target) => target.isConnected)
        .map((target) => ({
          target,
          borderBoxSize: [
            {
              inlineSize: 800,
              blockSize: (target as HTMLElement).offsetHeight,
            },
          ],
        })) as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }
}
/** Diffs mount after the open animation completes. */
async function settle() {
  await act(async () => vi.advanceTimersByTimeAsync(350));
}
async function measure() {
  await act(async () => {
    for (const observer of observers) observer.deliver();
    await vi.advanceTimersByTimeAsync(20);
  });
}
let root: Root;
let container: HTMLDivElement;
const files: GitChangedFile[] = Array.from({ length: 30 }, (_, index) => ({
  path: `/repo/dir/file${index}.ts`,
  relative: `dir/file${index}.ts`,
  status: "modified",
  additions: 1,
  deletions: 1,
  staged: true,
  unstaged: true,
}));
const comparison = {
  ...files[0],
  original: "unchanged\nold\n",
  current: "unchanged\nnew\n",
  binary: false,
  tooLarge: false,
};
const scroller = () =>
  container.querySelector<HTMLElement>(".overscroll-contain")!;
const listHeight = () =>
  Number.parseFloat((scroller().firstElementChild as HTMLElement).style.height);
const card = (index: number) =>
  container.querySelector<HTMLElement>(
    `[data-review-file="dir/file${index}.ts"]`,
  )!;
async function click(title: string, within: ParentNode = container) {
  await act(async () =>
    within
      .querySelector<HTMLButtonElement>(`button[title="${title}"]`)!
      .click(),
  );
}
async function select(source: string) {
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!
      .click(),
  );
  const option = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
  ].find((node) => node.textContent === source)!;
  await act(async () => option.click());
}
async function render(props: Partial<GitReviewPaneProps> = {}) {
  await act(async () =>
    root.render(
      createElement(GitReviewPane, {
        cwd: "/repo",
        ...props,
      }),
    ),
  );
  // Browsers emit scroll after scrollToIndex; happy-dom only updates scrollTop.
  await act(async () => scroller().dispatchEvent(new Event("scroll")));
  await measure();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  observers.clear();
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("overscroll-contain")) return 74;
      if (this.hasAttribute("data-index"))
        return this.querySelector(".zen-fold-item") ? 337 : 37;
      return 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    100_000,
  );
  vi.mocked(gitDiffFiles).mockResolvedValue({ files } as GitDiffIndex);
  vi.mocked(gitFileDiff).mockResolvedValue(comparison);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("virtualizes cards, supports multiple expansions, and removes offscreen expanded heights on collapse all", async () => {
  await render();
  expect(container.querySelectorAll("[data-review-file]").length).toBeLessThan(
    files.length,
  );
  expect(gitFileDiff).not.toHaveBeenCalled();
  await click("Expand file", card(0));
  await click("Expand file", card(1));
  expect(card(0).querySelector("[data-diff-content]")).toBeNull();
  await settle();
  await measure();
  expect(card(0).querySelector("[data-diff-content]")).not.toBeNull();
  expect(card(1).querySelector("[data-diff-content]")).not.toBeNull();
  expect(listHeight()).toBe(37 * files.length + 600);
  await act(async () => {
    scroller().scrollTop = 1200;
    scroller().dispatchEvent(new Event("scroll"));
  });
  expect(card(0)).toBeNull();
  expect(card(1)).toBeNull();
  await click("Collapse all");
  expect(listHeight()).toBe(37 * files.length);
  await act(async () => {
    scroller().scrollTop = 0;
    scroller().dispatchEvent(new Event("scroll"));
  });
  const loadsBefore = vi.mocked(gitFileDiff).mock.calls.length;
  await click("Expand all");
  // Rows are re-estimated at their expanded size in the same render, so only the
  // cards near the viewport mount and load instead of every collapsed row in view.
  expect(listHeight()).toBeGreaterThan(37 * files.length * 2);
  expect(
    container.querySelectorAll("[data-review-file]").length,
  ).toBeLessThanOrEqual(3);
  expect(
    vi.mocked(gitFileDiff).mock.calls.length - loadsBefore,
  ).toBeLessThanOrEqual(3);
  await settle();
  await measure();
  expect(
    container.querySelectorAll("[data-diff-content]").length,
  ).toBeGreaterThan(1);
  await click("Collapse all");
  expect(container.querySelector("[data-diff-content]")).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(350));
  await measure();
  expect(container.querySelector("[data-diff-content]")).toBeNull();
  expect(listHeight()).toBe(37 * files.length);
});

it("retains the card and scroll position during refresh and reloads its invalidated diff", async () => {
  await render();
  await click("Expand file", card(0));
  await settle();
  const existing = card(0);
  scroller().scrollTop = 50;
  let finish!: (value: GitDiffIndex) => void;
  vi.mocked(gitDiffFiles).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  vi.mocked(gitFileDiff).mockResolvedValueOnce({
    ...comparison,
    current: "refreshed\n",
  });
  await click("Refresh changes");
  expect(card(0)).toBe(existing);
  expect(scroller().scrollTop).toBe(50);
  expect(card(0).textContent).toContain("refreshed");
  expect(gitFileDiff).toHaveBeenCalledTimes(2);
  await act(async () => finish({ files } as GitDiffIndex));
  expect(card(0)).toBe(existing);
});

it("uses Monocode file operations and stages the chunk's document position", async () => {
  await render();
  await click("Stage file", card(0));
  expect(gitStageFile).toHaveBeenCalledWith("/repo", files[0].relative);
  await click("Discard changes", card(0));
  expect(gitDiscardFile).toHaveBeenCalledWith("/repo", files[0].relative);
  await click("Expand file", card(0));
  await settle();
  await click("Stage hunk", card(0));
  expect(gitStageContents).toHaveBeenCalledWith(
    "/repo",
    files[0].relative,
    comparison.current,
  );
  await select("Staged");
  await click("Unstage file", card(0));
  expect(gitUnstageFile).toHaveBeenCalledWith("/repo", files[0].relative);
  expect(card(0).querySelector('[title="Stage hunk"]')).toBeNull();
  expect(card(0).querySelector('[title="Discard changes"]')).toBeNull();
  for (const [label, operation, expected] of [
    ["Copy absolute path", copyText, files[0].path],
    ["Copy relative path", copyText, files[0].relative],
    ["Reveal in file manager", revealPath, files[0].path],
  ] as const) {
    await click("File actions", card(0));
    const item = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === label)!;
    await act(async () => item.click());
    expect(operation).toHaveBeenLastCalledWith(expected);
  }
});

it("initializes from the tab's staged source and expands and scrolls to the focused file", async () => {
  await act(async () =>
    root.render(
      createElement(WorkingTreeDiff, {
        cwd: "/repo",
        focusKind: "staged",
        focusPath: files[25].path,
      }),
    ),
  );
  await act(async () => scroller().dispatchEvent(new Event("scroll")));
  await measure();
  expect(gitFileDiff).toHaveBeenCalledWith(
    "/repo",
    files[25].relative,
    "staged",
  );
  expect(card(25).querySelector("[data-diff-content]")).not.toBeNull();
  expect(scroller().scrollTop).toBeGreaterThan(0);
});

it("offers session checkpoints only on a session tab and keeps Undo/Keep outside the pane", async () => {
  await render();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!
      .click(),
  );
  expect(
    [...document.querySelectorAll('[role="option"]')].map(
      (node) => node.textContent,
    ),
  ).toEqual(["Uncommitted", "Unstaged", "Staged", "Committed", "Branch"]);
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!
      .click(),
  );
  vi.mocked(sessionCheckpointStatus).mockResolvedValue({
    files,
  } as unknown as CheckpointStatus);
  await render({ sessionId: "s1" });
  await select("Session changes");
  expect(sessionCheckpointStatus).toHaveBeenLastCalledWith("s1", "/repo");
  expect(card(0).querySelector('[title="Stage file"]')).toBeNull();
  expect(container.textContent).not.toMatch(/Undo|Keep/);
});
