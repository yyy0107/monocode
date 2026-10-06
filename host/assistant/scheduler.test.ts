import { expect, it } from "vitest";
import { nextInterval, retryDelay } from "./scheduler";
it("coalesces missed intervals and schedules once in the future", () => {
  expect(nextInterval(60000, 1, 245000)).toBe(300000);
  expect(nextInterval(60000, 1, 60000)).toBe(120000);
});
it("backs off exponentially and bounds retry time", () => {
  expect(retryDelay(1)).toBe(30000);
  expect(retryDelay(3)).toBe(120000);
  expect(retryDelay(100)).toBe(900000);
});
it("claims a missed schedule once and does not run while paused", async () => {
  const { HostStore } = await import("../store");
  const { AssistantStore } = await import("./store");
  const { enqueueSchedules } = await import("./scheduler");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "schedule-"));
  const host = new HostStore(join(dir, "host.db"));
  const store = new AssistantStore(host);
  try {
    store.initialize({
      harness: "codex",
      model: "test",
      schedules: [
        {
          id: "one",
          enabled: true,
          intervalMinutes: 1,
          prompt: "Check",
          timezone: "Asia/Shanghai",
          nextRunAt: 60000,
        },
      ],
    });
    enqueueSchedules(store, 245000);
    enqueueSchedules(store, 245000);
    expect(store.wakeups()).toHaveLength(1);
    expect(store.get()!.schedules[0].nextRunAt).toBe(300000);
    expect(store.wakeups()[0].rootCauseId).toBe("schedule:one");
    store.update({ lifecycle: "paused" });
    enqueueSchedules(store, 600000);
    expect(store.wakeups()).toHaveLength(1);
    expect(store.get()!.schedules[0].nextRunAt).toBe(300000);
  } finally {
    host.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
