# Verification evidence

Executed on 2026-10-04 in the user's existing working checkout. Unrelated local
changes remain intact; no provider or Rust implementation was changed.

Tool versions: Node v24.16.0, npm 12.0.1, TypeScript 5.8.3, Vite 7.3.6,
Vitest 3.2.7. No provider CLI calls were needed for this file-preview change.

The initial image regression run had six expected failures covering AVIF,
extensionless images, mismatched MIME, the old 4 MiB limit, mislabeled text and
browser decode errors. After implementation:

- Affected web tests: 8 files, 67 tests passed, including 16 image cases.
- Real MobileClient/Host integration: 11 tests passed. The new case reads a
  temporary PNG outside registered projects, verifies exact bytes for a 5 MiB
  response, keeps project registration unchanged, and rejects directory,
  relative, oversized and revoked-credential requests.
- The first large-byte assertion exceeded Vitest's default timeout because a
  multi-million-element deep comparison was slow. Using Buffer.equals for the
  same complete byte comparison brought the integration case to 367 ms.
- `npm run check:web`: passed; 447 files / 4,666 tests passed, 2 files / 13
  tests skipped, TypeScript completed successfully.
- `npm run test:host`: passed, including host build; 27 files / 181 tests
  passed, 1 file / 5 tests skipped.
- `npm run build`: passed.
- `npm run mobile:build`: passed.
- Both builds report the existing large-chunk warnings.
- `git diff --check`: passed.

A local browser fixture used the real MobileTranscript, MobileFileSheet and
mobile styles. At a 390 × 844 viewport, clicking the Read tool's temporary image
chip opened the localized bottom sheet. The supplied reference image decoded at
1080 × 2376 and displayed at 230.18 × 506.4 within the panel. Screenshot saved to
`/tmp/monocode-mobile-image-preview.png`; temporary fixture files, tab and dev
server were removed after verification, and the viewport override was reset.

Limits: format cases verify MIME routing in the DOM; the browser fixture verifies
real image decoding/layout for the supplied image. Native Android/iOS image
decoder coverage and installed-device deployment were not run. The existing
running Host was not restarted or updated. A phone connected to an older Host
that rejects project-external reads needs a matching Host update to open `/tmp`
files. `check:rust` was not run because no Rust changed.
