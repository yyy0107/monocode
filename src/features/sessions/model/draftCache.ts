/**
 * In-memory composer drafts, keyed by session id.
 *
 * SessionPane keeps the text you are typing in a React ref so retyping while
 * the pane stays mounted does not re-render on every keystroke. A plain ref
 * only lives as long as that one component instance though: closing a
 * session's pane (or moving it to another split) unmounts SessionPane, and
 * the ref - and whatever you had typed - is gone with no warning the moment
 * it remounts.
 *
 * This module-level map survives that, because it lives outside the React
 * tree for as long as the app process is running: the draft comes back when
 * the pane for that session opens again.
 *
 * It does not survive an app restart or a full reload - that needs the
 * draft written into the session's persisted record on disk, which is a
 * separate, larger change (touches the Rust-side session_upsert schema
 * too).
 */
import type { McpTag } from "./mcpPicker";

const drafts = new Map<string, string>();
const mcpTags = new Map<string, McpTag[]>();
const attachmentCounts = new Map<string, number>();
const attachmentReads = new Map<string, number>();

/** Metadata only: the mounted Composer still owns attachments and their URLs. */
export function setComposerAttachmentCount(
  sessionId: string,
  count: number,
): void {
  if (count > 0) attachmentCounts.set(sessionId, count);
  else attachmentCounts.delete(sessionId);
}

/** Register before yielding to a file read, including reads that later fail. */
export function beginComposerAttachmentRead(sessionId: string): () => void {
  attachmentReads.set(sessionId, (attachmentReads.get(sessionId) ?? 0) + 1);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    const remaining = (attachmentReads.get(sessionId) ?? 1) - 1;
    if (remaining > 0) attachmentReads.set(sessionId, remaining);
    else attachmentReads.delete(sessionId);
  };
}

export function hasComposerDraftContent(sessionId: string): boolean {
  return !!(
    drafts.get(sessionId)?.length ||
    mcpTags.get(sessionId)?.length ||
    attachmentCounts.get(sessionId) ||
    attachmentReads.get(sessionId)
  );
}

export function getComposerDraft(sessionId: string): string | undefined {
  return drafts.get(sessionId);
}

export function setComposerDraft(sessionId: string, text: string): void {
  if (text) {
    drafts.set(sessionId, text);
  } else {
    drafts.delete(sessionId);
    mcpTags.delete(sessionId);
  }
}

export function getComposerMcpTags(sessionId: string): McpTag[] {
  return mcpTags.get(sessionId) ?? [];
}

export function setComposerMcpTags(sessionId: string, tags: McpTag[]): void {
  if (tags.length > 0) {
    mcpTags.set(sessionId, tags);
  } else {
    mcpTags.delete(sessionId);
  }
}

export function clearComposerDraft(sessionId: string): void {
  drafts.delete(sessionId);
  mcpTags.delete(sessionId);
  attachmentCounts.delete(sessionId);
  attachmentReads.delete(sessionId);
}
