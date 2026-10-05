# 设计与实施计划

沿用现有独立 npm 包 `host/im/`，不修改根依赖，不调整 Host 启动路径。

- `core/types.ts`：与 SDK 无关的渠道、消息和路由处理契约。
- `core/registry.ts`：按配置实例 ID 注册渠道，拒绝重复 ID。
- `core/sessionMap.ts`：内存会话绑定；JSON 元组键避免字符串拼接冲突。
- `core/router.ts`：向注入处理器交付消息；提供原渠道回复函数。
- `providers/{feishu,telegram}/adapter.ts`：类型引用和动态 import 工厂。
- `index.ts`：导出契约、注册与运行时启停；保留旧四平台加载 API。
- `index.mjs`：兼容先前 JS 入口，转发至 TS 实现。

Node 24 原生加载 TypeScript，源码仅使用可擦除类型语法；相对 import 使用
`.ts`，与现有 Host TypeScript 配置兼容。启动与停止拒绝重入；失败清理按
启动逆序执行，并保留清理失败的渠道。每次运行使用新 generation，关闭后或
旧运行期的回调和回复不能继续派发。

验证：路由、会话键隔离、启动回滚、清理重试、过期回调回归；独立进程验证
平台模块按需加载且不打开连接；执行 Host 构建和测试。真实平台收发留待后续。
