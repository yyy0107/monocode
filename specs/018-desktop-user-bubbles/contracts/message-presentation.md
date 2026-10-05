# User message presentation contract

- User messages in `chat` and `full` layouts are right-aligned and reserve 18%
  of the row on the left. Short text bubbles fit their content. Chat text has a
  maximum width of `min(100%, 36rem)`; full text has a maximum width of 100%.
- Text bubbles have a 38px minimum height, 8px vertical / 13px horizontal
  padding, and clockwise corner radii of 19px / 19px / 6px / 19px.
- Ordinary user text uses 15px type with a 1.45 line height. Existing CI repair
  content retains its own structure and typography.
- Normal user bubble backgrounds use content color at 8%; custom-accent themes use
  accent color at 22%. Draft backgrounds retain their existing treatment.
- Committed images in both layouts precede text in a right-aligned wrapping
  media row. Draft images remain inside the bubble. Thumbnails are
  120px squares with rounded corners and shrink when the available pane width
  is narrower. Image-only messages have no visible empty text bubble.
- Preview callbacks, copy/save actions, links and collapse behavior remain
  unchanged. Composer attachment sizes remain unchanged. The transcript layout
  setting, other layout behavior and `promptRise` animation differences remain.
- Full-layout acceptance explicitly includes compact short-text bubbles and
  committed images above text, with no visible empty bubble for image-only messages.
- Shared mobile transcript markup must remain usable; no message schema,
  image persistence or provider protocol changes are introduced.
