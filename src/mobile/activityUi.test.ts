// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "./MobileApp";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";

const mocked = vi.hoisted(() => ({
  summaries: [] as HostSessionSummary[],
  permission: "granted",
  notify: vi.fn(),
  openSettings: vi.fn(async () => {}),
  session: vi.fn(),
  status: { state: "connected" as const },
  updateSession: vi.fn(),
  native: false,
  nativeUnread: undefined as ((result: { environmentId: string; unreadIds: string[] }) => void) | undefined,
}));
vi.mock("./client", () => ({
  MobileClient: class {
    connection = {
      endpoint: "http://computer:3774",
      token: "test-token",
      environmentId: "host",
      name: "Computer",
    };
    getConnectionStatus = () => mocked.status;
    subscribeConnectionStatus = () => () => {};
    restore = async () => true;
    pending = async () => undefined;
    verify = async () => {};
    projects = async () => [
      { id: "project", name: "Project", cwd: "/project" },
      { id: "other-project", name: "Other", cwd: "/other" },
    ];
    sessions = async (projectId: string) =>
      mocked.summaries.filter((row) => row.projectId === projectId);
    models = async () => ({ models: {}, errors: {} });
    activity = async () => ({
      environmentId: "host",
      sessions: mocked.summaries,
    });
    session = mocked.session;
    updateSession = mocked.updateSession;
  },
}));
vi.mock("./MobileAppUpdates", () => ({
  useMobileAppUpdates: () => ({}),
  MobileAppUpdates: () => null,
}));
vi.mock("./MobileTranscript", () => ({
  MobileTranscript: () => createElement("div", { "data-transcript": true }),
}));
vi.mock("./notifications", () => ({
  nativeActivityNotifications: () => mocked.native,
  MobileNotifications: {
    addListener: async (event: string, callback: typeof mocked.nativeUnread) => {
      if (event === "unread") mocked.nativeUnread = callback;
      return { remove: async () => {} };
    },
    state: async () => ({ environmentId: "host", unreadIds: [] }),
    consumeOpen: async () => ({}),
    setVisible: async () => ({ environmentId: "host", unreadIds: [] }),
    observe: async () => ({ environmentId: "host", unreadIds: [] }),
    start: async () => {},
    stop: async () => {},
    openSettings: mocked.openSettings,
  },
  mobileNotificationPermission: async () => mocked.permission,
  mobileNotificationTexts: () => ({}),
  showBrowserActivityNotification: mocked.notify,
}));

