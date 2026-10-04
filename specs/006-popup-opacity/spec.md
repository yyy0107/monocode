# Consistent popup opacity

## Requested behavior

The existing Popover opacity preference applies to shared modal panels and legacy
dialogs as well as menus and pickers, in both light and dark mode. Changing the
preference updates an open panel without reopening it.

MCP configuration fields and worktree creation fields use translucent or
transparent fills so opaque controls do not obscure the chosen panel opacity.
Keep readable text, borders, focus indicators, and existing keyboard behavior.

## Scope

Reuse the current setting, storage key, and glass background rule. Cover shared
Modal consumers plus the independent file picker, remote project, project removal,
and branch switching dialogs. Keep page dimming and image-preview surfaces as
separate treatments. Preserve unrelated local work.
