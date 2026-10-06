# Verification: 会话专属标签与分屏切换

**Date**: 2026-10-05 (America/Los_Angeles)
**Status**: Scoped implementation, focused regressions, delivery build and Host suite passed. The web suite has three unrelated Worktrees assertion failures. Native Tauri/real PTY/real Host UI remain unverified.

**Runtime**: Node.js 24.16.0, npm 12.0.1, Vitest 3.2.7. No provider CLI compatibility claim is made by this UI/state feature.

## Executed

| Command / scenario | Actual result | Evidence |
| --- | --- | --- |
| `npm test -- src/features/workspace/model/layout.test.ts src/features/workspace/model/workspaceSnapshot.test.ts` | Passed, exit 0; 2 test files, 127 tests | Vitest v3.2.7 output during this task |
| Independent same-kind app views in two chats | Passed model regression | `layout.test.ts`, `workspaceSnapshot.test.ts` |
| Mode, focused pane and active file round trip | Passed model regression | Both split and unified cases |
| Invalid/absent mode fallback, reset clears mode | Passed model regression | Malformed-value and reset cases |
| Local duplicate page cleanup / legacy standalone compatibility | Passed model regression | Snapshot cases retain chat-owned pages |
| `src/app/App.appViews.test.ts` | Passed; 36 tests | Same file/pages in separate chats, active surface restoration, independent referenced-line navigation, async source routing/invalidation, localization and existing App consumers |
| `src/features/sessions/model/sessionWorkspaceLifecycle.test.ts` | Passed; 9 tests | Deleting the final chat clears its mode and owned tools from the replacement; the new regression failed before the fix and passed afterward |
| `src/features/workspace/ui/PaneTreeSurfaces.test.ts` | Passed; 8 tests | Split/full controls, hidden mounted/inert surfaces, rapid reversal, reduced motion, multi-chat compatibility, nested tracks, resize and window controls |
| Existing PaneTree resize / enter / title-drop regressions | Passed; 5 + 5 + 1 tests | `PaneTreeResize.test.ts`, `PaneTreeEnter.test.ts`, `PaneTreeTitleDrop.test.ts` |
| FilePane agent / app-view regressions | Passed; 5 + 1 tests | `FilePane.agent.test.ts`, `FilePane.appView.test.ts` |
| Settings / language regressions | Passed; 105 tests | `settings.test.ts`, `language.test.ts` |
| `src/features/files/ui/FilePaneNavigation.test.ts` | Passed; 11 tests | Final run after cold dynamic-import wait ordering was corrected in the test; preserves referenced-line navigation |
| Isolated browser using actual PaneTree / SessionSurfaceToolbar | Passed observed scenarios | After normalized-grid fix, tool and Chat each fill the workspace; collapsed pane is inert and mounted; return to split works. Chat/editor content was stubbed. |
| `npm run check:web` (delivery run with sandbox escalation) | 5233 passed, 3 failed, 13 skipped; exit 1 | Only failures are the three Worktrees SVG style-serialization assertions, independently reproduced. App 36, FilePaneNavigation 11 and lifecycle 9 all passed in this run. |
| `npm run test:host` (delivery run with sandbox escalation) | 306 passed, 5 skipped; exit 0 | Host build and all 41 executed test files passed after other tasks updated Host source; `/tmp/monocode-session-testhost-delivery.log` |
| `npm run build` (delivery run) | Passed; exit 0 | TypeScript and Vite completed after the lifecycle reset fix; `/tmp/monocode-session-build-delivery.log`. Existing large-chunk advisory remains. |

## Final checks and remaining limits

| Check | Status |
| --- | --- |
| App async file/review source routing and focus restoration | Passed automated regressions; native UI unverified |
| PaneTree / toolbar modes, hiding, reverse transitions and reduced motion | Passed component regressions; isolated-browser layout check passed for described scenarios |
| `npm run check:web` | Delivery run completed with 3 unrelated Worktrees assertion failures; its chained type-check did not run after Vitest failed |
| `npm run test:host` | Delivery run passed: 306 tests, 5 skipped |
| `npm run build` | Delivery run passed, including TypeScript |
| Rust checks | No Rust changes assigned to this feature; existing dirty Rust work is separate |

Earlier Host runs were blocked by a missing `HostEngine.assistant` member, then reported 261 passed / 3 failed / 5 skipped in desktop-import ownership and native-event revision cases. Other tasks updated the Host source during this session. The delivery rerun supersedes those results and passed all 306 executed tests. This feature did not modify Host files or claim real Host UI acceptance.

The web failures compare `SVG.outerHTML` against React server markup in `Worktrees.test.ts:516`: `--ui-icon-stroke-width:1.75` versus the DOM-normalized `--ui-icon-stroke-width: 1.75;`. SVG content matches. The inline style comes from concurrent changes to the existing icon wrapper; this feature did not edit that wrapper or Worktrees tests. The Worktrees suite alone reproduced 31 passed / 3 failed, confirming the failures do not depend on App test state. Final web evidence is `/tmp/monocode-session-checkweb-delivery.log`.

## Native scenarios

| Scenario | Status / limits |
| --- | --- |
| Tauri desktop file/review/page tabs independent between A and B | Unverified |
| Same file open in two chats with independent previews and edits | Unverified in native UI |
| Switch chats while file/review resolves; close or reset original chat | Unverified in native UI |
| Local and real Host chat selection restores current tool page | Unverified with real Host |
| Restart and window transfer preserve mode and active document | Unverified in native UI |
| Split ↔ unified, rapid reversal and reduced motion | Component regression passed; described isolated-browser layout scenarios passed; native UI unverified |
| Hidden editor/chat draft remains; running terminal PTY survives | Unverified with real PTY |
| Explicit multi-chat split selection, resizing, dragging and detaching | Existing generic split/resize/title-drop regressions passed; native UI unverified. Tools remain workspace-owned; per-leaf surface transfer is not implemented. |

No real provider CLI scenario is required to prove this UI/state change, and no provider compatibility claim is made. Existing unrelated dirty work is preserved; broad check results must report actual failures rather than attributing them to this feature without evidence.

## Duplicate split heading correction (2026-10-05)

The split chat rendered both SessionSurfaceToolbar and the legacy SessionPane heading. The surface toolbar now replaces that heading, retaining pane dragging, focus indication and close controls. Host-backed panes supply the resolved session title to the replacement; unavailable Host panes retain a fallback header. Header callbacks remain stable during sash resizing.

Validation: PaneTreeSurfaces (9), PaneTreeResize (7) and RemoteSession (39) tests passed, 55 total. After the unavailable-header fallback and Host-title assertion were added, the affected mounted-Host-conversation test passed (1 run, 38 filtered out). RemoteSession's full run emitted React act warnings but no failures. Native desktop visual acceptance was not run.

Final `npx tsc --noEmit` and `git diff --check` passed (exit 0).

Follow-up: the unified Chat tab previously hid the session title whenever tool tabs were visible. Both modes now use the display title as the tab label, falling back to localized Chat only when empty. PaneTreeSurfaces passed all 9 tests, including title visibility in both modes and the empty-title fallback; `git diff --check` passed. Native visual acceptance remains unverified.
