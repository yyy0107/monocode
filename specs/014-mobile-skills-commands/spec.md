# Mobile skills and slash commands

Bring the desktop's existing skill selection and slash completion to the phone.
The composer offers Skills and commands from its plus menu and suggestions while
typing a slash token. Users can search, select an item, continue writing arguments
and send explicitly. Preserve text around the caret, attachments, plan intent,
message queue ownership, retry identity and the original text in history.

Catalogs come from the connected Host and the current project/Agent/session,
including project, personal and enabled Claude plugin skills. File-skill discovery
follows the desktop's roots, metadata, precedence and limits. Pi and OMP use their
existing provider-owned native catalogs and invocation strings. The supported
MonoCode shortcuts are Plan and, for a suitable existing conversation, Compact.
Keep unavailable operations out of the offered commands.

The Host applies selected file skills using the same prompt instructions as
desktop, including queued and steered turns. Native commands and their arguments
stay under their provider's ownership. Changing project, Agent or conversation
must never display a previous context's results. A failed catalog can be retried
without losing the draft. Application text is bilingual; skill/provider names,
descriptions, commands and user text retain their original values.

This is selection and invocation of existing skills, not a new skill-management
screen. No provider credentials, skill bodies or filesystem access move onto the
phone. Existing Host authentication and protocol-v1 clients remain compatible.

## Compact list follow-up — 2026-10-05

Use smaller text, icons and spacing in the mobile skills picker and inline slash
suggestions. Command names and descriptions stay on one line with ellipsis when
needed; source labels take only their content width. Preserve at least 44px touch
targets, readable search input, native argument hints and existing selection.
Both the plus-menu picker and the list opened by typing `/` use this density;
file-skill origin labels read Project / Personal (项目 / 个人), without a skill suffix.
