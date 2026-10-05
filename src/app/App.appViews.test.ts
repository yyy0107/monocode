// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { newSession } from "../features/sessions/model/session";
import {
  newAppViewWorkspaceTab,
  newTab,
  newTerminalFile,
} from "../features/workspace/model/layout";
import {
  createProjectTerminal,
  type DockSide,
} from "../features/projects/model/projectTerminal";
import { setUiLanguage } from "../shared/i18n/language";
import { saveNotesEnabled } from "../features/settings/model/settings";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  viewMounted: vi.fn(),
  fileOpen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => false,
  convertFileSrc: (path: string) => path,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
  emit: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "main",
    onFocusChanged: async () => () => {},
    onCloseRequested: async () => () => {},
    setTitle: async () => {},
    setFocus: async () => {},
    unminimize: async () => {},
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
  message: vi.fn(async () => {}),
  open: vi.fn(async () => null),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => {}),
}));
vi.mock("./model/preloadNavigation", () => ({
  preloadNavigationWhenIdle: () => () => {},
}));
vi.mock("./hooks/useIdleSessionDetach", () => ({
  useIdleSessionDetach: () => {},
}));
vi.mock("../features/source-control/hooks/useProjectBranches", () => ({
  useProjectBranches: () => null,
}));
vi.mock("../features/inbox/hooks/useInboxUnseen", () => ({
  useInboxActivity: () => ({
    unseen: false,
    linkedSessionUpdateIds: new Set(),
    linkedSessionUpdates: new Map(),
  }),
}));
vi.mock("../features/notifications/hooks/useSessionReminders", () => ({
  useSessionReminders: () => ({
    reminders: [],
    due: [],
    error: null,
    schedule: () => {},
    cancel: () => {},
    dismissDue: () => {},
    open: () => {},
    refresh: () => {},
  }),
}));
vi.mock("../features/quick-composer/hooks/useQuickComposerLaunches", () => ({
  useQuickComposerLaunches: () => {},
}));
vi.mock("../features/sessions/data/nativeSessions", async (original) => ({
  ...(await original<
    typeof import("../features/sessions/data/nativeSessions")
  >()),
  installNativeSessionSync: () => () => {},
}));
vi.mock("../integrations/harness", async (original) => ({
  ...(await original<typeof import("../integrations/harness")>()),
  registerBuiltinHarnesses: () => {},
  startHarnessBridge: () => () => {},
  probeHarnessAvailability: async () => {},
  refreshHarnessCatalogs: async () => {},
  stopHarnessTextPrompts: async () => {},
}));
vi.mock("./model/appLifecycle", async (original) => ({
  ...(await original<typeof import("./model/appLifecycle")>()),
  bindResumedSessions: () => {},
}));
vi.mock("../features/files/model/fileIndex", async (original) => ({
  ...(await original<typeof import("../features/files/model/fileIndex")>()),
  prefetchProjectFiles: () => {},
  resolveFileOpenRequest: async (cwd: string, path: string) => {
    mocks.fileOpen(cwd, path);
    return path;
  },
  resolveOpenablePath: async (_cwd: string, path: string) => path,
}));

