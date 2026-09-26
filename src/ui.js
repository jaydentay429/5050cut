import { CONFIG } from "./config.js?v=105";
import { achieveHint, achieveTitle, getLang, t, themeName, titleIdFromStored, typeLabel } from "./i18n.js?v=139";

const TROPHY_CHIP = {
  none: { fill: "rgba(16, 12, 9, 0.45)", text: "rgba(243, 230, 208, 0.55)", stroke: "rgba(243, 230, 208, 0.28)" },
  seen: { fill: "rgba(243, 230, 208, 0.16)", text: "#f3e6d0", stroke: "rgba(243, 230, 208, 0.7)" },
  bronze: { fill: "#8a4a22", text: "#ffd4a8", stroke: "#e0a060" },
  gold: { fill: "#d4a024", text: "#2a1c12", stroke: "#ffe08a" },
};

const SHOP_HINTS = {
  retry: () => t("hintRetry"),
  guide: () => t("hintGuide"),
  summon: () => t("hintSummon"),
};

export function uiScale(width, height) {
  return Math.min(width / 390, height / 700, 1.35);
}

export function uiSafe() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const n = (name) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : 0;
    };
    return { t: n("--safe-t"), r: n("--safe-r"), b: n("--safe-b"), l: n("--safe-l") };
  } catch {
    return { t: 0, r: 0, b: 0, l: 0 };
  }
}

function layoutPad(width, height) {
  const s = uiScale(width, height);
  const safe = uiSafe();
  const g = Math.max(12, 16 * s);
  return {
    s,
    g,
    l: g + safe.l,
    r: g + safe.r,
    t: g + safe.t,
    b: g + safe.b,
  };
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
      label: t("cancel"),
      kind: "ghost",
      x: boxX,
      y: cy,
      w: cw,
      h: menuH,
    },
    "confirm-buy": {
      id: "confirm-buy",
      label: t("confirm"),
      x: boxX + cw + 12,
      y: cy,
      w: cw,
      h: menuH,
    },
  };
}

function itemChipLabel(name, count, price) {
  if (count > 0) return `${name}  ×${count}`;
  return `${name}  ${price}${t("tokenUnit")}`;
}

function drawBuyConfirm(ctx, width, height, model) {
  const prompt = model.pendingPrompt;
  if (prompt?.mode === "lang") {
    drawLangPick(ctx, width, height, model);
    return;
  }
  const item = prompt?.item || model.pendingBuy;
  if (!item) return;
  const mode = prompt?.mode || "buy";
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const names = { retry: t("retry"), guide: t("guide"), summon: t("summon") };
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
  ctx.fillText(mode === "use" ? t("confirmUse") : t("confirmBuy"), width / 2, boxY + Math.max(36, 40 * s));
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 15 * s), "600");
  ctx.fillText(
    mode === "use"
      ? `${t("confirmUse")} · ${names[item] || ""}`
      : `${t("confirmBuy")} · ${cost}${t("tokenUnit")} ${names[item] || ""}`,
    width / 2,
    boxY + Math.max(64, 70 * s),
  );
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(SHOP_HINTS[item]?.() || "", width / 2, boxY + Math.max(88, 96 * s));
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
  const code = getLang();
  const family =
    code === "en"
      ? `"Avenir Next", "Segoe UI", system-ui, sans-serif`
      : code === "zh-Hans"
        ? `"PingFang SC", "Noto Sans SC", system-ui, sans-serif`
        : `"PingFang TC", "Noto Sans TC", system-ui, sans-serif`;
  return `${weight} ${size}px ${family}`;
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
  const p = layoutPad(width, height);
  const w = Math.max(72, 82 * p.s);
  const h = Math.max(40, 44 * p.s);
  return {
    id: "mute",
    label: muted ? t("muteOn") : t("muteOff"),
    x: p.l,
    y: height - p.b - h,
    w,
    h,
  };
}

function langButton(width, height, place = "top") {
  const p = layoutPad(width, height);
  const code = getLang();
  const two = code !== "en";
  const w = Math.max(52, 58 * p.s);
  const h = Math.max(40, 44 * p.s);
  const label = two ? t("lang") : "EN";
  const sub = two ? "en" : "";
  if (place === "dock") {
    const mute = muteButton(width, height, false);
    return {
      id: "lang",
      label,
      sub,
      kind: "ghost",
      x: mute.x + mute.w + Math.max(8, 8 * p.s),
      y: mute.y,
      w,
      h,
    };
  }
  return {
    id: "lang",
    label,
    sub,
    kind: "ghost",
    x: width - p.r - w,
    y: p.t,
    w,
    h,
  };
}

function layoutLangPick(width, height) {
  const s = uiScale(width, height);
  const boxW = Math.min(320, width - 40);
  const boxH = Math.max(220, 236 * s);
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.36;
  const btnH = Math.max(46, 50 * s);
  const gap = 10;
  const inner = 20;
  const y0 = boxY + Math.max(64, 72 * s);
  return {
    "lang-hans": {
      id: "lang-hans",
      label: t("langHans"),
      x: boxX + inner,
      y: y0,
      w: boxW - inner * 2,
      h: btnH,
    },
    "lang-hant": {
      id: "lang-hant",
      label: t("langHant"),
      x: boxX + inner,
      y: y0 + btnH + gap,
      w: boxW - inner * 2,
      h: btnH,
    },
    "lang-cancel": {
      id: "lang-cancel",
      label: t("cancel"),
      kind: "ghost",
      x: boxX + inner,
      y: y0 + (btnH + gap) * 2,
      w: boxW - inner * 2,
      h: Math.max(42, 46 * s),
    },
  };
}

