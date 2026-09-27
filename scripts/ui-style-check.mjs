/**
 * 图鉴顶栏、分类标签、语言选择器、关卡标题的测量，外加 config 统一后的页面回归。
 * 分类标签是 canvas 绘制，宽度用 measureText，不是 DOM 的 scrollWidth。
 * 不进发布目录（pack-pages 不复制 scripts/）。
 *
 *   node scripts/ui-style-check.mjs
 *
 * 需要本机 Chrome。页面走本地静态服务，拦截 /api/board。
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = "/tmp/after-ui";
fs.mkdirSync(shotDir, { recursive: true });

const LANGS = ["zh-Hans", "zh-Hant", "en"];
const WIDTHS = [320, 360, 390];
const PHONE_H = 844;
const TAB_INSET = 6;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname);
    if (rel.startsWith("/api/board")) {
      server.boardHits.push(`${req.method} ${rel}`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true,"rows":[]}');
      return;
    }
    const file = path.join(root, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("no");
      return;
    }
    const ext = path.extname(file);
    const type =
      ext === ".html" ? "text/html" :
      ext === ".js" ? "text/javascript" :
      ext === ".css" ? "text/css" :
      ext === ".svg" ? "image/svg+xml" :
      "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  server.boardHits = [];
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function inside(box, plate, slop = 0.6) {
  return (
    box.x >= plate.x - slop &&
    box.y >= plate.y - slop &&
    box.x + box.w <= plate.x + plate.w + slop &&
    box.y + box.h <= plate.y + plate.h + slop
  );
}

const server = await startServer();
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const failures = [];
const rows = [];

function fail(msg) {
  failures.push(msg);
}

const page = await browser.newPage({ viewport: { width: 390, height: PHONE_H }, deviceScaleFactor: 1 });
await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });

async function paint(spec) {
  return page.evaluate(async (spec) => {
    const i18n = await import("/src/i18n.js?v=147");
    const ui = await import("/src/ui.js?v=151");
    i18n.setLang(spec.lang);
    const { width, height } = spec;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const calls = [];
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = (text, x, y, maxWidth) => {
      const m = ctx.measureText(String(text));
      const ascent = m.actualBoundingBoxAscent || 0;
      const descent = m.actualBoundingBoxDescent || 0;
      const left = m.actualBoundingBoxLeft || 0;
      const right = m.actualBoundingBoxRight || 0;
      calls.push({
        text: String(text),
        x,
        y,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        font: ctx.font,
        width: m.width,
        ascent,
        descent,
        left,
        right,
      });
      return orig(text, x, y, maxWidth);
    };
    ctx.fillStyle = "#1c1712";
    ctx.fillRect(0, 0, width, height);
    const state = spec.state;
    const buttons = ui.mergePromptButtons(
      ui.layoutButtons(width, height, state, false, {
        unlockedCount: spec.unlockedCount ?? 0,
        catalogTotal: spec.catalogTotal ?? 100,
        codexTheme: spec.codexTheme || "fruit",
      }),
      width,
      height,
      spec.prompt || null,
    );
    const catalog = spec.catalog || {};
    ui.renderUI(ctx, {
      width,
      height,
      state,
      muted: false,
      codexTheme: spec.codexTheme || "fruit",
      catalog,
      catalogTotal: spec.catalogTotal ?? 100,
      unlockedCount: spec.unlockedCount ?? 0,
      codexSelected: spec.codexSelected ?? null,
      collection: spec.collection ?? 0,
      collectionMax: spec.collectionMax ?? 10000,
      stallTrophy: null,
      stallStars: [],
      buttons,
      pendingPrompt: spec.prompt || null,
      score: spec.score ?? 1280,
      combo: 2,
      tokens: 4,
      highScore: 0,
      themeJustChanged: Boolean(spec.flash),
      themeFlashAge: spec.flashAge ?? 0.6,
      themeName: spec.themeName || "",
      themeIndex: spec.themeIndex ?? 0,
      time: 1,
      showHint: false,
    });
    const layout = ui.layoutCodex(width, height, false, spec.codexTheme || "fruit");
    const frame = ui.langPickFrame(width, height);
    const panel = ui.scorePanelRect(width, height);
    const tabs = Object.values(layout.buttons).filter((button) => button.kind === "tab");
    return {
      png: canvas.toDataURL("image/png"),
      calls,
      plate: layout.plate,
      tabs: tabs.map((button) => ({ id: button.id, label: button.label, x: button.x, y: button.y, w: button.w, h: button.h })),
      frame,
      cancel: buttons["lang-cancel"] || null,
      panel,
      restart: buttons.restart || null,
      mute: buttons.mute || null,
    };
  }, spec);
}

function glyphBox(call) {
  const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(call.font)?.[1] || 12);
  const hasInk = call.ascent + call.descent > 0.5 && call.left + call.right > 0.5;
  const w = hasInk ? call.left + call.right : call.width;
  const h = hasInk ? call.ascent + call.descent : fontSize;
  const x = hasInk
    ? call.x - call.left
    : call.align === "center"
      ? call.x - w / 2
      : call.align === "right"
        ? call.x - w
        : call.x;
  const y = hasInk
    ? call.y - call.ascent
    : call.baseline === "middle"
      ? call.y - h / 2
      : call.baseline === "top"
        ? call.y
        : call.y - h * 0.8;
  return { x, y, w, h, text: call.text, width: call.width };
}

function inPlate(box, plate) {
  const cy = box.y + box.h / 2;
  return cy >= plate.y && cy <= plate.y + plate.h;
}

for (const width of WIDTHS) {
  for (const lang of LANGS) {
    const locked = await paint({
      lang,
      width,
      height: PHONE_H,
      state: "codex",
      unlockedCount: 0,
      codexTheme: "night",
    });
    const picked = await paint({
      lang,
      width,
      height: PHONE_H,
      state: "codex",
      unlockedCount: 3,
      codexSelected: null,
      codexTheme: "candy",
    });
    const selected = await paint({
      lang,
      width,
      height: PHONE_H,
      state: "codex",
      unlockedCount: 10,
      codexSelected: "watering_can",
      codexTheme: "veg",
      catalog: { watering_can: { cuts: 2, best: 100 } },
    });
    const longLocked = await paint({
      lang,
      width,
      height: PHONE_H,
      state: "codex",
      unlockedCount: 0,
      codexTheme: "fruit",
      collection: 9999,
      collectionMax: 10000,
    });
    const longFull = await paint({
      lang,
      width,
      height: PHONE_H,
      state: "codex",
      unlockedCount: 100,
      codexSelected: null,
      codexTheme: "candy",
      collection: 9999,
      collectionMax: 10000,
    });

    for (const [name, shot] of [
      ["未选锁定", locked],
      ["未选可点", picked],
      ["已选", selected],
      ["收藏分9999", longLocked],
      ["满收藏9999", longFull],
    ]) {
      const texts = shot.calls.map(glyphBox).filter((box) => inPlate(box, shot.plate));
      rows.push({
        kind: "顶栏",
        width,
        lang,
        name,
        n: texts.length,
        texts: texts.map((box) => box.text),
      });
      for (let i = 0; i < texts.length; i += 1) {
        if (!inside(texts[i], shot.plate)) {
          fail(`顶栏出框 ${width} ${lang} ${name} 「${texts[i].text}」 ${JSON.stringify(texts[i])} plate ${JSON.stringify(shot.plate)}`);
        }
        for (let j = i + 1; j < texts.length; j += 1) {
          const area = overlapArea(texts[i], texts[j]);
          rows.push({
            kind: "重叠",
            width,
            lang,
            name,
            a: texts[i].text,
            b: texts[j].text,
            area: Math.round(area * 100) / 100,
          });
          if (area > 0.01) {
            fail(`顶栏重叠 ${width} ${lang} ${name} 「${texts[i].text}」×「${texts[j].text}」面积 ${area.toFixed(2)}`);
          }
        }
      }
    }

    const tabs = locked;
    for (const tab of tabs.tabs) {
      const lines = tabs.calls.map(glyphBox).filter((box) => {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        return cx >= tab.x && cx <= tab.x + tab.w && cy >= tab.y && cy <= tab.y + tab.h;
      });
      const inner = tab.w - TAB_INSET * 2;
      for (const line of lines) {
        const overflow = Math.round((line.width - inner) * 100) / 100;
        rows.push({
          kind: "标签",
          method: "canvas measureText",
          width,
          lang,
          label: tab.label,
          textW: Math.round(line.width * 100) / 100,
          inner: Math.round(inner * 100) / 100,
          overflow,
          line: line.text,
        });
        if (line.width > inner + 0.05) {
          fail(`标签超宽 ${width} ${lang} 「${line.text}」宽 ${line.width.toFixed(1)} > 内宽 ${inner.toFixed(1)}`);
        }
        if (line.x < tab.x - 0.6 || line.x + line.w > tab.x + tab.w + 0.6) {
          fail(`标签出按钮 ${width} ${lang} 「${line.text}」`);
        }
      }
      if (!lines.length) fail(`标签没有文字 ${width} ${lang} ${tab.label}`);
    }
  }
}

const langHeights = [
  [320, PHONE_H],
  [360, PHONE_H],
  [390, PHONE_H],
  [1280, 800],
  [1280, 720],
];
for (const [width, height] of langHeights) {
  for (const lang of LANGS) {
    const shot = await paint({
      lang,
      width,
      height,
      state: "menu",
      prompt: { mode: "lang" },
    });
    const cancel = shot.cancel;
    const frame = shot.frame;
    const panel = { x: frame.boxX, y: frame.boxY, w: frame.boxW, h: frame.boxH };
    const button = { x: cancel.x, y: cancel.y, w: cancel.w, h: cancel.h };
    const margin = panel.y + panel.h - (button.y + button.h);
    rows.push({
      kind: "语言",
      width,
      height,
      lang,
      margin: Math.round(margin * 100) / 100,
      buttonBottom: Math.round((button.y + button.h) * 100) / 100,
      panelBottom: Math.round((panel.y + panel.h) * 100) / 100,
    });
    if (margin < 1) fail(`取消按钮出面板 ${width}x${height} ${lang} 余量 ${margin.toFixed(2)}`);
    if (!inside(button, panel, 0)) fail(`取消按钮不在面板内 ${width}x${height} ${lang}`);
    const label = shot.calls.map(glyphBox).find((box) => box.text === cancel.label && box.y >= cancel.y && box.y <= cancel.y + cancel.h);
    if (label && (label.x < cancel.x - 0.6 || label.x + label.w > cancel.x + cancel.w + 0.6)) {
      fail(`取消文字出按钮 ${width} ${lang}`);
    }
  }
}

const themes = [
  ["fruit", 0],
  ["night", 7],
  ["candy", 4],
];
// 标题只有 globalAlpha 淡出，位置不随时间变。仍按开始 / 中段 / 快消失取样，确认整段轨迹都不压分数面板。
const FLASH_FRAMES = [
  ["开始", 0.05],
  ["中段", 0.8],
  ["快消失", 1.72],
];
for (const width of WIDTHS) {
  for (const lang of LANGS) {
    for (const [themeId, themeIndex] of themes) {
      const themeName = await page.evaluate(async ({ lang, themeId, themeIndex }) => {
        const i18n = await import("/src/i18n.js?v=147");
        i18n.setLang(lang);
        return { name: i18n.themeName(themeId), station: i18n.t("station", { n: themeIndex + 1 }) };
      }, { lang, themeId, themeIndex });
      const seen = [];
      for (const [phase, flashAge] of FLASH_FRAMES) {
        const named = await paint({
          lang,
          width,
          height: PHONE_H,
          state: "playing",
          flash: true,
          flashAge,
          themeIndex,
          themeName: themeName.name,
        });
        const texts = named.calls.map(glyphBox).filter((box) => box.text === themeName.station || box.text === themeName.name);
        const panel = named.panel;
        if (texts.length < 2) fail(`标题没画全 ${width} ${lang} ${themeId} ${phase} ${texts.map((b) => b.text).join("|")}`);
        for (const box of texts) {
          const area = overlapArea(box, panel);
          const restartArea = named.restart ? overlapArea(box, named.restart) : 0;
          const muteArea = named.mute ? overlapArea(box, named.mute) : 0;
          const spot = {
            kind: "标题",
            width,
            lang,
            phase,
            age: flashAge,
            text: box.text,
            x: Math.round(box.x * 10) / 10,
            y: Math.round(box.y * 10) / 10,
            panelArea: Math.round(area * 100) / 100,
            restartArea: Math.round(restartArea * 100) / 100,
            muteArea: Math.round(muteArea * 100) / 100,
          };
          rows.push(spot);
          seen.push(spot);
          if (area > 0.01) fail(`标题压分数面板 ${width} ${lang} ${phase} 「${box.text}」面积 ${area.toFixed(2)}`);
          if (restartArea > 0.01) fail(`标题压重开 ${width} ${lang} ${phase} 「${box.text}」`);
          if (muteArea > 0.01) fail(`标题压静音 ${width} ${lang} ${phase} 「${box.text}」`);
        }
        if (texts.length === 2) {
          const area = overlapArea(texts[0], texts[1]);
          if (area > 0.01) fail(`标题两行重叠 ${width} ${lang} ${themeId} ${phase} ${area.toFixed(2)}`);
        }
      }
      const byText = new Map();
      for (const spot of seen) {
        if (!byText.has(spot.text)) byText.set(spot.text, []);
        byText.get(spot.text).push(spot);
      }
      for (const [text, spots] of byText) {
        const x0 = spots[0].x;
        const y0 = spots[0].y;
        for (const spot of spots) {
          if (Math.abs(spot.x - x0) > 0.5 || Math.abs(spot.y - y0) > 0.5) {
            fail(`标题轨迹位移 ${width} ${lang} 「${text}」 ${spots.map((s) => `${s.phase}@${s.x},${s.y}`).join(" ")}`);
          }
        }
      }
    }
  }
}

async function saveShot(name, spec) {
  const shot = await paint(spec);
  const buf = Buffer.from(shot.png.split(",")[1], "base64");
  fs.writeFileSync(path.join(shotDir, `${name}.png`), buf);
}

await saveShot("codex-320-en", {
  lang: "en",
  width: 320,
  height: PHONE_H,
  state: "codex",
  unlockedCount: 0,
  codexTheme: "night",
});
await saveShot("codex-390-hans", {
  lang: "zh-Hans",
  width: 390,
  height: PHONE_H,
  state: "codex",
  unlockedCount: 0,
  codexTheme: "fruit",
});
await saveShot("tabs-320-en", {
  lang: "en",
  width: 320,
  height: PHONE_H,
  state: "codex",
  unlockedCount: 0,
  codexTheme: "candy",
});
await saveShot("lang-390-en", {
  lang: "en",
  width: 390,
  height: PHONE_H,
  state: "menu",
  prompt: { mode: "lang" },
});
await saveShot("title-390-en", {
  lang: "en",
  width: 390,
  height: PHONE_H,
  state: "playing",
  flash: true,
  themeName: "Fruit stall",
  themeIndex: 0,
  score: 1280,
});
await saveShot("lang-1280", {
  lang: "zh-Hans",
  width: 1280,
  height: 800,
  state: "menu",
  prompt: { mode: "lang" },
});

await page.close();

const net = await browser.newPage();
const board = [];
const configs = [];
await net.route("**/*", async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.includes("googlesyndication") || url.includes("googleads") || url.includes("doubleclick")) {
    await route.fulfill({ status: 204, body: "" });
    return;
  }
  if (url.includes("/api/board")) {
    board.push(req.method());
    if (req.method() !== "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true,"rows":[],"me":null}',
    });
    return;
  }
  await route.continue();
});
net.on("request", (req) => {
  if (req.url().includes("config.js")) configs.push(`${req.method()} ${req.url()}`);
});
await net.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
await net.waitForTimeout(2500);
const resources = await net.evaluate(() =>
  performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => name.includes("config.js")),
);
await net.close();

