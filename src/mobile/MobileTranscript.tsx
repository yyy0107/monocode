import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AgentTranscript } from "../features/sessions/ui/AgentTranscript";
import { QuestionForm } from "../features/sessions/ui/QuestionForm";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import { ArrowDownCircle } from "../shared/ui/icons";
import type { Block } from "../features/sessions/model/session";
import type { ApprovalDecision } from "../integrations/harness";
import type { EditorNavigation } from "../features/search/model/search";
import type {
  HostSession,
  HostCommand,
} from "../features/connections/model/protocol";
import {
  mobileTranscriptPlatform,
  createMobileTranscriptPlatform,
} from "./transcriptPlatform";
import { MobileToolSheet } from "./MobileToolSheet";
import { MobileFileSheet } from "./MobileFileSheet";
import { useTranscriptLayout } from "../features/sessions/hooks/useTranscriptLayout";

type Detail =
  | { kind: "tool"; block: Block }
  | { kind: "file"; path: string; line?: number; from?: Block };

/** Host snapshots feed the same message renderer used by desktop sessions.
 * Memoized: typing in the composer re-renders the app, and the transcript
 * only needs to follow its snapshot. */
export const MobileTranscript = memo(function MobileTranscript({
  snapshot,
  disabled,
  onCommand,
  readBinaryFile,
  animateFrom,
}: {
  snapshot: HostSession;
  disabled: boolean;
  onCommand: (command: HostCommand) => void;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
  animateFrom?: string;
}) {
  const [detail, setDetail] = useState<Detail>();
  const layout = useTranscriptLayout();
  // Sheets portal to the app root: as a sibling of the composer dock they
  // would pick up the dock spacing rules and stop short of the screen bottom.
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);
  const findSheetHost = useCallback(
    (element: HTMLElement | null) =>
      setSheetHost(element?.closest<HTMLElement>(".mobile-app") ?? null),
    [],
  );
  const platform = useMemo(
    () => ({
      ...(readBinaryFile
        ? createMobileTranscriptPlatform(readBinaryFile)
        : mobileTranscriptPlatform),
      openTool: (block: Block) => setDetail({ kind: "tool", block }),
    }),
    [readBinaryFile],
  );
  // Phones have no editor pane, so file links open a read-only sheet.
  const openFile = useCallback(
    (path: string, navigation?: EditorNavigation) =>
      setDetail((current) => ({
        kind: "file",
        path,
        line: navigation?.line,
        from: current?.kind === "tool" ? current.block : undefined,
      })),
    [],
  );
  const [jump, setJump] = useState<(() => void) | undefined>();
  const [showJump, setShowJump] = useState(false);
  const onJumpReady = useCallback(
    (callback: () => void) => setJump(() => callback),
    [],
  );
  const { session, runId } = snapshot;
  const sessionId = session.id;
  // Memoized transcript blocks compare this callback; a fresh one on every
  // poll would re-render each block while a reply streams.
  const onApproval = useMemo(
    () =>
      !disabled && runId
        ? (requestId: number, decision: ApprovalDecision) =>
            onCommand({
              type: "approve",
              commandId: crypto.randomUUID(),
              sessionId,
              runId,
              requestId,
              decision,
            })
        : undefined,
    [disabled, runId, sessionId, onCommand],
  );
  return (
    <TranscriptPlatformContext.Provider value={platform}>
      <div
        ref={findSheetHost}
        className="mobile-desktop-transcript"
        data-layout={layout}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        <AgentTranscript
          touchScroll
          promptMotion="mobile"
          animateFrom={animateFrom}
          blocks={session.blocks}
          busy={snapshot.status === "running"}
          cwd={session.cwd}
          harness={session.harness}
          model={session.model}
          modelSettings={session.modelSettings}
          pendingQuestion={!!session.pendingQuestion}
          onOpenFile={readBinaryFile ? openFile : undefined}
          onOpenDiff={readBinaryFile ? openFile : undefined}
          onJumpToBottomChange={setShowJump}
          onJumpToBottomReady={onJumpReady}
          onApproval={onApproval}
        />
        {showJump && (
          <button
            className="mobile-jump"
            type="button"
            aria-label="Jump to latest message"
            // Keep focus in the composer so tapping does not collapse it first.
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              jump?.();
            }}
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
      {sheetHost &&
        createPortal(
          <>
            {detail?.kind === "tool" && (
              <MobileToolSheet
                // Follow the live block so a running call fills in while open.
                block={
                  session.blocks.find(
                    (block) => block.id === detail.block.id,
                  ) ?? detail.block
                }
                cwd={session.cwd}
                onOpenFile={readBinaryFile ? openFile : undefined}
                onClose={() => setDetail(undefined)}
              />
            )}
            {detail?.kind === "file" && readBinaryFile && (
              <MobileFileSheet
                path={detail.path}
                line={detail.line}
                cwd={session.cwd}
                readBinaryFile={readBinaryFile}
                onOpenFile={openFile}
                onBack={
                  detail.from
                    ? () => setDetail({ kind: "tool", block: detail.from! })
                    : undefined
                }
                onClose={() => setDetail(undefined)}
              />
            )}
          </>,
          sheetHost,
        )}
    </TranscriptPlatformContext.Provider>
  );
});
