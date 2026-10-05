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
- No Rust change; the macOS native menu keeps working through the same events.
