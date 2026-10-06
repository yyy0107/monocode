# Feature 023: Mobile project and conversation home

## Scope

The user requested the mobile interface only. The supplied screenshots are
visual references for project, pinned and recent conversation lists.

- Launch and successful connection open a home page for the connected computer.
- Home and the sidebar's All projects entry show projects plus conversations
  across those projects. A project name opens that project's conversation page.
- Remove the new-conversation plus beside every sidebar project. Retain a
  separate disclosure arrow and the global new-conversation action.
- The list page includes search, pinned and recent conversations, relative
  update times, provider indicators and unread/running state.
  Provider icons precede conversation titles; unread notification dots sit at
  the trailing edge of the row, after the relative timestamp.
- Home and All projects' top-right search button replaces the leading button and center title
  with one input capsule. The separate trailing button dismisses search;
  typing filters the current home/project scope and dismissal clears it.
  The capsule reuses the shared glass material and respects header safe insets.
- Selected project pages follow the supplied flat-list reference: a leading
  Back button beside the project title and Host connection status, single-line
  conversation titles with trailing times, and separate bottom Search / Chat
  capsules. Search opens the existing animated header input; aggregate Home
  and All projects keep their current layout. Preserve provider icons, unread
  indicators, running metadata, pinned disclosure and project-title menu.
- Opening a conversation uses its actual owning project. New conversations
  use the selected project, or the last valid project from Home.
- Only conversations opened or created from a project page show Back in the
  leading chat header. This includes regular, pinned and search-result rows
  and the bottom Chat action. Home, All projects, sidebar, notification and
  assistant entries show Menu, even after an earlier project-page visit.
  Entry source is explicit in-memory state, independent of retained list scope.
  Back opens the current conversation's project list; drafts use the selected
  project, and a missing project falls back to Home. Loading, failed loading
  and Settings round trips preserve Back. Returning during loading prevents
  a late response from reopening the conversation. Drawer swipes and Android
  Back keep their existing behavior.
- Settings return to the previous view. Android Back leaves conversations for
  their project page, then returns to Home; search and overlays close first.
- Disclosures animate in both directions with AnimatedCollapse, including
  Show more/Show less. Closing content is inert until animation finishes.
- Home project rows use a 44px minimum height and aggregate conversation rows
  use 48px, with 8px vertical padding for a more compact list.
- Home and sidebar projects sort by their newest non-archived conversation's
  update time, descending; equal times retain the supplied project order.
  Sidebar summaries refresh while open and foregrounded, including collapsed
  projects. The current project and projects with running conversations open
  by default; manual collapses survive refreshes. Expanded projects remain
  visible beyond the normal five-project preview, using animated batches.
- Labels support English and Simplified Chinese; user/provider values survive.
- Home's top-center title uses plain text and a dropdown arrow instead of a
  capsule. Its dropdown shows Add connection and Settings and reuses the
  existing MobileSheet popup and row styling.
  The popup covers the title trigger and aligns its top with the trigger and
  adjacent header capsules. Its width is capped at 180px and shrinks to the
  title's available space on narrow screens, leaving both side buttons clear.
- Mobile Settings adds a Message composer group with Queue / Steer follow-up
  behavior. The preference is remembered locally and included in subsequent
  conversation sends. Supported active turns receive steering; unavailable,
  finishing, paused or edited queues retain the message for normal queue handling.
  New conversations and idle turns retain their existing send behavior.

Desktop navigation, provider protocols, publication and APK installation are
outside this request.

## Conversation long-press follow-up

Home, pinned and project conversation rows open an anchored action popup on a
450 ms hold, right click or keyboard context-menu shortcut. The popup identifies
the conversation and exposes existing pin, unread, copy ID, rename and archive
actions. Scrolling and cancelled touches must not open it or navigate.
