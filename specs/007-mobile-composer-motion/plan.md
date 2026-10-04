# Implementation and validation

Use existing data-collapsed CSS transitions instead of display:none for composer
regions; keep inert and aria-hidden for collapsed controls. Measure textarea
wrapping at its final expanded width and observe the dock width rather than the
animated form/textarea width. The collapsed form uses calc(100% - 32px), centered,
with width sharing the 280ms padding/height transition. Set the compact preview
on padding transition completion.
Retain cleared attachment chips for their exit transition, then release them.
Stretch the existing liquid-glass map while the composer resizes; rasterize only
after 80ms without a size change. Keep other glass surfaces' updates immediate.

Add an optional mobile motion variant to the shared transcript renderer. Defer
its origin measurement one frame so the dock has published its height, then use
transform and opacity animations (420ms rise, 200ms fade and reply reveal).
Cancel pending frames and animations on a new prompt or unmount. Retain existing
desktop timings. No provider, Host protocol or native persistence changes.

Run affected composer/transcript regressions, check:web, a production build and
mobile build. Inspect the real components in a phone-sized browser fixture.
Native Android/iOS keyboard animation and device frame rates remain unverified
unless exercised on physical devices.
