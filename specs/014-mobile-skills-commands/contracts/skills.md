# Skills contract

Protocol remains version 1. skills.list accepts projectId, harness, optional
sessionId and refresh. A stored session must belong to the project and Agent;
its execution directory wins over the project's directory. The result is a
HostSkillCatalog containing skills (existing Skill union), native and canCompact.
Advertise skills.list additively. Discovery returns metadata only.

File catalogs preserve desktop discovery order and deduplication. Native catalogs
preserve invocation, aliases, argument hints and source values. A provider's
native catalog owns its skills; file skills are not substituted for native
commands. /plan and /compact remain application shortcuts, with native reserved
commands escaped by the provider's existing invocation prefix.

Send commands, attachments, queued rows and journal records retain their existing
shape and original text. Host dispatch prepares skill bodies only for execution;
history retains /name text. A repeated receipt must not repeat execution. Queued
and steered messages follow the same preparation. Cancelled preparation must not
start a provider. Mobile catalog errors and stale responses cannot alter drafts
or leak items from another project/Agent/session.
