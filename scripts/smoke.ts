#!/usr/bin/env bun
/**
 * Smoke E2E untuk static export docs: serve `dist/` dengan static server murni
 * (tanpa runtime Moons), lalu verifikasi halaman inti, navigasi klien, search,
 * tema, TOC, tombol salin, pager, nav mobile, 404, dan higiene bundle klien.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type BrowserContext, type Page } from "playwright";

const root = resolve(import.meta.dir, "..", "dist", "client");
const port = Number(process.env["MOONS_TEST_PORT"] ?? 3055);
const base = `http://127.0.0.1:${port}`;
const CANARY = "MOONS_DOCS_V2_7d41fa";
const CHUNK_BUDGET_BYTES = 80 * 1024;
const TOTAL_BUDGET_BYTES = 240 * 1024;
const kb = (bytes: number): string => `${Math.round(bytes / 1024)}KB`;

if (!existsSync(join(root, "index.html"))) {
  throw new Error("[smoke] dist/index.html missing — run `bun run build` first");
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

function resolveFile(pathname: string): string | null {
  let file = normalize(join(root, pathname));
  if (file !== root && !file.startsWith(root + "/")) {
    return null;
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }
  if (existsSync(file) && statSync(file).isFile()) {
    return file;
  }
  if (existsSync(`${file}.html`)) {
    return `${file}.html`;
  }
  return null;
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);
    const file = resolveFile(decodeURIComponent(url.pathname));
    if (file !== null) {
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

let failures = 0;
const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.error(`  FAIL ${name}\n       ${detail}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type MarkerWindow = Window & { __smokeMarker?: number };

async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as MarkerWindowGlobal).__smokeMarker = 1;
  });
}

async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as MarkerWindowGlobal).__smokeMarker === 1);
}

declare global {
  type MarkerWindowGlobal = Window & { __smokeMarker?: number };
}

const browser = await chromium.launch();
const errors: string[] = [];

async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return page;
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await desktop.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });

console.log("[smoke] desktop checks");

await check("home renders hero, version, and 12 feature cards", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const h1 = await page.locator("h1").first().textContent();
  assert((h1 ?? "").includes("leak server code"), `unexpected h1: ${h1}`);
  const badge = await page.locator("header + main span", { hasText: /Zero-trust by design · v\d+/ }).first().textContent();
  assert((badge ?? "").includes("Zero-trust by design · v"), `version badge missing: ${badge}`);
  const cards = await page.locator("[data-feature]").count();
  assert(cards === 12, `expected 12 feature cards, got ${cards}`);
  await page.close();
});

await check("client navigation home → installation (no reload)", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await markPage(page);
  await page.getByRole("link", { name: "Get started" }).click();
  await page.waitForURL("**/getting-started/installation");
  await page.waitForSelector("h1");
  const h1 = await page.locator("h1").first().textContent();
  assert((h1 ?? "").includes("Installation"), `unexpected h1: ${h1}`);
  assert(await markerStillThere(page), "window marker lost — full reload happened");
  await page.close();
});

await check("sidebar marks the active page", async () => {
  const page = await newPage(desktop);
  await page.goto(`${base}/core-concepts/routing`, { waitUntil: "domcontentloaded" });
  const active = page.locator("nav[aria-label='Documentation'] a[href='/core-concepts/routing']");
  await active.waitFor();
  const className = (await active.getAttribute("class")) ?? "";
  assert(className.includes("font-medium"), `active link not highlighted: ${className}`);
  await page.close();
});

await check("table of contents scrolls and highlights", async () => {
  const page = await newPage(desktop);
  await page.goto(`${base}/core-concepts/routing`, { waitUntil: "domcontentloaded" });
  const toc = page.locator("nav[aria-label='On this page']");
  await toc.waitFor();
  const links = toc.locator("a");
  assert((await links.count()) >= 2, "expected at least two TOC entries");
  const second = links.nth(1);
  await second.click();
  await page.waitForFunction(() => window.scrollY > 0, undefined, { timeout: 5000 });
  const hash = await page.evaluate(() => location.hash);
  assert(hash.startsWith("#"), `hash not updated after TOC click: ${hash}`);
  await page.waitForFunction(
    () => document.querySelector("nav[aria-label='On this page'] a[class*='border-brand']") !== null,
    undefined,
    { timeout: 5000 },
  );
  await page.close();
});

