#!/usr/bin/env node
/** Copy original Tripo GLBs from Downloads back into assets/models. */
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = process.env.GLB_ORIGINALS || path.join(process.env.HOME, "Downloads", "small game item glb");
const map = JSON.parse(await readFile(path.join(root, "scripts", "restore-glb-map.json"), "utf8"));
map["fruit/mango"] = path.join(srcDir, "mango 3d model.glb");

let ok = 0;
const missing = [];
for (const [rel, name] of Object.entries(map)) {
  const from = path.isAbsolute(name) ? name : path.join(srcDir, name);
  const id = rel.split("/")[1];
  const dest = path.join(root, "assets", "models", rel, `${id}.glb`);
  try {
    await stat(from);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(from, dest);
    const n = (await stat(dest)).size;
    console.log("ok", (n / 1e6).toFixed(2) + "MB", rel);
    ok += 1;
  } catch {
    missing.push(rel);
    console.error("miss", rel, name);
  }
}
console.log(`restored ${ok}, missing ${missing.length}${missing.length ? ": " + missing.join(", ") : ""}`);
