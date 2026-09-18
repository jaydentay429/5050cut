import { CONFIG } from "./config.js";
import { axisLength } from "./shapeProfile.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function themeAt(index) {
  const order = CONFIG.themes.order;
  const id = order[((index % order.length) + order.length) % order.length];
  return { id, ...CONFIG.themes[id] };
}

export function pickObjectType(themeId, previous) {
  const objects = CONFIG.themes[themeId]?.objects || CONFIG.themes.fruit.objects;
  if (!previous) return objects[0];
  const pool = objects.filter((type) => type !== previous);
  const list = pool.length ? pool : objects;
  return list[Math.floor(Math.random() * list.length)];
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

export const TYPE_LABELS = {
  apple: "苹果",
  pear: "梨",
  orange: "橙子",
  banana: "香蕉",
  strawberry: "草莓",
  lemon: "柠檬",
  rose: "玫瑰",
  tulip: "郁金香",
  daisy: "雏菊",
  pencil: "铅笔",
  eraser: "橡皮",
  crayon: "蜡笔",
  ruler: "尺子",
  carrot: "胡萝卜",
  cucumber: "黄瓜",
  corn: "玉米",
  eggplant: "茄子",
  cake: "蛋糕",
  bread: "面包",
  cheese: "芝士",
  onigiri: "饭团",
  sunflower: "向日葵",
  lollipop: "棒棒糖",
  chocolate: "巧克力",
  macaron: "马卡龙",
  popsicle: "冰棒",
};

export function themeTrail() {
  return CONFIG.themes.order.map((id) => CONFIG.themes[id].name).join("  →  ");
}
