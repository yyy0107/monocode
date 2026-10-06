// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { configureSharedHost } from "../../connections/model/remoteProjects";
import {
  loadSharedProviderDefaults,
  setSharedProviderDefault,
  importCurrentCodexAccount,
  initProviderAccountPublishing,
  addProviderAccountProfile,
  updateProviderAccountProfile,
} from "./providerAccountCredentials";
import { readProviderAccountIdentity } from "./providerAccountIdentity";
import {
  providerAccounts,
  saveProviderAccount,
  sharedProviderAccountId,
} from "./providerAccounts";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  configureSharedHost("env", [], "machine");
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (command) => {
      if (command === "remote_request")
        return {
          protocolVersion: 1,
          environmentId: "env",
          name: "fixture",
          providers: ["codex"],
          capabilities: ["providerAccounts.defaults"],
        };
      if (command === "provider_account_defaults") return { codex: "work" };
      if (command === "provider_account_set_default") return { codex: "work" };
    });
});
it("loads authoritative defaults and only updates selectors after a successful native commit", async () => {
  await loadSharedProviderDefaults();
  expect(sharedProviderAccountId("codex")).toBe("work");
  saveProviderAccount({ provider: "codex", id: "work", label: "Work" });
  await setSharedProviderDefault("codex", "work");
  const commands = vi.mocked(invoke).mock.calls.map((call) => call[0]);
  expect(commands.indexOf("provider_accounts_publish")).toBeLessThan(
    commands.indexOf("provider_account_set_default"),
  );
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "remote_request")
      return {
        protocolVersion: 1,
        environmentId: "env",
        name: "fixture",
        providers: ["codex"],
        capabilities: ["providerAccounts.defaults"],
      };
    if (command === "provider_accounts_publish")
      throw new Error("disk unavailable");
    throw new Error("must not commit");
  });
  await expect(setSharedProviderDefault("codex", "different")).rejects.toThrow(
    "disk unavailable",
  );
  expect(sharedProviderAccountId("codex")).toBe("work");
});
it("restores disk accounts before the first publication when browser metadata is missing", async () => {
  const disk = { codex: [{ id: "work", label: "Work", dataHome: "/data/codex" }] };
  vi.mocked(invoke).mockImplementation(async command => command === "provider_accounts_list" ? disk : undefined);
  const release = await initProviderAccountPublishing();
  try {
    expect(providerAccounts("codex")[1]).toMatchObject(disk.codex[0]);
    expect(invoke).toHaveBeenCalledWith("provider_accounts_publish", { accounts: {
      claude: [{ id: "default", label: "Default account" }],
      codex: [{ id: "default", label: "Default account" }, ...disk.codex],
    } });
    expect(vi.mocked(invoke).mock.calls[0][0]).toBe("provider_accounts_list");
  } finally { release(); }
});

it("adds a profile without OAuth, keeps custom Homes, and does not cache failed native saves", async () => {
  const account = await addProviderAccountProfile("claude", "Work", "/data/claude");
  expect(providerAccounts("claude")[1]).toEqual(account);
  expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual(["provider_accounts_publish"]);
  expect(invoke).toHaveBeenCalledWith("provider_accounts_publish", { accounts: expect.objectContaining({ claude: expect.arrayContaining([expect.objectContaining({ dataHome: "/data/claude" })]) }) });
  vi.mocked(invoke).mockRejectedValue(new Error("Invalid Home"));
  await expect(addProviderAccountProfile("codex", "Failed", "relative")).rejects.toThrow("Invalid Home");
  expect(providerAccounts("codex")).toHaveLength(1);
});

