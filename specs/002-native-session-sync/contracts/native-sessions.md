# Native session contract

`native_sessions_list` returns `{sessions, warnings}`. Each file has provider
(`codex`/`pi`), providerSessionId, absolute cwd/path, revision (`size:mtime_ns`)
and modifiedAt in milliseconds. `native_session_read({path, revision})` reads at
most 64 MiB and rejects snapshots whose revision changed before/during the read.
The canonical path must remain inside a configured native source root.

`NativeTranscript` contains createdAt, ordered blocks, optional model/title and
modelSettings. Parsers verify header identity. Stable source identities deduplicate
refreshes. Pi accepts v3 trees; malformed paths/cycles or JSON invalidate the
snapshot. Image content never appears as base64 transcript text.

`Session.nativeSession` optionally stores provider, providerSessionId, path,
revision, createdAt, updatedAt and blockIds. It persists only while linked to the
same current provider/ID. `session_list_native_ids` selects unarchived linked
sessions whose worktree has not been removed. Synchronization never discovers
new chats into the database automatically and never resurrects a deleted row.

Existing bindSession receives an optional source link only for a matching provider
and native ID. Codex strict resume does not fall back on a missing native thread.
Pi uses the exact native file path and verifies the state response ID. Idle
imported provider processes reopen between operations; running/steered processes
retain the normal turn lifecycle.

Synchronization commits a new snapshot only after user messages created locally
are visible on disk. It preserves user turn panels for matching ordered user
messages, the MonoCode title/runtime mode and other session metadata. A partially
written local answer or a divergent local turn defers sync with a visible error.
Only a successful persistence operation advances the stored revision.
