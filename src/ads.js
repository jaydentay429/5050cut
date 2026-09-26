/**
 * 广告：Google H5 Ad Placement API。无 client / 本机走 mock。
 * 只从 platform.js 调用。
 */
import { CONFIG } from "./config.js?v=105";
import { setFocusMuted } from "./audio.js?v=67";

/** 激励广告在收到 beforeReward / beforeAd 之前的等待上限。 */
const REWARD_AD_TIMEOUT_MS = 5000;

let hooks = { pause: () => {}, resume: () => {} };
let inited = false;
let busy = false;
let rewardSerial = 0;
let rewardActiveId = 0;
let rewardPending = false;
let playSeconds = 0;
let lastInterstitialAt = -999;
let meaningfulRuns = 0;
let sessionInterstitials = 0;

export function adHooks(next) {
  hooks = { ...hooks, ...next };
}

export function notePlayTime(dt) {
  playSeconds += dt;
}

export function noteMeaningfulRun() {
  meaningfulRuns += 1;
}

export function isAdBusy() {
  return busy;
}

export function isRewardPending() {
  return rewardPending;
}

function isLocal() {
  try {
    const host = location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return true;
  }
}

function clientId() {
  return (typeof window !== "undefined" && window.AD_CLIENT) || CONFIG.ads?.client || "";
}

export function adsStatus() {
  if (isLocal()) return "mock";
  if (!clientId()) return "off";
  return "on";
}

export function initAds() {
  if (inited) return;
  const client = clientId();
  if (!client || isLocal()) {
    inited = true;
    return;
  }
  inited = true;
  window.adsbygoogle = window.adsbygoogle || [];
  if (typeof window.adBreak !== "function") {
    window.adBreak = window.adConfig = (o) => window.adsbygoogle.push(o);
  }
  if (!document.getElementById("adsbygoogle-js")) {
    const s = document.createElement("script");
    s.id = "adsbygoogle-js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.dataset.adClient = client;
    document.head.appendChild(s);
  }
  window.adConfig({
    preloadAdBreaks: "on",
    sound: "on",
  });
}

function pauseAll() {
  busy = true;
  hooks.pause();
  setFocusMuted(true);
}

function resumeAll() {
  busy = false;
  setFocusMuted(false);
  hooks.resume();
}

function canInterstitial() {
  const ads = CONFIG.ads || {};
  if (meaningfulRuns < 1) return false;
  if (playSeconds < (ads.minPlaySec ?? 90)) return false;
  if (sessionInterstitials >= (ads.maxPerSession ?? 8)) return false;
  if (playSeconds - lastInterstitialAt < (ads.cooldownSec ?? 120)) return false;
  if (document.hidden) return false;
  return true;
}

function mockBreak(ms = 900) {
  pauseAll();
  return new Promise((resolve) => {
    setTimeout(() => {
      resumeAll();
      resolve({ status: "shown" });
    }, ms);
  });
}

export async function showInterstitial(placementId) {
  if (busy) return { status: "error", error: "busy" };
  if (!canInterstitial()) return { status: "cooldown" };
  lastInterstitialAt = playSeconds;
  sessionInterstitials += 1;

  const adBreak = typeof window !== "undefined" ? window.adBreak : null;
  if (!adBreak || isLocal() || !clientId()) {
    if (isLocal()) return mockBreak(700);
    resumeAll();
    return { status: "no_fill" };
  }

  return new Promise((resolve) => {
    let paused = false;
    adBreak({
      type: "next",
      name: placementId || "gameover",
      beforeAd: () => {
        paused = true;
        pauseAll();
      },
      afterAd: () => {
        if (paused) resumeAll();
      },
      adBreakDone: (info) => {
        if (paused && busy) resumeAll();
        const status = info?.breakStatus || "other";
        if (status === "viewed") return resolve({ status: "shown" });
        if (status === "frequencyCapped") return resolve({ status: "cooldown" });
        if (["noAdPreloaded", "notReady", "timeout", "other"].includes(status)) {
          return resolve({ status: "no_fill" });
        }
        resolve({ status: "error", error: status });
      },
    });
  });
}

function liveRewardAdBreak() {
  if (typeof window === "undefined" || typeof window.adBreak !== "function") return null;
  // 本机商店默认模拟发奖。验证脚本可设 __FORCE_LIVE_ADS__ 走真实 adBreak。
  if (window.__FORCE_LIVE_ADS__) return window.adBreak;
  if (isLocal() || !clientId()) return null;
  return window.adBreak;
}

export async function showRewarded(placementId) {
  initAds();
  if (busy || rewardPending) return { status: "error", error: "busy" };
  const adBreak = liveRewardAdBreak();
  if (!adBreak) {
    if (isLocal()) {
      pauseAll();
      await new Promise((r) => setTimeout(r, 1100));
      resumeAll();
      return { status: "rewarded" };
    }
    return { status: "no_fill" };
  }

  const requestId = ++rewardSerial;
  rewardActiveId = requestId;
  rewardPending = true;

  return new Promise((resolve) => {
    let viewed = false;
    let paused = false;
    let settled = false;
    const current = () => !settled && rewardActiveId === requestId;

    const timer = setTimeout(() => {
      if (!current()) return;
      settled = true;
      rewardActiveId = 0;
      rewardPending = false;
      resolve({ status: "no_fill" });
    }, REWARD_AD_TIMEOUT_MS);

    const acknowledge = () => {
      if (!current()) return false;
      clearTimeout(timer);
      return true;
    };

    const finish = (result) => {
      if (!current()) return;
      settled = true;
      clearTimeout(timer);
      rewardActiveId = 0;
      rewardPending = false;
      if (paused && busy) resumeAll();
      resolve(result);
    };

    try {
      adBreak({
        type: "reward",
        name: placementId || "shop_tokens",
        beforeReward: (showAdFn) => {
          if (!acknowledge()) return;
          if (typeof showAdFn !== "function") return;
          try {
            showAdFn();
          } catch (error) {
            if (current()) finish({ status: "error", error: String(error?.message || error) });
          }
        },
        beforeAd: () => {
          if (!acknowledge()) return;
          paused = true;
          pauseAll();
        },
        afterAd: () => {
          if (!current()) return;
          if (paused) resumeAll();
        },
        adViewed: () => {
          if (!current()) return;
          viewed = true;
        },
        adDismissed: () => {
          if (!current()) return;
          viewed = false;
        },
        adBreakDone: (info) => {
          if (!current()) return;
          if (viewed || info?.breakStatus === "viewed") return finish({ status: "rewarded" });
          if (info?.breakStatus === "dismissed") return finish({ status: "closed" });
          const status = info?.breakStatus || "other";
          if (["noAdPreloaded", "notReady", "timeout", "other", "ignored"].includes(status)) {
            return finish({ status: "no_fill" });
          }
          finish({ status: "error", error: status });
        },
      });
    } catch (error) {
      finish({ status: "error", error: String(error?.message || error) });
    }
  });
}
