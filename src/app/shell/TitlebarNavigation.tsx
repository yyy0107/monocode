import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useCollapseMotion } from "../../shared/ui/AnimatedCollapse";
import { SurfaceVisibilityContext } from "../../shared/ui/SurfaceVisibility";

/** Reserve the destinations' measured width without covering other chrome. */
export function TitlebarNavigation({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const { foldState, finish } = useCollapseMotion(expanded);
  const content = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-titlebar-navigation
      data-fold-state={foldState}
      className="animated-collapse-size grid min-w-0 shrink-0"
      style={{ gridTemplateColumns: expanded ? `${width}px` : "0px" }}
      aria-hidden={!expanded || undefined}
      inert={!expanded}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-columns"
        )
          finish();
      }}
    >
      <div className="min-w-0 overflow-hidden">
        <div
          ref={content}
          className="w-max"
          style={{
            visibility:
              !expanded && foldState === "closed" ? "hidden" : undefined,
          }}
        >
          <SurfaceVisibilityContext.Provider value={expanded}>
            {children}
          </SurfaceVisibilityContext.Provider>
        </div>
      </div>
    </div>
  );
}
