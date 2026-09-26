/**
 * 存档码与备份。不碰 DOM。
 * 格式：5050CUT1: + base64url(UTF-8 JSON) + "." + FNV-1a 64 位十六进制。
 * JSON：{ v:1, exportedAt, data:{ 白名单键: 原始字符串 } }
 * 备份键不进存档码，避免 localStorage 里叠多份备份。
 * 昵称必须已经是改名弹窗 cleanBoardName 的结果；头衔必须是空或成就 id。否则整份拒绝。
 */
import { ACHIEVEMENTS } from "./achievements.js?v=140";

export const CODE_PREFIX = "5050CUT1:";
export const BACKUP_KEY = "perfect-slice-backup";
export const BOARD_KEY = "perfect-slice-board";

export const SAVE_KEYS = [
  "perfect-slice-high-score",
  "perfect-slice-muted",
  "perfect-slice-codex",
  "perfect-slice-economy",
  "perfect-slice-achievements",
  BOARD_KEY,
  "perfect-slice-lang",
];

const JSON_KEYS = new Set([
  "perfect-slice-codex",
  "perfect-slice-economy",
  "perfect-slice-achievements",
  BOARD_KEY,
]);

const SAVE_KEY_SET = new Set(SAVE_KEYS);
const BOARD_ID_RE = /^[0-9a-fA-F]{24}$/;
const NAME_RE = /^[\p{L}\p{N} _.\-·]{2,12}$/u;
const TITLE_IDS = new Set(ACHIEVEMENTS.map((row) => row.id));

export function cleanBoardName(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (!NAME_RE.test(name)) return null;
  if (/https?:|www\.|@/i.test(name)) return null;
  return name;
}
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

export function fnv1a64Hex(bytes) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= BigInt(bytes[i]);
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

function boardProfileError(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) return "boardId";
  if (typeof board.id !== "string" || !BOARD_ID_RE.test(board.id)) return "boardId";
  if (typeof board.name !== "string" || cleanBoardName(board.name) !== board.name) return "name";
  if (board.titleId != null && board.titleId !== "") {
    if (typeof board.titleId !== "string" || !TITLE_IDS.has(board.titleId)) return "title";
  }
  return "";
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function base64UrlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error("b64");
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function collectSave(storage) {
  const data = {};
  for (const key of SAVE_KEYS) {
    const value = storage.getItem(key);
    if (typeof value === "string") data[key] = value;
  }
  return data;
}

export function validateSaveData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "shape" };
  const parsed = {};
  for (const key of Object.keys(data)) {
    if (!SAVE_KEY_SET.has(key)) return { ok: false, error: "key" };
    if (typeof data[key] !== "string") return { ok: false, error: "type" };
    if (!JSON_KEYS.has(key)) continue;
    try {
      parsed[key] = JSON.parse(data[key]);
    } catch {
      return { ok: false, error: "jsonValue" };
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, BOARD_KEY)) {
    const board = parsed[BOARD_KEY];
    const profileError = boardProfileError(board);
    if (profileError) return { ok: false, error: profileError };
  }
  return { ok: true };
}

export function encodeSaveCode(data, now = new Date()) {
  const check = validateSaveData(data);
  if (!check.ok) throw new Error(check.error);
  const payload = {
    v: 1,
    exportedAt: now.toISOString(),
    data,
  };
  const b64 = base64UrlEncode(utf8(JSON.stringify(payload)));
  const sum = fnv1a64Hex(utf8(b64));
  return `${CODE_PREFIX}${b64}.${sum}`;
}

export function exportSaveFromData(data, now = new Date()) {
  const check = validateSaveData(data);
  if (check.ok) return { ok: true, code: encodeSaveCode(data, now), titleCleared: false };
  if (check.error !== "title") return { ok: false, error: check.error };
  const board = JSON.parse(data[BOARD_KEY]);
  const cleared = { ...data, [BOARD_KEY]: JSON.stringify({ ...board, titleId: "" }) };
  const again = validateSaveData(cleared);
  if (!again.ok) return { ok: false, error: again.error };
  return { ok: true, code: encodeSaveCode(cleared, now), titleCleared: true };
}

export function decodeSaveCode(raw) {
  const text = String(raw ?? "").replace(/\s+/g, "");
  if (!text) return { ok: false, error: "empty" };
  if (!text.startsWith(CODE_PREFIX)) return { ok: false, error: "prefix" };
  const body = text.slice(CODE_PREFIX.length);
  const dot = body.lastIndexOf(".");
  if (dot <= 0 || dot === body.length - 1) return { ok: false, error: "prefix" };
  const b64 = body.slice(0, dot);
  const sum = body.slice(dot + 1);
  let expected = "";
  try {
    expected = fnv1a64Hex(utf8(b64));
  } catch {
    return { ok: false, error: "checksum" };
  }
  if (sum.toLowerCase() !== expected) return { ok: false, error: "checksum" };
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(b64)));
  } catch {
    return { ok: false, error: "json" };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, error: "shape" };
  if (payload.v !== 1) return { ok: false, error: "version" };
  if (typeof payload.exportedAt !== "string" || !payload.exportedAt) return { ok: false, error: "shape" };
  const check = validateSaveData(payload.data);
  if (!check.ok) return check;
  return { ok: true, exportedAt: payload.exportedAt, data: payload.data };
}

function rollbackCollected(storage, prev) {
  for (const key of SAVE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(prev, key)) storage.setItem(key, prev[key]);
    else storage.removeItem(key);
  }
}

export function withSaveBackup(storage, mutate, now = new Date()) {
  const prev = collectSave(storage);
  try {
    storage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: now.toISOString(), data: prev }));
  } catch {
    return { ok: false, error: "write", rolledBack: true };
  }
  try {
    mutate(storage);
    return { ok: true };
  } catch {
    try {
      rollbackCollected(storage, prev);
      return { ok: false, error: "write", rolledBack: true };
    } catch {
      return { ok: false, error: "write", rolledBack: false };
    }
  }
}

export function applyImportedSave(storage, data, now = new Date()) {
  const check = validateSaveData(data);
  if (!check.ok) return { ...check, rolledBack: true };
  return withSaveBackup(storage, (target) => {
    for (const key of SAVE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) target.setItem(key, data[key]);
      else target.removeItem(key);
    }
  }, now);
}
