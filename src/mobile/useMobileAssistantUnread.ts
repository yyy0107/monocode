import { useEffect, useReducer, useState } from "react";
import type { AssistantMessage } from "../features/assistant/model/assistant";
import { AssistantClient, type AssistantRpc } from "../features/assistant/model/assistantClient";
import {
  subscribeAssistantRead,
  unreadAssistantMessages,
} from "../features/assistant/model/assistantUnread";

/** Refresh the drawer's count without marking messages as read. */
export function useMobileAssistantUnread(
  hostKey: string | undefined,
  rpc: AssistantRpc,
  active: boolean,
) {
  const [state, setState] = useState<{ hostKey: string; messages: AssistantMessage[] }>();
  const [, refreshRead] = useReducer((value: number) => value + 1, 0);
  useEffect(() => subscribeAssistantRead(refreshRead), []);
  useEffect(() => {
    if (!hostKey || !active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const client = new AssistantClient(hostKey, async <T,>(method: string, params?: object) => {
      // A sync can fetch several pages. Never continue it on a different Host
      // after the drawer closes or the selected connection changes.
      if (disposed) throw new Error("Assistant sync cancelled");
      const result = await rpc<T>(method, params);
      if (disposed) throw new Error("Assistant sync cancelled");
      return result;
    });
    const refresh = async () => {
      let delay = 2000;
      try {
        const next = await client.sync();
        if (!disposed) setState({ hostKey, messages: next.messages });
      } catch {
        // Retain the last count through transient connection failures.
        delay = 30000;
      } finally {
        if (!disposed) timer = setTimeout(refresh, delay);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [hostKey, rpc, active]);
  return hostKey && state?.hostKey === hostKey
    ? unreadAssistantMessages(hostKey, state.messages).length
    : 0;
}
