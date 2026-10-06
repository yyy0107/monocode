# Data Model: Host 常驻个人助理

所有新字段为可选或有迁移默认值。时间是 UTC epoch milliseconds。公开类型位于 `src/features/assistant/model/assistant.ts`。配置 revision 只在用户修改设置时增加，生命周期 tick 不使正在编辑的设置过期。

## Assistant

`assistants` 每 Host 至多一行，通过固定 singleton key 约束。

| 字段 | 语义 |
| --- | --- |
| id / name / revision | 稳定身份、用户名称、配置修订 |
| enabled / lifecycle | enabled；idle / running / paused / backoff / interrupted / failed / disabled |
| harness / model / modelSettings | 现有 provider 与模型配置 |
| brainSessionId / brainGeneration | 当前专用执行会话与代次；不能跨 provider 重用 |
| runtimeMode / targetRuntimeMode | 现有 RuntimeMode；默认 full-access，用户可调整，目标可显式覆盖 |
| policy / policyVersion | 动作权限、project scope 和当前授权修订 |
| triggers | user / event / schedule 三类开关；默认开启 |
| nextRetryAt / error | 可见退避及故障 |
| backlog | 公开读取时计算；超 100 待处理输入或来源提示延迟，不持久化配置 |
| chatRevision / sourceCursor | 公开聊天 revision 和持久来源收取游标 |
| createdAt / updatedAt | 生命周期时间 |

brain 保存为现有 HostSession，增加 `Session.assistantOwnerId?: string`。专用 workspace 注册为内部 project，`HostProject.kind?: "assistant"`；数据库项目行使用可选 kind 列，旧行为空。公开 projects/sessions 默认过滤内部 brain，助理自己的状态通过专用接口获取。

## PermissionPolicy

动作键见 contracts；`allowedProjects: "all" | string[]`，默认 all，空数组只保留不涉及项目的可用查询。查看受项目范围限制；全局 catalog 查询可用但不能泄漏禁止项目的 cwd、标题或 transcript。新增动作键默认关闭，初始明确声明的完整键集合全开，避免未来升级偷偷增加权限。

打开新项目时尚无 project ID：all scope 且 projects.open 允许才可登记。限制范围时，只允许已允许项目的同一路径，不能借 open 扩张范围。未知键、删除字段后的含糊 patch 和不存在的 project ID 均拒绝。策略只能经用户配置 RPC 修改，agent namespace 无权修改。

runtimeMode 是 provider 权限配置，不是此 policy 的别名；公开设置需说明 Host API 权限与操作系统执行能力的区别。

## AssistantMessage

`assistant_messages(revision, id, payload)`，singleton 配置负责 assistant 身份；每次插入／更新按 chatRevision 递增，保留同 id 更新记录用于增量同步。

| kind | payload |
| --- | --- |
| user | text、attachments 的已授权引用、sentAt、wakeupId |
| assistant | text、brainGeneration、turnId、sentAt |
| session-card | ref、actionId、关联输入 messageId、accepted/queued/running/completed/failed/unknown/unavailable 状态 |
| status | error/pause/backoff/cycle-limit 等用户可处理变化，不写每次无变化 tick |
| input | brain session 的 approval/question 引用、runId、requestId、pending/resolved 状态 |

不存公开 tool/reasoning 消息；原始执行保留在 brain session。文本和 cards 不含 grant、token、内部 scratch 路径。限制与现有 attachment/request body 上限一致，规范化后签名，不接受任意嵌入二进制。

## SessionReference and TurnOrigin

```ts
type SessionReference = {
  environmentId: string;
  projectId: string;
  sessionId: string;
};

type TurnOrigin = {
  kind: "assistant";
  assistantId: string;
  actionId: string;
  wakeupId: string;
};
```

卡片另存标题、项目名和 harness 的快照以支持 tombstone；实时状态按 reference 读取且使用当前授权。`Block.origin?` 和 `QueuedMessage.origin?` 都由 trusted actor 注入，来源不存在时是普通历史。brain 切换不改变稳定 assistantId。

