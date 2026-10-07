// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarRail, SidebarTransition } from "./SidebarTransition";
import { useSurfaceVisibility } from "../../shared/ui/SurfaceVisibility";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(["sidebar", "rail"] as const)("retained %s content", (kind) => {
  it("defers the first mount, stops hidden parent updates and refreshes on reopening", () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    const rendered = vi.fn();
    function Content({ open, text }: { open: boolean; text: string }) {
      const visible = useSurfaceVisibility();
      rendered({ open, visible, text });
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return createElement("input", {
        defaultValue: "saved draft",
        "data-text": text,
      });
    }
    const setPaneRef = vi.fn();
    const finishDrag = vi.fn();
    const render = (open: boolean, text: string) =>
      act(() => {
        const children = createElement(Content, { open, text });
        root.render(
          kind === "rail"
            ? createElement(SidebarRail, { open, children })
            : createElement(SidebarTransition, {
                open,
                width: 280,
                dragging: false,
                setPaneRef,
                finishDrag,
                children,
              }),
        );
      });
    render(false, "initial");
    expect(mounted).not.toHaveBeenCalled();
    render(true, "first");
    const input = container.querySelector("input")!;
    input.value = "keep this edit";
    expect(mounted).toHaveBeenCalledOnce();

    render(false, "closing");
    expect(rendered).toHaveBeenLastCalledWith({
      open: false,
      visible: false,
      text: "closing",
    });
    expect(input.closest("[hidden]")).toBeNull();
    expect(input.closest("[inert]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(input.closest("[hidden]")).not.toBeNull();
    rendered.mockClear();
    render(false, "latest");
    expect(rendered).not.toHaveBeenCalled();
    expect(unmounted).not.toHaveBeenCalled();

    render(true, "latest");
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("keep this edit");
    expect(input.dataset.text).toBe("latest");
    expect(input.closest("[hidden], [inert]")).toBeNull();
    expect(mounted).toHaveBeenCalledOnce();
    expect(rendered).toHaveBeenLastCalledWith({
      open: true,
      visible: true,
      text: "latest",
    });
  });
});
