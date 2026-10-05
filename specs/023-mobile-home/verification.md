# Verification

Verified for the mobile UI change on 2026-10-05 (user timezone).

## Runtime versions

Node v24.16.0; npm 12.0.1; TypeScript 5.8.3; Vite 7.3.6;
Vitest 3.2.7. Provider CLIs were not involved in this UI change.

## Executed checks

- Final affected Vitest suite: 9 files, 68 tests passed. Covers Home history,
  project ownership, search, retry, stale requests, disclosures, navigation,
  cached/fresh session loading, unread confirmation, commands and folder picker.
- `npm run check:web`: passed; 488 files passed, 2 skipped; 5161 tests passed,
  13 skipped; TypeScript completed successfully. An earlier run exposed old
  launch/tree expectations which were updated for the new requested behavior.
  FilePaneNavigation had 11 failures on that run, then all 11 passed in an
  isolated rerun and in the successful complete check.
- `npm run build`: passed. Existing bundle-size warnings remain.
- `npm run mobile:build`: passed, including a final build after UI refinements.
  Existing bundle-size warnings remain.
- `npm run test:host`: failed; 254 tests passed, 5 skipped, 3 failed. A focused
  rerun of the two failing files reproduced all three failures (36 passed).
  No Host/provider/Rust code was changed by this feature:
  - `host/desktop-import.test.ts`: continuation did not throw the expected
    CLI-ownership error.
  - `host/engine.test.ts`: two imported-native-session tests fail during setup
    with the existing events table's `(session_id, revision)` unique constraint.
- `git diff --check`: passed.

## Browser evidence and limits

Used the actual MobileApp with temporary fixture histories and no provider
commands. Checked 440 × 935 light and 320 × 740 dark layouts, with no horizontal
overflow. Verified Home startup, project filtering, opening a conversation,
All projects navigation, Chinese search input, removing per-project plus
buttons, hiding background interaction while the drawer is open, and returning
from Settings to All projects. Temporary preview code was removed afterward.

Physical Android/iOS execution, hardware Back behavior, APK installation and
publication were not run. No Rust changes were made by this feature, so
`check:rust` was not run for it. The workspace contained unrelated changes when
the task began; those were preserved.

## Home title menu follow-up

- Home uses a plain title dropdown with Add connection / Settings, rendered
  through MobileSheet's existing glass surface and action rows. Controlled
  open/close lifetime uses useCollapseMotion and respects reduced motion.
- Final affected suite after the width refinement: 4 files, 33 tests passed.
  Includes exact top alignment, width recalculation on resize, inert closing,
  rapid reversal, focus restoration, connection form reuse, translations,
  navigation and liquid-glass selector regressions.
- `npm run check:web` initially had one 5000ms timeout in
  sessionStoreConcurrency.test.ts (5214 passed, 13 skipped). All 5 tests in
  that file passed immediately in isolation. Before the final width refinement,
  the complete suite rerun with `npx vitest run --maxWorkers=4` passed:
  490 files passed, 2 skipped; 5218 tests passed, 13 skipped. A separate
  `npx tsc --noEmit` passed.
- Final `npm run mobile:build` after the width refinement passed, including
  both TypeScript checks. Existing CSS optimization and bundle-size warnings
  remain. An earlier build was blocked by an undefined `t` in unrelated
  AgentTranscript work; that code was corrected in the shared workspace
  independently, and subsequent builds passed.
- Browser measurements: at 320 × 740 the popup is 176px wide with 8px gaps
  to both header side buttons; at 440 × 935 it is capped at 180px. Popup and
  side buttons share the same 10px top edge. Neither layout has horizontal
  overflow. Preview: `/tmp/monocode-home-title-menu-narrow-320.png`.
  Temporary preview HTML and the feature's preview server were removed/stopped.
- `git diff --check` passed. Native device execution and publication remain
  unrun; Host/provider/Rust behavior was outside this follow-up.

## Mobile composer preference follow-up

- Added Settings → Message composer (编写器) → Follow-up behavior with Queue /
  Steer. Uses the existing shared preference storage/default and MobileSelect
  action popup. MobileSelect now retains inert content through shared closing
  motion. Subsequent sends carry an optional preference; commands without it
  retain the existing queue semantics. Host uses its existing durable queue
  and steering path rather than a second client-side dispatch.
