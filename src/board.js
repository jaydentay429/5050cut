/**
 * 排行榜客户端。国家由服务端 IP 判定。
 */
import { applyDomLang, getLang, t } from "./i18n.js?v=148";
import { applyImportedSave, cleanBoardName, collectSave, decodeSaveCode, exportSaveFromData } from "./saveTransfer.js?v=6";

const NAMES = ["切客", "正中侠", "摊主", "半半", "果刀", "一刀准", "桌边人", "夜摊"];

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function loadBoardProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem("perfect-slice-board") || "null");
    if (raw && typeof raw === "object" && raw.id) {
      return {
        id: String(raw.id),
        name: String(raw.name || "").slice(0, 12) || defaultName(raw.id),
        titleId: String(raw.titleId || ""),
        country: String(raw.country || ""),
      };
    }
  } catch {
    /* ignore */
  }
  const id = randomId();
  const profile = { id, name: defaultName(id), titleId: "", country: "" };
  saveBoardProfile(profile);
  return profile;
}

export function saveBoardProfile(profile) {
  try {
    localStorage.setItem("perfect-slice-board", JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function defaultName(id) {
  const n = Number.parseInt(String(id).slice(-2), 16);
  const base = NAMES[Number.isFinite(n) ? n % NAMES.length : 0];
  return `${base}${String(id).slice(-3).toUpperCase()}`;
}

export { cleanBoardName };

export function isNamePromptOpen() {
  const root = document.getElementById("board-name");
  return Boolean(root && !root.hidden);
}

function selectElementText(el) {
  if (!el) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

function showIdStatus(statusEl, key) {
  if (!statusEl) return;
  statusEl.hidden = false;
  statusEl.textContent = t(key);
}

async function copyLeaderboardId(id, idEl, statusEl) {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("no-clipboard");
    }
    await navigator.clipboard.writeText(id);
    showIdStatus(statusEl, "nickIdCopied");
  } catch {
    selectElementText(idEl);
    showIdStatus(statusEl, "nickIdCopyManual");
  }
}

function coarsePointer() {
  try {
    return window.matchMedia?.("(pointer: coarse)")?.matches === true;
  } catch {
    return false;
  }
}

export function saveCopyManualKey(coarse = coarsePointer()) {
  return coarse ? "saveCopyManual" : "saveCopyManualFine";
}

const SAVE_ERR = {
  empty: "saveErrEmpty",
  prefix: "saveErrPrefix",
  incomplete: "saveErrIncomplete",
  checksum: "saveErrChecksum",
  version: "saveErrVersion",
  json: "saveErrJson",
  shape: "saveErrJson",
  key: "saveErrKey",
  type: "saveErrType",
  jsonValue: "saveErrType",
  boardId: "saveErrBoard",
  name: "saveErrName",
  title: "saveErrTitle",
  write: "saveErrWrite",
};

function showLine(el, message, isError = false) {
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
  el.classList.toggle("is-error", Boolean(message) && isError);
}

async function copyPlainText(text, field, statusEl, okKey, manualKey) {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("no-clipboard");
    }
    await navigator.clipboard.writeText(text);
    showLine(statusEl, t(okKey), false);
  } catch {
    if (field && typeof field.select === "function") {
      field.focus();
      field.select();
    } else {
      selectElementText(field);
    }
    showLine(statusEl, t(manualKey), true);
  }
}

export function saveErrorText(error, rolledBack) {
  if (error === "write" && rolledBack === false) return t("saveErrWriteKeep");
  return t(SAVE_ERR[error] || "saveErrJson");
}