it("commits default Home edits without duplicating or clearing the profile when a save fails", async () => {
  vi.mocked(invoke).mockImplementation(async command => command === "provider_accounts_list" ? { codex: [{ id: "default", label: "Default account", dataHome: "/data/codex", resolvedDataHome: "/data/codex" }] } : undefined);
  await updateProviderAccountProfile({ id: "default", provider: "codex", label: "Default account", dataHome: "/data/codex" });
  expect(providerAccounts("codex")[0]).toMatchObject({ dataHome: "/data/codex", resolvedDataHome: "/data/codex" });
  const published = vi.mocked(invoke).mock.calls.find(([command]) => command === "provider_accounts_publish")![1] as { accounts: { codex: unknown[] } };
  expect(published.accounts.codex).toEqual([{ id: "default", label: "Default account", dataHome: "/data/codex" }]);
  vi.mocked(invoke).mockRejectedValue(new Error("cannot save"));
  await expect(updateProviderAccountProfile({ id: "default", provider: "codex", label: "Default account", dataHome: "/different" })).rejects.toThrow("cannot save");
  expect(providerAccounts("codex")[0].dataHome).toBe("/data/codex");
});

it("does not overwrite native metadata if restoration failed", async () => {
  vi.mocked(invoke).mockRejectedValue(new Error("unreadable"));
  await expect(initProviderAccountPublishing()).rejects.toThrow("unreadable");
  expect(invoke).not.toHaveBeenCalledWith("provider_accounts_publish", expect.anything());
});

it("rejects unsupported Hosts before claiming a shared default was saved", async () => {
  vi.mocked(invoke).mockResolvedValue({
    protocolVersion: 1,
    environmentId: "env",
    name: "fixture",
    providers: ["codex"],
    capabilities: [],
  });
  await expect(setSharedProviderDefault("codex", "work")).rejects.toThrow(
    "Update the Host",
  );
  expect(invoke).not.toHaveBeenCalledWith(
    "provider_account_set_default",
    expect.anything(),
  );
});
it("imports a named profile without changing shared defaults, and keeps failed imports out of metadata", async () => {
  const imported = await importCurrentCodexAccount("9300");
  expect(invoke).toHaveBeenCalledWith("provider_account_import_codex", {
    accountId: imported.id,
  });
  expect(
    providerAccounts("codex").some(
      (account) => account.id === imported.id && account.label === "9300",
    ),
  ).toBe(true);
  expect(sharedProviderAccountId("codex")).toBe("default");
  vi.mocked(invoke).mockRejectedValue(new Error("auth unavailable"));
  await expect(importCurrentCodexAccount("Failed")).rejects.toThrow(
    "auth unavailable",
  );
  expect(
    providerAccounts("codex").some((account) => account.label === "Failed"),
  ).toBe(false);
});
it("reads shared Host identities, coalesces requests and never substitutes the local identity on failure", async () => {
  vi.mocked(invoke).mockResolvedValue({
    codex: [
      { id: "default", label: "CLI", identity: { email: "host@example.test" } },
      { id: "work", label: "Work", identity: { email: "work@example.test" } },
    ],
  });
  expect(
    await Promise.all([
      readProviderAccountIdentity("codex", "default"),
      readProviderAccountIdentity("codex", "work"),
    ]),
  ).toEqual([{ email: "host@example.test" }, { email: "work@example.test" }]);
  expect(invoke).toHaveBeenCalledTimes(1);
  vi.mocked(invoke).mockRejectedValue(new Error("Host offline"));
  expect(await readProviderAccountIdentity("codex", "default")).toBeNull();
  expect(
    vi
      .mocked(invoke)
      .mock.calls.every(([command]) => command === "remote_request"),
  ).toBe(true);
});
it("discards identities returned after the shared Host changes", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = readProviderAccountIdentity("codex", "default");
  configureSharedHost("other", [], "other-machine");
  finish({
    codex: [{ id: "default", identity: { email: "old@example.test" } }],
  });
  expect(await pending).toBeNull();
});

it("keeps native desktop imports on their local identity source", async () => {
  vi.mocked(invoke).mockResolvedValue({ email: "native@example.test" });
  expect(await readProviderAccountIdentity("codex", "default", "local")).toEqual({ email: "native@example.test" });
  expect(invoke).toHaveBeenCalledWith("provider_account_identity", { provider: "codex", accountId: "default" });
});
