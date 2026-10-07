import type { ReactNode } from "react";
import { useTranslation } from "../../shared/i18n/useTranslation";
import { useShortcutLabel } from "../commands/useCommandShortcut";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  PanelLeft,
} from "../../shared/ui/icons";
import { IS_MAC } from "../../platform/tauri/platform";
import { startWindowDrag } from "./startWindowDrag";
import { WindowControls } from "./WindowControls";

/**
 * Window chrome shared by every shell layout now that the workspace tab strip
 * is gone: the drag bar, product icon, navigation controls and reserved space.
 */

export function IconButton({
  label,
  active,
  accent,
  disabled,
  expanded,
  controls,
  onClick,
  onOpenContextMenu,
  children,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  controls?: string;
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
      aria-expanded={expanded}
      aria-controls={controls}
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
      className={`grid size-7 place-items-center rounded-lg transition-colors ${
        disabled
          ? "text-foreground-subtlest opacity-60"
          : accent
            ? "text-accent hover:bg-surface-hover"
            : active
              ? "text-content hover:bg-surface-hover"
              : "text-foreground-subtle hover:bg-surface-hover hover:text-content"
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
  onToggleNavigation,
  navigationExpanded = true,
}: {
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onTogglePanel?: () => void;
  panelActive?: boolean;
  onToggleNavigation?: () => void;
  navigationExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const backLabel = useShortcutLabel("Back", "Tab: Back");
  const forwardLabel = useShortcutLabel("Forward", "Tab: Forward");
  const panelLabel = useShortcutLabel("Toggle Sidebar", "App: Toggle Sidebar");
  return (
    <div className="flex shrink-0 items-center">
      <div className="flex w-10 shrink-0 items-center pl-1">
        <img
          src="/monocode.png"
          alt="MonoCode"
          draggable={false}
          className="size-6"
        />
      </div>
      {onTogglePanel ? (
        <IconButton
          label={panelLabel}
          active={panelActive}
          onClick={onTogglePanel}
        >
          <PanelLeft className="size-4" />
        </IconButton>
      ) : null}
      <IconButton label={backLabel} disabled={!canGoBack} onClick={onGoBack}>
        <ArrowLeft className="size-4" />
      </IconButton>
      <IconButton
        label={forwardLabel}
        disabled={!canGoForward}
        onClick={onGoForward}
      >
        <ArrowRight className="size-4" />
      </IconButton>
      {onToggleNavigation ? (
        <IconButton
          label={t(
            navigationExpanded
              ? "Collapse navigation menu"
              : "Expand navigation menu",
          )}
          expanded={navigationExpanded}
          controls="sidebar-navigation-menu"
          onClick={onToggleNavigation}
        >
          {navigationExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </IconButton>
      ) : null}
    </div>
  );
}

const WINDOW_NAVIGATION_LEFT = IS_MAC ? 78 : 6;
const WINDOW_NAVIGATION_WIDTH = 40 + 112;
export const WINDOW_NAVIGATION_END =
  WINDOW_NAVIGATION_LEFT + WINDOW_NAVIGATION_WIDTH;
export const WINDOW_DRAG_BAR_HEIGHT = 40;

/** Keep native window dragging independent of the active page or pane layout. */
export function WindowDragBar({
  windowLeading,
  windowActions,
  ...props
}: Parameters<typeof TabVisitNav>[0] & {
  /** Left-aligned window-wide destination and its notification preview. */
  windowLeading?: ReactNode;
  /** Window-wide actions shown just before the window controls. */
  windowActions?: ReactNode;
}) {
  return (
    <header
      data-window-drag-bar
      data-tauri-drag-region="deep"
      onMouseDownCapture={startWindowDrag}
      className="shell-chrome relative grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] select-none items-center"
      style={{ height: WINDOW_DRAG_BAR_HEIGHT }}
    >
      <WindowNavigation {...props} />
      <div
        className="self-stretch"
        style={{ minWidth: WINDOW_NAVIGATION_END }}
      />
      <div
        data-window-leading
        className="flex min-w-0 items-center"
      >
        {windowLeading}
      </div>
      <div className="flex min-w-0 items-center justify-end self-stretch">
        {windowActions ? (
          <div
            data-tauri-drag-region="false"
            className="flex shrink-0 items-center"
          >
            {windowActions}
          </div>
        ) : null}
        {!IS_MAC ? <WindowControls /> : null}
      </div>
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
        left: WINDOW_NAVIGATION_LEFT,
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