原生刷新使用 providerTurnId／已记录 native binding 对齐并保留 app 元数据；缺少可证明映射时保留 app overlay，不按相同文本猜测，把人的重复消息标成助理。执行开始后冻结该消息的 provenance。

## Wakeup and Source

`assistant_wakeups`：id、assistantId、kind、dedupeKey、sourceRefs、userMessageId、rootCauseId、chainDepth、state、createdAt、claimedAt、retryAt、error。

state：pending → running → completed；运行失败可到 backoff / interrupted / failed。确定未接受的临时失败可 backoff → pending；interrupted 只通过显式 Continue 创建恢复轮，原记录不改成“从未执行”。用户输入高于 event，高于 schedule，同优先级按 createdAt/id。

`assistant_sources`：seq、unique eventKey、sessionRef、eventKind、runId、pendingInputKey、sourceRevision、rootCauseId、createdAt、consumedBy。只存摘要引用，读取时校验目标当前状态。

eventKind：completed / failed / approval / question / interrupted。重复 key 不增加新唤醒。source 写入与引发变化的 session save 同事务；cursor 推进和 wakeup 生成同事务。事务内不调用模型或网络。

因果链状态持久保存于 `assistant_chains`：rootCauseId、windowStartedAt、autoTurns、paused。人类输入开启新 root；周期检查不能重置未解决目标的已暂停自动链。默认 8 轮／15 分钟。参数可配置但必须为有界正整数。

## Action

`assistant_actions`：id、assistantId、requestId、signature、kind、wakeupId、rootCauseId、targetRef、state、result、error；其他 actor 字段保存在 input/origin/targetRef JSON。

- 唯一键 `(assistantId, requestId)`；规范化 kind/input 签名不匹配时报冲突。
- pending → executing → accepted → completed；拒绝可到 denied；确定失败到 failed；外部效果不确定到 unknown。
- accepted 表示持久接受，不能自动解释为 provider 已完成。
- 同 ID 重试返回同结果；unknown 查询可核对已有回执，不自动再次执行。
- 查询已有结果也要检查当前 read 权限与范围，撤权后不泄漏受限内容。
- command ID 从稳定 action ID 派生，保留助理专用前缀；可信 actor 是 engine 调用上下文，不在客户端 JSON 中。
- 非幂等外部动作先保存 executing 意图；create/metadata 的数据库效果与 action／卡片同事务；其余 Engine 命令沿用已有持久 receipt，恢复时核对。engine 的队列出队要复核来源动作的当前 policy。

## Schedule and Watch

singleton 配置 JSON 的 `schedules` 数组：id、assistantId、enabled、intervalMinutes、prompt、timezone、nextRunAt、lastWakeupId、revision。intervalMinutes 为 1..10080，默认 60。timezone 是合法 IANA 名称，默认使用客户端系统时区；周期按 UTC duration 执行，不受夏令时重复小时影响。

singleton 配置 JSON 的 `watches` 数组：id、assistantId、enabled、projectIds、sessionIds、eventKinds、prompt、revision。缺省关注全部允许项目和所有重要事件；读写都受当前 policy 限制，不把订阅当独立授权。

计划 claim 与下一次时间推进原子完成；错过多个周期仅一份 pending 合并记录。暂停不运行，继续按最新状态收取；禁用不新增来源，重新开启从当前基线开始，不补报停用期间所有历史。

## Recovery and retention

- 配置和聊天必须保留；用户明确清空聊天不删除目标会话或影响命令回执。
- 已接受 action、未解决 source/wakeup、unknown 与 active chain 不允许被清理。完整 receipt 签名／结果必须保留到其引用不再可重试，首版不自动清理。
- 恢复先绑定已有 brain，再转换 interrupted 状态、核对已知回执并撤销旧代 grant；最后开始 timer。
- 旧 source 已消费可归档，但不能破坏重复 key 的幂等判定；首版不自动裁剪。
- 存储失败时停止新副作用，保留现有 engine interrupted 行为，显示可恢复错误。