let root: Root;
let node: HTMLDivElement;
function summary(id = "one", projectId = "project"): HostSessionSummary {
  return {
    id,
    projectId,
    title: id === "one" ? "First conversation" : "Other conversation",
    harness: "codex",
    status: "idle",
    revision: 10,
    updatedAt: 100,
    lastReplyRevision: 8,
    lastCompletedRunId: "old",
  };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  setUiLanguage("en");
  mocked.permission = "granted";
  mocked.native = false;
  mocked.nativeUnread = undefined;
  mocked.notify.mockClear();
  mocked.openSettings.mockClear();
  mocked.summaries = [summary(), summary("two", "other-project")];
  mocked.updateSession.mockReset().mockImplementation(async (_projectId: string, id: string, patch: object) => {
    mocked.summaries = mocked.summaries.map(row => row.id === id ? { ...row, ...patch, revision: row.revision + 1 } : row);
    return mocked.summaries.find(row => row.id === id);
  });
  mocked.session.mockReset().mockImplementation(async (id: string) => {
    const row = mocked.summaries.find((session) => session.id === id)!;
    return {
      ...row,
      session: {
        id,
        cwd: row.projectId === "project" ? "/project" : "/other",
        title: row.title,
        harness: "codex",
        model: "codex:test",
        modelSettings: {},
        runtimeMode: "supervised",
        blocks: [],
      },
    };
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function openMenu() {
  await act(async () => {
    node.querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!.click();
  });
}
// Launch restores the first project; its history lives in the drawer.
async function clickProject() {
  await act(async () => {
    root.render(createElement(MobileApp));
  });
  await openMenu();
}
async function updateReply(id = "one") {
  mocked.summaries = mocked.summaries.map((row) =>
    row.id === id
      ? {
          ...row,
          revision: 20,
          lastReplyRevision: 20,
          lastCompletedRunId: "new",
        }
      : row,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });
}
describe("mobile unread indicators and notification navigation", () => {
  it("opens native conversation notification settings after permission is already granted", async () => {
    mocked.native = true;
    await clickProject();
    await act(async () => {
      node.querySelector<HTMLButtonElement>(".mobile-drawer-settings")!.click();
    });
    const notificationSettings = [...node.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Notification settings…");
    expect(notificationSettings).toBeDefined();
    await act(async () => notificationSettings!.click());
    expect(mocked.openSettings).toHaveBeenCalledOnce();
    await act(async () => setUiLanguage("zh-CN"));
    expect(notificationSettings!.textContent).toBe("通知设置…");
  });
  const menuButton = (label: string) => [...node.querySelectorAll<HTMLButtonElement>(".mobile-session-actions button")]
    .find(button => button.textContent?.trim() === label)!;
  const holdSession = async (id: string) => {
    const row = node.querySelector<HTMLButtonElement>(`[data-session-id="${id}"]`)!;
    await act(async () => {
      row.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, pointerId: 8, pointerType: "touch", button: 0, clientX: 100, clientY: 100,
      }));
      await vi.advanceTimersByTimeAsync(450);
      row.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 8, pointerType: "touch" }));
      row.click();
    });
  };
  it("pins and archives the held conversation without switching away from the current conversation", async () => {
    mocked.summaries.push(summary("second", "project"));
    await clickProject();
    await act(async () => node.querySelector<HTMLButtonElement>('[data-session-id="one"]')!.click());
    await openMenu();
    await holdSession("second");
    const menu = node.querySelector<HTMLElement>('.mobile-sheet[aria-label="Session actions"]')!;
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("100px");
    expect(mocked.session).not.toHaveBeenCalledWith("second");
    await act(async () => menuButton("Pin").click());
    expect(mocked.updateSession).toHaveBeenCalledWith("project", "second", { pinned: true });
    const pinnedList = node.querySelector(".mobile-section-label")!.nextElementSibling!;
    expect(pinnedList.querySelector(".mobile-session-row")!.getAttribute("data-session-id")).toBe("second");
    expect(node.querySelector("header strong")?.textContent).toBe("First conversation");
    await holdSession("second");
    expect(menuButton("Unpin")).toBeDefined();
    await act(async () => menuButton("Archive").click());
    expect(mocked.updateSession).toHaveBeenCalledWith("project", "second", { archived: true });
    expect(node.querySelector('[data-session-id="second"]')).toBeNull();
    expect(mocked.session).not.toHaveBeenCalledWith("second");
  });
  it.each([false, true])("retains a manual unread mark across activity polling (native=%s) until the conversation opens", async (native) => {
    mocked.native = native;
    await clickProject();
    await act(async () => node.querySelector<HTMLButtonElement>('[data-session-id="one"]')!.click());
    await openMenu();
    await holdSession("one");
    await act(async () => menuButton("Mark as unread").click());
    expect(node.querySelector(".mobile-unread-dot")).not.toBeNull();
    expect(node.querySelector("header strong")?.textContent).toBe("First conversation");
    await act(async () => {
      mocked.nativeUnread?.({ environmentId: "host", unreadIds: [] });
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(node.querySelector(".mobile-unread-dot")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("monocode.mobileActivity:host")!).entries.one.manualUnread).toBe(true);
    expect(mocked.notify).not.toHaveBeenCalled();
    await act(async () => node.querySelector<HTMLButtonElement>('[data-session-id="one"]')!.click());
    await openMenu();
    expect(node.querySelector(".mobile-unread-dot")).toBeNull();
    expect(JSON.parse(localStorage.getItem("monocode.mobileActivity:host")!).entries.one.manualUnread).toBeUndefined();
  });
  it("shows a green unread marker at the end of a row, clears it after loading and does not repeat the banner", async () => {
    await clickProject();
    expect(node.querySelector(".mobile-unread-dot")).toBeNull();
    await updateReply();
    const dot = node.querySelector(
      '.mobile-unread-dot[aria-label="Unread reply"]',
    )!;
    expect(dot).not.toBeNull();
    expect(dot.parentElement?.tagName).toBe("SMALL");
    expect(dot.parentElement?.lastElementChild).toBe(dot);
    expect(mocked.notify).toHaveBeenCalledTimes(1);
    await act(async () => {
      node.querySelector<HTMLButtonElement>(".mobile-session-row")!.click();
    });
    expect(
      JSON.parse(localStorage.getItem("monocode.mobileActivity:host")!).entries
        .one.read,
    ).toBe(20);
    await openMenu();
    expect(node.querySelector(".mobile-unread-dot")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(mocked.notify).toHaveBeenCalledTimes(1);
  });
  it("keeps the unread marker if opening the conversation fails", async () => {
    await clickProject();
    await updateReply();
    mocked.session.mockRejectedValue(new Error("Offline"));
    await act(async () => {
      node.querySelector<HTMLButtonElement>(".mobile-session-row")!.click();
    });
    expect(
      JSON.parse(localStorage.getItem("monocode.mobileActivity:host")!).entries
        .one.read,
    ).toBeLessThan(20);
    await openMenu();
    expect(node.querySelector(".mobile-unread-dot")).not.toBeNull();
  });
  it("still marks unread replies when permission is denied and localizes the marker", async () => {
    mocked.permission = "denied";
    await clickProject();
    await updateReply();
    expect(mocked.notify).not.toHaveBeenCalled();
    await act(async () => setUiLanguage("zh-CN"));
    expect(
      node.querySelector('.mobile-unread-dot[aria-label="未读回复"]'),
    ).not.toBeNull();
  });
  it("restores the last conversation on launch", async () => {
    localStorage.setItem(
      "monocode-mobile-last",
      JSON.stringify({
        environmentId: "host",
        projectId: "other-project",
        sessionId: "two",
      }),
    );
    await act(async () => {
      root.render(createElement(MobileApp));
    });
    expect(mocked.session).toHaveBeenCalledWith("two");
    expect(node.querySelector("header strong")?.textContent).toBe(
      "Other conversation",
    );
    expect(node.querySelector(".mobile-navigation")).toBeNull();
  });
  it("starts a new conversation when the remembered one is gone", async () => {
    localStorage.setItem(
      "monocode-mobile-last",
      JSON.stringify({
        environmentId: "host",
        projectId: "project",
        sessionId: "deleted",
      }),
    );
    await act(async () => {
      root.render(createElement(MobileApp));
    });
    expect(mocked.session).not.toHaveBeenCalled();
    expect(node.querySelector("header strong")?.textContent).toBe(
      "New conversation",
    );
  });
  it("switches projects in the drawer and closes it for a new conversation", async () => {
    await clickProject();
    const project = node.querySelector<HTMLButtonElement>(
      ".mobile-drawer-project",
    )!;
    expect(project.textContent).toContain("Project");
    await act(async () => project.click());
    const other = [
      ...node.querySelectorAll<HTMLButtonElement>(".mobile-drawer-item"),
    ].find((item) => item.querySelector("strong")?.textContent === "Other")!;
    await act(async () => other.click());
    const drawer = () =>
      node.querySelector(".mobile-drawer-backdrop")!.getAttribute("data-open");
    expect(drawer()).toBe("true");
    expect(
      node.querySelector(".mobile-session-row strong")?.textContent,
    ).toBe("Other conversation");
    await act(async () => {
      node.querySelector<HTMLButtonElement>(".mobile-drawer-new")!.click();
    });
    expect(drawer()).toBe("false");
    expect(
      JSON.parse(localStorage.getItem("monocode-mobile-last")!).projectId,
    ).toBe("other-project");
  });
  it("follows a finger to open and close the drawer", async () => {
    await act(async () => {
      root.render(createElement(MobileApp));
    });
    const backdrop = node.querySelector(".mobile-drawer-backdrop")!;
    // Layout is absent in happy-dom; give the drawer a phone-sized width.
    Object.defineProperty(node.querySelector(".mobile-drawer")!, "offsetWidth", {
      value: 300,
    });
    const surface = node.querySelector(".mobile-chat")!;
    const touch = (type: string, target: Element, x: number, y = 300) =>
      act(() => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 7,
            pointerType: "touch",
            clientX: x,
            clientY: y,
          }),
        );
      });
    expect(backdrop.getAttribute("data-open")).toBe("false");
    // A vertical scroll on the conversation leaves the drawer closed.
    await touch("pointerdown", surface, 100, 300);
    await touch("pointermove", surface, 104, 360);
    await touch("pointerup", surface, 104, 360);
    expect(backdrop.getAttribute("data-open")).toBe("false");
    // A slow pull past halfway opens it, following the finger meanwhile.
    await touch("pointerdown", surface, 20);
    await touch("pointermove", surface, 60);
    expect(backdrop.hasAttribute("data-dragging")).toBe(true);
    await touch("pointermove", surface, 240);
    await touch("pointerup", surface, 240);
    expect(backdrop.getAttribute("data-open")).toBe("true");
    expect(backdrop.hasAttribute("data-dragging")).toBe(false);
    // Pushing it back to the left closes it.
    await touch("pointerdown", backdrop, 300);
    await touch("pointermove", backdrop, 250);
    await touch("pointermove", backdrop, 60);
    await touch("pointerup", backdrop, 60);
    expect(backdrop.getAttribute("data-open")).toBe("false");
  });
  it("opens a notification from another project in its owning project", async () => {
    await clickProject();
    await updateReply("two");
    expect(mocked.notify).toHaveBeenCalledTimes(1);
    const onOpen = mocked.notify.mock.calls[0][3];
    await act(async () => {
      onOpen({
        environmentId: "host",
        projectId: "other-project",
        sessionId: "two",
      });
    });
    expect(mocked.session).toHaveBeenCalledWith("two");
    expect(node.querySelector("header strong")?.textContent).toBe(
      "Other conversation",
    );
    expect(
      JSON.parse(localStorage.getItem("monocode.mobileActivity:host")!).entries
        .two.read,
    ).toBe(20);
  });
});
