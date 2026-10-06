// @vitest-environment happy-dom
import { act, createElement, useEffect, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectTerminalDock } from "./ProjectTerminalDock";
import { createProjectTerminal } from "../../projects/model/projectTerminal";
import { newTerminalFile } from "../../workspace/model/layout";
import { SurfaceVisibilityContext } from "../../../shared/ui/SurfaceVisibility";

const lifetime = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("./TerminalView", () => ({
  TerminalView: ({ active }: { active: boolean }) => {
    useEffect(() => {
      lifetime.mount();
      return lifetime.unmount;
    }, []);
    return createElement("div", { "data-terminal-active": active });
  },
}));
vi.mock("../../../app/shell/WindowChrome", () => ({
  IconButton: ({ label, onClick }: { label: string; onClick: () => void }) =>
    createElement("button", { "aria-label": label, onClick }, label),
}));

let root: Root;
let container: HTMLDivElement;
let props: ComponentProps<typeof ProjectTerminalDock>;
async function render(visible: boolean) {
  await act(async () => {
    root.render(
      createElement(
        SurfaceVisibilityContext.Provider,
        { value: visible },
        createElement(ProjectTerminalDock, props),
      ),
    );
    await vi.dynamicImportSettled();
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  lifetime.mount.mockClear();
  lifetime.unmount.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = {
    dock: createProjectTerminal("/repo", newTerminalFile("/repo")),
    focused: true,
    onFocus: vi.fn(),
    onHide: vi.fn(),
    onSideChange: vi.fn(),
    onSizePaint: vi.fn(),
    onSizeCommit: vi.fn(),
    onAddTerminal: vi.fn(),
    onSelectTerminal: vi.fn(),
    onCloseTerminal: vi.fn(),
    onCloseOtherTerminals: vi.fn(),
    onReorderTerminals: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps running content mounted, suppresses focus and hides the move menu during collapse", async () => {
  await render(true);
  const terminal = container.querySelector<HTMLElement>(
    "[data-terminal-active]",
  )!;
  expect(terminal.dataset.terminalActive).toBe("true");
  act(() =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Move Terminal"]')!
      .click(),
  );
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  await render(false);
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(terminal.dataset.terminalActive).toBe("false");
  act(() =>
    terminal.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(props.onFocus).not.toHaveBeenCalled();
  await render(true);
  expect(container.querySelector("[data-terminal-active]")).toBe(terminal);
  expect(lifetime.mount).toHaveBeenCalledTimes(1);
  expect(lifetime.unmount).not.toHaveBeenCalled();
});

it("commits and releases an active resize before closing, cancelling queued paint", async () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 42),
  );
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  await render(true);
  const sash = container.querySelector<HTMLElement>('[role="separator"]')!;
  sash.setPointerCapture = vi.fn();
  sash.hasPointerCapture = vi.fn(() => true);
  sash.releasePointerCapture = vi.fn();
  act(() => {
    sash.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 7,
        clientY: 100,
        bubbles: true,
      }),
    );
    sash.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 7,
        clientY: 80,
        bubbles: true,
      }),
    );
  });
  expect(document.body.style.cursor).toBe("row-resize");
  await render(false);
  expect(props.onSizeCommit).toHaveBeenCalledExactlyOnceWith(240);
  expect(props.onSizePaint).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledWith(42);
  expect(sash.releasePointerCapture).toHaveBeenCalledWith(7);
  expect(document.body.style.cursor).not.toBe("row-resize");
});
