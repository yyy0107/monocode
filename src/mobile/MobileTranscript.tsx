import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AgentTranscript } from "../features/sessions/ui/AgentTranscript";
import { QuestionForm } from "../features/sessions/ui/QuestionForm";
import { questionFollowUp } from "../features/sessions/model/questionHistory";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import { ArrowDownCircle } from "../shared/ui/icons";
import type { Block } from "../features/sessions/model/session";
import { isToolBlock, toolCallState } from "../features/sessions/model/transcriptActivity";
import type { QuestionAnswer } from "../features/sessions/model/userQuestion";
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
import { MobileActivitySheet } from "./MobileActivitySheet";
import { MobileFileSheet } from "./MobileFileSheet";
import { useTranscriptLayout } from "../features/sessions/hooks/useTranscriptLayout";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { useStableCallback } from "./useStableCallback";

type Detail =
  | { kind: "activity"; steps: Block[] }
  | { kind: "tool"; block: Block; fromActivity?: Block[] }
  | { kind: "file"; path: string; line?: number; from?: Block };
type Details = {
  active?: Detail["kind"];
  activity?: Extract<Detail, { kind: "activity" }>;
  tool?: Extract<Detail, { kind: "tool" }>;
  file?: Extract<Detail, { kind: "file" }>;
};

/** Host snapshots feed the same message renderer used by desktop sessions.
 * Memoized: typing in the composer re-renders the app, and the transcript
 * only needs to follow its snapshot. */
export const MobileTranscript = memo(function MobileTranscript({
  snapshot,
  disabled,
  onCommand,
  readBinaryFile,
  animateFrom,
  active = true,
}: {
  snapshot: HostSession;
  disabled: boolean;
  onCommand: (command: HostCommand) => void | Promise<boolean>;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
  animateFrom?: string;
  active?: boolean;
}) {
  const parentVisible = useSurfaceVisibility();
  const visible = active && parentVisible;
  const [detail, setDetail] = useState<Details>({});
  useEffect(() => {
    if (!visible) setDetail({});
  }, [visible]);
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
      openTool: (block: Block) => setDetail((current) => ({
        ...current, active: "tool", tool: { kind: "tool", block },
      })),
      openActivity: (steps: Block[]) => setDetail((current) => ({
        ...current, active: "activity", activity: { kind: "activity", steps },
      })),
      liveClockInFooter: true,
    }),
    [readBinaryFile],
  );
  // Phones have no editor pane, so file links open a read-only sheet.
  const openFile = useCallback(
    (path: string, navigation?: EditorNavigation) =>
      setDetail((current) => ({
        ...current,
        active: "file",
        file: {
          kind: "file", path, line: navigation?.line,
          from: current.active === "tool" ? current.tool?.block : undefined,
        },
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
  const workflowParent = useMemo(() => session.blocks.some((block) => block.workflowRun)
    ? { id: session.id, harness: session.harness, model: session.model, modelSettings: session.modelSettings,
      workflowRuns: session.workflowRuns, cwd: session.cwd } : undefined,
  [session.id, session.blocks, session.harness, session.model, session.modelSettings, session.workflowRuns, session.cwd]);
  const onQuestionFollowUp = useStableCallback((answer: QuestionAnswer) =>
    disabled || !visible ? false : onCommand({ type: "send", commandId: crypto.randomUUID(), sessionId,
      text: questionFollowUp(session, answer), followUpBehavior: "steer", questionAnswer: answer }));
  const closeDetail = useCallback(() => setDetail((current) => ({ ...current, active: undefined })), []);
  const releaseActivity = useCallback(() => setDetail((current) =>
    current.active === "activity" ? current : { ...current, activity: undefined }), []);
  const openStep = useCallback((block: Block) => setDetail((current) => ({
    ...current, active: "tool", tool: { kind: "tool", block, fromActivity: current.activity?.steps },
  })), []);
  const releaseTool = useCallback(() => setDetail((current) =>
    current.active === "tool" ? current : { ...current, tool: undefined }), []);
  const releaseFile = useCallback(() => setDetail((current) =>
    current.active === "file" ? current : { ...current, file: undefined }), []);
  // Memoized transcript blocks compare this callback; a fresh one on every
  // poll would re-render each block while a reply streams.
  const onApproval = useMemo(
    () =>
      !disabled && visible && runId
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
    [disabled, visible, runId, sessionId, onCommand],
  );
  return (
    <TranscriptPlatformContext.Provider value={platform}>
      <div
        ref={findSheetHost}
        className="mobile-desktop-transcript"
        data-layout={layout}
        role="log"
        aria-label="Conversation"
        aria-live={visible ? "polite" : "off"}
        aria-hidden={!visible || undefined}
        inert={!visible}
      >
        <AgentTranscript
          visible={visible}
          touchScroll
          promptMotion="mobile"
          animateFrom={animateFrom}
          blocks={session.blocks}
          busy={snapshot.status === "running"}
          cwd={session.cwd}
          harness={session.harness}
          model={session.model}
          modelSettings={session.modelSettings}
          workflowParent={workflowParent}
          pendingQuestion={!!session.pendingQuestion}
          pendingQuestionHistoryId={session.pendingQuestion?.historyId}
          onQuestionFollowUp={session.harness !== "codex" ? undefined : onQuestionFollowUp}
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
          disabled={!visible || disabled || !runId}
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
            {detail.activity && (
              <MobileActivitySheet
                open={visible && detail.active === "activity"}
                onExited={releaseActivity}
                // Follow live blocks so a running group fills in while open.
                steps={detail.activity.steps.map((step) =>
                  session.blocks.find((block) => block.id === step.id) ?? step)}
                cwd={session.cwd}
                live={snapshot.status === "running" &&
                  detail.activity.steps.some((step) => {
                    const current = session.blocks.find((block) => block.id === step.id) ?? step;
                    return isToolBlock(current) && toolCallState(current) === "pending";
                  })}
                onStep={openStep}
                onClose={closeDetail}
              />
            )}
            {detail.tool && (
              <MobileToolSheet
                open={visible && detail.active === "tool"}
                onExited={releaseTool}
                // Follow the live block so a running call fills in while open.
                block={
                  session.blocks.find(
                    (block) => block.id === detail.tool!.block.id,
                  ) ?? detail.tool.block
                }
                cwd={session.cwd}
                onOpenFile={readBinaryFile ? openFile : undefined}
                onBack={
                  detail.tool.fromActivity
                    ? () => setDetail((current) => ({ ...current, active: "activity",
                      activity: { kind: "activity", steps: detail.tool!.fromActivity! } }))
                    : undefined
                }
                onClose={closeDetail}
              />
            )}
            {detail.file && readBinaryFile && (
              <MobileFileSheet
                open={visible && detail.active === "file"}
                onExited={releaseFile}
                path={detail.file.path}
                line={detail.file.line}
                cwd={session.cwd}
                readBinaryFile={readBinaryFile}
                onOpenFile={openFile}
                onBack={
                  detail.file.from
                    ? () => setDetail((current) => ({ ...current, active: "tool",
                      tool: { kind: "tool", block: detail.file!.from! } }))
                    : undefined
                }
                onClose={closeDetail}
              />
            )}
          </>,
          sheetHost,
        )}
    </TranscriptPlatformContext.Provider>
  );
});
