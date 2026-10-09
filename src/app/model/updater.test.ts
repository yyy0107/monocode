// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveUpdatePreferences } from "./updatePreferences";

const mocks = vi.hoisted(() => ({
  announce: vi.fn(),
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  getVersion: vi.fn(),
  message: vi.fn(),
  relaunch: vi.fn(),
  remember: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.getVersion }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  message: mocks.message,
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("../../features/settings/model/sounds", () => ({
  announceUpdateAvailable: mocks.announce,
}));
vi.mock("./updateNotice", () => ({ rememberInstalledUpdate: mocks.remember }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
  mocks.getVersion.mockResolvedValue("0.1.22");
  mocks.relaunch.mockResolvedValue(undefined);
  mocks.message.mockResolvedValue(undefined);
});

async function updaterWithPendingUpdate() {
  const update = {
    version: "0.1.23",
    body: "### Fixed\n\n- Update preview.",
    date: "2026-09-30T12:00:00Z",
    downloadAndInstall: mocks.downloadAndInstall,
  };
  mocks.check.mockResolvedValue(update);
  const updater = await import("./updater");
  await updater.probeForUpdate();
  return updater;
}

describe("installPendingUpdate", () => {
  it("keeps release notes and date through download progress", async () => {
    mocks.downloadAndInstall.mockImplementation(async (onProgress) => {
      onProgress({ event: "Started", data: { contentLength: 100 } });
      onProgress({ event: "Progress", data: { chunkLength: 42 } });
    });
    const updater = await updaterWithPendingUpdate();
    const progress = vi.fn();
    await updater.installPendingUpdate(progress);
    expect(progress).toHaveBeenCalledTimes(3);
    for (const [snapshot] of progress.mock.calls) {
      expect(snapshot).toMatchObject({
        phase: "downloading",
        availableVersion: "0.1.23",
        releaseNotes: "### Fixed\n\n- Update preview.",
        releaseDate: "2026-09-30T12:00:00Z",
      });
    }
    expect(progress.mock.lastCall?.[0].progress).toBe(42);
  });

  it("records a successful installation before relaunching", async () => {
    mocks.downloadAndInstall.mockResolvedValue(undefined);
    const updater = await updaterWithPendingUpdate();

    await updater.installPendingUpdate();

    expect(mocks.remember).toHaveBeenCalledWith("0.1.23");
    expect(mocks.relaunch).toHaveBeenCalledOnce();
    expect(mocks.remember.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.relaunch.mock.invocationCallOrder[0]!,
    );
  });

  it("does not record or relaunch after installation fails", async () => {
    mocks.downloadAndInstall.mockRejectedValue(new Error("install failed"));
    const updater = await updaterWithPendingUpdate();

    const result = await updater.installPendingUpdate();

    expect(result.phase).toBe("error");
    expect(mocks.remember).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });

  it("does not record when no update is pending", async () => {
    const updater = await import("./updater");

    expect((await updater.installPendingUpdate()).phase).toBe("idle");
    expect(mocks.remember).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
});

it("includes feed notes and date when an update check finds a release", async () => {
  const updater = await updaterWithPendingUpdate();
  const snapshot = await updater.runUpdateFlow(false);
  expect(snapshot).toMatchObject({
    phase: "available",
    availableVersion: "0.1.23",
    releaseNotes: "### Fixed\n\n- Update preview.",
    releaseDate: "2026-09-30T12:00:00Z",
  });
});

it("silently ignores the skipped version on automatic probes but allows later versions", async () => {
  saveUpdatePreferences({ skippedVersion: "0.1.23", autoInstall: true });
  mocks.check.mockResolvedValue({ version: "0.1.23" });
  const updater = await import("./updater");
  expect(await updater.probeForUpdate()).toBeNull();
  expect(mocks.announce).not.toHaveBeenCalled();
  expect((await updater.installPendingUpdate()).phase).toBe("idle");
  mocks.check.mockResolvedValue({ version: "0.1.24" });
  expect(await updater.probeForUpdate()).toMatchObject({ version: "0.1.24" });
  expect(mocks.announce).toHaveBeenCalledExactlyOnceWith("0.1.24");
});

it("keeps skipped releases available to a manual update check", async () => {
  saveUpdatePreferences({ skippedVersion: "0.1.23" });
  mocks.check.mockResolvedValue({ version: "0.1.23" });
  const updater = await import("./updater");
  expect(await updater.runUpdateFlow(true)).toMatchObject({
    phase: "available",
    availableVersion: "0.1.23",
  });
});
