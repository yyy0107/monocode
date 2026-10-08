import { useCallback, useRef } from "react";
import { observeAnimationVisibility } from "../lib/animationVisibility";

const PAUSED = "data-animation-paused";

/**
 * Pauses an element's looping CSS animations (see `[data-animation-paused]`
 * in index.css) while it is scrolled out of view or the window is hidden.
 * WebKit keeps restyling and repainting a running loop even off screen; a
 * small spinner above the fold cost several percent of a core. Paused loops
 * resume from where they stopped instead of replaying missed frames.
 */
export function usePauseOffscreenAnimation<T extends Element>() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((element: T | null) => {
    stop.current?.();
    stop.current = null;
    if (!element) return;
    const unobserve = observeAnimationVisibility(element, ({ visible }) => {
      element.toggleAttribute(PAUSED, !visible);
    });
    stop.current = () => {
      unobserve();
      element.removeAttribute(PAUSED);
    };
  }, []);
}
