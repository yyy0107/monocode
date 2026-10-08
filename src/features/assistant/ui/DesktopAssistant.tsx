import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RemoteAttachment } from "../../connections/model/protocol";
import { AssistantChat } from "./AssistantChat";
import { AssistantFilePanel, useAssistantFilePanel } from "./AssistantFilePanel";
import {
  remoteRequest,
  refreshRemoteProjectSessions,
} from "../../connections/model/connections";
import {
  sharedHostMachineId,
  configureSharedHost,
  rememberRemoteProject,
} from "../../connections/model/remoteProjects";
import { sharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import type { SessionReference } from "../model/assistant";
import type { AssistantTarget } from "../model/assistantNavigation";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { SearchableSelect } from "../../../shared/ui/SearchableSelect";
import { useDesktopAssistantHosts } from "../model/useDesktopAssistantHosts";
export function DesktopAssistant({
  selectedMachineId,
  onSelectMachine,
  onLocalSession,
  onRemoteSession,
}: {
  selectedMachineId?: string;
  onSelectMachine: (id: string) => void;
  onLocalSession: (id: string, project: string) => Promise<void> | void;
  onRemoteSession: (project: string, id: string) => void;
}) {
  const { t } = useTranslation();
  const choices = useDesktopAssistantHosts();
  const localId = sharedHostMachineId();
  const machine =
    choices.find((m) => m.id === (selectedMachineId ?? localId)) ?? choices[0];
  const rpc = useCallback(
    <T,>(method: string, params?: object) =>
      machine
        ? remoteRequest<T>(machine.id, method, params)
        : Promise.reject(new Error("Connect to a Host first.")),
    [machine?.id],
  );
  // Host attachments are stored under opaque IDs, so each opened file is
  // copied once to a local file under its own name for the floating card.
  const filePanel = useAssistantFilePanel();
  const openFile = filePanel.open;
  const attachmentPaths = useRef(new Map<string, Promise<string>>());
  const openAttachment = useCallback(
    (file: RemoteAttachment, read: () => Promise<string>) => {
      if (!machine) return;
      const key = `${machine.environmentId}:${file.id}`;
      let path = attachmentPaths.current.get(key);
      if (!path) {
        path = read().then((data) =>
          invoke<string>("write_attachment", { name: file.name, data }),
        );
        attachmentPaths.current.set(key, path);
        path.catch(() => attachmentPaths.current.delete(key));
      }
      path.then(openFile, (error) =>
        console.error(`Could not open ${file.name}`, error),
      );
    },
    [machine?.environmentId, openFile],
  );
  const open = async (ref: SessionReference, { project, session }: AssistantTarget) => {
    if (!machine) return;
    if (machine.id === localId) {
      // AssistantChat already validated this target against the current Host.
      // Register the resolved project without fetching the same list again.
      configureSharedHost(machine.environmentId, [project], machine.id);
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
      <div className="assistant-host-select">
        <SearchableSelect
          label={t("Host")}
          value={machine?.id ?? ""}
          options={choices.map((host) => ({ value: host.id, label: host.name }))}
          onChange={onSelectMachine}
          variant="pill"
          searchable={false}
        />
      </div>
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
          onOpenAttachment={openAttachment}
        />
      ) : (
        <div className="assistant-availability">
          <p>{t("Connect to a Host first.")}</p>
        </div>
      )}
      <AssistantFilePanel {...filePanel} onOpenFile={openFile} />
    </section>
  );
}
