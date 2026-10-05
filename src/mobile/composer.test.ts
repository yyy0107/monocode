// @vitest-environment happy-dom
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileComposer, type MobileComposerPanel } from "./MobileComposer";
import { setUiLanguage } from "../shared/i18n/language";
import { readMobileAttachments } from "./attachments";
import { KEYBOARD_EVENT, installKeyboardMotion } from "./keyboardMotion";

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
function keyboard(height: number, duration = 285) {
  act(() =>
    window.dispatchEvent(
      new CustomEvent(KEYBOARD_EVENT, {
        detail: { height, viewport: 800, duration, easing: "linear(0, 1)" },
      }),
    ),
  );
}
function tapKeepingFocus(target: HTMLElement) {
  act(() => {
    for (const event of [
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
      }),
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    ]) {
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    target.click();
  });
}
describe("mobile composer popup focus", () => {
  it.each([
    "Add to message",
    "Model and reasoning",
    "Permissions: Supervised",
    "Plan mode",
  ])("keeps typing focus and the caret when opening and dismissing %s", (label) => {
    const { node, button } = render({ planMode: true });
    const area = node.querySelector("textarea")!;
    act(() => {
      area.focus();
      area.setSelectionRange(5, 9);
    });
    const blur = vi.fn();
    area.addEventListener("blur", blur);
    tapKeepingFocus(button(label));
    const sheet = node.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(sheet).not.toBeNull();
    expect(document.activeElement).toBe(area);
    expect(sheet.getAttribute("aria-modal")).not.toBe("true");
    tapKeepingFocus(node.querySelector<HTMLElement>(".mobile-sheet-backdrop")!);
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(area);
    expect([area.selectionStart, area.selectionEnd]).toEqual([5, 9]);
    expect(area.value).toBe("Keep this draft");
    expect(blur).not.toHaveBeenCalled();
  });

  it("keeps typing focus through model and reasoning submenus and option changes", () => {
    const onConfigurationChange = vi.fn();
    const { node, button } = render({
      onConfigurationChange,
      catalog: {
        models: {
          codex: [{
            id: "codex:test",
            name: "Test model",
            harness: "codex",
            settings: [{
              id: "reasoningEffort",
              label: "Reasoning",
              kind: "select",
              value: "high",
              options: [
                { value: "low", label: "Low" },
                { value: "high", label: "High" },
              ],
            }],
          }],
        },
        errors: {},
      },
    });
    const area = node.querySelector("textarea")!;
    act(() => area.focus());
    const blur = vi.fn();
    area.addEventListener("blur", blur);
    const row = (text: string) => [...node.querySelectorAll<HTMLButtonElement>(".mobile-sheet-row")]
      .find((element) => element.querySelector("strong")?.textContent === text)!;
    tapKeepingFocus(button("Model and reasoning"));
    tapKeepingFocus(row("Model"));
    tapKeepingFocus(row("Test model"));
    tapKeepingFocus(row("Reasoning effort"));
    tapKeepingFocus(row("Low"));
    expect(onConfigurationChange).toHaveBeenLastCalledWith(expect.objectContaining({
      modelSettings: { reasoningEffort: "low" },
    }));
    expect(document.activeElement).toBe(area);
    expect(blur).not.toHaveBeenCalled();
  });

  it("closes with Escape from the input and allows Tab to enter popup navigation", () => {
    const { node, button } = render();
    const area = node.querySelector("textarea")!;
    act(() => area.focus());
    tapKeepingFocus(button("Add to message"));
    act(() => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(area);

    tapKeepingFocus(button("Add to message"));
    const rows = [...node.querySelectorAll<HTMLButtonElement>(".mobile-sheet-row:not(:disabled)")];
    act(() => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement).toBe(rows[0]);
    act(() => rows[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(rows.at(-1));
    act(() => rows.at(-1)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(area);
  });
});
describe("mobile composer with the Android keyboard", () => {
  it("changes shape when the keyboard starts moving, on the keyboard's timing", () => {
    vi.useFakeTimers();
    const uninstall = installKeyboardMotion();
    try {
      keyboard(0, 0);
      const { node } = render();
      const form = node.querySelector("form")!;
      const area = node.querySelector("textarea")!;
      act(() => area.focus());
      expect(form.dataset.collapsed).toBe("true");
      keyboard(300);
      expect(form.dataset.collapsed).toBe("false");
      expect(form.style.getPropertyValue("--mobile-composer-duration")).toBe("285ms");
      // The keyboard's curve may overshoot; the capsule keeps its own.
      expect(form.style.getPropertyValue("--mobile-composer-easing")).toBe("");
      expect(document.documentElement.style.getPropertyValue("--mobile-keyboard-height")).toBe(
        "300px",
      );

      const outside = document.createElement("button");
      document.body.append(outside);
      act(() => outside.focus());
      expect(form.dataset.collapsed).toBe("false");
      keyboard(0, 240);
      expect(form.dataset.collapsed).toBe("true");
      expect(form.style.getPropertyValue("--mobile-composer-duration")).toBe("240ms");
    } finally {
      uninstall();
      vi.useRealTimers();
    }
  });
  it("keeps the borrowed keyboard duration within the capsule's range", () => {
    vi.useFakeTimers();
    const uninstall = installKeyboardMotion();
    try {
      keyboard(0, 0);
      const { node } = render();
      const form = node.querySelector("form")!;
      act(() => node.querySelector("textarea")!.focus());
      keyboard(300, 900);
      expect(form.dataset.collapsed).toBe("false");
      expect(form.style.getPropertyValue("--mobile-composer-duration")).toBe("420ms");
    } finally {
      uninstall();
      vi.useRealTimers();
    }
  });
  it("expands on its own when no keyboard appears", () => {
    vi.useFakeTimers();
    const uninstall = installKeyboardMotion();
    try {
      keyboard(0, 0);
      const { node } = render();
      const form = node.querySelector("form")!;
      act(() => node.querySelector("textarea")!.focus());
      expect(form.dataset.collapsed).toBe("true");
      act(() => vi.advanceTimersByTime(400));
      expect(form.dataset.collapsed).toBe("false");
      expect(form.style.getPropertyValue("--mobile-composer-duration")).toBe("");
    } finally {
      uninstall();
      vi.useRealTimers();
    }
  });
});
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

  it("keeps controls and attachments mounted through collapse and settles the single-line preview at the end", () => {
    const { node } = render({
      value: "First line\nSecond line",
      attachments: [{ id: "one", name: "notes.txt", mimeType: "text/plain", kind: "file", size: 4 }],
    });
    const form = node.querySelector("form")!;
    const area = node.querySelector("textarea")!;
    const regions = [...node.querySelectorAll<HTMLElement>(".mobile-composer-controls, .mobile-composer-attachment-region")];
    act(() => area.focus());
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => outside.focus());
    expect(area.dataset.compact).toBe("false");
    for (const region of regions) {
      expect(region.hidden).toBe(false);
      expect(region.dataset.collapsed).toBe("true");
      expect(region.getAttribute("aria-hidden")).toBe("true");
      expect(region.inert).toBe(true);
    }
    const settle = () => {
      // happy-dom exposes TransitionEvent as Event and drops propertyName.
      const event = new Event("transitionend", { bubbles: true });
      Object.defineProperty(event, "propertyName", { value: "padding-bottom" });
      act(() => form.dispatchEvent(event));
    };
    settle();
    expect(area.dataset.compact).toBe("true");
    act(() => area.focus());
    // A late completion from the previous collapse must not compact the field.
    settle();
    expect(area.dataset.compact).toBe("false");
    expect(area.value).toBe("First line\nSecond line");
  });

  it("measures the final expanded width once and only remeasures when the dock width changes", () => {
    const observers: { callback: () => void; observe: ReturnType<typeof vi.fn> }[] = [];
    const resize = vi.spyOn(globalThis, "ResizeObserver").mockImplementation(function (callback) {
      const observer = { callback: () => callback([], {} as ResizeObserver), observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      observers.push(observer);
      return observer;
    });
    const measuredWidths: string[] = [];
    vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) {
      measuredWidths.push(this.style.width);
      return this.style.width === "336px" ? 80 : 120;
    });
    const { node } = render();
    const form = node.querySelector("form")!;
    const area = node.querySelector("textarea")!;
    const dock = node.querySelector<HTMLElement>(".mobile-composer-dock")!;
    dock.style.padding = "8px 16px";
    form.style.border = "1px solid";
    const width = vi.spyOn(dock, "clientWidth", "get").mockReturnValue(394);
    const formWidth = vi.spyOn(form, "clientWidth", "get").mockReturnValue(328);
    act(() => area.focus());
    const dockObservers = observers.filter((item) => item.observe.mock.calls.some(([target]) => target === dock));
    expect(dockObservers).toHaveLength(2);
    const notifyResize = () => act(() => dockObservers.forEach((item) => item.callback()));
    expect(measuredWidths).toEqual(["336px"]);
    expect(area.style.height).toBe("80px");
    formWidth.mockReturnValue(344);
    notifyResize();
    formWidth.mockReturnValue(360);
    notifyResize();
    expect(measuredWidths).toEqual(["336px"]);
    width.mockReturnValue(334);
    notifyResize();
    expect(measuredWidths).toEqual(["336px", "276px"]);
    expect(area.style.height).toBe("120px");
    expect(node.querySelectorAll("textarea")).toHaveLength(1);
    resize.mockRestore();
  });

  it("settles immediately when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { node } = render();
    const area = node.querySelector("textarea")!;
    act(() => area.focus());
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => outside.focus());
    expect(area.dataset.compact).toBe("true");
    expect(area.style.height).toBe("28px");
  });

  it("lets sent attachments exit smoothly and cancels their removal if new files arrive", () => {
    vi.useFakeTimers();
    try {
      const attachment = { id: "one", name: "notes.txt", mimeType: "text/plain", kind: "file", size: 4 };
      const { node, rerender } = render({ attachments: [attachment] });
      act(() => node.querySelector("textarea")!.focus());
      rerender({ value: "", attachments: [] });
      const region = node.querySelector<HTMLElement>(".mobile-composer-attachment-region")!;
      expect(region.dataset.collapsed).toBe("true");
      expect(region.inert).toBe(true);
      expect(region.textContent).toContain("notes.txt");
      act(() => vi.advanceTimersByTime(140));
      rerender({ attachments: [{ ...attachment, id: "two", name: "new.txt" }] });
      act(() => vi.advanceTimersByTime(280));
      expect(region.dataset.collapsed).toBe("false");
      expect(region.textContent).toContain("new.txt");
      rerender({ attachments: [] });
      act(() => vi.advanceTimersByTime(280));
      expect(node.querySelector(".mobile-composer-attachment-region")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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
