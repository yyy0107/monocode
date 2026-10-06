# Contract: Assistant IM UI

## Entry and identity

桌面侧栏提供全局 Assistant 入口，移动抽屉为当前 Host 提供同名入口。入口不依赖当前项目；顶部展示助理名称、连接的 Host、运行／暂停／退避状态及配置入口。不同 Host 的身份、聊天 revision 和草稿各自独立。

桌面入口打开独立的工作区助理标签页，复用既有 app view 的切换、关闭和快照恢复；重复打开聚焦已有页面。助理不再使用右侧固定悬浮层。页面顶部居中显示身份，聊天内容居中限宽，胶囊输入框停留在底部；窄面板内自适应。切换普通会话保留助理草稿和滚动位置，隐藏页面关闭其回复菜单，打开目标会话不删除助理页。

首次开启选择现有 provider/model，默认完整平台权限与 full-access 执行模式，可在设置中调整。未配置时显示配置引导；缺少 `assistant.v1` 的 Host 显示 “Assistant is unavailable on this Host”。掉线允许保留草稿，不在未知状态盲目改 ID 重发。

## Chat projection

只渲染 user、assistant、session-card、status、input；不订阅 raw brain transcript。用户消息与回复使用 IM 消息列表、输入框和发送按钮。支持现有附件能力和多行输入，草稿按 Host 保存。聊天切换不卸载正在运行的执行服务。

brain 工具、reasoning、原始 stdout/stderr 不显示。必要 approval/question 作为 input 卡显示；简洁错误包含可执行的恢复入口，不泄漏 grant。失败不能只有永久 typing 指示。首次数据获取和分页有独立状态，旧条目不会因 revision 更新重复出现。

完整日志留在 Host brain session，首版没有默认展示工具／思考的聊天入口。普通开发会话继续使用完整 AgentTranscript。

用户聊天中的助理回复在生成时流式更新同一 Markdown 气泡，结束或中断后显示完已接收的尾部便停止动态显示。桌面与手机共享 250ms 活跃轮询、2 秒空闲轮询；请求完成后再安排下一次刷新。历史无 streaming 字段仍正常渲染，流式更新不得移动旧气泡或强制打断历史阅读。

气泡复用普通会话的字符级打字机效果，按字符边界展示新增文本，不仅设置 streaming 标记。新消息即使首次到达就已完成也逐字展示；生成结束后继续平滑显示尚未展示的尾部。首批加载的历史立即显示，后续同步不会重播已有文字。逐字展开引起高度变化时保持底部跟随。

桌面助理回复使用左对齐圆角气泡、主题自适应底色和细边框，最大宽度为消息区的 88%，与右侧用户气泡区分；Markdown 和流式状态沿用共享渲染。

每条 user／assistant 消息的时间和复制图标独立放在气泡外下方；用户侧右对齐，助理侧左对齐。时间取稳定 createdAt，按本地时区显示时分，悬浮显示完整日期时间。复制仅复制消息原文，不包含时间／状态，复用 CopyTurnButton 的成功／失败反馈；手机使用原生剪贴板适配。用户消息附带 Host 回传的已读／未读状态，含义为助理是否已开始处理该输入；不跟随用户打开、滚动或隐藏聊天变化。旧消息无回执字段时不显示推测状态。

首条可见聊天条目前显示居中的日期／时间；后续条目以相邻条目的 createdAt 比较，间隔 >= 300000ms 时在当前条目前插入相同分隔。小于五分钟的连续消息不插入，即使整段对话已超过五分钟。显示本地时区的月日和 24 小时时分（如“10月5日 14:52”），复用中英文区域格式。分隔不属于气泡，不替换气泡下方时间，流式和回执 revision 不影响分隔。

桌面右键助理回复（或聚焦后 Shift+F10）显示“回复”；手机长按 450ms 显示同一动作，移动超过 10px、滚动、松手或取消会撤销尚未触发的长按。链接与按钮保留自身交互。选择后将所选回复的文本快照作为 Markdown 引用放到当前草稿之前，保留草稿、聚焦输入框，不自动发送。未投递消息待重试或输入不可用时禁用回复。手机复用 MobileSheet 双向动画，返回键先关闭回复菜单；设置覆盖聊天时菜单关闭。

## Session cards

卡片数据来自 Host action 结果，包含：

- 标题、项目、provider/model。
- accepted / queued / running / completed / failed / unknown / unavailable 的本地化状态。
- “Open session” 入口及稳定 environmentId/projectId/sessionId。
- 错误或被删除时的简短提示。

