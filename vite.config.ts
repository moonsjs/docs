import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import moons from "@moonsjs/vite";

/**
 * `virtual:moons-docs-content` — the single door to documentation data.
 * - ssr environment (dev SSR + build SSR): full content from
 *   `src/generated/content.json` (produced by `bun run content`);
 * - client environment: `null`. Browsers always use the `#__moons_data`
 *   payload embedded in the served HTML, so page content never ships in the
 *   client bundle.
 */
function docsContent(): Plugin {
  return {
    name: "moons-docs-content",
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
      if (envName === "client") {
        return "export const content = null;\n";
      }
      const file = new URL("./src/generated/content.json", import.meta.url);
      if (!existsSync(file)) {
        throw new Error(
          "[docs] src/generated/content.json is missing — run `bun run content` first",
        );
      }
      return `export const content = ${readFileSync(file, "utf8")};\n`;
    },
  };
}

/**
 * Preload the latin variable-font files so FCP/LCP do not wait on the
 * stylesheet cascade (build only; dev has no bundle to inspect).
 */
function fontPreload(): Plugin {
  return {
    name: "moons-docs-font-preload",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      const bundle = (ctx as { bundle?: Record<string, unknown> }).bundle;
      if (bundle === undefined) {
        return html;
      }
      const fonts = Object.keys(bundle).filter(
        (file) =>
          /(inter|jetbrains-mono)-latin-wght-normal[^/]*\.woff2$/.test(file),
      );
      return {
        html,
        tags: fonts.map((file) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            as: "font",
            type: "font/woff2",
            href: `/${file}`,
            crossorigin: "",
          },
          injectTo: "head" as const,
        })),
      };
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  plugins: [
    tailwindcss(),
    docsContent(),
    moons({ leakTest: { canary: "MOONS_DOCS_V2_7d41fa" } }),
    fontPreload(),
  ],
});
