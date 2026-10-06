// @vitest-environment happy-dom
import { act, createElement, Fragment, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActivityBar, type ActivityBarLayout } from "./ActivityBar";
import { useUpdateStatus } from "./useUpdateStatus";
import {
  installPendingUpdate,
  probeForUpdate,
  readAppVersion,
  type UpdaterSnapshot,
} from "../model/updater";
import {
  savePinnedProjects,
  saveProjectRailOrder,
} from "../../features/projects/model/recents";
import { setUiLanguage } from "../../shared/i18n/language";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (path: string) => path,
}));
vi.mock("../../features/source-control/hooks/useProjectDiffStats", () => ({
  useProjectDiffStats: () => null,
}));
vi.mock("../model/updater", () => ({
  readAppVersion: vi.fn(async () => "0.7.0"),
  probeForUpdate: vi.fn(async () => null),
  installPendingUpdate: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
let props: ComponentProps<typeof ActivityBar>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setUiLanguage("en");
  vi.mocked(probeForUpdate).mockReset().mockResolvedValue(null);
  vi.mocked(readAppVersion).mockClear();
  vi.mocked(installPendingUpdate).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = {
    cwd: "/work/alpha",
    recents: [{ path: "/work/beta", openedAt: 1 }],
    onSelectProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSearch: vi.fn(),
    onOpenInbox: vi.fn(),
    onOpenNotes: vi.fn(),
    onOpenAutomations: vi.fn(),
    onOpenSettings: vi.fn(),
  };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setUiLanguage("en");
  localStorage.clear();
  vi.unstubAllGlobals();
});
function ActivityBarWindow({ layouts }: { layouts: ActivityBarLayout[] }) {
  const updateStatus = useUpdateStatus();
  return createElement(
    Fragment,
    null,
    ...layouts.map((layout) =>
      createElement(ActivityBar, {
        ...props,
        layout,
        updateStatus,
        key: layout,
      }),
    ),
  );
}
async function render(layouts: ActivityBarLayout[] = [props.layout ?? "rail"]) {
  await act(async () =>
    root.render(createElement(ActivityBarWindow, { layouts })),
  );
}
function action(label: string) {
  return container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  )!;
}
function projectInput() {
  return document.querySelector<HTMLInputElement>(
    'input[aria-label="Search projects"]',
  )!;
}
function typeQuery(value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(projectInput(), value);
    projectInput().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("keeps a 48px bar with title-row fallback and routes destinations to workspace actions", async () => {
  await render();
  expect(container.querySelector("nav")?.classList.contains("w-12")).toBe(true);
  expect(
    container
      .querySelector('[data-tauri-drag-region="deep"]')
      ?.classList.contains("h-10"),
  ).toBe(true);
  props.chromeInMenuBar = true;
  await render();
  expect(container.querySelector('[data-tauri-drag-region="deep"]')).toBeNull();
  const quickOpen = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.title.startsWith("Quick Open"))!;
  act(() => {
    quickOpen.click();
    action("Inbox").click();
    action("Notes").click();
    action("Automations").click();
    [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.title.startsWith("Settings"))!
      .click();
  });
  for (const fn of [
    props.onSearch,
    props.onOpenInbox,
    props.onOpenNotes,
    props.onOpenAutomations,
    props.onOpenSettings,
  ])
    expect(fn).toHaveBeenCalledOnce();
  props.inboxActive = true;
  await render();
  expect(action("Inbox").getAttribute("aria-pressed")).toBe("true");
  act(() => action("Inbox").click());
  expect(props.onOpenInbox).toHaveBeenCalledTimes(2);
  props.chromeInMenuBar = false;
  await render();
  expect(
    container
      .querySelector('[data-tauri-drag-region="deep"]')
      ?.classList.contains("h-10"),
  ).toBe(true);
});

