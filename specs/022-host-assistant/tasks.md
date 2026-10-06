# Tasks: Host 常驻个人助理

**Input**: `specs/022-host-assistant/` 的 spec、plan、research、data-model 和 contracts。

**Status**: 实现与受影响回归已完成；T047 原生 GUI/全部 provider 验收、T048 全量 Web 通过仍未完成，见 compatibility.md。

**Tests**: 依 spec 的 Validation Scope 和 constitution，先建立生命周期、权限、协议及失败回归，再实施。实际 CLI 与 GUI 验收单独记录。

**Organization**: 按四个用户故事交付；路径相对仓库。`[P]` 只允许在共同前置条件完成后处理不同文件。

## Phase 1: Setup

- [X] T001 核对当前 dirty workspace、019/021 所有权规则与运行环境，建立 `specs/022-host-assistant/compatibility.md` 的 tested/untested/unavailable 记录，不修改无关工作。
- [X] T002 定义可选 TurnOrigin、assistantOwnerId、HostProject.kind 和共享 Assistant 类型，在 `src/features/sessions/model/session.ts`、`src/features/connections/model/protocol.ts`、`src/features/assistant/model/assistant.ts` 保持旧数据兼容（FR-005、FR-018）。

## Phase 2: Foundational

- [X] T003 在 `host/assistant/store.test.ts` 建立旧数据库迁移、来源事务、回执冲突、卡片恢复与存储失败回归（FR-012、FR-013、FR-015）。
- [X] T004 在 `host/assistant/store.ts` 和 `host/store.ts` 实现 data-model 的表（schedule/watch 内嵌配置 JSON）、singleton 约束、迁移、chat revision、receipt 和 action/source 原子提交，禁止事务内外部调用（FR-012、FR-018）。
- [X] T005 [P] 在 `host/assistant/policy.test.ts` 验证默认完整键集合、项目范围、撤权、未知 workspace 命令和新能力默认关闭（FR-008、FR-009）。
- [X] T006 在 `host/assistant/policy.ts` 实现声明的全部权限键、scope 校验及当前策略读取，分离 RuntimeMode 与平台权限（FR-008、FR-009）。
- [X] T007 [P] 在 `host/assistant/control.test.ts` 和 `host/orchestration-provider-environment.test.ts`、`host/assistant/provider-environment.test.ts` 建立 namespace、brain generation、grant 泄漏及原 control 兼容回归（FR-009、FR-018）。
- [X] T008 在 `host/control.ts`、`host/assistant/control.ts`、`host/child-backend.ts`、`host/cli.ts` 接入 assistant namespace/CLI 与独立 grant，保留原 control ACTION 参数和 revoke 行为（FR-009、FR-018）。
- [X] T009 在 `host/assistant/index.test.ts`（真实 HostEngine）建立身份伪造、保留 commandId、直接发送／排队／steer 来源、撤权出队及普通消息队列不受影响回归（FR-004、FR-005、FR-009、FR-018）。
- [X] T010 在 `host/engine.ts` 与 `host/store.ts` 实现内部 trusted actor、助理 action 派生命令 ID、来源保存和出队复核，兼容旧普通 receipt；公共 parseCommand 拒绝伪造身份（FR-005、FR-009、FR-012、FR-018）。

**Checkpoint**: 有可信来源、权限与持久副作用边界后再接入真实 brain。不能先发任务再补权限。

## Phase 3: US1 — 全局聊天与派发 (P1)

**Independent test**: 查看两个项目和 provider，创建／发送，目标显示标签，桌面与移动卡片导航准确，关闭客户端后任务继续。

