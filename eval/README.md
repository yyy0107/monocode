# MonoCode 助理评测

[最新公开集验收：200条参考回放通过；真实smoke 10/14，44请求/$0.05268](docs/PUBLIC_DATASETS.md)。

新增公开集：**6 个可执行来源、176 道不同公开原题、200 个变体**；加上原有原创集共 **352 道不同任务、376 个可执行条目**。四个新集为 tau-bench、API-Bank、HotpotQA、BIPIA；BFCL/LongMemEval 已接入程序判分。[公开集运行说明](public/README.md)。下文原始套件的历史成绩与 judge 校准结论保持不变。

176 个**原创**中英文场景，覆盖 16 个能力维度；同时提供硬断言、隔离工具、真实现有 agent 适配器、独立 LLM judge、原生 Host 回归和 JSONL/JSON/Markdown 报告。没有将原创案例冒充 BFCL、tau 或其他官方数据集。原始套件既有实测：16维度各2例，23/32通过；独立完整smoke 4/6，10个格式有效的judge输出因校准失败均标为untrusted，正式综合通过率为N/A。[最终验收与最简命令](docs/FINAL_ACCEPTANCE.md)。

在 MonoCode 仓库根目录运行，复用现有 Node 24、TypeScript、esbuild、Zod、Vitest 依赖，不增加生产依赖：

```bash
node eval/bin/eval.mjs validate
node eval/bin/eval.mjs run --mode reference --out /tmp/monocode-reference-run
npx vitest run --config eval/vitest.config.ts
npx tsc --noEmit -p eval/tsconfig.json
npx prettier --check 'eval/src/**/*.ts' 'eval/native/**/*.ts' 'eval/tests/**/*.ts' 'eval/bin/*.mjs' eval/vitest.config.ts
```

输出目录必须是新目录，已有报告不覆盖。`reference` 只验证 harness/fixtures/评分器，不是模型成绩。Host 测试需要本机 loopback socket 权限；禁止 socket 的容器会报 `EPERM`，这属于环境失败。

真实模型测试（使用 CLI 已有认证，不读取/复制/打印密钥）：

```bash
# Claude Code：原生工具、hooks、自定义配置、MCP、skills 全关。
node eval/bin/eval.mjs run --mode claude --tier smoke --model sonnet \
  --judge-model opus --max-requests 24 --max-usd 2 --request-usd 0.08

# Pi：使用已登录的 provider/model ID，可先 pi --list-models 查询。
node eval/bin/eval.mjs run --mode pi --tier smoke \
  --model openai-codex/gpt-5.6-luna --judge-model openai-codex/gpt-6.1-sol \
  --max-requests 24 --max-usd 1 --request-usd 0.04

# 指定类别/用例与种子；max-requests 包含 agent 和 judge 的所有请求。
node eval/bin/eval.mjs run --mode pi --category recovery --limit 3 --seed 29 \
  --model openai-codex/gpt-5.6-luna --max-requests 12 --max-usd 0.48 --request-usd 0.04
```

`--max-usd` 是保守请求预留预算；Claude 还传递 provider 的每次调用限额。Pi 没有 CLI 美元硬上限，USD 预留只是估算，实际用量来自返回 usage；订阅计价信息未必等于额外收费。`costUsd: null` 表示未知，绝不当成免费。每次调用有超时和输出上限，整例有步数上限；账号/模型不可用触发熔断，其余未跑项标为 skipped。默认不自动重试真实 provider 请求，以免重复扣量；工具故障重试由被测 agent 在相同 fixture 中处理。

有工具场景要求真实 CLI 输出决策 JSON，执行动作的是内存隔离环境；无工具场景也接受直接的用户可见文本或 JSON，内容仍由硬断言检验。加载当前源码的 `buildBrainPrompt`，但这**不是完整生产 Host+UI 端到端测试**。所有邮箱、日历、文件修改和会话委派都在模拟状态里；不连接真实邮箱、不写项目文件、不支付、不修改账号。原生 Host 的测试仅使用临时目录与测试数据库，provider 是受控假对象。支持边界见 [COVERAGE.md](docs/COVERAGE.md)。

## 数据与评分

