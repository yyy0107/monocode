# Data Model and State Rules

## Submission

Identity: Monocode session, provider flavor and request ID; each is independently scoped.
State: accepting -> handled-complete, or accepting -> running -> settled.
Cancellation/exit release pending promises once. Pi agent_end is not settled.
OMP keeps its existing completion records. No persistent session schema change.

## Interaction

Existing request identity and choice values are retained.
Proposed optional UserQuestion text settings:
input.kind (text or multiline), initialValue, placeholder, preserveWhitespace,
allowEmpty and maxLength. Fields are absent for existing providers unless explicitly enabled.
Pi input/editor retains empty and whitespace strings; submitted value is distinct
from cancelled. Timeout metadata bounds pending interaction lifetime.
Host keeps the existing 10,000-character reply boundary and errors visibly.

## Native Command

Existing NativeCommand name, invocation, source, description and optional origin.
Pi origins: skill, extension, prompt. Keep valid names and raw invocation values,
deduplicate and reject malformed entries. Reserved names use existing escaping.

## Session Model Capability

Active model reference, available thinking levels, applied thinking level and query
status belong to one runtime session. A model change invalidates cached levels.
Failed set operations do not mutate the applied selection; reconcile with provider
state. Optional-command fallback is recorded, not silently assumed successful.

## Tool Image and Attachment

Raw event: stable itemId derived from toolCallId/image index, PNG MIME and base64 data.
Materialized event: itemId, name, path, mimeType, size, optional ordinary Attachment.
20 MiB decoded PNG cap; invalid signatures/data and other MIME types fail visibly.
Keep image row metadata plus block.attachments to support scoped remote preview.
Never persist base64 in Host snapshots. Repeated IDs do not append duplicate rows.
Run/session ownership and generation tokens protect against late cancelled output.
PNG chunk CRCs are checked; nested codemode results are displayed only when the parent forwards them.

## Compatibility Record

Capability, runtime/provider, CLI version, executed validation and result.
Outcomes: tested/pass, tested/fail, unverified, unsupported/deferred.
A generated task list is never a tested/pass result.