function promptButtons(width, height, prompt) {
  if (!prompt) return {};
  if (prompt.mode === "lang") return layoutLangPick(width, height);
  return layoutBuyConfirm(width, height);
}

export function mergePromptButtons(buttons, width, height, prompt) {
  if (prompt) Object.assign(buttons, promptButtons(width, height, prompt));
  return buttons;
}

function drawLangPick(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  ctx.fillStyle = "rgba(8, 6, 4, 0.72)";
  ctx.fillRect(0, 0, width, height);
  const boxW = Math.min(320, width - 40);
  const boxH = Math.max(220, 236 * s);
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.36;
  fillPlate(ctx, boxX, boxY, boxW, boxH, 18, "rgba(16, 12, 9, 0.94)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.35)";
  ctx.lineWidth = 1.6;
  roundRect(ctx, boxX, boxY, boxW, boxH, 18);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(18, 20 * s), "800");
  ctx.fillText(t("langAsk"), width / 2, boxY + Math.max(36, 40 * s));
  for (const id of ["lang-hans", "lang-hant", "lang-cancel"]) {
    drawButton(ctx, model.buttons[id], {
      hovered: model.hoveredId === id,
      pressed: model.pressedId === id,
    });
  }
}

/** 按钮位置与游戏逻辑共用，保证点击区域和绘制一致。 */
export function layoutButtons(width, height, state, muted = false, options = {}) {
  const p = layoutPad(width, height);
  const s = p.s;
  const padL = p.l;
  const padR = p.r;
  const padT = p.t;
  const padB = p.b;
  const mute = muteButton(width, height, muted);

  if (options.paused) {
    const w = Math.min(280 * s, width - padL - padR);
    const h = Math.max(48, 54 * s);
    return {
      resume: {
        id: "resume",
        label: t("resume"),
        x: (width - w) / 2,
        y: height * 0.52,
        w,
        h,
      },
      mute,
      lang: langButton(width, height),
    };
  }

  if (state === "menu") {
    const w = Math.min(280 * s, width - padL - padR);
    const h = Math.max(48, 54 * s);
    const unlocked = options.unlockedCount ?? 0;
    const total = options.catalogTotal ?? 0;
    const startY = height * 0.54;
    const ghostH = Math.max(42, 46 * s);
    const rowY = startY + h + 10 + ghostH + 10;
    const gap = 8;
    const colW = (w - gap * 2) / 3;
    const rowX = (width - w) / 2;
    return {
      start: {
        id: "start",
        label: t("start"),
        x: (width - w) / 2,
        y: startY,
        w,
        h,
      },
      codex: {
        id: "codex",
        label: total ? `${t("catalog")}  ${unlocked}/${total}` : t("catalog"),
        kind: "ghost",
        x: (width - w) / 2,
        y: startY + h + 10,
        w,
        h: ghostH,
      },
      shop: {
        id: "shop",
        label: t("shop"),
        kind: "ghost",
        x: rowX,
        y: rowY,
        w: colW,
        h: ghostH,
      },
      board: {
        id: "board",
        label: t("board"),
        kind: "ghost",
        x: rowX + colW + gap,
        y: rowY,
        w: colW,
        h: ghostH,
      },
      achieve: {
        id: "achieve",
        label: t("achieve"),
        kind: "ghost",
        x: rowX + (colW + gap) * 2,
        y: rowY,
        w: colW,
        h: ghostH,
      },
      mute,
      lang: langButton(width, height, "dock"),
    };
  }

  if (state === "shop") {
    const prices = options.prices || CONFIG.economy.prices;
    const inv = options.inventory || {};
    const shareN = options.shareTokens ?? CONFIG.economy.shareTokens;
    const adN = options.adTokens ?? CONFIG.economy.adTokens;
    const ready = options.shareReady || {};
    const w = Math.min(320, width - padL - padR);
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
        const panelY = Math.max(padT + 52, Math.min(height * 0.1, (height - stack - padB - 52) / 2));
    let y = panelY + headerH + section;
    const buy = (id, name, key, cost) => ({
      id,
      label: name,
      hint: SHOP_HINTS[key](),
      price: cost,
      hold: inv[key] || 0,
      kind: "shopBuy",
      x,
      y: 0,
      w,
      h: buyH,
    });
    const buttons = {
      "buy-retry": buy("buy-retry", t("retry"), "retry", prices.retry ?? 3),
      "buy-guide": buy("buy-guide", t("guide"), "guide", prices.guide ?? 2),
      "buy-summon": buy("buy-summon", t("summon"), "summon", prices.summon ?? 5),
    };
    buttons["buy-retry"].y = y;
    buttons["buy-guide"].y = y + buyH + gap;
    buttons["buy-summon"].y = y + (buyH + gap) * 2;
    const shareY = y + (buyH + gap) * 3 + section;
    const sw = (w - 12) / 3;
    const shareLabel = (key, name) => (ready[key] === false ? t("claimed") : `${name} +${shareN}`);
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
      label: `${t("watchAd")}  +${adN}${t("tokenUnit")}`,
      kind: "ghost",
      x,
      y: adY,
      w,
      h: shareH,
    };
    buttons.menu = {
      id: "menu",
      label: t("back"),
      kind: "ghost",
      x,
      y: adY + shareH + 12,
      w,
      h: menuH,
    };
    buttons.mute = mute;
    buttons.lang = langButton(width, height);
    if (options.pendingPrompt) Object.assign(buttons, promptButtons(width, height, options.pendingPrompt));
    buttons._shop = { panelY, panelW: w, panelX: x, stack, headerH, section, shareN, adN };
    return buttons;
  }

  if (state === "achieve") {
    const menuH = Math.max(42, 46 * s);
    const gap = 8;
    const muteDock = { ...mute, y: height - padB - menuH, h: menuH };
    const lang = {
      ...langButton(width, height, "dock"),
      y: muteDock.y,
      h: menuH,
      x: muteDock.x + muteDock.w + gap,
    };
    const menuX = lang.x + lang.w + gap;
    const buttons = {
      mute: muteDock,
      lang,
      menu: {
        id: "menu",
        label: t("back"),
        kind: "ghost",
        x: menuX,
        y: muteDock.y,
        w: width - padR - menuX,
        h: menuH,
      },
    };
    const list = options.achieveList || [];
    const unlocked = options.achieveUnlocked || {};
    const cols = 2;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const cellGap = 8;
    const panelX = padL;
    const panelW = width - padL - padR;
    const panelY = padT;
    const panelBottom = height - padB - menuH - 10;
    const gridY = panelY + Math.max(78, 86 * s);
    const gridH = panelBottom - gridY - 8;
    const cellW = (panelW - 24 - cellGap) / cols;
    const cellH = Math.min(56, (gridH - cellGap * (rows - 1)) / rows);
    const startX = panelX + 12;
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i];
      if (!unlocked[row.id]) continue;
      const col = i % cols;
      const r = Math.floor(i / cols);
      buttons[`wear-${row.id}`] = {
        id: `wear-${row.id}`,
        x: startX + col * (cellW + cellGap),
        y: gridY + r * (cellH + cellGap),
        w: cellW,
        h: cellH,
      };
    }
    return buttons;
  }

  if (state === "board") {
    const menuH = Math.max(42, 46 * s);
    const tabH = Math.max(40, 44 * s);
    const gap = 8;
    const muteDock = { ...mute, y: height - padB - menuH, h: menuH };
    const lang = {
      ...langButton(width, height, "dock"),
      y: muteDock.y,
      h: menuH,
      x: muteDock.x + muteDock.w + gap,
    };
    const menuX = lang.x + lang.w + gap;
    const chipH = Math.max(32, 34 * s);
    const chipY = padT + Math.max(86, 94 * s);
    const chipGap = 8;
    const chipW = (width - padL - padR - chipGap) / 2;
    const tabY = chipY + chipH + 10;
    const tabW = (width - padL - padR - 8) / 2;
    const home = options.boardScope !== "global";
    const title = options.boardTitle || "";
    return {
      "board-home": {
        id: "board-home",
        label: t("boardHome"),
        kind: home ? undefined : "ghost",
        x: padL,
        y: tabY,
        w: tabW,
        h: tabH,
      },
      "board-global": {
        id: "board-global",
        label: t("boardGlobal"),
        kind: home ? "ghost" : undefined,
        x: padL + tabW + 8,
        y: tabY,
        w: tabW,
        h: tabH,
      },
      "board-rename": {
        id: "board-rename",
        label: t("rename"),
        kind: "ghost",
        x: padL,
        y: chipY,
        w: chipW,
        h: chipH,
      },
      "board-title": {
        id: "board-title",
        label: title ? t("changeTitle") : t("pickTitle"),
        kind: "ghost",
        x: padL + chipW + chipGap,
        y: chipY,
        w: chipW,
        h: chipH,
      },
      mute: muteDock,
      lang,
      menu: {
        id: "menu",
        label: t("back"),
        kind: "ghost",
        x: menuX,
        y: muteDock.y,
        w: width - padR - menuX,
        h: menuH,
      },
    };
  }

  if (state === "codex") {
    return layoutCodex(width, height, muted, options.codexTheme).buttons;
  }

  if (state === "gameover") {
    const w = Math.min(280 * s, width - padL - padR);
    const h = Math.max(48, 52 * s);
    return {
      again: {
        id: "again",
        label: t("again"),
        x: (width - w) / 2,
        y: height * 0.58,
        w,
        h,
      },
      menu: {
        id: "menu",
        label: t("menu"),
        x: (width - w) / 2,
        y: height * 0.58 + h + 12,
        w,
        h,
      },
      mute,
      lang: langButton(width, height),
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
      label: t("restart"),
      x: width - padR - w,
      y: padT,
      w,
      h,
    },
    mute: { ...mute, y: padT },
  };
  const prices = options.prices || CONFIG.economy.prices;
  const inv = options.inventory || {};
  if (state === "feedback" && options.fatalBreak) {
    const bw = Math.min(280 * s, width - padL - padR);
    const bh = Math.max(50, 56 * s);
    const retryN = inv.retry || 0;
    buttons["use-retry"] = {
      id: "use-retry",
      label: retryN > 0 ? t("retryHave", { n: retryN }) : t("retryBuy", { n: prices.retry ?? 3 }),
      x: (width - bw) / 2,
      y: height * 0.58,
      w: bw,
      h: bh,
    };
    buttons["skip-retry"] = {
      id: "skip-retry",
      label: t("skip"),
      kind: "ghost",
      x: (width - bw) / 2,
      y: height * 0.58 + bh + 12,
      w: bw,
      h: Math.max(42, 46 * s),
    };
    if (options.pendingPrompt) Object.assign(buttons, promptButtons(width, height, options.pendingPrompt));
    return buttons;
  }
  const chipW = Math.max(92, 108 * s);
  const chipH = Math.max(36, 40 * s);
  const gap = 8;
  const chips = [
    {
      id: "use-guide",
      label: itemChipLabel(t("guide"), inv.guide || 0, prices.guide ?? 2),
    },
    {
      id: "use-summon",
      label: itemChipLabel(t("summon"), inv.summon || 0, prices.summon ?? 5),
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
      y: height - padB - chipH,
      w: chipW,
      h: chipH,
    };
  });
  if (options.pendingPrompt) Object.assign(buttons, promptButtons(width, height, options.pendingPrompt));
  return buttons;
}

