import { useEffect, useReducer, useState } from "react";
import { remoteRequest } from "../../connections/model/connections";
import {
  REMOTE_PROVIDERS,
  type HostDescriptor,
} from "../../connections/model/protocol";
import { AssistantClient } from "../model/assistantClient";
import type { AssistantMessage } from "../model/assistant";
import {
  subscribeAssistantRead,
  unreadAssistantMessages,
} from "../model/assistantUnread";
import { useDesktopAssistantHosts } from "../model/useDesktopAssistantHosts";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Bot } from "../../../shared/ui/icons";

export function DesktopAssistantButton({
  active,
  onOpen,
}: {
  active: boolean;
  onOpen: (machineId?: string) => void;
}) {
  const { t } = useTranslation();
  const hosts = useDesktopAssistantHosts();
  const targets = JSON.stringify(
    hosts.map(({ id, environmentId }) => ({ id, environmentId })),
  );
  const [messages, setMessages] = useState<Record<string, AssistantMessage[]>>(
    {},
  );
  const [, refreshRead] = useReducer((value: number) => value + 1, 0);
  useEffect(() => subscribeAssistantRead(refreshRead), []);
  useEffect(() => {
    let disposed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const machines: { id: string; environmentId: string }[] =
      JSON.parse(targets);
    for (const machine of machines) {
      const client = new AssistantClient(
        machine.environmentId,
        (method, params) => remoteRequest(machine.id, method, params),
      );
      let supported: boolean | undefined;
      const refresh = async () => {
        let delay = 2000;
        try {
          if (supported === undefined) {
            const descriptor = await remoteRequest<HostDescriptor>(
              machine.id,
              "environment.describe",
              {
                supportedProviders: REMOTE_PROVIDERS,
              },
            );
            supported =
              descriptor.capabilities?.includes("assistant.v1") ?? false;
          }
          if (disposed || !supported) return;
          const next = await client.sync();
          if (!disposed)
            setMessages((current) => ({
              ...current,
              [machine.environmentId]: next.messages,
            }));
        } catch {
          // Keep unread messages through a disconnect and back off before retrying.
          delay = 30000;
        } finally {
          if (!disposed && supported !== false) {
            const timer = setTimeout(() => {
              timers.delete(timer);
              void refresh();
            }, delay);
            timers.add(timer);
          }
        }
      };
      void refresh();
    }
    return () => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [targets]);
  const unread = hosts
    .flatMap((host) =>
      unreadAssistantMessages(
        host.environmentId,
        messages[host.environmentId] ?? [],
      ).map((message) => ({ machineId: host.id, message })),
    )
    .sort(
      (a, b) =>
        a.message.createdAt - b.message.createdAt ||
        a.message.revision - b.message.revision,
    );
  const latest = unread[unread.length - 1];
  const preview =
    latest && "text" in latest.message
      ? latest.message.text.replace(/\s+/g, " ").trim().slice(0, 120)
      : "";
  const label = unread.length
    ? t("Assistant, {count} unread messages", { count: unread.length })
    : t("Assistant");
  return (
    <button
      type="button"
      data-open-assistant
      data-tauri-drag-region="false"
      aria-label={label}
      aria-pressed={active}
      title={preview ? `${label}: ${preview}` : label}
      onClick={() => onOpen(latest?.machineId)}
      className={`mx-1 flex h-7 min-w-0 max-w-sm items-center gap-1.5 rounded-lg px-2 text-ui-sm transition-colors ${active ? "bg-selection text-content" : "text-foreground-subtle hover:bg-surface-hover hover:text-content"}`}
    >
      <Bot className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{preview || t("Assistant")}</span>
      {latest ? (
        <span
          aria-hidden
          className="shrink-0 rounded-full bg-brand px-1.5 text-xs text-brand-foreground"
        >
          {unread.length > 99 ? "99+" : unread.length}
        </span>
      ) : null}
    </button>
  );
}
