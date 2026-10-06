import { expect, it } from "vitest";
import {
  buildBrainPrompt,
  relativeGap,
  splitReply,
  PERSONA_PRESETS,
} from "./prompt";
import type { AssistantRecord, Wakeup } from "./store";
import { fullAssistantPolicy } from "../../src/features/assistant/model/assistant";

it("splits bubbles at breaks and holds a partially streamed break", () => {
  expect(splitReply("One<msg_break/> Two ")).toEqual(["One", "Two"]);
  expect(splitReply("One<msg_br", true)).toEqual(["One"]);
  expect(splitReply("One<msg_br", false)).toEqual(["One<msg_br"]);
  expect(splitReply("<msg_break/>Two")).toEqual(["", "Two"]);
});
it("describes gaps like a person would", () => {
  expect(relativeGap(10_000)).toBe("just now");
  expect(relativeGap(5 * 60000)).toBe("5 minutes ago");
  expect(relativeGap(3 * 3600000)).toBe("3 hours ago");
  expect(relativeGap(2 * 86400000)).toBe("2 days ago");
});
it("gives the brain local time, conversation gap, personality and promises", () => {
  const now = Date.UTC(2026, 9, 5, 1, 30);
  const wakeup: Wakeup = {
    id: "w2",
    kind: "user",
    text: "Any news?",
    rootCauseId: "w2",
    state: "running",
    createdAt: now,
    attempts: 1,
  };
  const prompt = buildBrainPrompt({
    config: {
      name: "Muse",
      persona: {
        preset: "partner",
        style: "Tease me a little",
        userName: "Wy",
      },
      timezone: "Asia/Shanghai",
      policy: fullAssistantPolicy(),
      reminders: [
        {
          id: "r1",
          dueAt: now + 1800000,
          prompt: "Check the login fix",
          createdAt: now,
          createdBy: "w1",
          rootCauseId: "w1",
          state: "pending",
        },
      ],
    } as unknown as AssistantRecord,
    launcher: "monocode-host",
    actions: ["projects.list"],
    wakeup,
    messages: [
      {
        id: "a",
        kind: "assistant",
        text: "Done.",
        revision: 1,
        createdAt: now - 3 * 3600000,
      },
      {
        id: "u",
        kind: "user",
        text: "Any news?",
        wakeupId: "w2",
        revision: 2,
        createdAt: now,
      },
    ],
    ledger: [],
    now,
  });
  expect(prompt).toContain("Monday, October 5, 2026");
  expect(prompt).toContain("09:30");
  expect(prompt).toContain("Asia/Shanghai");
  expect(prompt).toContain("3 hours ago");
  expect(prompt).toContain(PERSONA_PRESETS.partner);
  expect(prompt).toContain("Tease me a little");
  expect(prompt).toContain('"Wy"');
  expect(prompt).toContain("Check the login fix");
  expect(prompt).toContain("<assistant_quiet/>");
});
