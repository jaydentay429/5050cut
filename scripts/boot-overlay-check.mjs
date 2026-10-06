/**
 * 首页加载遮罩不得挡住正文 h1。
 * 分别在 javaScriptEnabled:false 和正常情况下打开 /，
 * 执行 document.querySelector("h1").scrollIntoView()，
 * 断言 document.elementFromPoint(h1 中心点) 就是该 h1。
 * 360 与 1280 宽各一次。视口高度固定为 800。
 * 另：WebGL 上下文创建失败时，#boot-load 进入 is-failed，且同样不挡住 h1。
 * 顺带检查 about / contact / terms / privacy / 首页的 JSON-LD 能被 JSON.parse。
 *
 *   node scripts/boot-overlay-check.mjs
 *
 * 需要本机可 import playwright，并用已安装的 Chrome。
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WIDTHS = [360, 1280];
const HEIGHT = 800;
const FAIL_TEXT = ["加载失败，请刷新", "載入失敗，請重新整理", "Load failed — refresh"];

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.resolve(root, rel === "" ? "index.html" : rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end("no");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("no");
      return;
    }
    const ext = path.extname(file);
    const type =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".js" ? "text/javascript; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      ext === ".svg" ? "image/svg+xml" :
      ext === ".wasm" ? "application/wasm" :
      "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

function updatedDate(html) {
  const match = html.match(/最后更新：(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function assertJsonLd() {
  const pages = [
    ["about.html", "AboutPage", "关于", "https://5050cut.com/about"],
    ["contact.html", "ContactPage", "联系", "https://5050cut.com/contact"],
    ["terms.html", "WebPage", "使用条款", "https://5050cut.com/terms"],
    ["privacy.html", "WebPage", "隐私政策", "https://5050cut.com/privacy"],
  ];
  for (const [file, type, name, url] of pages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const blocks = jsonLdBlocks(html);
    const crumb = blocks.find((block) => block["@type"] === "BreadcrumbList");
    const page = blocks.find((block) => block["@type"] === type);
    if (!crumb || !page) throw new Error(`${file} missing BreadcrumbList or ${type}`);
    const items = crumb.itemListElement;
    if (items.length !== 2) throw new Error(`${file} breadcrumb length`);
    if (items[0].position !== 1 || items[0].name !== "首页" || items[0].item !== "https://5050cut.com/") {
      throw new Error(`${file} breadcrumb home`);
    }
    if (items[1].position !== 2 || items[1].name !== name || items[1].item !== url) {
      throw new Error(`${file} breadcrumb self`);
    }
    if (page.name !== name || page.url !== url || page.inLanguage !== "zh-Hans") {
      throw new Error(`${file} page fields`);
    }
    const modified = updatedDate(html);
    if (!modified || page.dateModified !== modified) {
      throw new Error(`${file} dateModified ${page.dateModified} != 最后更新 ${modified}`);
    }
    const publisher = page.publisher;
    if (
      publisher["@type"] !== "Organization" ||
      publisher["@id"] !== "https://webpawsstudio.com/#org" ||
      publisher.name !== "WebPaws Studio" ||
      publisher.url !== "https://webpawsstudio.com"
    ) {
      throw new Error(`${file} publisher`);
    }
    if (type === "ContactPage") {
      if (page.mainEntity?.["@id"] !== "https://webpawsstudio.com/#org") {
        throw new Error("contact mainEntity");
      }
    }
    if (!html.includes('<nav class="crumbs" aria-label="面包屑">')) {
      throw new Error(`${file} missing visible crumbs`);
    }
    if (!html.includes(`<span aria-current="page">${name}</span>`)) {
      throw new Error(`${file} crumb label`);
    }
    const h1 = html.match(/<h1>([^<]*)<\/h1>/);
    if (!h1 || h1[1] !== name) throw new Error(`${file} h1`);
  }

  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const homeBlocks = jsonLdBlocks(home);
  const graph = homeBlocks.find((block) => Array.isArray(block["@graph"]))?.["@graph"] || [];
  const org = graph.find((node) => node["@type"] === "Organization");
  if (!org || org.email !== "jaydentay429@gmail.com") throw new Error("home organization email");
  console.log("json-ld ok");
}

async function h1IsHit(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    h1.scrollIntoView();
    const rect = h1.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      ok: hit === h1,
      describe: hit ? `${hit.tagName}#${hit.id}.${String(hit.className)}` : "null",
      x,
      y,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      innerHeight: window.innerHeight,
    };
  });
}

async function openHome(browser, { javaScriptEnabled, width, initScript }) {
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const stage = document.getElementById("stage");
    return !!stage && getComputedStyle(stage).position === "relative";
  });
  return { context, page };
}

let origin = "";

async function checkReadable(browser, label, options) {
  const { context, page } = await openHome(browser, options);
  try {
    const hit = await h1IsHit(page);
    if (!hit.ok) {
      throw new Error(`${label}: elementFromPoint -> ${hit.describe} @ ${hit.x},${hit.y} rectTop=${hit.top} bottom=${hit.bottom} vh=${hit.innerHeight}`);
    }
    console.log(`ok ${label}`);
  } finally {
    await context.close();
  }
}

const WEBGL_STUB = () => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (typeof type === "string" && type.toLowerCase().includes("webgl")) return null;
    return orig.apply(this, [type, ...args]);
  };
};

async function checkWebglFailure(browser, width) {
  const { context, page } = await openHome(browser, {
    javaScriptEnabled: true,
    width,
    initScript: WEBGL_STUB,
  });
  try {
    await page.waitForSelector("#boot-load.is-failed", { timeout: 60000 });
    const state = await page.evaluate((accepted) => {
      const load = document.getElementById("boot-load");
      const text = document.getElementById("boot-load-text");
      const style = getComputedStyle(load);
      return {
        text: text ? text.textContent : "",
        position: style.position,
        background: style.backgroundColor,
        bootError: !!document.getElementById("boot-error"),
        acceptedOk: accepted.includes(text ? text.textContent : ""),
      };
    }, FAIL_TEXT);
    if (!state.acceptedOk) throw new Error(`webgl ${width}: unexpected fail text ${state.text}`);
    if (state.position !== "absolute") throw new Error(`webgl ${width}: position ${state.position}`);
    if (state.bootError) throw new Error(`webgl ${width}: #boot-error covered the page`);
    if (!/rgba?\(28,\s*23,\s*18,\s*0?\.85\)/.test(state.background)) {
      throw new Error(`webgl ${width}: background ${state.background}`);
    }
    const hit = await h1IsHit(page);
    if (!hit.ok) {
      throw new Error(`webgl ${width}: elementFromPoint -> ${hit.describe}`);
    }
    console.log(`ok webgl-fail ${width}`);
  } finally {
    await context.close();
  }
}

assertJsonLd();

const server = await startServer();
origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const width of WIDTHS) {
    const { context, page } = await openHome(browser, { javaScriptEnabled: false, width });
    try {
      const hidden = await page.evaluate(() => getComputedStyle(document.getElementById("boot-load")).display);
      if (hidden !== "none") throw new Error(`noscript ${width}: #boot-load display ${hidden}`);
      const hit = await h1IsHit(page);
      if (!hit.ok) throw new Error(`noscript ${width}: elementFromPoint -> ${hit.describe} @ ${hit.x},${hit.y}`);
      console.log(`ok noscript ${width}`);
    } finally {
      await context.close();
    }
  }
  for (const width of WIDTHS) {
    await checkReadable(browser, `script ${width}`, { javaScriptEnabled: true, width });
  }
  for (const width of WIDTHS) {
    await checkWebglFailure(browser, width);
  }
} finally {
  await browser.close();
  server.close();
}

console.log("boot overlay checks passed");
