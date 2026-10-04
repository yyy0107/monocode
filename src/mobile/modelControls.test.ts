// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MobileModelControls,
  configurationForModel,
  type MobileConfiguration,
} from "./MobileModelControls";
import type { HostModelCatalog } from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
import { HARNESS_TITLE } from "../features/sessions/model/session";
const catalog: HostModelCatalog = {
  models: {
    codex: [
      {
        id: "codex:full",
        name: "Full model",
        harness: "codex",
        settings: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            kind: "select",
            value: "high",
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
        ],
      },
      {
        id: "codex:fast",
        name: "Fast model",
        harness: "codex",
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
    claude: [
      {
        id: "claude:test",
        name: "Claude model",
        harness: "claude",
        settings: [
          {
            id: "effort",
            label: "Effort",
            kind: "select",
            value: "medium",
            options: [
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
        ],
      },
    ],
    cursor: [{ id: "cursor:test", name: "Cursor model", harness: "cursor" }],
  },
  errors: {},
};
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
let root: Root;
beforeEach(() => setUiLanguage("en"));
afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
});
function render(
  lockedAgent = false,
  configuration = configurationForModel(catalog.models.codex![0]),
) {
  const node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  const changes: MobileConfiguration[] = [];
  const refresh = (next: MobileConfiguration) => {
    act(() =>
      root.render(
        createElement(MobileModelControls, {
          catalog,
          configuration: next,
          lockedAgent,
          disabled: false,
          onClose: () => {},
          onChange: (value) => {
            changes.push(value);
            refresh(value);
          },
        }),
      ),
    );
  };
  refresh(configuration);
  const row = (name: string) =>
    [...node.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.querySelector("strong")?.textContent === name,
    )!;
  const change = (label: string, value: string) => {
    const back = node.querySelector<HTMLButtonElement>('[aria-label="Back"]');
    if (back) act(() => back.click());
    let name: string;
    if (label === "Agent") {
      act(() => row("Agent").click());
      name = HARNESS_TITLE[value as keyof typeof HARNESS_TITLE];
    } else if (label === "Model") {
      act(() => row("Model").click());
      name = Object.values(catalog.models)
        .flat()
        .find((model) => model?.id === value)!.name;
    } else
      name = { low: "Low", medium: "Medium", high: "High" }[
        value as "low" | "medium" | "high"
      ];
    const option = [
      ...node.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ].find((button) => button.textContent === name)!;
    expect(option).toBeDefined();
    act(() => option.click());
    const afterBack = node.querySelector<HTMLButtonElement>(
      '[aria-label="Back"]',
    );
    if (afterBack) act(() => afterBack.click());
  };
  return { node, changes, change };
}
describe("mobile Agent, model and reasoning controls", () => {
  it("filters models by selected Agent and resets provider-specific settings", () => {
    const { node, change, changes } = render();
    change("Agent", "claude");
    expect(changes.at(-1)).toMatchObject({
      harness: "claude",
      model: "claude:test",
      modelSettings: { effort: "medium" },
    });
    expect(changes.at(-1)!.modelSettings).not.toHaveProperty("reasoningEffort");
    expect(
      [...node.querySelectorAll("button")]
        .find(
          (button) => button.querySelector("strong")?.textContent === "Model",
        )!
        .querySelector("small")!.textContent,
    ).toBe("Claude model");
  });
  it("sends a chosen thinking level and resets unsupported values after a model switch", () => {
    const { change, changes } = render();
    change("Reasoning effort", "low");
    expect(changes.at(-1)!.modelSettings.reasoningEffort).toBe("low");
    change("Reasoning effort", "high");
    change("Model", "codex:fast");
    expect(changes.at(-1)).toMatchObject({
      model: "codex:fast",
      modelSettings: { reasoningEffort: "medium" },
    });
  });
  it("keeps compatible effort values when changing models", () => {
    const { change, changes } = render();
    change("Reasoning effort", "low");
    change("Model", "codex:fast");
    expect(changes.at(-1)!.modelSettings.reasoningEffort).toBe("low");
  });
  it("does not invent thinking settings for an Agent/model that has none", () => {
    const { node, change, changes } = render();
    change("Agent", "cursor");
    expect(changes.at(-1)!.modelSettings).toEqual({});
    expect(node.querySelector('[aria-label="Reasoning effort"]')).toBeNull();
  });
  it("locks only the Agent for existing conversations while allowing model and effort changes", () => {
    const { node, change, changes } = render(true);
    expect(
      [...node.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.querySelector("strong")?.textContent === "Agent",
      )!.disabled,
    ).toBe(true);
    expect(
      [...node.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.querySelector("strong")?.textContent === "Model",
      )!.disabled,
    ).toBe(false);
    change("Reasoning effort", "medium");
    expect(changes.at(-1)!.modelSettings.reasoningEffort).toBe("medium");
  });
});