- `data/cases.jsonl`：176 例；JSON Schema 见 `schema/case.schema.json`，严格检查未知字段和参数。
- `data/references.jsonl`：独立脚本化参考轨迹，只供 harness 验证，绝不放入 agent prompt。
- `data/author_cases.py`：逐项原创的数据源；修改后运行此脚本重新生成 JSONL。
- `src/environment.ts`：确定性 reset/seed、白名单工具、request-ID 幂等、未知结果/限流/故障注入、项目范围与路径保护。
- `src/scoring.ts`：调用参数、次数、顺序、最终状态、精确 JSON、语义关键字段、引用来源和原文证据、允许副作用及最大次数。安全与状态硬断言不能被 judge 覆盖。
- `src/runner.ts`：多轮脚本事件、上下文 replay、步数上限、错误分类及可追溯 trace。
- `src/adapters.ts`：真实 Claude/Pi 子进程，无 shell 字符串拼接，超时杀进程组，临时目录清理。
- `tests/native-host.test.ts`：直接针对实际 Host 的集成回归。

用例 `support` 的 `native` 表示该能力属于产品原生范围，**不表示这一 JSON fixture 已通过生产端到端验证**。`simulated-extension` 表示评测专用扩展；`unsupported` 验证不可用时诚实降级。每个类别的正向能力和降级能力应分开看。

每例包含 `id/category/language/support/tier/prompt/tools/fixture/assertions/allowedEffects/maxEffects/rubric/events/maxSteps/provenance`。`events.afterStep` 在该轮工具返回后注入后续用户消息；支持状态变化，不能把未来消息提前泄露给 agent。`state.path` 使用点分路径，例如 `reminders.0.prompt`；包含点的文件名请对整个 `files` 对象断言。`call.success` 省略表示任意结果，true/false 分别要求成功/错误。正文或提醒的自然表述尽量用关键字段/regex 或 judge，不应无故要求与参考答案逐字相同。

新增例子的流程：先写具体任务和能力边界 → 构造最小 fixture → 写硬断言与允许副作用 → 写参考轨迹验证可解性 → 加一个错误解/恶意解检查评分器能拒绝 → 选入小批量真实 smoke → 人工检查有争议失败，再扩大量。更改数据会改变 SHA256；旧报告不可当成新版本成绩。

## LLM-as-judge

评分维度为任务完成、证据、澄清、沟通、安全、恢复，每维 0–4，rubric 在 `src/judge.ts`。输入隐藏模型身份、参考轨迹与已有硬判分；输出必须包含每维分数、逐字可验证的证据和理由。交换任务与候选材料顺序跑两次，分差大于 1 标为 `inconsistent / trust=invalid`，错误码为 `ORDER_DISAGREEMENT`。解析失败、证据不存在、缺维度、模型不可用均标为 `unavailable`，不计能力失败。

必须指定不同 judge 模型；若实际返回的模型 ID 与 agent 相同，拒绝自评。不同模型也不是人类 ground truth；双顺序一致只是一致性检查，不能排除共同偏差。Judge 不改变硬断言结果。`data/judge-calibration.json` 必须有匹配模型、协议哈希、证据文件哈希及维度覆盖的通过记录；当前校准失败，10个原始scored输出被标为untrusted并排除正式rubric/综合通过率。缺失/无效/过期校准也默认排除。模型输出和工具内容作为不可信数据传给 judge，仍需抽查提示注入和偏见；初版没有宣称通过人工校准。

## 报告与错误

每个运行目录包含：

- `results.jsonl`：逐例调用/结果、最终状态、失败断言、模型输出、种子、案例 SHA256、usage、judge 证据。
- `summary.json`：按能力/语言/支持边界的通过率、状态计数、成本/token/延迟、数据 SHA256。
- `report.md`：可读汇总和失败 ID。

`passed/failed` 才进入程序能力分母；`environment_error/budget_exhausted/skipped` 排除且单列。原始报告永久保留；复测不能抹除原先结果。正式结论见 [实际运行记录](docs/RESULTS.md)。

## 公开 benchmark

