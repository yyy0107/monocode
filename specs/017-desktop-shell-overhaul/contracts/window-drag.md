# Native menu/title-bar move initiation

MenuBar and TitleBar share `app/shell/startWindowDrag` through
`onMouseDownCapture` on their `data-tauri-drag-region="deep"` regions. During an
eligible first primary mouse press, the helper immediately calls
`getCurrentWindow().startDragging()` in the capture handler. There is no window
state await, animation-frame request or delay timer before dispatch.

Eligibility requires a native Linux/Windows environment, `button === 0`,
`detail === 1`, no previous event prevention, the current deep-region marker and
a genuine target contained inside that region's DOM. Buttons, inputs, links and
other interactive controls, explicit `data-tauri-drag-region="false"` descendants,
and portal targets outside the region retain their existing behavior. Rejected
events remain unconsumed. Browser/Host and macOS receive no new native move call.

An accepted request prevents default and stops propagation before the existing
Tauri document-bubble drag listener can dispatch a duplicate request. Acceptance
means the move call was issued; it does not confirm actual OS movement or timing.
MenuBar then closes its active menu and clears temporary Alt-reveal state without
waiting for the native promise. Native call rejection remains handled.

The second press of a double click is not consumed by this helper, preserving
Tauri's existing double-click maximize route. Window-level native edge capture
precedes the component capture handler and keeps resize priority at eligible
ordinary edges/corners. Interactive controls and tab/pane drag regions keep their
existing independent handlers.

Local Tauri 2.11.5 script inspection found an immediate document-bubble
`mousedown` invoke on a first press; no application drag-delay timer was found.
This change moves dispatch earlier in event propagation. Source inspection and
mocked invocation establish no native queue diagnosis, OS-delay resolution or
performance number. Focused tests must cover immediate dispatch/order, rejected
targets/platforms, menu cleanup, double clicks and edge precedence. Actual native
press-to-move timing and Linux/Windows behavior require separate desktop evidence.
