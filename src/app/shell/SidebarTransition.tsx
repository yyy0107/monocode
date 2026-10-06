import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useCollapseMotion } from "../../shared/ui/AnimatedCollapse";
import { SurfaceVisibilityContext } from "../../shared/ui/SurfaceVisibility";

type Props = {
  open: boolean;
  width: number;
  dragging: boolean;
  setPaneRef: (pane: HTMLElement | null) => void;
  finishDrag: () => void;
  resizeHandle?: ReactNode;
  children: ReactNode;
};

// The sidebar and its replacement rail must move with the same timing.
export const SIDEBAR_TRANSITION_MS = 280;
export const SIDEBAR_MOTION_STYLE = {
  "--collapse-duration": `${SIDEBAR_TRANSITION_MS}ms`,
  "--collapse-easing": "cubic-bezier(0.2, 0.65, 0.3, 1)",
} as CSSProperties;

export function SidebarTransition({
  open,
  width,
  dragging,
  setPaneRef,
  finishDrag,
  resizeHandle,
  children,
}: Props) {
  const { foldState, finish } = useCollapseMotion(open, SIDEBAR_TRANSITION_MS);
  const shell = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const attach = useCallback(
    (pane: HTMLDivElement | null) => {
      shell.current = pane;
      setPaneRef(pane);
      if (pane && !openRef.current) pane.style.width = "0px";
    },
    [setPaneRef],
  );

  useLayoutEffect(() => {
    if (open) return;
    finishDrag();
    // Completing a drag commits its real width; the closed shell stays at zero.
    if (shell.current) shell.current.style.width = "0px";
  }, [open, finishDrag]);

  return (
    <div
      ref={attach}
      data-sidebar-transition
      data-fold-state={foldState}
      data-expanded={open}
      data-resizing={dragging || undefined}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      className="animated-collapse-size sidebar-transition relative h-full min-h-0 shrink-0"
      style={{ ...SIDEBAR_MOTION_STYLE, width: open ? width : 0 }}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "width"
        ) {
          finish();
        }
      }}
    >
      <div className="sidebar-transition-clip h-full min-h-0 overflow-hidden">
        <div className="sidebar-transition-content h-full min-h-0">
          <SurfaceVisibilityContext.Provider value={open}>
            {open || foldState !== "closed" ? children : null}
          </SurfaceVisibilityContext.Provider>
        </div>
      </div>
      {open ? resizeHandle : null}
    </div>
  );
}
