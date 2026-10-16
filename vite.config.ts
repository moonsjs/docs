import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import moons from "@moonsjs/vite";

/**
 * `virtual:moons-docs-content` — satu-satunya pintu data dokumen:
 * - environment `ssr` (dev SSR & build SSR) → konten penuh dari
 *   `src/generated/content.json` (hasil `bun run content`);
 * - environment `client` → `null` (stub), karena browser selalu memakai
 *   payload `#__moons_data` dari HTML. Bundle klien tetap ramping dan data
 *   dokumen tidak pernah ikut ter-bundle.
 */
function docsContent(): Plugin {
  let isSsrBuild = false;
  return {
    name: "moons-docs-content",
    configResolved(config) {
      isSsrBuild = Boolean((config.build as { ssr?: boolean }).ssr);
    },
    resolveId(id) {
      if (id === "virtual:moons-docs-content") {
        return "\0virtual:moons-docs-content";
      }
      return undefined;
    },
    load(id) {
      if (id !== "\0virtual:moons-docs-content") {
        return undefined;
      }
      const envName = (this as { environment?: { name?: string } }).environment?.name;
      const ssr = envName === undefined ? isSsrBuild : envName === "ssr";
      if (!ssr) {
        return "export const content = null;\n";
      }
      const file = new URL("./src/generated/content.json", import.meta.url);
      if (!existsSync(file)) {
        throw new Error(
          "[docs] src/generated/content.json belum ada — jalankan `bun run content` dulu",
        );
      }
      return `export const content = ${readFileSync(file, "utf8")};\n`;
    },
  };
}

export default defineConfig({
  plugins: [docsContent(), moons({ leakTest: { canary: "MOONS_DOCS_CANARY_3f9c21" } })],
});
