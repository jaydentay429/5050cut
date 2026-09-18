import { CONFIG } from "./config.js";
import { themeTrail, TYPE_LABELS } from "./object.js";

export function uiScale(width, height) {
  return Math.min(width / 390, height / 700, 1.35);
}

function font(size, weight = "600") {
  return `${weight} ${size}px "PingFang TC", "Noto Sans TC", system-ui, sans-serif`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function muteButton(width, height, muted) {
  const s = uiScale(width, height);
  const pad = Math.max(12, 16 * s);
  const w = Math.max(64, 76 * s);
  const h = Math.max(36, 40 * s);
  return {
    id: "mute",
    label: muted ? "静音" : "声音",
    x: pad,
    y: height - pad - h,
    w,
    h,
  };
}

/** 按钮位置与游戏逻辑共用，保证点击区域和绘制一致。 */
export function layoutButtons(width, height, state, muted = false, options = {}) {
  const s = uiScale(width, height);
  const pad = Math.max(12, 16 * s);
  const mute = muteButton(width, height, muted);

  if (state === "menu") {
    const w = Math.min(280 * s, width - pad * 2);
    const h = Math.max(48, 54 * s);
    const unlocked = options.unlockedCount ?? 0;
    const total = options.catalogTotal ?? 0;
    return {
      start: {
        id: "start",
        label: "开始游戏",
        x: (width - w) / 2,
        y: height * 0.58,
        w,
        h,
      },
      codex: {
        id: "codex",
        label: total ? `图鉴  ${unlocked}/${total}` : "图鉴",
        kind: "ghost",
        x: (width - w) / 2,
        y: height * 0.58 + h + 12,
        w,
        h: Math.max(44, 48 * s),
      },
      mute,
    };
  }

  if (state === "codex") {
    return layoutCodex(width, height, muted, options.codexTheme).buttons;
  }

  if (state === "gameover") {
    const w = Math.min(280 * s, width - pad * 2);
    const h = Math.max(48, 52 * s);
    return {
      again: {
        id: "again",
        label: "再来一局",
        x: (width - w) / 2,
        y: height * 0.62,
        w,
        h,
      },
      menu: {
        id: "menu",
        label: "返回菜单",
        x: (width - w) / 2,
        y: height * 0.62 + h + 12,
        w,
        h,
      },
      mute,
    };
  }

  const w = Math.max(72, 88 * s);
  const h = Math.max(36, 40 * s);
  return {
    restart: {
      id: "restart",
      label: "重开",
      x: width - pad - w,
      y: pad,
      w,
      h,
    },
    mute,
  };
}

export function layoutCodex(width, height, muted = false, themeId = "fruit") {
  const s = uiScale(width, height);
  const pad = Math.max(12, 16 * s);
  const mute = muteButton(width, height, muted);
  const backH = Math.max(40, 44 * s);
  const wide = width >= 720;
  const panelTop = Math.round(height * (wide ? 0.6 : 0.52));
  const buttons = {
    menu: {
      id: "menu",
      label: "返回",
      kind: "ghost",
      x: width - pad - Math.max(88, 108 * s),
      y: height - pad - backH,
      w: Math.max(88, 108 * s),
      h: backH,
    },
    mute,
  };

  const captionH = Math.max(44, 52 * s);
  const tabGap = Math.max(6, 7 * s);
  const tabH = Math.max(32, 36 * s);
  const tabY = panelTop + captionH;
  const tabCount = CONFIG.themes.order.length;
  const tabCols = wide ? tabCount : Math.min(3, tabCount);
  const tabRows = Math.ceil(tabCount / tabCols);
  const tabW = (width - pad * 2 - tabGap * (tabCols - 1)) / tabCols;
  CONFIG.themes.order.forEach((id, i) => {
    const col = i % tabCols;
    const row = Math.floor(i / tabCols);
    buttons[`theme-${id}`] = {
      id: `theme-${id}`,
      themeId: id,
      label: CONFIG.themes[id].name,
      kind: "tab",
      x: pad + col * (tabW + tabGap),
      y: tabY + row * (tabH + tabGap),
      w: tabW,
      h: tabH,
    };
  });

  const active = CONFIG.themes[themeId] ? themeId : "fruit";
  const objects = CONFIG.themes[active].objects;
  const gap = Math.max(6, 7 * s);
  const cols = Math.min(wide ? 6 : 3, objects.length);
  const gridY = tabY + tabRows * (tabH + tabGap) + Math.max(8, 10 * s);
  const gridBottom = height - pad - backH - 8;
  const rows = Math.ceil(objects.length / cols);
  const cellH = Math.max(44, Math.min(58 * s, (gridBottom - gridY - gap * (rows - 1)) / rows));
  const cellW = (width - pad * 2 - gap * (cols - 1)) / cols;
  objects.forEach((type, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    buttons[`entry-${type}`] = {
      id: `entry-${type}`,
      type,
      x: pad + col * (cellW + gap),
      y: gridY + row * (cellH + gap),
      w: cellW,
      h: cellH,
      kind: "codex",
    };
  });

  return { buttons, panelTop, activeTheme: active, captionH };
}

export function hitButton(buttons, point) {
  if (!point) return null;
  for (const button of Object.values(buttons)) {
    if (pointInRect(point, button)) return button;
  }
  return null;
}

function drawButton(ctx, button, { hovered, pressed }) {
  if (!button) return;
  const spec = CONFIG.ui;

  if (button.kind === "codex") return;

  ctx.save();
  if (button.kind === "ghost" || button.kind === "tab") {
    roundRect(ctx, button.x, button.y, button.w, button.h, button.h / 2);
    const on = button.kind === "tab" && button.active;
    ctx.fillStyle = on ? "rgba(224, 122, 61, 0.32)" : "rgba(243, 230, 208, 0.1)";
    ctx.fill();
    ctx.strokeStyle = on || hovered || pressed ? spec.cream : "rgba(243, 230, 208, 0.45)";
    ctx.lineWidth = on || hovered || pressed ? 2 : 1.5;
    ctx.stroke();
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(13, button.h * (button.kind === "tab" ? 0.38 : 0.36)), "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
    ctx.restore();
    return;
  }

  const fill = pressed ? spec.accentDown : spec.accent;
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = hovered || pressed ? 16 : 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, button.x, button.y, button.w, button.h, button.h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  if (hovered && !pressed) {
    roundRect(ctx, button.x, button.y, button.w, button.h, button.h / 2);
    ctx.strokeStyle = spec.cream;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = spec.buttonText;
  ctx.font = font(Math.max(16, button.h * 0.38), "700");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
}

function drawStroke(ctx, stroke, color, width) {
  if (!stroke) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = width + 8;
  ctx.beginPath();
  ctx.moveTo(stroke.start.x, stroke.start.y);
  ctx.lineTo(stroke.end.x, stroke.end.y);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(stroke.start.x, stroke.start.y);
  ctx.lineTo(stroke.end.x, stroke.end.y);
  ctx.stroke();
  ctx.restore();
}

function drawMenu(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(32, 48 * s), "800");
  ctx.fillText(spec.title, width / 2, height * 0.13);

  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(13, 15 * s), "500");
  wrapText(ctx, spec.subtitle, width / 2, height * 0.13 + Math.max(28, 36 * s), width - 48, Math.max(18, 22 * s));

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(14, 16 * s), "600");
  ctx.fillText(`历史最高  ${model.highScore}`, width / 2, height * 0.5);

  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(11, 12 * s), "600");
  wrapText(ctx, model.themeTrail || themeTrail(), width / 2, height * 0.535, width - 56, Math.max(16, 18 * s));

  drawButton(ctx, model.buttons.start, {
    hovered: model.hoveredId === "start",
    pressed: model.pressedId === "start",
  });
  drawButton(ctx, model.buttons.codex, {
    hovered: model.hoveredId === "codex",
    pressed: model.pressedId === "codex",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}

function drawCodex(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const layout = layoutCodex(width, height, model.muted, model.codexTheme);
  const catalog = model.catalog || {};
  const total = model.catalogTotal || 0;
  const unlocked = model.unlockedCount || 0;
  const pad = Math.max(12, 16 * s);

  const fade = ctx.createLinearGradient(0, layout.panelTop - 36, 0, layout.panelTop + 28);
  fade.addColorStop(0, "rgba(16, 12, 9, 0)");
  fade.addColorStop(0.55, "rgba(16, 12, 9, 0.45)");
  fade.addColorStop(1, "rgba(16, 12, 9, 0.78)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, layout.panelTop - 36, width, 64);
  ctx.fillStyle = "rgba(16, 12, 9, 0.78)";
  ctx.fillRect(0, layout.panelTop + 28, width, height - layout.panelTop - 28);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(20, 26 * s), "800");
  ctx.fillText("图鉴", pad, Math.max(28, 34 * s));
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(`${unlocked} / ${total}`, pad, Math.max(50, 58 * s));

  ctx.textAlign = "center";
  if (model.codexSelected && catalog[model.codexSelected]) {
    const entry = catalog[model.codexSelected];
    const captionY = layout.panelTop + layout.captionH * 0.38;
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(18, 22 * s), "800");
    ctx.fillText(TYPE_LABELS[model.codexSelected] || model.codexSelected, width / 2, captionY);
    ctx.font = font(Math.max(12, 13 * s), "600");
    ctx.fillStyle = spec.creamDim;
    ctx.fillText(`切开 ${entry.cuts} 次 · 最佳 ${entry.best}`, width / 2, captionY + Math.max(18, 20 * s));
  } else {
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(13, 14 * s), "600");
    ctx.fillText(unlocked ? "点选已解锁的物品" : "切开物体后会收入这里", width / 2, layout.panelTop + layout.captionH * 0.5);
  }

  for (const button of Object.values(layout.buttons)) {
    if (button.kind === "tab") {
      button.active = button.themeId === layout.activeTheme;
      drawButton(ctx, button, {
        hovered: model.hoveredId === button.id,
        pressed: model.pressedId === button.id,
      });
    }
  }

  for (const button of Object.values(layout.buttons)) {
    if (button.kind !== "codex") continue;
    const entry = catalog[button.type];
    const selected = model.codexSelected === button.type;
    roundRect(ctx, button.x, button.y, button.w, button.h, 12);
    if (entry) {
      ctx.fillStyle = selected ? "rgba(224, 122, 61, 0.34)" : "rgba(243, 230, 208, 0.12)";
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = spec.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = spec.cream;
      ctx.font = font(Math.max(13, 14 * s), "700");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TYPE_LABELS[button.type] || button.type, button.x + button.w / 2, button.y + button.h * 0.42);
      ctx.fillStyle = spec.creamDim;
      ctx.font = font(Math.max(10, 11 * s), "600");
      ctx.fillText(`最佳 ${entry.best}`, button.x + button.w / 2, button.y + button.h * 0.7);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fill();
      ctx.fillStyle = "rgba(243, 230, 208, 0.35)";
      ctx.font = font(Math.max(18, 22 * s), "800");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("？", button.x + button.w / 2, button.y + button.h * 0.46);
      ctx.font = font(Math.max(10, 11 * s), "600");
      ctx.fillText("未切开", button.x + button.w / 2, button.y + button.h * 0.72);
    }
  }

  drawButton(ctx, layout.buttons.menu, {
    hovered: model.hoveredId === "menu",
    pressed: model.pressedId === "menu",
  });
  drawButton(ctx, layout.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = [...text];
  let line = "";
  let offset = 0;
  for (const char of chars) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset);
      line = char;
      offset += lineHeight;
    } else {
      line = next;
    }
  }
  ctx.fillText(line, x, y + offset);
}

