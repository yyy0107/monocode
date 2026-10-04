# Implementation plan

Base: local main `2f4b36e3799f6acdd7f4ee33a98f3f705dccdee6` in a new managed
worktree. Existing uncommitted work stays in the original checkout.

Put pure title policy and a timer/attempt coordinator in shared session/harness
modules. Add optional native title reads to adapters, and translate native title
notifications to a shared metadata event. Route it independently of turn output
guards, with provider binding and epoch checks. Reuse the coordinator from desktop
and Host. Persist optional title state in desktop SQLite and Host snapshots and
summaries. Public manual title patches always mark the name as user-owned.

Provider reads use the existing child backend and account-aware live process.
They never create a conversation or send a model prompt. Unknown/missing methods
are harmless and bounded. Keep native text unchanged; generated titles follow
the input language and a 50-character limit, including bare Chinese titles.

Run targeted regressions during each phase, then check:web, test:host, build and
check:rust. Record actual native versions, read-only/real-model evidence and
unavailable scenarios separately. No installation, push, publication or merge.
