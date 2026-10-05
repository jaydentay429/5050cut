/**
 * 无头浏览器检查改名弹窗里的导出 / 导入。
 * 拦截 /api/board，不访问 5050cut.com。
 *
 *   NODE_PATH=$(npm root -g) 不行时：
 *   node scripts/save-transfer-browser.mjs
 *   （需要本机可 import playwright，并用已安装的 Chrome）
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { decodeSaveCode } from "../src/saveTransfer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = "/opt/cursor/artifacts/screenshots";
const ID = "ab".repeat(12);

const seed = {
  "perfect-slice-high-score": "42",
  "perfect-slice-muted": "1",
  "perfect-slice-codex": JSON.stringify({ apple: { cuts: 1, best: 90 } }),
  "perfect-slice-economy": JSON.stringify({
    tokens: 7,
    inventory: { retry: 1, guide: 0, summon: 0 },
    lastShareByChannel: { fb: "", x: "", threads: "" },
    lastSummonSecretDay: "",
  }),
  "perfect-slice-achievements": JSON.stringify({
    unlocked: { first_cut: 1 },
    stats: { bestCombo: 1, maxWorlds: 1, perfects: 0, highPerfect: 0 },
  }),
  "perfect-slice-board": JSON.stringify({
    id: ID,
    name: "切客·阿明",
    titleId: "combo_5",
    country: "JP",
  }),
  "perfect-slice-lang": "zh-Hans",
};

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function harnessHtml() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf('<div id="board-name"');
  const end = html.indexOf('<script type="module"');
  if (start < 0 || end < start) throw new Error("rename dialog markup missing");
  const block = html.slice(start, end).trim();
  return `<!DOCTYPE html>
<html lang="zh-Hans">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>save transfer harness</title>
    <link rel="stylesheet" href="/style.css?v=14" />
    <style>
      html, body { overflow: hidden !important; }
    </style>
  </head>
  <body>
    <div id="stage">
      <canvas id="scene"></canvas>
      <canvas id="game"></canvas>
    </div>
    <main id="about">
      <h1>50/50 Cut</h1>
      <p>
        Swipe through the center of the object to cut it in half. If the middle is hard to judge, drag the pad on the right to turn the object, then cut.
      </p>
      <p>
        A slice through the exact center scores 100. The farther the cut sits from the middle, the lower the score, and a cut too far off center scores nothing.
      </p>
    </main>
    ${block}
    <script>
      window.__errors = [];
      window.addEventListener("error", (event) => {
        window.__errors.push(String(event.message || event));
      });
    </script>
    <script type="module">
      import { promptBoardName } from "/src/board.js?v=18";
      import { layoutButtons } from "/src/ui.js?v=152";
      const scene = document.getElementById("scene");
      scene.width = window.innerWidth;
      scene.height = window.innerHeight;
      const paint = scene.getContext("2d");
      paint.fillStyle = "#0055ff";
      paint.fillRect(0, 0, scene.width, scene.height);
      const mute = document.createElement("div");
      mute.id = "mute-standin";
      mute.textContent = "静音";
      mute.style.cssText = "position:fixed;z-index:2;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:#3a2418;color:#f3e6d0;border:2px solid #e07a3d;border-radius:999px;font:700 14px sans-serif;pointer-events:auto;";
      document.body.appendChild(mute);
      window.__placeMute = () => {
        const box = layoutButtons(window.innerWidth, window.innerHeight, "menu", true).mute;
        mute.style.left = box.x + "px";
        mute.style.top = box.y + "px";
        mute.style.width = box.w + "px";
        mute.style.height = box.h + "px";
        return { x: box.x, y: box.y, w: box.w, h: box.h };
      };
      window.__placeMute();
      window.addEventListener("resize", () => window.__placeMute());
      window.__openName = () => promptBoardName("本地新名字");
      document.documentElement.dataset.ready = "1";
    </script>
  </body>
</html>`;
}

function startServer() {
  const page = harnessHtml();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/harness.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page);
      return;
    }
    const file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function stable(dump) {
  return JSON.stringify(Object.fromEntries(Object.keys(dump).sort().map((key) => [key, dump[key]])));
}

async function dumpStorage(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      out[key] = localStorage.getItem(key);
    }
    return out;
  });
}

async function openDialog(page) {
  const ready = await Promise.race([
    page.waitForFunction(() => document.documentElement.dataset.ready === "1").then(() => "ready"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 8000)),
  ]);
  if (ready !== "ready") {
    const info = await page.evaluate(() => ({
      ready: document.documentElement.dataset.ready || "",
      html: document.body ? document.body.innerHTML.slice(0, 500) : "",
      errors: window.__errors || [],
    })).catch((err) => ({ evalError: String(err) }));
    throw new Error(`dialog not ready ${JSON.stringify(info)}`);
  }
  await page.evaluate(() => {
    void window.__openName();
  });
  await page.waitForSelector("#board-name:not([hidden])", { timeout: 8000 });
  await page.waitForFunction(() => (document.querySelector("[data-board-id]")?.textContent || "").length === 24, { timeout: 8000 });
}

async function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const card = document.querySelector("#board-name .ad-consent-card");
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`page overflow ${doc.scrollWidth}>${doc.clientWidth}`);
    if (card.scrollWidth > card.clientWidth + 1) problems.push(`card overflow ${card.scrollWidth}>${card.clientWidth}`);
    const cardBox = card.getBoundingClientRect();
    const nodes = [...card.querySelectorAll("button, input, textarea, .board-id, .board-key-warn, .board-name-label, .board-id-status, .ad-consent-body")].filter((el) => {
      if (el.closest("[hidden]")) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    for (const el of nodes) {
      const box = el.getBoundingClientRect();
      const name = el.getAttribute("data-i18n") || el.id || el.getAttribute("data-board-id") || el.className;
      if (box.left < cardBox.left - 1 || box.right > cardBox.right + 1) {
        problems.push(`horizontal ${name} ${Math.round(box.left)}-${Math.round(box.right)} card ${Math.round(cardBox.left)}-${Math.round(cardBox.right)}`);
      }
      if ((el.matches("button") || el.matches("input") || el.matches("textarea")) && box.height < 32) {
        problems.push(`short ${name} h=${Math.round(box.height)}`);
      }
    }
    const interactive = nodes.filter((el) => el.matches("button, input, textarea"));
    for (let i = 0; i < interactive.length; i += 1) {
      for (let j = i + 1; j < interactive.length; j += 1) {
        const a = interactive[i].getBoundingClientRect();
        const b = interactive[j].getBoundingClientRect();
        const overlap = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        if (!overlap) continue;
        const an = interactive[i].getAttribute("data-i18n") || interactive[i].id;
        const bn = interactive[j].getAttribute("data-i18n") || interactive[j].id;
        problems.push(`overlap ${an} ${bn}`);
      }
    }
    return problems;
  });
}

async function assertMuteClear(page) {
  const report = await page.evaluate(() => {
    const muteBox = window.__placeMute();
    const card = document.querySelector("#board-name .ad-consent-card");
    card.scrollTop = card.scrollHeight;
    const cardBox = card.getBoundingClientRect();
    const mute = document.getElementById("mute-standin").getBoundingClientRect();
    const problems = [];
    const buttons = [...card.querySelectorAll("button")].filter((el) => {
      if (el.closest("[hidden]")) return false;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    for (const el of buttons) {
      const box = el.getBoundingClientRect();
      const visible = {
        left: Math.max(box.left, cardBox.left, 0),
        right: Math.min(box.right, cardBox.right, window.innerWidth),
        top: Math.max(box.top, cardBox.top, 0),
        bottom: Math.min(box.bottom, cardBox.bottom, window.innerHeight),
      };
      if (visible.right - visible.left < 8 || visible.bottom - visible.top < 8) continue;
      const name = el.getAttribute("data-i18n") || el.id || "button";
      const samples = [
        [(visible.left + visible.right) / 2, (visible.top + visible.bottom) / 2],
        [visible.left + 6, (visible.top + visible.bottom) / 2],
        [Math.min(visible.right - 4, mute.left + mute.width / 2), (visible.top + visible.bottom) / 2],
      ];
      for (const [x, y] of samples) {
        if (x < visible.left || x > visible.right || y < visible.top || y > visible.bottom) continue;
        const hit = document.elementFromPoint(x, y);
        const covered = hit && (hit.id === "mute-standin" || hit.closest("#mute-standin"));
        if (covered || !hit || (hit !== el && !el.contains(hit))) {
          problems.push(`mute covers ${name} at ${Math.round(x)},${Math.round(y)} hit ${hit && (hit.id || hit.className)}`);
        }
      }
    }
    return { problems, mute: muteBox };
  });
  if (report.problems.length) throw new Error(report.problems.join("\n"));
  return report.mute;
}

async function assertClickable(page) {
  const problems = await page.evaluate(() => {
    const problems = [];
    const nodes = [...document.querySelectorAll("#board-name button, #board-name input, #board-name textarea")].filter((el) => !el.closest("[hidden]") && !el.hidden);
    for (const el of nodes) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const box = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 2, Math.max(2, box.left + box.width / 2));
      const y = Math.min(window.innerHeight - 2, Math.max(2, box.top + Math.min(box.height / 2, 20)));
      const hit = document.elementFromPoint(x, y);
      const name = el.getAttribute("data-i18n") || el.id || el.className;
      if (!hit || (hit !== el && !el.contains(hit))) problems.push(`miss ${name} hit ${hit && (hit.getAttribute("data-i18n") || hit.id || hit.className)}`);
    }
    return problems;
  });
  if (problems.length) throw new Error(problems.join("\n"));
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    offset += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png ${bitDepth}/${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const row = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const ul = i >= channels ? prev[i - channels] : 0;
      const x = row[i];
      if (filter === 0) row[i] = x;
      else if (filter === 1) row[i] = (x + left) & 255;
      else if (filter === 2) row[i] = (x + up) & 255;
      else if (filter === 3) row[i] = (x + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[i] = (x + paeth(left, up, ul)) & 255;
      else throw new Error(`png filter ${filter}`);
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = row[s];
      out[d + 1] = row[s + 1];
      out[d + 2] = row[s + 2];
      out[d + 3] = channels === 4 ? row[s + 3] : 255;
    }
    prev = row;
  }
  return { width, height, data: out };
}

async function assertAboutCovered(page) {
  const info = await page.evaluate(() => {
    const about = document.getElementById("about");
    const scene = document.getElementById("scene");
    const game = document.getElementById("game");
    const card = document.querySelector("#board-name .ad-consent-card");
    if (!about || !scene || !game || !card) return { ok: false, reason: "missing about or canvas" };
    const sceneVisibility = getComputedStyle(scene).visibility;
    const gameVisibility = getComputedStyle(game).visibility;
    if (sceneVisibility === "hidden" || gameVisibility === "hidden") {
      return { ok: false, reason: `canvas hidden scene=${sceneVisibility} game=${gameVisibility}` };
    }
    if (!document.body.classList.contains("overlay-open")) return { ok: false, reason: "missing overlay-open" };
    if (!(about.innerText || "").includes("Swipe through the center")) return { ok: false, reason: "about copy missing" };
    const cardBox = card.getBoundingClientRect();
    const points = [
      [Math.round(window.innerWidth / 2), 16],
      [16, 16],
      [window.innerWidth - 16, 16],
      [16, Math.round(window.innerHeight / 2)],
      [window.innerWidth - 16, Math.round(window.innerHeight / 2)],
    ].filter(([x, y]) => x < cardBox.left || x > cardBox.right || y < cardBox.top || y > cardBox.bottom);
    return { ok: true, points };
  });
  if (!info.ok) throw new Error(info.reason);
  if (!info.points.length) throw new Error("no backdrop sample outside the dialog card");
  const png = decodePng(await page.screenshot({ type: "png" }));
  const viewport = page.viewportSize();
  const scaleX = png.width / viewport.width;
  const scaleY = png.height / viewport.height;
  const bad = [];
  for (const [x, y] of info.points) {
    const sx = Math.min(png.width - 1, Math.max(0, Math.round(x * scaleX)));
    const sy = Math.min(png.height - 1, Math.max(0, Math.round(y * scaleY)));
    const i = (sy * png.width + sx) * 4;
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    if (!(b > 100 && r < 40 && b > r + 60)) bad.push(`${x},${y} rgb(${r},${g},${b})`);
  }
  if (bad.length) throw new Error(`#about shows through the dialog: ${bad.join("; ")}`);
}

async function exportNotice(browser, origin, width, lang, patch, needle, file, kind) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    locale: lang === "en" ? "en-US" : lang === "zh-Hant" ? "zh-TW" : "zh-CN",
  });
  await context.addInitScript((initial) => {
    for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, value);
  }, { ...seed, "perfect-slice-lang": lang });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.route("**/api/board**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ country: "TW", scope: "global", rows: [], me: null }),
  }));
  await page.goto(`${origin}/harness.html`, { waitUntil: "domcontentloaded", timeout: 8000 });
  await openDialog(page);
  await page.evaluate((next) => {
    const board = JSON.parse(localStorage.getItem("perfect-slice-board"));
    if (next.name != null) board.name = next.name;
    if (next.titleId != null) board.titleId = next.titleId;
    localStorage.setItem("perfect-slice-board", JSON.stringify(board));
  }, patch);
  await page.click("[data-save-export]");
  await page.waitForFunction((text) => (document.body.innerText || "").includes(text), needle);
  const layout = await layoutProblems(page);
  if (layout.length) throw new Error(layout.join("\n"));
  if (kind === "title") {
    const code = await page.locator("[data-export-text]").inputValue();
    const decoded = decodeSaveCode(code);
    if (!decoded.ok) throw new Error(`cleared title did not export ${decoded.error}`);
    if (JSON.parse(decoded.data["perfect-slice-board"]).titleId !== "") throw new Error("exported title was not cleared");
    const still = await page.evaluate(() => JSON.parse(localStorage.getItem("perfect-slice-board")).titleId);
    if (still !== patch.titleId) throw new Error("local title was changed");
    await page.locator("[data-export-status]").scrollIntoViewIfNeeded();
  } else {
    const code = await page.locator("[data-export-text]").inputValue();
    if (code) throw new Error("blocked export still produced a code");
    const focused = await page.evaluate(() => document.activeElement?.id || "");
    if (focused !== "board-name-input") throw new Error(`rename field not focused: ${focused}`);
    await page.evaluate(() => {
      const note = document.querySelector("[data-export-rename]");
      const card = document.querySelector("#board-name .ad-consent-card");
      const delta = note.getBoundingClientRect().top - card.getBoundingClientRect().top;
      card.scrollTop += delta - 8;
    });
  }
  await page.screenshot({ path: path.join(shotDir, file) });
  await context.close();
  console.log(`export ${kind} ${lang} ${width}px`);
}

