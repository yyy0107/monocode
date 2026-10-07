import { useLayoutEffect, useRef, type RefObject } from "react";

const TIMING = { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };

type Snapshot = Map<string, number>;

function rows(root: HTMLElement, attribute: string) {
  const found = new Map<string, HTMLElement>();
  for (const node of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const id = node.getAttribute(attribute);
    if (id && !found.has(id)) found.set(id, node);
  }
  return found;
}

/** Content-relative tops, so scrolling the list never reads as movement. */
function measure(root: HTMLElement, nodes: Map<string, HTMLElement>): Snapshot {
  const base = root.getBoundingClientRect().top - root.scrollTop;
  const tops: Snapshot = new Map();
  for (const [id, node] of nodes) {
    const rect = node.getBoundingClientRect();
    // Collapsed disclosure rows have no place to slide from or to.
    if (rect.height > 0) tops.set(id, rect.top - base);
  }
  return tops;
}

function sameRelativeOrder(previous: string[], next: string[]) {
  const kept = new Set(next);
  const before = previous.filter((id) => kept.has(id));
  const was = new Set(previous);
  const after = next.filter((id) => was.has(id));
  return before.join("\0") === after.join("\0");
}

/**
 * Slide rows to their new places when a sorted list reorders, instead of
 * letting them jump. Only reorders of rows that were already present animate;
 * insertions and removals keep their own motion.
 */
export function useListReorderMotion(
  root: RefObject<HTMLElement | null>,
  order: readonly string[],
  attribute: string,
) {
  const key = order.join("\0");
  // Read the outgoing layout during render, while the DOM still shows it.
  // Rows in flight are measured where they are drawn, so a reorder that
  // interrupts another continues from the visible position.
  const before = useRef<{ key: string; tops: Snapshot | null }>({
    key,
    tops: null,
  });
  const committed = useRef(key);
  if (before.current.key !== key) {
    const node = root.current;
    before.current = {
      key,
      tops: node ? measure(node, rows(node, attribute)) : null,
    };
  }

  useLayoutEffect(() => {
    if (committed.current === key) return;
    const previousIds = committed.current.split("\0");
    committed.current = key;
    const snapshot = before.current.key === key ? before.current.tops : null;
    before.current = { key, tops: null };
    const node = root.current;
    if (
      !snapshot ||
      !node ||
      typeof node.animate !== "function" ||
      sameRelativeOrder(previousIds, [...order]) ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const nodes = rows(node, attribute);
    // Settle script-driven slides (an earlier reorder or an insertion push)
    // so the new layout is measured without them; this slide replaces them.
    for (const element of nodes.values()) {
      for (const animation of element.getAnimations()) {
        if ("transitionProperty" in animation || "animationName" in animation)
          continue;
        const effect = animation.effect;
        if (
          effect instanceof KeyframeEffect &&
          effect.getKeyframes().some((frame) => "transform" in frame)
        )
          animation.cancel();
      }
    }
    const after = measure(node, nodes);
    for (const [id, top] of after) {
      const from = snapshot.get(id);
      if (from === undefined) continue;
      const delta = from - top;
      if (Math.abs(delta) < 0.5) continue;
      nodes.get(id)!.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
        TIMING,
      );
    }
  });
}
