/**
 * Liquid Glass edge refraction. Each floating glass surface gets an SVG
 * displacement filter sized to its own box and corner radius, so the backdrop
 * bends inward along a bezel the way a thick lens does. CSS picks the filter
 * up through `--mobile-glass-refraction`. Only Chromium (the Android WebView)
 * runs SVG filters inside backdrop-filter; WebKit keeps the CSS-only material.
 * Keep the selector in step with the glass surfaces in mobile.css.
 */

export const LIQUID_GLASS_SELECTOR = [
  '.mobile-header[data-floating="true"] > :not([data-capsule="false"])',
  ".mobile-composer:not(.mobile-composer-card)",
  ".mobile-composer-card > .mobile-composer-context",
  ".mobile-composer-card > .mobile-composer-input",
  ".mobile-jump",
  ".mobile-queue-pill",
  ".mobile-glass-preview-chip",
  ".mobile-drawer",
  '.mobile-sheet:not([data-surface="solid"])',
  ".mobile-shared-question",
  ".popover-backdrop",
].join(", ");

const SVG_NS = "http://www.w3.org/2000/svg";
const REFRACTION_VARIABLE = "--mobile-glass-refraction";
const MAX_BEZEL = 24;
const MAP_CACHE_LIMIT = 32;

let refraction = 1;
const refractionListeners = new Set<() => void>();

/** Edge refraction multiplier from settings; 0 turns the lens off. */
export function setLiquidGlassRefraction(multiplier: number) {
  if (multiplier === refraction) return;
  refraction = multiplier;
  for (const listener of refractionListeners) listener();
}

export function isChromiumUserAgent(userAgent: string): boolean {
  return (
    /\b(?:Chrome|Chromium)\//.test(userAgent) &&
    !/\b(?:iPhone|iPad|iPod)\b/.test(userAgent)
  );
}

/** Bezel width for a box: thick enough to read, never past the center. */
export function bezelWidth(width: number, height: number): number {
  return Math.min(MAX_BEZEL, (Math.min(width, height) / 2) * 0.7);
}

/**
 * Where a backdrop pixel is sampled from, as a vector in [-1, 1]: zero across
 * the flat center, growing toward the edge and pointing inward so the bezel
 * magnifies what sits just inside it.
 */
export function bezelDisplacement(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  bezel: number,
): [number, number] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const px = x - halfWidth;
  const py = y - halfHeight;
  const r = Math.max(0, Math.min(radius, halfWidth, halfHeight));
  const qx = Math.abs(px) - (halfWidth - r);
  const qy = Math.abs(py) - (halfHeight - r);
  let depth: number;
  let nx: number;
  let ny: number;
  if (qx > 0 && qy > 0) {
    const length = Math.hypot(qx, qy);
    depth = r - length;
    nx = qx / length;
    ny = qy / length;
  } else if (qx > qy) {
    depth = r - qx;
    nx = 1;
    ny = 0;
  } else {
    depth = r - qy;
    nx = 0;
    ny = 1;
  }
  if (bezel <= 0 || depth >= bezel) return [0, 0];
  const t = 1 - Math.max(0, depth) / bezel;
  const strength = t * t;
  return [-Math.sign(px) * nx * strength, -Math.sign(py) * ny * strength];
}

function displacementMap(
  width: number,
  height: number,
  radius: number,
  bezel: number,
): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = bezelDisplacement(
        x + 0.5,
        y + 0.5,
        width,
        height,
        radius,
        bezel,
      );
      const i = (y * width + x) * 4;
      data[i] = 128 + dx * 127;
      data[i + 1] = 128 + dy * 127;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

// Sheets and popovers mount repeatedly at the same few sizes.
const maps = new Map<string, string>();
function cachedDisplacementMap(
  width: number,
  height: number,
  radius: number,
  bezel: number,
) {
  const key = `${width}x${height}x${radius}`;
  const cached = maps.get(key);
  if (cached) return cached;
  const map = displacementMap(width, height, radius, bezel);
  if (!map) return null;
  if (maps.size >= MAP_CACHE_LIMIT) maps.delete(maps.keys().next().value!);
  maps.set(key, map);
  return map;
}

interface Surface {
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  displacement: SVGFEDisplacementMapElement;
  resize: ResizeObserver;
  key: string;
  boxKey?: string;
  scale?: number;
  settleTimer?: ReturnType<typeof setTimeout>;
}

