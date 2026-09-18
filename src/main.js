/**
 * 入口：创建 Canvas / WebGL、处理窗口尺寸、驱动游戏循环。
 * 浏览器专属 API（window / document / canvas）集中在这一文件、input.js 和 audio.js。
 */
import { Game } from "./game.js";
import { attachInput } from "./input.js";
import { catalogTypes } from "./object.js";
import { createScene } from "./scene.js";

const sceneCanvas = document.getElementById("scene");
const uiCanvas = document.getElementById("game");
const ctx = uiCanvas.getContext("2d", { alpha: true });
const scene = createScene(sceneCanvas);
const game = new Game(scene);

let lastTime = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

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
  scene.render();
  game.render(ctx);

  requestAnimationFrame(loop);
}

attachInput(uiCanvas, {
  onDown: (pos) => game.pointerDown(pos),
  onMove: (pos) => game.pointerMove(pos),
  onUp: (pos) => game.pointerUp(pos),
  onHover: (pos) => game.pointerMove(pos),
});

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();
const preview = new URLSearchParams(window.location.search).get("item");
const codexParam = new URLSearchParams(window.location.search).get("codex");
if (preview && catalogTypes().includes(preview)) game.previewItem(preview);
else {
  game.spawnObject(0);
  if (codexParam !== null) {
    game.openCodex();
    if (catalogTypes().includes(codexParam)) game.inspectCodex(codexParam);
  }
}
requestAnimationFrame(loop);
