# Verification — 2026-10-04

Environment: Node v24.16.0, npm 12.0.1, Vitest 3.2.7, OpenJDK 21.0.12.1,
Gradle 8.14.3, Android compile/target SDK 36. Native runtime test: a fresh isolated
Android 16 / API 36 x86_64 emulator. Existing working-copy changes were preserved.

| Check | Executed result |
| --- | --- |
| `npm run check:web` | Passed; 4,389 tests passed, 13 pre-existing opt-in provider tests skipped; TypeScript passed. |
| `npm run test:host` | Passed; 169 tests passed, 5 skipped; includes Host build, authenticated activity RPC, input/completion metadata, and all provider queue regressions including Pi/OMP. |
| `npm run build` | Passed. |
| `npm run mobile:build` | Passed. |
| Android `:app:compileDebugJavaWithJavac` | Passed. |
| Android `:app:testDebugUnitTest` | Passed; 8 Java read/delivery cursor tests. |
| Android test APK packaging | Passed using a temporary publication-disabled Gradle init script and isolated version directory. No APK was published. |
| Native `ConversationNotificationTest` instrumentation | Passed, 1 test in 12.553 seconds on Android 16 / API 36. |
| `git diff --check` | Passed. |

The instrumentation test runs the actual Android receiver and notification
manager against a local HTTP fixture. It confirms background delivery after the
WebView pauses, the version-1 RPC envelope and pinned Host identity, device bearer
authentication without browser Origin, persistent unread state, no repeated banner
on a subsequent poll, protection against a stale WebView foreground flag, and
cancellation/unread clearing after returning and acknowledging the displayed reply.

React/state/bridge tests cover the green marker at the end of a row, failed-load
read protection, Chinese accessibility labels, cross-project notification routing,
Host mismatch rejection, denied permissions, disabled reception, persistent cursors,
input IDs reused in another run, immediate queued turns, and late/stale snapshots.
Native read acknowledgements include the displayed completion/input identities so
a later partial reply cannot replay an already seen notification.

Limits: OS permission grant was programmatic in the isolated emulator; a physical
phone, the actual permission dialog and notification tap, long-duration lock-screen
Doze/power restrictions, process force-stop, and paid provider sessions were not
exercised. iOS native system/background notifications are outside this Android
scope and shown as unavailable. Rust was unchanged. Build chunk-size warnings
and Gradle deprecation warnings remain; they did not fail the builds.

Delivery requires the matching updated Host and Android app. In Connections,
enable System notifications and allow the OS permission. The Android foreground
receiver shows a quiet ongoing reception notification and can be disabled there.
