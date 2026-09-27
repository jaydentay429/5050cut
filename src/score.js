import { t } from "./i18n.js?v=148";
import { CONFIG } from "./config.js?v=105";

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
  if (baseScore >= CONFIG.score.perfectScore) return t("gradePerfect");
  if (baseScore >= CONFIG.score.comboMinScore) return t("gradeNice");
  if (baseScore >= 70) return t("gradeOk");
  if (baseScore > 0) return t("gradeOff");
  return t("gradeMiss");
}

export function rankFromRun(maxCombo, bestCut) {
  if (maxCombo >= 20 || (maxCombo >= 12 && bestCut >= 99)) return t("rankLegend");
  if (maxCombo >= 12) return t("rankMaster");
  if (maxCombo >= 8 || bestCut >= 99) return t("rankGod");
  if (maxCombo >= 4) return t("rankGuest");
  if (maxCombo >= 1) return t("rankPupil");
  return t("newBlade");
}

export function comboTitle(combo) {
  if (combo >= 16) return t("combo16");
  if (combo >= 12) return t("combo12");
  if (combo >= 8) return t("combo8");
  if (combo >= 5) return t("combo5");
  if (combo >= 3) return t("combo3");
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
