# Multi-project sidebar contract

ProjectList accepts controlled expansion keyed by pathKey, an independent
disclosure callback, child rendering and per-project creation. Its existing
standalone/full/compact callers remain supported. Tree rows reuse existing
display names, pins, grouping and ordering; names/paths are never translated.
Tree session rows, including folder members, match their project header's
horizontal bounds and 32px height while keeping titles on one line.
Tree row and session-group gaps are consistently 3px, including collapsed
folders and the last member of expanded folders, pins and reminders. Project
groups retain 8px separation. Disclosure/member spacing follows the same 3px
rhythm without narrowing child rows.
Child row content is inset to the project-name edge (folder members to the
folder title); only the inner padding changes. In the tree the project avatar
occupies the disclosure slot and swaps to a chevron on hover/focus. Each project
shows its first 5 ungrouped chats with Show more/Show less; the active chat is
always shown, folders/pins/reminders are not counted, and search shows all.
A name click on an open project collapses it without activating it; a
collapsed project activates and expands. Child rows animate with the shared
fold styles through shared `AnimatedCollapse` (reduced motion skips it), stay
inert while closing and unmount once closed. Project groups and session folders,
pins and reminders use the same component for both directions. Closing content
and portals are hidden from interaction, and rapid reversal cancels stale timers.
This follows the standing expand/collapse rule in AGENTS.md.

Terminal dock grid tracks reuse that rule through `useCollapseMotion` and shared
size-transition styles. Closed tracks have zero size without changing grid areas.
Terminal views stay mounted; closing docks become inert and suppress portals and
focus. Direct resizing is immediate, commits before hiding, and restores the
saved dimension after reopening. Reduced motion settles immediately.

Sidebar is the sole width/transition owner. Each expanded project owns a
ProjectSessionSection; only the active project publishes keyboard navigation
order. Batch selection and session/folder drops cannot cross project roots.
Remote row identity is the pair of project key and host session id. Existing
Shared Host native-session rows continue through the local native import path.
That local route applies only to locally shared projects; native rows from a
remote Host use the existing remote open path.

App local history has project-keyed load/error/request state. Equal in-flight
reads deduplicate; forced revalidation makes earlier responses obsolete. Session
mutation refreshes and persistence update that session's project, even inactive.
onNewInProject(cwd) creates and focuses a chat using that project's worktree.
Removing or relocating a project invalidates its in-flight reads and clears or
rebases loaded/error state with the same pathKey normalization.

Remote summary cache is readable with polling disabled, including a successfully
loaded empty list. One-shot prefetch and polling deduplicate. Failed reads keep
previous summaries and expose project-local error/offline state.
An unregistered remote:// project is offline, with a scoped retry error instead
of an indefinite initial loading indicator. Reminder cwd and known shell/Host
bindings scope reminder, completion and linked-update state.

Search uses project label/path and session display title only, preserves existing
filters, and fills missing summaries at concurrency <=4. Search expands matching
ancestors temporarily, without changing saved expansion. Folder pruning requires
the complete successful project list, never filtered/search rows.
Failed retries remain visible as project errors. The active file/change surface
is separate from the Sessions project tree and follows the working-copy contract
below.

## Files and Changes working copy

When `tab !== "sessions"` and `recents !== undefined`, Sidebar renders the
existing compact, ghost `SearchableProjectPicker` in the top header, replacing
the Projects title. A compact branch/worktree control sits beside it for an
available local Git project and preserves the existing selector behavior.
Quick-open/search and add remain at the right of the header. Tabs follow the
header immediately; these modes have no standalone project-picker or worktree
toolbar rows below them. The picker receives the current cwd and recents;
selection calls `onSelectProject(path)` through the existing App handler and
opening a project reuses `onOpenProject`. The picker
shows the existing project avatar and resolved display name through an optional
visible label in compact mode, and retains its search/popover behavior.

The remaining viewport contains one working copy for cwd: FileTree or
ProjectSearch in Files, SourceControl in Changes. It does not render ProjectList
rows and does not depend on project expansion state. A `flex-1 min-h-0` region
uses all remaining sidebar height instead of the former 60%/420px cap. Files
uses `overflow-hidden` so its file tree scrolls internally; Changes uses
`overflow-y-auto` so its controls and change list remain reachable in short
windows. Header diff statistics continue to follow only the active git root.

An empty or `~` cwd retains the picker and shows the existing localized
`Choose project` hint (`选择项目`). With `recents === undefined`, Sidebar keeps
the existing single-project header, worktree toolbar, ProjectList and bounded
working-copy behavior and omits the project picker.

