// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "./MobileApp";
import { setUiLanguage, UI_LANGUAGE_KEY } from "../shared/i18n/language";
import { ensureRandomUUID } from "./browserCrypto";
import { LIQUID_GLASS_SELECTOR } from "./liquidGlass";

const healthyStatus = vi.hoisted(() => ({
  state: "connected" as "connected" | "failed" | "disconnected",
}));
const host = vi.hoisted(() => ({
  getConnectionStatus: () => healthyStatus,
  subscribeConnectionStatus: () => () => {},
  verify: vi.fn(async () => {}),
  reconnect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  suspend: vi.fn(async () => {}),
  connection: { endpoint: "http://computer:3774", name: "My computer", environmentId: "settings-host", disabled: false },
  restore: vi.fn(async () => false),
  pending: vi.fn(async () => undefined),
  connect: vi.fn(async () => {}),
  projects: vi.fn(async () => [
    { id: "one", name: "Connections", cwd: "/projects/Connections" },
  ]),
  sessions: vi.fn(async () => []),
  models: vi.fn(async () => ({ models: {}, errors: {} })),
  cachedModels: () => undefined,
  providerAccounts: vi.fn(async () => ({})),
  activity: vi.fn(async () => ({ environmentId: "host", sessions: [] })),
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
  healthyStatus.state = "connected";
  host.connection.disabled = false;
  host.connect.mockResolvedValue(undefined);
  host.restore.mockResolvedValue(false);
  localStorage.clear();
  setUiLanguage("en");
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
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
    (item) => item.getAttribute("aria-label") === text || item.textContent?.trim() === text,
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
  it("opens glass controls on their own page and retains the selected effect when navigating back", async () => {
    await render();
    expect(node.querySelector("#mobile-glass-effect")).toBeNull();
    act(() => button("Glass").click());
    expect(node.querySelector("#mobile-theme")).toBeNull();
    expect(node.querySelector(".mobile-glass-preview")).not.toBeNull();
    act(() => node.querySelector<HTMLButtonElement>("#mobile-glass-effect")!.click());
    act(() => [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((item) => item.textContent?.trim() === "Solid")!.click());
    expect(node.querySelector<HTMLInputElement>("#mobile-glass-intensity")!.disabled).toBe(true);
    act(() => button("Back").click());
    expect(node.querySelector("#mobile-theme")).not.toBeNull();
    expect(node.querySelector("#mobile-glass-effect")).toBeNull();
    expect(button("Glass").textContent).toContain("Solid");
    act(() => button("Glass").click());
    expect(node.querySelector("#mobile-glass-effect")!.textContent).toBe("Solid");
  });

  async function openConnectedSettings() {
    host.restore.mockResolvedValue(true);
    await render();
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Home menu"]')!.click());
    await act(async () => button("Settings").click());
  }

  it("keeps Add connection in the device list and disconnects through its switch", async () => {
    await openConnectedSettings();
    const list = node.querySelector(".mobile-connection-list")!;
    expect(list.textContent).toContain("My computer");
    expect(list.textContent).toContain("Connected");
    expect(list.querySelector('[aria-label="Add connection"]')).not.toBeNull();
    const toggle = list.querySelector<HTMLInputElement>('[role="switch"]')!;
    expect(toggle.checked).toBe(true);
    await act(async () => toggle.click());
    expect(host.suspend).toHaveBeenCalledTimes(1);
    expect(host.disconnect).not.toHaveBeenCalled();
    expect(host.reconnect).not.toHaveBeenCalled();
  });

  it("keeps a switched-off connection in the list and reconnects using its saved settings", async () => {
    healthyStatus.state = "disconnected";
    host.connection.disabled = true;
    await openConnectedSettings();
    const list = node.querySelector(".mobile-connection-list")!;
    expect(list.textContent).toContain("Disconnected");
    const toggle = list.querySelector<HTMLInputElement>('[role="switch"]')!;
    expect(toggle.checked).toBe(false);
    const automaticReconnects = host.reconnect.mock.calls.length;
    await act(async () => toggle.click());
    expect(host.reconnect).toHaveBeenCalledTimes(automaticReconnects + 1);
    expect(host.disconnect).not.toHaveBeenCalled();
  });

  it("opens connection actions on a hold, edits the local alias and icon, and preserves the Host name", async () => {
    await openConnectedSettings();
    vi.useFakeTimers();
    const details = node.querySelector<HTMLButtonElement>(".mobile-connection-details")!;
    act(() => details.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 70, clientY: 140 })));
    act(() => vi.advanceTimersByTime(449));
    expect(node.querySelector('[role="dialog"][aria-label="Connection options"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(node.querySelector('[role="dialog"][aria-label="Connection options"]')).not.toBeNull();
    act(() => button("Edit").click());
    expect(node.querySelector('[role="dialog"][aria-label="Edit connection"]')).not.toBeNull();
    expect(button("Save").disabled).toBe(true);
    input(".mobile-connection-name-field input", "Workstation");
    act(() => button("Terminal").click());
    act(() => node.querySelector(".mobile-connection-editor")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(node.querySelector(".mobile-connection-name")!.textContent).toBe("Workstation");
    expect(node.querySelector(".mobile-header-title")!.textContent).toBe("MonoCode");
    expect(host.connection.name).toBe("My computer");
    expect(JSON.parse(localStorage.getItem("monocode.mobile.connectionAppearance:settings-host")!)).toEqual({ displayName: "Workstation", icon: "terminal" });
    vi.useRealTimers();
  });

  it("cancels long press when scrolling and keeps the switch separate from deletion", async () => {
    await openConnectedSettings();
    vi.useFakeTimers();
    const details = node.querySelector<HTMLButtonElement>(".mobile-connection-details")!;
    act(() => details.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 70, clientY: 140 })));
    act(() => details.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 70, clientY: 165 })));
    act(() => vi.advanceTimersByTime(500));
    expect(node.querySelector('[role="dialog"][aria-label="Connection options"]')).toBeNull();
    act(() => details.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
    act(() => button("Delete").click());
    expect(host.disconnect).not.toHaveBeenCalled();
    await act(async () => button("Delete connection").click());
    expect(host.disconnect).toHaveBeenCalledTimes(1);
    expect(host.suspend).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("opens the plain Home title dropdown and reuses the connection dialog anchored to that title", async () => {
    host.restore.mockResolvedValue(true);
    await render();
    const title = node.querySelector<HTMLButtonElement>('.mobile-header-title[data-capsule="false"]')!;
    expect(title.tagName).toBe("BUTTON");
    expect(title.matches(LIQUID_GLASS_SELECTOR)).toBe(false);
    expect(title.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { title.focus(); title.click(); });
    const menu = node.querySelector<HTMLElement>('[role="dialog"][aria-label="Home menu"]')!;
    expect(menu.closest(".mobile-sheet-backdrop")?.getAttribute("data-placement")).toBe("anchor");
    expect([...menu.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Add connection", "Settings"]);
    await act(async () => menu.querySelector<HTMLButtonElement>("button")!.click());
    const form = node.querySelector<HTMLElement>('[role="dialog"][aria-label="Add connection"]')!;
    expect(form).not.toBeNull();
    expect(form.classList.contains("mobile-sheet")).toBe(true);
    input('input[type="url"]', "http://next-computer:3774");
    input('input[type="password"]', "new-device-token");
    act(() => form.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(node.querySelector('[role="dialog"][aria-label="Add connection"]')).toBeNull();
    expect(document.activeElement).toBe(title);
    expect(host.connect).not.toHaveBeenCalled();
    expect(node.querySelector(".mobile-app")?.getAttribute("data-view")).toBe("home");
  });

  it("opens Settings from the Home dropdown and returns to Home with translated menu labels", async () => {
    host.restore.mockResolvedValue(true);
    await render();
    const title = () => node.querySelector<HTMLButtonElement>('[aria-label="Home menu"]')!;
    await act(async () => title().click());
    await act(async () => setUiLanguage("zh-CN"));
    const menu = node.querySelector<HTMLElement>('[role="dialog"][aria-label="首页菜单"]')!;
    expect([...menu.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["添加连接", "设置"]);
    await act(async () => menu.querySelectorAll<HTMLButtonElement>("button")[1].click());
    expect(node.querySelector(".mobile-app")?.getAttribute("data-view")).toBe("settings");
    expect(node.querySelector("header strong")?.textContent).toBe("MonoCode");
    await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="返回"]')!.click());
    expect(node.querySelector(".mobile-app")?.getAttribute("data-view")).toBe("home");
    expect(node.querySelector('.mobile-header-title')?.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the connection screen when LAN HTTP has no native randomUUID", async () => {
    const native = globalThis.crypto;
    const api = { getRandomValues: native.getRandomValues.bind(native) } as unknown as Crypto;
    vi.stubGlobal("crypto", api);
    ensureRandomUUID();
    await render();
    expect(button("Add connection")).toBeDefined();
    expect(api.randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

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
    expect(node.querySelector('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
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
    expect(node.querySelector("header strong")!.textContent).toBe("MonoCode");
    act(() => button("添加连接").click());
    input('input[type="url"]', "http://computer:3774");
    input('input[type="password"]', "device-token");
    act(() => setUiLanguage("en"));
    expect(
      node.querySelector('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')!.getAttribute("aria-label"),
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
    expect(node.querySelector('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    expect(appearance.textContent).toBe("Dark");
    expect(document.activeElement).toBe(appearance);
    act(() => appearance.click());
    act(() =>
      [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((item) => item.textContent?.trim() === "Light")!
        .click(),
    );
    expect(node.querySelector('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
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
    expect(node.querySelector('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    // A successful connection opens Home with the connected computer's projects.
    expect(node.querySelector(".mobile-app")?.getAttribute("data-view")).toBe("home");
    expect(node.querySelector("header strong")!.textContent).toBe("MonoCode");
    expect(node.querySelector(".mobile-home-project strong")!.textContent).toBe("Connections");
  });
});
