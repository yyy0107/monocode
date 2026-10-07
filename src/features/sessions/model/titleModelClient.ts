import {
  remoteMachineFor,
  remoteRequest,
} from "../../connections/model/connections";
import {
  remoteProjectFor,
  sharedHostMachineId,
} from "../../connections/model/remoteProjects";
import type { GeneratedSessionTitle } from "./sessionTitle";

/** Desktop title requests use the same configured API and credential owner as Host sessions. */
export async function generateConfiguredSessionTitle(
  cwd: string,
  message: string,
): Promise<GeneratedSessionTitle | null> {
  const project = remoteProjectFor(cwd);
  const machineId = project
    ? (await remoteMachineFor(project.environmentId))?.id
    : sharedHostMachineId();
  if (!machineId) return null;
  return remoteRequest(machineId, "titleModel.generate", { message });
}
