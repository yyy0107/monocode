# Mobile navigation contract

`View = home | chat | settings`.

- `homeProjectId` selects the displayed history scope; absent means all projects.
  It does not mutate the active conversation or provider configuration.
- Launch opens `home` with no selected home project. Persisted last-location
  records retain their existing shape and supply a valid default project.
- A project page opens without provider/model discovery. Model discovery begins
  when opening or creating a conversation, independently of history loading.
- A conversation list row carries both session id and owning HostProject.
  Cross-project opens load the owner and validate the snapshot's project id.
- Settings remember the previous view; Android Back from chat opens its project
  list. Home project Back opens the aggregate page.
- Histories use existing `sessions.list({projectId})`; no Host API changes.
  A failed project leaves successful and previously loaded rows usable and
  offers Retry. Requests cannot update a scope after its effect is disposed.
- Home, All projects and project pages share a controlled header search query.
  Search replaces the leading button/title with a capsule; their hidden
  controls are inert. The trailing button closes search, as do Escape and
  Android Back. Dismissal or leaving Home clears the query; closing content
  remains inert until shared motion completes and trigger focus is restored.
  Search matches session titles and project names only within the current scope.
  Selected project pages launch search from their bottom dock and restore focus
  to that persistent trigger on close; an open search also has a header Close
  button. Their idle header shows Back, project-title menu and Host status;
  their dock Chat action creates a conversation in that selected project.
- Archived sessions are excluded; pinned sessions appear once in Pinned and
  other sessions retain the existing activity/running ordering in Recent.
- Conversation rows put the provider icon before the title and unread marker
  after the timestamp on the right. Unread state and notification consumption
  retain their existing behavior; the icon remains visible when titles truncate.
- The Home title opens a MobileSheet dropdown with Add connection and Settings.
  Settings retains the current home scope on return; connection form dismissal
  restores focus to the title. Android Back closes the dropdown first.
- MobileSheet accepts optional controlled `open`; when false it remains inert
  during shared closing motion, then unmounts its dialog. Existing sheets
  retain their default open behavior. The Home title has `data-capsule=false`
  and is excluded from the CSS glass surfaces and liquid-glass selector.
- MobileSheet's optional `overlapAnchor` places the popup over its trigger with
  the same top edge; other popovers keep their existing offset positioning.
- Optional `constrainWidthToAnchor` bounds the popup width to its trigger's
  measured width and recalculates on resize. Home uses a 180px cap; its title
  fills only the space between side buttons, preserving their 8px gaps.
- Settings' composer preference uses `monocode.followUpBehavior` and the
  existing shared default (`steer`). New send commands can include optional
  `followUpBehavior: queue | steer`; omission retains existing Host queue
  behavior. The preference never mutates a previously journaled command.
- Host records a selected steering message as a queue acceptance with the
  original command ID before attempting steering. Receipt replay cannot inject
  twice. Unsupported, finishing or unavailable steering, active queue edits
  and paused queues fall back to the same durable queue. Provider rejection
  pauses the queue and retains the message through the existing failure path.
