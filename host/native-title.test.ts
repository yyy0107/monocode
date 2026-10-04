import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readClaudeTitleFile } from "./native-title";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
it("reads the selected Claude account's metadata without mixing credential homes", async () => {
  const root = mkdtempSync(join(tmpdir(), "monocode-native-title-"));
  directories.push(root);
  const config = join(root, "desktop.json");
  writeFileSync(config, JSON.stringify({ desktopDirectory: root }));
  for (const account of ["one", "two"]) {
    const project = join(
      root,
      "provider-accounts",
      "claude",
      account,
      "projects",
      "-project",
    );
    mkdirSync(project, { recursive: true });
    writeFileSync(
      join(project, "native.jsonl"),
      JSON.stringify({
        type: "ai-title",
        sessionId: "native",
        aiTitle: `${account} title`,
      }) + "\n{unfinished",
    );
  }
  expect(
    await readClaudeTitleFile(
      {
        cwd: "/project",
        providerSessionId: "native",
        providerAccountId: "one",
      },
      config,
    ),
  ).toBe("one title");
  expect(
    await readClaudeTitleFile(
      {
        cwd: "/project",
        providerSessionId: "../native",
        providerAccountId: "one",
      },
      config,
    ),
  ).toBeNull();
  expect(
    await readClaudeTitleFile({
      cwd: "/project",
      providerSessionId: "native",
      providerAccountId: "one",
    }),
  ).toBeNull();
});
it("rejects a transcript symlink outside the provider's projects directory", async () => {
  const root = mkdtempSync(join(tmpdir(), "monocode-native-title-"));
  directories.push(root);
  const project = join(root, "projects", "-project");
  mkdirSync(project, { recursive: true });
  const outside = join(root, "outside.jsonl");
  writeFileSync(
    outside,
    JSON.stringify({
      type: "ai-title",
      sessionId: "native",
      aiTitle: "Other data",
    }),
  );
  symlinkSync(outside, join(project, "native.jsonl"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", root);
  expect(
    await readClaudeTitleFile({ cwd: "/project", providerSessionId: "native" }),
  ).toBeNull();
});
