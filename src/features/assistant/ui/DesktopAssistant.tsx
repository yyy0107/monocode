import { useCallback, useState } from "react";
import { AssistantChat } from "./AssistantChat";
import {
  remoteRequest,
  useRemoteMachines,
  refreshRemoteProjectSessions,
} from "../../connections/model/connections";
import {
  sharedHostEnvironment,
  sharedHostMachineId,
  configureSharedHost,
  rememberRemoteProject,
} from "../../connections/model/remoteProjects";
import { sharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import type { SessionReference } from "../model/assistant";
import { resolveAssistantTarget } from "../model/assistantNavigation";
import type { HostProject } from "../../connections/model/protocol";
import { useTranslation } from "../../../shared/i18n/useTranslation";
export function DesktopAssistant({
  onLocalSession,
  onRemoteSession,
}: {
  onLocalSession: (id: string, project: string) => Promise<void> | void;
  onRemoteSession: (project: string, id: string) => void;
}) {
  const { t } = useTranslation();
  const { machines } = useRemoteMachines();
  const localId = sharedHostMachineId(),
    localEnvironment = sharedHostEnvironment();
  const choices = [...machines];
  if (localId && localEnvironment && !choices.some((m) => m.id === localId))
    choices.unshift({
      id: localId,
      environmentId: localEnvironment,
      name: t("Local"),
      endpoint: "",
      providers: [],
      capabilities: ["assistant.v1"],
    } as (typeof machines)[number]);
  const [selected, setSelected] = useState(localId ?? "");
  const machine = choices.find((m) => m.id === selected) ?? choices[0];
  const rpc = useCallback(
    <T,>(method: string, params?: object) =>
      machine
        ? remoteRequest<T>(machine.id, method, params)
        : Promise.reject(new Error("Connect to a Host first.")),
    [machine?.id],
  );
  const open = async (ref: SessionReference) => {
    if (!machine) return;
    const { project, session } = await resolveAssistantTarget(
      machine.environmentId,
      ref,
      rpc,
    );
    if (machine.id === localId) {
      const projects = await rpc<HostProject[]>("projects.list");
      configureSharedHost(machine.environmentId, projects, machine.id);
      sharedSessionBackend()?.rememberSession(ref.sessionId, project.cwd);
      await onLocalSession(ref.sessionId, project.cwd);
    } else {
      const remote = rememberRemoteProject(machine.environmentId, project);
      onRemoteSession(
        remote.key,
        session.session.orchestrationLeadId ?? ref.sessionId,
      );
    }
    refreshRemoteProjectSessions();
  };
  const hostPicker =
    choices.length > 1 ? (
      <select
        className="assistant-host-select"
        aria-label={t("Host")}
        value={machine?.id ?? ""}
        onChange={(e) => setSelected(e.target.value)}
      >
        {choices.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    ) : undefined;
  return (
    <section
      className="assistant-workspace bg-background-base text-content"
      aria-label={t("Assistant")}
    >
      {machine ? (
        <AssistantChat
          key={machine.environmentId}
          hostKey={machine.environmentId}
          hostName={machine.name}
          hostPicker={hostPicker}
          rpc={rpc}
          onOpen={open}
        />
      ) : (
        <div className="assistant-availability">
          <p>{t("Connect to a Host first.")}</p>
        </div>
      )}
    </section>
  );
}