- Affected Web suite: 4 files, 70 tests passed, including persisted selection,
  remount, live language changes, keyboard cancellation/focus, close animation,
  immediate send behavior and existing connection/command regressions.
- `npm run test:host`: passed (including host:build); 41 files passed, 1
  skipped; 304 tests passed, 5 skipped. Queue tests: 38 passed. New tests cover
  Pi/OMP steering with fixture providers, replay, preserving other queued work,
  unsupported/paused/edited fallback, idle sends, concurrent steering and
  provider rejection. These are fixture behavior checks, not live CLI runs.
- `npm run check:web`: failed only in Worktrees.test.ts; 493 files passed,
  2 skipped, 1 failed; 5232 tests passed, 13 skipped, 3 failed. Isolated rerun
  reproduced those 3 failures (31 passed). The SVG outerHTML assertions compare
  server-rendered inline-style text without spaces/semicolon against browser
  serialization with spaces/semicolon. Shared icon styling changed elsewhere
  in the workspace; this composer follow-up did not modify those icons/tests.
  The command did not reach its TypeScript step because of these failures.
- `npm run build` and `npm run mobile:build`: both passed, including their
  TypeScript checks. Existing CSS optimization and bundle-size warnings remain.
- Browser verified the actual Settings UI at 320 × 740 and 440 × 935 with no
  horizontal overflow. Chinese group/options fit; selecting Queue dismisses
  the popup and persists through reload. Preview:
  `/tmp/monocode-mobile-composer-settings-440.png`. Temporary preview HTML and
  the feature's preview server were removed/stopped after verification.
- `git diff --check` passed. No Rust/provider adapter changes or live model
  turns were made; native device execution, APK installation and publication
  remain unrun. Older Hosts that ignore the optional field retain queuing;
  automatic steering needs the updated Host implementation.

## Header search follow-up

- The trailing search button replaces the leading button and plain title
  with MobileHeaderSearch. It shares the header glass surface, automatically
  focuses its input and filters the current history scope. Closing clears the
  query, restores the list/trigger focus and keeps closing content inert using
  useCollapseMotion. Hidden leading controls are inert; reduced motion skips
  animation. Leaving Home also clears search state.
- Final affected suite: 5 files, 38 tests passed (MobileHome, activityUi,
  connectionSettings, followUpSettings and liquidGlassResize). New integration
  coverage includes Home/project/All projects filtering, scope preservation,
  conversation navigation, dismissal/reopening, rapid reversal, translations,
  focus restoration and reduced motion.
- Final `npm run mobile:build`: passed, including both TypeScript checks.
  Existing CSS highlight optimization and bundle-size warnings remain.
  This UI-only follow-up did not rerun Host, Rust or the full Web suite; the
  earlier full-suite outcomes above remain recorded separately.
- Browser verified the actual MobileApp with fixture Host histories at
  320 × 740 and 440 × 935. The capsule measures 232px / 352px wide and 48px
  high, shares the trailing button's 10px top edge and preserves an 8px gap.
  Neither viewport overflows horizontally. Input styling stays transparent
  inside the shared glass capsule. Chinese query filtering and Escape restore
  the complete list and focus. Screenshots:
  `/tmp/monocode-mobile-header-search-320.png`,
  `/tmp/monocode-mobile-header-search-440.png`.
- `git diff --check` passed. The temporary fixture and preview server were
  removed/stopped and the preview tab returned to about:blank. Device-native
  keyboard behavior and APK installation remain untested.

## Conversation row placement follow-up

- Home's pinned/recent rows now render the provider icon before the title,
  keeping the icon visible while the text truncates. Unread dots moved to
  the trailing edge after the relative timestamp, retaining the existing
  notification state and translated accessible name. Project idle rows omit
  empty metadata; project/running metadata remains visible where applicable.
  The drawer already used the requested icon/notification placement.
- Affected existing suite: 3 files, 41 tests passed (MobileHome, MobileDrawer
  and activityUi), including unread persistence, consumption and navigation.
  `npm run mobile:build` passed with both TypeScript checks; existing CSS
  highlight optimization and bundle-size warnings remain. `git diff --check`
  passed. Host/Rust and the full Web suite were not rerun for this layout edit.
