import type { Session } from "../../sessions/model/session";
import {
  DEFAULT_PROVIDER_ACCOUNT_ID,
  supportsProviderAccounts,
} from "../../providers/model/providerAccounts";
import type { HostSession } from "./protocol";
import { remotePath, type RemoteProject } from "./remoteProjects";

/** Show the host's conversation in the app's ordinary session state while
 * retaining the local tab ID and the project's remote path. */
export function remoteSessionState(
  shell: Session,
  snapshot: HostSession,
  project: RemoteProject,
): Session {
  const host = snapshot.session;
  return {
    ...shell,
    ...host,
    createdAt: snapshot.createdAt ?? host.createdAt,
    updatedAt: snapshot.updatedAt,
    id: shell.id,
    cwd: shell.cwd,
    // The Host omits the built-in profile; never let the shell's stale or the
    // new-conversation default stand in for the account the Host runs.
    providerAccountId: supportsProviderAccounts(host.harness)
      ? (host.providerAccountId ?? DEFAULT_PROVIDER_ACCOUNT_ID)
      : undefined,
    nativeSyncStatus: snapshot.nativeStatus,
    worktreeCwd: host.cwd === project.cwd
      ? undefined
      : project.local ? host.cwd : remotePath(project.environmentId, host.cwd),
  };
}
