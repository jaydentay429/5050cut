import { CONFIG } from "./config.js?v=91";

/** Local: `/assets/...`. Production: `https://cdn.example.com/assets/...`. */
export function assetUrl(rel) {
  const path = String(rel || "").replace(/^\.\//, "");
  const raw =
    (typeof window !== "undefined" && window.ASSET_BASE) || CONFIG.assetBase || "";
  const base = String(raw).replace(/\/$/, "");
  // Root-absolute so models, textures, and HDR still resolve when the
  // document URL is not `/` and when unknown paths return 404.
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}
