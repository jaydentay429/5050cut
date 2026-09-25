import { CONFIG } from "./config.js?v=100";
import { TYPE_LABELS } from "./object.js?v=70";

const TROPHY_CHIP = {
  none: { fill: "rgba(16, 12, 9, 0.45)", text: "rgba(243, 230, 208, 0.55)", stroke: "rgba(243, 230, 208, 0.28)" },
  seen: { fill: "rgba(243, 230, 208, 0.16)", text: "#f3e6d0", stroke: "rgba(243, 230, 208, 0.7)" },
  bronze: { fill: "#8a4a22", text: "#ffd4a8", stroke: "#e0a060" },
  gold: { fill: "#d4a024", text: "#2a1c12", stroke: "#ffe08a" },
};

const SHOP_HINTS = {
  retry: "断连后立刻再切同一件",
  guide: "下一刀画出正中线",
  summon: "指定一件已切开的物品出现",
};

export function uiScale(width, height) {
  return Math.min(width / 390, height / 700, 1.35);
}

function layoutBuyConfirm(width, height) {
  const s = uiScale(width, height);
  const boxW = Math.min(320, width - 40);
  const boxH = Math.max(188, 200 * s);
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.38;
  const menuH = Math.max(42, 46 * s);
  const cw = (boxW - 12) / 2;
  const cy = boxY + boxH - menuH - 20;
  return {
    "cancel-buy": {
      id: "cancel-buy",
      label: "取消",
      kind: "ghost",
      x: boxX,
      y: cy,
      w: cw,
      h: menuH,
    },
    "confirm-buy": {
      id: "confirm-buy",
      label: "确认",
      x: boxX + cw + 12,
      y: cy,
      w: cw,
      h: menuH,
    },
  };
}

function itemChipLabel(name, count, price) {
  if (count > 0) return `${name}  ×${count}`;
  return `${name}  ${price}币`;
}

