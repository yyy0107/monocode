import { build } from "esbuild";
import { copyFile } from "node:fs/promises";

await build({
  entryPoints: ["host/cli.ts"],
  outfile: "build/host/monocode-host.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  loader: { ".ps1": "text", ".md": "text" },
  define: { "import.meta.hot": "undefined" },
  sourcemap: true,
  // The workflow analyzer bundles the CommonJS TypeScript compiler, which reads
  // require/__filename at load time; provide them in the ESM output.
  banner: {
    js: [
      'import { createRequire as __monocodeCreateRequire } from "node:module";',
      'import { fileURLToPath as __monocodeFileURLToPath } from "node:url";',
      'import { dirname as __monocodeDirname } from "node:path";',
      "const require = __monocodeCreateRequire(import.meta.url);",
      "const __filename = __monocodeFileURLToPath(import.meta.url);",
      "const __dirname = __monocodeDirname(__filename);",
    ].join("\n"),
  },
});
await copyFile("host/provider-guard.mjs", "build/host/provider-guard.mjs");
