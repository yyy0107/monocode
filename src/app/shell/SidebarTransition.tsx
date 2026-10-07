import {
  memo,
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
export const SIDEBAR_RAIL_WIDTH = 48;
export const SIDEBAR_TRANSITION_EASING = "cubic-bezier(0.2, 0.65, 0.3, 1)";
export const SIDEBAR_MOTION_STYLE = {
  "--collapse-duration": `${SIDEBAR_TRANSITION_MS}ms`,
  "--collapse-easing": SIDEBAR_TRANSITION_EASING,
  "--sidebar-rail-width": `${SIDEBAR_RAIL_WIDTH}px`,
} as CSSProperties;

// Deliver the first closed render so descendants stop polling, then leave the
// hidden tree alone until reopening. Keep its list state and subscriptions.
const RetainedSidebarContent = memo(
  function RetainedSidebarContent({
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) {
    return children;
  },
  (previous, next) =>
    previous.open === next.open &&
    (!next.open || previous.children === next.children),
);

/** Keep animation bookkeeping out of App so each phase only renders this rail. */
export function SidebarRail({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const { foldState, finish } = useCollapseMotion(open, SIDEBAR_TRANSITION_MS);
  const hasOpened = useRef(open);
  if (open) hasOpened.current = true;
  return (
    <div
      data-sidebar-rail
      data-fold-state={foldState}
      className="animated-collapse-size sidebar-rail relative grid h-full min-h-0 shrink-0"
      data-expanded={open}
      style={{
        ...SIDEBAR_MOTION_STYLE,
        gridTemplateColumns: open ? `${SIDEBAR_RAIL_WIDTH}px` : "0px",
      }}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
    >
      <div
        className="sidebar-rail-content absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: SIDEBAR_RAIL_WIDTH }}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform"
          ) finish();
        }}
      >
        <div className="h-full" hidden={!open && foldState === "closed"}>
          <SurfaceVisibilityContext.Provider value={open}>
            {hasOpened.current ? (
              <RetainedSidebarContent open={open}>
                {children}
              </RetainedSidebarContent>
            ) : null}
          </SurfaceVisibilityContext.Provider>
        </div>
      </div>
    </div>
  );
}

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
  const hasOpened = useRef(open);
  if (open) hasOpened.current = true;
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
    >
      <div
        className="sidebar-transition-clip absolute inset-y-0 h-full min-h-0 overflow-hidden"
        style={{
          width: dragging ? "100%" : width,
          left: open ? 0 : -SIDEBAR_RAIL_WIDTH,
        }}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform"
          ) finish();
        }}
      >
        <div
          className="sidebar-transition-content h-full min-h-0"
          hidden={!open && foldState === "closed"}
        >
          <SurfaceVisibilityContext.Provider value={open}>
            {hasOpened.current ? (
              <RetainedSidebarContent open={open}>
                {children}
              </RetainedSidebarContent>
            ) : null}
          </SurfaceVisibilityContext.Provider>
        </div>
      </div>
      {open ? resizeHandle : null}
    </div>
  );
}
