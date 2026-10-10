// @vitest-environment happy-dom
import { invoke } from "@tauri-apps/api/core";
import { afterEach, expect, it, vi } from "vitest";
import {
  keepSessionChanges,
  registerHostCheckpointRoute,
  sessionCheckpointFileDiff,
  sessionCheckpointStatus,
  undoSessionChanges,
} from "./checkpoint";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({ files: [] })) }));

afterEach(() => vi.clearAllMocks());

it("routes a Host conversation's review, Keep and Undo to its Host", async () => {
  const route = vi.fn(async () => ({ files: [] }));
  const unregister = registerHostCheckpointRoute("tab", route);
  await sessionCheckpointStatus("tab", "/repo");
  await sessionCheckpointFileDiff("tab", "/repo", "a.ts");
  await undoSessionChanges("tab", "/repo", "a.ts");
  await keepSessionChanges("tab", "/repo");
  expect(route.mock.calls).toEqual([["status"], ["diff", "a.ts"], ["undo", "a.ts"], ["keep", undefined]]);
  expect(invoke).not.toHaveBeenCalled();

  unregister();
  await sessionCheckpointStatus("tab", "/repo");
  expect(invoke).toHaveBeenCalledWith("session_checkpoint_status", { sessionId: "tab", cwd: "/repo" });
});
