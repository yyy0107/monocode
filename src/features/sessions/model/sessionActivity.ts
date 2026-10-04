import type { Session } from "./session";

/** Stable identities for the input requests currently visible in a session. */
export function pendingSessionInputKey(
  session?: Session,
  runId?: string,
): string | null {
  if (!session) return null;
  const keys = session.blocks.flatMap((block) =>
    block.approval && !block.approval.decided
      ? [`approval:${block.approval.requestId}`]
      : [],
  );
  if (session.pendingQuestion)
    keys.push(`question:${session.pendingQuestion.requestId}`);
  return keys.length
    ? `${runId ? `${runId}:` : ""}${keys.sort().join(",")}`
    : null;
}
