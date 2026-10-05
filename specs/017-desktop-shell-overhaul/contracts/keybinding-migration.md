# Keybinding override migration

Overrides are stored in localStorage `monocode.keybindingOverrides` keyed by
English command id. The Keybindings page must save under `row.command`, never
the translated label.

When `App: Toggle Session Sidebar` is removed, `parseKeybindingOverrides` maps
it to `App: Toggle Sidebar` before validating ids. A legacy shortcut wins over
an existing `App: Toggle Sidebar` entry (which held the old rail chord); a
legacy `disabled` entry is dropped so the sidebar toggle is never silently
disabled. Parsing does not write back and is idempotent.
