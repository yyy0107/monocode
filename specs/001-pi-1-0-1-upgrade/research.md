# Research: Pi 1.0.1 Upgrade

**Date**: 2026-10-03
**Baseline**: 6527b3a21dbff258bad77b03fddca3a98e4822ec
**Pi audited**: @earendil-works/pi-coding-agent 1.0.1
**Spec Kit used**: Installed specify 0.12.5.dev0, bundled offline templates.
**Node runtime**: v24.16.0 (Linux).
**OMP real CLI**: Not installed; use protocol/Host fixtures, real OMP remains unverified.
**Other real CLI versions**: Not exercised by this implementation.
**Application upgrade**: Implemented; automated checks and actual RPC evidence recorded in quickstart.md.
**Runtime change during work**: Global Pi became 1.0.2. Target 1.0.1 was installed independently in a temporary directory; both versions passed RPC smoke.

## Decision: Target a Bounded Personal-Fork Change

Rationale: Existing adapters and optional shared methods already provide most of
the architecture. Upstream contribution procedures do not serve the user's scope.
Alternatives considered: wholesale protocol replacement or full RPC coverage;
both add work unrelated to the current user outcomes.

## Decision: Keep Pi and OMP Completion Semantics Separate

Real Pi probes of an extension command and consumed input returned
data.disposition=handled and emitted no agent run events. Replaying that response
against the production adapter left its promise unresolved until cancellation.
Pi 1.0.1 also requires agent_settled; current agent_end fallback can finish too early.
OMP already uses agentInvoked/prompt_result and has separate update events.
Evidence: piFamily.ts runTurn/handleFrame; Pi docs/rpc.md and docs/json.md.
Alternative: applying Pi termination assumptions globally would risk OMP regressions.

## Decision: Extend Existing Questions with Optional Text Settings

OMP already bridges select/input/editor. Pi only exposes allow/deny, first choice
or cancellation. UserQuestion has no multiline/prefill/placeholder and reply
building trims custom text. Add optional text settings and keep old defaults.
Retain raw option values despite sanitized display labels; distinguish empty
submission from cancellation and enforce Host's existing 10,000-character limit.
Evidence: piProtocol.ts, piFamily.ts, userQuestion.ts, QuestionForm.tsx,
host/engine.ts. Mobile has its own question renderer; full new mobile UX is deferred.

## Decision: Scope Thinking Levels to the Active Session/Model

get_available_thinking_levels returns data.levels for the current model.
thinking_level_changed uses level. Current code hardcodes choices and swallows
set_thinking_level failures. Query after initialization/model changes and update
applied values only on success. Do not mutate every model's global catalog.
Evidence: Pi rpc-types and piFamily.ts applyModel; piProtocol.ts thinkingSetting.

## Decision: Materialize PNG Images Per Runtime

The shared reducer ignores raw data image events. Desktop Codex already saves
images before emitting path events, through Tauri. Host does not yet do this.
Use final tool content, stable IDs and 20 MiB PNG limit. Desktop saves through
existing APIs; Host stores an ordinary session-owned attachment and emits a path
image event with attachment metadata. Keep image blocks plus attachment references;
remote previews/downloads already traverse block.attachments.
Evidence: core/apply.ts appendImage; codex.ts materializeGeneratedImage;
host/engine.ts event; host/attachments.ts; GeneratedImage.tsx;
connections/model/remoteAttachmentPreviews.ts. Existing Rust image-save limit is 25 MiB/PNG.
Alternative: treating a Host-private path as a desktop path fails remote authorization.

## Sources

- [Pi 1.0.1 release](https://github.com/earendil-works/pi/releases/tag/v1.0.1)
- [Pi RPC lifecycle](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/rpc.md)
- [Pi RPC commands](https://github.com/earendil-works/pi/blob/v1.0.1/packages/coding-agent/docs/rpc-commands.md)
- [Spec Kit existing-project guide](https://github.github.io/spec-kit/guides/existing-projects.html)
- Repository code referenced above, read in the baseline worktree.

## Final Decisions

Live model choices are transient capabilities, refreshed after restore and after
commands change native state; no Rust storage schema migration was needed.
Unsupported level queries hide unverified choices while retaining provider state.
PNG is limited to 20 MiB, validated with chunk CRCs, and materialized per runtime.
Nested codemode images are shown only when forwarded by the outer result.
Actual model execution and native GUI interaction were not run; do not infer those
results from the protocol smoke.
