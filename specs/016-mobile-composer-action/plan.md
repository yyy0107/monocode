# Implementation plan

Choose the mobile primary action from running state and the current draft and
attachments, independently of send availability. Reuse the existing submit,
cancel, disabled and loading states. No Host/provider protocol changes.

Update existing composer checks for sending during a run, disabled sending,
clearing back to Stop and configuration locks. The popup navigation assertion
must count only enabled menu rows, matching the existing focus handler.
Run the mobile test suite and mobile production build. Record executed results
and distinguish physical-device/provider scenarios that were not exercised.

## Android typing focus follow-up

Add a shared, container-scoped touch focus hook beside the existing input focus
helper and reuse it in MobileComposer and its MobileSheet surfaces. Passive
touch start records an already-focused input and selection; passive movement
cancels taps beyond 10px or consumed by the sheet drag handler. A non-passive
touch end cancels the valid tap's default focus change and synchronously invokes
its original click action, retaining file picker user activation. Ignore a
following compatibility click without blocking a new touch/pointer press or
keyboard activation. Clean up all listeners with the surface.

Keep popup focus restoration, keyboard navigation and existing disclosure motion.
Extend composer regressions to use touch sequences without an extra test-generated
click; cover duplicate activation, drag/scroll cancellation and unfocused/editable
controls. Run mobile tests, check:web and the mobile build, then browser touch QA.
No Host/provider protocol, native keyboard API, dependency or deployment changes.

## Reference card layout follow-up

Replace the focus-driven capsule layout with a permanent context band and input
card in MobileComposer. Reuse its model/project sheets and existing toolbar
actions. Scope the new surface styles to the session composer so other mobile
forms retain their layout. Keep keyboard docking and textarea autosizing; use
AnimatedCollapse for attachment entry/exit instead of per-view fold timers.
Keep composer sheets mounted with their controlled open flag for both directions
of motion. Enable their existing touch focus hook when the sheet opens so an
initially closed sheet installs its listeners after its surface mounts.
Update affected existing composer checks and inspect the actual component at
mobile widths in light/dark themes, including popup touch focus and long drafts.

## Keyboard anchor follow-up

While a button-anchored MobileSheet is open, sample the trigger bounds on animation
frames and rerun existing placement only when those bounds change. This covers
CSS keyboard motion, including opening a sheet midway through it, without relying
on resize/scroll events. Cancel tracking on close/unmount and skip point anchors.
Run focused sheet/composer consumer checks, TypeScript and browser keyboard-motion
simulation; distinguish the simulation from physical Android IME verification.
