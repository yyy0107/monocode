# Implementation Plan: 会话专属标签与分屏切换

## Architecture

沿用 `WorkspaceTab` 作为会话工作区，文件与页面继续保存在 `editorPanes`，终端保持现有 `terminalPanes`／项目停靠区模型。新增可选 `surfaceMode: "split" | "unified"`，缺省分屏；避免增加与现有布局树并行的全局会话面板缓存。

`openSessionAppView(tab, kind)` 通过 `openEditorTab` 只查询给定工作区。旧 `openAppViewTab` 保留为已有独立页面消费者的兼容工具。快照对每个含会话的工作区分别去重应用页面；旧独立应用页面仍可按窗口去重，避免升级后恢复重复的遗留入口。

## Navigation and async routing

`App.tsx` 的会话文件链接传入来源 session ID。文件及审查在第一次 await 前确定 checkout、项目和归属工作区；状态更新仍检查捕获来源有效，完成后仅在同一归属工作区仍活跃时更新可见焦点。会话计划直接查找包含来源 session ID 的工作区。

普通会话选择和会话列表键盘导航通过目标工作区激活，不用替换当前聊天叶子的方式交换聊天。打开其他会话时，已有工具面板的空白聊天不被复用。对于显式多会话工作区，保持布局和原有叶子操作，并验证选择特定聊天仍能到达它。

## UI and lifetime

`PaneTree` 在会话工作区提供本地标签栏及模式按钮。`SessionSurfaceToolbar` 复用 `SurfaceTabs` 的标签选择、关闭、固定、排序及菜单。完整视图在同一栏选择聊天和文件／页面；分屏视图显示聊天与工具面板。

布局模式切换使用共享 `useCollapseMotion` 与 `animated-collapse-size`。`sessionSurfaceGrid` 从现有布局叶子生成稳定轨道，完整视图将选中轨道归一化为可用空间；其他轨道保持零尺寸，嵌套工具面板也沿用此规则。直接 resize 禁用过渡。隐藏中的内容通过共享可见性协议禁用交互和门户；会话、编辑器与运行终端的挂载身份保持稳定，关闭动画结束前不丢内容。

## Persistence and compatibility

`workspaceSnapshot.ts` 接受且保存合法模式，丢弃非法模式以恢复默认分屏。原有 `focusedId` 和 `activeFileId` 持续表示活动面板／文档。`resetTabToSession` 清除模式。窗口转移沿用工作区对象，不需要新的顶层格式。

首版所有权单位是 `WorkspaceTab`。显式多聊天 split 的工具仍由组合工作区持有；逐聊天叶子保存和拖动时迁移工具不在当前实现范围。不得把该边界描述为已验证的逐叶子所有权。

## Verification

先执行 layout、snapshot 与 UI／导航受影响测试，覆盖独立页面、相同文件、临时预览、活动面板恢复、解析竞态、模式切换与隐藏交互。完成实现后执行 `npm run check:web`、`npm run test:host` 和 `npm run build`。Rust 未变更时不新增 Rust 验证要求；当前工作区的既有无关变更不得作为本功能修改或测试结果。

原生桌面、真实 PTY、Host 会话、窗口转移、rapid reversal 和 reduced motion 验收单独记录。不以构建或 mock 回归代替这些场景。

## Current delivery evidence

模型、App 会话归属／异步解析、PaneTree／工具栏、文件导航和设置／语言相关回归已通过。使用实际 PaneTree／SessionSurfaceToolbar 的隔离浏览器检查确认，完整视图下工具和聊天都填满工作区，折叠面板保持挂载且 inert，并能返回分屏；聊天和编辑器是 stub，该检查不等于完整原生应用验收。

最终 Host suite 已运行，结果为 306 passed、5 skipped，exit 0。早期 Host 的类型阻塞和三项失败已由其他工作解决，不能列为当前失败。最终 web suite 为 5233 passed、3 failed、13 skipped；仅工作树 SVG 样式序列化断言失败，已独立复现且不来自本功能。实际构建结果记录在 verification.md。
