import { describe, expect, it } from "vitest";
import { LIVE_VERBS, liveStatus, liveVerb } from "./liveStatus";
import type { Block } from "./session";

const user: Block = { id: "u1", role: "user", text: "fix it", startedAt: 0 };

function thought(patch: Partial<Block> = {}): Block {
  return { id: "r1", role: "reasoning", text: "hmm", startedAt: 1_000, ...patch };
}

function command(status: string): Block {
  return {
    id: "t1",
    role: "tool",
    text: "Ran ls",
    tool: { kind: "execute", title: "ls", status },
  };
}

describe("liveStatus", () => {
  it("says what the turn is waiting on before anything else", () => {
    const status = liveStatus({
      turn: [user, thought({ streaming: true })],
      now: 5_000,
      waiting: "answers",
      seed: "u1",
    });
    expect(status.phase).toBe("waiting");
    expect(status.label).toEqual({ key: "Waiting for answers" });
  });

  it("escalates the thinking copy and shows the clock while thinking", () => {
    const at = (now: number) =>
      liveStatus({
        turn: [user, thought({ streaming: true })],
        now,
        startedAt: 0,
        seed: "u1",
      });
    expect(at(5_000).label).toEqual({ key: "Thinking…" });
    expect(at(5_000).elapsed).toBe("5s");
    expect(at(15_000).label).toEqual({ key: "Still thinking…" });
    expect(at(30_000).label).toEqual({ key: "Thinking more…" });
    expect(at(62_000).label).toEqual({ key: "Almost done thinking…" });
    expect(at(62_000).elapsed).toBe("1m 2s");
    expect(at(62_000).lastThought).toBeUndefined();
  });

  it("keeps the newest thought's length for the rest of the turn", () => {
    const earlier = thought({ id: "r0", durationMs: 3_000 });
    const latest = thought({ durationMs: 6_000 });
    const afterThought = liveStatus({
      turn: [user, earlier, latest],
      now: 8_000,
      startedAt: 0,
      seed: "u1",
    });
    expect(afterThought.phase).toBe("working");
    expect(afterThought.lastThought).toBe("6s");
    expect(afterThought.elapsed).toBeUndefined();

    const prose: Block = { id: "a1", role: "assistant", text: "Now fixing it" };
    const tool = liveStatus({
      turn: [user, latest, prose, command("in_progress")],
      now: 9_000,
      toolSummary: "Running 1 command",
      seed: "u1",
    });
    expect(tool.label).toEqual({ literal: "Running 1 command" });
    expect(tool.lastThought).toBe("6s");
  });

  it("shows the tool summary only while a tool is running", () => {
    const running = liveStatus({
      turn: [user, command("in_progress")],
      now: 2_000,
      toolSummary: "Running 1 command",
      seed: "u1",
    });
    expect(running.label).toEqual({ literal: "Running 1 command" });
    expect(running.lastThought).toBeUndefined();
    const done = liveStatus({
      turn: [user, command("completed")],
      now: 2_000,
      toolSummary: "Ran 1 command",
      seed: "u1",
    });
    expect(done.phase).toBe("working");
  });

  it("leaves the clock out when not thinking and counts background tasks", () => {
    const status = liveStatus({
      turn: [user],
      now: 25_000,
      startedAt: 0,
      background: 1,
      seed: "u1",
    });
    expect(status.elapsed).toBeUndefined();
    expect(status.background).toBe(1);
  });
});

describe("liveVerb", () => {
  it("holds still within a phase and varies across phases", () => {
    expect(liveVerb("u1", 3)).toBe(liveVerb("u1", 3));
    const verbs = new Set(Array.from({ length: 12 }, (_, phase) => liveVerb("u1", phase)));
    expect(verbs.size).toBeGreaterThan(3);
    for (const verb of verbs) expect(LIVE_VERBS).toContain(verb);
  });
});
