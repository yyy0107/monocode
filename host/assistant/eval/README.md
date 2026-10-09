# MonoCode 助理评测

Canonical path: `host/assistant/eval/`. See [migration and both working-directory commands](docs/MIGRATION.md). Historical evidence is retained unchanged.

## 评测数据按需准备

运行评测、列出案例或生成评分汇总时，入口会自动准备所需数据。公开数据从固定上游版本下载并按已有规则生成子集；原创案例从 `data/author_cases.py` 生成。题目、参考答案和运行时数据保存在项目外的缓存中，仓库保留代码、来源与许可证、选择规则及 SHA256 锁文件 `data/datasets.lock.json`。

默认缓存位置为 `${XDG_CACHE_HOME:-~/.cache}/monocode/eval/<锁文件哈希>/`。`MONOCODE_EVAL_CACHE` 可指定缓存基目录；`MONOCODE_EVAL_DATA_ROOT` 可指定完整的数据缓存根目录。首次准备公开数据需要网络及相应导入依赖；缓存完整且哈希匹配后可离线复用。准备数据不会调用模型；校验失败或下载失败时入口停止，不会继续评测或重写锁文件。

可在评测前显式准备缓存：

```bash
# 不指定 --sources 时准备原创与全部六个公开来源。
python3 host/assistant/eval/bin/prepare_data.py
python3 host/assistant/eval/bin/prepare_data.py --sources bfcl,longmemeval
```

首次重建 HotpotQA 需要 `pyarrow`（原导入器验证版本为 `23.0.1`）；BIPIA 需要 `nltk==3.9.2` 和 `pandas`。准备器不会自动安装依赖；完整缓存命中后不需要这些重建依赖。

单元测试读取已有缓存；先运行对应评测入口的验证/列出命令准备数据，再执行相关测试。历史报告中的 `data/...`、`public/...` 路径继续作为逻辑来源路径，实际数据由缓存解析，历史证据与数据哈希保持不变。

## 优化后的安全实测入口

**当前状态：真实请求保持暂停。** [继续执行记录](docs/CONTINUATION_REVIEW.zh-CN.md)：7类离线修复、287项测试通过；尚不能为旧未知请求建立可靠费用上界，不能用新目录重置累计预算。T4/T6真人工作仍pending。下列实测命令为接口说明，不代表已获恢复条件。

本轮实现与边界见 [优化执行记录](docs/OPTIMIZATION_EXECUTION.zh-CN.md)。[新实测评分卡](reports/optimization-sdk-final-2026-10-09/scores.html)：25次HTTP后因未知成本停止，13个有效episodes、1个环境失败、99个跳过；已知成本$0.0095182，总成本未知。N与扩量未启动，不能宣称完成。新 runner 使用 `terminal-compatible-v2`、`native-parity-v2` 和 `citation-v2`；可用旧版本解释历史证据，原题/gold/历史报告不改写。新增明确嵌套 schema 的 `structured-nested-v2` 是单独派生案例，目录变体总数为 377，不能算作新增独立原题。

```bash
# 只冻结选择、源哈希、模型目录/费用边界；0 个模型请求。
node host/assistant/eval/bin/optimization_eval.mjs --out /tmp/assistant-opt-preview-NEW
# 显式实测：同一全局账本，最多 200 次实际 HTTP 请求 / $2。
node host/assistant/eval/bin/optimization_eval.mjs --execute \
  --out /tmp/assistant-opt-run-NEW --max-requests 200 --max-usd 2
```

新运行额外保存仅含白名单字段的`provider-diagnostics.jsonl`，在内存会话清理前逐事件刷盘；费用未知仍停止，日志不能代替费用账本。人工待办见[T4/T6问题卡](docs/HUMAN_REVIEW_QUESTIONS.zh-CN.md)。

新入口所有阶段均经过 Pi SDK 的 HTTP 计数关口，关闭自动重试、上下文自动压缩、预热和工具/扩展发现；P/扩量使用无原生工具的单次文本完成，N 使用隔离的原生工具循环。每次发送前保留按本机模型目录容量和最高费率计算的假设预留（本轮 `$0.6256`），收到已知用量后才释放余额；用量未知立即停止。这依赖目录容量和费率正确，不是供应商账单设置。113 个预选 episodes 不保证在预算内全部执行；未运行项保留 N/A，禁止重新建预算目录绕过累计上限。

N 的 MonoCode 臂使用临时 Host 的实际动作入口，尚未覆盖完整生产 Pi provider 生命周期、落盘恢复或真实运行中的 steer/cancel。`recovery-changing-language` 是脚本事件。正式 judge 仍需两位独立人工审核和至少 20 个锚点，当前不可用。旧的 `eval.mjs` / `public_eval.mjs` / `campaign.py` CLI 适配器保留复现历史用途；其进程计数与估算美元限额不能代替新入口的逐 HTTP 预算控制。

