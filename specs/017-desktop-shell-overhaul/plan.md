# Implementation plan

Phases ship independently in dependency order: registry and menu bar →
quick open → app-view tabs → activity bar.

1. `src/app/commands/registry.ts` builds `AppCommand`s from `KEYBINDINGS` plus
   unbound commands; `useCommandDispatcher` owns the per-command debounce and
   the native `listen()` table. The App key handler keeps its guards and
   dispatches by command id. `MenuBar` renders registry menus; the visibility
   flag `monocode.menuBarVisible` defaults to true. Fix the zh-CN override key.
   Use a 36px menu row, with `TabVisitNav` before the menus and `WindowControls`
   at the far right, all vertically centered.
   When pinned, remove the lower title/sidebar chrome and navigation spacers;
   the sidebar workspace header aligns with the 40px tab strip. Keep title-row
   controls for macOS and hidden-menu mode; Alt reveals menus between them.
   The activity bar drops its 40px top spacer while the menu is pinned.
2. `FilePicker` becomes `features/search/ui/QuickOpen.tsx` with prefix modes
   parsed by `features/search/model/quickOpen.ts`; commands come from the
   registry; sessions and projects reuse `appSearch.ts` helpers.
3. `FilePaneTab.appView = {kind}` (path `app:<kind>`, cwd `~`). `AppViewHost`
   renders views through an `AppViewRenderer` context supplied by App, mounts
   on first activation and freezes while hidden. Remove the five view booleans
   and the props that existed only for full-page rendering.
   Keep a bounded-height flex container between `FilePane` and each app view:
   `flex-1` on the view must have a flex parent, with `min-h-0` through the
   chain so internal `overflow-y-auto` regions can shrink and scroll. Isolate
   lazy-content suspension inside the app pane with a local loading fallback;
   the window shell and neighbouring panes remain mounted and visible.
   Regressions cover the container contract, retained view state and
   pane-local loading. Browser geometry checks verify actual overflow and
   scrolling on long Settings pages and representative app views.
4. Persist the sidebar width; extract `ProjectList`/`ProjectAvatar`; add
   `ActivityBar`; reduce `Sidebar` to the panel; drop the project rail and its
   collapsed-mode setting; migrate the sidebar keybinding in the override
   parser without writing back.
   `SidebarTransition` keeps a zero-width shell mounted and animates width
   for 200ms. Keep content at the saved width until collapse finishes; disable
   transitions during direct drag resizing. Closing finishes any active drag,
   marks content inert, hides portals and then unmounts it. Cancel stale close
   timers on reopening, with immediate collapse for reduced-motion preferences.

Validation: affected vitest files during development; `npm run check:web` and
`npm run build` per phase; `npm run test:host` at the end. Manual checks on
Linux zh-CN via `npm run tauri dev`. macOS/Windows remain unverified.

## Phase 5 — multi-project tree (2026-10-05)

- Keep ActivityBar at 48px with window-wide actions and a project access action;
  move avatars into ProjectList named rows. Extend ProjectList with controlled
  expansion/child rendering while retaining pin/group/order/menu storage.
- Sidebar owns one transition/resizer, the view tabs, query and filters. Extract
  ProjectSessionSection from its existing session controller; every project
  keeps its own folders, pagination, rename and menu state. In multi-project
  Files/Changes, replace the top Projects title with the compact ghost
  SearchableProjectPicker and its visible current-project label; reuse its
  avatar, resolved name, search and existing select/open handlers. Place the
  existing branch/worktree selector in a compact form beside it for an available
  local Git project, retaining its selection/open behavior. Keep quick-open/search
  and add aligned at the right. Render the tabs immediately below the header,
  omitting separate project-picker and worktree-toolbar rows in these modes.
  Render the active file/search/source-control content through a local
  renderWorkingCopy() in the remaining `flex-1 min-h-0`
  viewport, without ProjectList rows or the former 60%/420px cap. Files keeps
  its internal scroller behind `overflow-hidden`; Changes uses `overflow-y-auto`.
  Empty/`~` cwd retains the picker with the existing localized Choose project
  hint. Callers with recents undefined retain their current header, worktree
  toolbar, ProjectList and bounded working-copy behavior, without a project
  picker. Sessions reuses the header picker with an opt-in All projects choice
  and window-local scope state, separate from cwd. Scope the project tree and
  lazy/search loaders to that selection; choosing a concrete project also calls
  the existing activation handler and expands it. Reveal its group temporarily
  without persisting group collapse changes. Retain the scope across sidebar
  tabs and fall back to All projects when the project disappears. Keep the
  compact worktree control in the header only when the scope matches the active
  local project. Use single-line 32px session rows matching project row
  width, with focus-accessible
  metadata; use consistent 3px row/session-group gaps and 8px project-group
  separation. Source-control controls and the change list remain reachable by
  scrolling in short windows.
