# Desktop shell overhaul

Date: 2026-10-05. Branch: `main` (local).

The desktop shell crowds the workspace and hides it behind full-page views.
Reshape it around four user decisions while preserving sessions, tabs, panes,
terminal docks, persisted snapshots and existing keyboard overrides.

## Stories

1. **Command registry and menu bar.** One registry describes every app command
   (id, English title, effective shortcut, native menu event, runner). The key
   handler, native menu events, the Windows/Linux menu bar and the palette all
   dispatch through it. On Windows/Linux the in-window menu bar is always
   visible (File, Edit, View, Go, Terminal, Help) with a setting that restores
   Alt-reveal. Menu hints and tooltips show the user's effective shortcuts.
   "Close Pane" closes the focused pane, matching Ctrl+W. Rebinding a shortcut
   works in the zh-CN UI (overrides are stored under English command ids).
   The same top row begins with Back, Forward and Toggle Sidebar, followed by
   the menus, and ends with Minimize, Maximize/Restore and Close window.
   The tab strip and sidebar do not repeat these controls in this layout.
2. **Unified quick open.** ⌘P and ⌘K open one palette; no prefix lists files,
   `>` commands, `#` sessions and `@` projects. A final row searches everything
   in the Search view. ⌘⇧P opens the palette prefilled with `>`. Search icons in
   the shell open the palette.
3. **App views as workspace tabs.** Settings, Search, Inbox, Notes and
   Automations open as workspace tabs that can be split beside sessions, closed
   with ⌘W and restored after restart. The sidebar, terminal dock and footer
   stay visible. Each view has one instance per window; a tab holding only app
   views appears in every project's tab strip. Esc leaves a view without
   closing its tab. Settings navigation lives inside the Settings view.
   Each view fills the available pane height so its content and internal
   navigation can scroll independently. First-use lazy loading stays inside
   the pane; it does not clear the window or hide the surrounding shell.
4. **Activity bar and single sidebar.** A 48px activity bar (Search, Inbox,
   Notes, Automations, project avatars, all-projects pop-out, live agents,
   updates, Settings) replaces the 200px project rail. One sidebar keeps
   Sessions, Explorer and Changes; ⌘B toggles it and its width persists.
   Expanding and collapsing animate the width smoothly while dragging stays
   immediate; reduced-motion preferences skip the transition.
   Overrides for the removed "Toggle Session Sidebar" command migrate to
   "Toggle Sidebar".

## Acceptance

- zh-CN on Linux: menus, palette, tab titles, tooltips and settings rows are
  localized; a rebound shortcut appears in the menu and works.
- Opening a file, diff or plan from an app-view-only tab never lands inside an
  app view; it opens in the project's last visited tab.
- Older workspace snapshots restore unchanged; app-view tabs round-trip by
  kind only; duplicate kinds collapse to the first.
- Long Settings pages and other app views scroll within their available pane
  height, including split panes and a visible terminal dock.
- Switching to an app view whose content is still loading keeps the menu,
  activity bar, sidebar, tab strip, footer and adjacent panes visible, with a
  loading fallback confined to that app pane.
- No Rust change; the macOS native menu keeps working through the same events.

## Terminal dock disclosure motion

Terminal docks follow the standing expand/collapse rule in AGENTS.md. Grid tracks
animate in both directions and keep the same areas at zero size when closed.
Hidden docks retain their terminal instances and running PTYs, suppress focus and
menus, and restore the committed size when reopened. Direct resizing is immediate;
closing during a drag commits its pending size and releases pointer capture.
Reduced-motion preferences skip the animation.

## Native window resize edges follow-up (2026-10-05)

The outer edge of the whole desktop window is too difficult to grab for resizing.
Linux and Windows workspace windows provide transparent resize hit areas extending
10 CSS pixels inward from each edge, with 16px corner areas for diagonal resizing.
All eight directions show the matching resize cursor and start the existing native
window resize operation. Native size constraints and window-manager behavior stay
under Tauri/OS control; the application does not calculate or set window sizes.

The handles are mounted for every workspace window, including transferred and
detached workspaces. They are inactive when maximized, fullscreen or non-resizable,
and are absent on macOS and browser/Host clients. Changes to native window state
update availability; unmounting releases listeners and ignores stale asynchronous
results. Internal sidebar and terminal dock resizing retain their existing behavior.
Acceptance requires directional/native-state regressions and an explicit record of
which real desktop/platform resize scenarios were exercised.
