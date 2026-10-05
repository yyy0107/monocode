# App-view tab contract

`FilePaneTab.appView` is optional: `{ kind }` where kind is `settings`,
`search`, `inbox`, `notes` or `automations`. Such a tab has path `app:<kind>`
and cwd `~` and carries no other virtual-tab field. `editorTabKey` is
`app:<kind>`. App views are virtual documents, never previews.

A window holds at most one tab per kind. Opening an existing kind focuses it.
A workspace tab whose panes contain only app views belongs to no project and
is shown in every project's tab strip. Files, diffs and plans never open into
a pane whose active file is an app view.

Snapshots persist only the kind. Sanitizing rejects entries mixing `appView`
with other virtual fields and keeps the first entry per kind. Older snapshots
need no migration; older builds treat a saved app view as a missing virtual
file the user can close.
