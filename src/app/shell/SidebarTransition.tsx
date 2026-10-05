import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

// Keep the fallback unmount timer in sync with duration-200 below.
const TRANSITION_MS = 200;

export function SidebarTransition({
  open,
  width,
  dragging,
  setPaneRef,
  finishDrag,
  resizeHandle,
  children,
}: Props) {
  const [present, setPresent] = useState(open);
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
    if (open) {
      setPresent(true);
      return;
    }
    finishDrag();
    // Completing a drag commits its real width; the closed shell stays at zero.
    if (shell.current) shell.current.style.width = "0px";
    if (!present) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPresent(false);
      return;
    }
    // Give transitionend a frame of slack before the fallback removes content.
    const timer = window.setTimeout(() => setPresent(false), TRANSITION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [open, present, finishDrag]);

  return (
    <div
      ref={attach}
      data-sidebar-transition
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      className={`relative h-full min-h-0 shrink-0 ${
        dragging
          ? "transition-none"
          : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      } ${!open ? "pointer-events-none" : ""}`}
      style={{ width: open ? width : 0 }}
      onTransitionEnd={(event) => {
        if (
          !open &&
          event.target === event.currentTarget &&
          event.propertyName === "width"
        ) {
          setPresent(false);
        }
      }}
    >
      <div className="h-full min-h-0 overflow-hidden">
        <SurfaceVisibilityContext.Provider value={open}>
          {open || present ? children : null}
        </SurfaceVisibilityContext.Provider>
      </div>
      {open ? resizeHandle : null}
    </div>
  );
}
