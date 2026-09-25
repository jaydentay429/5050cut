import { CONFIG } from "./config.js?v=91";

/** Local: `./assets/...`. Production: `https://cdn.example.com/assets/...`. */
export function assetUrl(rel) {
  const path = String(rel || "").replace(/^\.\//, "");
  const raw =
    (typeof window !== "undefined" && window.ASSET_BASE) || CONFIG.assetBase || "";
  const base = String(raw).replace(/\/$/, "");
  if (!base) return `./${path}`;
  return `${base}/${path}`;
}