- [X] T011 [P] [US1] 在 `host/assistant/index.test.ts` 和 `host/server.test.ts` 建立手动输入、串行执行、重复 create/send、部分失败卡片、旧能力与公开日志过滤回归（FR-001、FR-003、FR-006、FR-007、FR-012、FR-016）。
- [X] T012 [US1] 在 `host/assistant/index.ts`、`host/engine.ts`、`host/cli.ts` 实现生命周期、内部 project/brain session、provider 绑定、手动唤醒和 idle park；启动恢复不重放运行中的 prompt（FR-001、FR-002、FR-011、FR-013）。
- [X] T013 [US1] 在 `host/assistant/control.ts` 和 `host/assistant/index.ts` 实现 catalog/project/session 查询、create/send/steer、稳定 action、卡片及可见回复／必要输入投影，复用现有附件校验（FR-003、FR-004、FR-006、FR-007、FR-012）。
- [X] T014 [US1] 在 `host/server.ts` 实现 assistant.v1、get/messages/send/基础 configure/control/用户 respond RPC，公共列表隐藏 brain 内部 project，助理查询包含 archived 和 worker（FR-003、FR-012、FR-016）。
- [X] T015 [US1] 在 `src/features/assistant/model/assistantClient.ts` 和 `src/features/connections/model/connections.ts` 实现分页同步、持久 commandId 重试、Host 独立缓存和旧 Host 回退（FR-012、FR-016）。
- [X] T016 [US1] 在 `src/features/assistant/ui/AssistantChat.tsx`、`AssistantSessionCard.tsx`、`assistant.css` 和 `src/shared/i18n/zh-CN.json` 实现 IM 输入／回复／卡片／状态／必要输入，按 UI contract 隐藏工具与思考（FR-006、FR-007、FR-017）。
- [X] T017 [US1] 在 `src/app/App.tsx`、`src/app/shell/Sidebar.tsx`、`src/features/connections/ui/RemoteSession.tsx` 和 `src/features/assistant/model/assistantNavigation.ts` 接入全局入口及确切 Host/project/session 导航，worker 使用只读详情（FR-001、FR-007、FR-016）。
- [X] T018 [US1] 在 `src/mobile/client.ts`、`src/mobile/MobileApp.tsx`、`src/mobile/MobileDrawer.tsx` 接入同一助理聊天、同步、草稿与卡片导航，使用共享组件和本地化（FR-001、FR-007、FR-016、FR-017）。
- [X] T019 [US1] 在 `host/desktop-import.ts`、`host/desktop-import.test.ts`、`src/features/sessions/data/nativeSessions.ts`、`src/features/sessions/model/turnOrigins.ts` 及 `turnOrigins.test.ts` 保留可证明对应的 origin/app overlay，避免按文本误标普通重复消息（FR-004、FR-005、FR-018）。
- [X] T020 [US1] 在 `src/features/sessions/ui/AgentTranscript.tsx`、`src/features/sessions/ui/MessageQueue.tsx`、`src/mobile/MobileMessageQueue.tsx`、`src/shared/i18n/zh-CN.json` 渲染用户侧与队列助理标签，保留普通气泡和复制文本语义（FR-005、FR-017）。
- [X] T021 [US1] 在 `src/features/assistant/ui/AssistantChat.test.ts`、`src/features/assistant/model/assistantClient.test.ts`、`assistantNavigation.test.ts` 验证 20 条日志不展示、卡片同步不重复、删除／断开目标及桌面／移动 ID 映射（FR-005、FR-006、FR-007、FR-012、FR-016）。

## Phase 4: US2 — 完整可配置控制 (P1)

**Independent test**: 每项允许／拒绝动作与 scope 正确；批准／回答竞态、worker 和原生所有权不被绕过。

- [X] T022 [P] [US2] 在 `host/assistant/policy.test.ts` 和 `host/assistant/control.test.ts` 建立完整 action deny 矩阵与代表性允许路径（底层允许语义复用既有 Host 回归）、scope、grant 撤销后 await、重复 approve/answer 和旧 receipt 读取范围回归（FR-008、FR-009、FR-012）。
- [X] T023 [US2] 在 `host/assistant/control.ts` 实现 configure/compact/cancel/approve/answer/queue/update/delete，全量校验 run/input ID 与可选能力，拒绝 agent 修改自己权限／Host 管理凭据（FR-008、FR-009、FR-015）。
- [X] T024 [US2] 在 `host/assistant/policy.ts`、`host/assistant/control.ts`、`host/workspace-commands.ts` 为全部 workspace 子命令建立映射，接入文件/Git/附件范围与 checkout guard，分离 git.publish（FR-008、FR-009、FR-018）。
- [X] T025 [US2] 在 `host/assistant/control.ts`、`host/orchestration.ts` 接入 run/proposal 和 worker 的合法控制路径，保持暂停、scope、review、generation 与 provider 限制（FR-004、FR-008、FR-018）。
- [X] T026 [US2] 在 `host/assistant/store.ts`、`host/server.ts`、`host/assistant/index.ts` 完成配置 expectedRevision、外部副作用 intent/unknown、必要 brain input 响应及撤权时进行中的处理（FR-009、FR-012、FR-013、FR-015）。
- [X] T027 [US2] 在 `src/features/assistant/ui/AssistantSettings.tsx`、全局助理设置入口、`src/shared/i18n/zh-CN.json` 实现动作开关／项目范围／provider/model/runtimeMode 与触发设置，解释 API 与执行权限，使用共享折叠动画（FR-002、FR-008、FR-009、FR-010、FR-017）。
- [X] T028 [US2] 在 `src/features/assistant/ui/AssistantChat.test.ts`（包含设置测试） 验证默认完整权限、设置冲突、暂停、必要输入、双向展开／快速反转／reduced motion 与中英文（FR-006、FR-008、FR-009、FR-017）。
- [X] T029 [US2] 在 `host/assistant/control.test.ts`、`host/engine.test.ts`、`host/orchestration.test.ts`、`host/native-access.test.ts` 覆盖真实控制路径、两方抢答、已撤权排队、worker 禁止普通写入和原生 guard（FR-004、FR-008、FR-009、FR-012、FR-018）。

