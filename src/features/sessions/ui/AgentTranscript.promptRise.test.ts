// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";
import { notePromptLaunch, takePromptLaunch } from "./promptLaunch";

const appearance = vi.hoisted(() => ({
  layout: "chat" as "chat" | "full",
  anchor: true,
}));
vi.mock("../hooks/useTranscriptLayout", () => ({
  useTranscriptLayout: () => appearance.layout,
}));
vi.mock("../hooks/useTranscriptAnchor", () => ({
  useTranscriptAnchor: () => appearance.anchor,
}));

let container: HTMLDivElement;
let root: Root;
let animate: ReturnType<typeof vi.fn>;

const first: Block[] = [{ id: "u1", role: "user", text: "Hello" }];
const second: Block[] = [
  ...first,
  { id: "a1", role: "assistant", text: "Hi" },
  { id: "u2", role: "user", text: "Next" },
];

function render(blocks: Block[], busy = true, options: { promptMotion?: "mobile"; animateFrom?: string } = {}) {
  act(() =>
    root.render(
      createElement(AgentTranscript, { blocks, busy, visible: true, ...options }),
    ),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  appearance.layout = "chat";
  appearance.anchor = true;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-prompt-launch-surface"))
        return { left: 8, right: 348, top: 676, bottom: 780, width: 340, height: 104 } as DOMRect;
      if (this.dataset.launchOrigin)
        return { left: 20, top: 700, bottom: 740, width: 300, height: 40 } as DOMRect;
      return (
        this.dataset.promptAnchor || this.classList.contains("user-message-bubble")
          ? { left: 200, right: 400, width: 200, top: 0, bottom: 60, height: 60 }
          : { left: 0, right: 400, width: 400, top: 0, bottom: 800, height: 800 }
      ) as DOMRect;
    },
  );
  animate = vi.fn(() => ({ cancel: vi.fn() }));
  HTMLElement.prototype.animate = animate as never;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  takePromptLaunch();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function risenPrompts() {
  return [
    ...new Set(
      animate.mock.contexts.map(
        (element) =>
          (element as HTMLElement).closest<HTMLElement>("[data-prompt-anchor]")
            ?.dataset.promptAnchor,
      ),
    ),
  ];
}

