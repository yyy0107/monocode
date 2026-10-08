// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";

const appearance = vi.hoisted(() => ({
  layout: "chat" as "chat" | "full",
  anchor: true,
  // Where earlier turns sit; moving it between renders models a send's scroll.
  turnTop: 0,
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
  appearance.turnTop = 0;
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
      if (this.classList.contains("transcript-turn") && !this.querySelector("[data-prompt-anchor='u2']"))
        return { left: 0, right: 400, width: 400, top: appearance.turnTop, bottom: appearance.turnTop + 100, height: 100 } as DOMRect;
      return (
        this.dataset.promptAnchor || this.classList.contains("user-message-bubble")
          ? { left: 200, right: 400, width: 200, top: 0, bottom: 60, height: 60 }
          : { left: 0, right: 400, width: 400, top: 0, bottom: 800, height: 800 }
      ) as DOMRect;
    },
  );
  animate = vi.fn(() => {
    let finish!: () => void;
    let cancel!: (reason: Error) => void;
    const finished = new Promise<void>((resolve, reject) => { finish = resolve; cancel = reject; });
    // Native Animation only creates this promise when its getter is read.
    void finished.catch(() => {});
    return { finished, startTime: null, finish, cancel: vi.fn(() => cancel(new Error("cancelled"))) };
  });
  HTMLElement.prototype.animate = animate as never;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
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
  it("slides the first prompt up from the dock and settles it from a pending tint", () => {
    render(first);
    act(() => vi.advanceTimersByTime(20));

    expect(risenPrompts()).toEqual(["u1"]);
    const [slide] = animate.mock.calls[0];
    const [settle] = animate.mock.calls[1];
    expect(slide).toEqual([
      { transform: "translateY(732.00px)" },
      { transform: "translateY(0px)" },
    ]);
    expect(settle[0]).toEqual({ opacity: 0.5 });
    expect(settle.at(-1)).toEqual({ opacity: 1 });
    // The message keeps its landed shape: nothing resizes or scales.
    for (const [frames] of animate.mock.calls) {
      for (const frame of frames) {
        expect(frame).not.toHaveProperty("width");
        expect(frame.transform ?? "").not.toContain("scale");
      }
    }
  });

  it("holds the rest of the turn until the animation actually finishes", async () => {
    render(first);
    const turn = container.querySelector<HTMLElement>(".transcript-turn")!;
    expect(turn.dataset.promptRise).toBe("rising");

    act(() => vi.advanceTimersByTime(20));
    act(() => vi.advanceTimersByTime(2000));
    expect(turn.dataset.promptRise).toBe("rising");
    await act(async () => animate.mock.results[0].value.finish());
    expect(turn.dataset.promptRise).toBe("revealing");

    act(() => vi.advanceTimersByTime(180));
    expect(turn.dataset.promptRise).toBeUndefined();
  });

  it("rises each newly sent prompt", () => {
    render(first, false);
    render(second);
    act(() => vi.advanceTimersByTime(20));

    expect(risenPrompts()).toEqual(["u2"]);
  });

  it.each([true, false])("scrolls the earlier turn and the new prompt together (anchor=%s)", (anchor) => {
    appearance.anchor = anchor;
    appearance.turnTop = 300;
    render(first, false);
    render(second);
    // The send moved the previous turn up by 200px.
    appearance.turnTop = 100;
    act(() => vi.advanceTimersByTime(20));

    const bubble = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"] .user-message-bubble')!;
    const previous = container.querySelector<HTMLElement>('[data-prompt-anchor="u1"]')!
      .closest<HTMLElement>(".transcript-turn")!;
    const slideOf = (element: HTMLElement) =>
      animate.mock.calls[animate.mock.contexts.indexOf(element)];
    expect(slideOf(bubble)[0][0]).toEqual({ transform: "translateY(200.00px)" });
    expect(slideOf(previous)[0]).toEqual(slideOf(bubble)[0]);
    expect(slideOf(previous)[1]).toEqual(slideOf(bubble)[1]);
  });

  it("keeps a sending prompt tinted and hands its slide to the recorded copy", async () => {
    const sending: Block[] = [
      ...first,
      { id: "a1", role: "assistant", text: "Hi" },
      { id: "sending:1", role: "user", text: "Next", sending: true },
    ];
    render(first, false);
    render(sending, false);
    act(() => vi.advanceTimersByTime(20));
    const pendingRow = container.querySelector<HTMLElement>('[data-prompt-anchor="sending:1"]')!;
    expect(pendingRow.dataset.sending).toBe("true");
    expect(risenPrompts()).toEqual(["sending:1"]);
    // No settle: the tint stays until the Host records the message.
    expect(animate.mock.calls.some(([frames]) => "opacity" in frames[0])).toBe(false);
    const slide = animate.mock.calls[0];
    const running = animate.mock.results.map((result) => result.value);

    render(second);
    const bubble = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"] .user-message-bubble')!;
    const index = animate.mock.contexts.lastIndexOf(bubble);
    expect(index).toBeGreaterThan(0);
    expect(animate.mock.calls[index]).toEqual(slide);
    for (const animation of running) expect(animation.cancel).not.toHaveBeenCalled();
    expect(bubble.closest<HTMLElement>("[data-prompt-anchor]")!.dataset.sending).toBeUndefined();
    await act(async () => animate.mock.results[0].value.finish());
    expect(bubble.closest<HTMLElement>(".transcript-turn")!.dataset.promptRise).toBe("revealing");
  });

  it("lifts a recorded copy to full strength once the slide has landed", async () => {
    render(first, false);
    render([...first, { id: "sending:1", role: "user", text: "Next", sending: true }], false);
    act(() => vi.advanceTimersByTime(20));
    await act(async () => animate.mock.results[0].value.finish());
    const calls = animate.mock.calls.length;

    render([...first, { id: "u2", role: "user", text: "Next" }]);
    expect(animate.mock.calls.slice(calls).map(([frames]) => frames)).toEqual([
      [{ opacity: 0.5 }, { opacity: 1 }],
    ]);
  });

  it("lifts a prompt the Host records under the same id where it is", () => {
    render(first, false);
    render([...first, { id: "u2", role: "user", text: "Next", sending: true }], false);
    act(() => vi.advanceTimersByTime(20));
    const row = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"]')!;
    const calls = animate.mock.calls.length;

    render([...first, { id: "u2", role: "user", text: "Next" }]);
    expect(container.querySelector('[data-prompt-anchor="u2"]')).toBe(row);
    expect(row.dataset.sending).toBeUndefined();
    expect(animate.mock.calls.slice(calls).map(([frames]) => frames)).toEqual([
      [{ opacity: 0.5 }, { opacity: 1 }],
    ]);
  });

  it("drops a withdrawn sending prompt without replaying the previous one", () => {
    render(first, false);
    render([...first, { id: "sending:1", role: "user", text: "Next", sending: true }], false);
    act(() => vi.advanceTimersByTime(20));
    const calls = animate.mock.calls.length;
    const running = animate.mock.results.map((result) => result.value);

    render(first, false);
    act(() => vi.advanceTimersByTime(20));
    expect(animate.mock.calls).toHaveLength(calls);
    for (const animation of running) expect(animation.cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    [true, "Caption"], [false, "Caption"], [true, ""], [false, ""],
  ] as const)("slides sent images with their caption and supports image-only sends (anchor=%s, text=%s)", async (anchor, text) => {
    appearance.anchor = anchor;
    render(first, false, { promptMotion: "mobile" });
    render([...first, {
      id: "u2", role: "user", text,
      attachments: ["one", "two"].map(id => ({
        id, name: `${id}.png`, kind: "image", mimeType: "image/png", data: "aGVsbG8=", size: 5,
      })),
    }], true, { promptMotion: "mobile" });
    const row = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"]')!;
    const bubble = row.querySelector<HTMLElement>(".user-message-bubble")!;
    const media = row.querySelector<HTMLElement>(".user-message-media")!;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue(text
      ? { left: 200, right: 400, width: 200, top: 270, bottom: 330, height: 60 } as DOMRect
      : { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 } as DOMRect);
    vi.spyOn(media, "getBoundingClientRect").mockReturnValue({
      left: 120, right: 400, width: 280, top: 100, bottom: 260, height: 160,
    } as DOMRect);
    act(() => vi.advanceTimersByTime(20));

    const mediaIndex = animate.mock.contexts.indexOf(media);
    expect(mediaIndex).toBeGreaterThanOrEqual(0);
    expect(bubble.hidden).toBe(!text);
    expect(animate.mock.calls[mediaIndex][0][0]).toEqual({
      transform: text ? "translateY(462.00px)" : "translateY(532.00px)",
    });
    expect(animate.mock.calls[mediaIndex][0]).toEqual(animate.mock.calls[0][0]);
    expect(animate.mock.calls[mediaIndex][1]).toEqual(animate.mock.calls[0][1]);
    expect(animate.mock.results[mediaIndex].value.startTime).toBe(animate.mock.results[0].value.startTime);

    await act(async () => animate.mock.results[0].value.finish());
    expect(row.closest<HTMLElement>(".transcript-turn")!.dataset.promptRise).toBe("revealing");
    expect(media.querySelectorAll("img")).toHaveLength(2);
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

  it("starts mobile sends above the dock after layout, including a reply completed before sync", async () => {
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
    expect(animate.mock.calls[0][0][0]).toEqual({ transform: "translateY(604.00px)" });
    const turn = row.closest<HTMLElement>(".transcript-turn")!;
    // The rest of the turn follows once the bubble lands.
    await act(async () => animate.mock.results[0].value.finish());
    expect(turn.dataset.promptRise).toBe("revealing");
    act(() => vi.advanceTimersByTime(180));
    expect(turn.dataset.promptRise).toBeUndefined();
    render(second, false, { promptMotion: "mobile", animateFrom: "u2" });
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("cancels the previous slide on the next send without revealing the old turn", async () => {
    render(first, false);
    render(second);
    act(() => vi.advanceTimersByTime(20));
    const oldTurn = container.querySelector<HTMLElement>('[data-prompt-anchor="u2"]')!.closest<HTMLElement>(".transcript-turn")!;
    const previousAnimations = animate.mock.results.map(result => result.value);
    render([...second, { id: "u3", role: "user", text: "Again" }]);
    await act(async () => {});
    expect(oldTurn.dataset.promptRise).toBeUndefined();
    for (const animation of previousAnimations) expect(animation.cancel).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(20));
    expect(container.querySelector('[data-prompt-anchor="u3"]')!.closest<HTMLElement>(".transcript-turn")!.dataset.promptRise).toBe("rising");
  });

  it("cancels a slide when hidden and does not replay it when shown", async () => {
    render(first);
    act(() => vi.advanceTimersByTime(20));
    const slide = animate.mock.results[0].value;
    await act(async () => root.render(createElement(AgentTranscript, { blocks: first, busy: true, visible: false })));
    expect(slide.cancel).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLElement>(".transcript-turn")!.dataset.promptRise).toBeUndefined();
    render(first);
    act(() => vi.advanceTimersByTime(20));
    expect(animate).toHaveBeenCalledTimes(2);
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

  it.each([
    [undefined, true], ["mobile", true], [undefined, false], ["mobile", false],
  ] as const)("keeps history and reduced-motion sends still (motion=%s, anchor=%s)", (promptMotion, anchor) => {
    appearance.anchor = anchor;
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
