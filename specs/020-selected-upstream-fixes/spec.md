# Selected upstream fixes

Date: 2026-10-05. Personal fork baseline: `fe48e80302a7137276d708f2fe83d4df7becd945`.
Upstream reviewed baseline: `807c70e0d56fad77a83e98dad12cef0e4f3ef460`.

The user approved selectively integrating the recommended upstream changes in
batches. Preserve the fork's desktop shell, multi-project work in progress,
localization, shared mobile transcript, question input semantics and remote
capability contracts. Do not include optional upstream layout, palette, worktree
creation, GitLab or release-version changes, nor repeat already implemented fixes.

## Acceptance

- Pi model discovery loads extensions; OMP catalog probes retain isolation.
- Markdown/SVG review tabs default to source and remember their mode separately
  from ordinary tabs, preserving navigation and editor behavior.
- Both model-search flyout paths focus after the surface becomes visible.
- Multiple-question prompts can return to earlier answers, including fork native
  multiline inputs, without changing user-entered whitespace or empty values.
- Send waits for pasted and dropped attachments. Retired async reads release
  resources and cannot populate a subsequent draft or an unmounted composer.
  Native listeners use current capabilities and remote routing; owned errors
  switch language with the UI.
- Git tree folders support stage/unstage and lock concurrent mutations. Host and
  desktop treat paths literally, including wildcard-looking directory names.
  Changed disclosure uses shared bidirectional motion, inert closing content,
  focus restoration, reversal and reduced-motion behavior.
- Nested scroll gestures do not pause the outer transcript. Browser clamps,
  queued programmatic scroll events and turn-resize ordering preserve reader
  intent. Keep existing touch behavior, prompt/jump motion, end observation and
  character-based output reveal.
- Preserve all unrelated staged, unstaged and untracked main-checkout work when
  integrating validated commits. Each adapted commit records upstream provenance.
