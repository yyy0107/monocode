# Implementation plan

Keep accounts.json's provider arrays compatible. Add authoritative defaults.json
with provider -> named account ID, managed by native commands. Desktop caches its
confirmed value for selectors but never republishes it from browser storage.
Serialize metadata publication and await it before committing default changes.

Resolve omitted create selections in HostEngine only, validate published
metadata, then persist the concrete account ID. Child processes use the existing
isolated profile environment and fail when its directory has been removed.
Legacy retained sessions are never resolved through the new preference.

Extend providerAccounts.list entries with optional identity and shared-default
metadata. Read only public cached identity fields on the Host. Desktop identity
reads use that RPC when connected to its shared Host; no local fallback on failure.
Mobile uses the metadata for its follow-default label. Older Hosts remain readable.

Add focused regressions for persistence/publication failures, import boundaries,
identity routing, creation and retained session behavior; build Host/mobile and run
check:rust for native changes. Preserve unrelated changes in this personal fork.
