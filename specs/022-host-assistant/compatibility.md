# Host assistant verification

Implemented on 2026-10-05 against `main` at `7c1b588`, in the existing dirty
workspace. Existing orchestration, native sync, desktop shell and mobile changes
were preserved. This record distinguishes regression tests, real provider work
and browser fixtures. It does not claim native desktop or phone acceptance.

## Environment

| Component | Observed version |
| --- | --- |
| Node | v24.16.0 |
| OS | Linux 7.0.0-34-generic |
| Codex CLI | 0.160.0 |
| Claude Code | 2.1.289 |
| Pi | 1.0.3 |
| OMP | 18.6.0 |
| OpenCode | 1.18.34 |

## Actual Host and provider evidence

A disposable Host data directory and two temporary projects were used. No user
service was installed or replaced. The validation Host and isolated preview
browser have been stopped. Credentials remain outside repository artifacts.

- **Tested: Codex brain and target.** Catalog discovery, create, send, durable
  duplicate input/command handling and trusted target origin used the real
  `codex:gpt-6.1-sol` model and assistant control CLI. Exactly one long-running
  Codex target existed when reconnecting. A repeated original send returned its
  original message receipt after Host restart.
- **Tested: client disconnection.** The target wrote timestamps every 30 seconds
  for 610 seconds without any RPC/UI client connected, then wrote
  `HOST_ASSISTANT_OK`. Direct SQLite observation did not drive scheduling. The final reconnection record was taken 929 seconds after the original send, after an additional idle Host restart; 610 seconds is the independently confirmed disconnected job duration. The
  Host collected completion, the brain inspected it, and two distinct operation
  cards (create and send) converged to completed. Private brain/project records
  remained absent from ordinary listings. An idle Host restart retained history.
- **Tested: consecutive control turns.** The same Codex native brain handled
  subsequent catalog, cross-provider dispatch and configuration calls within
  five minutes. Old grants are revoked, idle child processes are refreshed and
  native history is rebound before injecting the next grant. Pi and OMP both
  exercise this through their production adapters with temporary RPC executables.
- **Tested: real interval and quiet check.** A one-minute schedule ran with no
  client, persisted its next deadline, called projects.list and completed once.
  Progress text plus the final quiet sentinel produced zero public messages.
  This exposed and verified the automatic-reply buffering repair.
- **Tested transport; execution unavailable: Claude.** The Codex brain created
  one Claude session and sent an ordinary trusted user turn. Sonnet returned a
  provider 429 credential cooldown. A deliberate retry configured that same
  session to Opus and returned a second 429. The assistant reported failure and
  did not retry further. File execution is **not** counted as passing.
- **Untested real models:** Pi, OMP, OpenCode, Cursor, Grok, FX, Hermes and
  Antigravity. CLI presence and model catalog discovery do not prove execution.
  Antigravity catalog discovery reported an error in the initial catalog probe.

Sanitized evidence: [validation/evidence.json](validation/evidence.json).

## Client and UI evidence

- Shared AssistantChat and settings were rendered in an isolated browser fixture
  at 1440×900 and 390×844. Both fit without horizontal overflow. Chinese labels,
  all 19 initial permissions and project scope controls were inspected.
- The fixture card opened its exact session ID. Actual Host/project/session
  validation and desktop/mobile integration identifiers have regression coverage.
- DOM tests cover public log filtering, repeated card revisions, stale settings
  and explicit reload, scoped card disabling, necessary input run/generation,
  default permissions, localization, two-way animated collapse, rapid reversal
  and reduced motion. Client tests cover outbox recovery, stable IDs, pagination
  and independent Hosts; navigation tests cover mismatched/deleted targets.
- Browser screenshots are **shared-component fixtures**, not native app or
  physical-phone acceptance: [desktop](validation/desktop.png),
  [mobile](validation/mobile.png).
- **Untested:** signed native desktop navigation, Android/iOS packaging and
  physical-phone reconnect, macOS/Windows Host services, all real-provider
  permission/approval/orchestration combinations and real Git publishing.

## Automated checks

The original implementation checks below predate the directory reorganization;
command paths are shown using their current `host/assistant/` locations.

