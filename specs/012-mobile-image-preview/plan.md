# Implementation and verification

Read the constitution and active native-title spec, plan, contract and tasks.
Keep `.specify/feature.json` unchanged for this bounded mobile preview change.

Reuse `sniffImageMime` from the file feature in `MobileFileSheet`, retaining the
SVG extension fallback. Apply a separate 10 MiB image cap before creating blobs.
Use a contained image surface in the existing bottom sheet and show a localized
message when the browser rejects image bytes. Keep binary/text behavior intact.

Establish rendering regressions for the screenshot's Read-tool image chip,
formats, extensionless data, MIME mismatch, sizes, decoder failure and URL
cleanup/stale reads. Verify real MobileClient RPC against an isolated Host for
temporary files outside registered projects, byte equality and invalid/oversized
reads. Run affected tests, check:web, test:host, build and mobile:build; record
actual versions, results and unavailable native-device scenarios.
