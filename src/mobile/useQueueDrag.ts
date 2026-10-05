import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { moveItem } from "../shared/lib/reorder";

type Drag = { id: string; left: number; top: number; width: number };
const HOLD_MS = 400;
const MOVE_SLOP = 8;

/** Touch-first sorting: short taps open actions, swipes scroll, a hold drags. */
export function useQueueDrag(
  ids: string[],
  enabled: boolean,
  onDrop: (id: string, beforeId?: string) => void,
) {
  const [drag, setDrag] = useState<Drag>();
  const [preview, setPreview] = useState<string[]>();
  const cleanup = useRef<(() => void) | undefined>(undefined);
  const suppressUntil = useRef(0);
  const latest = useRef({ ids, enabled, onDrop });
  latest.current = { ids, enabled, onDrop };
  const key = ids.join("\0");
  const cancel = () => {
    cleanup.current?.();
    setDrag(undefined);
    setPreview(undefined);
  };
  useEffect(() => {
    cancel();
  }, [key]);
  useEffect(() => {
    if (!enabled && cleanup.current) cancel();
  }, [enabled]);
  useEffect(() => () => cleanup.current?.(), []);

  const start = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!enabled || ids.length < 2 || event.button !== 0 || cleanup.current)
      return;
    suppressUntil.current = 0;
    const handle = event.currentTarget;
    const list = handle.parentElement!;
    const nodes = [...list.querySelectorAll<HTMLElement>("[data-queue-id]")];
    const rects = nodes.map((node) => node.getBoundingClientRect());
    const from = ids.indexOf(id);
    if (from < 0 || nodes.length !== ids.length) return;
    const rect = rects[from];
    const startX = event.clientX,
      startY = event.clientY,
      scrollStart = list.scrollTop;
    const grabOffset = startY - rect.top;
    const pointerId = event.pointerId;
    let active = false,
      moved = false,
      y = startY,
      order = ids;
    let frame = 0;
    const place = () => {
      const center =
        y - grabOffset + rect.height / 2 + list.scrollTop - scrollStart;
      let to = from,
        distance = Infinity;
      rects.forEach((slot, index) => {
        const nextDistance = Math.abs(center - slot.top - slot.height / 2);
        if (nextDistance < distance) {
          to = index;
          distance = nextDistance;
        }
      });
      const next = moveItem(ids, from, to);
      // Most moves stay within the same slot; only a new order re-renders.
      if (next.some((entry, index) => entry !== order[index])) {
        order = next;
        setPreview(order);
      }
      setDrag({ id, left: rect.left, top: y - grabOffset, width: rect.width });
    };
    const tick = () => {
      if (!active) return;
      const bounds = list.getBoundingClientRect();
      const speed = y < bounds.top + 24 ? -7 : y > bounds.bottom - 24 ? 7 : 0;
      if (speed) {
        list.scrollTop += speed;
        place();
      }
      frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      if (moved || !latest.current.enabled) return;
      active = true;
      suppressUntil.current = Infinity;
      place();
      frame = requestAnimationFrame(tick);
    }, HOLD_MS);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      y = next.clientY;
      if (next.cancelable) next.preventDefault();
      if (!active) {
        if (Math.hypot(next.clientX - startX, y - startY) > MOVE_SLOP) {
          moved = true;
          clearTimeout(timer);
          list.scrollTop = scrollStart - (y - startY);
        }
        return;
      }
      place();
    };
    const stop = (next?: PointerEvent, commit = false) => {
      if (next && next.pointerId !== pointerId) return;
      const wasActive = active;
      active = false;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", aborted);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", keydown);
      if (handle.hasPointerCapture?.(pointerId))
        handle.releasePointerCapture(pointerId);
      cleanup.current = undefined;
      if (wasActive || moved) suppressUntil.current = Date.now() + 500;
      setDrag(undefined);
      if (
        commit &&
        wasActive &&
        latest.current.enabled &&
        order.some((entry, index) => entry !== ids[index])
      ) {
        latest.current.onDrop(id, order[order.indexOf(id) + 1]);
      } else setPreview(undefined);
    };
    const up = (next: PointerEvent) => stop(next, true);
    const aborted = (next: PointerEvent) => stop(next);
    const blur = () => stop();
    const keydown = (next: KeyboardEvent) => {
      if (next.key === "Escape") {
        next.preventDefault();
        stop();
      }
    };
    cleanup.current = () => stop();
    handle.setPointerCapture?.(pointerId);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", aborted);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", keydown);
  };
  return {
    drag,
    order: preview ?? ids,
    start,
    cancel,
    clearPreview: () => setPreview(undefined),
    suppressClick: () => Date.now() < suppressUntil.current,
  };
}