await check("Cmd+K search opens, filters, and navigates", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await markPage(page);
  const dialog = page.locator("[role='dialog']");
  let opened = false;
  for (let attempt = 0; attempt < 10 && !opened; attempt += 1) {
    await page.keyboard.press("Control+k");
    try {
      await dialog.waitFor({ state: "visible", timeout: 700 });
      opened = true;
    } catch {
      await page.waitForTimeout(250);
    }
  }
  assert(opened, "Cmd+K did not open the search dialog");
  await page.keyboard.type("serverFn");
  await page.waitForTimeout(250);
  const item = dialog.locator("[cmdk-item]", { hasText: "serverFn" }).first();
  await item.waitFor();
  await item.click();
  await page.waitForURL("**/core-concepts/server-fn");
  assert(await markerStillThere(page), "search navigation did a full reload");
  await page.close();
});

await check("theme toggle: dark persists across reload, light switches back", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Switch theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  assert(
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
    "dark class not applied",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  assert(
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
    "dark class lost after reload",
  );
  await page.getByRole("button", { name: "Switch theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  assert(
    !(await page.evaluate(() => document.documentElement.classList.contains("dark"))),
    "light mode did not turn dark off",
  );
  await page.close();
});

await check("code block copy button copies the snippet", async () => {
  const page = await newPage(desktop);
  await page.goto(`${base}/getting-started/installation`, { waitUntil: "domcontentloaded" });
  const button = page.locator("button[data-copy]").first();
  await button.waitFor();
  const expected = await page
    .locator(".code-block")
    .first()
    .locator("pre code")
    .innerText();
  await button.click();
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.trim().length > 0, "clipboard is empty");
  assert(
    expected.includes(copied.trim()) || copied.trim().includes(expected.trim().slice(0, 24)),
    "clipboard does not match the snippet",
  );
  const label = await button.textContent();
  assert(label === "Copied", `copy button label not updated: ${label}`);
  await page.close();
});

await check("previous/next pagination navigates", async () => {
  const page = await newPage(desktop);
  await page.goto(`${base}/getting-started/installation`, { waitUntil: "domcontentloaded" });
  const next = page.locator("nav[aria-label='Pagination'] a").last();
  await next.click();
  await page.waitForURL("**/getting-started/first-app");
  await page.close();
});

await check("placeholder pages are marked as planned", async () => {
  const page = await newPage(desktop);
  await page.goto(`${base}/guides/databases`, { waitUntil: "domcontentloaded" });
  const alert = page.locator("[data-slot='alert']", { hasText: "Planned page" });
  await alert.waitFor();
  await page.close();
});

await check("hero terminal types the full command", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // Assert the VISUAL terminal (not the sr-only copy): the typed text must
  // reach the complete command, character for character.
  await page.waitForFunction(
    () => document.querySelector("[data-terminal]")?.textContent?.includes("bun run dev") ?? false,
    undefined,
    { timeout: 20000 },
  );
  const typed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-terminal] p"))
      .map((line) => line.textContent ?? "")
      .join("\n"),
  );
  assert(
    typed === "bunx --package @moonsjs/cli moons create my-app\ncd my-app\nbun run dev",
    `typed text incomplete: ${JSON.stringify(typed)}`,
  );
  await page.close();
});

await check("showcase morphs between server and client code", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const code = page.locator(".showcase-code");
  await code.waitFor();
  await page.waitForFunction(
    () => document.querySelector(".showcase-code")?.textContent?.includes("publishPost") ?? false,
    undefined,
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: /client call sites/ }).click();
  await page.waitForFunction(
    () => document.querySelector(".showcase-code")?.textContent?.includes("typed RPC stub") ?? false,
    undefined,
    { timeout: 6000 },
  );
  await page.getByRole("button", { name: /posts\.server\.ts/ }).click();
  await page.waitForFunction(
    () => document.querySelector(".showcase-code")?.textContent?.includes("serverFn") ?? false,
    undefined,
    { timeout: 6000 },
  );
  await page.close();
});

await check("verify card copies the command and celebrates", async () => {
  const page = await newPage(desktop);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const card = page.locator("[data-feature='One command to verify']");
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.click();
  await page.waitForTimeout(300);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.trim() === "bun run check", `clipboard: ${copied}`);
  const canvases = await page.locator("canvas").count();
  assert(canvases > 0, "confetti canvas did not appear");
  await page.close();
});

