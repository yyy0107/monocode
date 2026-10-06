# Tasks

- [x] T001 Reuse pure desktop skill contracts and implement Host discovery/catalog RPC with regressions.
- [x] T002 Apply skill prompts and native command escapes to Host send, queue and steer, preserving history/retry/cancellation.
- [x] T003 Add mobile skill sheet, slash completion, caret/focus behavior, context isolation and localized labels.
- [x] T004 Connect mobile Plan/Compact and the existing send/journal flow; verify real Host and Pi/OMP subprocess paths.
- [x] T005 Run affected and complete checks/builds, inspect phone layouts and record actual results and limits.

Executed evidence and unverified native/provider scenarios are recorded in quickstart.md.

## Compact list follow-up — 2026-10-05

- [x] Reduce mobile skill typography, icon size and spacing; keep command names
  on one line, size origins to content and preserve 44px minimum touch targets.
- [x] Run existing skill selection checks and inspect narrow phone layouts.

Validation: `LANG=en_US.UTF-8 node node_modules/vitest/vitest.mjs run
src/mobile/mobileSkills.test.ts` passed all 6 tests (Vitest 3.2.7).
Chrome 154.0.8037.97 rendered the actual MobileComposer and production styles with
local catalog props at 390×844 dark and 320×740 light. Common `/speckit-*` rows
changed from 87px with wrapped names to 47.5px with single-line names; long names
truncate and both lists fit horizontally. Search text remains 16px and native
argument hints remain visible. Clicking a skill inserted its command and retained
textarea focus; typing `/speckit-` opened the compact inline suggestions (14px
names, 47.5px rows) with no horizontal list overflow. `git diff --check` passed for
the changed files. No physical device or Host/provider session was exercised.

- [x] Shorten origin labels to Project / Personal (项目 / 个人) in the shared
  mobile list and verify both the plus menu and typed `/` suggestions.

Follow-up validation: the same 6 mobile skills tests passed after the label
change. Chrome 154.0.8037.97 at 320×740 rendered both actual composer entry points
with 项目 / 个人 origins, 14px command names, 47.5px rows and no horizontal list
overflow. The inline `/plan` origin remains MonoCode. Existing localization keys
were reused; physical-device validation remains unrun. Scoped diff checks passed.
