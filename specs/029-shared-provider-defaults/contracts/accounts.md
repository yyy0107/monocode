# Account defaults contract

Desktop app data/provider-accounts/defaults.json is a JSON object with optional
codex/claude named profile IDs. Missing key/file means the legacy Host CLI account.
Native provider_account_defaults reads it; provider_account_set_default validates
that the profile is published and exists, then atomically updates it. ID default
clears that provider's preference. Removing an active shared default is rejected.

providerAccounts.list keeps its existing provider -> array shape. Entries add
optional identity (email/name/plan/organization). The builtin default entry also
adds defaultAccountId/defaultAccountLabel/defaultIdentity and defaultError when
configuration cannot be resolved. These are public metadata, never credentials.
A capability providerAccounts.defaults identifies support.

A create command's absent providerAccountId follows the shared preference.
An explicit named ID overrides it; explicit default selects the original Host CLI
profile (desktop per-project override). Mobile's follow-default choice omits the ID.
Saved sessions store the resolved named ID;
legacy absent IDs retain the original Host CLI account. Deleting a selected profile
or corrupting defaults must never silently switch a conversation to another account.

Desktop provider_account_import_codex accepts a new named ID and copies the current
process's CLI auth.json and optional config.toml into a private, newly created
profile and forces that profile's file credential store. Keychain-only sources
require the normal sign-in flow. Existing destinations are rejected and partial copies cleaned up. It does
not copy session history or change the shared preference until explicitly saved.
