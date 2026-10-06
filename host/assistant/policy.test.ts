import { expect, it } from "vitest";
import { fullAssistantPolicy } from "../../src/features/assistant/model/assistant";
import {
  checkPolicy,
  workspacePermission,
  validatePolicy,
} from "./policy";
import { WORKSPACE_COMMANDS } from "../workspace-commands";
it("maps every workspace action and fails closed on future commands", () => {
  for (const command of WORKSPACE_COMMANDS)
    expect(workspacePermission(command)).toBeTruthy();
  expect(() => workspacePermission("future_shell")).toThrow();
  expect(workspacePermission("git_push")).toBe("git.publish");
  expect(workspacePermission("delete_path")).toBe("files.write");
});
it("blocks revoked permissions and project scope", () => {
  const policy = fullAssistantPolicy();
  checkPolicy(policy, "sessions.send", "project");
  policy.permissions["sessions.send"] = false;
  expect(() => checkPolicy(policy, "sessions.send", "project")).toThrow(
    /permission/i,
  );
  policy.allowedProjects = ["allowed"];
  expect(() => checkPolicy(policy, "sessions.read", "other")).toThrow(/scope/i);
});
it("rejects unknown policy fields and disabled missing permissions", () => {
  expect(() =>
    validatePolicy({ ...fullAssistantPolicy(), secret: true }),
  ).toThrow();
  const policy = validatePolicy({ permissions: {}, allowedProjects: [] });
  expect(policy.permissions["sessions.send"]).toBe(false);
});
