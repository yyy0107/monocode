# Verification: Mobile Agent defaults

Date: 2026-10-05. Implementation and focused automated checks complete.

## Passing checks

| Command | Result |
| --- | --- |
| `npx vitest run src/mobile/agentDefaults.test.ts src/mobile/modelControls.test.ts src/mobile/clientLoading.test.ts` | 3 files, 36 tests passed |
| `npx vitest run src/mobile/agentDefaultsFlow.test.ts src/mobile/followUpSettings.test.ts src/mobile/connectionSettings.test.ts src/mobile/sessionLoading.test.ts src/mobile/projectPickerFlow.test.ts src/mobile/MobileSheet.test.ts` | Sheet (10), project picker (2), session loading (31), follow-up (4) and defaults flow (9) passed; connection mock failures repaired and rerun below |
| `npx vitest run src/mobile/agentDefaultsFlow.test.ts src/mobile/connectionSettings.test.ts src/mobile/followUpSettings.test.ts src/mobile/client.test.ts src/mobile/activityUi.test.ts` | 5 files, 78 tests passed, including the expanded defaults flow (11) and repaired connection tests (12) |
| `npx vitest run --config host/vitest.config.ts host/server.test.ts -t 'lists desktop provider accounts'` | 1 passed, 26 unrelated tests skipped |
| `npx vitest run --config host/vitest.config.ts host/child-backend.test.ts -t 'desktop named'` | 2 passed (Codex/Claude), 6 unrelated tests skipped |
| `npx tsc --noEmit` | Passed |
| `npm run mobile:build` | TypeScript checks and Vite mobile production build passed |
| `git diff --check` restricted to touched tracked source/test files | Passed |

The final passing coverage comprises 157 distinct frontend tests and 3 Host tests.
The initial flow-test run exposed two incorrect test selectors (Chinese Home menu
label and Settings button containing the Host name); these were repaired. Connection
settings fixtures needed the newly used cachedModels/providerAccounts methods.

## Verified behavior

- Defaults persist per Host and Agent, including independent model/effort/account choices.
- Legacy defaults migrate once; named accounts retain confirmation requirements
  until matched to current Host metadata. Removed account selections stay visible.
- Settings works without projects, restores each Agent's preferences, translates
  application labels, and leaves custom account names unchanged.
- Home, project and drawer entry points send saved model/effort/account on create.
- Existing sessions and current draft overrides survive Settings changes. Late
  model discovery does not overwrite manual draft model selection.
- Partial catalogs display usable fallbacks without overwriting saved preferences.
  Account lookup failures can be retried independently; old Hosts are recognized.
- Global/project caches are separate; late catalog/account responses are rejected
  on Host switch, disconnect and reconnect; old Settings responses are discarded.
- Host RPC lists published accounts, persists/passes the selected account to a
  mocked turn and rejects a removed account. Process fixtures confirm the existing
  Codex/Claude profile-directory environment isolation.

## Limits and diagnostics

No real provider CLI/model calls or Android/iOS device run were performed. Provider
versions and real account compatibility are not asserted. Host tests used synthetic
account metadata and provider/process fixtures, not user credentials.

The passing activity UI tests emitted React act() warnings during the existing
finger-drag test. The passing production build emitted two CSS optimizer warnings
for transcript-search ::highlight selectors and the large-chunk warning. These
styles and bundling policies are outside this feature.

No full test suite, Rust check, APK/iOS packaging, publishing, push or merge was run.
