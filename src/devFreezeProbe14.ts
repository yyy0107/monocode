// TEMPORARY freeze probe. Remove after diagnosis.
const w = window as any;
if (import.meta.env.DEV && !w.__perfProbe) {
  w.__perfProbe = true;
  const send = (data: unknown) => {
    fetch(`/__perfprobe?d=${encodeURIComponent(JSON.stringify(data))}`).catch(() => undefined);
  };
  let lastEvent = "";
  let lastEventAt = 0;
  const nameOf = (type: any): string | null =>
    !type || typeof type === "string" ? null
      : type.displayName || type.name || (type.render && (type.render.displayName || type.render.name)) || (type.type && nameOf(type.type)) || null;
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), inject: () => 1, checkDCE: () => undefined,
    onScheduleFiberRoot: () => undefined, onCommitFiberUnmount: () => undefined, onPostCommitFiberRoot: () => undefined,
    onCommitFiberRoot: (_id: number, root: any) => {
      const top = root.current;
      const total = top.actualDuration ?? 0;
      const wall = performance.now() - (top.actualStartTime ?? performance.now());
      if (performance.now() - lastEventAt > 2000 || (total < 15 && wall < 30)) return;
      const start = top.actualStartTime ?? 0;
      const rendered = (f: any) => (f.actualStartTime ?? -1) >= start;
      const self = new Map<string, number>();
      const mounts = new Map<string, number>();
      const stack: any[] = [top];
      while (stack.length) {
        const f = stack.pop();
        if (!rendered(f)) continue;
        let childSum = 0;
        for (let c = f.child; c; c = c.sibling) if (rendered(c)) { childSum += c.actualDuration ?? 0; stack.push(c); }
        const n = nameOf(f.type);
        if (!n) continue;
        if (f.alternate === null) mounts.set(n, (mounts.get(n) ?? 0) + 1);
        self.set(n, (self.get(n) ?? 0) + f.actualDuration - childSum);
      }
      const top8 = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}=${Math.round(v)}`);
      send({ kind: "commit", at: Math.round(performance.now() - lastEventAt), total: Math.round(total), wall: Math.round(wall), lastEvent, self: top8(self), mounts: top8(mounts) });
    },
  };
  const label = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest("button,[role],input,a") ?? target : null;
    return el ? `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}` : "?";
  };
  window.addEventListener("click", (event) => {
    const t0 = performance.now();
    lastEvent = label(event.target);
    lastEventAt = t0;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      send({ kind: "event", name: lastEvent, frame: Math.round(performance.now() - t0) })));
  }, true);
  // Time JS spent in ResizeObserver and rAF callbacks per frame.
  let roMs = 0, rafMs = 0, roCalls = 0;
  const RO = window.ResizeObserver;
  (window as any).ResizeObserver = class extends RO {
    constructor(cb: ResizeObserverCallback) {
      super((entries, observer) => {
        const t = performance.now();
        try { cb(entries, observer); } finally { roMs += performance.now() - t; roCalls += entries.length; }
      });
    }
  };
  const raf = window.requestAnimationFrame.bind(window);
  const rafBy = new Map<string, number>();
  const sourceOf = () => {
    const lines = (new Error().stack ?? "").split("\n").filter((l) => !l.includes("devFreezeProbe"));
    const line = lines.find((l) => /\/(src|node_modules)\//.test(l)) ?? lines[1] ?? "?";
    return line.replace(/^.*?\/((src|node_modules)\/[^?:]*)[^:]*:(\d+).*$/, "$1:$3").slice(-90);
  };
  window.requestAnimationFrame = (cb) => {
    const src = performance.now() - lastEventAt < 1500 ? sourceOf() : "";
    return raf((ts) => {
      const t = performance.now();
      try { cb(ts); } finally {
        const d = performance.now() - t;
        rafMs += d;
        if (src) rafBy.set(src, (rafBy.get(src) ?? 0) + d);
      }
    });
  };
  (w as any).__rafBy = rafBy;
  // Frames slower than 50 ms within 1.5 s of a click: animation jank shows up here.
  let prev = performance.now();
  const loop = (now: number) => {
    const gap = now - prev;
    if (gap > 50 && now - lastEventAt < 1500)
      send({ kind: "gap", gap: Math.round(gap), at: Math.round(now - lastEventAt), lastEvent, ro: Math.round(roMs), roCalls, raf: Math.round(rafMs),
        rafBy: [...rafBy].filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}=${Math.round(v)}`) });
    rafBy.clear();
    roMs = 0; rafMs = 0; roCalls = 0;
    prev = now;
    raf(loop);
  };
  raf(loop);
  send({ kind: "ready" });
}
export {};