async function confirmLanguage(browser, origin, width, lang, needle) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    locale: lang === "en" ? "en-US" : lang === "zh-Hant" ? "zh-TW" : "zh-CN",
  });
  await context.addInitScript((initial) => {
    for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, value);
  }, { ...seed, "perfect-slice-lang": lang });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.route("**/api/board**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ country: "TW", scope: "global", rows: [], me: null }),
  }));
  await page.goto(`${origin}/harness.html`, { waitUntil: "domcontentloaded", timeout: 8000 });
  await openDialog(page);
  await page.click("[data-save-export]");
  await page.waitForFunction(() => (document.querySelector("[data-export-text]")?.value || "").startsWith("5050CUT1:"));
  const code = await page.locator("[data-export-text]").inputValue();
  await page.click("[data-save-import]");
  await page.fill("[data-import-text]", code);
  await page.click("[data-import-go]");
  await page.waitForSelector("[data-import-confirm]:not([hidden])");
  const confirmText = await page.locator("[data-import-confirm]").innerText();
  if (!confirmText.includes(needle)) throw new Error(`${lang} confirm copy missing: ${confirmText}`);
  const layout = await layoutProblems(page);
  if (layout.length) throw new Error(layout.join("\n"));
  await page.locator("[data-import-confirm]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, `save-confirm-${lang}-${width}.png`) });
  await context.close();
  console.log(`confirm ${lang} ${width}px`);
}

