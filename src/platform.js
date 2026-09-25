/**
 * 门户 SDK 挂钩。CrazyGames / Poki 之后只往这里填，不要散落到玩法代码里。
 * 现在全部是空实现，接 SDK 时保持函数签名即可。未点名上门户前不要接 live 广告。
 */

export function onGameStart() {
  // sdk.gameplayStart()
}

export function onGameEnd(_score) {
  // sdk.gameplayStop()
}

export function onShowAd(_reason) {
  // 结算或返回菜单时的插屏。Basic Launch 阶段必须是空操作。
}

export function onHappyTime() {
  // CrazyGames: sdk.game.happytime()  破纪录、高连击
}

export function onVisibility(_hidden) {
  // 失焦 gameplayStop，回来 gameplayStart。游戏侧已暂停/静音。
}

export function onShare(_channel) {
  // 上门户后换成 SDK share。现在只记一次点击。
}

export function onRewardedAd(_done) {
  // 激励广告换代币。未上门户前不要接 live SDK。
  // _done?.(true) 成功；现在直接失败。
}

export function submitCollectionScore(_score) {
  // 真排行：CrazyGames 内置榜或点名的云存档。本地不要做假全球榜。
}

export function gameUrl() {
  try {
    return `${location.origin}${location.pathname}`;
  } catch {
    return "";
  }
}

export function openShare(channel, { title, text, url }) {
  onShare(channel);
  const hrefTarget = url || gameUrl();
  const encodedUrl = encodeURIComponent(hrefTarget);
  const encodedText = encodeURIComponent(text || title || "");
  const href = {
    fb: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    threads: `https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`,
  }[channel];
  if (!href) return;
  const payload = { title: title || "", text: text || "", url: hrefTarget };
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    navigator.share(payload).catch(() => {
      try {
        window.open(href, "_blank", "noopener,noreferrer");
      } catch {
        // ignore
      }
    });
    return;
  }
  try {
    window.open(href, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}
