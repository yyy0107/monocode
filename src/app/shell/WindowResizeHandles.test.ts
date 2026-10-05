// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowResizeHandles } from "./WindowResizeHandles";

const native = vi.hoisted(() => ({
  environment: { tauri: true, linux: true, windows: false },
  getCurrentWindow: vi.fn(),
  isResizable: vi.fn(),
  isMaximized: vi.fn(),
  isFullscreen: vi.fn(),
  onResized: vi.fn(),
  startResizeDragging: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => native.environment.tauri,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: native.getCurrentWindow,
}));
vi.mock("../../platform/tauri/platform", () => ({
  get IS_LINUX() {
    return native.environment.linux;
  },
  get IS_WIN() {
    return native.environment.windows;
  },
}));

const DIRECTIONS = [
  "East",
  "North",
  "NorthEast",
  "NorthWest",
  "South",
  "SouthEast",
  "SouthWest",
  "West",
] as const;

let container: HTMLDivElement;
let root: Root;
let unmounted: boolean;
let onResized: (() => void) | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function render() {
  await act(async () => {
    root.render(createElement(WindowResizeHandles));
  });
}

function handles() {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-window-resize-direction]"),
  );
}

function handle(direction: string) {
  const element = handles().find(
    (candidate) => candidate.dataset.windowResizeDirection === direction,
  );
  expect(element).toBeDefined();
  return element!;
}

async function resizeEvent() {
  expect(onResized).toBeDefined();
  await act(async () => onResized!());
}

async function press(direction: string, button = 0) {
  const event = new MouseEvent("mousedown", {
    button,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    handle(direction).dispatchEvent(event);
  });
  return event;
}

function unmount() {
  act(() => root.unmount());
  unmounted = true;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  native.environment.tauri = true;
  native.environment.linux = true;
  native.environment.windows = false;
  native.isResizable.mockReset().mockResolvedValue(true);
  native.isMaximized.mockReset().mockResolvedValue(false);
  native.isFullscreen.mockReset().mockResolvedValue(false);
  native.startResizeDragging.mockReset().mockResolvedValue(undefined);
  native.unlisten.mockReset();
  native.getCurrentWindow.mockReset().mockReturnValue(native);
  native.onResized.mockReset().mockImplementation(async (callback: () => void) => {
    onResized = callback;
    return native.unlisten;
  });
  onResized = undefined;
  unmounted = false;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  if (!unmounted) unmount();
  container.remove();
  vi.unstubAllGlobals();
});

describe("native window resize handles", () => {
  it.each(["Linux", "Windows"])(
    "dispatches all four edges and four corners to native resizing on %s",
    async (platform) => {
      native.environment.linux = platform === "Linux";
      native.environment.windows = platform === "Windows";
      await render();
      expect(
        handles().map((element) => element.dataset.windowResizeDirection).sort(),
      ).toEqual([...DIRECTIONS].sort());
      expect(
        container
          .querySelector("[data-window-resize-handles]")
          ?.getAttribute("aria-hidden"),
      ).toBe("true");
      for (const direction of DIRECTIONS) {
        expect(handle(direction).getAttribute("data-tauri-drag-region")).toBe(
          "false",
        );
        await press(direction);
      }
      expect(
        native.startResizeDragging.mock.calls.map(([direction]) => direction),
      ).toEqual(DIRECTIONS);
    },
  );

  it("ignores secondary and middle mouse buttons", async () => {
    await render();
    await press("East", 1);
    await press("NorthWest", 2);
    expect(native.startResizeDragging).not.toHaveBeenCalled();
  });

  it("prevents a resize press from also reaching document title-drag handlers", async () => {
    await render();
    const titleDrag = vi.fn();
    document.addEventListener("mousedown", titleDrag);
    try {
      const event = await press("NorthEast");
      expect(event.defaultPrevented).toBe(true);
      expect(titleDrag).not.toHaveBeenCalled();
      expect(native.startResizeDragging).toHaveBeenCalledExactlyOnceWith(
        "NorthEast",
      );
    } finally {
      document.removeEventListener("mousedown", titleDrag);
    }
  });

  it.each([
    ["fixed size", "isResizable", false],
    ["maximized", "isMaximized", true],
    ["fullscreen", "isFullscreen", true],
  ] as const)("has no pointer targets while %s", async (_state, query, value) => {
    native[query].mockResolvedValue(value);
    await render();
    expect(handles()).toHaveLength(0);
    expect(native.startResizeDragging).not.toHaveBeenCalled();
  });

  it.each(["browser", "macOS"])(
    "leaves native borders and app controls unobstructed in %s",
    async (environment) => {
      if (environment === "browser") native.environment.tauri = false;
      else native.environment.linux = false;
      await render();
      expect(handles()).toHaveLength(0);
      expect(native.getCurrentWindow).not.toHaveBeenCalled();
      expect(native.onResized).not.toHaveBeenCalled();
    },
  );

  it("removes targets when maximizing and restores them after returning to a resizable window", async () => {
    await render();
    expect(handles()).toHaveLength(8);
    native.isMaximized.mockResolvedValue(true);
    await resizeEvent();
    expect(handles()).toHaveLength(0);
    native.isMaximized.mockResolvedValue(false);
    await resizeEvent();
    expect(handles()).toHaveLength(8);
    native.isFullscreen.mockResolvedValue(true);
    await resizeEvent();
    expect(handles()).toHaveLength(0);
  });

  it("starts disabled and ignores stale state reads after a newer resize refresh", async () => {
    const initialMaximized = deferred<boolean>();
    native.isMaximized
      .mockImplementationOnce(() => initialMaximized.promise)
      .mockResolvedValue(true);
    await render();
    expect(handles()).toHaveLength(0);
    await resizeEvent();
    expect(handles()).toHaveLength(0);
    await act(async () => initialMaximized.resolve(false));
    expect(handles()).toHaveLength(0);
  });

  it("unsubscribes its native resize listener on unmount", async () => {
    await render();
    unmount();
    expect(native.unlisten).toHaveBeenCalledOnce();
  });

  it("cleans up a listener registered after unmount and ignores pending state", async () => {
    const listener = deferred<() => void>();
    const resizable = deferred<boolean>();
    native.onResized.mockImplementationOnce(() => listener.promise);
    native.isResizable.mockImplementationOnce(() => resizable.promise);
    await render();
    unmount();
    await act(async () => {
      listener.resolve(native.unlisten);
      resizable.resolve(true);
    });
    expect(native.unlisten).toHaveBeenCalledOnce();
    expect(handles()).toHaveLength(0);
  });

  it("keeps targets disabled when native state cannot be read", async () => {
    native.isResizable.mockRejectedValue(new Error("native state unavailable"));
    await render();
    expect(handles()).toHaveLength(0);
    expect(native.startResizeDragging).not.toHaveBeenCalled();
  });

  it("handles a rejected native resize command without breaking subsequent gestures", async () => {
    native.startResizeDragging.mockRejectedValueOnce(
      new Error("resize rejected"),
    );
    await render();
    await press("SouthWest");
    await press("East");
    expect(native.startResizeDragging.mock.calls).toEqual([
      ["SouthWest"],
      ["East"],
    ]);
  });
});
