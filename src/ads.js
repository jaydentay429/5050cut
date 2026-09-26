/**
 * 广告：Google H5 Ad Placement API。无 client / 本机走 mock。
 * 只从 platform.js 调用。
 */
import { CONFIG } from "./config.js?v=105";
import { setFocusMuted } from "./audio.js?v=67";

let hooks = { pause: () => {}, resume: () => {} };
let inited = false;
let busy = false;
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

export async function showRewarded(placementId) {
  initAds();
  if (busy) return { status: "error", error: "busy" };
  const adBreak = typeof window !== "undefined" ? window.adBreak : null;
  if (!adBreak || isLocal() || !clientId()) {
    if (isLocal()) {
      pauseAll();
      await new Promise((r) => setTimeout(r, 1100));
      resumeAll();
      return { status: "rewarded" };
    }
    return { status: "no_fill" };
  }

  return new Promise((resolve) => {
    let viewed = false;
    let paused = false;
    adBreak({
      type: "reward",
      name: placementId || "shop_tokens",
      beforeReward: (showAdFn) => showAdFn(),
      beforeAd: () => {
        paused = true;
        pauseAll();
      },
      afterAd: () => {
        if (paused) resumeAll();
      },
      adViewed: () => {
        viewed = true;
      },
      adDismissed: () => {
        viewed = false;
      },
      adBreakDone: (info) => {
        if (paused && busy) resumeAll();
        if (viewed || info?.breakStatus === "viewed") return resolve({ status: "rewarded" });
        if (info?.breakStatus === "dismissed") return resolve({ status: "closed" });
        const status = info?.breakStatus || "other";
        if (["noAdPreloaded", "notReady", "timeout", "other", "ignored"].includes(status)) {
          return resolve({ status: "no_fill" });
        }
        resolve({ status: "error", error: status });
      },
    });
  });
}
