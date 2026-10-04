import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), desktop: true }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => mocks.desktop,
}));
import {
  withNativeSessionAccess,
  assertNativeSessionAccess,
} from "./nativeAccess";
const input = {
  harness: "pi" as const,
  sessionId: "import",
  cwd: "/repo",
  model: "pi:default",
  runtimeMode: "supervised" as const,
  onEvent: vi.fn(),
  nativeSession: {
    provider: "pi" as const,
    providerSessionId: "native-id",
    path: "/native/pi.jsonl",
    revision: "1",
    createdAt: 1,
    updatedAt: 2,
    blockIds: [],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.desktop = true;
  mocks.invoke.mockImplementation(async (command: string) =>
    command === "native_session_acquire" ? "lease-token" : undefined,
  );
});
it("does not let stale UI access bypass the last check before a provider mutation", async () => {
  const write = vi.fn();
  mocks.invoke.mockRejectedValueOnce(
    new Error(
      "Native session is open in another CLI or its ownership is unknown",
    ),
  );
  await expect(withNativeSessionAccess(input, write)).rejects.toThrow(
    "another CLI",
  );
  expect(write).not.toHaveBeenCalled();
  expect(mocks.invoke).toHaveBeenCalledOnce();
});
it("holds the lease until the provider settles and releases it on failures", async () => {
  const write = vi.fn(async () => {
    expect(mocks.invoke).toHaveBeenCalledOnce();
    throw new Error("provider failed");
  });
  await expect(withNativeSessionAccess(input, write)).rejects.toThrow(
    "provider failed",
  );
  expect(mocks.invoke).toHaveBeenLastCalledWith("native_session_release", {
    sessionId: "import",
    token: "lease-token",
  });
});
it("fails closed on unsupported runtimes while ordinary providers keep working", async () => {
  mocks.desktop = false;
  const write = vi.fn(async () => "result");
  await expect(withNativeSessionAccess(input, write)).rejects.toThrow(
    "cannot be verified",
  );
  expect(
    await withNativeSessionAccess(
      { ...input, nativeSession: undefined },
      write,
    ),
  ).toBe("result");
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("checks external ownership before steering within the active MonoCode lease", async () => {
  mocks.invoke.mockResolvedValueOnce({ access: { state: "external" } });
  await expect(assertNativeSessionAccess(input)).rejects.toThrow("another CLI");
});
