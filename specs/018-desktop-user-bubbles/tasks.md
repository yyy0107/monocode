# Tasks

- [x] T001 Read project rules, constitution and active feature records; capture scope.
- [x] T002 Align chat user bubbles with mobile dimensions, typography and theme colors.
- [x] T003 Place wrapping image thumbnails above text; hide empty image-only bubbles.
- [x] T004 Preserve draft/CI behavior, previews, copying, collapse, composer sizes and other layout behavior.
- [x] T005 Main agent: run affected regressions, web checks and production build; record evidence.
- [x] T006 Main agent: review narrow/wide and mobile rendering; record tested and unverified scenarios.

## Validation evidence — 2026-10-05

- Runtime: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`.
- Affected regressions passed: 7 files, 63 tests, including transcript image-only
  messages, pane width caps, attachment preview, copying, truncation, search,
  prompt motion and the mobile transcript.
- Replaced the obsolete single-line corner measurement regression with a pooled
  tab truncation regression: showing the same prompt at a narrower width exposes
  Show more; showing it at a wider width removes that control.
- `npx tsc --noEmit` passed. `npm run build` passed; Vite reports existing CSS
  optimizer and bundle-size advisories.
- `npm run check:web` completed its test phase: 465 files passed, 2 skipped;
  4833 tests passed, 13 skipped, 1 failed. The failure is in the independently
  modified `src/app/shell/SidebarRename.test.ts` assertion that a closed sidebar
  removes its aside. That same test fails when run alone (40 passed, 1 failed).
  This change does not edit Sidebar or that test. The full check therefore did
  not reach its bundled TypeScript step; TypeScript was checked separately.
- Browser verification used the real AgentTranscript and shared production CSS
  in a temporary fixture. Light/dark themes, user accent, wide/320px panes,
  multi-image wrapping, image-only messages, draft backgrounds, 11px CI details
  and document layout were checked. At 160px pane width, images shrink to about
  111px squares without overflowing. Image preview opens, Escape closes it and
  restores focus; long text expands successfully.
- Mobile shared rendering and CSS overrides were reviewed; its 6 transcript
  regressions passed. Native Tauri/mobile device visual checks were not run.
- `git diff --check` passed for this change. Temporary preview source was removed.
  Changes remain local and uncommitted. No Rust/provider/Host code changed.


## Full-layout follow-up — 2026-10-05

The screenshot reported by the user matched the untouched full-layout branch.
A read-only query confirmed `monocode.transcriptLayout = full` in both native
WebKit local-storage origins. The initial chat-only scope was incomplete.

- Both layouts now render compact right-aligned user bubbles and lift sent image
  previews above text. Chat retains its 36rem cap; full allows longer text up to
  the available row width. Other layout/animation choices are unchanged.
- Settings copy and zh-CN translation now describe those width differences.
- Existing bubble-width/image tests are parameterized for chat and full:
  2 files, 39 tests passed. The other affected suites passed: 9 files, 107 tests.
- Final `npm run check:web` passed: 466 files, 4843 tests; 2 files and 13 tests
  skipped. Its TypeScript step also passed. The earlier sidebar failure no
  longer occurs in the current checkout.
- Browser verification explicitly used full: short “你好”/“你是谁” messages
  measured 56px/71px and aligned to the right; long text could exceed 36rem;
  image previews appeared above captions, opened in the lightbox, and closed
  with Escape. At 320px pane width, multiple images wrapped without overflow.
- Native layout preferences were left intact. The browser preview uses the
  real shared component/styles; the native application itself was not inspected.
- Final `npm run build` and scoped `git diff --check` passed; existing CSS
  optimizer and bundle-size advisories remain. Temporary preview sources removed.