[来源与许可清单](data/sources.json)记录官方 URL、固定 commit、代码/数据许可差异、接入状态和环境要求。[官方许可审计](data/license-audit.json)包含此次读取的许可与哈希。BFCL 已导入五类共 30 题原始子集及 24 条答案；LongMemEval 已导入六题型共 18 题 oracle 原始子集（含 4 题拒答、保留整数/字符串答案及完整证据）。两者都通过格式/哈希验证，**未跑官方模型评分**；其余 10 个来源仍仅为清单。

```bash
# 默认只展示固定版本的接入计划，不下载或执行任何代码。
python3 eval/bin/import_benchmark.py --source bfcl
python3 eval/bin/import_benchmark.py --source tau2

# 可选：下载许可清楚的固定上游源码快照；不会运行其评测。
python3 eval/bin/import_benchmark.py --source bfcl --fetch --out /tmp/bfcl-pinned
```

GAIA gated、ToolSandbox 自定义许可、AssistantBench 代码 Open RAIL-S 与数据 Apache-2.0、WorkArena 实例审批、AppWorld 受保护数据、长上下文/VM/在线评测均有单独限制，脚本不会绕过。不要把上游静态问题塞进本地模拟器后称为官方复现。版本会变化，特别是 tau2 仓库当前含 tau3；比较历史结果必须选择匹配 commit、任务和 evaluator。

评测代码和原创 fixtures 采用仓库根目录 MIT 许可；外部材料保留自身许可，代码许可不自动覆盖所有数据。


## 有预算的跨维度实测与公开数据导入

真实入口的复用部分和绕过部分见 [ENTRYPOINT.md](docs/ENTRYPOINT.md)。以下 campaign 默认只打印计划；显式 `--execute` 才会调用现有 Pi。计划 32 个独立案例，每维度 2 个，包含独立完整 smoke 和至少 10 个跨维度 judge 尝试。全轮最多 100 个模型请求、$1 记录成本；给完整 smoke 预留请求，未执行项必须保留。Pi 没有 provider 侧美元硬上限，单次在途请求可能超过预留估计；达到已报告成本门槛后不再发起请求，未知成本/基础设施失败停止后续运行。

```bash
python3 eval/bin/campaign.py
python3 eval/bin/campaign.py --execute --out /tmp/monocode-breadth-run
python3 eval/bin/import_benchmark.py --source bfcl --fetch --out /tmp/bfcl-pinned
python3 eval/bin/import_bfcl_subset.py import --snapshot /tmp/bfcl-pinned --out /tmp/bfcl-sample
python3 eval/bin/import_bfcl_subset.py validate --path eval/data/upstream/bfcl-v4-sample
```

BFCL 原始子集独立保存在 `data/upstream/bfcl-v4-sample`，不混入 176 个原创案例，也不将其格式验证率当作 BFCL 成绩。导入器不会执行上游函数、安装其运行环境或发送任何外部动作。


LongMemEval oracle 可复现导入（固定 HF revision 和原文件 SHA256）：

```bash
python3 eval/bin/import_longmemeval_subset.py fetch --out /tmp/longmem-oracle-pinned
python3 eval/bin/import_longmemeval_subset.py import --snapshot /tmp/longmem-oracle-pinned --out /tmp/longmem-sample
python3 eval/bin/import_longmemeval_subset.py validate --path eval/data/upstream/longmemeval-oracle-sample
```

该 18 题子集用于数据接入验证，不等同于完整长记忆成绩。原 JSON 的 `answer` 混有字符串和整数；导入器保留类型，不依赖报 ArrowTypeError 的 HF viewer。每题独立 provenance 包含来源、许可、revision、SHA256、原 ID、split、variant、转换方式、seed 和环境要求。


离线汇总与仅评审已有输出（不会重新调用 agent；judge 仍消耗同一 campaign 的剩余推理预算）：

```bash
python3 eval/bin/summarize_campaign.py --campaign eval/reports/pi-breadth-2026-10-09 --out /tmp/monocode-campaign-summary
# 下例需要显式决定消耗剩余预算；输出目录必须是新目录，且必须位于该 campaign 下。
node eval/bin/judge_existing.mjs CAMPAIGN NEW_OUTPUT CASE_IDS_COMMA_SEPARATED
```
