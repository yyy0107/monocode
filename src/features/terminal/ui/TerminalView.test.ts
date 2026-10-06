// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const pty = vi.hoisted(() => ({
  spawnPty: vi.fn(async () => {}),
  killPty: vi.fn(async () => {}),
  resizePty: vi.fn(async () => {}),
  writePty: vi.fn(async () => {}),
  subscribePty: vi.fn(() => () => {}),
  getPtyStatus: vi.fn(async () => ({ foreground: null })),
}));
vi.mock("../../../platform/tauri/pty", () => pty);
vi.mock("../model/terminalLayout", () => ({
  fitTerminal: () => null,
  applyTerminalChrome: () => {},
  resetGridStretch: () => {},
}));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    parser = { registerOscHandler: () => ({ dispose() {} }) };
    buffer = {
      active: { type: "normal" },
      onBufferChange: () => ({ dispose() {} }),
    };
    element = undefined;
    open() {}
    focus() {}
    dispose() {}
    writeln() {}
    onData() {
      return { dispose() {} };
    }
    onRender() {
      return { dispose() {} };
    }
    attachCustomKeyEventHandler() {}
    attachCustomWheelEventHandler() {}
  },
}));
import { TERMINAL_HANDOFF_MS, TerminalView } from "./TerminalView";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Let an unclaimed terminal's handoff window lapse and its teardown run. */
async function lapseHandoff() {
  await act(async () => {
    vi.advanceTimersByTime(TERMINAL_HANDOFF_MS + 1);
  });
}

function setup() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  document.body.appendChild(host);
  return { host, root: createRoot(host) };
}

it("does not let StrictMode cleanup kill the replacement shell", async () => {
  const { host, root } = setup();
  try {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(TerminalView, {
            id: "same-id",
            cwd: "/tmp",
            active: true,
          }),
        ),
      );
    });
    expect(pty.spawnPty).toHaveBeenCalledTimes(1);
    expect(pty.subscribePty).toHaveBeenCalledTimes(1);
    expect(pty.killPty).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
  expect(pty.killPty).not.toHaveBeenCalled();
  await lapseHandoff();
  expect(pty.killPty).toHaveBeenCalledTimes(1);
});

it("keeps the shell when a terminal moves between the dock and a pane", async () => {
  const { host, root } = setup();
  // A new `key` remounts a fresh view with the same PTY id, as moving a
  // terminal between the dock and a split pane does.
  const view = (key: string) =>
    createElement(TerminalView, {
      key,
      id: "moved",
      cwd: "/tmp",
      active: true,
    });
  try {
    await act(async () => {
      root.render(view("dock"));
    });
    await act(async () => {
      root.render(view("pane"));
    });
    await lapseHandoff();
    expect(pty.subscribePty).toHaveBeenCalledTimes(1);
    expect(pty.spawnPty).toHaveBeenCalledTimes(1);
    expect(pty.killPty).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      root.unmount();
    });
    await lapseHandoff();
    host.remove();
  }
  expect(pty.killPty).toHaveBeenCalledTimes(1);
});

it("waits for a closed terminal's teardown before starting its id again", async () => {
  const { host, root } = setup();
  const operations: string[] = [];
  let releaseSpawn!: () => void;
  pty.subscribePty.mockImplementation(() => {
    operations.push("subscribe");
    return () => {
      operations.push("unsubscribe");
    };
  });
  pty.spawnPty
    .mockImplementationOnce(() => {
      operations.push("spawn old");
      return new Promise<void>((resolve) => {
        releaseSpawn = resolve;
      });
    })
    .mockImplementationOnce(async () => {
      operations.push("spawn replacement");
    });
  pty.killPty.mockImplementation(async () => {
    operations.push("kill");
  });
  const view = () =>
    createElement(TerminalView, { id: "reopened", cwd: "/tmp", active: true });
  try {
    await act(async () => {
      root.render(view());
    });
    await act(async () => {
      root.render(null);
    });
    await lapseHandoff();
    await act(async () => {
      root.render(view());
    });
    expect(operations).toEqual(["subscribe", "spawn old"]);
    await act(async () => {
      releaseSpawn();
    });
    expect(operations).toEqual([
      "subscribe",
      "spawn old",
      "unsubscribe",
      "kill",
      "subscribe",
      "spawn replacement",
    ]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    await lapseHandoff();
    host.remove();
  }
});

it("does not hold a different terminal behind another one's teardown", async () => {
  const { host, root } = setup();
  pty.spawnPty.mockImplementationOnce(() => new Promise<void>(() => {}));
  try {
    await act(async () => {
      root.render(
        createElement(TerminalView, { id: "first", cwd: "/tmp", active: true }),
      );
    });
    await act(async () => {
      root.render(
        createElement(TerminalView, {
          id: "second",
          cwd: "/tmp",
          active: true,
        }),
      );
    });
    expect(pty.spawnPty).toHaveBeenCalledTimes(2);
    expect(pty.spawnPty).toHaveBeenLastCalledWith("second", "/tmp", 80, 24);
  } finally {
    await act(async () => {
      root.unmount();
    });
    await lapseHandoff();
    host.remove();
  }
});
