# Title contract

`Session.titleState` is optional: source (`placeholder`, `native`, `generated`,
`manual`), nonnegative epoch, purpose (`initial`, `automation`), and
fallbackAttempted. Invalid/missing state protects non-placeholder legacy names.

`session.titleUpdated` carries providerSessionId and title. It is metadata,
independent of the originating turn's completion. Events for other native IDs,
deleted sessions, retired naming cycles, manual names or automation-owned names
must not overwrite the current title. Null/empty/default native titles preserve
the last useful title. Optional `readSessionTitle` returns an existing native
title for the bound session without inference or native mutations.

`session.titleRefreshRequested` carries providerSessionId and requests a bounded
metadata re-read (not inference), including Grok summary-completion signals.
`ComposerTurnOptions` and `HostCommand.send` gain optional boolean refreshTitle
for event automations. Older protocol-v1 clients may omit it. Manual title writes
always remain protected, including renames before the first Host send.

Desktop SQLite adds nullable title_state_json. Host protocol remains version 1;
snapshot and list additions are optional. Old clients' explicit title patches
remain manual. Native titles preserve their language and provider values.
