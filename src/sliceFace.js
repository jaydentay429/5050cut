import * as THREE from "three";

const SIZE = 512;

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function fill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function addNoise(ctx, amount = 28) {
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

function paintSkin(ctx, stops, opts = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  for (const [p, c] of stops) g.addColorStop(p, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (opts.stripe) {
    const s = ctx.createLinearGradient(0, 0, SIZE, 0);
    s.addColorStop(0, "rgba(0,0,0,0.18)");
    s.addColorStop(0.35, "rgba(255,255,255,0.08)");
    s.addColorStop(0.55, "rgba(255,255,255,0.22)");
    s.addColorStop(0.7, "rgba(255,255,255,0.06)");
    s.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  if (opts.highlight !== false) {
    const hx = SIZE * (opts.hx ?? 0.3);
    const hy = SIZE * (opts.hy ?? 0.26);
    const h = ctx.createRadialGradient(hx, hy, SIZE * 0.02, hx, hy, SIZE * 0.42);
    h.addColorStop(0, "rgba(255,255,255,0.38)");
    h.addColorStop(0.45, "rgba(255,255,255,0.1)");
    h.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  if (opts.spots) {
    ctx.fillStyle = opts.spotColor || "rgba(70,40,10,0.2)";
    for (let i = 0; i < opts.spots; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        (i * 73 + 19) % SIZE,
        (i * 131 + 41) % SIZE,
        opts.spotR ?? 2.2,
        (opts.spotR ?? 2.2) * 1.4,
        i,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  addNoise(ctx, opts.noise ?? 22);
}

function paintFlesh(ctx, skin, flesh, opts = {}) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  fill(ctx, skin);
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = flesh;
  ctx.fill();

  if (opts.segments) {
    ctx.strokeStyle = opts.segmentColor || "rgba(255, 220, 160, 0.55)";
    ctx.lineWidth = SIZE * 0.01;
    for (let i = 0; i < opts.segments; i += 1) {
      const a = (i / opts.segments) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * SIZE * 0.42, cy + Math.sin(a) * SIZE * 0.42);
      ctx.stroke();
    }
  }

  if (opts.core) {
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE * (opts.coreR ?? 0.12), 0, Math.PI * 2);
    ctx.fillStyle = opts.core;
    ctx.fill();
  }

  if (opts.seeds) {
    ctx.fillStyle = opts.seedColor || "#5a3a14";
    for (let i = 0; i < opts.seeds; i += 1) {
      const a = (i / opts.seeds) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * SIZE * 0.08,
        cy + Math.sin(a) * SIZE * 0.08,
        SIZE * 0.018,
        SIZE * 0.01,
        a,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  addNoise(ctx, 14);
}

function paintWoodRings(ctx) {
  const cx = SIZE / 2 + 8;
  const cy = SIZE / 2 - 6;
  fill(ctx, "#d7b07a");
  for (let r = SIZE * 0.72; r > 4; r -= 5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 15 < 6 ? "#8a5a32" : "#c49a62";
    ctx.lineWidth = r % 15 < 6 ? 2.4 : 1.1;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#5c3a1f";
  ctx.fill();
  addNoise(ctx, 22);
}

function paintCucumberFace(ctx) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  fill(ctx, "#3f7a28");
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = "#d7ed7a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#eaf6b0";
  ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = cx + Math.cos(a) * SIZE * 0.28;
    const y = cy + Math.sin(a) * SIZE * 0.28;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f6e7a2";
    ctx.fill();
    ctx.restore();
  }
  addNoise(ctx, 18);
}

function paintCakeFace(ctx) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  fill(ctx, "#f4c8d4");
  const bands = [
    ["#fff6ea", SIZE * 0.46],
    ["#e8b56a", SIZE * 0.38],
    ["#fff6ea", SIZE * 0.28],
    ["#e8b56a", SIZE * 0.2],
    ["#fff0f4", SIZE * 0.1],
  ];
  for (const [color, r] of bands) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = "#d42838";
  ctx.fill();
  addNoise(ctx, 14);
}

function paintBreadFace(ctx) {
  fill(ctx, "#f0d9a0");
  ctx.fillStyle = "rgba(196, 138, 74, 0.22)";
  for (let i = 0; i < 40; i += 1) {
    const x = 12 + Math.random() * (SIZE - 24);
    const y = 12 + Math.random() * (SIZE - 24);
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + Math.random() * 10, 3 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 26);
}

function paintWoodSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
  gradient.addColorStop(0, "#e0c08a");
  gradient.addColorStop(0.5, "#c9a36a");
  gradient.addColorStop(1, "#a97d45");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(90, 50, 22, 0.28)";
  for (let x = 8; x < SIZE; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 4, SIZE * 0.3, x - 5, SIZE * 0.7, x + 2, SIZE);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  addNoise(ctx, 18);
}

function paintCucumberSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, 0);
  gradient.addColorStop(0, "#2f6a22");
  gradient.addColorStop(0.5, "#5aa832");
  gradient.addColorStop(1, "#2f6a22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 9; i += 1) {
    const x = ((i + 0.5) / 9) * SIZE;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(180, 220, 90, 0.38)" : "rgba(20, 60, 12, 0.22)";
    ctx.lineWidth = SIZE * 0.055;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 10, SIZE * 0.5, x, SIZE);
    ctx.stroke();
  }
  addNoise(ctx, 18);
}

