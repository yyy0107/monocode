// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSessionActions } from "./MobileSessionActions";
import { setUiLanguage } from "../shared/i18n/language";
import type { HostSession } from "../features/connections/model/protocol";

const clipboard = vi.hoisted(() => ({ copyText: vi.fn(async () => {}) }));
vi.mock("./transcriptPlatform", () => ({
  mobileTranscriptPlatform: clipboard,
}));
let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setUiLanguage("en");
  vi.clearAllMocks();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});
function render(
  options: { running?: boolean; pinned?: boolean; draft?: boolean } = {},
) {
  const snapshot: HostSession = {
    projectId: "project",
    revision: 1,
    status: options.running ? "running" : "idle",
    updatedAt: 1,
    pinned: options.pinned,
    session: {
      id: "session",
      title: "Conversation",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks: [],
      providerSessionId: "provider-session",
    },
  };
  const trigger = document.createElement("button");
  node.append(trigger);
  const onUpdate = vi.fn(async (_patch: object) => {});
  const onDelete = vi.fn(async () => {});
  const onClose = vi.fn();
  const onNew = vi.fn();
  act(() =>
    root.render(
      createElement(MobileSessionActions, {
        snapshot: options.draft ? undefined : snapshot,
        anchor: { current: trigger },
        disabled: false,
        onUpdate,
        onDelete,
        onClose,
        onNew,
      }),
    ),
  );
  return { onUpdate, onDelete, onClose, onNew };
}
function button(text: string) {
  return [...node.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === text,
  )!;
}
function click(text: string) {
  act(() => button(text).click());
}
function input(value: string) {
  const field = node.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("mobile session management", () => {
  it.each([false, true])(
    "toggles persisted pin state from %s",
    async (pinned) => {
      const { onUpdate, onClose } = render({ pinned });
      await act(async () => button(pinned ? "Unpin" : "Pin").click());
      expect(onUpdate).toHaveBeenCalledWith({ pinned: !pinned });
      expect(onClose).toHaveBeenCalledOnce();
    },
  );
  it("keeps a failed rename open for retry and submits only a trimmed title", async () => {
    const { onUpdate, onClose } = render();
    click("Rename");
    input("  My new title  ");
    onUpdate.mockRejectedValueOnce(new Error("Host is offline"));
    await submit();
    expect(onUpdate).toHaveBeenCalledWith({ title: "My new title" });
    expect(node.querySelector('[role="alert"]')!.textContent).toBe(
      "Host is offline",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(node.querySelector("input")!.value).toBe("  My new title  ");
    await submit();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("requires delete confirmation, supports cancellation and deduplicates repeated taps", async () => {
    const { onDelete, onClose } = render();
    click("Delete");
    expect(onDelete).not.toHaveBeenCalled();
    click("Cancel");
    expect(onDelete).not.toHaveBeenCalled();
    click("Delete");
    let finish!: () => void;
    onDelete.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    act(() => {
      button("Delete").click();
      button("Delete").click();
    });
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("disables deleting a running session", () => {
    const { onDelete } = render({ running: true });
    expect(button("Delete").disabled).toBe(true);
    click("Delete");
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("validates GitHub URLs and saves the same canonical metadata as desktop", async () => {
    const { onUpdate } = render();
    click("Link GitHub issue or PR…");
    input("https://example.com/issues/42");
    await submit();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(node.querySelector('[role="alert"]')).not.toBeNull();
    input("https://github.com/acme/monocode/issues/42");
    await submit();
    expect(onUpdate).toHaveBeenCalledWith({
      linkedWorkItem: {
        kind: "issue",
        repo: "acme/monocode",
        number: 42,
        url: "https://github.com/acme/monocode/issues/42",
      },
    });
  });
  it.each([
    ["Harness session ID", "provider-session"],
    ["MonoCode session ID", "session"],
  ])("copies the requested %s", async (label, value) => {
    render();
    click("Copy session ID");
    await act(async () => button(label).click());
    expect(clipboard.copyText).toHaveBeenCalledWith(value);
  });
  it("keeps new conversation available before the first message is saved", () => {
    const { onUpdate, onDelete, onNew } = render({ draft: true });
    expect(button("Delete")).toBeUndefined();
    expect(button("Rename")).toBeUndefined();
    click("New conversation");
    expect(onNew).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
