import { useEffect, useRef, useState } from "react";
import type { MobileClient } from "./client";
import {
  loadMobileActivity,
  saveMobileActivity,
  type MobileActivity,
} from "./activity";
import {
  MobileNotifications,
  mobileNotificationPermission,
  mobileNotificationTexts,
  nativeActivityNotifications,
  showBrowserActivityNotification,
  type MobileNotificationPermission,
  type MobileNotificationTarget,
} from "./notifications";
import { translate } from "../shared/i18n/language";

const ENABLED_KEY = "monocode.mobileNotifications";
export function useMobileActivity(
  client: MobileClient,
  options: {
    connected: boolean;
    foreground: boolean;
    visibleSession?: {
      id: string;
      revision: number;
      lastCompletedRunId?: string | null;
      pendingInputKey?: string | null;
    };
    language: string;
    onOpen: (target: MobileNotificationTarget) => void | Promise<void>;
  },
) {
  const { connected, foreground, visibleSession, language } = options;
  const environmentId = connected
    ? client.connection?.environmentId
    : undefined;
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(ENABLED_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [permission, setPermission] =
    useState<MobileNotificationPermission>("prompt");
  const [notificationError, setNotificationError] = useState("");
  const hadConnection = useRef(false);
  const activity = useRef<MobileActivity | undefined>(undefined);
  const current = useRef({ ...options, environmentId, enabled, permission });
  current.current = { ...options, environmentId, enabled, permission };
  const onOpen = (target: MobileNotificationTarget) => {
    if (target.environmentId !== current.current.environmentId) return;
    void Promise.resolve(current.current.onOpen(target)).catch(() => {});
  };

  useEffect(() => {
    if (!environmentId) {
      setUnreadIds(new Set());
      return;
    }
    let live = true;
    activity.current = loadMobileActivity(environmentId);
    setUnreadIds(
      new Set(
        nativeActivityNotifications()
          ? activity.current.manualUnreadIds()
          : activity.current.unreadIds(),
      ),
    );
    if (!nativeActivityNotifications()) {
      return;
    }
    const apply = (result: { environmentId: string; unreadIds: string[] }) => {
      if (
        live &&
        result.environmentId === environmentId &&
        current.current.environmentId === environmentId
      )
        setUnreadIds(
          new Set([
            ...result.unreadIds,
            ...(activity.current?.manualUnreadIds() ?? []),
          ]),
        );
    };
    const unreadListener = MobileNotifications.addListener("unread", apply);
    const openListener = MobileNotifications.addListener("open", onOpen);
    void (async () => {
      await openListener;
      apply(await MobileNotifications.state({ environmentId }));
      const pending = await MobileNotifications.consumeOpen();
      if (live && pending.target) onOpen(pending.target);
    })().catch(() => {});
    return () => {
      live = false;
      void unreadListener.then((handle) => handle.remove()).catch(() => {});
      void openListener.then((handle) => handle.remove()).catch(() => {});
    };
  }, [environmentId]);

  useEffect(() => {
    if (!foreground) return;
    let live = true;
    void (async () => {
      let next = await mobileNotificationPermission();
      if (
        next === "prompt" &&
        connected &&
        nativeActivityNotifications()
      )
        next = await mobileNotificationPermission(true);
      if (live) setPermission(next);
    })();
    return () => {
      live = false;
    };
  }, [connected, enabled, foreground]);

  useEffect(() => {
    if (!nativeActivityNotifications()) return;
    // Initial restoration and permission checks may run while a native service
    // from the previous activity is still receiving updates.
    if (!connected) {
      if (hadConnection.current) void MobileNotifications.stop().catch(() => {});
      hadConnection.current = false;
      return;
    }
    hadConnection.current = true;
    if (permission === "denied" || permission === "unsupported") {
      void MobileNotifications.stop().catch(() => {});
    } else if (permission === "granted" && foreground && client.connection) {
      void MobileNotifications.start({
        ...client.connection,
        enabled,
        texts: mobileNotificationTexts(client.connection.name),
      })
        .then(() => setNotificationError(""))
        .catch(() =>
          setNotificationError(
            translate("Unable to receive background conversation updates."),
          ),
        );
    }
  }, [
    connected,
    environmentId,
    enabled,
    permission,
    foreground,
    language,
    client,
    client.connection,
  ]);

  useEffect(() => {
    if (!environmentId) return;
    let live = true;
    if (foreground && visibleSession && activity.current) {
      activity.current.markRead(visibleSession.id, visibleSession.revision, {
        finished: visibleSession.lastCompletedRunId,
        input: visibleSession.pendingInputKey,
      });
      saveMobileActivity(environmentId, activity.current);
    }
    if (nativeActivityNotifications()) {
      void MobileNotifications.setVisible({
        environmentId,
        foreground,
        sessionId: visibleSession?.id,
        revision: visibleSession?.revision,
        ...(visibleSession?.lastCompletedRunId !== undefined
          ? { lastCompletedRunId: visibleSession.lastCompletedRunId }
          : {}),
        ...(visibleSession?.pendingInputKey !== undefined
          ? { pendingInputKey: visibleSession.pendingInputKey }
          : {}),
      })
        .then((result) => {
          if (live)
            setUnreadIds(
              new Set([
                ...result.unreadIds,
                ...(activity.current?.manualUnreadIds() ?? []),
              ]),
            );
        })
        .catch(() => {});
    } else if (foreground && visibleSession && activity.current) {
      setUnreadIds(new Set(activity.current.unreadIds()));
    }
    return () => {
      live = false;
    };
  }, [
    environmentId,
    foreground,
    visibleSession?.id,
    visibleSession?.revision,
    visibleSession?.lastCompletedRunId,
    visibleSession?.pendingInputKey,
  ]);

  useEffect(() => {
    if (!environmentId || !foreground) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      try {
        const result = await client.activity();
        if (!live || result.environmentId !== environmentId) return;
        if (nativeActivityNotifications()) {
          activity.current?.observe(
            result.sessions,
            current.current.visibleSession?.id,
          );
          if (activity.current) saveMobileActivity(environmentId, activity.current);
          const state = await MobileNotifications.observe({
            environmentId,
            sessions: result.sessions,
            enabled:
              current.current.enabled &&
              current.current.permission === "granted",
          });
          if (live)
            setUnreadIds(
              new Set([
                ...state.unreadIds,
                ...(activity.current?.manualUnreadIds() ?? []),
              ]),
            );
        } else if (activity.current) {
          const notices = activity.current.observe(
            result.sessions,
            current.current.visibleSession?.id,
          );
          const visible = current.current.visibleSession;
          if (visible)
            activity.current.markRead(visible.id, visible.revision, {
              finished: visible.lastCompletedRunId,
              input: visible.pendingInputKey,
            });
          saveMobileActivity(environmentId, activity.current);
          if (live) setUnreadIds(new Set(activity.current.unreadIds()));
          if (
            current.current.enabled &&
            current.current.permission === "granted"
          )
            for (const notice of notices)
              showBrowserActivityNotification(
                notice.session,
                notice.kind,
                environmentId,
                onOpen,
              );
        }
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 4);
      } finally {
        if (live)
          timer = setTimeout(
            poll,
            failures ? Math.min(60_000, 3_000 * 2 ** failures) : 3_000,
          );
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [environmentId, foreground, client]);

  const setNotificationsEnabled = async (next: boolean) => {
    try {
      localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    } catch {
      /* Runtime preference remains effective. */
    }
    setEnabled(next);
    if (next) setPermission(await mobileNotificationPermission(true));
  };
  const requestPermission = async () =>
    setPermission(await mobileNotificationPermission(true));
  const openSettings = () => MobileNotifications.openSettings().catch(() => {});
  const markUnread = (id: string, revision: number) => {
    if (!environmentId || !activity.current) return;
    activity.current.markUnread(id, revision);
    saveMobileActivity(environmentId, activity.current);
    setUnreadIds((ids) => new Set([...ids, id]));
  };
  return {
    unreadIds,
    markUnread,
    enabled,
    permission,
    notificationError,
    setNotificationsEnabled,
    requestPermission,
    openSettings,
    canOpenSettings: nativeActivityNotifications(),
  };
}
