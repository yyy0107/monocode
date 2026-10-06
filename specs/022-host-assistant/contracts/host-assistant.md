# Contract: Host assistant v1

这是已实现的 assistant.v1 接口；验证覆盖见 compatibility.md。

## Transport and capabilities

沿用认证 `POST /rpc`、`HOST_PROTOCOL_VERSION = 1`、environmentId 和设备 token 校验。支持的 Host 在 `environment.describe.capabilities` 加 `assistant.v1`；缺失时客户端不发送这些 RPC。不会把 device token、brain transcript、grant 或内部命令 journal 放进公开结果。

| RPC | params | result |
| --- | --- | --- |
| assistant.get | `{}` | 配置、当前 lifecycle、harness/model、policy、triggers、nextRetryAt、公开 revision；未配置返回 null |
| assistant.configure | `{commandId, expectedRevision, patch}` | 配置 revision 与持久 receipt |
| assistant.messages | `{afterRevision?, limit?}` | `{revision, entries, hasMore, nextRevision}`，可分页增量，limit 1..100 默认 50 |
| assistant.send | `{commandId, text, attachments?}` | `{commandId, messageId, wakeupId, revision}`，仅代表持久接收 |
| assistant.control | `{commandId, action: "pause" | "resume" | "disable" | "enable" | "cancelTurn", expectedGeneration?}` | 持久 receipt 与 lifecycle |
| assistant.respond | `{commandId, messageId, brainGeneration, runId, requestId, decision? , reply?}` | 对仍 pending 的 brain 输入的接受结果 |

configure patch 支持 name、harness、model、modelSettings、runtimeMode、targetRuntimeMode、policy、triggers、schedules、watches 和有界自动链限制；用户操作不能指定脑会话 ID、generation、grant、来源或 card 内容。配置信息验证使用已有 catalog 和 RuntimeMode；provider 未提供能力时明确报 unavailable。

公开 assistant 消息可含 `streaming?: boolean`（缺省为非流式）。用户轮次生成期间以稳定 ID、首次 createdAt 和递增 revision 提供完整文本快照；最终快照设为 false。旧流式快照可被新版替代，revision 允许有空洞；客户端按 ID 合并最新 revision，不把每个增量当成新气泡。取消／故障／重启结束流式状态并保留部分回复。自动巡检仍缓冲至完成，以保留无变化静默语义。

公开 user 消息新增可选 `readAt?: number | null`：null 表示持久接收但仍未处理，时间戳表示 Host 已 claim 对应用户 wakeup、开始处理。读取回执与 claim 在同一事务更新，失败一起回滚；保留原始 createdAt，以新的消息 revision 同步到所有客户端。重试与重启不清除既有回执。该状态不表示任务完成或模型成功响应。旧 Host／旧历史缺少字段时不推断已读或未读，不影响展示和发送。

所有 mutation 幂等键为 `(environmentId, commandId)`，先核对保存的签名／receipt，再检查新请求的 revision；重复旧成功请求返回旧接受结果，不因当前 revision 改变误拒。不同 payload 使用同 ID 报 conflict。send 和 messages 的读权限仍使用现有 device auth；token 被撤销后拒绝。

暂停立即阻止新的 control 动作并停止当前 brain 后续执行；不会取消已经接受的目标任务。resume 遇到 interrupted 时明确表示开始恢复处理，读取 ledger 后运行，绝不重发未知外部副作用。disable 保留记录并停止来源收集。

## Agent control namespace

CLI：`monocode-control assistant ACTION [--input FILE|- | --json JSON] [--request-id ID]`。复杂输入优先文件或 stdin。单行 JSON 回包 `{ok, requestId, result? , error? , code?}`。

TCP namespace 为 `assistant`。grant 由 Host 注入 brain 进程环境，绑定当前 brain session/generation，并在每轮刷新。旧闲置 provider 进程先停止并恢复原生绑定，随后注入新 grant；普通子进程不能继承助理 grant，编排 lead 的 control grant 不能用于此 namespace。校验输入前后与实际执行前核对 grant 的生命周期和当前 policy。agent 输入不得包含 author、assistantId、policyVersion 或 credential 等 Host 所有字段。

`--request-id` 是一个逻辑动作的稳定 ID；超时重试同 ID 同输入。返回 accepted 不代表完成；unknown 不得换 ID 重试。既有 `control ACTION` 及 lead/worker 行为保持兼容。

## Actions and permission map

以下键是完整初始权限集合，默认 true。项目相关动作均检查 allowedProjects；动作输入中 session 必须属于其 project 和本 environment。

