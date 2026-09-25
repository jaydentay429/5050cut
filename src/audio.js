/**
 * Web Audio 合成音效。浏览器 AudioContext 只放这一文件。
 */
import { CONFIG } from "./config.js";
import { loadMuted, saveMuted } from "./storage.js";
import { worldOf } from "./worlds.js?v=99";

let ctx = null;
let master = null;
let muted = loadMuted();
let amb = null;
let ambGain = null;
let musicGain = null;
let padGain = null;
let padOsc = null;
let musicNext = 0;
let musicBeat = 0;
let musicMood = "menu";
let musicCombo = 0;

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = muted || focusMuted ? 0 : CONFIG.audio.master;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === "suspended") {
    audio.resume().then(() => {
      musicNext = 0;
    }).catch(() => {});
  }
  startAmbient();
  ensureMusic();
}

export function isMuted() {
  return muted;
}

let focusMuted = false;

export function setFocusMuted(on) {
  focusMuted = Boolean(on);
  if (!master) return;
  master.gain.value = muted || focusMuted ? 0 : CONFIG.audio.master;
}

export function setMuted(next) {
  muted = Boolean(next);
  saveMuted(muted);
  if (master) master.gain.value = muted || focusMuted ? 0 : CONFIG.audio.master;
  if (ambGain) ambGain.gain.value = muted ? 0 : CONFIG.audio.ambient;
  if (musicGain) musicGain.gain.value = muted ? 0 : CONFIG.audio.music;
  if (!muted) {
    startAmbient();
    ensureMusic();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    musicNext = 0;
  } else {
    musicNext = 0;
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

function tone({ freq, freqEnd, duration, type = "sine", gain = 0.2, delay = 0 }) {
  const audio = ensureContext();
  if (!audio || muted) return;
  const now = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noise({ duration, gain = 0.12, freq = 1200, delay = 0 }) {
  const audio = ensureContext();
  if (!audio || muted) return;
  const now = audio.currentTime + delay;
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  src.start(now);
  src.stop(now + duration + 0.02);
}

function startAmbient() {
  const audio = ensureContext();
  if (!audio || amb || muted) return;
  const length = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    data[i] = last;
  }
  amb = audio.createBufferSource();
  amb.buffer = buffer;
  amb.loop = true;
  ambGain = audio.createGain();
  ambGain.gain.value = CONFIG.audio.ambient;
  amb.connect(ambGain);
  ambGain.connect(master);
  amb.start();
}

function toneAt(dest, { freq, freqEnd, duration, type = "sine", gain = 0.2, when }) {
  const audio = ensureContext();
  if (!audio || muted || !dest) return;
  const start = Math.max(when, audio.currentTime);
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noiseAt(dest, { duration, gain = 0.12, freq = 1200, when }) {
  const audio = ensureContext();
  if (!audio || muted || !dest) return;
  const start = Math.max(when, audio.currentTime);
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  src.start(start);
  src.stop(start + duration + 0.02);
}

/** 自合成循环：C 大调五声，4 小节钩子。无第三方曲库。 */
const HOOK = [
  523, 523, 659, 784, 659, 587, 523, 0,
  392, 523, 659, 523, 587, 659, 784, 0,
  523, 659, 784, 659, 523, 392, 440, 523,
  659, 523, 440, 392, 349, 392, 523, 0,
];
const BASS = [
  130.81, 0, 130.81, 0, 98, 0, 98, 0,
  110, 0, 110, 0, 87.31, 0, 98, 0,
];
const MENU_HOOK = [
  392, 0, 523, 0, 659, 0, 523, 0,
  392, 0, 440, 0, 523, 0, 392, 0,
];

function ensureMusic() {
  const audio = ensureContext();
  if (!audio || musicGain) return audio;
  musicGain = audio.createGain();
  musicGain.gain.value = muted ? 0 : CONFIG.audio.music;
  musicGain.connect(master);

  padGain = audio.createGain();
  padGain.gain.value = 0.01;
  padGain.connect(musicGain);

  const o1 = audio.createOscillator();
  const o2 = audio.createOscillator();
  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.value = 130.81;
  o2.frequency.value = 196;
  o1.connect(padGain);
  o2.connect(padGain);
  o1.start();
  o2.start();
  padOsc = { o1, o2 };
  return audio;
}

function emitBeat(when, beat) {
  const loop = 32;
  const step = ((beat % loop) + loop) % loop;
  const bar8 = step % 16;
  const heat = 1 + Math.min(0.22, musicCombo * 0.028);
  const play = musicMood === "play";
  const over = musicMood === "over";
  const kick = step % 4 === 0;
  const snare = step % 8 === 4;
  const hat = step % 2 === 1;

  if (kick && !over) {
    toneAt(musicGain, {
      freq: 92,
      freqEnd: 48,
      duration: 0.16,
      type: "sine",
      gain: play ? 0.16 : 0.1,
      when,
    });
  }

  if (snare && play) {
    noiseAt(musicGain, { duration: 0.05, gain: 0.028 + Math.min(0.012, musicCombo * 0.0012), freq: 2100, when });
  }

  if (hat && play) {
    noiseAt(musicGain, { duration: 0.018, gain: 0.012, freq: 7800, when });
  }

  const bass = over ? 0 : BASS[bar8];
  if (bass) {
    toneAt(musicGain, {
      freq: bass,
      duration: 0.18,
      type: "triangle",
      gain: play ? 0.12 : 0.08,
      when,
    });
  }

  const hook = over ? 0 : play ? HOOK[step] : MENU_HOOK[bar8];
  if (hook) {
    toneAt(musicGain, {
      freq: hook * (play ? heat : 1),
      duration: play ? 0.15 : 0.2,
      type: "triangle",
      gain: play ? 0.1 : 0.072,
      when,
    });
    if (play && step % 4 === 0) {
      toneAt(musicGain, {
        freq: hook * 2 * heat,
        duration: 0.08,
        type: "sine",
        gain: 0.016,
        when,
      });
    }
  }

  if (over && kick) {
    toneAt(musicGain, {
      freq: 73,
      freqEnd: 52,
      duration: 0.28,
      type: "sine",
      gain: 0.04,
      when,
    });
  }
}

export function tickMusic({ mood = "menu", combo = 0, theme = "fruit" } = {}) {
  if (muted) return;
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
    return;
  }
  const audio = ctx;
  musicMood = mood;
  musicCombo = combo;
  startAmbient();
  ensureMusic();
  if (muted || !padOsc || !padGain) return;

  const pads = {
    fruit: [130.81, 196],
    veg: [146.83, 220],
    flower: [164.81, 246.94],
    pastry: [130.81, 196],
    candy: [174.61, 261.63],
    stationery: [146.83, 220],
    kitchen: [123.47, 185],
    night: [110, 164.81],
    toys: [196, 293.66],
    mineral: [98, 146.83],
  };
  const pair = pads[theme] || pads.fruit;
  const padA = mood === "over" ? 98 : mood === "menu" ? 130.81 : pair[0];
  const padB = mood === "over" ? 146.83 : mood === "menu" ? 196 : pair[1];
  const padVol = mood === "over" ? 0.02 : mood === "play" ? 0.04 + Math.min(0.02, combo * 0.002) : 0.035;
  padOsc.o1.frequency.setTargetAtTime(padA, audio.currentTime, 0.18);
  padOsc.o2.frequency.setTargetAtTime(padB, audio.currentTime, 0.18);
  padGain.gain.setTargetAtTime(padVol, audio.currentTime, 0.12);

  if (!musicNext) musicNext = audio.currentTime + 0.04;
  /** 120 BPM 八分音符，4 小节一轮。 */
  const step = 60 / 120 / 2;
  let guard = 0;
  while (musicNext < audio.currentTime + 0.16 && guard < 8) {
    emitBeat(musicNext, musicBeat);
    musicNext += step;
    musicBeat += 1;
    guard += 1;
  }
}

export function haptic(kind) {
  if (muted || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    if (kind === "cut") navigator.vibrate(10);
    else if (kind === "perfect") navigator.vibrate([10, 24, 18]);
    else if (kind === "break") navigator.vibrate([18, 30, 40]);
  } catch {
    // 部分浏览器禁止振动
  }
}

export function play(name, extra) {
  unlockAudio();
  if (muted) return;
  startAmbient();

  if (name === "button") {
    tone({ freq: 520, freqEnd: 680, duration: 0.08, type: "triangle", gain: 0.08 });
    return;
  }

  if (name === "swipe") {
    noise({ duration: 0.07, gain: 0.04, freq: 1800 });
    return;
  }

  if (name === "miss") {
    tone({ freq: 180, freqEnd: 90, duration: 0.18, type: "sawtooth", gain: 0.06 });
    noise({ duration: 0.1, gain: 0.05, freq: 400 });
    return;
  }

  if (name === "combo") {
    const n = Math.max(1, extra || 1);
    const freq = 520 + Math.min(8, n) * 70;
    tone({ freq, freqEnd: freq * 1.35, duration: 0.12, type: "triangle", gain: 0.08 + Math.min(0.05, n * 0.008) });
    if (n === 3 || n === 5 || n === 8) {
      tone({ freq: freq * 1.5, freqEnd: freq * 2, duration: 0.18, type: "sine", gain: 0.07, delay: 0.04 });
      tone({ freq: 180 + n * 12, freqEnd: 90, duration: 0.22, type: "sine", gain: 0.05, delay: 0.02 });
    }
    return;
  }

  if (name === "land") {
    noise({ duration: 0.08, gain: 0.06, freq: 280 });
    tone({ freq: 90, freqEnd: 60, duration: 0.1, type: "sine", gain: 0.06 });
    return;
  }

  if (name === "thud") {
    noise({ duration: 0.06, gain: 0.05, freq: 220 });
    tone({ freq: 70, freqEnd: 48, duration: 0.08, type: "sine", gain: 0.05 });
    return;
  }

  if (name === "record") {
    tone({ freq: 440, freqEnd: 880, duration: 0.2, type: "triangle", gain: 0.1 });
    tone({ freq: 660, freqEnd: 990, duration: 0.24, type: "sine", gain: 0.06, delay: 0.06 });
    return;
  }

  if (name === "perfect") {
    tone({ freq: 392, freqEnd: 784, duration: 0.18, type: "sine", gain: 0.1 });
    tone({ freq: 494, freqEnd: 988, duration: 0.22, type: "triangle", gain: 0.07, delay: 0.05 });
    tone({ freq: 587, freqEnd: 1174, duration: 0.28, type: "sine", gain: 0.05, delay: 0.1 });
    noise({ duration: 0.14, gain: 0.07, freq: 2400 });
    return;
  }

  if (name === "shield") {
    tone({ freq: 660, freqEnd: 880, duration: 0.14, type: "triangle", gain: 0.08 });
    tone({ freq: 880, freqEnd: 1320, duration: 0.22, type: "sine", gain: 0.07, delay: 0.06 });
    noise({ duration: 0.12, gain: 0.05, freq: 2800 });
    return;
  }

  if (name === "gameover") {
    tone({ freq: 240, freqEnd: 80, duration: 0.42, type: "square", gain: 0.07 });
    return;
  }

  if (name === "cut") {
    const kind = extra || "apple";
    const sfx = (CONFIG.themes[worldOf(kind)] || {}).sfx || "wood";
    if (sfx === "fruit") {
      noise({ duration: 0.1, gain: 0.1, freq: 1400 });
      tone({ freq: 300, freqEnd: 160, duration: 0.13, type: "sine", gain: 0.07 });
    } else if (sfx === "flower") {
      noise({ duration: 0.08, gain: 0.07, freq: 1800 });
      tone({ freq: 480, freqEnd: 280, duration: 0.12, type: "triangle", gain: 0.05 });
    } else if (sfx === "veg") {
      noise({ duration: 0.11, gain: 0.09, freq: 900 });
      tone({ freq: 220, freqEnd: 110, duration: 0.14, type: "sine", gain: 0.06 });
    } else if (sfx === "pastry") {
      noise({ duration: 0.1, gain: 0.08, freq: 700 });
      tone({ freq: 260, freqEnd: 140, duration: 0.16, type: "triangle", gain: 0.06 });
    } else if (sfx === "candy") {
      noise({ duration: 0.07, gain: 0.06, freq: 2200 });
      tone({ freq: 620, freqEnd: 880, duration: 0.1, type: "sine", gain: 0.05 });
    } else {
      noise({ duration: 0.09, gain: 0.1, freq: 1200 });
      tone({ freq: 200, freqEnd: 100, duration: 0.12, type: "sine", gain: 0.07 });
    }
  }
}
