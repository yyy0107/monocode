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
| `npm run check:web` | PASS — 407 test files, 4291 tests; 13 skipped; TypeScript check passed |
| `npm run test:host` | PASS — 20 test files, 107 tests; 5 skipped; Host build passed |
| `npm run build` | PASS — TypeScript + Vite production build (existing CSS/chunk-size warnings) |
| `npm run check:rust` | PASS — formatter, workspace Clippy with warnings denied, 503 tests; 1 ignored |
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

Actual paid-model turns, native desktop GUI interaction, other operating systems,
and simultaneous model runs by MonoCode and an external CLI were not exercised.
The CLI smoke establishes resume/history protocol evidence, not paid-model or GUI
compatibility. Remote Host import, archived Codex session discovery, arbitrary
credential-home selection, Pi v2 migration, imported image rendering and native tree
editing are outside this feature. Existing remote/provider suites remain passing.
