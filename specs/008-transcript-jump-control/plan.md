# Implementation and validation

Keep scroll following separate from jump-button visibility in AgentTranscript.
Place an end marker after the latest turn's real content, before the anchored
turn's blank space. Measure it within the scroller's existing scroll-padding
insets. Reconcile visibility on input, scroll and resize, and observe the end
crossing the readable viewport during content growth within an anchored turn.

Isolate mobile transcript content in its own stacking context and place the
floating button above it. Consume the button's pointer-down, mouse-down and
click events while preserving the existing focus behavior.

Run focused scroll and mobile regressions, TypeScript/web checks and desktop
and mobile production builds. Inspect actual hit testing over an image and
composer resizing in a browser fixture. Record actual evidence and device limits.
