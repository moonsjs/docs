// Konfigurasi situs dokumentasi Moons (Astro Starlight).
// Sumber markdown: site/** (ID), site-en/** (EN), ai/**, api/**, migration/**,
// manifest.md — digenerate ke src/content/docs oleh scripts/build.ts.
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
        root: { label: "Bahasa Indonesia", lang: "id" },
        en: { label: "English", lang: "en" },
      },
      description: "Framework full-stack TypeScript yang membuat kebocoran kode server ke client mustahil.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/moonsjs" }],
      plugins: [starlightLinksValidator()],
      sidebar: [
        // Struktur mengikuti Diátaxis (tutorial → how-to → reference → explanation):
        // Mulai (tutorial) · Konsep (explanation) · Panduan (how-to) ·
        // Referensi (reference) · Arsitektur/Migrasi (explanation/how-to) · Agen AI · Contoh.
        { label: "Mulai", translations: { en: "Start" }, items: [
          { label: "Mulai cepat", translations: { en: "Quickstart" }, slug: "mulai/mulai-cepat" },
          { label: "Struktur proyek", translations: { en: "Project structure" }, slug: "mulai/struktur-proyek" },
        ]},
        { label: "Konsep", translations: { en: "Concepts" }, items: [
          { label: "Model zero-trust", translations: { en: "Zero-trust model" }, slug: "keamanan" },
          { label: "Routing", slug: "dasar/routing" },
          { label: "Loader", translations: { en: "Loaders" }, slug: "dasar/loader" },
          { label: "serverFn", slug: "dasar/server-fn" },
          { label: "Konteks & env", translations: { en: "Context & env" }, slug: "dasar/context-env" },
          { label: "Navigasi & parameter URL", translations: { en: "Navigation & URL params" }, slug: "dasar/navigasi" },
          { label: "Meta & SEO", slug: "dasar/meta" },
          { label: "Error, redirect & 404", translations: { en: "Errors, redirect & 404" }, slug: "dasar/error" },
        ]},
        { label: "Panduan", translations: { en: "Guides" }, items: [
          { label: "Validasi dua sisi", translations: { en: "Two-sided validation" }, slug: "panduan/validasi-dua-sisi" },
          { label: "Auth & CSRF", slug: "panduan/auth-dan-csrf" },
          { label: "Rate limit", slug: "panduan/rate-limit" },
          { label: "Endpoint API (src/api)", translations: { en: "API endpoints (src/api)" }, slug: "panduan/api-routes" },
          { label: "Prerender & ISR", translations: { en: "Prerendering & ISR" }, slug: "panduan/prerender" },
          { label: "Upload file", translations: { en: "File uploads" }, slug: "panduan/upload" },
          { label: "Cache & header HTTP", translations: { en: "Caching & HTTP headers" }, slug: "panduan/cache-dan-http" },
          { label: "Pengujian", translations: { en: "Testing" }, slug: "panduan/testing" },
          { label: "Plugin & siklus hidup", translations: { en: "Plugins & lifecycle" }, slug: "panduan/plugin" },
          { label: "Build & deploy", slug: "panduan/deploy" },
        ]},
        { label: "Referensi", translations: { en: "Reference" }, items: [
          { label: "Ikhtisar paket", translations: { en: "Packages overview" }, slug: "api" },
          { label: "Core", slug: "api/core" },
          { label: "Server", slug: "api/server" },
          { label: "React", slug: "api/react" },
          { label: "Vite", slug: "api/vite" },
          { label: "CLI", slug: "api/cli" },
          { label: "MCP & konteks agen", translations: { en: "MCP & agent context" }, slug: "api/mcp" },
        ]},
        { label: "Arsitektur", translations: { en: "Architecture" }, items: [{ label: "Manifest", slug: "manifest" }] },
        { label: "Migrasi", translations: { en: "Migration" }, items: [{ autogenerate: { directory: "migration" } }] },
        { label: "Agen AI", translations: { en: "AI agents" }, items: [
          { label: "Konteks agen (EN)", translations: { en: "Agent context (EN)" }, slug: "ai/context" },
          { label: "Kontrak CLI JSON", translations: { en: "CLI JSON contract" }, slug: "ai/cli-json" },
          { label: "Resep (EN)", items: [{ autogenerate: { directory: "ai/recipes" } }] },
        ]},
        { label: "Contoh", translations: { en: "Examples" }, items: [{ label: "Cookbook (repo)", link: "https://github.com/moonsjs/cookbook" }] },
      ],
    }),
  ],
});
