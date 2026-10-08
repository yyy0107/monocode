// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { configureSharedHost } from "../model/remoteProjects";
import { ConnectionsPage } from "./ConnectionsPage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
const phone = { id: "phone", name: "My phone", admin: false, manufacturer: "Samsung", model: "SM-S9280" };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  configureSharedHost("local", [], "computer");
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command, input) => {
    const { method } = input as { method: string };
    if (command === "remote_request" && method === "devices.list")
      return {
        devices: [
          { id: "desktop", name: "Desktop credential", admin: true },
          phone,
        ],
      };
    if (command === "remote_request" && method === "devices.revoke")
      return { revoked: true };
    throw new Error(`Unexpected operation: ${command} ${method}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  configureSharedHost(undefined, []);
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function render(strict = false) {
  const page = createElement(ConnectionsPage);
  await act(async () =>
    root.render(strict ? createElement(StrictMode, null, page) : page),
  );
}

const refreshButton = () =>
  container.querySelector<HTMLButtonElement>('button[aria-label="Refresh"]')!;
const button = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  )!;

it("loads controlling devices and revokes access after StrictMode effect replay", async () => {
  await render(true);
  expect(invoke).toHaveBeenCalledWith("remote_request", {
    machineId: "computer",
    method: "devices.list",
    params: {},
  });
  expect(container.textContent).toContain("My phone");
  expect(container.textContent).toContain("Samsung SM-S9280 · Never connected");
  expect(container.textContent).not.toContain("Desktop credential");
  expect(container.textContent).not.toContain("Loading devices…");
  expect(refreshButton().disabled).toBe(false);

  await act(async () => button("Revoke access").click());
  await act(async () => button("Confirm revoke").click());
  expect(invoke).toHaveBeenCalledWith("remote_request", {
    machineId: "computer",
    method: "devices.revoke",
    params: { deviceId: "phone" },
  });
  expect(container.textContent).not.toContain("My phone");
  expect(container.textContent).toContain("No devices yet.");
});

it("stops loading after a failed list and lets refresh retry the request", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error("Host unavailable"));
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Host unavailable",
  );
  expect(container.textContent).not.toContain("Loading devices…");
  expect(container.textContent).not.toContain("No devices yet.");
  expect(refreshButton().disabled).toBe(false);

  let finish!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () => new Promise((resolve) => { finish = resolve; }),
  );
  await act(async () => refreshButton().click());
  expect(container.textContent).toContain("Loading devices…");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(refreshButton().disabled).toBe(true);
  await act(async () => finish({ devices: [] }));
  expect(container.textContent).toContain("No devices yet.");
  expect(container.textContent).not.toContain("Loading devices…");
  expect(refreshButton().disabled).toBe(false);
});

it("shows the unavailable service state without requesting devices", async () => {
  configureSharedHost(undefined, []);
  await render(true);
  expect(container.textContent).toContain(
    "The conversation service on this computer is not running.",
  );
  expect(container.textContent).not.toContain("Loading devices…");
  expect(refreshButton().disabled).toBe(true);
  expect(button("Add").disabled).toBe(true);
  expect(invoke).not.toHaveBeenCalled();
});
