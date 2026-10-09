<p align="center">
  <img src="public/monocode.png" alt="ohmymonocode" width="80" />
</p>

<h1 align="center">ohmymonocode</h1>

<p align="center">A desktop and mobile workspace for coding agents and a personal assistant.</p>

[English](README.md) · [简体中文](README.zh-CN.md)

A personal fork of [MonoCode](https://github.com/hardbeat920/monocode), focused on Chinese localization, desktop and mobile workflows, and assistant features. Independently maintained; thanks to the upstream authors and contributors.

![ohmymonocode desktop workspace with a conversation and terminal side by side](docs/screenshots/desktop-workspace.png)

<p align="center">
  <img src="docs/screenshots/mobile-sessions.jpg" alt="ohmymonocode mobile client: devices and conversations" width="280" />
</p>

## Features

- **Multiple agents** — use installed providers such as Claude Code, Codex, OpenCode, Pi and omp in one workspace.
- **Project workspace** — conversations, split panes, terminals, files, Git branches and worktrees.
- **Personal assistant** — task delegation, followed conversations, reminders and editable memory.
- **Desktop and mobile** — connect to a shared Host to access project conversations across devices.
- **Everyday tools** — notes, inbox, automations and workflows, with English and Simplified Chinese interfaces.

## Get started

Install and sign in to at least one supported agent CLI. To run the desktop app from source, prepare Node.js 24+, a stable Rust toolchain and the native Tauri dependencies for your system.

```bash
git clone https://github.com/yyy0107/ohmymonocode.git
cd ohmymonocode
npm ci
npm run tauri dev
```

On Linux, install native dependencies first with `npm run setup:linux:deb` (Ubuntu/Debian) or `npm run setup:linux:fedora` (Fedora).

For the mobile client, follow the [setup guide](mobile/README.md) and connect using your Host URL and device token. Switch the interface language in **Settings → General → Language**.

## Documentation

- [Shared conversations](docs/shared-sessions.md)
- [Remote access](docs/remote-access.md)
- [Mobile setup and builds](mobile/README.md)
- [Assistant evaluation](host/assistant/eval/README.md)
- [Manual development refresh](scripts/dev-refresh.md)

## License

[MIT](LICENSE). Original MonoCode attribution is preserved. Provider names and logos belong to their respective owners; see [NOTICE](NOTICE). Evaluation datasets retain their source licenses.
