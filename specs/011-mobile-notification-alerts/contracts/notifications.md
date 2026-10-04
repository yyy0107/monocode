# Notification contract

MonoCodeNotifications.start/stop/observe/setVisible/state/consumeOpen and unread/open
events retain their existing shapes. start resolves after the bound receiver has
accepted its connection; stop unbinds. A paused WebView retains the binding, while
activity destruction releases it. No foreground-service notification is posted.

The monocode-replies channel ID and per-environment/session notification tags stay
stable. Alerts are auto-cancelable messages; completed-run and pending-input keys
continue to deduplicate them. Legacy notification ID 9041 and monocode-monitoring
are only referenced for cleanup. Android owns already-created channel preferences.

Native texts contain channel/reply/input. Notification settings opens the existing
conversation channel when notifications are allowed and the app settings otherwise.
Device tokens remain in the existing secure storage and transient receiver config.
