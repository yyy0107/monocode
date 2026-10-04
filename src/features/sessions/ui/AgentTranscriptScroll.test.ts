// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;
let observers: Array<{
  targets: Element[];
  resize: (entries?: unknown[]) => void;
}>;
let endObservers: Array<{
  targets: Element[];
  intersect: () => void;
  margin?: string;
}>;

beforeEach(() => {
  observers = [];
  endObservers = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets: Element[] = [];
      constructor(readonly resize: (entries?: unknown[]) => void) {
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      disconnect() {
        this.targets = [];
      }
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      targets: Element[] = [];
      margin?: string;
      constructor(readonly intersect: () => void, options?: IntersectionObserverInit) {
        this.margin = options?.rootMargin;
        endObservers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      disconnect() {
        this.targets = [];
      }
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("subagent scrolling", () => {
  it("follows growing content to the bottom with only one live scroll window", () => {
    const blocks: Block[] = [
      { id: "user", role: "user", text: "Investigate auth" },
      {
        id: "spawn",
        role: "tool",
        text: "Auth review",
        tool: { callId: "spawn", kind: "agent", status: "in_progress" },
        agentRun: {
          name: "Auth review",
          steps: [
            { id: "intro", kind: "message", text: "Inspecting files." },
            ...Array.from({ length: 8 }, (_, index) => ({
              id: `step-${index}`,
              kind: "tool" as const,
              text: `Read file-${index}.ts`,
              toolKind: "read",
              status: "completed",
            })),
            {
              id: "last",
              kind: "tool",
              text: "Run check",
              toolKind: "shell",
              status: "failed",
              preview: {
                kind: "read",
                output: "Last line of output",
                contentOnly: true,
              },
            },
          ],
        },
      },
    ];
    act(() =>
      root.render(createElement(AgentTranscript, { blocks, busy: true })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show Auth review\'s work"]',
    );
    expect(button).not.toBeNull();
    act(() => button!.click());
    const scroller =
      container.querySelector<HTMLDivElement>(".zen-phase-live")!;
    expect(scroller).not.toBeNull();
    expect(scroller.parentElement?.closest(".zen-phase-live")).toBeNull();
    let height = 600;
    let top = 0;
    Object.defineProperties(scroller, {
      scrollHeight: { get: () => height },
      clientHeight: { get: () => 280 },
      scrollTop: {
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, height - 280));
        },
      },
    });
    const observer = observers.find((item) =>
      item.targets.includes(scroller.firstElementChild!),
    )!;
    expect(observer).toBeDefined();
    act(() => observer.resize());
    expect(top).toBe(320);
    // A row expansion or a markdown layout change resizes this inner body.
    height = 900;
    act(() => observer.resize());
    expect(top).toBe(620);
    // Reading older work must pause automatic following.
    act(() =>
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 })),
    );
    top = 300;
    height = 1000;
    act(() => observer.resize());
    expect(top).toBe(300);
  });
});

