#!/usr/bin/env node
/** Copy a Pages-ready tree to ./dist (no node_modules, no git). */
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const LIMIT = 25 * 1024 * 1024;

async function walk(dir, out = []) {
  const { readdir } = await import("node:fs/promises");
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const next = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(next, out);
    else out.push(next);
  }
  return out;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const copies = [
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "style.css",
  "privacy.html",
  "about.html",
  "contact.html",
  "terms.html",
  "pages.css",
  "ads.txt",
  "favicon.svg",
  "_headers",
  "_redirects",
  "functions",
  "src",
  "vendor",
  "assets",
  "guide",
  "faq.html",
  "llms.txt",
];
for (const name of copies) {
  const from = path.join(root, name);
  try {
    await stat(from);
  } catch {
    continue;
  }
  await cp(from, path.join(dist, name), {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (base === "studio_small_03_1k.hdr") return false;
      if (base.endsWith(".tmp.glb")) return false;
      return true;
    },
  });
}

const oversize = [];
for (const file of await walk(dist)) {
  const n = (await stat(file)).size;
  if (n > LIMIT) oversize.push({ file: path.relative(dist, file), mb: (n / 1e6).toFixed(1) });
}
if (oversize.length) {
  console.error("Pages rejects files over 25 MiB. Put these on R2 and set ASSET_BASE:");
  for (const row of oversize) console.error(`  ${row.mb}MB  ${row.file}`);
  process.exit(1);
}

const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
if (!locs.length) {
  console.error("sitemap.xml has no <loc> entries");
  process.exit(1);
}
const missing = [];
for (const loc of locs) {
  let url;
  try {
    url = new URL(loc);
  } catch {
    missing.push(`${loc} (not a URL)`);
    continue;
  }
  if (url.origin !== "https://5050cut.com") {
    missing.push(`${loc} (unexpected origin)`);
    continue;
  }
  const pathname = url.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    missing.push(`${loc} (trailing slash)`);
    continue;
  }
  const rel = pathname === "/" ? "index.html" : `${pathname.replace(/^\//, "")}.html`;
  if (rel.includes("..") || path.isAbsolute(rel)) {
    missing.push(`${loc} (bad path)`);
    continue;
  }
  try {
    const info = await stat(path.join(dist, rel));
    if (!info.isFile()) missing.push(`${loc} -> ${rel} (not a file)`);
    else console.log(`sitemap ok: ${loc} -> ${rel}`);
  } catch {
    missing.push(`${loc} -> ${rel}`);
  }
}
if (missing.length) {
  console.error("sitemap URLs must match an .html file in the Pages output:");
  for (const row of missing) console.error(`  ${row}`);
  process.exit(1);
}

try {
  const llms = await stat(path.join(dist, "llms.txt"));
  if (!llms.isFile()) throw new Error("not a file");
  console.log("packed llms.txt", llms.size);
} catch {
  console.error("llms.txt must be copied into the Pages output");
  process.exit(1);
}

console.log("packed", dist);