function drawBuyConfirm(ctx, width, height, model) {
  const prompt = model.pendingPrompt;
  const item = prompt?.item || model.pendingBuy;
  if (!item) return;
  const mode = prompt?.mode || "buy";
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const names = { retry: "再试刀", guide: "准星", summon: "点名" };
  const cost = model.prices?.[item] ?? CONFIG.economy.prices[item];
  ctx.fillStyle = "rgba(8, 6, 4, 0.72)";
  ctx.fillRect(0, 0, width, height);
  const boxW = Math.min(320, width - 40);
  const boxH = Math.max(188, 200 * s);
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.38;
  fillPlate(ctx, boxX, boxY, boxW, boxH, 18, "rgba(16, 12, 9, 0.94)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.35)";
  ctx.lineWidth = 1.6;
  roundRect(ctx, boxX, boxY, boxW, boxH, 18);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(18, 20 * s), "800");
  ctx.fillText(mode === "use" ? "确认使用" : "确认购买", width / 2, boxY + Math.max(36, 40 * s));
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 15 * s), "600");
  ctx.fillText(
    mode === "use" ? `使用 1 个${names[item] || ""}？` : `花 ${cost} 币买 1 个${names[item] || ""}？`,
    width / 2,
    boxY + Math.max(64, 70 * s),
  );
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(SHOP_HINTS[item] || "", width / 2, boxY + Math.max(88, 96 * s));
  drawButton(ctx, model.buttons["cancel-buy"], {
    hovered: model.hoveredId === "cancel-buy",
    pressed: model.pressedId === "cancel-buy",
  });
  drawButton(ctx, model.buttons["confirm-buy"], {
    hovered: model.hoveredId === "confirm-buy",
    pressed: model.pressedId === "confirm-buy",
  });
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
    label: muted ? "开声音" : "关声音",
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

  if (options.paused) {
    const w = Math.min(280 * s, width - pad * 2);
    const h = Math.max(48, 54 * s);
    return {
      resume: {
        id: "resume",
        label: "继续",
        x: (width - w) / 2,
        y: height * 0.52,
        w,
        h,
      },
      mute,
    };
  }

  if (state === "menu") {
    const w = Math.min(280 * s, width - pad * 2);
    const h = Math.max(48, 54 * s);
    const unlocked = options.unlockedCount ?? 0;
    const total = options.catalogTotal ?? 0;
    const startY = height * 0.58;
    return {
      start: {
        id: "start",
        label: "开始游戏",
        x: (width - w) / 2,
        y: startY,
        w,
        h,
      },
      codex: {
        id: "codex",
        label: total ? `图鉴  ${unlocked}/${total}` : "图鉴",
        kind: "ghost",
        x: (width - w) / 2,
        y: startY + h + 10,
        w,
        h: Math.max(42, 46 * s),
      },
      shop: {
        id: "shop",
        label: "商店",
        kind: "ghost",
        x: (width - w) / 2,
        y: startY + h + 10 + Math.max(42, 46 * s) + 10,
        w: (w - 10) / 2,
        h: Math.max(42, 46 * s),
      },
      achieve: {
        id: "achieve",
        label: "成就",
        kind: "ghost",
        x: (width - w) / 2 + (w - 10) / 2 + 10,
        y: startY + h + 10 + Math.max(42, 46 * s) + 10,
        w: (w - 10) / 2,
        h: Math.max(42, 46 * s),
      },
      mute,
    };
  }

  if (state === "shop") {
    const prices = options.prices || CONFIG.economy.prices;
    const inv = options.inventory || {};
    const shareN = options.shareTokens ?? CONFIG.economy.shareTokens;
    const adN = options.adTokens ?? CONFIG.economy.adTokens;
    const ready = options.shareReady || {};
    const w = Math.min(320, width - pad * 2);
    const x = (width - w) / 2;
    const buyH = Math.max(52, 56 * s);
    const shareH = Math.max(40, 44 * s);
    const gap = 8;
    const headerH = Math.max(78, 86 * s);
    const section = Math.max(28, 32 * s);
    const menuH = Math.max(42, 46 * s);
    const stack =
      headerH +
      section +
      buyH * 3 +
      gap * 2 +
      section +
      shareH +
      12 +
      menuH;
    const panelY = Math.max(pad, Math.min(height * 0.08, (height - stack - pad - 52) / 2));
    let y = panelY + headerH + section;
    const buy = (id, name, key, cost) => ({
      id,
      label: name,
      hint: SHOP_HINTS[key],
      price: cost,
      hold: inv[key] || 0,
      kind: "shopBuy",
      x,
      y: 0,
      w,
      h: buyH,
    });
    const buttons = {
      "buy-retry": buy("buy-retry", "再试刀", "retry", prices.retry ?? 3),
      "buy-guide": buy("buy-guide", "准星", "guide", prices.guide ?? 2),
      "buy-summon": buy("buy-summon", "点名", "summon", prices.summon ?? 5),
    };
    buttons["buy-retry"].y = y;
    buttons["buy-guide"].y = y + buyH + gap;
    buttons["buy-summon"].y = y + (buyH + gap) * 2;
    const shareY = y + (buyH + gap) * 3 + section;
    const sw = (w - 12) / 3;
    const shareLabel = (key, name) => (ready[key] === false ? "已领" : `${name} +${shareN}`);
    buttons["share-fb"] = {
      id: "share-fb",
      label: shareLabel("fb", "FB"),
      kind: "ghost",
      x,
      y: shareY,
      w: sw,
      h: shareH,
    };
    buttons["share-x"] = {
      id: "share-x",
      label: shareLabel("x", "X"),
      kind: "ghost",
      x: x + sw + 6,
      y: shareY,
      w: sw,
      h: shareH,
    };
    buttons["share-threads"] = {
      id: "share-threads",
      label: shareLabel("threads", "Threads"),
      kind: "ghost",
      x: x + (sw + 6) * 2,
      y: shareY,
      w: sw,
      h: shareH,
    };
    const adY = shareY + shareH + section;
    buttons["ad-token"] = {
      id: "ad-token",
      label: `看广告  +${adN}币`,
      kind: "ghost",
      x,
      y: adY,
      w,
      h: shareH,
    };
    buttons.menu = {
      id: "menu",
      label: "返回",
      kind: "ghost",
      x,
      y: adY + shareH + 12,
      w,
      h: menuH,
    };
    buttons.mute = mute;
    if (options.pendingPrompt) Object.assign(buttons, layoutBuyConfirm(width, height));
    buttons._shop = { panelY, panelW: w, panelX: x, stack, headerH, section, shareN, adN };
    return buttons;
  }

  if (state === "achieve") {
    const menuH = Math.max(42, 46 * s);
    const gap = 10;
    const menuX = mute.x + mute.w + gap;
    return {
      mute: { ...mute, y: height - pad - menuH, h: menuH },
      menu: {
        id: "menu",
        label: "返回",
        kind: "ghost",
        x: menuX,
        y: height - pad - menuH,
        w: width - pad - menuX,
        h: menuH,
      },
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
        y: height * 0.58,
        w,
        h,
      },
      menu: {
        id: "menu",
        label: "返回菜单",
        x: (width - w) / 2,
        y: height * 0.58 + h + 12,
        w,
        h,
      },
      mute,
    };
  }

  if (options.summonPicker) {
    return layoutSummon(width, height, options.summonTypes || [], muted, options.summonScroll || 0);
  }

  const w = Math.max(72, 88 * s);
  const h = Math.max(36, 40 * s);
  const buttons = {
    restart: {
      id: "restart",
      label: "重开",
      x: width - pad - w,
      y: pad,
      w,
      h,
    },
    mute: { ...mute, y: pad },
  };
  const prices = options.prices || CONFIG.economy.prices;
  const inv = options.inventory || {};
  if (state === "feedback" && options.fatalBreak) {
    const bw = Math.min(280 * s, width - pad * 2);
    const bh = Math.max(50, 56 * s);
    const retryN = inv.retry || 0;
    buttons["use-retry"] = {
      id: "use-retry",
      label: retryN > 0 ? `再试刀  ×${retryN}` : `再试刀  ${prices.retry ?? 3}币`,
      x: (width - bw) / 2,
      y: height * 0.58,
      w: bw,
      h: bh,
    };
    buttons["skip-retry"] = {
      id: "skip-retry",
      label: "结束本局",
      kind: "ghost",
      x: (width - bw) / 2,
      y: height * 0.58 + bh + 12,
      w: bw,
      h: Math.max(42, 46 * s),
    };
    if (options.pendingPrompt) Object.assign(buttons, layoutBuyConfirm(width, height));
    return buttons;
  }
  const chipW = Math.max(92, 108 * s);
  const chipH = Math.max(36, 40 * s);
  const gap = 8;
  const chips = [
    {
      id: "use-guide",
      label: itemChipLabel("准星", inv.guide || 0, prices.guide ?? 2),
    },
    {
      id: "use-summon",
      label: itemChipLabel("点名", inv.summon || 0, prices.summon ?? 5),
    },
  ];
  const totalW = chips.length * chipW + (chips.length - 1) * gap;
  const startX = (width - totalW) / 2;
  chips.forEach((chip, i) => {
    buttons[chip.id] = {
      id: chip.id,
      label: chip.label,
      kind: "ghost",
      x: startX + i * (chipW + gap),
      y: height - pad - chipH,
      w: chipW,
      h: chipH,
    };
  });
  if (options.pendingPrompt) Object.assign(buttons, layoutBuyConfirm(width, height));
  return buttons;
}

