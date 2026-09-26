import assert from "node:assert/strict";
import test from "node:test";
import { saveErrorText } from "./board.js";
import { setLang, t } from "./i18n.js?v=145";
import {
  BACKUP_KEY,
  BOARD_KEY,
  applyImportedSave,
  collectSave,
  decodeSaveCode,
  encodeSaveCode,
  exportSaveFromData,
  fnv1a64Hex,
  withSaveBackup,
} from "./saveTransfer.js";

const ID = "ab".repeat(12);
const NOW = new Date("2026-09-26T00:00:00.000Z");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}

function sampleData() {
  return {
    "perfect-slice-high-score": "42",
    "perfect-slice-muted": "0",
    "perfect-slice-codex": JSON.stringify({ apple: { cuts: 2, best: 100 } }),
    "perfect-slice-economy": JSON.stringify({
      tokens: 7,
      inventory: { retry: 1, guide: 0, summon: 0 },
      lastShareByChannel: { fb: "", x: "", threads: "" },
      lastSummonSecretDay: "",
    }),
    "perfect-slice-achievements": JSON.stringify({
      unlocked: { first_cut: 1 },
      stats: { bestCombo: 3, maxWorlds: 1, perfects: 0, highPerfect: 0 },
    }),
    [BOARD_KEY]: JSON.stringify({
      id: ID,
      name: "切客·阿明",
      titleId: "combo_5",
      country: "JP",
    }),
    "perfect-slice-lang": "zh-Hans",
  };
}

test("fnv1a64 of empty bytes is the offset basis", () => {
  assert.equal(fnv1a64Hex(new Uint8Array()), "cbf29ce484222325");
});

test("encode and decode round-trip Chinese nicknames", () => {
  const data = sampleData();
  const code = encodeSaveCode(data, NOW);
  assert.ok(code.startsWith("5050CUT1:"));
  assert.equal(code.includes("+"), false);
  assert.equal(code.includes("/"), false);
  const decoded = decodeSaveCode(code);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.exportedAt, NOW.toISOString());
  assert.deepEqual(decoded.data, data);
  assert.equal(JSON.parse(decoded.data[BOARD_KEY]).name, "切客·阿明");
});

test("whitespace around a code is ignored", () => {
  const code = encodeSaveCode(sampleData(), NOW);
  const wrapped = `${code.slice(0, 20)}\n${code.slice(20)}`;
  assert.equal(decodeSaveCode(`  ${wrapped}  `).ok, true);
});

test("empty, wrong prefix, and a one-character edit fail closed", () => {
  assert.deepEqual(decodeSaveCode(""), { ok: false, error: "empty" });
  assert.deepEqual(decodeSaveCode("   "), { ok: false, error: "empty" });
  const code = encodeSaveCode(sampleData(), NOW);
  assert.equal(decodeSaveCode(code.replace("5050CUT1:", "5050CUT2:")).error, "prefix");
  const chars = [...code];
  const at = code.indexOf(":") + 3;
  chars[at] = chars[at] === "A" ? "B" : "A";
  assert.equal(decodeSaveCode(chars.join("")).error, "checksum");
});

test("version, foreign keys, non-strings, bad JSON, and board id are rejected", () => {
  const good = sampleData();
  const pack = (payload) => {
    const b64 = encodeSaveCode(good, NOW).slice("5050CUT1:".length).split(".")[0];
    void b64;
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const n of bytes) bin += String.fromCharCode(n);
    const encoded = btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
    const sum = fnv1a64Hex(new TextEncoder().encode(encoded));
    return `5050CUT1:${encoded}.${sum}`;
  };
  assert.equal(decodeSaveCode(pack({ v: 2, exportedAt: NOW.toISOString(), data: good })).error, "version");
  assert.equal(
    decodeSaveCode(pack({ v: 1, exportedAt: NOW.toISOString(), data: { ...good, "perfect-slice-backup": "{}" } })).error,
    "key",
  );
  assert.equal(
    decodeSaveCode(pack({ v: 1, exportedAt: NOW.toISOString(), data: { "perfect-slice-high-score": 42 } })).error,
    "type",
  );
  assert.equal(
    decodeSaveCode(pack({ v: 1, exportedAt: NOW.toISOString(), data: { "perfect-slice-codex": "{no" } })).error,
    "jsonValue",
  );
  const badBoard = { ...good, [BOARD_KEY]: JSON.stringify({ id: "abc", name: "切客" }) };
  assert.equal(decodeSaveCode(pack({ v: 1, exportedAt: NOW.toISOString(), data: badBoard })).error, "boardId");
});

