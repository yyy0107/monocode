// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  platform: "android",
  http: vi.fn(),
  info: vi.fn(),
  permission: vi.fn(),
  install: vi.fn(),
  listener: vi.fn(),
  foreground: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => native.platform,
    isNativePlatform: () => native.platform !== "web",
  },
  CapacitorHttp: { get: native.http },
  registerPlugin: () => ({
    installPermission: native.permission,
    downloadAndInstall: native.install,
    addListener: native.listener,
  }),
}));
vi.mock("@capacitor/app", () => ({
  App: { getInfo: native.info, addListener: native.foreground },
}));
vi.mock("../shared/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (text: string, values?: Record<string, unknown>) =>
      text.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key])),
  }),
}));
import {
  checkMobileUpdate,
  parseMobileUpdate,
  hasMobileUpdate,
  updateBaseUrl,
} from "./updates";
import { MobileAppUpdates, useMobileAppUpdates } from "./MobileAppUpdates";

const manifest = {
  packageId: "com.monocode.mobile",
  versionName: "0.7.0",
  versionCode: 5,
  downloadPath: "/apk/monocode-5.apk",
  sha256: "a".repeat(64),
  size: 1234,
  publishedAt: "2026-10-03T12:00:00Z",
};
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
let root: Root | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  native.platform = "android";
  native.info.mockResolvedValue({ version: "0.7.0", build: "4" });
  native.http.mockResolvedValue({ status: 200, data: manifest });
  native.foreground.mockResolvedValue({ remove: native.remove });
  native.listener.mockResolvedValue({ remove: native.remove });
  native.permission.mockResolvedValue({ allowed: true });
  native.install.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  function TestApp() {
    const state = useMobileAppUpdates();
    return createElement(MobileAppUpdates, { state });
  }
  await act(async () => root!.render(createElement(TestApp)));
  return container;
}
// Match the label people see; a content swap keeps an aria-hidden exiting copy.
const label = (item: Element) => {
  const copy = item.cloneNode(true) as Element;
  copy.querySelectorAll("[aria-hidden='true']").forEach((node) => node.remove());
  return copy.textContent;
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((item) => label(item) === text)!;

describe("mobile app updates", () => {
  it("compares build codes even when the visible version stays the same", () => {
    expect(parseMobileUpdate(manifest)).toEqual(manifest);
    expect(hasMobileUpdate({ version: "0.7.0", build: 4 }, manifest)).toBe(
      true,
    );
    expect(hasMobileUpdate({ version: "0.7.0", build: 5 }, manifest)).toBe(
      false,
    );
    expect(hasMobileUpdate({ version: "0.7.0", build: 6 }, manifest)).toBe(
      false,
    );
  });
  it.each([
    { packageId: "other.app" },
    { downloadPath: "http://other/app.apk" },
    { downloadPath: "/apk/../app.apk" },
    { sha256: "bad" },
    { versionCode: 1.5 },
    { versionCode: -1 },
    { size: 0 },
    { publishedAt: "invalid" },
  ])("rejects invalid manifest %j", (change) => {
    expect(() => parseMobileUpdate({ ...manifest, ...change })).toThrow(
      "Invalid update information",
    );
  });
  it("checks the fixed HTTP source without requiring a Host login", async () => {
    expect(await checkMobileUpdate()).toEqual(manifest);
    expect(native.http.mock.calls[0][0]).toMatchObject({
      url: `${updateBaseUrl}/latest.json`,
    });
    expect(native.http.mock.calls[0][0].headers).toBeUndefined();
  });
  it("checks on app startup and foreground, and exposes the newer APK", async () => {
    const container = await mount();
    expect(container.textContent).toContain("A new version is available.");
    expect(container.textContent).toContain(updateBaseUrl);
    expect(native.http).toHaveBeenCalledTimes(1);
    await act(async () =>
      native.foreground.mock.calls[0][1]({ isActive: false }),
    );
    expect(native.http).toHaveBeenCalledTimes(1);
    await act(async () =>
      native.foreground.mock.calls[0][1]({ isActive: true }),
    );
    expect(native.http).toHaveBeenCalledTimes(2);
  });
  it("waits for Android install permission and lets the user retry after returning", async () => {
    native.permission.mockResolvedValueOnce({ allowed: false });
    const container = await mount();
    await act(async () => button(container, "Download and install").click());
    expect(native.install).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Allow MonoCode to install apps");
    await act(async () => button(container, "Download and install").click());
    expect(native.install).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${updateBaseUrl}${manifest.downloadPath}`,
        sha256: manifest.sha256,
        versionCode: 5,
      }),
    );
    expect(container.textContent).toContain(
      "Confirm the update in the Android installer.",
    );
    expect(native.remove).toHaveBeenCalled();
  });
  it("recovers from an offline update server and hides install when already current", async () => {
    native.http.mockRejectedValueOnce(new Error("offline"));
    const container = await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "offline",
    );
    native.info.mockResolvedValue({ version: "0.7.0", build: "5" });
    await act(async () => button(container, "Check for updates").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("You are up to date.");
    expect(button(container, "Download and install")).toBeUndefined();
  });
  it("does not offer an Android package for iOS", async () => {
    native.platform = "ios";
    const container = await mount();
    expect(container.textContent).toContain(
      "iOS updates require an Apple distribution channel.",
    );
    expect(native.http).not.toHaveBeenCalled();
    expect(container.querySelector("button")).toBeNull();
  });
  it("shows native download progress and prevents duplicate installation requests", async () => {
    let finish!: () => void;
    native.install.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const container = await mount();
    await act(async () => {
      button(container, "Download and install").click();
      button(container, "Download and install").click();
    });
    expect(native.install).toHaveBeenCalledTimes(1);
    await act(async () =>
      native.listener.mock.calls[0][1]({ received: 600, total: 1000 }),
    );
    expect(container.querySelector("progress")?.value).toBe(60);
    expect(container.textContent).toContain("Downloading… 60%");
    await act(async () => finish());
    expect(container.querySelector("progress")).toBeNull();
    expect(button(container, "Download and install").disabled).toBe(false);
  });
  it("allows retry after a native download fails", async () => {
    native.install.mockRejectedValueOnce(new Error("download interrupted"));
    const container = await mount();
    await act(async () => button(container, "Download and install").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "download interrupted",
    );
    expect(native.remove).toHaveBeenCalled();
    await act(async () => button(container, "Download and install").click());
    expect(native.install).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
