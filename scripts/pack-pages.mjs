#!/usr/bin/env node
/** Copy a Pages-ready tree to ./dist (no node_modules, no git). */
import { cp, mkdir, rm, stat } from "node:fs/promises";
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
  "favicon.svg",
  "_headers",
  "_redirects",
  "src",
  "vendor",
  "assets",
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
console.log("packed", dist);