**逐项真实评分 / Per-case agent scores:** [Markdown](reports/scores-2026-10-09/scores.md) · [mobile-friendly HTML](reports/scores-2026-10-09/scores.html) · [CSV](reports/scores-2026-10-09/cases.csv) · [all attempts](reports/scores-2026-10-09/attempts.csv). All 376 catalog variants appear, including N/A for unrun cases. Refresh without inference: `python3 host/assistant/eval/bin/scoring_report.py --out /tmp/assistant-scores-NEW`.

[最新公开集验收：200条参考回放通过；真实smoke 10/14，44请求/$0.05268](docs/PUBLIC_DATASETS.md)。

新增公开集：**6 个可执行来源、176 道不同公开原题、200 个变体**；加上原有原创集的基线为 **352 道不同任务、376 个可执行条目**；本轮新增1个明确schema的派生变体后为 **377条，独立任务仍352道**。四个新集为 tau-bench、API-Bank、HotpotQA、BIPIA；BFCL/LongMemEval 已接入程序判分。[公开集运行说明](public/README.md)。下文原始套件的历史成绩与 judge 校准结论保持不变。

176 个**原创**中英文场景，覆盖 16 个能力维度；同时提供硬断言、隔离工具、真实现有 agent 适配器、独立 LLM judge、原生 Host 回归和 JSONL/JSON/Markdown 报告。没有将原创案例冒充 BFCL、tau 或其他官方数据集。原始套件既有实测：16维度各2例，23/32通过；独立完整smoke 4/6，10个格式有效的judge输出因校准失败均标为untrusted，正式综合通过率为N/A。[最终验收与最简命令](docs/FINAL_ACCEPTANCE.md)。

在 MonoCode 仓库根目录运行，复用现有 Node 24、TypeScript、esbuild、Zod、Vitest 依赖，不增加生产依赖：

```bash
node host/assistant/eval/bin/eval.mjs validate
node host/assistant/eval/bin/eval.mjs run --mode reference --out /tmp/monocode-reference-run
npx vitest run --config host/assistant/eval/vitest.config.ts
npx tsc --noEmit -p host/assistant/eval/tsconfig.json
npx prettier --check 'host/assistant/eval/src/**/*.ts' 'host/assistant/eval/native/**/*.ts' 'host/assistant/eval/tests/**/*.ts' 'host/assistant/eval/bin/*.mjs' host/assistant/eval/vitest.config.ts
```

输出目录必须是新目录，已有报告不覆盖。`reference` 只验证 harness/fixtures/评分器，不是模型成绩。Host 测试需要本机 loopback socket 权限；禁止 socket 的容器会报 `EPERM`，这属于环境失败。

真实模型测试（使用 CLI 已有认证，不读取/复制/打印密钥）：

```bash
# Claude Code：原生工具、hooks、自定义配置、MCP、skills 全关。
node host/assistant/eval/bin/eval.mjs run --mode claude --tier smoke --model sonnet \
  --judge-model opus --max-requests 24 --max-usd 2 --request-usd 0.08

# Pi：使用已登录的 provider/model ID，可先 pi --list-models 查询。
node host/assistant/eval/bin/eval.mjs run --mode pi --tier smoke \
  --model openai-codex/gpt-5.6-luna --judge-model openai-codex/gpt-6.1-sol \
  --max-requests 24 --max-usd 1 --request-usd 0.04

# 指定类别/用例与种子；max-requests 包含 agent 和 judge 的所有请求。
node host/assistant/eval/bin/eval.mjs run --mode pi --category recovery --limit 3 --seed 29 \
  --model openai-codex/gpt-5.6-luna --max-requests 12 --max-usd 0.48 --request-usd 0.04
```

`--max-usd` 是保守请求预留预算；Claude 还传递 provider 的每次调用限额。Pi 没有 CLI 美元硬上限，USD 预留只是估算，实际用量来自返回 usage；订阅计价信息未必等于额外收费。`costUsd: null` 表示未知，绝不当成免费。每次调用有超时和输出上限，整例有步数上限；账号/模型不可用触发熔断，其余未跑项标为 skipped。默认不自动重试真实 provider 请求，以免重复扣量；工具故障重试由被测 agent 在相同 fixture 中处理。

有工具场景要求真实 CLI 输出决策 JSON，执行动作的是内存隔离环境；无工具场景也接受直接的用户可见文本或 JSON，内容仍由硬断言检验。加载当前源码的 `buildBrainPrompt`，但这**不是完整生产 Host+UI 端到端测试**。所有邮箱、日历、文件修改和会话委派都在模拟状态里；不连接真实邮箱、不写项目文件、不支付、不修改账号。原生 Host 的测试仅使用临时目录与测试数据库，provider 是受控假对象。支持边界见 [COVERAGE.md](docs/COVERAGE.md)。

## 数据与评分

- `data/cases.jsonl`：缓存中的逻辑路径，176 例；JSON Schema 见 `schema/case.schema.json`，严格检查未知字段和参数。
- `data/references.jsonl`：缓存中的逻辑路径，独立脚本化参考轨迹，只供 harness 验证，绝不放入 agent prompt。
- `data/author_cases.py`：逐项原创的数据源；评测时自动生成 JSONL。维护用例时用 `python3 host/assistant/eval/data/author_cases.py --out /tmp/monocode-original-NEW` 检查新产物，审阅后同步数据锁中的哈希。
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