export function promptBoardName(current) {
  const root = document.getElementById("board-name");
  const input = root?.querySelector("#board-name-input");
  const hint = root?.querySelector("[data-name-hint]");
  const form = root?.querySelector("[data-name-form]");
  const idEl = root?.querySelector("[data-board-id]");
  const copyBtn = root?.querySelector("[data-id-copy]");
  const statusEl = root?.querySelector("[data-id-status]");
  const exportBtn = root?.querySelector("[data-save-export]");
  const importBtn = root?.querySelector("[data-save-import]");
  const exportPanel = root?.querySelector("[data-export-panel]");
  const exportText = root?.querySelector("[data-export-text]");
  const exportCopy = root?.querySelector("[data-export-copy]");
  const exportShare = root?.querySelector("[data-export-share]");
  const exportStatus = root?.querySelector("[data-export-status]");
  const exportRename = root?.querySelector("[data-export-rename]");
  const importPanel = root?.querySelector("[data-import-panel]");
  const importText = root?.querySelector("[data-import-text]");
  const importGo = root?.querySelector("[data-import-go]");
  const importError = root?.querySelector("[data-import-error]");
  const importConfirm = root?.querySelector("[data-import-confirm]");
  const importYes = root?.querySelector("[data-import-yes]");
  const importNo = root?.querySelector("[data-import-no]");
  if (!root || !input) return Promise.resolve(null);
  if (!root.hidden) return Promise.resolve(null);

  const boardId = loadBoardProfile().id;
  let exportCode = "";
  let pendingImport = null;

  return new Promise((resolve) => {
    let done = false;
    const openedAt = performance.now();
    const finish = (value) => {
      if (done) return;
      done = true;
      document.body.classList.remove("overlay-open");
      root.hidden = true;
      root.removeEventListener("pointerdown", onGuard, true);
      root.removeEventListener("click", onBackdrop);
      form?.removeEventListener("submit", onSubmit);
      copyBtn?.removeEventListener("click", onCopy);
      exportBtn?.removeEventListener("click", onExport);
      importBtn?.removeEventListener("click", onImportOpen);
      exportCopy?.removeEventListener("click", onExportCopy);
      exportShare?.removeEventListener("click", onExportShare);
      importGo?.removeEventListener("click", onImportCheck);
      importYes?.removeEventListener("click", onImportYes);
      importNo?.removeEventListener("click", onImportNo);
      importText?.removeEventListener("input", onImportEdit);
      cancel?.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onCopy = (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyLeaderboardId(boardId, idEl, statusEl);
    };
    const hideRenameGuide = () => {
      if (!exportRename) return;
      exportRename.hidden = true;
      exportRename.textContent = "";
    };
    const onExport = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (exportPanel) exportPanel.hidden = false;
      hideRenameGuide();
      showLine(exportStatus, "", false);
      const result = exportSaveFromData(collectSave(localStorage));
      if (!result.ok) {
        exportCode = "";
        if (exportText) exportText.value = "";
        if (result.error === "name") {
          const message = t("saveExportRename");
          showLine(exportStatus, message, true);
          if (exportRename) {
            exportRename.hidden = false;
            exportRename.textContent = message;
          }
          input.focus();
          (exportRename || input).scrollIntoView({ block: "nearest" });
          return;
        }
        showLine(exportStatus, saveErrorText(result.error, true), true);
        return;
      }
      exportCode = result.code;
      if (exportText) exportText.value = exportCode;
      if (exportShare) exportShare.hidden = typeof navigator.share !== "function";
      showLine(exportStatus, result.titleCleared ? t("saveExportTitleGone") : "", false);
      exportPanel?.scrollIntoView({ block: "nearest" });
    };
    const onExportCopy = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!exportCode) return;
      copyPlainText(exportCode, exportText, exportStatus, "saveCopied", saveCopyManualKey());
    };
    const onExportShare = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!exportCode || typeof navigator.share !== "function") return;
      navigator.share({ text: exportCode }).catch((err) => {
        if (err && err.name === "AbortError") return;
        copyPlainText(exportCode, exportText, exportStatus, "saveCopied", saveCopyManualKey());
      });
    };
    const onImportOpen = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (importPanel) importPanel.hidden = false;
      pendingImport = null;
      if (importConfirm) importConfirm.hidden = true;
      showLine(importError, "", false);
      importPanel?.scrollIntoView({ block: "nearest" });
      importText?.focus();
    };
    const onImportEdit = () => {
      pendingImport = null;
      if (importConfirm) importConfirm.hidden = true;
    };
    const onImportCheck = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const decoded = decodeSaveCode(importText?.value || "");
      if (!decoded.ok) {
        pendingImport = null;
        if (importConfirm) importConfirm.hidden = true;
        showLine(importError, saveErrorText(decoded.error, true), true);
        return;
      }
      pendingImport = decoded.data;
      if (importConfirm) importConfirm.hidden = false;
      showLine(importError, "", false);
      importConfirm?.scrollIntoView({ block: "nearest" });
    };
    const onImportNo = (event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingImport = null;
      if (importConfirm) importConfirm.hidden = true;
    };
    const onImportYes = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pendingImport) return;
      const result = applyImportedSave(localStorage, pendingImport);
      if (!result.ok) {
        showLine(importError, saveErrorText(result.error, result.rolledBack), true);
        return;
      }
      window.location.reload();
    };
    const onGuard = (event) => event.stopPropagation();
    const onBackdrop = (event) => {
      if (performance.now() - openedAt < 500) return;
      if (event.target === root) finish(null);
    };
    const onCancel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };
    const onSave = () => {
      const name = cleanBoardName(input.value);
      if (!name) {
        if (hint) {
          hint.textContent = t("nickBad");
          hint.classList.add("is-error");
        }
        input.focus();
        return;
      }
      finish(name);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSave();
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish(null);
    };
    const cancel = root.querySelector("[data-name-cancel]");
    document.body.classList.add("overlay-open");
    applyDomLang();
    if (hint) {
      hint.textContent = t("nickBody");
      hint.classList.remove("is-error");
    }
    if (idEl) idEl.textContent = boardId;
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.classList.remove("is-error");
    }
    if (exportPanel) exportPanel.hidden = true;
    if (exportText) exportText.value = "";
    if (exportShare) exportShare.hidden = true;
    showLine(exportStatus, "", false);
    if (importPanel) importPanel.hidden = true;
    if (importText) importText.value = "";
    if (importConfirm) importConfirm.hidden = true;
    showLine(importError, "", false);
    input.value = current || "";
    root.hidden = false;
    root.addEventListener("pointerdown", onGuard, true);
    root.addEventListener("click", onBackdrop);
    form?.addEventListener("submit", onSubmit);
    copyBtn?.addEventListener("click", onCopy);
    exportBtn?.addEventListener("click", onExport);
    importBtn?.addEventListener("click", onImportOpen);
    exportCopy?.addEventListener("click", onExportCopy);
    exportShare?.addEventListener("click", onExportShare);
    importGo?.addEventListener("click", onImportCheck);
    importYes?.addEventListener("click", onImportYes);
    importNo?.addEventListener("click", onImportNo);
    importText?.addEventListener("input", onImportEdit);
    cancel?.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
    window.setTimeout(() => {
      input.focus();
    }, 120);
  });
}

