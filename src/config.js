/** 所有可调数值集中放这里，后续打磨手感只改这一份。 */
import { catalogSpec, themeBlock } from "./worlds.js?v=96";

export const CONFIG = {
  backgroundColor: "#1c1712",
  showCanvasSize: false,
  /** 生产把模型放到 R2 时填写，例如 https://cdn.yourdomain.com 。本地留空。 */
  assetBase: "",
  /** 仅调试：局内图鉴全开。正式站保持 false；本地可用 ?codex=all。 */
  unlockAllCodex: false,

  scene: {
    fov: 32,
    near: 0.1,
    far: 80,
    cameraPos: [0.62, 2.12, 5.15],
    lookAt: [0, 0.32, 0],
    /** 水果摊实拍：铺满画面，略上移让空桌对齐物品。 */
    stallCover: 1.16,
    stallLift: -0.38,
    tableY: 0.02,
    fruitZ: 0,
    fruitScreenLift: 0.08,
    /** 桌上苹果最长边（世界单位）。其它物品 = 这个值 × realScale。 */
    fruitAppleLength: 0.52,
    fruitScaleMin: 0.16,
    fruitScaleMax: 2.4,
    /** 保证物体长轴在竖屏里也能完整入画。 */
    fitMargin: 1.45,
    fogNear: 18,
    fogFar: 48,
    maxPixelRatio: 1.5,
    baseLength: 2.45,
    minLength: 0.95,
    boardSize: [6.2, 0.1, 3.2],
    boardColor: "#3a2b1e",
    groundColor: "#1a1510",
    hemiSky: "#fff3e0",
    hemiGround: "#3a2a1c",
    hemiIntensity: 1.05,
    sunColor: "#fff0dd",
    sunIntensity: 1.95,
    sunPos: [-3.2, 6.2, 4.4],
    dropHeight: 0.85,
    dropDuration: 0.38,
    heroPos: [1.15, 0.72, 2.35],
  },

  object: {
    /** 每切一刀，下一刀基础长度乘这个系数（再叠加随机抖动）。 */
    shrinkPerCut: 0.97,
    widthJitter: 0.08,
    /** 连击越高，下一刀略短，压力上来。 */
    comboShorten: 0.028,
    comboShortenCap: 0.22,
  },

  catalog: catalogSpec(),
  themes: themeBlock(),

  cut: {
    minStrokeLength: 28,
    minChordLength: 18,
  },

  orbit: {
    yawPerPx: 0.008,
    pitchPerPx: 0.006,
    /** 右边转盘：滑一点就要明显转起来。 */
    padYawPerPx: 0.024,
    padPitchPerPx: 0.02,
  },

  score: {
    maxScore: 100,
    /** |切面位置 - 正中| 达到或超过此值 → 0 分。正中是 0，边缘是 0.5。 */
    missDeviation: 0.36,
    /** 越大越苛刻（靠近边缘掉分更快）。1 = 线性，2 = 中间更宽容。 */
    curvePower: 1.35,
    comboMinScore: 85,
    comboBonusPerStack: 0.12,
    perfectScore: 98,
  },

  economy: {
    /** 8 件常见合计约 95%，小隐藏约 3%，大隐藏约 1%。无保底。今日摊 ×2。 */
    weight: { common: 16, rare: 4, secret: 1 },
    dailyRareBoost: 2,
    tokenStreak98: 10,
    tokenStreak98Reward: 1,
    tokenStreak100: 12,
    tokenStreak100Reward: 1,
    shareTokens: 2,
    adTokens: 3,
    prices: { retry: 5, guide: 2, summon: 10, summonSecret: 15 },
    collectionMax: 10000,
  },

  feedback: {
    duration: 0.82,
    perfectDuration: 1.12,
    breakDuration: 1.28,
    slowMoScale: 0.34,
    /** 两半分开距离 = 物体沿切线方向尺寸 × 这个比例。 */
    splitGapShare: 0.1,
    splitDistance: 0.34,
    splitTilt: 0.1,
    splitYaw: 0.52,
    perfectSplitBoost: 1.4,
    popupPeakScale: 1.35,
    shake: 0.045,
    perfectShake: 0.08,
    gravity: 9.4,
    splitKick: 0.52,
    splitPop: 0.58,
    bounce: 0.16,
    slowMoBody: 0.58,
  },

  audio: {
    master: 0.7,
    music: 0.75,
    ambient: 0.03,
  },

  ui: {
    title: "对半切",
    subtitle: "画面上直接划刀。右边滑动，转动物品。",
    cream: "#f3e6d0",
    creamDim: "rgba(243, 230, 208, 0.55)",
    accent: "#e07a3d",
    accentDown: "#c45f28",
    buttonText: "#2a1c12",
    hudShadow: "rgba(0, 0, 0, 0.45)",
    menuOverlay: "rgba(16, 12, 9, 0.28)",
    /** 划刀线宽。会按物品屏幕大小再缩。 */
    strokeLive: 2.35,
    strokeCut: 1.85,
    strokeMark: 1.7,
  },
};
