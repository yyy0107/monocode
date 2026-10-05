// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import {
  loadProjectTreeExpanded,
  saveProjectTreeExpanded,
  clearProjectTreeExpanded,
  rebaseProjectTreeExpanded,
} from "../../features/projects/model/projectTree";
import {
  loadSessionFolders,
  saveSessionFolders,
} from "../../features/sessions/model/sessionFolders";
import { saveTabGroupLabel } from "../../features/workspace/model/tabGroups";
import {
  loadProjectGroups,
  saveProjectGroups,
  saveProjectGroupAssignments,
} from "../../features/projects/model/projectGroups";
import { useProjectDiffStats } from "../../features/source-control/hooks/useProjectDiffStats";
import { setUiLanguage } from "../../shared/i18n/language";
import {
  configureSharedHost,
  rememberRemoteProject,
} from "../../features/connections/model/remoteProjects";
import type { RemoteProjectSessions } from "../../features/connections/model/connections";
import type { HostSessionSummary } from "../../features/connections/model/protocol";
import type { SessionSummary } from "../../features/sessions/data/sessionStore";

const remoteState = vi.hoisted(() => ({
  rows: new Map<string, HostSessionSummary[]>(),
  bindings: new Map<string, string>(),
  states: new Map<string, Partial<RemoteProjectSessions>>(),
  subscriptions: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  isTauri: () => false,
  convertFileSrc: (path: string) => path,
}));
vi.mock("../../features/source-control/hooks/useProjectDiffStats", () => ({
  useProjectDiffStats: vi.fn(() => null),
}));
vi.mock("../../features/source-control/hooks/useGitFileStatuses", () => ({
  useGitFileStatuses: () => ({ files: new Map(), dirs: new Map() }),
}));
vi.mock("../../features/source-control/ui/SidebarWorktreeSwitcher", () => ({
  SidebarWorktreeSwitcher: ({
    cwd,
    compact = false,
  }: {
    cwd: string;
    compact?: boolean;
  }) =>
    createElement(
      "button",
      {
        type: "button",
        "aria-label": "Switch working copy",
        "data-worktree-picker": cwd,
        "data-compact": String(compact),
      },
      "master",
    ),
}));
vi.mock("../../features/files/ui/FileTree", () => ({
  FileTree: ({ cwd }: { cwd: string }) =>
    createElement("div", { "data-files-project": cwd }, "Files"),
}));
vi.mock("../../features/source-control/ui/SourceControl", () => ({
  SourceControl: ({ cwd }: { cwd: string }) =>
    createElement("div", { "data-changes-project": cwd }, "Changes"),
}));
vi.mock(
  "../../features/connections/model/connections",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../features/connections/model/connections")
    >()),
    useRemoteMachines: () => ({ machines: [], loaded: true }),
    useRemoteMachineOnline: () => false,
    remoteSessionFor: (id: string) =>
      remoteState.bindings.get(id) ??
      (id.startsWith("shell:") ? id.slice(6) : undefined),
    hasCachedRemoteProjectSessions: (path: string) =>
      remoteState.rows.has(path),
    cachedRemoteSessions: (path: string) => remoteState.rows.get(path) ?? [],
    useRemoteProjectSessions: (path: string, enabled: boolean) => {
      remoteState.subscriptions(path, enabled);
      return {
        machine: undefined,
        sessions: remoteState.rows.get(path) ?? [],
        loaded: true,
        pending: false,
        offline: false,
        ...remoteState.states.get(path),
      };
    },
  }),
);

let container: HTMLDivElement;
let root: Root;
let props: ComponentProps<typeof Sidebar>;
let measuredHeight: number;
let resizeCallbacks: Array<() => void>;
const A = "/workspace/alpha";
const B = "/workspace/beta";
const summary = (id: string, cwd = A, title = id): SessionSummary => ({
  id,
  cwd,
  title,
  harness: "codex",
  model: "",
  runtimeMode: "supervised",
  createdAt: 0,
  updatedAt: 1234,
});
const hostRow = (id: string, title = id): HostSessionSummary => ({
  id,
  title,
  projectId: "host-project",
  cwd: "/host/repo",
  harness: "codex",
  model: "",
  runtimeMode: "supervised",
  updatedAt: 1234,
  status: "idle",
});
const project = (path: string) =>
  container.querySelector<HTMLElement>(`[data-project-path="${path}"]`)!;
const card = (id: string) =>
  container.querySelector<HTMLElement>(`[data-session-card="${id}"]`)!;
const input = () =>
  container.querySelector<HTMLInputElement>(
    'input[aria-label="Search projects and conversations"], input[aria-label="Search conversations"]',
  )!;
const scopePicker = () =>
  container.querySelector<HTMLButtonElement>("[data-project-switcher] button")!;