**MVP checkpoint**: US1+US2 完成后才达到首版可用助理范围；只完成文档、空界面或 create/send 不算完整交付。

## Phase 5: US3 — 事件跟进 (P2)

**Independent test**: 关闭客户端后重要事件触发；重复、storm 和自触发不丢任务、不无限循环。

- [X] T030 [P] [US3] 在 `host/assistant/events.test.ts` 建立稳定 completed/input/error 分类、native Host 刷新、worker 事件、去重、own-brain 与标题/delta 排除回归（FR-010、FR-011、FR-018）。
- [X] T031 [US3] 在 `host/assistant/events.ts` 和 `host/store.ts` 实现保存事务中的 source journal 与提交后 Host timer 收取，保持 source/revision 原子性，不依赖客户端 polling（FR-001、FR-010、FR-012）。
- [X] T032 [US3] 在 `host/assistant/index.ts` 和 `host/assistant/store.ts` 实现 durable cursor 收取、2 秒合并、每批 50 来源、最多 100 内存摘要、持久溢出和用户优先串行处理（FR-010、FR-011、FR-012）。
- [X] T033 [US3] 在 `host/assistant/events.ts`、`host/assistant/control.ts`、`host/assistant/scheduler.ts` 实现 source/action/session 因果链继承、8 轮/15 分钟限制、暂停提示和定时不能绕过的链冷却（FR-011、FR-014）。
- [X] T034 [US3] 在 `host/server.ts`、`src/features/assistant/ui/AssistantSettings.tsx`、`src/shared/i18n/zh-CN.json` 接入持久 watch 筛选和提示，scope 撤销立即生效（FR-009、FR-010、FR-017）。
- [X] T035 [US3] 在 `host/assistant/index.ts` 和 `src/features/assistant/ui/AssistantChat.tsx` 实现有意义结果通知、卡片实时状态、延迟/chain-limit 提示，无变化不写气泡（FR-007、FR-011、FR-014、FR-015）。
- [X] T036 [US3] 在 `host/assistant/index.test.ts`、`host/assistant/events.test.ts`、`host/assistant/scheduler.test.ts` 验证超 100 来源恢复、无客户端、与用户输入并发、10 秒收取及持久链限制（FR-001、FR-010、FR-011、FR-012）。

## Phase 6: US4 — 定时、重启和退避 (P2)

**Independent test**: 无客户端仍定时；错过多个周期只一次；中断显式继续、限流退避和未知动作不重放。

- [X] T037 [P] [US4] 在 `host/assistant/scheduler.test.ts` 建立 确定时钟参数的周期 claim、nextRunAt、停机合并、时区、暂停和限流退避回归（FR-010、FR-014、FR-015）。
- [X] T038 [US4] 在 `host/assistant/scheduler.ts` 和 `host/assistant/store.ts` 实现有界 interval、UTC 时间、原子 claim/推进、持久 backoff 和自动重试资格判断（FR-010、FR-012、FR-014、FR-015）。
- [X] T039 [US4] 在 `host/assistant/index.test.ts` 和 `host/assistant/store.test.ts` 注入 create接受/card前、executing外部效果、brain running、存储失败等崩溃点，验证不重放和 pending 恢复（FR-012、FR-013、FR-015）。
- [X] T040 [US4] 在 `host/assistant/index.ts`、`host/engine.ts`、`host/cli.ts` 完成恢复顺序、停机撤 grant、Pause/Disable/Continue、action 核对和 stale generation 隔离（FR-001、FR-011、FR-012、FR-013、FR-018）。
- [X] T041 [US4] 在 `src/features/assistant/ui/AssistantSettings.tsx`、`src/features/assistant/ui/AssistantChat.tsx`、`src/shared/i18n/zh-CN.json` 完成 schedule 提示、interval/timezone、nextRetryAt 与可恢复错误控制（FR-014、FR-015、FR-017）。
- [X] T042 [US4] 在 `src/features/assistant/model/assistantClient.test.ts`、`src/features/assistant/ui/AssistantChat.test.ts` 验证重连不创建重复输入、两客户端竞态、旧 Host、独立 Host 草稿和卡片恢复（FR-012、FR-013、FR-016）。
- [X] T043 [US4] 在 `host/assistant/index.ts`、`host/assistant/index.test.ts` 验证换 provider 新 brain、保留公开聊天、模型不可用／账户失效明确状态，不能跨 provider 复用 session ID（FR-002、FR-013、FR-015、FR-018）。
- [X] T044 [US4] 在 `host/assistant/index.test.ts`、`host/assistant/scheduler.test.ts` 完成 pause事件/pending恢复/限流部分执行/循环冷却及错过多次周期的综合失败回归（FR-001、FR-011、FR-013、FR-014、FR-015）。

