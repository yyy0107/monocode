// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuBar } from "./MenuBar";
import { APP_COMMANDS, type CommandHandlers } from "../commands/registry";
import {
  saveKeybindingOverride,
  saveMenuBarVisible,
} from "../../features/settings/model/settings";
import { setUiLanguage } from "../../shared/i18n/language";

const windowMock = vi.hoisted(() => ({
  isMaximized: vi.fn(async () => false),
  onResized: vi.fn(async (_callback: () => Promise<void>) => () => {}),
  minimize: vi.fn(async () => {}),
  toggleMaximize: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  startDragging: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tauri-apps/api/core")>()),
  isTauri: () => true,
}));
vi.mock("../../platform/tauri/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../platform/tauri/platform")>()),
  IS_LINUX: true,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMock,
}));

let container: HTMLDivElement;
let root: Root;
let dispatch: ReturnType<typeof vi.fn>;

const handlers: CommandHandlers = Object.fromEntries(
  APP_COMMANDS.map((spec) => [spec.id, () => {}]),
);

function render(props: Partial<ComponentProps<typeof MenuBar>> = {}) {
  act(() =>
    root.render(createElement(MenuBar, { handlers, dispatch, ...props })),
  );
}

function menuButton(label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-menu-bar] button[aria-haspopup="menu"]'),
  ).find((button) => button.textContent === label);
}

function tapAlt() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" }));
  });
}

function openMenuItems(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="menu"] button'),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  localStorage.clear();
  saveMenuBarVisible(true);
  setUiLanguage("en");
  windowMock.isMaximized.mockResolvedValue(false);
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  dispatch = vi.fn(() => true);
});

