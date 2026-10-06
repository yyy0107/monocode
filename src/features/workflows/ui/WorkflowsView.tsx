// The Workflows app view: the saved-workflows hub (global and per-project
// groups, run with arguments, detail, run history, create via chat).
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Workflow } from "../../../shared/ui/icons";
import { TooltipProvider } from "../kit/components/ui/tooltip";
import { SavedWorkflowsSection } from "../kit/settings/saved-workflows/SavedWorkflowsSection";
import { useWorkflowApp } from "./workflowAppContext";

export function WorkflowsView({ cwd }: { cwd: string }) {
  const { t } = useTranslation();
  const app = useWorkflowApp();
  return (
    <div
      role="region"
      aria-label={t("Workflows")}
      data-app-workflows
      className="flex min-h-0 min-w-0 flex-1 flex-col text-content"
    >
      <div className="flex h-10 shrink-0 select-none items-center border-b border-stroke">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
          <Workflow className="size-3.5 shrink-0 text-content/45" />
          <span className="min-w-0 truncate text-content">{t("Workflows")}</span>
        </div>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="min-h-0 flex-1 overflow-y-auto bg-background-base font-sans">
          <div className="mx-auto w-full max-w-3xl px-4 py-4">
            <SavedWorkflowsSection
              workspacePath={cwd}
              {...(app
                ? {
                    onNavigateToLaunchedRun: (target, sessionId) => app.openSession(target.workspacePath, sessionId),
                    onCreateViaChat: (prompt, target) => app.createViaChat(target.workspacePath, prompt),
                    onOpenWorkflowRun: (params) => app.openSession(params.workspacePath, params.sessionId),
                  }
                : {})}
            />
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
