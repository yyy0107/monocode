// @vitest-environment happy-dom
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileComposer, type MobileComposerPanel } from "./MobileComposer";
import { setUiLanguage } from "../shared/i18n/language";
import { readMobileAttachments } from "./attachments";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
let root: Root | undefined;
beforeEach(() => setUiLanguage("en"));
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
function render(overrides: Record<string, unknown> = {}) {
  const node = document.createElement("div");
  document.body.append(node);
  const onSend = vi.fn();
  const onStop = vi.fn();
  const onFiles = vi.fn();
  const onProjectChange = vi.fn();
  function TestApp() {
    const [panel, setPanel] = useState<MobileComposerPanel>(null);
    const [planMode, setPlanMode] = useState(false);
    return createElement(MobileComposer, {
      value: "Keep this draft",
      onChange: vi.fn(),
      configuration: {
        harness: "codex",
        model: "codex:test",
        modelSettings: {},
        runtimeMode: "supervised",
      },
      lockedAgent: false,
      disabled: false,
      running: false,
      working: false,
      canSend: true,
      canStop: false,
      onConfigurationChange: vi.fn(),
      onSend,
      onStop,
      panel,
      onPanelChange: setPanel,
      catalog: {
        models: {
          codex: [{ id: "codex:test", name: "Test model", harness: "codex" }],
        },
        errors: {},
      },
      projects: [
        { id: "one", name: "monocode", cwd: "/projects/monocode" },
        { id: "two", name: "workbench", cwd: "/projects/workbench" },
      ],
      project: { id: "one", name: "monocode", cwd: "/projects/monocode" },
      onProjectChange,
      attachments: [],
      onFiles,
      onRemoveAttachment: vi.fn(),
      planMode,
      onPlanModeChange: setPlanMode,
      ...overrides,
    });
  }
  root = createRoot(node);
  act(() => root!.render(createElement(TestApp)));
  const button = (label: string) =>
    node.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const click = (label: string) =>
    act(() => {
      button(label).focus();
      button(label).click();
    });
  return { node, button, click, onSend, onStop, onFiles, onProjectChange };
}
describe("compact mobile composer", () => {
  it("keeps model controls in a sheet and closes it with Escape without losing the draft", () => {
    const { node, button, click } = render();
    expect(node.querySelector("dialog, [role=dialog]")).toBeNull();
    click("Model and reasoning");
    const sheet = node.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(sheet).not.toBeNull();
    expect(button("Model and reasoning").getAttribute("aria-expanded")).toBe(
      "true",
    );
    act(() =>
      sheet.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(node.querySelector("textarea")!.value).toBe("Keep this draft");
    expect(document.activeElement).toBe(button("Model and reasoning"));
  });
  it("uses a send button and Ctrl/Command+Enter while plain Enter stays a newline", () => {
    const { node, click, onSend } = render();
    const area = node.querySelector("textarea")!;
    act(() =>
      area.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(onSend).not.toHaveBeenCalled();
    act(() =>
      area.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(onSend).toHaveBeenCalledTimes(1);
    act(() =>
      area.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          isComposing: true,
          bubbles: true,
        }),
      ),
    );
    expect(onSend).toHaveBeenCalledTimes(1);
    click("Send message");
    expect(onSend).toHaveBeenCalledTimes(2);
  });
  it("replaces send with Stop while running and locks all configuration controls", () => {
    const onPlanModeChange = vi.fn();
    const { node, button, click, onStop } = render({
      running: true,
      disabled: true,
      canStop: true,
      planMode: true,
      onPlanModeChange,
    });
    expect(node.querySelector('[aria-label="Send message"]')).toBeNull();
    expect(node.querySelector("textarea")!.disabled).toBe(true);
    expect(button("Model and reasoning").disabled).toBe(true);
    expect(button("Add to message").disabled).toBe(true);
    expect(button("Plan mode").disabled).toBe(true);
    click("Plan mode");
    expect(onPlanModeChange).not.toHaveBeenCalled();
    click("Stop");
    expect(onStop).toHaveBeenCalledOnce();
  });
  it("enables plan mode through the add menu and can turn it off again", () => {
    const { node, click } = render();
    click("Add to message");
    act(() =>
      node.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
    );
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(node.querySelector(".mobile-composer-plan")).not.toBeNull();
    click("Plan mode");
    expect(node.querySelector('[role="dialog"]')).not.toBeNull();
    expect(node.querySelector(".mobile-composer-plan")).not.toBeNull();
    click("Turn off plan mode");
    expect(node.querySelector(".mobile-composer-plan")).toBeNull();
  });
  it("keeps an existing conversation's project fixed when opening the add menu", () => {
    const { node, click, onProjectChange } = render({ lockedAgent: true });
    click("Add to message");
    expect(node.querySelector('[aria-label="Choose project"]')).toBeNull();
    expect(onProjectChange).not.toHaveBeenCalled();
    expect(node.querySelector("textarea")!.value).toBe("Keep this draft");
  });
  it("accepts file selections and allows selecting the same file again", () => {
    const { node, onFiles } = render();
    const input = node.querySelector<HTMLInputElement>(
      'input[aria-label="Upload files"]',
    )!;
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");
  });
  it("reads file bytes without desktop APIs and rejects files beyond the Host limits", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    expect(await readMobileAttachments([file])).toEqual([
      expect.objectContaining({
        name: "notes.txt",
        data: "dGV4dA==",
        size: 4,
        mimeType: "text/plain",
        kind: "file",
      }),
    ]);
    await expect(readMobileAttachments(Array(21).fill(file))).rejects.toThrow(
      "20 files",
    );
    Object.defineProperty(file, "size", { value: 21 * 1024 * 1024 });
    await expect(readMobileAttachments([file])).rejects.toThrow("20 MB");
  });
});