export function isBoardOverlayOpen() {
  return isNamePromptOpen() || isTitlePromptOpen();
}

export function isTitlePromptOpen() {
  const root = document.getElementById("board-title");
  return Boolean(root && !root.hidden);
}

export function promptBoardTitle(choices, currentId) {
  const root = document.getElementById("board-title");
  const list = root?.querySelector("[data-title-list]");
  const empty = root?.querySelector("[data-title-empty]");
  if (!root || !list) return Promise.resolve(null);
  if (!root.hidden) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const openedAt = performance.now();
    const finish = (value) => {
      if (done) return;
      done = true;
      document.body.classList.remove("overlay-open");
      root.hidden = true;
      root.removeEventListener("click", onBackdrop);
      none?.removeEventListener("click", onNone);
      cancel?.removeEventListener("click", onCancel);
      resolve(value);
    };
    const onBackdrop = (event) => {
      if (performance.now() - openedAt < 500) return;
      if (event.target === root) finish(null);
    };
    const onCancel = () => finish(null);
    const onNone = () => finish("");
    const none = root.querySelector("[data-title-none]");
    const cancel = root.querySelector("[data-title-cancel]");
    list.replaceChildren();
    const rows = choices || [];
    if (empty) empty.hidden = rows.length > 0;
    for (const row of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = row.title;
      if (row.id === currentId) button.classList.add("on");
      button.addEventListener("click", () => finish(row.id));
      list.appendChild(button);
    }
    applyDomLang();
    document.body.classList.add("overlay-open");
    root.hidden = false;
    root.addEventListener("click", onBackdrop);
    none?.addEventListener("click", onNone);
    cancel?.addEventListener("click", onCancel);
  });
}

function countryLabel(code) {
  if (!code || code === "UN") return t("unknown");
  try {
    const loc = getLang() === "en" ? ["en"] : getLang() === "zh-Hans" ? ["zh-CN", "zh", "en"] : ["zh-Hant", "zh", "en"];
    const names = new Intl.DisplayNames(loc, { type: "region" });
    return names.of(code) || code;
  } catch {
    return code;
  }
}

export async function fetchBoard(scope, id) {
  const q = new URLSearchParams({ scope, id });
  const res = await fetch(`/api/board?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("board");
  const data = await res.json();
  data.countryName = countryLabel(data.country);
  data.rows = (data.rows || []).map((row) => ({
    ...row,
    countryName: countryLabel(row.country),
  }));
  if (data.me) data.me.countryName = countryLabel(data.me.country);
  return data;
}

export async function submitBoardScore(profile, score) {
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: profile.id,
      name: profile.name,
      titleId: profile.titleId || "",
      score,
    }),
  });
  if (!res.ok) throw new Error("submit");
  return res.json();
}