function layoutSummon(width, height, types, muted, scrollY) {
  const s = uiScale(width, height);
  const pad = Math.max(12, 16 * s);
  const mute = muteButton(width, height, muted);
  const barH = Math.max(42, 46 * s);
  mute.y = height - pad - barH;
  mute.h = barH;
  const gapBtn = 10;
  const cancelX = mute.x + mute.w + gapBtn;
  const buttons = {
    mute,
    "summon-cancel": {
      id: "summon-cancel",
      label: "取消",
      kind: "ghost",
      x: cancelX,
      y: mute.y,
      w: width - pad - cancelX,
      h: barH,
    },
  };
  const cols = 4;
  const cellH = Math.max(36, 40 * s);
  const gap = 6;
  const gridW = width - pad * 2;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const gridTop = height * 0.26;
  const gridBottom = mute.y - 12;
  const rows = Math.max(1, Math.ceil(types.length / cols));
  const contentH = rows * (cellH + gap) - gap;
  const viewH = Math.max(40, gridBottom - gridTop);
  const maxScroll = Math.max(0, contentH - viewH);
  const scroll = Math.max(0, Math.min(maxScroll, scrollY || 0));
  types.forEach((type, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const y = gridTop + row * (cellH + gap) - scroll;
    if (y + cellH < gridTop + 1 || y > gridBottom - 1) return;
    buttons[`summon-${type}`] = {
      id: `summon-${type}`,
      label: TYPE_LABELS[type] || type,
      kind: "ghost",
      x: pad + col * (cellW + gap),
      y,
      w: cellW,
      h: cellH,
    };
  });
  buttons._summon = {
    gridTop,
    gridBottom,
    maxScroll,
    scroll,
    cellH,
    gap,
    cols,
    pad,
    cellW,
    types,
  };
  return buttons;
}

export function layoutOrbitPad(width, height, anchor) {
  const s = uiScale(width, height);
  const inset = Math.max(10, 12 * s);
  const size = Math.max(68, Math.min(86, 80 * s));
  const gap = Math.max(44, 52 * s);
  const restartH = Math.max(36, 40 * s);
  const right = Number.isFinite(anchor?.x) ? anchor.x : width * 0.62;
  const midY = Number.isFinite(anchor?.y) ? anchor.y : height * 0.48;
  let x = right + gap;
  let y = midY - size / 2;
  x = Math.min(width - inset - size, Math.max(inset, x));
  y = Math.min(height - inset - size, Math.max(inset + restartH + 6, y));
  return { x, y, w: size, h: size };
}

export function hitOrbitPad(pad, point) {
  if (!pad || !point) return false;
  const extra = Math.max(12, pad.w * 0.1);
  return pointInRect(point, {
    x: pad.x - extra,
    y: pad.y - extra,
    w: pad.w + extra * 2,
    h: pad.h + extra * 2,
  });
}

export function layoutCodex(width, height, muted = false, themeId = "fruit") {
  const s = uiScale(width, height);
  const pad = Math.max(12, 16 * s);
  const backH = Math.max(40, 44 * s);
  const captionH = Math.max(36, 40 * s);
  const tabGap = Math.max(6, 7 * s);
  const tabH = Math.max(32, 36 * s);
  const tabCount = CONFIG.themes.order.length;
  const tabCols = Math.min(5, tabCount);
  const tabRows = Math.ceil(tabCount / tabCols);
  const tabY = pad;
  const tabBarH = tabRows * (tabH + tabGap) - tabGap;
  const btnY = height - pad - backH;
  const mute = { ...muteButton(width, height, muted), y: btnY, h: backH };
  const buttons = {
    menu: {
      id: "menu",
      label: "返回",
      kind: "ghost",
      x: width - pad - Math.max(88, 108 * s),
      y: btnY,
      w: Math.max(88, 108 * s),
      h: backH,
    },
    mute,
  };

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
  const cols = Math.min(5, objects.length);
  const rows = Math.ceil(objects.length / cols);
  const cellH = Math.max(38, Math.min(46 * s, 48));
  const gridH = rows * cellH + gap * Math.max(0, rows - 1);
  const trophyStrip = Math.max(28, 30 * s);
  const panelTop = Math.round(tabY + tabBarH + 8);
  const gridY = btnY - 10 - gridH;
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

  return { buttons, panelTop, activeTheme: active, captionH, tabY, tabBarH, gridY, gridH, trophyStrip };
}

export function hitButton(buttons, point) {
  if (!point) return null;
  const list = Object.values(buttons);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (!list[i].id || list[i].id.startsWith("_")) continue;
    if (pointInRect(point, list[i])) return list[i];
  }
  return null;
}

