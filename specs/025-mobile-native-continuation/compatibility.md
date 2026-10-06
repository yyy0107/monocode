# Compatibility record (2026-10-05)

## Baseline

Git HEAD: `3a8943e30d45d257bed165f7b5ebe21e244435d8`.
The workspace already contains uncommitted native-sync, shared Host,
orchestration, assistant, desktop and mobile work. The pre-existing native Host
guard and adapter strict-resume tests are the source baseline; their earlier
results are not evidence for this change.

Affected providers: Claude Code, Codex, Pi, omp and OpenCode. No CLI upgrade or
new transcript format is in scope. The target is guarded continuation through
the same paired Host from mobile.

## Environment and CLI versions

Observed during this implementation on Linux:

| Runtime/CLI | Version |
| --- | --- |
| Node | v24.16.0 |
| npm | 12.0.1 |
| Codex | codex-cli 0.160.0 |
| Claude Code | 2.1.289 |
| Pi | 1.0.3 |
| omp | 18.6.0 |
| OpenCode | 1.18.34 |

Version measurements do not prove actual provider continuation. Rust bootstrap
delegates to the changed Node preparation path; this feature changes no Rust
source and does not require check:rust.

## Executed checks

Automated validation is complete. Manual/device scenarios remain unverified:

| Check | Result |
| --- | --- |
| Initial affected web/mobile regressions | PASS: 41 tests |
| Final affected mobile app/client suites | PASS: 24 + 22 tests (46 total), included in the final full web run |
| Affected Host ownership/engine/import/upgrade regressions | PASS: 6 suites / 75 tests |
| Final native guard/engine regressions after async lease release and cleanup-test repairs | PASS: 42 tests |
| `npm run host:build` | PASS |
| `VITEST_MAX_FORKS=4 VITEST_MIN_FORKS=1 npm run check:web` | PASS: 489 files passed, 2 skipped; 5215 tests passed, 13 skipped (5228 total); subsequent TypeScript check and command exit 0 |
| `npm run test:host -- --pool=forks --maxWorkers=4 --minWorkers=1` | PASS: 39 files passed, 1 skipped; 277 tests passed, 5 skipped (282 total); exit 0 |
| `npm run build` | PASS; exit 0 |
| `npm run mobile:build` | PASS; exit 0 |
| `npm run check:rust` | Not required: no Rust changes in this feature |
| Spec/plan/contracts/tasks/documentation review | PASS: scoped implementation review, required artifacts and local Markdown links; scoped `git diff --check` |

## Initial full-run failures

These are recorded separately from the final passing reruns. Final results do
not erase the initial failures.

- First `npm run check:web`: 11 failed, 5199 passed, 13 skipped (5223 tests).
  `FilePaneNavigation` had 10 cold-import timeouts and
  `sessionStoreConcurrency` had one timeout. Another concurrent task corrected
  the existing FilePane test helper; this task did not edit it. The current
  focused FilePane suite passes 11/11, and the untouched Git HEAD suite also
  passes 11/11. The final full web check uses four forks and passes.
- First `npm run test:host`: 2 failed, 266 passed, 5 skipped (273 tests).
  One native lock failure exposed a real probe-release race: ending the lock
  child's stdin had returned before that child exited. Probes and turn cleanup
  now await release before publishing idle; a deterministic delayed-holder
  regression and the final native guard/engine and full Host checks pass. The
  other failure was an
  orchestration fixture's one-second worker-start deadline; the test now waits
  three seconds, with no orchestration product behavior change.
- First desktop and mobile builds failed typechecking because the existing
  shared `AgentTranscript` referenced an undefined `t`. Reusing its existing
  `uiT` translator corrects that reference. Both final builds pass. Existing
  bundle-size warnings are nonfatal.

## APK LAN publication (2026-10-05)

`npm run mobile:apk` completed successfully and published signed Android debug
build 56, version 0.7.0, package `com.monocode.mobile`, to
`http://192.168.0.206:3780/apk/monocode-56.apk`. The LAN service's latest manifest
points to this build. `npm run test:mobile-updates` passed all four tests.

The built APK, published manifest and HTTP download agree on size 8,706,140 bytes
and SHA-256 `540df4817de0c13d06a868fda5bfd217d69ca1d91612c013f5e91e2351288ed3`.
`apksigner verify` passed; the certificate matches the previously published
build 55. `aapt dump badging` confirmed package, version, min SDK 24 and target
SDK 36. APK assets include the native-access RPC and updated mobile notices.
`/health`, `/latest.json` and the full APK download were verified on the LAN
address. No physical-phone installation or real-provider continuation was
performed by this publication.

On the subsequent requested rebuild, `npm run mobile:apk` again passed and
published version 0.7.0 build 57 to
`http://192.168.0.206:3780/apk/monocode-57.apk`; `latest.json` points to build 57.
The APK and full LAN download match size 8,711,200 bytes and SHA-256
`3bfdb5f1bf0ac8088e08f0f4bad7239b6a6a92f93ca4dda23fa75c42133043d4`.
Signature verification passed with the same certificate as build 56, and
`aapt` confirmed the package and version metadata.

