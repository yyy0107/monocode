// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaneTree } from "./PaneTree";

vi.mock("../../files/ui/FilePane", () => ({ FilePane: () => null }));
vi.mock("../../sessions/ui/SessionPane", () => ({ SessionPane: () => null }));

let container: HTMLDivElement;
let root: Root;
let pendingFrame: FrameRequestCallback | undefined;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingFrame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pendingFrame = undefined;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  pendingFrame = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(dir: "right" | "down") {
  const noop = vi.fn();
  const onRatio = vi.fn();
  const props: ComponentProps<typeof PaneTree> = {
    visible: true,
    layout: {
      type: "split",
      id: "split",
      dir,
      children: [
        { type: "leaf", id: "first" },
        { type: "leaf", id: "second" },
      ],
      sizes: [0.5, 0.5],
    },
    sessions: [],
    editorPanes: [],
    dirtyFileIds: new Set(),
    fileErrorCounts: new Map(),
    focusedId: "first",
    composerFocused: false,
    recents: [],
    onFocus: noop,
    onClose: noop,
    onSelectFile: noop,
    onCloseFile: noop,
    onCloseOtherFiles: noop,
    onReorderFiles: noop,
    onFileDirtyChange: noop,
    onFileErrorCountChange: noop,
    onRatio,
    onCwdChange: noop,
    onBranchChange: noop,
    onWorkspaceModeChange: noop,
    onWorktreeBaseChange: noop,
    onModelChange: noop,
    onModelSettingsChange: noop,
    onRuntimeModeChange: noop,
    onSubmit: noop,
    onSaveDraft: noop,
    onRemoveDraft: noop,
    onStop: noop,
    onCompactContext: noop,
    onPlaceSessionInFolder: noop,
    onDeleteQueuedMessage: noop,
    onEditQueuedMessage: noop,
    onQueuedMessageEditingChange: noop,
    onSteerQueuedMessage: noop,
    onResumeQueue: noop,
    onUsageLimitResume: noop,
    onUsageLimitResumeAtReset: noop,
    onUsageLimitDismiss: noop,
    onApproval: noop,
    onQuestionReply: noop,
    onOpenFile: noop,
    onOpenDiff: noop,
    onOpenPlan: noop,
    onUpdatePlan: noop,
    onBuildPlan: noop,
    onMovePane: noop,
    onDetachPane: noop,
    onNewTerminal: noop,
  };
  act(() => root.render(createElement(PaneTree, props)));
  container.firstElementChild!.getBoundingClientRect = () =>
    new DOMRect(100, 100, 1000, 800);
  const separator = container.querySelector<HTMLElement>('[role="separator"]')!;
  const handle = separator.firstElementChild as HTMLElement;
  const capture = new Set<number>();
  handle.setPointerCapture = (id) => capture.add(id);
  handle.hasPointerCapture = (id) => capture.has(id);
  handle.releasePointerCapture = (id) => capture.delete(id);
  return { onRatio, separator, handle, capture };
}

function pointer(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
) {
  act(() =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX,
        clientY,
      }),
    ),
  );
}

describe("workspace split resize handles", () => {
  it.each(["right", "down"] as const)(
    "previews and commits a %s split through the enlarged target",
    (dir) => {
      const { onRatio, separator, handle, capture } = render(dir);
      const previousCursor = document.body.style.cursor;
      expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
      expect(separator.getAttribute("aria-orientation")).toBe(
        dir === "right" ? "vertical" : "horizontal",
      );
      pointer(handle, "pointerdown", 600, 500);
      expect(capture.has(1)).toBe(true);
      pointer(handle, "pointermove", 750, 620);
      act(() => pendingFrame?.(0));
      expect(separator.getAttribute("aria-valuenow")).toBe("65");
      pointer(handle, "pointerup", 750, 620);
      expect(onRatio).toHaveBeenCalledExactlyOnceWith("split", 0, 0.65);
      expect(capture.has(1)).toBe(false);
      expect(document.body.style.cursor).toBe(previousCursor);
    },
  );

  it.each(["right", "down"] as const)(
    "moves a %s divider by only the pointer delta when grabbed at the target's far edge",
    (dir) => {
      const { onRatio, handle } = render(dir);
      const row = dir === "right";
      pointer(handle, "pointerdown", row ? 615 : 600, row ? 500 : 515);
      pointer(handle, "pointermove", row ? 616 : 600, row ? 500 : 516);
      act(() => pendingFrame?.(0));

      const pane = container.querySelector<HTMLElement>(
        '[data-pane-id="first"]',
      )!;
      const span = row ? 1000 : 800;
      expect(
        parseFloat(row ? pane.style.width : pane.style.height),
      ).toBeCloseTo(50 + 100 / span);

      pointer(handle, "pointerup", row ? 616 : 600, row ? 500 : 516);
      expect(onRatio).toHaveBeenCalledExactlyOnceWith(
        "split",
        0,
        0.5 + 1 / span,
      );
    },
  );

  it("restores the original ratio on Escape and cancels pending paint", () => {
    const { onRatio, separator, handle, capture } = render("right");
    pointer(handle, "pointerdown", 600, 500);
    pointer(handle, "pointermove", 750, 500);
    act(() => pendingFrame?.(0));
    expect(separator.getAttribute("aria-valuenow")).toBe("65");
    pointer(handle, "pointermove", 800, 500);
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(pendingFrame).toBeUndefined();
    expect(onRatio).not.toHaveBeenCalled();
    expect(capture.has(1)).toBe(false);
  });
});