先创建后发送失败仍显示创建结果与发送失败状态；没有文本回复时卡片仍存在。点击通过 `assistantNavigation.ts` 映射真实 Host ID 到桌面本地 shell ID 或移动路由；不能用 cwd、标题或当前项目猜目标。跨项目直接打开对应项目。编排 worker 引用使用现有只读 worker 详情，不强行放入普通聊天列表。

卡片所存 title 仅为历史快照；当前 scope 撤销后仍可显示已有操作记录，但不拉取被禁止的目标内容或提供继续操作。已删除目标保留 unavailable 卡片，点开不给用户创建新会话。断开 Host 的卡片提示连接状态，重连后用原 ID 继续。

## Assistant origin in ordinary conversations

用户侧气泡保留原有内容和操作，气泡上方右对齐显示助理图标及“来自 {昵称}”，昵称取助理设置，由 Host 写入可选的 `TurnOrigin.assistantName`。Host 启动及昵称更改后刷新已有消息和排队消息的来源名称；旧记录缺少名称时回退到本地化 “Assistant”。身份标签不放在气泡内，正文与复制内容不含该标签。来源仅认 Host 提供的 `Block.origin.kind === "assistant"`；文本、block id 前缀和 `monocode` 标志不能制造身份。

队列项提前显示助理标签；送入 transcript 后标签保留。copy 只复制用户文本，不把标签加入任务正文。未执行队列项被人类编辑／接管时清除助理来源，新提交属于人类；已执行消息的可信来源保持不变。普通历史没有 origin 时不增加标签。

## Settings and lifecycle controls

设置包括名称、provider/model、平台动作权限、允许项目、brain/target runtimeMode、三类触发、事件订阅和周期提示。初始动作键全开，用户可以关闭具体权限。平台权限解释文本：

> These permissions control the assistant's MonoCode actions. Agent execution permissions control commands and file access through the selected provider.

解释覆盖范围，不把 API 开关描述成系统沙箱。新增能力默认关闭。修改应用到 Host 并显示保存状态；冲突时刷新当前值，不能用客户端旧 revision 覆盖。

Pause 停止新的助理轮次／动作，不取消已派发目标。Continue 对 interrupted 展示明确恢复状态。disable 保留聊天；cancelTurn 只作用于当前 brain。backoff 显示下一次时间；账户失效显示修复模型配置入口。周期提示无结果时保持静默，不新增“没有变化”气泡。

## Accessibility, animation and localization

所有应用拥有的标签使用 English key 与 zh-CN 字典，用户 prompt、名称和 provider 输出原样。输入按钮、卡片导航和状态有可访问名称，焦点和滚动位置在增量更新时保留。

权限组、事件筛选及详情展开使用 `AnimatedCollapse`；grid panel 使用 `useCollapseMotion` 和 `animated-collapse-size`，双向动画、快速反转、关闭期间禁用交互／portals、reduced motion 均沿用共享实现。运行中的 terminal 若出现于复用详情必须保持挂载。

## Phone presentation

手机布局按 Muse / Project Assistant 参考呈现：顶部居中助理标记与名称、两侧圆形导航，左右大圆角气泡，任务卡嵌入聊天流，底部胶囊包含附件、自动增高多行输入及发送。Host 和生命周期保留为次级信息；操作菜单提供 Settings／Pause／Continue／Disable assistant。没有语音能力时不展示假通话或录音入口。

设置复用 MobileSheet 在底部可滑动面板展示，从下向上展开、向下收起，隐藏正文滚动条，沿用项目主题的 inset cards、触控开关及保存按钮；项目订阅不使用难于手机操作的多选框。返回键先收起菜单，再返回聊天，最后退出助理。聊天草稿、附件与滚动位置在设置切换期间保留，增量同步不能打断历史阅读。安全区域与键盘沿用手机 shell 的 CSS 变量；输入字体至少 16px，主要触控目标至少 44px。设置面板的双向动画、拖动关闭、关闭期间 inert 与焦点恢复沿用 MobileSheet；减少动态效果时立即开合，背景页面不接受焦点。内层选项定位于视口，返回或 Escape 先关闭选项。

设置中的单行与多行文本控件共享圆角填充、内边距和中性聚焦边缘，覆盖通用蓝色外框；错误状态显示红色边缘。多行文本框使用内容增高及最大高度后的内部滚动，无拖拽角标；不支持 field-sizing 的 WebView 沿用固定最小高度和内部滚动。
