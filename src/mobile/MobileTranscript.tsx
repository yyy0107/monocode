import { useMemo, useState } from "react";
import { AgentTranscript } from "../features/sessions/ui/AgentTranscript";
import { QuestionForm } from "../features/sessions/ui/QuestionForm";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import { ArrowDownCircle } from "../shared/ui/icons";
import type {
  HostSession,
  HostCommand,
} from "../features/connections/model/protocol";
import {
  mobileTranscriptPlatform,
  createMobileTranscriptPlatform,
} from "./transcriptPlatform";

/** Host snapshots feed the same message renderer used by desktop sessions. */
export function MobileTranscript({
  snapshot,
  disabled,
  onCommand,
  readBinaryFile,
}: {
  snapshot: HostSession;
  disabled: boolean;
  onCommand: (command: HostCommand) => void;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
}) {
  const platform = useMemo(
    () =>
      readBinaryFile
        ? createMobileTranscriptPlatform(readBinaryFile)
        : mobileTranscriptPlatform,
    [readBinaryFile],
  );
  const [jump, setJump] = useState<(() => void) | undefined>();
  const [showJump, setShowJump] = useState(false);
  const { session, runId } = snapshot;
  return (
    <TranscriptPlatformContext.Provider value={platform}>
      <div
        className="mobile-desktop-transcript"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        <AgentTranscript
          blocks={session.blocks}
          busy={snapshot.status === "running"}
          cwd={session.cwd}
          harness={session.harness}
          model={session.model}
          modelSettings={session.modelSettings}
          pendingQuestion={!!session.pendingQuestion}
          onJumpToBottomChange={setShowJump}
          onJumpToBottomReady={(callback) => setJump(() => callback)}
          onApproval={
            !disabled && runId
              ? (requestId, decision) =>
                  onCommand({
                    type: "approve",
                    commandId: crypto.randomUUID(),
                    sessionId: session.id,
                    runId,
                    requestId,
                    decision,
                  })
              : undefined
          }
        />
        {showJump && (
          <button
            className="mobile-jump"
            type="button"
            aria-label="Jump to latest message"
            onClick={() => jump?.()}
          >
            <ArrowDownCircle size={22} />
          </button>
        )}
      </div>
      {session.pendingQuestion && (
        <fieldset
          className="mobile-shared-question"
          disabled={disabled || !runId}
        >
          <QuestionForm
            key={`${runId}:${session.pendingQuestion.requestId}`}
            prompt={session.pendingQuestion}
            onReply={(requestId, reply) => {
              if (!disabled && runId)
                onCommand({
                  type: "answer",
                  commandId: crypto.randomUUID(),
                  sessionId: session.id,
                  runId,
                  requestId,
                  reply,
                });
            }}
          />
        </fieldset>
      )}
    </TranscriptPlatformContext.Provider>
  );
}
