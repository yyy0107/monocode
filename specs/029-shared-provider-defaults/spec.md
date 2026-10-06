# Shared provider account defaults

Status: implemented; executed checks and runtime limits are in verification.md.

Desktop Settings can choose a shared default Codex or Claude named account. New
ordinary desktop and phone conversations follow that preference unless an explicit
account is selected. The Host resolves it once at creation and stores the
concrete account ID. Existing conversations and native imports keep their binding.

The authoritative preference lives beside desktop-published account metadata,
not in a process environment or browser-only storage. Credentials stay on the
computer. A selected missing account or corrupt preference fails visibly without
falling back. Selecting another shared default is required before removing it.

For installations without a configured preference, the original Host CLI account
remains available for backward compatibility. Desktop labels must read that
identity from the Host, never substitute the desktop process's identity. Phones
show which account following the Host default currently resolves to. Explicit
phone selections still override the shared preference.

Desktop can import the current Codex CLI sign-in into a new isolated profile and
select it as the shared default; this copies only auth.json and optional config.toml,
not session history. Signing in normally remains available for both providers.
No service environment changes, restarts, real provider requests or automatic
credential migration are required by implementation/testing.
