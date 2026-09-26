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
    <link rel="stylesheet" href="/style.css?v=11" />
  </head>
  <body>
    ${block}
    <script>
      window.__errors = [];
      window.addEventListener("error", (event) => {
        window.__errors.push(String(event.message || event));
      });
    </script>
    <script type="module">
      import { promptBoardName } from "/src/board.js?v=11";
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
    const nodes = [...card.querySelectorAll("button, input, textarea, .board-id, .board-key-warn, .board-name-label")].filter((el) => {
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
  await page.click("[data-save-export]");
  await page.waitForFunction(() => (document.querySelector("[data-export-text]")?.value || "").startsWith("5050CUT1:"));
  const code = await page.locator("[data-export-text]").inputValue();
  const decoded = decodeSaveCode(code);
  if (!decoded.ok) throw new Error(`export decode ${decoded.error}`);
  if (JSON.parse(decoded.data["perfect-slice-board"]).name !== "切客·阿明") throw new Error("chinese name missing");
  await page.click("[data-export-copy]");
  await page.waitForFunction(() => (document.querySelector("[data-export-status]")?.textContent || "").includes("长按"));
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
  await page.screenshot({ path: path.join(shotDir, `save-dialog-${width}.png`) });
  await page.evaluate(() => {
    const card = document.querySelector("#board-name .ad-consent-card");
    card.scrollTop = card.scrollHeight;
  });
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
  const confirmLayout = await layoutProblems(page);
  if (confirmLayout.length) throw new Error(confirmLayout.join("\n"));
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
  await runWidth(browser, origin, 360);
  await runWidth(browser, origin, 390);
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
