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
import "./pageMotion.css";

export const MOBILE_PAGE_MOTION_MS = 220;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
export interface MobileRoute {
  key: string;
  section: "home" | "chat" | "settings";
  depth: number;
}
type Direction = -1 | 0 | 1;
export function mobileRouteDirection(from: MobileRoute, to: MobileRoute): Direction {
  if (from.section === to.section)
    return Math.sign(to.depth - from.depth) as Direction;
  if (to.section === "settings") return 1;
  if (from.section === "settings") return -1;
  return to.section === "chat" ? 1 : -1;
}
const reducedMotion = () => reducedMotionQuery().matches;

/** Interrupt from the visible position, and let the shared lifetime own cleanup. */
function usePageMotion(
  element: RefObject<HTMLDivElement | null>,
  active: boolean,
  enter: boolean,
  direction: Direction,
  finish: () => void,
  slide = false,
) {
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || (!enter && active) || reducedMotion() || !node.animate) return;
    const computed = getComputedStyle(node);
    const animation = node.animate([
      {
        opacity: slide ? 1 : node.style.opacity || (active ? "0" : computed.opacity || "1"),
        transform: node.style.transform || (active ? `translateX(${direction * (slide ? 100 : 10)}${slide ? "%" : "px"})` : computed.transform),
      },
      { opacity: slide || active ? 1 : 0, transform: active ? "translateX(0px)" : `translateX(${-direction * (slide ? 100 : 10)}${slide ? "%" : "px"})` },
    ], { duration: MOBILE_PAGE_MOTION_MS, easing: EASING, fill: "both" });
    // A reversal intentionally cancels the old animation's finished promise.
    void animation.finished.catch(() => {});
    node.dataset.motionApi = "true";
    animation.onfinish = () => {
      if (active) {
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
        animation.cancel();
      }
      finish();
    };
    return () => {
      if (animation.playState === "running") {
        const visible = getComputedStyle(node);
        node.style.opacity = visible.opacity;
        node.style.transform = visible.transform;
      }
      animation.onfinish = null;
      animation.cancel();
    };
  }, [active, enter, direction, element, finish, slide]);
}

function PageLayer({ active, visible, enter, direction, page, children, onExited, slide }: {
  active: boolean;
  visible: boolean;
  enter: boolean;
  direction: Direction;
  page: MobilePageState;
  children: ReactNode;
  onExited: () => void;
  slide: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const { foldState, finish } = useCollapseMotion(active, MOBILE_PAGE_MOTION_MS);
  const exit = useRef(onExited);
  exit.current = onExited;
  usePageMotion(element, active, enter, direction, finish, slide);
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
    if (slide && active && visible)
      element.current?.querySelector<HTMLElement>(".mobile-sheet-header-button")?.focus({ preventScroll: true });
  }, [slide, active, visible]);
  return (
    <div
      ref={element}
      className="mobile-page-layer"
      data-page-active={active}
      data-page-motion={!active ? "exit" : enter ? "enter" : undefined}
      style={{
        "--mobile-page-offset": `${direction * (slide ? 100 : 10)}${slide ? "%" : "px"}`,
        "--mobile-page-start-opacity": slide ? 1 : 0,
      } as CSSProperties}
      inert={!active || !visible}
      aria-hidden={!active || !visible || undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}
    >
      <MobilePageStateContext.Provider value={page}>
        <SurfaceVisibilityContext.Provider value={active && visible}>
          {children}
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
    current: Entry; previous?: Entry & { children: ReactNode }; serial: number; direction: Direction; enter: boolean;
  }>(() => {
    const page = pageState();
    pages.current.set(route.key, page);
    return { current: { route, id: 0, page }, serial: 0, direction: 0, enter: false };
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
          slide={slide}
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
