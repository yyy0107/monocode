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
  vi.restoreAllMocks();
});
function render(overrides: Record<string, unknown> = {}) {
  const node = document.createElement("div");
  document.body.append(node);
  const onSend = vi.fn();
  const onStop = vi.fn();
  const onFiles = vi.fn();
  const onProjectChange = vi.fn();
  let current = overrides;
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
      ...current,
    });
  }
  root = createRoot(node);
  act(() => root!.render(createElement(TestApp)));
  const button = (label: string) =>
    node.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const click = (label: string) => {
    if (button(label).closest('[aria-hidden="true"]'))
      act(() => node.querySelector("textarea")!.focus());
    act(() => {
      button(label).focus();
      button(label).click();
    });
  };
  const rerender = (next: Record<string, unknown>) => {
    current = { ...current, ...next };
    act(() => root!.render(createElement(TestApp)));
  };
  return { node, button, click, rerender, onSend, onStop, onFiles, onProjectChange };
}
describe("compact mobile composer", () => {
  it("keeps the send target still during a pointer press, then expands after sending", () => {
    const { node, button, onSend } = render();
    const form = node.querySelector("form")!;
    const send = button("Send message");
    act(() => send.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    act(() => send.focus());
    expect(form.dataset.collapsed).toBe("true");
    act(() => {
      send.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      send.click();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(form.dataset.collapsed).toBe("false");
  });

  it("starts as a single row with only the add and primary action, then expands when clicked", () => {
    const { node, button } = render({ planMode: true });
    const form = node.querySelector("form")!;
    expect(form.dataset.collapsed).toBe("true");
    expect(button("Add to message").hidden).toBe(false);
    expect(button("Send message").hidden).toBe(false);
    expect(button("Model and reasoning").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(button("Permissions: Supervised").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(button("Plan mode").closest('[aria-hidden="true"]')).not.toBeNull();
    act(() => form.click());
    expect(document.activeElement).toBe(node.querySelector("textarea"));
    expect(form.dataset.collapsed).toBe("false");
    expect(button("Model and reasoning").closest('[aria-hidden="true"]')).toBeNull();
    expect(button("Plan mode").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("collapses on outside focus and restores multiline drafts and attachments when focused again", () => {
    const draft = "First line\nSecond line\nThird line";
    const { node, button } = render({
      value: draft,
      attachments: [{ id: "one", name: "notes.txt", mimeType: "text/plain", kind: "file", size: 4 }],
    });
    const form = node.querySelector("form")!;
    const area = node.querySelector("textarea")!;
    const attachments = node.querySelector<HTMLElement>(".mobile-composer-attachment-region")!;
    vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(104);
    expect(attachments.getAttribute("aria-hidden")).toBe("true");
    act(() => area.focus());
    expect(form.dataset.collapsed).toBe("false");
    expect(area.style.height).toBe("104px");
    expect(attachments.getAttribute("aria-hidden")).toBe("false");
    expect(node.querySelectorAll("textarea")).toHaveLength(1);
    act(() => button("Add to message").focus());
    expect(form.dataset.collapsed).toBe("false");
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => outside.focus());
    expect(form.dataset.collapsed).toBe("true");
    expect(area.style.height).toBe("28px");
    expect(attachments.getAttribute("aria-hidden")).toBe("true");
    expect(area.value).toBe(draft);
    act(() => area.focus());
    expect(form.dataset.collapsed).toBe("false");
    expect(area.style.height).toBe("104px");
    expect(attachments.getAttribute("aria-hidden")).toBe("false");
    expect(area.value).toBe(draft);
  });

  it("stays expanded after choosing a sheet option while the change briefly disables it", () => {
    const { node, click, rerender } = render();
    const form = node.querySelector("form")!;
    click("Permissions: Supervised");
    const fullAccess = [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((row) => row.getAttribute("aria-checked") === "false")!;
    act(() => {
      fullAccess.focus();
      fullAccess.click();
    });
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(form.dataset.collapsed).toBe("false");
    rerender({ disabled: true });
    expect(form.dataset.collapsed).toBe("false");
    rerender({ disabled: false });
    expect(form.dataset.collapsed).toBe("false");
  });

  it("stays expanded when focus leaves for the system, such as a file picker", () => {
    const { node } = render();
    const form = node.querySelector("form")!;
    const area = node.querySelector("textarea")!;
    act(() => area.focus());
    act(() => area.blur());
    expect(form.dataset.collapsed).toBe("false");
  });

  it("collapses on an outside tap but not on an outside scroll gesture", () => {
    const { node } = render();
    const form = node.querySelector("form")!;
    const area = node.querySelector("textarea")!;
    const transcript = document.createElement("div");
    document.body.append(transcript);
    const pointer = (type: string, y: number) =>
      act(() => {
        transcript.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: 10, clientY: y }),
        );
      });
    act(() => area.focus());
    pointer("pointerdown", 100);
    pointer("pointerup", 160);
    expect(form.dataset.collapsed).toBe("false");
    pointer("pointerdown", 100);
    pointer("pointercancel", 100);
    pointer("pointerup", 100);
    expect(form.dataset.collapsed).toBe("false");
    pointer("pointerdown", 100);
    pointer("pointerup", 102);
    expect(form.dataset.collapsed).toBe("true");
    expect(document.activeElement).not.toBe(area);
    expect(area.value).toBe("Keep this draft");
  });

  it("allows drafting and queueing while running, keeps Stop available and locks model settings", () => {
    const { node, click, onSend, onStop, button } = render({ running: true, canStop: true, lockedAgent: true });
    expect(node.querySelector("textarea")!.disabled).toBe(false);
    expect(button("Model and reasoning").disabled).toBe(true);
    click("Queue message");
    expect(onSend).toHaveBeenCalledTimes(1);
    click("Stop");
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("keeps model controls in a sheet and closes it with Escape without losing the draft", () => {
    const { node, button, click } = render();
    expect(node.querySelector("dialog, [role=dialog]")).toBeNull();
    click("Model and reasoning");
    const sheet = node.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(sheet).not.toBeNull();
    expect(node.querySelector("form")!.dataset.collapsed).toBe("false");
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
    expect(node.querySelector("form")!.dataset.collapsed).toBe("false");
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
