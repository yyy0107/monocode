# Android remote connection in the background

Keep a visible ongoing Android notification while MonoCode is connected to a Host.
Match the reference's content: title Remote, body Connected to {host}, using the
actual computer name and application language. Tapping the card returns to the app.
Transient network failures show Reconnecting to {host} and retry automatically.

Home, Android Back/exitApp, and removing the activity's recent task must leave the
native receiver running independently of the WebView. Preserve reply/input alerts,
unread state, deduplication and notification navigation. The System notifications
switch controls conversation alerts; disabling it leaves the remote connection
and ongoing card active. Explicit disconnect, revoked credentials, a different
Host identity, or revoked system notification permission stops the receiver/card.

Restore a system-restarted foreground service from the existing encrypted
connection, without persisting another token. Do not resurrect it after explicit
disconnect. Android force-stop, the system Active apps Stop control, device reboot
and OEM power restrictions are outside guaranteed survival; no boot receiver or
battery-policy bypass. Android owns notification rendering/dismissal policies.
iOS and browser behavior remain compatible; this feature targets Android.

This request supersedes 011's removal of the ongoing notification. Preserve the
existing uncommitted work and current active Spec Kit pointer for native titles.
