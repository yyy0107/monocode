# Implementation and validation

Promote the existing native activity receiver to a started foreground service of
type remoteMessaging. Bind while preparing startup, promote before requesting
started lifetime, then unbind after acknowledgment. Cancelling a pending binding
never calls startForegroundService and avoids Android's FGS deadline race.
Activity/plugin destruction releases the binding without stopping the service.
Declare foreground service permissions and stopWithTask=false. Use a separate
low-importance, silent monocode-remote channel, notification ID 9042, MonoCode's
existing status icon, ongoing/only-alert-once flags and an app content intent.
Retain legacy notification/channel cleanup and the existing monocode-replies ID.

Persist only activation, pinned endpoint/Host identity, translated texts and the
alert preference in activity preferences. START_STICKY reads the existing AES-GCM
connection through shared secure-storage reading. Explicit stop clears activation
before stopping. Native credential removal also stops reception. A single native
polling loop validates Host identity and credentials, updates connected/reconnecting
status, retries transient failures with bounded backoff and reconciles background
activity. Guard asynchronous results against reconfiguration/stop.

The mobile hook starts the service whenever connected with system permission;
passes an optional enabled flag for conversation alerts; updates localized texts
and actual host name; never stops it simply because the WebView backgrounds.
Settings explain the ongoing background connection independently of alert choice.
Request immediate FGS notification display rather than Android's deferred default.

Run mobile regressions, meaningful Android instrumentation covering foreground
promotion, activity destruction, reconnect, alert preference, shutdown and encrypted
restart. Complete check:web, test:host, build, mobile build and Android build.
Suppress the repository's APK publication hook for local verification and delivery.
Record executed results and unverified physical/OEM scenarios in quickstart.md.

Android references: [service types](https://developer.android.com/develop/background-work/services/fgs/service-types),
[launch](https://developer.android.com/develop/background-work/services/fgs/launch),
[user stopping](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping).
