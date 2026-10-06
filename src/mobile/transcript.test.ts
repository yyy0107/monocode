// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileTranscript } from "./MobileTranscript";
import type {
  HostCommand,
  HostSession,
} from "../features/connections/model/protocol";
import type { Block } from "../features/sessions/model/session";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
function render(
  options: { runId?: string; disabled?: boolean; block?: object; blocks?: Block[];
    onCommand?: (command: HostCommand) => Promise<boolean> } = {},
) {
  const commands: HostCommand[] = [];
  const node = document.createElement("div");
  document.body.append(node);
  const snapshot: HostSession = {
    projectId: "project",
    revision: 1,
    status: "running",
    runId: options.runId,
    updatedAt: 1,
    session: {
      id: "session",
      title: "Test",
      cwd: "/project",
      harness: "codex",
      model: "codex:test",
      modelSettings: {},
      runtimeMode: "supervised",
      blocks: options.blocks ?? [
        {
          id: "tool",
          role: "tool",
          text: "Run npm test?",
          tool: { title: "Run npm test?" },
          approval: { requestId: 7 },
          ...options.block,
        },
      ],
    },
  };
  act(() => {
    root = createRoot(node);
    root.render(
      createElement(MobileTranscript, {
        snapshot,
        disabled: options.disabled ?? false,
        onCommand: options.onCommand ?? ((command) => { commands.push(command); }),
      }),
    );
  });
  return { node, commands };
}

