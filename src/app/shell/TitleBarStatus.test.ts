// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBar, WindowNavigation, type Tab } from "./TitleBar";

vi.mock("./WindowControls", () => ({
  WindowControls: () => createElement("div", { "data-window-controls": true }),
}));

let container: HTMLDivElement;
let root: Root;

function tab(id: string, overrides: Partial<Tab> = {}): Tab {
  return {
    id,
    project: "project",
    title: id,
    more: [],
    sessionCount: 1,
    harnesses: ["codex"],
    busyHarnesses: [],
    doneHarnesses: [],
    files: [],
    ...overrides,
  };
}

function render(tabs: Tab[]) {
  act(() =>
    root.render(
      createElement(TitleBar, {
        tabs,
        activeId: "active",
        cwd: "/project",
        onToggleSidebar: vi.fn(),
        onNew: vi.fn(),
        onSelect: vi.fn(),
        onClose: vi.fn(),
        onCloseMany: vi.fn(),
        onReorder: vi.fn(),
      }),
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps window navigation mounted while the sidebar is toggled", () => {
  const onGoBack = vi.fn();
  const onGoForward = vi.fn();
  const onTogglePanel = vi.fn();
  const renderNavigation = (panelActive: boolean) =>
    act(() =>
      root.render(
        createElement(WindowNavigation, {
          panelActive,
          canGoBack: panelActive,
          canGoForward: true,
          onGoBack,
          onGoForward,
          onTogglePanel,
        }),
      ),
    );

  renderNavigation(true);
  const navigation = container.querySelector("[data-window-navigation]")!;
  const toggle = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Toggle Sidebar (Ctrl+B)"]',
  )!;
  const icon = toggle.querySelector("svg");
  act(() => toggle.click());
  expect(onTogglePanel).toHaveBeenCalledOnce();

  renderNavigation(false);
  expect(container.querySelector("[data-window-navigation]")).toBe(navigation);
  expect(
    container.querySelector('button[aria-label="Toggle Sidebar (Ctrl+B)"]'),
  ).toBe(toggle);
  expect(toggle.querySelector("svg")).toBe(icon);
  expect(toggle.getAttribute("aria-pressed")).not.toBe("true");
  act(() => {
    container
      .querySelector<HTMLButtonElement>('button[aria-label^="Back"]')!
      .click();
    container
      .querySelector<HTMLButtonElement>('button[aria-label^="Forward"]')!
      .click();
    toggle.click();
  });
  expect(onGoBack).not.toHaveBeenCalled();
  expect(onGoForward).toHaveBeenCalledOnce();
  expect(onTogglePanel).toHaveBeenCalledTimes(2);
});

describe("title tab response status", () => {
  it("shows a teal completion check until the response is seen", () => {
    render([tab("done", { doneHarnesses: ["codex"] }), tab("active")]);

    const doneTab = container.querySelector('[data-title-tab-id="done"]')!;
    expect(
      doneTab.querySelector('[data-harness-status="done"]'),
    ).not.toBeNull();
    expect(
      doneTab.querySelector("svg")?.classList.contains("text-teal-400"),
    ).toBe(true);
    expect(
      doneTab.querySelector("button")?.getAttribute("aria-label"),
    ).toContain("Response complete");

    render([tab("done"), tab("active")]);
    expect(
      container.querySelector(
        '[data-title-tab-id="done"] [data-harness-status="idle"]',
      ),
    ).not.toBeNull();
  });

  it("keeps the loading indicator ahead of completion for the same provider", () => {
    render([
      tab("working", {
        busyHarnesses: ["codex"],
        doneHarnesses: ["codex"],
      }),
      tab("active"),
    ]);

    expect(
      container.querySelector(
        '[data-title-tab-id="working"] [data-harness-status="busy"]',
      ),
    ).not.toBeNull();
  });
});

it("reserves navigation space when the sidebar is closed", () => {
  act(() =>
    root.render(
      createElement(TitleBar, {
        tabs: [tab("active")],
        activeId: "active",
        cwd: "/project",
        projectRailOpen: false,
        sessionSidebarOpen: false,
        onToggleSidebar: vi.fn(),
        onNew: vi.fn(),
        onSelect: vi.fn(),
        onClose: vi.fn(),
        onCloseMany: vi.fn(),
        onReorder: vi.fn(),
      }),
    ),
  );
  expect(
    container.querySelector("[data-window-navigation-space]"),
  ).not.toBeNull();
});

it.each([false, true])(
  "moves window chrome out of the title strip in menu mode (compact=%s)",
  (compactRail) => {
    const renderChrome = (chromeInMenuBar: boolean) =>
      act(() =>
        root.render(
          createElement(TitleBar, {
            tabs: [tab("active")],
            activeId: "active",
            cwd: "/project",
            projectRailOpen: false,
            sessionSidebarOpen: false,
            compactRail,
            chromeInMenuBar,
            onToggleSidebar: vi.fn(),
            onNew: vi.fn(),
            onSelect: vi.fn(),
            onClose: vi.fn(),
            onCloseMany: vi.fn(),
            onReorder: vi.fn(),
          }),
        ),
      );

    renderChrome(false);
    expect(container.querySelectorAll("[data-window-controls]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-window-navigation-space]")).toHaveLength(1);

    renderChrome(true);
    expect(container.querySelector("[data-window-controls]")).toBeNull();
    expect(container.querySelector("[data-window-navigation-space]")).toBeNull();
    expect(container.querySelector("[data-compact-title-nav]")).toBeNull();
    expect(container.querySelector("[data-title-tab-strip]")).not.toBeNull();

    renderChrome(false);
    expect(container.querySelectorAll("[data-window-controls]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-window-navigation-space]")).toHaveLength(1);
  },
);
