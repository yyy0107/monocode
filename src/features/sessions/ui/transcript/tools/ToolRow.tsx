import { useContext, useState } from "react";
import { useTranslation } from "../../../../../shared/i18n/useTranslation";
import { ChevronRight } from "../../../../../shared/ui/icons";
import { AnimatedCollapse } from "../../../../../shared/ui/AnimatedCollapse";
import type { ApprovalDecision } from "../../../../../integrations/harness";
import type { Block } from "../../../model/session";
import {
  needsApproval,
  toolCallLabel,
  toolCallState,
} from "../../../model/transcriptActivity";
import { resolveToolRenderer, toolBodyText } from "../../../model/toolRenderer";
import { TranscriptPlatformContext } from "../../TranscriptPlatform";
import { QuestionRecord, ToolOutput } from "./ToolBody";
import {
  ActivityToolIcon,
  ApprovalControls,
  ToolCallIcon,
  ToolCallStatusIcon,
  ToolCallSummary,
  ToolOpenRow,
} from "./ToolCallParts";

/**
 * One tool call: a summary line every renderer shares, and whatever the call
 * opens onto under it — a command's output, a skill's result, the questions
 * the agent asked. `activity` rows sit on a phase rail; `standalone` rows stand
 * in the transcript on their own.
 */
export function ToolRow({
  block,
  cwd,
  live = false,
  variant,
  bare = false,
  onApproval,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  live?: boolean;
  variant: "activity" | "standalone";
  /** The rail is the bullet, so the row draws no icon of its own. */
  bare?: boolean;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const { openTool } = useContext(TranscriptPlatformContext);
  const [override, setOverride] = useState<boolean | null>(null);
  const renderer = resolveToolRenderer(block);
  const label = toolCallLabel(block, cwd);
  const state = toolCallState(block);
  const pending = needsApproval(block);
  const failed = state === "rejected";
  const running = state === "pending";
  const activity = variant === "activity";
  const questions =
    renderer === "question" && block.tool?.questions?.items.length
      ? block.tool.questions
      : undefined;
  const bodyText = questions ? undefined : toolBodyText(block, renderer);
  const expandable = !pending && (!!questions || !!bodyText);
  // A command you are watching run shows its output; it folds once it is done.
  const autoOpen = renderer === "execute" && live && running && !!bodyText;
  const open = expandable && (override ?? autoOpen);
  const toggle = () => setOverride(!open);

  const icon = activity ? (
    bare ? null : (
      <ActivityToolIcon state={state} live={live} />
    )
  ) : (
    <ToolCallIcon state={state} />
  );
  const statusIcon =
    activity && !pending ? <ToolCallStatusIcon state={state} /> : null;
  const summary =
    renderer === "question" ? (
      <QuestionSummary count={questions?.items.length} failed={failed} />
    ) : (
      <ToolCallSummary
        label={label}
        preview={block.tool?.preview}
        cwd={cwd}
        chip={activity && bare}
        failed={failed}
        status={state}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    );
  const gap = activity ? "gap-1.5" : "gap-2";

  if (openTool && !pending) {
    return (
      <ToolOpenRow
        block={block}
        label={label}
        className={`flex w-full min-w-0 items-center ${gap} py-1`}
        onOpen={openTool}
      >
        {icon}
        {summary}
        {statusIcon}
      </ToolOpenRow>
    );
  }

  return (
    <div data-tool-renderer={renderer} className="flex min-w-0 flex-col">
      <div
        aria-label={
          failed
            ? t("Failed tool call: {value0}", { value0: label })
            : t("Tool call: {value0}", { value0: label })
        }
        className={`group flex min-w-0 items-center ${gap} py-1`}
      >
        {icon}
        {expandable ? (
          <div className="flex min-w-0 flex-1 cursor-pointer" onClick={toggle}>
            {summary}
          </div>
        ) : (
          summary
        )}
        {statusIcon}
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={
              failed
                ? open
                  ? t("Hide error details for {value0}", { value0: label })
                  : t("Show error details for {value0}", { value0: label })
                : open
                  ? t("Hide details for {value0}", { value0: label })
                  : t("Show details for {value0}", { value0: label })
            }
            onClick={toggle}
            className="-m-1 shrink-0 rounded p-1"
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-200 ${
                failed ? "text-red-400/60" : "text-content/35"
              } ${open ? "rotate-90" : ""}`}
              strokeWidth={1.75}
            />
          </button>
        ) : null}
      </div>
      {pending ? (
        <ApprovalControls block={block} onApproval={onApproval} />
      ) : null}
      {expandable ? (
        <AnimatedCollapse expanded={open}>
          {() => (
            <div
              className={`min-w-0 pb-1.5 ${activity && !bare ? "pl-5" : ""}`}
            >
              {questions ? <QuestionRecord record={questions} /> : null}
              {bodyText ? (
                <ToolOutput
                  text={bodyText}
                  live={live && running}
                  failed={failed}
                />
              ) : null}
            </div>
          )}
        </AnimatedCollapse>
      ) : null}
    </div>
  );
}

function QuestionSummary({
  count,
  failed,
}: {
  count?: number;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const text = !count
    ? t("Asked a question")
    : count === 1
      ? t("Asked 1 question")
      : t("Asked {value0} questions", { value0: String(count) });
  return (
    <span
      className={`min-w-0 flex-1 truncate font-sans text-sm ${
        failed ? "text-red-400" : "text-content/50"
      }`}
    >
      {text}
    </span>
  );
}
