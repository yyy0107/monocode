# Shared desktop and mobile conversations

Ordinary conversations in local desktop projects now belong to the same Host
used by the phone. The desktop automatically starts or reconnects the service
in `~/.monocode-host`, normally on `127.0.0.1:3774`. It receives a separate
device credential, stored only in the native desktop data directory. The phone
keeps its existing Host URL and credential; its reverse proxy or tunnel is still
needed because the Host listens on loopback.

Both clients use Host session IDs, revisions and command receipts. A message
sent on the desktop appears on the phone; a phone follow-up appears on the
desktop. Concurrent sends go through the same Host execution owner. Closing a
desktop pane or quitting the desktop leaves Host turns running. Connection
failure cannot silently create a second desktop-local conversation.

On first startup, the desktop imports ordinary legacy rows from its original
`monocode.db`. IDs, provider conversation/account bindings, model settings,
timestamps, titles, archive/pin state and attachment bytes are preserved. The
source database is read-only during import and remains available for recovery.
Import markers prevent duplication and prevent deleted conversations from
being imported again. Missing/oversized attachment files produce a startup
error so history is not silently lost. Restore the file and Retry to finish
that import. Existing Host conversations are never replaced by the importer.

The Host uses the existing native Codex/Claude account profile directories for
imported named accounts. An older Host is upgraded when idle; a running legacy
turn leaves it running and shows a retryable startup error. Wait for that turn
to finish and Retry. Phone credentials and Host history survive the upgrade.

Imported native Codex/Pi conversations also publish history to the shared Host.
Desktop preserves their original file ownership checks and native continuation
behavior. Mobile can read these imports, with a clear message to continue on
the desktop. Host does not start another provider against those native files.
Repeated synchronization reuses image copies. Desktop-native metadata changes
are reconciled with the shared history before native file refreshes.

Local project paths, file operations and terminals remain native. Shared history
is listed, searched and edited through the Host; SQLite continues to hold native
workspace layout and unrelated desktop data. Desktop releases include the pinned
Node runtime and Host bundle. Development startup builds the Host before Vite.
Restart the development desktop to pick up the new native bootstrap command.
Native worktree removal checks the Host's canonical conversation references and
holds a write reservation during removal. Delete the shared conversations that
refer to a worktree before removing that checkout; retained-history worktree
detachment has not been added to the Host command protocol.

The conversation command surface currently covers sends, configuration, drafts,
plans, attachments, approvals, questions, cancellation and compaction. Host
sessions retain the existing restrictions on `/operator`, orchestration,
handoff and BTW conversations; those native runtime
features need additional Host commands. Their parity is not claimed by this
change. Mobile push notifications and background polling remain unchanged.

Verification and unexercised environments are recorded in
[the implementation record](../specs/002-shared-sessions/quickstart.md).
