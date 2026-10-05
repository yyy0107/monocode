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
   Notes, Automations, project access, live agents,
   updates, Settings) replaces the 200px project rail. One sidebar keeps
   Sessions, Explorer and Changes; ⌘B toggles it and its width persists.
   Expanding and collapsing animate the width smoothly while dragging stays
   immediate; reduced-motion preferences skip the transition.
   Overrides for the removed "Toggle Session Sidebar" command migrate to
   "Toggle Sidebar".
5. **Persistent multi-project tree.** Project names and avatars live in the
   single sidebar, grouped and pinned using existing preferences. Several
   projects can expand concurrently in Sessions; session rows are one line
   with title and status, with metadata available on hover/focus. In multi-project
   mode, Explorer and Changes replace the top Projects title with a searchable
   project picker and a compact branch/worktree control for an available local
   Git project. Quick-open/search and add remain at the right of that header;
   the tabs sit immediately below, without separate project or worktree rows.
   Picking a project switches the active working copy; only its file tree/search
   or changes panel
   fills the remaining sidebar height, without project-tree rows or a 420px cap.
   Files scroll internally and Changes has a vertical scroll region. An empty
   or `~` cwd keeps the switcher visible and shows the localized Choose project
   hint. Single-project callers without recents keep their existing header,
   worktree toolbar, ProjectList and bounded working-copy behavior and do not
   show the project picker. Sessions also uses the header project picker, with
   All projects as its default scope and a choice for any remembered project.
   A concrete selection activates and expands that project, shows only its
   sessions, and limits search/history reads to it. Returning to All projects
   restores the multi-project tree. Show the compact worktree control only for
   a concrete scope matching the active local project. Its expansion persists; clicking a collapsed project's
   name activates and expands it, clicking an open one collapses it, and
   disclosure clicks only expand/collapse. Rows slide open and closed. Per-project new chat
   targets that project's remembered worktree. Projects remain until explicitly
   archived/deleted, without the previous 20-project eviction.
   Child rows indent their content to the project name; the project avatar
   doubles as the disclosure, turning into a chevron on hover/focus. Each
   project shows five ungrouped chats (plus the active one) with Show
   more/Show less; search results are never truncated.

   Project groups, project children, session folders, pins and reminders all
   animate on expansion and collapse through the shared AnimatedCollapse
   component, following the standing disclosure rule in AGENTS.md. Closing
   content stays mounted and inert until motion completes; rapid reversal is
   supported and reduced-motion preferences settle immediately.

   Terminal docks follow the same standing motion rule: their grid tracks
   expand/collapse smoothly, stay stable at zero size when closed, and disable
   transitions during direct resizing. Hidden docks retain their running PTYs,
   suppress focus/menus, and restore the committed size when shown again.

   Sessions search matches project display names/paths and conversation titles
   across projects in the selected scope. It fills missing summaries with at most four
   concurrent reads, temporarily expands result ancestors, and restores saved
   expansion after clearing. Summaries/errors are cached independently per
   project; collapsed remote projects stop polling. Selection, folder drops and
   batch actions remain project-scoped. Current-project keyboard navigation,
   worktree behavior and existing session folders/reminders remain compatible.
   Project and session rows share 32px height and the same horizontal row bounds,
   including folder members. Rows and session groups use consistent 3px gaps;
   project groups retain 8px separation. Model, branch, time and full title
   remain available on hover and keyboard focus. Same-name projects expose
   full paths and remote machine names. Existing rename/archive/delete,
   orchestration details, folder/reminder/pin menus and workspace-pane drops
   remain available. Folder membership is cleaned only after a complete,
   successful project listing, never from filtered results or a failed read.