function pickScope(path: string | null) {
  act(() => scopePicker().click());
  const dialog = document.querySelector(
    '[role="dialog"][aria-label="Project picker"]',
  )!;
  const button = path
    ? dialog.querySelector<HTMLButtonElement>(`button[title="${path}"]`)!
    : [...dialog.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent === "All projects",
      )!;
  act(() => button.click());
}
function render() {
  root.render(createElement(Sidebar, props));
}
function query(value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/** Finish collapse transitions; happy-dom does not run CSS animations. */
function settleFolds() {
  act(() => {
    for (const fold of container.querySelectorAll(
      '.zen-fold-item[data-fold-state="closing"]',
    ))
      fold.dispatchEvent(new Event("animationend", { bubbles: true }));
  });
}
function expand(path: string) {
  act(() =>
    project(path)
      .querySelector<HTMLButtonElement>('button[aria-label="Expand project"]')!
      .click(),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setUiLanguage("en");
  configureSharedHost(undefined, []);
  remoteState.rows.clear();
  remoteState.bindings.clear();
  remoteState.states.clear();
  remoteState.subscriptions.mockClear();
  vi.mocked(useProjectDiffStats).mockReset().mockReturnValue(null);
  resizeCallbacks = [];
  measuredHeight = 700;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    () => measuredHeight,
  );
  props = {
    cwd: A,
    open: true,
    recents: [
      { path: B, openedAt: 2 },
      { path: A, openedAt: 1 },
    ],
    sessions: [summary("a", A, "Alpha conversation")],
    projectHistory: [
      summary("a", A, "Alpha conversation"),
      summary("b", B, "Hidden conversation"),
    ],
    loadedProjectPaths: new Set([A, B]),
    failedProjectPaths: new Set(),
    busySessionIds: new Set(),
    approvalSessionIds: new Set(),
    activeSessionId: "a",
    status: "idle",
    pending: false,
    tab: "sessions",
    filesSearchOpen: false,
    onOpenFile: vi.fn(),
    onSelectSession: vi.fn(),
    onSelectProject: vi.fn(),
    onTabChange: vi.fn(),
    onFilesSearchOpenChange: vi.fn(),
    onOpenProject: vi.fn(),
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setUiLanguage("en");
  configureSharedHost(undefined, []);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("named project/session tree", () => {
  it("keeps project names visible, expands independently and routes inactive session selection with its project", () => {
    props.onSessionNavigationOrder = vi.fn();
    props.onNewInProject = vi.fn(() => "new-b");
    act(() => render());
    expect(container.querySelectorAll("aside")).toHaveLength(1);
    expect(project(A).textContent).toContain("alpha");
    expect(project(B).textContent).toContain("beta");
    expect(card("a")).not.toBeNull();
    expect(card("b")).toBeNull();
    expand(B);
    expect(card("a")).not.toBeNull();
    expect(card("b")).not.toBeNull();
    expect(props.onSelectProject).not.toHaveBeenCalled();
    expect(props.onSessionNavigationOrder).toHaveBeenCalledTimes(1);
    expect(props.onSessionNavigationOrder).toHaveBeenLastCalledWith(["a"]);
    act(() => card("b").click());
    expect(props.onSelectSession).toHaveBeenCalledWith("b", B);
    act(() =>
      project(B)
        .querySelector<HTMLButtonElement>('[aria-label="New session in beta"]')!
        .click(),
    );
    expect(props.onNewInProject).toHaveBeenCalledWith(B);
    expect(loadProjectTreeExpanded(A)).toEqual(new Set([A, B]));
  });

  it("collapses an open project from its name and animates rows in and out", () => {
    act(() => render());
    const header = (path: string) =>
      project(path).querySelector<HTMLElement>("[data-project-header]")!;
    const fold = (path: string) =>
      project(path).querySelector<HTMLElement>(".zen-fold-item");
    // Initially open rows render settled, without replaying the animation.
    expect(fold(A)?.dataset.foldState).toBe("open");
    act(() => header(A).click());
    expect(props.onSelectProject).not.toHaveBeenCalled();
    expect(fold(A)?.dataset.foldState).toBe("closing");
    expect(fold(A)?.inert).toBe(true);
    expect(loadProjectTreeExpanded(A)).toEqual(new Set());
    settleFolds();
    expect(card("a")).toBeNull();
    expect(fold(A)).toBeNull();
    act(() => header(B).click());
    expect(props.onSelectProject).toHaveBeenCalledWith(B);
    expect(fold(B)?.dataset.foldState).toBe("opening");
    expect(card("b")).not.toBeNull();
  });

  it("expands projects activated outside the tree and focuses the unified query on request", () => {
    act(() => render());
    expect(card("b")).toBeNull();
    props = {
      ...props,
      cwd: B,
      activeSessionId: "b",
      sessions: [summary("b", B, "Hidden conversation")],
      searchFocusToken: 1,
    };
    act(() => render());
    expect(card("b")).not.toBeNull();
    expect(card("a")).not.toBeNull();
    expect(document.activeElement).toBe(input());
    expect(loadProjectTreeExpanded(B)).toEqual(new Set([A, B]));
  });

  it("persists first-use expansion so renaming and removing a project update the mounted tree", () => {
    const renamed = "/workspace/renamed-alpha";
    act(() => render());
    expect(localStorage.getItem("monocode.projectTreeExpanded.v1")).toBe(
      JSON.stringify([A]),
    );
    act(() => rebaseProjectTreeExpanded(A, renamed));
    props = {
      ...props,
      cwd: renamed,
      recents: [{ path: renamed, openedAt: 1 }],
      sessions: [summary("a", renamed)],
      projectHistory: [summary("a", renamed)],
      loadedProjectPaths: new Set([renamed]),
    };
    act(() => render());
    expect(loadProjectTreeExpanded(renamed)).toEqual(new Set([renamed]));
    expect(card("a")).not.toBeNull();
    act(() => clearProjectTreeExpanded(renamed));
    expect(loadProjectTreeExpanded(renamed)).toEqual(new Set());
    settleFolds();
    expect(card("a")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    act(() => render());
    expect(card("a")).toBeNull();
    expect(loadProjectTreeExpanded(renamed)).toEqual(new Set());
  });

  it("scopes reminder and completion/link flags to project identity and translates its open Host shell binding", () => {
    configureSharedHost("machine", [
      { id: "alpha-host", cwd: A, name: "alpha" },
      { id: "beta-host", cwd: B, name: "beta" },
    ]);
    remoteState.rows.set(A, [hostRow("same", "Host alpha")]);
    remoteState.rows.set(B, [hostRow("same", "Host beta")]);
    props.projectHistory = [summary("same", A, "Local/native alpha")];
    props.openSessions = [summary("b-shell", B, "Open beta")];
    props.reminders = [
      {
        sessionId: "same",
        cwd: A,
        title: "Alpha reminder",
        harness: "codex",
        dueAt: 12_345,
        firedAt: null,
      },
    ];
    props.unseenFinishedIds = new Set(["same"]);
    props.linkedSessionUpdateIds = new Set(["same"]);
    saveProjectTreeExpanded([A, B]);
    act(() => render());
    expect(project(A).querySelector("[data-reminder-sessions]")).not.toBeNull();
    expect(project(B).querySelector("[data-reminder-sessions]")).toBeNull();
    expect(project(A).querySelector('[aria-label="Done"]')).not.toBeNull();
    expect(project(B).querySelector('[aria-label="Done"]')).toBeNull();
    expect(
      project(A).querySelector('[aria-label="Linked work item updated"]'),
    ).not.toBeNull();
    expect(
      project(B).querySelector('[aria-label="Linked work item updated"]'),
    ).toBeNull();
    remoteState.bindings.set("b-shell", "same");
    props = {
      ...props,
      unseenFinishedIds: new Set(["b-shell"]),
      linkedSessionUpdateIds: new Set(["b-shell"]),
    };
    act(() => render());
    expect(project(B).querySelector('[aria-label="Done"]')).not.toBeNull();
    expect(project(A).querySelector('[aria-label="Done"]')).toBeNull();
    expect(
      project(B).querySelector('[aria-label="Linked work item updated"]'),
    ).not.toBeNull();
    expect(
      project(A).querySelector('[aria-label="Linked work item updated"]'),
    ).toBeNull();
  });

  it("shows structured metadata with complete values and status on keyboard focus", () => {
    const title =
      "Complete title that remains readable across multiple lines in the summary";
    const branch = "workbench-ui/codex/020-desktop-architecture-refactor";
    const worktreeCwd =
      "/workspace/alpha/a-long-worktree-directory/desktop-shell-overhaul";
    props.projectHistory = [
      {
        ...summary("a", A, title),
        branch,
        repo: "alpha",
        model: "codex:test",
        worktreeCwd,
        updatedAt: Date.now() - 65_000,
      },
    ];
    props.sessions = props.projectHistory;
    props.busySessionIds = new Set(["a"]);
    act(() => render());
    expect(card("a").classList.contains("h-8")).toBe(true);
    expect(card("a").textContent).toContain(title);
    expect(card("a").textContent).not.toContain(branch);
    expect(card("a").hasAttribute("title")).toBe(false);
    expect(card("a").querySelector('[aria-label="Working..."]')).not.toBeNull();
    act(() =>
      card("a").querySelector<HTMLElement>("[data-session-select]")!.focus(),
    );
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(tooltip.textContent).toContain(title);
    expect(tooltip.textContent).toContain(`alpha/${branch}`);
    expect(tooltip.textContent).toContain(worktreeCwd);
    expect(tooltip.textContent).toContain("1m");
    expect(tooltip.textContent).toContain("Working...");
    expect(tooltip.querySelector('[aria-label="Model"]')).not.toBeNull();
    expect(tooltip.querySelector('[aria-label="Branch"]')).not.toBeNull();
    expect(
      tooltip.querySelector('[aria-label="Working directory"]'),
    ).not.toBeNull();
    expect(tooltip.querySelector('[aria-label="Last updated"]')).not.toBeNull();
    expect(tooltip.querySelector("h3")?.classList.contains("truncate")).toBe(
      false,
    );
    expect(
      tooltip.querySelector("h3")?.classList.contains("line-clamp-1"),
    ).toBe(false);
  });

  it("opens and closes pointer summaries immediately and retains direct card transfer", () => {
    vi.useFakeTimers();
    act(() => render());
    act(() => {
      card("a").dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(tooltip).not.toBeNull();
    act(() => {
      card("a").dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: tooltip }),
      );
      tooltip.dispatchEvent(
        new MouseEvent("pointerover", {
          bubbles: true,
          relatedTarget: card("a"),
        }),
      );
    });
    expect(document.querySelector('[role="tooltip"]')).toBe(tooltip);
    act(() => {
      tooltip.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("hides missing metadata and uses the row status priority in summaries", () => {
    props.projectHistory = [{ ...summary("a"), draft: true, updatedAt: 0 }];
    props.sessions = props.projectHistory;
    props.busySessionIds = new Set(["a"]);
    props.approvalSessionIds = new Set(["a"]);
    props.unseenFinishedIds = new Set(["a"]);
    act(() => render());
    act(() =>
      card("a").querySelector<HTMLElement>("[data-session-select]")!.focus(),
    );
    const tooltip = () =>
      document.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(tooltip().textContent).toContain("Need approval");
    expect(tooltip().querySelector('[aria-label="Model"]')).toBeNull();
    expect(tooltip().querySelector('[aria-label="Branch"]')).toBeNull();
    expect(
      tooltip().querySelector('[aria-label="Working directory"]'),
    ).toBeNull();
    expect(tooltip().querySelector('[aria-label="Last updated"]')).toBeNull();
    props.approvalSessionIds = new Set();
    act(() => render());
    expect(tooltip().textContent).toContain("Working...");
    props.busySessionIds = new Set();
    act(() => render());
    expect(tooltip().textContent).toContain("Done");
    props.unseenFinishedIds = new Set();
    act(() => render());
    expect(tooltip().textContent).toContain("Draft");
    props.projectHistory = [summary("a")];
    props.sessions = props.projectHistory;
    act(() => render());
    expect(tooltip().textContent).toContain("Idle");
  });

  it("dismisses a focused summary on Escape, outside click, scroll and selection", () => {
    act(() => render());
    const trigger = card("a").querySelector<HTMLElement>(
      "[data-session-select]",
    )!;
    const focus = () => {
      act(() => trigger.blur());
      act(() => trigger.focus());
      expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    };
    focus();
    act(() =>
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    focus();
    act(() =>
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    focus();
    act(() => container.dispatchEvent(new Event("scroll")));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    focus();
    act(() => card("a").click());
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(props.onSelectSession).toHaveBeenCalledWith("a", A);
  });

  it("closes summaries when a project or the sidebar starts collapsing", () => {
    act(() => render());
    act(() =>
      card("a").querySelector<HTMLElement>("[data-session-select]")!.focus(),
    );
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    act(() =>
      project(A).querySelector<HTMLElement>("[data-project-header]")!.click(),
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    settleFolds();
    expand(A);
    act(() =>
      card("a").querySelector<HTMLElement>("[data-session-select]")!.focus(),
    );
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    props.open = false;
    act(() => render());
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("dismisses metadata before a session menu or drag and keeps it hidden during dragging", () => {
    vi.useFakeTimers();
    act(() => render());
    const trigger = card("a").querySelector<HTMLElement>(
      "[data-session-select]",
    )!;
    act(() => trigger.focus());
    act(() =>
      card("a").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })),
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    act(() => trigger.blur());
    act(() => trigger.focus());
    const from = card("a");
    from.setPointerCapture = vi.fn();
    from.releasePointerCapture = vi.fn();
    vi.spyOn(document, "elementFromPoint").mockReturnValue(null);
    act(() => {
      from.dispatchEvent(
        new PointerEvent("pointerdown", {
          button: 0,
          pointerId: 1,
          clientX: 1,
          clientY: 1,
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 20,
          clientY: 20,
          bubbles: true,
        }),
      );
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    act(() => {
      from.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    act(() =>
      window.dispatchEvent(
        new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
      ),
    );
    expect(props.onSelectSession).not.toHaveBeenCalled();
  });

  it("keeps the immediate subagent tooltip ahead of session metadata", () => {
    props.projectHistory = [
      {
        ...summary("a"),
        orchestration: {
          status: "active",
          tasks: [
            {
              sessionId: "worker",
              title: "Review changes",
              harness: "codex",
              model: "codex:test",
              status: "running",
            },
          ],
        },
      },
    ];
    props.sessions = props.projectHistory;
    act(() => render());
    act(() =>
      card("a").querySelector<HTMLElement>("[data-session-select]")!.focus(),
    );
    expect(document.querySelector('[role="tooltip"] h3')).not.toBeNull();
    act(() =>
      card("a")
        .querySelector("[data-orchestration-icon]")!
        .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    );
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    const tooltip = document.querySelector('[role="tooltip"]')!;
    expect(tooltip.textContent).toContain("Subagents");
    expect(tooltip.textContent).toContain("Review changes");
    expect(tooltip.querySelector("h3")).toBeNull();
  });

  it("matches the project row height and horizontal bounds for plain, folder, pinned and reminder sessions, including rename", () => {
    props.projectHistory = [
      summary("plain", A),
      summary("folder", A),
      { ...summary("pinned", A), pinned: true },
      summary("reminder", A),
    ];
    props.sessions = props.projectHistory;
    props.reminders = [
      {
        sessionId: "reminder",
        cwd: A,
        title: "Reminder",
        harness: "codex",
        dueAt: 12_345,
        firedAt: null,
      },
    ];
    props.onRenameSession = vi.fn();
    saveSessionFolders(A, [
      {
        id: "folder-a",
        name: "Folder",
        sessionIds: ["folder"],
        collapsed: false,
      },
    ]);
    act(() => render());
    const header = project(A).querySelector<HTMLElement>(
      "[data-project-header]",
    )!;
    expect(header.classList.contains("h-8")).toBe(true);
    expect(header.classList.contains("px-2")).toBe(true);
    const lists = project(A).querySelectorAll<HTMLElement>(
      "[data-project-session-section] ul",
    );
    expect(lists).toHaveLength(4);
    for (const list of lists) {
      expect(list.classList.contains("gap-[3px]")).toBe(true);
      if (list.hasAttribute("data-session-list")) {
        expect(list.classList.contains("py-[3px]")).toBe(true);
      } else {
        expect(list.classList.contains("pt-[3px]")).toBe(true);
        expect(list.classList.contains("py-[3px]")).toBe(false);
      }
      expect(list.classList.contains("gap-px")).toBe(false);
    }
    const groups = project(A).querySelectorAll<HTMLElement>(
      "[data-pinned-sessions],[data-reminder-sessions],[data-session-folder]",
    );
    expect(groups).toHaveLength(3);
    for (const group of groups) {
      expect(group.classList.contains("mb-1")).toBe(false);
      expect(group.classList.contains("mb-1.5")).toBe(false);
    }
    for (const id of ["plain", "folder", "pinned", "reminder"]) {
      expect(card(id).classList.contains("h-8")).toBe(true);
      expect(card(id).classList.contains("w-full")).toBe(true);
      for (
        let node = card(id).parentElement;
        node && !node.hasAttribute("data-project-session-section");
        node = node.parentElement
      ) {
        expect(node.classList.contains("px-1")).toBe(false);
        expect(node.classList.contains("p-1")).toBe(false);
      }
    }
    // Rows keep the header's bounds while their text indents to its name.
    expect(card("plain").classList.contains("pl-8")).toBe(true);
    expect(card("plain").classList.contains("pr-2")).toBe(true);
    expect(card("folder").classList.contains("pl-[54px]")).toBe(true);
    expect(card("folder").classList.contains("pr-2")).toBe(true);
    act(() =>
      card("plain")
        .querySelector<HTMLElement>("[data-session-select]")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "F2", bubbles: true }),
        ),
    );
    const rename = project(A).querySelector<HTMLElement>(
      '[data-session-rename-row="plain"]',
    )!;
    expect(rename.classList.contains("h-8")).toBe(true);
    expect(rename.classList.contains("w-full")).toBe(true);
    expect(rename.classList.contains("pl-6")).toBe(true);
  });

  it.each(["folder", "pinned", "reminders"] as const)(
    "animates %s members open and closed through the shared disclosure",
    (kind) => {
      props.projectHistory = [
        { ...summary("member", A), pinned: kind === "pinned" },
      ];
      props.sessions = props.projectHistory;
      if (kind === "folder") {
        saveSessionFolders(A, [
          { id: "f", name: "Folder", sessionIds: ["member"], collapsed: false },
        ]);
      }
      if (kind === "reminders") {
        props.reminders = [
          {
            sessionId: "member",
            cwd: A,
            title: "Reminder",
            harness: "codex",
            dueAt: 12_345,
            firedAt: null,
          },
        ];
      }
      act(() => render());
      const selector =
        kind === "folder"
          ? "[data-session-folder]"
          : kind === "pinned"
            ? "[data-pinned-sessions]"
            : "[data-reminder-sessions]";
      const group = project(A).querySelector<HTMLElement>(selector)!;
      const toggle = group.querySelector<HTMLButtonElement>(
        "button[aria-expanded]",
      )!;
      const fold = () => group.querySelector<HTMLElement>(".zen-fold-item");
      expect(fold()?.dataset.foldState).toBe("open");
      act(() => toggle.click());
      expect(fold()?.dataset.foldState).toBe("closing");
      expect(fold()?.inert).toBe(true);
      expect(card("member")).not.toBeNull();
      settleFolds();
      expect(card("member")).toBeNull();
      act(() => toggle.click());
      expect(fold()?.dataset.foldState).toBe("opening");
      expect(card("member")).not.toBeNull();
      act(() =>
        fold()!.dispatchEvent(new Event("animationend", { bubbles: true })),
      );
      expect(fold()?.dataset.foldState).toBe("open");
    },
  );

  it("reveals matching collapsed projects and folders, matches custom names, and restores saved expansion", () => {
    saveSessionFolders(B, [
      { id: "folder-b", name: "Team", sessionIds: ["b"], collapsed: true },
    ]);
    saveTabGroupLabel(B, "My custom beta");
    act(() => render());
    query("Hidden conversation");
    expect(card("b")).not.toBeNull();
    expect(project(A)).toBeNull();
    expect(
      project(B)
        .querySelector('[data-session-folder="folder-b"] button')
        ?.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(loadSessionFolders(B)[0].collapsed).toBe(true);
    expect(loadProjectTreeExpanded(A)).toEqual(new Set([A]));
    query("");
    settleFolds();
    expect(card("b")).toBeNull();
    expect(card("a")).not.toBeNull();
    query("My custom");
    expect(card("b")).not.toBeNull();
    query("/workspace/beta");
    expect(card("b")).not.toBeNull();
  });

  it("keeps folder membership through first load, filtered searches and failed refreshes", () => {
    saveProjectTreeExpanded([A, B]);
    saveSessionFolders(B, [
      {
        id: "folder-b",
        name: "Team",
        sessionIds: ["b", "later"],
        collapsed: false,
      },
    ]);
    props.loadedProjectPaths = new Set([A]);
    act(() => render());
    expect(loadSessionFolders(B)[0].sessionIds).toEqual(["b", "later"]);
    props.failedProjectPaths = new Set([B]);
    act(() => render());
    expect(card("b")).not.toBeNull();
    expect(project(B).textContent).toContain("Couldn’t load sessions");
    query("Hidden conversation");
    expect(loadSessionFolders(B)[0].sessionIds).toEqual(["b", "later"]);
    expect(project(B).querySelector("button")?.textContent).not.toBe(
      "No sessions yet",
    );
  });

  it.each(["files", "changes"] as const)(
    "switches the one full-height working copy from the project header picker in %s",
    (tab) => {
      props.tab = tab;
      props.onSelectWorkspace = vi.fn();
      props.onGoToFile = vi.fn();
      measuredHeight = 300;
      saveTabGroupLabel(A, "My alpha");
      vi.mocked(useProjectDiffStats).mockImplementation((path, enabled) =>
        enabled
          ? { files: 1, additions: path === A ? 7 : 11, deletions: 2 }
          : null,
      );
      act(() => render());

      expect(container.querySelectorAll("[data-project-path]")).toHaveLength(0);
      expect(
        container.querySelectorAll("[data-project-working-copy]"),
      ).toHaveLength(1);
      const switcher = container.querySelector<HTMLElement>(
        "[data-project-switcher]",
      )!;
      const header = container.querySelector<HTMLElement>(
        "aside > [data-project-header]",
      )!;
      const tablist = container.querySelector('[role="tablist"]')!;
      const picker = switcher.querySelector<HTMLButtonElement>("button")!;
      expect(picker.textContent).toContain("My alpha");
      expect(picker.getAttribute("aria-label")).toBe(
        "Switch project, current project My alpha",
      );
      expect(switcher.parentElement).toBe(header);
      expect(header.textContent).not.toContain("Projects");
      expect(header.nextElementSibling).toBe(tablist);
      const worktreeToolbar = container.querySelector<HTMLElement>(
        "[data-active-worktree-toolbar]",
      )!;
      expect(worktreeToolbar.parentElement).toBe(switcher);
      expect(picker.parentElement?.nextElementSibling).toBe(worktreeToolbar);
      expect(
        worktreeToolbar
          .querySelector(`[data-worktree-picker="${A}"]`)
          ?.getAttribute("data-compact"),
      ).toBe("true");
      const quickOpen = header.querySelector<HTMLButtonElement>(
        'button[aria-label^="Quick Open"]',
      )!;
      expect(quickOpen).not.toBeNull();
      expect(
        header.querySelector('button[aria-label="Open project"]'),
      ).not.toBeNull();
      act(() => quickOpen.click());
      expect(props.onGoToFile).toHaveBeenCalledTimes(1);
      const copy = container.querySelector<HTMLElement>(
        "[data-project-working-copy]",
      )!;
      expect(copy.style.height).toBe("");
      expect(copy.style.maxHeight).toBe("");
      expect(copy.classList.contains("flex-1")).toBe(true);
      expect(copy.classList.contains("min-h-0")).toBe(true);
      expect(tablist.nextElementSibling?.contains(copy)).toBe(true);
      expect(
        copy.classList.contains(
          tab === "files" ? "overflow-hidden" : "overflow-y-auto",
        ),
      ).toBe(true);
      expect(copy.querySelector(`[data-${tab}-project="${A}"]`)).not.toBeNull();
      expect(
        container.querySelector('[role="tab"][title="Explorer"]')?.textContent,
      ).toBe("Files");
      expect(
        container
          .querySelector('[role="tab"][title="Changes"]')
          ?.getAttribute("aria-label"),
      ).toBe("Changes +7 -2");
      expect(
        vi
          .mocked(useProjectDiffStats)
          .mock.calls.filter(([, enabled]) => enabled),
      ).toEqual(expect.arrayContaining([[A, true]]));
      expect(
        vi
          .mocked(useProjectDiffStats)
          .mock.calls.filter(([, enabled]) => enabled)
          .every(([path]) => path === A),
      ).toBe(true);

      act(() => picker.click());
      const dialog = document.querySelector(
        '[role="dialog"][aria-label="Project picker"]',
      )!;
      expect(dialog).not.toBeNull();
      act(() =>
        dialog
          .querySelector<HTMLButtonElement>(`button[title="${B}"]`)!
          .click(),
      );
      expect(props.onSelectProject).toHaveBeenCalledWith(B);
      expect(
        document.querySelector('[role="dialog"][aria-label="Project picker"]'),
      ).toBeNull();
      vi.mocked(useProjectDiffStats).mockClear();
      props.cwd = B;
      act(() => render());
      expect(container.querySelectorAll("[data-project-path]")).toHaveLength(0);
      expect(container.querySelectorAll(`[data-${tab}-project]`)).toHaveLength(
        1,
      );
      expect(
        container.querySelector(`[data-${tab}-project="${B}"]`),
      ).not.toBeNull();
      expect(
        container.querySelector("[data-project-switcher] button")?.textContent,
      ).toContain("beta");
      expect(
        container
          .querySelector(`[data-worktree-picker="${B}"]`)
          ?.getAttribute("data-compact"),
      ).toBe("true");
      expect(
        container
          .querySelector('[role="tab"][title="Changes"]')
          ?.getAttribute("aria-label"),
      ).toBe("Changes +11 -2");
      expect(
        vi
          .mocked(useProjectDiffStats)
          .mock.calls.filter(([, enabled]) => enabled),
      ).toEqual(expect.arrayContaining([[B, true]]));
      expect(
        vi
          .mocked(useProjectDiffStats)
          .mock.calls.filter(([, enabled]) => enabled)
          .every(([path]) => path === B),
      ).toBe(true);
    },
  );

  it("lets the whole Changes surface scroll in the remaining sidebar height", () => {
    props.tab = "changes";
    measuredHeight = 300;
    act(() => render());
    const copy = container.querySelector<HTMLElement>(
      "[data-project-working-copy]",
    )!;
    const content = copy.querySelector<HTMLElement>(
      "[data-project-changes-content]",
    )!;
    expect(copy.style.height).toBe("");
    expect(copy.style.maxHeight).toBe("");
    expect(copy.classList.contains("overflow-y-auto")).toBe(true);
    expect(content.style.height).toBe("");
    expect(content.classList.contains("min-h-[480px]")).toBe(true);
    expect(content.classList.contains("shrink-0")).toBe(true);
    expect(container.querySelectorAll("[data-project-path]")).toHaveLength(0);
  });

  it.each([
    ["files", ""],
    ["files", "~"],
    ["changes", ""],
    ["changes", "~"],
  ] as const)(
    "shows a project picker and hint for %s without a project (%s)",
    (tab, cwd) => {
      props.tab = tab;
      props.cwd = cwd;
      act(() => render());
      const switcher = container.querySelector<HTMLElement>(
        "[data-project-switcher]",
      )!;
      expect(switcher.parentElement).toBe(
        container.querySelector("aside > [data-project-header]"),
      );
      expect(
        container.querySelector("[data-active-worktree-toolbar]"),
      ).toBeNull();
      expect(switcher.querySelector("button")?.textContent).toContain(
        "Choose project",
      );
      expect(switcher.querySelector("button")?.getAttribute("aria-label")).toBe(
        "Choose project",
      );
      expect(container.querySelector("[data-project-working-copy]")).toBeNull();
      expect(container.querySelector("[data-project-path]")).toBeNull();
      expect(
        container.querySelectorAll(
          "[data-files-project], [data-changes-project]",
        ),
      ).toHaveLength(0);
      expect(
        Array.from(container.querySelectorAll("p"), (node) => node.textContent),
      ).toContain("Choose project");
    },
  );

  it("localizes the project picker and empty hint while preserving its custom project name", () => {
    props.tab = "files";
    saveTabGroupLabel(A, "My alpha");
    setUiLanguage("zh-CN");
    act(() => render());
    const picker = () =>
      container.querySelector<HTMLButtonElement>(
        "[data-project-switcher] button",
      )!;
    expect(picker().textContent).toContain("My alpha");
    expect(picker().getAttribute("aria-label")).toContain("当前项目 My alpha");
    expect(
      container.querySelector('[role="tab"][title="文件资源管理器"]')
        ?.textContent,
    ).toBe("文件");

    props.cwd = "~";
    act(() => render());
    expect(picker().textContent).toContain("选择项目");
    expect(picker().getAttribute("aria-label")).toBe("选择项目");
    expect(
      Array.from(container.querySelectorAll("p"), (node) => node.textContent),
    ).toContain("选择项目");
    expect(container.querySelector("[data-project-working-copy]")).toBeNull();
  });

  it("searches projects by their custom name and selects the match with Enter", () => {
    props.tab = "files";
    saveTabGroupLabel(B, "Archive beta");
    act(() => render());
    act(() =>
      container
        .querySelector<HTMLButtonElement>("[data-project-switcher] button")!
        .click(),
    );
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="Search projects..."]',
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(search, "Archive");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const dialog = document.querySelector(
      '[role="dialog"][aria-label="Project picker"]',
    )!;
    expect(dialog.querySelector(`button[title="${A}"]`)).toBeNull();
    expect(dialog.querySelector(`button[title="${B}"]`)?.textContent).toContain(
      "Archive beta",
    );
    act(() =>
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(props.onSelectProject).toHaveBeenCalledExactlyOnceWith(B);
    expect(
      document.querySelector('[role="dialog"][aria-label="Project picker"]'),
    ).toBeNull();
  });

  it("opens the existing project flow from the project picker", () => {
    props.tab = "files";
    act(() => render());
    act(() =>
      container
        .querySelector<HTMLButtonElement>("[data-project-switcher] button")!
        .click(),
    );
    const createProject = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="dialog"][aria-label="Project picker"] button',
      ),
    ).find((button) => button.textContent === "New project")!;
    act(() => createProject.click());
    expect(props.onOpenProject).toHaveBeenCalledTimes(1);
  });

  it.each(["files", "changes"] as const)(
    "keeps the open-project action next to the project header pickers in %s",
    (tab) => {
      props.tab = tab;
      act(() => render());
      const header = container.querySelector<HTMLElement>(
        "aside > [data-project-header]",
      )!;
      act(() =>
        header
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Open project"]',
          )!
          .click(),
      );
      const openFolder = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[role="menu"][aria-label="Open project"] button',
        ),
      ).find((button) => button.textContent === "Open folder…")!;
      expect(openFolder).not.toBeNull();
      act(() => openFolder.click());
      expect(props.onOpenProject).toHaveBeenCalledTimes(1);
    },
  );

  it("defaults Sessions to all projects with the picker above tabs and search", () => {
    props.onSelectWorkspace = vi.fn();
    act(() => render());
    const header = container.querySelector<HTMLElement>(
      "aside > [data-project-header]",
    )!;
    const tablist = container.querySelector('[role="tablist"]')!;
    const searchRow = input().parentElement!.parentElement!;
    expect(header.textContent).toContain("All projects");
    expect(header.nextElementSibling).toBe(tablist);
    expect(header.contains(scopePicker())).toBe(true);
    expect(tablist.nextElementSibling).toBe(searchRow);
    expect(
      container.querySelector("[data-active-worktree-toolbar]"),
    ).toBeNull();
    expect(project(A)).not.toBeNull();
    expect(project(B)).not.toBeNull();
  });

  it("selects the current project too, scopes conversations, and restores all projects", () => {
    saveProjectTreeExpanded([A, B]);
    props.onSelectWorkspace = vi.fn();
    act(() => render());
    pickScope(A);
    expect(scopePicker().textContent).toContain("alpha");
    expect(project(A)).not.toBeNull();
    expect(project(B)).toBeNull();
    expect(card("a")).not.toBeNull();
    expect(card("b")).toBeNull();
    expect(input().placeholder).toBe("Search conversations...");
    expect(
      container
        .querySelector(`[data-worktree-picker="${A}"]`)
        ?.getAttribute("data-compact"),
    ).toBe("true");
    expect(props.onSelectProject).toHaveBeenCalledExactlyOnceWith(A);
    pickScope(null);
    expect(scopePicker().textContent).toContain("All projects");
    expect(card("a")).not.toBeNull();
    expect(card("b")).not.toBeNull();
    expect(loadProjectTreeExpanded()).toEqual(new Set([A, B]));
    expect(props.onSelectProject).toHaveBeenCalledTimes(1);
  });

  it("activates and expands a selected collapsed project without hiding its sessions again", () => {
    saveProjectTreeExpanded([A]);
    props.onSessionNavigationOrder = vi.fn();
    act(() => render());
    pickScope(B);
    expect(props.onSelectProject).toHaveBeenCalledExactlyOnceWith(B);
    expect(props.onSessionNavigationOrder).toHaveBeenLastCalledWith([]);
    expect(card("b")).not.toBeNull();
    expect(project(A)).toBeNull();
    expect(loadProjectTreeExpanded()).toEqual(new Set([A, B]));
    query("Alpha conversation");
    expect(card("a")).toBeNull();
    expect(container.textContent).toContain("No matching sessions");
    query("Hidden");
    expect(card("b")).not.toBeNull();
    pickScope(null);
    query("Alpha");
    expect(card("a")).not.toBeNull();
  });

  it("retains the conversation scope when visiting Files and restores all if its project is removed", () => {
    act(() => render());
    pickScope(B);
    props.cwd = B;
    props.tab = "files";
    act(() => render());
    expect(
      container.querySelector(`[data-files-project="${B}"]`),
    ).not.toBeNull();
    act(() => scopePicker().click());
    expect(
      document.querySelector('[role="dialog"]')?.textContent,
    ).not.toContain("All projects");
    props.tab = "sessions";
    act(() => render());
    expect(
      document.querySelector('[role="dialog"][aria-label="Project picker"]'),
    ).toBeNull();
    expect(project(A)).toBeNull();
    expect(scopePicker().textContent).toContain("beta");
    props.cwd = A;
    props.recents = [{ path: A, openedAt: 1 }];
    act(() => render());
    expect(scopePicker().textContent).toContain("All projects");
    expect(project(A)).not.toBeNull();
  });

  it("reveals a selected project's collapsed group temporarily and hides other groups", () => {
    saveProjectGroups([
      { id: "group-a", name: "First group", collapsed: true },
      { id: "group-b", name: "Second group", collapsed: true },
    ]);
    saveProjectGroupAssignments({ [A]: "group-a", [B]: "group-b" });
    act(() => render());
    pickScope(B);
    expect(card("b")).not.toBeNull();
    expect(container.textContent).toContain("Second group");
    expect(container.textContent).not.toContain("First group");
    expect(loadProjectGroups().every((group) => group.collapsed)).toBe(true);
    pickScope(null);
    settleFolds();
    expect(container.textContent).toContain("First group");
    expect(card("b")).toBeNull();
  });

  it("limits missing-history search reads to the selected project", async () => {
    saveProjectTreeExpanded([]);
    props.loadedProjectPaths = new Set();
    props.onLoadProject = vi.fn(async () => {});
    act(() => render());
    pickScope(B);
    query("Hidden");
    await act(async () => {});
    expect(props.onLoadProject).toHaveBeenCalled();
    expect(
      vi.mocked(props.onLoadProject).mock.calls.every(([path]) => path === B),
    ).toBe(true);
    expect(project(A)).toBeNull();
  });

  it("supports searching remote project names and selecting them with Enter", () => {
    const remote = "remote://machine/host/repo";
    rememberRemoteProject("machine", {
      id: "remote",
      cwd: "/host/repo",
      name: "Remote repo",
    });
    remoteState.rows.set(remote, [
      hostRow("remote-chat", "Remote conversation"),
    ]);
    props.recents = [...props.recents!, { path: remote, openedAt: 3 }];
    saveTabGroupLabel(remote, "Remote repo");
    act(() => render());
    act(() => scopePicker().click());
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="Search projects..."]',
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(search, "Remote repo");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(props.onSelectProject).toHaveBeenCalledExactlyOnceWith(remote);
    expect(project(A)).toBeNull();
    expect(card("remote-chat")).not.toBeNull();
    pickScope(null);
    expect(project(A)).not.toBeNull();
  });

  it("localizes all-project scope and restores it with the keyboard", () => {
    saveTabGroupLabel(B, "My beta");
    setUiLanguage("zh-CN");
    act(() => render());
    expect(scopePicker().textContent).toContain("所有项目");
    expect(scopePicker().getAttribute("aria-label")).toContain("筛选项目");
    act(() => scopePicker().click());
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[role="dialog"] button[title="${B}"]`,
        )!
        .click(),
    );
    expect(scopePicker().textContent).toContain("My beta");
    act(() => scopePicker().click());
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="搜索项目…"]',
    )!;
    act(() =>
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(scopePicker().textContent).toContain("所有项目");
    expect(project(A)).not.toBeNull();
  });

  it.each(["files", "changes"] as const)(
    "keeps the single-project %s working copy without a picker",
    (tab) => {
      props.tab = tab;
      props.recents = undefined;
      props.onSelectWorkspace = vi.fn();
      act(() => render());
      expect(container.querySelector("[data-project-switcher]")).toBeNull();
      const header = container.querySelector<HTMLElement>(
        "aside > [data-project-header]",
      )!;
      const tablist = container.querySelector('[role="tablist"]')!;
      const worktreeToolbar = container.querySelector<HTMLElement>(
        "[data-active-worktree-toolbar]",
      )!;
      expect(header.textContent).toBe("Projects");
      expect(header.nextElementSibling).toBe(tablist);
      expect(tablist.nextElementSibling).toBe(worktreeToolbar);
      expect(header.contains(worktreeToolbar)).toBe(false);
      expect(
        worktreeToolbar
          .querySelector("[data-worktree-picker]")
          ?.getAttribute("data-compact"),
      ).toBe("false");
      expect(
        container.querySelectorAll("[data-project-working-copy]"),
      ).toHaveLength(1);
      expect(
        container.querySelector(`[data-${tab}-project="${A}"]`),
      ).not.toBeNull();
    },
  );

  it("does not drop cached remote folder members while offline", () => {
    configureSharedHost("machine", [{ id: "project", cwd: B, name: "beta" }]);
    remoteState.rows.set(B, [hostRow("b", "Host conversation")]);
    remoteState.states.set(B, { loaded: true, offline: true });
    saveProjectTreeExpanded([A, B]);
    saveSessionFolders(B, [
      {
        id: "folder-b",
        name: "Team",
        sessionIds: ["b", "offline-only"],
        collapsed: false,
      },
    ]);
    act(() => render());
    expect(card("b")).not.toBeNull();
    expect(loadSessionFolders(B)[0].sessionIds).toEqual(["b", "offline-only"]);
    expect(project(B).textContent).toContain(
      "Offline — showing cached sessions",
    );
  });

  it("preserves a blank Host session created in a folder after collapse and re-expansion before its first send", () => {
    configureSharedHost("machine", [{ id: "project", cwd: B, name: "beta" }]);
    remoteState.rows.set(B, [hostRow("b")]);
    saveProjectTreeExpanded([A, B]);
    saveSessionFolders(B, [
      { id: "folder-b", name: "Team", sessionIds: ["b"], collapsed: false },
    ]);
    props.onNewInProject = vi.fn((path) => {
      props = {
        ...props,
        openSessions: [summary("blank-host", path, "Blank Host session")],
      };
      render();
      return "blank-host";
    });
    act(() => render());
    act(() =>
      project(B)
        .querySelector<HTMLButtonElement>(
          '[data-session-folder] button[aria-label="New session"]',
        )!
        .click(),
    );
    expect(loadSessionFolders(B)[0].sessionIds).toContain("blank-host");
    act(() =>
      project(B)
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Collapse project"]',
        )!
        .click(),
    );
    settleFolds();
    expect(card("blank-host")).toBeNull();
    expand(B);
    expect(card("blank-host")).not.toBeNull();
    expect(loadSessionFolders(B)[0].sessionIds).toContain("blank-host");
    act(() => card("blank-host").click());
    expect(props.onSelectSession).toHaveBeenCalledWith("blank-host", B);
    remoteState.bindings.set("blank-host", "host-new");
    props = { ...props, openSessions: [...props.openSessions!] };
    act(() => render());
    expect(loadSessionFolders(B)[0].sessionIds).toContain("host-new");
    expect(card("host-new")).not.toBeNull();
  });

  it("rejects dragging a session into another project's folder and keeps keyboard multiselection scoped", () => {
    saveProjectTreeExpanded([A, B]);
    saveSessionFolders(B, [
      { id: "folder-b", name: "Team", sessionIds: ["b"], collapsed: false },
    ]);
    props.onPlaceSessionOnPane = vi.fn();
    act(() => render());
    const select = (id: string) =>
      act(() =>
        card(id)
          .querySelector<HTMLElement>("[data-session-select]")!
          .dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              ctrlKey: true,
              bubbles: true,
            }),
          ),
      );
    select("a");
    expect(card("a").dataset.sessionSelected).toBe("true");
    select("b");
    expect(card("a").dataset.sessionSelected).toBeUndefined();
    expect(card("b").dataset.sessionSelected).toBe("true");
    const from = card("a");
    from.setPointerCapture = vi.fn();
    from.releasePointerCapture = vi.fn();
    vi.spyOn(document, "elementFromPoint").mockReturnValue(card("b"));
    act(() => {
      from.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 1,
          button: 0,
          clientX: 1,
          clientY: 1,
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 20,
          clientY: 20,
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 1,
          clientX: 20,
          clientY: 20,
          bubbles: true,
        }),
      );
    });
    expect(loadSessionFolders(A)).toEqual([]);
    expect(loadSessionFolders(B)[0].sessionIds).toEqual(["b"]);
    expect(props.onPlaceSessionOnPane).not.toHaveBeenCalled();
  });

  it("routes a native-history row on another machine through the remote project", () => {
    const remoteProject = rememberRemoteProject("other-machine", {
      id: "remote-project",
      cwd: "/remote/repo",
      name: "repo",
    });
    props.recents!.push({ path: remoteProject.key, openedAt: 3 });
    props.onSelectRemoteSession = vi.fn();
    remoteState.rows.set(remoteProject.key, [
      {
        ...hostRow("remote-native"),
        nativeSession: {
          provider: "codex",
          providerSessionId: "provider",
          createdAt: 0,
          updatedAt: 0,
          path: "/native.jsonl",
          revision: "r1",
          blockIds: [],
        },
      },
    ]);
    saveProjectTreeExpanded([A, remoteProject.key]);
    act(() => render());
    act(() => card("remote-native").click());
    expect(props.onSelectRemoteSession).toHaveBeenCalledWith(
      remoteProject.key,
      "remote-native",
    );
    expect(props.onSelectSession).not.toHaveBeenCalled();
  });

  it("uses project identity for colliding Host ids and preserves native Shared Host routing", () => {
    configureSharedHost("machine", [
      { id: "alpha-host", cwd: A, name: "alpha" },
      { id: "beta-host", cwd: B, name: "beta" },
    ]);
    remoteState.rows.set(A, [hostRow("same", "Host alpha")]);
    remoteState.rows.set(B, [
      hostRow("same", "Host beta"),
      {
        ...hostRow("native", "Native imported"),
        nativeSession: {
          provider: "codex",
          providerSessionId: "provider",
          createdAt: 0,
          updatedAt: 0,
          path: "/native.jsonl",
          revision: "r1",
          blockIds: [],
        },
      },
    ]);
    props.activeSessionId = "shell:same";
    props.onSelectRemoteSession = vi.fn();
    saveProjectTreeExpanded([A, B]);
    act(() => render());
    expect(
      project(A)
        .querySelector('[data-session-select="same"]')
        ?.getAttribute("aria-current"),
    ).toBe("true");
    expect(
      project(B)
        .querySelector('[data-session-select="same"]')
        ?.getAttribute("aria-current"),
    ).toBeNull();
    act(() =>
      project(B)
        .querySelector<HTMLElement>('[data-session-card="same"]')!
        .click(),
    );
    expect(props.onSelectRemoteSession).toHaveBeenCalledWith(B, "same");
    act(() => card("native").click());
    expect(props.onSelectSession).toHaveBeenCalledWith("native", B);
  });
});

describe("unified project search loading", () => {
  it("loads at most four unvisited projects, waits before no-results, and stops queuing when search clears", async () => {
    props.recents = [
      A,
      ...Array.from({ length: 7 }, (_, n) => `/workspace/project-${n}`),
    ].map((path) => ({ path, openedAt: 0 }));
    props.loadedProjectPaths = new Set([A]);
    const finish: Array<() => void> = [];
    props.onLoadProject = vi.fn(
      () => new Promise<void>((resolve) => finish.push(resolve)),
    );
    act(() => render());
    await act(async () => query("a search that has no matches"));
    expect(props.onLoadProject).toHaveBeenCalledTimes(4);
    expect(container.textContent).toContain("Searching projects…");
    expect(container.textContent).not.toContain("No matching sessions");
    query("another query");
    await act(async () => Promise.resolve());
    expect(props.onLoadProject).toHaveBeenCalledTimes(4);
    query("");
    await act(async () => finish.forEach((resolve) => resolve()));
    expect(props.onLoadProject).toHaveBeenCalledTimes(4);
  });

  it("prefetches a collapsed Shared Host project despite already-loaded local summaries without starting its poller", async () => {
    configureSharedHost("machine", [{ id: "project", cwd: B, name: "beta" }]);
    props.loadedProjectPaths = new Set([A, B]);
    props.projectHistory = [summary("a", A, "Alpha conversation")];
    props.onPrefetchRemoteProject = vi.fn(async (path) => {
      remoteState.rows.set(
        path,
        path === B ? [hostRow("host-match", "Found through Host")] : [],
      );
      window.dispatchEvent(new Event("monocode:remote-history-updated"));
    });
    act(() => render());
    await act(async () => query("Found through Host"));
    expect(props.onPrefetchRemoteProject).toHaveBeenCalledWith(B);
    expect(card("host-match")).not.toBeNull();
    expect(
      remoteState.subscriptions.mock.calls
        .filter(([path]) => path === B)
        .every(([, enabled]) => enabled === false),
    ).toBe(true);
    expect(loadProjectTreeExpanded(A)).toEqual(new Set([A]));
    await act(async () => query(""));
    settleFolds();
    expect(card("host-match")).toBeNull();
  });

  it("retains a failed nonmatching remote project and its error when a search retry also fails", async () => {
    const remoteProject = rememberRemoteProject("other-machine", {
      id: "remote-project",
      cwd: "/remote/repo",
      name: "repo",
    });
    props.recents!.push({ path: remoteProject.key, openedAt: 3 });
    props.onPrefetchRemoteProject = vi.fn(async () => {
      throw new Error("offline");
    });
    act(() => render());
    await act(async () => query("Alpha conversation"));
    expect(project(remoteProject.key).textContent).toContain(
      "Couldn’t load sessions",
    );
    const retry = Array.from(
      project(remoteProject.key).querySelectorAll("button"),
    ).find((button) => button.textContent === "Retry")!;
    await act(async () => retry.click());
    expect(props.onPrefetchRemoteProject).toHaveBeenCalledTimes(2);
    expect(project(remoteProject.key).textContent).toContain(
      "Couldn’t load sessions",
    );
    expect(card("a")).not.toBeNull();
    expect(container.textContent).not.toContain("No matching sessions");
  });

  it("displays a failed project with a retry while other projects remain operable", async () => {
    props.loadedProjectPaths = new Set([A]);
    props.projectHistory = props.sessions;
    props.onLoadProject = vi.fn(async () => {
      throw new Error("list failed");
    });
    act(() => render());
    await act(async () => query("Alpha conversation"));
    expect(card("a")).not.toBeNull();
    expect(project(B).textContent).toContain("Couldn’t load sessions");
    const retry = Array.from(project(B).querySelectorAll("button")).find(
      (button) => button.textContent === "Retry",
    )!;
    expect(retry).not.toBeNull();
    await act(async () => retry.click());
    expect(props.onLoadProject).toHaveBeenCalledTimes(2);
    act(() => card("a").click());
    expect(props.onSelectSession).toHaveBeenCalledWith("a", A);
  });
});

describe("project tree session preview", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      summary(`s${index}`, A, `Chat ${index}`),
    );
  const toggle = () =>
    project(A).querySelector<HTMLButtonElement>("[data-session-list-toggle]");

  it("shows five ungrouped chats per project until Show more, then offers Show less", () => {
    props.projectHistory = many(9);
    props.sessions = props.projectHistory;
    props.activeSessionId = "s0";
    act(() => render());
    expect(card("s4")).not.toBeNull();
    expect(card("s5")).toBeNull();
    expect(toggle()?.textContent).toBe("Show more");
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
    act(() => toggle()!.click());
    expect(card("s8")).not.toBeNull();
    expect(toggle()?.textContent).toBe("Show less");
    act(() => toggle()!.click());
    expect(card("s5")).toBeNull();
  });

  it("keeps the active chat visible and leaves folders out of the preview count", () => {
    props.projectHistory = many(9);
    props.sessions = props.projectHistory;
    props.activeSessionId = "s7";
    saveSessionFolders(A, [
      { id: "f", name: "Folder", sessionIds: ["s0", "s1"], collapsed: false },
    ]);
    act(() => render());
    expect(card("s0")).not.toBeNull();
    expect(card("s1")).not.toBeNull();
    // Ungrouped s2..s7 are mounted through the active chat; s8 waits.
    expect(card("s7")).not.toBeNull();
    expect(card("s8")).toBeNull();
    expect(toggle()).not.toBeNull();
  });

  it("does not truncate search results or show the toggle for short lists", () => {
    props.projectHistory = many(9);
    props.sessions = props.projectHistory;
    act(() => render());
    query("Chat");
    expect(card("s8")).not.toBeNull();
    expect(toggle()).toBeNull();
    query("");
    props.projectHistory = many(3);
    props.sessions = props.projectHistory;
    act(() => render());
    expect(toggle()).toBeNull();
  });
});