function drawHud(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const pad = Math.max(12, 16 * s);

  ctx.save();
  ctx.shadowColor = spec.hudShadow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = spec.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(Math.max(18, 22 * s), "800");
  ctx.fillText(`${model.score}`, pad, pad);

  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillStyle = spec.creamDim;
  ctx.fillText("分数", pad, pad + Math.max(22, 26 * s));

  const comboY = pad + Math.max(44, 52 * s);
  const comboHot = model.combo >= 3;
  if (comboHot) {
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(model.time * 6) * 0.06;
    ctx.fillStyle = spec.accent;
    roundRect(ctx, pad - 6, comboY - 4, Math.max(108, 128 * s), Math.max(28, 32 * s), 10);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = comboHot ? spec.accent : spec.cream;
  ctx.font = font(Math.max(15, comboHot ? 20 * s : 17 * s), "800");
  ctx.fillText(`连击  ${model.combo}`, pad, comboY);

  const barY = comboY + Math.max(22, 26 * s);
  const barW = Math.max(92, 108 * s);
  const barH = Math.max(4, 5 * s);
  roundRect(ctx, pad, barY, barW, barH, barH / 2);
  ctx.fillStyle = "rgba(243, 230, 208, 0.18)";
  ctx.fill();
  const fillW = barW * Math.min(1, model.combo / 16);
  if (fillW > 1) {
    roundRect(ctx, pad, barY, fillW, barH, barH / 2);
    ctx.fillStyle = spec.accent;
    ctx.fill();
  }

  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(`最高  ${model.highScore}`, pad, barY + Math.max(12, 14 * s));
  if (model.typeLabel) {
    ctx.fillText(model.typeLabel, pad, barY + Math.max(32, 36 * s));
  }
  if (model.themeName) {
    ctx.fillText(model.themeName, pad, barY + Math.max(52, 58 * s));
  }
  ctx.restore();

  if (model.buttons.restart) {
    drawButton(ctx, model.buttons.restart, {
      hovered: model.hoveredId === "restart",
      pressed: model.pressedId === "restart",
    });
  }
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}

function drawHint(ctx, width, height, t) {
  const s = uiScale(width, height);
  const bob = Math.sin(t * 4) * 10;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = CONFIG.ui.cream;
  ctx.fillStyle = CONFIG.ui.cream;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const x = width / 2;
  const y = height * 0.38 + bob;
  ctx.beginPath();
  ctx.moveTo(x, y - 28 * s);
  ctx.lineTo(x, y + 18 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y + 4 * s);
  ctx.lineTo(x, y + 20 * s);
  ctx.lineTo(x + 12 * s, y + 4 * s);
  ctx.stroke();
  ctx.font = font(Math.max(13, 14 * s), "600");
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("任意角度都能切", x, y + 28 * s);
  ctx.restore();
}

function drawFeedback(ctx, width, height, model) {
  if (!model.lastResult) return;
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const { baseScore, gained, grade, combo, miss, ratio, fatal } = model.lastResult;
  const t = model.feedbackT;
  const perfect = !miss && baseScore >= CONFIG.score.perfectScore;
  const milestone = !miss && Boolean(model.lastResult.comboTitle);
  const nearMiss = Boolean(fatal) && !miss && baseScore >= 70;

  if (!miss && model.centerScreen && model.lastResult.cutX != null) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15);
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 3;
    const cutX = model.lastResult.cutX;
    const cutY = model.lastResult.cutY ?? model.centerScreen.y;
    const stroke = model.lastResult.stroke;
    let ux = 0;
    let uy = 1;
    if (stroke) {
      const sdx = stroke.end.x - stroke.start.x;
      const sdy = stroke.end.y - stroke.start.y;
      const slen = Math.hypot(sdx, sdy) || 1;
      ux = sdx / slen;
      uy = sdy / slen;
    }
    ctx.beginPath();
    ctx.moveTo(cutX - ux * 40, cutY - uy * 40);
    ctx.lineTo(cutX + ux * 40, cutY + uy * 40);
    ctx.stroke();
    ctx.restore();
  }

  if (perfect) {
    const rings = 3;
    for (let i = 0; i < rings; i += 1) {
      const rt = Math.min(1, t * 1.8 - i * 0.12);
      if (rt <= 0) continue;
      ctx.save();
      ctx.globalAlpha = (1 - rt) * 0.45;
      ctx.strokeStyle = spec.cream;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.42, 20 + rt * 90 + i * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  const scale =
    (perfect ? CONFIG.feedback.popupPeakScale + 0.2 : CONFIG.feedback.popupPeakScale) -
    0.35 * easeOut(t);
  const alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

  if (perfect && t < 0.22) {
    ctx.fillStyle = `rgba(255, 236, 210, ${0.18 * (1 - t / 0.22)})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (fatal && t < 0.38) {
    ctx.fillStyle = `rgba(140, 18, 12, ${0.22 * (1 - t / 0.38)})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(width / 2, height * 0.3);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(36, perfect ? 58 * s : 52 * s), "800");
  ctx.fillText(miss ? grade : String(baseScore), 0, 0);

  if (!miss) {
    ctx.font = font(Math.max(14, 16 * s), "700");
    ctx.fillStyle = baseScore >= CONFIG.score.comboMinScore ? spec.accent : spec.creamDim;
    ctx.fillText(grade, 0, Math.max(28, 36 * s));

    if (gained > baseScore) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(13, 14 * s), "600");
      ctx.fillText(`+${gained}  （连击 ×${combo}）`, 0, Math.max(50, 62 * s));
    }

    const leftPct = Math.round((model.lastResult.leftShare ?? 0.5) * 100);
    const rightPct = 100 - leftPct;
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(12, 13 * s), "600");
    const nx = Math.abs(model.lastResult.nx ?? 1);
    const ny = Math.abs(model.lastResult.ny ?? 0);
    let volumeLabel = `体积  ${leftPct}%  ·  ${rightPct}%`;
    if (ny > nx * 1.25 && ny > 0.55) volumeLabel = `体积  下${leftPct}%  ·  上${rightPct}%`;
    else if (nx > ny * 1.25 && nx > 0.55) volumeLabel = `体积  左${leftPct}%  ·  右${rightPct}%`;
    ctx.fillText(volumeLabel, 0, Math.max(70, 84 * s));

    if (model.lastResult.codexNew) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(13, 15 * s), "800");
      ctx.fillText("收入图鉴", 0, Math.max(88, 106 * s));
    }

    if (nearMiss) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(15, 18 * s), "800");
      ctx.fillText("就差一点点", 0, Math.max(94, 112 * s));
    }
  } else if (fatal) {
    ctx.fillStyle = spec.accent;
    ctx.font = font(Math.max(15, 18 * s), "800");
    ctx.fillText("连击断开", 0, Math.max(36, 44 * s));
  }

  if (milestone && t < 0.7) {
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - t / 0.7;
    ctx.fillStyle = spec.accent;
    ctx.textAlign = "center";
    ctx.font = font(Math.max(28, 36 * s), "800");
    ctx.fillText(model.lastResult.comboTitle || `连击 ×${combo}`, width / 2, height * 0.16);
  }
  ctx.restore();
}

