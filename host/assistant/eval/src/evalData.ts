import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export type DatasetLock = {
  version: number;
  sources: Record<string, { files: Record<string, string> }>;
};

const expandHome = (path: string) =>
  path === "~"
    ? homedir()
    : path.startsWith("~/")
      ? join(homedir(), path.slice(2))
      : path;

export function readDatasetLock(root: string): DatasetLock | undefined {
  try {
    return JSON.parse(
      readFileSync(join(root, "data/datasets.lock.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function evalDataRoot(root: string): string {
  if (process.env.MONOCODE_EVAL_DATA_ROOT)
    return resolve(expandHome(process.env.MONOCODE_EVAL_DATA_ROOT));
  const digest = createHash("sha256")
    .update(readFileSync(join(root, "data/datasets.lock.json")))
    .digest("hex")
    .slice(0, 16);
  return resolve(
    expandHome(
      process.env.MONOCODE_EVAL_CACHE ||
        join(
          process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
          "monocode",
          "eval",
        ),
    ),
    digest,
  );
}

/** Only immutable files explicitly listed in the dataset lock live in the cache. */
export function evalDataPath(root: string, relativePath: string): string {
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes(".."))
    throw new Error("Invalid evaluation data path");
  const lock = readDatasetLock(root);
  const external =
    lock &&
    Object.entries(lock.sources).find(([, source]) =>
      Object.hasOwn(source.files, relativePath),
    );
  return external
    ? join(evalDataRoot(root), external[0], relativePath)
    : resolve(root, relativePath);
}

/** Acquisition happens before the isolated, network-denied evaluation bridge starts. */
export async function ensureEvalData(
  root: string,
  sources: readonly string[],
): Promise<string> {
  const selected = [...new Set(sources)];
  const lock = readDatasetLock(root);
  if (!lock) return root;
  if (
    !selected.length ||
    selected.some((source) => !Object.hasOwn(lock.sources, source))
  )
    throw new Error("Unknown evaluation dataset");
  const output = await new Promise<string>((resolveOutput, reject) => {
    const child = spawn(
      "python3",
      [
        "-B",
        join(root, "bin/prepare_data.py"),
        "--sources",
        selected.join(","),
      ],
      {
        cwd: root,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "",
      stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8192);
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveOutput(stdout)
        : reject(
            new Error(
              `Evaluation data preparation failed (${code}): ${stderr.trim()}`,
            ),
          ),
    );
  });
  const result = JSON.parse(output.trim().split("\n").at(-1) ?? "{}");
  if (typeof result.root !== "string" || !isAbsolute(result.root))
    throw new Error(
      "Evaluation data preparation returned no absolute cache root",
    );
  process.env.MONOCODE_EVAL_DATA_ROOT = result.root;
  return result.root;
}
