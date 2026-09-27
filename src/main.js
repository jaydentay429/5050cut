/**
 * 入口：创建 Canvas / WebGL、处理窗口尺寸、驱动游戏循环。
 * 浏览器专属 API（window / document / canvas）集中在这一文件、input.js 和 audio.js。
 */
import { Game } from "./game.js?v=152";
import { attachInput } from "./input.js?v=80";
import { catalogTypes } from "./object.js?v=86";
import { prefetchTheme, preloadFruitAssets } from "./fruitAssets.js?v=126";
import { createScene } from "./scene.js?v=107";
import { CONFIG } from "./config.js?v=105";
import { t } from "./i18n.js?v=148";

// 触屏 pointerup 上的 preventDefault 拦不住浏览器随后补发的 click。
// 返回主菜单的同一帧如果把隐私链接显示出来，补发的 click 会落在右下角链接上。
const PRIVACY_HOLD_MS = 400;
let privacyBootstrapped = false;
let privacyRevealAt = 0;
let privacyClickBlockUntil = 0;

function isKeyboardActivation(event) {
  if (event.detail === 0) return true;
  const caps = event.sourceCapabilities;
  return Boolean(caps) && caps.firesTouchEvents === false && event.button === 0 && event.clientX === 0 && event.clientY === 0;
}

function armPrivacyClickGuard() {
  const link = document.getElementById("privacy-link");
  if (!link || link.dataset.privacyGuard === "1") return;
  link.dataset.privacyGuard = "1";
  link.addEventListener(
    "click",
    (event) => {
      if (performance.now() >= privacyClickBlockUntil) return;
      if (isKeyboardActivation(event)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

function syncPrivacyLink(game) {
  const link = document.getElementById("privacy-link");
  if (!link) return;
  armPrivacyClickGuard();
  const langOpen = game.prompt?.mode === "lang";
  const hide = game.state !== "menu" || langOpen;
  if (!privacyBootstrapped) {
    privacyBootstrapped = true;
    link.hidden = hide;
    return;
  }
  if (hide) {
    privacyRevealAt = 0;
    if (!link.hidden) link.hidden = true;
    return;
  }
  const now = performance.now();
  if (link.hidden && !privacyRevealAt) {
    privacyRevealAt = now + PRIVACY_HOLD_MS;
    privacyClickBlockUntil = privacyRevealAt + 50;
  }
  if (privacyRevealAt && now < privacyRevealAt) {
    link.hidden = true;
    return;
  }
  privacyRevealAt = 0;
  if (link.hidden) link.hidden = false;
}

const sceneCanvas = document.getElementById("scene");
const uiCanvas = document.getElementById("game");
const ctx = uiCanvas.getContext("2d", { alpha: true });
const loadRoot = document.getElementById("boot-load");
const loadBar = document.getElementById("boot-load-bar");
const loadText = document.getElementById("boot-load-text");

function setLoad(ratio, label) {
  if (loadBar) loadBar.style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;
  if (loadText && label) loadText.textContent = label;
}

function hideLoad() {
  loadRoot?.remove();
}

function isLocalPreview() {
  try {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

async function boot() {
  const scene = createScene(sceneCanvas);
  setLoad(0.02, t("bootPrep"));
  await preloadFruitAssets(scene.renderer, ({ ratio, label }) => setLoad(0.05 + ratio * 0.9, label));
  scene.setEnvironment();
  const game = new Game(scene);

  let lastTime = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.scene.maxPixelRatio ?? 1.5);
    const vv = window.visualViewport;
    const width = Math.round(vv?.width || window.innerWidth);
    const height = Math.round(vv?.height || window.innerHeight);

    uiCanvas.width = Math.floor(width * dpr);
    uiCanvas.height = Math.floor(height * dpr);
    uiCanvas.style.width = `${width}px`;
    uiCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    scene.resize(width, height, dpr);
    game.resize(width, height);
  }

  function loop(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;

    game.update(dt);
    syncPrivacyLink(game);
    scene.render();
    game.render(ctx);
    if (uiCanvas.style.cursor !== game.cursor) uiCanvas.style.cursor = game.cursor;

    requestAnimationFrame(loop);
  }

  attachInput(uiCanvas, {
    onDown: (pos) => game.pointerDown(pos),
    onMove: (pos) => game.pointerMove(pos),
    onUp: (pos) => game.pointerUp(pos),
    onHover: (pos) => game.pointerMove(pos),
    onWheel: (deltaY) => game.pointerWheel(deltaY),
  });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  window.visualViewport?.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    game.setSuspended(document.hidden);
  });
  window.addEventListener("blur", () => game.setSuspended(true));
  window.addEventListener("focus", () => {
    if (!document.hidden) game.setSuspended(false);
  });
  resize();
  const preview = new URLSearchParams(window.location.search).get("item");
  const codexParam = new URLSearchParams(window.location.search).get("codex");
  const fullCodex = CONFIG.unlockAllCodex || codexParam === "all" || isLocalPreview();
  if (fullCodex) game.previewFullCodex();
  if (preview && catalogTypes().includes(preview)) game.previewItem(preview);
  else {
    game.showCover();
    if (codexParam !== null || isLocalPreview()) {
      game.openCodex();
      if (codexParam && codexParam !== "all" && catalogTypes().includes(codexParam)) {
        game.inspectCodex(codexParam);
      }
    }
  }
  syncPrivacyLink(game);
  hideLoad();
  prefetchTheme("fruit");
  if (window.__FORCE_LIVE_ADS__) {
    window.__cutTest = {
      buttons: () => game.buttons(),
      tokens: () => game.economy.tokens,
      toast: () => game.tokenToast,
      state: () => game.state,
    };
  }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  if (loadText) loadText.textContent = t("bootFail");
});