## Sessions project scope

Multi-project Sessions uses the same header picker with an optional
onSelectAllProjects callback and empty picker cwd for All projects. Its railCwd
remains the active cwd so every remembered/current project stays selectable.
The default scope is All projects; choosing a project (including the active one)
sets a window-local scope, activates it and expands its session section. Choosing
All projects clears only the scope. Files/Changes and other picker consumers
have no All projects option and retain their existing activation behavior.

The selected scope limits tree rows, missing-history reads and search matches.
Search still respects existing session filters. Project groups are temporarily
revealed in a concrete scope without changing saved group collapse state;
unrelated groups are hidden. Saved project expansion is retained. Only an active
project still visible in the tree publishes keyboard navigation order. Remote
projects retain their existing cache/loading/open behavior and scoped identity.
The selection survives sidebar tab changes, but removing its project restores
All projects. A matching active local project's worktree selector sits beside
the concrete project picker; All projects has no worktree selector.

RecentProject[] storage is unchanged; rememberProject no longer evicts at 20.
Expansion storage uses normalized paths and follows project rename/remove.
Older already-evicted projects are not reconstructed.

## Hover summaries

ProjectList optionally accepts projectSummaries keyed by pathKey and an
onProjectHoverOpen callback. ProjectHoverSummary contains optional total,
unread, opened, historyState (idle/loading/ready/error), optional cached and
optional canRetry. canRetry:false suppresses actions without a backend loader;
unknown entries without such a loader use the identity/actions-only fallback.
Absent data leaves identity/actions available without invented counts. Sidebar
adds optional openSessionIds alongside retained openSessions; App passes the
deduplicated session leaves of all workspace tabs.

Counts use full unfiltered project history and cached Host rows, exclude
archived chats and orchestration workers from total/unread, and add genuine
open blank chats. Opened counts actual workspace conversations (including a
still-open archived chat), never all retained runtime sessions. Remote ID
deduplication and unseen flags remain project-scoped. Unknown total is omitted;
a complete empty listing is zero. Failed reads retain cached counts when
available and expose unavailable/cached state. Hover performs one-shot reads
through existing loaders, without enabling collapsed-project polling.

Both cards use the shared HoverSummary surface and interaction hook. Session
summaries are read-only tooltips; project summaries are accessible dialogs
whose controls reuse existing pin/menu operations. Hover/focus opens immediately;
leaving both the row and card closes immediately when neither retains focus.
There are no open/close timers or entrance animation. A 1px placement overlap
and whole-frame pointer boundary retain direct row/card transfer, including
flipped placement; the trigger region includes the full project header.
Focus inside the portal retains the surface and Tab reaches project actions.
Escape restores the project
trigger without reopening it. Menus, drag, ancestor scrolling and hidden or
closing parent surfaces dismiss summaries. Existing Popover positioning and
AnimatedCollapse/SurfaceVisibility contracts remain the source of layout,
motion and portal visibility.

## Session folder retirement — 2026-10-05

Supersedes references to user-defined session folders above: desktop sessions
are flat within each project. Stored folder membership/collapse cannot affect
visibility, ordering, pagination or navigation. Dragging one session onto another
does nothing; workspace pane drops remain supported. Group menus, composer
folder commands, automation destination pickers and Operator folder actions are
removed. Pins, reminders and project groups keep their existing behavior.

## Recent sections — 2026-10-05

Recent projects replaces the ordinary Projects heading. Unpinned projects,
including group members, use openedAt descending; their saved manual rail order
is ignored and they do not initiate drag sorting. Pins retain manual order.
ProjectList accepts optional recentEntries (project-key/session-id identity plus
rendered shortcut), positioned after Pinned with an independent five-row preview.
Optional recentPending suppresses an empty-state hint until summary reads settle.
The recent section uses the existing AnimatedCollapse reveal/closing lifetime.
Sidebar supplies filtered non-worker history and missing open conversations;
Host shell IDs are canonicalized within their project before deduplication.
Recent shortcuts sort by updatedAt descending, regardless of pin, and use the
same native/local/remote session actions as pinned shortcuts. Scope/search and
filters affect both lists. Single-project callers omit recentEntries.
The shared summary queue reads collapsed as well as expanded projects at
concurrency <=4 while the multi-project Sessions sidebar is open. These are
one-shot reads, with no collapsed Host polling; hiding the sidebar or leaving
Sessions stops queued work. Search clearing leaves recent-summary discovery on.
