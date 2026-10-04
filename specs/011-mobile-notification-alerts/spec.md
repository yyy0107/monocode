# Mobile conversation alerts without an ongoing notification

Remove Android's ongoing Receiving conversation updates notification when system
notifications are enabled. Completed replies and questions/approvals request
heads-up notifications with sound and vibration. Preserve unread green dots,
notification deduplication, quiet delivery for the visible conversation and
notification navigation to the owning Host/project/session.

Use the current Host activity endpoint and device credential. A service bound to
the app may poll while the WebView is paused, without a foreground service or an
ongoing notification. Reception follows the app/binding lifetime; after Android
reclaims or force-stops the process, reopening reconciles missed activity. No
cloud push provider, extra credential persistence or Host protocol change.

Clean up the legacy monitoring notification and channel. Preserve the existing
conversation channel ID and user preferences. Android controls existing channel
importance, sound, vibration and floating banners, including Do Not Disturb and
manufacturer restrictions. Provide access to the conversation channel settings.
iOS and browser behavior remain compatible.
