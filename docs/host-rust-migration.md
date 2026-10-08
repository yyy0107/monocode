# Host 从 Node 迁移到 Rust：可行性分析与路线

## Context
用户想知道 headless Host（`host/`，以 esbuild 打包成 `build/host/monocode-host.mjs`，再和一个内置的 Node 24 运行时一起分发）能不能改用 Rust 实现。本文是分析和路线规划，尚未实施。

## 现状（实测数据）
- `host/` 非测试代码约 **25.8k 行 TS**（含测试约 41k 行）。最大的几个文件：`engine.ts` 2082 行、`assistant/index.ts` 1418 行、`workflows/service.ts` 1085 行、`assistant/control.ts` 1002 行、`orchestration-workspace.ts` 986 行。
- Host **直接复用前端 `src/` 的 TS 代码**，共约 200 处 import。主要来源：
  - `src/integrations/harness/core` 和 `providers/*`：约 32k 行。这是 Claude/Codex/Cursor/Pi/OMP/OpenCode 等 provider 的协议解析，**桌面端 webview 也用同一份**（`ChildBackend` 抽象，见 `src/integrations/harness/core/child.ts:10`）
  - `features/sessions|connections|assistant|orchestration/model`：协议类型、会话模型
  - `src/integrations/workflow`：约 26k 行，其中 dynamic-workflow 分析器依赖 **TypeScript 编译器 API**
- 对 Node 的硬依赖：
  - `node:sqlite`（19 处，存 `~/.monocode-host/host.db`）
  - `node:vm`：workflow 子进程会执行用户的 TS/JS 工作流（`host/workflows/runtime/child-source.ts`）
  - `host/im`：IM 渠道走 npm SDK（Telegram、飞书 Lark、QQ、微信 `chat-adapter-*`），没有对应的 Rust 实现
  - 内置的 Node 运行时还被拿来跑 npm 发布的 provider CLI（`host/cli.ts` 会把 `process.execPath` 放到 PATH 最前面）
- Rust 这边已有基础：`src-tauri` 约 49.5k 行，里面已经有 `harness.rs`（进程 spawn/kill/write，即桌面端的 ChildBackend）、`pty.rs`、`remote_ssh.rs`、`session_store.rs`、`worktrees.rs`、`skills.rs`，以及 `local_host.rs`（已经在 Rust 里直接读写 host.db 的资源租约表）。

## 结论
**技术上能做，但整体重写性价比很低，不建议。** 原因如下：
1. **最大的阻碍是共享的 provider 协议层。** 约 32k 行 harness 代码同时服务桌面 webview 和 Host。如果把 Host 改成 Rust，要么维护两套协议实现（违反 AGENTS.md 里 Pi/OMP 共享、Desktop/Host 复用 adapter 的约定，每次 provider CLI 升级都要改两处），要么连桌面端一起把协议层搬到 Rust。后者等于重写产品核心，工作量相当于半个仓库。
2. **Workflow 运行时离不开 JS 引擎。** 用户工作流本身就是 TS/JS，分析器依赖 TypeScript 编译器。换成 Rust 也得嵌入 deno_core/V8 或 QuickJS，而 TS 编译器 API 在 QuickJS 上不现实，最后仍然要带一个 JS 运行时。
3. **IM 渠道依赖 npm SDK。** 飞书、QQ、微信的适配器都要在 Rust 里重写，还要跟着平台协议持续维护。
4. **npm 类 provider 本身需要 Node。** 就算 Host 不用 Node，安装包里也可能还得带 Node，用来跑这些 provider CLI。这样体积和依赖上的收益大打折扣。
5. 回归风险高：现有约 15k 行 host 测试是 vitest，迁移后要用 Rust 重写一遍。

## 推荐方案：渐进式、按边界下沉，不整体重写
只把**纯系统层、和协议无关、Rust 里已经有现成实现**的部分下沉，TS 继续负责协议、编排、workflow 和 IM：
1. **进程托管 / ChildBackend**：把 `host/child-backend.ts` 和 `host/provider-guard.mjs` 的职责交给一个 Rust sidecar（复用 `src-tauri/src/harness.rs` 的 spawn/kill/输出上限逻辑）。Host 继续通过现有的 `ChildBackend` 接口调用它，上层代码不用改。收益：进程组清理、Windows 作业对象、输出限流都更可靠。
2. **存储**：`node:sqlite` 目前够用。`local_host.rs` 已经共享同一份 schema，可以把 schema/迁移逻辑抽成一个 workspace crate，Tauri 和 Host（通过 sidecar）共用，免得两边分别实现。
3. **Git/worktree/文件浏览**（`git-worktrees.ts`、`browse.ts`、`workspace.ts`）：Rust 侧已有 `worktrees.rs`/`fs.rs`，可以按需逐个替换。
4. 不动的部分：`engine.ts`、`assistant/*`、`orchestration*`、`workflows/*`、`im/*`，以及全部 provider 协议代码。

如果目标其实是**“分发包不带 Node / 体积更小 / 启动更快”**，更划算的做法是把 Host 打成 Node SEA 单文件（代码里已经出现“SEA 子命令”的说法），或者评估 Bun/Deno compile。这样不用重写，就能拿到单二进制分发。

