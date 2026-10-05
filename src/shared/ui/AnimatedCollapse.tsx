import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "./SurfaceVisibility";

/** Shared lifetime for disclosures and grid-sized panels. */
export function useCollapseMotion(expanded: boolean) {
  const [foldState, setFoldState] = useState<
    "open" | "opening" | "closing" | "closed"
  >(expanded ? "open" : "closed");

  useLayoutEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
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
    // CSS runs for 340ms. Hidden windows may never fire animationend.
    const timer = window.setTimeout(
      () => setFoldState(expanded ? "open" : "closed"),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [foldState, expanded]);

  const finish = useCallback(
    () => setFoldState(expanded ? "open" : "closed"),
    [expanded],
  );
  return { foldState, finish };
}

/** Shared vertical disclosure motion; uses the existing zen-fold CSS. */
export function AnimatedCollapse({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const parentVisible = useSurfaceVisibility();
  const { foldState, finish } = useCollapseMotion(expanded);

  if (!expanded && foldState === "closed") return null;
  return (
    <div
      className="zen-fold-item"
      data-fold-state={foldState}
      aria-hidden={!expanded || undefined}
      inert={!expanded}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        finish();
      }}
    >
      <div>
        <SurfaceVisibilityContext.Provider value={parentVisible && expanded}>
          {children}
        </SurfaceVisibilityContext.Provider>
      </div>
    </div>
  );
}
