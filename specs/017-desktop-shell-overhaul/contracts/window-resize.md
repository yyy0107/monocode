# Native workspace window boundary

Each native Linux/Windows workspace bootstrap mounts one transparent resize layer
at the whole window's outer boundary. Four 10 CSS pixel inward edge strips and
four 16px corner squares expose North, East, South, West and the four diagonals,
with corners taking hit-test precedence and the matching cursor. A primary pointer
press calls Tauri `startResizeDragging` with that direction; native constraints,
snapping and size updates remain owned by the OS/Tauri.

Handles are unavailable while maximized, fullscreen or non-resizable, on macOS,
and in browser/Host clients. Native state refreshes cannot apply stale results;
all native listeners, including asynchronously registered ones, are released on
unmount. The layer applies to primary and additional workspace windows and does
not alter the internal sidebar or terminal dock resize/disclosure contracts.
