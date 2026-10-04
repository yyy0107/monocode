# Tasks

- [x] T001 Replace the ongoing foreground receiver with an app-bound receiver and legacy cleanup.
- [x] T002 Configure heads-up eligible conversation alerts and provide system channel settings access.
- [x] T003 Verify native background reception, shutdown, unread state, deduplication and alert configuration.
- [x] T004 Run web/Host checks and desktop/mobile/native builds; record actual outcomes and limits.

Executed evidence is in quickstart.md. The notification-specific checks passed;
the full workspace check:web gate did not pass because of concurrently edited
provider tests. A checked execution task does not claim those tests passed.
