# Verification record

Verified on Linux on 2026-10-04 with Node.js v24.16.0, npm 12.0.1, TypeScript
5.8.3, Vitest 3.2.7 and Vite 7.3.6. Native-provider subprocess tests used generated
Node fixtures through the production adapters; no paid model was contacted and
no actual provider CLI version is claimed by these tests.

- Existing desktop skills/catalog/prompt regressions: 48 tests passed in four
  files after the pure helper extraction; desktop module exports stayed compatible.
- Host discovery, queue and engine regressions: 69 tests passed in three files.
  Exercised project/personal precedence, fallback/folded metadata, symlink roots,
  Claude plugin scope and local/managed enable settings, bundled skill overrides,
  native aliases/hints, shared prompt instructions and live updates superseding
  an older discovery result.
- Mobile insertion, picker and existing composer regressions: 36 tests passed in
  three files. Covered caret/selection insertion, preserved surrounding text,
  native invocation strings, search, retry without draft loss, stale context
  responses, live localization, Tab selection and Escape dismissal.
- MobileApp skill/Plan/Compact flow: five tests passed. Confirmed original skill
  text reaches the Host journal, Plan prefixes become turn intent, standalone
  Plan enables the mode without an empty turn, Compact dispatches its command,
  and provider-prefixed escapes are not consumed as app commands.
- Real disposable Host/mobile RPC and production provider transport: 39 tests
  passed in two files. Confirmed metadata-only catalogs, original history/queue
  text, single execution after a lost create receipt, skill preparation for
  queued/steered turns, cancellation before provider startup, wrong-context
  rejection and both Pi/OMP catalog probes over real fake subprocess I/O.
- Final npm run check:web: 453 files passed, two skipped; 4714 tests passed,
  13 skipped, plus TypeScript checking passed. Log:
  /tmp/monocode-skills-check-web.log.
- npm run test:host: 28 files passed, one skipped; 193 tests passed, five skipped.
  Its Host build prerequisite passed. Log: /tmp/monocode-skills-test-host.log.
- npm run build and npm run mobile:build passed with the existing large-chunk
  warnings. Logs: /tmp/monocode-skills-build.log and
  /tmp/monocode-skills-mobile-build.log. git diff --check passed.

Chrome preview exercised the real composer/list components with disposable
catalogs at 390 × 844 (Chinese/dark) and 320 × 568 (English/light). Verified slash
suggestions, plus-menu search, selection returning focus and the caret, Native
command aliases/hints, Agent switching, preserved invocation strings and a
scrollable popup staying inside the small viewport. Temporary viewport override
was reset and the preview tab/server were closed after verification.

No Android/iOS device or emulator and no real paid-provider session was exercised.
Real Windows filesystem/plugin/native CLI behavior remains unverified; skipped
scenarios retain their skipped status. Rust code was unchanged. Desktop-local
disabled file-skill preferences are not a Host-shared setting; catalogs reflect
the Host skill directories and Claude plugin settings. This feature needs both
the updated mobile app and a Host advertising skills.list. No personal Host was
restarted and no APK publication, push or merge was performed by this task.
