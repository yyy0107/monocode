import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyPublicIntegrity } from "../src/publicIntegrity";

it("rejects added executable files as well as edited locked bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "public-integrity-test-"));
  try {
    for (const path of [
      "public",
      "data/upstream/bfcl-v4-sample",
      "data/upstream/longmemeval-oracle-sample",
    ])
      await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, "public/adapter.py"), "original");
    await writeFile(
      join(root, "public/integrity.json"),
      JSON.stringify({
        files: {
          "public/adapter.py": createHash("sha256")
            .update("original")
            .digest("hex"),
        },
      }),
    );
    expect((await verifyPublicIntegrity(root)).files).toBe(1);
    await writeFile(join(root, "public/extra.py"), "unexpected tool");
    await expect(verifyPublicIntegrity(root)).rejects.toThrow(
      "inventory drift",
    );
    await rm(join(root, "public/extra.py"));
    await writeFile(join(root, "public/adapter.py"), "changed");
    await expect(verifyPublicIntegrity(root)).rejects.toThrow("hash drift");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
