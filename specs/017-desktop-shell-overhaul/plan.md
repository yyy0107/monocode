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