| Command | Exit | Actual result |
| --- | --- | --- |
| `npm run test:host -- --maxWorkers=2` | 0 | 314 passed, 5 platform tests skipped; 42 files passed, 1 skipped |
| `npx vitest run --config host/vitest.config.ts host/assistant/index.test.ts` (final extra steer regression) | 0 | 21 passed; covers trusted live guidance in addition to the full run |
| Focused web client/UI/origin/queue/collapse run (six files) | 0 | 32 passed |
| `npm run check:web` | 1 | 5240 passed, 13 skipped, 3 Worktrees SVG assertions failed; trailing tsc did not run |
| `npm run build` | 0 | TypeScript and desktop Vite build passed |
| `npm run mobile:build` | 0 | TypeScript, mobile tools and mobile Vite build passed |
| `npm run host:build` (test prehook) | 0 | Host TypeScript and bundle passed |
| `git diff --check` | 0 | No whitespace errors |

The final bounded Host run avoided the earlier concurrent-process timeouts.
Desktop/mobile builds retain existing CSS `::highlight` and large-chunk warnings.
Rust checks were not run: this feature did not modify Rust. Native release builds
and signing are not covered by Vite builds.

The final assistant runtime suite includes persistence failure before card or
metadata acceptance, legacy database migration, crash recovery and unknown
outcomes, namespace/grant revocation, direct/queued provenance, native ownership,
stale target approvals, revoked queued sends, configuration races and provider
replacement. It also covers over 100 sources, causal limits, usage backoff,
partial-execution interruption, paused delegated queues and quiet automatic
progress. Existing Host suites continue to verify workspace, native locks and
orchestration owners.

## Known limits

Full Web checks have changed during concurrent workspace edits. The original
assistant delivery failed three Worktrees SVG serialization assertions, also
reproduced without assistant changes. Those assertions passed during the mobile
refinement. The latest full run has one failure in `mobileSkills.test.ts`, which
expects a skills menu dialog to unmount immediately despite its retained closing
animation. The same failure reproduces in the focused existing composer test;
that test and the shared composer/sheet implementation were not changed here.

The Claude adapter exposes the observed upstream 429 as assistant text and ends
its turn normally. Operation card status therefore reflects the existing Host
turn lifecycle; it is not proof that the requested business outcome succeeded.
The assistant inspected and accurately reported the provider error. This feature
does not change Claude's provider-specific parsing.

Platform action switches are Host API policy, not an operating-system sandbox.
External Git/file effects left uncertain by a crash require inspection rather
than replay. Native external-CLI discovery depends on existing synchronization;
this feature does not add a headless native-file watcher. Receipt/source retention
has no automatic pruning in this first version. No push, merge or publication
was performed.


## Directory reorganization

Moved all 14 Host assistant source/test files into `host/assistant/`, removed
the `assistant-` filename prefix and renamed the runtime entry to `index.ts`
with `index.test.ts`. Relative imports and active documentation references were
updated. Comparing against a pre-move snapshot confirmed that the moved files
have identical non-import contents.

Validation: `npm run test:host -- --maxWorkers=2` exited 0, including the Host
TypeScript/bundle prehook; 320 tests passed, 5 platform tests were skipped
(43 files passed, 1 skipped). `git diff --check` passed.


## Mobile layout refinement (2026-10-05)

Implemented the user-supplied Muse / Project Assistant style: centered assistant
mark and name, circular navigation, large rounded reply/user bubbles, inline
session cards and a bottom capsule composer. Mobile settings now use a separate
scrolling page, phone switches and a settings/lifecycle menu. State/RPC ownership
remains in the shared chat; desktop uses the default chrome. Native Back closes
the menu, returns from settings, then leaves the assistant. Closing surfaces
remain mounted and inert through shared motion; drafts, attachments and history
reading survive settings and polling. Input and attachment/send targets use
16px text and 44px controls.

Validation:

- Focused assistant/client/navigation, mobile sheet/focus and shared motion:
  **40 passed**, 7 files, exit 0; includes five phone interaction regressions.
  Log: `/tmp/monocode-assistant-mobile-focused.log`.
- `npm run test:host -- --maxWorkers=2`: **324 passed, 5 skipped**, 43 files
  passed and 1 skipped, exit 0; includes Host build prehook.
  Log: `/tmp/monocode-assistant-mobile-host.log`.
