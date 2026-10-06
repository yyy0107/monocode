# Feature Specification: 助理拟人化

**Feature Branch**: `main`（沿用当前工作区；不创建或提交分支）

**Created**: 2026-10-05

**Status**: Implemented — 验证记录见 compatibility.md

**Input**: 用户希望 Host 常驻助理（specs/022-host-assistant）更像真人。经讨论选定：时间情境感知、可配置人格（预设模板 + 自定义）、分条发送与先回一句确认、可见的人话进度、兑现“稍后再看”的一次性提醒、运行中可插话。主动性保持“只在有结果或承诺时”，不加每日简报。长期记忆不在本次范围。

## User Scenarios & Testing

### User Story 1 - 有时间感和人格的对话 (Priority: P1)

用户在设置里选择“轻松搭档”，填写称呼和语气要求。助理用对应口吻、称呼回复，知道当地时间和距上次聊天多久。

**Acceptance Scenarios**:

1. **Given** 已选预设与称呼，**When** 用户发消息，**Then** 回复遵循预设口吻、称呼用户，并跟随用户语言。
2. **Given** 选择“自定义”且未填写描述，**When** 保存，**Then** 阻止保存并提示填写。
3. **Given** 旧 Host 不支持人格，**When** 打开设置，**Then** 不显示人格字段，也不发送这些字段。
4. **Given** 助理所在时区与 Host 不同，**When** 用户问时间，**Then** 按设置时区回答。

### User Story 2 - 像 IM 一样分条与先确认 (Priority: P1)

**Acceptance Scenarios**:

1. **Given** 任务需要工具，**When** 助理开始处理，**Then** 先出现一条简短确认气泡，再给结果。
2. **Given** 回复包含分条标记，**When** 流式输出，**Then** 拆成多个气泡，只有最后一个处于流式状态；未完整的标记不显示。
3. **Given** 处理中，**When** 助理执行平台动作，**Then** “处理中”提示替换为人话进度（如“正在查看你的项目…”），回合结束后清除。

### User Story 3 - 兑现承诺的跟进 (Priority: P1)

**Acceptance Scenarios**:

1. **Given** 助理答应“1 分钟后提醒”，**When** 到期且无客户端连接，**Then** 助理自行开启一轮，重新读取状态后告诉用户。
2. **Given** 同一提醒请求重试或 Host 重启，**Then** 只创建一次、只触发一次。
3. **Given** 关闭“定时检查”唤醒，**When** 助理尝试创建提醒，**Then** 被拒绝并说明原因。
4. **Given** 设置页显示待办提醒，**When** 用户取消，**Then** 该提醒不再触发。

### User Story 4 - 运行中插话 (Priority: P2)

**Acceptance Scenarios**:

1. **Given** 助理正处理用户消息且 provider 支持引导，**When** 用户再发一条（无附件），**Then** 立即送入当前回合，消息标记已读，不再单独排队。
2. **Given** provider 不支持引导、带附件或当前是事件/定时回合，**Then** 保持原排队行为。

## Requirements

- **FR-001**: 助理配置 MUST 支持可选 `persona`（预设 secretary/partner/engineer/custom、自定义描述 ≤ 4000、称呼 ≤ 100）与 IANA `timezone`；旧记录读取时补默认值，时区回退到定时检查时区。
- **FR-002**: 每轮提示 MUST 包含当地时间与星期、距上次聊天的人话间隔、已派发任务运行/排队数、待办提醒。
- **FR-003**: `<msg_break/>` MUST 将回复拆为多条气泡，ID 稳定、首段沿用旧 ID 以兼容历史。
- **FR-004**: 助理执行动作时 MUST 发布可选 `activity`，回合结束、暂停或失败时清除。
- **FR-005**: 新增 `reminders.create/list/cancel` 动作与 `assistant.control` 的 `cancelReminder`；受“定时检查”开关约束，最多 50 个待办，1 分钟至 7 天；幂等；到期入队一次并重置该因果链计数。
- **FR-006**: 运行中的用户回合 MUST 尝试引导插话，失败时退回排队，不重复处理。
- **FR-007**: Host MUST 声明 `assistant.persona` 能力；客户端仅在存在时发送人格与时区、显示提醒取消。
- **FR-008**: 新界面文本 MUST 提供英语和简体中文；展开区块复用既有动画组件。

## Out of Scope

- 长期记忆、每日简报、更积极的主动提醒。
- 客户端按顺序逐个打出同批到达的多条气泡（自动回合一次性发布的多段会同时开始打字）。