async function runWidth(browser, origin, width) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    locale: "zh-CN",
  });
  await context.addInitScript((initial) => {
    if (!sessionStorage.getItem("seeded")) {
      for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }
    const reject = () => Promise.reject(new Error("denied"));
    try {
      if (navigator.clipboard) navigator.clipboard.writeText = reject;
      else navigator.clipboard = { writeText: reject };
    } catch {
      try {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: reject } });
      } catch {
        /* copy fallback still runs if writeText throws */
      }
    }
  }, seed);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(8000);
  const bad = [];
  let boardGets = 0;
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("5050cut.com")) bad.push(url);
    if (url.includes("/api/board")) {
      if (req.method() !== "GET") bad.push(`${req.method()} ${url}`);
      else boardGets += 1;
    }
  });
  await page.route("**/api/board**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ country: "TW", scope: "global", rows: [], me: null }),
    });
  });
  await page.goto(`${origin}/harness.html`, { waitUntil: "domcontentloaded", timeout: 8000 });
  await openDialog(page);
  await assertAboutCovered(page);
  await page.click("[data-save-export]");
  await page.waitForFunction(() => (document.querySelector("[data-export-text]")?.value || "").startsWith("5050CUT1:"));
  const code = await page.locator("[data-export-text]").inputValue();
  const decoded = decodeSaveCode(code);
  if (!decoded.ok) throw new Error(`export decode ${decoded.error}`);
  if (JSON.parse(decoded.data["perfect-slice-board"]).name !== "切客·阿明") throw new Error("chinese name missing");
  await page.click("[data-export-copy]");
  await page.waitForFunction(() => (document.querySelector("[data-export-status]")?.textContent || "").includes("Ctrl+C"));
  const selected = await page.evaluate(() => {
    const field = document.querySelector("[data-export-text]");
    return field.selectionStart === 0 && field.selectionEnd === field.value.length && document.activeElement === field;
  });
  if (!selected) throw new Error("copy fallback did not select the save code");
  const shareHidden = await page.locator("[data-export-share]").isHidden();
  if (!shareHidden && typeof navigator === "undefined") throw new Error("share button");
  await page.click("[data-save-import]");
  await page.waitForSelector("[data-import-panel]:not([hidden])");
  const layout = await layoutProblems(page);
  if (layout.length) throw new Error(layout.join("\n"));
  await assertClickable(page);
  fs.mkdirSync(shotDir, { recursive: true });
  await page.evaluate(() => {
    document.querySelector("#board-name .ad-consent-card").scrollTop = 0;
  });
  await assertAboutCovered(page);
  await page.screenshot({ path: path.join(shotDir, `save-dialog-${width}.png`) });
  const mute = await assertMuteClear(page);
  console.log(`mute clear ${width}px`, mute);
  await page.screenshot({ path: path.join(shotDir, `save-dialog-${width}-bottom.png`) });
  const leakedRestore = await page.locator("body").innerText();
  if (leakedRestore.includes("恢复排行榜") || leakedRestore.includes("Restore leaderboard")) {
    throw new Error("id restore copy is still in the dialog");
  }
  if (!leakedRestore.includes("不要发给别人")) throw new Error("missing keep-the-code warning");

  const beforeBad = stable(await dumpStorage(page));
  const beforeGets = boardGets;
  await page.click("[data-import-go]");
  await page.waitForFunction(() => (document.querySelector("[data-import-error]")?.textContent || "").includes("粘贴"));
  if (stable(await dumpStorage(page)) !== beforeBad) throw new Error("empty import changed storage");

  await page.fill("[data-import-text]", code.replace("5050CUT1:", "5050CUT2:"));
  await page.click("[data-import-go]");
  await page.waitForFunction(() => (document.querySelector("[data-import-error]")?.textContent || "").includes("5050CUT1"));
  if (stable(await dumpStorage(page)) !== beforeBad) throw new Error("bad prefix changed storage");
  const confirmHidden = await page.locator("[data-import-confirm]").isHidden();
  if (!confirmHidden) throw new Error("bad import showed confirm");

  const chars = [...code];
  const at = code.indexOf(":") + 3;
  chars[at] = chars[at] === "A" ? "B" : "A";
  await page.fill("[data-import-text]", chars.join(""));
  await page.click("[data-import-go]");
  await page.waitForFunction(() => (document.querySelector("[data-import-error]")?.textContent || "").includes("校验"));
  if (stable(await dumpStorage(page)) !== beforeBad) throw new Error("checksum import changed storage");
  if (boardGets !== beforeGets) throw new Error("import touched the leaderboard API");

  await page.evaluate(() => {
    localStorage.setItem("perfect-slice-high-score", "1");
    const board = JSON.parse(localStorage.getItem("perfect-slice-board"));
    board.name = "临时号";
    localStorage.setItem("perfect-slice-board", JSON.stringify(board));
  });
  await page.fill("[data-import-text]", code);
  await page.click("[data-import-go]");
  await page.waitForSelector("[data-import-confirm]:not([hidden])");
  const confirmText = await page.locator("[data-import-confirm]").innerText();
  if (!confirmText.includes("原来那一行排行榜记录会留在榜上")) throw new Error(`confirm copy missing: ${confirmText}`);
  const confirmLayout = await layoutProblems(page);
  if (confirmLayout.length) throw new Error(confirmLayout.join("\n"));
  await page.locator("[data-import-confirm]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, `save-confirm-zh-Hans-${width}.png`) });
  await assertMuteClear(page);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click("[data-import-yes]"),
  ]);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  const afterImport = await dumpStorage(page);
  if (afterImport["perfect-slice-high-score"] !== "42") throw new Error("import did not restore score");
  if (!afterImport["perfect-slice-board"].includes("切客·阿明")) throw new Error("import did not restore name");
  if (JSON.parse(afterImport["perfect-slice-economy"]).tokens !== 7) throw new Error("economy lost");
  const backup = JSON.parse(afterImport["perfect-slice-backup"]);
  if (backup.data["perfect-slice-high-score"] !== "1") throw new Error("backup missing previous score");
  if (afterImport["perfect-slice-backup-2"]) throw new Error("extra backup key");
  if (boardGets !== 0) throw new Error(`export/import called the leaderboard ${boardGets} times`);
  if (bad.length) throw new Error(`unexpected requests ${bad.join(", ")}`);
  await context.close();
  console.log(`ok ${width}px boardGets=${boardGets}`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    /* resolved below when playwright is not a project dependency */
  }
  const { pathToFileURL } = await import("node:url");
  const roots = ["/home/ubuntu/.npm/_npx", "/usr/lib/node_modules", "/lib/node_modules"].filter((dir) => fs.existsSync(dir));
  for (const base of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(base);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const file = path.join(base, entry, "node_modules/playwright/index.mjs");
      const direct = path.join(base, "playwright/index.mjs");
      if (fs.existsSync(file)) return import(pathToFileURL(file).href);
      if (fs.existsSync(direct)) return import(pathToFileURL(direct).href);
    }
  }
  throw new Error("playwright is not installed");
}

