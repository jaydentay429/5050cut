/**
 * 图鉴顶栏、分类标签、语言选择器、关卡标题的测量。
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
    const i18n = await import("/src/i18n.js?v=146");
    const ui = await import("/src/ui.js?v=150");
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
      themeFlashAge: 0.6,
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

    for (const [name, shot] of [
      ["未选锁定", locked],
      ["未选可点", picked],
      ["已选", selected],
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
for (const width of WIDTHS) {
  for (const lang of LANGS) {
    for (const [themeId, themeIndex] of themes) {
      const themeName = await page.evaluate(async ({ lang, themeId, themeIndex }) => {
        const i18n = await import("/src/i18n.js?v=146");
        i18n.setLang(lang);
        return { name: i18n.themeName(themeId), station: i18n.t("station", { n: themeIndex + 1 }) };
      }, { lang, themeId, themeIndex });
      const named = await paint({
        lang,
        width,
        height: PHONE_H,
        state: "playing",
        flash: true,
        themeIndex,
        themeName: themeName.name,
      });
      const texts = named.calls.map(glyphBox).filter((box) => box.text === themeName.station || box.text === themeName.name);
      const panel = named.panel;
      for (const box of texts) {
        const area = overlapArea(box, panel);
        const restartArea = named.restart ? overlapArea(box, named.restart) : 0;
        const muteArea = named.mute ? overlapArea(box, named.mute) : 0;
        rows.push({
          kind: "标题",
          width,
          lang,
          text: box.text,
          panelArea: Math.round(area * 100) / 100,
          restartArea: Math.round(restartArea * 100) / 100,
          muteArea: Math.round(muteArea * 100) / 100,
        });
        if (area > 0.01) fail(`标题压分数面板 ${width} ${lang} 「${box.text}」面积 ${area.toFixed(2)}`);
        if (restartArea > 0.01) fail(`标题压重开 ${width} ${lang} 「${box.text}」`);
        if (muteArea > 0.01) fail(`标题压静音 ${width} ${lang} 「${box.text}」`);
      }
      if (texts.length < 2) fail(`标题没画全 ${width} ${lang} ${themeId} ${texts.map((b) => b.text).join("|")}`);
      if (texts.length === 2) {
        const area = overlapArea(texts[0], texts[1]);
        if (area > 0.01) fail(`标题两行重叠 ${width} ${lang} ${themeId} ${area.toFixed(2)}`);
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
const tabRows = rows.filter((row) => row.kind === "标签");
const langRows = rows.filter((row) => row.kind === "语言");
const titleRows = rows.filter((row) => row.kind === "标题");
const worstTabs = [...tabRows].sort((a, b) => b.overflow - a.overflow).slice(0, 12);

const report = [
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
  "图鉴顶栏文字两两重叠面积",
  table(overlapRows, ["width", "lang", "name", "a", "b", "area"]),
  "",
  "分类标签最紧的几条（overflow>0 为超宽）",
  table(worstTabs, ["width", "lang", "label", "line", "textW", "inner", "overflow"]),
  "",
  "关卡标题与分数面板重叠面积",
  table(titleRows, ["width", "lang", "text", "panelArea", "restartArea", "muteArea"]),
  "",
  failures.length ? `失败 ${failures.length}:\n${failures.join("\n")}` : "全部通过",
].join("\n");

fs.writeFileSync("/tmp/ui-style-check.txt", report);
console.log(report);
if (failures.length) process.exit(1);
