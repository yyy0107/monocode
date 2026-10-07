import type { Block } from "./session";
import { formatLiveElapsed } from "./liveAgents";
import { isToolBlock, toolCallState } from "./transcriptActivity";

/**
 * The words under a live turn. A key is English UI text for `t()`; a literal
 * is already-built text (a tool summary) shown as is.
 */
export type LiveStatusText =
  | { key: string; params?: Record<string, string | number> }
  | { literal: string };

export type LiveStatusPhase = "waiting" | "thinking" | "tool" | "working";

export interface LiveStatus {
  phase: LiveStatusPhase;
  label: LiveStatusText;
  /** The turn clock, shown while the agent is thinking. */
  elapsed?: string;
  /** How long the newest finished thought ran, kept for the rest of the turn. */
  lastThought?: string;
  /** How many tasks are still going outside the main stream. */
  background: number;
}

/**
 * Filler verbs for the stretches where nothing more specific is happening. A
 * verb only says the agent is alive; a new one each phase keeps a long turn
 * from looking frozen. These are English UI keys for `t()`.
 */
export const LIVE_VERBS = [
  "Brewing",
  "Pondering",
  "Mulling",
  "Computing",
  "Cooking",
  "Percolating",
  "Contemplating",
  "Scheming",
  "Imagining",
  "Tinkering",
  "Crafting",
  "Musing",
  "Noodling",
  "Simmering",
  "Synthesizing",
  "Weaving",
  "Conjuring",
  "Untangling",
  "Assembling",
  "Puzzling",
] as const;

export interface LiveStatusInput {
  /** The live turn's blocks, user prompt first. */
  turn: Block[];
  now: number;
  /** When the turn started; the clock is hidden without it. */
  startedAt?: number;
  /** What the turn is blocked on, if anything. */
  waiting?: "approval" | "answers";
  /** The live activity group's summary ("Running 2 commands"). */
  toolSummary?: string;
  background?: number;
  /** Stable per turn, so the verb only changes with the phase. */
  seed: string;
}

export function liveStatus(input: LiveStatusInput): LiveStatus {
  const { turn, now, startedAt } = input;
  const background = input.background ?? 0;
  const status = (phase: LiveStatusPhase, label: LiveStatusText): LiveStatus => ({
    phase,
    label,
    background,
  });

  if (input.waiting) {
    return status("waiting", {
      key: input.waiting === "answers" ? "Waiting for answers" : "Waiting for approval",
    });
  }

  const last = lastMeaningfulBlock(turn);
  if (last?.role === "reasoning" && last.streaming) {
    const thoughtMs = last.startedAt != null ? now - last.startedAt : 0;
    return {
      ...status("thinking", { key: thinkingKey(thoughtMs) }),
      ...(startedAt != null ? { elapsed: formatLiveElapsed(startedAt, now) } : {}),
    };
  }

  const thought = lastThoughtMs(turn);
  const withThought = (live: LiveStatus): LiveStatus =>
    thought != null ? { ...live, lastThought: formatLiveElapsed(0, thought) } : live;

  if (input.toolSummary && turn.some(isRunningTool)) {
    return withThought(status("tool", { literal: input.toolSummary }));
  }

  return withThought(status("working", { key: liveVerb(input.seed, turn.length) }));
}

function thinkingKey(thoughtMs: number): string {
  if (thoughtMs < 10_000) return "Thinking…";
  if (thoughtMs < 25_000) return "Still thinking…";
  if (thoughtMs < 50_000) return "Thinking more…";
  return "Almost done thinking…";
}

/** The newest block the agent produced, skipping empty placeholders. */
function lastMeaningfulBlock(turn: Block[]): Block | undefined {
  for (let index = turn.length - 1; index > 0; index -= 1) {
    const block = turn[index];
    if (block.role === "user") return undefined;
    if (block.role === "reasoning" && !block.text.trim() && !block.streaming) continue;
    return block;
  }
  return undefined;
}

/** The newest thought in the turn that has finished and kept its length. */
function lastThoughtMs(turn: Block[]): number | undefined {
  for (let index = turn.length - 1; index > 0; index -= 1) {
    const block = turn[index];
    if (block.role === "user") return undefined;
    if (block.role === "reasoning" && block.durationMs != null) return block.durationMs;
  }
  return undefined;
}

function isRunningTool(block: Block): boolean {
  return isToolBlock(block) && toolCallState(block) === "pending";
}

/** A verb that holds still within a phase and moves on with the next one. */
export function liveVerb(seed: string, phase: number): string {
  const text = `${seed}:${phase}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return LIVE_VERBS[(hash >>> 0) % LIVE_VERBS.length];
}
