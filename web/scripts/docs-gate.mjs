// Docs quality gate: every docs page at 1440 and 390 in light and dark
// (screenshots + no sideways scroll), Previous/Next order = sidebar order,
// every internal link and anchor resolves, and search works at both widths.
// Usage: BASE_URL=http://localhost:3001 OUT_DIR=screenshots/docs node scripts/docs-gate.mjs
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const out = process.env.OUT_DIR ?? "screenshots/docs";
const shots = process.env.NO_SHOTS !== "1";
const nav = await readFile(new URL("../lib/docs-nav.ts", import.meta.url), "utf8");
const slugs = [...nav.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
const href = (s) => (s === "index" ? "/docs" : `/docs/${s}`);
let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL", msg); };

await mkdir(out, { recursive: true });
const browser = await chromium.launch();

// 1. Screenshots and overflow
for (const slug of slugs) {
  for (const vp of [{ n: "1440", w: 1440, h: 900 }, { n: "390", w: 390, h: 844, mobile: true }]) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile, deviceScaleFactor: 1, colorScheme: theme });
      const page = await ctx.newPage();
      const res = await page.goto(base + href(slug), { waitUntil: "load" });
      if (res?.status() !== 200) fail(`${slug} HTTP ${res?.status()}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) fail(`${slug} ${vp.n} ${theme}: ${overflow}px sideways scroll`);
      // Text that spills out of a hint or table cell without scrolling the page.
      const spill = await page.evaluate(() =>
        [...document.querySelectorAll("#content [role=note], #content td, #content p, #content li")]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible")
          .map((el) => el.textContent.slice(0, 40)),
      );
      if (spill.length) fail(`${slug} ${vp.n} ${theme}: text spills out of ${spill.length} block(s): ${JSON.stringify(spill[0])}`);
      if (shots) await page.screenshot({ path: `${out}/${slug}-${vp.n}-${theme}.jpg`, fullPage: true, type: "jpeg", quality: 60 });
      await ctx.close();
    }
  }
}
console.log(`pages: ${slugs.length}, screenshots: ${shots ? slugs.length * 4 : 0}`);

// 2. Previous / Next follow the sidebar order; links and anchors resolve
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const internal = new Set();
for (const [i, slug] of slugs.entries()) {
  await page.goto(base + href(slug), { waitUntil: "load" });
  const pn = await page.$$eval('nav[aria-label="Previous and next pages"] a', (as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })));
  const expectPrev = i > 0 ? href(slugs[i - 1]) : undefined;
  const expectNext = i < slugs.length - 1 ? href(slugs[i + 1]) : undefined;
  const got = pn.map((l) => l.href);
  const want = [expectPrev, expectNext].filter(Boolean);
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${slug} prev/next ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
  const links = await page.$$eval("#content a[href], nav[aria-label='On this page'] a[href]", (as) => as.map((a) => a.getAttribute("href")));
  for (const l of links) if (l.startsWith("/") || l.startsWith("#")) internal.add(l.startsWith("#") ? `${href(slug)}${l}` : l);
}
for (const l of internal) {
  const [path, anchor] = l.split("#");
  const res = await page.goto(base + path, { waitUntil: "load" });
  if (res?.status() !== 200) { fail(`link ${l} HTTP ${res?.status()}`); continue; }
  if (anchor && !(await page.$(`[id="${anchor}"]`))) fail(`link ${l}: no #${anchor}`);
}
console.log(`internal links checked: ${internal.size}`);
await ctx.close();

// 3. Search at both widths: shortcut or button opens it, typing finds pages,
//    arrow keys + Enter navigate
for (const vp of [{ n: "1440", w: 1440, h: 900 }, { n: "390", w: 390, h: 844, mobile: true }]) {
  const c = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile });
  const p = await c.newPage();
  await p.goto(base + "/docs/quote", { waitUntil: "load" });
  if (vp.mobile) await p.getByRole("button", { name: "Search docs" }).last().click();
  else await p.keyboard.press("Control+k");
  const input = p.getByRole("dialog", { name: "Search docs" }).getByRole("searchbox");
  await input.waitFor({ timeout: 3000 }).catch(() => fail(`search ${vp.n}: dialog did not open`));
  await input.fill("slippage");
  const n = await p.getByRole("option").count();
  if (!n) fail(`search ${vp.n}: no results for "slippage"`);
  await input.press("ArrowDown");
  await input.press("Enter");
  await p.waitForURL((u) => !u.pathname.endsWith("/docs/quote") || u.hash !== "", { timeout: 5000 }).catch(() => fail(`search ${vp.n}: Enter did not navigate`));
  console.log(`search ${vp.n}: ${n} results, opened ${new URL(p.url()).pathname}${new URL(p.url()).hash}`);
  await c.close();
}

await browser.close();
console.log(failures ? `${failures} failure(s)` : "docs gate: all checks passed");
process.exit(failures ? 1 : 0);
