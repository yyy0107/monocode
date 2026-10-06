# Implementation Plan: Host 常驻个人助理

**Branch**: `main` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/022-host-assistant/spec.md`

**Status**: 已实现；验收覆盖与限制见 compatibility.md。Spec Kit 脚本报告的 `BRANCH` 是功能标识 `022-host-assistant`，实际 Git 分支仍为 `main`。

## Summary

在 Host 内新增 `HostAssistant` 服务，复用 `HostEngine`、现有 provider adapter、命令回执、会话队列与 `HostControl` 的 agent 驱动模式。每个 Host 一个助理、一份公开 IM 聊天、一个当前 provider 的专用 brain session。Host 调度用户、事件与定时输入，brain 使用受认证的 `assistant` control namespace 操作平台。

公开聊天和 brain transcript 分开存储：聊天只投影回复、卡片、状态和必要输入；完整执行记录继续由既有生命周期处理。操作成功接受时由 Host 自动生成卡片，不依赖模型记得输出链接。目标会话仍为普通会话，发出的消息保持 `role: user`，增加可选可信来源字段。

## Technical Context

**Language/Version**: TypeScript 5.8 项目；本次读取环境 Node v24.16.0；React 19；Tauri 2。

**Primary Dependencies**: 现有 `node:sqlite`、Node 进程／HTTP／TCP、Vitest、React、现有 harness adapters；首版不引入新的模型 SDK、调度库或 WebSocket。

**Storage**: 现有 Host SQLite，新增助理配置、公开消息、唤醒、事件来源、操作与因果链表；schedule/watch 保存于 singleton 配置 JSON；完整 brain 复用 HostSession。

**Testing**: Vitest Host lifecycle/权限/协议/失败回归；Web DOM 与导航测试；真实 provider CLI 和客户端验收另记。

**Target Platform**: 现有 Host 支持的平台；桌面与移动端连接同一 Host。

**Project Type**: 本地持续运行服务及桌面／移动客户端。

**Performance Goals**: 空闲可处理的重要事件 10 秒内纳入运行；事件去抖默认 2 秒；每轮事件摘要最多 50 条、超出继续分页。

**Constraints**: 每个助理最多一轮；默认每 60 分钟检查；事件源持久保存；不自动重放不确定动作；权限可撤销；现有原生和编排所有权不变。

**Scale/Scope**: 每个 Host 一个助理；全部已登记项目和会话；跨 Host 聚合和外部 IM 不在首版。

## Constitution Check

研究前与设计后均通过以下检查：

- I：新增模块和可选元数据服务本功能，保留工作区原有未提交改动，不重构无关桌面／导入功能。
- II：公开协议以 `assistant.v1` 能力协商，旧历史可读；provider 的可选能力不变。
- III：provider 细节留在 adapter，助理调用共享生命周期；若实施中确需修改 `piFamily.ts`，必须加入 Pi/OMP 双回归。
- IV：实际 CLI、回归、浏览器与未验证组合记录于 compatibility.md；不扩大兼容声明。
- V：权限、幂等、恢复和共享消息元数据需要失败回归；交付实现前执行 check:web、test:host、build，Rust 改动时加 check:rust。
- AGENTS：所有新／改动 disclosure 使用 `AnimatedCollapse` 或 `useCollapseMotion`；遵守中英文文本规则。

## Project Structure

### Documentation (this feature)

```text
specs/022-host-assistant/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/host-assistant.md
  contracts/assistant-ui.md
  checklists/requirements.md
  tasks.md
  compatibility.md                 # 实施时记录实际结果
```

### Source Code (repository root)

实现路径如下；测试路径以 tasks.md 和 compatibility.md 为准：

```text
host/
  assistant/
    index.ts                     # 生命周期、串行唤醒、brain 会话
    store.ts                     # 助理专用表与事务操作
    policy.ts                    # action -> 权限映射与范围检查
    control.ts                   # namespace、参数验证、动作执行
    events.ts                    # 重要变化分类与持久来源
    scheduler.ts                 # 周期、退避、循环限额
    errors.ts                    # 公开错误码
    *.test.ts
  engine.ts / store.ts            # trusted actor、消息来源与提交后观察
  control.ts / child-backend.ts    # 独立 grant、进程环境隔离
  cli.ts / server.ts              # 生命周期和 RPC 连接
  desktop-import.ts               # 原生刷新保留 app 元数据
