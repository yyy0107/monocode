// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  forgetDeletedRemoteBindings,
  remoteSessionFor,
  remoteSessionScopeFor,
  rememberRemoteSession,
} from "./connections";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const BINDINGS = "monocode.remote-tabs.v2";
const SCOPES = "monocode.remote-tab-scopes.v1";
const scope = { environmentId: "local", projectId: "project" };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("decodes large binding and scope tables once across repeated row lookups", () => {
  const bindings = JSON.stringify(Object.fromEntries(
    Array.from({ length: 1_200 }, (_, index) => [`shell-${index}`, `host-${index}`]),
  ));
  const scopes = JSON.stringify(Object.fromEntries(
    Array.from({ length: 1_200 }, (_, index) => [
      `shell-${index}`, { ...scope, hostId: `host-${index}` },
    ]),
  ));
  localStorage.setItem(BINDINGS, bindings);
  localStorage.setItem(SCOPES, scopes);
  const parse = vi.spyOn(JSON, "parse");

  for (let index = 0; index < 1_200; index++) {
    expect(remoteSessionFor(`shell-${index}`)).toBe(`host-${index}`);
    expect(remoteSessionScopeFor(`shell-${index}`)).toEqual(scope);
  }

  expect(parse.mock.calls.filter(([raw]) => raw === bindings)).toHaveLength(1);
  expect(parse.mock.calls.filter(([raw]) => raw === scopes)).toHaveLength(1);
});

it("ignores repeated identical bindings so pollers cannot trigger history refreshes", () => {
  const changes = vi.fn();
  window.addEventListener("monocode:remote-history", changes);
  try {
    rememberRemoteSession("shell", "host", scope);
    const write = vi.spyOn(Storage.prototype, "setItem");
    rememberRemoteSession("shell", "host", scope);
    rememberRemoteSession("shell", "host");
    expect(write).not.toHaveBeenCalled();
    expect(changes).toHaveBeenCalledOnce();
    rememberRemoteSession("shell", "next", scope);
    expect(changes).toHaveBeenCalledTimes(2);
  } finally {
    window.removeEventListener("monocode:remote-history", changes);
  }
});

it("keeps cached readers current after binding, rebinding and retirement", () => {
  rememberRemoteSession("shell", "first", scope);
  rememberRemoteSession("other", "first", { ...scope, environmentId: "other" });
  expect(remoteSessionFor("shell")).toBe("first");
  expect(remoteSessionScopeFor("shell")).toEqual(scope);

  rememberRemoteSession("shell", "second");
  expect(remoteSessionFor("shell")).toBe("second");
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
  expect(forgetDeletedRemoteBindings(["second"], { environmentId: "local" }))
    .toEqual(["shell"]);
  expect(remoteSessionFor("shell")).toBeUndefined();
  expect(remoteSessionScopeFor("shell")).toBeUndefined();
  expect(remoteSessionFor("other")).toBe("first");
  expect(remoteSessionScopeFor("other")?.environmentId).toBe("other");

  rememberRemoteSession("other");
  expect(remoteSessionFor("other")).toBeUndefined();
  expect(remoteSessionScopeFor("other")).toBeUndefined();
});

it("sees another window's replacement and clearing even before its storage event", () => {
  rememberRemoteSession("shell", "before", scope);
  expect(remoteSessionScopeFor("shell")).toEqual(scope);

  // A sibling window's write updates shared storage before its queued event.
  localStorage.setItem(BINDINGS, JSON.stringify({ shell: "after" }));
  expect(remoteSessionFor("shell")).toBe("after");
  expect(remoteSessionScopeFor("shell")).toBeUndefined();
  const nextScope = { environmentId: "replacement", projectId: "next" };
  localStorage.setItem(SCOPES, JSON.stringify({ shell: { ...nextScope, hostId: "after" } }));
  expect(remoteSessionScopeFor("shell")).toEqual(nextScope);
  window.dispatchEvent(new StorageEvent("storage", { key: SCOPES }));
  expect(remoteSessionScopeFor("shell")).toEqual(nextScope);

  localStorage.clear();
  expect(remoteSessionFor("shell")).toBeUndefined();
  expect(remoteSessionScopeFor("shell")).toBeUndefined();
});

it("does not expose unpersisted mutations when storage rejects a write", () => {
  rememberRemoteSession("shell", "saved", scope);
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });

  rememberRemoteSession("shell", "unsaved", { ...scope, environmentId: "wrong" });
  expect(remoteSessionFor("shell")).toBe("saved");
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
  expect(() => forgetDeletedRemoteBindings(["saved"], { environmentId: "local" }))
    .toThrow("Storage is full");
  expect(remoteSessionFor("shell")).toBe("saved");
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
});

it("drops stale bindings after invalid storage and recovers from later valid writes", () => {
  rememberRemoteSession("shell", "saved", scope);
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
  localStorage.setItem(BINDINGS, "invalid");
  localStorage.setItem(SCOPES, "null");
  expect(remoteSessionFor("shell")).toBeUndefined();
  expect(remoteSessionScopeFor("shell")).toBeUndefined();

  rememberRemoteSession("shell", "recovered", scope);
  expect(remoteSessionFor("shell")).toBe("recovered");
  expect(remoteSessionScopeFor("shell")).toEqual(scope);
});
