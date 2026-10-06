import type {
  HostProject,
  HostSession,
} from "../../connections/model/protocol";
import type { SessionReference } from "./assistant";
import type { AssistantRpc } from "./assistantClient";
export type AssistantTarget = { project: HostProject; session: HostSession };

export async function resolveAssistantTarget(
  environmentId: string,
  ref: SessionReference,
  rpc: AssistantRpc,
): Promise<AssistantTarget> {
  if (ref.environmentId !== environmentId)
    throw new Error("This conversation belongs to another Host");
  const [projects, session] = await Promise.all([
    rpc<HostProject[]>("projects.list"),
    rpc<HostSession>("sessions.get", { sessionId: ref.sessionId }),
  ]);
  const project = projects.find((p) => p.id === ref.projectId);
  if (
    !project ||
    !session ||
    session.projectId !== ref.projectId ||
    session.session.id !== ref.sessionId ||
    session.session.assistantOwnerId
  )
    throw new Error("Conversation is unavailable");
  return { project, session };
}
