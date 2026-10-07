import type { Session } from "./session";

export type SessionNotificationPreview = {
  reply: string | null;
  input: string | null;
};

/** Bounded transcript excerpts for clients that only receive session summaries. */
export function sessionNotificationPreview(
  session: Session,
): SessionNotificationPreview {
  const blocks = [...session.blocks].reverse();
  const reply = blocks.find(
    (block) =>
      !block.internal &&
      (block.role === "assistant" || block.role === "plan" || !!block.notice) &&
      !!block.text.trim(),
  );
  const approval = blocks.find(
    (block) => !block.internal && block.approval && !block.approval.decided,
  );
  const question = session.pendingQuestion;
  return {
    reply: notificationExcerpt(reply?.text),
    input:
      notificationExcerpt(
        question?.questions.map((item) => item.prompt).join("\n\n"),
      ) ||
      notificationExcerpt(question?.title) ||
      notificationExcerpt(approval?.tool?.title) ||
      notificationExcerpt(approval?.text),
  };
}

function notificationExcerpt(text?: string): string | null {
  const paragraph = text
    ?.trim()
    .split(/\n\s*\n/, 1)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (!paragraph) return null;
  const characters = Array.from(paragraph);
  return characters.length > 240
    ? `${characters.slice(0, 239).join("")}…`
    : paragraph;
}

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
