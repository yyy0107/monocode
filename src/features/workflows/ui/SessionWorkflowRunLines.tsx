// ZCode's run lines under a conversation row in the left sidebar: a rail of
// phase lights and the current phase; clicking one opens the run's detail tab.
import { TaskWorkflowRunLines } from "../zcode/components/workflow-run-line/TaskWorkflowRunLines";
import { TooltipProvider } from "../zcode/components/ui/tooltip";
import { useZCodeIntl } from "../zcode/i18n/IntlProvider";
import { useWorkflowActivity } from "../model/workflowActivity";

export function SessionWorkflowRunLines({ sessionId, isActive }: { sessionId: string; isActive: boolean }) {
  const entry = useWorkflowActivity(sessionId);
  const { intl } = useZCodeIntl();
  if (!entry) return null;
  return (
    <TooltipProvider delayDuration={400}>
      <TaskWorkflowRunLines
      activity={entry.activity}
      isActive={isActive}
      intl={intl}
      session={{ workspacePath: entry.cwd, sessionId: entry.sessionId }}
      className="mt-1"
      />
    </TooltipProvider>
  );
}
