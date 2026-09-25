/** 存档入口。现在用 localStorage；换平台时只改这几个函数内部。 */

const HIGH_SCORE_KEY = "perfect-slice-high-score";
const MUTED_KEY = "perfect-slice-muted";
const CODEX_KEY = "perfect-slice-codex";

function readNumber(key, fallback) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // 隐私模式 / 存储配额不足时静默失败
  }
}

export function saveHighScore(score) {
  writeValue(HIGH_SCORE_KEY, score);
}

export function loadHighScore() {
  return readNumber(HIGH_SCORE_KEY, 0);
}

export function saveMuted(muted) {
  writeValue(MUTED_KEY, muted ? "1" : "0");
}

export function loadMuted() {
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export function loadCodex() {
  try {
    const raw = JSON.parse(localStorage.getItem(CODEX_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  } catch {
    return {};
  }
}

export function unlockCodexEntry(type, score) {
  const data = loadCodex();
  const prev = data[type] || { cuts: 0, best: 0 };
  const first = prev.cuts === 0;
  data[type] = {
    cuts: prev.cuts + 1,
    best: Math.max(prev.best || 0, score),
  };
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
  return { data, first };
}

const ECONOMY_KEY = "perfect-slice-economy";

function emptyEconomy() {
  return {
    tokens: 0,
    inventory: { retry: 0, guide: 0, summon: 0 },
    lastShareByChannel: { fb: "", x: "", threads: "" },
    lastSummonSecretDay: "",
  };
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function loadEconomy() {
  const base = emptyEconomy();
  try {
    const raw = JSON.parse(localStorage.getItem(ECONOMY_KEY) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
    return {
      tokens: Math.max(0, Number(raw.tokens) || 0),
      inventory: {
        retry: Math.max(0, Number(raw.inventory?.retry) || 0),
        guide: Math.max(0, Number(raw.inventory?.guide) || 0),
        summon: Math.max(0, Number(raw.inventory?.summon) || 0),
      },
      lastShareByChannel: {
        fb: String(raw.lastShareByChannel?.fb || ""),
        x: String(raw.lastShareByChannel?.x || ""),
        threads: String(raw.lastShareByChannel?.threads || ""),
      },
      lastSummonSecretDay: String(raw.lastSummonSecretDay || ""),
    };
  } catch {
    return base;
  }
}

export function saveEconomy(data) {
  try {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const ACHIEVE_KEY = "perfect-slice-achievements";

function emptyAchievements() {
  return {
    unlocked: {},
    stats: { bestCombo: 0, maxWorlds: 0, perfects: 0, highPerfect: 0 },
  };
}

export function loadAchievements() {
  const base = emptyAchievements();
  try {
    const raw = JSON.parse(localStorage.getItem(ACHIEVE_KEY) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
    const unlocked = raw.unlocked && typeof raw.unlocked === "object" && !Array.isArray(raw.unlocked) ? raw.unlocked : {};
    return {
      unlocked,
      stats: {
        bestCombo: Math.max(0, Number(raw.stats?.bestCombo) || 0),
        maxWorlds: Math.max(0, Number(raw.stats?.maxWorlds) || 0),
        perfects: Math.max(0, Number(raw.stats?.perfects) || 0),
        highPerfect: Math.max(0, Number(raw.stats?.highPerfect) || 0),
      },
    };
  } catch {
    return base;
  }
}

export function saveAchievements(data) {
  try {
    localStorage.setItem(ACHIEVE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
