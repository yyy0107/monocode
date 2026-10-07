// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostSession } from "../features/connections/model/protocol";
import { newSession } from "../features/sessions/model/session";
import type { GitDiffIndex, GitFileDiff } from "../platform/tauri/fs";
import { setUiLanguage } from "../shared/i18n/language";
import type { MobileGitSource } from "./mobileGit";
import { MobileTranscript } from "./MobileTranscript";

let app: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  setUiLanguage("en");
  app = document.createElement("div");
  app.className = "mobile-app";
  document.body.append(app);
  root = createRoot(app);
});
afterEach(() => {
  act(() => root.unmount());
  app.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const index = (both = true): GitDiffIndex => ({
  branch: "feature",
  head: "head",
  additions: 2,
  deletions: 1,
  files: [
    {
      path: "src/app.ts",
      relative: "src/app.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      staged: both,
      unstaged: true,
    },
  ],
  remote: null,
  upstream: null,
  defaultBranch: null,
  ahead: 0,
  behind: 0,
  aheadOfDefault: 0,
  headPushed: false,
});
const diff = (original = "old\n", current = "new\n"): GitFileDiff => ({
  path: "src/app.ts",
  relative: "src/app.ts",
  status: "modified",
  original,
  current,
  binary: false,
  tooLarge: false,
});
async function render(source: MobileGitSource) {
  const snapshot: HostSession = {
    projectId: "project",
    revision: 1,
    status: "idle",
    updatedAt: 1,
    session: {
      ...newSession("codex", "/repo"),
      id: "session",
      blocks: [{ id: "user", role: "user", text: "Change the file" }],
    },
  };
  const onOverlayChange = vi.fn();
  let props: ComponentProps<typeof MobileTranscript> = {
    snapshot,
    disabled: false,
    onCommand: vi.fn(),
    gitSource: source,
    onOverlayChange,
  };
  const update = async (next: Partial<typeof props>) => {
    props = { ...props, ...next };
    await act(async () => root.render(createElement(MobileTranscript, props)));
  };
  await update({});
  return { update, onOverlayChange };
}
const activeDialog = () =>
  app.querySelector<HTMLElement>(
    '.mobile-sheet-backdrop:not([inert]) [role="dialog"]',
  )!;
const page = () =>
  activeDialog()?.querySelector<HTMLElement>('[data-page-active="true"]') ??
  activeDialog();
const click = async (button: HTMLElement) => {
  await act(async () => button.click());
};
const settle = () => act(async () => vi.advanceTimersByTime(400));
async function openReview() {
  await click(
    app.querySelector<HTMLButtonElement>(".mobile-progress-capsule")!,
  );
  await click(
    activeDialog().querySelector<HTMLButtonElement>(".mobile-progress-row")!,
  );
  await settle();
}
const fileButton = (position = 0) =>
  page().querySelectorAll<HTMLButtonElement>(".mobile-git-file-row")[position];

describe("mobile Git review from the progress capsule", () => {
  it("shows counts and one combined uncommitted diff per file with native Back navigation", async () => {
    const source: MobileGitSource = {
      loadIndex: vi.fn(async () => index()),
      loadDiff: vi.fn(async () => diff("HEAD version\n", "Working version\n")),
    };
    const { onOverlayChange } = await render(source);
    expect(
      app.querySelector(".mobile-progress-capsule")?.textContent,
    ).toContain("+2−1");
    await openReview();
    expect(page().textContent).toContain("Uncommitted changes");
    expect(page().textContent).not.toMatch(/Staged|Unstaged|feature/);
    expect(page().querySelectorAll(".mobile-git-file-row")).toHaveLength(1);
    await click(fileButton());
    expect(source.loadDiff).toHaveBeenLastCalledWith("src/app.ts");
    expect(page().textContent).toContain("HEAD version");
    expect(page().textContent).toContain("Working version");
    await act(async () => onOverlayChange.mock.calls.at(-1)![0]());
    expect(page().querySelectorAll(".mobile-git-file-row")).toHaveLength(1);
    await act(async () => onOverlayChange.mock.calls.at(-1)![0]());
    expect(activeDialog().getAttribute("aria-label")).toBe("Session progress");
  });

  it.each([
    [{ binary: true }, "Binary file changed"],
    [{ tooLarge: true }, "Diff is too large to display"],
    [{ original: "same", current: "same" }, "No textual diff"],
  ] as const)(
    "keeps zero-line changes reachable and explains %s",
    async (overrides, message) => {
      const source: MobileGitSource = {
        loadIndex: vi.fn(async () => ({
          ...index(false),
          additions: 0,
          deletions: 0,
        })),
        loadDiff: vi.fn(async () => ({ ...diff(), ...overrides })),
      };
      await render(source);
      expect(
        app.querySelector(".mobile-progress-capsule")?.textContent,
      ).toContain("+0−0");
      await openReview();
      await click(fileButton());
      expect(page().textContent).toContain(message);
      expect(page().querySelector(".file-preview-list")).toBeNull();
    },
  );

  it("shows errors instead of an empty diff and retries the selected file", async () => {
    const loadIndex = vi.fn(async () => index(false));
    loadIndex.mockRejectedValueOnce(new Error("Index read failed"));
    const loadDiff = vi.fn(async () => diff());
    loadDiff.mockRejectedValueOnce(new Error("File changed during read"));
    await render({ loadIndex, loadDiff });
    await click(
      app.querySelector<HTMLButtonElement>(".mobile-progress-capsule")!,
    );
    expect(activeDialog().textContent).toContain("Could not load changes.");
    await click(
      activeDialog().querySelector<HTMLButtonElement>(".mobile-progress-row")!,
    );
    await click(fileButton());
    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      "File changed during read",
    );
    expect(page().textContent).not.toContain("No textual diff");
    await click(
      page().querySelector<HTMLButtonElement>(
        '[aria-label="Refresh changes"]',
      )!,
    );
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(page().querySelector(".file-preview-list")?.textContent).toContain(
      "new",
    );
  });

  it("refreshes an emptied working copy without dismissing review or keeping stale capsule counts", async () => {
    const loadIndex = vi.fn(async () => index(false));
    await render({ loadIndex, loadDiff: vi.fn(async () => diff()) });
    await openReview();
    loadIndex.mockResolvedValue({
      ...index(false),
      files: [],
      additions: 0,
      deletions: 0,
    });
    await click(
      page().querySelector<HTMLButtonElement>(
        '[aria-label="Refresh changes"]',
      )!,
    );
    expect(page().textContent).toContain("No file changes");
    expect(page().querySelector(".mobile-git-file-row")).toBeNull();
    await click(
      page().querySelector<HTMLButtonElement>('[aria-label="Back"]')!,
    );
    expect(activeDialog().getAttribute("aria-label")).toBe("Session progress");
    expect(
      app.querySelector(".mobile-progress-capsule")?.textContent,
    ).not.toContain("+2");
  });

  it("ignores a file response after navigating to another file", async () => {
    let finish!: (value: GitFileDiff) => void;
    const loadDiff = vi.fn<MobileGitSource["loadDiff"]>(async () =>
      diff("Index\n", "Current\n"),
    );
    loadDiff.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const files = index().files;
    await render({
      loadIndex: vi.fn(async () => ({
        ...index(),
        files: [...files, { ...files[0], relative: "src/other.ts" }],
      })),
      loadDiff,
    });
    await openReview();
    await click(fileButton());
    await click(
      page().querySelector<HTMLButtonElement>('[aria-label="Back"]')!,
    );
    await click(fileButton(1));
    await act(async () => finish(diff("Old request\n", "Old result\n")));
    expect(page().textContent).toContain("Current");
    expect(page().textContent).not.toContain("Old result");
  });
});
