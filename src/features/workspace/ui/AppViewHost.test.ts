// @vitest-environment happy-dom
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppViewHost,
  AppViewRendererContext,
  type AppViewRenderer,
} from "./AppViewHost";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(renderView: AppViewRenderer, visible: boolean, focused = true) {
  act(() => root.render(createElement(
    AppViewRendererContext.Provider,
    { value: renderView },
    createElement(AppViewHost, { kind: "search", visible, focused }),
  )));
}

describe("AppViewHost", () => {
  it("waits for first visibility and distinguishes focus from visibility", () => {
    const renderer = vi.fn((_kind, active) => createElement("div", null, String(active)));
    render(renderer, false);
    expect(renderer).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
    render(renderer, true, false);
    expect(renderer).toHaveBeenLastCalledWith("search", false);
    render(renderer, true, true);
    expect(renderer).toHaveBeenLastCalledWith("search", true);
  });

  it("freezes renderer updates while hidden and resumes with current props", () => {
    const before = vi.fn((_kind, active) => createElement("div", null, `old:${active}`));
    const after = vi.fn((_kind, active) => createElement("div", null, `new:${active}`));
    render(before, true);
    render(before, false);
    expect(before).toHaveBeenCalledTimes(2);
    expect(before).toHaveBeenLastCalledWith("search", false);
    render(after, false);
    expect(after).not.toHaveBeenCalled();
    expect(container.textContent).toBe("old:false");
    render(after, true);
    expect(after).toHaveBeenLastCalledWith("search", true);
    expect(container.textContent).toBe("new:true");
  });

  it("keeps local view state and its mounted instance across tab switches", () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function View({ active }: { active: boolean }) {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return createElement("button", {
        "data-active": active,
        onClick: () => setCount((value) => value + 1),
      }, String(count));
    }
    const renderer: AppViewRenderer = (_kind, active) => createElement(View, { active });
    render(renderer, true);
    const button = container.querySelector("button")!;
    act(() => button.click());
    expect(button.textContent).toBe("1");
    render(renderer, false);
    render((_kind, active) => createElement(View, { active }), false);
    render(renderer, true);
    expect(container.querySelector("button")).toBe(button);
    expect(button.textContent).toBe("1");
    expect(button.dataset.active).toBe("true");
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });
});
