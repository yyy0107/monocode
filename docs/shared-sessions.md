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

Imported native Claude Code, Codex, Pi, omp and OpenCode conversations also
publish history to the shared Host. Mobile can continue the same native
conversation through a capable paired Linux Host after it verifies that no
external CLI or other MonoCode writer owns it. Host and desktop share the native
lock, and resume retains the original provider ID, path, project and account
binding. Unverified ownership and unsupported Host platforms keep imported
history read-only; older Hosts show an upgrade notice. Rebuild and restart the
development desktop to upgrade an idle older Host, or finish its running turns
before retrying. Repeated synchronization reuses image copies. Desktop-native
metadata changes are reconciled before native file refreshes, and a running Host
turn is preserved during those refreshes. Provider and phone continuation must be verified with the matching Host and
client versions.

The Host now owns native conversations in its projects.
It lists provider sources and imports them itself. It runs every turn of an
imported conversation, and it watches and merges external CLI writes even when
the desktop is closed. Before a turn, the Host takes the writer lock, rechecks
ownership and catches up history. After the turn (success, failure,
cancellation or compaction), it stops the provider, waits for the final write,
merges the native records into its own turn, and only then releases the lock
and sends queued messages. Sync failures keep the streamed output and retry
automatically; messages sent meanwhile wait in the queue. Background auto-sync
is a Host setting; turn preparation and settlement always synchronize. The
Settings → Import panel reads the managed count, last sync and that setting
from the Host listing, and "Sync now" re-reads every managed conversation on
the Host (`nativeSources.syncAll`).

The desktop no longer reads, watches, probes, locks or mirrors native sessions
itself; the Rust native commands and `sessions.refreshDesktopNative` were
removed. On startup the Host rewrites native links saved by older clients once
into the managed shape (`mode`, `nativeIds`, `storage`) and re-reads them, so
sync has no per-read fallbacks and no prompt-text pairing. The writer lock lives
only in the Host data directory. Repeated syncs reuse the resolved source and
the parsed transcript while the source revision is unchanged, skip writes when
nothing changed, and session lists omit per-block native ID arrays.

A conversation MonoCode started itself keeps its warm provider process. If the same native
conversation is continued in the CLI, the next MonoCode send takes it over and
merges the CLI's turns first. A rewind or branch switch outside MonoCode keeps
history and pauses sending. Ownership checks remain Linux-only; on macOS and
Windows, managed native conversations stay read-only.

Local project paths, file operations and terminals remain native. Shared history
is listed, searched and edited through the Host; SQLite continues to hold native
workspace layout and unrelated desktop data. Desktop releases include the pinned
Node runtime and Host bundle. Development startup builds the Host before Vite.
Restart the development desktop to pick up the new native bootstrap command.
Native and Host worktree removal share a checkout reservation registry. Removal
checks conversation references, open editors, terminals and provider processes;
Git operations run without holding a SQLite write transaction.

The conversation command surface currently covers sends, configuration, drafts,
plans, attachments, approvals, questions, cancellation and compaction.
Host also keeps per-conversation edit checkpoints (`sessions.checkpoint`): an
ordinary conversation's structured edits are snapshotted at tool start and
completion in the Host data directory, so desktop and phone clients review the
same changed files and can Keep or Undo them after the turn ends. Undo refuses
files changed outside the conversation's own edits and waits while another
conversation runs in the same checkout. Orchestration workers, workflow
children and the assistant are excluded. Editing the last message is not yet
available for Host conversations. Desktop
clients can also generate, edit and confirm orchestration assignments, inspect
workers, cancel a task, stop a run and resume it. Host owns worker processes,
isolated checkouts, checkpoints and command receipts. Closing desktop leaves
accepted work running; reconnecting only reads state. Restarting Host pauses
unfinished orchestration until the user resumes it after inspecting its work.
Phone clients continue to read the same history and status without orchestration
controls. Older remote Hosts show orchestration as unavailable until upgraded.

The first upgraded desktop startup persists an exact legacy orchestration deletion
manifest, stops only its lead/worker execution, retires imported Host copies and
then deletes the native source records. Permanent tombstones prevent delayed
writes, imports and workspace restoration from recreating those conversations.
Legacy code, checkouts, branches and checkpoint files are preserved. This cleanup
does not rescan orchestration created after migration.

Host sessions retain the existing restrictions on `/operator`, handoff and BTW
conversations. Mobile push notifications and background polling remain unchanged.

Historical local `specs/` verification notes are not included in this repository.
These behavior descriptions do not establish compatibility for untested provider
or device combinations.


## Host personal assistant

The desktop sidebar and mobile drawer expose **Assistant** for Hosts supporting
`assistant.v1`. The same Host owns the chat, dispatches and interval/event
follow-ups, so closing either client leaves accepted work running. An assistant
message is an ordinary user turn with trusted Host provenance; its badge follows
queued sends, transcript synchronization and proven native-turn reconciliation.
Client-supplied identity fields cannot produce this badge.

Settings select an existing agent/model, execution modes, platform permissions,
project scope and manual/event/schedule triggers. The public chat shows replies,
operation cards and necessary questions/approvals. Cards navigate to an exact
conversation; orchestration workers remain read-only. Each Host's chat and drafts
are independent. Missing capabilities display an upgrade notice.

The assistant can save reusable procedures with `playbooks.save` and inspect
exact names with `playbooks.list` / `playbooks.read`. To assign them to an agent,
`sessions.send` accepts `playbooks: "release"` or an ordered list such as
`playbooks: ["release", "verify"]`, alongside the task `text`. The same field is
supported by `sessions.steer`, queue edits (`sessions.queue`, `action: "edit"`),
and `orchestration.worker` actions `message`, `steer` and `retry` (outside the
nested `input`). Selection applies to that message, not to the session forever.
The Host resolves names, deduplicates them in order and includes the complete
procedures in the persisted task text. Unknown names and oversized combined
messages fail rather than silently omitting steps. Later playbook edits or
deletions do not change accepted/queued messages; normal project permissions,
queue revocation and stable request-ID replay still apply.

**Pause** stops the assistant's current brain rather than delegated conversations.
**Continue** explicitly resumes interrupted reasoning and inspects durable action
receipts. Changing the brain's provider creates a separate native conversation
while keeping the public chat. Unknown external operations require verification
before retry. The separate [assistant evaluation guide](../host/assistant/eval/README.md)
explains the scope of simulated and model-based evaluations.

## Shared default provider account

Settings → Accounts can select a shared default Codex or Claude named account.
The native desktop writes `provider-accounts/defaults.json` beside its published
`accounts.json`; the Host reads this preference when creating a conversation and
saves the resolved account ID. Desktop and phone new conversations follow it
unless they select an account explicitly. Existing conversations retain their
account when the shared preference changes.

To reuse a Codex file-based CLI login, choose **Import current Codex login**, name
it (for example, `9300`), then choose **Use as shared default** on that account.
Import copies sign-in/configuration into a private managed profile, excludes
history, and uses that profile's file credential store. Keychain-only logins can
use **Add account** and the normal sign-in flow. Phones use **Follow Host default**
or choose an explicit named account in New conversations settings.

A named shared default has a fixed profile directory. Without a configured shared
default, the legacy Host CLI account still inherits the Host environment. The
desktop now reads ordinary conversation account identities from that Host; native
imports retain their local source. Host CLI usage is unavailable until a named
profile is selected, because querying the desktop environment could show another
account's usage. Missing shared accounts produce an error rather than falling
back, and the desktop prevents removing the active shared default.
