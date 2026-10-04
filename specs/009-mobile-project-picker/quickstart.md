# Verification record

Verified on Linux on 2026-10-04 with Node.js v24.16.0, npm 12.0.1, TypeScript
5.8.3, Vitest 3.2.7 and Vite 7.3.6. No provider CLI or paid model invocation was
needed for this UI change.

- Picker, connection settings and desktop remote-folder regressions: 15 tests
  passed in three files.
- Final picker and MobileApp entry-point regressions: 9 tests passed in two files.
  Covered home/parent/root navigation, filtering/empty folders, explicit manual
  paths, browse/open failures and retries, duplicate submissions, stale requests,
  cancellation/focus, live language switching and both empty-screen/drawer flows.
- Real Host mobile-client and directory-browser regressions: 10 tests passed in
  two files. A disposable directory outside registered projects was browsed without
  registration, then opened explicitly; opening the same path reused the project.
- Final npm run check:web: 444 files passed, two skipped; 4596 tests passed, 13
  skipped. TypeScript checking passed. Logs:
  /tmp/monocode-project-picker-check-web.log.
- npm run test:host: 27 files passed, one skipped; 177 tests passed, five skipped.
  Its Host build prerequisite passed. Logs:
  /tmp/monocode-project-picker-test-host.log.
- Final npm run build and npm run mobile:build passed. Both emitted the existing
  warning for large production chunks. Logs: /tmp/monocode-project-picker-build.log
  and /tmp/monocode-project-picker-mobile-build.log.
- git diff --check passed.

Chrome preview used the actual component and styles with disposable in-memory
folder responses at 390 × 844 (Chinese/dark) and 320 × 568 (English/light).
Verified directory navigation, filtering, selecting a project, scrolling long
folder names and keeping Open project visible. At 390 × 400, reproduced a clipped
footer and corrected it by scrolling the picker body independently of its footer;
the final button stayed inside the sheet and manual opening succeeded.

No Android/iOS device or emulator was exercised. Reduced-height browser preview
is not evidence of native keyboard behavior. Windows path strings with spaces and
Chinese names were exercised through fake folder responses; browsing a real Windows
Host remains unverified. The full suites' skipped provider/platform scenarios stay
unverified. Rust code was unchanged. No APK publication, push or merge was performed.

## Permission and symlink repair (2026-10-04)

The user's EACCES screenshot showed that clearing the directory response also
disabled parent navigation. New regressions reproduced this before the repair,
along with omitted directory links in both the Host browser and mobile RPC.
Parent navigation now has independent state, updates from requested/manual Host
paths and remains available during failed or pending reads. Host enumeration now
checks symlink targets while retaining the links' names, paths and parents.

Using the same tool versions above, verification passed:

- Picker, MobileApp flow and desktop remote-folder regressions: 20 tests across
  three files. Included leaving denied and pending reads, ignoring late failures,
  manual POSIX/Windows/UNC parents and disabling navigation above filesystem roots.
- Real Host browser and mobile-client regressions: 13 tests across two files.
  Exercised real Linux directory symlinks and links outside registered projects,
  relative directory links, file links, broken links, a loop, and actual EACCES from
  temporary directories made unreadable under the non-root test user. Confirmed
  that browsing retains link paths and opening registers their canonical targets.
- Final npm run check:web: 447 files passed, two skipped; 4666 tests passed, 13
  skipped, and TypeScript checking passed. Log:
  /tmp/monocode-picker-repair-check-web-final.log.
- npm run test:host: 27 files passed, one skipped; 180 tests passed, five skipped.
  The Host build prerequisite passed. Log:
  /tmp/monocode-picker-repair-test-host.log.
- npm run build and npm run mobile:build passed, with the existing large-chunk
  warnings. Logs: /tmp/monocode-picker-repair-build.log and
  /tmp/monocode-picker-repair-mobile-build.log. git diff --check passed.

The first full Web run reported six failures in the concurrently edited
MobileFileSheet.images.test.ts. This repair did not edit image-preview code.
Its latest standalone run passed all 16 tests, and the final full Web run above
passed. The initial run is preserved in /tmp/monocode-picker-repair-check-web.log.

Real Windows links/permissions and native Android/iOS behavior remain unverified;
the Linux permission/link scenarios above did run. No Rust changes were made by
this repair. To use both fixes on the phone, update the mobile app and run the
rebuilt Host, which owns folder enumeration. No running personal Host was stopped
or restarted, and no APK was published by this repair.
