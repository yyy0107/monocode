# Implementation Plan: 助理拟人化

**Branch**: `main` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

## Summary

在 022 的 Host 助理上做增量：把 brain 提示词抽成 `host/assistant/prompt.ts`（情境、人格、对话风格），在 Host 侧拆分气泡、记录活动、管理一次性提醒，并为 assistant 自有 brain 增加引导插话。客户端增加人格设置、提醒列表和人话进度。所有新字段可选，用 `assistant.persona` 能力协商。

## Constitution Check

- I：只改助理模块及其 Host 接入点（engine 新增 `assistantBrainSteer`、server 能力列表），不重构无关代码。
- II：新字段均为可选；旧记录可读；旧 Host 不收到新字段。
- III：引导复用 provider 现有可选 `steer`，不支持的 provider 保持排队。
- IV/V：Host 回归覆盖拆分、提醒幂等/触发、取消、引导、活动、人格校验与旧记录；真实 provider 验证见 compatibility.md。

## Design

| 能力 | 位置 |
| --- | --- |
| 提示词与人格模板、`splitReply` | `host/assistant/prompt.ts` |
| 气泡拆分、活动清除、插话、`cancelReminder`、配置校验 | `host/assistant/index.ts` |
| `reminders.*` 动作、活动记录 | `host/assistant/control.ts` |
| 到期提醒入队 | `host/assistant/scheduler.ts` |
| 默认值与旧记录兼容 | `host/assistant/store.ts` |
| brain 引导 | `host/engine.ts` `assistantBrainSteer` |
| 共享类型 | `src/features/assistant/model/assistant.ts` |
| 进度文案 | `src/features/assistant/model/assistantActivity.ts` |
| 人格设置、提醒列表 | `src/features/assistant/ui/AssistantSettings.tsx` |

提醒不新增权限键（新增会让旧客户端提交的 policy 校验失败），由“定时检查”开关控制。时区沿用定时检查的时区选择器，不新增独立字段 UI。
