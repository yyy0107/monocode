# MonoCode Mobile

A Capacitor iOS / Android client for an existing MonoCode Host. The app supports
manual **Host URL + device token** connections, opening projects by host folder
path, conversation history, Agent/model/reasoning selection for new conversations,
model/reasoning changes for idle conversations, permission selection,
streamed messages, tool activity, approvals, questions, cancellation, and
foreground reconnect. It shares the desktop theme tokens, fonts, icons,
the desktop AgentTranscript / AgentMarkdown renderers, question form, and
bounded code highlighter. Clipboard and external links use native mobile
services. Dark, Light, and System
appearance are available in Connections. There is no QR, SSH bootstrap, or
cloud account setup in the mobile app.

**Open project** browses folders on the connected computer, starting at its
user's home directory. Enter a subfolder, use Parent folder or Home folder, or
filter the names in the current directory, then tap Open project to add and
select it. Browsing alone does not add a project. The path field also accepts
a known absolute computer path; Go to folder lists its subfolders, while Open
project opens it directly. This also works for paths on another Windows drive.
The browser can reach directories outside existing projects and adds no folder
allowlist or approval steps; ordinary computer filesystem errors are displayed
with retry. It uses the same Host folder browser as desktop remote projects.
Parent folder remains available when a directory read fails or is still loading.
Directory symlinks are shown under their link names and keep their link paths
while browsing; file links and broken links are omitted. Folder enumeration runs
on the Host, so directory-browser fixes require updating the Host as well as the
mobile app.

## Connect to a Host

The desktop starts the shared MonoCode Host automatically. For a computer
without the desktop running yet, run the matching Host release manually. Follow
[remote-access.md](../docs/remote-access.md) to install providers, run the Host,
and issue a separate device credential for your phone:

```sh
npm ci
npm run host:build
node build/host/monocode-host.mjs start
node build/host/monocode-host.mjs pair --name "My phone" --token 123
```

The command above registers `123` as this phone's device token. Omit `--token`
to generate a random token instead. The Host validates the registered device
credential, and revoking that device also invalidates `123`.

The app accepts both HTTP and HTTPS Host URLs, including LAN IP addresses and
hostnames. For example, enter `http://192.168.1.10:3774` and the device token
when that address provides a reachable Host endpoint. Supply only the scheme,
host, and optional port, without `/rpc`, a query, or URL credentials.

The Host itself listens on `127.0.0.1:3774`, so a reverse proxy or tunnel must
make it reachable from your phone. That endpoint can use HTTP or HTTPS. For
example, with Tailscale installed and connected on both devices:

```sh
tailscale serve --bg http://127.0.0.1:3774
```

You can enter the generated `https://...ts.net` base URL as well. The app sends
RPC through Capacitor's native HTTP implementation. Android cleartext traffic
and iOS ATS HTTP access are enabled for user-supplied Host URLs. A phone's
`127.0.0.1` refers to the phone, not your computer.

The host computer must remain awake and online. Closing the phone app does not
stop a Host-owned agent. Transcript polling pauses in the background and catches
up when foregrounded. Android can continue receiving conversation notifications
through the separate activity receiver described below.

**Shared conversations:** ordinary desktop and phone conversations use the
same Host and history. Desktop connects automatically to the Host on this
computer; the phone uses its reachable URL and a separate device token.
Existing desktop history is imported automatically with its conversation IDs,
provider bindings and attachments. Repeated startup does not duplicate history
or restore conversations deleted from the shared Host. Desktop files and
terminals keep their native project paths. See [shared session behavior and
verification](../docs/shared-sessions.md).

## Unread replies and notifications

A green dot after a conversation's timestamp means there is an unread reply or
input request. It survives app restarts and is local to this phone and Host.
Opening and successfully loading the conversation in the foreground clears it.
Outgoing messages, renaming, queue edits and tool progress do not create a dot;
the first connection baselines historical messages without flooding notifications.

On Android, **Connections → System notifications** enables notifications for
completed replies and new questions/approvals across all projects. Allow the
system permission when requested. The current visible conversation stays quiet;
tapping a reply notification opens its project and conversation. Repeated polls
do not repeat a banner, including when another queued turn immediately starts.
Disabling notifications or denying permission preserves unread dots.

While connected with Android notification permission, a silent ongoing **Remote**
card shows **Connected to {computer name}** (or **Reconnecting to {computer name}**
when the network is unavailable). Tap it to return to MonoCode. The native
foreground receiver continues after Home, Android Back/closing the page, and
removing the app's recent task. **Disconnect** stops reception and removes the
card. The **System notifications** switch controls reply/input alerts separately;
turning it off keeps the Remote card and background connection active.

