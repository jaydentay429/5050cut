#!/usr/bin/env node
/**
 * Upload ./assets to an R2 bucket (keys keep the assets/ prefix).
 * Usage:
 *   R2_BUCKET=precise-cut-assets node scripts/upload-r2.mjs
 * Requires: npx wrangler login
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = process.env.R2_BUCKET || "precise-cut-assets";
const prefix = process.env.R2_PREFIX || "";

const types = {
  ".glb": "model/gltf-binary",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".hdr": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const next = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(next, out);
    else if (!ent.name.endsWith(".tmp.glb")) out.push(next);
  }
  return out;
}

const files = await walk(path.join(root, "assets"));
let ok = 0;
for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const key = `${prefix}${rel}`;
  const ext = path.extname(file).toLowerCase();
  const ct = types[ext] || "application/octet-stream";
  const result = spawnSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", file, "--content-type", ct],
    { stdio: "inherit", cwd: root },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  ok += 1;
}
console.log(`uploaded ${ok} files to r2://${bucket}`);
