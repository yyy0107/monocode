import type { HostSession } from "../../src/features/connections/model/protocol";
import { titleFromPrompt } from "../../src/features/sessions/model/session";
import { sanitizeTitleState } from "../../src/features/sessions/model/titlePolicy";
import { NATIVE_PENDING_TITLE } from "../../src/integrations/harness/core/nativeReconcile";

/**
 * Rewrites a native link saved by an older desktop or Host into the current
 * managed shape, once, so sync never needs per-read fallbacks:
 * - `mode` absent: the Host takes the conversation over and re-reads it;
 * - `nativeIds` absent: older links tracked native record IDs in `blockIds`;
 * - `storage` absent: links from before multi-provider sync were all JSONL;
 * - no title state with the prompt title: a pre-title-state import still
 *   waits for the agent's own title.
 * Returns undefined when the value is already current.
 */
export function migrateNativeLink(value: HostSession, now = Date.now()): HostSession | undefined {
  const link = value.session.nativeSession;
  if (!link || (link.mode === "managed" && link.nativeIds && link.storage)) return undefined;
  const legacy = link.mode !== "managed";
  let session = {
    ...value.session,
    nativeSession: {
      ...link,
      mode: "managed" as const,
      nativeIds: link.nativeIds ?? [...link.blockIds],
      storage: link.storage ?? ("jsonl" as const),
    },
  };
  const prompt = session.blocks.find((block) => block.role === "user")?.text;
  if (legacy && !sanitizeTitleState(session.titleState) && prompt !== undefined && session.title === titleFromPrompt(prompt, session.harness))
    session = { ...session, titleState: NATIVE_PENDING_TITLE };
  return {
    ...value,
    session,
    // The source may have moved on since the old client's last read.
    nativeStatus: legacy
      ? { state: "syncing", revision: link.revision, pendingChange: true, checkedAt: now }
      : value.nativeStatus,
  };
}
