import type { Note } from "../features/notes/notesText";

// Keep writes ordered even if an editor is closed and reopened mid-request.
// The key includes the Host identity; equal note IDs on other Hosts are isolated.
const queues = new Map<
  string,
  { pending: Promise<Note | void>; saved?: Note }
>();
export function enqueueMobileNoteSave(
  key: string,
  save: (latest?: Note) => Promise<Note | void>,
) {
  const queue = queues.get(key) ?? { pending: Promise.resolve() };
  const persist = async () => {
    const saved = await save(queue.saved);
    if (saved) queue.saved = saved;
    return saved;
  };
  const pending = queue.pending.then(persist, persist).finally(() => {
    if (queue.pending === pending) queues.delete(key);
  });
  queue.pending = pending;
  queues.set(key, queue);
  return pending;
}
