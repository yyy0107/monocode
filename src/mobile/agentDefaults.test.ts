// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type {
  HostModelCatalog,
  RemoteProvider,
} from "../features/connections/model/protocol";
import {
  accountChoices,
  configurationForAgent,
  confirmLegacyAccounts,
  defaultConfiguration,
  defaultProviderAccount,
  loadMobileAgentDefaults,
  saveMobileAgentDefaults,
  withDefaultAccount,
  withDefaultConfiguration,
  type MobileAgentDefaults,
} from "./agentDefaults";

const catalog: HostModelCatalog = {
  models: {
    claude: [{ harness: "claude", id: "claude:opus", name: "Opus" }],
    codex: [
      {
        harness: "codex",
        id: "codex:fast",
        name: "Fast",
        settings: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            kind: "select",
            value: "medium",
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
            ],
          },
        ],
      },
    ],
  },
  errors: {},
};
afterEach(() => localStorage.clear());
describe("mobile defaults scoped to Host and Agent", () => {
  it("remembers each Agent independently and isolates Hosts even with the same account ID", () => {
    let first: MobileAgentDefaults = {
      harness: "codex",
      agents: {
        codex: {
          model: "codex:fast",
          modelSettings: { reasoningEffort: "low" },
          accountId: "work",
        },
      },
    };
    first = withDefaultConfiguration(
      first,
      configurationForAgent(catalog, first, "claude")!,
    );
    first = withDefaultAccount(first, "claude", "personal");
    saveMobileAgentDefaults("one", first);
    saveMobileAgentDefaults("two", {
      harness: "codex",
      agents: { codex: { accountId: "work", model: "codex:other" } },
    });
    const restored = loadMobileAgentDefaults("one");
    expect(restored.harness).toBe("claude");
    expect(configurationForAgent(catalog, restored, "codex")).toMatchObject({
      model: "codex:fast",
      modelSettings: { reasoningEffort: "low" },
    });
    expect(defaultProviderAccount("claude", restored)).toBe("personal");
    expect(loadMobileAgentDefaults("two").agents?.codex?.model).toBe(
      "codex:other",
    );
    expect(loadMobileAgentDefaults("three")).toEqual({});
    expect(loadMobileAgentDefaults()).toEqual({});
  });
  it("claims legacy defaults once and requires matching Host account metadata", () => {
    localStorage.setItem(
      "monocode.mobileAgentDefaults",
      JSON.stringify({
        harness: "codex",
        model: "codex:fast",
        modelSettings: { reasoningEffort: "low" },
        accounts: { codex: "work", claude: "removed" },
      }),
    );
    expect(loadMobileAgentDefaults()).toEqual({});
    const first = loadMobileAgentDefaults("one");
    expect(first.agents?.codex?.accountNeedsConfirmation).toBe(true);
    expect(loadMobileAgentDefaults("two")).toEqual({});
    const verified = confirmLegacyAccounts(first, {
      codex: [{ id: "work", label: "Work" }],
    });
    expect(verified.agents?.codex?.accountNeedsConfirmation).toBeUndefined();
    expect(verified.agents?.claude?.accountNeedsConfirmation).toBe(true);
    expect(accountChoices({}, verified).map(({ agent }) => agent)).toEqual([
      "codex",
      "claude",
    ]);
    expect(defaultProviderAccount("claude", verified)).toBe("removed");
    expect(
      defaultProviderAccount(
        "claude",
        withDefaultAccount(verified, "claude", "default"),
      ),
    ).toBeUndefined();
  });
  it("falls back within an Agent before fixed provider order without rewriting preferences", () => {
    const saved = {
      harness: "codex" as const,
      agents: {
        codex: {
          model: "codex:removed",
          modelSettings: { reasoningEffort: "high", unknown: "value" },
        },
      },
    };
    saveMobileAgentDefaults("one", saved);
    expect(defaultConfiguration(catalog, saved)).toMatchObject({
      harness: "codex",
      model: "codex:fast",
      modelSettings: { reasoningEffort: "medium" },
    });
    expect(defaultConfiguration(catalog, { harness: "pi" })).toMatchObject({
      harness: "codex",
    });
    expect(
      defaultConfiguration(
        {
          models: { claude: catalog.models.claude },
          errors: { codex: "offline" },
        },
        saved,
      )?.harness,
    ).toBe("claude");
    expect(loadMobileAgentDefaults("one")).toEqual(saved);
    expect(
      defaultConfiguration({ models: {}, errors: {} }, saved),
    ).toBeUndefined();
  });
  it.each([
    ["pi", "thinking"],
    ["omp", "thinking"],
    ["opencode", "variant"],
    ["claude", "effort"],
    ["codex", "reasoningEffort"],
  ] as const)("uses %s's actual %s options", (harness, id) => {
    const remote: HostModelCatalog = {
      models: {
        [harness]: [
          {
            harness,
            id: `${harness}:test`,
            name: "Test",
            settings: [
              {
                id,
                label: "Effort",
                kind: "select",
                value: "low",
                options: [
                  { value: "low", label: "Low" },
                  { value: "high", label: "High" },
                ],
              },
            ],
          },
        ],
      },
      errors: {},
    };
    expect(
      defaultConfiguration(remote, {
        harness,
        agents: {
          [harness]: {
            modelSettings: { [id]: "high", reasoning: "unsupported" },
          },
        },
      })?.modelSettings,
    ).toEqual({ [id]: "high" });
  });
  it("does not invent settings or accept account choices for unsupported Agents", () => {
    expect(
      defaultConfiguration(catalog, {
        harness: "claude",
        agents: { claude: { modelSettings: { effort: "high" } } },
      })?.modelSettings,
    ).toEqual({});
    expect(
      defaultProviderAccount("pi", { agents: { pi: { accountId: "work" } } }),
    ).toBeUndefined();
    expect(
      accountChoices(
        { codex: [{ id: "default", label: "Default account" }] },
        {},
      ),
    ).toEqual([]);
  });
  it("ignores corrupt storage and unknown provider fields", () => {
    localStorage.setItem("monocode.mobileAgentDefaults", "broken");
    expect(loadMobileAgentDefaults("one")).toEqual({});
    saveMobileAgentDefaults("one", {
      harness: "fake" as RemoteProvider,
      agents: {
        codex: {
          modelSettings: {
            reasoningEffort: "low",
            bad: 3 as unknown as string,
          },
        },
      },
    });
    expect(loadMobileAgentDefaults("one")).toEqual({
      agents: { codex: { modelSettings: { reasoningEffort: "low" } } },
    });
  });
});
