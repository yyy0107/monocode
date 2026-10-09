import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export async function verifyPublicIntegrity(root: string) {
  const bytes = await readFile(join(root, "public/integrity.json"));
  const lock = JSON.parse(bytes.toString());
  const actual: Record<string, string> = {};
  async function scan(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "__pycache__" || entry.name.endsWith(".pyc")) continue;
      const path = join(directory, entry.name);
      const key = relative(root, path).split(sep).join("/");
      if (key === "public/integrity.json") continue;
      if (entry.isSymbolicLink())
        throw Error(`Public artifact symlink rejected: ${key}`);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile())
        actual[key] = createHash("sha256")
          .update(await readFile(path))
          .digest("hex");
    }
  }
  for (const directory of [
    "public",
    "data/upstream/bfcl-v4-sample",
    "data/upstream/longmemeval-oracle-sample",
  ])
    await scan(join(root, directory));
  if (
    JSON.stringify(Object.keys(actual).sort()) !==
    JSON.stringify(Object.keys(lock.files).sort())
  )
    throw Error(
      "Public artifact inventory drift; investigate added/removed files before running adapters",
    );
  for (const [path, digest] of Object.entries(actual))
    if (lock.files[path] !== digest)
      throw Error(`Public artifact hash drift: ${path}`);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    files: Object.keys(actual).length,
  };
}