function drawButton(ctx, button, { hovered, pressed, pulse = false, time = 0 }) {
  if (!button) return;
  const spec = CONFIG.ui;

  if (button.kind === "codex") return;
  if (button.kind === "shopBuy") {
    const fill = pressed ? spec.accentDown : spec.accent;
    ctx.save();
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
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = font(Math.max(15, button.h * 0.3), "800");
    ctx.fillText(button.label, button.x + 18, button.y + button.h * 0.38);
    if (button.hint) {
      ctx.globalAlpha = 0.72;
      ctx.font = font(Math.max(11, button.h * 0.22), "600");
      ctx.fillText(button.hint, button.x + 18, button.y + button.h * 0.7);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "right";
    ctx.font = font(Math.max(13, button.h * 0.26), "700");
    ctx.fillText(`${button.price}币`, button.x + button.w - 16, button.y + button.h * 0.36);
    ctx.font = font(Math.max(11, button.h * 0.22), "600");
    ctx.globalAlpha = 0.7;
    ctx.fillText(`持有 ${button.hold ?? 0}`, button.x + button.w - 16, button.y + button.h * 0.68);
    ctx.globalAlpha = 1;
    return;
  }
  if (pulse) {
    const glow = 0.12 + Math.sin(time * 5) * 0.08;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = spec.accent;
    roundRect(ctx, button.x - 6, button.y - 6, button.w + 12, button.h + 12, (button.h + 12) / 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  if (button.kind === "ghost" || button.kind === "tab" || button.kind === "yaw") {
    const round = button.kind === "yaw" ? button.h / 2 : button.h / 2;
    roundRect(ctx, button.x, button.y, button.w, button.h, round);
    const on = button.kind === "tab" && button.active;
    ctx.fillStyle = on || pressed
      ? "rgba(224, 122, 61, 0.38)"
      : "rgba(243, 230, 208, 0.12)";
    ctx.fill();
    ctx.strokeStyle = on || hovered || pressed ? spec.cream : "rgba(243, 230, 208, 0.45)";
    ctx.lineWidth = on || hovered || pressed ? 2 : 1.5;
    ctx.stroke();
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(11, button.h * (button.kind === "yaw" ? 0.48 : button.kind === "tab" ? 0.32 : button.w < 120 ? 0.28 : 0.36)), "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + (button.kind === "yaw" ? -1 : 1));
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

function itemSpan(model) {
  const b = model.itemBounds;
  if (!b || !Number.isFinite(b.width)) return 96;
  return Math.max(22, Math.min(b.width, b.height));
}

function strokePx(model, base) {
  const t = Math.max(0.4, Math.min(1, itemSpan(model) / 108));
  return Math.max(1.2, base * t);
}

function drawCutGuide(ctx, width, height, model) {
  const g = model.guideLine;
  const c = g || model.centerScreen;
  if (!c || !Number.isFinite(c.x)) return;
  const b = model.itemBounds;
  const x = c.x;
  const y0 = Number.isFinite(c.y0) ? c.y0 : b ? b.y + 2 : Math.max(36, (c.y || height * 0.48) - height * 0.22);
  const y1 = Number.isFinite(c.y1) ? c.y1 : b ? b.y + b.height - 2 : Math.min(height - 72, (c.y || height * 0.48) + height * 0.22);
  ctx.save();
  ctx.strokeStyle = "rgba(12, 10, 8, 0.82)";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([7, 6]);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.restore();
}

function drawStroke(ctx, stroke, color, width) {
  if (!stroke) return;
  ctx.save();
  ctx.lineCap = "round";
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
  const statsY = height * 0.34;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(34, 50 * s), "800");
  ctx.shadowColor = "rgba(16, 12, 9, 0.55)";
  ctx.shadowBlur = 12;
  ctx.fillText(spec.title, width / 2, height * 0.13);
  ctx.shadowBlur = 0;

  const colW = Math.min(width - 48, Math.max(300, 340 * s));
  const left = (width - colW) / 2;
  const mid = width / 2;
  const high = String(model.highScore ?? 0);
  const collect = `${model.collection ?? 0}`;
  const collectMax = `${model.collectionMax ?? 10000}`;

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(28, 34 * s), "800");
  ctx.fillText(high, mid, statsY);
  ctx.fillStyle = "rgba(243, 230, 208, 0.72)";
  ctx.font = font(Math.max(11, 12 * s), "600");
  ctx.fillText("历史最高", mid, statsY + Math.max(20, 22 * s));

  const ruleY = statsY + Math.max(36, 40 * s);
  ctx.strokeStyle = "rgba(224, 122, 61, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 24, ruleY);
  ctx.lineTo(left + colW - 24, ruleY);
  ctx.stroke();
  ctx.fillStyle = spec.accent;
  ctx.beginPath();
  ctx.arc(mid, ruleY, 2.4, 0, Math.PI * 2);
  ctx.fill();

  const rowY = ruleY + Math.max(22, 26 * s);
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(16, 18 * s), "800");
  ctx.fillText(`${collect} / ${collectMax}`, mid, rowY);
  ctx.fillStyle = "rgba(243, 230, 208, 0.72)";
  ctx.font = font(Math.max(11, 12 * s), "600");
  ctx.fillText("收藏分", mid, rowY + Math.max(16, 18 * s));

  let stampY = rowY + Math.max(40, 44 * s);
  if (model.grandTrophy) {
    ctx.fillStyle = spec.accent;
    ctx.font = font(Math.max(12, 13 * s), "800");
    ctx.fillText("刀神奖杯", mid, stampY);
    stampY += Math.max(22, 24 * s);
  }
  if (model.dailyTheme) {
    const tag = `今日 · ${model.dailyTheme}  隐藏×2`;
    ctx.font = font(Math.max(12, 13 * s), "700");
    const tw = ctx.measureText(tag).width + 22;
    const th = Math.max(22, 24 * s);
    const tx = mid - tw / 2;
    roundRect(ctx, tx, stampY - th / 2, tw, th, th / 2);
    ctx.fillStyle = "rgba(28, 20, 14, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(243, 230, 208, 0.92)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = spec.cream;
    ctx.fillText(tag, mid, stampY + 0.5);
  }

  drawButton(ctx, model.buttons.start, {
    hovered: model.hoveredId === "start",
    pressed: model.pressedId === "start",
  });
  drawButton(ctx, model.buttons.codex, {
    hovered: model.hoveredId === "codex",
    pressed: model.pressedId === "codex",
  });
  drawButton(ctx, model.buttons.shop, {
    hovered: model.hoveredId === "shop",
    pressed: model.pressedId === "shop",
  });
  drawButton(ctx, model.buttons.achieve, {
    hovered: model.hoveredId === "achieve",
    pressed: model.pressedId === "achieve",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
  drawTokenToast(ctx, width, height, model);
}

function drawCodex(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const layout = layoutCodex(width, height, model.muted, model.codexTheme);
  const catalog = model.catalog || {};
  const total = model.catalogTotal || 0;
  const unlocked = model.unlockedCount || 0;
  const pad = Math.max(12, 16 * s);

  const topEnd = layout.panelTop + layout.captionH + 8;
  const topScrim = ctx.createLinearGradient(0, 0, 0, topEnd);
  topScrim.addColorStop(0, "rgba(16, 12, 9, 0.72)");
  topScrim.addColorStop(0.72, "rgba(16, 12, 9, 0.4)");
  topScrim.addColorStop(1, "rgba(16, 12, 9, 0)");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, topEnd);

  const dockTop = (layout.gridY || height * 0.7) - (layout.trophyStrip || 28) - 6;
  const dockFade = ctx.createLinearGradient(0, dockTop - 28, 0, dockTop + 8);
  dockFade.addColorStop(0, "rgba(16, 12, 9, 0)");
  dockFade.addColorStop(1, "rgba(16, 12, 9, 0.78)");
  ctx.fillStyle = dockFade;
  ctx.fillRect(0, dockTop - 28, width, 36);
  ctx.fillStyle = "rgba(16, 12, 9, 0.78)";
  ctx.fillRect(0, dockTop + 8, width, height - dockTop - 8);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(11, 12 * s), "600");
  ctx.fillText(`${unlocked} / ${total}`, pad, layout.panelTop + layout.captionH * 0.5);
  ctx.textAlign = "right";
  ctx.fillText(`收藏分  ${model.collection ?? 0} / ${model.collectionMax ?? 10000}`, width - pad, layout.panelTop + layout.captionH * 0.5);

  ctx.textAlign = "center";
  if (model.codexSelected && catalog[model.codexSelected]) {
    const entry = catalog[model.codexSelected];
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(16, 18 * s), "800");
    ctx.fillText(TYPE_LABELS[model.codexSelected] || model.codexSelected, width / 2, layout.panelTop + 12);
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillStyle = spec.creamDim;
    ctx.fillText(`切开 ${entry.cuts} 次 · 最佳 ${entry.best}`, width / 2, layout.panelTop + 12 + Math.max(16, 17 * s));
  } else {
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(13, 14 * s), "600");
    ctx.fillText(unlocked ? "点选已解锁的物品" : "切开物体后会收入这里", width / 2, layout.panelTop + layout.captionH * 0.5);
  }

  const trophy = model.stallTrophy;
  const trophyName = trophy ? (model.trophyLabel?.[trophy] || trophy) : "尚未集齐";
  const chip = TROPHY_CHIP[trophy] || TROPHY_CHIP.none;
  ctx.font = font(Math.max(12, 13 * s), "800");
  const chipW = Math.max(56, ctx.measureText(trophyName).width + 16);
  const chipH = Math.max(20, 22 * s);
  const chipY = (layout.gridY || dockTop) - (layout.trophyStrip || 28) + 4;
  roundRect(ctx, pad, chipY, chipW, chipH, chipH / 2);
  ctx.fillStyle = chip.fill;
  ctx.fill();
  ctx.strokeStyle = chip.stroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = chip.text;
  ctx.textAlign = "center";
  ctx.fillText(trophyName, pad + chipW / 2, chipY + chipH / 2 + 0.5);

  const stars = model.stallStars || [];
  const starSize = Math.max(9, 10 * s);
  const starGap = 5;
  let starX = pad + chipW + 14 + starSize / 2;
  const starY = chipY + chipH / 2;
  for (const rank of stars) {
    ctx.beginPath();
    ctx.arc(starX, starY, starSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = rank >= 3 ? "#f6c56a" : rank >= 2 ? "#c56a28" : rank >= 1 ? "#f3e6d0" : "rgba(16, 12, 9, 0.45)";
    ctx.fill();
    if (rank === 0) {
      ctx.strokeStyle = "rgba(243, 230, 208, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (rank === 2) {
      ctx.strokeStyle = "#8a3a12";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    starX += starSize + starGap;
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
      ctx.fillText("？", button.x + button.w / 2, button.y + button.h * 0.5);
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

function fillPlate(ctx, x, y, w, h, r, fill = "rgba(8, 6, 4, 0.92)") {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTokenToast(ctx, width, height, model) {
  if (!model.tokenToast) return;
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  ctx.save();
  ctx.fillStyle = spec.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(Math.max(14, 16 * s), "800");
  const reason = model.tokenToast.reason ? `${model.tokenToast.reason}  ` : "";
  const msg = model.tokenToast.amount
    ? `${reason}+${model.tokenToast.amount}币`
    : model.tokenToast.reason || "奖励";
  ctx.fillText(msg, width / 2, height * 0.2);
  ctx.restore();
}

function drawHud(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const pad = Math.max(12, 16 * s);
  const muteH = Math.max(36, 40 * s);
  const x = pad;
  const y = pad + muteH + Math.max(8, 10 * s);
  const panelW = Math.max(132, 148 * s);
  const panelH = Math.max(108, 118 * s);

  ctx.save();
  fillPlate(ctx, x - 8, y - 8, panelW, panelH, 14);
  ctx.strokeStyle = "rgba(243, 230, 208, 0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - 8, y - 8, panelW, panelH, 14);
  ctx.stroke();
  ctx.fillStyle = spec.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(Math.max(26, 32 * s), "800");
  ctx.fillText(`${model.score}`, x, y);

  ctx.font = font(Math.max(13, 14 * s), "700");
  ctx.fillStyle = spec.cream;
  ctx.fillText("分数", x, y + Math.max(30, 36 * s));

  const comboY = y + Math.max(50, 58 * s);
  const comboHot = model.combo >= 3;
  if (comboHot) {
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(model.time * 6) * 0.06;
    ctx.fillStyle = spec.accent;
    roundRect(ctx, pad - 6, comboY - 4, Math.max(100, 118 * s), Math.max(26, 30 * s), 10);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = comboHot ? spec.accent : spec.cream;
  ctx.font = font(Math.max(15, comboHot ? 18 * s : 16 * s), "800");
  ctx.fillText(`连击  ${model.combo}`, x, comboY);

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(13, 14 * s), "700");
  ctx.fillText(`代币  ${model.tokens ?? 0}`, x, comboY + Math.max(28, 32 * s));
  ctx.restore();

  drawTokenToast(ctx, width, height, model);

  if (model.paused) return;

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
  for (const id of ["use-retry", "use-guide", "use-summon", "skip-retry"]) {
    if (!model.buttons[id]) continue;
    drawButton(ctx, model.buttons[id], {
      hovered: model.hoveredId === id,
      pressed: model.pressedId === id,
    });
  }
  if (model.orbitPad) {
    drawOrbitPad(ctx, model.orbitPad, {
      active: model.orbitActive,
      hover: model.orbitHover,
      time: model.time,
      nudge: model.orbitNudge,
    });
  }
}

function drawOrbitPad(ctx, pad, { active, hover, time, nudge }) {
  const spec = CONFIG.ui;
  const pulse = 0.12 + Math.sin((time || 0) * 3.2) * 0.05;
  const radius = Math.min(28, pad.w * 0.22);
  ctx.save();
  roundRect(ctx, pad.x, pad.y, pad.w, pad.h, radius);
  ctx.fillStyle = active ? "rgba(224, 122, 61, 0.34)" : "rgba(16, 12, 9, 0.5)";
  ctx.fill();
  ctx.strokeStyle = active || hover ? spec.accent : "rgba(243, 230, 208, 0.55)";
  ctx.lineWidth = active ? 2.6 : 1.8;
  ctx.stroke();

  const cx = pad.x + pad.w / 2 + (nudge?.x || 0);
  const cy = pad.y + pad.h * 0.46 + (nudge?.y || 0);
  const r = Math.min(pad.w, pad.h) * 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(243, 230, 208, ${0.28 + pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.4, 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.4, r, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = active ? spec.accent : spec.cream;
  ctx.fill();

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(13, pad.w * 0.12), "700");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("转动", pad.x + pad.w / 2, pad.y + pad.h - Math.max(14, pad.h * 0.14));
  ctx.restore();
}

function drawHint(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const boxW = Math.min(width - 24, Math.max(220, 252 * s));
  const boxH = Math.max(72, 80 * s);
  const itemX = model.centerScreen?.x ?? width / 2;
  const itemY = model.centerScreen?.y ?? height * 0.48;
  const orbit = model.orbitPad;
  let x = itemX - boxW / 2;
  if (orbit && x + boxW > orbit.x - 10) {
    x = Math.max(12, orbit.x - 10 - boxW);
  }
  x = Math.max(12, Math.min(x, width - 12 - boxW));
  let y = itemY + Math.max(78, 92 * s);
  y = Math.min(height - 18 - boxH, Math.max(itemY + 58, y));
  const pulse = 0.55 + Math.sin((model.time || 0) * 4) * 0.2;
  const r = 16;

  ctx.save();
  ctx.beginPath();
  const tipX = Math.max(x + 22, Math.min(itemX, x + boxW - 22));
  ctx.moveTo(tipX - 11, y + 1);
  ctx.lineTo(tipX, y - 14);
  ctx.lineTo(tipX + 11, y + 1);
  ctx.closePath();
  ctx.fillStyle = "rgba(8, 6, 4, 0.94)";
  ctx.fill();

  fillPlate(ctx, x, y, boxW, boxH, r, "rgba(8, 6, 4, 0.94)");
  ctx.strokeStyle = spec.accent;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 2.2;
  roundRect(ctx, x, y, boxW, boxH, r);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const tagW = Math.max(48, 56 * s);
  const tagH = Math.max(18, 20 * s);
  roundRect(ctx, x + 12, y + 10, tagW, tagH, tagH / 2);
  ctx.fillStyle = spec.accent;
  ctx.fill();
  ctx.fillStyle = spec.buttonText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(Math.max(11, 12 * s), "800");
  ctx.fillText("怎么玩", x + 12 + tagW / 2, y + 10 + tagH / 2 + 0.5);

  const iconX = x + 28;
  const iconY = y + boxH * 0.64;
  ctx.strokeStyle = spec.cream;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(iconX - 14 * s, iconY);
  ctx.lineTo(iconX + 16 * s, iconY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(iconX + 6 * s, iconY - 8 * s);
  ctx.lineTo(iconX + 16 * s, iconY);
  ctx.lineTo(iconX + 6 * s, iconY + 8 * s);
  ctx.stroke();

  ctx.fillStyle = spec.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = font(Math.max(15, 17 * s), "800");
  ctx.fillText("手指划过正中", x + 52 * s, y + boxH * 0.54);
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText("右边转盘可以转动", x + 52 * s, y + boxH * 0.76);
  ctx.restore();
}

function drawFeedback(ctx, width, height, model) {
  if (!model.lastResult) return;
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const { baseScore, gained, grade, combo, miss, fatal, shielded } = model.lastResult;
  const t = model.feedbackT;
  const perfect = !miss && baseScore >= CONFIG.score.perfectScore;
  const milestone = !miss && Boolean(model.lastResult.comboTitle);
  const nearMiss = Boolean(fatal) && !miss && baseScore >= 70;

  if (!miss && model.centerScreen && model.lastResult.cutX != null) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15);
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = strokePx(model, CONFIG.ui.strokeMark ?? 1.7);
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
    const mark = Math.max(12, Math.min(26, itemSpan(model) * 0.28));
    ctx.beginPath();
    ctx.moveTo(cutX - ux * mark, cutY - uy * mark);
    ctx.lineTo(cutX + ux * mark, cutY + uy * mark);
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
    let volumeLabel = `正中  ${leftPct}%  ·  ${rightPct}%`;
    if (ny > nx * 1.25 && ny > 0.55) volumeLabel = `正中  下${leftPct}%  ·  上${rightPct}%`;
    else if (nx > ny * 1.25 && nx > 0.55) volumeLabel = `正中  左${leftPct}%  ·  右${rightPct}%`;
    ctx.fillText(volumeLabel, 0, Math.max(70, 84 * s));

    if (model.lastResult.codexNew) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(13, 15 * s), "800");
      ctx.fillText("收入图鉴", 0, Math.max(88, 106 * s));
    }

    if (shielded) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(15, 18 * s), "800");
      ctx.fillText("护盾生效，这局保住了", 0, Math.max(94, 112 * s));
    } else if (nearMiss) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(15, 18 * s), "800");
      ctx.fillText("就差一点点", 0, Math.max(94, 112 * s));
    }
  } else if (fatal) {
    ctx.fillStyle = spec.accent;
    ctx.font = font(Math.max(15, 18 * s), "800");
    ctx.fillText("连击断开", 0, Math.max(36, 44 * s));
  }

  if (fatal) {
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(13, 14 * s), "700");
    ctx.fillText("点再试刀，切同一件", 0, miss ? Math.max(58, 70 * s) : Math.max(112, 132 * s));
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
  ctx.fillText(
    `收藏分  ${summary.collection ?? model.collection ?? 0} / ${summary.collectionMax ?? model.collectionMax ?? 10000}`,
    width / 2,
    height * 0.48,
  );
  if (summary.worlds) {
    ctx.fillText(
      `走到 ${summary.lastTheme || ""}（${summary.worlds}/${summary.worldTotal} 站）`,
      width / 2,
      height * 0.52,
    );
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
  drawTokenToast(ctx, width, height, model);
}

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

