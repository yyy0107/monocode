# Verification and timing evidence

Date: 2026-10-04. Baseline: `684e975d79d065ec50e2def924d229f9ad7f93a4`.
Keep the active native-title record and unrelated mobile skills/composer work.

## Result

Project selection immediately shows a new conversation. Restoring a remembered
conversation starts its text sync alongside history/branch lookup. Provider model
discovery and visible-conversation image hydration run independently. Reopening
one of the eight cached sessions displays its snapshot in the navigation update;
commands and unread acknowledgement wait for a confirmed current revision.

Session reads share one in-flight request per ID. Reads after a command receipt
require at least its revision. Cached image bytes merge into current blocks,
without replacing newer metadata or deleted content. Host changes, identity
mismatches, disconnect and deletion invalidate late cache writes. Model catalogs
use an eight-project, one-minute cache; failed catalogs remain retryable.

## Measurements

Use a disposable real HTTP/SQLite Host with two synthetic 1000-block
conversations. One serialized snapshot is 368,452 bytes. No personal projects,
native provider CLIs or paid inference are used.

| Scenario | Measured result | Scope |
| --- | --- | --- |
| Fresh text synchronization, 20 samples | Median 3.83 ms; p95 5.16 ms | Local loopback HTTP, JSON transfer/parse and client sync; excludes connection setup/rendering |
| Cached snapshot lookup, 1000 samples | Median 0.000304 ms; p95 0.000374 ms | Node in-memory lookup only, not UI latency |
| 500 ms simulated image delay, baseline | Text returned in 505.59 ms | Same real Host, artificial delay applied only to attachment transport |
| Same image delay, optimized client | Text returned in 3.35 ms | Image hydration no longer blocks text |
| Browser first conversation render | A: 99.3 ms; B: 79.2 ms | Navigation handler to first transcript DOM/layout commit |
| Browser cached conversation switch | 15.2, 12.4, 11.6, 10.8, 11.0 ms | Five semantic button activations in a minified production React build |
| Browser cached switch by pointer | 19.7 ms | Same navigation handler and DOM/layout boundary |

Browser measurements used Chrome with a 390 px wide phone viewport and the
actual shared transcript renderer. The isolated build enables only the existing
development browser transport, with a same-origin proxy restricted to the
disposable Host. Production native transport, authentication and Host origin
checks are unchanged. Freeze the test build to avoid concurrent HMR resetting
caches. Local performance measures are named `monocode.mobile.session.cached`
and `monocode.mobile.session.network`; root DOM diagnostics include the explicit
`commit` stage. Earlier frame-callback measurements were discarded because
background scheduling/HMR contaminated that boundary.

These figures exclude app launch, credential/Host verification, later image or
syntax decoding and physical screen paint. Android/iOS WebView, the user's
phone, cellular/VPN/Wi-Fi latency and cold transfer of much larger transcripts
remain unmeasured. Caches are in memory and do not survive an app restart.

```sh
node scripts/mobile-loading-benchmark.mjs --baseline=684e975d79d065ec50e2def924d229f9ad7f93a4
# Build and serve an isolated minified browser fixture; stop with Ctrl+C.
node scripts/mobile-loading-benchmark.mjs --baseline=684e975d79d065ec50e2def924d229f9ad7f93a4 --serve
```

## Checks

Actual tool versions: Node `v24.16.0`, npm `12.0.1`, TypeScript `5.8.3`,
Vite `7.3.6`, Vitest `3.2.7`, esbuild `0.28.2`.

Targeted regressions cover unresolved image downloads, concurrent sync, receipt
revisions, late image merges, cache invalidation/eviction/expiry, failed model
discovery, slow history, archived/deleted restoration, immediate cached text,
confirmation gating and navigation races. Existing mobile notification,
project-picker, retry/journal and desktop preview consumers are exercised too.

- `npm run test:host`: passed, 193 tests; 5 skipped.
- `npm run build`: passed.
- `npm run mobile:build`: passed.
- `npm run check:web`: passed, 4,716 tests; 13 skipped; TypeScript check passed.
- `git diff --check`: passed.

The initial aggregate check had one skill-completion test failure; its standalone
rerun and subsequent aggregate run passed. After separating drawer and chat
loading, two loading-test assertions initially matched the hidden drawer spinner;
they now check only the conversation pane, and the targeted rerun passed.
The final aggregate run passed all 4,716 executed tests.

Builds retain existing large-chunk/CSS optimization warnings. Real-model
Antigravity suites and platform-specific Host scenarios remain skipped according
to the suites' existing conditions. Rust files were unchanged; `check:rust` was
not run. No APK publication, personal Host restart, push or merge was performed;
phone use requires a later APK build/install containing these web changes.