describe("mobile approval interaction", () => {
  it("renders approvals attached to real Host tool blocks and sends the active run identity", () => {
    const { node, commands } = render({ runId: "active-run" });
    const allow = [...node.querySelectorAll("button")].find(
      (button) => button.textContent === "Allow",
    )!;
    expect(allow).toBeDefined();
    act(() => allow.click());
    expect(commands[0]).toMatchObject({
      type: "approve",
      sessionId: "session",
      runId: "active-run",
      requestId: 7,
      decision: "allow",
    });
  });
  it("disables approval after reconnect without a current run or while another command is pending", () => {
    let result = render();
    expect(
      [...result.node.querySelectorAll("button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    act(() => root!.unmount());
    result = render({ runId: "active-run", disabled: true });
    expect(
      [...result.node.querySelectorAll("button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });
  it("shows resolved approval state without actionable buttons", () => {
    const { node } = render({
      runId: "active-run",
      block: { approval: { requestId: 7, decided: "allow" } },
    });
    expect(node.querySelector(".agent-transcript")).not.toBeNull();
    expect(
      [...node.querySelectorAll("button")].some((button) =>
        ["Allow", "Deny"].includes(button.textContent || ""),
      ),
    ).toBe(false);
  });
});

describe("mobile jump interaction", () => {
  it("consumes pointer, mouse and click events and keeps composer focus", () => {
    const { node } = render({ runId: "active-run" });
    const parent = document.createElement("div");
    node.replaceWith(parent);
    parent.append(node);
    const scroller = node.querySelector<HTMLDivElement>(".agent-transcript")!;
    let top = 0;
    Object.defineProperties(scroller, {
      clientHeight: { value: 400 },
      scrollHeight: { value: 1000 },
      scrollTop: {
        get: () => top,
        set: (value: number) => { top = Math.max(0, Math.min(value, 600)); },
      },
    });
    scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    scroller.querySelector<HTMLElement>("[data-transcript-end]")!
      .getBoundingClientRect = () => ({ top: 1000 - top }) as DOMRect;
    act(() => scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -10 })));
    const button = node.querySelector<HTMLButtonElement>(".mobile-jump")!;
    expect(button).not.toBeNull();
    const composer = document.createElement("textarea");
    node.append(composer);
    composer.focus();
    const bubbled = vi.fn();
    for (const type of ["pointerdown", "mousedown", "click"])
      parent.addEventListener(type, bubbled);
    for (const type of ["pointerdown", "mousedown", "click"]) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      act(() => button.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
    }
    expect(bubbled).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(composer);
    expect(node.querySelector(".mobile-jump")).toBeNull();
  });
});

describe("mobile character streaming", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const text = "这段中文将逐字显示，不会等待整句话完成之后再一起出现。";
  function reply(animate: boolean) {
    const node = document.createElement("div");
    document.body.append(node);
    const snapshot: HostSession = {
      projectId: "project",
      revision: 1,
      status: "idle",
      updatedAt: 1,
      session: {
        id: "fast-session",
        title: "Test",
        cwd: "/project",
        harness: "codex",
        model: "codex:test",
        modelSettings: {},
        runtimeMode: "supervised",
        blocks: [
          { id: "user", role: "user", text: "Reply in Chinese" },
          { id: "reply", role: "assistant", text },
        ],
      },
    };
    act(() => {
      root = createRoot(node);
      root.render(
        createElement(MobileTranscript, {
          snapshot,
          disabled: false,
          onCommand: () => {},
          animateFrom: animate ? "user" : undefined,
        }),
      );
    });
    return node;
  }
  it("types a newly submitted reply even when it finished before the first sync", () => {
    const node = reply(true);
    expect(node.querySelector(".agent-markdown")?.textContent).toBe("");
    act(() => vi.advanceTimersByTime(100));
    const partial = node.querySelector(".agent-markdown")?.textContent ?? "";
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(text.length);
    expect(text.startsWith(partial)).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(node.querySelector(".agent-markdown")?.textContent).toBe(text);
  });
  it("shows saved replies immediately without replaying the typewriter", () => {
    const node = reply(false);
    expect(node.querySelector(".agent-markdown")?.textContent).toBe(text);
  });
});

describe("mobile question history", () => {
  const question: Block = {
    id: "saved-question", role: "system", text: "Which source?",
    question: { requestId: 3, historyId: "saved-question", allowLateReply: true, decision: "skipped",
      questions: [{ id: "q", prompt: "Which source?", allowCustom: false, multiSelect: false,
        options: [{ id: "local", label: "Local" }, { id: "remote", label: "Remote" }] }] },
  };
  it.each([undefined, "new-run"])("answers a missed question from the transcript with active run %s", async runId => {
    const { node, commands } = render({ runId, blocks: [
      { id: "user", role: "user", text: "Work" }, question,
      { id: "done", role: "assistant", text: "Work continued" },
    ] });
    const history = node.querySelector('[data-question-history="saved-question"]')!;
    expect(history).not.toBeNull();
    expect(history.textContent).toContain("Answer question");
    act(() => history.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
    const option = [...history.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Local")!;
    act(() => option.click());
    await act(async () => history.querySelector<HTMLButtonElement>('[data-question-submit]')!.click());
    expect(commands).toEqual([expect.objectContaining({
      type: "send", sessionId: "session", text: "Which source?\nLocal", followUpBehavior: "steer",
      questionAnswer: { blockId: "saved-question", reply: { kind: "answered", answers: { q: ["local"] } } },
    })]);
    expect(commands[0]).not.toHaveProperty("runId");
    expect(commands[0]).not.toHaveProperty("requestId");
  });

  it("shows saved answers after reopening and keeps blocking questions read-only", () => {
    const answered: Block = { ...question, question: { ...question.question!, decision: "answered",
      reply: { kind: "answered", answers: { q: ["remote"] } } } };
    const { node, commands } = render({ blocks: [
      { id: "user", role: "user", text: "Work" }, answered,
      { ...question, id: "blocking", question: { ...question.question!, allowLateReply: false } },
    ] });
    for (const button of node.querySelectorAll<HTMLButtonElement>('[data-question-history] > button'))
      act(() => button.click());
    const history = node.querySelector('[data-question-history="saved-question"]')!;
    expect(history.textContent).toContain("Remote");
    expect(history.textContent).toContain("Answered");
    expect(node.querySelector("[data-question-form]")).toBeNull();
    expect(commands).toEqual([]);
  });

  it("keeps an unsuccessful late answer open for retry", async () => {
    const onCommand = vi.fn(async (_command: HostCommand) => false);
    const { node } = render({ blocks: [question], onCommand });
    const history = node.querySelector('[data-question-history="saved-question"]')!;
    act(() => history.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
    act(() => [...history.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent === "Local")!.click());
    const submit = history.querySelector<HTMLButtonElement>('[data-question-submit]')!;
    await act(async () => submit.click());
    expect(history.querySelector('button[aria-expanded]')?.getAttribute("aria-expanded")).toBe("true");
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(onCommand).toHaveBeenCalledTimes(2);
    expect(onCommand.mock.calls[1][0]).toMatchObject({ type: "send", text: "Which source?\nLocal",
      questionAnswer: { blockId: "saved-question", reply: { kind: "answered", answers: { q: ["local"] } } } });
  });
});
