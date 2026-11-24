import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

/** ビルド後、dist のファイル一覧を Service Worker のキャッシュ対象として書き込む */
function swPrecache() {
  return {
    name: "sw-precache",
    apply: "build" as const,
    closeBundle() {
      const dist = resolve(root, "dist");
      const files: string[] = [];
      const walk = (d: string, rel = "") => {
        for (const f of readdirSync(d)) {
          const full = resolve(d, f), r = rel + f;
          if (statSync(full).isDirectory()) walk(full, r + "/");
          else if (r !== "sw.js" && !r.endsWith(".br") && !r.endsWith(".gz")) files.push("./" + r);
        }
      };
      walk(dist);
      const swPath = resolve(dist, "sw.js");
      const version = Date.now().toString(36);
      writeFileSync(swPath, readFileSync(swPath, "utf8").replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(["./", ...files])));
    },
  };
}

const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  base: "./",
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  plugins: [swPrecache()],
  test: { globals: true, include: ["test/**/*.test.ts"] },
});
