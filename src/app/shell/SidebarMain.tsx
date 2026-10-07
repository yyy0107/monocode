import { useLayoutEffect, useRef, type ReactNode } from "react";
import { SIDEBAR_TRANSITION_MS } from "./SidebarTransition";

/** Keep text width fixed during the slide and resize it only at the endpoints. */
export function SidebarMain({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useRef<{
    open: boolean;
    left: number;
    width: number;
    parentWidth: number;
  }>(undefined);
  const animation = useRef<Animation | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current!;
    const previous = layout.current;
    const changing = previous && previous.open !== open;
    const canAnimate =
      typeof el.animate === "function" &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Opening keeps the old, wider text surface until it has slid behind the
    // sidebar. Closing adopts that wider surface immediately. In both cases
    // the right edge stays covered and text never reflows on animation frames.
    if (changing)
      el.style.flex = open && canAnimate ? `0 0 ${previous.width}px` : "";
    const next = {
      open,
      left: el.offsetLeft,
      width: el.offsetWidth,
      parentWidth: el.parentElement!.clientWidth,
    };
    layout.current = next;
    if (!previous || previous.open === open) return;

    // Include the current visual offset when reversing an unfinished slide.
    const transform = animation.current
      ? getComputedStyle(el).transform
      : "none";
    const translated =
      transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
    animation.current?.cancel();
    animation.current = undefined;
    const offset = previous.left - next.left + translated;
    if (!offset || !canAnimate) {
      el.style.removeProperty("flex");
      return;
    }

    const motion = el.animate(
      [
        { transform: `translateX(${offset}px)` },
        { transform: "translateX(0)" },
      ],
      {
        duration: SIDEBAR_TRANSITION_MS,
        easing: "cubic-bezier(0.2, 0.65, 0.3, 1)",
      },
    );
    animation.current = motion;
    void motion.finished.catch(() => undefined);
    motion.onfinish = () => {
      if (animation.current !== motion) return;
      animation.current = undefined;
      motion.cancel();
      el.style.removeProperty("flex");
      layout.current = { ...next, left: el.offsetLeft, width: el.offsetWidth };
    };
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current!;
    // Direct resizing changes layout immediately and must not inherit a slide.
    const onResize = () => {
      const previous = layout.current;
      if (!previous) return;
      const left = el.offsetLeft;
      const width = el.offsetWidth;
      const parentWidth = el.parentElement!.clientWidth;
      if (
        previous.left === left &&
        previous.width === width &&
        previous.parentWidth === parentWidth
      )
        return;
      animation.current?.cancel();
      animation.current = undefined;
      el.style.removeProperty("flex");
      layout.current = {
        ...previous,
        left: el.offsetLeft,
        width: el.offsetWidth,
        parentWidth,
      };
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(onResize);
    observer?.observe(el);
    // A held-width surface does not resize when its parent or sidebar does.
    if (el.parentElement) {
      observer?.observe(el.parentElement);
      el.parentElement
        .querySelectorAll(
          ":scope > [data-sidebar-transition], :scope > [data-sidebar-rail]",
        )
        .forEach((sibling) => observer?.observe(sibling));
    }
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotionPreference = () => {
      if (!media?.matches) return;
      animation.current?.cancel();
      animation.current = undefined;
      el.style.removeProperty("flex");
      if (layout.current)
        layout.current = {
          ...layout.current,
          left: el.offsetLeft,
          width: el.offsetWidth,
        };
    };
    media?.addEventListener?.("change", onMotionPreference);
    return () => {
      observer?.disconnect();
      media?.removeEventListener?.("change", onMotionPreference);
      animation.current?.cancel();
      el.style.removeProperty("flex");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar-main
      className="body-glass flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
}
