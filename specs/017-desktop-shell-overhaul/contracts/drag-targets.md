# Internal drag targets

Existing internal panel dividers share `shared/ui/ResizeHandle`. Its edge is
`left`, `right`, `top` or `bottom`; the element remains an accessible separator
with the corresponding vertical/horizontal orientation and the caller's label.
Each transparent target spans 16 CSS pixels on one side of the divider:
vertical strips extend to the right, and horizontal strips extend downward.
A matching resize cursor and 2px hover/active line provide feedback at the boundary.
Most targets do not add a layout track; the graph panel has a real 16px divider
track.

Consumers include sidebar, workspace split, graph, project/session terminal
dock, Inbox/Notes list, Inbox discussion and linked-item panel dividers. Existing
controllers still own pointer capture/release, drag direction, min/max dimensions,
imperative drag painting, supported double-click resets and saved size commits.
Targets preserve the caller's event handlers and responsive availability rules.

The target's surrounding container exposes the full hit area. Apply clipping to
an inner content wrapper when needed, including linked-item opening animation.
Protect controls with 16px content clearance on the target's side of the divider;
preceding panes retain their scrollbar positions. Inbox/Notes details and
Discussion/Linked panels reserve left-side content padding separately from their
existing horizontal padding. Root/main workspace content reserves only left/top
padding toward following panels, with no added right/bottom spacing. Responsive
hidden discussion handles reserve no unused target space.

The compact bottom project-terminal dock is an exception to the 16px top content
clearance: tabs retain equal top/bottom gaps. Raised tab slots match the 30px
pill height and raised trailing actions fit their controls, rather than covering
the whole row. The clearance above both groups belongs to the resize target,
leaving the horizontal boundary draggable across the dock's full width while
the pills and buttons remain clickable. Blank portions retain the 16px hit area.

Disabled and hidden/closing surfaces expose no active handle. Reuse the existing
`SurfaceVisibility` contract to suppress hidden interaction. Sidebar keeps its
shared `SidebarTransition`; terminal grid panels keep `useCollapseMotion` and
`animated-collapse-size`, with motion in both directions, inert closing content
and reduced-motion behavior. Grid tracks
remain stable at zero size while closed; direct resizing disables transitions.
Terminal instances remain mounted while hidden so PTYs survive, and a closing
panel finishes its active drag before hiding.

Quick Composer keeps its existing native window-drag behavior with a 20px-high
top strip. The color picker's hue slider keeps its existing value/capture behavior
with a 16px-high target. These surfaces retain their own existing semantics.

Non-macOS global WebKit scrollbar styling uses transparent 12px horizontal and
vertical tracks with a 6px visible thumb. The transparent default thumb border
is 1px, with a 5px left border on vertical thumbs and a 5px top border on horizontal
thumbs. Content-box background clipping leaves the visible body 1px from the
right/bottom edge. Preserve existing intentionally hidden scrollbars. Inbox/Notes list right margins and content before discussion/linked
panels have no added right inset. The earlier proposed 8px two-sided divider
clearances and 10px native-window root padding are removed. `window-resize.md`
defines real-target capture and interactive/scrollbar pass-through alongside the
native layer's direction and availability rules.

CodeMirror keeps its 18px draggable rail while drawing a 6px thumb 1px from the
right edge; diagnostic markers and cursor indicators keep their existing layout.
xterm keeps its 14px draggable rail and draws a 6px thumb 1px from the right edge.
The ordinary terminal shell has no right padding; its left/top/bottom padding
and alternate-screen scrollbar hiding remain intact. Split dragging uses pointer
displacement from the pressed position, avoiding an initial jump when grabbing
the far end of the wider target.

Focused regressions establish controller behavior. Browser geometry and pointer
checks must separately confirm the full one-sided target, edge-adjacent scrollbar
access, neighboring controls, hidden/closing suppression and responsive layouts.
Native window dragging and platform compatibility require actual desktop checks;
mocked or browser interactions are not native verification.