| Action | 权限键 | 输入／语义 |
| --- | --- | --- |
| agents.list / models.list | catalog.read | 当前全部可用 provider/model，含能力与错误；不泄漏受限项目配置 |
| projects.list | projects.read | 允许范围内项目；隐藏内部 brain project |
| projects.open | projects.open | cwd；all scope 可登记，限制范围只能使用已允许项目 |
| sessions.list / sessions.get / sessions.activity | sessions.read | 归档／worker 可查看；支持 cursor/limit，get 指定 revision 和最多 100 blocks |
| sessions.create | sessions.create | projectId、harness、model、modelSettings?、runtimeMode?；自动 session card |
| sessions.send / sessions.steer | sessions.send | sessionRef、text、attachments?、intent?；steer 必须 provider 支持且 runId 仍有效 |
| sessions.configure / sessions.compact | sessions.configure | 现有配置／compact schema；不改变助理自身配置 |
| sessions.cancel | sessions.cancel | sessionRef、当前 runId |
| sessions.approve | sessions.approve | sessionRef、runId、requestId、allow/deny；仅当前输入 |
| sessions.answer | sessions.answer | sessionRef、runId、requestId、UserQuestionReply |
| sessions.queue | sessions.queue | 现有 queue schema；steer/edit 同时要求 sessions.send |
| sessions.update | sessions.metadata | title、archived、pinned、linkedWorkItem；不改变原生 ID 或所有权 |
| sessions.delete | sessions.delete | 确切 sessionRef；保留 card tombstone，沿用现有删除限制 |
| orchestration.get | sessions.read | 公开 run view，无 secret 或 journal |
| orchestration.command | orchestration.control | 现有 edit/confirm/resume/stop/cancelTask schema；保留 revision/generation 检查 |
| orchestration.worker | orchestration.control + 对应 session 权限 | 限定 lead/task/run 的现有 control 动作，经 scheduler，禁止普通 send 写 worker |
| files.list/read/search | files.read | 现有 project/worktree 路径约束 |
| files.create/write/move/copy/rename/delete | files.write | 现有 project/worktree 路径及 checkout reservation |
| git.read | git.read | branches、worktrees、diff、history、PR 状态 |
| git.action | git.write | stage/commit/discard/branch/worktree 等已支持操作 |
| git.publish | git.publish | push、pull、sync、PR 创建等远程副作用 |
| workspace.run | 根据子命令 | allowlist 路由，下述覆盖检查；未知子命令拒绝 |
| actions.get | 对应动作当前 read 权限 | requestId 查询已知接受／结果状态，unknown 只核对 |

`workspace.run` 不能作为独立万能权限：`host/workspace-commands.ts` 的 WORKSPACE_COMMANDS 必须逐项映射 read/write/git.read/git.write/git.publish。`git_push`、`git_pull`、`git_sync`、`git_pr_create` 需要 git.publish；delete/move 的所有涉及路径都检查范围。新增子命令没有映射时不可用。attachments 上传／读取沿用大小、项目和引用校验。

worker 的 message/steer/respond/answer/retry/cancel/review/finish 等只在 run 状态允许时通过 owner，approve/answer 另外需要对应权限；不能用 assistant 身份放松编排原有暂停、集成、scope 和工作区 guard。

平台完整权限不包括修改自身 policy、配对设备／凭据、停止系统 Host 服务、任意执行未声明 workspace 命令。这些属于管理员或实现层能力，而非用户要求的工作控制权限。

## Trusted origin and queue

公开 HostCommand 不新增可自行声明的 origin；JSON 携带身份字段拒绝。engine 提供内部 trusted actor 调用参数，写 `Block.origin` 和 `QueuedMessage.origin`。私有 brain/project 标记也不能通过普通 create 提交。

排队回执保存发送时的授权版本，执行前按当前 scope、sessions.send、enabled 和来源 action 再核对。若已撤权，该项停为 blocked 并保留提示；不使整个普通人的队列失效。人类可移除／接管该队列项，接管产生新的人类动作，不能伪装成原助理重新授权。

block origin 的公开投影只有身份、稳定 action/wakeup 引用，无 credentials。旧 block 缺失 origin 时原样显示。来源必须贯穿 engine direct send、queue、steer、store/sync 和 native metadata reconciliation。

## Receipts, races and errors

- 所有助理写入保存 action intent；create/metadata 与 action/card 原子提交；其他会话命令复用 Host 原子 receipt，恢复时核对。外部效果失败按 known-failed 或 unknown 区分。
- 现有 create/send 回执可核对接受状态；provider 完成取目标 run 状态。API 不承诺模型／Git 外部副作用 exactly-once。
- approve/answer 绑定 brain/target generation、runId 和 requestId；等待期间已经有人处理则 stale-input，不能回答下一条请求。
- 多客户端 configure 使用 expectedRevision；不同动作可并发提交，但 brain 轮次串行。
- public list/get 只返回受当前权限约束的内容，历史 action result 也不能成为撤权后的读取旁路。
- 稳定 code：unsupported、permission-denied、scope-denied、stale-input、conflict、busy、paused、unavailable、unknown-outcome、storage-failed；error 文本可读且不含密钥。
- storage failure 停止新副作用，source/action 恢复优先，不能将保存失败显示成成功。
