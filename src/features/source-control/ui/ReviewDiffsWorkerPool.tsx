// Adapted from ZCode (Apache-2.0).
import { useEffect, useState, type ReactNode } from "react";
import { WorkerPoolContext } from "@pierre/diffs/react";
import { WorkerPoolManager } from "@pierre/diffs/worker";
import ReviewDiffsWorker from "@pierre/diffs/worker/worker.js?worker";

const highlighterOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  preferredHighlighter: "shiki-wasm",
  lineDiffType: "word-alt",
  maxLineDiffLength: 1000,
  tokenizeMaxLineLength: 1000,
  useTokenTransformer: false,
} as const;

export function ReviewDiffsWorkerPool({ children }: { children: ReactNode }) {
  const [pool, setPool] = useState<WorkerPoolManager>();
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let stopped = false;
    let manager: WorkerPoolManager | undefined;
    const workers: Worker[] = [];
    // Pierre 1.1 can leave initialization pending on an asset/worker load error.
    // Keep main-thread highlighting available until initialization succeeds,
    // and return to it on failure rather than trusting isWorkingPool().
    const fallback = () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(timeout);
      manager?.terminate();
      for (const worker of workers) worker.terminate();
      setPool(undefined);
    };
    const timeout = window.setTimeout(fallback, 10_000);
    try {
      manager = new WorkerPoolManager(
        {
          workerFactory: () => {
            // Bundle Pierre's entry directly: its package marks the worker as
            // side-effect free, which erases a wrapper's bare static import.
            const worker = new ReviewDiffsWorker({
              name: "monocode-review-diffs",
            });
            worker.addEventListener("error", fallback);
            worker.addEventListener("messageerror", fallback);
            workers.push(worker);
            return worker;
          },
          poolSize: Math.max(
            1,
            Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
          ),
          totalASTLRUCacheSize: 40,
        },
        highlighterOptions,
      );
      const initialized = manager;
      void initialized
        .initialize()
        .then(() => {
          if (stopped) return;
          window.clearTimeout(timeout);
          setPool(initialized);
        })
        .catch(fallback);
    } catch {
      fallback();
    }
    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      manager?.terminate();
      for (const worker of workers) {
        worker.removeEventListener("error", fallback);
        worker.removeEventListener("messageerror", fallback);
        worker.terminate();
      }
    };
  }, []);
  return (
    <WorkerPoolContext.Provider value={pool}>
      {children}
    </WorkerPoolContext.Provider>
  );
}