// Keep App's state, command dispatch, workspace model and pane rendering real.
// These shell/view substitutes isolate background services and rich editors.
vi.mock("./shell/MenuBar", async () => {
  const { createElement: el } = await import("react");
  return {
    MENU_BAR_HEIGHT: 36,
    MenuBar: ({ dispatch }: { dispatch: (id: string) => void }) =>
      el(
        "nav",
        { "data-menu": true },
        ...[
          "App: Settings",
          "View: Inbox",
          "View: Notes",
          "View: Search Everywhere",
          "Pane: Close",
          "Tab: Close All",
          "Session: Next",
          "Terminal: Toggle Dock",
        ].map((id) =>
          el(
            "button",
            { key: id, "data-command": id, onClick: () => dispatch(id) },
            id,
          ),
        ),
      ),
  };
});
vi.mock("./shell/TitleBar", async () => {
  const { createElement: el } = await import("react");
  return {
    WindowNavigation: () => null,
    TitleBar: ({
      tabs,
      activeId,
      onSelect,
    }: {
      tabs: { id: string; files: string[] }[];
      activeId: string;
      onSelect: (id: string) => void;
    }) =>
      el(
        "div",
        { "data-title-bar": true },
        ...tabs.map((tab) =>
          el(
            "button",
            {
              key: tab.id,
              "data-select-tab": tab.id,
              "data-active": String(tab.id === activeId),
              "data-files": tab.files.join("|"),
              onClick: () => onSelect(tab.id),
            },
            tab.id,
          ),
        ),
      ),
  };
});
vi.mock("./shell/Sidebar", async () => {
  const { createElement: el } = await import("react");
  return {
    Sidebar: ({
      onOpenFile,
      onOpenDiff,
      cwd,
      gitCwd,
      projectHistory = [],
      loadedProjectPaths = new Set(),
      failedProjectPaths = new Set(),
      onLoadProject,
      onNewInProject,
      onSelectSession,
      onRenameSession,
      onSelectRemoteSession,
      onRemoteSessionDeleted,
      onSessionNavigationOrder,
      onRemoveProject,
    }: {
      onOpenFile: (path: string) => void;
      onOpenDiff: (path: string) => void;
      cwd: string;
      gitCwd: string;
      projectHistory?: { id: string; cwd: string; title: string }[];
      loadedProjectPaths?: ReadonlySet<string>;
      failedProjectPaths?: ReadonlySet<string>;
      onLoadProject: (cwd: string) => Promise<void>;
      onNewInProject: (cwd: string) => void;
      onSelectSession: (id: string, cwd?: string) => void;
      onRenameSession: (id: string, title: string) => void;
      onSelectRemoteSession: (cwd: string, id: string) => void;
      onRemoteSessionDeleted: (id: string, cwd?: string) => void;
      onSessionNavigationOrder: (ids: readonly string[]) => void;
      onRemoveProject: (cwd: string, options: { purgeData: boolean }) => void;
    }) =>
      el(
        "aside",
        {
          "data-sidebar": cwd,
          "data-git-cwd": gitCwd,
          "data-loaded-projects": [...loadedProjectPaths].join("|"),
          "data-failed-projects": [...failedProjectPaths].join("|"),
        },
        el(
          "button",
          {
            "data-publish-navigation": true,
            onClick: () => onSessionNavigationOrder(["first", "recent"]),
          },
          "Publish navigation",
        ),
        ...["/project-a", "/project-b"].flatMap((path) => [
          el(
            "button",
            {
              key: `load-${path}`,
              "data-load-project": path,
              onClick: () => void onLoadProject(path),
            },
            "Load",
          ),
          el(
            "button",
            {
              key: `new-${path}`,
              "data-new-project-session": path,
              onClick: () => onNewInProject(path),
            },
            "New",
          ),
          el(
            "button",
            {
              key: `remove-${path}`,
              "data-remove-project": path,
              onClick: () => onRemoveProject(path, { purgeData: true }),
            },
            "Remove",
          ),
        ]),
        ...["remote://host/project-a", "remote://host/project-b"].flatMap(
          (path) => [
            el(
              "button",
              {
                key: `remote-${path}`,
                "data-open-remote-project": path,
                onClick: () => onSelectRemoteSession(path, "shared-id"),
              },
              "Open remote",
            ),
            el(
              "button",
              {
                key: `delete-${path}`,
                "data-delete-remote-project": path,
                onClick: () => onRemoteSessionDeleted("shared-id", path),
              },
              "Delete remote",
            ),
          ],
        ),
        ...projectHistory.map((row) =>
          el(
            "div",
            {
              key: row.id,
              "data-history-project": row.cwd,
              "data-history-title": row.title,
            },
            el(
              "button",
              {
                "data-open-history": row.id,
                onClick: () => onSelectSession(row.id, row.cwd),
              },
              row.title,
            ),
            el(
              "button",
              {
                "data-rename-history": row.id,
                onClick: () => onRenameSession(row.id, "Renamed"),
              },
              "Rename",
            ),
          ),
        ),
        el(
          "button",
          {
            "data-open-file": true,
            onClick: () => onOpenFile("/repo/file.ts"),
          },
          "Open file",
        ),
        el(
          "button",
          {
            "data-open-diff": true,
            onClick: () => onOpenDiff("/repo/file.ts"),
          },
          "Open diff",
        ),
      ),
  };
});
vi.mock("./shell/ActivityBar", () => ({ ActivityBar: () => null }));
vi.mock("./shell/UsageFooter", async () => {
  const { createElement: el } = await import("react");
  return { UsageFooter: () => el("footer", { "data-footer": true }, "Usage") };
});
vi.mock("../features/terminal/ui/ProjectTerminalDock", async () => {
  const { createElement: el } = await import("react");
  const { useSurfaceVisibility } =
    await import("../shared/ui/SurfaceVisibility");
  return {
    ProjectTerminalDock: ({
      onHide,
      onSizePaint,
      onSizeCommit,
    }: {
      onHide: () => void;
      onSizePaint: (size: number) => void;
      onSizeCommit: (size: number) => void;
    }) =>
      el(
        "div",
        {
          "data-terminal-dock": true,
          "data-visible": useSurfaceVisibility(),
        },
        "Terminal",
        el("button", { "data-terminal-hide": true, onClick: onHide }, "Hide"),
        el(
          "button",
          { "data-terminal-paint": true, onClick: () => onSizePaint(280) },
          "Resize",
        ),
        el(
          "button",
          { "data-terminal-commit": true, onClick: () => onSizeCommit(280) },
          "Commit",
        ),
      ),
  };
});
vi.mock("../features/sessions/ui/SessionPane", async () => {
  const { createElement: el } = await import("react");
  return {
    SessionPane: ({
      session,
    }: {
      session: {
        id: string;
        cwd: string;
        worktreeCwd?: string;
        branch?: string;
      };
    }) =>
      el("div", {
        "data-session": session.id,
        "data-session-cwd": session.cwd,
        "data-session-worktree": session.worktreeCwd,
        "data-session-branch": session.branch,
      }),
  };
});
vi.mock("../features/sessions/ui/SessionSurface", () => ({
  SessionSurface: () => null,
}));
vi.mock("../features/files/ui/FileEditor", async () => {
  const { createElement: el } = await import("react");
  return {
    FileEditor: ({
      path,
      cwd,
      showDiff,
    }: {
      path: string;
      cwd: string;
      showDiff: boolean;
    }) =>
      el("div", {
        "data-file-editor": path,
        "data-file-cwd": cwd,
        "data-file-diff": showDiff,
      }),
  };
});
vi.mock("../features/source-control/ui/WorkingTreeDiff", async () => {
  const { createElement: el } = await import("react");
  return {
    WorkingTreeDiff: ({ cwd }: { cwd: string }) =>
      el("div", { "data-diff-cwd": cwd }),
  };
});
vi.mock("../features/settings/ui/SettingsView", async () => {
  const { createElement: el, useEffect, useState } = await import("react");
  return {
    SettingsView: ({
      active,
      onClose,
    }: {
      active: boolean;
      onClose: () => void;
    }) => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mocks.viewMounted("settings");
      }, []);
      return el(
        "section",
        { "data-app-view": "settings", "data-focused": active },
        el(
          "button",
          {
            "data-view-state": true,
            onClick: () => setCount((value) => value + 1),
          },
          String(count),
        ),
        el("button", { "data-leave-view": true, onClick: onClose }, "Leave"),
      );
    },
  };
});
vi.mock("../features/inbox/ui/InboxView", async () => {
  const { createElement: el, useEffect } = await import("react");
  return {
    InboxView: ({ active }: { active: boolean }) => {
      useEffect(() => {
        mocks.viewMounted("inbox");
      }, []);
      return el(
        "section",
        { "data-app-view": "inbox", "data-focused": active },
        "Inbox",
      );
    },
    LinkedWorkItemPanel: () => null,
  };
});
vi.mock("../features/notes/ui/NotesView", async () => {
  const { createElement: el } = await import("react");
  return {
    NotesView: () => el("section", { "data-app-view": "notes" }, "Notes"),
  };
});

