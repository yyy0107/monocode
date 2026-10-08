/**
 * Split dividers and panel folds resize panes on every animation frame.
 * Surfaces whose resize is expensive (a terminal re-wraps its scrollback and
 * resizes the PTY) can wait for the motion to end instead of following every
 * intermediate size.
 */
let active = 0;
const settledListeners = new Set<() => void>();

export function isPaneResizing(): boolean {
  return active > 0;
}

/** Returns the matching end call; calling it more than once is harmless. */
export function beginPaneResize(): () => void {
  active += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    active -= 1;
    if (active > 0) return;
    for (const listener of [...settledListeners]) listener();
  };
}

/** Runs after the last active pane resize ends. */
export function onPaneResizeSettled(listener: () => void): () => void {
  settledListeners.add(listener);
  return () => settledListeners.delete(listener);
}
