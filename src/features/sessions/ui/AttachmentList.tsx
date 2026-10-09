import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "../../../shared/lib/reducedMotion";
import { COMPOSER_MOTION_EASING, COMPOSER_MOTION_MS } from "../model/composerResize";
import type { Attachment } from "../model/session";
import { AttachmentChip } from "./AttachmentChip";

/** Shared attachment list for transcripts and composers on both platforms. */
export function AttachmentList<T extends Attachment>({
  attachments, onRemove, renderAttachment, animated = false, style, ...props
}: HTMLAttributes<HTMLDivElement> & {
  attachments: T[];
  onRemove?: (id: string) => void;
  renderAttachment?: (attachment: T) => ReactNode;
  /** Chips added or removed after mount fade in place; the rest slide over. */
  animated?: boolean;
}) {
  const items = useAttachmentPresence(attachments, animated);
  const list = useRef<HTMLDivElement>(null);
  useAttachmentMotion(list, animated, items.list, items.release);
  const render = (file: T) => renderAttachment
    ? renderAttachment(file)
    : <AttachmentChip key={file.id} attachment={file} onRemove={onRemove ? () => onRemove(file.id) : undefined} />;
  if (!animated) return <div {...props} style={style}>{attachments.map(render)}</div>;
  return <div {...props} ref={list} style={style} className={`attachment-list-animated${props.className ? ` ${props.className}` : ""}`}>
    {items.list.map(({ attachment, leaving }) =>
      <div
        key={attachment.id}
        className="attachment-presence"
        data-attachment-id={attachment.id}
        data-leaving={leaving || undefined}
        inert={leaving || undefined}
        aria-hidden={leaving || undefined}
      >
        {render(attachment)}
      </div>)}
  </div>;
}

type Presence<T> = { attachment: T; leaving: boolean };

/** Keeps removed chips at their previous position until they finish leaving. */
export function mergeAttachmentPresence<T extends Attachment>(previous: Presence<T>[], next: T[]): Presence<T>[] {
  const ids = new Set(next.map(file => file.id));
  const result: Presence<T>[] = next.map(attachment => ({ attachment, leaving: false }));
  previous.forEach((item, index) => {
    if (ids.has(item.attachment.id)) return;
    let at = 0;
    for (let before = index - 1; before >= 0; before--) {
      const found = result.findIndex(entry => entry.attachment.id === previous[before].attachment.id);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    result.splice(at, 0, { attachment: item.attachment, leaving: true });
  });
  return result;
}

function useAttachmentPresence<T extends Attachment>(attachments: T[], enabled: boolean) {
  const [state, setState] = useState(() => ({
    source: attachments,
    list: attachments.map(attachment => ({ attachment, leaving: false })),
  }));
  let current = state;
  if (enabled && state.source !== attachments) {
    current = { source: attachments, list: mergeAttachmentPresence(state.list, attachments) };
    setState(current);
  }
  const release = (id: string) => setState(previous => ({
    ...previous,
    list: previous.list.filter(item => !(item.leaving && item.attachment.id === id)),
  }));
  return { list: current.list, release };
}

/**
 * Transform/opacity only, so the composer never re-lays out per frame: a
 * leaving chip leaves flow at its last position and fades, while the chips
 * after it start where they were and slide into their new slots.
 */
function useAttachmentMotion(
  list: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  items: unknown,
  release: (id: string) => void,
) {
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const mounted = useRef(false);
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useLayoutEffect(() => {
    const element = list.current;
    if (!enabled || !element) return;
    // Chips present when the list mounts arrive with it.
    const initial = !mounted.current;
    mounted.current = true;
    const motion = !initial && typeof element.animate === "function" && !prefersReducedMotion();
    const options: KeyframeAnimationOptions = { duration: COMPOSER_MOTION_MS, easing: COMPOSER_MOTION_EASING };
    const previous = positions.current;
    const next = new Map<string, { x: number; y: number }>();
    const visible = (child: HTMLElement) => {
      const style = getComputedStyle(child);
      return { opacity: style.opacity, transform: style.transform === "none" ? "none" : style.transform };
    };
    const children = [...element.children] as HTMLElement[];
    const leaving: [HTMLElement, string][] = [];
    // Read every slot before moving anything.
    const slots = children.map((child) => {
      const id = child.dataset.attachmentId!;
      if (child.dataset.leaving !== undefined) {
        if (child.dataset.leavingStarted === undefined) leaving.push([child, id]);
        return undefined;
      }
      if (child.dataset.leavingStarted !== undefined) {
        // Re-added while leaving: rejoin the flow from the visible state.
        delete child.dataset.leavingStarted;
        for (const name of ["position", "left", "top", "margin"] as const) child.style[name] = "";
      }
      return { child, id };
    });
    for (const [child, id] of leaving) {
      const from = previous.get(id);
      child.dataset.leavingStarted = "";
      if (!motion || !from) {
        releaseRef.current(id);
        continue;
      }
      const start = visible(child);
      for (const animation of child.getAnimations()) animation.cancel();
      Object.assign(child.style, { position: "absolute", left: `${from.x}px`, top: `${from.y}px`, margin: "0" });
      const animation = child.animate(
        [start, { opacity: 0, transform: "scale(0.8)" }],
        { ...options, fill: "forwards" },
      );
      void animation.finished.catch(() => undefined);
      animation.onfinish = () => releaseRef.current(id);
    }
    const moves = slots.flatMap((slot) => {
      if (!slot) return [];
      const { child, id } = slot;
      const x = child.offsetLeft;
      const y = child.offsetTop;
      next.set(id, { x, y });
      if (!motion) return [];
      const from = previous.get(id);
      const running = child.getAnimations();
      const offset = running.length ? new DOMMatrixReadOnly(getComputedStyle(child).transform) : undefined;
      const start = running.length ? visible(child) : undefined;
      return [{ child, from, dx: from ? from.x - x + (offset?.e ?? 0) : 0, dy: from ? from.y - y + (offset?.f ?? 0) : 0, start, running }];
    });
    for (const { child, from, dx, dy, start, running } of moves) {
      if (!from) {
        const animation = child.animate([{ opacity: 0, transform: "scale(0.8)" }, { opacity: 1, transform: "none" }], options);
        void animation.finished.catch(() => undefined);
        continue;
      }
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !running.length) continue;
      for (const animation of running) animation.cancel();
      const animation = child.animate(
        [{ opacity: start?.opacity ?? 1, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 1, transform: "none" }],
        options,
      );
      void animation.finished.catch(() => undefined);
    }
    positions.current = next;
  }, [list, enabled, items]);
}
