#!/usr/bin/env bun
// Smoke E2E untuk static export docs: serve `dist/` dengan static server murni
// (tanpa runtime Moons) lalu uji halaman inti, 404, dan navigasi klien + tema.
import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const repoRoot = resolve(import.meta.dir, "..");
const root = resolve(repoRoot, "dist");
const port = Number(process.env["MOONS_TEST_PORT"] ?? 3041);

if (!existsSync(join(root, "index.html"))) {
  throw new Error("[docs] dist/index.html tidak ada — jalankan `bun run build` dulu");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + "/")) {
      return new Response("forbidden", { status: 403 });
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, "index.html");
    }
    if (existsSync(file) && statSync(file).isFile()) {
      return new Response(Bun.file(file), {
        headers: { "content-type": MIME[extname(file)] ?? "application/octet-stream" },
      });
    }
    const notFound = join(root, "404.html");
    if (existsSync(notFound)) {
      return new Response(Bun.file(notFound), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("not found", { status: 404 });
  },
});

const base = `http://127.0.0.1:${port}`;

async function expectStatus(path: string, status: number): Promise<Response> {
  const response = await fetch(`${base}${path}`);
  if (response.status !== status) {
    throw new Error(`[docs] ${path} → ${response.status} (harap ${status})`);
  }
  return response;
}

await expectStatus("/", 200);
await expectStatus("/start/quickstart", 200);
await expectStatus("/id/start/quickstart", 200);
await expectStatus("/raw/ai/CONTEXT.md", 200);
await expectStatus("/llms.txt", 200);
await expectStatus("/pagefind/pagefind.js", 200);
await expectStatus("/sitemap.xml", 200);
await expectStatus("/robots.txt", 200);
await expectStatus("/_redirects", 200);

const notFound = await expectStatus("/tidak-ada", 404);
if (!(await notFound.text()).includes("Page not found")) {
  throw new Error("[docs] 404.html tidak dipakai untuk path tak dikenal");
}

// Audit render: tidak boleh ada artefak Promise & blok kode harus ter-render.
const htmlFiles = new Bun.Glob("**/*.html");
let audited = 0;
for await (const file of htmlFiles.scan({ cwd: root })) {
  const html = await Bun.file(join(root, file)).text();
  audited += 1;
  if (html.includes("[object Promise]")) {
    throw new Error(`[docs] artefak [object Promise] di ${file}`);
  }
}
const quickstart = await (await expectStatus("/start/quickstart", 200)).text();
if (!quickstart.includes('class="shiki')) {
  throw new Error("[docs] blok kode quickstart tidak ter-render (shiki)");
}
const plain = quickstart.replace(/<[^>]+>/g, "");
if (!plain.includes("moons create my-app")) {
  throw new Error("[docs] perintah create tidak ada di quickstart");
}
console.log(`  audit render: ${audited} halaman, tanpa [object Promise]`);

// Hygiene statis: tree deploy bebas canary & tool build-time.
const TEXT_EXT = new Set([".js", ".mjs", ".html", ".css", ".json", ".txt", ".xml", ".md", ".map"]);
const FORBIDDEN = ["MOONS_DOCS_CANARY_3f9c21", "prepare-content", "createHighlighter"];
for await (const file of new Bun.Glob("**/*").scan({ cwd: root })) {
  if (!TEXT_EXT.has(extname(file))) {
    continue;
  }
  const full = join(root, file);
  if (!statSync(full).isFile()) {
    continue;
  }
  const text = await Bun.file(full).text();
  for (const marker of FORBIDDEN) {
    if (text.includes(marker)) {
      throw new Error(`[docs] "${marker}" bocor ke dist/${file}`);
    }
  }
}
if (existsSync(join(root, "content.json"))) {
  throw new Error("[docs] content.json ikut ter-deploy (harus SSR-only)");
}
console.log("  hygiene: tanpa canary, tool build-time, atau content.json di dist");