[来源与许可清单](data/sources.json)记录官方 URL、固定 commit、代码/数据许可差异、接入状态和环境要求。[官方许可审计](data/license-audit.json)包含此次读取的许可与哈希。BFCL 已导入五类共 30 题原始子集及 24 条答案；LongMemEval 已导入六题型共 18 题 oracle 原始子集（含 4 题拒答、保留整数/字符串答案及完整证据）。两者都通过格式/哈希验证，**未跑官方模型评分**；tau-bench、API-Bank、HotpotQA、BIPIA 也已有本地可执行改编子集；其余来源仍仅为清单或受环境/许可限制。

```bash
# 默认只展示固定版本的接入计划，不下载或执行任何代码。
python3 host/assistant/eval/bin/import_benchmark.py --source bfcl
python3 host/assistant/eval/bin/import_benchmark.py --source tau2

# 可选：下载许可清楚的固定上游源码快照；不会运行其评测。
python3 host/assistant/eval/bin/import_benchmark.py --source bfcl --fetch --out /tmp/bfcl-pinned
```

GAIA gated、ToolSandbox 自定义许可、AssistantBench 代码 Open RAIL-S 与数据 Apache-2.0、WorkArena 实例审批、AppWorld 受保护数据、长上下文/VM/在线评测均有单独限制，脚本不会绕过。不要把上游静态问题塞进本地模拟器后称为官方复现。版本会变化，特别是 tau2 仓库当前含 tau3；比较历史结果必须选择匹配 commit、任务和 evaluator。

评测代码和原创 fixtures 采用仓库根目录 MIT 许可；外部材料保留自身许可，代码许可不自动覆盖所有数据。


## 有预算的跨维度实测与公开数据导入

真实入口的复用部分和绕过部分见 [ENTRYPOINT.md](docs/ENTRYPOINT.md)。以下 campaign 默认只打印计划；显式 `--execute` 才会调用现有 Pi。计划 32 个独立案例，每维度 2 个，包含独立完整 smoke 和至少 10 个跨维度 judge 尝试。全轮最多 100 个模型请求、$1 记录成本；给完整 smoke 预留请求，未执行项必须保留。Pi 没有 provider 侧美元硬上限，单次在途请求可能超过预留估计；达到已报告成本门槛后不再发起请求，未知成本/基础设施失败停止后续运行。

```bash
python3 host/assistant/eval/bin/campaign.py
python3 host/assistant/eval/bin/campaign.py --execute --out /tmp/monocode-breadth-run
python3 host/assistant/eval/bin/import_benchmark.py --source bfcl --fetch --out /tmp/bfcl-pinned
python3 host/assistant/eval/bin/import_bfcl_subset.py import --snapshot /tmp/bfcl-pinned --out /tmp/bfcl-sample
python3 host/assistant/eval/bin/import_bfcl_subset.py validate --path host/assistant/eval/data/upstream/bfcl-v4-sample
```

BFCL 原始子集的逻辑路径为 `data/upstream/bfcl-v4-sample`，实际数据保存在项目外缓存中；上述 `validate` 命令会自动准备并解析缓存。不混入 176 个原创案例，也不将其格式验证率当作 BFCL 成绩。导入器不会执行上游函数、安装其运行环境或发送任何外部动作。


LongMemEval oracle 可复现导入（固定 HF revision 和原文件 SHA256）：

```bash
python3 host/assistant/eval/bin/import_longmemeval_subset.py fetch --out /tmp/longmem-oracle-pinned
python3 host/assistant/eval/bin/import_longmemeval_subset.py import --snapshot /tmp/longmem-oracle-pinned --out /tmp/longmem-sample
python3 host/assistant/eval/bin/import_longmemeval_subset.py validate --path host/assistant/eval/data/upstream/longmemeval-oracle-sample
```

该 18 题子集用于数据接入验证，不等同于完整长记忆成绩。`validate` 命令自动准备缓存中的数据，仓库内路径保留 manifest 和 provenance。原 JSON 的 `answer` 混有字符串和整数；导入器保留类型，不依赖报 ArrowTypeError 的 HF viewer。每题独立 provenance 包含来源、许可、revision、SHA256、原 ID、split、variant、转换方式、seed 和环境要求。


离线汇总与仅评审已有输出（不会重新调用 agent；judge 仍消耗同一 campaign 的剩余推理预算）：

```bash
python3 host/assistant/eval/bin/summarize_campaign.py --campaign host/assistant/eval/reports/pi-breadth-2026-10-09 --out /tmp/monocode-campaign-summary
# 下例需要显式决定消耗剩余预算；输出目录必须是新目录，且必须位于该 campaign 下。
node host/assistant/eval/bin/judge_existing.mjs CAMPAIGN NEW_OUTPUT CASE_IDS_COMMA_SEPARATED
```
