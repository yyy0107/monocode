// Copied to the Windows builder; intentionally uses only Node built-ins.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function runWindowsBuild(
  { repository, runId, version, archiveHash, checkOnly = false },
  {
    run = (command, args, options) =>
      execFileSync(command, args, { stdio: "inherit", ...options }),
  } = {},
) {
  if (
    !/^[a-f0-9-]{36}$/.test(runId) ||
    !/^\d+\.\d+\.\d+-lan\.\d+$/.test(version)
  )
    throw new Error("Invalid Windows build identity");
  const state = join(repository, "build/windows-lan");
  const inbox = join(state, "inbox", runId);
  const workspace = join(state, "workspace");
  const lock = join(state, "build.lock");
  await mkdir(state, { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        `Windows publication is already running (or was interrupted). Inspect ${lock} before retrying.`,
      );
    throw error;
  }
  try {
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, runId, version }),
    );
    const archive = join(inbox, "source.tar.gz");
    if (digest(await readFile(archive)) !== archiveHash)
      throw new Error("Windows source archive checksum mismatch");
    // Never clean an arbitrary checkout or another tool's directory.
    const marker = join(workspace, ".monocode-windows-builder");
    try {
      await mkdir(workspace);
      await writeFile(marker, "1");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await access(marker);
    }
    for (const name of await readdir(workspace)) {
      if (
        ![
          "node_modules",
          "target",
          "build",
          ".monocode-windows-builder",
        ].includes(name)
      )
        await rm(join(workspace, name), { recursive: true, force: true });
    }
    run("tar.exe", ["-xzf", archive, "-C", workspace]);
    const npm = join(
      dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    );
    const env = {
      ...process.env,
      CARGO_TARGET_DIR: join(workspace, "target"),
      RUSTUP_TOOLCHAIN: "stable-x86_64-pc-windows-msvc",
    };
    delete env.TAURI_SIGNING_PRIVATE_KEY;
    delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    const options = { cwd: workspace, env };
    run(process.execPath, ["--version"], options);
    run(process.execPath, [npm, "--version"], options);
    run("cargo.exe", ["--version"], options);
    run("rustc.exe", ["--version"], options);
    const config = join(workspace, "build/tauri.lan.conf.json");
    await mkdir(dirname(config), { recursive: true });
    await writeFile(config, JSON.stringify({ version }));
    const receipt = { version, archiveHash, checked: checkOnly };
    if (!checkOnly) {
      run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], options);
      // Use a relative config path: npm forwards arguments through cmd.exe.
      run(
        process.execPath,
        [
          npm,
          "run",
          "build:windows",
          "--",
          "--config",
          "build/tauri.lan.conf.json",
          "--ci",
        ],
        options,
      );
      const filename = `MonoCode_${version}_x64-setup.exe`;
      const source = join(workspace, "target/release/bundle/nsis", filename);
      const bytes = await readFile(source);
      if (bytes.toString("ascii", 0, 2) !== "MZ")
        throw new Error(
          "Windows build did not produce an executable installer",
        );
      await copyFile(source, join(inbox, filename));
      Object.assign(receipt, {
        filename,
        sha256: digest(bytes),
        size: bytes.length,
      });
    }
    await writeFile(join(inbox, "result.json"), JSON.stringify(receipt));
    return receipt;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.platform !== "win32" || process.arch !== "x64")
      throw new Error("The Windows builder requires Windows x64");
    await runWindowsBuild(
      JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8")),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
