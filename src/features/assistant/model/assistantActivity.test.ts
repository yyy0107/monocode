import { expect, it } from "vitest";
import { assistantActivityLabel } from "./assistantActivity";

it("describes the current action in plain words", () => {
  expect(
    assistantActivityLabel({
      action: "sessions.create",
      projectName: "web",
      at: 1,
    }),
  ).toEqual({
    key: "Starting a conversation in {project}…",
    params: { project: "web" },
  });
  expect(
    assistantActivityLabel({
      action: "sessions.send",
      sessionTitle: "Login",
      at: 1,
    }),
  ).toEqual({
    key: "Handing the task to {title}…",
    params: { title: "Login" },
  });
  expect(assistantActivityLabel({ action: "git.read", at: 1 }).key).toBe(
    "Checking Git status…",
  );
  expect(assistantActivityLabel(undefined).key).toBe("Working…");
});