test("collectSave skips the backup key", () => {
  const storage = memoryStorage({
    ...sampleData(),
    [BACKUP_KEY]: JSON.stringify({ savedAt: NOW.toISOString(), data: { "perfect-slice-high-score": "1" } }),
    "unrelated": "keep",
  });
  const data = collectSave(storage);
  assert.equal(Object.hasOwn(data, BACKUP_KEY), false);
  assert.equal(Object.hasOwn(data, "unrelated"), false);
  assert.equal(data["perfect-slice-high-score"], "42");
});

test("import replaces save keys, keeps one backup, and does not write when invalid", () => {
  const storage = memoryStorage({
    "perfect-slice-high-score": "1",
    "perfect-slice-muted": "1",
    "unrelated": "stay",
  });
  const rejected = applyImportedSave(storage, { "perfect-slice-nope": "x" }, NOW);
  assert.equal(rejected.ok, false);
  assert.equal(storage.getItem("perfect-slice-high-score"), "1");
  assert.equal(storage.getItem(BACKUP_KEY), null);

  const next = { "perfect-slice-high-score": "9", "perfect-slice-lang": "en" };
  const applied = applyImportedSave(storage, next, NOW);
  assert.equal(applied.ok, true);
  assert.equal(storage.getItem("perfect-slice-high-score"), "9");
  assert.equal(storage.getItem("perfect-slice-muted"), null);
  assert.equal(storage.getItem("perfect-slice-lang"), "en");
  assert.equal(storage.getItem("unrelated"), "stay");
  const backup = JSON.parse(storage.getItem(BACKUP_KEY));
  assert.equal(backup.savedAt, NOW.toISOString());
  assert.deepEqual(backup.data, { "perfect-slice-high-score": "1", "perfect-slice-muted": "1" });
  assert.equal(Object.hasOwn(backup.data, BACKUP_KEY), false);

  applyImportedSave(storage, { "perfect-slice-muted": "0" }, NOW);
  const latest = JSON.parse(storage.getItem(BACKUP_KEY));
  assert.equal(latest.data["perfect-slice-high-score"], "9");
  const backupKeys = Object.keys(storage.dump()).filter((key) => key === BACKUP_KEY || key.startsWith(`${BACKUP_KEY}-`));
  assert.deepEqual(backupKeys, [BACKUP_KEY]);
});

test("a failed write rolls back to the backup snapshot", () => {
  const storage = memoryStorage(sampleData());
  const original = storage.getItem("perfect-slice-high-score");
  let armed = false;
  let hits = 0;
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (armed && key === "perfect-slice-lang" && hits++ === 0) throw new Error("quota");
    setItem(key, value);
  };
  const result = withSaveBackup(storage, () => {
    armed = true;
    storage.setItem("perfect-slice-high-score", "99");
    storage.setItem("perfect-slice-lang", "en");
  }, NOW);
  assert.deepEqual(result, { ok: false, error: "write", rolledBack: true });
  assert.equal(storage.getItem("perfect-slice-high-score"), original);
  assert.equal(storage.getItem("perfect-slice-lang"), "zh-Hans");
  const backup = JSON.parse(storage.getItem(BACKUP_KEY));
  assert.equal(backup.data["perfect-slice-high-score"], original);
});

function codeFor(data) {
  const json = JSON.stringify({ v: 1, exportedAt: NOW.toISOString(), data });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const n of bytes) bin += String.fromCharCode(n);
  const encoded = btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  const sum = fnv1a64Hex(new TextEncoder().encode(encoded));
  return `5050CUT1:${encoded}.${sum}`;
}

const FIELD_COPY = {
  name: {
    "zh-Hans": "昵称不合法",
    "zh-Hant": "暱稱不合法",
    en: "Nickname is not valid",
  },
  title: {
    "zh-Hans": "头衔不合法",
    "zh-Hant": "頭銜不合法",
    en: "Title is not valid",
  },
};

function assertFieldNamed(error) {
  for (const [lang, needle] of Object.entries(FIELD_COPY[error])) {
    setLang(lang);
    const text = saveErrorText(error, true);
    assert.equal(text.includes(needle), true, `${lang} ${error}: ${text}`);
  }
}

test("hand-edited nickname and title are rejected and the save is unchanged", () => {
  const board = JSON.parse(sampleData()[BOARD_KEY]);
  const cases = [
    ["name", { ...board, name: "一二三四五六七八九十一二三" }],
    ["name", { ...board, name: "<img src=x onerror=alert(1)>" }],
    ["title", { ...board, titleId: "<img src=x onerror=alert(1)>" }],
    ["name", { ...board, name: "切\u0001客" }],
  ];
  const storage = memoryStorage(sampleData());
  const before = structuredClone(storage.dump());
  for (const [error, nextBoard] of cases) {
    const data = { ...sampleData(), [BOARD_KEY]: JSON.stringify(nextBoard) };
    const decoded = decodeSaveCode(codeFor(data));
    assert.equal(decoded.ok, false);
    assert.equal(decoded.error, error);
    assertFieldNamed(error);
    const applied = applyImportedSave(storage, data, NOW);
    assert.equal(applied.ok, false);
    assert.equal(applied.error, error);
    assert.deepEqual(storage.dump(), before);
    assert.equal(storage.getItem(BACKUP_KEY), before[BACKUP_KEY] ?? null);
  }
});

