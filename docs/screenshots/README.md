# Documentation screenshots / 文档截图

Captured on 2026-10-09 from actual running MonoCode interfaces. These are screenshots, not generated mockups.

- `desktop-conversation.png`: the actual native Linux conversation page, **1280 × 800**, in a separate window with the empty `monocode-documentation-demo` project. The visible Chinese draft is **unsent**; this capture made **zero model requests**. No private conversation, account details, generated transcript, or edited UI is included. It uses the same existing native binary and live frontend as the settings capture.
- `desktop-settings.png`: the General settings panel of the native Linux development app, captured with `scrot` according to the local-screenshot skill. The tight capture region excludes private conversations, projects, and account information. It uses the existing native binary plus the live frontend from this checkout; no release build was performed.
- `mobile-settings.png`: the actual mobile frontend in a fresh Chrome browser profile at **390 × 844**, scale 1. It is an **unpaired browser preview**, not an Android/iOS physical-device screenshot. No token, account, or conversation was loaded.

截图使用独立空白演示项目（对话草稿未发送）、设置面板和未配对移动前端。只选择窗口/区域，没有后期改图、虚构对话或替换 UI。完整尺寸、版本和 SHA-256 见 [capture.json](capture.json)。仓库图片本地更新不代表已推送到 GitHub；本任务不提交、不推送、不发布版本。Library 上传为交付文件副本，不会发布仓库。

To refresh: inspect the application window identity, navigate to a non-sensitive panel without changing settings, capture only that panel, and verify the resulting image. For mobile, run the actual `mobile.html` in a fresh browser profile at the documented viewport. Preserve the browser/real-device distinction and update capture metadata after visual inspection.