const playwright = await loadPlaywright();
const server = await startServer();
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const browser = await playwright.chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
let failed = false;
try {
  await runWidth(browser, origin, 320);
  await runWidth(browser, origin, 360);
  await runWidth(browser, origin, 390);
  for (const width of [360, 390]) {
    await confirmLanguage(browser, origin, width, "zh-Hant", "原來那一行排行榜記錄會留在榜上");
    await confirmLanguage(browser, origin, width, "en", "can no longer be changed");
    for (const [lang, titleNeedle, nameNeedle] of [
      ["zh-Hans", "旧头衔已失效，已清空", "请先改下面的昵称，再导出"],
      ["zh-Hant", "舊頭銜已失效，已清空", "請先改下面的暱稱，再匯出"],
      ["en", "no longer valid and was cleared", "Change the name below, then export"],
    ]) {
      await exportNotice(browser, origin, width, lang, { titleId: "retired_blade" }, titleNeedle, `save-export-title-${lang}-${width}.png`, "title");
      await exportNotice(browser, origin, width, lang, { name: "刀" }, nameNeedle, `save-export-name-${lang}-${width}.png`, "name");
    }
  }
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await Promise.race([browser.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]);
  server.close();
}
if (failed) process.exit(1);
console.log("browser checks passed");
process.exit(0);
