import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { translate } from "../i18n/language";
import { LAYER } from "../lib/layers";
import { CircleAlert, CircleCheck, LoaderCircle, X } from "./icons";
import "./status-toast.css";

/**
 * Transient progress/result notices for actions that finish out of view:
 * a loading toast that turns into a success or error toast in place.
 * Desktop and mobile share one self-mounted host on `document.body`.
 */
export type StatusToastTone = "loading" | "success" | "error";

type Item = {
  id: number;
  message: string;
  tone: StatusToastTone;
  leaving: boolean;
};

const DURATION: Record<StatusToastTone, number> = {
  loading: 0,
  success: 2600,
  error: 5000,
};
const EXIT_MS = 180;
const LIMIT = 3;

let items: Item[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let mounted = false;

function emit(next: Item[]) {
  items = next;
  for (const listener of listeners) listener();
}

function schedule(id: number, tone: StatusToastTone) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const duration = DURATION[tone];
  if (duration > 0) timers.set(id, setTimeout(() => dismissStatusToast(id), duration));
}

function ensureHost() {
  if (mounted || typeof document === "undefined") return;
  mounted = true;
  const host = document.createElement("div");
  host.dataset.statusToastHost = "";
  document.body.appendChild(host);
  createRoot(host).render(<StatusToastHost />);
}

export function showStatusToast(message: string, tone: StatusToastTone = "success"): number {
  ensureHost();
  const id = ++nextId;
  const live = items.filter((item) => !item.leaving);
  // Older finished notices make room; a long-running action keeps its toast.
  const overflow = live.length - LIMIT + 1;
  const evicted = new Set(
    overflow > 0
      ? live.filter((item) => item.tone !== "loading").slice(0, overflow).map((item) => item.id)
      : [],
  );
  emit([
    ...items.map((item) => (evicted.has(item.id) ? { ...item, leaving: true } : item)),
    { id, message, tone, leaving: false },
  ]);
  for (const evictedId of evicted) finishLeaving(evictedId);
  schedule(id, tone);
  return id;
}

export function updateStatusToast(id: number, message: string, tone: StatusToastTone) {
  if (!items.some((item) => item.id === id && !item.leaving)) {
    showStatusToast(message, tone);
    return;
  }
  emit(items.map((item) => (item.id === id ? { ...item, message, tone } : item)));
  schedule(id, tone);
}

function finishLeaving(id: number) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      emit(items.filter((item) => item.id !== id));
    }, EXIT_MS),
  );
}

export function dismissStatusToast(id: number) {
  if (!items.some((item) => item.id === id && !item.leaving)) return;
  emit(items.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
  finishLeaving(id);
}

type Outcome<T> = string | false | ((value: T) => string | false);

/**
 * Shows `loading` while `task` runs, then `success` (or `error`) in the same
 * toast. `false` closes the toast silently, e.g. when the caller already
 * reports failures inline. The task's result or error passes through.
 */
export async function withStatusToast<T>(
  task: () => Promise<T>,
  {
    loading,
    success,
    error = (reason) => (reason instanceof Error ? reason.message : String(reason)),
  }: {
    loading: string;
    success: Outcome<T>;
    error?: Outcome<unknown>;
  },
): Promise<T> {
  const id = showStatusToast(loading, "loading");
  const settle = <V,>(outcome: Outcome<V>, value: V, tone: StatusToastTone) => {
    const message = typeof outcome === "function" ? outcome(value) : outcome;
    if (message) updateStatusToast(id, message, tone);
    else dismissStatusToast(id);
  };
  try {
    const value = await task();
    settle(success, value, "success");
    return value;
  } catch (reason) {
    settle(error, reason, "error");
    throw reason;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function StatusToastHost() {
  const current = useSyncExternalStore(subscribe, () => items, () => items);
  return (
    <div className="status-toast-stack" style={{ zIndex: LAYER.toast }}>
      {current.map((item) => (
        <StatusToastView key={item.id} item={item} />
      ))}
    </div>
  );
}

function StatusToastView({ item }: { item: Item }) {
  const Icon = item.tone === "loading" ? LoaderCircle : item.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      className="status-toast"
      data-tone={item.tone}
      data-leaving={item.leaving || undefined}
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      inert={item.leaving}
    >
      <Icon className="status-toast-icon" aria-hidden="true" />
      <span className="status-toast-message">{item.message}</span>
      {item.tone !== "loading" && (
        <button
          type="button"
          className="status-toast-close"
          aria-label={translate("Close")}
          onClick={() => dismissStatusToast(item.id)}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
