# Native session titles

Date: 2026-10-04. Branch: `codex/native-session-titles`.

New MonoCode sessions show an immediate prompt-derived title and prefer the
provider's native title. Cover all ten providers and both desktop and Host
execution. Only titles change; no summary UI is added.

Use native notifications and bounded metadata reads. Codex reads thread.name,
OpenCode reads session.title, ACP providers read session_info_update.title and
advertised session/list, and Claude reads the bound transcript's ai-title.
Pi/OMP retain immediate application generation in their current RPC modes.

After an accepted first turn settles, wait 15 seconds, perform one final native
read (at most five seconds), and generate once if no native title is available.
Fallback uses the current provider's generator or existing available text
providers on the execution machine. Persist attempts before launching them.
Late native titles may supersede initial fallback titles. Cancellation does not
launch fallback. User names always win. Event automations retain one explicit
application title refresh per event, protected from stale native names.

Optional durable title state tracks source, epoch, purpose and fallback attempt.
Legacy non-placeholder names are protected. Preserve unrelated work, account
selection, Issue/PR association, branch naming and native import behavior.
Title metadata updates must not become received replies or unread notifications.

Acceptance requires native-success zero extra calls; missing-title at most one
fallback per initial cycle; durable manual/automation guards; late metadata saved
after turn completion; and desktop/Host/mobile persistence compatibility.
