import { isTauri } from "@tauri-apps/api/core";
import {
  getCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";
import { useEffect, useState, type MouseEvent } from "react";
import { IS_LINUX, IS_WIN } from "../../platform/tauri/platform";

type ResizeDirection = Parameters<TauriWindow["startResizeDragging"]>[0];

const DIRECTIONS: ResizeDirection[] = [
  "North",
  "East",
  "South",
  "West",
  "NorthWest",
  "NorthEast",
  "SouthWest",
  "SouthEast",
];

/** A wider inner rim for undecorated workspace windows; the OS owns the drag. */
export function WindowResizeHandles() {
  const [resizeWindow, setResizeWindow] = useState<TauriWindow | null>(null);

  useEffect(() => {
    if (!(IS_LINUX || IS_WIN) || !isTauri()) return;
    const win = getCurrentWindow();
    let mounted = true;
    let revision = 0;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      const current = ++revision;
      try {
        const [resizable, maximized, fullscreen] = await Promise.all([
          win.isResizable(),
          win.isMaximized(),
          win.isFullscreen(),
        ]);
        if (mounted && current === revision) {
          setResizeWindow(resizable && !maximized && !fullscreen ? win : null);
        }
      } catch {
        if (mounted && current === revision) setResizeWindow(null);
      }
    };
    void refresh();
    void win
      .onResized(refresh)
      .then((stop) => {
        if (mounted) unlisten = stop;
        else stop();
      })
      .catch(() => {});
    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  if (!resizeWindow) return null;
  const startResize = (
    event: MouseEvent<HTMLDivElement>,
    direction: ResizeDirection,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    void resizeWindow.startResizeDragging(direction).catch(() => {});
  };
  return (
    <div data-window-resize-handles aria-hidden="true">
      {DIRECTIONS.map((direction) => (
        <div
          key={direction}
          data-window-resize-direction={direction}
          data-tauri-drag-region="false"
          onMouseDown={(event) => startResize(event, direction)}
        />
      ))}
    </div>
  );
}
