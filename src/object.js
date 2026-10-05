import { CONFIG } from "./config.js?v=105";
import { axisLength } from "./shapeProfile.js?v=86";
import { dailyThemeId, ITEMS } from "./worlds.js?v=102";
import { isModelReady } from "./fruitAssets.js?v=127";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function themeAt(index) {
  const order = CONFIG.themes.order;
  const id = order[((index % order.length) + order.length) % order.length];
  return { id, ...CONFIG.themes[id] };
}

export function pickObjectType(themeId, previous, forcedType, preferReady = false) {
  const objects = CONFIG.themes[themeId]?.objects || CONFIG.themes.fruit.objects;
  if (forcedType && objects.includes(forcedType)) return forcedType;
  const daily = dailyThemeId() === themeId;
  const boost = daily ? CONFIG.economy.dailyRareBoost : 1;
  const readyOnly = preferReady ? objects.filter((type) => type !== previous && isModelReady(type)) : [];
  const pool = readyOnly.length ? readyOnly : objects;
  const weights = objects.map((type) => {
    if (!pool.includes(type)) return 0;
    if (type === previous) return 0;
    const rarity = ITEMS[type]?.rarity || "common";
    let weight = CONFIG.economy.weight[rarity] ?? CONFIG.economy.weight.common;
    if (rarity !== "common") weight *= boost;
    return weight;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    const pool = objects.filter((type) => type !== previous);
    const list = pool.length ? pool : objects;
    return list[Math.floor(Math.random() * list.length)];
  }
  let roll = Math.random() * total;
  for (let i = 0; i < objects.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return objects[i];
  }
  return objects[objects.length - 1];
}

export function lengthForRound(type, round, combo = 0, themeIndex = 0) {
  const shrink = CONFIG.object.shrinkPerCut ** Math.min(round, 16);
  const jitter = 1 + (Math.random() * 2 - 1) * CONFIG.object.widthJitter;
  const heat = 1 - Math.min(CONFIG.object.comboShortenCap, combo * CONFIG.object.comboShorten);
  const world = 1 - Math.min(0.16, themeIndex * 0.028);
  const requested = clamp(
    CONFIG.scene.baseLength * shrink * jitter * heat * world,
    CONFIG.scene.minLength,
    CONFIG.scene.baseLength,
  );
  return axisLength(type, requested);
}

export function catalogTypes() {
  const list = [];
  for (const id of CONFIG.themes.order) {
    for (const type of CONFIG.themes[id].objects) {
      if (!list.includes(type)) list.push(type);
    }
  }
  return list;
}

export function themeIdForType(type) {
  for (const id of CONFIG.themes.order) {
    if (CONFIG.themes[id].objects.includes(type)) return id;
  }
  return CONFIG.themes.order[0];
}

export function displayLength(type) {
  return axisLength(type, CONFIG.scene.baseLength);
}

export const TYPE_LABELS = Object.fromEntries(
  Object.entries(ITEMS).map(([id, item]) => [id, item.label || id]),
);

export function themeTrail() {
  return CONFIG.themes.order.map((id) => CONFIG.themes[id].name).join("  →  ");
}
