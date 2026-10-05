# 骨架验证记录

日期：2026-10-05。环境：Linux，Node.js v24.16.0，npm 12.0.1，Vitest 3.2.7。
依赖版本固定在 host/im/package.json 与 package-lock.json，不依赖平台 CLI。

| 检查 | 实际结果 |
| --- | --- |
| npm ls --prefix host/im --depth=0 | 5 个直接依赖，成功 |
| npm run host:build | TypeScript 检查和 Host 打包成功；完整 Host 测试的 pretest 也再次通过 |
| IM 骨架回归 | 5 项通过；覆盖会话隔离、原文路由、启动回滚、清理重试、旧回调和回复拒绝 |
| npm run test:host | 43 个文件通过，1 个文件跳过；320 项通过，5 项跳过 |
| Node 原生 TypeScript / JS 兼容入口 | 12 个独立进程检查通过：2 个入口 × telegram、feishu、lark、weixin、qq、未知平台 |
| 按需加载 / 导入无连接 | 入口导入不加载 chat 或任何平台包；仅所选平台包加载；fetch 与 Socket.connect 拦截期间检查通过 |

跳过项来自现有 Windows 专用测试，本次 Linux 环境不能据此证明 Windows 验收。
完整 Host 测试包含现有诊断日志，最终退出码为 0。

未执行 check:web、前端 build 或 Rust 检查：本阶段未修改这些运行路径。
未执行平台登录、飞书 WebSocket、Telegram webhook、微信 / QQ 消息收发，
未创建 Chat 机器人，也未接入 MonoCode 会话。provider 当前只有工厂加载函数，
实际 ImChannel 实现、持久化和产品验收均属于后续范围。
