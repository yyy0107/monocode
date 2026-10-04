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
function render(open = true) {
  const onOpenChange = vi.fn();
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
        open,
        onOpenChange,
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
  return { onOpenChange, onSession, onSessionActions };
}
const row = () =>
  node.querySelector<HTMLButtonElement>('[data-session-id="recent"]')!;
function touch(type: string, y = 100, x = 100, target: Element = row()) {
  act(() =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        clientX: x,
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
  it("closes when the open panel is pushed from a session row, without opening it", () => {
    const { onOpenChange, onSession } = render();
    touch("pointerdown");
    touch("pointermove", 100, 60);
    touch("pointermove", 100, 20);
    touch("pointerup", 100, 20);
    act(() => row().click());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onSession).not.toHaveBeenCalled();
  });
  it("closes from a push that starts anywhere on screen, outside the drawer", () => {
    const { onOpenChange } = render();
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    touch("pointerdown", 100, 360, elsewhere);
    touch("pointermove", 100, 300, elsewhere);
    touch("pointermove", 100, 150, elsewhere);
    touch("pointerup", 100, 150, elsewhere);
    elsewhere.remove();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("follows a push that reverses mid-gesture and stays open", () => {
    const { onOpenChange } = render();
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const panel = node.querySelector<HTMLElement>(".mobile-drawer")!;
    touch("pointerdown", 100, 250);
    touch("pointermove", 100, 200);
    touch("pointermove", 100, 100);
    expect(panel.style.transform).toBe("translateX(-150px)");
    act(() => vi.advanceTimersByTime(100));
    touch("pointermove", 100, 230);
    expect(panel.style.transform).toBe("translateX(-20px)");
    touch("pointerup", 100, 230);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("keeps the browser from claiming a touch the drawer is dragging", () => {
    render();
    const move = () => {
      const event = new Event("touchmove", { bubbles: true, cancelable: true });
      act(() => row().dispatchEvent(event));
      return event.defaultPrevented;
    };
    touch("pointerdown");
    expect(move()).toBe(false);
    touch("pointermove", 100, 60);
    expect(move()).toBe(true);
    touch("pointerup", 100, 60);
    expect(move()).toBe(false);
  });
  it("leaves pushes on a sheet above the drawer alone", () => {
    const { onOpenChange } = render();
    const sheet = document.createElement("div");
    sheet.className = "mobile-sheet-backdrop";
    document.body.append(sheet);
    touch("pointerdown", 100, 300, sheet);
    touch("pointermove", 100, 100, sheet);
    touch("pointerup", 100, 100, sheet);
    sheet.remove();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("opens when the conversation is pulled from a button", () => {
    const { onOpenChange } = render(false);
    Object.defineProperty(node.querySelector(".mobile-drawer"), "offsetWidth", {
      value: 300,
    });
    const chat = document.createElement("main");
    chat.className = "mobile-chat";
    const tool = document.createElement("button");
    const clicked = vi.fn();
    tool.addEventListener("click", clicked);
    chat.append(tool);
    document.body.append(chat);
    touch("pointerdown", 100, 20, tool);
    touch("pointermove", 100, 80, tool);
    touch("pointermove", 100, 200, tool);
    touch("pointerup", 100, 200, tool);
    act(() => tool.click());
    chat.remove();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(clicked).not.toHaveBeenCalled();
  });
  it("leaves pulls that start in a text field alone", () => {
    const { onOpenChange } = render(false);
    const chat = document.createElement("main");
    chat.className = "mobile-chat";
    const field = document.createElement("textarea");
    chat.append(field);
    document.body.append(chat);
    touch("pointerdown", 100, 20, field);
    touch("pointermove", 100, 200, field);
    touch("pointerup", 100, 200, field);
    chat.remove();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
