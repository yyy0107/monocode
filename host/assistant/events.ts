import type { HostSession } from "../../src/features/connections/model/protocol";
import { pendingSessionInputKey } from "../../src/features/sessions/model/sessionActivity";
import type { Source } from "./store";
export function importantSources(
  previous: HostSession | undefined,
  next: HostSession,
): Source[] {
  if (next.session.assistantOwnerId) return [];
  const root =
    [...next.session.blocks].reverse().find((b) => b.role === "user")?.origin
      ?.wakeupId ??
    `session:${next.session.id}:${next.runId ?? next.lastCompletedRunId ?? next.revision}`;
  const base = {
    sessionId: next.session.id,
    projectId: next.projectId,
    rootCauseId: root,
    createdAt: Date.now(),
  };
  const sources: Source[] = [];
  if (
    next.lastCompletedRunId &&
    next.lastCompletedRunId !== previous?.lastCompletedRunId
  ) {
    const turn = next.session.blocks.slice(
      next.session.blocks.map((b) => b.role).lastIndexOf("user") + 1,
    );
    const failed =
      !!next.session.usageLimit || turn.some((b) => b.notice === "error");
    sources.push({
      ...base,
      kind: failed ? "failed" : "completed",
      eventKey: `${next.session.id}:done:${next.lastCompletedRunId}`,
    });
  }
  const input = pendingSessionInputKey(next.session, next.runId);
  if (
    input &&
    input !== pendingSessionInputKey(previous?.session, previous?.runId)
  )
    sources.push({
      ...base,
      kind: next.session.pendingQuestion ? "question" : "approval",
      eventKey: `${next.session.id}:input:${input}`,
    });
  if (next.status === "interrupted" && previous?.status !== "interrupted")
    sources.push({
      ...base,
      kind: "interrupted",
      eventKey: `${next.session.id}:interrupted:${next.runId ?? next.revision}`,
    });
  return sources;
}
