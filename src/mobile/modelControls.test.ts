// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MobileModelControls,
  configurationForModel,
  type MobileConfiguration,
} from "./MobileModelControls";
import type { HostModelCatalog } from "../features/connections/model/protocol";
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
          onChange: (value) => {
            changes.push(value);
            refresh(value);
          },
        }),
      ),
    );
  };
  refresh(configuration);
  const change = (label: string, value: string) => {
    const select = node.querySelector<HTMLSelectElement>(
      `[aria-label="${label}"]`,
    )!;
    expect(select).not.toBeNull();
    act(() => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
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
    expect(node.querySelector('[aria-label="Model"]')!.textContent).toBe(
      "Claude model",
    );
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
      node.querySelector<HTMLSelectElement>('[aria-label="Agent"]')!.disabled,
    ).toBe(true);
    expect(
      node.querySelector<HTMLSelectElement>('[aria-label="Model"]')!.disabled,
    ).toBe(false);
    change("Reasoning effort", "medium");
    expect(changes.at(-1)!.modelSettings.reasoningEffort).toBe("medium");
  });
});