function drawShop(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const meta = model.buttons._shop || {};
  const shareN = model.shareTokens ?? meta.shareN ?? CONFIG.economy.shareTokens;
  const adN = model.adTokens ?? meta.adN ?? CONFIG.economy.adTokens;
  const buy = model.buttons["buy-retry"];
  const share = model.buttons["share-fb"];
  const ad = model.buttons["ad-token"];
  const back = model.buttons.menu;
  const panelX = meta.panelX ?? buy?.x ?? width * 0.1;
  const panelW = meta.panelW ?? buy?.w ?? width * 0.8;
  const panelY = meta.panelY ?? 24;
  const panelBottom = (back?.y || height * 0.85) + (back?.h || 44) + 16;

  ctx.fillStyle = "rgba(12, 9, 7, 0.62)";
  ctx.fillRect(0, 0, width, height);

  fillPlate(ctx, panelX - 14, panelY, panelW + 28, panelBottom - panelY, 22, "rgba(16, 12, 9, 0.82)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.22)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, panelX - 14, panelY, panelW + 28, panelBottom - panelY, 22);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(26, 32 * s), "800");
  ctx.fillText("商店", width / 2, panelY + Math.max(22, 26 * s));

  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(16, 18 * s), "800");
  ctx.fillText(`代币  ${model.tokens ?? 0}`, width / 2, panelY + Math.max(48, 54 * s));

  if (buy) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText("购买", buy.x, buy.y - Math.max(14, 16 * s));
  }
  if (share) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText("每日分享", share.x, share.y - Math.max(16, 18 * s));
    ctx.textAlign = "right";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillText(`每渠道 +${shareN}币 · 一天一次`, share.x + panelW, share.y - Math.max(16, 18 * s));
  }
  if (ad) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText("看广告", ad.x, ad.y - Math.max(16, 18 * s));
    ctx.textAlign = "right";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillText(`每次 +${adN}币 · 未开放`, ad.x + panelW, ad.y - Math.max(16, 18 * s));
  }

  for (const id of ["buy-retry", "buy-guide", "buy-summon", "share-fb", "share-x", "share-threads", "ad-token", "menu", "mute"]) {
    if (!model.buttons[id]) continue;
    drawButton(ctx, model.buttons[id], {
      hovered: model.hoveredId === id,
      pressed: model.pressedId === id,
    });
  }

  drawBuyConfirm(ctx, width, height, model);
  drawTokenToast(ctx, width, height, model);
}

