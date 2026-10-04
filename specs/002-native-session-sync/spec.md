# Codex and Pi native session import and synchronization

Date: 2026-10-04. Branch: `codex/codex-pi-session-sync`.
Status: implemented; final verification is recorded in quickstart.md.

Scope confirmed by the user: import local conversations, continuously synchronize
selected imports, and continue their original native sessions in MonoCode.

## User stories

1. In Settings → Providers → Native sessions, discover Codex and Pi history,
   filter by provider/project/session ID, and import an individual conversation.
   Reimporting the same native ID must reuse existing MonoCode history.
2. Imported conversations refresh manually or every 30 seconds and on focus.
   Only explicitly imported conversations are synchronized automatically.
   Running conversations, queued submissions and other session operations are
   skipped; deleted imports must not reappear. Unavailable sources and failed
   writes preserve saved history and show a recoverable error.
3. Open an imported conversation from settings or project history and continue
   the original provider session. Idle imported processes reopen before the next
   operation so externally appended messages participate in model context.
   Failed native resume must fail explicitly instead of starting a blank thread.

## Requirements and boundaries

- Discover active Codex rollout JSONL from `$CODEX_HOME/sessions`, falling back
  to `~/.codex/sessions`. Discover Pi v3 session JSONL from
  `$PI_CODING_AGENT_SESSION_DIR`, or `$PI_CODING_AGENT_DIR/sessions`, falling
  back to `~/.pi/agent/sessions`.
- Preserve text, reasoning, tool calls/results, provider ID, native model and
  thinking settings. Codex event/response duplicates are displayed once.
  Pi follows the current parent chain and applies context edits.
- Persist source path, revision and imported block identities. Preserve existing
  MonoCode metadata/user turn panels. Do not overwrite a local turn that has not
  reached the native file. Failed persistence can be retried.
- Preserve native history timestamps on imports; normal MonoCode submissions
  continue updating their activity time.
- Existing session rows and other providers retain their defaults. Pi/OMP shared
  code changes require regressions for both.
- Application labels are available in English and Simplified Chinese.
- Bound discovery to 5000 JSONL files, depth 4 and 64 MiB per transcript. Report
  unsupported/corrupt/unreadable files. Ignore only an unfinished final JSON line.
- Native images remain in the provider file and model context; imported history
  displays a visible placeholder. Rendering imported image pixels is deferred.
- This feature is local desktop functionality. Remote Host/native import, arbitrary
  Codex credential-home selection, archived native history, provider format
  migration, native tree editing, two-way file editing are outside this scope. Continuing through the native
  provider naturally writes subsequent MonoCode turns to that same native file.

## Acceptance evidence

See quickstart.md for actual versions, commands, outcomes and unverified scenarios.

## Running native session protection (requested follow-up)

- Imported sessions held by external Codex/Pi processes remain read-only while
  history continues synchronizing. Ambiguous ownership/probe failure stays read-only.
- Recheck native access immediately before provider sends, compaction or rewind.
  Use an OS advisory lease to serialize imported writes across MonoCode instances.
- Poll access separately from the optional history-sync preference. Release the
  UI guard only after the source snapshot is current and its process owner exited.
- Keep user drafts and normal MonoCode/other-provider behavior. Existing imported
  sessions start with unknown access until checked; access status is not persisted.
- Initial runtime support is Linux /proc. Other platforms report unknown access.
  An uncooperative native CLI does not honor MonoCode's advisory lease, so a CLI
  started after the final access check remains a documented external race. An idle
  external process still holding the session must be closed before takeover.

## Session ownership guidance (requested follow-up)

- Show localized, actionable guidance for confirmed Codex, Claude, OMP, fx,
  Hermes and Cursor ownership errors. Keep the original provider error unchanged
  in an expandable detail and keep the saved history readable.
- Distinguish a confirmed external owner from unavailable access, ordinary turn
  busy states, authentication failures and database transaction contention.
- Explain that finishing a reply does not necessarily release an open session;
  offer guidance to continue in the original client or close that session before
  retrying. Do not introduce force-unlock or process termination controls.
- Preserve provider bindings when fx/Hermes/Cursor resume reports ownership or
  unavailable coordination, rather than silently creating a new conversation.
- Reuse the shared transcript for desktop and mobile, including existing Host
  history without error tags. No native import support for new providers is added.
