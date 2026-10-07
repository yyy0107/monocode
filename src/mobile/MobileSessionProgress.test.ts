// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostSession } from "../features/connections/model/protocol";
import { newSession, type Block } from "../features/sessions/model/session";
import { setUiLanguage } from "../shared/i18n/language";
import { MobileTranscript } from "./MobileTranscript";

let root: Root;
let app: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  setUiLanguage("en");
  app = document.createElement("div");
  app.className = "mobile-app";
  document.body.append(app);
  root = createRoot(app);
});
afterEach(() => {
  act(() => root.unmount());
  app.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setUiLanguage("en");
});

const tasks = (count = 3, completed = 1): Block => ({
  id: "tasks",
  role: "tasks",
  text: "",
  taskList: {
    items: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      text: `Task ${i + 1}`,
      status:
        i < completed
          ? "completed"
          : i === completed
            ? "in_progress"
            : "pending",
    })),
  },
});
const plan: Block = {
  id: "plan",
  role: "plan",
  text: "# Implementation plan\n\nKeep the public API stable.",
};
const agent: Block = {
  id: "agent",
  role: "tool",
  text: "Review changes",
  tool: { callId: "agent", kind: "Agent", status: "in_progress" },
  agentRun: {
    name: "Review changes",
    model: "review-model",
    steps: [],
    transcript: [
      { id: "reply", role: "assistant", text: "Checking compatibility." },
    ],
  },
};

function render(blocks: Block[], backgroundTasks?: string[]) {
  let snapshot: HostSession = {
    projectId: "project",
    revision: 1,
    status: "running",
    runId: "run",
    updatedAt: 1,
    session: {
      ...newSession("codex", "/repo"),
      id: "session",
      blocks,
      backgroundTasks,
    },
  };
  const onOverlayChange = vi.fn();
  let props: ComponentProps<typeof MobileTranscript> = {
    snapshot,
    disabled: false,
    onCommand: vi.fn(),
    onOverlayChange,
  };
  const update = (changes: Partial<HostSession> = {}, active = true) => {
    snapshot = { ...snapshot, ...changes };
    props = { ...props, snapshot, active };
    act(() => root.render(createElement(MobileTranscript, props)));
  };
  update();
  return { snapshot, update, onOverlayChange };
}
const capsule = () =>
  app.querySelector<HTMLButtonElement>(".mobile-progress-capsule");
const dialog = () =>
  app.querySelector<HTMLElement>(
    '.mobile-sheet-backdrop:not([inert]) [role="dialog"]',
  );
const click = (element: HTMLElement) => act(() => element.click());
const finish = () => act(() => vi.advanceTimersByTime(400));
const row = (text: string) =>
  [
    ...dialog()!.querySelectorAll<HTMLButtonElement>(".mobile-progress-row"),
  ].find((button) => button.textContent?.includes(text))!;

