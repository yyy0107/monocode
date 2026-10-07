import type { Block } from "./session";
import { formatLiveElapsed } from "./liveAgents";
import { isToolBlock, toolCallLabel, toolCallState } from "./transcriptActivity";

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
  /** Current thought/tool time, otherwise the current response round's time. */
  elapsed?: string;
  clock?: "thinking" | "tool" | "round";
  /** Brief activities, gaps and user waits keep the status line text-only. */
  showClock: boolean;
  /** A new origin resets the digits without animating the old time backwards. */
  clockStartedAt?: number;
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
  /** Initial origin, before the first response or tool boundary arrives. */
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
  const { turn, now } = input;
  const roundStartedAt = responseRoundStartedAt(turn, input.startedAt);
  const last = lastMeaningfulBlock(turn);
  const background = input.background ?? 0;
  const status = (
    phase: LiveStatusPhase,
    label: LiveStatusText,
    phaseStartedAt?: number,
  ): LiveStatus => {
    const origin = phaseStartedAt ?? roundStartedAt;
    const liveReply = last?.streaming && (last.role === "assistant" || last.role === "plan");
    // Like the verb pool, ordinary replies sometimes carry a clock. The choice
    // stays fixed for the response, so each token/second cannot toggle it.
    const timedReply = liveReply && phaseHash(`${input.seed}:clock`, origin ?? 0) % 3 === 0;
    return {
      phase,
      label,
      background,
      showClock: origin != null && now - origin >= 2_000 && (
        phase === "thinking" || phase === "tool" || (phase === "working" && !!timedReply)
      ),
      ...(origin != null ? {
        elapsed: formatLiveElapsed(origin, now, true),
        clock: phaseStartedAt != null && (phase === "thinking" || phase === "tool")
          ? phase
          : "round",
        clockStartedAt: origin,
      } : {}),
    };
  };

  if (input.waiting) {
    return status("waiting", {
      key: input.waiting === "answers" ? "Waiting for answers" : "Waiting for approval",
    });
  }

  if (last?.role === "reasoning" && last.streaming) {
    const thoughtMs = last.startedAt != null ? now - last.startedAt : 0;
    return status("thinking", { key: thinkingKey(thoughtMs) }, last.startedAt);
  }

  const tool = lastRunningTool(turn);
  if (tool) {
    return status("tool", {
      literal: input.toolSummary ?? toolCallLabel(tool),
    }, tool.startedAt);
  }

  return status("working", { key: liveVerb(input.seed, turn.length) });
}

/**
 * Each new response starts a small round. Between responses, the latest tool
 * boundary starts the next round, including calls that complete out of order.
 * Status pings and further tokens in the same response do not move the origin.
 */
function responseRoundStartedAt(turn: Block[], fallback?: number): number | undefined {
  let toolBoundary: number | undefined;
  for (let index = turn.length - 1; index >= 0; index -= 1) {
    const block = turn[index];
    if (block.role === "user") return toolBoundary ?? block.sentAt ?? fallback;
    if (isToolBlock(block) && block.startedAt != null) {
      const boundary = block.startedAt + Math.max(0, block.durationMs ?? 0);
      toolBoundary = Math.max(toolBoundary ?? boundary, boundary);
    }
    if (
      block.role === "assistant" || block.role === "reasoning" ||
      block.role === "plan" || block.role === "image"
    ) {
      const origin = block.startedAt ?? block.sentAt;
      if (origin != null) return toolBoundary ?? origin;
    }
  }
  return toolBoundary ?? fallback;
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
    if (block.role === "system" && !block.notice && !block.question) continue;
    if (block.role === "reasoning" && !block.text.trim() && !block.streaming) continue;
    return block;
  }
  return undefined;
}

function isRunningTool(block: Block): boolean {
  return isToolBlock(block) && toolCallState(block) === "pending";
}

/** The latest active call supplies the tool clock, even with concurrent calls. */
function lastRunningTool(turn: Block[]): Block | undefined {
  for (let index = turn.length - 1; index >= 0; index -= 1) {
    const block = turn[index];
    if (block.role === "user") return undefined;
    if (isRunningTool(block)) return block;
  }
  return undefined;
}

/** A verb that holds still within a phase and moves on with the next one. */
export function liveVerb(seed: string, phase: number): string {
  return LIVE_VERBS[phaseHash(seed, phase) % LIVE_VERBS.length];
}

function phaseHash(seed: string, phase: number): number {
  const text = `${seed}:${phase}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
