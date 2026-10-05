# Composer action contract

| Session state | Pending content | Primary action |
| --- | --- | --- |
| Idle | Any | Send, enabled only when `canSend` |
| Running | Non-whitespace text or attachments | Send, enabled only when `canSend` |
| Running | Empty or whitespace-only text, no attachments | Stop, enabled only when `canStop` |

Send submits the existing form and calls `onSend` only when `canSend`.
Stop is a non-submit button that calls `onStop`. Action selection uses current
attachments, excluding attachment chips retained for their exit animation.