function drawSummon(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const meta = model.buttons._summon || {};
  ctx.fillStyle = "rgba(12, 9, 7, 0.62)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(22, 26 * s), "800");
  ctx.fillText("点名一件已切开的物品", width / 2, height * 0.16);
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(`隐藏款另加 ${model.prices?.summonSecret ?? 15} 币，每天一次`, width / 2, height * 0.205);
  if (meta.maxScroll > 0) {
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillText("上下滑动查看", width / 2, height * 0.238);
  }

  const gridTop = meta.gridTop ?? height * 0.26;
  const gridBottom = meta.gridBottom ?? height * 0.82;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, gridTop, width, Math.max(0, gridBottom - gridTop));
  ctx.clip();
  for (const button of Object.values(model.buttons || {})) {
    if (!button?.id?.startsWith("summon-") || button.id === "summon-cancel") continue;
    drawButton(ctx, button, {
      hovered: model.hoveredId === button.id,
      pressed: model.pressedId === button.id,
    });
  }
  ctx.restore();

  if (meta.maxScroll > 0) {
    const trackH = gridBottom - gridTop;
    const thumbH = Math.max(24, trackH * (trackH / (trackH + meta.maxScroll)));
    const thumbY = gridTop + (trackH - thumbH) * (meta.scroll / meta.maxScroll);
    ctx.fillStyle = "rgba(243, 230, 208, 0.22)";
    roundRect(ctx, width - 10, gridTop, 4, trackH, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(243, 230, 208, 0.7)";
    roundRect(ctx, width - 10, thumbY, 4, thumbH, 2);
    ctx.fill();
  }

  drawButton(ctx, model.buttons["summon-cancel"], {
    hovered: model.hoveredId === "summon-cancel",
    pressed: model.pressedId === "summon-cancel",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}

function drawAchieve(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const list = model.achieveList || [];
  const unlocked = model.achieveUnlocked || {};
  const back = model.buttons.menu;
  const pad = Math.max(12, 16 * s);
  const panelX = pad;
  const panelW = width - pad * 2;
  const panelY = pad;
  const panelBottom = (back?.y || height - pad - 46) - 10;

  ctx.fillStyle = "rgba(12, 9, 7, 0.62)";
  ctx.fillRect(0, 0, width, height);
  fillPlate(ctx, panelX, panelY, panelW, panelBottom - panelY, 22, "rgba(16, 12, 9, 0.82)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.22)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, panelX, panelY, panelW, panelBottom - panelY, 22);
  ctx.stroke();

  const done = list.filter((row) => unlocked[row.id]).length;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(24, 30 * s), "800");
  ctx.fillText("成就", width / 2, panelY + Math.max(22, 26 * s));
  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(13, 14 * s), "700");
  ctx.fillText(`解锁得代币   ${done}/${list.length}`, width / 2, panelY + Math.max(46, 52 * s));

  const cols = 2;
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const gap = 8;
  const gridY = panelY + Math.max(64, 72 * s);
  const gridH = panelBottom - gridY - 8;
  const cellW = (panelW - 24 - gap) / cols;
  const cellH = Math.min(56, (gridH - gap * (rows - 1)) / rows);
  const startX = panelX + 12;

  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const col = i % cols;
    const r = Math.floor(i / cols);
    const x = startX + col * (cellW + gap);
    const y = gridY + r * (cellH + gap);
    const on = Boolean(unlocked[row.id]);
    roundRect(ctx, x, y, cellW, cellH, 12);
    ctx.fillStyle = on ? "rgba(224, 122, 61, 0.22)" : "rgba(243, 230, 208, 0.06)";
    ctx.fill();
    ctx.strokeStyle = on ? "rgba(224, 122, 61, 0.7)" : "rgba(243, 230, 208, 0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = on ? spec.cream : "rgba(243, 230, 208, 0.45)";
    ctx.font = font(Math.max(12, 13 * s), "800");
    ctx.fillText(row.title, x + 10, y + cellH * 0.38);
    ctx.fillStyle = on ? "rgba(243, 230, 208, 0.78)" : spec.creamDim;
    ctx.font = font(Math.max(10, 11 * s), "600");
    ctx.fillText(row.hint, x + 10, y + cellH * 0.72);
    ctx.textAlign = "right";
    ctx.fillStyle = on ? spec.cream : spec.accent;
    ctx.font = font(Math.max(11, 12 * s), "800");
    ctx.fillText(`+${row.tokens}`, x + cellW - 10, y + cellH * 0.38);
  }

  drawButton(ctx, model.buttons.menu, {
    hovered: model.hoveredId === "menu",
    pressed: model.pressedId === "menu",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
  drawTokenToast(ctx, width, height, model);
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

  if (state === "shop") {
    drawShop(ctx, width, height, model);
    return;
  }

  if (state === "achieve") {
    drawAchieve(ctx, width, height, model);
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
  if (model.summonPicker) {
    drawSummon(ctx, width, height, model);
    return;
  }

  if (model.themeJustChanged && model.themeName) {
    const s = uiScale(width, height);
    const station = (model.themeIndex ?? 0) + 1;
    const age = model.themeFlashAge ?? 0;
    const fade = age < 0.25 ? age / 0.25 : age > 1.35 ? Math.max(0, 1 - (age - 1.35) / 0.45) : 1;
    ctx.save();
    ctx.globalAlpha = 0.96 * fade;
    ctx.fillStyle = CONFIG.ui.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(Math.max(13, 15 * s), "700");
    ctx.fillText(`第 ${station} 站`, width / 2, height * 0.11);
    ctx.font = font(Math.max(24, 32 * s), "800");
    ctx.fillText(model.themeName, width / 2, height * 0.155);
    ctx.restore();
  }

  if (model.guideArmed && !model.summonPicker) {
    drawCutGuide(ctx, width, height, model);
  }

  if (model.showHint && !model.paused && !model.liveStroke) {
    drawHint(ctx, width, height, model);
  }

  if (model.liveStroke) {
    drawStroke(ctx, model.liveStroke, "rgba(243, 230, 208, 0.95)", strokePx(model, CONFIG.ui.strokeLive ?? 2.35));
  }

  if (state === "feedback" && !model.paused) {
    if (model.cutStroke) {
      drawStroke(ctx, model.cutStroke, "rgba(224, 122, 61, 0.95)", strokePx(model, CONFIG.ui.strokeCut ?? 1.85));
    }
    drawFeedback(ctx, width, height, model);
  }

  if (model.paused) {
    drawPause(ctx, width, height, model);
  } else {
    drawBuyConfirm(ctx, width, height, model);
  }
}

function drawPause(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  ctx.fillStyle = "rgba(16, 12, 9, 0.55)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = spec.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(Math.max(28, 36 * s), "800");
  ctx.fillText("暂停", width / 2, height * 0.4);
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 16 * s), "600");
  ctx.fillText("切到别处时会自动停下", width / 2, height * 0.4 + Math.max(28, 34 * s));
  if (model.buttons.resume) {
    drawButton(ctx, model.buttons.resume, {
      hovered: model.hoveredId === "resume",
      pressed: model.pressedId === "resume",
    });
  }
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
}
