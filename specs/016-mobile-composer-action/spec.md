# Mobile composer send action

When a session is running, the mobile composer's primary button shows Send
whenever the draft has non-whitespace text or an attachment. Sending uses the
existing Host submission and queue behavior. With no pending content, the
primary button shows Stop and cancels the current run.

Sending remains disabled whenever `canSend` is false. Temporary submission or
attachment work must not turn a nonempty draft's primary action into Stop.
Preserve the existing queue shortcut, configuration locks, focus behavior,
localized labels and desktop composer.

## Android typing focus follow-up — 2026-10-05

When typing with the soft keyboard open, tapping the model, permissions or add
control retains the textarea focus, draft and selection through popup opening,
submenus and dismissal. Ordinary local option changes activate once. Protect
the touch/gesture path as well as existing pointer and mouse interactions.
Scrolling, dragging, multi-touch and cancelled gestures must not activate rows.
Opening a popup while the textarea is unfocused must not force the keyboard open.
System file pickers and deliberate focus changes to another editable control
retain their existing behavior. Existing busy/configuration locks remain intact.
Record browser touch validation separately from physical Android IME validation.

## Reference card layout follow-up — 2026-10-05

The mobile session composer follows the supplied reference: a full-width rounded
card with model and project context in the upper band, a separate rounded input
surface, and a bottom toolbar with the add control on the left and a circular
primary action on the right. The card and controls remain visible while the input
is unfocused; multiline drafts and attachments are not compacted on blur.
Use the existing permissions, skills, plan and queue actions rather than adding
unsupported voice controls. Project selection is available before creating a
session; existing conversations retain their fixed project. Preserve focus,
send/stop selection, busy locks, keyboard positioning and both theme variants.

## Keyboard anchor follow-up — 2026-10-05

An open add panel must follow the composer's button throughout keyboard opening,
dismissal and reversal, even when the button moves without resizing or scrolling.
Other button-anchored sheets share this behavior; long-press point menus retain
their fixed coordinates. Preserve focus and existing disclosure motion.