const reg = await browser.newPage({ viewport: { width: 390, height: PHONE_H }, deviceScaleFactor: 1 });
await reg.addInitScript(() => {
  const orig = CanvasRenderingContext2D.prototype.fillText;
  let bucket = [];
  const flush = () => {
    window.__lastTexts = bucket;
    bucket = [];
    requestAnimationFrame(flush);
  };
  requestAnimationFrame(flush);
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
    bucket.push(String(text));
    return orig.call(this, text, x, y, maxWidth);
  };
});
await reg.route("**/*", async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.includes("googlesyndication") || url.includes("googleads") || url.includes("doubleclick")) {
    await route.fulfill({ status: 204, body: "" });
    return;
  }
  if (url.includes("/api/board")) {
    board.push(req.method());
    if (req.method() !== "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true,"rows":[],"me":null}',
    });
    return;
  }
  await route.continue();
});
const regConfigs = [];
reg.on("request", (req) => {
  if (req.url().includes("config.js")) regConfigs.push(req.url());
});

async function frameTexts() {
  await reg.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  return reg.evaluate(() => window.__lastTexts || []);
}

async function liveButtons(state, prompt) {
  return reg.evaluate(async ({ state, prompt }) => {
    const ui = await import("/src/ui.js?v=151");
    const audio = await import("/src/audio.js?v=67");
    const canvas = document.getElementById("game");
    const width = parseFloat(canvas.style.width) || window.innerWidth;
    const height = parseFloat(canvas.style.height) || window.innerHeight;
    let buttons = ui.layoutButtons(width, height, state, audio.isMuted(), {
      unlockedCount: 100,
      catalogTotal: 100,
      codexTheme: "fruit",
    });
    if (prompt) buttons = ui.mergePromptButtons(buttons, width, height, prompt);
    const slim = {};
    for (const [id, button] of Object.entries(buttons)) {
      slim[id] = { x: button.x, y: button.y, w: button.w, h: button.h, label: button.label || "" };
    }
    return slim;
  }, { state, prompt });
}