describe("transcript scrolling", () => {
  it.each([true, false])(
    "hides the jump while the content end is above the composer without resuming following (touch=%s)",
    (touchScroll) => {
      const showJump = vi.fn();
      act(() => root.render(createElement(AgentTranscript, {
        blocks: [
          { id: "user", role: "user", text: "Explain" },
          { id: "reply", role: "assistant", text: "Short answer" },
        ],
        busy: true,
        touchScroll,
        onJumpToBottomChange: showJump,
      })));
      const scroller = container.querySelector<HTMLDivElement>(".agent-transcript")!;
      const end = scroller.querySelector<HTMLElement>("[data-transcript-end]")!;
      scroller.style.scrollPaddingTop = "80px";
      scroller.style.scrollPaddingBottom = "100px";
      let top = 0;
      let contentEnd = 830;
      Object.defineProperties(scroller, {
        scrollHeight: { get: () => 1000 },
        clientHeight: { get: () => 400 },
        scrollTop: {
          get: () => top,
          set: (value: number) => { top = Math.max(0, Math.min(value, 600)); },
        },
      });
      scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
      end.getBoundingClientRect = () => ({ top: contentEnd - top }) as DOMRect;
      const observer = observers.find((item) => item.targets.includes(scroller))!;
      act(() => observer.resize());
      expect(top).toBe(600);

      // Reading intent changes immediately, but the latest answer is still visible.
      act(() => {
        scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -10 }));
        top = 550;
        scroller.dispatchEvent(new Event("scroll"));
      });
      expect(showJump).toHaveBeenLastCalledWith(false);
      act(() => observer.resize());
      expect(top).toBe(550);

      // The anchored turn's outer size is unchanged as its reply grows.
      contentEnd = 860;
      let endObserver = endObservers.find((item) => item.targets.includes(end))!;
      expect(endObserver.margin).toBe("-80px 0px -100px 0px");
      act(() => endObserver.intersect());
      expect(showJump).toHaveBeenLastCalledWith(true);

      act(() => {
        top = 558;
        scroller.dispatchEvent(new Event("scroll"));
      });
      expect(showJump).toHaveBeenLastCalledWith(true);
      act(() => {
        // A fold makes the answer visible again while the reader remains unpinned.
        contentEnd = 830;
        endObserver.intersect();
      });
      expect(showJump).toHaveBeenLastCalledWith(false);

      // Expanding the dock occludes the end; collapsing it reveals it again.
      scroller.style.scrollPaddingBottom = "150px";
      act(() => observer.resize());
      expect(showJump).toHaveBeenLastCalledWith(true);
      expect(top).toBe(558);
      endObserver = endObservers.find((item) => item.targets.includes(end))!;
      expect(endObserver.margin).toBe("-80px 0px -150px 0px");
      scroller.style.scrollPaddingBottom = "100px";
      act(() => observer.resize());
      expect(showJump).toHaveBeenLastCalledWith(false);
    },
  );
  it("reserves the floating header inset when stretching the latest turn, including keyboard resizing", () => {
    act(() => root.render(createElement(AgentTranscript, {
      blocks: [{ id: "new-prompt", role: "user", text: "Next question" }],
      busy: true,
    })));
    const scroller = container.querySelector<HTMLDivElement>(".agent-transcript")!;
    const inner = scroller.firstElementChild as HTMLElement;
    scroller.style.scrollPaddingTop = "116px";
    inner.style.paddingBottom = "32px";
    let viewport = 600;
    Object.defineProperties(scroller, {
      clientHeight: { get: () => viewport },
      scrollHeight: { get: () => 1000 },
    });
    const observer = observers.find((item) => item.targets.includes(scroller))!;
    act(() => observer.resize());
    expect(scroller.style.getPropertyValue("--transcript-viewport")).toBe("452px");
    viewport = 300;
    act(() => observer.resize());
    expect(scroller.style.getPropertyValue("--transcript-viewport")).toBe("152px");
    // Ordinary panes without a floating header retain their full anchoring area.
    scroller.style.scrollPaddingTop = "0px";
    act(() => observer.resize());
    expect(scroller.style.getPropertyValue("--transcript-viewport")).toBe("268px");
  });
  it("follows streamed layout growth on mobile, pauses for a touch up, and resumes at the bottom", () => {
    const showJump = vi.fn();
    const ready = vi.fn();
    act(() =>
      root.render(
        createElement(AgentTranscript, {
          blocks: [
            { id: "user", role: "user", text: "Explain" },
            { id: "reply", role: "assistant", text: "Answer" },
          ],
          busy: true,
          touchScroll: true,
          onJumpToBottomChange: showJump,
          onJumpToBottomReady: ready,
        }),
      ),
    );
    const scroller =
      container.querySelector<HTMLDivElement>(".agent-transcript")!;
    let height = 1000;
    let viewport = 400;
    let top = 0;
    // This stream reaches the real end, with no trailing anchored blank space.
    scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    scroller.querySelector<HTMLElement>("[data-transcript-end]")!
      .getBoundingClientRect = () => ({ top: height - top }) as DOMRect;
    Object.defineProperties(scroller, {
      scrollHeight: { get: () => height },
      clientHeight: { get: () => viewport },
      scrollTop: {
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, height - viewport));
        },
      },
    });
    const observer = observers.find((item) => item.targets.includes(scroller))!;
    act(() => observer.resize());
    expect(top).toBe(600);
    // A paced Markdown render grows independently of the Host snapshot.
    height = 1080;
    act(() => scroller.dispatchEvent(new Event("scroll")));
    act(() => observer.resize());
    expect(top).toBe(680);
    const touch = (type: string, y: number) => {
      const event = new Event(type);
      Object.defineProperty(event, "touches", { value: [{ clientY: y }] });
      scroller.dispatchEvent(event);
    };
    act(() => {
      touch("touchstart", 100);
      touch("touchmove", 130);
      top = 676;
      scroller.dispatchEvent(new Event("scroll"));
    });
    height = 1160;
    act(() => observer.resize());
    expect(top).toBe(676);
    expect(showJump).toHaveBeenLastCalledWith(true);
    act(() => {
      touch("touchmove", 80);
      top = 760;
      scroller.dispatchEvent(new Event("scroll"));
    });
    height = 1200;
    act(() => observer.resize());
    expect(top).toBe(800);
    // Opening the keyboard changes viewport height, not reading intent.
    viewport = 250;
    act(() => scroller.dispatchEvent(new Event("scroll")));
    act(() => observer.resize());
    expect(top).toBe(950);
    act(() => {
      touch("touchmove", 150);
      top = 500;
      scroller.dispatchEvent(new Event("scroll"));
    });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const start = performance.now();
    act(() => ready.mock.calls[0][0]());
    expect(showJump).toHaveBeenLastCalledWith(false);
    // The jump glides instead of snapping, and streamed growth during the
    // glide does not cut it short.
    act(() => frames.shift()?.(start + 100));
    expect(top).toBeGreaterThan(500);
    expect(top).toBeLessThan(950);
    height = 1300;
    act(() => observer.resize());
    expect(top).toBeLessThan(950);
    act(() => frames.shift()?.(start + 1000));
    expect(top).toBe(1050);
    expect(frames).toHaveLength(0);
    expect(showJump).toHaveBeenLastCalledWith(false);
  });
  it("lets a wheel up inside the bottom margin leave a streaming reply", () => {
    const blocks = (text: string): Block[] => [
      { id: "user", role: "user", text: "Explain auth" },
      { id: "reply", role: "assistant", text },
    ];
    act(() =>
      root.render(
        createElement(AgentTranscript, { blocks: blocks("One"), busy: true }),
      ),
    );
    const scroller =
      container.querySelector<HTMLDivElement>(".agent-transcript")!;
    let height = 1000;
    let top = 0;
    Object.defineProperties(scroller, {
      scrollHeight: { get: () => height },
      clientHeight: { get: () => 400 },
      scrollTop: {
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, height - 400));
        },
      },
    });
    const observer = observers.find((item) => item.targets.includes(scroller))!;
    act(() => observer.resize());
    expect(top).toBe(600);

    // A trackpad's first ticks move only a few pixels.
    act(() => {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -4 }));
      top = 596;
      scroller.dispatchEvent(new Event("scroll"));
    });
    height = 1040;
    act(() =>
      root.render(
        createElement(AgentTranscript, {
          blocks: blocks("One\n\nTwo"),
          busy: true,
        }),
      ),
    );
    act(() => observer.resize());
    expect(top).toBe(596);

    // Scrolling back down to the end follows the stream again.
    act(() => {
      top = 640;
      scroller.dispatchEvent(new Event("scroll"));
    });
    height = 1080;
    act(() => observer.resize());
    expect(top).toBe(680);
  });

  it("holds the reader's place when a turn above the view lays out", () => {
    const blocks: Block[] = Array.from({ length: 3 }, (_, index) => [
      { id: `user-${index}`, role: "user" as const, text: `Question ${index}` },
      { id: `reply-${index}`, role: "assistant" as const, text: "Answer" },
    ]).flat();
    act(() => root.render(createElement(AgentTranscript, { blocks })));
    const scroller =
      container.querySelector<HTMLDivElement>(".agent-transcript")!;
    let height = 3000;
    let top = 0;
    Object.defineProperties(scroller, {
      scrollHeight: { get: () => height },
      clientHeight: { get: () => 400 },
      scrollTop: {
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, height - 400));
        },
      },
    });
    act(() => {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
      top = 1000;
      scroller.dispatchEvent(new Event("scroll"));
    });
    const [above, reading] = scroller.querySelectorAll(".transcript-turn");
    const observer = observers.find((item) => item.targets.includes(above))!;
    expect(observer).toBeDefined();
    above.getBoundingClientRect = () => ({ top: -800 }) as DOMRect;
    reading.getBoundingClientRect = () => ({ top: -100 }) as DOMRect;
    const size = (target: Element, blockSize: number) => ({
      target,
      borderBoxSize: [{ blockSize }],
      contentRect: { height: blockSize },
    });
    // Off-screen turns report their placeholder size first.
    act(() => observer.resize([size(above, 240), size(reading, 240)]));
    expect(top).toBe(1000);

    // Scrolling up lays them out. Only the turn wholly above the view moves
    // the reader; the one on screen grows below where they are reading.
    height = 4420;
    act(() => observer.resize([size(above, 900), size(reading, 1000)]));
    expect(top).toBe(1660);
  });
});
