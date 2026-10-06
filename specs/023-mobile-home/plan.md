# Plan

- Add MobileHome as one list surface for Home, All projects and a selected project.
  Load histories independently with partial-failure recovery; refresh every 3 s
  while foregrounded and ignore requests from a previous selection.
- Extend MobileApp navigation with a home view and a selected home project.
  Preserve the active conversation separately from the browsed list scope.
  Remember the last project without automatically reopening its conversation.
- Track conversation entry source separately in MobileApp memory. Project-page
  row and creation callbacks pass `project`; other entries default to `other`.
  Preserve source through loading, unavailable-session draft fallback and
  Settings navigation. Render the existing localized Back IconButton/ArrowLeft
  for project entries and call openHome with the current valid project, reusing
  navigation request invalidation. Keep persisted locations and Host APIs intact.
- Split MobileDrawer project headers into a page link and an animated disclosure
  control. Reuse the existing global creation and folder-picker flows.
- Extend drawer swipe support to the list page, and use existing theme tokens,
  provider icons, relative-time formatting, sorting and localization.
  Keep provider icons immediately before Home list titles, truncate only the
  title text and place unread markers after the trailing timestamps. Project
  idle rows omit empty secondary text; retain running status metadata.
- Update existing integration tests to enter conversations explicitly from Home;
  retain coverage of cache/network loading, notification read confirmation,
  command preparation and folder selection.
- Verify mobile layout with fixture histories at phone widths. Run affected
  tests, check:web, test:host, build and mobile:build. No Rust changes are needed.
- Use MobileHomeMenu with a center-aligned MobileSheet covering the plain Home
  title. Keep the menu mounted for shared useCollapseMotion closing behavior;
  exclude the title from glass styling and lens generation. Add connection
  opens the existing connection form anchored to the persistent title button.
  Shared overlapAnchor positioning aligns the menu top with the title and
  neighboring capsules, preserving safe insets and viewport clamping.
  Cap the menu at 180px and use shared constrainWidthToAnchor positioning to
  preserve the header's 8px gaps beside its side buttons when resized.
- Add the composer preference to MobileSettings using MobileSelect and the
  shared follow-up preference loader/saver. Keep selectors mounted through
  MobileSheet's closing motion. Include an optional followUpBehavior on send
  commands; Host acceptance reuses its persisted queue and steerQueued path,
  so retries retain the acceptance ID and failed steering keeps the message.
- Lift the list query into MobileApp and render MobileHeaderSearch in the
  header. Its capsule fills the space left of the trailing search/close button,
  with an 8px gap. Reuse useCollapseMotion for opening/closing lifetime, keep
  closing content inert and restore trigger focus; hide the leading button and
  plain title from interaction while searching. Clear search on view changes.
- Give selected projects a scoped header/list/dock layout. Move Host context
  beneath the leading project title, omit the redundant Recent heading, and
  put the Search trigger beside a compact accent Chat action at the bottom.
  Reuse the header search input and its motion, focus restoration, filtering
  and dismissal. Keep aggregate pages and all session-row indicators intact.

- Connect Home row holds to MobileSessionActions with the selected summary and
  project ID. Refresh Home histories after successful metadata changes without
  navigating. Retain the controlled MobileSheet through closing animation and
  preserve existing sidebar and chat actions.
- Share project activity ordering between MobileHome and MobileDrawer. Load
  all other project summaries on drawer open and every 3 s while foregrounded;
  reuse the app's current-project summaries and retain histories on failures.
  Preserve request generation guards and pause polling when hidden or closed.
  Automatically expand non-archived running projects unless manually collapsed.
  Let MobileListPreview reveal enough existing animated batches to keep expanded
  projects visible without changing time order or resetting pagination.
