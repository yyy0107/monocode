import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { reducedMotionQuery } from "../shared/lib/reducedMotion";
import { useCollapseMotion } from "../shared/ui/AnimatedCollapse";
import { SurfaceVisibilityContext, useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { MobilePageStateContext, type MobilePageState } from "./mobilePageState";
import { MobileOverlayLevelContext } from "./MobileOverlayHost";
import { ReadonlyTextStateContext } from "../shared/ui/ReadonlyTextView";
import "./pageMotion.css";

export const MOBILE_PAGE_MOTION_MS = 220;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
export interface MobileRoute {
  key: string;
  section: "home" | "chat" | "settings";
  depth: number;
}
type Direction = -1 | 0 | 1;
type PageMotion = "subtle" | "slide" | "push-chat" | "push-home";
export function mobileRouteDirection(from: MobileRoute, to: MobileRoute): Direction {
  if (from.section === to.section)
    return Math.sign(to.depth - from.depth) as Direction;
  if (to.section === "settings") return 1;
  if (from.section === "settings") return -1;
  return to.section === "chat" ? 1 : -1;
}
const reducedMotion = () => reducedMotionQuery().matches;
function pageMotionValues(direction: Direction, motion: PageMotion) {
  const distance = motion === "subtle" ? 10 : motion === "push-home" ? 30 : 100;
  const unit = motion === "subtle" ? "px" : "%";
  return {
    offset: `${direction * distance}${unit}`,
    exitOffset: `${-direction * distance}${unit}`,
    opacity: motion === "subtle" ? 0 : 1,
    filter: motion === "push-home" ? "brightness(0.7)" : "none",
  };
}

/** Interrupt from the visible position, and let the shared lifetime own cleanup. */
function usePageMotion(
  element: RefObject<HTMLDivElement | null>,
  active: boolean,
  enter: boolean,
  direction: Direction,
  finish: () => void,
  motion: PageMotion = "subtle",
) {
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || (!enter && active) || reducedMotion() || !node.animate) return;
    const computed = getComputedStyle(node);
    const hidden = pageMotionValues(direction, motion);
    const animation = node.animate([
      {
        opacity: node.style.opacity || (active ? hidden.opacity : computed.opacity || "1"),
        transform: node.style.transform || (active ? `translateX(${hidden.offset})` : computed.transform),
        filter: node.style.filter || (active ? hidden.filter : computed.filter),
      },
      {
        opacity: active ? 1 : hidden.opacity,
        transform: active ? "translateX(0px)" : `translateX(${hidden.exitOffset})`,
        filter: active ? "none" : hidden.filter,
      },
    ], { duration: MOBILE_PAGE_MOTION_MS, easing: EASING, fill: "both" });
    // A reversal intentionally cancels the old animation's finished promise.
    void animation.finished.catch(() => {});
    node.dataset.motionApi = "true";
    animation.onfinish = () => {
      if (active) {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
        node.style.removeProperty("filter");
        animation.cancel();
      }
      finish();
    };
    return () => {
      if (animation.playState === "running") {
        const visible = getComputedStyle(node);
        node.style.opacity = visible.opacity;
        node.style.transform = visible.transform;
        node.style.filter = visible.filter;
      }
      animation.onfinish = null;
      animation.cancel();
    };
  }, [active, enter, direction, element, finish, motion]);
}

function PageLayer({ active, visible, enter, direction, page, children, onExited, motion }: {
  active: boolean;
  visible: boolean;
  enter: boolean;
  direction: Direction;
  page: MobilePageState;
  children: ReactNode;
  onExited: () => void;
  motion: PageMotion;
}) {
  const element = useRef<HTMLDivElement>(null);
  const { foldState, finish } = useCollapseMotion(active, MOBILE_PAGE_MOTION_MS);
  const exit = useRef(onExited);
  exit.current = onExited;
  usePageMotion(element, active, enter, direction, finish, motion);
  useLayoutEffect(() => {
    if (!active && foldState === "closed") exit.current();
  }, [active, foldState]);
  useLayoutEffect(() => {
    if (!active) return;
    const node = element.current;
    if (!node) return;
    const selectors = [".mobile-home-scroll", ".mobile-settings", "[data-mobile-page-scroll]"];
    for (const selector of selectors) {
      const scroll = node.querySelector<HTMLElement>(selector);
      if (scroll) scroll.scrollTop = page.scroll.get(selector) ?? 0;
    }
    const save = () => {
      for (const selector of selectors) {
        const scroll = node.querySelector<HTMLElement>(selector);
        if (scroll) page.scroll.set(selector, scroll.scrollTop);
      }
    };
    node.addEventListener("scroll", save, true);
    return () => { save(); node.removeEventListener("scroll", save, true); };
  }, [active, page]);
  useLayoutEffect(() => {
    if (motion === "slide" && active && visible)
      element.current?.querySelector<HTMLElement>(".mobile-sheet-header-button")?.focus({ preventScroll: true });
  }, [motion, active, visible]);
  const hidden = pageMotionValues(direction, motion);
  return (
    <div
      ref={element}
      className="mobile-page-layer"
      data-page-active={active}
      data-page-front={motion === "push-chat" || undefined}
      data-page-motion={!active ? "exit" : enter ? "enter" : undefined}
      style={{
        "--mobile-page-offset": hidden.offset,
        "--mobile-page-start-opacity": hidden.opacity,
        "--mobile-page-start-filter": hidden.filter,
      } as CSSProperties}
      inert={!active || !visible}
      aria-hidden={!active || !visible || undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}
    >
      <MobilePageStateContext.Provider value={page}>
        <SurfaceVisibilityContext.Provider value={active && visible}>
          <ReadonlyTextStateContext.Provider value={page.values}>
            {children}
          </ReadonlyTextStateContext.Provider>
        </SurfaceVisibilityContext.Provider>
      </MobilePageStateContext.Provider>
    </div>
  );
}