- App retains its multi-project history array but loads/error/dedup/generation
  state becomes project-keyed. Refresh actions target the edited session's cwd.
  Reuse listSessionsByProject and existing remote summaries without new protocol
  fields. Add explicit per-project creation, project-scoped remote identity,
  and active-only session navigation order. Invalidate pending reads on project
  removal/location changes; scope reminders and completion/link flags by project.
- Expansion loads only summaries; global search fills missing lists through a
  four-request queue. Remote polling and one-shot searches share deduped cache
  reads; cache remains usable offline or collapsed. Search never persists
  temporary expansion or prunes folders against partial results.
- Reuse `shared/ui/AnimatedCollapse` for project groups/children and session
  folders/pins/reminders. Keep the existing fold CSS, cancel stale timers on
  reversal, hide closing surfaces/portals, and settle reduced motion immediately.
  AGENTS.md owns this standing UI rule for future disclosure changes.
- Terminal docks reuse `useCollapseMotion` and the shared motion duration/easing
  in `animated-collapse-size`. Keep dock grid areas/tracks stable at zero size
  when closed, disable grid transitions for imperative drag painting, finish a
  resize before hiding, and retain mounted terminal views so PTYs survive.
- Keep the recent-project wire format but remove its 20-item truncation. Store
  expansion under normalized project keys and rebase/clear with project paths.
  Mobile continues to consume Host projects.list/HostProject[]; its protocol and
  layout are unchanged. Inspect shared desktop project pickers for schema
  compatibility and test retention by re-reading stored recents.
- Validate affected UI/data/navigation regressions, complete web/Host/build
  checks sequentially, and record actual browser/native QA independently.

## Hover summary follow-up (2026-10-05)

- Add shared HoverSummary intent/focus handling and a 320px Popover surface
  with 12px padding and wrapping metadata rows. Retain existing Popover
  placement and SurfaceVisibility handling. Open and close immediately on
  hover/focus departure, retaining pointer or focus within the row/card.
  Disable the entrance animation only for these cards; overlap the row edge
  by 1px and include the whole Popover frame and trigger region in pointer
  retention. Dismiss on drag/scroll/menu/hidden surfaces and restore
  project-row focus on Escape.
- Replace dense session metadata strings with a full-title/status header and
  optional model, branch, worktree path and update rows. Keep session prefetch
  independent and the existing subagent tooltip's priority.
- ProjectList accepts optional projectSummaries/onProjectHoverOpen; its
  interactive card reuses pin storage and useProjectMenu with the original row
  as the return-focus target. Existing callers without counts show identity
  and actions. Stop React portal event propagation to row actions.
- App supplies actual openSessionIds(tabs) independently of retained live
  openSessions. Sidebar calculates full unfiltered project counts and performs
  deduped lazy reads on hover. Reuse Host caches and project-scoped
  shell-to-Host IDs; distinguish unknown/empty/error/cached data without new
  protocols or persistence. Add English-key Chinese summary labels.
- Verify intent/focus/actions/counts/loading/remote isolation in affected
  tests; check real browser layout in both themes/languages, narrow sidebars
  and viewport edges. Complete check:web, test:host and build sequentially.

## Terminal dock disclosure motion

Extract `useCollapseMotion` from shared AnimatedCollapse and use the shared 340ms
duration/easing for `animated-collapse-size` grid transitions. Keep dock grid areas
stable while closed; allow zero-sized layout tracks without changing saved dock
sizes. Retain mounted terminal views, make closing surfaces inert and hide their
portals. Disable transitions for drag painting, restore them on commit, finish
an active drag before hiding, and settle reduced motion immediately.

## Native window resize edges follow-up (2026-10-05)

- Mount shared transparent window resize handles at the workspace bootstrap so
  each primary, transferred or detached workspace window receives them. Limit
  activation to native Linux/Windows windows; browser/Host and macOS paths remain
  inactive. Use fixed 10 CSS pixel edge strips and 16px corner squares, with the
  corners taking precedence and matching cursors for all eight directions.
- Delegate a primary pointer press to Tauri `startResizeDragging(direction)`.
  Keep native min/max sizes and window-manager constraints/snap behavior; do not
  introduce manual size calculation or change internal sidebar/dock resizers.
- Query maximized, fullscreen and resizable state before enabling the handles,
  refresh after native window changes, and hide/disable them when any state
  disallows resizing. Release listeners on unmount, including late registrations,
  and discard obsolete asynchronous state responses.
- Verify direction dispatch, hit-area geometry, platform/state gating and listener
  cleanup with focused regressions, then run web/Host/build checks. Record native
  Linux/Windows edge, corner, maximize/restore and fullscreen checks separately;
  source inspection and mocked APIs do not establish native platform compatibility.


## Other draggable regions follow-up (2026-10-05)

- Add shared `ResizeHandle` with left/right/top/bottom edges and 16px one-sided
  transparent targets: vertical strips extend right and horizontal strips down.
  Centralize placement/cursors and 2px hover/active feedback in shared CSS, and suppress interaction through disabled state and existing
  `SurfaceVisibility` when a parent closes or hides.
