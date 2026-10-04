/**
 * Liquid Glass edge refraction. Each floating glass surface gets an SVG
 * displacement filter sized to its own box and corner radius, so the backdrop
 * bends inward along a bezel the way a thick lens does. CSS picks the filter
 * up through `--mobile-glass-refraction`. Only Chromium (the Android WebView)
 * runs SVG filters inside backdrop-filter; WebKit keeps the CSS-only material.
 * Keep the selector in step with the glass surfaces in mobile.css.
 */

export const LIQUID_GLASS_SELECTOR = [
  '.mobile-header[data-floating="true"] > *',
  ".mobile-composer",
  ".mobile-jump",
  ".mobile-queue-pill",
  ".mobile-glass-preview-chip",
  ".mobile-drawer",
  ".mobile-sheet",
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

  const update = (element: HTMLElement, surface: Surface) => {
    if (refraction <= 0) {
      element.style.removeProperty(REFRACTION_VARIABLE);
      return;
    }
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width < 4 || height < 4) return;
    const radius =
      parseFloat(getComputedStyle(element).borderTopRightRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    const bezel = bezelWidth(width, height);
    if (key !== surface.key) {
      const map = cachedDisplacementMap(width, height, radius, bezel);
      if (!map) return;
      surface.key = key;
      for (const node of [surface.filter, surface.image]) {
        node.setAttribute("width", String(width));
        node.setAttribute("height", String(height));
      }
      surface.image.setAttribute("href", map);
    }
    surface.displacement.setAttribute("scale", String(bezel * 2 * refraction));
    element.style.setProperty(
      REFRACTION_VARIABLE,
      `url(#${surface.filter.id})`,
    );
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
      resize: new ResizeObserver(() => update(element, surface)),
    };
    surface.resize.observe(element);
    surfaces.set(element, surface);
    update(element, surface);
  };

  const detach = (element: HTMLElement, surface: Surface) => {
    surface.resize.disconnect();
    surface.filter.remove();
    element.style.removeProperty(REFRACTION_VARIABLE);
    surfaces.delete(element);
  };

  // MutationObserver already batches records per task, so syncing directly
  // keeps up with React commits without waiting for a visible frame.
  const sync = () => {
    const current = new Set(
      root.querySelectorAll<HTMLElement>(LIQUID_GLASS_SELECTOR),
    );
    for (const [element, surface] of surfaces)
      if (!current.has(element)) detach(element, surface);
    for (const element of current) if (!surfaces.has(element)) attach(element);
  };
  const mutations = new MutationObserver(sync);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-floating", "class"],
  });
  sync();
  const refresh = () => {
    for (const [element, surface] of surfaces) update(element, surface);
  };
  refractionListeners.add(refresh);

  return () => {
    refractionListeners.delete(refresh);
    mutations.disconnect();
    for (const [element, surface] of surfaces) detach(element, surface);
    svg.remove();
  };
}
