// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { HostSession } from "../features/connections/model/protocol";
import { MobileSessionActions } from "./MobileSessionActions";
import { mobileTranscriptPlatform } from "./transcriptPlatform";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const snapshot = (branch?: string): HostSession => ({
  projectId: "project",
  revision: 1,
  status: "idle",
  updatedAt: 1,
  session: {
    id: "session",
    title: "Test",
    cwd: "/project",
    harness: "codex",
    model: "codex:test",
    modelSettings: {},
    runtimeMode: "supervised",
    blocks: [],
    branch,
  },
});

function render(value: HostSession) {
  const node = document.createElement("div");
  document.body.append(node);
  const anchor = document.createElement("button");
  node.append(anchor);
  act(() => {
    root = createRoot(node);
    root.render(createElement(MobileSessionActions, {
      snapshot: value,
      anchor: { current: anchor },
      disabled: false,
      onUpdate: async () => {},
      onClose: () => {},
    }));
  });
  const row = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(".mobile-sheet-row")]
    .find((button) => button.textContent?.startsWith(label));
  return { row };
}

it("copies the conversation's branch from the header menu", async () => {
  const copy = vi.spyOn(mobileTranscriptPlatform, "copyText").mockResolvedValue();
  const { row } = render(snapshot("feature/mobile"));
  expect(row("Copy branch")?.textContent).toBe("Copy branchfeature/mobile");
  await act(async () => row("Copy branch")!.click());
  expect(copy).toHaveBeenCalledWith("feature/mobile");
});

it("omits Copy branch when the conversation has no branch", () => {
  const { row } = render(snapshot());
  expect(row("Copy branch")).toBeUndefined();
  expect(row("Session status")).toBeUndefined();
});