it("leaves space for the named sidebar and preserves pinned projects in the fallback pop-out", async () => {
  saveProjectRailOrder(["/work/beta", "/work/alpha"]);
  savePinnedProjects(["/work/beta"]);
  await render();
  expect(container.querySelector('[data-project-list="avatars"]')).toBeNull();
  await act(async () => action("All projects").click());
  const list = document.querySelector('[data-project-list="full"]')!;
  expect(list.textContent).toContain("Pinnedbeta");
  act(() =>
    list
      .querySelector<HTMLButtonElement>(
        'button[data-project-select="/work/beta"]',
      )!
      .click(),
  );
  expect(props.onSelectProject).toHaveBeenCalledExactlyOnceWith("/work/beta");
  expect(document.querySelector('[data-project-list="full"]')).toBeNull();
});

it("focuses and filters the fallback project pop-out", async () => {
  await render();
  await act(async () => action("All projects").click());
  expect(document.activeElement).toBe(projectInput());
  typeQuery("beta");
  const list = document.querySelector('[data-project-list="full"]')!;
  expect(
    list.querySelector('button[data-project-select="/work/beta"]'),
  ).not.toBeNull();
  expect(
    list.querySelector('button[data-project-select="/work/alpha"]'),
  ).toBeNull();
  expect(container.querySelector('[data-project-list="avatars"]')).toBeNull();
  act(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector('[data-project-list="full"]')).toBeNull();
  expect(document.activeElement).toBe(action("All projects"));
});

it("opens working agents from the bottom icon and selects sessions across projects", async () => {
  props.onSelectAgent = vi.fn();
  props.liveAgents = [
    {
      id: "a",
      cwd: "/work/alpha",
      title: "Build settings",
      harness: "codex",
      activity: "Editing",
      startedAt: Date.now(),
      needsApproval: false,
      done: false,
    },
    {
      id: "b",
      cwd: "/work/beta",
      title: "Review tests",
      harness: "claude",
      activity: "Testing",
      startedAt: Date.now(),
      needsApproval: true,
      done: false,
    },
  ];
  await render();
  expect(
    document.querySelector('[data-live-agents-preview="full"]'),
  ).toBeNull();
  await act(async () => action("Working agents, 2").click());
  expect(document.querySelectorAll("[data-live-agent-card]")).toHaveLength(2);
  act(() =>
    document
      .querySelector<HTMLButtonElement>('[data-live-agent-card="b"]')!
      .click(),
  );
  expect(props.onSelectAgent).toHaveBeenCalledExactlyOnceWith("b");
  expect(
    document.querySelector('[data-live-agents-preview="full"]'),
  ).toBeNull();
});

it("offers a single working agent in its pop-out", async () => {
  props.onSelectAgent = vi.fn();
  props.liveAgents = [
    {
      id: "a",
      cwd: "/work/alpha",
      title: "Build settings",
      harness: "codex",
      activity: "Editing",
      startedAt: Date.now(),
      needsApproval: false,
      done: false,
    },
  ];
  await render();
  await act(async () => action("Working agents, 1").click());
  act(() =>
    document
      .querySelector<HTMLButtonElement>('[data-live-agent-card="a"]')!
      .click(),
  );
  expect(props.onSelectAgent).toHaveBeenCalledExactlyOnceWith("a");
});

it("probes once and only displays updates when there is an available action", async () => {
  await render();
  expect(action("Updates")).toBeNull();
  props.inboxActive = true;
  await render();
  expect(probeForUpdate).toHaveBeenCalledOnce();
});

it("opens the update install action from the updates icon", async () => {
  vi.mocked(probeForUpdate).mockResolvedValue({ version: "0.7.1" } as Awaited<
    ReturnType<typeof probeForUpdate>
  >);
  await render();
  expect(action("Updates")).not.toBeNull();
  expect(document.body.textContent).not.toContain("Update to 0.7.1");
  await act(async () => action("Updates").click());
  expect(document.body.textContent).toContain("Update to 0.7.1");
});

