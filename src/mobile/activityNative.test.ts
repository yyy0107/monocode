// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useMobileActivity } from "./useMobileActivity";
import type { MobileClient } from "./client";

const native = vi.hoisted(() => ({
  permission: "granted",
  unread: ["one"],
  callbacks: new Map<string, (value: any) => void>(),
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  state: vi.fn(async () => ({ environmentId: "host", unreadIds: ["one"] })),
  observe: vi.fn(async () => ({ environmentId: "host", unreadIds: ["one"] })),
  visible: vi.fn(async () => ({ environmentId: "host", unreadIds: ["one"] })),
  consume: vi.fn(async () => ({})),
}));
vi.mock("./notifications", () => ({
  nativeActivityNotifications: () => true,
  mobileNotificationPermission: async () => native.permission,
  mobileNotificationTexts: () => ({ reply: "A new reply is ready." }),
  MobileNotifications: {
    start: native.start,
    stop: native.stop,
    state: native.state,
    observe: native.observe,
    setVisible: native.visible,
    consumeOpen: native.consume,
    openSettings: vi.fn(async () => {}),
    addListener: async (event: string, callback: (value: any) => void) => {
      native.callbacks.set(event, callback);
      return {
        remove: async () => {
          native.callbacks.delete(event);
        },
      };
    },
  },
}));
let root: Root;
let node: HTMLDivElement;
let latest: ReturnType<typeof useMobileActivity>;
let client: MobileClient;
let options: Parameters<typeof useMobileActivity>[1];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  vi.clearAllMocks();
  native.callbacks.clear();
  native.permission = "granted";
  native.start.mockResolvedValue(undefined);
  client = {
    connection: {
      environmentId: "host",
      endpoint: "http://computer:3774",
      token: "test-token",
      name: "Computer",
    },
    activity: vi.fn(async () => ({ environmentId: "host", sessions: [] })),
  } as unknown as MobileClient;
  options = {
    connected: true,
    foreground: true,
    language: "en",
    onOpen: vi.fn(),
  };
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function Test() {
  latest = useMobileActivity(client, options);
  return null;
}
async function render() {
  await act(async () => {
    root.render(createElement(Test));
  });
}
describe("Android activity notification bridge", () => {
  it("starts background reception with the pinned connection and keeps it running after the WebView loses foreground", async () => {
    await render();
    expect(native.start).toHaveBeenCalledWith({
      ...client.connection,
      enabled: true,
      texts: { reply: "A new reply is ready." },
    });
    const stops = native.stop.mock.calls.length;
    options = { ...options, foreground: false };
    await render();
    expect(native.stop).toHaveBeenCalledTimes(stops);
    expect(native.visible).toHaveBeenLastCalledWith(
      expect.objectContaining({ environmentId: "host", foreground: false }),
    );
    const polls = vi.mocked(client.activity).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(client.activity).toHaveBeenCalledTimes(polls);
  });
  it("acknowledges only rendered snapshots and retains unread state when permission is denied", async () => {
    native.permission = "denied";
    await render();
    expect(latest.unreadIds.has("one")).toBe(true);
    expect(native.start).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(native.observe).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    options = { ...options, visibleSession: { id: "one", projectId: "project", revision: 20 } };
    await render();
    expect(native.visible).toHaveBeenLastCalledWith({
      environmentId: "host",
      foreground: true,
      sessionId: "one",
      revision: 20,
    });
  });
  it("routes matching notification clicks and preserves the remote service when reply alerts are disabled", async () => {
    await render();
    await act(async () => {
      native.callbacks.get("open")!({
        environmentId: "other-host",
        projectId: "project",
        sessionId: "one",
      });
      native.callbacks.get("open")!({
        environmentId: "host",
        projectId: "project",
        sessionId: "one",
      });
    });
    expect(options.onOpen).toHaveBeenCalledTimes(1);
    expect(options.onOpen).toHaveBeenCalledWith({
      environmentId: "host",
      projectId: "project",
      sessionId: "one",
    });
    const stops = native.stop.mock.calls.length;
    await act(async () => latest.setNotificationsEnabled(false));
    expect(native.stop).toHaveBeenCalledTimes(stops);
    expect(native.start).toHaveBeenLastCalledWith({
      ...client.connection,
      enabled: false,
      texts: { reply: "A new reply is ready." },
    });
    expect(localStorage.getItem("monocode.mobileNotifications")).toBe("0");
    expect(latest.unreadIds.has("one")).toBe(true);
  });
  it("starts the remote service when alerts were disabled in a previous app session and stops on disconnect", async () => {
    localStorage.setItem("monocode.mobileNotifications", "0");
    await render();
    expect(native.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, name: "Computer" }),
    );
    const stops = native.stop.mock.calls.length;
    options = { ...options, connected: false };
    await render();
    expect(native.stop).toHaveBeenCalledTimes(stops + 1);
  });
  it("does not stop an existing native service while restoring the connection or checking permission", async () => {
    native.permission = "prompt";
    options = { ...options, connected: false };
    await render();
    expect(native.stop).not.toHaveBeenCalled();
    options = { ...options, connected: true };
    await render();
    expect(native.stop).not.toHaveBeenCalled();
    expect(native.start).not.toHaveBeenCalled();
  });
  it("keeps unread state when service startup fails and reconciles background changes on resume", async () => {
    native.start.mockRejectedValue(new Error("Service denied"));
    await render();
    expect(latest.notificationError).toBe(
      "Unable to receive background conversation updates.",
    );
    await act(async () => {
      native.callbacks.get("unread")!({
        environmentId: "host",
        unreadIds: ["one", "two"],
      });
    });
    expect([...latest.unreadIds]).toEqual(["one", "two"]);
    await act(async () => {
      native.callbacks.get("unread")!({
        environmentId: "other-host",
        unreadIds: [],
      });
    });
    expect([...latest.unreadIds]).toEqual(["one", "two"]);
  });
});
