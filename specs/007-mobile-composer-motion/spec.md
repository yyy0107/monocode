# Smoother mobile message and composer motion

Improve mobile send entrances and composer collapse with continuous motion.
Keep toolbar and attachments present during their fade, prevent intermediate
textarea widths from repeatedly restarting its height animation, and defer the
single-line draft preview until collapse finishes. Preserve drafts, focus and
sheet behavior, queue actions, desktop animation defaults and reduced motion.

The collapsed capsule is centered and 32px narrower than the expanded composer.
Width and height animate together; expansion keeps the full available width.

New mobile prompts enter from above the floating dock, with a shorter rise and
fade. Explicitly submitted prompts also animate when their response finishes
before the first Host snapshot. Saved idle history does not replay.
