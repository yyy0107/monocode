import type { ComponentType } from "react";
import type { Block } from "../features/sessions/model/session";
import {
  isThinkingBlock,
  isToolBlock,
  proseSummary,
  toolCallLabel,
  toolCallState,
  toolCategory,
  workDiffStats,
  workSummaryLine,
  type ActivityWorkKind,
} from "../features/sessions/model/transcriptActivity";
import { useTranslation } from "../shared/i18n/useTranslation";
import {
  Bot,
  ChevronRight,
  CircleX,
  Eye,
  LoaderCircle,
  Pencil,
  Sparkles,
  StickyNote,
  Terminal,
  Wrench,
} from "../shared/ui/icons";
import { MobileSheet } from "./MobileSheet";

const WORK_ICONS: Record<ActivityWorkKind, ComponentType<{ size?: number }>> = {
  research: Eye,
  edit: Pencil,
  run: Terminal,
  agent: Bot,
  other: Wrench,
};

function StepIcon({ block }: { block: Block }) {
  if (isToolBlock(block)) {
    const Icon = WORK_ICONS[toolCategory(block)];
    return <Icon size={18} />;
  }
  return isThinkingBlock(block) ? <Sparkles size={18} /> : <StickyNote size={18} />;
}

/** A group of steps on a rail; each tool call opens its own details. */
export function MobileActivitySheet({
  open = true,
  onExited,
  steps,
  cwd,
  live,
  onStep,
  onClose,
}: {
  open?: boolean;
  onExited?: () => void;
  steps: Block[];
  cwd?: string;
  live: boolean;
  onStep: (block: Block) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <MobileSheet open={open} onExited={onExited} title="Activity" onClose={onClose}
      detents header={{ title: workSummaryLine(steps, live) }}>
      <div className="mobile-activity-sheet">
        <ol className="mobile-activity-steps">
          {steps.map((block) => {
            if (!isToolBlock(block)) {
              const text = proseSummary(block.text);
              if (!text) return null;
              return (
                <li key={block.id} className="mobile-activity-step" data-kind="note">
                  <span className="mobile-activity-icon"><StepIcon block={block} /></span>
                  <span className="mobile-activity-text">{text}</span>
                </li>
              );
            }
            const state = toolCallState(block);
            const diff = workDiffStats([block]);
            return (
              <li key={block.id} className="mobile-activity-step">
                <button type="button" onClick={() => onStep(block)}>
                  <span className="mobile-activity-icon"><StepIcon block={block} /></span>
                  <span className="mobile-activity-text mobile-detail-mono">
                    {toolCallLabel(block, cwd)}
                  </span>
                  {(diff.additions > 0 || diff.deletions > 0) && (
                    <span className="mobile-activity-diff">
                      <span data-kind="add">+{diff.additions}</span>
                      <span data-kind="del">−{diff.deletions}</span>
                    </span>
                  )}
                  {state === "pending" ? (
                    <LoaderCircle size={16} className="mobile-spin" aria-label={t("Running")} />
                  ) : state === "rejected" ? (
                    <CircleX size={16} className="mobile-activity-failed" aria-label={t("Failed")} />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </MobileSheet>
  );
}
