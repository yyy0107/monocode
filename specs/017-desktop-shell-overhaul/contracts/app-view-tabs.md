# App-view tab contract

`FilePaneTab.appView` is optional: `{ kind }` where kind is `settings`,
`search`, `inbox`, `notes` or `automations`. Such a tab has path `app:<kind>`
and cwd `~` and carries no other virtual-tab field. `editorTabKey` is
`app:<kind>`. App views are virtual documents, never previews.

A window holds at most one tab per kind. Opening an existing kind focuses it.
A workspace tab whose panes contain only app views belongs to no project and
is shown in every project's tab strip. Files, diffs and plans never open into
a pane whose active file is an app view.

`FilePane` and `AppViewHost` provide a bounded-height flex chain to the view.
The host fills the available pane, including when split beside a session or
resized by the terminal dock. View roots can use `flex-1`; their internal
scrollers use `min-h-0` and `overflow-y-auto`. Content must overflow its own
scroller rather than expand past the pane and be clipped by `PaneTree`.

First-use lazy content suspends within the app pane. Its fallback fills that
pane without replacing the surrounding window shell or adjacent panes.
Showing an already visited view retains its mounted instance and local state.

Snapshots persist only the kind. Sanitizing rejects entries mixing `appView`
with other virtual fields and keeps the first entry per kind. Older snapshots
need no migration; older builds treat a saved app view as a missing virtual
file the user can close.