let container: HTMLDivElement;
let root: Root;
let firstId: string;
let recentId: string;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  localStorage.clear();
  setUiLanguage("en");
  localStorage.setItem("monocode.fileTabMode", "pane");
  mocks.invoke.mockReset().mockImplementation(async (command) => {
    if (command === "default_cwd") return "/repo";
    if (command === "git_branches") return { branches: [], current: "main" };
    return [];
  });
  mocks.viewMounted.mockReset();
  mocks.fileOpen.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setUiLanguage("en");
  localStorage.clear();
});

async function mount(onlyApp = false, side: DockSide = "bottom") {
  const first = { ...newSession("codex", "/repo"), id: "first" };
  const recent = { ...newSession("codex", "/repo"), id: "recent" };
  const firstTab = newTab(first.id);
  const recentTab = newTab(recent.id);
  firstId = firstTab.id;
  recentId = recentTab.id;
  await act(async () =>
    root.render(
      createElement(App, {
        resumed: {
          sessions: onlyApp ? [] : [first, recent],
          tabs: onlyApp
            ? [{ ...newAppViewWorkspaceTab("settings"), id: "sole-app" }]
            : [firstTab, recentTab],
          activeTabId: onlyApp ? "sole-app" : firstTab.id,
          projectCwd: "/repo",
          projectReturnMemory: new Map(),
          projectTerminals: [
            createProjectTerminal("/repo", newTerminalFile("/repo"), side),
          ],
        },
      }),
    ),
  );
  await act(async () => vi.dynamicImportSettled());
}

