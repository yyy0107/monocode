// The left sidebar's Workflows section: conversations with workflow runs (each
// with run lines; a line opens the run's detail tab) and the saved
// workflows hub.
import { useContext } from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Workflow } from "../../../shared/ui/icons";
import { TooltipProvider } from "../kit/components/ui/tooltip";
import { TaskWorkflowRunLines } from "../kit/components/workflow-run-line/TaskWorkflowRunLines";
import { useWorkflowIntl } from "../kit/i18n/IntlProvider";
import { WorkflowActivityContext, workflowActivityEntries } from "../model/workflowActivity";
import { useWorkflowApp } from "./workflowAppContext";

export function WorkflowSidebarSection({ activeSessionId, onOpenSession, onOpenWorkflows, workflowsActive }: {
  activeSessionId?: string;
  onOpenSession: (sessionId: string) => void;
  onOpenWorkflows: () => void;
  workflowsActive?: boolean;
}) {
  const { t } = useTranslation();
  const { intl } = useWorkflowIntl();
  const app = useWorkflowApp();
  const entries = workflowActivityEntries(useContext(WorkflowActivityContext));
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col gap-px px-2" data-workflow-sidebar>
        {entries.map((entry) => (
          <div
            key={entry.sessionId}
            className={`flex min-w-0 flex-col rounded-lg px-2.5 py-1.5 hover:bg-surface-hover ${entry.sessionId === activeSessionId ? "bg-selection" : ""}`}
          >
            <button
              type="button"
              className="min-w-0 truncate text-left text-ui-base text-content"
              onClick={() => onOpenSession(entry.sessionId)}
            >
              {entry.title}
            </button>
            <TaskWorkflowRunLines
              activity={entry.activity}
              isActive={entry.sessionId === activeSessionId}
              intl={intl}
              {...(app ? { session: { workspacePath: entry.cwd, sessionId: entry.sessionId } } : {})}
              className="mt-0.5"
            />
          </div>
        ))}
        <button
          type="button"
          aria-current={workflowsActive ? "page" : undefined}
          onClick={onOpenWorkflows}
          className={`flex h-7 min-w-0 items-center gap-2 rounded-lg px-2.5 text-left text-ui-sm text-content/60 hover:bg-surface-hover hover:text-content ${workflowsActive ? "bg-selection text-content" : ""}`}
        >
          <Workflow className="size-3.5 shrink-0" />
          <span className="truncate">{t("Saved workflows")}</span>
        </button>
      </div>
    </TooltipProvider>
  );
}
