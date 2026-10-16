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

const executablePath = process.env["MOONS_CHROME_EXECUTABLE"];
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/`);
  await page.waitForLoadState("networkidle");

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

  await page.click("[data-theme-toggle]");
  const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? "light");
  if (theme !== "dark") {
    throw new Error("[docs] theme toggle tidak mengubah tema");
  }
} finally {
  await browser.close();
}

console.log("OK static-smoke (docs)");
process.exit(0);
