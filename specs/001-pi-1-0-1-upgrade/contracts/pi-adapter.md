# Pi Adapter Contract

## Request Completion (US1; FR-001, FR-002)

- prompt response success confirms command handling, not model completion.
- Pi data.disposition=handled without a run completes the submission.
- started/queued work waits for agent_settled; agent_end alone is insufficient.
- Cancellation, process exit and late events complete/reject an originating request once.
- Busy slash commands use prompt/steering behavior without completing the main run.
- Native model/thinking state is reconciled after handled commands and run settling.
- OMP agentInvoked/prompt_result semantics remain flavor-specific.

## Extension Interactions (US2; FR-003, FR-004, FR-008)

- confirm replies preserve confirmed true/false or cancellation.
- select replies return the chosen original option value, including styled source strings.
- input/editor reply with exact value, including empty text if explicitly submitted.
- Cancel and timeout are distinct from submitted values.
- Preserve placeholder, prefill and timeout metadata; remove stale pending UI.
- Use shared question events and optional text settings; old providers retain defaults.

## Commands and Model State (US3; FR-005, FR-006, FR-008)

- get_commands data.commands includes skill, extension and prompt origins.
- Map names to existing NativeCommand invocation rules; validate and deduplicate.
- Query get_available_thinking_levels after active-model selection.
- Only valid returned levels are presented for that session/model.
- Before live session capabilities arrive, Pi catalog choices honor its
  thinkingLevelMap: null removes a level; xhigh/max require explicit mappings.
  The catalog default is an available level. OMP keeps its independent defaults.
- thinking_level_changed.level updates the shared session configuration.
- Stale/default thinking choices do not abort a turn merely because they are
  absent from the active choices. Pi resolves them through set_thinking_level;
  read get_state after a successful set or model switch and publish the effective
  native level, never the requested value based only on an acknowledgement.
- A failed set does not claim local success; unsupported query disables unverified thinking choices, retains actual provider state and emits a status explanation.
- Extend session.configChanged with optional active-model setting-choice metadata;
  reducer/session/ModelPicker scope it to that session. Do not overwrite the global
  catalog based on one session query. Old providers and old history omit the field.

## Images and Runtime Boundaries (US4; FR-007, FR-008)

- Extract text plus PNG image blocks from final outer-tool result.content; nested
  results remain private unless the parent forwards them.
- Stable itemId prevents duplicate progress/end frames from duplicating attachments.
- Save/validate before a persisted path event is applied; completion waits for pending saves.
- Materialized image events may carry an optional ordinary Attachment reference.
- Reducer keeps image metadata and block.attachments on the same image row.
- Desktop uses existing image-save APIs; Host uses session-owned attachment storage.
- Remote reads use attachment UUID and existing session authorization, never arbitrary paths.
- Unsupported/oversized/invalid data and save failure produce visible failure with usable text retained.
- Cancelled/obsolete runs cannot append late images; no base64 in Host snapshots.

## Compatibility and Validation (US5; FR-009, FR-010, FR-011)

Existing adapters need not emit new optional metadata. Old session rows stay readable.
Test both Pi/OMP shared paths and existing question/image consumers.
Remote acceptance applies to desktop-connected Host sessions; new mobile image/editor UX is deferred.
Record actual CLI versions and executed checks rather than assuming compatibility from interface names.
