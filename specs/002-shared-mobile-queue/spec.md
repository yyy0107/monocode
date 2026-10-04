# Shared mobile and desktop message queue

The mobile and desktop clients opening the same Host-owned session share one persistent FIFO queue for every remote provider. Concurrent sends must be accepted once, synchronized in session snapshots/deltas, and executed serially. The shared queue card supports editing, removing, resuming and native steering when the provider supports it. Mobile accepts drafts and attachments during running turns and keeps Stop available.

A successful command receipt means durable acceptance. Duplicate receipt retries must never enqueue or execute twice. Queue editing holds the edited head using a renewable per-view lease; another client cannot overwrite that edit. Normal provider settlement advances the queue only after process cleanup. Cancel, errors, usage limits, restart and abandoned editors pause it until explicit review/resume.

Provider execution belongs to Host. Desktop local sessions remain managed by the existing desktop runner; synchronization requires opening the same Host conversation in Connections. Automatic migration of local sessions, native Pi follow-up queue ownership, local/Host executor takeover and support for new native steering APIs are outside this bounded change.
