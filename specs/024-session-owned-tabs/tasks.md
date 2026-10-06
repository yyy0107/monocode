# Tasks: 会话专属标签与分屏切换

**Status**: Scoped implementation and automated checks recorded. Delivery build and Host checks passed; web checks have three unrelated Worktrees assertion failures. Native acceptance remains unverified. Completed tasks below describe automated/component coverage, not native compatibility.

- [x] T001 新增 `WorkspaceTab.surfaceMode` 与会话内 `openSessionAppView`，保留旧独立应用页面 helper，重置会话清除模式。
- [x] T002 保存合法模式并允许不同会话持有同种应用页面；每个会话内部去重，旧独立应用页面兼容去重。
- [x] T003 运行 layout／workspaceSnapshot 回归，验证独立页面、活动面板／活动文档、两种模式、非法模式和重置；2026-10-05 共 127 项通过。
- [x] T004 完成文件、计划及审查的来源路由，App 回归覆盖解析期间切换、关闭／重置和失效来源不更新替代聊天或夺走焦点。
- [x] T005 完成本地及 Host 会话选择与键盘导航恢复本工作区活动面板；保留显式多聊天布局，自动化覆盖目标聊天选择。真实 Host UI 仍未验收。
- [x] T006 接入会话标签栏与分屏／完整模式按钮，复用 SurfaceTabs，补全中英文和可访问名称；设置／语言回归 105 项通过。
- [x] T007 接入共享双向布局动画、隐藏交互／门户约束、稳定挂载与 resize 过渡规则；组件回归覆盖快速反转、reduced motion、嵌套工具轨道和直接 resize。隔离浏览器检查确认聊天／工具填满工作区并返回分屏。
- [x] T008 建立有意义的 App／PaneTree／toolbar 回归，验证跨会话文件／页面独立、活动面板及引用行位置恢复、异步竞态与模式交互；App 36 项、PaneTree／FilePane 相关 25 项、FilePaneNavigation 11 项和生命周期 9 项通过。
- [x] T009 执行并记录 `npm run check:web`（5233 passed／3 failed／13 skipped，工作树 SVG 序列化断言失败）、`npm run test:host`（306 passed／5 skipped，exit 0）及 `npm run build`（exit 0）；详见 verification，不将全量网页检查或未执行场景标为通过。
- [ ] T010 在原生桌面验收重启、窗口转移、编辑器／草稿、真实 PTY、真实 Host 会话、组合 split、rapid reversal 和 reduced motion，记录未验证或不可用项。

## Dependency order

T001 → T002 → T003；T004/T005 依赖模型；T006/T007 依赖模型并可与导航回归并行；T008 在导航及组件稳定后完成；T009 在实现完成后执行；T010 根据可用的原生运行环境验收。

## Scope guard

不修改 `.specify/feature.json` 的 022 指针，不修改旧 feature 记录，不提交、推送、发布或合并。用户主动组成的多会话工作区继续持有工具面板，逐聊天叶子的工具迁移没有完成声明。