async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull();
  await act(async () => button!.click());
  await act(async () => vi.dynamicImportSettled());
}

const activeTitle = () =>
  container.querySelector<HTMLButtonElement>(
    '[data-select-tab][data-active="true"]',
  )!;

describe("terminal dock disclosure motion", () => {
  const grid = () =>
    container.querySelector<HTMLElement>("[data-terminal-dock-layout]")!;
  const terminal = () =>
    container.querySelector<HTMLElement>("[data-terminal-dock]")!;
  const finish = () =>
    act(() => {
      const event = new Event("transitionend", { bubbles: true });
      Object.defineProperty(event, "propertyName", {
        value: "grid-template-rows",
      });
      grid().dispatchEvent(event);
    });

  it.each(["bottom", "top", "left", "right"] as const)(
    "animates the %s dock with stable tracks while retaining its terminal instance",
    async (side) => {
      await mount(false, side);
      const node = terminal();
      const areas = grid().style.gridTemplateAreas;
      expect(grid().dataset.foldState).toBe("open");
      expect(grid().classList.contains("animated-collapse-size")).toBe(true);
      await click("[data-terminal-hide]");
      expect(grid().dataset.foldState).toBe("closing");
      expect(grid().style.gridTemplateAreas).toBe(areas);
      expect(
        side === "bottom" || side === "top"
          ? grid().style.gridTemplateRows
          : grid().style.gridTemplateColumns,
      ).toContain("0px");
      expect(node.parentElement?.inert).toBe(true);
      expect(node.dataset.visible).toBe("false");
      expect(node.closest(".hidden")).toBeNull();
      finish();
      expect(grid().dataset.foldState).toBe("closed");
      expect(node.closest(".hidden")).not.toBeNull();
      await click('[data-command="Terminal: Toggle Dock"]');
      expect(grid().dataset.foldState).toBe("opening");
      expect(terminal()).toBe(node);
      expect(node.dataset.visible).toBe("true");
      expect(node.closest(".hidden")).toBeNull();
      finish();
      expect(grid().dataset.foldState).toBe("open");
    },
  );

  it("disables motion while resizing and preserves the committed height through rapid reversal", async () => {
    await mount();
    await click("[data-terminal-paint]");
    expect(grid().style.transitionProperty).toBe("none");
    expect(grid().style.gridTemplateRows).toContain("280px");
    await click("[data-terminal-commit]");
    expect(grid().style.transitionProperty).toBe("");
    await click("[data-terminal-hide]");
    expect(grid().dataset.foldState).toBe("closing");
    await click('[data-command="Terminal: Toggle Dock"]');
    expect(grid().dataset.foldState).toBe("opening");
    expect(grid().style.gridTemplateRows).toContain("280px");
    finish();
    expect(grid().dataset.foldState).toBe("open");
  });

  it("settles dock visibility immediately with reduced motion without destroying the terminal", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
        }) as MediaQueryList,
    );
    await mount();
    const node = terminal();
    await click("[data-terminal-hide]");
    expect(grid().dataset.foldState).toBe("closed");
    expect(node.closest(".hidden")).not.toBeNull();
    await click('[data-command="Terminal: Toggle Dock"]');
    expect(grid().dataset.foldState).toBe("open");
    expect(terminal()).toBe(node);
  });
});

