import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { reducedMotionQuery } from "../lib/reducedMotion";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "./SurfaceVisibility";

// Prop updates can wait while retained content is hidden. Visibility context
// remains outside this boundary so descendants can dismiss portals and polling.
const RetainedCollapseContent = memo(
  function RetainedCollapseContent({
    children,
  }: {
    visible: boolean;
    children: ReactNode | (() => ReactNode);
  }) {
    return typeof children === "function" ? children() : children;
  },
  (previous, next) =>
    previous.visible === next.visible &&
    (!next.visible || previous.children === next.children),
);

/** Shared lifetime for disclosures and grid-sized panels. */
export function useCollapseMotion(expanded: boolean, durationMs = 340) {
  const [foldState, setFoldState] = useState<
    "open" | "opening" | "closing" | "closed"
  >(expanded ? "open" : "closed");
  const timerRef = useRef<number | undefined>(undefined);
  const restart = useCallback(
    (duration = durationMs) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        () => setFoldState(expanded ? "open" : "closed"),
        duration + 10,
      );
    },
    [expanded, durationMs],
  );

  useLayoutEffect(() => {
    if (reducedMotionQuery().matches) {
      setFoldState(expanded ? "open" : "closed");
      return;
    }
    setFoldState((current) => {
      if (!expanded)
        return current === "closed" || current === "closing"
          ? current
          : "closing";
      return current === "open" || current === "opening" ? current : "opening";
    });
  }, [expanded]);

  useEffect(() => {
    if (foldState !== "opening" && foldState !== "closing") return;
    // Allow completion events a short grace period; hidden windows may omit them.
    restart();
    return () => window.clearTimeout(timerRef.current);
  }, [foldState, restart]);

  const finish = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setFoldState(expanded ? "open" : "closed");
  }, [expanded]);
  return { foldState, finish, restart };
}