Old monitoring notifications and their channel are removed. The Remote card uses
its own low-importance channel without sound or vibration. Completed replies and
input requests use a high
importance channel with sound and vibration to request heads-up banners. The
**Notification settings…** button opens that channel's system settings so you can
allow floating/pop-up notifications. Existing channel preferences, Do Not Disturb
and manufacturer settings still control whether a banner appears.

The receiver uses the existing Host URL/device token, requires no cloud push
provider, and does not persist another credential copy. A system-restarted service
uses the connection already in encrypted secure storage, checks its pinned Host
identity and resumes reception. The matching Host must
support `sessions.activity`. Host identity changes and revoked credentials stop
reception; network failures retry with backoff and update the Remote card. Revoking
system notification permission also stops the receiver. Android force-stop, the
system Active apps Stop button, reboot and manufacturer power/network restrictions
can stop or suspend reception; reopening the app reconciles missed unread replies.
Foreground services are subject to Android's system policies, including notification
dismissal on newer Android versions. There is no boot auto-start or power-policy
bypass. See Android's [foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types),
[user stopping](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping)
and [notification channel](https://developer.android.com/develop/ui/compose/notifications/channels)
documentation.

Browser previews use permission-granted browser notifications while polling is
active. iOS supports foreground unread indicators; native iOS system/background
notifications are unavailable in this Android change and the settings say so.

## Agent, models, and reasoning

The composer has separate Agent and Model selectors. Models and settings come
from the connected Host's catalog, so reasoning levels are shown only when that
model supports them. Changing models preserves compatible settings and resets
unsupported values to the new model's defaults. Changing Agents starts with
that Agent's own model defaults.

New conversations send the chosen Agent, model, reasoning settings, and
permission mode to the Host. Existing conversations keep their Agent; create a
new conversation to choose another. While idle, changing their model or
reasoning dispatches the Host's configure command and applies to subsequent
turns. Configuration controls are disabled while a turn or command is running.

Message bubbles, Markdown/code/Mermaid, tool activity, folding, approvals, and
scroll behavior render through the same components as desktop. Mobile adds
clipboard/link services, touch layout, and a jump-to-latest button.

Tap an image file link or a Read tool's file chip to show the image in the bottom
file panel. PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG use the phone's image
decoder; images up to 10 MiB fit within the panel, while unreadable formats show
an error. Temporary image files outside the project also open through the Host's
authenticated read-only file preview. Use a matching current Host build: an old
Host that reports “Path is outside this machine’s projects” must be updated for
these temporary paths to work.

Desktop and mobile share the same character-by-character reply reveal, including
Chinese text and complete emoji. Received chunks catch up smoothly; completed
history opens immediately without replaying the animation. Live mobile chats
sync every 250 ms. The transcript follows content and viewport growth until the
reader scrolls up, then preserves their place; scrolling back to the bottom or
tapping Jump to latest resumes following.

The mobile composer uses a compact rounded card with one toolbar. Tap its model
summary for reasoning settings, model selection, and Agent selection; tap the
shield for permission modes. The menus use touch-friendly bottom sheets with
selected checkmarks, scrolling, focus handling, and Android Back dismissal.
The project selector above the card starts a new conversation in that project
while keeping the current message and selected attachments. Chat navigation
moves to the header so the card sits directly above the keyboard or safe area.

The plus menu offers photos, files, and Plan mode. Files are read on the phone,
previewed using the shared desktop attachment chips, and uploaded through the
Host's existing chunk protocol when sending. Limits match the Host: 20 files,
up to 20 MB each. The first-message journal preserves attachment references
and plan intent across reconnects; a lost chunk receipt retries the same bytes
and offset. Enter inserts a newline; Ctrl/Command+Enter sends. Running turns
show Stop and lock configuration controls.

## Build

From the repository root, use Node.js 22 or newer (required by Capacitor 8):

```sh
npm ci
npm run mobile:sync
```

`mobile:build` builds the independent mobile entry into `dist-mobile/index.html`.
`mobile:sync` copies it into both native projects and refreshes native plugins.
The normal desktop `dev`, `build`, and Tauri entries remain separate.

Android requires JDK 21, Android SDK 36, and the platform's build tools. Open
`mobile/android` in Android Studio or run:

```sh
npm run mobile:android
# Or build an unsigned/debug APK after mobile:sync:
cd mobile/android
./gradlew :app:assembleDebug
```

The debug APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
`mobile/android/local.properties` is machine-specific and ignored by Git;
configure `sdk.dir` or your normal Android SDK environment before using Gradle.

## LAN app updates

The phone's Connections screen includes App updates. It checks at startup and
when returning to the foreground, including when a Host connection is saved.
The update source is currently fixed to `http://192.168.0.206:3780` in
`mobile/update-config.json`, independently of the Host URL and device token.
HTTP is supported. The computer must be online on the same LAN.

```sh
npm run mobile:apk
```

Every signed APK assembled through Gradle (including Android Studio and direct
`assembleDebug`) receives a new versionCode, even when versionName stays the
same. Successful assembly publishes the APK and atomically updates
`latest.json`, then starts the LAN update server if necessary. Unsigned release
APKs are not published. `mobile:build` alone builds web assets, not an APK.
Version counters and packages are shared between worktrees in
`~/.local/share/monocode/mobile-updates` (or under `XDG_DATA_HOME`). For isolated
builds, override `MONOCODE_MOBILE_UPDATE_DIR`. Versioned APK URLs remain immutable,
and a slower older build cannot replace the latest version. Keep the Android
signing key unchanged for compatible updates.

To restart the server after reboot, use `npm run mobile:updates`; another
successful APK build also starts it. The server exposes only `/latest.json`,
versioned `/apk/monocode-N.apk` packages, and `/health` on the fixed LAN address.
Published packages do not require the Host token.

Install the first APK containing this updater once. Subsequent updates use
**Check for updates → Download and install**. If Android requests permission,
allow MonoCode to install apps, return, and tap Download and install again.
Downloads show progress and verify size, SHA-256, package ID, versionCode, and
signing certificate before opening the system installer. Android still requires
the user to confirm installation. Connection credentials are kept during an
in-place update. iOS cannot install these Android packages; its update entry
explains that an Apple distribution channel is required.

Verify publication and update behavior with `npm run test:mobile-updates` and
`npx vitest run src/mobile/updates.test.ts`.

For iOS, use macOS with Xcode and Swift Package Manager:

```sh
npm run mobile:ios
```

Select your signing team in Xcode, then run the `App` target on a simulator or
phone. The iOS project uses `MobileBridgeViewController` from both its storyboard
and SceneDelegate to register secure storage. The iOS deployment target is 15;
Android minimum SDK is 24. Store signing and distribution are not configured.

## Browser development

The production Host intentionally rejects browser-origin requests. Development
uses a **local Vite proxy bound to one configured Host**, rather than changing
Host CORS or exposing its token in a URL:

```sh
MONOCODE_MOBILE_HOST_URL=http://127.0.0.1:3774 npm run mobile:dev
```

Open `http://127.0.0.1:1425/mobile.html` and enter the same configured Host URL and
device token. The browser preview keeps credentials and pending commands only
in memory; refresh requires another login. There is no production browser
transport or public mobile gateway bundled in this change.

On Android with an emulator or connected test device, `adb reverse tcp:3774
tcp:3774` allows the native app to use `http://127.0.0.1:3774` during development.

## Credentials and retry behavior

On iOS the connection and pending command journal are in device-only Keychain
items. On Android they use AES-GCM encryption with an Android Keystore key;
application backup is disabled. Only appearance is stored in WebView
localStorage. No provider credentials are copied to the phone.

Before sending a command the app saves its original `commandId`. A lost response
shows a Retry action; retry asks for the same receipt and never creates another
command id. Creating a conversation and sending its first message is journaled
in two stages, including across an app restart. Commands are serialized. The
client pins `environmentId` and will not replay pending work onto another Host.
A definitive Host command rejection clears the pending request so the user can
correct it. Disconnect removes the saved connection without stopping tasks or
revoking the Host device token; use the Host's `revoke DEVICE_ID` command when
revocation is needed.

## Verify

```sh
npx vitest run src/mobile
npx vitest run --config host/vitest.config.ts host/mobile-client.test.ts
npm run check:web
npm run mobile:build
npm run mobile:sync
```

Mobile tests use fake transports; the Host suite includes a disposable real Host/SQLite database with
an in-memory fake provider. They cover native RPC envelopes, URL validation,
revocation, Host identity, streamed deltas, snapshot fallback, chunking,
first-message retry after a lost response, serialized commands, and tool-block
approval interactions. They never use paid providers or personal projects.
