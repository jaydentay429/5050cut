/**
 * 门户 / 广告 / 排行。SDK 只进这一文件。
 */
import { showInterstitial, showRewarded } from "./ads.js?v=6";
import { loadBoardProfile, saveBoardProfile, submitBoardScore } from "./board.js?v=16";

export function onGameStart() {
  // sdk.gameplayStart()
}

export function onGameEnd(_score) {
  // sdk.gameplayStop()
}

export function onShowAd(reason) {
  return showInterstitial(reason || "gameover");
}

export function onHappyTime() {
  // CrazyGames: sdk.game.happytime()
}

export function onVisibility(_hidden) {
  // 失焦由游戏侧暂停 / 静音。
}

export function onShare(_channel) {}

export function onRewardedAd(done) {
  showRewarded("shop_tokens")
    .then((result) => done?.(result.status === "rewarded", result.status))
    .catch(() => done?.(false, "error"));
}

export function submitCollectionScore(_score) {}

export function submitRunScore(score) {
  const n = Math.floor(Number(score) || 0);
  if (n < 1) return Promise.resolve(null);
  const profile = loadBoardProfile();
  return submitBoardScore(profile, n)
    .then((data) => {
      if (data?.country) {
        const latest = loadBoardProfile();
        latest.country = data.country;
        saveBoardProfile(latest);
      }
      return data;
    })
    .catch(() => null);
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
        /* ignore */
      }
    });
    return;
  }
  try {
    window.open(href, "_blank", "noopener,noreferrer");
  } catch {
    /* ignore */
  }
}
