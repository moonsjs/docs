// Konfigurasi situs dokumentasi Moons (Astro Starlight).
// Locale root = English (`site/**`), Indonesia di `/id/**` (`id/site/**`).
// Sumber markdown digenerate ke src/content/docs oleh scripts/build.ts.
// Landing root (`/`) dirender oleh src/pages/index.astro.
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";

const SITE = "https://docs.devmoon.net";

export default defineConfig({
  site: SITE,
  integrations: [
    starlight({
      title: "Moons",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        id: { label: "Bahasa Indonesia" },
      },
      description:
        "Full-stack TypeScript for React where server code can never leak into the client bundle.",
      logo: { src: "./src/assets/logo.svg", alt: "Moons" },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/moonsjs" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/org/moonsjs" },
      ],
      customCss: [
        "@fontsource-variable/inter",
        "@fontsource-variable/jetbrains-mono",
        "./src/styles/custom.css",
      ],
      plugins: [starlightLinksValidator()],
      expressiveCode: {
        styleOverrides: { borderRadius: "0.75rem" },
      },
      sidebar: [
        {
          label: "Get started",
          translations: { id: "Mulai" },
          items: [
            { label: "Quickstart", translations: { id: "Mulai cepat" }, slug: "start/quickstart" },
            {
              label: "Project structure",
              translations: { id: "Struktur proyek" },
              slug: "start/project-structure",
            },
          ],
        },
        {
          label: "Concepts",
          translations: { id: "Konsep" },
          items: [
            {
              label: "Zero-trust model",
              translations: { id: "Model zero-trust" },
              slug: "concepts/zero-trust",
            },
            { label: "Routing", slug: "concepts/routing" },
            { label: "Loaders", translations: { id: "Loader" }, slug: "concepts/loaders" },
            { label: "serverFn", slug: "concepts/server-fn" },
            {
              label: "Context & env",
              translations: { id: "Konteks & env" },
              slug: "concepts/context-env",
            },
            {
              label: "Navigation & URL params",
              translations: { id: "Navigasi & parameter URL" },
              slug: "concepts/navigation",
            },
            { label: "Meta & SEO", slug: "concepts/meta" },
            {
              label: "Errors, redirect & 404",
              translations: { id: "Error, redirect & 404" },
              slug: "concepts/errors",
            },
          ],
        },
        {
          label: "Guides",
          translations: { id: "Panduan" },
          items: [
            {
              label: "Two-sided validation",
              translations: { id: "Validasi dua sisi" },
              slug: "guides/two-sided-validation",
            },
            { label: "Auth & CSRF", slug: "guides/auth-csrf" },
            { label: "Rate limiting", translations: { id: "Rate limit" }, slug: "guides/rate-limit" },
            {
              label: "API routes (src/api)",
              translations: { id: "Endpoint API (src/api)" },
              slug: "guides/api-routes",
            },
            {
              label: "Prerendering & ISR",
              translations: { id: "Prerender & ISR" },
              slug: "guides/prerender-isr",
            },
            { label: "File uploads", translations: { id: "Upload file" }, slug: "guides/uploads" },
            {
              label: "Caching & HTTP headers",
              translations: { id: "Cache & header HTTP" },
              slug: "guides/caching-headers",
            },
            { label: "Testing", translations: { id: "Pengujian" }, slug: "guides/testing" },
            { label: "Plugins & lifecycle", translations: { id: "Plugin & siklus hidup" }, slug: "guides/plugins" },
            { label: "Build & deploy", slug: "guides/deploy" },
          ],
        },
        {
          label: "Reference",
          translations: { id: "Referensi" },
          items: [
            { label: "Packages overview", translations: { id: "Ikhtisar paket" }, slug: "api" },
            { label: "Core", slug: "api/core" },
            { label: "Server", slug: "api/server" },
            { label: "React", slug: "api/react" },
            { label: "Vite", slug: "api/vite" },
            { label: "CLI", slug: "api/cli" },
            { label: "MCP & agent context", translations: { id: "MCP & konteks agen" }, slug: "api/mcp" },
          ],
        },
        {
          label: "Architecture",
          translations: { id: "Arsitektur" },
          items: [{ label: "Manifest", slug: "manifest" }],
        },
        {
          label: "Migration",
          translations: { id: "Migrasi" },
          items: [{ autogenerate: { directory: "migration" } }],
        },
        {
          label: "AI agents",
          translations: { id: "Agen AI" },
          items: [
            { label: "Agent context", translations: { id: "Konteks agen" }, slug: "ai/context" },
            { label: "CLI JSON contract", translations: { id: "Kontrak CLI JSON" }, slug: "ai/cli-json" },
            {
              label: "Recipes",
              translations: { id: "Resep" },
              items: [{ autogenerate: { directory: "ai/recipes" } }],
            },
          ],
        },
        {
          label: "Examples",
          translations: { id: "Contoh" },
          items: [{ label: "Cookbook (repo)", link: "https://github.com/moonsjs/cookbook" }],
        },
      ],
    }),
  ],
});
