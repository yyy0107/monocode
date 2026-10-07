import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fontScale from "./scripts/postcss-font-scale.mjs";
import { resolve } from "node:path";
import { renameSync } from "node:fs";

// Browser development uses a same-origin proxy. Production mobile builds call
// the Host through native HTTP; the Host's browser-origin guard stays intact.
function hostProxy(): Plugin {
  const endpoint = process.env.MONOCODE_MOBILE_HOST_URL;
  return {
    name: "monocode-mobile-host",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/__mobile/rpc") return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        if (!endpoint || req.method !== "POST") {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error: "Set MONOCODE_MOBILE_HOST_URL before starting mobile:dev.",
            }),
          );
          return;
        }
        try {
          const data: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 32 * 1024 * 1024) throw new Error("Request is too large");
            data.push(Buffer.from(chunk));
          }
          const input = JSON.parse(Buffer.concat(data).toString());
          if (input.endpoint !== new URL(endpoint).origin)
            throw new Error(
              "URL does not match the configured development Host",
            );
          const response = await fetch(`${new URL(endpoint).origin}/rpc`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.authorization ?? "",
            },
            body: JSON.stringify(input.request),
            redirect: "error",
            signal: AbortSignal.timeout(20_000),
          });
          res.statusCode = response.status;
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Host connection failed",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  // Desktop and mobile dev servers often run together. Sharing the optimizer
  // cache invalidates lazy chunks (notably Streamdown's highlighted body).
  cacheDir: "node_modules/.vite-mobile",
  plugins: [
    react(),
    tailwindcss(),
    hostProxy(),
    {
      name: "mobile-entry",
      apply: "build",
      closeBundle() {
        renameSync("dist-mobile/mobile.html", "dist-mobile/index.html");
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 1425,
    strictPort: true,
    watch: {
      ignored: [
        "**/mobile/android/**",
        "**/mobile/ios/**",
        "**/dist-mobile/**",
      ],
    },
  },
  // Settings → Appearance font sizes and reduced-motion override.
  css: { postcss: { plugins: [fontScale()] } },
  build: { outDir: "dist-mobile", rollupOptions: { input: "mobile.html" } },
  // Capacitor loads index.html. Keep mobile.html separate from the desktop entry.
  resolve: { alias: { "@mobile": resolve("src/mobile") } },
});
