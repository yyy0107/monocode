# Implementation plan

Read AGENTS.md, the constitution and the active desktop shell records. Keep
`.specify/feature.json` on feature 017 and record this bounded change separately.

Update `UserMessageBlock` in `src/features/sessions/ui/AgentTranscript.tsx`
to right-align user bubbles in both `chat` and `full` layouts, with committed
images above text and no visible empty bubble for image-only messages. Keep
draft images inside the bubble. Replace line-count-dependent corners with a
consistent mobile shape. Apply compact bubble styling to both layouts in
`src/styles/index.css`; cap chat text at `min(100%, 36rem)` and full text at
100% while sizing short messages to their content.
Reuse `AttachmentChip` and existing preview callbacks; scope thumbnail sizing to
the transcript media container so composer attachments retain their dimensions.
Check mobile transcript overrides for the shared markup.

Use the values in `contracts/message-presentation.md`. Preserve existing
message data, draft treatment, CI content and interactions. Retain the overall
layout setting and other layout behavior, including the `promptRise` animation
differences; synchronize the setting's description with the shared bubble style.
The main implementation agent runs relevant message/attachment regressions,
web checks and the production build, and records actual evidence in tasks.md.
Explicitly verify that short full-layout messages do not fill the row and
committed full-layout images appear above the text.
No Rust or provider change is required.