async function tap(id, state, prompt) {
  const buttons = await liveButtons(state, prompt);
  const button = buttons[id];
  if (!button) throw new Error(`没有按钮 ${id} @ ${state}`);
  const box = await reg.locator("#game").boundingBox();
  await reg.mouse.click(box.x + button.x + button.w / 2, box.y + button.y + button.h / 2);
  await reg.waitForTimeout(180);
}

function includesText(list, needle) {
  return list.some((text) => text.includes(needle));
}

function expectTexts(list, needles, where) {
  for (const needle of needles) {
    const ok = includesText(list, needle);
    rows.push({ kind: "回归", where, needle, ok: ok ? "是" : "否" });
    if (!ok) fail(`回归 ${where} 缺少「${needle}」 实际: ${[...new Set(list)].slice(0, 24).join(" | ")}`);
  }
}

await reg.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
await reg.evaluate(() => {
  localStorage.setItem("perfect-slice-lang", "zh-Hans");
  localStorage.removeItem("perfect-slice-muted");
});
await reg.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
await reg.waitForSelector("#boot-load", { state: "detached", timeout: 90000 });
let drawn = await frameTexts();
expectTexts(drawn, ["收藏分", "返回", "水果摊"], "简体图鉴");
await tap("menu", "codex");
drawn = await frameTexts();
expectTexts(drawn, ["开始游戏", "图鉴", "商店"], "简体首页");
await tap("shop", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["商店", "再试刀"], "简体商店");
await tap("menu", "shop");
await tap("lang", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["Play", "Collection", "Shop"], "英文首页");
await tap("shop", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["Shop", "Retry cut"], "英文商店");
await tap("menu", "shop");
await tap("codex", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["Album", "Fruit stall", "Back"], "英文图鉴");
await tap("menu", "codex");
await tap("lang", "menu");
await tap("lang-hant", "menu", { mode: "lang" });
drawn = await frameTexts();
expectTexts(drawn, ["開始遊戲", "圖鑑", "商店"], "繁体首页");
await tap("shop", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["商店", "再試刀"], "繁体商店");
await tap("menu", "shop");
await tap("codex", "menu");
drawn = await frameTexts();
expectTexts(drawn, ["收藏分", "水果攤", "返回"], "繁体图鉴");
await tap("menu", "codex");
await tap("mute", "menu");
const mutedStored = await reg.evaluate(() => localStorage.getItem("perfect-slice-muted"));
drawn = await frameTexts();
rows.push({ kind: "回归", where: "静音写入", needle: "perfect-slice-muted=1", ok: mutedStored === "1" ? "是" : mutedStored });
if (mutedStored !== "1") fail(`静音后 localStorage 是 ${mutedStored}`);
expectTexts(drawn, ["開聲音"], "繁体静音开");
await reg.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
await reg.waitForSelector("#boot-load", { state: "detached", timeout: 90000 });
const mutedAfter = await reg.evaluate(() => localStorage.getItem("perfect-slice-muted"));
const langAfter = await reg.evaluate(() => localStorage.getItem("perfect-slice-lang"));
drawn = await frameTexts();
rows.push({ kind: "回归", where: "刷新后静音", needle: "仍为1", ok: mutedAfter === "1" ? "是" : mutedAfter });
rows.push({ kind: "回归", where: "刷新后语言", needle: "zh-Hant", ok: langAfter === "zh-Hant" ? "是" : langAfter });
if (mutedAfter !== "1") fail(`刷新后静音丢失 ${mutedAfter}`);
if (langAfter !== "zh-Hant") fail(`刷新后语言丢失 ${langAfter}`);
expectTexts(drawn, ["開聲音", "水果攤"], "刷新后图鉴仍静音且繁体");
await tap("mute", "codex");
const unmuted = await reg.evaluate(() => localStorage.getItem("perfect-slice-muted"));
drawn = await frameTexts();
rows.push({ kind: "回归", where: "取消静音", needle: "perfect-slice-muted=0", ok: unmuted === "0" ? "是" : unmuted });
if (unmuted !== "0") fail(`取消静音后 localStorage 是 ${unmuted}`);
expectTexts(drawn, ["關聲音"], "繁体静音关");
await reg.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
await reg.waitForSelector("#boot-load", { state: "detached", timeout: 90000 });
const unmutedAfter = await reg.evaluate(() => localStorage.getItem("perfect-slice-muted"));
drawn = await frameTexts();
rows.push({ kind: "回归", where: "刷新后未静音", needle: "仍为0", ok: unmutedAfter === "0" ? "是" : unmutedAfter });
if (unmutedAfter !== "0") fail(`刷新后静音状态不是关 ${unmutedAfter}`);
expectTexts(drawn, ["關聲音"], "刷新后仍未静音");

