import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import {
  buildWindowsDesktop,
  createWindowsSnapshot,
  powershellCommand,
} from "./desktop-windows-build.mjs";
import { runWindowsBuild } from "./desktop-windows-runner.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const version = "0.7.1-lan.123";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "monocode-windows-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  const write = async (path, value) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
  };
  await write(".gitignore", "build/\nnode_modules/\n.env\n");
  await write("src/main.ts", "original");
  await write("src/deleted.ts", "deleted");
  await write("Cargo.toml", "source");
  execFileSync("git", ["add", "."], { cwd: root });
  return { root, write };
}

test("Windows snapshots contain current uncommitted inputs, exclude credentials/outputs and respect deletions", async (t) => {
  const { root, write } = await fixture(t);
  await write("src/main.ts", "edited");
  await write("host/new.ts", "untracked input");
  await write("CHANGELOG.md", "bundled release notes");
  await write(".env", "secret");
  await write("build/output", "generated");
  await write("mobile/android/source", "mobile");
  // The desktop tsc project also checks src/mobile/updates.ts.
  await write("mobile/update-config.json", "{}");
  await rm(join(root, "src/deleted.ts"));
  const archive = join(root, "build/source.tar.gz");
  assert.equal(
    await createWindowsSnapshot(root, archive),
    hash(await readFile(archive)),
  );
  const list = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .trim()
    .split("\n");
  assert.deepEqual(list, [
    "CHANGELOG.md",
    "Cargo.toml",
    "host/new.ts",
    "mobile/update-config.json",
    "src/main.ts",
  ]);
  assert.equal(
    execFileSync("tar", ["-xOzf", archive, "src/main.ts"], {
      encoding: "utf8",
    }),
    "edited",
  );
  await symlink(join(root, ".env"), join(root, "src/symlink"));
  await assert.rejects(
    createWindowsSnapshot(root, archive),
    /requires regular files/,
  );
});

test("remote PowerShell commands transport literal paths without shell expansion", () => {
  const script = "Write-Output 'C:\\User Files\\O''Neil & $test'";
  const command = powershellCommand(script);
  assert.match(
    command,
    /^powershell.exe -NoProfile -NonInteractive -EncodedCommand [A-Za-z0-9+/=]+$/,
  );
  assert.ok(
    Buffer.from(command.split(" ").at(-1), "base64")
      .toString("utf16le")
      .endsWith(script),
  );
});

test("remote builds use an isolated cache, remove stale source and release the lock on failure", async (t) => {
  const { root, write } = await fixture(t);
  const runId = randomUUID();
  const state = "build/windows-lan";
  const inbox = join(root, state, "inbox", runId);
  await write(`${state}/inbox/${runId}/source.tar.gz`, "source archive");
  await write(`${state}/workspace/.monocode-windows-builder`, "1");
  await write(`${state}/workspace/src/stale.ts`, "stale");
  await write(`${state}/workspace/target/cache`, "rust cache");
  await write(`${state}/workspace/build/runtime-cache`, "runtime cache");
  const options = {
    repository: root,
    runId,
    version,
    archiveHash: hash("source archive"),
  };
  const commands = [];
  const run = (command, args, settings) => {
    commands.push([command, args]);
    if (args.includes("build:windows")) {
      assert.equal(settings.cwd, join(root, state, "workspace"));
      assert.equal(settings.env.CARGO_TARGET_DIR, join(settings.cwd, "target"));
      const output = join(
        settings.cwd,
        "target/release/bundle/nsis",
        `MonoCode_${version}_x64-setup.exe`,
      );
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, "MZ built exe");
    }
  };
  const result = await runWindowsBuild(options, { run });
  assert.equal(result.sha256, hash("MZ built exe"));
  assert.equal(
    await readFile(join(inbox, result.filename), "utf8"),
    "MZ built exe",
  );
  assert.equal(existsSync(join(root, state, "workspace/src/stale.ts")), false);
  assert.equal(
    await readFile(join(root, state, "workspace/target/cache"), "utf8"),
    "rust cache",
  );
  assert.equal(await readFile(join(root, "src/main.ts"), "utf8"), "original");
  assert.equal(existsSync(join(root, state, "build.lock")), false);
  assert.equal(commands.filter(([, args]) => args.includes("ci")).length, 1);
  assert.equal(
    commands.filter(([, args]) => args.includes("build:windows")).length,
    1,
  );
  await assert.rejects(
    runWindowsBuild(options, {
      run: () => {
        throw new Error("tool failed");
      },
    }),
    /tool failed/,
  );
  assert.equal(existsSync(join(root, state, "build.lock")), false);
});

test("remote build refuses overlaps, altered archives and unowned directories", async (t) => {
  const { root, write } = await fixture(t);
  const runId = randomUUID();
  const state = "build/windows-lan";
  await write(`${state}/inbox/${runId}/source.tar.gz`, "source archive");
  const options = {
    repository: root,
    runId,
    version,
    archiveHash: hash("source archive"),
  };
  await mkdir(join(root, state, "build.lock"));
  const run = () => assert.fail("must not run a command");
  await assert.rejects(runWindowsBuild(options, { run }), /already running/);
  assert.equal(existsSync(join(root, state, "build.lock")), true);
  await rm(join(root, state, "build.lock"), { recursive: true });
  await assert.rejects(
    runWindowsBuild({ ...options, archiveHash: "wrong" }, { run }),
    /checksum mismatch/,
  );
  await write(`${state}/workspace/precious.txt`, "existing user file");
  await assert.rejects(runWindowsBuild(options, { run }), /ENOENT/);
  assert.equal(
    await readFile(join(root, state, "workspace/precious.txt"), "utf8"),
    "existing user file",
  );
});

for (const failure of [null, "version", "checksum", "ssh"]) {
  test(`controller validates transfer and receipt (${failure || "success"}) before returning an installer`, async (t) => {
    const { root } = await fixture(t);
    let request;
    let unchangedChecks = 0;
    const commands = [];
    const run = (command, args) => {
      commands.push(command);
      if (failure === "ssh") throw new Error("SSH unreachable");
      if (command === "ssh") {
        const script = Buffer.from(
          args.at(-1).split(" ").at(-1),
          "base64",
        ).toString("utf16le");
        const data = script.match(/\.mjs' '([A-Za-z0-9+/=]+)'/);
        if (data) request = JSON.parse(Buffer.from(data[1], "base64"));
      } else if (command === "scp" && basename(args.at(-1)) === "result.json") {
        writeFileSync(
          args.at(-1),
          JSON.stringify({
            version: failure === "version" ? "wrong" : request.version,
            archiveHash: request.archiveHash,
            checked: false,
            filename: `MonoCode_${version}_x64-setup.exe`,
            sha256: hash("MZ installer"),
            size: "MZ installer".length,
          }),
        );
      } else if (command === "scp" && args.at(-1).endsWith(".exe")) {
        writeFileSync(
          args.at(-1),
          failure === "checksum" ? "bad bytes" : "MZ installer",
        );
      }
    };
    const call = buildWindowsDesktop(root, version, {
      run,
      assertUnchanged: async () => {
        unchangedChecks++;
      },
    });
    if (failure) {
      await assert.rejects(
        call,
        failure === "ssh"
          ? /SSH unreachable/
          : failure === "version"
            ? /receipt/
            : /checksum mismatch/,
      );
    } else {
      const { nsis } = await call;
      assert.equal(await readFile(nsis, "utf8"), "MZ installer");
      assert.equal(unchangedChecks, 2);
      assert.equal(commands.at(-1), "ssh");
    }
  });
}
