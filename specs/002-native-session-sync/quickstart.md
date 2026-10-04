# Native session import: usage and verification

Implementation date: 2026-10-04.
Branch: `codex/codex-pi-session-sync`.
Base: local main `6b42c95`.
Worktree: `/home/wy/.codex-accountB/worktrees/codex-pi-session-sync/monocode`.

## Use

1. Launch the desktop app from this worktree using the usual project setup.
2. Open Settings → Providers → Native sessions (设置 → 提供商 → 原生会话).
3. Filter/search, then choose Import / refresh for the desired Codex or Pi chat.
4. Use Open, or open the conversation from its project history, to continue it.
5. Automatic synchronization is enabled initially: imported sessions refresh
   every 30 seconds and on window focus. Disable the checkbox for manual refresh.

Sources use the desktop process's CODEX_HOME/Pi session environment settings and
ordinary home-directory defaults. Only explicitly imported sessions are tracked.
Imported Codex history uses the default credential home; choosing an unrelated
named account is a separate provider change. Reimport matches native provider IDs
across MonoCode project/worktree grouping and reuses the existing conversation.

Pi imports follow the current branch. The UI preserves text, reasoning and tool
results; images stay in the native transcript and appear as placeholders in the
imported history. Native files are never rewritten by the importer. Subsequent
provider turns naturally append to the original native session.

Local submissions absent from the native file defer synchronization. Running or
queued MonoCode conversations and concurrent session operations are skipped.
Unreadable, changed or corrupt source snapshots and failed database writes retain
previous history. Missing imported source sessions fail resume explicitly.

## Actual environment

- Node `v24.16.0`; npm `12.0.1`.
- Codex `codex-cli 0.160.0`.
- Pi `1.0.2` (not the earlier feature's 1.0.1 installation).
- OMP executable unavailable on PATH; shared OMP behavior was exercised with the
  existing protocol/Host fixtures, not an actual OMP installation.
- Existing local dependency installation reused in this worktree.

## Verification

| Check | Final result |
| --- | --- |
| `npm run check:web` | PASS — 408 test files, 4298 tests; 13 skipped; TypeScript check passed |
| `npm run test:host` | PASS — 20 test files, 107 tests; 5 skipped; Host build passed |
| `npm run build` | PASS — TypeScript + Vite production build (existing CSS/chunk-size warnings) |
| `npm run check:rust` | PASS — formatter, workspace Clippy with warnings denied, 507 tests; 1 ignored |
| `node scripts/native-session-smoke.mjs` | PASS — actual Codex 0.160.0 native-ID resume/read and Pi 1.0.2 exact-file resume/read |
| `git diff --check` | PASS |

Skipped suites are existing real-provider/soak/platform scenarios; they are not
counted as passing compatibility evidence.

The isolated CLI smoke is reproducible with:

```sh
node scripts/native-session-smoke.mjs
```

It creates temporary fixture history/config directories, resumes each actual CLI,
checks the original ID and user/assistant history using Pi get_state/get_messages
and Codex thread/resume/thread/read, then removes the temporary files. It does not
submit a model prompt or modify existing user history.

Automated regressions cover provider identity, Codex duplicate events, unfinished
versus corrupt JSON lines, Pi tree branches/context edits/tools/image placeholders,
repeat import, existing session reuse, original credential profile, synchronization
of appended history, running/deleted sessions, unmirrored local turns, failed
persistence/retry, English/Chinese controls, strict missing-session resume and
reloading imported context between idle operations. Ordinary Pi/OMP resume behavior
and Host provider transport remain covered by the existing suites.

The Rust formatter also corrected existing menu.rs line wrapping to satisfy the
required workspace formatting gate; no menu behavior changed.

## Limits

Actual paid-model turns, native desktop GUI interaction and other operating
systems were not exercised. Controlled external processes and real Linux file
leases were exercised; simultaneous paid-model runs in two CLIs were not.
The CLI smoke establishes resume/history protocol evidence, not paid-model or GUI
compatibility. Remote Host import, archived Codex session discovery, arbitrary
credential-home selection, Pi v2 migration, imported image rendering and native tree
editing are outside this feature. Existing remote/provider suites remain passing.

## Running-session protection follow-up (2026-10-04)

The current Linux build treats imported history as read-only while a recognized
external CLI owns the native file, or ownership is ambiguous. The composer shows
a localized explanation and retains its draft. History still refreshes. Close the
external CLI to release ownership; the app saves the latest source snapshot before
restoring Send. A CLI left open but apparently idle is still treated conservatively
because the history file cannot prove retries/follow-ups have settled.

Access checks run every five seconds even if optional history synchronization is
disabled. Normal history still uses the 30-second setting; access release and
externally held history require synchronization for takeover. Another MonoCode
window's active lease also blocks writes. Send, compact, rewind and steering get
a backend ownership recheck; the UI status alone cannot authorize a mutation.

The follow-up required checks all passed: check:web (4298 tests plus TypeScript),
test:host (107 tests plus Host build), build, and check:rust (formatter, strict
Clippy and 507 tests). Existing skipped/ignored cases remain as listed above.
Codex 0.160.0 and Pi 1.0.2 isolated resume/history smoke was rerun and passed.
Additional regressions exercise external owner detection/release, ambiguous TUI
processes, explicit other sessions, managed wrapper descendants, real advisory
lease contention/drop, access failure, stale UI, refresh-before-unlock, unchanged
file revisions during a live owner, steering checks and draft preservation.

Limits: initial ownership observation is Linux and same-user standard CLI/Pi
launcher patterns. Other platforms fail closed; renamed/opaque launchers are
unverified. The lease serializes cooperating MonoCode instances sharing an
app-data directory, not arbitrary native CLIs. An external CLI started after the
final check remains a race requiring native cooperation. A renderer lost during a
mutation can leave its in-process lease until the app exits; reopening the app
releases that lease. No existing external CLI is killed or interrupted by probing.
