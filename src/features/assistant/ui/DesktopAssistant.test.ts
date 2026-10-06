// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesktopAssistant } from "./DesktopAssistant";
import { fullAssistantPolicy, type AssistantMessage } from "../model/assistant";
import { configureSharedHost, remoteProjectFor } from "../../connections/model/remoteProjects";
import { setSharedSessionBackend } from "../../sessions/data/sharedSessionBackend";
import { setUiLanguage } from "../../../shared/i18n/language";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  refresh: vi.fn(),
  hosts: [{ id: "machine", environmentId: "host", name: "Host", endpoint: "" }],
}));
vi.mock("../../connections/model/connections", () => ({
  remoteRequest: (...args: unknown[]) => mocks.rpc(...args),
  refreshRemoteProjectSessions: () => mocks.refresh(),
  useRemoteMachines: () => ({ machines: mocks.hosts }),
}));
vi.mock("./AssistantWorkerDetails", () => ({
  AssistantWorkerDetails: () => createElement("div", null, "Read-only worker"),
}));

const project = { id: "project", name: "Project", cwd: "/work/project" };
const card: Extract<AssistantMessage, { kind: "session-card" }> = {
  kind: "session-card", id: "card", revision: 1, createdAt: 1,
  ref: { environmentId: "host", projectId: "project", sessionId: "target" },
  title: "Play music", projectName: "Project", harness: "pi", model: "test",
  actionId: "action", status: "completed",
};
let root: Root, node: HTMLDivElement;
let view: { policy: ReturnType<typeof fullAssistantPolicy> };
let getSession: () => Promise<unknown>;
const local = vi.fn(), remote = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.clearAllMocks();
  local.mockReset();
  remote.mockReset();
  localStorage.clear();
  setUiLanguage("en");
  configureSharedHost("host", [], "machine");
  view = {
    id: "assistant", name: "Assistant", revision: 1, lifecycle: "idle",
    enabled: true, brainGeneration: 1,
    triggers: { user: true, event: true, schedule: true },
    policy: fullAssistantPolicy(),
  } as typeof view;
  getSession = async () => ({ projectId: project.id, session: { id: "target" } });
  mocks.rpc.mockImplementation(async (_machine: string, method: string) => {
    switch (method) {
      case "environment.describe": return { capabilities: ["assistant.v1"] };
      case "assistant.get": return view;
      case "assistant.messages": return { entries: [card], nextRevision: 1, hasMore: false };
      case "models.list": return { models: {}, errors: {} };
      case "projects.list": return [project];
      case "sessions.get": return getSession();
      default: return [];
    }
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  configureSharedHost(undefined, []);
  setSharedSessionBackend(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}
async function render() {
  const props = {
    onSelectMachine: () => {}, onLocalSession: local, onRemoteSession: remote,
  };
  act(() => root.render(createElement(DesktopAssistant, props)));
  await flush();
  mocks.rpc.mockClear();
  return node.querySelector<HTMLButtonElement>(".assistant-card button")!;
}
const requests = (method: string) => mocks.rpc.mock.calls.filter((call) => call[1] === method);

it("shows loading immediately, prevents repeat opens and reuses the validated local target", async () => {
  let finish!: () => void;
  local.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const button = await render();
  act(() => {
    button.click();
    button.click();
  });
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.textContent).toBe("Opening…");
  expect(button.querySelector("svg.animate-spin.motion-reduce\\:animate-none")).not.toBeNull();
  await flush();
  expect(requests("assistant.get")).toHaveLength(1);
  expect(requests("projects.list")).toHaveLength(1);
  expect(requests("sessions.get")).toHaveLength(1);
  expect(local).toHaveBeenCalledExactlyOnceWith("target", project.cwd);
  expect(remoteProjectFor(project.cwd)?.projectId).toBe(project.id);
  expect(button.disabled).toBe(true);
  await act(async () => finish());
  expect(button.disabled).toBe(false);
  expect(button.hasAttribute("aria-busy")).toBe(false);
  expect(button.textContent).toBe("Open session");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("clears loading after a failed open and allows retry", async () => {
  getSession = async () => { throw new Error("Conversation is unavailable"); };
  const button = await render();
  act(() => button.click());
  await flush();
  expect(button.disabled).toBe(false);
  expect(node.textContent).toContain("Conversation is unavailable");
  expect(local).not.toHaveBeenCalled();
  getSession = async () => ({ projectId: project.id, session: { id: "target" } });
  act(() => button.click());
  await flush();
  expect(local).toHaveBeenCalledOnce();
  expect(node.textContent).not.toContain("Conversation is unavailable");
});

it("rechecks permission before reading or opening the target", async () => {
  const button = await render();
  view = { ...view, policy: { ...fullAssistantPolicy(), allowedProjects: [] } };
  act(() => button.click());
  await flush();
  expect(requests("sessions.get")).toHaveLength(0);
  expect(local).not.toHaveBeenCalled();
  expect(remote).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
  expect(node.textContent).toContain("outside the assistant's current permissions");
});

it("reuses the validated target for remote navigation", async () => {
  configureSharedHost(undefined, []);
  const button = await render();
  act(() => button.click());
  await flush();
  expect(remote).toHaveBeenCalledExactlyOnceWith("remote://host/work/project", "target");
  expect(local).not.toHaveBeenCalled();
  expect(requests("projects.list")).toHaveLength(1);
  expect(requests("sessions.get")).toHaveLength(1);
});

it("keeps orchestration workers in the read-only detail view", async () => {
  getSession = async () => ({
    projectId: project.id, session: { id: "target", orchestrationLeadId: "lead" },
  });
  const button = await render();
  act(() => button.click());
  await flush();
  expect(node.textContent).toContain("Read-only worker");
  expect(local).not.toHaveBeenCalled();
  expect(remote).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
});
