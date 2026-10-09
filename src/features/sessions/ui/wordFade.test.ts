// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentMarkdown } from "./AgentMarkdown";
import {
  revealEnd,
  WORD_FADE_MS,
  characterBoundaries,
  usePacedText,
  useWordFading,
  type TextRevealOptions,
} from "./wordFade";
import { TranscriptPlatformContext } from "./TranscriptPlatform";
import { SurfaceVisibilityContext } from "../../../shared/ui/SurfaceVisibility";
import {
  applyReducedMotion,
  REDUCED_MOTION_CHANGE_EVENT,
} from "../../../shared/lib/reducedMotion";
import { TextRevealQueue } from "./textRevealQueue";
import { AfterTextReveal } from "./useTranscriptRenderingPlatform";

describe("revealEnd", () => {
  it("keeps emoji, combining marks, and flags together for character reveal", () => {
    expect(characterBoundaries("A👩‍💻e\u0301🇨🇳")).toEqual([1, 6, 8, 12]);
  });
  it("stops at the end of the word the reveal has reached", () => {
    expect(revealEnd("Hello there friend", 0, true)).toBe(5);
    expect(revealEnd("Hello there friend", 6.2, true)).toBe(11);
    expect(revealEnd("Hello there", 5, true)).toBe(5);
  });

  it("holds a word still being streamed back until it is whole", () => {
    expect(revealEnd("Hello the", 7, true)).toBe(6);
    expect(revealEnd("Hel", 1, true)).toBe(0);
  });

  it("lets the last word out once the stream has ended", () => {
    expect(revealEnd("Hello the", 7, false)).toBe(9);
  });
});

