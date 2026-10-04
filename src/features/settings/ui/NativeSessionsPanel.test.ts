// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  sync: vi.fn(),
  import: vi.fn(),
  auto: vi.fn(),
  desktop: true,
  state: {
    files: [
      {
        provider: "codex",
        providerSessionId: "c-id",
        cwd: "/codex-project",
        path: "/codex.jsonl",
        revision: "1",
        modifiedAt: 100,
      },
      {
        provider: "pi",
        providerSessionId: "p-id",
        cwd: "/pi-project",
        path: "/pi.jsonl",
        revision: "1",
        modifiedAt: 100,
      },
    ],
    warnings: [],
    busy: false,
    error: undefined as string | undefined,
  },
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => mocks.desktop }));
vi.mock("../../sessions/data/nativeSessions", () => ({
  discoverNativeSessions: mocks.discover,
  syncNativeSessions: mocks.sync,
  importNativeSession: mocks.import,
  nativeSessionSnapshot: () => mocks.state,
  subscribeNativeSessions: () => () => {},
  nativeAutoSyncEnabled: () => true,
  setNativeAutoSync: mocks.auto,
}));
import { NativeSessionsPanel } from "./NativeSessionsPanel";
import { setUiLanguage } from "../../../shared/i18n/language";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.desktop = true;
  mocks.state.error = undefined;
  vi.clearAllMocks();
  mocks.discover.mockResolvedValue([]);
  mocks.import.mockResolvedValue("existing-id");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  setUiLanguage("en");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  setUiLanguage("en");
  vi.unstubAllGlobals();
});
it("filters by provider, imports the selected source and opens its saved conversation", async () => {
  const open = vi.fn();
  await act(async () =>
    root.render(createElement(NativeSessionsPanel, { onOpenSession: open })),
  );
  expect(mocks.discover).toHaveBeenCalledOnce();
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "pi";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.textContent).not.toContain("/codex-project");
  expect(container.textContent).toContain("/pi-project");
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === "Import / refresh",
  )!;
  await act(async () => button.click());
  expect(mocks.import).toHaveBeenCalledWith(mocks.state.files[1]);
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((node) => node.textContent === "Open")!
      .click(),
  );
  expect(open).toHaveBeenCalledWith("existing-id");
});
it("switches to Chinese without changing native provider values and persists the sync preference", async () => {
  await act(async () => root.render(createElement(NativeSessionsPanel)));
  await act(async () => setUiLanguage("zh-CN"));
  expect(container.textContent).toContain("原生会话");
  expect(container.textContent).toContain("Codex");
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click(),
  );
  expect(mocks.auto).toHaveBeenCalledWith(false);
});
it("does not attempt unsupported browser import", async () => {
  mocks.desktop = false;
  await act(async () => root.render(createElement(NativeSessionsPanel)));
  expect(mocks.discover).not.toHaveBeenCalled();
  expect(container.textContent).toContain("desktop app");
});
