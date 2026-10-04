# Executed verification — 2026-10-04

Android now has a started remoteMessaging foreground receiver independent of the
activity. The silent Remote card displays localized connected/reconnecting status
with the computer name; conversation alerts retain their existing high-importance
channel and can be disabled independently. Explicit disconnect stops reception.
Activation stores no second credential copy; restoration reads the existing
encrypted connection and checks its endpoint/Host identity pin.

## Tools

Node.js 24.16.0; npm 12.0.1; TypeScript 5.8.3; Vitest 3.2.7; Vite 7.3.6;
Capacitor CLI 8.5.2; Gradle 8.14.3; OpenJDK 21.0.12.1;
ADB 1.0.41 (platform-tools 37.0.1-15733141);
Android Emulator 37.1.11.0 (15917651), WorkbenchRemoteApi36, Android 16 / API 36.
No provider CLI behavior changed and no provider/model sessions were exercised.

## Results

- Before implementation, the new native-hook regressions exposed four failures:
  alert toggles stopped the receiver, alerts-disabled startup did not start it,
  restoration stopped a receiver too early, and the alert preference was not sent.
  Log: `/tmp/monocode-remote-background-regressions-before.log`.
- Focused activity/native bridge/UI/localization suite: **34 passed**, four files.
  Log: `/tmp/monocode-remote-background-focused.log`.
- Live locale/unchanged Host name notification-text regression: **1 passed**.
  Log: `/tmp/monocode-remote-background-texts.log`.
- `npm run check:web`: **passed** including TypeScript; final run **4671 passed,
  13 skipped**, 448 passing files and two skipped. Log:
  `/tmp/monocode-remote-background-check-web-final.log`.
- `npm run test:host`: **181 passed, 5 skipped**, 27 passing files and one skipped.
  Log: `/tmp/monocode-remote-background-test-host.log`.
- `npm run build`: **passed**. Log: `/tmp/monocode-remote-background-build.log`.
- `npm run mobile:build` and `npx cap copy android`: **passed**. Logs:
  `/tmp/monocode-remote-background-mobile-build-final.log`,
  `/tmp/monocode-remote-background-cap-copy-final.log`.
- Native Java compile, **8 SessionActivityState unit tests**, debug APK and
  instrumentation APK assembly: **passed**. Logs:
  `/tmp/monocode-remote-background-native-compile.log`,
  `/tmp/monocode-remote-background-apk-ready.log`.
- Android instrumentation on the final APK: **6 tests passed**, 165.593 seconds.
  Log: `/tmp/monocode-remote-background-android-complete.log`. Verified immediate
  Remote posting, translated Host text, ongoing/foreground flags, silent low
  importance, task/activity destruction with continuing polling and unread state,
  alerts-disabled reception, transient reconnect, credential rejection, changed
  Host identity, encrypted restoration/pin guards, secure disconnect, pending-bind
  cancellation/restart, legacy cleanup, reply alert importance, deduplication,
  stale foreground protection, read acknowledgment and explicit polling shutdown.
  The first run passed all three
  new remote-lifecycle/secure-restoration tests but failed two existing tests at
  immediate card assertions because Android deferred posting the FGS notification.
  Set FOREGROUND_SERVICE_IMMEDIATE and wait briefly for notification-manager delivery.
  Initial log: `/tmp/monocode-remote-background-android-tests.log`.
- The next run exposed a real start/stop race: cancelling startup after requesting
  startForegroundService could leave Android's promotion deadline armed and crash
  the process. Startup now binds first, promotes, requests started lifetime, and
  unbinds; cancelling before binding never requests FGS startup. The isolated
  cancellation/restart regression **passed**, one test, 10.015 seconds. Logs:
  `/tmp/monocode-remote-background-android-tests-final.log`,
  `/tmp/monocode-remote-background-android-race.log`.
- `git diff --check`: **passed**. Rust was unchanged; no Rust check was run.
- The final APK signature and package metadata: **verified** with SDK 36
  apksigner/aapt2; one v2 signer, package com.monocode.mobile, versionCode 45,
  min SDK 24 and target SDK 36. Log:
  `/tmp/monocode-remote-background-apk-signature.log`.

## Installable artifact and limits

Local APK: `build/mobile/monocode-remote-background-45.apk`, MonoCode 0.7.0,
versionCode 45, 8,674,984 bytes, SHA-256
`101b8848edd054c7a00aa948bd617b6a67081d14a85bff92af6e8ef53e88bbc6`.
It retains the existing debug signing key and normal version allocator. The
packaging publication action was disabled for these builds by
`/tmp/monocode-notification-test-build.init.gradle`; this work did not publish to
the LAN update feed or install on a physical phone.

Physical Android/OEM notification rendering, pre-API-26 notifications, iOS,
Do Not Disturb overrides, power/Doze restrictions and actual OS process-kill/sticky
restart remain unverified. Encrypted restoration and pin guards are exercised
directly by instrumentation; do not interpret them as a real process-kill test.
Android owns notification dismissal on newer versions and can stop the app via
force-stop or Active apps Stop. There is no boot receiver or power-policy bypass.
