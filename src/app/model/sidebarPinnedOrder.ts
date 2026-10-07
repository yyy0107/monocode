import { mergeOrderedSubset } from "../../shared/lib/reorder";

const KEY = "monocode.sidebarPinnedOrder.v1";
const CHANGED = "monocode:sidebar-pinned-order-changed";

export function loadSidebarPinnedOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}

/** Preserve hidden, filtered and not-yet-loaded pins when moving visible rows. */
export function reorderSidebarPins(
  order: string[],
  visible: string[],
): string[] {
  const all = [...new Set([...order, ...visible])].map((id) => ({ id }));
  return mergeOrderedSubset(
    all,
    visible.map((id) => ({ id })),
  ).map(({ id }) => id);
}

export function saveSidebarPinnedOrder(order: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // The current view still supports sorting when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function subscribeSidebarPinnedOrder(onChange: () => void): () => void {
  let previous = JSON.stringify(loadSidebarPinnedOrder());
  const notify = () => {
    const next = JSON.stringify(loadSidebarPinnedOrder());
    if (next === previous) return;
    previous = next;
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) notify();
  };
  window.addEventListener(CHANGED, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, notify);
    window.removeEventListener("storage", onStorage);
  };
}
