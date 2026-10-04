// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MobileTranscript } from "./MobileTranscript";
import type {
  HostCommand,
  HostSession,
} from "../features/connections/model/protocol";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
function render(
  options: { runId?: string; disabled?: boolean; block?: object } = {},
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
      blocks: [
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
        onCommand: (command) => commands.push(command),
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
