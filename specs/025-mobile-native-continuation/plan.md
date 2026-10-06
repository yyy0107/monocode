# Implementation plan

**Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Status**: Implemented; automated verification complete. Manual phone,
real-provider and actual desktop/Host restart scenarios remain pending.

## Baseline and scope

Git HEAD is `3a8943e30d45d257bed165f7b5ebe21e244435d8`. Implementation starts in
an existing dirty workspace containing native sync, Host orchestration,
assistant, desktop and mobile changes. This feature preserves that work and
records only the requested continuation behavior. The active feature pointer
remains owned by the existing workflow; this record does not change it.

Reuse `HostEngine`, `NativeSessionGuard`, native session metadata, authenticated
RPC and provider adapters. Native protocols stay under
`src/integrations/harness/providers/`; this feature does not add a second mobile
provider execution path. Linux `/proc` detection and the desktop-compatible
advisory lock remain the authority for writes.

## Design

### Host capability and bootstrap

Advertise native access through the public Host descriptor capabilities and the
private lifecycle status used by desktop bootstrap. A Host that supports shared
desktop/orchestration but lacks native continuation is still an older Host.
The idle upgrade uses the existing SQLite write lease and shutdown path so no
device can accept a new turn between the idle decision and replacement. Keep
paired credentials and the existing Host database. The Rust desktop bootstrap
delegates preparation to `host/desktop.ts`; only that Node capability predicate
needs changing. This feature does not change Rust code.

### Mobile ownership state

Model an access request as checking, supported result, unsupported Host, or
failed request. Mobile calls the ownership RPC without gating on descriptor
capabilities, so earlier capable Hosts remain usable. Only an HTTP 400 response
whose error is exactly `Unsupported host method` becomes the older-Host state.
A transport or other server error remains an error state,
with an accurate localized notice. Only a successful current idle result permits
an idle imported session to send.

Bind responses to the current Host connection and selected session; cancel or
ignore superseded probes. Preserve running Host controls while its native lock
is held. A desktop-native execution marker mirrored to shared history is not
proof that the Host owns that running turn.

### Native execution and synchronization

Keep strict provider bindings, native path/account/cwd metadata, and the Host's
fresh ownership check under the shared lock. The mobile probe cannot replace
that final check. The lock remains held until the provider stops, including
completion, cancellation and error cleanup.

An availability probe that temporarily acquires the lease must await the lock
holder's exit before returning `idle`. Closing its stdin starts release but does
not synchronously relinquish the OS lock; an immediate send could otherwise
mistake that short-lived probe holder for another MonoCode writer. Make lease
release awaitable for probes and add a deterministic regression for delayed
release. Turn cleanup also awaits lease release after stopping its provider and
before publishing idle, so an immediate follow-up cannot contend with the
Host's previous lock holder.

When desktop-native refresh reaches an already running Host conversation, do
not replace its snapshot or clear its status. Resume normal native history
reconciliation once the Host turn has settled. Keep imported image reuse and
application-owned metadata reconciliation.

## Constitution check

- Bounded fork change: capability, upgrade, feedback and mirror fixes serve the
  requested phone continuation; unrelated workspace changes remain intact.
- Shared contracts: optional native fields, old histories and existing Host
  commands remain compatible; mobile and desktop use one execution authority.
- Provider isolation: strict resume stays in adapters. Any changes to shared
  `piFamily.ts` require both Pi and omp regression coverage.
- Compatibility evidence: [compatibility.md](compatibility.md) distinguishes
  automated regressions from actual provider/mobile scenarios and records CLI
  versions only when observed.
- Validation: meaningful failure regressions cover ownership, stale responses,
  older Hosts and active-turn refresh. Run check:web, test:host and build; run
  check:rust only if this feature changes Rust. Build the mobile entry.
- Localization/disclosure: application labels use the existing translation
  system. No new disclosure interaction is required; modified disclosure UI
  must still follow the standing AnimatedCollapse rule.

## Affected paths

- `host/cli.ts`, `host/server.ts`, `host/desktop.ts`: capability advertisement,
  bootstrap upgrade and active native mirror protection. Rust bootstrap reuses
  that Node preparation path unchanged.
- `host/desktop-import.ts`, `host/engine.ts`: existing mirror/import and native
  execution paths retained and exercised by regression coverage.
- `host/native-access.ts`, `host/native-access.test.ts`, `host/engine.ts`:
  await probe/turn lease release before publishing idle, with deterministic
  lock-release regression coverage.
- `src/mobile/client.ts`, `src/mobile/MobileApp.tsx`,
  `src/shared/i18n/zh-CN.json`: mobile access state and notices.
- Corresponding Host/mobile/bootstrap regression tests.
- `docs/shared-sessions.md`: current continuation behavior and apply/restart
  guidance; this feature directory: bounded requirements and evidence.

## Verification

Execute targeted ownership, engine, mirror, upgrade and mobile regressions
first. Then complete repository checks, recording counts and actual failures.
Real CLI continuation, desktop restart, physical phone and non-Linux scenarios
remain unverified until individually exercised. A passing bundle or fixture
test does not complete those acceptance scenarios.