function layoutSummon(width, height, types, muted, scrollY) {
  const p = layoutPad(width, height);
  const s = p.s;
  const mute = muteButton(width, height, muted);
  const barH = Math.max(42, 46 * s);
  mute.y = height - p.b - barH;
  mute.h = barH;
  const gapBtn = 8;
  const cancelX = mute.x + mute.w + gapBtn;
  const buttons = {
    mute,
    "summon-cancel": {
      id: "summon-cancel",
      label: t("cancel"),
      kind: "ghost",
      x: cancelX,
      y: mute.y,
      w: width - p.r - cancelX,
      h: barH,
    },
  };
  const cols = 4;
  const cellH = Math.max(36, 40 * s);
  const gap = 6;
  const gridW = width - p.l - p.r;
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
      label: typeLabel(type),
      kind: "ghost",
      x: p.l + col * (cellW + gap),
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
    pad: p.l,
    cellW,
    types,
  };
  return buttons;
}

export function layoutOrbitPad(width, height, anchor) {
  const p = layoutPad(width, height);
  const s = p.s;
  const inset = Math.max(10, 12 * s);
  const size = Math.max(68, Math.min(86, 80 * s));
  const gap = Math.max(44, 52 * s);
  const restartH = Math.max(36, 40 * s);
  const right = Number.isFinite(anchor?.x) ? anchor.x : width * 0.62;
  const midY = Number.isFinite(anchor?.y) ? anchor.y : height * 0.48;
  let x = right + gap;
  let y = midY - size / 2;
  x = Math.min(width - p.r - inset - size, Math.max(p.l + inset, x));
  y = Math.min(height - p.b - inset - size, Math.max(p.t + inset + restartH + 6, y));
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
  const p = layoutPad(width, height);
  const s = p.s;
  const backH = Math.max(40, 44 * s);
  const captionH = Math.max(48, 52 * s);
  const tabGap = Math.max(6, 7 * s);
  const tabH = Math.max(32, 36 * s);
  const tabCount = CONFIG.themes.order.length;
  const tabCols = Math.min(5, tabCount);
  const tabRows = Math.ceil(tabCount / tabCols);
  const tabY = p.t;
  const tabBarH = tabRows * (tabH + tabGap) - tabGap;
  const btnY = height - p.b - backH;
  const mute = { ...muteButton(width, height, muted), y: btnY, h: backH };
  const dockGap = 8;
  const lang = {
    ...langButton(width, height, "dock"),
    y: btnY,
    h: backH,
    x: mute.x + mute.w + dockGap,
  };
  const menuW = Math.max(88, 108 * s);
  const buttons = {
    menu: {
      id: "menu",
      label: t("back"),
      kind: "ghost",
      x: width - p.r - menuW,
      y: btnY,
      w: menuW,
      h: backH,
    },
    mute,
    lang,
  };

  const tabW = (width - p.l - p.r - tabGap * (tabCols - 1)) / tabCols;
  CONFIG.themes.order.forEach((id, i) => {
    const col = i % tabCols;
    const row = Math.floor(i / tabCols);
    buttons[`theme-${id}`] = {
      id: `theme-${id}`,
      themeId: id,
      label: themeName(id),
      kind: "tab",
      x: p.l + col * (tabW + tabGap),
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
  const cellW = (width - p.l - p.r - gap * (cols - 1)) / cols;
  objects.forEach((type, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    buttons[`entry-${type}`] = {
      id: `entry-${type}`,
      type,
      x: p.l + col * (cellW + gap),
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
    if (!list[i].id || list[i].id.startsWith("_") || list[i].disabled) continue;
    if (pointInRect(point, list[i])) return list[i];
  }
  return null;
}

function drawRewardSpinner(ctx, button) {
  const r = Math.max(5, Math.min(9, button.h * 0.18));
  const cx = button.x + button.w - r - 12;
  const cy = button.y + button.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((performance.now() / 140) % (Math.PI * 2));
  ctx.strokeStyle = "rgba(243, 230, 208, 0.92)";
  ctx.lineWidth = 2.25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();
}

function drawButton(ctx, button, { hovered, pressed, pulse = false, time = 0 }) {
  if (!button) return;
  if (button.disabled) {
    hovered = false;
    pressed = false;
    pulse = false;
  }
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
    ctx.fillText(`${button.price}${t("tokenUnit")}`, button.x + button.w - 16, button.y + button.h * 0.36);
    ctx.font = font(Math.max(11, button.h * 0.22), "600");
    ctx.globalAlpha = 0.7;
    ctx.fillText(t("hold", { n: button.hold ?? 0 }), button.x + button.w - 16, button.y + button.h * 0.68);
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
    const locked = Boolean(button.disabled);
    const round = button.kind === "yaw" ? button.h / 2 : button.h / 2;
    roundRect(ctx, button.x, button.y, button.w, button.h, round);
    const on = button.kind === "tab" && button.active;
    ctx.fillStyle = locked
      ? "rgba(243, 230, 208, 0.06)"
      : on || pressed
        ? "rgba(224, 122, 61, 0.38)"
        : "rgba(243, 230, 208, 0.12)";
    ctx.fill();
    ctx.strokeStyle = locked
      ? "rgba(243, 230, 208, 0.28)"
      : on || hovered || pressed
        ? spec.cream
        : "rgba(243, 230, 208, 0.45)";
    ctx.lineWidth = !locked && (on || hovered || pressed) ? 2 : 1.5;
    ctx.stroke();
    ctx.fillStyle = locked ? "rgba(243, 230, 208, 0.55)" : spec.cream;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = button.x + button.w / 2;
    if (button.sub) {
      ctx.font = font(Math.max(11, button.h * 0.32), "700");
      ctx.fillText(button.label, cx, button.y + button.h * 0.36);
      ctx.fillStyle = spec.creamDim;
      ctx.font = font(Math.max(10, button.h * 0.26), "600");
      ctx.fillText(button.sub, cx, button.y + button.h * 0.7);
    } else {
      ctx.font = font(Math.max(11, button.h * (button.kind === "yaw" ? 0.48 : button.kind === "tab" ? 0.32 : button.w < 120 ? 0.28 : 0.36)), "700");
      ctx.fillText(button.label, cx, button.y + button.h / 2 + (button.kind === "yaw" ? -1 : 1));
    }
    if (locked) drawRewardSpinner(ctx, button);
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
  ctx.fillText(t("title"), width / 2, height * 0.13);
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
  ctx.fillText(t("highScore"), mid, statsY + Math.max(20, 22 * s));

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
  ctx.fillText(t("collection"), mid, rowY + Math.max(16, 18 * s));

  let stampY = rowY + Math.max(40, 44 * s);
  if (model.grandTrophy) {
    ctx.fillStyle = spec.accent;
    ctx.font = font(Math.max(12, 13 * s), "800");
    ctx.fillText(t("grandTrophy"), mid, stampY);
    stampY += Math.max(22, 24 * s);
  }
  if (model.dailyTheme) {
    const tag = t("daily", { name: model.dailyTheme });
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
  drawButton(ctx, model.buttons.board, {
    hovered: model.hoveredId === "board",
    pressed: model.pressedId === "board",
  });
  drawButton(ctx, model.buttons.achieve, {
    hovered: model.hoveredId === "achieve",
    pressed: model.pressedId === "achieve",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
  drawButton(ctx, model.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
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
  const p = layoutPad(width, height);
  const pad = p.l;
  const padR = p.r;

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

  const capY = layout.panelTop;
  const capH = layout.captionH;
  fillPlate(ctx, pad, capY, width - pad - padR, capH, 14, "rgba(12, 9, 7, 0.9)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.28)";
  ctx.lineWidth = 1;
  roundRect(ctx, pad, capY, width - pad - padR, capH, 14);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 3;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(12, 13 * s), "700");
  ctx.fillText(`${unlocked} / ${total}`, pad + 12, capY + capH * 0.5);
  ctx.textAlign = "right";
  ctx.fillText(
    ` ${t("collection")}  ${model.collection ?? 0} / ${model.collectionMax ?? 10000}`,
    width - padR - 12,
    capY + capH * 0.5,
  );

  ctx.textAlign = "center";
  if (model.codexSelected && catalog[model.codexSelected]) {
    const entry = catalog[model.codexSelected];
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(16, 18 * s), "800");
    ctx.fillText(typeLabel(model.codexSelected), width / 2, capY + capH * 0.36);
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillStyle = spec.cream;
    ctx.globalAlpha = 0.88;
    ctx.fillText(t("catalogCuts", { n: entry.cuts, best: entry.best }), width / 2, capY + capH * 0.72);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(13, 14 * s), "700");
    ctx.fillText(unlocked ? t("catalogPick") : t("catalogLocked"), width / 2, capY + capH * 0.5);
  }
  ctx.restore();

  const trophy = model.stallTrophy;
  const trophyName = trophy ? (model.trophyLabel?.[trophy] || trophy) : t("trophyNone");
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
      ctx.fillText(typeLabel(button.type), button.x + button.w / 2, button.y + button.h * 0.42);
      ctx.fillStyle = spec.creamDim;
      ctx.font = font(Math.max(10, 11 * s), "600");
      ctx.fillText(t("best", { n: entry.best }), button.x + button.w / 2, button.y + button.h * 0.7);
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
  drawButton(ctx, layout.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
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
  const reason = model.tokenToast.reason ? `${model.tokenToast.reason}` : "";
  const msg = model.tokenToast.amount
    ? t("tokenGain", {
        reason,
        n: model.tokenToast.amount,
        unit: t("tokenUnit"),
      })
    : reason || t("reward");
  ctx.save();
  ctx.font = font(Math.max(14, 16 * s), "800");
  const textW = Math.min(ctx.measureText(msg).width, width * 0.78);
  const padX = 16;
  const boxW = Math.min(width - 24, textW + padX * 2);
  const boxH = Math.max(36, 40 * s);
  const menu = model.buttons?.menu;
  const boxX = (width - boxW) / 2;
  const boxY = menu ? Math.max(12, menu.y - boxH - 12) : height * 0.16;
  fillPlate(ctx, boxX, boxY, boxW, boxH, boxH / 2, "rgba(12, 9, 7, 0.94)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.45)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2);
  ctx.stroke();
  ctx.fillStyle = spec.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, width / 2, boxY + boxH / 2, boxW - padX * 2);
  ctx.restore();
}

function drawHud(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const p = layoutPad(width, height);
  const muteH = Math.max(36, 40 * s);
  const x = p.l;
  const y = p.t + muteH + Math.max(8, 10 * s);
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
  ctx.fillText(t("score"), x, y + Math.max(30, 36 * s));

  const comboY = y + Math.max(50, 58 * s);
  const comboHot = model.combo >= 3;
  if (comboHot) {
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(model.time * 6) * 0.06;
    ctx.fillStyle = spec.accent;
    roundRect(ctx, x - 6, comboY - 4, Math.max(100, 118 * s), Math.max(26, 30 * s), 10);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = comboHot ? spec.accent : spec.cream;
  ctx.font = font(Math.max(15, comboHot ? 18 * s : 16 * s), "800");
  ctx.fillText(t("combo", { n: model.combo }), x, comboY);

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(13, 14 * s), "700");
  ctx.fillText(t("tokens", { n: model.tokens ?? 0 }), x, comboY + Math.max(28, 32 * s));
  ctx.restore();

  if (model.itemLoading) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const bw = Math.max(132, 148 * s);
    const bh = Math.max(40, 44 * s);
    fillPlate(ctx, (width - bw) / 2, height * 0.46, bw, bh, 14);
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(15, 16 * s), "800");
    ctx.fillText(t("loading"), width / 2, height * 0.46 + bh / 2);
    ctx.restore();
  }

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
  ctx.fillText(t("rotate"), pad.x + pad.w / 2, pad.y + pad.h - Math.max(14, pad.h * 0.14));
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
  ctx.fillText(t("how"), x + 12 + tagW / 2, y + 10 + tagH / 2 + 0.5);

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
  ctx.fillText(t("hintCut"), x + 52 * s, y + boxH * 0.54);
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(t("hintSpin"), x + 52 * s, y + boxH * 0.76);
  ctx.restore();
}

function drawFeedback(ctx, width, height, model) {
  if (!model.lastResult) return;
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const { baseScore, gained, grade, combo, miss, fatal, shielded } = model.lastResult;
  const ft = model.feedbackT;
  const perfect = !miss && baseScore >= CONFIG.score.perfectScore;
  const milestone = !miss && Boolean(model.lastResult.comboTitle);
  const nearMiss = Boolean(fatal) && !miss && baseScore >= 70;

  if (!miss && model.centerScreen && model.lastResult.cutX != null) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (ft < 0.85 ? 1 : 1 - (ft - 0.85) / 0.15);
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
      const rt = Math.min(1, ft * 1.8 - i * 0.12);
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
    0.35 * easeOut(ft);
  const alpha = ft < 0.85 ? 1 : 1 - (ft - 0.85) / 0.15;

  if (perfect && ft < 0.22) {
    ctx.fillStyle = `rgba(255, 236, 210, ${0.18 * (1 - ft / 0.22)})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (fatal && ft < 0.38) {
    ctx.fillStyle = `rgba(140, 18, 12, ${0.22 * (1 - ft / 0.38)})`;
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
      ctx.fillText(`+${gained}  （${t("comboX", { n: combo })}）`, 0, Math.max(50, 62 * s));
    }

    const leftPct = Math.round((model.lastResult.leftShare ?? 0.5) * 100);
    const rightPct = 100 - leftPct;
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(12, 13 * s), "600");
    const nx = Math.abs(model.lastResult.nx ?? 1);
    const ny = Math.abs(model.lastResult.ny ?? 0);
    let volumeLabel = t("volMid", { a: leftPct, b: rightPct });
    if (ny > nx * 1.25 && ny > 0.55) volumeLabel = t("volTB", { a: leftPct, b: rightPct });
    else if (nx > ny * 1.25 && nx > 0.55) volumeLabel = t("volLR", { a: leftPct, b: rightPct });
    ctx.fillText(volumeLabel, 0, Math.max(70, 84 * s));

    if (model.lastResult.codexNew) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(13, 15 * s), "800");
      ctx.fillText(t("intoCodex"), 0, Math.max(88, 106 * s));
    }

    if (shielded) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(15, 18 * s), "800");
      ctx.fillText(t("shield"), 0, Math.max(94, 112 * s));
    } else if (nearMiss) {
      ctx.fillStyle = spec.accent;
      ctx.font = font(Math.max(15, 18 * s), "800");
      ctx.fillText(t("close"), 0, Math.max(94, 112 * s));
    }
  } else if (fatal) {
    ctx.fillStyle = spec.accent;
    ctx.font = font(Math.max(15, 18 * s), "800");
    ctx.fillText(t("comboBreak"), 0, Math.max(36, 44 * s));
  }

  if (fatal) {
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(13, 14 * s), "700");
    ctx.fillText(t("retryHint"), 0, miss ? Math.max(58, 70 * s) : Math.max(112, 132 * s));
  }

  if (milestone && ft < 0.7) {
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - ft / 0.7;
    ctx.fillStyle = spec.accent;
    ctx.textAlign = "center";
    ctx.font = font(Math.max(28, 36 * s), "800");
    ctx.fillText(model.lastResult.comboTitle || t("comboX", { n: combo }), width / 2, height * 0.16);
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
  ctx.fillText(summary.newRecord ? t("newRecord") : t("comboBreak"), width / 2, height * 0.2);

  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(36, 48 * s), "800");
  ctx.fillText(String(summary.score ?? 0), width / 2, height * 0.3);

  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 16 * s), "600");
  ctx.fillText(summary.rank || t("newBlade"), width / 2, height * 0.38);
  ctx.fillText(
    t("maxCombo", { combo: summary.maxCombo ?? 0, cut: summary.bestCut ?? 0 }),
    width / 2,
    height * 0.44,
  );
  ctx.fillText(
    `${t("collection")}  ${summary.collection ?? model.collection ?? 0} / ${summary.collectionMax ?? model.collectionMax ?? 10000}`,
    width / 2,
    height * 0.48,
  );
  if (summary.worlds) {
    ctx.fillText(
      t("walked", { name: summary.lastTheme || "", a: summary.worlds, b: summary.worldTotal }),
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
  drawButton(ctx, model.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
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
  ctx.fillText(t("shop"), width / 2, panelY + Math.max(22, 26 * s));

  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(16, 18 * s), "800");
  ctx.fillText(t("tokens", { n: model.tokens ?? 0 }), width / 2, panelY + Math.max(48, 54 * s));

  if (buy) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText(t("buy"), buy.x, buy.y - Math.max(14, 16 * s));
  }
  if (share) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText(t("shareDaily"), share.x, share.y - Math.max(16, 18 * s));
    ctx.textAlign = "right";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillText(t("shareOnce", { n: shareN }), share.x + panelW, share.y - Math.max(16, 18 * s));
  }
  if (ad) {
    ctx.textAlign = "left";
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText(t("watchAd"), ad.x, ad.y - Math.max(16, 18 * s));
    ctx.textAlign = "right";
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(11, 12 * s), "600");
    const adsHint =
      model.adsStatus === "on" ? t("adsOn") : model.adsStatus === "mock" ? t("adsMock") : t("adsOff");
    ctx.fillText(t("adLine", { n: adN, hint: adsHint }), ad.x + panelW, ad.y - Math.max(16, 18 * s));
  }

  for (const id of ["buy-retry", "buy-guide", "buy-summon", "share-fb", "share-x", "share-threads", "ad-token", "menu", "mute", "lang"]) {
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
  ctx.fillText(t("summonTitle"), width / 2, height * 0.16);
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(12, 13 * s), "600");
  ctx.fillText(t("summonSecret", { n: model.prices?.summonSecret ?? 15 }), width / 2, height * 0.205);
  if (meta.maxScroll > 0) {
    ctx.font = font(Math.max(11, 12 * s), "600");
    ctx.fillText(t("summonScroll"), width / 2, height * 0.238);
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
  const p = layoutPad(width, height);
  const pad = p.l;
  const padR = p.r;
  const panelX = pad;
  const panelW = width - pad - padR;
  const panelY = p.t;
  const panelBottom = (back?.y || height - p.b - 46) - 10;

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
  ctx.fillText(t("achieve"), width / 2, panelY + Math.max(22, 26 * s));
  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(13, 14 * s), "700");
  ctx.fillText(t("achieveSub", { a: done, b: list.length }), width / 2, panelY + Math.max(46, 52 * s));
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(11, 12 * s), "600");
  ctx.fillText(t("achieveWear"), width / 2, panelY + Math.max(64, 70 * s));

  const cols = 2;
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const gap = 8;
  const gridY = panelY + Math.max(78, 86 * s);
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
    const worn = on && model.boardTitleId === row.id;
    roundRect(ctx, x, y, cellW, cellH, 12);
    ctx.fillStyle = worn ? "rgba(224, 122, 61, 0.38)" : on ? "rgba(224, 122, 61, 0.22)" : "rgba(243, 230, 208, 0.06)";
    ctx.fill();
    ctx.strokeStyle = worn ? spec.accent : on ? "rgba(224, 122, 61, 0.7)" : "rgba(243, 230, 208, 0.16)";
    ctx.lineWidth = worn ? 2 : 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = on ? spec.cream : "rgba(243, 230, 208, 0.45)";
    ctx.font = font(Math.max(12, 13 * s), "800");
    ctx.fillText(worn ? t("wearing", { name: achieveTitle(row.id) }) : achieveTitle(row.id), x + 10, y + cellH * 0.38);
    ctx.fillStyle = on ? "rgba(243, 230, 208, 0.78)" : spec.creamDim;
    ctx.font = font(Math.max(10, 11 * s), "600");
    ctx.fillText(achieveHint(row.id), x + 10, y + cellH * 0.72);
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
  drawButton(ctx, model.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
  });
  drawTokenToast(ctx, width, height, model);
}

function drawBoard(ctx, width, height, model) {
  const s = uiScale(width, height);
  const spec = CONFIG.ui;
  const back = model.buttons.menu;
  const p = layoutPad(width, height);
  const pad = p.l;
  const padR = p.r;
  const panelX = pad;
  const panelW = width - pad - padR;
  const panelY = p.t;
  const panelBottom = (back?.y || height - p.b - 46) - 10;

  ctx.fillStyle = "rgba(12, 9, 7, 0.62)";
  ctx.fillRect(0, 0, width, height);
  fillPlate(ctx, panelX, panelY, panelW, panelBottom - panelY, 22, "rgba(16, 12, 9, 0.82)");
  ctx.strokeStyle = "rgba(243, 230, 208, 0.22)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, panelX, panelY, panelW, panelBottom - panelY, 22);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(24, 30 * s), "800");
  ctx.fillText(t("boardTitle"), width / 2, panelY + Math.max(22, 26 * s));
  ctx.fillStyle = spec.accent;
  ctx.font = font(Math.max(12, 13 * s), "700");
  const place = model.boardCountryName || t("boardUnknown");
  ctx.fillText(
    model.boardScope === "global" ? t("boardWorldScore") : t("boardHomeScore", { place }),
    width / 2,
    panelY + Math.max(42, 48 * s),
  );
  ctx.fillStyle = spec.cream;
  ctx.font = font(Math.max(12, 13 * s), "700");
  const you = model.boardName ? t("nickLine", { name: model.boardName }) : t("nickEmpty");
  const worn = model.boardTitle ? ` · ${model.boardTitle}` : "";
  ctx.fillText(`${you}${worn}`, width / 2, panelY + Math.max(60, 68 * s), panelW - 24);

  drawButton(ctx, model.buttons["board-home"], {
    hovered: model.hoveredId === "board-home",
    pressed: model.pressedId === "board-home",
  });
  drawButton(ctx, model.buttons["board-global"], {
    hovered: model.hoveredId === "board-global",
    pressed: model.pressedId === "board-global",
  });

  const tabs = model.buttons["board-home"];
  const listY = (tabs?.y || panelY + 90) + (tabs?.h || 44) + 12;
  const listH = panelBottom - listY - 8;
  if (model.boardError) {
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(14, 15 * s), "700");
    ctx.fillText(model.boardError, width / 2, listY + 40);
  } else if (model.boardLoading && !model.boardRows?.length) {
    ctx.fillStyle = spec.creamDim;
    ctx.font = font(Math.max(14, 15 * s), "700");
    ctx.fillText(t("boardLoad"), width / 2, listY + 40);
  } else {
    const rows = model.boardRows || [];
    const rowH = Math.min(42, Math.max(32, listH / 11));
    if (!rows.length) {
      ctx.fillStyle = spec.creamDim;
      ctx.font = font(Math.max(14, 15 * s), "700");
      ctx.fillText(t("boardEmpty"), width / 2, listY + 40);
    }
    for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
      const row = rows[i];
      const y = listY + i * rowH;
      if (y + rowH > panelBottom - 4) break;
      const hasTitle = Boolean(row.title);
      ctx.textAlign = "left";
      ctx.fillStyle = row.me ? spec.accent : spec.cream;
      ctx.font = font(Math.max(13, 14 * s), "800");
      ctx.fillText(`${row.rank}`, panelX + 18, y + rowH * 0.5);
      ctx.font = font(Math.max(13, 14 * s), "700");
      ctx.fillText(row.name, panelX + 48, y + (hasTitle ? rowH * 0.34 : rowH * 0.5));
      if (hasTitle) {
        ctx.fillStyle = spec.accent;
        ctx.font = font(Math.max(10, 11 * s), "700");
        ctx.fillText(row.title ? achieveTitle(titleIdFromStored(row.title)) || row.title : "", panelX + 48, y + rowH * 0.72);
      }
      ctx.textAlign = "right";
      ctx.fillStyle = row.me ? spec.accent : spec.creamDim;
      ctx.font = font(Math.max(11, 12 * s), "600");
      ctx.fillText(row.countryName || row.country || "", panelX + panelW - 88, y + rowH * 0.5);
      ctx.fillStyle = row.me ? spec.accent : spec.cream;
      ctx.font = font(Math.max(13, 14 * s), "800");
      ctx.fillText(String(row.score), panelX + panelW - 18, y + rowH * 0.5);
    }
  }

  if (model.boardMe) {
    ctx.textAlign = "center";
    ctx.fillStyle = spec.cream;
    ctx.font = font(Math.max(12, 13 * s), "700");
    ctx.fillText(t("yourRank", { rank: model.boardMe.rank, score: model.boardMe.score }), width / 2, panelBottom - 16);
  }

  drawButton(ctx, model.buttons["board-rename"], {
    hovered: model.hoveredId === "board-rename",
    pressed: model.pressedId === "board-rename",
  });
  drawButton(ctx, model.buttons["board-title"], {
    hovered: model.hoveredId === "board-title",
    pressed: model.pressedId === "board-title",
  });
  drawButton(ctx, model.buttons.menu, {
    hovered: model.hoveredId === "menu",
    pressed: model.pressedId === "menu",
  });
  drawButton(ctx, model.buttons.mute, {
    hovered: model.hoveredId === "mute",
    pressed: model.pressedId === "mute",
  });
  drawButton(ctx, model.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
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
  const paintOverlay = () => {
    if (!model.paused && model.pendingPrompt) drawBuyConfirm(ctx, width, height, model);
  };

  if (state === "menu") {
    drawMenu(ctx, width, height, model);
    paintOverlay();
    return;
  }

  if (state === "shop") {
    drawShop(ctx, width, height, model);
    paintOverlay();
    return;
  }

  if (state === "achieve") {
    drawAchieve(ctx, width, height, model);
    paintOverlay();
    return;
  }

  if (state === "board") {
    drawBoard(ctx, width, height, model);
    paintOverlay();
    return;
  }

  if (state === "codex") {
    drawCodex(ctx, width, height, model);
    paintOverlay();
    return;
  }

  if (state === "gameover") {
    drawGameOver(ctx, width, height, model);
    paintOverlay();
    return;
  }

  drawHud(ctx, width, height, model);
  drawSparks(ctx, model.sparks);
  if (model.summonPicker) {
    drawSummon(ctx, width, height, model);
    paintOverlay();
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
    ctx.fillText(t("station", { n: station }), width / 2, height * 0.11);
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
  ctx.fillText(t("pause"), width / 2, height * 0.4);
  ctx.fillStyle = spec.creamDim;
  ctx.font = font(Math.max(14, 16 * s), "600");
  ctx.fillText(t("pauseHint"), width / 2, height * 0.4 + Math.max(28, 34 * s));
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
  drawButton(ctx, model.buttons.lang, {
    hovered: model.hoveredId === "lang",
    pressed: model.pressedId === "lang",
  });
}
