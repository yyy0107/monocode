// @vitest-environment happy-dom
import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "./MobileApp";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { AttachmentChip } from "../features/sessions/ui/AttachmentChip";
import { setUiLanguage, UI_LANGUAGE_KEY } from "../shared/i18n/language";
import { ensureRandomUUID } from "./browserCrypto";
import { LIQUID_GLASS_SELECTOR } from "./liquidGlass";

const nativeBack = vi.hoisted(() => ({
  listener: undefined as (() => void) | undefined,
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (event: string, listener: () => void) => {
      if (event === "backButton") nativeBack.listener = listener;
      return { remove: async () => {} };
    },
    exitApp: vi.fn(),
  },
}));

const healthyStatus = vi.hoisted(() => ({
  state: "connected" as "connected" | "failed" | "disconnected",
}));
const host = vi.hoisted(() => ({
  hasCapability: () => false,
  getConnectionStatus: () => healthyStatus,
  subscribeConnectionStatus: () => () => {},
  verify: vi.fn(async () => {}),
  reconnect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  suspend: vi.fn(async () => {}),
  connection: { endpoint: "http://computer:3774", name: "My computer", environmentId: "settings-host", disabled: false },
  restore: vi.fn(async () => false),
  pending: vi.fn(async () => undefined),
  savedConnections: vi.fn(async () => []),
  switchTo: vi.fn(async () => undefined),
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
  nativeBack.listener = undefined;
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
  vi.restoreAllMocks();
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
function active<T extends Element = HTMLElement>(selector: string): T | null {
  return [...node.querySelectorAll<T>(selector)]
    .find(item => !item.closest('[inert]')) ?? null;
}
function finishClosingSheet(dialog: Element) {
  const backdrop = dialog.closest<HTMLElement>(".mobile-sheet-backdrop")!;
  expect(backdrop.dataset.foldState).toBe("closing");
  expect(backdrop.hasAttribute("inert")).toBe(true);
  act(() => backdrop.dispatchEvent(new Event("animationend", { bubbles: true })));
  expect(dialog.isConnected).toBe(false);
}
function button(text: string) {
  return [...node.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => !item.closest('[inert]') &&
      (item.getAttribute("aria-label") === text || item.textContent?.trim() === text),
  )!;
}
function chooseMethod(label: string) {
  act(() =>
    [...node.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((item) => !item.closest("[inert]") && item.textContent?.trim() === label)!
      .click(),
  );
}
function open() {
  act(() => {
    button("Add connection").focus();
    button("Add connection").click();
  });
  chooseMethod("Pairing code");
}
function input(selector: string, value: string) {
  const field = active<HTMLInputElement>(selector)!;
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
  it.each(["native", "close button", "backdrop"])("preserves the current page when an image closes via %s, then lets Back navigate", async (closeMode) => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    await act(async () => {
      root.render(createElement(Fragment, null,
        createElement(MobileApp),
        createElement(AttachmentChip, { attachment: {
          id: "preview", kind: "image", name: "photo.png",
          mimeType: "image/png", size: 42, previewUrl: "blob:photo",
        } }),
      ));
    });
    act(() => button("Glass").click());
    act(() => button("Open photo.png full screen").click());
    const preview = document.querySelector<HTMLElement>(".image-lightbox")!;
    expect(preview).not.toBeNull();

    act(() => {
      if (closeMode === "native") nativeBack.listener!();
      else if (closeMode === "close button")
        preview.querySelector<HTMLButtonElement>(".image-lightbox-close")!.click();
      else preview.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector(".image-lightbox")).toBeNull();
    expect(active("header strong")?.textContent).toBe("Glass");
    expect(App.exitApp).not.toHaveBeenCalled();

    act(() => nativeBack.listener!());
    expect(active("header strong")?.textContent).toBe("MonoCode");
    expect(App.exitApp).not.toHaveBeenCalled();
  });

  it.each(["header", "native"])("opens Glass from the root and returns with %s back, retaining glass settings", async (backMode) => {
    if (backMode === "native")
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const back = () => act(() => {
      if (backMode === "native") nativeBack.listener!();
      else button("Back").click();
    });
    await render();
    expect(active("#mobile-follow-up, #mobile-glass-effect")).toBeNull();
    expect(active("#mobile-theme")!.textContent).toBe("Dark");
    expect(active("#mobile-language")).not.toBeNull();
    expect(button("Notifications").querySelector(".mobile-settings-value")?.textContent).toBe("Off");
    const rootPage = active("#mobile-theme")!.closest(".mobile-page-layer")!;
    act(() => button("Glass").click());
    expect(active("header strong")?.textContent).toBe("Glass");
    expect(rootPage.hasAttribute("inert")).toBe(true);
    expect(active("#mobile-theme")).toBeNull();
    act(() => rootPage.dispatchEvent(new Event("animationend", { bubbles: true })));
    expect(rootPage.isConnected).toBe(false);
    expect(active(".mobile-glass-preview")).not.toBeNull();
    act(() => active<HTMLButtonElement>("#mobile-glass-effect")!.click());
    act(() => [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(item => !item.closest('[inert]')).find((item) => item.textContent?.trim() === "Solid")!.click());
    expect(active<HTMLInputElement>("#mobile-glass-intensity")!.disabled).toBe(true);
    act(() => active<HTMLButtonElement>("#mobile-glass-effect")!.click());
    back();
    expect(active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    if (backMode === "native") {
      expect(active("header strong")?.textContent).toBe("Glass");
      back();
    }
    expect(active("header strong")?.textContent).toBe("MonoCode");
    expect(active("#mobile-theme")).not.toBeNull();
    expect(active("#mobile-glass-effect")).toBeNull();
    expect(button("Glass").textContent).toContain("Solid");
    act(() => button("Glass").click());
    expect(active("#mobile-glass-effect")!.textContent).toBe("Solid");
    expect(active("#mobile-glass-effect")!.getAttribute("aria-expanded")).toBe("false");
    back();
    expect(active("#mobile-glass-effect")).toBeNull();
    expect(active("header strong")?.textContent).toBe("MonoCode");
  });

  it("shows the installed version and opens app updates from the About menu", async () => {
    await render();
    act(() => button("About").click());
    const about = active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')!;
    expect(about.getAttribute("aria-label")).toBe("About");
    expect(about.querySelector(".mobile-about-version")?.textContent).toContain("MonoCode");
    act(() => [...about.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.trim() === "App updates")!.click());
    expect(active("header strong")?.textContent).toBe("App updates");
  });

  async function openConnectedSettings() {
    host.restore.mockResolvedValue(true);
    await render();
    await act(async () => active<HTMLButtonElement>('[aria-label="Home menu"]')!.click());
    await act(async () => button("Settings").click());
  }

  it("opens Accounts and usage from Settings and returns with native Back", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    await openConnectedSettings();
    await act(async () => button("Accounts and usage").click());
    expect(active("header strong")?.textContent).toBe("Accounts and usage");
    expect(active(".mobile-provider-accounts")?.textContent).toContain("My computer");
    await act(async () => nativeBack.listener?.());
    expect(active("header strong")?.textContent).toBe("MonoCode");
    expect(button("Accounts and usage")).toBeDefined();
  });

  it("keeps Add connection in the device list and disconnects through its switch", async () => {
    await openConnectedSettings();
    const list = active(".mobile-connection-list")!;
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
    const list = active(".mobile-connection-list")!;
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
    const details = active<HTMLButtonElement>(".mobile-connection-details")!;
    act(() => details.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 70, clientY: 140 })));
    act(() => vi.advanceTimersByTime(449));
    expect(active('[role="dialog"][aria-label="Connection options"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(active('[role="dialog"][aria-label="Connection options"]')).not.toBeNull();
    act(() => button("Edit").click());
    expect(active('[role="dialog"][aria-label="Edit connection"]')).not.toBeNull();
    expect(button("Save").disabled).toBe(true);
    input(".mobile-connection-name-field input", "Workstation");
    act(() => button("Terminal").click());
    act(() => active(".mobile-connection-editor")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(active(".mobile-connection-name")!.textContent).toBe("Workstation");
    expect(active(".mobile-header-title")!.textContent).toBe("MonoCode");
    expect(host.connection.name).toBe("My computer");
    expect(JSON.parse(localStorage.getItem("monocode.mobile.connectionAppearance:settings-host")!)).toEqual({ displayName: "Workstation", icon: "terminal" });
    vi.useRealTimers();
  });

  it("cancels long press when scrolling and keeps the switch separate from deletion", async () => {
    await openConnectedSettings();
    vi.useFakeTimers();
    const details = active<HTMLButtonElement>(".mobile-connection-details")!;
    act(() => details.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 70, clientY: 140 })));
    act(() => details.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 70, clientY: 165 })));
    act(() => vi.advanceTimersByTime(500));
    expect(active('[role="dialog"][aria-label="Connection options"]')).toBeNull();
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
    const title = active<HTMLButtonElement>('.mobile-header-title[data-capsule="false"]')!;
    expect(title.tagName).toBe("BUTTON");
    expect(title.matches(LIQUID_GLASS_SELECTOR)).toBe(false);
    expect(title.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { title.focus(); title.click(); });
    const menu = active<HTMLElement>('[role="dialog"][aria-label="Home menu"]')!;
    expect(menu.closest(".mobile-sheet-backdrop")?.getAttribute("data-placement")).toBe("anchor");
    expect([...menu.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Add connection", "Settings"]);
    await act(async () => menu.querySelector<HTMLButtonElement>("button")!.click());
    const form = active<HTMLElement>('[role="dialog"][aria-label="Add connection"]')!;
    expect(form).not.toBeNull();
    expect(form.classList.contains("mobile-sheet")).toBe(true);
    chooseMethod("Pairing code");
    input('input[type="url"]', "http://next-computer:3774");
    input('input.mobile-pairing-code', "new-device-token");
    act(() => form.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(active('[role="dialog"][aria-label="Add connection"]')).toBeNull();
    finishClosingSheet(form);
    expect(document.activeElement).toBe(title);
    expect(host.connect).not.toHaveBeenCalled();
    expect(active(".mobile-app")?.getAttribute("data-view")).toBe("home");
  });

  it("opens Settings from the Home dropdown and returns to Home with translated menu labels", async () => {
    host.restore.mockResolvedValue(true);
    await render();
    const title = () => active<HTMLButtonElement>('[aria-label="Home menu"]')!;
    await act(async () => title().click());
    await act(async () => setUiLanguage("zh-CN"));
    const menu = active<HTMLElement>('[role="dialog"][aria-label="首页菜单"]')!;
    expect([...menu.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["添加连接", "设置"]);
    await act(async () => menu.querySelectorAll<HTMLButtonElement>("button")[1].click());
    expect(active(".mobile-app")?.getAttribute("data-view")).toBe("settings");
    expect(active("header strong")?.textContent).toBe("MonoCode");
    await act(async () => active<HTMLButtonElement>('[aria-label="返回"]')!.click());
    expect(active(".mobile-app")?.getAttribute("data-view")).toBe("home");
    expect(active('.mobile-header-title')?.getAttribute("aria-expanded")).toBe("false");
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
    expect(active('input[type="url"], input.mobile-pairing-code')).toBeNull();
    open();
    input('input[type="url"]', "http://computer:3774");
    input('input.mobile-pairing-code', "device-token");
    act(() =>
      node
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    expect(host.connect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Add connection"));
    open();
    expect(
      active<HTMLInputElement>('input[type="url"]')!.value,
    ).toBe("http://computer:3774");
    expect(
      active<HTMLInputElement>('input.mobile-pairing-code')!.value,
    ).toBe("");
  });

  it("switches and remembers language immediately without losing open form values", async () => {
    await render();
    const language = active<HTMLButtonElement>("#mobile-language")!;
    act(() => {
      language.focus();
      language.click();
    });
    act(() => {
      [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(item => !item.closest('[inert]'))
        .find((item) => item.textContent?.trim() === "简体中文")!
        .click();
    });
    expect(localStorage.getItem(UI_LANGUAGE_KEY)).toBe("zh-CN");
    expect(active("header strong")!.textContent).toBe("MonoCode");
    expect(active("#mobile-theme")!.textContent).toBe("深色");
    expect(button("通知").querySelector(".mobile-settings-value")?.textContent).toBe("关闭");
    expect(button("编写器").querySelector(".mobile-settings-value")?.textContent).toBe("引导");
    act(() => button("添加连接").click());
    chooseMethod("配对码");
    input('input[type="url"]', "http://computer:3774");
    input('input.mobile-pairing-code', "device-token");
    act(() => setUiLanguage("en"));
    expect(
      active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')!.getAttribute("aria-label"),
    ).toBe("Add connection");
    expect(
      active<HTMLInputElement>('input[type="url"]')!.value,
    ).toBe("http://computer:3774");
    expect(
      active<HTMLInputElement>('input.mobile-pairing-code')!.value,
    ).toBe("device-token");
    expect(host.connect).not.toHaveBeenCalled();
  });

  it("opens the color mode dialog from the keyboard, cancels without changes and saves a selected option", async () => {
    await render();
    const appearance = active<HTMLButtonElement>("#mobile-theme")!;
    act(() => {
      appearance.focus();
      appearance.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    expect(
      active('[role="radio"][aria-checked="true"]')!.textContent,
    ).toBe("Dark");
    expect(
      active('.mobile-sheet-backdrop[data-placement="dialog"] .mobile-sheet-title')?.textContent,
    ).toBe("Color mode");
    act(() =>
      node
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    expect(appearance.textContent).toBe("Dark");
    expect(document.activeElement).toBe(appearance);
    act(() => appearance.click());
    act(() =>
      [...node.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(item => !item.closest('[inert]'))
        .find((item) => item.textContent?.trim() === "Light")!
        .click(),
    );
    expect(active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    expect(appearance.textContent).toBe("Light");
    expect(localStorage.getItem("monocode-mobile-theme")).toBe("light");
    expect(active("#mobile-theme")!.textContent).toBe("Light");
  });

  it("retains failed connection input for retry and closes only after success", async () => {
    await render();
    open();
    input('input[type="url"]', "http://computer:3774");
    input('input.mobile-pairing-code', "device-token");
    host.connect.mockRejectedValueOnce(new Error("Host rejected this token"));
    await submit();
    expect(host.connect).toHaveBeenCalledWith(
      "http://computer:3774",
      "device-token",
    );
    expect(
      active('[role="dialog"] [role="alert"]')!.textContent,
    ).toBe("Host rejected this token");
    expect(
      active<HTMLInputElement>('input.mobile-pairing-code')!.value,
    ).toBe("device-token");
    act(() => setUiLanguage("zh-CN"));
    await submit();
    expect(active('.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]')).toBeNull();
    // A successful connection opens Home on the connected computer.
    expect(active(".mobile-app")?.getAttribute("data-view")).toBe("home");
    expect(active("header strong")!.textContent).toBe("MonoCode");
    expect(active(".mobile-home-host")!.textContent).toContain("My computer");
  });
});
