# Mobile conversation loading

Opening a phone conversation should display its text without waiting for model
discovery or image downloads. Reopening an in-memory conversation should render
the cached snapshot in the same navigation update, then synchronize its revision.
Target a sub-100 ms cached navigation on the measured local environment; record
cold transport time separately rather than promise a network-independent limit.

Keep cached views read-only until fresh synchronization succeeds. Preserve Host
identity checks, command journaling, archived/deleted-session restoration rules,
image previews, native read-only sessions and the existing mobile work. No new
credential/content persistence, provider protocol changes or APK publication.

Acceptance includes slow/failed model discovery, hanging images, concurrent
poll/navigation reads, deltas arriving during image downloads, navigation races,
Host switches/disconnects and cache eviction. Report actual timing scope and
unmeasured phone/VPN scenarios explicitly.