const executablePath = process.env["MOONS_CHROME_EXECUTABLE"];
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
const permissions: Array<"clipboard-read" | "clipboard-write"> = [
  "clipboard-read",
  "clipboard-write",
];
try {
  // ---------- Desktop ----------
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions,
  });
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await page.waitForLoadState("networkidle");

  if (await page.locator(".nav-toggle").isVisible()) {
    throw new Error("[docs] nav-toggle terlihat di desktop");
  }

  let fullReload = false;
  page.on("load", () => {
    fullReload = true;
  });
  await page.evaluate(() => {
    (window as unknown as { __smoke?: number }).__smoke = 1;
  });

  await page.click('a[href="/start/quickstart"]');
  await page.waitForURL("**/start/quickstart");
  await page.waitForFunction(
    () => document.querySelector("h1")?.textContent?.toLowerCase().includes("quickstart") ?? false,
  );

  if (fullReload) {
    throw new Error("[docs] navigasi klien menyebabkan full reload");
  }
  const marker = await page.evaluate(() => (window as unknown as { __smoke?: number }).__smoke);
  if (marker !== 1) {
    throw new Error("[docs] konteks window hilang setelah navigasi");
  }

  // Tema: dua arah + background benar-benar berubah.
  const themeState = (): Promise<string> =>
    page.evaluate(() => document.documentElement.dataset.theme ?? "light");
  const bodyBg = (): Promise<string> =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const initialTheme = await themeState();
  const initialBg = await bodyBg();
  await page.click("[data-theme-toggle]");
  const flippedTheme = await themeState();
  const flippedBg = await bodyBg();
  if (flippedTheme === initialTheme) {
    throw new Error("[docs] theme toggle tidak mengubah state");
  }
  if (flippedBg === initialBg) {
    throw new Error("[docs] background tidak berubah saat tema berganti");
  }
  await page.click("[data-theme-toggle]");
  if ((await themeState()) !== initialTheme) {
    throw new Error("[docs] tema tidak kembali setelah toggle kedua");
  }
  console.log("  tema: light ⇄ dark dua arah + background berubah ✓");

  // Code-copy di prose (blok kode dokumentasi).
  const proseCopy = page.locator(".prose .code-block button[data-code-copy]").first();
  await proseCopy.scrollIntoViewIfNeeded();
  const codeText =
    (await proseCopy.locator("xpath=following-sibling::pre/code").first().textContent()) ?? "";
  await proseCopy.click();
  await page.waitForFunction(
    () =>
      document.querySelector(".prose .code-block button[data-code-copy]")?.textContent === "Copied",
  );
  const clipProse = await page.evaluate(() => navigator.clipboard.readText());
  if (clipProse.trim() !== codeText.trim()) {
    throw new Error("[docs] clipboard prose tidak sama dengan isi blok kode");
  }
  console.log("  code-copy (prose) ✓");

  // TOC: klik anchor → target ada + hash diterapkan.
  const tocLink = page.locator(".docs-toc a").first();
  const tocHref = await tocLink.getAttribute("href");
  if (tocHref === null || !tocHref.startsWith("#")) {
    throw new Error("[docs] TOC tidak memuat anchor");
  }
  await tocLink.click();
  const targetExists = await page.evaluate(
    (id) => document.getElementById(id) !== null,
    tocHref.slice(1),
  );
  if (!targetExists) {
    throw new Error(`[docs] target TOC ${tocHref} tidak ada di halaman`);
  }
  if (!page.url().endsWith(tocHref)) {
    throw new Error("[docs] hash TOC tidak diterapkan di URL");
  }
  console.log("  TOC anchor ✓");

  // Prev/Next: berpindah halaman lalu kembali.
  const nextHref = await page.locator(".pager-link.next").getAttribute("href");
  if (nextHref === null) {
    throw new Error("[docs] pager next tidak ada");
  }
  const h1Before = await page.locator("h1").textContent();
  await page.click(".pager-link.next");
  await page.waitForURL(`**${nextHref}`);
  const h1After = await page.locator("h1").textContent();
  if (h1After === h1Before) {
    throw new Error("[docs] pager next tidak berpindah halaman");
  }
  await page.click(".pager-link.prev");
  await page.waitForURL("**/start/quickstart");
  console.log("  prev/next ✓");

  // Search: dialog Pagefind, query, hasil, lalu tutup.
  await page.click(".search-button");
  await page.locator(".search-overlay").waitFor({ state: "visible" });
  await page.fill(".search-input", "serverFn");
  await page.waitForFunction(
    () => document.querySelectorAll(".search-results li").length > 0,
    undefined,
    { timeout: 15_000 },
  );
  const firstResult =
    (await page.locator(".search-results li .search-title").first().textContent()) ?? "";
  if (firstResult.trim().length === 0) {
    throw new Error("[docs] hasil pencarian kosong");
  }
  await page.click(".search-backdrop");
  await page.locator(".search-overlay").waitFor({ state: "hidden" });
  console.log("  search (Pagefind) ✓");

  // Code-copy di landing (perintah install) + kembali lewat brand link.
  await page.click('header a[href="/"]');
  await page.waitForURL(`${base}/`);
  const installText = (await page.locator(".install pre code").first().textContent()) ?? "";
  await page.click(".install button[data-code-copy]");
  await page.waitForFunction(
    () => document.querySelector(".install button[data-code-copy]")?.textContent === "Copied",
  );
  const clipLanding = await page.evaluate(() => navigator.clipboard.readText());
  if (clipLanding.trim() !== installText.trim()) {
    throw new Error("[docs] clipboard landing tidak sama dengan perintah install");
  }
  console.log("  code-copy (landing) ✓");
  await context.close();

  // ---------- Mobile ----------
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${base}/start/quickstart`);
  await mpage.waitForLoadState("networkidle");

  if (!(await mpage.locator(".nav-toggle").isVisible())) {
    throw new Error("[docs] nav-toggle tidak terlihat di mobile");
  }
  if (await mpage.locator(".docs-sidebar").isVisible()) {
    throw new Error("[docs] sidebar terlihat sebelum menu dibuka (mobile)");
  }

  await mpage.click(".nav-toggle");
  console.log("    menu dibuka…");
  await mpage.waitForFunction(
    () => document.querySelector(".docs-shell")?.classList.contains("nav-open") ?? false,
  );
  if (!(await mpage.locator(".docs-sidebar").isVisible())) {
    throw new Error("[docs] sidebar tidak muncul setelah menu dibuka");
  }

  const firstNav = mpage.locator(".docs-sidebar .docs-nav a").first();
  const navHref = await firstNav.getAttribute("href");
  if (navHref === null) {
    throw new Error("[docs] sidebar link tanpa href");
  }
  await firstNav.click();
  console.log("    navigasi sidebar…");
  await mpage.waitForURL(`**${navHref}`);

  // Navigasi klien me-render ulang shell → menu tertutup otomatis.
  await mpage.waitForFunction(
    () => !(document.querySelector(".docs-shell")?.classList.contains("nav-open") ?? true),
  );
  if (await mpage.locator(".docs-sidebar").isVisible()) {
    throw new Error("[docs] sidebar masih terbuka setelah navigasi (mobile)");
  }

  // Buka lagi lalu tutup manual lewat toggle.
  await mpage.click(".nav-toggle");
  console.log("    buka-tutup manual…");
  await mpage.waitForFunction(
    () => document.querySelector(".docs-shell")?.classList.contains("nav-open") ?? false,
  );
  await mpage.click(".nav-toggle");
  await mpage.waitForFunction(
    () => !(document.querySelector(".docs-shell")?.classList.contains("nav-open") ?? true),
  );

  const mobileThemeBefore = await mpage.evaluate(
    () => document.documentElement.dataset.theme ?? "light",
  );
  await mpage.click("[data-theme-toggle]");
  const mobileThemeAfter = await mpage.evaluate(
    () => document.documentElement.dataset.theme ?? "light",
  );
  if (mobileThemeAfter === mobileThemeBefore) {
    throw new Error("[docs] theme toggle tidak bekerja di mobile");
  }
  await mobile.close();
  console.log("  mobile: menu, navigasi, tutup, tema ✓");
} finally {
  await browser.close();
}

console.log(
  "OK static-smoke (docs): halaman inti, hygiene, navigasi klien, tema, code-copy, TOC, prev/next, search, mobile",
);
process.exit(0);
