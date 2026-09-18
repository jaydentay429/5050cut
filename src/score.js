import { CONFIG } from "./config.js";

export function createScoreState() {
  return {
    total: 0,
    combo: 0,
    maxCombo: 0,
  };
}

/** 偏差 0 → 满分；达到 missDeviation → 0 分。中间按幂函数插值。 */
export function scoreFromDeviation(deviation) {
  const { missDeviation, curvePower, maxScore } = CONFIG.score;
  if (deviation >= missDeviation) return 0;
  const t = deviation / missDeviation;
  return Math.round(maxScore * (1 - t ** curvePower));
}

export function gradeFromScore(baseScore) {
  if (baseScore >= CONFIG.score.perfectScore) return "精准！";
  if (baseScore >= CONFIG.score.comboMinScore) return "漂亮";
  if (baseScore >= 70) return "还行";
  if (baseScore > 0) return "偏了";
  return "没切中";
}

export function rankFromRun(maxCombo, bestCut) {
  if (maxCombo >= 20 || (maxCombo >= 12 && bestCut >= 99)) return "传说";
  if (maxCombo >= 12) return "宗师";
  if (maxCombo >= 8 || bestCut >= 99) return "神刀";
  if (maxCombo >= 4) return "刀客";
  if (maxCombo >= 1) return "学徒";
  return "新刀";
}

export function comboTitle(combo) {
  if (combo >= 16) return "刀神降临";
  if (combo >= 12) return "停不下来";
  if (combo >= 8) return "热刀";
  if (combo >= 5) return "手感来了";
  if (combo >= 3) return "连上了";
  return "";
}

/**
 * 用这一刀的基础分更新总分和连击。
 * 连续 baseScore >= comboMinScore 才叠连击；连击从第 2 刀开始加分。
 */
export function applyCut(state, baseScore) {
  const combo =
    baseScore >= CONFIG.score.comboMinScore ? state.combo + 1 : 0;
  const stacks = Math.max(0, combo - 1);
  const gained = Math.round(
    baseScore * (1 + stacks * CONFIG.score.comboBonusPerStack),
  );

  return {
    total: state.total + gained,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    baseScore,
    gained,
  };
}
