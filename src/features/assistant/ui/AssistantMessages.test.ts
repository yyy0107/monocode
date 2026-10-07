// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AssistantMessage } from "../model/assistant";
import { AssistantMessages } from "./AssistantMessages";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";
import { quoteAssistantReply, splitAssistantReply } from "../model/assistantReply";

vi.mock("../../sessions/ui/AgentMarkdown", () => ({
  AgentMarkdown: vi.fn(({ text }: { text: string }) =>
    createElement("p", null, text),
  ),
}));
vi.mock("../../sessions/ui/useTranscriptRenderingPlatform", () => ({
  AfterTextReveal: ({ children }: { children: React.ReactNode }) => children,
}));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  vi.mocked(AgentMarkdown).mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

it.each([true, false])("separates the quote above a mobile sent bubble while retaining full copy text (mobile: %s)", (mobile) => {
  const quote = "我先检查你电脑上\n\n本地提交和远程分支，再推送已有提交";
  const text = `${quoteAssistantReply(quote)}\n\n你好\n请继续`;
  const bindReply = vi.fn(() => ({}));
  act(() => root.render(createElement(AssistantMessages, {
    messages: [{ kind: "user", id: "sent", revision: 1, createdAt: 1, text }],
    canRead: true,
    mobile,
    busy: false,
    bindReply,
    onOpen: vi.fn(),
    onRespond: vi.fn(),
  })));
  expect(node.querySelector(".assistant-message-user")?.textContent).toBe(mobile ? "你好\n请继续" : text);
  const context = node.querySelector(".assistant-message-reply-context");
  if (mobile) {
    expect(context?.textContent).toBe(quote);
    expect(context?.querySelector("svg")).not.toBeNull();
    expect(bindReply).toHaveBeenCalledWith(text, false);
  } else expect(context).toBeNull();
});

it("recognizes legacy multiline quotes without consuming the reply's own paragraphs", () => {
  expect(splitAssistantReply("> First\r\n> \r\n> Last\r\n\r\nReply\r\n\r\nDetails")).toEqual({
    quote: "First\n\nLast", text: "Reply\r\n\r\nDetails",
  });
  for (const text of ["Hello\n\nWorld", "> literal without reply", "> Quote\nUnquoted\n\nBody", "A > B\n\nBody"])
    expect(splitAssistantReply(text)).toBeUndefined();
});

it("leaves settled message rows alone while the final reply grows", () => {
  const messages: AssistantMessage[] = Array.from(
    { length: 40 },
    (_, index) => ({
      kind: "assistant",
      id: String(index),
      text: `Reply ${index}`,
      revision: index,
      createdAt: index,
    }),
  );
  const actions = {
    onOpen: vi.fn(),
    onRespond: vi.fn(),
    bindReply: vi.fn(() => ({})),
  };
  const render = (messages: AssistantMessage[], busy = false) =>
    act(() =>
      root.render(
        createElement(AssistantMessages, {
          ...actions,
          messages,
          canRead: true,
          allowedProjects: "all",
          mobile: true,
          busy,
        }),
      ),
    );
  render(messages);
  vi.mocked(AgentMarkdown).mockClear();
  actions.bindReply.mockClear();
  render(messages);
  render(messages, true);
  expect(AgentMarkdown).not.toHaveBeenCalled();
  expect(actions.bindReply).not.toHaveBeenCalled();
  const next = messages.slice();
  next[39] = {
    ...next[39],
    text: "New output",
    revision: 41,
  } as AssistantMessage;
  render(next, true);
  expect(AgentMarkdown).toHaveBeenCalledTimes(1);
  expect(actions.bindReply).toHaveBeenCalledOnce();
  expect(node.textContent).toContain("New output");
});

it.each(["user", "assistant"] as const)("renders persisted %s attachments above the caption and opens them", async kind => {
  const image = { id: "photo", name: "photo.png", mimeType: "image/png", kind: "image" as const, size: 3 };
  const readImage = vi.fn(async () => btoa("png"));
  const props = {
    messages: [{ id: "message", revision: 1, createdAt: 1, kind, text: "Caption", attachments: [image,
      { id: "file", name: "notes.txt", mimeType: "text/plain", kind: "file" as const, size: 1 },
    ] }],
    canRead: true, mobile: true, busy: false, readImage, onOpenAttachment: vi.fn(),
    bindReply: vi.fn(() => ({})), onOpen: vi.fn(), onRespond: vi.fn(),
  };
  await act(async () => root.render(createElement(AssistantMessages, props)));
  const media = node.querySelector(".assistant-message-media")!;
  expect(media.querySelector(".attachment-chip-thumbnail")?.getAttribute("src")).toBe(`data:image/png;base64,${btoa("png")}`);
  expect(media.querySelector(".attachment-chip-card-name")?.textContent).toBe("notes.txt");
  expect(media.nextElementSibling?.textContent).toBe("Caption");
  act(() => media.querySelector<HTMLButtonElement>("[aria-label=\"Open notes.txt\"]")!.click());
  expect(props.onOpenAttachment).toHaveBeenCalledExactlyOnceWith("message", props.messages[0].attachments[1]);
  expect(readImage).toHaveBeenCalledExactlyOnceWith("message", image);
  await act(async () => root.render(createElement(AssistantMessages, { ...props, busy: true })));
  await act(async () => root.render(createElement(AssistantMessages, {
    ...props, messages: [{ ...props.messages[0], revision: 2, attachments: props.messages[0].attachments.map(file => ({ ...file })) }],
  })));
  expect(readImage).toHaveBeenCalledOnce();
  act(() => media.querySelector<HTMLButtonElement>("button")!.click());
  expect(document.querySelector(".image-lightbox img")?.getAttribute("alt")).toBe("photo.png");
  act(() => document.querySelector<HTMLButtonElement>(".image-lightbox-close")!.click());
  expect(document.querySelector(".image-lightbox")).toBeNull();
});

it("shows image-only history without an empty bubble and falls back to its filename if unavailable", async () => {
  const readImage = vi.fn().mockRejectedValue(new Error("Older Host"));
  await act(async () => root.render(createElement(AssistantMessages, {
    messages: [{ id: "message", revision: 1, createdAt: 1, kind: "user", text: "", attachments: [
      { id: "photo", name: "photo.png", mimeType: "image/png", kind: "image", size: 3 },
    ] }],
    canRead: true, mobile: true, busy: false, readImage,
    bindReply: vi.fn(() => ({})), onOpen: vi.fn(), onRespond: vi.fn(),
  })));
  expect(node.querySelector(".assistant-message-user")).toBeNull();
  expect(node.querySelector(".assistant-message-media")?.textContent).toBe("photo.png");
  expect(node.querySelector(".attachment-chip-thumbnail")).toBeNull();
});
