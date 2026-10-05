# Command registry contract

`AppCommand` fields: `id` (equals the `KEYBINDINGS` command when bound,
otherwise `Category: Title`), `title` (English, translated at display),
`bound` (has a `KEYBINDINGS` row, so the effective shortcut is user-rebindable),
`nativeEvent` (event name emitted by `src-tauri/src/menu.rs`), `menu` (menu id,
group, order), `palette: false` to hide from quick open, optional `enabled` /
`checked`, and `run(arg)`.

Every `KEYBINDINGS` row maps to exactly one command. Rows owned by a focused
surface (composer workspace toggle, editor find/replace, model switch, quick
composer) are not matched by the App key handler; their menu/palette runs
reach the owning surface through its existing event. Key matching rules are
unchanged: defaults match `event.key`, overrides match `event.code`.

`dispatch(id, arg)` debounces repeated runs of the same id within 80 ms so a
native menu accelerator and the webview key handler cannot double-fire.
Native events with payloads (`toggle_autosave`, notification clicks) remain
special cases. Shortcut labels read the current overrides and update when they
change.

The Windows/Linux menu row owns window navigation on its left and native
window controls on its right when pinned. Navigation runs `Tab: Back`,
`Tab: Forward` and `App: Toggle Sidebar` through the dispatcher; history
availability disables the arrows. With the menu row hidden, title-row controls
remain available and the Alt menu overlay leaves them unobscured.
