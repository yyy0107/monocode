# Eval relocation / 目录迁移（2026-10-09）

The canonical location is `host/assistant/eval/` at repository root. The former root-level `eval/` directory was moved in place; no duplicate dataset, compatibility copy, or symlink is retained.

原路径 `/projects/monocode/eval/` 现对应 `/projects/monocode/host/assistant/eval/`。历史 reports、PROGRESS、RESULTS、IMPLEMENTATION 中的命令、绝对路径和当时的 Git 状态按原样保留，它们记录的是当时环境，不能直接当作当前命令。历史相对路径仍以 eval 根目录为基准。目录名中的 2026-10-10 仍是既有笔误；真实运行时间请看 manifest 的 UTC 时间。

迁移前目录有 **825 个文件（736 个 Git 跟踪文件）**，其中 **173 个历史 reports 文件**。迁移保留全部原文件，历史报告和原始案例/上游数据逐字节不变；完整清单见 [before.json](../reports/migration-2026-10-09/before.json)，迁移后的比对见 [integrity.json](../reports/migration-2026-10-09/integrity.json)。Python cache 不作为数据集分母。

Path repairs cover the native product imports, fixture tests, public implementation hash paths, Python CLI working directories, Vitest root, and active documentation. Host test/typecheck configuration excludes this independent eval tree so normal Host work keeps its previous scope. No assistant production behavior changed.

The global public integrity lock was refreshed only because active documentation paths changed. BIPIA's manifest also locks its local README; only that README entry's hash and byte count changed. Dataset/raw/vendor and past run hashes remain unchanged. Historical manifests intentionally retain their old implementation/lock hashes.

## Commands from repository root

```bash
node host/assistant/eval/bin/eval.mjs validate
python3 host/assistant/eval/bin/verify_public.py
node host/assistant/eval/bin/eval.mjs run --mode reference --out /tmp/original-reference-NEW
node host/assistant/eval/bin/public_eval.mjs run --mode reference --max-steps 32 --out /tmp/public-reference-NEW
node_modules/.bin/vitest run --config host/assistant/eval/vitest.config.ts
python3 -m unittest discover -s host/assistant/eval/tests -p 'test_*.py'
node_modules/.bin/tsc --noEmit -p host/assistant/eval/tsconfig.json
python3 host/assistant/eval/bin/scoring_report.py --out /tmp/assistant-scores-NEW
```

## Commands from eval directory

```bash
cd host/assistant/eval
node bin/eval.mjs validate
node bin/public_eval.mjs list
../../../node_modules/.bin/vitest run --config vitest.config.ts
python3 -m unittest discover -s tests -p 'test_*.py'
../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
python3 bin/scoring_report.py --out /tmp/assistant-scores-NEW
```

Use a fresh output directory each time. All commands above are offline and do not run models. The scoring report only re-reads existing real Pi evidence; reference results and unit tests remain framework checks. Full verification evidence is [verification.json](../reports/migration-2026-10-09/verification.json).