只有在确实要彻底去掉 JS 运行时的情况下，才值得考虑全量迁移。那就要先把 provider 协议层整体搬到 Rust，桌面端也改成调用 Rust（通过 Tauri command），然后才轮到 Host，规模是多个月级别。

## 用户确认的目标 → 实施路线
用户确认的三个目标：性能/内存、进程管理更稳定、分发不带 Node 且体积更小。**不全量重写**，分三个阶段，每个阶段单独提交、单独验证。

### 阶段 1：Rust 进程托管 sidecar（对应稳定性目标，收益最直接）
- 在 Cargo workspace 里新增 crate，比如 `crates/host-supervisor`，把 `src-tauri/src/harness.rs` 里和 Tauri 无关的 spawn/kill/写入/输出上限逻辑抽进来（`pty.rs` 视情况一起抽）。`src-tauri` 改为依赖这个 crate，桌面端行为保持不变。
- 产出一个小二进制 `monocode-supervisor`：Host 和它之间走 stdio 上的 JSON-RPC。可以复用 `src/integrations/harness/core/jsonRpc.ts` 的消息格式。
- 新增 `host/child-backend` 的 Rust 实现，实现现有的 `ChildBackend` 接口（`src/integrations/harness/core/child.ts:10`）。`harness_spawn/write/kill/kill_all/read_text_file/resolve_*` 这些命令照原样转发。`provider-guard.mjs` 的 fd3 父进程存活检测，改由 sidecar 用进程组（Unix）和 Job Object（Windows）实现。
- 保留 Node 实现作为回退开关，比如 `--child-backend=node`，稳定后再删掉。

**进度（已实现）**
- `crates/process-tree`：从 `src-tauri/src/harness.rs`、`windows.rs` 移植的进程树管理（Unix 进程组、ETXTBSY 重试、TERM→KILL 升级；Windows 挂起后加入 kill-on-close Job Object）。
- `crates/host-supervisor`（二进制 `monocode-supervisor`）：一个长驻进程托管所有 provider 子进程，协议是 stdio 上的换行分隔 JSON（`spawn`/`write`/`kill`/`killAll`，事件 `stdout`/`stderr`/`exit`）。行读取和 64 MiB/8 MiB 上限与 `host/provider-output.ts` 一致；Host 的 stdin 关闭（包括 Host 崩溃）时停止全部进程树；provider 退出后会清理它进程组里残留的子进程（对应 `provider-guard.mjs` 的行为）。
- `host/provider-supervisor.ts` + `host/child-backend.ts`：`HostChildBackend` 优先使用与 `host.mjs` 同目录的 supervisor；`MONOCODE_PROVIDER_SUPERVISOR=<路径>` 可指定其他构建，`=node` 强制回退到原 Node guard。exec/HTTP/SSE/账号环境等仍在 TS。
- `host/package.mjs`：为本机目标或桌面端 Tauri 目标（`TAURI_ENV_TARGET_TRIPLE`）构建并打包 supervisor；交叉打包的其他目标继续用 Node guard。

**尚未做**
- `src-tauri` 改为依赖 `monocode-process-tree`（目前两份实现并存）。需要在能构建桌面端的环境里改并验证。
- 在 Windows/macOS 真机上验证 supervisor（Linux 已验证；Windows 仅通过交叉 `cargo clippy`）。

### 阶段 2：内存与性能
- 先测量，不预设热点：用 `node --cpu-prof --heap-prof` 跑大型同步（`large-sync.test.ts` 的场景）和多会话长时间运行，找出热点。
- 可能的下沉点：provider 大输出的缓冲与截断（`provider-output.ts`）、原生会话扫描与解析（`host/native/*`）、git 读操作。只有测出确实是热点的部分，才搬进 sidecar 并加 RPC 命令。
- 低成本措施先做：限制 V8 堆上限、按需懒加载 workflow 分析器和 IM SDK（避免在启动时就载入 TypeScript 编译器）。

### 阶段 3：分发不带独立 Node
- `host/package.mjs` 目前是“内置 node + host.mjs”。改为 **Node SEA 单文件**：workflow 运行时已经为 SEA 做了适配（`host/workflows/runtime/child-source.ts` 里的 `__zcode-dwf-child` 子命令）。最终产物是一个 host 可执行文件加上 supervisor 二进制，`src-tauri/src/local_host.rs` 的 `bundled_runtime` 也要相应调整。
- 需要留意：npm 类 provider 要用 Node 来启动子进程。SEA 二进制可以通过 `ELECTRON_RUN_AS_NODE` 这类做法作为 node 使用，要验证是否可行；不可行就保留可选的 node 运行时。
- 体积上，SEA 和“node + mjs”差别不大（仍然包含 V8），主要收益是**单文件、免解压、少一层脚本**。要明显缩小体积，得评估 Bun compile，但需要验证 `node:sqlite`、`node:vm` 的兼容性，风险更高，列为可选项。

## 验证（实施各阶段时）
- 每下沉一块，跑对应的 `npm run test:host` 子集，比如 `child-backend.test.ts`、`process.test.ts`、`provider-transport.test.ts`
- Rust 改动跑 `npm run check:rust`
- 用实际的 provider CLI（Claude/Codex/Pi/OMP）在 headless Host 上端到端跑一轮会话，并记录 CLI 版本
