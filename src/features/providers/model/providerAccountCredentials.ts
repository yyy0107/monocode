import {
  sharedHostMachineId,
  sharedHostEnvironment,
} from "../../connections/model/remoteProjects";
import { loadRemoteHostDescriptor } from "../../connections/model/remoteHostMetadata";
import { invoke } from "@tauri-apps/api/core";
import {
  PROVIDER_ACCOUNT_PROVIDERS,
  providerAccounts,
  rememberSharedProviderDefaults,
  newProviderAccount,
  saveProviderAccount,
  type SharedProviderDefaults,
  subscribeProviderAccounts,
  type ProviderAccountProvider,
} from "./providerAccounts";

/** Remove a named profile's native credentials before its UI metadata. */
export async function removeProviderAccountCredentials(
  provider: ProviderAccountProvider,
  accountId: string,
): Promise<void> {
  await invoke("provider_account_remove", { provider, accountId });
}

let publication: Promise<unknown> = Promise.resolve();
export function publishProviderAccounts(): Promise<void> {
  const accounts = Object.fromEntries(
    PROVIDER_ACCOUNT_PROVIDERS.map((provider) => [
      provider,
      providerAccounts(provider).map(({ id, label }) => ({ id, label })),
    ]),
  );
  const next = publication
    .catch(() => {})
    .then(() => invoke<void>("provider_accounts_publish", { accounts }));
  publication = next;
  return next;
}

/** Keep the shared Host's copy of account labels current for phones. */
export function initProviderAccountPublishing() {
  void publishProviderAccounts().catch(() => {});
  subscribeProviderAccounts(() => {
    void publishProviderAccounts().catch(() => {});
  });
}

export async function loadSharedProviderDefaults(): Promise<SharedProviderDefaults> {
  const defaults = await invoke<SharedProviderDefaults>(
    "provider_account_defaults",
  );
  rememberSharedProviderDefaults(defaults);
  return defaults;
}

export async function setSharedProviderDefault(
  provider: ProviderAccountProvider,
  accountId: string,
): Promise<SharedProviderDefaults> {
  await requireSharedAccountHost();
  // A failed metadata write must not look like a successfully shared preference.
  await publishProviderAccounts();
  const defaults = await invoke<SharedProviderDefaults>(
    "provider_account_set_default",
    { provider, accountId },
  );
  rememberSharedProviderDefaults(defaults);
  return defaults;
}

export async function importCurrentCodexAccount(label: string) {
  const account = newProviderAccount("codex", label);
  await invoke("provider_account_import_codex", { accountId: account.id });
  saveProviderAccount(account);
  await publishProviderAccounts();
  return account;
}

export async function requireSharedAccountHost(): Promise<void> {
  const machineId = sharedHostMachineId();
  const environmentId = sharedHostEnvironment();
  if (!machineId || !environmentId)
    throw new Error("Connect to the shared Host to choose a default account.");
  const descriptor = await loadRemoteHostDescriptor(machineId, environmentId);
  if (!descriptor.capabilities.includes("providerAccounts.defaults"))
    throw new Error("Update the Host to use shared account defaults.");
}
