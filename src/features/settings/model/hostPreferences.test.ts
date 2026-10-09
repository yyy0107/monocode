// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { initializeHostPreferences, desktopProjectPreferenceStores, stopDesktopHostPreferences } from "./hostPreferences";
import { preferenceStorage } from "./sharedPreferences";
import { configureSharedHost } from "../../connections/model/remoteProjects";
import { remoteRequest } from "../../connections/model/connections";
import { loadRemoteHostDescriptor } from "../../connections/model/remoteHostMetadata";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../connections/model/connections", () => ({ remoteRequest: vi.fn(), remoteSessionFor: () => undefined, REMOTE_MACHINES_CHANGED: "monocode:remote-machines" }));
vi.mock("../../connections/model/remoteHostMetadata", () => ({ loadRemoteHostDescriptor: vi.fn() }));

const machines = [
  { id: "local-machine", environmentId: "local", name: "Local", endpoint: "http://localhost:3774" },
  { id: "remote-machine", environmentId: "remote", name: "Remote", endpoint: "http://remote:3774" },
];
let hosts: Record<string, { revision: number; imported: boolean; values: Record<string, string> }>;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubEnv("DEV", false);
  configureSharedHost(undefined, []);
  configureSharedHost("local", [{ id: "local-project", cwd: "/app", name: "App" }], "local-machine");
  hosts = {
    "local-machine": { revision: 0, imported: false, values: {} },
    "remote-machine": { revision: 0, imported: false, values: {} },
  };
  vi.mocked(invoke).mockResolvedValue(machines);
  vi.mocked(loadRemoteHostDescriptor).mockImplementation(async (_machine, environmentId) => ({ environmentId, capabilities: ["clientState.v1"] }) as never);
  vi.mocked(remoteRequest).mockImplementation(async (machine, method, params) => {
    const state = hosts[machine];
    if (method === "projects.list") return [{ id: "remote-project", cwd: "/app", name: "Remote app" }];
    if (method === "preferences.patch") {
      const patch = params as { changes: Record<string, string | null>; importRelease?: boolean };
      if (!patch.importRelease || !state.imported) {
        for (const [key, value] of Object.entries(patch.changes)) {
          if (value === null) delete state.values[key]; else state.values[key] = value;
        }
        state.revision++;
        if (patch.importRelease) state.imported = true;
      }
    }
    return structuredClone(state);
  });
});
afterEach(() => { stopDesktopHostPreferences(); vi.unstubAllEnvs(); });
const settle = async () => {
  for (let count = 0; count < 3; count++) await Promise.all([...desktopProjectPreferenceStores.values()].map((store) => store.sync()));
};

it("imports release global settings once and sends project choices to the owning Host", async () => {
  localStorage.setItem("monocode.colorScheme", "dark");
  localStorage.setItem("monocode.projectProviderSettings.v1", JSON.stringify({
    "/app": { defaultHarness: "codex" }, "remote://remote/app": { defaultHarness: "claude" },
  }));
  await initializeHostPreferences();
  await settle();
  expect(hosts["local-machine"].imported).toBe(true);
  expect(hosts["local-machine"].values["monocode.colorScheme"]).toBe("dark");
  expect(hosts["local-machine"].values['monocode.projectProviderSettings.v1::["@project:local:local-project","defaultHarness"]']).toBe('"codex"');
  expect(hosts["remote-machine"].values['monocode.projectProviderSettings.v1::["@project:remote:remote-project","defaultHarness"]']).toBe('"claude"');
  expect(Object.keys(hosts["local-machine"].values).some((key) => key.includes("@project:remote:"))).toBe(false);
  expect(JSON.parse(preferenceStorage.getItem("monocode.projectProviderSettings.v1")!)).toEqual({
    "/app": { defaultHarness: "codex" }, "remote://remote/app": { defaultHarness: "claude" },
  });
  localStorage.setItem("monocode.colorScheme", "light");
  await initializeHostPreferences();
  expect(hosts["local-machine"].values["monocode.colorScheme"]).toBe("dark");
});

it("does not upload the dev origin's legacy settings", async () => {
  vi.stubEnv("DEV", true);
  localStorage.setItem("monocode.colorScheme", "light");
  await initializeHostPreferences();
  await settle();
  expect(hosts["local-machine"].imported).toBe(false);
  expect(hosts["local-machine"].values["monocode.colorScheme"]).toBeUndefined();
  expect(hosts["local-machine"].values["monocode.recentProjects"]).toContain("@project:local:local-project");
  expect(localStorage.getItem("monocode.recentProjects")).toBeNull();
});

it("boots from the same verified Host cache on transport failure but rejects identity failures", async () => {
  localStorage.setItem("monocode.colorScheme", "dark");
  await initializeHostPreferences();
  await settle();
  vi.mocked(loadRemoteHostDescriptor).mockRejectedValue(new Error("connection refused"));
  vi.mocked(remoteRequest).mockRejectedValue(new Error("offline"));
  await initializeHostPreferences();
  expect(preferenceStorage.getItem("monocode.colorScheme")).toBe("dark");
  expect(desktopProjectPreferenceStores.get("local")?.error).toBe("offline");
  vi.mocked(loadRemoteHostDescriptor).mockRejectedValue(new Error("Host identity changed"));
  await expect(initializeHostPreferences()).rejects.toThrow("Host identity changed");
});
