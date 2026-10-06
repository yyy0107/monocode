import { useSyncExternalStore } from "react";
import { paneEdgeFromPoint, type PaneEdge } from "./layout";

export type PaneDrop = {
  fromId: string;
  overId: string | null;
  edge: PaneEdge;
};

let drop: PaneDrop | null = null;
const listeners = new Set<() => void>();

function subscribeNoop() {
  return () => {};
}

function getNullDrop(): PaneDrop | null {
  return null;
}

export function setExternalPaneDrop(next: PaneDrop | null) {
  if (
    drop?.fromId === next?.fromId &&
    drop?.overId === next?.overId &&
    drop?.edge === next?.edge
  ) {
    return;
  }
  if (drop == null && next == null) return;
  drop = next;
  for (const listener of listeners) listener();
}

export function subscribeExternalPaneDrop(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getExternalPaneDrop() {
  return drop;
}

/** Overlay for a drag that starts outside the pane tree (sidebar cards). */
export function useExternalPaneDrop(enabled = true) {
  return useSyncExternalStore(
    enabled ? subscribeExternalPaneDrop : subscribeNoop,
    enabled ? getExternalPaneDrop : getNullDrop,
  );
}

export function paneDropFromPoint(
  x: number,
  y: number,
): { id: string; edge: PaneEdge } | null {
  const el = document.elementFromPoint(x, y);
  const pane = el?.closest("[data-pane-id]") as HTMLElement | null;
  const id = pane?.dataset.paneId;
  if (!id || !pane) return null;
  return { id, edge: paneEdgeFromPoint(x, y, pane.getBoundingClientRect()) };
}

/**
 * A split terminal dragged toward the project's terminal dock: over the open
 * dock, or over the bottom band where a closed dock would open.
 */
export type TerminalDockDrop = "dock" | "band" | null;

let dockDrop: TerminalDockDrop = null;
const dockListeners = new Set<() => void>();

export function setTerminalDockDrop(next: TerminalDockDrop) {
  if (dockDrop === next) return;
  dockDrop = next;
  for (const listener of dockListeners) listener();
}

function subscribeTerminalDockDrop(listener: () => void) {
  dockListeners.add(listener);
  return () => {
    dockListeners.delete(listener);
  };
}

export function useTerminalDockDrop() {
  return useSyncExternalStore(
    subscribeTerminalDockDrop,
    () => dockDrop,
    () => null,
  );
}

/** Height of the bottom strip that docks a dragged terminal when no dock is open. */
export const TERMINAL_DOCK_BAND = 56;

/** Whether the point is over the open terminal dock. */
export function overOpenTerminalDock(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y);
  return !!el?.closest("[data-project-terminal-dock]:not([inert] *)");
}

/** An open dock that can receive terminals is on screen. */
export function terminalDockOpen(): boolean {
  return !!document.querySelector(
    "[data-project-terminal-dock]:not([inert] *)",
  );
}
