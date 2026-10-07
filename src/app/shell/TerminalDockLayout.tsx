import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  applyDockGridStyle,
  type DockSide,
  type ProjectTerminalDock as ProjectTerminal,
} from "../../features/projects/model/projectTerminal";
import { sameProjectPath } from "../../features/projects/model/recents";
import { ProjectTerminalDock } from "../../features/terminal/ui/ProjectTerminalDock";
import { useCollapseMotion } from "../../shared/ui/AnimatedCollapse";
import { SurfaceVisibilityContext } from "../../shared/ui/SurfaceVisibility";

const RetainedTerminalDock = memo(ProjectTerminalDock);

type Props = Omit<
  ComponentProps<typeof ProjectTerminalDock>,
  "dock" | "onSizePaint"
> & {
  projectTerminals: ProjectTerminal[];
  currentDock?: ProjectTerminal;
  projectCwd: string;
  workspaceVisible: boolean;
  lastDockSide: DockSide | null;
  children: ReactNode;
};

/** Own animation phases here so settling a dock never rerenders the workspace. */
export function TerminalDockLayout({
  projectTerminals,
  currentDock,
  projectCwd,
  workspaceVisible,
  lastDockSide,
  focused,
  onSizeCommit,
  children,
  ...terminalProps
}: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const dragSize = useRef<number | null>(null);
  const currentDockRef = useRef(currentDock);
  currentDockRef.current = currentDock;
  const open = !!currentDock?.open;
  const { foldState, finish } = useCollapseMotion(open);
  const paintSize = useCallback((size: number) => {
    const dock = currentDockRef.current;
    const element = grid.current;
    if (!dock || !element) return;
    dragSize.current = size;
    element.style.transitionProperty = "none";
    applyDockGridStyle(element, dock.side, size);
  }, []);
  const commitSize = useCallback(
    (size: number) => {
      dragSize.current = null;
      grid.current?.style.removeProperty("transition-property");
      onSizeCommit(size);
    },
    [onSizeCommit],
  );
  useLayoutEffect(() => {
    if (!open) dragSize.current = null;
    if (dragSize.current != null) return;
    const element = grid.current;
    if (!element) return;
    element.style.removeProperty("transition-property");
    applyDockGridStyle(
      element,
      currentDock?.side ?? lastDockSide ?? "bottom",
      open ? (currentDock?.size ?? 0) : 0,
    );
  }, [currentDock, open, lastDockSide]);

  return (
    <div
      ref={grid}
      data-terminal-dock-layout
      data-fold-state={foldState}
      className="animated-collapse-size pane-card-gutter grid h-full min-h-0 min-w-0 flex-1"
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.propertyName === "grid-template-rows" ||
            event.propertyName === "grid-template-columns")
        )
          finish();
      }}
    >
      {projectTerminals.map((dock) => {
        const current =
          workspaceVisible && sameProjectPath(dock.projectPath, projectCwd);
        const show = current && dock.open;
        const present = current && (show || foldState === "closing");
        return (
          <div
            key={dock.projectPath}
            className={
              present
                ? `h-full min-h-0 min-w-0 w-full ${show ? "" : "overflow-hidden"}`
                : "hidden"
            }
            style={present ? { gridArea: "dock" } : undefined}
            aria-hidden={!show}
            inert={!show || undefined}
          >
            <SurfaceVisibilityContext.Provider value={show}>
              <RetainedTerminalDock
                {...terminalProps}
                dock={dock}
                focused={show && focused}
                onSizePaint={paintSize}
                onSizeCommit={commitSize}
              />
            </SurfaceVisibilityContext.Provider>
          </div>
        );
      })}
      {children}
    </div>
  );
}