const regConfigUrls = [...new Set(regConfigs)];
if (regConfigUrls.length !== 1) fail(`回归页 config.js ${regConfigUrls.length} 种: ${regConfigUrls.join(" | ")}`);
rows.push({
  kind: "回归",
  where: "config.js",
  needle: regConfigUrls[0] || "(无)",
  ok: regConfigUrls.length === 1 ? "1次URL" : `${regConfigUrls.length}种`,
});

await reg.close();
await browser.close();

const nonGet = board.filter((method) => method !== "GET");
const serverNonGet = server.boardHits.filter((line) => !line.startsWith("GET "));
if (nonGet.length) fail(`浏览器发出非 GET /api/board: ${nonGet.join(", ")}`);
if (serverNonGet.length) fail(`服务器收到非 GET /api/board: ${serverNonGet.join(", ")}`);
const configUrls = [...new Set(resources)];
if (configUrls.length !== 1) fail(`config.js 请求 ${configUrls.length} 种: ${configUrls.join(" | ")}`);
if (resources.length !== 1) fail(`config.js 请求次数 ${resources.length}: ${resources.join(" | ")}`);

server.close();

function table(list, cols) {
  const head = cols.join(" | ");
  const lines = [head, cols.map(() => "---").join(" | ")];
  for (const row of list) lines.push(cols.map((col) => row[col] ?? "").join(" | "));
  return lines.join("\n");
}