describe("mobile session progress", () => {
  it("hides ordinary chats and follows live task snapshots, including idle completion", () => {
    const { snapshot, update } = render([
      { id: "user", role: "user", text: "Hello" },
    ]);
    expect(capsule()).toBeNull();
    update({ session: { ...snapshot.session, blocks: [tasks()] } });
    expect(capsule()?.textContent).toContain("Task 2");
    expect(capsule()?.textContent).toContain("1 of 3");
    click(capsule()!);
    expect(dialog()?.getAttribute("aria-label")).toBe("Session progress");
    update({ session: { ...snapshot.session, blocks: [tasks(3, 2)] } });
    expect(capsule()?.textContent).toContain("Task 3");
    expect(
      dialog()?.querySelector('[data-status="in_progress"]')?.textContent,
    ).toContain("Task 3");
    update({
      status: "idle",
      session: { ...snapshot.session, blocks: [tasks(3, 3)] },
    });
    expect(dialog()).toBeNull();
    const closing = app.querySelector(
      '.mobile-sheet-backdrop[data-fold-state="closing"]',
    )!;
    expect(closing.hasAttribute("inert")).toBe(true);
    expect(closing.textContent).toContain("Task 3");
    expect(capsule()?.closest("[inert]")).not.toBeNull();
    expect(capsule()?.textContent).toContain("Task 3");
    finish();
    expect(capsule()).toBeNull();
    expect(app.querySelector(".mobile-sheet-backdrop")).toBeNull();
    // New work should bring back only the capsule, not reopen the old sheet.
    update({
      status: "running",
      session: { ...snapshot.session, blocks: [tasks()] },
    });
    expect(capsule()).not.toBeNull();
    expect(dialog()).toBeNull();
  });

  it("opens the existing plan and agent details and follows their live data", async () => {
    const { snapshot, update } = render(
      [tasks(), plan, agent],
      ["npm run dev"],
    );
    click(capsule()!);
    expect(dialog()?.textContent).toContain("npm run dev");
    click(row("Implementation plan"));
    expect(dialog()?.getAttribute("aria-label")).toBe("Plan");
    expect(dialog()?.textContent).toContain("Keep the public API stable.");
    finish();
    click(dialog()!.querySelector<HTMLButtonElement>('[aria-label="Close"]')!);
    finish();
    click(capsule()!);
    click(row("Review changes"));
    expect(dialog()?.textContent).toContain("Checking compatibility.");
    await act(async () =>
      update({
        session: {
          ...snapshot.session,
          blocks: [
            tasks(),
            plan,
            {
              ...agent,
              agentRun: {
                ...agent.agentRun!,
                transcript: [
                  {
                    id: "reply",
                    role: "assistant",
                    text: "Checking compatibility. Compatibility verified.",
                  },
                ],
              },
            },
          ],
        },
      }),
    );
    expect(dialog()?.textContent).toContain("Compatibility verified.");
  });

  it("focuses a long checklist and keeps folded rows inert through rapid reversal", () => {
    render([tasks(8, 4)]);
    click(capsule()!);
    const more = dialog()!.querySelector<HTMLButtonElement>(
      ".mobile-progress-more",
    )!;
    expect(
      dialog()?.querySelectorAll(".mobile-progress-tasks li"),
    ).toHaveLength(3);
    click(more);
    finish();
    expect(
      dialog()?.querySelectorAll(".mobile-progress-tasks li"),
    ).toHaveLength(8);
    click(more);
    expect(
      dialog()?.querySelector('[data-fold-state="closing"][inert]')
        ?.textContent,
    ).toContain("Task 1");
    click(more);
    finish();
    expect(
      dialog()?.querySelectorAll(".mobile-progress-tasks li"),
    ).toHaveLength(8);
    click(more);
    finish();
    expect(
      dialog()?.querySelectorAll(".mobile-progress-tasks li"),
    ).toHaveLength(3);
  });

  it("registers native Back dismissal, supports rapid reopen and releases hidden portals", () => {
    const { update, onOverlayChange } = render([tasks()]);
    click(capsule()!);
    const close = onOverlayChange.mock.calls.at(-1)?.[0] as () => void;
    expect(close).toBeTypeOf("function");
    act(() => close());
    expect(dialog()).toBeNull();
    expect(app.querySelector(".mobile-sheet-backdrop[inert]")).not.toBeNull();
    click(capsule()!);
    finish();
    expect(dialog()).not.toBeNull();
    update({}, false);
    expect(dialog()).toBeNull();
    expect(onOverlayChange.mock.calls.at(-1)?.[0]).toBeUndefined();
    finish();
    expect(app.querySelector(".mobile-sheet-backdrop")).toBeNull();
    update();
    expect(dialog()).toBeNull();
  });

  it("localizes application text while preserving provider text and running counts", () => {
    render([agent], ["npm run dev"]);
    expect(capsule()?.textContent).toContain("2 running");
    act(() => setUiLanguage("zh-CN"));
    expect(capsule()?.getAttribute("aria-label")).toBe("会话进度");
    click(capsule()!);
    expect(dialog()?.textContent).toContain("后台");
    expect(dialog()?.textContent).toContain("Review changes");
    expect(dialog()?.textContent).toContain("review-model");
    expect(dialog()?.textContent).toContain("npm run dev");
  });
});
