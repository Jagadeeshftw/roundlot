// Screenshot gate: every page at desktop 1440 and mobile 390, light and dark.
// Usage: BASE_URL=http://localhost:3001 node scripts/screenshots.mjs [paths...]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const out = process.env.OUT_DIR ?? "screenshots";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/docs", "/docs/quickstart", "/docs/quote"];
const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];
const themes = ["light", "dark"];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const path of paths) {
  for (const vp of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile ?? false,
        deviceScaleFactor: vp.deviceScaleFactor ?? 1,
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto(base + path, { waitUntil: "load" });
      await page.waitForTimeout(2500); // let entrance motion finish
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) {
        console.error(`OVERFLOW ${path} ${vp.name} ${theme}: page is ${overflow}px wider than the viewport`);
        process.exitCode = 1;
      }
      const name = `${path === "/" ? "home" : path.replace(/^\//, "").replaceAll("/", "-")}-${vp.name}-${theme}.jpg`;
      await page.screenshot({ path: `${out}/${name}`, fullPage: true, type: "jpeg", quality: 70 });
      console.log(`${out}/${name}`);
      await context.close();
    }
  }
}
await browser.close();
