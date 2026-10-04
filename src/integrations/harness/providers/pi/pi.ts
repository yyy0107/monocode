import { isTauri } from "@tauri-apps/api/core";
import { saveGeneratedImage, deleteGeneratedImages } from "../../../../platform/tauri/fs";
import {
  bindSession,
  cancelTurn,
  compactContext,
  forgetSession,
  respondApproval,
  respondQuestion,
  rewindLastTurn,
  sendTurn,
  setPiBinaryResolver as setFlavorBinaryResolver,
  steerTurn,
  stopSession,
} from "./piFamily";
import { PI_FLAVOR } from "./piFlavor";
import type { UserQuestionReply } from "../../../../features/sessions/model/userQuestion";
import type {
  ApprovalDecision,
  CompactContextInput,
  RewindLastTurnInput,
  RewindLastTurnResult,
  SendTurnInput,
  SteerTurnInput,
} from "../../core/types";

/**
 * Live Pi adapter. Spawns `pi --mode rpc` with the user's config and extensions
 * loaded (no `--no-extensions`). Todos/subagents packages in `~/.pi/agent`
 * keep working; TUI-only widgets do not appear in MonoCode.
 */
export function sendPiTurn(input: SendTurnInput): Promise<void> {
  return sendTurn(PI_FLAVOR, input, typeof isTauri === "function" && isTauri() ? async image => {
    const asset = await saveGeneratedImage({ data: image.data, name: image.name });
    return { event: { type: "image.generated", itemId: image.itemId,
      path: asset.path, name: image.name, mimeType: asset.mimeType, size: asset.size },
      discard: () => deleteGeneratedImages([asset.path]),
    };
  } : undefined);
}

export function compactPiContext(input: CompactContextInput): Promise<void> {
  return compactContext(PI_FLAVOR, input);
}

export function rewindPiLastTurn(
  input: RewindLastTurnInput,
): Promise<RewindLastTurnResult> {
  return rewindLastTurn(PI_FLAVOR, input);
}

export function steerPiTurn(input: SteerTurnInput): Promise<void> {
  return steerTurn(PI_FLAVOR, input);
}

export function respondPiApproval(
  sessionId: string,
  requestId: number,
  decision: ApprovalDecision,
): void {
  respondApproval(PI_FLAVOR, sessionId, requestId, decision);
}

export function respondPiQuestion(sessionId: string, requestId: number, reply: UserQuestionReply): void {
  respondQuestion(PI_FLAVOR, sessionId, requestId, reply);
}

export function cancelPiTurn(sessionId: string): Promise<void> {
  return cancelTurn(PI_FLAVOR, sessionId);
}

export function stopPiSession(sessionId: string): Promise<void> {
  return stopSession(PI_FLAVOR, sessionId);
}

export function forgetPiSession(sessionId: string): Promise<void> {
  return forgetSession(PI_FLAVOR, sessionId);
}

export function bindPiSession(
  threadId: string,
  providerSessionId: string,
  cwd: string,
): void {
  bindSession(PI_FLAVOR, threadId, providerSessionId, cwd);
}

/** Test seam. */
export function setPiBinaryResolver(fn: () => Promise<{ path: string }>): void {
  setFlavorBinaryResolver(PI_FLAVOR, fn);
}