src/features/assistant/
  model/assistant.ts              # 共享公开类型
  model/assistantClient.ts        # 同步、回执及重试
  model/assistantNavigation.ts    # Host 身份 -> 导航
  ui/AssistantChat.tsx
  ui/AssistantSessionCard.tsx
  ui/AssistantSettings.tsx
  ui/assistant.css
src/features/connections/model/protocol.ts
src/features/sessions/model/session.ts
src/features/sessions/data/nativeSessions.ts
src/features/sessions/ui/AgentTranscript.tsx
src/features/connections/ui/RemoteSession.tsx
src/app/App.tsx / shell/Sidebar.tsx
src/features/settings/ui/SettingsView.tsx
src/mobile/client.ts / MobileApp.tsx / MobileDrawer.tsx
src/shared/i18n/zh-CN.json
```

**Structure Decision**: Host 持有状态与权限；客户端只投影、同步和提交用户意图。保留现有 RPC 轮询和能力协商，不迁移已有 transport。

消息回复菜单由 `useAssistantReplyMenu` 管理桌面右键与手机长按手势，chrome 插槽分别复用 ExplorerMenu 和 MobileSheet。引用直接作为可编辑 Markdown 草稿发送，沿用现有 outbox 幂等重试，无需变更 Host 协议。手机菜单沿用共享关闭动画及返回优先级。

消息下方的 AssistantMessageMeta 展示 createdAt、用户 readAt 和共享 CopyTurnButton；正文与元信息是同一消息行的兄弟节点，气泡只包裹正文／附件。手机为共享 renderer 提供 mobileTranscriptPlatform，包括原生复制能力。Host receive 写 readAt:null，claim 在现有事务中以同一用户消息 ID 写首次 readAt 时间；重试保留首次值，使用既有 revision 同步，无需新增 RPC 或数据表。

共享 AssistantDateSeparator 根据相邻条目的 createdAt 插入首条／五分钟间隔日期分隔，作为聊天列表的直接子节点居中显示；消息使用稳定 ID 的 Fragment，保留原有气泡与打字机组件实例。

普通会话代发消息的来源标签置于气泡上方，使用“From {value0}”及 Host 提供的可选 TurnOrigin.assistantName。Host 在动作派发时取配置名称，并在启动／改名后的 tick 刷新匹配的历史及队列来源；刷新前 flush，保存后同步 live value，防止覆盖未落盘的流式文本。旧来源缺名称时使用本地化 Assistant。

## Phase 0: Research

依据当前代码核实基础，决策及替代项见 [research.md](research.md)。现有 `HostControl` 的 grant 仅限 lead，不能直接给助理复用其 worker 权限；新增 namespace 与 principal，保留旧 control 行为。当前 Host 代码已有 `NativeSessionGuard`，与 feature 021 的旧“不支持 headless continuation”范围描述存在差异：本功能遵循当前 guard 的实际支持，不自行扩大或绕过。

## Phase 1: Design

### 1. Host ownership and brain lifecycle

`HostAssistant` 在 engine 恢复与 control endpoint ready 后初始化，server 宣告能力前完成恢复。助理 brain 在独立空工作目录运行；建立内部 project 和 `Session.assistantOwnerId` 分类，默认不出现在普通项目／会话列表。内部 project 的类别采用兼容旧行的可选 `HostProject.kind`。目标会话没有该分类，正常列出。

brain 使用已有 HostEngine provider 绑定、发送、停机和 idle park。新轮带精简状态摘要、用户目标和 control 使用说明，按需拉取具体会话。Host 不将全库 transcript 注入 prompt。记录 brain generation，换 provider 时新建 brain，旧 brain 保留历史；换模型遵循原 adapter 能力，不跨 provider 复用原生 ID。

开启待命不等于连续模型调用。关闭桌面不影响服务；退出 Host 先拒绝新输入并停计时器、撤 grant，再按现有 engine 规则结束运行。暂停撤销新操作 grant、取消／标记当前 brain 轮，保留已派发的普通任务。禁用停止新的来源收集；暂停保留去重来源供继续处理。

### 2. Separate IM thread projection

新增公开聊天 journal，包含 user、assistant、session-card、status、input 五类条目。用户唤醒时，brain 已持久保存的 assistant 文本增量即投影到稳定 reply ID，带可选 streaming 字段；完成时更新同一条目。后续快照保持首次 createdAt，并替换过时的流式快照，revision 保持递增以兼容分页／重连。取消和故障结束流式状态，重启恢复保留部分文本。reasoning 和 tool 不返回公开聊天 API，静默标记前缀暂缓显示。自动事件／巡检仍在结束后判断是否发布最终回复。用户消息与 wakeup 在同一事务持久接收。

由操作回执生成卡片：接受 sessions.create 后立即写 session ref；接受 send 后显示 accepted/queued，目标完成后更新状态。模型回复引用卡片只是可选文本，不决定卡片真实性。brain 若等待批准或问题，投影必要输入；不把需要用户处理的请求藏进执行记录。

桌面侧提供全局入口；移动侧提供当前 Host 的助理入口，复用同一聊天组件与导航身份映射。客户端以 revision 增量获取，重连只读恢复。运行时每次请求完成后间隔 250ms 同步，其他状态间隔 2 秒。`AgentTranscript` 与 `AssistantChat` 共用 `useTranscriptRenderingPlatform`，通过 TranscriptPlatformContext 给 AgentMarkdown 提供字符级 reveal 和已展示长度；助理回复传稳定 streamingKey。首次同步（包括空历史）完成后到达的新回复从零逐字显示，已加载历史不重播。复用现有 usePacedText，不另建打字计时器。ResizeObserver 观察消息内容高度，逐字增长时跟随底部但不打断历史阅读。

### 3. Trusted control and permissions

助理调用 `monocode-control assistant ACTION --input FILE|- --request-id ID`。复用 loopback transport 的读写与 launcher，新增 `namespace: assistant`，grant 绑定助理 ID、brain generation 和生命周期。普通 agent、编排 worker 和 device RPC 不获得此 grant。

平台权限默认全开，包括查看／打开项目／创建／发送／配置／批准／回答／取消／队列／元数据／删除／编排／文件／Git／受支持 workspace 动作。Settings 提供动作组开关及项目范围，逐个 workspace 子命令映射到实际权限，未知命令拒绝，不能通过 workspace.run 绕过。

每次执行使用当前策略与目标状态。长期 await 后、队列出队前重新核对；撤权阻止未开始动作。批准和回答绑定实际 request ID，编排操作仍走 scheduler；worker 禁止通过 ordinary command 获得第二个写入者。grant 不允许修改自身权限、device 凭据或 Host 生命周期管理。

`runtimeMode` 管理 brain／目标 agent 的 shell、文件和 provider 权限，是独立配置。平台开关是 Host control API 的强制边界，不是同一操作系统用户下原生 CLI 的文件系统沙箱。UI 必须直说这一范围，不声称关闭 files.write 能阻止一个有 shell 权限的 provider 直接写文件。更强的系统隔离是单独工程范围。

### 4. Provenance and durable actions

内部 trusted actor 参数用于 Engine 调用，不开放客户端自填身份。`Block.origin` 与 `QueuedMessage.origin` 是可选字段，记录 kind、assistantId、actionId 和 wakeupId。外部 command 的 origin 字段拒绝；内部 brain 标识及助理来源不能由 RPC 或 CLI 输入覆盖。

直接 send、排队、steer、客户端同步、持久化及原生历史刷新均保留来源。不要用 `monocode`、`internal` 或 `managed:` 字符串替代可信身份。角色仍为 user，目标 provider 接收原有任务文本，不靠 prompt 前缀制造标签。

每个 control request 在 `assistant_actions` 保存规范化签名与稳定 ID。创建和发送复用 Host 命令回执；会话修改等纯数据库效果与 action 接受／卡片写入同一事务。外部副作用先写执行意图再执行，记录结果；崩溃留下 unknown 时不自动重放。重复同 ID 同参数返回已存结果，改参数报冲突。

Host command ID 使用助理专用保留命名空间，外部提交拒绝该前缀；actor 身份纳入助理 action 签名，旧普通命令回执签名兼容。删除等操作保留 card tombstone，不因目标不存在丢失操作记录。

### 5. Durable event inbox and causal limits

`HostStore.save` 的重要变化在保存事务内产生独立 source journal，由 Host 的 1 秒 timer 收取已提交来源。不依赖桌面轮询、不持有整个 transcript，不将最多 2000 revisions 的现有 session events 当唯一恢复来源。

分类依据稳定 completed run ID、pending input key、错误及 interrupted 转换；事件 key 唯一。原生事件以 Host 实际同步到的状态为准，本功能不新增无客户端时的外部 CLI 文件 watcher。忽略自己的 brain、流式 delta 和仅标题变化。捕获编排 worker 事件但动作走编排 owner。

用户消息是独立输入且优先；事件默认 2 秒合并、每批最多 50 个引用。只有一轮运行，后续事件等待。内存中最多 100 个待处理摘要，超出保留持久 source 游标并分页收取，向用户显示延迟而非丢事件。

动作携带 rootCauseId 和自动链计数，派发会话的完成继承因果关系；新的人类消息开启新的根。默认每条自动链 15 分钟内最多 8 轮，触顶暂停该链并保存提示。定时 tick 使用当前订阅和状态，并对自动链冷却进行检查，不能通过新 tick 绕过同一未解决目标的限制。

### 6. Schedule, retry and recovery

首版周期使用 intervalMinutes（最小 1，最大 10080），默认 60；nextRunAt 使用 UTC epoch，timezone 仅决定展示。定时 claim 和推进 nextRunAt 在同一事务，错过多个周期只产生一次合并 wakeup。关闭客户端不会停计时。

重启后 pending 恢复；running wakeup 标 interrupted，不自动重发 brain prompt。已知接受结果可从回执恢复卡片；未知动作需要核对。用户 Continue 先加载操作 ledger，再明确开始新一轮处理，已有 action ID 不能变成新效果。

限流默认退避 30 秒、60 秒、120 秒，封顶 15 分钟；仅确定未接受的模型调用自动重试，部分执行或结果不确定转 interrupted。配置／调度失败进入 failed；provider 轮次错误进入 interrupted，等待修复或明确继续。重试时间与状态持久保存。没有新消息、卡片、必要输入或错误时，不增加无变化通知。

## Phase 2: Delivery and Validation

详细任务见 [tasks.md](tasks.md)，按四个用户故事交付。最小可用版本包含 US1 和 US2：全局聊天、查看、创建／发送、可信标签、卡片导航和完整可配置控制。之后加入 US3 的事件协调与 US4 的定时／恢复；基础阶段已包含不重放语义，不能到最后才补。

必须覆盖可信来源伪造、排队撤权、权限绕过、原生锁、worker 所有权、卡片幂等、事件风暴、循环限制、模型限流和提交中崩溃。UI 验证双向动画、输入可用性、旧 Host 与不同 Host ID 映射。

实现交付前执行 `npm run check:web`、`npm run test:host`、`npm run build`；若 Rust 变更加 `npm run check:rust`。移动构建改变时加 `npm run mobile:build`。真实 CLI、桌面和移动验收按 [quickstart.md](quickstart.md) 记录，不把 fake-provider 回归当成真实兼容证据。

## Desktop workspace presentation

桌面助理注册为 AppViewKind assistant，侧栏经 openAppViewTab 聚焦或创建独立工作区标签页，AppViewHost 管理保留挂载及快照恢复。DesktopAssistant 改为常规布局容器，移除 overlay 状态和 Escape 关闭；工作区负责关闭页面。聊天通过 SurfaceVisibilityContext 关闭隐藏页回复菜单，设置焦点也遵循页面可见性。专用 assistant-workspace 样式将桌面消息和输入栏居中限宽，窄面板使用 container query；移动展示不变。

## Mobile layout refinement

`AssistantChatChrome.ts` 定义展示插槽，`AssistantChat` 继续拥有 RPC、回执、设置 revision、输入响应及消息同步。`src/mobile/MobileAssistant.tsx` 提供手机头部、菜单、设置底部面板、胶囊输入栏及 Android 返回处理；`src/mobile/assistant.css` 独立限定手机样式。设置复用 `MobileSheet` 的底部开合动画、共享 `useCollapseMotion`、拖动、焦点管理与返回逻辑；权限／唤醒继续使用 `AnimatedCollapse`。设置开启时聊天及背景不可交互，关闭动画结束前保留内容并禁用交互。设置正文隐藏滚动条并保留滑动；不透明外层取消 backdrop-filter 和持久 transform 层，让内层选择器按视口定位。内层已处理的键盘事件不重复关闭外层。读取历史时轮询不强制滚到底，发送或保持底部时跟随新消息／视口变化。手机设置项目订阅用触控开关列表。验证包括草稿、返回层级、设置冲突、附件／重试、历史阅读和 320/390/430px 浏览器尺寸；原生设备仍单独验收。

设置文本控件在手机样式中覆盖通用输入框与 focus-visible 样式，使用 12px 圆角、10px/12px 内边距、主题填充色和中性聚焦边缘；错误边缘优先。单行输入至少 46px，多行文本框 112–240px，通过 CSS field-sizing 增高并保留内部滚动回退，禁用拖拽缩放；聚焦过渡遵循 reduced motion。用真实组件的模拟 RPC 浏览器预览检查明暗主题、三种手机宽度、输入与保存。
