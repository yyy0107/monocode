# Desktop user message bubbles

Date: 2026-10-05.

Match the mobile presentation in both desktop transcript layouts (`chat` and `full`):
right-aligned user bubbles with an 18% left inset, compact typography and
asymmetric corners. Display image attachments above the text as square
thumbnails. Multiple images wrap, and an image-only message has no empty bubble.
Chat text is capped at `min(100%, 36rem)`; full text may use 100% of its
available message width so long messages can be wider. Short full-layout
messages still fit their content rather than occupying the entire row.

Keep the transcript layout setting and its other layout behavior, including
the existing `promptRise` animation differences. Keep draft backgrounds and
draft images inside the bubble. Preserve CI repair content, composer attachment
dimensions, image preview, copying, message links and collapse behavior intact.
This is a presentation change; provider protocols and stored messages are unchanged.

Acceptance: short, long, draft, link, CI, image-only and mixed messages remain
usable in wide and narrow panes, in ordinary and custom-accent themes. Mobile
transcript rendering and existing message actions remain available.
In full layout, short text renders as a compact right-aligned bubble and
committed image attachments appear above the text, including image-only messages.
