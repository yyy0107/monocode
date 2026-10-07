// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HostCommand,
  HostModelCatalog,
  HostProviderAccounts,
  HostSession,
} from "../features/connections/model/protocol";
import { HARNESS_TITLE } from "../features/sessions/model/session";
import { setUiLanguage } from "../shared/i18n/language";
import { MobileApp } from "./MobileApp";
import {
  loadMobileAgentDefaults,
  saveMobileAgentDefaults,
} from "./agentDefaults";

const project = vi.hoisted(() => ({
  id: "project",
  name: "Project",
  cwd: "/project",
}));
const catalog = vi.hoisted((): HostModelCatalog => ({
  models: {
    codex: [
      {
        harness: "codex",
        id: "codex:first",
        name: "First",
        settings: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            kind: "select",
            value: "medium",
            options: [
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
        ],
      },
      {
        harness: "codex",
        id: "codex:chosen",
        name: "Chosen",
        settings: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            kind: "select",
            value: "medium",
            options: [
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
        ],
      },
    ],
    claude: [
      {
        harness: "claude",
        id: "claude:test",
        name: "Claude model",
        settings: [
          {
            id: "effort",
            label: "Effort",
            kind: "select",
            value: "low",
            options: [
              { value: "low", label: "Low" },
              { value: "high", label: "High" },
            ],
          },
        ],
      },
    ],
  },
  errors: {},
}));
const accounts = vi.hoisted((): HostProviderAccounts => ({
  codex: [
    { id: "default", label: "Default account" },
    { id: "work", label: "Work account" },
  ],
  claude: [
    { id: "default", label: "Default account" },
    { id: "personal", label: "Personal account" },
  ],
}));
const snapshot = vi.hoisted((): HostSession => ({
  projectId: "project",
  revision: 1,
  updatedAt: 1,
  status: "idle",
  session: {
    id: "session",
    title: "Existing conversation",
    cwd: "/project",
    harness: "codex",
    model: "codex:first",
    modelSettings: { reasoningEffort: "medium" },
    providerAccountId: "original",
    runtimeMode: "supervised",
    blocks: [],
  },
}));
const healthyStatus = vi.hoisted(() => ({ state: "connected" as const }));
const host = vi.hoisted(() => ({
  connection: {
    endpoint: "http://computer:3774",
    name: "Computer",
    environmentId: "defaults-one",
  },
  getConnectionStatus: () => healthyStatus,
  subscribeConnectionStatus: () => () => {},
  restore: vi.fn(async () => true),
  verify: vi.fn(async () => {}),
  pending: vi.fn(async () => undefined),
  projects: vi.fn(async () => [project]),
  sessions: vi.fn(async (): Promise<any[]> => []),
  models: vi.fn(async (_project?: string, _refresh?: boolean) => catalog),
  providerAccounts: vi.fn(
    async (): Promise<HostProviderAccounts | null> => accounts,
  ),
  cachedModels: vi.fn(
    (_project?: string): HostModelCatalog | undefined => undefined,
  ),
  cachedSession: () => undefined,
  sessionPreviews: async () => undefined,
  session: vi.fn(async () => snapshot),
  uploadAttachments: vi.fn(async () => []),
  rpc: vi.fn(async () => null),
  dispatch: vi.fn(async (command: HostCommand) => ({
    commandId: command.commandId,
    sessionId: "session",
    revision: 2,
  })),
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
vi.mock("./useMobileActivity", () => ({
  useMobileActivity: () => ({
    unreadIds: new Set(),
    permission: "unsupported",
    enabled: false,
  }),
}));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  localStorage.clear();
  setUiLanguage("en");
  host.connection = {
    endpoint: "http://computer:3774",
    name: "Computer",
    environmentId: "defaults-one",
  };
  host.projects.mockResolvedValue([project]);
  host.sessions.mockResolvedValue([]);
  host.models.mockResolvedValue(catalog);
  host.providerAccounts.mockResolvedValue(accounts);
  host.cachedModels.mockReturnValue(undefined);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(createElement(MobileApp)));
}
// Exiting pages remain mounted during their transition but are not interactive.
function current<T extends Element = HTMLElement>(selector: string): T | null {
  return [...node.querySelectorAll<T>(selector)].find((element) =>
    !element.closest('[data-page-active="false"]')) ?? null;
}
function dialog() {
  return current<HTMLElement>(
    '.mobile-sheet-backdrop:not([aria-hidden="true"]) [role="dialog"]',
  )!;
}
async function click(label: string, scope: Element = node) {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      !button.closest('[inert], [aria-hidden="true"], [data-page-active="false"]') &&
      (button.getAttribute("aria-label") === label ||
        button.textContent?.trim() === label ||
        button.querySelector("strong")?.textContent === label ||
        button.querySelector(":scope > span")?.textContent === label),
  );
  expect(button, label).toBeDefined();
  expect(button!.disabled, label).toBe(false);
  await act(async () => button!.click());
}
async function settings(fromChat = false) {
  await click(fromChat ? "Menu" : "Home menu");
  await click(
    "Settings",
    fromChat ? current(".mobile-drawer")! : dialog(),
  );
  await click("New conversations");
}
async function leaveSettings() {
  await click("Back", current("header")!);
  await click("Back", current("header")!);
}
async function defaultsPanel() {
  const group = current('[aria-label="New conversations"]')!;
  await act(async () =>
    group
      .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
      .click(),
  );
}
async function choose(row: string, value: string) {
  await click(row, dialog());
  await click(value, dialog());
}
async function dismiss() {
  await act(async () =>
    dialog().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
}
async function input(text: string) {
  await act(async () => {
    const field = current("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function send() {
  await act(async () =>
    current("form.mobile-composer")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
function saveChosen(hostId = "defaults-one") {
  saveMobileAgentDefaults(hostId, {
    harness: "codex",
    agents: {
      codex: {
        model: "codex:chosen",
        modelSettings: { reasoningEffort: "high" },
        accountId: "work",
      },
      claude: {
        model: "claude:test",
        modelSettings: { effort: "high" },
        accountId: "personal",
      },
    },
  });
}

describe("mobile Agent defaults settings and new conversations", () => {
  it("configures without projects, remembers each Agent, localizes labels and preserves account names", async () => {
    host.projects.mockResolvedValue([]);
    await render();
    await settings();
    expect(host.models).toHaveBeenCalledWith(undefined, false);
    await defaultsPanel();
    await choose("Model", "Chosen");
    await choose("Reasoning effort", "High");
    await choose("Agent", HARNESS_TITLE.claude);
    await choose("Reasoning effort", "High");
    await choose("Agent", HARNESS_TITLE.codex);
    expect(dialog().textContent).toContain("Chosen");
    expect(dialog().textContent).toContain("High");
    await dismiss();
    await click("Codex account");
    await click("Work account", dialog());
    expect(loadMobileAgentDefaults("defaults-one").agents?.codex).toEqual({
      model: "codex:chosen",
      modelSettings: { reasoningEffort: "high" },
      accountId: "work",
    });
    expect(
      loadMobileAgentDefaults("defaults-one").agents?.claude?.modelSettings,
    ).toEqual({ effort: "high" });
    await act(async () => setUiLanguage("zh-CN"));
    expect(current('[aria-label="新会话"]')).not.toBeNull();
    expect(current("#mobile-account-codex")?.textContent).toContain(
      "Work account",
    );
    expect(current('[aria-label="新会话"]')?.textContent).toContain(
      "高",
    );
    act(() => root.unmount());
    root = createRoot(node);
    await render();
    await click("首页菜单");
    await click("设置", dialog());
    await click("新会话");
    expect(current('[aria-label="新会话"]')?.textContent).toContain(
      "Chosen",
    );
  });

  it.each(["home", "project", "drawer"])(
    "passes saved defaults and account from the %s new-conversation entry",
    async (entry) => {
      saveChosen();
      await render();
      if (entry === "project")
        await click("Project", current(".mobile-home-projects")!);
      if (entry === "drawer") await click("Menu");
      await click(
        "New conversation",
        entry === "drawer"
          ? current(".mobile-drawer")!
          : current(".mobile-home")!,
      );
      await input("Use my preferences");
      await send();
      expect(host.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "create",
          projectId: "project",
          harness: "codex",
          model: "codex:chosen",
          modelSettings: { reasoningEffort: "high" },
          providerAccountId: "work",
        }),
        { text: "Use my preferences" },
      );
    },
  );

  it("keeps a draft's temporary configuration and account when Settings changes", async () => {
    saveChosen();
    await render();
    await click("New conversation", current(".mobile-home")!);
    await input("Keep this draft");
    await click("Model and reasoning");
    await choose("Model", "First");
    await dismiss();
    await settings(true);
    await defaultsPanel();
    await choose("Agent", HARNESS_TITLE.claude);
    await dismiss();
    await click("Codex account");
    await click("Default account", dialog());
    await leaveSettings();
    await send();
    expect(host.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "create",
        harness: "codex",
        model: "codex:first",
        providerAccountId: "work",
      }),
      { text: "Keep this draft" },
    );
    expect(loadMobileAgentDefaults("defaults-one").harness).toBe("claude");
    expect(loadMobileAgentDefaults("defaults-one").agents?.codex?.model).toBe(
      "codex:chosen",
    );
  });

  it("preserves an existing session when changing new-conversation defaults", async () => {
    saveChosen();
    host.sessions.mockResolvedValue([
      {
        id: "session",
        title: snapshot.session.title,
        harness: "codex",
        projectId: "project",
        status: "idle",
        revision: 1,
        updatedAt: 1,
      },
    ]);
    await render();
    await act(async () =>
      current<HTMLButtonElement>(
          '.mobile-home-session[data-session-id="session"]',
        )!
        .click(),
    );
    await settings(true);
    await defaultsPanel();
    await choose("Agent", HARNESS_TITLE.claude);
    await dismiss();
    await leaveSettings();
    await input("Continue existing");
    await send();
    expect(host.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "send",
        sessionId: "session",
        text: "Continue existing",
      }),
      undefined,
    );
    expect(
      host.dispatch.mock.calls.some(
        ([command]) =>
          command.type === "configure" || command.type === "create",
      ),
    ).toBe(false);
    expect(host.providerAccounts).toHaveBeenCalledTimes(1);
  });

  it("shows removed accounts and refuses to create silently under the default login", async () => {
    saveChosen();
    host.providerAccounts.mockResolvedValue({
      codex: [{ id: "default", label: "Default account" }],
    });
    await render();
    await settings();
    expect(current("#mobile-account-codex")?.textContent).toContain(
      "Unavailable account (work)",
    );
    await leaveSettings();
    await click("New conversation", current(".mobile-home")!);
    await input("Do not switch accounts");
    await send();
    expect(host.dispatch).not.toHaveBeenCalled();
    expect(host.uploadAttachments).not.toHaveBeenCalled();
    expect(node.textContent).toContain(
      "This provider account is no longer available.",
    );
  });

  it("supports older Hosts and retries independent account failures without losing the model choices", async () => {
    host.providerAccounts.mockResolvedValue(null);
    await render();
    await settings();
    expect(node.textContent).toContain(
      "Provider accounts are unavailable on this Host.",
    );
    await defaultsPanel();
    expect(dialog().textContent).toContain("First");
    await dismiss();
    await leaveSettings();
    host.providerAccounts.mockRejectedValue(new Error("Network offline"));
    await settings();
    expect(node.textContent).toContain("Network offline");
    host.providerAccounts.mockResolvedValue(accounts);
    await click("Retry");
    expect(node.textContent).not.toContain("Network offline");
    expect(current("#mobile-account-codex")?.textContent).toContain(
      "Default account",
    );
  });

  it("discards the previous Host's late settings response", async () => {
    saveChosen();
    let resolve!: (accounts: HostProviderAccounts) => void;
    host.providerAccounts.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render();
    await settings();
    host.connection = {
      ...host.connection,
      environmentId: "defaults-two",
      endpoint: "http://second",
    };
    await render();
    await act(async () =>
      resolve({
        codex: [
          { id: "default", label: "Default account" },
          { id: "late", label: "Wrong Host" },
        ],
      }),
    );
    await click("Codex account");
    expect(dialog().textContent).not.toContain("Wrong Host");
    expect(dialog().querySelector('[aria-checked="true"]')?.textContent).toBe(
      "Default account",
    );
    expect(loadMobileAgentDefaults("defaults-two")).toEqual({});
    expect(
      loadMobileAgentDefaults("defaults-one").agents?.codex?.accountId,
    ).toBe("work");
  });

  it("shows a partial catalog's usable fallback without replacing the saved default", async () => {
    saveChosen();
    host.models.mockResolvedValue({
      models: { claude: catalog.models.claude },
      errors: { codex: "Codex is unavailable" },
    });
    await render();
    await settings();
    expect(
      current('[aria-label="New conversations"]')?.textContent,
    ).toContain("Claude model");
    expect(node.textContent).toContain("Codex is unavailable");
    expect(loadMobileAgentDefaults("defaults-one").harness).toBe("codex");
    host.models.mockResolvedValue(catalog);
    await click("Retry");
    expect(
      current('[aria-label="New conversations"]')?.textContent,
    ).toContain("Chosen");
    expect(host.models).toHaveBeenLastCalledWith(undefined, true);
  });

  it("does not overwrite a manual model choice when a warmed catalog finishes refreshing", async () => {
    saveChosen();
    host.cachedModels.mockReturnValue(catalog);
    let resolve!: (catalog: HostModelCatalog) => void;
    const pending = new Promise<HostModelCatalog>((done) => {
      resolve = done;
    });
    host.models.mockReturnValue(pending);
    await render();
    await click("New conversation", current(".mobile-home")!);
    await click("Model and reasoning");
    await choose("Model", "First");
    await dismiss();
    await act(async () => resolve(catalog));
    await input("Keep manual selection");
    await send();
    expect(host.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "create",
        model: "codex:first",
        providerAccountId: "work",
      }),
      { text: "Keep manual selection" },
    );
    expect(loadMobileAgentDefaults("defaults-one").agents?.codex?.model).toBe(
      "codex:chosen",
    );
  });
});

it("shows the actual shared Host default identity", async () => {
  host.providerAccounts.mockResolvedValue({ codex: [
    { id: "default", label: "Default account", defaultAccountId: "work", defaultAccountLabel: "9300", defaultIdentity: { email: "9300@example.test" } },
    { id: "work", label: "9300", identity: { email: "9300@example.test" } },
  ] });
  await render();
  await settings();
  expect(current("#mobile-account-codex")?.textContent).toContain("Follow Host default: 9300 · 9300@example.test");
});
