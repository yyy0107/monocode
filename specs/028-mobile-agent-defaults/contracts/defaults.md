# Defaults contract

Storage key: monocode.mobileAgentDefaults. Version 2 stores `hosts`, keyed by
verified environmentId. Each entry has optional `harness` and `agents` map.
Agent entries contain optional `model`, `modelSettings`, `accountId`, and a legacy
`accountNeedsConfirmation` marker. Default login is absent or `default`.

Legacy top-level harness/model/modelSettings/accounts migrate once; named account
IDs keep the marker until matched against the current Host's metadata or explicitly
reselected. Invalid/removed IDs are never normalized to the default login.

Existing RPCs remain unchanged:
- models.list accepts an omitted projectId for the Host's global catalog.
- providerAccounts.list returns id/label lists; exact unsupported-method replies
  become null in MobileClient, while other failures propagate for retry.
- commands.dispatch create uses optional providerAccountId. No account secrets
  are sent to or stored on the phone.

MobileClient.models(projectId?, refresh?) and cachedModels(projectId?) distinguish
global and project cache entries. Connection cache epochs reject late model and
account responses after switching, disconnecting, or reconnecting.

A draft uses captured defaults for its current Agent. Model/effort adjustments
remain local to that draft or existing session. Settings saves affect later drafts.

Follow-up: spec 029 adds a desktop-owned shared account default. The phone's
absent/default preference still omits providerAccountId; a newer Host resolves
that omission to its configured shared default. Named phone preferences retain
priority. Optional account-list metadata identifies the effective Host account.
