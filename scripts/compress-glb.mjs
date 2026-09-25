#!/usr/bin/env node
/**
 * Restore originals first (npm run restore-glb), then this.
 * Resize textures + Draco. Does not strip vertices, so shapes stay.
 * Files under 1.2MB have no original backup and are left as-is.
 */
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune, textureCompress, weld } from "@gltf-transform/functions";
import draco3d from "draco3d";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelsDir = path.join(root, "assets", "models");
const SIZE = Number(process.env.GLB_TEXTURE_SIZE || 1024);

async function listGlbs(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const next = path.join(dir, ent.name);
    if (ent.isDirectory()) await listGlbs(next, out);
    else if (ent.name.endsWith(".glb")) out.push(next);
  }
  return out;
}

async function compressOne(io, file) {
  const before = (await stat(file)).size;
  if (before < 1_200_000) {
    return { file, before, after: before, skipped: true };
  }
  const tmp = `${file}.tmp.glb`;
  const document = await io.read(file);
  await document.transform(
    dedup(),
    weld(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [SIZE, SIZE],
      quality: 84,
    }),
    prune(),
    draco(),
  );
  await io.write(tmp, document);
  const after = (await stat(tmp)).size;
  if (after >= before * 0.98) {
    await rm(tmp, { force: true });
    return { file, before, after: before, skipped: true };
  }
  await rename(tmp, file);
  return { file, before, after, skipped: false };
}

const files = (await listGlbs(modelsDir)).sort();
const only = process.argv.slice(2);
const targets = only.length
  ? files.filter((f) => only.some((q) => f.includes(q)))
  : files;
if (!targets.length) {
  console.error("no glb matched");
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

let saved = 0;
let bytesIn = 0;
let bytesOut = 0;
for (const file of targets) {
  const rel = path.relative(root, file);
  try {
    const r = await compressOne(io, file);
    bytesIn += r.before;
    bytesOut += r.after;
    saved += r.before - r.after;
    const pct = ((1 - r.after / r.before) * 100).toFixed(0);
    console.log(
      `${r.skipped ? "keep" : "ok  "} ${pct.padStart(3)}%  ${(r.after / 1e6).toFixed(2)}MB  ${rel}`,
    );
  } catch (err) {
    console.error("fail", rel, err.message || err);
    await rm(`${file}.tmp.glb`, { force: true });
  }
}
console.log(
  `done ${targets.length} files, ${(bytesIn / 1e6).toFixed(1)}MB → ${(bytesOut / 1e6).toFixed(1)}MB, saved ${(saved / 1e6).toFixed(1)}MB`,
);
