# 构建、更新与发布 / Builds and updates

桌面端与 Android 默认使用本 fork 的 [GitHub Releases](https://github.com/yyy0107/ohmymonocode/releases)。可下载的版本和平台以已发布 Release 的附件为准；本地构建不会自动创建或发布 GitHub Release。

| 目标 | 在仓库根目录执行 | 产物 |
| --- | --- | --- |
| Linux x86_64 | `npm run build:linux:release` | DEB、AppImage |
| Windows x64（Windows 上执行） | `npm run build:windows:release` | NSIS 安装程序 |
| Android | `npm run mobile:apk:release` | 未配置签名的 Release APK，分发前需签名 |

开发依赖见[贡献指南](../CONTRIBUTING.md)，Android 工具链见[移动端指南](../mobile/README.md#build)。

## GitHub updates (default)

Ordinary desktop and mobile builds check this repository's GitHub Releases:

- Desktop: `https://github.com/yyy0107/ohmymonocode/releases/latest/download/latest.json`
- Android: `https://github.com/yyy0107/ohmymonocode/releases/latest/download/mobile-latest.json`

`npm run mobile:apk` produces a debug-signed APK with the project version and
GitHub updates; it does not publish to LAN. The frontend and Android download
allowlist both use `mobile/update-config.release.json`. The manifest uses the
existing mobile schema with a flat `/monocode-N.apk` download path. Upload the
APK under that name and its matching size/SHA-256 manifest to the same Release.
Use the same signing certificate as the installed app for compatible updates.

`npm run mobile:apk:release` selects the Release variant and always uses GitHub,
even if a LAN channel is configured in the environment. Gradle does not configure
a Release signing key by default, so this APK needs signing before distribution.
Neither build command uploads files or publishes a GitHub Release.

Ordinary desktop builds use the HTTPS endpoint in `src-tauri/tauri.conf.json`.
The explicit `build:linux:release` and `build:windows:release` commands remain
available and use the same GitHub endpoint. The desktop manifest must include
package URLs and updater signatures made with the configured signing key.

Changing the update source requires installing a newly built app once; existing
installed binaries retain the address they were built with.

## LAN app updates (explicit publication)

`npm run mobile:publish` explicitly selects `MONOCODE_UPDATE_CHANNEL=lan` for
both the web assets and Android's download allowlist. It uses the addresses in
`mobile/update-config.json`, trying LAN first and then Tailscale HTTPS. Normal
GitHub builds do not fall back to these addresses.

LAN builds retain the `MM-dd-HHmm` date label in `America/Los_Angeles`.
Every assembled APK receives an increasing versionCode. Version counters and
packages are shared in `~/.local/share/monocode/mobile-updates` (or under
`XDG_DATA_HOME`); `MONOCODE_MOBILE_UPDATE_DIR` selects an isolated directory.

The LAN server exposes `/latest.json`, immutable `/apk/monocode-N.apk` downloads,
and `/health`. It can be started with `npm run mobile:updates`. The optional
Tailscale source proxies that same server:

```sh
tailscale serve --bg --https=8444 http://192.168.0.206:3780
```

Desktop LAN publication uses `src-tauri/tauri.lan.conf.json` explicitly on Linux
and Windows, so its build, signing and deployment checks retain the LAN endpoint.

### Publish manually

Builds and LAN publication are run manually; no conversation hooks are configured.
On Linux, run from the repository root:

```sh
npm run mobile:publish
# Equivalent script entry:
bash mobile/task-publish.sh
```

The command uses `flock` to reject overlapping invocations, builds with
`MONOCODE_MOBILE_DEFER_PUBLISH=1`, compares source fingerprints before and after
the build, and only then publishes through the existing updater. A changed input
or failed build leaves the previous LAN release in place. Fix or finish the task
and invoke it again; it does not retry automatically. Avoid concurrent Android
Studio or direct `mobile:apk` builds, which do not take this command's lock.

Fingerprints cover Android sources, `src/mobile/` and its local imports,
`src/styles/`, `public/`, mobile build/publish scripts, package manifests, and build
configuration.
Tests, documentation, iOS-only code, and generated outputs are excluded. The
local import scan follows shared TypeScript/JavaScript, JSON, CSS and assets,
including literal dynamic imports. Unrelated desktop source does not change it.
An unchanged successful publication is skipped while it remains the latest LAN
release. Local state lives in ignored `build/mobile-publish/`. The first invocation
builds once because earlier manual releases have no source fingerprint.

The build includes the existing TypeScript checks; task-specific checks must
pass before publishing. The command reports publication results in the terminal
and does not install a phone update automatically. Verify changes to this workflow
with `npm run test:mobile-publish`.

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

## Desktop LAN publication

On the Linux update server, run `npm run desktop:publish` after relevant checks
pass. This builds DEB and AppImage locally and NSIS through `ssh wy-win`. The
Windows builder receives the current source snapshot in its ignored
`build/windows-lan/workspace` directory; it does not build from or overwrite the
Windows checkout's HEAD.

All three packages are signed on Linux with the existing local key. The command
uses an increasing `next-patch-lan.N` version through an ignored Tauri config,
without changing repository versions. Packages are deployed before the LAN feed
is replaced atomically; all platforms must succeed at the same version. Source
changes during the operation prevent the feed from advancing. An unchanged
published source state is skipped.

A shared lock rejects overlapping desktop publications across worktrees. Do not
run direct Tauri builds concurrently. After a remote crash, inspect the owner and
processes before removing a stale Windows `build/windows-lan/build.lock`.
See [AGENTS.md](../AGENTS.md#manual-lan-publication) for the local build setup and
[scripts/dev-refresh.md](../scripts/dev-refresh.md) for the separate Host/desktop
restart and Android publication command.
