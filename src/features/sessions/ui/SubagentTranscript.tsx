import { useState } from "react";
import type { Block } from "../model/session";
import { agentTranscript } from "../model/agentTranscript";
import {
  isSubagentBlock,
  subagentName,
  subagentReport,
  toolCallLabel,
  toolCallState,
} from "../model/transcriptActivity";
import { AgentMarkdown } from "./AgentMarkdown";
import { GeneratedImage } from "./GeneratedImage";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Bot, ChevronRight, Wrench } from "../../../shared/ui/icons";

function Thought({
  block,
  cwd,
  onOpenFile,
}: {
  block: Block;
  cwd?: string;
  onOpenFile?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 py-2"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          size={16}
          className={`zen-disclosure-chevron ${open ? "rotate-90" : ""}`}
        />
        {t("Thinking")}
      </button>
      <AnimatedCollapse expanded={open}>
        {() => (
          <AgentMarkdown text={block.text} cwd={cwd} onOpenFile={onOpenFile} />
        )}
      </AnimatedCollapse>
    </div>
  );
}

/** Read-only conversation body shared by subagent surfaces; never binds parent controls. */
export function SubagentTranscript({
  block,
  cwd,
  onOpenAgent,
  onOpenTool,
  onOpenFile,
}: {
  block: Block;
  cwd?: string;
  onOpenAgent: (block: Block) => void;
  onOpenTool: (block: Block) => void;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const rows = agentTranscript(block);
  const report = subagentReport(block);
  const showReport =
    report &&
    !rows.some((row) => row.role === "assistant" && row.text.trim() === report);
  const partial = block.agentRun?.coverage === "partial";
  const legacy = block.agentRun?.transcript === undefined;
  return (
    <div className="subagent-transcript flex min-w-0 flex-col gap-4 p-4">
      {partial || (legacy && rows.length > 0) ? (
        <p className="text-sm text-content/50" role="note">
          {t(
            legacy
              ? "Historical subagent records may be incomplete."
              : "The provider supplied only part of this subagent's conversation.",
          )}
        </p>
      ) : null}
      {!rows.length && !report ? (
        <p className="text-sm text-content/50" role="status">
          {t(
            toolCallState(block) === "pending"
              ? "Waiting for subagent messages…"
              : "The provider did not supply this subagent's conversation.",
          )}
        </p>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.id}
          data-agent-message={row.id}
          className="min-w-0 break-words"
          style={{
            contentVisibility: "auto",
            containIntrinsicSize: "auto 60px",
          }}
        >
          {row.role === "tool" ? (
            <button
              type="button"
              className="flex w-full min-w-0 items-center gap-2 py-2 text-left"
              onClick={() =>
                isSubagentBlock(row) ? onOpenAgent(row) : onOpenTool(row)
              }
            >
              {isSubagentBlock(row) ? (
                <Bot size={18} className="shrink-0" />
              ) : (
                <Wrench size={18} className="shrink-0" />
              )}
              <span className="line-clamp-2 min-w-0 flex-1 break-words">
                {isSubagentBlock(row)
                  ? subagentName(row)
                  : toolCallLabel(row, cwd)}
              </span>
              <span className="shrink-0 text-xs text-content/50">
                {t(
                  toolCallState(row) === "pending"
                    ? "Running"
                    : toolCallState(row) === "rejected"
                      ? "Failed"
                      : "Completed",
                )}
              </span>
              <ChevronRight size={16} className="shrink-0" />
            </button>
          ) : row.role === "reasoning" ? (
            <Thought block={row} cwd={cwd} onOpenFile={onOpenFile} />
          ) : row.role === "image" && row.image ? (
            <GeneratedImage
              image={row.image}
              attachment={row.attachments?.[0]}
            />
          ) : (
            <div
              className={
                row.role === "user" ? "rounded-xl bg-content/5 p-3" : undefined
              }
            >
              {row.role === "user" ? (
                <p className="mb-2 text-xs text-content/50">{t("Task")}</p>
              ) : null}
              <AgentMarkdown
                text={row.text}
                cwd={cwd}
                onOpenFile={onOpenFile}
              />
            </div>
          )}
        </div>
      ))}
      {showReport ? (
        <AgentMarkdown text={report} cwd={cwd} onOpenFile={onOpenFile} />
      ) : null}
    </div>
  );
}
