# IM 渠道骨架

独立准备 IM 渠道接口与按需加载的 npm 适配器。当前未连接平台、创建机器人
或接入 MonoCode 会话执行；飞书和 Telegram 的实际收发尚未实现。

```text
host/im/
  core/
    types.ts              # 渠道、消息与路由处理契约
    registry.ts           # 按渠道配置实例注册
    router.ts             # 消息交付和原渠道回复
    sessionMap.ts         # 内存会话绑定
    im.test.ts            # 骨架回归
  providers/
    feishu/adapter.ts      # 飞书 SDK 工厂按需加载与配置类型
    telegram/adapter.ts    # Telegram SDK 工厂按需加载与配置类型
  index.ts                # 公共接口、渠道注册与运行时启停
  index.mjs               # 兼容先前 JS 加载入口
  package.json
  package-lock.json
```

## 使用边界

`ImChannel` 声明 `start(onMessage)`、`stop()` 和 `send(threadId, message)`。
后续平台实现负责认证、原生协议收发与消息转换；当前 provider 文件只加载 SDK
工厂。`ImRuntime` 管理调用方显式注册的渠道，导入或注册均不自动启动连接。
未注册渠道时调用 `start()` 会报错。

通过 `new ImRuntime({ onMessage })` 注入消息处理函数，再用 `register(channel)`
注册实际渠道实现、`start()` / `stop()` 显式控制生命周期。消息处理函数收到
原始消息、可选 sessionId 和 reply 函数；reply 使用消息原来的渠道与 thread。
没有自动回复、agent 或机器人业务逻辑。

`runtime.sessions.bind({ channelId, threadId }, sessionId)` 建立绑定；get 和
unbind 查询或移除。channelId 区分多个平台账户 / 配置实例，不能只用平台名。
映射仅保存在内存中，不创建或持久化 MonoCode 会话。

启动失败按逆序清理已尝试启动的渠道，清理失败可再调用 stop 重试。
启停期间拒绝重入；关闭后或旧运行期的消息与回复被拒绝。

## 按需加载

从仓库根目录的模块使用：

```ts
import { loadFeishuAdapter, loadTelegramAdapter } from "./host/im/index.ts";

const createFeishuAdapter = await loadFeishuAdapter();
// 只有调用相应 loader 时才加载对应 SDK；此时还没有创建适配器或连接。
```

Telegram 使用 loadTelegramAdapter。通用 `loadImAdapter(platform)` 继续支持
telegram、feishu、lark（feishu 别名）、weixin 和 qq。微信和 QQ 当前只保留原有
npm 包和加载函数，尚未建立 ImChannel 实现。

## 依赖与安装

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `chat` | 4.41.1 | 适配器必需的公共运行时与类型 |
| `@chat-adapter/telegram` | 4.41.1 | Telegram |
| `@larksuite/vercel-chat-adapter` | 0.3.0 | 飞书 / Lark |
| `chat-adapter-weixin` | 0.1.4 | 微信 iLink |
| `@amatsuka/chat-adapter-qq` | 0.1.13 | QQ 官方机器人 |

使用 Node 24 原生加载 TypeScript；本次环境为 Node.js v24.16.0、npm 12.0.1。
依赖安装在此目录 node_modules，由仓库原有规则忽略。原上游源码已移出仓库。
MonoCode 根目录依赖、Host 启动路径和活动 Spec Kit 指针均未修改。

从仓库根目录安装和运行骨架测试：

```sh
npm ci --prefix host/im --no-audit --no-fund
npx vitest run --config host/vitest.config.ts host/im/core/im.test.ts
```

实现记录及实际验证结果见 `specs/026-im-channel-scaffold/`。
