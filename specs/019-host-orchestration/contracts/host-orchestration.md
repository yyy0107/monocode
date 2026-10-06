# Host orchestration contract

- Host advertises `sessions.orchestration`; lifecycle retains `sharedDesktop: 2`
  and adds `orchestrationHost: 1`. Missing capability disables new controls.
- Send accepts `intent: orchestrate` and an optional saved proposal block for
  regeneration. Host owns the author/catalog; clients may edit tasks/parallelism.
- Edit/confirm bind the current Host session revision. Run controls bind a stable
  orchestration ID, distinct from the provider turn run ID. All mutations carry
  command IDs and preserve the existing durable-acceptance receipt semantics.
- Optional snapshots/summary fields expose run/task state and worker membership.
  They never expose credentials, internal control receipts or scratch paths.
- Client identity is environment + project + Host session ID. UI shell IDs and
  remote path aliases are presentation mappings, never execution authority.
- Managed worker operations are trusted internal Engine calls. Public commands
  cannot independently send/configure/approve/delete a worker or bypass Resume.
- Control CLI retains list/delegate/get/wait/respond/answer/steer/message/retry/
  cancel/review/finish, strict input validation and request-ID retry semantics.
- Immutable checkout baselines and after-images gate integration and cleanup.
  Checkout reservations span Git work without holding SQLite write transactions.
- Legacy retirement uses exact durable IDs and per-source import tombstones.
  Source import stays read-only; native source deletion follows Host acceptance.