describe("App workspace app views", () => {
  it("closes an existing Notes tab when Notes is disabled", async () => {
    await mount();
    await click('[data-command="View: Notes"]');
    const notesId = activeTitle().dataset.selectTab;
    expect(container.querySelector('[data-app-view="notes"]')).not.toBeNull();
    await click('[data-command="App: Settings"]');
    await act(async () => {
      saveNotesEnabled(false);
    });
    expect(container.querySelector('[data-app-view="notes"]')).toBeNull();
    expect(
      container.querySelector(`[data-select-tab="${notesId}"]`),
    ).toBeNull();
    expect(
      container.querySelector('[data-app-view="settings"]'),
    ).not.toBeNull();
  });

  it("updates an app title in zh-CN without losing the active tab or view state", async () => {
    await mount();
    await click('[data-command="App: Settings"]');
    const appId = activeTitle().dataset.selectTab;
    await click("[data-view-state]");
    await act(async () => setUiLanguage("zh-CN"));
    expect(activeTitle().dataset.files).toBe("设置");
    expect(activeTitle().dataset.selectTab).toBe(appId);
    expect(container.querySelector("[data-view-state]")?.textContent).toBe("1");
    expect(
      mocks.viewMounted.mock.calls.filter(([kind]) => kind === "settings"),
    ).toHaveLength(1);
  });

  it("mounts Inbox in a pane and keeps the sidebar, footer and terminal dock visible", async () => {
    await mount();
    await click('[data-command="View: Inbox"]');
    const inbox = container.querySelector('[data-app-view="inbox"]');
    expect(inbox).not.toBeNull();
    expect(inbox?.closest("[data-pane-id]")).not.toBeNull();
    expect(inbox?.closest('[aria-hidden="true"]')).toBeNull();
    for (const selector of [
      "[data-sidebar]",
      "[data-footer]",
      "[data-terminal-dock]",
    ]) {
      const shell = container.querySelector(selector);
      expect(shell, selector).not.toBeNull();
      expect(shell?.closest(".hidden")).toBeNull();
    }
    expect(activeTitle().dataset.files).toBe("Inbox");
  });

  it("opens from an app-only tab in the project's last visited content tab", async () => {
    await mount();
    await click(`[data-select-tab="${recentId}"]`);
    await click('[data-command="App: Settings"]');
    await click("[data-open-file]");
    expect(activeTitle().dataset.selectTab).toBe(recentId);
    const editor = container.querySelector(
      '[data-file-editor="/repo/file.ts"]',
    );
    expect(editor).not.toBeNull();
    expect(editor?.getAttribute("data-file-cwd")).toBe("/repo");
    expect(mocks.fileOpen).toHaveBeenCalledWith("/repo", "/repo/file.ts");
  });

  it.each(["editor", "unified"])(
    "opens a %s diff from an app-only tab in the project's last content tab",
    async (viewer) => {
      localStorage.setItem("monocode.diffViewer", viewer);
      await mount();
      await click(`[data-select-tab="${recentId}"]`);
      await click('[data-command="App: Settings"]');
      await click("[data-open-diff]");
      expect(activeTitle().dataset.selectTab).toBe(recentId);
      expect(
        container.querySelector(
          viewer === "unified"
            ? '[data-diff-cwd="/repo"]'
            : '[data-file-editor="/repo/file.ts"][data-file-cwd="/repo"][data-file-diff="true"]',
        ),
      ).not.toBeNull();
    },
  );

  it("keeps one Settings instance and its local state when revisiting, then closes it with Ctrl+W", async () => {
    await mount();
    await click('[data-command="App: Settings"]');
    const appId = activeTitle().dataset.selectTab!;
    await click("[data-view-state]");
    await click(`[data-select-tab="${firstId}"]`);
    await click(`[data-select-tab="${appId}"]`);
    expect(container.querySelector("[data-view-state]")?.textContent).toBe("1");
    expect(
      mocks.viewMounted.mock.calls.filter(([kind]) => kind === "settings"),
    ).toHaveLength(1);
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "w",
          code: "KeyW",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(container.querySelector(`[data-select-tab="${appId}"]`)).toBeNull();
    expect(container.querySelector('[data-app-view="settings"]')).toBeNull();
    expect(activeTitle().dataset.selectTab).toBe(recentId);
  });

  it("Escape leaves the real Search view and retains its workspace tab", async () => {
    await mount();
    await click(`[data-select-tab="${recentId}"]`);
    await click('[data-command="View: Search Everywhere"]');
    const appId = activeTitle().dataset.selectTab!;
    expect(container.querySelector("[data-app-search]")).not.toBeNull();
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(activeTitle().dataset.selectTab).toBe(recentId);
    expect(
      container.querySelector(`[data-select-tab="${appId}"]`),
    ).not.toBeNull();
    expect(
      container
        .querySelector("[data-app-search]")
        ?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it.each(["close-pane", "close-all"])(
    "keeps the current project after %s closes the sole app tab",
    async (action) => {
      await mount(true);
      expect(
        container.querySelector('[data-app-view="settings"]'),
      ).not.toBeNull();
      if (action === "close-pane") {
        await act(async () =>
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "w",
              code: "KeyW",
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          ),
        );
      } else {
        await click('[data-command="Tab: Close All"]');
      }
      expect(container.querySelector('[data-app-view="settings"]')).toBeNull();
      expect(
        container.querySelector('[data-session-cwd="/repo"]'),
      ).not.toBeNull();
      expect(activeTitle().dataset.files).toBe("");
      expect(container.querySelector('[data-sidebar="/repo"]')).not.toBeNull();
    },
  );
});

describe("App multi-project history", () => {
  it("discards a removed project's pending history and starts a fresh read when re-added", async () => {
    let finishOld!: (rows: unknown[]) => void;
    const oldRead = new Promise<unknown[]>((resolve) => {
      finishOld = resolve;
    });
    let reads = 0;
    const summary = (id: string) => ({
      ...newSession("codex", "/project-a"),
      id,
      title: id,
      createdAt: 1,
      updatedAt: 2,
    });
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === "session_list_by_project" && args.cwd === "/project-a") {
        reads++;
        return reads === 1 ? oldRead : [summary("fresh-chat")];
      }
      return [];
    });
    await mount();
    await click('[data-load-project="/project-a"]');
    await click('[data-remove-project="/project-a"]');
    await click('[data-load-project="/project-a"]');
    await act(async () => finishOld([summary("stale-chat")]));
    // Purging also lists stored chats; the reopened branch makes its own read.
    expect(reads).toBe(3);
    expect(
      container.querySelector('[data-open-history="fresh-chat"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-open-history="stale-chat"]'),
    ).toBeNull();
    await click('[data-remove-project="/project-a"]');
    expect(
      container.querySelector('[data-history-project="/project-a"]'),
    ).toBeNull();
    expect(
      container
        .querySelector("[data-sidebar]")
        ?.getAttribute("data-loaded-projects"),
    ).not.toContain("/project-a");
  });

  it("loads inactive projects independently and retains both after out-of-order responses", async () => {
    let finishA!: (rows: unknown[]) => void;
    let finishB!: (rows: unknown[]) => void;
    const a = new Promise<unknown[]>((resolve) => {
      finishA = resolve;
    });
    const b = new Promise<unknown[]>((resolve) => {
      finishB = resolve;
    });
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === "session_list_by_project") {
        if (args.cwd === "/project-a") return a;
        if (args.cwd === "/project-b") return b;
      }
      return [];
    });
    await mount();
    await click('[data-load-project="/project-a"]');
    await click('[data-load-project="/project-a"]');
    await click('[data-load-project="/project-b"]');
    const summary = (id: string, cwd: string) => ({
      ...newSession("codex", cwd),
      id,
      title: id,
      createdAt: 1,
      updatedAt: 2,
    });
    await act(async () => finishB([summary("b", "/project-b")]));
    await act(async () => finishA([summary("a", "/project-a")]));
    expect(
      container.querySelector('[data-history-project="/project-a"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-history-project="/project-b"]'),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-sidebar]")?.getAttribute("data-sidebar"),
    ).toBe("/repo");
    expect(
      mocks.invoke.mock.calls.filter(
        ([command, args]) =>
          command === "session_list_by_project" && args.cwd === "/project-a",
      ),
    ).toHaveLength(1);
  });

  it("keeps a failed project isolated and clears its error after retry", async () => {
    let fail = true;
    mocks.invoke.mockImplementation(async (command, args) => {
      if (
        command === "session_list_by_project" &&
        args.cwd === "/project-a" &&
        fail
      )
        throw new Error("unavailable");
      return [];
    });
    await mount();
    await click('[data-load-project="/project-a"]');
    await click('[data-load-project="/project-b"]');
    expect(
      container
        .querySelector("[data-sidebar]")
        ?.getAttribute("data-failed-projects"),
    ).toBe("/project-a");
    expect(
      container
        .querySelector("[data-sidebar]")
        ?.getAttribute("data-loaded-projects"),
    ).toContain("/project-b");
    fail = false;
    await click('[data-load-project="/project-a"]');
    expect(
      container
        .querySelector("[data-sidebar]")
        ?.getAttribute("data-failed-projects"),
    ).toBe("");
    expect(
      container
        .querySelector("[data-sidebar]")
        ?.getAttribute("data-loaded-projects"),
    ).toContain("/project-a");
  });

  it("renames and refreshes an inactive project's summary", async () => {
    let row = {
      ...newSession("codex", "/project-b"),
      id: "inactive-chat",
      blocks: [
        { id: "prompt", role: "user" as const, text: "Work on this project" },
      ],
      title: "Original",
      createdAt: 1,
      updatedAt: 2,
    };
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === "session_list_by_project")
        return args.cwd === "/project-b" ? [row] : [];
      if (command === "session_get") return row;
      if (command === "session_upsert") {
        row = { ...row, ...args.session };
        return row;
      }
      return [];
    });
    await mount();
    await click('[data-load-project="/project-b"]');
    await click('[data-rename-history="inactive-chat"]');
    expect(
      container
        .querySelector('[data-history-project="/project-b"]')
        ?.getAttribute("data-history-title"),
    ).toContain("Renamed");
    expect(container.querySelector('[data-sidebar="/repo"]')).not.toBeNull();
    expect(
      mocks.invoke.mock.calls.filter(
        ([command, args]) =>
          command === "session_list_by_project" && args.cwd === "/project-b",
      ),
    ).toHaveLength(2);
    expect(
      mocks.invoke.mock.calls.filter(
        ([command, args]) =>
          command === "session_list_by_project" && args.cwd === "/repo",
      ),
    ).toHaveLength(1);
  });

  it("creates a chat in an inactive project's remembered worktree", async () => {
    const { setWorktreeFocus } =
      await import("../features/source-control/model/worktreeFocus");
    setWorktreeFocus("/project-b", {
      path: "/project-b-worktree",
      branch: "feature",
    });
    await mount();
    await click('[data-new-project-session="/project-b"]');
    expect(
      container.querySelector('[data-sidebar="/project-b"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-session-cwd="/project-b"][data-session-worktree="/project-b-worktree"][data-session-branch="feature"]',
      ),
    ).not.toBeNull();
    await act(async () => setWorktreeFocus("/project-b", undefined));
  });

  it("does not reuse the previous project's keyboard order when the new branch is collapsed", async () => {
    await mount();
    await click("[data-publish-navigation]");
    await click('[data-new-project-session="/project-b"]');
    const activeTab = activeTitle().dataset.selectTab;
    await click('[data-command="Session: Next"]');
    expect(activeTitle().dataset.selectTab).toBe(activeTab);
    expect(
      container.querySelector('[data-sidebar="/project-b"]'),
    ).not.toBeNull();
  });

  it("keeps equal remote session ids in different projects in separate tabs", async () => {
    await mount();
    await click('[data-open-remote-project="remote://host/project-a"]');
    const aTab = activeTitle().dataset.selectTab;
    await click('[data-open-remote-project="remote://host/project-b"]');
    expect(activeTitle().dataset.selectTab).not.toBe(aTab);
    expect(
      container.querySelector('[data-session-cwd="remote://host/project-a"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-session-cwd="remote://host/project-b"]'),
    ).not.toBeNull();
    await click('[data-delete-remote-project="remote://host/project-b"]');
    expect(
      container.querySelector('[data-session-cwd="remote://host/project-a"]'),
    ).not.toBeNull();
    await click('[data-open-remote-project="remote://host/project-a"]');
    expect(activeTitle().dataset.selectTab).toBe(aTab);
  });
});
