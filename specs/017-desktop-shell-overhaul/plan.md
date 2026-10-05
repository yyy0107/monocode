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