6. **Session and project hover summaries.** Session rows reveal a structured
   320px summary with full title, current status and optional model, branch,
   worktree directory and last-update rows. Project rows reveal a matching card
   with avatar/name, pin control, session/unread/opened counts, full path,
   remote machine/connection when relevant and Edit project. Edit reuses the
   existing project configuration menu. Pointer opening and leaving are
   immediate, without timers or a card entrance animation. Direct pointer
   transfer between the row and card retains the surface. Keyboard users
   can reach the project actions, Escape restores focus, and row actions never
   fire from summary controls. Search, filters and the five-row preview do not
   affect counts. Unread means finished while unfocused and not yet viewed;
   opened means distinct main conversations in this window's workspace tabs.
   Unknown history is not zero; lazy reads retain cached summaries on failure.

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
- Several project trees can remain open; request deduplication and generation
  checks prevent out-of-order or removed/relocated-project responses from
  replacing current data. A failed project can retry while others remain usable.
- In multi-project Explorer/Changes, the compact searchable project picker
  replaces the top Projects title, shows the current project and calls the
  existing project-switch handler on selection. An available local Git project
  shows its compact branch/worktree control beside the picker. Quick-open/search
  and add stay at the right; tabs follow the header with no standalone project
  or worktree rows. The viewport renders one active working copy and no
  project-tree rows and fills the remaining height. Header diff statistics
  follow only the current project's git root.
  Empty or `~` cwd shows Choose project (选择项目); callers without recents
  show no picker and retain their previous header/worktree behavior. Switching
  back to Sessions restores its project scope picker, search and project tree.
- Equal remote session IDs in different projects open distinct chats; Shared
  Host native rows use the existing local route only for a locally shared project.
- Searching collapsed projects fills missing summaries at concurrency <=4,
  preserves offline remote cache, reports unfinished/error state, and restores
  project/group/folder expansion after clearing. Reminder and update badges do
  not leak across projects with equal session IDs.
- Adding 25 projects survives a storage reload, preserving the existing recent
  format; archived/deleted projects and renamed paths update expansion keys.
  Already-evicted projects require re-adding.
- Summary title/branch/path values wrap without horizontal overflow in both
  themes and UI languages. Optional metadata is hidden when unavailable.
  Keyboard focus and pointer hover immediately open the same content, and
  summary scrolling remains usable. Scroll/drag/outside/Escape/menu dismissal
  and closing ancestors immediately hide the surface.
- Project counts deduplicate within project identity, exclude archived/worker
  history, include genuine open blank chats and exclude retained closed chats
  from opened counts. Loaded empty projects show zero; loading, unavailable
  and cached states remain distinct. Equal remote IDs do not leak counts.

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


## Other draggable regions follow-up (2026-10-05)

After enlarging the native window edges, the user requested larger targets for the
other existing draggable regions. Internal panel dividers use a transparent 16 CSS
pixel target on one side of the divider, with a thin 2px hover/drag feedback line.
Vertical targets extend to the right and horizontal targets extend downward.
This applies to the sidebar, workspace splits, graph panel, project/session
terminal docks, Inbox and Notes lists, Inbox discussion and linked-item panels.
Quick Composer's window drag strip is 20px high; the color picker's hue drag strip
is 16px high. Existing thin visuals remain compact.

Targets remain fully available on their designated side of the divider. Content
clipping lives inside the target's container. Controls in that side's content have
16px clearance, while preceding panes keep scrollbars next to their original edge.
Preserve existing pointer capture, drag direction, size limits, double-click reset
and saved dimensions wherever supported. Hidden,
closing and disabled panels expose no active target. Responsive discussion-panel
rules remain in force.

Sidebar and terminal disclosure retain the shared two-way collapse motion, stable
closed tracks, immediate direct resizing and reduced-motion behavior. Hidden
terminals retain their mounted instances and PTYs. Acceptance requires focused
behavioral regressions plus browser checks of actual target geometry, neighboring
controls/scrollbars, drag/reset behavior and hidden/closing state. Real native
desktop dragging is recorded separately from simulated/browser results.


The user additionally requires the scrollbar's visible thumb to remain 1px from
its edge without making the visible thumb thicker. Non-macOS horizontal and
vertical tracks remain transparent and 12px wide; asymmetric transparent thumb
borders preserve a 6px visible body with a 1px right/bottom gap. The default border
is 1px, with 5px on the vertical thumb's left side and horizontal thumb's top side,
using content-box background clipping. Deliberately hidden scrollbars stay hidden. Inbox/Notes lists have no extra right margin, and content
before discussion or linked-item panels has no extra right padding.

