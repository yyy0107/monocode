# Loading contract

Host protocol v1 and serialized sessions are unchanged. MobileClient exposes a
synchronous cachedSession lookup, single-flight session synchronization, and a
separate sessionPreviews operation. Cached sessions are scoped to the current
connection and capped at eight entries. Preview hydration must not roll back
metadata, revision, blocks or removals from a more recent sync.

Model catalogs are scoped by project/current connection, capped at eight entries
and reused for at most one minute. Errors remain retryable. A late model response
must not reset an existing session configuration or another project's catalog.

Cached text may be read during revalidation. Sending, approval, answers, stopping
and unread acknowledgement require a confirmed current snapshot. No cache is
written to device storage. Full cold loads still depend on transcript size and
the real network round-trip.

Drawer history loading is independent of conversation loading. Selecting a
project immediately displays the new-conversation screen while summaries and
branch metadata load. An archived/deleted remembered session falls back to a
new conversation with an available default model, without displaying archived
cached blocks. Local timing diagnostics record navigation-to-DOM/layout commit;
they do not measure app launch, later asset decoding or physical screen paint.
