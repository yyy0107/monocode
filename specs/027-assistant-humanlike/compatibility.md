# 助理拟人化 verification

Implemented on 2026-10-05 in the existing dirty `main` workspace; unrelated
uncommitted work was preserved.

## Environment

| Component | Observed version |
| --- | --- |
| Node | v24.16.0 |
| OS | Linux 7.0.0-34-generic |
| Pi | 1.0.4 |
| Codex CLI | 0.160.1 |
| Claude Code | 2.1.289 |

## Automated checks

- `npx vitest run --config host/vitest.config.ts host/assistant host/engine.test.ts host/server.test.ts` — 10 files, 122 tests passed.
- `npx vitest run src/features/assistant` — 39 tests passed.
- `npm run check:web` with `LANG=en_US.UTF-8` — tsc passed; vitest 5360 passed,
  4 failed, all in `src/app/App.appViews.test.ts` (workspace tab and window
  controls; assistant is mocked there). Not caused by this change.
  Under the machine default `LANG=zh_CN.UTF-8`, 21 more locale-sensitive tests fail
  because they expect English output.

## Real Host and provider evidence

Isolated Host (`serve --data-dir <scratch> --port 3791`), two temporary git
projects, paired test device; Host stopped afterwards.

- **Tested: Pi brain `pi:openai-codex/gpt-5.6-sol`.**
  - The request "列出项目并 1 分钟后提醒我检查 README" first produced a separate
    acknowledgement bubble, then `activity=projects.list`, then a reminder
    created through `reminders.create` with the correct due time. The final
    reply used the configured name ("Wy").
  - A follow-up sent 10 s into the running turn was steered: marked read within
    1 s, answered in the same turn, no separate wakeup.
  - It answered the time question with the correct Asia/Shanghai local time
    (06:22 when the Host clock was 22:22 UTC).
  - With no client RPC in between, the reminder fired at its due second, the
    assistant re-read projects, and posted one follow-up in the "partner" tone
    (with an emoji). The reminder state became `fired`.
- **Tested; control unavailable: Codex brain `codex:gpt-6.1-sol`.** The
  acknowledgement bubble and persona worked. Every control call failed with
  "Host control access is unavailable for this process" because this machine's
  `~/.codex/config.toml` sets `shell_environment_policy.inherit = "core"`, which
  strips `MONOCODE_CONTROL_*`. This predates this feature and also affects 022.
  The assistant reported the failure honestly instead of claiming success.
- **Unavailable: Claude Code `claude:sonnet` and Pi `anthropic/*`.** Provider
  returned 401 invalid bearer token under the isolated Host. Not exercised.
- **Not exercised with a real model:** `<msg_break/>` splitting. The model sent
  separate assistant blocks instead. Splitting is covered by Host regressions.
- **Untested:** OMP, OpenCode, Cursor, Grok, FX, Hermes, Antigravity; native
  desktop and phone GUI (settings covered by DOM tests only).

## Known limits

- Bubbles from an automatic (event/schedule) turn are published together and
  start typing simultaneously in the client.
- Reminders share the scheduled-check trigger; pending ones fire once when the
  trigger is re-enabled.
