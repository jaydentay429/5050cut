#!/usr/bin/env node
/**
 * Weld + meshopt simplify (keeps UVs) + Draco.
 * Target ~60k triangles per file. Run after restore-glb when originals exist.
 */
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune, simplify, weld } from "@gltf-transform/functions";
import draco3d from "draco3d";
import { MeshoptSimplifier } from "meshoptimizer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelsDir = path.join(root, "assets", "models");
const TARGET_TRIS = Number(process.env.GLB_TARGET_TRIS || 60000);

async function listGlbs(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const next = path.join(dir, ent.name);
    if (ent.isDirectory()) await listGlbs(next, out);
    else if (ent.name.endsWith(".glb")) out.push(next);
  }
  return out;
}

function triCount(document) {
  let n = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      if (indices) n += indices.getCount() / 3;
      else if (pos) n += pos.getCount() / 3;
    }
  }
  return n;
}

async function simplifyOne(io, file) {
  const beforeSize = (await stat(file)).size;
  const document = await io.read(file);
  const beforeTris = triCount(document);
  if (beforeTris <= TARGET_TRIS * 1.15) {
    return { file, beforeSize, afterSize: beforeSize, beforeTris, afterTris: beforeTris, skipped: true };
  }
  const ratio = Math.min(1, TARGET_TRIS / beforeTris);
  await document.transform(
    dedup(),
    weld({ overwrite: true }),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio,
      error: 0.01,
      lockBorder: false,
    }),
    prune(),
    draco(),
  );
  const afterTris = triCount(document);
  const tmp = `${file}.tmp.glb`;
  await io.write(tmp, document);
  const afterSize = (await stat(tmp)).size;
  await rename(tmp, file);
  return { file, beforeSize, afterSize, beforeTris, afterTris, skipped: false };
}

await MeshoptSimplifier.ready;

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

for (const file of targets) {
  const rel = path.relative(root, file);
  try {
    const r = await simplifyOne(io, file);
    const tag = r.skipped ? "skip" : "ok  ";
    console.log(
      `${tag} ${Math.round(r.beforeTris)}→${Math.round(r.afterTris)} tris  ${(r.afterSize / 1e6).toFixed(2)}MB  ${rel}`,
    );
  } catch (err) {
    console.error("fail", rel, err.message || err);
    await rm(`${file}.tmp.glb`, { force: true });
  }
}
