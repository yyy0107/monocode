# Native workspace window boundary

Each native Linux/Windows workspace bootstrap handles outer-window resizing with
a window capture-phase `mousedown` listener. Geometric bands cover 10 CSS pixels
inward from the four edges and 16px at each corner, resolving North, East, South,
West and the four diagonals with corner geometry taking precedence. An eligible
primary press delegates to Tauri `startResizeDragging(direction)`; native size
constraints, snapping and resulting size updates remain owned by the OS/Tauri.

Before dispatch, inspect the genuine event target and actual scrollbar track.
Buttons, inputs, links, custom drag rails and scrollbar tracks retain their own
interaction even when they lie in a resize band. The eight transparent direction
nodes do not participate in pointer hit testing and cannot cover controls or
scrollbars. Pointer movement only manages the resize cursor; it does not start
a native drag.

Resizing is unavailable while maximized, fullscreen or non-resizable, on macOS,
and in browser/Host clients. Native state refreshes cannot apply stale results.
All native listeners, including asynchronously registered ones, and global input
listeners are released on unmount. Primary and additional workspace windows
receive the same behavior, preserving internal panel controllers and disclosure.

The root receives no extra padding or 10px content inset. Workspace content and
scrollbar tracks stay at their original edges. Non-macOS tracks are transparent
and 12px wide with a 6px visible thumb 1px from the right/bottom boundary, using
asymmetric transparent borders as described in `drag-targets.md`.

Regressions must cover direction geometry, native-state gating, stale/listener
cleanup and genuine-target pass-through, including real scrollbar-track detection.
Browser fixtures with simulated IPC establish only browser geometry and event
dispatch. Actual native edge/corner drags, neighboring controls/scrollbars, size
constraints, snapping and applicable platform scenarios remain separate desktop
verification requirements.
