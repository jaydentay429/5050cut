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