## Phase 7: Polish and verification

- [X] T045 [P] 更新 `docs/remote-access.md`、`docs/shared-sessions.md` 的助理生命周期、权限边界、卡片和恢复说明，不把旧 Host 宣称支持（FR-001、FR-009、FR-013、FR-016）。
- [X] T046 核对 `src/shared/i18n/zh-CN.json`、`src/features/assistant/ui/` 及普通 transcript 消费者，补充未覆盖的身份／本地化／可访问性／共享折叠回归（FR-005、FR-006、FR-017、FR-018）。
- [ ] T047 按 `specs/022-host-assistant/quickstart.md` 运行真实 provider/桌面/移动场景和 10 分钟断连验收，记录实际 CLI 版本与全部未验证／不可用组合到 `specs/022-host-assistant/compatibility.md`（FR-001、FR-002、FR-004、FR-016、FR-018；SC-001..SC-007）。
- [ ] T048 执行 check:web、test:host、build 及受影响的 mobile:build；Rust 改动时 check:rust，记录命令／退出码／限制到 `specs/022-host-assistant/compatibility.md`，只按真实通过结果勾选任务（FR-018；SC-007）。

## Dependencies and execution order

1. T001 → T002；基础存储 T003→T004、权限 T005→T006、grant T007→T008；T009→T010 依赖存储、权限和 grant。
2. US1 在 Foundation 后执行，T012→T013→T014→T015→T016→桌面/移动集成；T019/T020 涉及共享消息数据，串行处理同一文件。
3. US2 依赖可信 engine 和 US1 控制入口；可在 US1 UI 集成时开发独立权限控制，不能同时修改 assistant/control.ts、server.ts 等同一文件。
4. US3 依赖 US1+US2；持久 source→收取→因果链→订阅/UI→回归。
5. US4 的恢复基本原则已由 Foundation/US1 建立；定时与恢复综合依赖 US3 链限制，不能定时绕过。
6. 最终验证依赖全部故事；发布、推送和合并不包含在这些任务中。

## Parallel examples

- Foundation：T003、T005 和 T007 可在 T002 后建立不同文件的失败回归；各自实现等待对应回归。
- US1：T011 的 Host 场景先建立；接口稳定后，桌面 T017 和移动 T018 可在不同文件处理，先完成共享导航/聊天接口。
- US2：T022 的 policy/control 回归与 T028 的 UI 回归可在稳定类型后分工，同一个测试文件不可同时修改。
- US3：T030 分类回归和共享类型后的 watch UI 可分工；T031/T032 有事务依赖不可并行。
- US4：T037 fake-clock 回归与 T042 client reconnect 回归可分工；T040 恢复顺序必须等待 ledger 与 scheduler。
- Polish：T045 文档可独立处理，T047/T048 必须在功能完成后执行。

## Implementation strategy

首版先完成 Foundation 与 US1+US2，验证手动委派、可信身份、卡片导航和可配置完整权限。再交付事件跟进，最后完成定时与故障场景。每个故事分别验收，失败／未运行场景不能勾选；不把文档生成或 fake-provider 测试当作产品端到端验证。

共 48 项：46 项实现／受影响回归已核对。T047 部分通过（真实 Host/Codex、Claude 接受与限流、浏览器尺寸）；原生桌面／手机 GUI 和其余真实 provider 未验证。T048 已执行所需命令；原始 SVG 失败已随共享工作区后续变更消失，最新全量 Web 仍有 1 项 mobileSkills 关闭动画断言失败，见 compatibility.md。未验证／失败项目不宣称通过。

## Mobile layout refinement

