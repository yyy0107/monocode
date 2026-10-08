import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "../shared/lib/reducedMotion";
import { MOBILE_MOTION } from "./motion";

type Shown = { key: string; node: ReactNode };

/**
 * Swaps a control's icon and label as one unit: the previous content leaves
 * on its own short exit while the new content enters just behind it, so the
 * two never read as overlapping text. Change `swapKey` for a new state (idle,
 * busy, done); content updates under the same key, such as a progress
 * percentage, render in place without motion.
 */
export function MobileSwap({
  swapKey,
  children,
}: {
  swapKey: string;
  children: ReactNode;
}) {
  const [shownKey, setShownKey] = useState(swapKey);
  const [leaving, setLeaving] = useState<Shown[]>([]);
  // The first content renders still; each later key enters once on mount.
  const [swapped, setSwapped] = useState(false);
  // What the last commit showed, so the exit replays the final frame of the
  // previous state (for example its last progress value).
  const committed = useRef<Shown>({ key: swapKey, node: children });
  useLayoutEffect(() => {
    committed.current = { key: swapKey, node: children };
  });
  // Hidden controls never finish their exit animation; drop the copy anyway.
  useEffect(() => {
    if (!leaving.length) return;
    const timer = setTimeout(() => setLeaving([]), MOBILE_MOTION.contentOutMs + 60);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (shownKey !== swapKey) {
    // Derived during render so the exit starts in the same commit as the change.
    setShownKey(swapKey);
    if (!prefersReducedMotion()) {
      const previous = committed.current;
      setSwapped(true);
      setLeaving((current) => [
        ...current.filter((item) => item.key !== swapKey && item.key !== previous.key),
        previous,
      ]);
    }
  }
  return (
    <span className="mobile-swap">
      {leaving.map((item) => (
        <span
          key={`leaving-${item.key}`}
          className="mobile-swap-item"
          data-swap="out"
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            setLeaving((current) => current.filter((entry) => entry !== item));
          }}
        >
          {item.node}
        </span>
      ))}
      <span
        key={swapKey}
        className="mobile-swap-item"
        data-swap={swapped ? "in" : undefined}
      >
        {children}
      </span>
    </span>
  );
}
