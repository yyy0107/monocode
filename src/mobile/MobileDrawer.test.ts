// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostSessionSummary } from "../features/connections/model/protocol";
import { setUiLanguage } from "../shared/i18n/language";
import { MobileDrawer } from "./MobileDrawer";

let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function render() {
  const onSession = vi.fn();
  const onSessionActions = vi.fn();
  const base: HostSessionSummary = {
    id: "recent",
    title: "Recent conversation",
    projectId: "project",
    harness: "codex",
    status: "idle",
    revision: 1,
    updatedAt: 100,
  };
  act(() =>
    root.render(
      createElement(MobileDrawer, {
        open: true,
        onOpenChange: () => {},
        projects: [],
        project: { id: "project", name: "Project", cwd: "/project" },
        sessions: [
          base,
          { ...base, id: "pinned", title: "Pinned conversation", pinned: true },
          {
            ...base,
            id: "archived",
            title: "Archived conversation",
            archived: true,
          },
        ],
        loading: false,
        unreadIds: new Set<string>(),
        now: 100,
        hostName: "Host",
        hostStatus: { state: "connected" },
        projectTrigger: { current: null },
        onProject: () => {},
        onAddProject: () => {},
        onSession,
        onSessionActions,
        onNewSession: () => {},
        onSettings: () => {},
      }),
    ),
  );
  return { onSession, onSessionActions };
}
const row = () =>
  node.querySelector<HTMLButtonElement>('[data-session-id="recent"]')!;
function touch(type: string, y = 100) {
  act(() =>
    row().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        clientX: 100,
        clientY: y,
      }),
    ),
  );
}
describe("mobile sidebar sessions", () => {
  it("separates pinned conversations from recent ones and hides archives", () => {
    render();
    expect(
      [...node.querySelectorAll(".mobile-section-label")].map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(["Pin", "Recent"]);
    expect(
      [...node.querySelectorAll(".mobile-session-list")].map(
        (el) => el.querySelector("strong")?.textContent,
      ),
    ).toEqual(["Pinned conversation", "Recent conversation"]);
    expect(node.textContent).not.toContain("Archived conversation");
  });
  it("opens a conversation on a short tap", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    act(() => vi.advanceTimersByTime(200));
    touch("pointerup");
    act(() => row().click());
    act(() => vi.advanceTimersByTime(500));
    expect(onSession).toHaveBeenCalledWith("recent");
    expect(onSessionActions).not.toHaveBeenCalled();
  });
  it("opens actions on a hold and suppresses the release tap, then accepts a fresh tap", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    act(() => vi.advanceTimersByTime(450));
    expect(onSessionActions).toHaveBeenCalledExactlyOnceWith("recent", row(), {
      x: 100,
      y: 100,
    });
    touch("pointerup");
    act(() => row().click());
    expect(onSession).not.toHaveBeenCalled();
    touch("pointerdown");
    touch("pointerup");
    act(() => row().click());
    expect(onSession).toHaveBeenCalledOnce();
  });
  it("leaves scroll gestures to the list without opening actions or navigating", () => {
    const { onSession, onSessionActions } = render();
    touch("pointerdown");
    touch("pointermove", 160);
    act(() => vi.advanceTimersByTime(500));
    touch("pointerup", 160);
    act(() => row().click());
    expect(onSessionActions).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
  });
  it("cancels a hold when the touch is cancelled or the drawer unmounts", () => {
    const { onSessionActions } = render();
    touch("pointerdown");
    touch("pointercancel");
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
    touch("pointerdown");
    act(() => root.render(null));
    act(() => vi.advanceTimersByTime(500));
    expect(onSessionActions).not.toHaveBeenCalled();
  });
  it("offers the same actions from a context menu without opening the conversation", () => {
    const { onSession, onSessionActions } = render();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 72,
      clientY: 112,
    });
    act(() => row().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onSessionActions).toHaveBeenCalledWith("recent", row(), {
      x: 72,
      y: 112,
    });
    expect(onSession).not.toHaveBeenCalled();
  });
});
