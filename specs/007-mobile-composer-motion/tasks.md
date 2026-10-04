# Tasks

- [x] Keep composer controls and attachments mounted through their transitions.
- [x] Stabilize textarea measurement and delay compact wrapping until collapse ends.
- [x] Add mobile prompt entrance timing, origin, completed-send and cleanup handling.
- [x] Run affected tests, web checks and production/mobile builds.
- [x] Inspect browser motion and record verification limits.
- [x] Shorten the collapsed capsule and animate width smoothly in both directions.

## Validation evidence — 2026-10-04

- Tool versions: Node v24.16.0, npm 12.0.1, TypeScript 5.8.3,
  Vite 7.3.6, Vitest 3.2.7. No provider CLI or adapter changes.
- Affected composer, mobile transcript, prompt rise, first paint, scrolling and
  liquid-glass regressions: 48 passed across seven files.
- `npm run check:web`: passed; 4,573 tests passed, 13 skipped; 441 passing
  files, two skipped files; TypeScript check passed. After the final restriction
  preserving default desktop mount behavior, prompt-rise and mobile transcript
  tests passed again (15 tests, including the new desktop compatibility case).
- `npm run build` and `npm run mobile:build`: passed on the final source.
  Existing large-chunk warnings remain. `git diff --check` passed.
- Inspected the real MobileComposer/MobileTranscript components with liquid
  glass in a 390×844 browser fixture, using local message data. Multiline drafts
  and attachments expand/collapse continuously; the draft stays intact and the
  single-line preview settles only after collapse. Sending a long draft shrinks
  composer height from 242.6px to 107.6px without reversals or an attachment
  height snap; its glass map is encoded once, instead of at each resize frame.
  Consecutive short sends and the following collapse were also exercised.
- Screenshot and frame samples are saved under the current chat's visualization
  directory as `mobile-composer-motion.png` and `mobile-composer-motion.json`.
  The latter records the final consecutive-send and collapse scenario.
- Native Android/iOS keyboard coordination, physical-device frame rates and
  real-provider/network sends remain unverified. No Rust or Host code changed;
  Rust/Host checks were not run for this UI change. No push or publication.

## Collapsed-width follow-up — 2026-10-04

- Collapsed width is calc(100% - 32px), centered; expanded width stays at 100%.
  Both width directions share the existing 280ms height/padding easing.
- Measure final expanded textarea width from the fixed dock, excluding padding
  and form borders, so form width animation does not repeatedly retarget height.
- Composer and glass-resize tests: 21 passed. `npm run mobile:build` passed,
  including TypeScript checking; existing chunk warnings remain.
- Browser frame samples confirmed 326.4px → 358.4px during expansion and
  358.4px → 326.4px during collapse, with intermediate widths, no reversals and
  less than 0.01px center drift. Draft and attachment state were preserved.
- Follow-up screenshot and frame samples: `mobile-composer-width.png` and
  `mobile-composer-width.json` in the current chat's visualization directory.

## Short-draft expand/collapse follow-up — 2026-10-04

- Cause: collapsed content (6px + 28px + 6px + border = 42px) was below the
  54px min-height. Collapse hit the clamp at ~80ms and the height stopped dead
  while width and text slid for another ~160ms. Expansion stalled briefly at
  the clamp, then jumped (65% done by 60ms).
- Collapsed vertical padding now centres the field on the controls (12px), so
  content equals min-height and height interpolates without clamping.
- Expand: 320ms cubic-bezier(0.32, 0.72, 0, 1). Collapse: 300ms
  cubic-bezier(0.4, 0, 0.2, 1), set on the collapsed state so children inherit.
- Paused-transition samples in a 390×844 fixture: height, width and text
  position change monotonically in both directions and settle together
  (54 ↔ 107.6px, 326.4 ↔ 358.4px). Collapsed field position is unchanged.
- Composer, glass-resize and queue tests: 38 passed; `tsc --noEmit` passed.
  Not run on a physical device.

## Keyboard-open stall follow-up — 2026-10-04

- Report: tapping the collapsed composer stalls briefly while the keyboard opens.
- Likely causes (inferred from code; not profiled on a device):
  1. The Android WebView resize can freeze the page longer than the 80ms glass
     settle delay, so the displacement-map encode could run mid-expansion.
     The settle now waits until the composer's subtree has no running
     transitions.
  2. With the keyboard visible, MainActivity sets the bottom safe area to 0 in
     one step. The dock now animates padding-bottom with the composer.
- Slower expansion: 420ms cubic-bezier(0.25, 0.8, 0.25, 1); controls fade in
  over 220ms after 60ms. Collapse is unchanged (300ms).
- Composer, liquid-glass and queue tests: 44 passed, including the new
  deferred-rasterization case; `tsc --noEmit` passed. Not checked on a device.

## Keyboard-synchronised expansion follow-up — 2026-10-04

- Report: expanding the short composer still stutters; it must match the
  keyboard's speed and move together with it.
- Cause: the WebView resized in one step at an arbitrary point of the IME
  animation while the composer ran its own 420ms curve, started at focus
  rather than when the keyboard began to move.
- MainActivity now registers a WindowInsetsAnimationCompat callback (replacing
  the unused Keyboard plugin callback on the decor view). At animation start it
  sends `monocode:keyboard` with target height, full viewport, duration and
  the interpolator sampled as CSS `linear()`, together with the safe area.
  A rising keyboard resizes the WebView at the end; a lowering one resizes
  after the page has handled the event.
- `keyboardMotion.ts` publishes the target; mobile.css animates a registered,
  non-inherited `--mobile-keyboard` on the dock, sheet/modal backdrops and the
  transcript (scaled by how far a pinned transcript will scroll), offset by the
  part already reflected in layout. The composer's shape change waits for the
  keyboard's start (400ms open / 250ms close fallback) and uses its timing.
- Tests: `src/mobile` 208 passed (new keyboard follow and composer timing
  cases); `tsc --noEmit`, `npm run mobile:build` and
  `:app:compileDebugJavaWithJavac` passed. Headless Chrome fixture confirmed
  the offset follows the supplied curve and returns to 0 once layout includes
  the keyboard. Not run on a physical Android device; iOS unchanged.