- `npm run mobile:build` and `npm run build`: both exit 0, including TypeScript.
  Existing highlight/chunk-size warnings remain. Logs:
  `/tmp/monocode-assistant-mobile-build.log`,
  `/tmp/monocode-assistant-mobile-desktop-build.log`.
- Latest `npm run check:web`: **5267 passed, 13 skipped, 1 failed**, 497 files
  passed, 2 skipped and 1 failed, exit 1. Failure is the existing composer
  `mobileSkills.test.ts` immediate-dialog-removal assertion; focused rerun also
  fails. An earlier full run's PaneTreeResize assertion passed on focused rerun
  and on this later full run. Logs:
  `/tmp/monocode-assistant-mobile-check-web-final.log`,
  `/tmp/monocode-assistant-mobile-skills-check.log`.
- Browser fixture QA in **Chrome/154.0.8037.97**: 320×640, 390×844, 430×932;
  light/dark, long unbroken paths, multiline capped at 168px, upload/remove,
  exact session-card navigation, settings/back focus, reduced motion and
  simulated native keyboard before/after resize. No horizontal overflow;
  keyboard 300px reduced the 844px overlay to 544px before and after resize.
  Screenshots and metrics: `validation/mobile-layout-*.png` and
  `validation/mobile-layout-metrics.json`.
- `git diff --check`: exit 0. No Rust changed in this refinement.

Builds initially encountered missing type fields in another temporary mobile
composer preview created during concurrent work. Concurrent changes supplied the skill
fields; this refinement added only the required `kind: "select"` model-setting
field to that existing preview without altering its behavior. The preview was
otherwise preserved. Product code does not import it.

These screenshots render real UI components with fixture RPC responses; they
are not native-device acceptance or a new real-model run. Android/iOS hardware
keyboard, system bars and physical-device Back remain unverified. Temporary
assistant preview files and the isolated preview server/browser were removed
or stopped after QA. No push, merge or publication was performed.

## Streaming assistant replies — 2026-10-05

User-triggered replies now project persisted text increments before completion.
Stable IDs and creation times keep one bubble in place. Finalization, cancellation,
failure and restart clear streaming while retaining partial text. Superseded partial
snapshots are compacted without resetting revision cursors. Desktop and mobile use
the same streaming Markdown and poll after 250ms while running (2s otherwise).
Automatic checks retain their existing buffered, quiet-unless-actionable behavior.

- Regression before implementation: two new streaming/cancellation tests failed as
  expected because partial replies were absent; the fragmented quiet-marker test passed.
- `npx vitest run --config host/vitest.config.ts host/assistant/index.test.ts host/assistant/store.test.ts`:
  **33 passed**, exit 0. Includes partial output, same-ID completion, cancellation,
  quiet-marker fragments, compacted cursor pagination and restart recovery.
- `npx vitest run src/features/assistant/ui/AssistantChat.test.ts src/features/assistant/model/assistantClient.test.ts src/mobile/MobileAssistant.test.ts`:
  **24 passed**, exit 0. Includes a running reply updated in place without scrolling
  a reader away from history, plus existing mobile and client behavior.
- `npx tsc --noEmit` and `npx tsc --noEmit -p host/tsconfig.json`: both exit 0.

No provider adapters or Rust changed. These are fixture/HostEngine and DOM tests;
no new real-provider CLI, native desktop/mobile or browser acceptance was run.
Full suites and production builds were not repeated for this focused change.

## Reply menus — 2026-10-05

Desktop assistant bubbles expose Reply on right-click or Shift+F10. Mobile
bubbles expose it after a stationary 450ms hold; movement, scrolling, release
and pointer cancellation cancel pending holds. Reply quotes the captured text
into the existing draft and focuses the composer without sending. MobileSheet
provides close animation and Back handling. Desktop menus render above the
assistant dialog using the shared layer constants.

- `npx vitest run src/features/assistant/ui/AssistantChat.test.ts src/mobile/MobileAssistant.test.ts`:
  **22 passed**, exit 0. The first run had 21 passed and one unrelated settings
  localization assertion failure during concurrent settings work; that assertion
  was updated in the shared workspace, and the subsequent full focused run passed.
