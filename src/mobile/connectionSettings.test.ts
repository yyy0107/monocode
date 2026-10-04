// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "./MobileApp";
import { setUiLanguage, UI_LANGUAGE_KEY } from "../shared/i18n/language";

const healthyStatus = vi.hoisted(() => ({ state: "connected" as const }));
const host = vi.hoisted(() => ({
  getConnectionStatus: () => healthyStatus,
  subscribeConnectionStatus: () => () => {},
  verify: vi.fn(async () => {}),
  reconnect: vi.fn(async () => {}),
  connection: { endpoint: "http://computer:3774", name: "My computer" },
  restore: vi.fn(async () => false),
  pending: vi.fn(async () => undefined),
  connect: vi.fn(async () => {}),
  projects: vi.fn(async () => [
    { id: "one", name: "Connections", cwd: "/projects/Connections" },
  ]),
}));
vi.mock("./client", () => ({
  MobileClient: vi.fn(function () {
    return host;
  }),
}));
vi.mock("./MobileAppUpdates", () => ({
  useMobileAppUpdates: () => ({}),
  MobileAppUpdates: () => null,
}));

let root: Root;
let node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host.connect.mockResolvedValue(undefined);
  localStorage.clear();
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  setUiLanguage("en");
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(createElement(MobileApp));
  });
}
function button(text: string) {
  return [...node.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  )!;
}
function open() {
  act(() => {
    button("Add connection").focus();
    button("Add connection").click();
  });
}
function input(selector: string, value: string) {
  const field = node.querySelector<HTMLInputElement>(selector)!;
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

describe("mobile connection settings", () => {
  it("keeps connection fields in a dialog and cancels without connecting", async () => {
    await render();
    expect(node.querySelector('input[type="url"], input[type="password"]')).toBeNull();
    open();
    input('input[type="url"]', "http://computer:3774");
    input('input[type="password"]', "device-token");
    act(() =>
      node
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(host.connect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Add connection"));
    open();
    expect(
      node.querySelector<HTMLInputElement>('input[type="url"]')!.value,
    ).toBe("http://computer:3774");
    expect(
      node.querySelector<HTMLInputElement>('input[type="password"]')!.value,
    ).toBe("");
  });

  it("switches and remembers language immediately without losing open form values", async () => {
    await render();
    const language = node.querySelector<HTMLButtonElement>("#mobile-language")!;
    act(() => {
      language.focus();
      language.click();
    });
    act(() => {
      [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((item) => item.textContent?.trim() === "简体中文")!
        .click();
    });
    expect(localStorage.getItem(UI_LANGUAGE_KEY)).toBe("zh-CN");
    expect(node.querySelector("header strong")!.textContent).toBe("连接");
    act(() => button("添加连接").click());
    input('input[type="url"]', "http://computer:3774");
    input('input[type="password"]', "device-token");
    act(() => setUiLanguage("en"));
    expect(
      node.querySelector('[role="dialog"]')!.getAttribute("aria-label"),
    ).toBe("Add connection");
    expect(
      node.querySelector<HTMLInputElement>('input[type="url"]')!.value,
    ).toBe("http://computer:3774");
    expect(
      node.querySelector<HTMLInputElement>('input[type="password"]')!.value,
    ).toBe("device-token");
    expect(host.connect).not.toHaveBeenCalled();
  });

  it("opens appearance from the keyboard, cancels without changes and saves a selected option", async () => {
    await render();
    const appearance = node.querySelector<HTMLButtonElement>("#mobile-theme")!;
    act(() => {
      appearance.focus();
      appearance.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    expect(
      node.querySelector('[role="radio"][aria-checked="true"]')!.textContent,
    ).toBe("Dark");
    act(() =>
      node
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(appearance.textContent).toBe("Dark");
    expect(document.activeElement).toBe(appearance);
    act(() => appearance.click());
    act(() =>
      [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((item) => item.textContent?.trim() === "Light")!
        .click(),
    );
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(appearance.textContent).toBe("Light");
    expect(localStorage.getItem("monocode-mobile-theme")).toBe("light");
  });

  it("retains failed connection input for retry and closes only after success", async () => {
    await render();
    open();
    input('input[type="url"]', "http://computer:3774");
    input('input[type="password"]', "device-token");
    host.connect.mockRejectedValueOnce(new Error("Host rejected this token"));
    await submit();
    expect(host.connect).toHaveBeenCalledWith(
      "http://computer:3774",
      "device-token",
    );
    expect(
      node.querySelector('[role="dialog"] [role="alert"]')!.textContent,
    ).toBe("Host rejected this token");
    expect(
      node.querySelector<HTMLInputElement>('input[type="password"]')!.value,
    ).toBe("device-token");
    act(() => setUiLanguage("zh-CN"));
    await submit();
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(node.querySelector("header strong")!.textContent).toBe("项目");
    expect(node.querySelector(".mobile-row-text strong")!.textContent).toBe(
      "Connections",
    );
  });
});