interface Entry { route: MobileRoute; id: number; page: MobilePageState; }
const pageState = (): MobilePageState => ({ scroll: new Map(), values: new Map() });

/** Only the active page and its departing neighbor occupy DOM. */
export function MobilePageTransition({ route, visible = true, animate = true, slide = false, children }: {
  route: MobileRoute;
  visible?: boolean;
  animate?: boolean;
  /** Full-width navigation inside a persistent sheet, without fading pages. */
  slide?: boolean;
  children: ReactNode;
}) {
  const parentVisible = useSurfaceVisibility();
  const pages = useRef(new Map<string, MobilePageState>());
  const [state, setState] = useState<{
    current: Entry; previous?: Entry & { children: ReactNode }; serial: number; direction: Direction; enter: boolean; push: boolean;
  }>(() => {
    const page = pageState();
    pages.current.set(route.key, page);
    return { current: { route, id: 0, page }, serial: 0, direction: 0, enter: false, push: false };
  });
  const committed = useRef(children);
  useLayoutEffect(() => { committed.current = children; });
  if (route.key !== state.current.route.key) {
    let page = pages.current.get(route.key);
    if (!page) { page = pageState(); pages.current.set(route.key, page); }
    // Bound navigation memory; this contains values and offsets, never elements.
    pages.current.delete(route.key);
    pages.current.set(route.key, page);
    if (pages.current.size > 24) pages.current.delete(pages.current.keys().next().value!);
    const enter = animate && !reducedMotion();
    setState({
      current: { route, id: state.previous?.route.key === route.key ? state.previous.id : state.serial + 1, page },
      previous: enter ? { ...state.current, children: committed.current } : undefined,
      serial: state.serial + 1,
      direction: mobileRouteDirection(state.current.route, route),
      enter,
      // Retain the motion profile after the departing layer is released.
      push: (state.current.route.section === "home" && route.section === "chat")
        || (state.current.route.section === "chat" && route.section === "home"),
    });
  }
  const layers = [
    ...(state.previous ? [{ ...state.previous, active: false }] : []),
    { ...state.current, children, active: true },
  ];
  return (
    <div className="mobile-page-stack">
      {layers.map((entry) => (
        <PageLayer key={entry.id} active={entry.active} visible={visible && parentVisible}
          motion={slide ? "slide" : state.push ? entry.route.section === "chat" ? "push-chat" : "push-home" : "subtle"}
          enter={state.enter} direction={state.direction} page={entry.page}
          onExited={() => setState((current) => current.previous?.id === entry.id
            ? { ...current, previous: undefined } : current)}>
          {entry.children}
        </PageLayer>
      ))}
    </div>
  );
}

/** Fullscreen overlays retain their own subtree until the exit completes. */
export function MobilePageOverlay({ open, children }: { open: boolean; children: ReactNode }) {
  const { foldState, finish } = useCollapseMotion(open, MOBILE_PAGE_MOTION_MS);
  const element = useRef<HTMLDivElement>(null);
  const retained = useRef(children);
  if (open) retained.current = children;
  usePageMotion(element, open, true, 1, finish);
  if (!open && foldState === "closed") return null;
  return (
    <div ref={element} className="mobile-page-overlay" inert={!open} aria-hidden={!open || undefined}
      data-page-motion={open ? "enter" : "exit"}
      style={{ "--mobile-page-offset": "10px" } as CSSProperties}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}>
      <SurfaceVisibilityContext.Provider value={open}>
        <MobileOverlayLevelContext.Provider value={130}>
        {open ? children : retained.current}
        </MobileOverlayLevelContext.Provider>
      </SurfaceVisibilityContext.Provider>
    </div>
  );
}

/** The persistent header animates without duplicating its focus/anchor refs. */
export function useMobileHeaderMotion(ref: RefObject<HTMLElement | null>, route: MobileRoute, animate: boolean) {
  const previous = useRef(route);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = route;
    if (before.key === route.key || !animate || reducedMotion()) return;
    const animation = ref.current?.animate?.([
      { opacity: 0, transform: `translateX(${mobileRouteDirection(before, route) * 10}px)` },
      { opacity: 1, transform: "translateX(0px)" },
    ], { duration: MOBILE_PAGE_MOTION_MS, easing: EASING });
    void animation?.finished.catch(() => {});
    return () => animation?.cancel();
  }, [route.key, animate, ref]);
}