/** Keeps a refraction filter on every glass surface under `root`. */
export function installLiquidGlass(root: HTMLElement): () => void {
  if (
    !isChromiumUserAgent(navigator.userAgent) ||
    typeof ResizeObserver === "undefined" ||
    !CSS.supports("backdrop-filter", "url(#a) blur(1px)")
  )
    return () => {};

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.append(defs);
  document.body.append(svg);

  const surfaces = new Map<HTMLElement, Surface>();
  let nextId = 0;

  const pending = new Map<HTMLElement, boolean>();
  let frame: number | undefined;
  let disposed = false;
  const schedule = (element: HTMLElement, settled = false) => {
    pending.set(element, settled);
    frame ??= requestAnimationFrame(flush);
  };
  const flush = () => {
    frame = undefined;
    // Read every box before updating SVG/style: a group of resized surfaces
    // should pay for layout once, not once per lens.
    const measurements = [...pending].flatMap(([element, settled]) => {
      const surface = surfaces.get(element);
      if (!surface) return [];
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const radius = parseFloat(getComputedStyle(element).borderTopRightRadius) || 0;
      return [{ element, surface, settled, width, height, radius }];
    });
    pending.clear();
    for (const { element, surface, settled, width, height, radius } of measurements) {
      if (refraction <= 0) {
        clearTimeout(surface.settleTimer);
        surface.settleTimer = undefined;
        element.style.removeProperty(REFRACTION_VARIABLE);
        continue;
      }
      if (width < 4 || height < 4) continue;
      const key = `${width}x${height}x${radius}`;
      const bezel = bezelWidth(width, height);
      if (key !== surface.boxKey) {
        surface.boxKey = key;
        for (const node of [surface.filter, surface.image]) {
          node.setAttribute("width", String(width));
          node.setAttribute("height", String(height));
        }
      }
      if (key === surface.key) {
        clearTimeout(surface.settleTimer);
        surface.settleTimer = undefined;
      } else {
        if (surface.key && !settled) {
          // Reuse the current lens through all resizing surfaces, including
          // sheets. Encode only the final size after layout motion settles.
          clearTimeout(surface.settleTimer);
          const settle = () => {
            const moving = element.getAnimations?.({ subtree: true }).some(
              animation => animation.playState === "running" &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            );
            if (moving) {
              surface.settleTimer = setTimeout(settle, 80);
              return;
            }
            surface.settleTimer = undefined;
            if (!disposed && surfaces.has(element)) schedule(element, true);
          };
          surface.settleTimer = setTimeout(settle, 80);
        } else {
          const map = cachedDisplacementMap(width, height, radius, bezel);
          if (!map) continue;
          surface.key = key;
          surface.image.setAttribute("href", map);
        }
      }
      const scale = bezel * 2 * refraction;
      if (scale !== surface.scale) {
        surface.displacement.setAttribute("scale", String(scale));
        surface.scale = scale;
      }
      const filter = `url(#${surface.filter.id})`;
      if (element.style.getPropertyValue(REFRACTION_VARIABLE) !== filter)
        element.style.setProperty(REFRACTION_VARIABLE, filter);
    }
  };

  const attach = (element: HTMLElement) => {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = `mobile-glass-${nextId++}`;
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const image = document.createElementNS(SVG_NS, "feImage");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("result", "map");
    const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "map");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    filter.append(image, displacement);
    defs.append(filter);
    const surface: Surface = {
      filter,
      image,
      displacement,
      key: "",
      resize: new ResizeObserver(() => schedule(element)),
    };
    surface.resize.observe(element);
    surfaces.set(element, surface);
    pending.set(element, false);
  };

  const detach = (element: HTMLElement, surface: Surface) => {
    clearTimeout(surface.settleTimer);
    surface.resize.disconnect();
    surface.filter.remove();
    element.style.removeProperty(REFRACTION_VARIABLE);
    surfaces.delete(element);
    pending.delete(element);
  };

  const consider = (element: Element) => {
    if (element instanceof HTMLElement && element.matches(LIQUID_GLASS_SELECTOR) &&
        !surfaces.has(element)) attach(element);
  };
  const scan = (element: Element) => {
    if (element === svg || svg.contains(element)) return;
    consider(element);
    element.querySelectorAll(LIQUID_GLASS_SELECTOR).forEach(consider);
  };
  // Only newly mounted subtrees need a selector walk. Streamed transcript
  // text and unrelated class changes must not rescan the whole document.
  const mutations = new MutationObserver(records => {
    for (const record of records) {
      if (record.target === svg || svg.contains(record.target)) continue;
      if (record.type === "childList") {
        for (const added of record.addedNodes)
          if (added instanceof Element) scan(added);
      } else if (record.target instanceof Element) {
        consider(record.target);
        // Header and stacked-composer selectors depend on their parent.
        for (const child of record.target.children) consider(child);
      }
    }
    for (const [element, surface] of surfaces)
      if (!root.contains(element) || !element.matches(LIQUID_GLASS_SELECTOR))
        detach(element, surface);
    if (pending.size) frame ??= requestAnimationFrame(flush);
  });
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-floating", "data-capsule", "data-surface", "class"],
  });
  root.querySelectorAll(LIQUID_GLASS_SELECTOR).forEach(consider);
  flush();
  const refresh = () => {
    for (const element of surfaces.keys()) pending.set(element, false);
    // Settings apply immediately; cancel a queued frame before this batch.
    if (frame !== undefined) cancelAnimationFrame(frame);
    flush();
  };
  refractionListeners.add(refresh);

  return () => {
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    pending.clear();
    refractionListeners.delete(refresh);
    mutations.disconnect();
    for (const [element, surface] of surfaces) detach(element, surface);
    svg.remove();
  };
}
