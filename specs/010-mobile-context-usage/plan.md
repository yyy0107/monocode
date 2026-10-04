# Implementation and verification

Read the constitution and active native-title artifacts before implementation.
Keep the recorded active feature unchanged; this is a bounded context-display fix.

Add a mobile helper that combines a real session.context reading with the exact
provider/model entry in HostModelCatalog. Use it for the header and status sheet.
Add token-only and not-reported labels with Chinese translations. Keep the
existing computer icon when no valid ratio is available.

Handle Cursor usage_update in its adapter with finite, nonnegative used and
positive size validation. Route it through AcpSubagents before emitting context.
No Rust, shared event schema or Pi/OMP adapter implementation changes are needed.

After each settled Claude turn, read get_context_usage with detail=summary before
the adapter promise resolves so Host persists the reading while its run remains
active. Use get_binary_version once per live process and require >= 2.1.257,
the version that introduced summary mode; older CLIs could otherwise ignore the
field and perform full per-category token-count API requests. Bound each optional
control read to two seconds, disable unsuccessful probes for that live process,
and discard reads after cancellation, stop or process replacement. Manual compact
continues to use the existing handling. Preserve assistant/result fallback data.

Verify mobile rendering, localization, native-window precedence, missing/invalid
fields, Cursor child isolation, OpenCode's catalog-derived window, and the real
headless subprocess adapters with durable Host snapshots and serialized sync.
Run affected tests, check:web, test:host, build and mobile:build. Record CLI
versions, isolated native Pi/OMP reads and untested real-model/device scenarios.
