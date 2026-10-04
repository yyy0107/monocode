# Implementation and validation

Use the default GlassBackdrop in ModalPanel to read --popover-opacity. Apply the
existing popover-backdrop class to independent dialogs with fixed fills. Use
bg-content/5 for editable fields and SearchableSelect's existing transparent
variant for worktree selectors. Update English and Chinese setting descriptions
and search keywords to mention dialogs.

No new API or persistence contract is needed. The opacity preference continues
to affect background paint only; content opacity and the dismissal overlay remain
independent. Do not change provider or native-window behavior.

Run existing affected UI and appearance tests, the web checks, and a production
build. Inspect actual rendered MCP dialog backgrounds in both themes at multiple
opacity values, including a change while the dialog is open.