await check("no serious accessibility violations (axe)", async () => {
  const page = await newPage(desktop);
  const targets: Array<{ url: string; dark?: true }> = [
    { url: "/" },
    { url: "/", dark: true },
    { url: "/getting-started/installation" },
    { url: "/core-concepts/routing" },
    { url: "/guides/authentication" },
    { url: "/no-such-page" },
  ];
  const issues: string[] = [];
  for (const target of targets) {
    await page.goto(`${base}${target.url}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(450);
    if (target.dark === true) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    } else {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await page.waitForTimeout(250);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    for (const violation of results.violations) {
      if (violation.impact === "serious" || violation.impact === "critical") {
        issues.push(
          `${target.url}${target.dark === true ? " (dark)" : ""}: ${violation.id} x${violation.nodes.length}`,
        );
      }
    }
  }
  await page.close();
  assert(issues.length === 0, `axe: ${issues.join("; ")}`);
});

await check("404 page for unknown routes", async () => {
  const page = await newPage(desktop);
  const response = await page.goto(`${base}/no-such-page`, { waitUntil: "domcontentloaded" });
  assert(response !== null && response.status() === 404, `expected 404, got ${response?.status()}`);
  const h1 = await page.locator("h1").first().textContent();
  assert((h1 ?? "").includes("Page not found"), `unexpected 404 h1: ${h1}`);
  await page.close();
});

console.log("[smoke] mobile checks");
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });

await check("mobile sheet navigation opens, navigates, and closes", async () => {
  const page = await newPage(mobile);
  await page.goto(`${base}/core-concepts/routing`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = page.locator("[role='dialog']");
  await sheet.waitFor();
  await sheet.locator("a[href='/core-concepts/server-fn']").click();
  await page.waitForURL("**/core-concepts/server-fn");
  await page.waitForTimeout(300);
  const sheetVisible = await sheet.isVisible().catch(() => false);
  assert(!sheetVisible, "sheet stayed open after navigation");
  await page.close();
});

console.log("[smoke] static export + bundle hygiene");

await check("key pages exist as prerendered HTML", async () => {
  const hasPage = (slug: string): boolean =>
    existsSync(join(root, slug, "index.html")) || existsSync(join(root, `${slug}.html`));
  assert(existsSync(join(root, "index.html")), "missing dist/index.html");
  assert(existsSync(join(root, "404.html")), "missing dist/404.html");
  for (const slug of ["getting-started/installation", "core-concepts/server-fn", "architecture"]) {
    assert(hasPage(slug), `missing prerendered page: ${slug}`);
  }
});

await check("client bundle stays within the size budget", async () => {
  const assets = join(root, "assets");
  let total = 0;
  let biggest = { name: "", gzip: 0 };
  for (const name of readdirSync(assets)) {
    if (!name.endsWith(".js")) {
      continue;
    }
    const gzip = Bun.gzipSync(readFileSync(join(assets, name))).length;
    total += gzip;
    if (gzip > biggest.gzip) {
      biggest = { name, gzip };
    }
  }
  assert(
    biggest.gzip <= CHUNK_BUDGET_BYTES,
    `chunk ${biggest.name} is ${kb(biggest.gzip)} (chunk budget ${kb(CHUNK_BUDGET_BYTES)})`,
  );
  assert(
    total <= TOTAL_BUDGET_BYTES,
    `total client JS is ${kb(total)} (budget ${kb(TOTAL_BUDGET_BYTES)})`,
  );
  console.log(`       biggest chunk ${biggest.name} ${kb(biggest.gzip)} · total ${kb(total)}`);
});

await check("client bundles contain no canary or server-only content", async () => {
  const assets = join(root, "assets");
  assert(existsSync(assets), "dist/assets missing");
  for (const name of readdirSync(assets)) {
    if (!name.endsWith(".js")) {
      continue;
    }
    const source = readFileSync(join(assets, name), "utf8");
    assert(!source.includes(CANARY), `canary found in assets/${name}`);
    assert(!source.includes('"pages":{'), `content payload found in assets/${name}`);
    assert(!source.includes("prepare-content"), `content pipeline found in assets/${name}`);
  }
});

await browser.close();
await server.stop(true);

if (errors.length > 0) {
  console.error(`[smoke] uncaught page errors (${errors.length}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  failures += 1;
}

console.log(`[smoke] ${results.length - failures}/${results.length} checks passed`);
process.exit(failures > 0 ? 1 : 0);