describe("text reveal activity", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hidden = false;

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
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    applyReducedMotion("off");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    applyReducedMotion("system");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function Probe({
    id = "reply",
    text,
    streaming = true,
    options = { unit: "character", initialLength: 0 },
  }: {
    id?: string;
    text: string;
    streaming?: boolean;
    options?: TextRevealOptions;
  }) {
    const paced = usePacedText(text, streaming, options);
    return createElement(
      "span",
      { id, "data-revealing": paced.revealing },
      paced.text,
    );
  }

  function render(text: string, visible = true) {
    act(() =>
      root.render(
        createElement(
          SurfaceVisibilityContext.Provider,
          { value: visible },
          createElement(Probe, { text }),
        ),
      ),
    );
  }

  function changeDocumentVisibility(value: boolean) {
    act(() => {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  const reply = "一段需要逐字呈现的文本，其中也包含👩‍💻以及额外的文字。";

  it.each(["surface", "document", "reduced motion"])(
    "catches up when its %s hides and resumes pacing only new text",
    (kind) => {
      render(reply);
      act(() => vi.advanceTimersByTime(100));
      expect(container.textContent!.length).toBeGreaterThan(0);
      expect(container.textContent!.length).toBeLessThan(reply.length);

      if (kind === "surface") render(reply, false);
      else if (kind === "document") changeDocumentVisibility(true);
      else act(() => applyReducedMotion("on"));
      expect(container.textContent).toBe(reply);
      expect(vi.getTimerCount()).toBe(0);

      const receivedWhileHidden = reply + reply;
      render(receivedWhileHidden, kind !== "surface");
      expect(container.textContent).toBe(receivedWhileHidden);
      expect(vi.getTimerCount()).toBe(0);

      if (kind === "surface") render(receivedWhileHidden);
      else if (kind === "document") changeDocumentVisibility(false);
      else act(() => applyReducedMotion("off"));
      expect(container.textContent).toBe(receivedWhileHidden);
      expect(vi.getTimerCount()).toBe(0);

      render(receivedWhileHidden + reply);
      expect(container.textContent).toBe(receivedWhileHidden);
      act(() => vi.advanceTimersByTime(100));
      expect(container.textContent!.length).toBeGreaterThan(
        receivedWhileHidden.length,
      );
      expect(container.textContent!.length).toBeLessThan(
        receivedWhileHidden.length + reply.length,
      );
    },
  );

  it("cancels a held incomplete word when the document hides", () => {
    act(() =>
      root.render(
        createElement(Probe, {
          text: "Hello wor",
          options: { unit: "word", initialLength: 0 },
        }),
      ),
    );
    act(() => vi.advanceTimersByTime(112));
    expect(container.textContent).toBe("Hello ");
    expect(vi.getTimerCount()).toBe(1);
    changeDocumentVisibility(true);
    expect(container.textContent).toBe("Hello wor");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["surface", "document", "reduced motion"])(
    "finishes queued stream tails on %s suspension and releases AfterTextReveal",
    (kind) => {
      const queue = new TextRevealQueue();
      queue.setOrder(["first", "second"]);
      const entries = [{ id: "first" }, { id: "second" }];
      let streaming = true;
      function renderReplies(visible = true) {
        act(() =>
          root.render(
            createElement(
              SurfaceVisibilityContext.Provider,
              { value: visible },
              createElement(
                TranscriptPlatformContext.Provider,
                {
                  value: {
                    copyText: async () => {},
                    copyMessage: async () => {},
                    openExternal: async () => {},
                    readBinaryFile: async () => new Uint8Array(),
                    localFiles: false,
                    textRevealQueue: queue,
                  },
                },
                ...entries.map(({ id }) =>
                  createElement(Probe, {
                    key: id,
                    id,
                    text: reply,
                    streaming,
                    options: {
                      unit: "character",
                      initialLength: 0,
                      sequence: queue.forEntry(id),
                    },
                  }),
                ),
                createElement(AfterTextReveal, {
                  entries: entries.map((entry) => ({ ...entry, streaming })),
                  children: createElement("span", { id: "after" }, "Done"),
                }),
              ),
            ),
          ),
        );
      }
      renderReplies();
      act(() => vi.advanceTimersByTime(100));
      expect(
        container.querySelector("#first")!.textContent!.length,
      ).toBeGreaterThan(0);
      expect(container.querySelector("#second")!.textContent).toBe("");
      expect(queue.isPending("first")).toBe(true);
      expect(queue.isPending("second")).toBe(true);
      expect(container.querySelector("#after")).toBeNull();
      streaming = false;
      renderReplies();
      expect(container.querySelector("#after")).toBeNull();

      if (kind === "surface") renderReplies(false);
      else if (kind === "document") changeDocumentVisibility(true);
      else act(() => applyReducedMotion("on"));
      expect(container.querySelector("#first")!.textContent).toBe(reply);
      expect(container.querySelector("#second")!.textContent).toBe(reply);
      expect(queue.isPending("first")).toBe(false);
      expect(queue.isPending("second")).toBe(false);
      expect(container.querySelector("#after")!.textContent).toBe("Done");
      expect(vi.getTimerCount()).toBe(0);

      if (kind === "surface") renderReplies();
      else if (kind === "document") changeDocumentVisibility(false);
      else act(() => applyReducedMotion("off"));
      expect(container.querySelector("#first")!.textContent).toBe(reply);
      expect(container.querySelector("#second")!.textContent).toBe(reply);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("shares activity listeners while streaming and removes them for completed history", () => {
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    function renderReplies(streaming: boolean) {
      act(() =>
        root.render(
          createElement(
            "div",
            null,
            ...["first", "second"].map((id) =>
              createElement(Probe, {
                key: id,
                text: reply,
                streaming,
                options: { unit: "character", initialLength: reply.length },
              }),
            ),
          ),
        ),
      );
    }
    renderReplies(false);
    expect(
      addDocument.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(0);
    renderReplies(true);
    expect(
      addDocument.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);
    expect(
      addWindow.mock.calls.filter(
        ([type]) => type === REDUCED_MOTION_CHANGE_EVENT,
      ),
    ).toHaveLength(1);
    renderReplies(false);
    expect(
      removeDocument.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);
    expect(
      removeWindow.mock.calls.filter(
        ([type]) => type === REDUCED_MOTION_CHANGE_EVENT,
      ),
    ).toHaveLength(1);
    renderReplies(true);
    act(() => root.render(null));
    expect(
      removeDocument.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(2);
    expect(
      removeWindow.mock.calls.filter(
        ([type]) => type === REDUCED_MOTION_CHANGE_EVENT,
      ),
    ).toHaveLength(2);
  });

  it("does not keep a fade-tail timer running on a hidden surface", () => {
    function Fade({ active }: { active: boolean }) {
      return createElement("span", null, String(useWordFading(active)));
    }
    function renderFade(active: boolean, visible = true) {
      act(() =>
        root.render(
          createElement(
            SurfaceVisibilityContext.Provider,
            { value: visible },
            createElement(Fade, { active }),
          ),
        ),
      );
    }
    renderFade(true);
    renderFade(false);
    expect(container.textContent).toBe("true");
    expect(vi.getTimerCount()).toBe(1);
    renderFade(false, false);
    expect(container.textContent).toBe("false");
    expect(vi.getTimerCount()).toBe(0);
    renderFade(false);
    expect(container.textContent).toBe("false");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("paced streaming", () => {
  let container: HTMLDivElement;
  let root: Root;

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
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const reply =
    "I will review the current diff and recent commits, then check the affected code for regressions.";

  function render(text: string, streaming: boolean) {
    act(() => root.render(createElement(AgentMarkdown, { text, streaming })));
  }
  function renderCharacters(
    text: string,
    streaming: boolean,
    initialLength: number,
  ) {
    act(() =>
      root.render(
        createElement(
          TranscriptPlatformContext.Provider,
          {
            value: {
              copyText: async () => {},
              copyMessage: async () => {},
              openExternal: async () => {},
              readBinaryFile: async () => new Uint8Array(),
              localFiles: false,
              textReveal: () => ({ unit: "character", initialLength }),
            },
          },
          createElement(AgentMarkdown, {
            text,
            streaming,
            streamingKey: "reply",
          }),
        ),
      ),
    );
  }

  function shown() {
    return container.textContent ?? "";
  }

  function fading() {
    return !!container.querySelector(".agent-markdown.word-fading");
  }

  function word(text: string) {
    return [...container.querySelectorAll("[data-word-fade]")].find(
      (span) => span.textContent === text,
    );
  }

  it("lets a burst out a word at a time rather than all at once", () => {
    render("", true);
    render(reply, true);
    expect(shown()).toBe("");
    expect(fading()).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    const early = shown();
    expect(early.length).toBeGreaterThan(0);
    expect(early.length).toBeLessThan(reply.length);
    expect(reply.startsWith(early)).toBe(true);
    expect(early.endsWith(" ")).toBe(false);

    act(() => vi.advanceTimersByTime(2_000));
    expect(shown()).toBe(reply);
  });

  it("adds each word as its own span and never replaces one already shown", () => {
    render("", true);
    render("I will review ", true);
    act(() => vi.advanceTimersByTime(500));
    const first = word("I");
    expect(first).toBeDefined();

    // The fade plays as a span is added, so a word that keeps its element as
    // the reply grows is a word that does not fade again.
    render("I will review the diff and **recent** commits ", true);
    act(() => vi.advanceTimersByTime(1_000));
    expect(shown()).toBe("I will review the diff and recent commits");
    expect(word("I")).toBe(first);
    expect(word("recent")?.parentElement?.dataset.streamdown).toBe("strong");

    render("I will review the diff and **recent** commits", false);
    // The last word is still fading, so the spans already on screen stay put.
    expect(word("I")).toBe(first);
    act(() => vi.advanceTimersByTime(WORD_FADE_MS));
    expect(shown()).toBe("I will review the diff and recent commits");
    expect(fading()).toBe(false);
    expect(container.querySelector("[data-word-fade]")).toBeNull();
  });

  it("holds back a word still being written until the stream pauses on it", () => {
    render("", true);
    render("Hello wor", true);
    act(() => vi.advanceTimersByTime(100));
    expect(shown()).toBe("Hello");

    act(() => vi.advanceTimersByTime(300));
    expect(shown()).toBe("Hello wor");
  });

  it("finishes a stream that ends ahead of the reveal at pace, then stops fading", () => {
    render("", true);
    render(reply, true);
    render(reply, false);
    expect(shown()).toBe("");

    act(() => vi.advanceTimersByTime(2_000));
    expect(shown()).toBe(reply);
    act(() => vi.advanceTimersByTime(WORD_FADE_MS));
    // A finished reply drops its word spans, so hiding and showing it cannot
    // replay the fade.
    expect(fading()).toBe(false);
    expect(container.querySelector("[data-word-fade]")).toBeNull();
    expect(shown()).toBe(reply);
  });

  it("shows a reply that never streamed whole, as plain text", () => {
    render(reply, false);
    expect(shown()).toBe(reply);
    expect(fading()).toBe(false);
    expect(container.querySelector("[data-word-fade]")).toBeNull();
  });

  it("leaves code and links whole", () => {
    render("", true);
    render("Run `npm test` and see [the docs](https://example.com) now ", true);
    act(() => vi.advanceTimersByTime(2_000));
    expect(container.querySelector("code [data-word-fade]")).toBeNull();
    expect(container.querySelector("a [data-word-fade]")).toBeNull();
    expect(word("now")).toBeDefined();
  });
  it("reveals Chinese without spaces character by character even when the first batch already finished", () => {
    const text =
      "这是一段没有空格的中文输出。我们会逐字展示收到的消息，而不会整句跳出来。";
    renderCharacters(text, false, 0);
    expect(shown()).toBe("");
    act(() => vi.advanceTimersByTime(100));
    const early = shown();
    expect(early.length).toBeGreaterThan(0);
    expect(early.length).toBeLessThan(text.length);
    expect(text.startsWith(early)).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(shown()).toBe(text);
  });
  it("keeps an existing live reply visible and gradually catches up with later chunks", () => {
    const existing = "之前已经收到的内容。";
    const text = existing + "后面又收到了一段中文，继续逐字展示新增内容。";
    renderCharacters(existing, true, existing.length);
    expect(shown()).toBe(existing);
    renderCharacters(text, true, existing.length);
    expect(shown()).toBe(existing);
    act(() => vi.advanceTimersByTime(100));
    expect(shown().startsWith(existing)).toBe(true);
    expect(shown().length).toBeGreaterThan(existing.length);
    expect(shown().length).toBeLessThan(text.length);
    renderCharacters(text, false, existing.length);
    act(() => vi.advanceTimersByTime(2000));
    expect(shown()).toBe(text);
  });
  it("does not animate completed history when reopening a conversation", () => {
    renderCharacters(reply, false, reply.length);
    expect(shown()).toBe(reply);
    act(() => vi.advanceTimersByTime(100));
    expect(shown()).toBe(reply);
  });
});
