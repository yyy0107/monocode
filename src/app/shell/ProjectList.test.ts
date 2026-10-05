// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectList } from "./ProjectList";
import {
  configureSharedHost,
  rememberRemoteProject,
  remoteProjectFor,
  sessionUsesHost,
} from "../../features/connections/model/remoteProjects";
import {
  useRemoteMachineOnline,
  useRemoteMachines,
} from "../../features/connections/model/connections";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (path: string) => path,
}));
vi.mock("../../features/source-control/hooks/useProjectDiffStats", () => ({
  useProjectDiffStats: () => null,
}));
vi.mock(
  "../../features/connections/model/connections",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../features/connections/model/connections")
    >()),
    useRemoteMachines: vi.fn(),
    useRemoteMachineOnline: vi.fn(),
  }),
);

const machine = {
  id: "computer",
  environmentId: "environment",
  name: "wy-ubuntu",
  endpoint: "http://127.0.0.1:3774",
};
const project = { id: "project", cwd: "/home/me/repo", name: "repo" };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  configureSharedHost(undefined, []);
  vi.mocked(useRemoteMachines)
    .mockReset()
    .mockReturnValue({ machines: [machine], loaded: true });
  vi.mocked(useRemoteMachineOnline).mockReset().mockReturnValue(true);
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

async function renderRail(path: string) {
  await act(async () =>
    root.render(
      createElement(ProjectList, {
        cwd: path,
        recents: [{ path, openedAt: 1 }],
        onSelectProject: vi.fn(),
        onOpenProject: vi.fn(),
      }),
    ),
  );
}

it.each([true, false])(
  "shows a local folder without remote decoration (registered: %s)",
  async (registered) => {
    configureSharedHost(
      machine.environmentId,
      registered ? [project] : [],
      machine.id,
    );
    await renderRail(project.cwd);

    const card = container.querySelector<HTMLButtonElement>(
      'button[aria-current="true"]',
    )!;
    expect(card).not.toBeNull();
    expect(card.textContent).toBe("repo");
    expect(card.title).toBe(`repo\n${project.cwd}`);
    expect(card.querySelector('[role="img"]')).toBeNull();
    expect(useRemoteMachines).toHaveBeenCalledWith(false);
    expect(useRemoteMachineOnline).toHaveBeenCalledWith(undefined);
    expect(remoteProjectFor(project.cwd)).toMatchObject({ local: true });
    expect(sessionUsesHost({ cwd: project.cwd })).toBe(true);
  },
);

it("keeps the machine label and connection badge for a remote path", async () => {
  const remote = rememberRemoteProject(machine.environmentId, project);
  await renderRail(remote.key);

  const card = container.querySelector<HTMLButtonElement>(
    'button[aria-current="true"]',
  )!;
  expect(card.textContent).toBe("repowy-ubuntu");
  expect(card.title).toContain(`${project.cwd} on wy-ubuntu (Connected)`);
  expect(
    card.querySelector('[role="img"][aria-label="Connected"]'),
  ).not.toBeNull();
  expect(useRemoteMachines).toHaveBeenCalledWith(true);
  expect(useRemoteMachineOnline).toHaveBeenCalledWith(machine.id);
});

it("keeps the connection badge for a remote path whose machine is unavailable", async () => {
  vi.mocked(useRemoteMachines).mockReturnValue({ machines: [], loaded: true });
  const remote = rememberRemoteProject(machine.environmentId, project);
  await renderRail(remote.key);

  expect(
    container.querySelector(
      '[role="img"][aria-label="Machine not connected on this computer"]',
    ),
  ).not.toBeNull();
});
