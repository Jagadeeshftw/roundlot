// Writes content/docs/_updated.json: each page's last commit date, for the
// "Last updated" line. Run before building (deploys don't carry git history).
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";

const dir = new URL("../content/docs/", import.meta.url);
const out = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".mdx")).sort()) {
  const date = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: dir, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--", file], { cwd: dir, encoding: "utf8" }).trim();
  out[file.replace(/\.mdx$/, "")] = (dirty || !date ? new Date().toISOString() : date).slice(0, 10);
}
writeFileSync(new URL("_updated.json", dir), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${Object.keys(out).length} dates`);
