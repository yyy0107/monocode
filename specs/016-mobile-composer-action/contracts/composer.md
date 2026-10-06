# Composer action contract

| Session state | Pending content | Primary action |
| --- | --- | --- |
| Idle | Any | Send, enabled only when `canSend` |
| Running | Non-whitespace text or attachments | Send, enabled only when `canSend` |
| Running | Empty or whitespace-only text, no attachments | Stop, enabled only when `canStop` |

Send submits the existing form and calls `onSend` only when `canSend`.
Stop is a non-submit button that calls `onStop`. Action selection uses current
attachments, excluding attachment chips retained for their exit animation.

## Typing focus during popup actions

- With the textarea focused, model/permissions/add popup taps retain focus and
  selection through opening, navigation and dismissal; each valid tap activates
  its control exactly once.
- Movement beyond 10px, movement consumed by sheet dragging, multi-touch and
  cancellation do not activate controls. Lists retain native scrolling.
- Focus is protected only when the input was focused at the start. Another
  editable control may take focus; disabled/disconnected/inert controls are not
  activated, and an input disabled during the gesture is not refocused.
- Keyboard and mouse activation retain their ordinary click path. File picker
  actions remain synchronous user actions, with system-managed keyboard behavior.

## Reference card layout

- The context band and input toolbar remain visible independently of input focus.
- The context band opens existing model/reasoning and project sheets; a locked
  session's project is display-only and cannot invoke project changes.
- A dedicated toolbar shortcut opens the existing skills/commands picker and
  obeys its loading/disabled capability gate.
- Input blur preserves multiline display and attachments. Attachment removal
  animates through AnimatedCollapse, with stale controls inert during closing.
- Composer sheets retain their surfaces through closing and disable interaction
  while hidden; rapid reopening reverses the shared motion without losing focus.
- The existing primary action and touch-focus contracts above remain unchanged.

## Keyboard anchor positioning

- Button-anchored sheets follow the trigger's actual bounds throughout keyboard
  movement, retaining existing gap, safe-area clamping and flip rules.
- Tracking stops on close/unmount and resumes on reopen; long-press point menus
  remain at their original coordinates. Focus and disclosure motion are preserved.
