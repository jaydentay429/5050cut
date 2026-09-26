import { CONFIG } from "./config.js?v=105";

export const TROPHY_LABEL = {
  seen: "摊位章",
  bronze: "铜杯",
  gold: "金杯",
  grand: "刀神",
};

export function collectionScore(codex) {
  let sum = 0;
  for (const id of CONFIG.themes.order) {
    for (const type of CONFIG.themes[id].objects) {
      sum += Math.max(0, Math.min(100, Number(codex?.[type]?.best) || 0));
    }
  }
  return sum;
}

export function stallTrophy(codex, themeId) {
  const objects = CONFIG.themes[themeId]?.objects || [];
  if (!objects.length) return null;
  const allCut = objects.every((type) => (codex?.[type]?.cuts || 0) > 0);
  const all85 = objects.every((type) => (codex?.[type]?.best || 0) >= 85);
  const all100 = objects.every((type) => (codex?.[type]?.best || 0) >= 100);
  if (all100) return "gold";
  if (all85) return "bronze";
  if (allCut) return "seen";
  return null;
}

export function hasGrandTrophy(codex) {
  return CONFIG.themes.order.every((id) => stallTrophy(codex, id) === "gold");
}

export function stallStars(codex, themeId) {
  const objects = CONFIG.themes[themeId]?.objects || [];
  return objects.map((type) => {
    const best = Number(codex?.[type]?.best) || 0;
    const cuts = Number(codex?.[type]?.cuts) || 0;
    if (best >= 100) return 3;
    if (best >= 85) return 2;
    if (cuts > 0) return 1;
    return 0;
  });
}

export function unlockedStallIds(codex) {
  return CONFIG.themes.order.filter((id) =>
    CONFIG.themes[id].objects.some((type) => (codex?.[type]?.cuts || 0) > 0),
  );
}
