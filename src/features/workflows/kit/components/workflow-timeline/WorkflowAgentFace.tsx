import { faceState } from "./workflow-face-motion.js";
import { usePauseOffscreenAnimation } from "../../../../../shared/hooks/usePauseOffscreenAnimation";
export { faceState } from "./workflow-face-motion.js";
import {
  MASCOT_GRID,
  PROJECT_MASCOTS,
  type ProjectMascot,
} from "../../../../projects/model/projectMascots";
import { cn } from "../lib/utils.js";
import type { StepRunStatus } from "../workflow-graph/types.js";

/**
 * A subagent's avatar: one of Monocode's pixel mascots, the same set projects
 * pick from. Pills, roster cells and the sidebar avatar strip share it.
 *
 * Identity is mascot plus color: both follow `avatarIndex` (cycling through the
 * mascots and a nine-color ring) and fall back to a hash of the name. A running
 * agent swaps its two frames like a project mid-turn; a waiting one is dimmed.
 */
export const FACE_COLORS = [
  "#54B9A6",
  "#F19D38",
  "#6464EF",
  "#885CF5",
  "#3C82F6",
  "#ED712E",
  "#EB4699",
  "#5BC67A",
  "#EA4045",
] as const;

/** 名字散列选色（31 进制取模 360 后映射到九色板）；只在没有 `avatarIndex` 时兜底。 */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  return FACE_COLORS[hash % FACE_COLORS.length]!;
}

/** 代理的颜色：编号优先（九色环循环），缺席时退回名字散列。药丸悬停描边与脸共用它。 */
export function agentColor(avatarIndex: number | undefined, name: string): string {
  if (avatarIndex === undefined) return avatarColor(name);
  return FACE_COLORS[
    ((avatarIndex % FACE_COLORS.length) + FACE_COLORS.length) % FACE_COLORS.length
  ]!;
}

/** The agent's mascot: by number when there is one, else by name. */
export function agentMascot(avatarIndex: number | undefined, name: string): ProjectMascot {
  const count = PROJECT_MASCOTS.length;
  if (avatarIndex !== undefined) return PROJECT_MASCOTS[((avatarIndex % count) + count) % count]!;
  let hash = 0;
  for (const char of name) hash = (hash * 131 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PROJECT_MASCOTS[hash % count]!;
}

export function WorkflowAgentFace({
  avatarIndex,
  className,
  name,
  status,
}: {
  avatarIndex: number | undefined;
  className?: string;
  name: string;
  status: StepRunStatus | undefined;
}) {
  const state = faceState(status);
  const mascot = agentMascot(avatarIndex, name);
  const active = state === "scanning";
  const pauseOffscreen = usePauseOffscreenAnimation<SVGSVGElement>();
  return (
    <svg
      ref={active ? pauseOffscreen : undefined}
      aria-hidden
      className={cn(
        "wf-mascot overflow-visible",
        active && "mascot-active",
        state === "waiting" && "opacity-55",
        className,
      )}
      data-face-state={state}
      data-subagent-avatar
      fill={agentColor(avatarIndex, name)}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${MASCOT_GRID} ${MASCOT_GRID}`}
    >
      {active ? (
        <>
          <path className="mascot-rest" d={mascot.restPath} />
          <path className="mascot-talk" d={mascot.talkPath} />
        </>
      ) : (
        <path d={mascot.restPath} />
      )}
    </svg>
  );
}
