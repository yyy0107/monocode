// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => []),
  isTauri: () => false,
  convertFileSrc: (path: string) => path,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onFocusChanged: async () => () => {} }),
}));
vi.mock("../../../integrations/harness/core/availability", () => ({
  getHarnessAvailabilitySnapshot: () => 0,
  hasProbedHarnessAvailability: () => true,
  isHarnessAvailable: () => true,
  harnessUnavailableHint: () => "",
  probeHarnessAvailability: async () => {},
  subscribeHarnessAvailability: () => () => {},
}));
vi.mock("../../../integrations/harness/core/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../integrations/harness/core/registry")>()),
  refreshHarnessCatalogs: async () => {},
  isLiveHarness: () => true,
}));
vi.mock("./ModelPicker", () => ({ ModelPicker: () => null }));
vi.mock("./SessionReview", () => ({ SessionReview: () => null }));

import { newSession, type Session } from "../model/session";
import {
  anchorWorktreeCreation,
  completeWorktreeCreation,
  startWorktreeCreation,
} from "../../source-control/model/worktreeCreation";
import { SessionPane } from "./SessionPane";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const noop = () => {};

async function render(session: Session) {
  await act(async () => {
    root.render(
      createElement(SessionPane, {
        session,
        reviewUndoLocked: false,
        visible: true,
        focused: true,
        inSplit: false,
        composerFocused: true,
        recents: [],
        onFocus: noop,
        onClose: noop,
        onCwdChange: noop,
        onBranchChange: noop,
        onModelChange: noop,
        onModelSettingsChange: noop,
        onRuntimeModeChange: noop,
        onSubmit: () => true,
        onStop: noop,
        onCompactContext: () => false,
        onDeleteQueuedMessage: noop,
        onEditQueuedMessage: noop,
        onQueuedMessageEditingChange: noop,
        onSteerQueuedMessage: noop,
        onResumeQueue: noop,
        onApproval: noop,
        onQuestionReply: noop,
        onOpenFile: noop,
        onOpenDiff: noop,
        onOpenPlan: noop,
        onBuildPlan: noop,
        onNewTerminal: noop,
      }),
    );
  });
}

const draft: Session = {
  ...newSession("claude", "/repo", "claude-sonnet", "supervised", {}),
  workspaceMode: "worktree",
  worktreeBase: "main",
};

it("shows the creation record under the message that started it", async () => {
  await render(draft);
  expect(container.textContent).not.toContain("Creating worktree…");

  const creation = anchorWorktreeCreation(
    startWorktreeCreation("main", "run-1"),
    "run-1",
    "user-1",
  );
  await render({
    ...draft,
    blocks: [{ id: "user-1", role: "user", text: "Fix login" }],
    busy: true,
    worktreePreparing: true,
    worktreeCreation: creation,
  });
  expect(container.textContent).toContain("Fix login");
  expect(container.textContent).toContain("Creating worktree…");
  expect(container.textContent).toContain("[info] Starting worktree creation");
});

it("keeps the record between the message that started it and the reply", async () => {
  await render({
    ...draft,
    blocks: [
      { id: "user-1", role: "user", text: "Fix login" },
      { id: "reply-1", role: "assistant", text: "Done fixing" },
    ],
    worktreeCreation: anchorWorktreeCreation(
      completeWorktreeCreation(
        startWorktreeCreation("main", "run-1"),
        "run-1",
        "/trees/mc-3f2a1b7c",
      ),
      "run-1",
      "user-1",
    ),
  });
  const text = container.textContent ?? "";
  expect(text.indexOf("Fix login")).toBeLessThan(text.indexOf("Worktree created"));
  expect(text.indexOf("Worktree created")).toBeLessThan(text.indexOf("Done fixing"));
});

it("does not show a creation that is not anchored to a message in the transcript", async () => {
  await render({
    ...draft,
    blocks: [{ id: "user-1", role: "user", text: "Fix login" }],
    busy: true,
    worktreeCreation: startWorktreeCreation("main", "run-1"),
  });
  expect(container.textContent).not.toContain("Starting worktree creation");
});

it("shows no working clock while the worktree is still being made", async () => {
  await render({
    ...draft,
    blocks: [{ id: "user-1", role: "user", text: "Fix login" }],
    busy: true,
    worktreeCreation: anchorWorktreeCreation(
      startWorktreeCreation("main", "run-1"),
      "run-1",
      "user-1",
    ),
  });
  expect(container.textContent).toContain("Creating worktree…");
  expect(container.textContent).not.toMatch(/working/i);
});

it("shows no working clock until the host has taken the message", async () => {
  await render({
    ...draft,
    blocks: [{ id: "user-1", role: "user", text: "Fix login", sending: true }],
    busy: true,
    worktreeCreation: anchorWorktreeCreation(
      completeWorktreeCreation(
        startWorktreeCreation("main", "run-1"),
        "run-1",
        "/trees/mc-3f2a1b7c",
      ),
      "run-1",
      "user-1",
    ),
  });
  expect(container.textContent).not.toMatch(/working/i);
});

it("starts the working clock once the worktree exists and the agent has the message", async () => {
  await render({
    ...draft,
    blocks: [{ id: "user-1", role: "user", text: "Fix login", startedAt: Date.now() }],
    busy: true,
    worktreeCreation: anchorWorktreeCreation(
      completeWorktreeCreation(
        startWorktreeCreation("main", "run-1"),
        "run-1",
        "/trees/mc-3f2a1b7c",
      ),
      "run-1",
      "user-1",
    ),
  });
  expect(container.textContent).toMatch(/working/i);
});

it("keeps a finished record on its message after a reload, folded until it is opened", async () => {
  await render({
    ...draft,
    blocks: [
      {
        id: "user-1",
        role: "user",
        text: "Fix login",
        worktreeCreation: {
          base: "main",
          path: "/trees/mc-3f2a1b7c",
          log: [{ kind: "output" as const, text: "HEAD is now at abc1234 initial" }],
        },
      },
      { id: "reply-1", role: "assistant", text: "Done fixing" },
    ],
  });
  expect(container.textContent).toContain("Worktree created");
  expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull();
  expect(container.textContent).not.toContain("HEAD is now at");
});