- [X] T049 按用户参考实现手机专用助理头部／消息气泡／任务卡／胶囊输入，复用共享聊天状态及手机主题。
- [X] T050 实现独立设置页面、操作菜单和返回层级，保留草稿／附件／revision，覆盖双向关闭动画及历史滚动回归。
- [X] T051 浏览器检查 320/390/430px、浅色／深色、长文本、设置、附件及键盘尺寸；记录原生设备未验证边界。
- [X] T052 执行受影响回归、check:web、desktop/mobile build，更新实际验证记录。

手机布局 T049–T052 已实现并记录执行证据；T052 的完成仅表示所列验证已运行并记录，不代表全量 Web 通过。T047 原生 GUI/全部 provider、T048 全量 Web 通过仍未完成。

## Chat and settings refinement

- [X] T053 共享聊天：Markdown 回复、欢迎态、处理中指示、任务卡与审批卡样式；桌面 chrome（头部、设置页、一体化输入区、Host 切换、Escape 关闭）。
- [X] T054 设置表单分区、权限分组、标签式事件／项目选择、条件字段、高级折叠、固定保存栏、未修改禁用与字段校验；同步手机样式。
- [X] T055 更新受影响回归（Markdown、Enter 发送、保存校验）并运行 assistant 与 MobileAssistant 测试、tsc。

## Streaming assistant replies

- [X] T056 将用户轮次文本增量投影为稳定 ID 的公开回复，保留首次时间、结束／取消／故障／恢复状态及静默标记过滤；替换过时流式快照以控制存储量（FR-019）。
- [X] T057 桌面与手机共享活跃轮询及 Markdown 流式渲染，保持单气泡和历史滚动位置，兼容旧消息；自动巡检保留静默语义（FR-019）。
- [X] T058 运行定向 Host／客户端／手机回归和 Web／Host 类型检查，记录未运行真实 provider／原生 GUI 的边界（FR-019）。

## Reply from message menus

- [X] T059 实现桌面右键及手机长按回复，复用菜单与动画，引用填入草稿并聚焦，覆盖移动取消长按、返回关闭和不自动发送（FR-020）。
- [X] T060 验证桌面／手机助理交互及 TypeScript；桌面菜单层级高于助理窗口，记录实际检查和设备验收边界。

## Shared character reveal correction

- [X] T061 从普通会话提取并共用字符 reveal 配置，助理使用稳定 streamingKey，区分首批历史与新增回复；消息高度变化跟随底部（FR-019）。
- [X] T062 建立桌面／手机中文首批、一次性完成回复及历史后续增量回归，验证普通 transcript、助理交互和 TypeScript，记录实际结果。

## Message receipts and metadata

- [X] T063 给用户消息增加可选 Host readAt 回执，接收未读、claim 已读、事务失败回滚、重试／恢复不重置；保留发送时间（FR-021）。
- [X] T064 桌面／手机在气泡外下方显示时间、用户回执和共享复制图标；接入手机原生剪贴板适配（FR-021）。
- [X] T065 验证排队转已读、持久化、桌面／手机布局结构、复制原文／失败、本地化、流式显示及 TypeScript。

- [X] T066 首条消息及相邻消息间隔 >= 5 分钟时居中显示本地日期时间；验证阈值边界、连续消息、回执更新不重分段及既有桌面／手机交互。
- [X] T067 在代发消息气泡上方及桌面／手机队列中显示“来自 {助理昵称}”；Host 持久化可信来源名称并在启动／改名时刷新已有来源，保留正在流式生成的内容及原文复制语义。相关前端 27 项、Host 28 项测试及两端类型检查通过。
- [X] T068 桌面助理改为独立工作区页面，复用标签页导航和快照；调整居中聊天／底部输入栏布局，验证重复打开、切换保留草稿、关闭、隐藏页菜单清理及宽／窄浏览器预览。记录既有工作区测试失败的对照结果。
- [X] T069 统一手机助理设置输入框／文本框的圆角填充、内边距及中性聚焦边缘，去掉蓝色外框与拖拽角标；文本框有界增高并保留错误提示。设置相关 6 项测试及模拟 RPC 浏览器的 320/390/430px 明暗主题、聚焦、长文本、错误和保存检查通过；原生手机未验收。
- [X] T070 手机助理设置复用 MobileSheet 从底部展开／向下收起，保留共享开合、拖动、返回、草稿及关闭期间 inert；隐藏正文滚动条并保留滑动。修复内层选项的视口定位、Escape 和拖动隔离；29 项定向测试、类型检查及浏览器预览通过，实机未验收。
