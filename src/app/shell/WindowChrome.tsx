import type { ReactNode } from "react";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { useShortcutLabel } from "../commands/useCommandShortcut";
import { MoveLeft, MoveRight, PanelLeft } from "../../shared/ui/icons";
import { IS_MAC } from "../../platform/tauri/platform";
import { startWindowDrag } from "./startWindowDrag";
import { WindowControls } from "./WindowControls";

/**
 * Window chrome shared by every shell layout now that the workspace tab strip
 * is gone: the drag bar, back/forward/sidebar cluster and its reserved space.
 */

export function IconButton({
  label,
  active,
  accent,
  disabled,
  onClick,
  onOpenContextMenu,
  children,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onOpenContextMenu?: (x: number, y: number) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || accent}
      aria-disabled={disabled}
      data-tauri-drag-region="false"
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      onContextMenu={
        onOpenContextMenu
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (disabled) return;
              event.currentTarget.focus();
              onOpenContextMenu(event.clientX, event.clientY);
            }
          : undefined
      }
      onKeyDown={
        onOpenContextMenu
          ? (event) => {
              if (
                event.key !== "ContextMenu" &&
                !(event.shiftKey && event.key === "F10")
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              if (disabled) return;
              event.currentTarget.focus();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenContextMenu(rect.left, rect.bottom);
            }
          : undefined
      }
      className={`grid size-6.5 place-items-center rounded-md ${
        disabled
          ? "text-content/25"
          : accent
            ? "text-accent hover:bg-content/10"
            : active
              ? "text-content hover:bg-content/10"
              : "text-content/50 hover:bg-content/10 hover:text-content"
      }`}
    >
      {children}
    </button>
  );
}

export function TabVisitNav({
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onTogglePanel,
  panelActive = false,
}: {
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onTogglePanel?: () => void;
  panelActive?: boolean;
}) {
  const backLabel = useShortcutLabel("Back", "Tab: Back");
  const forwardLabel = useShortcutLabel("Forward", "Tab: Forward");
  const panelLabel = useShortcutLabel("Toggle Sidebar", "App: Toggle Sidebar");
  return (
    <div className="flex shrink-0 items-center">
      <IconButton label={backLabel} disabled={!canGoBack} onClick={onGoBack}>
        <MoveLeft className="size-3.5" strokeWidth={1.75} />
      </IconButton>
      <IconButton
        label={forwardLabel}
        disabled={!canGoForward}
        onClick={onGoForward}
      >
        <MoveRight className="size-3.5" strokeWidth={1.75} />
      </IconButton>
      {onTogglePanel ? (
        <IconButton
          label={panelLabel}
          active={panelActive}
          onClick={onTogglePanel}
        >
          <PanelLeft className="size-3.5" strokeWidth={1.75} />
        </IconButton>
      ) : null}
    </div>
  );
}

const WINDOW_NAVIGATION_LEFT = IS_MAC ? 78 : 6;
const WINDOW_NAVIGATION_WIDTH = 78;
export const WINDOW_NAVIGATION_END =
  WINDOW_NAVIGATION_LEFT + 48 + WINDOW_NAVIGATION_WIDTH;
export const WINDOW_DRAG_BAR_HEIGHT = 40;

/** Keep native window dragging independent of the active page or pane layout. */
export function WindowDragBar({
  windowActions,
  ...props
}: Parameters<typeof TabVisitNav>[0] & {
  /** Window-wide actions shown just before the window controls. */
  windowActions?: ReactNode;
}) {
  return (
    <header
      data-window-drag-bar
      data-tauri-drag-region="deep"
      onMouseDownCapture={startWindowDrag}
      className="shell-chrome relative flex shrink-0 select-none items-center"
      style={{ height: WINDOW_DRAG_BAR_HEIGHT }}
    >
      <WindowNavigation {...props} />
      <div className="min-w-0 flex-1 self-stretch" />
      {windowActions ? (
        <div
          data-tauri-drag-region="false"
          className="flex shrink-0 items-center"
        >
          {windowActions}
        </div>
      ) : null}
      {!IS_MAC ? <WindowControls /> : null}
    </header>
  );
}

export function WindowNavigation(props: Parameters<typeof TabVisitNav>[0]) {
  const { t: uiT } = useTranslation();
  return (
    <nav
      aria-label={uiT("Window navigation")}
      data-window-navigation
      data-tauri-drag-region="false"
      className="absolute z-20 flex h-10 items-center"
      style={{
        left: WINDOW_NAVIGATION_LEFT + 48,
        top: 0,
      }}
    >
      <TabVisitNav {...props} />
    </nav>
  );
}

/** Reserve the same window coordinates for navigation in every shell layout. */
export function WindowNavigationSpace({
  besideCompactRail = false,
}: {
  besideCompactRail?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-window-navigation-space
      className="shrink-0"
      style={{
        width:
          WINDOW_NAVIGATION_LEFT +
          WINDOW_NAVIGATION_WIDTH -
          (besideCompactRail ? 48 : 0),
      }}
    />
  );
}