function drawGameOver(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const summary = model.runSummary || {};

  ctx.fillStyle = "rgba(12, 9, 7, 0.55)";
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (summary.newRecord) {
    drawSparks(ctx, model.sparks);
  }

  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(16, 18 * s), "700");
  ctx.fillText(summary.newRecord ? "新纪录！" : "连击断开", width / 2, height * 0.2);

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(36, 48 * s), "800");
  ctx.fillText(String(summary.score ?? 0), width / 2, height * 0.3);

  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 16 * s), "600");
  ctx.fillText(summary.rank || "新刀", width / 2, height * 0.38);
  ctx.fillText(
    `最高连击 ${summary.maxCombo ?? 0}    最佳一刀 ${summary.bestCut ?? 0}`,
    width / 2,
    height * 0.44,
  );
  if (summary.worlds) {
    ctx.fillText(
      `走到 ${summary.lastTheme || ""}（${summary.worlds}/${summary.worldTotal} 站）`,
      width / 2,
      height * 0.49,
    );
  }
  if (!summary.newRecord && summary.gap > 0) {
    ctx.fillText(`再高 ${summary.gap} 分就破纪录`, width / 2, height * 0.54);
  } else {
    ctx.fillText(`历史最高  ${model.highScore}`, width / 2, height * 0.54);
  }

  drawButton(ctx, model.buttons.again, {
    hovered: model.hoveredId === "again",
    pressed: model.pressedId === "again",
  });
  drawButton(ctx, model.buttons.menu, {
    hovered: model.hoveredId === "menu",
    pressed: model.pressedId === "menu",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

function drawSparks(ctx, sparks) {
  if (!sparks?.length) return;
  ctx.save();
  for (const spark of sparks) {
    const remain = 1 - spark.age / spark.life;
    ctx.globalAlpha = Math.max(0, remain);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x - spark.w / 2, spark.y - spark.w / 2, spark.w, spark.w * 1.6);
  }
  ctx.restore();
}

export function renderUI(ctx, model) {
  const { width, height, state } = model;

  if (state === "menu") {
    drawMenu(ctx, width, height, model);
    return;
  }

  if (state === "codex") {
    drawCodex(ctx, width, height, model);
    return;
  }

  if (state === "gameover") {
    drawGameOver(ctx, width, height, model);
    return;
  }

  drawHud(ctx, width, height, model);
  drawSparks(ctx, model.sparks);

  if (model.themeJustChanged && model.themeName) {
    const s = uiScale(width, height);
    const station = (model.themeIndex ?? 0) + 1;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = CONFIG.ui.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(Math.max(13, 15 * s), "700");
    ctx.fillText(`第 ${station} 站`, width / 2, height * 0.11);
    ctx.font = font(Math.max(24, 32 * s), "800");
    ctx.fillText(model.themeName, width / 2, height * 0.155);
    ctx.restore();
  }

  if (model.showHint) {
    drawHint(ctx, width, height, model.time);
  }

  if (model.liveStroke) {
    drawStroke(ctx, model.liveStroke, "rgba(243, 230, 208, 0.95)", 5);
  }

  if (state === "feedback") {
    if (model.cutStroke) {
      drawStroke(ctx, model.cutStroke, "rgba(224, 122, 61, 0.95)", 4);
    }
    drawFeedback(ctx, width, height, model);
  }
}