const overlapRows = rows.filter((row) => row.kind === "重叠");
const longRows = overlapRows.filter((row) => row.name === "收藏分9999" || row.name === "满收藏9999");
const tabRows = rows.filter((row) => row.kind === "标签");
const focusTabs = tabRows.filter((row) => (row.width === 320 || row.width === 360) && (row.lang === "en" || row.lang === "zh-Hant"));
const langRows = rows.filter((row) => row.kind === "语言");
const titleRows = rows.filter((row) => row.kind === "标题" && row.lang === "en" && (row.text === "Fruit stall" || row.text === "Stall 1" || row.text === "Night market" || row.text === "Stall 8"));
const regRows = rows.filter((row) => row.kind === "回归");

const report = [
  "分类标签绘制：canvas。宽度用 CanvasRenderingContext2D.measureText().width，对比按钮内宽（按钮宽 - 12）。不是 DOM，不能用 scrollWidth / clientWidth。",
  "",
  "config.js 资源:",
  resources.join("\n") || "(none)",
  `config.js 请求次数: ${resources.length}`,
  `config.js 不同 URL: ${configUrls.length}`,
  `浏览器 /api/board 方法: ${board.join(", ") || "(无)"}`,
  `打到静态服务器的 /api/board: ${server.boardHits.join(", ") || "(无)"}`,
  "",
  "语言选择器取消按钮底边余量（面板底 - 按钮底，正数表示在面板内）",
  table(langRows, ["width", "height", "lang", "margin", "buttonBottom", "panelBottom"]),
  "",
  "图鉴顶栏 收藏分 9999 / 10000 的重叠面积",
  table(longRows, ["width", "lang", "name", "a", "b", "area"]),
  "",
  "分类标签 320/360 × 英文/繁体（measureText）",
  table(focusTabs, ["width", "lang", "label", "line", "textW", "inner", "overflow", "method"]),
  "",
  "关卡标题淡出帧（英文，无位移动画，三帧坐标应相同，panelArea 为 0）",
  table(titleRows, ["width", "phase", "age", "text", "x", "y", "panelArea"]),
  "",
  "config 统一后的页面回归",
  table(regRows, ["where", "needle", "ok"]),
  "",
  failures.length ? `失败 ${failures.length}:\n${failures.join("\n")}` : "全部通过",
].join("\n");

fs.writeFileSync("/tmp/ui-style-check.txt", report);
console.log(report);
if (failures.length) process.exit(1);