function paintCakeSide(ctx) {
  const layers = [
    ["#f4c8d4", 0, 0.14],
    ["#f7efe4", 0.14, 0.28],
    ["#e8b56a", 0.28, 0.46],
    ["#fff6ea", 0.46, 0.56],
    ["#e8b56a", 0.56, 0.74],
    ["#f7efe4", 0.74, 0.88],
    ["#f4c8d4", 0.88, 1],
  ];
  for (const [color, a, b] of layers) {
    ctx.fillStyle = color;
    ctx.fillRect(0, SIZE * a, SIZE, SIZE * (b - a) + 1);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(0, SIZE * 0.02, SIZE, SIZE * 0.06);
  addNoise(ctx, 12);
}

function paintBreadSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
  gradient.addColorStop(0, "#f0d49a");
  gradient.addColorStop(0.22, "#e2b46a");
  gradient.addColorStop(0.55, "#c48a42");
  gradient.addColorStop(1, "#8a4e20");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(90, 42, 12, 0.28)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    const x = SIZE * (0.22 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, SIZE * 0.08);
    ctx.quadraticCurveTo(x + 18, SIZE * 0.5, x - 6, SIZE * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(240, 210, 140, 0.35)";
  for (let i = 0; i < 28; i += 1) {
    ctx.beginPath();
    ctx.ellipse((i * 67) % SIZE, (i * 41) % (SIZE * 0.45), 4, 2.2, i, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 22);
}

function paintLemonFace(ctx) {
  paintFlesh(ctx, "#e2b22a", "#fff6b0", {
    segments: 10,
    segmentColor: "rgba(230, 180, 50, 0.45)",
    core: "#fffce0",
    coreR: 0.1,
  });
}

function paintLemonSide(ctx) {
  paintSkin(ctx, [
    [0, "#fff56a"],
    [0.35, "#ffe034"],
    [0.7, "#f0c820"],
    [1, "#e0b018"],
  ], { stripe: false, spots: 36, spotColor: "rgba(210, 160, 20, 0.16)", spotR: 2.2, noise: 14 });
}

function paintCheeseFace(ctx) {
  fill(ctx, "#f4c44a");
  ctx.fillStyle = "rgba(232, 176, 48, 0.55)";
  for (let i = 0; i < 9; i += 1) {
    const x = 28 + ((i * 73) % (SIZE - 56));
    const y = 32 + ((i * 97) % (SIZE - 64));
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + (i % 4) * 4, 8 + (i % 3) * 3, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#c98a28";
  for (let i = 0; i < 11; i += 1) {
    const x = 40 + ((i * 51) % (SIZE - 80));
    const y = 36 + ((i * 83) % (SIZE - 72));
    ctx.beginPath();
    ctx.arc(x, y, 6 + (i % 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 16);
}

function paintCheeseSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
  gradient.addColorStop(0, "#f7d56a");
  gradient.addColorStop(1, "#d9a032");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "rgba(180, 110, 28, 0.28)";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(30 + i * 28, 40 + (i % 2) * 90, 8 + (i % 3) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 18);
}

function paintCarrotFace(ctx) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  fill(ctx, "#c45a20");
  const rings = [
    ["#e07030", 0.46],
    ["#f08a40", 0.34],
    ["#f6b060", 0.18],
    ["#c45a20", 0.07],
  ];
  for (const [color, r] of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE * r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  addNoise(ctx, 14);
}

function paintCarrotSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, 0);
  gradient.addColorStop(0, "#c45a20");
  gradient.addColorStop(0.5, "#ef8038");
  gradient.addColorStop(1, "#c45a20");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(255, 210, 140, 0.22)";
  ctx.lineWidth = 6;
  for (let y = 12; y < SIZE; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y + 8);
    ctx.stroke();
  }
  addNoise(ctx, 16);
}

function paintOnigiriFace(ctx) {
  fill(ctx, "#1a2a18");
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 18);
  ctx.lineTo(28, SIZE - 22);
  ctx.lineTo(SIZE - 28, SIZE - 22);
  ctx.closePath();
  ctx.fillStyle = "#f4f0e4";
  ctx.fill();
  ctx.fillStyle = "rgba(40, 40, 40, 0.12)";
  for (let i = 0; i < 40; i += 1) {
    ctx.beginPath();
    ctx.arc(50 + ((i * 47) % 156), 70 + ((i * 31) % 120), 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 12);
}

function paintOnigiriSide(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
  gradient.addColorStop(0, "#243824");
  gradient.addColorStop(0.55, "#1a2c1a");
  gradient.addColorStop(1, "#0f1a10");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "rgba(244, 240, 228, 0.2)";
  ctx.fillRect(0, SIZE * 0.62, SIZE, SIZE * 0.38);
  addNoise(ctx, 18);
}


function paintBananaFace(ctx) {
  paintFlesh(ctx, "#d4a028", "#fff4b8", { core: "#fffce0", coreR: 0.18 });
  ctx.fillStyle = "#6a4a18";
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      SIZE / 2 + Math.cos(a) * SIZE * 0.22,
      SIZE / 2 + Math.sin(a) * SIZE * 0.22,
      SIZE * 0.012,
      SIZE * 0.007,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function paintBananaSide(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#d8a020");
  g.addColorStop(0.08, "#f8cc28");
  g.addColorStop(0.22, "#ffe44a");
  g.addColorStop(0.5, "#ffd830");
  g.addColorStop(0.82, "#f8d034");
  g.addColorStop(0.94, "#e8d848");
  g.addColorStop(1, "#9aaa30");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "rgba(180, 110, 20, 0.18)";
  ctx.lineWidth = SIZE * 0.018;
  for (const x of [0.17, 0.5, 0.83]) {
    ctx.beginPath();
    ctx.moveTo(SIZE * x, 0);
    ctx.quadraticCurveTo(SIZE * (x + 0.03), SIZE * 0.5, SIZE * x, SIZE);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(90, 48, 10, 0.12)";
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 73 + 19) % SIZE,
      (i * 131 + 41) % SIZE,
      1.4 + (i % 3),
      1.8 + (i % 2),
      i,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  addNoise(ctx, 10);
}

function paintAppleFace(ctx) {
  paintFlesh(ctx, "#b42828", "#f6ead0", {
    core: "#e8d4a8",
    coreR: 0.14,
    seeds: 5,
    seedColor: "#4a2a10",
  });
  ctx.strokeStyle = "rgba(180, 120, 60, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.2, 0, Math.PI * 2);
  ctx.stroke();
}

function paintAppleSide(ctx) {
  paintSkin(ctx, [
    [0, "#8a1810"],
    [0.22, "#e03428"],
    [0.48, "#ff4a32"],
    [0.78, "#d42820"],
    [1, "#6a120e"],
  ], { stripe: false, spots: 10, spotColor: "rgba(255,200,120,0.14)", spotR: 4, noise: 14 });
  ctx.fillStyle = "rgba(255, 220, 80, 0.16)";
  ctx.beginPath();
  ctx.ellipse(SIZE * 0.62, SIZE * 0.38, SIZE * 0.18, SIZE * 0.28, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function paintPearFace(ctx) {
  paintFlesh(ctx, "#8aaa32", "#f4f0c8", { core: "#d8c878", coreR: 0.1, seeds: 6, seedColor: "#5a3a10" });
}

function paintPearSide(ctx) {
  paintSkin(ctx, [
    [0, "#f4f47a"],
    [0.18, "#e8ea58"],
    [0.5, "#d2e04a"],
    [0.8, "#b4c83c"],
    [1, "#7a9a28"],
  ], { stripe: true, spots: 48, spotColor: "rgba(90,50,10,0.18)", spotR: 2.6, noise: 24, hx: 0.34, hy: 0.3 });
  ctx.fillStyle = "rgba(255, 255, 200, 0.18)";
  ctx.beginPath();
  ctx.ellipse(SIZE * 0.28, SIZE * 0.22, SIZE * 0.16, SIZE * 0.22, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function paintOrangeFace(ctx) {
  paintFlesh(ctx, "#e07018", "#ffb44a", {
    segments: 12,
    segmentColor: "rgba(255, 236, 190, 0.75)",
    core: "#ffe8b0",
    coreR: 0.09,
  });
}

function paintOrangeSide(ctx) {
  paintSkin(ctx, [
    [0, "#ffb034"],
    [0.35, "#ff9a28"],
    [0.7, "#f07818"],
    [1, "#d86810"],
  ], { stripe: false, spots: 90, spotColor: "rgba(255, 220, 90, 0.28)", spotR: 3.4, noise: 20 });
}

function paintStrawberryFace(ctx) {
  paintFlesh(ctx, "#a01828", "#ee5a68", { core: "#f08088", coreR: 0.16 });
  ctx.fillStyle = "#f0d060";
  for (let i = 0; i < 22; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      SIZE * 0.18 + ((i * 41) % (SIZE * 0.64)),
      SIZE * 0.18 + ((i * 29) % (SIZE * 0.64)),
      SIZE * 0.016,
      SIZE * 0.01,
      i,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function paintStrawberrySide(ctx) {
  paintSkin(ctx, [
    [0, "#ff7a80"],
    [0.4, "#f03848"],
    [0.75, "#d01830"],
    [1, "#9a1020"],
  ], { stripe: false, spots: 0, noise: 12 });
  ctx.fillStyle = "#f0c850";
  for (let i = 0; i < 36; i += 1) {
    ctx.beginPath();
    ctx.ellipse((i * 67) % SIZE, (i * 97) % SIZE, 4, 2.5, i, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRoseFace(ctx) {
  paintFlesh(ctx, "#6a1020", "#e85068");
  ctx.strokeStyle = "#c03048";
  ctx.lineWidth = SIZE * 0.02;
  for (let r = SIZE * 0.12; r < SIZE * 0.42; r += SIZE * 0.07) {
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, r, 0.2, Math.PI * 1.7);
    ctx.stroke();
  }
}

function paintRoseSide(ctx) {
  paintSkin(ctx, [
    [0, "#e04860"],
    [0.16, "#c03048"],
    [0.24, "#3a9a40"],
    [1, "#246a2c"],
  ], { stripe: false, highlight: false, noise: 12 });
}

function paintTulipFace(ctx) {
  paintFlesh(ctx, "#c45a18", "#f4a058");
}

function paintTulipSide(ctx) {
  paintSkin(ctx, [
    [0, "#ee6a28"],
    [0.28, "#d45020"],
    [0.4, "#3a8a30"],
    [1, "#1e4a20"],
  ], { highlight: false, noise: 14 });
}

function paintDaisyFace(ctx) {
  fill(ctx, "#3a8a30");
  ctx.fillStyle = "#fff8e8";
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      SIZE / 2 + Math.cos(a) * SIZE * 0.28,
      SIZE / 2 + Math.sin(a) * SIZE * 0.28,
      SIZE * 0.08,
      SIZE * 0.032,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c430";
  ctx.fill();
  addNoise(ctx, 10);
}

function paintDaisySide(ctx) {
  paintSkin(ctx, [
    [0, "#5aaa38"],
    [0.12, "#3a8a30"],
    [1, "#1e4a20"],
  ], { highlight: false, noise: 14 });
}

function paintPencilFace(ctx) {
  fill(ctx, "#c48a28");
  ctx.fillStyle = "#f3e0b8";
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.07, 0, Math.PI * 2);
  ctx.fill();
  addNoise(ctx, 10);
}

function paintPencilSide(ctx) {
  paintSkin(ctx, [
    [0, "#f7d24a"],
    [0.5, "#e8b028"],
    [1, "#c48818"],
  ], { stripe: true, highlight: false, noise: 12 });
  ctx.fillStyle = "#1f4a8c";
  ctx.fillRect(0, SIZE * 0.38, SIZE, SIZE * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `${Math.floor(SIZE * 0.06)}px sans-serif`;
  ctx.fillText("HB", SIZE * 0.12, SIZE * 0.44);
}

function paintEraserFace(ctx) {
  fill(ctx, "#e890a4");
  ctx.fillStyle = "#3a7ad8";
  ctx.fillRect(0, SIZE * 0.38, SIZE, SIZE * 0.24);
  addNoise(ctx, 16);
}

function paintEraserSide(ctx) {
  fill(ctx, "#f0a0b4");
  ctx.fillStyle = "#3a7ad8";
  ctx.fillRect(0, SIZE * 0.36, SIZE, SIZE * 0.28);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, SIZE, SIZE * 0.12);
  addNoise(ctx, 14);
}

function paintCrayonFace(ctx) {
  fill(ctx, "#2450c8");
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#4a78f0";
  ctx.fill();
  addNoise(ctx, 12);
}

function paintCrayonSide(ctx) {
  paintSkin(ctx, [
    [0, "#1e3aa0"],
    [0.5, "#3a6ae8"],
    [1, "#1e3aa0"],
  ], { stripe: true, highlight: false, noise: 10 });
  ctx.fillStyle = "#f4ead4";
  ctx.fillRect(0, SIZE * 0.32, SIZE, SIZE * 0.36);
  ctx.fillStyle = "#c43a32";
  ctx.fillRect(0, SIZE * 0.32, SIZE, SIZE * 0.06);
  ctx.fillStyle = "#2a2a2a";
  ctx.font = `${Math.floor(SIZE * 0.09)}px sans-serif`;
  ctx.fillText("CRAYON", SIZE * 0.12, SIZE * 0.55);
}

function paintRulerFace(ctx) {
  fill(ctx, "#e8d5a4");
  ctx.strokeStyle = "#1a140e";
  ctx.fillStyle = "#1a140e";
  ctx.lineWidth = 3;
  ctx.font = `bold ${Math.floor(SIZE * 0.09)}px sans-serif`;
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.04, SIZE * 0.82);
  ctx.lineTo(SIZE * 0.96, SIZE * 0.82);
  ctx.stroke();
  for (let i = 0; i <= 10; i += 1) {
    const x = SIZE * (0.08 + (i / 10) * 0.84);
    const h = i % 5 === 0 ? SIZE * 0.42 : SIZE * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, SIZE * 0.82);
    ctx.lineTo(x, SIZE * 0.82 - h);
    ctx.stroke();
    if (i % 5 === 0) ctx.fillText(String(i), x + 3, SIZE * 0.32);
  }
  addNoise(ctx, 8);
}

function paintCornFace(ctx) {
  paintFlesh(ctx, "#c47818", "#f6d24a", { core: "#fff0b0", coreR: 0.18 });
}

function paintCornSide(ctx) {
  fill(ctx, "#c47818");
  for (let y = 0; y < 14; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      ctx.beginPath();
      ctx.ellipse(36 + x * 60 + (y % 2) * 22, 20 + y * 36, 18, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = (x + y) % 3 === 0 ? "#ffe56a" : "#f0c430";
      ctx.fill();
      ctx.strokeStyle = "rgba(160, 90, 20, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function paintEggplantFace(ctx) {
  paintFlesh(ctx, "#4a1860", "#e8c8e8", { core: "#f4e0f0", coreR: 0.14, seeds: 8, seedColor: "#5a2040" });
}

function paintEggplantSide(ctx) {
  paintSkin(ctx, [
    [0, "#3a0a48"],
    [0.4, "#6a2088"],
    [0.75, "#8a38a8"],
    [1, "#2a0838"],
  ], { stripe: false, spots: 8, spotColor: "rgba(255,200,255,0.12)", noise: 12 });
}

function paintSunflowerFace(ctx) {
  fill(ctx, "#3a8a30");
  ctx.fillStyle = "#f0c430";
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(SIZE / 2 + Math.cos(a) * SIZE * 0.3, SIZE / 2 + Math.sin(a) * SIZE * 0.3, SIZE * 0.09, SIZE * 0.034, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "#6a3a10";
  ctx.fill();
}

function paintSunflowerSide(ctx) {
  paintSkin(ctx, [
    [0, "#c48a18"],
    [0.18, "#3a8a30"],
    [1, "#1e4a20"],
  ], { highlight: false, noise: 12 });
}

function paintLollipopFace(ctx) {
  fill(ctx, "#fff0f4");
  for (let i = 0; i < 8; i += 1) {
    ctx.strokeStyle = i % 2 === 0 ? "#e04870" : "#fff8e8";
    ctx.lineWidth = SIZE * 0.08;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.08 + i * SIZE * 0.045, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function paintLollipopSide(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#f07090");
  g.addColorStop(0.5, "#fff0f4");
  g.addColorStop(1, "#e04870");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function paintChocolateFace(ctx) {
  fill(ctx, "#5a2a14");
  ctx.fillStyle = "#3a180c";
  ctx.strokeStyle = "#2a1008";
  ctx.lineWidth = 6;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      ctx.fillRect(18 + x * 96, 40 + y * 150, 86, 130);
      ctx.strokeRect(18 + x * 96, 40 + y * 150, 86, 130);
    }
  }
}

function paintChocolateSide(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#7a3a18");
  g.addColorStop(1, "#3a180c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function paintMacaronFace(ctx) {
  fill(ctx, "#f090b0");
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#f8c0d0";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff0c8";
  ctx.fill();
}

function paintMacaronSide(ctx) {
  ctx.fillStyle = "#f4a0b8";
  ctx.fillRect(0, 0, SIZE, SIZE * 0.38);
  ctx.fillStyle = "#fff0c8";
  ctx.fillRect(0, SIZE * 0.38, SIZE, SIZE * 0.24);
  ctx.fillStyle = "#e878a0";
  ctx.fillRect(0, SIZE * 0.62, SIZE, SIZE * 0.38);
}

function paintPopsicleFace(ctx) {
  fill(ctx, "#f07080");
  ctx.fillStyle = "#70d0f0";
  ctx.fillRect(0, SIZE * 0.33, SIZE, SIZE * 0.34);
  ctx.fillStyle = "#f8e070";
  ctx.fillRect(0, SIZE * 0.66, SIZE, SIZE * 0.34);
}

function paintPopsicleSide(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#ff8090");
  g.addColorStop(0.33, "#80d8f8");
  g.addColorStop(0.66, "#ffe070");
  g.addColorStop(1, "#e8d0a0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function paintRulerSide(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#f0e0b4");
  g.addColorStop(0.5, "#d8c08a");
  g.addColorStop(1, "#b89860");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(90, 50, 22, 0.28)";
  for (let x = 10; x < SIZE; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 4, SIZE * 0.3, x - 5, SIZE * 0.7, x + 2, SIZE);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  addNoise(ctx, 12);
}

export function makeNoiseBump() {
  const { canvas, ctx } = makeCanvas();
  fill(ctx, "#808080");
  addNoise(ctx, 90);
  const texture = toTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}

const FACE_PAINTERS = {
  apple: paintAppleFace,
  pear: paintPearFace,
  orange: paintOrangeFace,
  banana: paintBananaFace,
  strawberry: paintStrawberryFace,
  lemon: paintLemonFace,
  rose: paintRoseFace,
  tulip: paintTulipFace,
  daisy: paintDaisyFace,
  sunflower: paintSunflowerFace,
  pencil: paintPencilFace,
  eraser: paintEraserFace,
  crayon: paintCrayonFace,
  ruler: paintRulerFace,
  carrot: paintCarrotFace,
  cucumber: paintCucumberFace,
  corn: paintCornFace,
  eggplant: paintEggplantFace,
  cake: paintCakeFace,
  bread: paintBreadFace,
  cheese: paintCheeseFace,
  onigiri: paintOnigiriFace,
  lollipop: paintLollipopFace,
  chocolate: paintChocolateFace,
  macaron: paintMacaronFace,
  popsicle: paintPopsicleFace,
};

const SIDE_PAINTERS = {
  apple: paintAppleSide,
  pear: paintPearSide,
  orange: paintOrangeSide,
  banana: paintBananaSide,
  strawberry: paintStrawberrySide,
  lemon: paintLemonSide,
  rose: paintRoseSide,
  tulip: paintTulipSide,
  daisy: paintDaisySide,
  sunflower: paintSunflowerSide,
  pencil: paintPencilSide,
  eraser: paintEraserSide,
  crayon: paintCrayonSide,
  ruler: paintRulerSide,
  carrot: paintCarrotSide,
  cucumber: paintCucumberSide,
  corn: paintCornSide,
  eggplant: paintEggplantSide,
  cake: paintCakeSide,
  bread: paintBreadSide,
  cheese: paintCheeseSide,
  onigiri: paintOnigiriSide,
  lollipop: paintLollipopSide,
  chocolate: paintChocolateSide,
  macaron: paintMacaronSide,
  popsicle: paintPopsicleSide,
};

export function makeThemeWall(themeId) {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (themeId === "flower") paintGardenBackdrop(ctx, W, H);
  else if (themeId === "stationery") paintDeskBackdrop(ctx, W, H);
  else if (themeId === "veg") paintVegBackdrop(ctx, W, H);
  else if (themeId === "pastry") paintPastryBackdrop(ctx, W, H);
  else if (themeId === "candy") paintCandyBackdrop(ctx, W, H);
  else paintStallBackdrop(ctx, W, H);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function paintStallBackdrop(ctx, W, H) {
  const plaster = ctx.createLinearGradient(0, 0, 0, H);
  plaster.addColorStop(0, "#e8b070");
  plaster.addColorStop(0.45, "#d49050");
  plaster.addColorStop(1, "#8a4a22");
  ctx.fillStyle = plaster;
  ctx.fillRect(0, 0, W, H);

  const awnTop = H * 0.22;
  const awnBot = H * 0.56;
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#c43a32" : "#f4ead4";
    const x0 = (i / 10) * W;
    ctx.fillRect(x0, awnTop, W / 10 + 1, awnBot - awnTop);
    ctx.beginPath();
    ctx.moveTo(x0, awnBot);
    ctx.quadraticCurveTo(x0 + W / 20, awnBot + 36, x0 + W / 10, awnBot);
    ctx.fill();
  }

  ctx.fillStyle = "#5a2810";
  ctx.fillRect(0, awnTop - 18, W, 22);

  const fruits = ["#d43a32", "#e07020", "#f0d040", "#6aaa38", "#c42838", "#f4e070"];
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(48 + i * 72, H * 0.78, 22 + (i % 3) * 5, 0, Math.PI * 2);
    ctx.fillStyle = fruits[i % fruits.length];
    ctx.fill();
  }
  ctx.fillStyle = "#6a3214";
  ctx.fillRect(0, H * 0.86, W, H * 0.14);
}

function paintGardenBackdrop(ctx, W, H) {
  const hedge = ctx.createLinearGradient(0, 0, 0, H);
  hedge.addColorStop(0, "#4f8a3a");
  hedge.addColorStop(0.45, "#2f6a28");
  hedge.addColorStop(1, "#1e4a18");
  ctx.fillStyle = hedge;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(90, 150, 55, 0.45)";
  for (let i = 0; i < 40; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 97) % W,
      (i * 53) % H,
      48 + (i % 5) * 10,
      28 + (i % 3) * 8,
      i * 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const blooms = ["#e85068", "#f0c430", "#fff8ee", "#f07828"];
  for (let i = 0; i < 28; i += 1) {
    ctx.fillStyle = blooms[i % blooms.length];
    ctx.beginPath();
    ctx.arc((i * 73 + 20) % W, H * 0.35 + (i % 5) * 28, 5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintDeskBackdrop(ctx, W, H) {
  ctx.fillStyle = "#efe4cc";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#d8c8a4";
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = "#c8b48c";
  ctx.fillRect(0, H * 0.7, W, 10);

  ctx.fillStyle = "#8ec6ee";
  ctx.fillRect(W * 0.08, H * 0.22, W * 0.46, H * 0.42);
  ctx.strokeStyle = "#f7f2e6";
  ctx.lineWidth = 18;
  ctx.strokeRect(W * 0.08, H * 0.22, W * 0.46, H * 0.42);
  ctx.beginPath();
  ctx.moveTo(W * 0.31, H * 0.22);
  ctx.lineTo(W * 0.31, H * 0.64);
  ctx.moveTo(W * 0.08, H * 0.43);
  ctx.lineTo(W * 0.54, H * 0.43);
  ctx.stroke();

  ctx.fillStyle = "#6a4a2a";
  ctx.fillRect(W * 0.62, H * 0.18, W * 0.3, H * 0.58);
  const spines = ["#c43a32", "#2a5a9a", "#e0a028", "#3a7a32", "#7a3a8a", "#d47838"];
  for (let i = 0; i < 18; i += 1) {
    const x = W * 0.64 + (i % 6) * 42;
    const y = H * 0.22 + Math.floor(i / 6) * 90;
    ctx.fillStyle = spines[i % spines.length];
    ctx.fillRect(x, y, 28, 72);
  }

  ctx.fillStyle = "#c9a36a";
  ctx.fillRect(W * 0.78, H * 0.08, 70, 52);
  ctx.strokeStyle = "#f3ead4";
  ctx.lineWidth = 8;
  ctx.strokeRect(W * 0.78, H * 0.08, 70, 52);
}

function paintVegBackdrop(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#8ec85a");
  g.addColorStop(0.5, "#4a8a32");
  g.addColorStop(1, "#2a5a18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#6a3a14";
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = "#3a7a28";
  for (let i = 0; i < 18; i += 1) {
    ctx.fillRect(30 + i * 56, H * 0.42, 18, H * 0.34);
    ctx.beginPath();
    ctx.ellipse(39 + i * 56, H * 0.4, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPastryBackdrop(ctx, W, H) {
  ctx.fillStyle = "#f3e0c8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d8b090";
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  ctx.fillStyle = "#c48a58";
  ctx.fillRect(0, H * 0.6, W, 14);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = "#fff6ea";
    ctx.beginPath();
    ctx.arc(90 + i * 190, H * 0.42, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ["#c45b6c", "#e8b56a", "#f090b0", "#d98a4a", "#f7efe4"][i];
    ctx.beginPath();
    ctx.arc(90 + i * 190, H * 0.42, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8a4a22";
  ctx.fillRect(W * 0.72, H * 0.12, W * 0.22, H * 0.42);
  ctx.fillStyle = "#ffb060";
  ctx.fillRect(W * 0.75, H * 0.18, W * 0.16, H * 0.22);
}

function paintCandyBackdrop(ctx, W, H) {
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#f090b8" : "#fff0f6";
    ctx.fillRect((i / 8) * W, 0, W / 8 + 1, H);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  const jars = ["#ff6a8a", "#70d0f0", "#ffe070", "#c070f0"];
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = jars[i];
    ctx.beginPath();
    ctx.arc(80 + i * 240 + 70, H * 0.28 + 90, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8ee";
    ctx.fillRect(80 + i * 240, H * 0.22, 140, 22);
  }
}

export function makeThemeGround(themeId) {
  const { canvas, ctx } = makeCanvas();
  if (themeId === "flower") {
    fill(ctx, "#3a6a30");
    ctx.fillStyle = "#4f8a3c";
    for (let i = 0; i < 220; i += 1) {
      ctx.fillRect((i * 53) % SIZE, (i * 91) % SIZE, 3, 10 + (i % 6));
    }
    ctx.fillStyle = "rgba(210, 180, 70, 0.16)";
    for (let i = 0; i < 24; i += 1) {
      ctx.beginPath();
      ctx.arc((i * 71) % SIZE, (i * 47) % SIZE, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (themeId === "veg") {
    fill(ctx, "#4a3218");
    ctx.fillStyle = "#3a6a28";
    for (let y = 0; y < SIZE; y += 64) {
      ctx.fillRect(0, y + 18, SIZE, 18);
    }
  } else if (themeId === "pastry") {
    for (let y = 0; y < SIZE; y += 64) {
      for (let x = 0; x < SIZE; x += 64) {
        ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? "#e8d4b8" : "#d4b898";
        ctx.fillRect(x, y, 64, 64);
      }
    }
  } else if (themeId === "candy") {
    for (let y = 0; y < SIZE; y += 64) {
      for (let x = 0; x < SIZE; x += 64) {
        ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? "#f8a0c0" : "#ffe8f0";
        ctx.fillRect(x, y, 64, 64);
      }
    }
  } else if (themeId === "stationery") {
    const g = ctx.createLinearGradient(0, 0, SIZE, 0);
    g.addColorStop(0, "#8a6a48");
    g.addColorStop(0.5, "#c4a06a");
    g.addColorStop(1, "#8a6a48");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = "rgba(70, 40, 16, 0.28)";
    ctx.lineWidth = 6;
    for (let x = 0; x < SIZE; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }
  } else {
    for (let y = 0; y < SIZE; y += 64) {
      for (let x = 0; x < SIZE; x += 64) {
        ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? "#c46830" : "#a04e20";
        ctx.fillRect(x, y, 64, 64);
      }
    }
    ctx.strokeStyle = "rgba(60, 20, 8, 0.28)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= SIZE; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, SIZE);
      ctx.moveTo(0, i);
      ctx.lineTo(SIZE, i);
      ctx.stroke();
    }
  }
  addNoise(ctx, 22);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

function paintStallBoard(ctx) {
  const g = ctx.createLinearGradient(0, 0, SIZE, 0);
  g.addColorStop(0, "#c88848");
  g.addColorStop(0.5, "#e0a060");
  g.addColorStop(1, "#b07038");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(90, 40, 12, 0.35)";
  ctx.lineWidth = 10;
  for (let x = 0; x < SIZE; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SIZE);
    ctx.stroke();
  }
  addNoise(ctx, 22);
}

function paintStoneBoard(ctx) {
  fill(ctx, "#6a7064");
  const tones = ["#9aa090", "#868c80", "#a8ae9c", "#7a8074"];
  for (let row = 0; row < 6; row += 1) {
    const odd = row % 2 === 1;
    for (let col = 0; col < 6; col += 1) {
      const x = col * 90 - (odd ? 45 : 0);
      const y = row * 86;
      ctx.fillStyle = tones[(row + col) % tones.length];
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 6, 82, 74, 10);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(70, 110, 40, 0.2)";
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    ctx.ellipse((i * 89) % SIZE, (i * 47) % SIZE, 16, 8, i, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 18);
}

function paintBlotterBoard(ctx) {
  fill(ctx, "#f3e6cc");
  ctx.fillStyle = "#7a3a2a";
  ctx.fillRect(0, 0, SIZE, 28);
  ctx.fillRect(0, SIZE - 28, SIZE, 28);
  ctx.fillRect(0, 0, 28, SIZE);
  ctx.fillRect(SIZE - 28, 0, 28, SIZE);
  ctx.strokeStyle = "rgba(180, 150, 100, 0.35)";
  ctx.lineWidth = 2;
  for (let y = 48; y < SIZE - 40; y += 22) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(SIZE - 40, y);
    ctx.stroke();
  }
  addNoise(ctx, 12);
}

function paintMarbleBoard(ctx) {
  fill(ctx, "#f4ead8");
  ctx.strokeStyle = "rgba(180, 140, 110, 0.35)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, 40 + i * 60);
    ctx.bezierCurveTo(120, 10 + i * 70, 280, 90 + i * 40, SIZE, 30 + i * 55);
    ctx.stroke();
  }
  addNoise(ctx, 10);
}

function paintCandyBoard(ctx) {
  fill(ctx, "#fff4f8");
  ctx.fillStyle = "#f090b8";
  ctx.fillRect(0, 0, SIZE, 22);
  ctx.fillRect(0, SIZE - 22, SIZE, 22);
  ctx.fillStyle = "rgba(255, 120, 160, 0.18)";
  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    ctx.arc((i * 73) % SIZE, (i * 51) % SIZE, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, 10);
}

function paintSoilBoard(ctx) {
  fill(ctx, "#6a4a22");
  ctx.fillStyle = "#5a3a18";
  for (let x = 0; x < SIZE; x += 40) {
    ctx.fillRect(x, 0, 18, SIZE);
  }
  ctx.fillStyle = "rgba(90, 140, 50, 0.2)";
  for (let i = 0; i < 20; i += 1) {
    ctx.fillRect((i * 61) % SIZE, (i * 37) % SIZE, 8, 22);
  }
  addNoise(ctx, 20);
}

export function makeThemeBoard(themeId) {
  const { canvas, ctx } = makeCanvas();
  if (themeId === "flower") paintStoneBoard(ctx);
  else if (themeId === "stationery") paintBlotterBoard(ctx);
  else if (themeId === "veg") paintSoilBoard(ctx);
  else if (themeId === "pastry") paintMarbleBoard(ctx);
  else if (themeId === "candy") paintCandyBoard(ctx);
  else paintStallBoard(ctx);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(themeId === "flower" ? 2.2 : themeId === "stationery" ? 1.4 : 3, 1.4);
  return texture;
}

export function makeAwningTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#c43a32" : "#f4ead4";
    ctx.fillRect((i / 10) * 512, 0, 52, 128);
  }
  ctx.fillStyle = "#5a2810";
  ctx.fillRect(0, 0, 512, 10);
  ctx.font = "700 42px PingFang TC, sans-serif";
  ctx.fillStyle = "#5a2810";
  ctx.textAlign = "center";
  ctx.fillText("水果攤", 256, 84);
  ctx.fillStyle = "#f4ead4";
  ctx.fillText("水果攤", 256, 80);
  return toTexture(canvas);
}

export function makeSliceTexture(type) {
  const { canvas, ctx } = makeCanvas();
  (FACE_PAINTERS[type] || paintWoodRings)(ctx);
  return toTexture(canvas);
}

export function makeSideTexture(type) {
  const { canvas, ctx } = makeCanvas();
  (SIDE_PAINTERS[type] || paintWoodSide)(ctx);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function makeOuterCapTexture(type) {
  if (type === "lemon" || type === "banana" || type === "apple" || type === "orange") {
    return makeSideTexture(type);
  }
  if (type === "pencil") return makeSliceTexture("pencil");
  return makeSideTexture(type);
}