describe("prompt rise in the chat layout", () => {
  it("rises the first prompt from the bottom when no composer origin was recorded", () => {
    render(first);
    act(() => vi.advanceTimersByTime(20));

    expect(risenPrompts()).toEqual(["u1"]);
    const [rise] = animate.mock.calls[0];
    const [fade] = animate.mock.calls[1];
    expect(rise[0]).toMatchObject({
      transform: "translate(0.00px, 732.00px) scale(1.0000, 1.0000)",
    });
    expect(fade).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it("holds the rest of the turn until the prompt settles", () => {
    vi.useFakeTimers();
    render(first);
    const turn = container.querySelector<HTMLElement>(".transcript-turn")!;
    expect(turn.dataset.promptRise).toBe("rising");

    act(() => vi.advanceTimersByTime(20));
    act(() => vi.advanceTimersToNextTimer());
    expect(turn.dataset.promptRise).toBe("revealing");

    act(() => vi.advanceTimersByTime(320));
    expect(turn.dataset.promptRise).toBeUndefined();
    vi.useRealTimers();
  });

  it("rises each newly sent prompt", () => {
    render(first, false);
    render(second);
    act(() => vi.advanceTimersByTime(20));

    expect(risenPrompts()).toEqual(["u2"]);
  });

  it("does not replay an existing conversation on mount", () => {
    render(second);
    act(() => vi.advanceTimersByTime(20));

    expect(animate).not.toHaveBeenCalled();
  });

  it("preserves the default mount behavior when an explicit submission marker is supplied", () => {
    render(second, true, { animateFrom: "u2" });
    act(() => vi.advanceTimersByTime(20));
    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still in the full-width layout", () => {
    appearance.layout = "full";
    render(first);
    render(second);
    act(() => vi.advanceTimersByTime(20));

    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still when prompts are not anchored to the top", () => {
    appearance.anchor = false;
    render(first);
    render(second);
    act(() => vi.advanceTimersByTime(20));

    expect(animate).not.toHaveBeenCalled();
  });

  it("starts mobile sends above the dock after layout, including a reply completed before sync", () => {
    vi.useFakeTimers();
    try {
      render(second, false, { promptMotion: "mobile", animateFrom: "u2" });
      const row = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"]')!;
      const scroller = container.querySelector<HTMLElement>(".agent-transcript")!;
      scroller.style.paddingBottom = "128px";
      expect(row.style.visibility).toBe("hidden");
      expect(animate).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(20));
      expect(row.style.visibility).toBe("");
      expect(risenPrompts()).toEqual(["u2"]);
      expect(animate.mock.contexts[0]).toHaveProperty("className", expect.stringContaining("user-message-bubble"));
      expect(animate.mock.calls[0][0][0]).toMatchObject({
        transform: "translate(0.00px, 604.00px) scale(1.0000, 1.0000)",
      });
      expect(animate.mock.calls[0][0].at(-1)).toMatchObject({
        transform: "translate(0.00px, 0.00px) scale(1.0000, 1.0000)",
      });
      expect(animate.mock.calls[1][0][0]).toEqual({ opacity: 0 });
      const turn = row.closest<HTMLElement>(".transcript-turn")!;
      // The rest of the turn follows once the bubble lands.
      act(() => vi.advanceTimersToNextTimer());
      expect(turn.dataset.promptRise).toBe("revealing");
      act(() => vi.advanceTimersByTime(200));
      expect(turn.dataset.promptRise).toBeUndefined();
      render(second, false, { promptMotion: "mobile", animateFrom: "u2" });
      expect(animate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flies a mobile send out of the composer text it was typed in", () => {
    vi.useFakeTimers();
    try {
      render(first, false, { promptMotion: "mobile" });
      const origin = document.createElement("textarea");
      origin.dataset.launchOrigin = "true";
      notePromptLaunch(origin);
      render(second, true, { promptMotion: "mobile" });
      act(() => vi.advanceTimersByTime(20));
      expect(risenPrompts()).toEqual(["u2"]);
      // Starts as wide as the composer text, under it, then narrows into place.
      expect(animate.mock.calls[0][0][0]).toMatchObject({
        transform: "translate(-80.00px, 680.00px) scale(1.0000, 1.0000)",
        transformOrigin: "100% 100%",
        width: "300.00px",
      });
      expect(animate.mock.calls[1][0][0]).toEqual({ opacity: 1 });
      // The origin is spent: the next send without one rises from the dock.
      render([...second, { id: "u3", role: "user", text: "Again" }], true, { promptMotion: "mobile" });
      act(() => vi.advanceTimersByTime(20));
      const flights = animate.mock.calls.filter(([keyframes]) => "transformOrigin" in keyframes[0]);
      expect(flights).toHaveLength(2);
      expect(flights[1][0][0]).toMatchObject({ transformOrigin: "100% 100%" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("flies a desktop send out of its composer text", () => {
    vi.useFakeTimers();
    try {
      render(first, false);
      const origin = document.createElement("textarea");
      origin.dataset.launchOrigin = "true";
      notePromptLaunch(origin);
      render(second);
      const row = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"]')!;
      expect(row.style.visibility).toBe("hidden");
      act(() => vi.advanceTimersByTime(20));
      expect(risenPrompts()).toEqual(["u2"]);
      expect(animate.mock.contexts[0]).toHaveProperty("className", expect.stringContaining("user-message-bubble"));
      expect(animate.mock.calls[0][0][0]).toMatchObject({
        transform: "translate(-80.00px, 680.00px) scale(1.0000, 1.0000)",
      });
      // Once the composer origin is spent, later sends still start at the bottom.
      render([...second, { id: "u3", role: "user", text: "Again" }]);
      act(() => vi.advanceTimersByTime(20));
      expect(animate.mock.calls.at(-2)![0][0]).toMatchObject({
        transform: "translate(0.00px, 732.00px) scale(1.0000, 1.0000)",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("lifts at the input width but keeps the landed message height while narrowing", () => {
    render(first, false, { promptMotion: "mobile" });
    const surface = document.createElement("div");
    surface.setAttribute("data-prompt-launch-surface", "");
    const area = document.createElement("textarea");
    area.dataset.launchOrigin = "true";
    surface.append(area);
    notePromptLaunch(area);
    render(second, true, { promptMotion: "mobile" });
    act(() => vi.advanceTimersByTime(20));

    const [frames, timing] = animate.mock.calls[0];
    expect(frames[0]).toMatchObject({
      width: "340.00px",
      height: "60.00px",
      transform: "translate(-52.00px, 720.00px) scale(1.0000, 1.0000)",
    });
    const lift = frames.find((frame: Keyframe) => Number(frame.offset) * timing.duration >= 100);
    expect(lift).toMatchObject({ width: "340.00px", height: "60.00px" });
    const contracting = frames.find((frame: Keyframe) => Number(frame.offset) * timing.duration >= 320);
    expect(parseFloat(contracting.width)).toBeLessThan(330);
    expect(parseFloat(contracting.width)).toBeGreaterThan(200);
    expect(frames.at(-1)).toMatchObject({ width: "200.00px", height: "60.00px" });
    expect(frames.every((frame: Keyframe) => frame.height === "60.00px")).toBe(true);
    expect(animate.mock.calls[1][0][0]).toEqual({ opacity: 1 });
  });

  it("starts desktop sends above the dock even when the recorded origin has expired", () => {
    render(first, false);
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const origin = document.createElement("textarea");
    origin.dataset.launchOrigin = "true";
    notePromptLaunch(origin);
    now.mockReturnValue(15_001);

    render(second);
    const scroller = container.querySelector<HTMLElement>(".agent-transcript")!;
    // Measure after the cleared composer has published its new layout.
    scroller.style.paddingBottom = "128px";
    expect(animate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(20));

    expect(risenPrompts()).toEqual(["u2"]);
    expect(animate.mock.calls[0][0][0]).toMatchObject({
      transform: "translate(0.00px, 604.00px) scale(1.0000, 1.0000)",
    });
    expect(animate.mock.calls[1][0][0]).toEqual({ opacity: 0 });
  });

  it.each([undefined, "mobile"] as const)("cancels a pending entrance when the transcript unmounts (motion=%s)", (promptMotion) => {
    vi.useFakeTimers();
    try {
      render(first, true, { promptMotion });
      const row = container.querySelector<HTMLElement>('[data-prompt-anchor="u1"]')!;
      act(() => root.unmount());
      act(() => vi.advanceTimersByTime(20));
      expect(animate).not.toHaveBeenCalled();
      expect(row.style.visibility).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([undefined, "mobile"] as const)("keeps history and reduced-motion sends still (motion=%s)", (promptMotion) => {
    render(second, false, { promptMotion });
    act(() => vi.advanceTimersByTime(20));
    expect(animate).not.toHaveBeenCalled();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render([...second, { id: "u3", role: "user", text: "Again" }], true, { promptMotion });
    act(() => vi.advanceTimersByTime(20));
    expect(animate).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLElement>('[data-prompt-anchor="u3"]')!.style.visibility).toBe("");
  });
});