test("an old title is cleared only in the exported code and then imports", () => {
  const data = sampleData();
  const board = JSON.parse(data[BOARD_KEY]);
  board.titleId = "retired_blade";
  data[BOARD_KEY] = JSON.stringify(board);
  const stored = data[BOARD_KEY];
  const exported = exportSaveFromData(data, NOW);
  assert.equal(exported.ok, true);
  assert.equal(exported.titleCleared, true);
  assert.equal(data[BOARD_KEY], stored);
  for (const [lang, needle] of Object.entries({
    "zh-Hans": "旧头衔已失效，已清空",
    "zh-Hant": "舊頭銜已失效，已清空",
    en: "no longer valid and was cleared",
  })) {
    setLang(lang);
    assert.equal(t("saveExportTitleGone").includes(needle), true, t("saveExportTitleGone"));
  }
  const decoded = decodeSaveCode(exported.code);
  assert.equal(decoded.ok, true);
  assert.equal(JSON.parse(decoded.data[BOARD_KEY]).titleId, "");
  assert.equal(JSON.parse(decoded.data[BOARD_KEY]).name, "切客·阿明");
  const storage = memoryStorage({ "perfect-slice-high-score": "1" });
  const applied = applyImportedSave(storage, decoded.data, NOW);
  assert.equal(applied.ok, true);
  assert.equal(JSON.parse(storage.getItem(BOARD_KEY)).titleId, "");
  assert.equal(storage.getItem("perfect-slice-high-score"), "42");
});

test("old nicknames are blocked until the name is legal, then export and import", () => {
  const badNames = ["刀", "一二三四五六七八九十一二三", "切客@"];
  for (const name of badNames) {
    const data = sampleData();
    const board = JSON.parse(data[BOARD_KEY]);
    board.name = name;
    data[BOARD_KEY] = JSON.stringify(board);
    const blocked = exportSaveFromData(data, NOW);
    assert.equal(blocked.ok, false, name);
    assert.equal(blocked.error, "name");
    assert.equal(blocked.code, undefined);
    assert.equal(data[BOARD_KEY].includes(name), true);
    board.name = "切客·阿明";
    data[BOARD_KEY] = JSON.stringify(board);
    const exported = exportSaveFromData(data, NOW);
    assert.equal(exported.ok, true);
    assert.equal(exported.titleCleared, false);
    const decoded = decodeSaveCode(exported.code);
    assert.equal(decoded.ok, true);
    const storage = memoryStorage({ "perfect-slice-high-score": "1" });
    const applied = applyImportedSave(storage, decoded.data, NOW);
    assert.equal(applied.ok, true);
    assert.equal(JSON.parse(storage.getItem(BOARD_KEY)).name, "切客·阿明");
  }
  for (const [lang, needle] of Object.entries({
    "zh-Hans": "请先改下面的昵称，再导出",
    "zh-Hant": "請先改下面的暱稱，再匯出",
    en: "Change the name below, then export",
  })) {
    setLang(lang);
    assert.equal(t("saveExportRename").includes(needle), true, t("saveExportRename"));
  }
});

test("a normally exported save code validates and imports", () => {
  const data = sampleData();
  const decoded = decodeSaveCode(encodeSaveCode(data, NOW));
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.data, data);
  const storage = memoryStorage({
    "perfect-slice-high-score": "1",
    [BOARD_KEY]: JSON.stringify({ id: "cd".repeat(12), name: "临时号", titleId: "", country: "" }),
  });
  const before = structuredClone(storage.dump());
  const applied = applyImportedSave(storage, decoded.data, NOW);
  assert.equal(applied.ok, true);
  assert.equal(storage.getItem("perfect-slice-high-score"), "42");
  assert.equal(JSON.parse(storage.getItem(BOARD_KEY)).name, "切客·阿明");
  assert.equal(JSON.parse(storage.getItem(BOARD_KEY)).titleId, "combo_5");
  const backup = JSON.parse(storage.getItem(BACKUP_KEY));
  assert.deepEqual(backup.data, before);
});

test("backup write failure does not change the save", () => {
  const storage = memoryStorage({ "perfect-slice-high-score": "4" });
  storage.setItem = (key) => {
    if (key === BACKUP_KEY) throw new Error("quota");
  };
  let mutated = false;
  const result = withSaveBackup(storage, () => {
    mutated = true;
  }, NOW);
  assert.equal(result.rolledBack, true);
  assert.equal(mutated, false);
  assert.equal(storage.getItem("perfect-slice-high-score"), "4");
});