it("shares one update probe and keeps the install lock across activity layouts", async () => {
  vi.mocked(probeForUpdate).mockResolvedValue({ version: "0.7.1" } as Awaited<
    ReturnType<typeof probeForUpdate>
  >);
  let reportProgress!: (snapshot: UpdaterSnapshot) => void;
  let finishInstall!: (snapshot: UpdaterSnapshot) => void;
  vi.mocked(installPendingUpdate).mockImplementation(
    (onProgress) =>
      new Promise((resolve) => {
        reportProgress = onProgress!;
        finishInstall = resolve;
      }),
  );
  await render(["rail", "sidebar-top", "sidebar-footer"]);
  expect(probeForUpdate).toHaveBeenCalledOnce();
  expect(readAppVersion).toHaveBeenCalledOnce();
  await act(async () => action("Updates").click());
  const installButton = () =>
    document.querySelector<HTMLButtonElement>(
      '[role="dialog"][aria-label="Updates"] button',
    )!;
  act(() => installButton().click());
  expect(installPendingUpdate).toHaveBeenCalledOnce();

  // The install has not even reported downloading yet. Switching layouts
  // unmounts its old button, but the workspace still owns the install lock.
  await render(["sidebar-top", "sidebar-footer"]);
  await act(async () => action("Updates").click());
  expect(installButton().disabled).toBe(true);
  expect(installButton().textContent).toContain("Downloading…");
  act(() => installButton().click());
  expect(installPendingUpdate).toHaveBeenCalledOnce();

  act(() =>
    reportProgress({
      phase: "downloading",
      currentVersion: "0.7.0",
      availableVersion: "0.7.1",
      progress: 42,
    }),
  );
  await render(["rail"]);
  await act(async () => action("Updates").click());
  expect(installButton().textContent).toContain("Downloading 42%");
  expect(installButton().disabled).toBe(true);
  expect(probeForUpdate).toHaveBeenCalledOnce();
  await act(async () =>
    finishInstall({ phase: "downloading", currentVersion: "0.7.0" }),
  );
});

it("localizes shell labels and tooltips while preserving project names", async () => {
  await render();
  await act(async () => setUiLanguage("zh-CN"));
  expect(container.querySelector('nav[aria-label="活动栏"]')).not.toBeNull();
  expect(action("所有项目")).not.toBeNull();
  await act(async () => action("所有项目").click());
  expect(
    document.querySelector('button[data-project-select="/work/alpha"]'),
  ).not.toBeNull();
});

it("opens the named project sidebar when its shell provides that action", async () => {
  props.onShowProjects = vi.fn();
  await render();
  await act(async () => action("All projects").click());
  expect(props.onShowProjects).toHaveBeenCalledOnce();
  expect(
    document.querySelector('[role="dialog"][aria-label="All projects"]'),
  ).toBeNull();
});

it("keeps installed update notes accessible from the updates pop-out", async () => {
  props.updateNotice = { version: "0.7.0" };
  props.onOpenWhatsNew = vi.fn();
  props.onDismissUpdate = vi.fn();
  await render();
  await act(async () => action("Updates").click());
  const card = document.querySelector('[role="dialog"][aria-label="Updates"]')!;
  expect(card.textContent).toContain("Updated to 0.7.0");
  act(() =>
    [...card.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("What's new"))!
      .click(),
  );
  expect(props.onOpenWhatsNew).toHaveBeenCalledExactlyOnceWith("0.7.0");
  expect(
    document.querySelector('[role="dialog"][aria-label="Updates"]'),
  ).toBeNull();
  await act(async () => action("Updates").click());
  act(() =>
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Dismiss update notification"]',
      )!
      .click(),
  );
  expect(props.onDismissUpdate).toHaveBeenCalledOnce();
  expect(
    document.querySelector('[role="dialog"][aria-label="Updates"]'),
  ).toBeNull();
});
