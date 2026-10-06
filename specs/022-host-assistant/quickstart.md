# Quickstart Validation: Host 常驻个人助理

**状态**：接口已实现。已执行项及剩余 GUI/provider 场景见 compatibility.md；下列步骤仍用于完整验收。

## Prerequisites

- 完成 tasks.md 对应故事，Host、桌面／移动客户端支持 `assistant.v1`。
- 使用隔离的 Host data-dir 与两个测试项目，至少两个可用 provider，使用既有登录。不要用真实需要保留的任务试验删除／取消。
- provider CLI、Node、OS、测试方式和结果记录到 `compatibility.md`；记录真实版本，不复制示例版本。
- 若验证后台常驻，按现有 `docs/remote-access.md` 安装／启动 Host 服务；运行测试时短周期用 1 分钟，恢复默认 60 分钟。

## Automated checks

实施中先运行受影响回归。例如新增文件后：

```bash
npx vitest run --config host/vitest.config.ts host/assistant/index.test.ts host/assistant/control.test.ts host/assistant/policy.test.ts host/assistant/scheduler.test.ts host/assistant/events.test.ts
npx vitest run src/features/assistant/model/assistantClient.test.ts src/features/assistant/ui/AssistantChat.test.ts
npm run check:web
npm run test:host
npm run build
```

Rust 改动时额外 `npm run check:rust`；移动集成后 `npm run mobile:build`。最终将实际命令、退出码与失败限制写入 compatibility.md。fake provider 通过不能证明真实 provider 能执行 control CLI。

## US1: Chat, dispatch and navigation

1. 桌面开启助理，选已登录 provider/model。设置保留默认权限，事件／定时可暂关以隔离手动场景。
2. 输入“列出所有项目和智能体，在项目 A 用另一个可用智能体新建会话检查测试失败”。
3. 验证实际 catalog、普通会话创建、任务接受／排队状态、助理聊天卡片及目标用户气泡的标签。
4. 点击卡片，在项目 A 的确切 Host session 打开；移动端点击同一卡片进入同一会话。
5. 对正在运行的目标发送后续任务，确认排队。断开全部客户端至少 10 分钟，目标继续；重连不重复派发。
6. 模拟 20 条工具／思考记录，公开聊天只显示回复、卡片与必要输入，不含这些正文。

## US2: Permissions and existing owners

1. 在测试会话依次执行 configure、approve、answer、cancel、queue、metadata、delete、file/Git 和 orchestration 动作。
2. 关闭对应 permission 或排除项目，再重试；副作用为零。检查 workspace 子命令不能绕过文件／Git 限制。
3. send 入队后撤销 sessions.send，完成当前轮；该助理队列项被阻止，普通人消息仍正常。
4. 用普通 device 请求提交 origin、brain 分类或助理保留命令 ID，全部拒绝，不出现可信标签。
5. 给原生会话启动外部 CLI，助理写入遵守 guard。worker 写入经 scheduler；暂停 run、stale request 和不支持 steer 都准确报错。
6. 通过用户回答与助理回答的竞态验证 stale input，不回答下一条问题。

## US3: Events and causal loops

1. 开启事件，断开客户端。让三个目标分别完成、失败和等待输入。
2. 验证 Host 重要变化生成持久 source，空闲助理 10 秒内收取；重连看到有意义结果。
3. 同一 source 提交多次、同一 mutation 重试 10 次，无重复业务效果或卡片。
4. 制造超过 100 个待处理来源；摘要有界且剩余可分页恢复，不丢来源。用户聊天优先于事件。
5. 让助理反复派发并完成任务；自动链到 8 轮／15 分钟上限停止并提示，自身日志和定时 tick 不绕过限制。

## US4: Scheduling, recovery and failures

1. 设 1 分钟检查，提示“有新进展才告诉我”；断开客户端验证执行和持久 nextRunAt，无变化不发通知。
2. 停 Host 超过两个周期后重启，至多一次合并检查；暂停期间不运行。
3. 在 create 接受后、card 投影前制造崩溃；重启从 ledger 恢复一张卡，不再创建会话。
4. 在外部操作 executing 未返回时崩溃；状态 unknown，需要核对而非自动重试。brain 运行中的重启显示 interrupted，Continue 新轮先读取 action ledger。
5. 模拟确定未接受的限流和部分执行后的失败：前者可退避，后者停止重放；模拟账户失效和存储失败，状态可解释。
6. 更换 provider、新旧 Host、不同连接、双向动画／快速反转／reduced motion、中英文切换和移动导航分别记录结果。

## Reporting

逐项记录 automated、real CLI、desktop GUI、mobile GUI、unverified/unavailable。实际结果见 compatibility.md；未运行的原生桌面／手机与其他 provider 场景保持未验证。
