import { expect, it } from "vitest";
import { assistantErrorMessage } from "./assistantErrors";

it("maps bridge and transport failures while keeping Host errors intact", () => {
  expect(assistantErrorMessage("Unsupported remote operation")).toMatch(
    /Update MonoCode/,
  );
  expect(
    assistantErrorMessage(
      "Machine is unreachable. Check the host and SSH tunnel, then reconnect.",
    ),
  ).toBe("Cannot reach the Host. Check the connection and retry.");
  expect(assistantErrorMessage(new Error("Host rejected request: conflict"))).toBe(
    "Host rejected request: conflict",
  );
});
