# IM 渠道契约

`ImChannel.id` 唯一标识配置实例；`platform` 标识平台。`start(handler)` 接收
上游消息并完成传输层启动，`stop()` 必须支持部分启动后的资源清理，
`send(threadId, message)` 发送调用方提供的回复。当前平台目录尚未实现该契约。

`ImIncomingMessage` 包含 conversation、messageId、senderId 和 text；
conversation 包含 channelId 和 threadId。provider 保留用户原文，负责原生消息转换。
`ImOutgoingMessage` 包含 text 和可选 replyToMessageId。

`ImRouteHandler` 接收原消息、可选 sessionId 与 reply 函数，不自动调用 agent。
会话绑定不创建 MonoCode 会话。未知渠道或与来源渠道不一致的消息被拒绝。

运行时状态为 stopped、starting、running、stopping、failed。注册仅允许在
stopped 状态；重复启动已 running 的实例无副作用；空注册表不能启动。
failed 状态需要先重试 stop 清理。导入 SDK 工厂不能代表渠道已启动。
