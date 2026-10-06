# Research: Host 常驻个人助理

日期：2026-10-05。依据当前未提交工作区代码；没有进行 Muse 产品行为核验，也未运行真实助理模型。

## 1. 复用 Host 与 provider 会话

**Decision**: 专用 brain session + Host 调度服务。

**Rationale**: `host/cli.ts` 已有 detached start、serve 与系统服务安装；`host/engine.ts` 已有持久命令、队列、provider bind 和异常恢复；`host/providers.ts` 接入十个 provider。`host/control.ts` 的 orchestration lead 已通过 loopback CLI 控制任务，适合扩展独立 namespace。

**Alternatives considered**: 内置模型 API loop 会新增 SDK、API key 和工具运行时；桌面常驻会随窗口退出，均与已选方向不符。

## 2. 公共聊天独立于执行日志

**Decision**: 公开 IM journal 与 brain HostSession 分离。

**Rationale**: `src/features/sessions/ui/AgentTranscript.tsx` 面向完整开发日志，直接隐藏几个 DOM 块仍会同步工具／思考正文并影响普通 transcript。专用投影明确只提供用户要求的消息、会话卡片和必要输入，跨 provider 切换也能保留聊天。

**Alternatives considered**: 完全重写 provider message schema 不必要；只让模型输出 Markdown 链接无法保证卡片真实且在部分失败时存在。

## 3. 平台权限与可信身份

**Decision**: 新 principal + live policy，消息 origin 只由 Host 注入。

**Rationale**: 当前 `Block` 和 Host send 没有 sender 字段；`monocode` 表示 app access，`internal` 隐藏消息，均不适合标签。当前 device auth 只验证 token，没有提交者 principal 传到消息。使用可选 `origin` 保持旧历史兼容，权限由 Host 在执行前检查。

**Alternatives considered**: 让客户端自填 author 可以伪造；只靠 system prompt 无法落实可配置权限；给 brain 一个 device token 会暴露没有动作限制的通用入口。

**Boundary**: 此权限覆盖 Host 控制入口。原生 CLI 如果有 unrestricted shell，仍有操作系统层面的能力；应独立显示 runtimeMode，不能把 API 权限开关宣称为 OS 沙箱。

## 4. 保留现有 RPC

**Decision**: `assistant.v1` 能力与增量 revision 轮询。

**Rationale**: `host/server.ts` 使用认证 `POST /rpc`，桌面和移动端已有重连与轮询实现。事件触发在 Host 内发生，不需要新增 push transport 才能长期运行。

**Alternatives considered**: 新增 WebSocket 有连接恢复和认证成本，本功能先复用已有 transport。

## 5. 事件、定时与幂等

**Decision**: 保存事务内写来源 journal，串行处理、限量摘要与持久回执；UTC 周期调度；禁止不确定动作自动重放。

**Rationale**: 现有 session events 有保留上限，客户端收到的 receipt 只表示持久接受。`HostEngine` 已明确说明 provider dispatch 不与 SQLite 原子提交，不能承诺外部副作用 exactly-once。助理只能通过幂等提交和 uncertain 停止重试避免重复。

**Alternatives considered**: setInterval 加内存队列会在重启时丢进度；每个 stream event 唤醒会造成成本和反馈循环；重启直接继续上一 prompt 可能重复操作。

## 6. 原生与编排支持遵循当前实现

**Decision**: 查看所有 Host session；原生写入经过 guard，worker 控制经过 orchestration owner。

**Rationale**: 当前 `host/engine.ts` 已有 `NativeSessionGuard` 和 native lease。Feature 021 spec 的“不支持 headless continuation”描述滞后，不能据旧描述设计一套旁路。`specs/019-host-orchestration/contracts/host-orchestration.md` 明确 public command 不能独立修改 worker。

**Alternatives considered**: 助理当作数据库超级写入者会破坏外部 CLI 锁和 scheduler，违背共享所有权。

## 7. 首版产品边界

**Decision**: 每 Host 一个助理，内置 IM、默认完整平台权限、三类唤醒开启；60 分钟检查；不新增外部 IM 或向量记忆。

**Rationale**: 完整覆盖用户已经明确的方向，先用现有持久会话、订阅、配置和 action ledger 管理上下文。

**Alternatives considered**: 多 Host 联邦与独立知识库会扩展身份、凭据和索引范围，另作功能。

## Evidence limits

- 已核对当前源码、package scripts、Spec Kit 模板和相关 contracts。
- 当前执行环境 Node v24.16.0；这不是 provider CLI 版本记录。
- 未运行真实助理、未验证十个 provider 的 shell/control 能力；支持与否要通过实施验收标记。
- 无 `.specify/extensions.yml`，没有需要执行的扩展 hooks；仓库未安装 agent-context 更新脚本，遵循 AGENTS.md，不虚构命令。
