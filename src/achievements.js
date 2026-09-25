/**
 * 成就目录。解锁条件只读快照，发币在 Game.flushAchievements。
 */
import { CONFIG } from "./config.js?v=91";
import { getItem } from "./worlds.js?v=96";
import { hasGrandTrophy, stallTrophy } from "./progress.js";

export const ACHIEVEMENTS = [
  { id: "first_cut", title: "第一刀", hint: "切开任意一件", tokens: 1, test: (s) => s.unlockedCount >= 1 },
  { id: "combo_5", title: "手感来了", hint: "连击达到 5", tokens: 1, test: (s) => s.bestCombo >= 5 },
  { id: "combo_10", title: "停不下来", hint: "连击达到 10", tokens: 2, test: (s) => s.bestCombo >= 10 },
  { id: "combo_25", title: "热刀不歇", hint: "连击达到 25", tokens: 4, test: (s) => s.bestCombo >= 25 },
  { id: "combo_50", title: "一气呵成", hint: "连击达到 50", tokens: 8, test: (s) => s.bestCombo >= 50 },
  { id: "combo_100", title: "百连成神", hint: "连击达到 100", tokens: 16, test: (s) => s.bestCombo >= 100 },
  { id: "score_500", title: "小试牛刀", hint: "单局满分累计 1000", tokens: 1, test: (s) => s.highPerfect >= 1000 },
  { id: "score_2000", title: "千刀入账", hint: "单局满分累计 5000", tokens: 3, test: (s) => s.highPerfect >= 5000 },
  { id: "score_5000", title: "摊位常客", hint: "单局满分累计 10000", tokens: 6, test: (s) => s.highPerfect >= 10000 },
  { id: "score_12000", title: "一刀传城", hint: "单局满分累计 25000", tokens: 12, test: (s) => s.highPerfect >= 25000 },
  { id: "score_25000", title: "史册留名", hint: "单局满分累计 50000", tokens: 20, test: (s) => s.highPerfect >= 50000 },
  { id: "perfect", title: "正中红心", hint: "一次切出 100 分", tokens: 1, test: (s) => s.perfects >= 1 },
  { id: "collect_10", title: "见多识广", hint: "图鉴解锁 10 件", tokens: 2, test: (s) => s.unlockedCount >= 10 },
  { id: "collect_30", title: "收藏家", hint: "图鉴解锁 30 件", tokens: 4, test: (s) => s.unlockedCount >= 30 },
  { id: "collect_100", title: "百刀入册", hint: "图鉴解锁 100 件", tokens: 12, test: (s) => s.unlockedCount >= (s.catalogTotal || 100) },
  { id: "first_rare", title: "小隐藏", hint: "切开一件小隐藏", tokens: 2, test: (s) => s.rares >= 1 },
  { id: "first_secret", title: "大隐藏", hint: "切开一件大隐藏", tokens: 5, test: (s) => s.secrets >= 1 },
  { id: "stall_seen", title: "逛完一摊", hint: "任一摊十件都切过", tokens: 3, test: (s) => s.stallSeen >= 1 },
  { id: "stall_bronze", title: "铜杯", hint: "任一摊全员 85 分", tokens: 5, test: (s) => s.stallBronze >= 1 },
  { id: "stall_bronze_all", title: "十摊铜杯", hint: "十摊都拿到铜杯", tokens: 12, test: (s) => s.stallBronze >= CONFIG.themes.order.length },
  { id: "stall_gold", title: "金杯", hint: "任一摊全员 100 分", tokens: 10, test: (s) => s.stallGold >= 1 },
  { id: "grand", title: "刀神", hint: "十摊都拿到金杯", tokens: 28, test: (s) => s.grand },
  { id: "worlds_3", title: "连逛三摊", hint: "单局进入第 3 摊", tokens: 2, test: (s) => s.worlds >= 3 },
  { id: "worlds_10", title: "环城一圈", hint: "单局走过十摊", tokens: 8, test: (s) => s.worlds >= CONFIG.themes.order.length },
];

export function achievementSnapshot({
  highScore = 0,
  runScore = 0,
  bestCombo = 0,
  worlds = 1,
  unlockedCount = 0,
  catalogTotal = 100,
  codex = {},
  perfects = 0,
  highPerfect = 0,
} = {}) {
  let rares = 0;
  let secrets = 0;
  for (const id of CONFIG.themes.order) {
    for (const type of CONFIG.themes[id].objects) {
      if ((codex?.[type]?.cuts || 0) <= 0) continue;
      const rarity = getItem(type).rarity || "common";
      if (rarity === "rare") rares += 1;
      if (rarity === "secret") secrets += 1;
    }
  }
  const trophies = CONFIG.themes.order.map((id) => stallTrophy(codex, id));
  return {
    highScore,
    runScore,
    bestCombo,
    worlds,
    unlockedCount,
    catalogTotal,
    rares,
    secrets,
    stallSeen: trophies.filter((t) => t === "seen" || t === "bronze" || t === "gold").length,
    stallBronze: trophies.filter((t) => t === "bronze" || t === "gold").length,
    stallGold: trophies.filter((t) => t === "gold").length,
    grand: hasGrandTrophy(codex),
    perfects,
    highPerfect,
  };
}

export function pendingAchievements(unlocked, snapshot) {
  return ACHIEVEMENTS.filter((row) => !unlocked[row.id] && row.test(snapshot));
}
