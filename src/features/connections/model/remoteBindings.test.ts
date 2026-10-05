// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  forgetDeletedRemoteBindings,
  remoteSessionFor,
  rememberRemoteSession,
} from "./connections";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const BINDINGS = "monocode.remote-tabs.v2";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("decodes a large binding table once across repeated row lookups", () => {
  const bindings = JSON.stringify(Object.fromEntries(
    Array.from({ length: 1_200 }, (_, index) => [`shell-${index}`, `host-${index}`]),
  ));
  localStorage.setItem(BINDINGS, bindings);
  const parse = vi.spyOn(JSON, "parse");

  for (let index = 0; index < 1_200; index++)
    expect(remoteSessionFor(`shell-${index}`)).toBe(`host-${index}`);

  expect(parse.mock.calls.filter(([raw]) => raw === bindings)).toHaveLength(1);
});

it("keeps cached readers current after binding, rebinding and retirement", () => {
  rememberRemoteSession("shell", "first");
  rememberRemoteSession("other", "first");
  expect(remoteSessionFor("shell")).toBe("first");

  rememberRemoteSession("shell", "second");
  expect(remoteSessionFor("shell")).toBe("second");
  forgetDeletedRemoteBindings(["second"]);
  expect(remoteSessionFor("shell")).toBeUndefined();
  expect(remoteSessionFor("other")).toBe("first");

  rememberRemoteSession("other");
  expect(remoteSessionFor("other")).toBeUndefined();
});

it("sees another window's replacement and clearing even before its storage event", () => {
  rememberRemoteSession("shell", "before");
  expect(remoteSessionFor("shell")).toBe("before");

  // A sibling window's write updates shared storage before its queued event.
  localStorage.setItem(BINDINGS, JSON.stringify({ shell: "after" }));
  expect(remoteSessionFor("shell")).toBe("after");
  window.dispatchEvent(new StorageEvent("storage", { key: BINDINGS }));
  expect(remoteSessionFor("shell")).toBe("after");

  localStorage.clear();
  expect(remoteSessionFor("shell")).toBeUndefined();
});

it("does not expose unpersisted mutations when storage rejects a write", () => {
  rememberRemoteSession("shell", "saved");
  expect(remoteSessionFor("shell")).toBe("saved");
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });

  rememberRemoteSession("shell", "unsaved");
  expect(remoteSessionFor("shell")).toBe("saved");
  expect(() => forgetDeletedRemoteBindings(["saved"]))
    .toThrow("Storage is full");
  expect(remoteSessionFor("shell")).toBe("saved");
});

it("drops stale bindings after invalid storage and recovers from later valid writes", () => {
  rememberRemoteSession("shell", "saved");
  expect(remoteSessionFor("shell")).toBe("saved");
  localStorage.setItem(BINDINGS, "invalid");
  expect(remoteSessionFor("shell")).toBeUndefined();

  rememberRemoteSession("shell", "recovered");
  expect(remoteSessionFor("shell")).toBe("recovered");
});
