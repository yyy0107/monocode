// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSettings } from "./AssistantSettings";
import type { AssistantMemory } from "../model/assistant";
import { setUiLanguage } from "../../../shared/i18n/language";

let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

/** A Host that keeps memory facts and rejects edits made against an old version. */
function fakeHost() {
  const memory: AssistantMemory = {
    revision: 1,
    facts: [{ index: 0, text: "Prefers pnpm", date: "2026-10-01", struck: false }],
    topics: [],
  };
  const rpc = vi.fn(async (method: string, params: Record<string, unknown> = {}) => {
    if (method === "assistant.memory") return structuredClone(memory);
    if (params.expectedRevision !== memory.revision)
      throw new Error("Memory changed elsewhere. Reload before saving.");
    memory.revision++;
    if (params.action === "addMemory")
      memory.facts.push({ index: memory.facts.length, text: String(params.fact), struck: false });
    if (params.action === "editMemory")
      memory.facts[Number(params.index)].text = String(params.fact);
    return {};
  });
  return { memory, rpc: rpc as never as <T>(method: string, params?: object) => Promise<T>, calls: rpc };
}

const render = (host: ReturnType<typeof fakeHost>) => {
  const save = vi.fn(async () => {});
  act(() =>
    root.render(
      createElement(AssistantSettings, {
        value: null,
        catalog: { models: { codex: [{ id: "test", name: "Test", harness: "codex" }] }, errors: {} },
        projects: [],
        busy: false,
        onSave: save,
        memory: { rpc: host.rpc, revision: host.memory.revision, lines: host.memory.facts.length },
      }),
    ),
  );
  return save;
};
const button = (text: string) =>
  [...node.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
const settle = () => act(async () => {});
function type(field: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const enter = (field: HTMLInputElement) =>
  act(async () => {
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });

it("loads memory only when opened and edits it without submitting the settings form", async () => {
  const host = fakeHost();
  const save = render(host);
  expect(button("Memory").textContent).toContain("1 remembered facts");
  expect(host.calls).not.toHaveBeenCalled();
  act(() => button("Memory").click());
  await settle();
  expect(node.querySelector(".assistant-memory-list")?.textContent).toContain("Prefers pnpm");

  const add = node.querySelector<HTMLInputElement>('.assistant-memory-add input')!;
  type(add, "Deploys on Fridays are off");
  await enter(add);
  await settle();
  expect(save).not.toHaveBeenCalled();
  expect(add.value).toBe("");
  expect(node.querySelector(".assistant-memory-list")?.textContent).toContain("Deploys on Fridays are off");

  act(() => button("Edit").click());
  const edit = node.querySelector<HTMLInputElement>('.assistant-memory-list input')!;
  type(edit, "Prefers bun");
  await enter(edit);
  await settle();
  expect(host.calls).toHaveBeenCalledWith(
    "assistant.control",
    expect.objectContaining({ action: "editMemory", index: 0, fact: "Prefers bun", expectedRevision: 2 }),
  );
  expect(node.querySelector(".assistant-memory-list")?.textContent).toContain("Prefers bun");
  expect(save).not.toHaveBeenCalled();
});

it("shows a conflict and reloads instead of overwriting a newer memory", async () => {
  const host = fakeHost();
  render(host);
  act(() => button("Memory").click());
  await settle();
  host.memory.revision = 5; // The assistant wrote meanwhile.
  host.memory.facts[0].text = "Prefers yarn";
  act(() => button("Forget").click());
  await settle();
  expect(node.querySelector('[role="alert"]')?.textContent).toMatch(/changed elsewhere/);
  expect(node.querySelector(".assistant-memory-list")?.textContent).toContain("Prefers yarn");
});
