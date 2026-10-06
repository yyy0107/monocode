# Tasks: 助理拟人化

- [x] T001 共享类型：persona、timezone、reminders、activity（`src/features/assistant/model/assistant.ts`）
- [x] T002 Store 默认值与旧记录兼容（`host/assistant/store.ts`）
- [x] T003 提示词模块：情境、人格、对话风格、`splitReply`（`host/assistant/prompt.ts`）
- [x] T004 configure 校验 persona/timezone（`host/assistant/index.ts`）
- [x] T005 用户与自动回合的气泡拆分（`host/assistant/index.ts`）
- [x] T006 活动记录与清除（`host/assistant/control.ts`、`index.ts`）
- [x] T007 `reminders.create/list/cancel` 与到期入队（`control.ts`、`scheduler.ts`）
- [x] T008 `assistant.control` `cancelReminder`
- [x] T009 brain 引导插话（`host/engine.ts`、`index.ts`）
- [x] T010 `assistant.persona` 能力声明（`host/server.ts`）
- [x] T011 设置页人格与提醒列表、进度文案、中文翻译
- [x] T012 Host 与客户端回归测试
- [x] T013 真实 provider 验收并记录（compatibility.md）