afterEach(() => {
  act(() => root.unmount());
  setUiLanguage("en");
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MenuBar", () => {
  it("starts a blank-bar drag during capture and closes an open menu without waiting", () => {
    render();
    act(() => menuButton("File")!.click());
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    const nativeDocumentHandler = vi.fn();
    document.addEventListener("mousedown", nativeDocumentHandler);
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      detail: 1,
    });
    try {
      act(() => {
        container.querySelector("[data-menu-bar]")!.dispatchEvent(event);
        expect(windowMock.startDragging).toHaveBeenCalledOnce();
      });
      expect(event.defaultPrevented).toBe(true);
      expect(nativeDocumentHandler).not.toHaveBeenCalled();
      expect(document.querySelector('[role="menu"]')).toBeNull();
    } finally {
      document.removeEventListener("mousedown", nativeDocumentHandler);
    }
  });

  it("lets menu and window-control presses keep their own click behavior", () => {
    render();
    const targets = [
      menuButton("File")!,
      container.querySelector('button[aria-label="Maximize window"] svg')!,
    ];
    for (const target of targets) {
      const event = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        detail: 1,
      });
      act(() => target.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
    }
    expect(windowMock.startDragging).not.toHaveBeenCalled();
    act(() => menuButton("File")!.click());
    expect(menuButton("File")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("puts navigation before the menus and window controls at the end", () => {
    render({ canGoBack: true, canGoForward: false, sidebarOpen: true });
    const bar = container.querySelector("[data-menu-bar]")!;
    const navigation = bar.querySelector("[data-window-navigation]")!;
    const controls = bar.querySelector(
      '[role="group"][aria-label="Window controls"]',
    )!;
    expect(bar.firstElementChild?.firstElementChild).toBe(navigation);
    expect(navigation.nextElementSibling).toBe(menuButton("File"));
    expect(bar.lastElementChild?.lastElementChild).toBe(controls);
    const [back, forward, toggle] =
      navigation.querySelectorAll<HTMLButtonElement>("button");
    expect(back.getAttribute("aria-label")).toMatch(/^Back/);
    expect(forward.getAttribute("aria-label")).toMatch(/^Forward/);
    expect(forward.getAttribute("aria-disabled")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Toggle Sidebar (Ctrl+B)");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    act(() => {
      back.click();
      forward.click();
      toggle.click();
    });
    expect(dispatch.mock.calls.map(([id]) => id)).toEqual([
      "Tab: Back",
      "App: Toggle Sidebar",
    ]);

    render({ canGoBack: false, canGoForward: true, sidebarOpen: false });
    expect(bar.querySelector("[data-window-navigation]")).toBe(navigation);
    expect(toggle.getAttribute("aria-pressed")).not.toBe("true");
    act(() => {
      back.click();
      forward.click();
    });
    expect(dispatch).toHaveBeenLastCalledWith("Tab: Forward");
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it("routes the navigation disclosure independently of the sidebar command", async () => {
    const onToggleNavigation = vi.fn();
    await act(async () => render({ sidebarOpen: true, navigationExpanded: true, onToggleNavigation }));
    const toggle = container.querySelector<HTMLButtonElement>('[aria-controls="sidebar-navigation-menu"]')!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    act(() => toggle.click());
    expect(onToggleNavigation).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    render({ sidebarOpen: true, navigationExpanded: false, onToggleNavigation });
    act(() => setUiLanguage("zh-CN"));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("展开导航菜单");
  });

  it("keeps native window actions and the maximized state in the menu row", async () => {
    await act(async () => render());
    const minimize = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Minimize window"]',
    )!;
    const maximize = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Maximize window"]',
    )!;
    const close = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close window"]',
    )!;
    act(() => {
      minimize.click();
      maximize.click();
      close.click();
    });
    expect(windowMock.minimize).toHaveBeenCalledOnce();
    expect(windowMock.toggleMaximize).toHaveBeenCalledOnce();
    expect(windowMock.close).toHaveBeenCalledOnce();
    windowMock.isMaximized.mockResolvedValue(true);
    await act(async () => windowMock.onResized.mock.calls[0][0]());
    expect(maximize.getAttribute("aria-label")).toBe("Restore window");
    act(() => maximize.click());
    expect(windowMock.toggleMaximize).toHaveBeenCalledTimes(2);
  });

  it("localizes the chrome and shows the rebound sidebar shortcut", () => {
    setUiLanguage("zh-CN");
    saveKeybindingOverride("App: Toggle Sidebar", {
      shortcut: "Control+Shift+KeyB",
    });
    render();
    expect(container.querySelector('[aria-label="窗口导航"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="窗口控制"]')).not.toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="切换项目侧栏（Ctrl+Shift+B）"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="最小化窗口"]'),
    ).not.toBeNull();
  });

  it("stays visible with every menu when pinned", () => {
    render();
    const labels = Array.from(
      container.querySelectorAll('[data-menu-bar] button[aria-haspopup="menu"]'),
    ).map((button) => button.textContent);
    expect(labels).toEqual(["File", "Edit", "View", "Go", "Terminal", "Help"]);
  });

  it("runs the picked command by id", () => {
    render();
    act(() => menuButton("File")!.click());
    const close = openMenuItems().find((item) =>
      item.textContent?.startsWith("Close Pane"),
    )!;
    act(() => close.click());
    expect(dispatch).toHaveBeenCalledWith("Pane: Close");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("shows the user's rebound shortcut", () => {
    saveKeybindingOverride("Tab: New", { shortcut: "Control+Shift+KeyY" });
    render();
    act(() => menuButton("File")!.click());
    const newTab = openMenuItems().find((item) =>
      item.textContent?.startsWith("New Tab"),
    )!;
    expect(newTab.textContent).toContain("Ctrl+Shift+Y");
  });

  it("opens File on an Alt tap and moves between menus with arrows", () => {
    render();
    tapAlt();
    expect(menuButton("File")!.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(menuButton("Edit")!.getAttribute("aria-expanded")).toBe("true");
    tapAlt();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("hides until Alt is tapped when turned off", () => {
    saveMenuBarVisible(false);
    render();
    expect(container.querySelector("[data-menu-bar]")).toBeNull();
    tapAlt();
    expect(container.querySelector("[data-menu-bar]")).not.toBeNull();
    expect(container.querySelector("[data-window-navigation]")).toBeNull();
    expect(
      container.querySelector('[aria-label="Window controls"]'),
    ).toBeNull();
    tapAlt();
    expect(container.querySelector("[data-menu-bar]")).toBeNull();
  });

  it("starts hidden without a saved preference and reveals on Alt", () => {
    localStorage.clear();
    render();
    expect(container.querySelector("[data-menu-bar]")).toBeNull();
    tapAlt();
    expect(menuButton("File")).toBeDefined();
  });

  it("checks the menu bar item while it is pinned", () => {
    render();
    act(() => menuButton("View")!.click());
    const item = openMenuItems().find((button) =>
      button.textContent?.startsWith("Menu Bar"),
    )!;
    expect(item.getAttribute("aria-checked")).toBe("true");
  });

  it.each(["escape", "outside", "blur"])(
    "dismisses the temporary menu row on %s before a dropdown opens",
    (reason) => {
      saveMenuBarVisible(false);
      render();
      tapAlt();
      act(() =>
        menuButton("File")!.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        ),
      );
      expect(container.querySelector("[data-menu-bar]")).not.toBeNull();
      act(() => {
        if (reason === "escape") {
          const event = new KeyboardEvent("keydown", {
            key: "Escape",
            cancelable: true,
          });
          window.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(true);
        } else if (reason === "outside") {
          document.body.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
          );
        } else {
          window.dispatchEvent(new Event("blur"));
        }
      });
      expect(container.querySelector("[data-menu-bar]")).toBeNull();
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
});