The user-requested Host/desktop restart and APK rebuild published version 0.7.0
build 58 to `http://192.168.0.206:3780/apk/monocode-58.apk`; `latest.json` points
to build 58. The APK and full LAN download match size 8,711,412 bytes and SHA-256
`acf2c04636d28ae8a9eb9e749be6e68358f8d8834083f65e1842ec44d7f2f70f`.
Signature verification passed with the same certificate as the previous builds.

The actual Host was rebuilt and restarted using the existing data directory.
Its authenticated lifecycle endpoint reports `nativeSessionAccess: 1`; the
existing desktop credential still succeeds for environment and project RPCs.
The database retains 1,189 sessions and two paired devices. A read-only Pi native
access RPC succeeds and conservatively reports `unknown/ambiguousProcess` for
the selected session; this does not establish that a real provider is writable.
The desktop closed through the normal window protocol and was rebuilt/restarted
in its existing Tauri development mode. Its new process and visible native
window were verified. These checks did not exercise a physical phone or a real
model continuation.

The next user-requested restart/publication on 2026-10-05 published version
0.7.0 build 59 to `http://192.168.0.206:3780/apk/monocode-59.apk`.
`npm run host:build` and `npm run mobile:apk` passed. The Host was initially
stopped and was started against its existing data directory; authenticated
lifecycle and environment RPC checks passed with the saved desktop credential.
Tauri development startup completed, its native window was visible, and its
frontend returned HTTP 200. The latest manifest, local APK and full LAN download
agree on size 8,717,400 bytes and SHA-256
`d8f4e58ad44063352a549bc6bdd49ef29134e80585be155b238d5d6bb0d0d961`.
`apksigner verify` passed with the same certificate as build 58, and `aapt`
confirmed the package and version metadata. No physical-phone installation or
real-provider continuation was performed for this publication.

After the reported mobile connection failure, the missing LAN forwarding was
restored at `http://192.168.0.206:3774` with the enabled user service
`monocode-host-lan.service`. It forwards only that LAN address to the existing
loopback Host and starts with the user session. An authenticated environment RPC
using the saved desktop credential returned HTTP 200 through the LAN address;
the same RPC without a credential returned HTTP 401. This verifies the LAN
listener and preserved authentication, not a physical-phone connection.

The later user-requested restart/publication on 2026-10-05 published version
0.7.0 build 61 to `http://192.168.0.206:3780/apk/monocode-61.apk`.
`npm run host:build` and `npm run mobile:apk` passed. The prior desktop closed
normally, the existing Host exited through its stop endpoint, and both restarted
against their existing data directories. Desktop resumed its existing
`tauri:stable` mode; its new native window was visible and its frontend returned
HTTP 200. LAN forwarding was started without re-enabling its previously disabled
login startup. The saved desktop credential succeeded through
`http://192.168.0.206:3774`; an unauthenticated RPC returned HTTP 401.
The latest manifest, local APK and full LAN download agree on size 8,741,260 bytes
and SHA-256 `03e8bacf43c08e7b6d3d58730dcc227dfadb96f850e18714ff75247f4c6c5ed7`.
`apksigner verify` passed with the previous signing certificate and `aapt`
confirmed package/version metadata. These checks do not establish a real-phone
installation or provider continuation.

The next requested restart/publication produced version 0.7.0 build 62 at
`http://192.168.0.206:3780/apk/monocode-62.apk`. `npm run host:build` and
`npm run mobile:apk` passed. The prior desktop exited normally; Host stop
completed after more than ten seconds and the old process was verified gone.
The new Host lifecycle and authenticated LAN RPC returned HTTP 200; requests
without credentials returned HTTP 401. The restarted `tauri:stable` desktop's
new native window was visible and its frontend returned HTTP 200. APK signature
verification and package/version inspection passed. Local and downloaded bytes
match the manifest's size 8,741,424 bytes and SHA-256
`88c9b15f33d0b5d3b42bca0dc58faae4434dc18593a80f5202aec69f30baa350`.
No physical-phone installation or provider continuation was exercised.

## Manual scenarios and limits

The following remain unverified until individually recorded:

- Real authenticated mobile follow-up in an imported Claude Code, Codex, Pi,
  omp and OpenCode conversation; strict preservation of the native ID and
  visibility when the original CLI is reopened.
- On-device mobile owner hints, composer block/unlock after external CLI exit,
  ownership acquired between the probe and send, and session/Host switching.
- Desktop-native synchronization during an actual Host provider turn, plus
  cancellation, approvals and questions from mobile.
- An idle legacy upgrade verified from the phone using its existing credential
  and history. Busy upgrade refusal against a running real
  conversation/orchestration.
- macOS/Windows ownership remains unsupported and imported history stays
  read-only; no execution compatibility is claimed there. Native iOS/Android
  installation and cross-architecture installers are not exercised by web
  builds.

External CLI transcript synchronization continues through the existing desktop
native watcher/polling path. This feature adds no independent Host watcher;
external writes made while no desktop synchronizer runs may not appear on the
phone until that synchronization resumes. The user's actual processes were
restarted in the subsequent explicitly requested publication step recorded above.
