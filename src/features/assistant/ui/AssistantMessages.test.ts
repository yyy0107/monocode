// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AssistantMessage } from "../model/assistant";
import { AssistantMessages } from "./AssistantMessages";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";

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