- After adjusting desktop menu layering, `npx vitest run src/features/assistant/ui/AssistantChat.test.ts -t 'quotes a reply'`:
  **1 passed**, 12 skipped, exit 0; includes checking the rendered menu layer.
- `npx tsc --noEmit`: passed after initializing the new gesture timer ref with
  an explicit undefined value (the initial check reported that type error).
- `git diff --check`: exit 0.

No new real-provider, browser or physical-device acceptance was run. Host
protocol, outbox receipts and provider adapters are unchanged.

## Shared typewriter correction — 2026-10-05

The earlier streaming change passed `streaming` but omitted the transcript's
character reveal context and stable key. As a result, first batches appeared
immediately and later Chinese chunks used word pacing. AgentTranscript and
AssistantChat now share `useTranscriptRenderingPlatform` and the existing
`usePacedText` renderer. Loaded history stays visible; new replies (even already
completed batches) and appended chunks reveal by character. Bubble resize
observation follows growing output only while the reader remains at the bottom.

- Before the correction, all **6** new desktop/mobile pacing regressions failed,
  reproducing full first batches and Chinese text jumping ahead.
- `npx vitest run src/features/assistant/ui/AssistantChatPacing.test.ts src/features/sessions/ui/AgentTranscriptPacing.test.ts src/features/sessions/ui/wordFade.test.ts src/mobile/transcript.test.ts src/features/assistant/ui/AssistantChat.test.ts src/mobile/MobileAssistant.test.ts`:
  **49 passed**, 6 files, exit 0 after the correction.
- `npx tsc --noEmit`: exit 0. `git diff --check`: exit 0.

No new browser/native-device or real-provider session was run; these results
verify shared renderer behavior with controlled animation clocks and fixture RPC.

## Message receipts, timestamps and copy — 2026-10-05

Read receipts reflect the assistant starting to process a user's input, as
clarified by the user. New inputs start with readAt:null; claiming a user wakeup
records its first readAt in the same transaction. A waiting input remains unread,
and retry/recovery preserve both receipt and original send time. Missing legacy
fields remain unknown. Time, receipt and copy are outside the message bubble,
aligned with its side. Copy uses the shared transcript button and mobile platform
adapter; metadata is excluded from copied text.

- Host store/runtime focused run: **35 passed**, exit 0. Subsequent added runtime
  case `keeps queued user messages unread` passed separately (**1 passed**,
  24 skipped); together these cover 36 Host cases including transactional receipt
  failure, queued-to-running transition, retry and recovery.
- `npx vitest run src/features/assistant/ui/AssistantMessageMeta.test.ts src/features/assistant/ui/AssistantChat.test.ts src/mobile/MobileAssistant.test.ts src/features/assistant/ui/AssistantChatPacing.test.ts src/features/sessions/ui/AgentTranscript.copy.test.ts`:
  **40 passed**, 5 files, exit 0. Includes metadata outside bubbles, unchanged
  timestamps, shared copy behavior, Chinese labels and mocked native clipboard
  success/failure. Initial native tests required mocking Capacitor's proxy API
  before spying on it; the corrected test setup passes.
- Web and Host `tsc --noEmit` checks: exit 0. `git diff --check`: exit 0.

No physical-device, browser or real-provider session was run for this change.
No local viewer-read cursor is used, and no new public mutation RPC was added.

## Five-minute date separators — 2026-10-05

The shared desktop/mobile chat renders a centered date/time before its first
entry and before subsequent entries separated from the previous one by at least
300000ms. It uses stable createdAt values, retaining per-message footer times.

- AssistantChat, MobileAssistant and AssistantChatPacing focused tests:
  **30 passed**, 3 files, exit 0. Covers gaps just below five minutes, the exact
  threshold, continuously active conversations and unchanged separators after
  read-receipt revisions.
- `npx tsc --noEmit` and `git diff --check`: exit 0.
- No new browser or physical-device acceptance was run.

## Assistant sender nickname — 2026-10-05

Ordinary conversation bubbles show “From {nickname}” above the bubble, using
the name in assistant settings. Host stamps the optional assistantName origin
field and refreshes matching historical and queued origins on startup/name
changes. Desktop/mobile queue labels share the same localized wording.