- Browser fixture checks at 320 × 740 and 440 × 935 confirmed no horizontal
  overflow, 14px icons before titles, long-title truncation and unread dots
  after timestamps at the row's right edge. Project rows and the drawer also
  met the requested placement. Screenshots:
  `/tmp/monocode-session-rows-320.png`, `/tmp/monocode-session-rows-440.png`.
  Temporary preview files/server were removed/stopped and the preview tab
  returned to about:blank. Native device execution remains untested.

## Selected-project reference layout follow-up

- Selected project pages now place Back beside the project-title menu and
  Host connection status, use a flat list with larger single-line titles and
  trailing timestamps, and offer separate bottom Search / Chat capsules.
  The Chat action keeps the existing mobile accent; provider icons remain
  14px before titles and unread dots remain after timestamps. Running metadata
  and the shared pinned disclosure are retained. Aggregate pages keep their
  existing layout and search trigger.
- Final affected Vitest run: `npx vitest run src/mobile/MobileHome.test.ts
  src/mobile/activityUi.test.ts`; 2 files, 23 tests passed. Includes project
  scope, ownership, navigation, unread state, stale histories, pinned closing /
  reversal, bottom search, localization, dismissal and focus restoration.
- Browser checks used the actual MobileApp with temporary fixture histories
  at 390 × 844 light, 320 × 740 dark with long English project / Host names,
  and 440 × 935 light Chinese with 24px top / bottom safe insets. No horizontal
  overflow; idle rows measure 54px, provider icons remain 14px, and long titles
  truncate without clipping icons. Long Host names truncate while connection
  status remains fully visible. Verified scoped filtering, bottom-trigger
  focus restoration, reduced-motion search unmount, project-title menu and
  returning to aggregate Home. Standard closing lifetime and rapid reversal
  are covered by the affected tests; device-native keyboard / Back execution
  remains untested. Screenshots: `/tmp/monocode-project-layout-390.png`,
  `/tmp/monocode-project-layout-320-dark.png`,
  `/tmp/monocode-project-layout-440.png`.
- An initial `npm run mobile:build` passed. A later full build attempt was
  blocked by an unrelated temporary `src/mobile/composerStylePreview.tsx:25`
  fixture missing `ModelSetting.kind`. The fixture was preserved and removed
  independently during this work. Final `npx tsc --noEmit`,
  `npx tsc -p tsconfig.mobile-tools.json` and
  `npx vite build --config vite.mobile.config.ts` passed. Existing CSS highlight
  optimization and bundle-size warnings remain. Before the fixture's removal,
  a temporary repo-relative TypeScript config excluding only that fixture also
  passed; it was removed afterward. An earlier config placed outside the repo
  failed to resolve the workspace's ambient timer types and was discarded;
  the final full type check uses the original repository configuration.
- `git diff --check` passed. The full Web / Host / Rust suites were not rerun
  for this mobile layout change.
- Temporary browser fixture and preview servers were removed / stopped;
  the task's final preview tab was closed. No Host / provider / Rust changes,
  device installation or publication were performed for this layout request.

## Conversation long-press follow-up (2026-10-05)

- MobileHome (11), MobileDrawer (18), MobileSheet (8) and sessionLoading (25)
  tests passed: 62 tests across four files. The new integration fixture first
  failed because its one-use projects mock was overwritten by polling; after
  fixing the fixture, all 25 sessionLoading tests passed.
- Verified hold/release suppression, fresh taps, scroll/cancel/inactive cleanup,
  pinned and project keyboard/context actions, cross-project pin/archive, unread,
  immediate list refresh, failed update preservation, and inert closing motion.
- `npx tsc --noEmit --pretty false` and `git diff --check` passed.
  Browser rendering and native-device gestures were not verified in this turn.

## Isolated commit validation (2026-10-05)

- Extracted mobile Home/settings changes into a temporary index and checkout,
  leaving unrelated desktop, assistant, native continuation and composer work
  unstaged and unchanged. Included only the follow-up preference parser/queue
  changes required by the mobile setting.
- The extracted tree passed TypeScript checking and 103 focused mobile tests
  across 11 files, plus all 38 Host queue tests. A composer-specific test was
  excluded with its unrelated implementation; a missing protocol field found
  during extraction was included before the successful type check.
- The actual commit snapshot was checked independently of the mixed worktree.
