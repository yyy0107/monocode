# Executed verification — 2026-10-04

Implementation removes the ongoing foreground service notification and replaces
the receiver with an app-bound service. Notification channel settings preserve
user preferences; explicit high importance, default sound and vibration request
heads-up alerts. Android may suspend reception when the app/binding is destroyed,
the process is reclaimed, or power/network restrictions apply. Opening the app
resumes reception and reconciles unread activity.

## Tools

Node.js 24.16.0; npm 12.0.1; TypeScript 5.8.3; Vitest 3.2.7; Vite 7.3.6;
Capacitor CLI 8.5.2; Gradle 8.14.3; OpenJDK 21.0.12.1;
ADB 1.0.41 (platform-tools 37.0.1-15733141);
Android Emulator 37.1.11.0 (15917651), WorkbenchRemoteApi36, Android 16 / API 36.
No provider CLI behavior changed or real-model provider sessions were exercised.

## Results

- Focused mobile activity/native bridge/navigation/settings tests: 4 files,
  **32 passed**. Log: `/tmp/monocode-notification-focused-final.log`.
- Native Java compile, instrumentation compile and testDebugUnitTest: **passed**,
  including **8 SessionActivityState tests**. Log:
  `/tmp/monocode-notification-native-compile.log`.
- Android instrumentation run via ADB on API 36: **2 tests passed**, 72.851 seconds.
  Log: `/tmp/monocode-notification-adb-tests-passing.log`. The actual plugin is
  exercised through a disposable loopback Host fixture. Verified legacy
  notification/channel cleanup, no startup or ongoing notification, one background
  conversation alert, high-importance channel with sound, unread persistence,
  repeated-poll deduplication, stale foreground acknowledgment protection,
  foreground read/cancellation, stop/unbind, pending-bind cancellation and restart.
  Android strips deprecated sound/vibration defaults on channel-based devices;
  the test checks the channel there and legacy defaults only below API 26.
- Native notification-manager inspection confirmed `monocode-replies` importance
  4, default notification sound, vibration enabled and legacy monitoring deleted.
  No OEM-specific visual floating-popup check was performed.
- `npm run test:host`: **177 passed, 5 skipped**, 27 passing files and one skipped.
  Log: `/tmp/monocode-notification-test-host.log`.
- `npx tsc --noEmit`: **passed**. Log: `/tmp/monocode-notification-types.log`.
- `npm run build`: **passed**. Log: `/tmp/monocode-notification-build.log`.
- `npm run mobile:build`, `npx cap copy android`: **passed**. Logs:
  `/tmp/monocode-notification-mobile-build.log`,
  `/tmp/monocode-notification-cap-copy.log`.
- Local debug APK and test APK assembly: **passed**. Logs:
  `/tmp/monocode-notification-apk-build-final.log`,
  `/tmp/monocode-notification-apk-ready.log`.
- `git diff --check`: **passed**. Rust was unchanged; no Rust check was run.

`npm run check:web` was executed three times while unrelated context/provider
work changed in the shared checkout. First run: 4599 passed, 1 Cursor test failed,
13 skipped and one unhandled rejection. The Cursor file then passed in a targeted
rerun with notification UI tests (30 tests passed). Second run: 4627 passed,
1 sessionStatus context-display expectation failed, 13 skipped. Third/latest run:
4629 passed, **4 Codex live image/lifecycle tests failed**, 13 skipped; the Codex
implementation and tests were concurrently modified and were not changed here.
Logs: `/tmp/monocode-notification-check-web.log`,
`/tmp/monocode-notification-check-web-final.log`,
`/tmp/monocode-notification-check-web-complete.log`.
The full workspace gate is therefore **not passing**. Its TypeScript stage was
run separately and passed. Unrelated work is preserved.

The Gradle connected-test attempt was interrupted and is not counted as passing.
An initial direct-ADB attempt raced that runner's uninstall cleanup. The next
direct run caught a deprecated-defaults test expectation, which was corrected;
the final complete direct run above passed both tests. Only completed final
instrumentation results are used as native evidence.

## Installable artifact and limits

Local APK: `build/mobile/monocode-notification-alerts-39.apk`, MonoCode 0.7.0,
versionCode 39, 8,670,744 bytes. It uses the existing debug signing configuration
and normal version allocator. The packaging publication action was disabled by
`/tmp/monocode-notification-test-build.init.gradle`; this work did not publish the
APK to the LAN update feed or install it on a physical phone. Native test builds
used `/tmp/monocode-notification-test-updates` with isolated version codes.

Physical Android/OEM floating notifications, pre-API-26 sound/vibration, iOS,
Do Not Disturb overrides, and survival after process reclamation remain unverified.
Heads-up display depends on Android's channel and system settings; the app does
not reset existing channel preferences or bypass Do Not Disturb. The notification
settings button opens the conversation channel when permission is granted and
app settings when notifications are blocked.
