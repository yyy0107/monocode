// Monocode stand-in for ZCode's agent/file-watcher services: saved workflows are
// read and changed by the Host workflow service of the project's machine.
import { workflowGlobalRequest, workflowRequest } from "../../model/workflowClient";
import type {
  ZCodeSavedWorkflowMeta,
  ZCodeSavedWorkflowRun,
  ZCodeSavedWorkflowScope,
  ZCodeWorkflowsGetResult,
} from "./shared.js";
import type { SavedWorkflowEntry, SavedWorkflowInvalidEntry } from "../../../../integrations/workflow/savedWorkflow";

export interface ZCodeAgentWorkspaceTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}

export type ZCodeAgentSavedWorkflowTarget =
  | (ZCodeAgentWorkspaceTarget & { scope?: ZCodeSavedWorkflowScope })
  | ({ scope: "global" } & Partial<ZCodeAgentWorkspaceTarget>);

type Failure = { ok: false; reason: string; path?: string; detail?: string };

export interface IZCodeAgentService {
  listSavedWorkflows(target: ZCodeAgentSavedWorkflowTarget): Promise<{ workflows: SavedWorkflowEntry[]; invalid: SavedWorkflowInvalidEntry[]; dir: string }>;
  getSavedWorkflow(params: ZCodeAgentSavedWorkflowTarget & { name: string }): Promise<ZCodeWorkflowsGetResult>;
  updateSavedWorkflowMeta(params: ZCodeAgentSavedWorkflowTarget & { name: string; meta: ZCodeSavedWorkflowMeta }): Promise<{ ok: true; path: string } | Failure>;
  deleteSavedWorkflow(params: ZCodeAgentSavedWorkflowTarget & { name: string }): Promise<{ ok: true; path: string } | Failure>;
  listSavedWorkflowRuns(params: ZCodeAgentSavedWorkflowTarget & { name?: string; limit: number }): Promise<{ runs: ZCodeSavedWorkflowRun[]; truncated?: true }>;
  moveSavedWorkflow(params: ZCodeAgentWorkspaceTarget & { name: string }): Promise<{ ok: true; from: string; to: string } | Failure>;
}

export interface IFileWatcherService {
  watch(params: { path: string }): Promise<{ id: string }>;
  unwatch(params: { id: string }): Promise<void>;
  onDynamicChange(id: string): (listener: () => void) => { dispose(): void };
}

/** Project requests go to the project's Host; global ones without a project to this computer's Host. */
function request<T>(target: ZCodeAgentSavedWorkflowTarget, action: string, params: Record<string, unknown>): Promise<T> {
  const scope = target.scope ? { scope: target.scope } : {};
  return target.workspacePath
    ? workflowRequest<T>(target.workspacePath, action, { ...scope, ...params })
    : workflowGlobalRequest<T>(action, params);
}

export const monocodeAgentService: IZCodeAgentService = {
  listSavedWorkflows: (target) => request(target, "saved.list", {}),
  getSavedWorkflow: (params) => request(params, "saved.get", { name: params.name }),
  updateSavedWorkflowMeta: (params) => request(params, "saved.updateMeta", { name: params.name, meta: params.meta }),
  deleteSavedWorkflow: (params) => request(params, "saved.delete", { name: params.name }),
  listSavedWorkflowRuns: (params) => request(params, "saved.runs", { limit: params.limit, ...(params.name ? { name: params.name } : {}) }),
  moveSavedWorkflow: (params) => workflowRequest(params.workspacePath, "saved.move", { name: params.name }),
};

/** Monocode refreshes the hub on open and on demand instead of watching folders. */
export const noFileWatcher: IFileWatcherService = {
  watch: () => Promise.reject(new Error("Folder watching is not available")),
  unwatch: () => Promise.resolve(),
  onDynamicChange: () => () => ({ dispose: () => {} }),
};
