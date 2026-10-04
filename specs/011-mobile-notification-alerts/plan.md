# Implementation and validation

Convert MonoCodeNotificationService to a bound service using a local Binder. The
Capacitor plugin serializes binding/unbinding with Android's main thread, resolves
start after configuration, unbinds on disable/disconnect/destroy and retains the
binding across WebView pause. Keep one polling loop with current connection,
Host identity checks, rejection handling, retry backoff and in-memory credentials.

Remove foreground service declarations/permissions and monitoring UI strings.
Cancel notification 9041 and delete monocode-monitoring on load and channel setup.
Keep monocode-replies at IMPORTANCE_HIGH with explicit default sound/vibration;
use PRIORITY_HIGH and default sound/vibration on pre-channel Android. Include the
VIBRATE permission. Do not replace conversation channels or override user choices.
Use the existing translated Notification settings… label for access to channel
settings when permission is granted; blocked permission opens app settings.

Extend the real Android notification fixture to call the Capacitor plugin, verify
no ongoing notification, legacy cleanup, paused-WebView reception, high importance
alerts, deduplication, read acknowledgment and shutdown. Run affected mobile and
Android tests, check:web, test:host, desktop/mobile builds. Disable the packaging
publication action for local builds so the LAN update feed stays unchanged. Use
an isolated version store for native tests and the normal allocator for the final
installable APK. Record exact
tools/results and distinguish channel configuration from actual OEM popup display.
