import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  SIDEBAR_TRANSITION_EASING,
  SIDEBAR_TRANSITION_MS,
} from "./SidebarTransition";
import { reducedMotionQuery } from "../../shared/lib/reducedMotion";

/**
 * Follow the sidebar's edge while resizing continuously. The left edge slides
 * with the sidebar and the width interpolates with the same curve, so the right
 * edge stays put and centered content glides instead of jumping at an endpoint.
 */
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
    // Start from the current visual geometry when reversing an unfinished slide.
    let fromLeft = previous?.left ?? 0;
    let fromWidth = previous?.width ?? 0;
    if (changing && animation.current) {
      const transform = getComputedStyle(el).transform;
      fromLeft +=
        transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
      fromWidth = el.offsetWidth;
    }
    if (changing) {
      animation.current?.cancel();
      animation.current = undefined;
      el.style.removeProperty("flex");
    }
    const next = {
      open,
      left: el.offsetLeft,
      width: el.offsetWidth,
      parentWidth: el.parentElement!.clientWidth,
    };
    layout.current = next;
    if (!changing) return;

    const canAnimate =
      typeof el.animate === "function" && !reducedMotionQuery().matches;
    const offset = fromLeft - next.left;
    if (!canAnimate || (!offset && fromWidth === next.width)) return;

    // CSS shortens an interrupted transition when it reverses. Follow the
    // sidebar's actual duration so the two touching edges cannot drift apart.
    // The curve stays the sidebar's own: per spec (and in WebKit/WebKitGTK) a
    // CSS transition reports `linear` effect easing and keeps its timing
    // function on the keyframes, which would slide this surface linearly
    // behind an ease-out sidebar and open a gap while collapsing.
    const sidebar = el.parentElement!.querySelector(
      ":scope > [data-sidebar-transition] .sidebar-transition-clip",
    );
    const slide = sidebar
      ?.getAnimations?.()
      .find(
        (animation) =>
          (animation as CSSTransition).transitionProperty === "transform",
      );
    const timing = slide?.effect?.getTiming();
    // Flex sizing would override the animated width until the slide ends.
    el.style.flex = "none";
    const motion = el.animate(
      [
        { transform: `translateX(${offset}px)`, width: `${fromWidth}px` },
        { transform: "translateX(0)", width: `${next.width}px` },
      ],
      {
        duration:
          typeof timing?.duration === "number"
            ? timing.duration
            : SIDEBAR_TRANSITION_MS,
        easing: SIDEBAR_TRANSITION_EASING,
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
      // An active slide resizes this surface itself; only outside layout
      // changes (window or sidebar resizing) should interrupt it.
      if (
        animation.current &&
        previous.left === left &&
        previous.parentWidth === parentWidth
      )
        return;
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
    const media = reducedMotionQuery();
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
