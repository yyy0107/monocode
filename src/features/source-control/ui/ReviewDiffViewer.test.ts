// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FileDiffProps } from "@pierre/diffs/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import {
  ADD_TO_CHAT_EVENT,
  type AddToChatRequest,
} from "../../sessions/model/quoteDraft";
import { prepareReviewDiff } from "../model/reviewDiff";
import { ReviewDiffViewer } from "./ReviewDiffViewer";

const hover = vi.hoisted(() => ({
  side: "deletions" as "additions" | "deletions",
  lineNumber: 2,
}));
vi.mock("@pierre/diffs/react", () => ({
  useWorkerPool: () => undefined,
  FileDiff: (props: FileDiffProps<number>) =>
    createElement(
      "div",
      { "data-pierre": "" },
      props.renderGutterUtility?.(() => hover),
      ...(props.lineAnnotations?.map((annotation) =>
        createElement(
          "div",
          { key: annotation.metadata },
          props.renderAnnotation?.(annotation),
        ),
      ) ?? []),
    ),
}));
vi.mock("../../../shared/hooks/useColorScheme", () => ({
  useColorScheme: () => "dark",
}));

let root: Root;
let container: HTMLDivElement;
const diff = prepareReviewDiff({
  original: "one\nremoved\nthree\n",
  current: "one\nadded\nextra\nthree\n",
  binary: false,
  tooLarge: false,
});
const stage = vi.fn();
function render(expanded: boolean) {
  act(() =>
    root.render(
      createElement(AnimatedCollapse, {
        expanded,
        motion: "height",
        children: () =>
          createElement(ReviewDiffViewer, {
            path: "/repo/a.ts",
            relative: "a.ts",
            diff,
            busy: false,
            onStageHunk: stage,
          }),
      }),
    ),
  );
}
function openComment() {
  act(() =>
    container
      .querySelector<HTMLButtonElement>('button[title="Comment on line"]')!
      .click(),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  stage.mockClear();
  hover.side = "deletions";
  hover.lineNumber = 2;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each([
  ["deletions", 2, "`/repo/a.ts:2` (deleted line)", "> -removed"],
  ["additions", 3, "`/repo/a.ts:3`", "> +extra"],
  ["additions", 4, "`/repo/a.ts:4`", ">  three"],
] as const)(
  "sends a %s line %s comment through the existing add-to-chat event",
  (side, line, location, quote) => {
    hover.side = side;
    hover.lineNumber = line;
    render(true);
    openComment();
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Leave a comment…"]',
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(textarea, "Please check this");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const received: AddToChatRequest[] = [];
    const listener = (event: Event) =>
      received.push((event as CustomEvent<AddToChatRequest>).detail);
    window.addEventListener(ADD_TO_CHAT_EVENT, listener);
    try {
      act(() =>
        textarea
          .closest("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
      );
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ mode: "plain" });
      expect(received[0].text).toContain(location);
      expect(received[0].text).toContain(quote);
      expect(received[0].text).toContain("Please check this");
      expect(
        document.querySelector('textarea[placeholder="Leave a comment…"]'),
      ).toBeNull();
    } finally {
      window.removeEventListener(ADD_TO_CHAT_EVENT, listener);
    }
  },
);

it("disables actions and removes the comment portal during closing, then supports rapid reversal", () => {
  render(true);
  openComment();
  expect(
    document.querySelector('textarea[placeholder="Leave a comment…"]'),
  ).not.toBeNull();
  const viewer = container.querySelector("[data-pierre]");
  render(false);
  expect(container.querySelector("[data-pierre]")).toBe(viewer);
  expect(container.querySelector<HTMLElement>(".zen-fold-item")?.inert).toBe(
    true,
  );
  expect(
    document.querySelector('textarea[placeholder="Leave a comment…"]'),
  ).toBeNull();
  expect(
    [...container.querySelectorAll<HTMLButtonElement>("button")].every(
      (button) => button.disabled,
    ),
  ).toBe(true);
  act(() => vi.advanceTimersByTime(100));
  render(true);
  expect(container.querySelector("[data-pierre]")).toBe(viewer);
  expect(
    container.querySelector<HTMLButtonElement>(
      'button[title="Comment on line"]',
    )?.disabled,
  ).toBe(false);
  act(() => vi.advanceTimersByTime(350));
  expect(container.querySelector("[data-pierre]")).toBe(viewer);
  render(false);
  act(() => vi.advanceTimersByTime(350));
  expect(container.querySelector("[data-pierre]")).toBeNull();
});

it("passes Monocode chunk positions to the stage action", () => {
  render(true);
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((item) => item.textContent === "Stage hunk")!;
  act(() => button.click());
  expect(stage).toHaveBeenCalledWith(
    diff.unified!.lines.find((line) => line.kind === "add")!.pos,
  );
});
