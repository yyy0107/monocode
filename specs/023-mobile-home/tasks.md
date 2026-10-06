# Tasks

- [x] T001 Read constitution, active-feature artifacts and localization rules;
  inspect the mobile shell and confirm the user wants mobile only.
- [x] T002 Add the shared mobile home/project list page with history fetching,
  search, pinned/recent groups, project ownership and retry behavior.
- [x] T003 Connect launch, project links, All projects, new conversations,
  Settings return and Android Back. Keep session/network confirmation behavior.
- [x] T004 Remove per-project plus buttons, preserve animated tree disclosure,
  animate Show more/Show less and support swiping from the new page.
- [x] T005 Add labels and update list, navigation, loading, unread, command and
  folder-picker regressions. Final affected suite: 9 files, 68 tests passed.
- [x] T006 Run full checks and browser layout verification; record actual
  results in verification.md, including the three Host failures outside this
  mobile change. Device-native Android/iOS execution is untested.
- [x] T007 Replace the Home title capsule with a plain dropdown, reuse
  MobileSheet for Add connection / Settings, and verify shared close motion,
  focus, localization, top alignment, narrow widths and mobile build.
- [x] T008 Add the mobile Message composer setting, persist Queue / Steer,
  connect sends to Host queue ownership, and verify selection, motion, reload,
  unsupported steering, receipt replay and failure preservation.
- [x] T009 Move Home / project / All projects search into a header input
  capsule replacing the leading controls, preserve scope and dismissal,
  shared motion and focus, and verify narrow layouts and mobile build.
- [x] T010 Put conversation provider icons before titles and unread dots
  after timestamps on the right; verify existing notification behavior,
  long-title truncation, project scope, drawer layout and mobile build.
- [x] T011 Match the selected-project reference layout with leading project /
  Host context, a flat history list and bottom Search / Chat actions. Preserve
  provider icons, unread/running state, pinned animation and menu/search flows;
  verify affected tests, phone-width layout and mobile build.

- [x] T012 Add Home/pinned/project conversation long-press menus with explicit
  project ownership, title, existing actions, gesture cancellation, and shared
  opening/closing motion. Verify gesture and cross-project update regressions.
- [x] T013 Compact aggregate Home project/conversation rows to 44px/48px
  minimum heights; verify phone-width rendering and text truncation.
- [x] T014 Share recent-activity project ordering with the drawer, fetch all
  summaries while open/foregrounded, default-expand running projects while
  preserving manual collapses and animated preview visibility, and verify
  refresh/failure/stale-request behavior and phone layouts.
- [x] T015 Track project-page conversation entry separately in MobileApp memory;
  show localized Back for project rows/new drafts and Menu for other entries.
  Preserve source through loading/failure and Settings; reuse openHome and its
  request invalidation, with Home fallback when the current project is missing.
- [x] T016 Verify project regular/pinned/search rows, drafts, Settings, Home,
  sidebar/notification/assistant source reset, loading/failure and late responses.
  Run activityUi.test.ts and sessionLoading.test.ts (60 passed) and TypeScript
  checking (passed); record actual results and limits in verification.md.
