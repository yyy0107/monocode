# Shared desktop and mobile conversations

Desktop and mobile use the same local MonoCode Host for ordinary project
conversations. Desktop starts or reconnects that Host automatically. Opening a
local project keeps its native filesystem path and terminal access.

Existing desktop conversations are imported with their IDs, provider bindings,
timestamps, metadata and attachments. Import never overwrites Host history,
and a deleted imported conversation must not reappear on a later startup.
The original desktop database remains intact as a migration source.

The Host owns execution and authoritative history. Desktop must not silently
start a second local runtime when Host startup or reconnection fails. Mobile
keeps its existing URL and separate device credential. Closing desktop must
leave Host tasks running.

Native CLI imports added concurrently retain the desktop's existing external
ownership guard. Their history is shared through Host, while mobile continuation
is read-only until that ownership protocol is available headlessly. No second
provider may be launched against an externally owned native session.

Acceptance: create on either client, list/open/continue on the other; concurrent
sends serialize through Host receipts; migrate/retry/delete/restart without
duplication or data loss; preserve native project paths and terminal callbacks.
Record unexercised native/device environments explicitly.