- Reuse existing handlers across sidebar, workspace splits, graph panel,
  project/session terminal docks, Inbox/Notes list dividers, discussion and
  linked-item panels. Keep capture, min/max clamps, double-click resets and
  dimension persistence owned by their current controllers.
- Keep clipping inside the handle's surrounding container. Reserve 16px for
  controls only on the side containing the target, without shifting the preceding
  pane's scrollbar away from its edge. Move linked-panel opening clipping to an
  inner wrapper and retain the discussion panel's narrow-screen handle hiding.
- Preserve shared sidebar/terminal disclosure motion in both directions, inert
  closing content, stable zero-sized dock tracks, retained PTYs and immediate
  direct resizing. No view-specific fold timers or alternate collapse mechanism.
- Enlarge Quick Composer's existing native drag strip to 20px and the color
  picker's existing hue slider to 16px without replacing their interaction logic.
- Follow `contracts/drag-targets.md`. Run focused affected tests, then full web,
  Host and build checks; record actual browser/native QA and CLI versions when
  performed. Preserve unrelated local work and the active-feature pointer.

- Enlarge the non-macOS horizontal/vertical scrollbar tracks to 12px while
  retaining a 6px visible thumb. Use a transparent 1px default thumb border, 5px
  vertical left border and 5px horizontal top border, with content-box background
  clipping. The visible thumb remains 1px from the right/bottom edge; deliberately
  hidden scrollbars remain hidden.
- Remove Inbox/Notes list `mr-2` and discussion/linked-panel preceding content's
  right padding. Protect controls with 16px left-side content padding in the
  detail/discussion/linked panels without overriding their existing horizontal
  padding. Workspace/main content reserves only left/top clearance for following
  panels, with no added right/bottom spacing; give Graph a real 16px divider track.
- Remove the native layer's proposed 10px root padding and the proposed 8px
  two-sided content insets. Keep scrollbars at their original edges.
- Use window capture-phase `mousedown` for native resizing, inspecting the real
  target and actual scrollbar track before delegating. Pass through buttons,
  inputs, links and custom drag rails. Keep the ordinary 10px edge/16px corner
  geometry; all eight transparent direction nodes have no pointer hit behavior.
  Pointer movement updates the resize cursor only. Verify target pass-through
  with native-state/direction regressions and separate actual desktop QA.
- Record browser geometry and controller exercises independently from native
  verification; final full-suite results remain pending.


## Menu/title-bar drag initiation follow-up (2026-10-05)

- Share `app/shell/startWindowDrag` between MenuBar and TitleBar and attach it via
  `onMouseDownCapture` to their deep native drag regions. Call Tauri
  `getCurrentWindow().startDragging()` immediately for eligible first primary
  presses, without awaiting state, requesting a frame or adding a timer.
- Require native Linux/Windows, an unconsumed event, `detail === 1`, the deep-region
  marker and actual DOM containment. Exclude controls, explicit non-drag
  descendants and React portal targets outside the region. Consume only an
  accepted move request so Tauri's document handler does not duplicate it.
- After MenuBar dispatch is accepted, close its menu and clear Alt-reveal state.
  Preserve control actions, tab/pane dragging and the existing double-click
  maximize route; native edge capture runs first and keeps resize precedence.
- Follow `contracts/window-drag.md`. Cover immediate invocation/order, exclusions,
  menu cleanup, platforms, double clicks and edge precedence with focused tests,
  then run full web/Host/build checks. Record actual native drag/timing observations
  independently from mocked dispatch and source inspection.
- Preserve existing dirty work and the active-feature pointer. Tauri 2.11.5 script
  inspection establishes the existing synchronous document-bubble dispatch path,
  not the source of OS/native queue delay or a measured speedup.

## Shared tab appearance — follow-up (2026-10-05)

- Define `.surface-tab` once in the shared stylesheet with theme-aware active
  surfaces, borders, corners, feedback transitions and reduced-motion handling.
  Use existing `aria-selected`, plus a grouped-tab data state for side questions.
- Apply the shared appearance to shell/document tabs, sidebar/app-page navigation
  and mode/provider pickers. Replace full-height underline tabs with centered
  30px pills; preserve 30px document tabs and smaller compact controls.
- Workspace tabs use tab/tablist semantics. Keep inactive document separators
  decorative and pointer-transparent, and show the selected workspace close action.
- Verify actual browser spacing, both themes and tab/close actions; run affected
  consumer suites and build/type checks. No provider, Host or Rust code belongs
  to this appearance change. Preserve other dirty work and the feature pointer.

- Compact bottom dock tab slots match the pill's 30px height and center within
  the row. Trailing controls also self-center with intrinsic height. Their raised
  hit regions protect only the controls, leaving the top boundary continuously
  available to ResizeHandle. Verify hit testing above inactive/active tabs,
  blank space and trailing actions, plus an actual drag from above a tab.
