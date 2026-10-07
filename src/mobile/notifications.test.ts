// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
import { mobileNotificationTexts, showBrowserActivityNotification, showBrowserAssistantNotification } from "./notifications";

afterEach(() => {
  setUiLanguage("en");
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("updates native Remote status when language changes and preserves the computer name", () => {
  const host = "wy-ubuntu <工作站> {host}";
  setUiLanguage("en");
  expect(mobileNotificationTexts(host).connected).toBe(`Connected to ${host}`);
  setUiLanguage("zh-CN");
  const texts = mobileNotificationTexts(host);
  expect(texts.remote).toBe("Remote");
  expect(texts.connected).toBe(`已连接到 ${host}`);
  expect(texts.reconnecting).toBe(`正在重新连接到 ${host}`);
  expect(texts.reply).toBe("收到了一条新回复。");
});

function browserNotification() {
  const close = vi.fn();
  const banner = { onclick: undefined as (() => void) | undefined, close };
  const notification = vi.fn(function (_title: string, _options?: NotificationOptions) { return banner; });
  Object.assign(notification, { permission: "granted" });
  vi.stubGlobal("Notification", notification);
  return { notification, banner, close };
}

function session(): HostSessionSummary {
  return {
    id: "conversation",
    projectId: "project",
    title: "登录修复 <用户标题>",
    harness: "codex",
    status: "idle",
    revision: 10,
    updatedAt: 100,
    notificationPreview: { reply: "Login now works.", input: "Which environment should I deploy to?" },
  };
}

it("uses each conversation's latest reply and keeps click navigation tied to that conversation", () => {
  const { notification, banner, close } = browserNotification();
  const current = session();
  const open = vi.fn();
  setUiLanguage("zh-CN");
  showBrowserActivityNotification(current, "reply", "host", open);
  expect(notification).toHaveBeenLastCalledWith(current.title, {
    body: "Login now works.", tag: "host:conversation",
  });
  banner.onclick?.();
  expect(open).toHaveBeenCalledWith({ environmentId: "host", projectId: "project", sessionId: "conversation" });
  expect(close).toHaveBeenCalledOnce();
  showBrowserActivityNotification({ ...current, id: "other", title: "Another task", notificationPreview: { reply: "Deployment completed.", input: null } }, "reply", "host", open);
  expect(notification).toHaveBeenLastCalledWith("Another task", {
    body: "Deployment completed.", tag: "host:other",
  });
});

it("shows the concrete input request and falls back for older Hosts without showing an unrelated reply", () => {
  const { notification } = browserNotification();
  const current = session();
  showBrowserActivityNotification(current, "input", "host", vi.fn());
  expect(notification).toHaveBeenLastCalledWith(current.title, {
    body: "Which environment should I deploy to?", tag: "host:conversation",
  });
  setUiLanguage("zh-CN");
  current.notificationPreview!.input = "  ";
  showBrowserActivityNotification(current, "input", "host", vi.fn());
  expect(notification.mock.calls.at(-1)?.[1]).toMatchObject({ body: mobileNotificationTexts().input });
  delete current.notificationPreview;
  showBrowserActivityNotification(current, "reply", "host", vi.fn());
  expect(notification.mock.calls.at(-1)?.[1]).toMatchObject({ body: "收到了一条新回复。" });
});

it("opens the assistant from its browser notification and localizes attachment-only replies", () => {
  const { notification, banner } = browserNotification();
  const open = vi.fn();
  setUiLanguage("zh-CN");
  showBrowserAssistantNotification({ id: "assistant", name: "小管家", revision: 2,
    latest: { id: "reply", revision: 2, kind: "reply", text: "" } }, "host", open);
  expect(notification).toHaveBeenCalledWith("小管家", { body: "收到了一条新回复。", tag: "host:assistant" });
  banner.onclick?.();
  expect(open).toHaveBeenCalledWith({ environmentId: "host", kind: "assistant" });
});
