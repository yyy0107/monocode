# IM 渠道骨架

日期：2026-10-05。范围：用户要求按 `host/im/core/`、
`host/im/providers/feishu/`、`host/im/providers/telegram/` 与 `host/im/index.ts`
先搭架子。保留现有 npm 依赖和按需导入，不接入 MonoCode，也不创建机器人应用。

要求：

- 渠道契约覆盖消息、收发、启动与停止；同平台多个配置使用不同 channelId。
- 路由向调用方交付原文和可选会话绑定，回复返回同一渠道和 thread。
- 会话映射先使用内存，键由 channelId 和 threadId 共同组成。
- 飞书与 Telegram 目录暴露按需加载 SDK 工厂，导入入口不加载平台 SDK。
- 运行时只启动调用方显式注册的 ImChannel；未注册渠道时启动失败。
- 启动失败释放部分启动的渠道；清理失败保留可重试状态；旧回调不能跨运行期使用。

本阶段不包含平台认证、实际协议收发、持久化、Host 会话执行、UI 或机器人逻辑。
验证必须区分骨架测试与真实平台兼容性。活动功能指针不变。
