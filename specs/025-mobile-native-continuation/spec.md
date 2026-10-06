# Feature 025: Mobile continuation of imported native sessions

**Date**: 2026-10-05

**Status**: Implemented and verified by automated checks. Physical-phone and
real-provider continuation scenarios remain unverified; see
[compatibility.md](compatibility.md).

## Context

Imported native sessions already appear in the phone's shared Host history. The
phone currently reports that they must continue on the desktop when its Host
cannot answer the ownership probe. The user requires mobile continuation of
those same conversations, including the Pi conversation in the supplied image.

The existing workspace already contains Host native ownership guards and strict
provider resume bindings. This feature completes capability advertisement and
method-availability handling,
automatic upgrade of older paired Hosts, accurate mobile availability feedback,
and synchronization while a Host turn owns an imported conversation. It extends
the historical desktop-only scope recorded in features 002 and 021; those
completed records remain historical evidence.

## Requirements

- R1 A phone connected to a capable, paired Host can send a follow-up to an
  imported Claude Code, Codex, Pi, omp or OpenCode session once the Host verifies
  that no other writer owns it.
- R2 The Host resumes exactly the imported provider conversation ID, source
  path, project cwd and applicable account binding. A missing or mismatched
  native binding fails visibly; continuation never silently creates a new
  provider conversation.
- R3 The same advisory lock coordinates desktop and Host writers. The Host
  rechecks external CLI ownership under that lock immediately before a native
  write. A mobile availability probe is advisory and cannot authorize a later
  write by itself.
- R4 A live external CLI, ambiguous matching provider process, another MonoCode
  writer, unavailable ownership check, or unsupported Host platform keeps the
  idle imported conversation read-only. When known, the phone names the provider
  and pid. Exit of the owner allows the phone to unlock after its next probe.
- R5 Checking, older Host capability, failed access request and ownership
  restrictions have distinct, localized feedback. A transient request failure
  must not claim that native conversations can only continue on the desktop.
- R6 Mobile ignores delayed access responses for a previous session or Host
  connection. An imported conversation stays read-only until its current Host
  and session have a successful ownership result.
- R7 Desktop bootstrap recognizes a paired Host without native continuation as
  requiring an upgrade. It replaces that Host only while idle, preserving
  history and device credentials. A running conversation or orchestration
  produces a retryable upgrade error.
- R8 Native desktop history refresh must preserve a currently running Host turn
  and its output. A stale desktop snapshot must not change that turn to idle,
  overwrite its transcript, or temporarily re-enable a second writer.
- R9 Existing Host command receipts, attachments, approvals, questions and
  cancellation remain the continuation surface. Optional native fields and old
  history stay readable. Application-owned labels follow docs/localization.md.

## Acceptance scenarios

1. Import a session from each supported provider on the paired Linux computer.
   Open it on mobile after the external CLI exits, send a follow-up and observe
   it in both clients and in the original provider conversation.
2. Keep an external CLI using an imported conversation. The phone remains
   read-only, identifies the holder where possible, and unlocks after it exits.
   If ownership changes after a mobile probe, the Host refuses the send before
   invoking the provider.
3. Run a Host turn from mobile while the desktop refreshes the native source.
   The shared turn, streamed output and native identity remain intact.
4. Connect mobile to an older Host. Show an upgrade-specific notice. Restart an
   idle paired desktop with the new bundle and confirm continuation becomes
   available without re-pairing. A busy old Host stays running until retried.
5. Fail an access request, reconnect to another Host, or switch conversations
   while a probe is in flight. The phone shows the appropriate current state
   and never applies an earlier session's idle result.
6. On an unsupported Host platform, retain readable imported history and a
   reason explaining that native ownership cannot be verified.

## Out of scope

- Mobile discovery/import of files stored on the phone, and transferring native
  provider files between computers.
- Ownership detection on macOS/Windows or bypassing the existing conservative
  Linux ownership rules.
- Adding a Host filesystem watcher for external CLI writes when no desktop
  synchronization client is running.
- New native transcript formats, new provider protocols, native orchestration,
  changing queue semantics, or relaxing strict native resume checks.
- Publishing, pushing, merging, installing a phone build, or restarting the
  user's running desktop/Host without a separately scoped request.
