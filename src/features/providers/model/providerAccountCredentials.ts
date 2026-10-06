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
  restoreProviderAccounts,
  type ProviderAccount,
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

let loading: Promise<void> | undefined;
export function loadProviderAccounts(): Promise<void> {
  if (loading) return loading;
  loading = invoke<unknown>("provider_accounts_list")
    .then(restoreProviderAccounts)
    .finally(() => { loading = undefined; });
  return loading;
}

let publication: Promise<unknown> = Promise.resolve();
export function publishProviderAccounts(extra?: ProviderAccount): Promise<void> {
  const next = publication.catch(() => {}).then(() => {
    // Snapshot inside the queue so an earlier restoration or save cannot be
    // overwritten by a stale publication captured before it finished.
    const accounts = Object.fromEntries(
      PROVIDER_ACCOUNT_PROVIDERS.map((provider) => {
        const entries = providerAccounts(provider).filter(account =>
          extra?.provider !== provider || account.id !== extra.id,
        );
        if (extra?.provider === provider) entries.push(extra);
        return [provider, entries.map(({ id, label, dataHome }) => ({ id, label, ...(dataHome ? { dataHome } : {}) }))];
      }),
    );
    return invoke<void>("provider_accounts_publish", { accounts });
  });
  publication = next;
  return next;
}

/** Restore disk profiles before ever publishing the webview's account cache. */
export async function initProviderAccountPublishing(): Promise<() => void> {
  await loadProviderAccounts();
  await publishProviderAccounts();
  return subscribeProviderAccounts(() => {
    void publishProviderAccounts().catch(() => {});
  });
}

/** Adding a profile must not wait for (or require) an OAuth browser flow. */
export async function addProviderAccountProfile(
  provider: ProviderAccountProvider,
  label: string,
  dataHome?: string,
): Promise<ProviderAccount> {
  const account = newProviderAccount(provider, label, dataHome);
  await publishProviderAccounts(account);
  saveProviderAccount(account);
  return account;
}

/** Commit edits before changing the cache, including the built-in profile. */
export async function updateProviderAccountProfile(account: ProviderAccount): Promise<void> {
  await publishProviderAccounts(account);
  saveProviderAccount(account);
  await loadProviderAccounts();
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