/** Shared vertical disclosure motion; measured height avoids intrinsic Grid sizing. */
export function AnimatedCollapse({
  expanded,
  className,
  durationMs,
  motion = "grid",
  animateContentResize = false,
  keepMounted = false,
  onEntered,
  children,
}: {
  expanded: boolean;
  className?: string;
  durationMs?: number;
  motion?: "grid" | "height";
  animateContentResize?: boolean;
  /** Retain content after its first opening and pause hidden parent-prop updates. */
  keepMounted?: boolean;
  /** Runs after entering, never for an initially expanded mount. */
  onEntered?: () => void;
  /** Use a factory to defer expensive content preparation while closed. */
  children: ReactNode | (() => ReactNode);
}) {
  const parentVisible = useSurfaceVisibility();
  const { foldState, finish, restart } = useCollapseMotion(
    expanded,
    durationMs,
  );
  const entered = useRef(expanded);
  const hasOpened = useRef(expanded);
  if (expanded) hasOpened.current = true;
  const visibleHeight = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!expanded) entered.current = false;
    else if (foldState === "open" && !entered.current) {
      entered.current = true;
      onEntered?.();
    }
  }, [expanded, foldState, onEntered]);
  const itemRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const heightMotion =
    motion === "height" &&
    typeof Element !== "undefined" &&
    typeof Element.prototype.animate === "function";

  useLayoutEffect(() => {
    const item = itemRef.current;
    const content = contentRef.current;
    if (!item || !content) return;
    const settled = foldState === "open";
    const reduced = reducedMotionQuery().matches;
    if (!heightMotion || reduced || (settled && !animateContentResize)) {
      item.style.removeProperty("height");
      item.style.removeProperty("overflow");
      return;
    }
    if (foldState === "closed") {
      item.style.height = "0px";
      visibleHeight.current = 0;
      return;
    }
    if (settled ? !expanded : (foldState === "opening") !== expanded) return;

    const duration = durationMs ?? 340;
    const startedAt = performance.now();
    const easing =
      getComputedStyle(item).getPropertyValue("--collapse-easing").trim() ||
      "cubic-bezier(0.22, 1, 0.36, 1)";
    let animation: Animation | undefined;
    let targetHeight = settled ? (visibleHeight.current ?? -1) : -1;
    const release = () => {
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
        animation = undefined;
      }
      item.style.removeProperty("height");
      item.style.removeProperty("overflow");
    };
    const retarget = () => {
      const nextHeight = expanded ? content.getBoundingClientRect().height : 0;
      if (
        settled &&
        (reducedMotionQuery().matches ||
          content.querySelector(
            '.zen-fold-item:is([data-fold-state="opening"], [data-fold-state="closing"])',
          ))
      ) {
        // Nested disclosures already animate the natural height; do not chase them.
        release();
        targetHeight = nextHeight;
        visibleHeight.current = nextHeight;
        return;
      }
      if (nextHeight === targetHeight) {
        if (settled && !animation) release();
        return;
      }
      const currentHeight =
        settled && !animation
          ? targetHeight < 0
            ? nextHeight
            : targetHeight
          : item.getBoundingClientRect().height;
      const remaining =
        animation && !animateContentResize
          ? Math.max(0, duration - (performance.now() - startedAt))
          : duration;
      targetHeight = nextHeight;
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
      }
      if (settled && currentHeight === nextHeight) {
        release();
        visibleHeight.current = nextHeight;
        return;
      }
      item.style.height = `${nextHeight}px`;
      item.style.overflow = "hidden";
      if (remaining === 0) {
        finish();
        return;
      }
      animation = item.animate(
        [{ height: `${currentHeight}px` }, { height: `${nextHeight}px` }],
        { duration: remaining, easing, fill: "both" },
      );
      void animation.finished.catch(() => undefined);
      // Late content gets a complete transition, not the last few milliseconds.
      if (!settled && animateContentResize) restart(remaining);
      animation.onfinish = () => {
        if (
          expanded &&
          content.getBoundingClientRect().height !== targetHeight
        ) {
          retarget();
          return;
        }
        if (settled) {
          visibleHeight.current = targetHeight;
          release();
        } else finish();
      };
    };
    retarget();
    // React's DOM changes arrive before layout/ResizeObserver delivery. Freeze
    // late content here so it cannot flash or feed back through layout observers.
    const mutations =
      expanded &&
      animateContentResize &&
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(retarget)
        : undefined;
    mutations?.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const observer =
      expanded && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(retarget)
        : undefined;
    observer?.observe(content);
    return () => {
      mutations?.disconnect();
      observer?.disconnect();
      visibleHeight.current = item.getBoundingClientRect().height;
      if (!animation) return;
      // Freeze the visible height before cancelling so rapid reversal never jumps.
      item.style.height = `${visibleHeight.current}px`;
      animation.onfinish = null;
      animation.cancel();
    };
  }, [
    expanded,
    foldState,
    heightMotion,
    durationMs,
    animateContentResize,
    finish,
    restart,
  ]);

  const hidden = !expanded && foldState === "closed";
  if (hidden && (!keepMounted || !hasOpened.current)) return null;
  return (
    <div
      ref={itemRef}
      data-collapse-motion={heightMotion ? "height" : undefined}
      className={`zen-fold-item${className ? ` ${className}` : ""}`}
      style={
        {
          ...(durationMs === undefined
            ? undefined
            : { "--collapse-duration": `${durationMs}ms` }),
          // Fold styles set display explicitly, so the hidden attribute alone
          // cannot remove retained contents from layout and painting.
          display: hidden ? "none" : undefined,
        } as CSSProperties
      }
      hidden={hidden}
      data-fold-state={foldState}
      aria-hidden={!expanded || undefined}
      inert={!expanded}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        finish();
      }}
    >
      <div ref={contentRef}>
        <SurfaceVisibilityContext.Provider value={parentVisible && expanded}>
          {keepMounted ? (
            <RetainedCollapseContent visible={parentVisible && expanded}>
              {children}
            </RetainedCollapseContent>
          ) : typeof children === "function" ? (
            children()
          ) : (
            children
          )}
        </SurfaceVisibilityContext.Provider>
      </div>
    </div>
  );
}
