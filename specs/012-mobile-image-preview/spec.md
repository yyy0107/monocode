# Mobile image file previews

Date: 2026-10-04.

Clicking an image file referenced in a conversation or Read tool opens the
existing bottom file sheet with the actual image below its name and path.
This includes absolute temporary paths outside the registered project, such as
`/tmp/monocode-image-preview/sheet.png`, through the authenticated Host's existing
read-only binary command.

Support PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG with the browser's image
decoder. Raster MIME comes from the existing shared byte detector, allowing
extensionless attachments and mismatched extensions. SVG retains the existing
image display behavior. Images up to the Host's 10 MiB read limit are previewable;
text retains its current limits and lazy rendering.

Fit large/tall images within the phone panel. Report unreadable/unsupported image
data without leaving a broken image. Release object URLs on file changes and
sheet dismissal, and ignore stale reads. Localize application-owned error text.
Preserve conversation, tool navigation, provider protocols and unrelated edits.

No provider calls, Rust changes, Host permission expansion, service restart or
native device deployment is required for the source implementation. Native phone
verification and a deployed Host update are separate from local build evidence.
