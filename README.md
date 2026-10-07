<p align="center">
  <img src="public/monocode.png" alt="MonoCode" width="88" />
</p>

<h1 align="center">MonoCode</h1>

<p align="center">
  <strong>A desktop UI for your coding agents.</strong>
</p>

<p align="center">
  <img width="1680" height="1050" alt="Screenshot 2026-09-04 at 06 34 00" src="https://github.com/user-attachments/assets/2cd4a6ec-eb1e-4b45-8627-a76442ea3874" />
</p>

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, Antigravity, Pi, omp, fx, and Hermes Agent. If they’re installed and logged in, MonoCode can run them. Tabs are sessions. The composer is the input. MonoCode does not sell tokens.

## Install

> Install and log in to at least one provider first:
>
> - [Claude Code](https://claude.com/product/claude-code) - `claude auth login`
> - [Codex](https://developers.openai.com/codex/cli) - `codex login`
> - [Cursor CLI](https://cursor.com/cli) - `agent login`
> - [Grok Build](https://docs.x.ai/build/overview) - `curl -fsSL https://x.ai/cli/install.sh | bash` then `grok login`
> - [OpenCode](https://opencode.ai) - `opencode auth login`
> - [Antigravity](https://antigravity.google/docs/cli-install) (macOS/Linux) - `curl -fsSL https://antigravity.google/cli/install.sh | bash`, then run `agy` once to sign in
> - [Pi](https://pi.dev/) - `npm install -g @earendil-works/pi-coding-agent`
> - [omp](https://omp.sh) - `curl -fsSL https://omp.sh/install | sh`
> - [fx](https://fx.sh) - `curl -fsSL https://fx.sh/setup.sh | bash` then `fx login`
> - [Hermes Agent](https://github.com/NousResearch/hermes-agent) - macOS/Linux: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`; Windows PowerShell: `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`; then run `hermes model`

macOS (Apple Silicon): download [MonoCode.dmg](https://dl.usemono.dev/MonoCode.dmg), open it, drag MonoCode to Applications.

macOS (Intel): download [MonoCode_x64.dmg](https://dl.usemono.dev/MonoCode_x64.dmg), open it, drag MonoCode to Applications.

Linux (x86_64): download the `.deb` or AppImage from [GitHub Releases](https://github.com/hardbeat920/monocode/releases/latest). Install the `.deb` with `sudo apt install ./MonoCode_*.deb`, or make the AppImage executable with `chmod +x MonoCode_*.AppImage` and run it directly. On Fedora and Enterprise Linux 10, download the `.rpm` from the same release page — see [Fedora / Enterprise Linux packages](#fedora--enterprise-linux-packages) for the one extra repository step Enterprise Linux needs.

Windows (x86_64): download the NSIS installer from [GitHub Releases](https://github.com/hardbeat920/monocode/releases/latest) and run it.

## Mobile client (development)

Desktop and mobile share ordinary project conversations through the same MonoCode Host. Desktop starts and connects to the local Host automatically and imports existing history; iOS and Android connect using the Host URL and their device token. See [shared conversations](docs/shared-sessions.md) and [mobile setup and build instructions](mobile/README.md).

## Some notes

### Interface language

Open **Settings → General → Language** to switch between **English** and
**简体中文 (Simplified Chinese)**. The change applies immediately across open
windows and is remembered after restarting. The initial language follows the
system language, with English as the fallback. Agent messages, code, file paths,
and project names retain their original content.

中文界面：打开 **设置 → 通用 → 语言**，选择 **简体中文**。切换立即生效，
无需重启；设置会自动保存，也可随时切回 English。

Experimental remote sessions: run agents on an always-on Windows, Linux, or macOS machine and connect from the desktop. See [remote access setup and current limitations](docs/remote-access.md).

This is very early and you should expect bugs.

### Agent access to MonoCode

Type `/operator` at the start of a composer message to enable MonoCode access in that thread. For example, `/operator start two Codex sessions: one to inspect the API and one to review the UI`, or `/operator list my notes`. The slash picker also offers this command. The transcript shows only the request text in a translucent amber bubble; MonoCode removes the command from the request sent to the agent and supplies the local `app` CLI path and instructions on that turn. Later turns in the same thread can use the CLI without repeating `/operator`; other threads receive no CLI instructions or app access. The CLI can act only during an active agent turn. The agent can run the shown `app --help` command for the exact JSON input fields.

- `models.list` shows available providers, models, settings, and permission modes.
- `sessions.start` opens a tab in the current project with a prompt. Set `placement: "right"` or `placement: "down"` to split the calling session's pane instead; `besideSessionId` selects another visible session pane in the project. Reuse the returned session ID as the next `besideSessionId` to build nested layouts. By default it submits the prompt; set `draft: true` to save it unsent without starting an agent turn. It accepts a provider, model, effort or other model settings, permission mode, and current checkout or new worktree choice. Set `worktreeCwd` to a path from `worktrees.list` for a specific existing checkout. Use `worktrees.create` to create a worktree on a named new or existing local branch, then pass its path as `worktreeCwd`. Omit `runtimeMode` to inherit the calling session's permission mode, or set it explicitly to override. It returns the new session ID as soon as the pane and prompt are accepted, so the agent can use it for follow-up actions.
- `sessions.list` shows project sessions. `sessions.read` returns up to three recent user/assistant exchanges, with a cursor for older exchanges and a per-message character cap. `sessions.send` submits a follow-up to an idle session, while `sessions.draft` saves an unsent message for the user to review.
- `notes.list` returns titles and short previews; `notes.read` returns one full note by ID.

Orchestration workers keep their existing scoped `control` workflow and do not receive this app access.

Small, focused pull requests are welcome. Anything large is worth an issue first - see [CONTRIBUTING.md](CONTRIBUTING.md).

## Build from source

Supports macOS, Linux, and Windows.

Need Node.js 24+ and a current stable Rust toolchain. On Linux, ensure standard Tauri prerequisites are installed (e.g. `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`). On Windows, the installer bootstraps the [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime when it is missing.

```bash
npm install
npm run tauri dev
```

Local desktop builds, including development mode, check
`http://192.168.0.206/latest.json` for updates. The endpoint must serve a Tauri
desktop update manifest; the mobile APK feed on port 3780 uses a different format.
The desktop updater public key is configured for the local signing key stored
outside the repository at `~/.local/share/monocode/desktop-updates/signing.key`.
Keep this private key to sign future updates; never publish or commit it.
Release CI overrides the endpoint and public key with its release configuration.

After `npm run build:linux`, prepare signed DEB and AppImage downloads and a Tauri
update manifest with:

```bash
node scripts/publish-desktop-update.mjs
```

The script checks the key's public key and the DEB version/architecture, then
writes `build/desktop-update-site/`. Downloads use content-based paths, so
rebuilding a version preserves links already returned by an update check. Both
packages must be signed before the script replaces `latest.json`. Use `--key`,
`--deb`, `--appimage`, or `--output` to override the default paths. For a combined
Windows/Linux feed, also pass `--nsis` with the matching Windows installer and
`--version` for the shared version. Do not replace a combined feed with a
Linux-only manifest; the publication workflow below always builds both platforms.

On the LAN update machine, Nginx serves `/var/www/html` on port 80. Deploy the
packages first, then atomically replace the feed (no Nginx reload is required):

```bash
sudo cp -R --no-preserve=ownership build/desktop-update-site/monocode-desktop /var/www/html/
sudo install -m 644 build/desktop-update-site/latest.json /var/www/html/.monocode-latest.json
sudo mv /var/www/html/.monocode-latest.json /var/www/html/latest.json
```

Verify that `http://192.168.0.206/latest.json` returns JSON and that its package
URLs work. Serving only installers on port 3781 does not provide this feed.
Updates require a newer semantic version; rebuilding `0.7.0` alone does not
offer an update to an existing `0.7.0` installation. Older local builds with an
empty updater public key need one manual reinstall to enable signed updates.

### Publish desktop updates manually

Builds and LAN publication are run manually; no conversation hooks are configured.
On the Linux x64 LAN update machine, run from the repository root:

```bash
npm run desktop:publish
# Equivalent script entry:
bash scripts/desktop-task-publish.sh
```

This builds DEB and AppImage
locally while building a Windows x64 NSIS installer over `ssh wy-win`. All three
packages use the same version. The workflow retrieves and verifies the Windows
installer, signs every package locally, deploys to `/var/www/html`, and checks the HTTP feed and
download sizes. Deployment uses noninteractive `sudo -n` when the web root is
not writable, so this machine must already have the appropriate permission.
The existing Nginx service and signing key must be available. Override the web
root with `MONOCODE_DESKTOP_UPDATE_DIR` only when it serves the configured URL.

The Windows repository is `C:\Users\wy777\Documents\ohmymonocode`. SSH must
work noninteractively; Node/npm, the stable MSVC Rust toolchain, Visual Studio
C++ Build Tools and Windows `tar.exe` must be installed. Override the SSH alias
or repository with `MONOCODE_WINDOWS_SSH_HOST` and `MONOCODE_WINDOWS_REPOSITORY`.
The publisher transfers current tracked and untracked build files (including
uncommitted edits, excluding ignored credentials and outputs) to an isolated
`build/windows-lan/workspace` under that repository. It removes stale source
files while preserving timestamps for unchanged files. It reuses that workspace's
npm dependencies when both root and Host lockfiles, npm/Node versions and install
configuration match the last successful install; otherwise it runs `npm ci`.
Rust and dependency caches stay in the isolated workspace. Platform and Windows
source/dependency timing lines identify which phase is slow on subsequent builds.
The Windows checkout and its Git state remain untouched; no pull/reset is needed.
The signing private key stays on Linux. Windows receives NSIS update entries
(`windows-x86_64-nsis` and the development fallback `windows-x86_64`) in the
same `http://192.168.0.206/latest.json` feed.

LAN builds display their build date as `MM-dd-HHmm`, for example `10-07-0840`.
The timestamp uses `America/Los_Angeles` on both desktop builders and Android,
so the same desktop build has one label regardless of the machine's time zone.
Desktop download filenames and feed notes use this date label; the feed also
includes `displayVersion`. Internally each new source state gets an increasing
SemVer LAN version such as
`0.7.1-lan.1791388800000` for a `0.7.0` checkout, so the Tauri updater can detect
subsequent builds. The generated version override lives in
`build/desktop-publish/tauri.lan.conf.json`; repository and bundled Host version
files retain their original versions. A newer published stable version prevents
an older checkout from replacing it. Both the public key and download signatures
remain required.

Already-published source states are skipped after verifying the existing feed.
Tests, ordinary docs, mobile-only files and generated outputs are excluded from
the source fingerprint; runtime Markdown bundled into the desktop or Host remains
an input. Build/signing failures or source drift leave the previous
live feed in place, including Windows SSH/build failures; the feed advances only
when both desktop platforms succeed. Failed publications must be retried manually.
A shared `flock` under
`~/.local/share/monocode/desktop-updates` (respecting `XDG_DATA_HOME` or
`MONOCODE_DESKTOP_STATE_DIR`) prevents overlapping publications across worktrees.
Avoid direct Tauri builds during this workflow.
The remote `build/windows-lan/build.lock` directory also rejects concurrent builds.
If a process was killed, inspect its `owner.json` and the Windows build processes
before removing that stale lock; it is deliberately not cleared automatically.

Successful source states and build artifacts are kept in ignored
`build/desktop-publish/`. The command reports publication results in the terminal.
Run relevant checks before publishing, and use `npm run test:desktop-publish` to
verify changes to this workflow. Publication does not install updates or push
Git changes.

### Ubuntu / Debian packages

On an Ubuntu/Debian workstation, the repository can install the native Tauri prerequisites and build distributable Linux packages directly:

```bash
npm run setup:linux:deb
npm ci
npm run build:linux
```

The Linux build emits `.deb` and AppImage bundles under `target/release/bundle/`.
Tauri loads `src-tauri/tauri.linux.conf.json` automatically for Linux development and builds.

### Fedora / Enterprise Linux packages

On Fedora, or on an Enterprise Linux 10 system (registered RHEL, Rocky, Alma, CentOS Stream, Oracle), install the release `.rpm` from [GitHub Releases](https://github.com/hardbeat920/monocode/releases/latest). Enterprise Linux needs EPEL first, because `webkit2gtk4.1` is an EPEL package there — CRB is not needed to run MonoCode. On Oracle Linux 10, `epel-release` does not enable `ol10_developer_EPEL`, which is the repository that provides that package. Enable it before installing the rpm:

```bash
# Enterprise Linux 10 only; skip on Fedora.
sudo dnf install -y epel-release   # RHEL: sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-10.noarch.rpm
# Oracle Linux 10, instead of epel-release:
# sudo dnf install -y oracle-epel-release-el10 dnf-plugins-core
# sudo dnf config-manager --set-enabled ol10_developer_EPEL
sudo dnf install ./MonoCode-*.rpm
```

The `.rpm` declares its own runtime dependencies, so `dnf` pulls the WebKitGTK stack for you. GitHub Releases builds that package on Enterprise Linux 10 so it loads on Fedora and EL 10. Building natively links the system WebKitGTK instead of the Ubuntu-built libraries shipped in the AppImage, which avoids graphics issues (e.g. `Could not create default EGL display`) on newer Mesa/Wayland systems.

To build it yourself instead — which also enables EPEL 10 and CRB automatically, since the -devel packages need CRB:

```bash
npm run setup:linux:fedora
npm ci
npm run build:fedora
```

That emits a `.rpm` under `target/release/bundle/rpm/`, installable with `sudo dnf install ./target/release/bundle/rpm/MonoCode-*.rpm`. EL 9 and older are unsupported (`webkit2gtk4.1-devel` only exists in EPEL 10).

### Troubleshooting on Fedora / Wayland

The portable AppImage bundles Ubuntu-built Wayland libraries that can fail against newer Mesa drivers: the app aborts at startup with `Could not create default EGL display: EGL_BAD_PARAMETER`, or opens a blank window. The native `.rpm` above links the system WebKitGTK stack and does not have this problem — prefer it on Fedora.

### Windows packages

```bash
npm ci
npm run build:windows
```

The Windows build emits an NSIS installer under `target/release/bundle/nsis/`.
Tauri loads `src-tauri/tauri.windows.conf.json` automatically for Windows development and builds.

## Contributors

Thanks to everyone who contributes to MonoCode!

[![MonoCode contributors](https://contrib.rocks/image?repo=hardbeat920/monocode)](https://github.com/hardbeat920/monocode/graphs/contributors)

## License

[MIT](LICENSE). Provider names and logos are trademarks of their owners - see [NOTICE](NOTICE).

## Acknowledgments

Special thanks to the project that helps us recognize MonoCode's contributors:

- [contrib.rocks](https://contrib.rocks)
