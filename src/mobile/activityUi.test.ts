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
  session: vi.fn(),
  status: { state: "connected" as const },
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
  nativeActivityNotifications: () => false,
  MobileNotifications: {},
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
  mocked.notify.mockClear();
  mocked.summaries = [summary(), summary("two", "other-project")];
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
async function clickProject() {
  await act(async () => {
    root.render(createElement(MobileApp));
  });
  const button = [...node.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.querySelector("strong")?.textContent === "Project",
  )!;
  await act(async () => button.click());
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
    await act(async () => {
      node
        .querySelector<HTMLButtonElement>('button[aria-label="Back"]')!
        .click();
    });
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
    await act(async () => {
      node
        .querySelector<HTMLButtonElement>('button[aria-label="Back"]')!
        .click();
    });
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
