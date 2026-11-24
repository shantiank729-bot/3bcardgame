import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
import { defineConfig } from "vitest/config";

// やねうら王 wasm（GPLv3）を public/engine/ にコピーして配信する
function copyEngine() {
  const src = resolve(root, "node_modules/@mizarjp/yaneuraou.k-p/lib");
  const dst = resolve(root, "public/engine");
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const f of ["yaneuraou.k-p.js", "yaneuraou.k-p.wasm", "yaneuraou.k-p.worker.js"]) copyFileSync(resolve(src, f), resolve(dst, f));
}
copyEngine();

const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  base: "./",
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  test: { globals: true, include: ["test/**/*.test.ts"] },
});