Protect controls on the target's side with 16px content clearance: Inbox/Notes
details and discussion/linked-item panels use left padding outside their existing
horizontal content padding. Workspace/main content reserves only left/top
clearance for following panels, with no additional right/bottom spacing. The graph
panel uses a real 16px divider track. The native resize layer introduces no 10px
root inset, so workspace content and scrollbars keep their edge positions.

Native edge resizing inspects the real event target from a window capture-phase
`mousedown` handler. Buttons, inputs, links, custom drag rails and actual scrollbar
tracks keep their existing pointer behavior; ordinary eligible edges still use
10px bands and 16px corners. The eight transparent direction nodes do not take
pointer hits. Pointer movement only supplies the resize cursor. Actual native
resize behavior and native scrollbar/control access require desktop verification.


## Menu/title-bar drag initiation follow-up (2026-10-05)

The user reports a slow response after pressing the menu bar to drag the window.
Eligible Linux/Windows native title/menu-bar presses dispatch the existing Tauri
window move from React's capture-phase mouse handler. A shared `startWindowDrag`
helper calls `startDragging()` during the initial handler without awaiting window
state, a frame, or a timer. After the helper accepts a menu-bar press, the menu
closes and its temporary Alt-reveal state resets.

Only a primary press with `detail === 1` inside a deep drag region is eligible.
Interactive controls, explicit `data-tauri-drag-region="false"` descendants and
portal targets outside the region retain their existing behavior. Browser/Host
and macOS clients use no new handler dispatch. The second press of a double click
passes through to Tauri's existing maximize behavior. Native window edge capture
keeps precedence over the title/menu-bar move handler.

Local inspection of Tauri's 2.11.5 drag script found an immediate document-bubble
`mousedown` invoke for a first press, and no application drag-delay timer was found.
The change moves application dispatch earlier in event propagation; the source of
any native queue delay and actual press-to-window-motion timing remain unmeasured.
Acceptance requires capture-dispatch and exclusion regressions, menu closure and
edge/double-click compatibility checks, then separate real native timing/drag
observations. No OS latency improvement or performance figure is claimed without
measurement.

## Shared tab appearance — follow-up (2026-10-05)

Workspace, file/terminal, sidebar, app-page and picker navigation tabs share the
reference image's appearance: the active tab has a subtle surface, thin border,
8px rounded corners and a small shadow; inactive document tabs have clear
separators. Keep existing document-tab heights and compact navigation sizing.
Center tabs vertically so top and bottom clearance match within each row.
Active workspace tabs expose their close button. Preserve tab selection, menus,
sorting, opening/closing motion, native window drag exclusions and dock resizing.
The earlier bottom terminal dock adjustment removes its extra 16px top padding;
its tabs/actions stay above the overlapping resize hit target.

The dock's raised tab/action wrappers must fit their visible controls. Its full
top boundary, including positions above tabs and trailing buttons, exposes the
resize cursor and drag gesture. A full-row wrapper must not block that boundary.

## Production startup responsiveness — follow-up (2026-10-05)

The user reproduced the delay in the production desktop and clarified that it
mainly happens immediately after launch. Restoring a large workspace must avoid
repeatedly decoding the entire remote-session binding table and building
transcripts for tabs that have never been shown. After its first visit, a
transcript retains the existing pool, scroll and revisit behavior. Background
session synchronization, queue ownership and mounted terminal lifetimes remain
independent of transcript visibility.

Simultaneous panes in the same Host scope share in-flight descriptor/model
catalog reads. Completed or failed reads are not retained by this coalescer:
later reconnects revalidate, identity changes fail closed, and different machines,
environments and projects remain isolated. Closing a waiting pane must not apply
its eventual result. Local-storage changes remain visible across windows before
the storage event is delivered, and failed writes must not alter cached records.

Verify restored-pane mount/request counts and existing transcript first-paint
and scrolling behavior. Rebuild production packages. Controlled counts and helper
benchmarks are evidence of removed work, not native launch-to-responsive timing.
