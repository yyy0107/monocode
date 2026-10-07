import { beforeEach, expect, it, vi } from "vitest";
import { generateConfiguredSessionTitle } from "./titleModelClient";
import {
  remoteMachineFor,
  remoteRequest,
} from "../../connections/model/connections";
import {
  remoteProjectFor,
  sharedHostMachineId,
} from "../../connections/model/remoteProjects";

vi.mock("../../connections/model/connections", () => ({
  remoteMachineFor: vi.fn(),
  remoteRequest: vi.fn(),
}));
vi.mock("../../connections/model/remoteProjects", () => ({
  remoteProjectFor: vi.fn(),
  sharedHostMachineId: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sharedHostMachineId).mockReturnValue("local");
});
it("uses the local Host's API for desktop-owned sessions", async () => {
  await generateConfiguredSessionTitle("/repo", "Title this");
  expect(remoteRequest).toHaveBeenCalledWith("local", "titleModel.generate", {
    message: "Title this",
  });
});
it("never sends a disconnected remote project's message to the local Host", async () => {
  vi.mocked(remoteProjectFor).mockReturnValue({
    key: "remote://project",
    environmentId: "remote-env",
    projectId: "project",
    cwd: "/repo",
  });
  expect(
    await generateConfiguredSessionTitle(
      "remote://project",
      "Private remote message",
    ),
  ).toBeNull();
  expect(remoteMachineFor).toHaveBeenCalledWith("remote-env");
  expect(remoteRequest).not.toHaveBeenCalled();
});
