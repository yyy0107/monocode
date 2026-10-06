import type { CSSProperties, ReactNode, UIEventHandler } from "react";
import { useCollapseMotion } from "../../../shared/ui/AnimatedCollapse";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "../../../shared/ui/SurfaceVisibility";

/** Collapsed tools retain their editor and PTY lifetimes until explicitly closed. */
export function SessionSurfacePane({
  id,
  visible,
  expanded,
  grid,
  dragging,
  style,
  onScroll,
  children,
}: {
  id: string;
  visible: boolean;
  expanded: boolean;
  grid: boolean;
  dragging: boolean;
  style: CSSProperties;
  onScroll: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const parentVisible = useSurfaceVisibility();
  const { foldState } = useCollapseMotion(expanded);
  const interactive = parentVisible && visible && expanded;
  return (
    <div
      data-pane-id={id}
      data-fold-state={grid ? foldState : undefined}
      aria-hidden={!interactive}
      inert={!interactive || undefined}
      className={`${grid ? "relative" : "absolute"} flex min-h-0 min-w-0 flex-col overflow-hidden ${!expanded && foldState === "closed" ? "invisible" : ""} ${dragging ? "opacity-40" : ""}`}
      style={style}
      onScroll={onScroll}
    >
      <SurfaceVisibilityContext.Provider value={interactive}>
        {children}
      </SurfaceVisibilityContext.Provider>
    </div>
  );
}
