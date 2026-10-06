# Plan: Mobile Agent defaults

Reuse the existing MobileAgentDefaults and MobileModelControls UI, model-settings
normalization, Host catalog/account RPCs and create command account field. Add a
Settings slot without changing desktop settings or provider protocol adapters.

- Store versioned defaults by environmentId, with per-Agent preferences.
- Load global models and account metadata independently while Settings is open;
  retry partial failures without blocking Home, history or new-chat entry.
- Capture preferences in the common project/new-chat initialization path. Pass
  the captured selected account on create after validating current Host metadata.
- Do not let late model discovery overwrite user configuration or existing sessions.
- Keep global/project model caches separate; invalidate late results on reconnect.
- Reuse MobileSelect/MobileSheet motion and focus behavior, including disabled options.

Constitution: focused mobile/shared-contract changes; optional existing account
fields remain compatible; no adapter or Rust changes planned. Preserve unrelated
workspace edits. Validate behavior with focused unit/UI/Host tests and mobile build.

Contract: contracts/defaults.md. Actual verification: verification.md.
