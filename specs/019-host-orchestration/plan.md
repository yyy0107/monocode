# Implementation plan

1. Extract the injected scheduler from desktop-specific defaults. Bind one
   instance to Host storage, catalog, trusted Engine operations and Node Git
   checkpoint operations. Recover persisted runs only before Host begins serving.
2. Extend command/snapshot contracts with optional orchestration support and a
   safe client view. Durable receipt checks precede revision/generation checks.
   Host control CLI uses a scoped loopback credential belonging only to the lead.
3. Replace desktop scheduler access with Host state/actions and full Host model
   catalog selection. Preserve shell/Host ID mapping and remote path projection.
   Keep Resume/Stop reachable in the transcript with the compact project tree.
4. Persist immutable worker checkout baselines and actual cumulative after-images;
   integrate only after all targets pass preflight. Journal partial integration
   and cleanup. Shared Node/Rust checkout reservations protect native resources.
5. Native writes a durable, exact legacy retirement manifest before cleanup.
   Host owner purges its copies and commits tombstones; native then removes source
   rows. Filter retired IDs before workspace restoration and reject stale writes.

Validation: affected regressions followed by required check:web, test:host,
build and check:rust. Record native/device/model scenarios separately. No push,
publish or merge is included.
