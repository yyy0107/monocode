import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import type { Connection } from "./client";
import { translate } from "../shared/i18n/language";

export type MobileNotificationPermission =
  "prompt" | "granted" | "denied" | "unsupported";
export type MobileNotificationTarget = {
  environmentId: string;
  projectId: string;
  sessionId: string;
};
type ActivityResult = { environmentId: string; unreadIds: string[] };
export interface MobileNotificationsPlugin {
  checkPermissions(): Promise<{ display: MobileNotificationPermission }>;
  requestPermissions(): Promise<{ display: MobileNotificationPermission }>;
  openSettings(): Promise<void>;
  start(options: Connection & {
    enabled?: boolean;
    texts: Record<string, string>;
  }): Promise<void>;
  stop(): Promise<void>;
  observe(options: {
    environmentId: string;
    sessions: readonly HostSessionSummary[];
    enabled: boolean;
  }): Promise<ActivityResult>;
  setVisible(options: {
    environmentId: string;
    sessionId?: string;
    revision?: number;
    foreground: boolean;
    lastCompletedRunId?: string | null;
    pendingInputKey?: string | null;
  }): Promise<ActivityResult>;
  state(options: { environmentId: string }): Promise<ActivityResult>;
  consumeOpen(): Promise<{ target?: MobileNotificationTarget }>;
  addListener(
    event: "unread",
    callback: (result: ActivityResult) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "open",
    callback: (target: MobileNotificationTarget) => void,
  ): Promise<PluginListenerHandle>;
}
export const MobileNotifications = registerPlugin<MobileNotificationsPlugin>(
  "MonoCodeNotifications",
);
export const nativeActivityNotifications = () =>
  Capacitor.getPlatform() === "android";

export function mobileNotificationTexts(host = ""): Record<string, string> {
  return {
    channel: translate("Conversation notifications"),
    reply: translate("A new reply is ready."),
    input: translate("This conversation needs your input."),
    remoteChannel: translate("Remote connection"),
    remote: translate("Remote"),
    connected: translate("Connected to {host}", { host }),
    reconnecting: translate("Reconnecting to {host}", { host }),
  };
}
export async function mobileNotificationPermission(
  request = false,
): Promise<MobileNotificationPermission> {
  try {
    if (nativeActivityNotifications())
      return (
        await (request
          ? MobileNotifications.requestPermissions()
          : MobileNotifications.checkPermissions())
      ).display;
    if (Capacitor.isNativePlatform() || typeof Notification === "undefined")
      return "unsupported";
    const permission = request
      ? await Notification.requestPermission()
      : Notification.permission;
    return permission === "default" ? "prompt" : permission;
  } catch {
    return "unsupported";
  }
}
export function showBrowserActivityNotification(
  session: HostSessionSummary,
  kind: "reply" | "input",
  environmentId: string,
  onOpen: (target: MobileNotificationTarget) => void,
): void {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  try {
    const notification = new Notification(session.title || "MonoCode", {
      body: mobileNotificationTexts()[kind],
      tag: `${environmentId}:${session.id}`,
    });
    notification.onclick = () => {
      onOpen({
        environmentId,
        projectId: session.projectId,
        sessionId: session.id,
      });
      notification.close();
    };
  } catch {
    /* A denied or unavailable banner never loses unread state. */
  }
}