- AgentTranscript.copy, turnOrigins and mobile/messageQueue: **27 passed**,
  3 files, exit 0. Covers the Chinese nickname label outside the bubble,
  unchanged copied text, trusted-origin retention and queue behavior.
- Host assistant index/control: **28 passed**, 2 files, exit 0. Covers nickname
  refresh in existing/queued messages while preserving unflushed live output,
  and no revision churn on the following unchanged tick.
- Web and Host `tsc --noEmit`: exit 0.
- No new browser, physical-device or real-provider acceptance was run.

## Desktop assistant workspace page — 2026-10-05

The desktop sidebar now opens/reuses a standalone Assistant workspace tab.
The existing app-view registry and workspace snapshot parser restore it. The
page retains mounted draft state across chat switches; hiding it closes its
reply portal. The former fixed overlay is removed. Desktop-only layout centers
the conversation and keeps a capsule composer at the bottom.

- Focused run of layout, workspaceSnapshot, AssistantChat, MobileAssistant and
  App.appViews: **186 passed, 4 failed**. Assistant registry round-trip and the
  new page navigation/draft/close case passed. Four existing app-view cases
  failed: native window controls, split-tool close, Search Escape and closing
  a chat with owned tools. A temporary copy with the assistant navigation
  changes removed reproduced all four failures; temporary files were deleted.
- Added hidden-page reply-menu regression plus page navigation rerun:
  **2 passed, 50 skipped**. No full-suite success is claimed.
- Chromium fixture preview used the real AssistantChat component and mocked
  Host RPC at 1308×1030 and 480×760. Checked centered header/content, rounded
  bubbles, bottom composer and no narrow horizontal overflow. This does not
  establish native desktop or real-provider compatibility.

- Final `npx tsc --noEmit` and `git diff --check`: exit 0. Preview fixtures and the temporary Vite server were removed after inspection.

## Mobile assistant settings fields — 2026-10-05

Single-line and multiline settings fields share rounded theme fills, padding
and a neutral focus border. The mobile blue outline and textarea resize grip
are removed. Textareas grow from 112px to 240px where field-sizing is supported,
then scroll internally; validation retains its red border.

- `npx vitest run src/features/assistant/ui/AssistantSettingsPersona.test.ts src/features/assistant/ui/AssistantSettingsReasoning.test.ts`:
  **6 passed**, 2 files, exit 0.
- Chromium preview used the real MobileAssistant/settings components with
  mocked Host RPC. At 320/390/430px, light/dark themes had no horizontal
  overflow, no focus outline and consistent field geometry. Checked both
  prompt fields, long-text growth/scrolling, shrink to minimum height,
  focused invalid-name red border, reduced-motion transitions and saving the
  edited personality with its original follow-up prompt.
- `git diff --check`: exit 0. Temporary preview files and its browser tab
  were removed after inspection; the existing development server was reused.
- No physical-device or older-WebView acceptance was run. No provider
  compatibility, full-suite or production-build result is claimed.

## Mobile settings bottom sheet and hidden scrollbar — 2026-10-05

Settings now reuse MobileSheet with its shared upward opening/downward closing
motion, grip dismissal, focus handling and back navigation. The scrolling form
hides both standard and WebKit scrollbar indicators. Its opaque outer sheet
avoids persistent filter/transform containing blocks so nested pickers position
against the viewport. Nested Escape and grip gestures affect the inner sheet.

- `npx vitest run src/mobile/MobileAssistant.test.ts src/mobile/MobileSheet.test.ts src/mobile/sheetDrag.test.ts`:
  **29 passed**, 3 files, exit 0. Covers retained drafts, mounted/inert closing,
  rapid reopening with unsaved edits, reduced motion, nested Escape, and mouse/
  touch drag isolation, along with existing picker/save/back behavior.
- `npx tsc --noEmit`: exit 0.
- Chromium preview with real MobileAssistant and mocked RPC checked 320/390px
  light/dark layouts, bottom placement, hidden standard/WebKit scrollbars with
  scrollable form content, native wheel scrolling, nested picker viewport
  placement, Escape returning to settings, upward opening keyframes and inert
  downward closing animation. No physical-device acceptance was run.
- `git diff --check`: exit 0. Temporary preview files and its browser tab
  were removed after inspection; the existing development server was reused.
