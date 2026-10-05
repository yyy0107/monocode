# Implementation and verification

Separate project history from background model discovery, retaining generation
guards and bounded project catalog caching. Display cached conversation snapshots
immediately, with controls and unread acknowledgement gated on a fresh revision.

Keep MobileClient session sync focused on text/metadata. Download previews for the
visible conversation separately and merge only matching attachment bytes into
the latest snapshot. Reuse the shared desktop preview helper without changing
desktop loading semantics. Deduplicate concurrent reads; invalidate in-flight
cache writes after disconnect, Host changes and deletion. Keep caches bounded.

Add failure/race regressions and measure a disposable real local HTTP Host plus
cached reads/rendering. Run affected tests, check:web, test:host, build and
mobile:build; record actual results and CLI versions. Preserve the active native
title feature and the concurrent mobile skills work.
