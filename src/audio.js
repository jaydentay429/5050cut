/**
 * Web Audio 合成音效。浏览器 AudioContext 只放这一文件。
 */
import { CONFIG } from "./config.js";
import { loadMuted, saveMuted } from "./storage.js";

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
  master.gain.value = muted ? 0 : CONFIG.audio.master;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const audio = ensureContext();
  if (audio?.state === "suspended") {
    audio.resume().catch(() => {});
  }
  startAmbient();
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  saveMuted(muted);
  if (master) master.gain.value = muted ? 0 : CONFIG.audio.master;
  if (ambGain) ambGain.gain.value = muted ? 0 : CONFIG.audio.ambient;
  if (musicGain) musicGain.gain.value = muted ? 0 : CONFIG.audio.music;
  if (!muted) {
    startAmbient();
    ensureMusic();
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

const MELODY = {
  menu: [392, 0, 440, 0, 523, 0, 440, 0, 392, 0, 349, 0, 440, 0, 392, 0],
  play: [392, 523, 440, 0, 587, 523, 440, 392, 523, 0, 659, 523, 440, 392, 349, 392],
  over: [247, 0, 220, 0, 196, 0, 0, 0, 185, 0, 196, 0, 0, 0, 0, 0],
};

function ensureMusic() {
  const audio = ensureContext();
  if (!audio || musicGain) return audio;
  musicGain = audio.createGain();
  musicGain.gain.value = muted ? 0 : CONFIG.audio.music;
  musicGain.connect(master);

  padGain = audio.createGain();
  padGain.gain.value = 0.012;
  padGain.connect(musicGain);

  const o1 = audio.createOscillator();
  const o2 = audio.createOscillator();
  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.value = 196;
  o2.frequency.value = 247;
  o1.connect(padGain);
  o2.connect(padGain);
  o1.start();
  o2.start();
  padOsc = { o1, o2 };
  return audio;
}

function emitBeat(when, beat) {
  const step = beat % 16;
  const seq = MELODY[musicMood] || MELODY.play;
  const freq = seq[step];
  const heat = 1 + Math.min(0.28, musicCombo * 0.035);

  if (step % 4 === 0) {
    toneAt(musicGain, {
      freq: musicMood === "over" ? 73 : 98,
      freqEnd: musicMood === "over" ? 58 : 82,
      duration: 0.2,
      type: "sine",
      gain: 0.042,
      when,
    });
  }

  if (freq) {
    toneAt(musicGain, {
      freq: freq * (musicMood === "play" ? heat : 1),
      duration: musicMood === "over" ? 0.22 : 0.13,
      type: "triangle",
      gain: musicMood === "menu" ? 0.028 : 0.034,
      when,
    });
  }

  if (musicMood === "play" && step % 2 === 0) {
    noiseAt(musicGain, { duration: 0.028, gain: 0.012 + Math.min(0.012, musicCombo * 0.0015), freq: 1700, when });
  }
}

export function tickMusic({ mood = "menu", combo = 0, theme = "fruit" } = {}) {
  if (!ctx) return;
  const audio = ctx;
  musicMood = mood;
  musicCombo = combo;
  startAmbient();
  ensureMusic();
  if (muted || !padOsc || !padGain) return;

  const pads = {
    fruit: [196, 247],
    veg: [174, 220],
    flower: [220, 330],
    pastry: [196, 294],
    candy: [247, 370],
    stationery: [185, 233],
  };
  const pair = pads[theme] || pads.fruit;
  const padA = mood === "over" ? 110 : mood === "menu" ? 174 : pair[0];
  const padB = mood === "over" ? 146 : mood === "menu" ? 220 : pair[1];
  const padVol = mood === "over" ? 0.008 : mood === "play" ? 0.016 + Math.min(0.01, combo * 0.0012) : 0.012;
  padOsc.o1.frequency.setTargetAtTime(padA, audio.currentTime, 0.18);
  padOsc.o2.frequency.setTargetAtTime(padB, audio.currentTime, 0.18);
  padGain.gain.setTargetAtTime(padVol, audio.currentTime, 0.12);

  if (!musicNext) musicNext = audio.currentTime + 0.04;
  const step = 60 / 90 / 2;
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
    const fruit = new Set(["apple", "pear", "orange", "banana", "strawberry", "lemon"]);
    const flower = new Set(["rose", "tulip", "daisy", "sunflower"]);
    const veg = new Set(["carrot", "cucumber", "corn", "eggplant"]);
    const pastry = new Set(["cake", "bread", "cheese", "onigiri"]);
    const candy = new Set(["lollipop", "chocolate", "macaron", "popsicle"]);
    if (fruit.has(kind)) {
      noise({ duration: 0.1, gain: 0.1, freq: 1400 });
      tone({ freq: 300, freqEnd: 160, duration: 0.13, type: "sine", gain: 0.07 });
    } else if (flower.has(kind)) {
      noise({ duration: 0.08, gain: 0.07, freq: 1800 });
      tone({ freq: 480, freqEnd: 280, duration: 0.12, type: "triangle", gain: 0.05 });
    } else if (veg.has(kind)) {
      noise({ duration: 0.11, gain: 0.09, freq: 900 });
      tone({ freq: 220, freqEnd: 110, duration: 0.14, type: "sine", gain: 0.06 });
    } else if (pastry.has(kind)) {
      noise({ duration: 0.1, gain: 0.08, freq: 700 });
      tone({ freq: 260, freqEnd: 140, duration: 0.16, type: "triangle", gain: 0.06 });
    } else if (candy.has(kind)) {
      noise({ duration: 0.07, gain: 0.06, freq: 2200 });
      tone({ freq: 620, freqEnd: 880, duration: 0.1, type: "sine", gain: 0.05 });
    } else if (kind === "eraser") {
      noise({ duration: 0.1, gain: 0.08, freq: 700 });
      tone({ freq: 180, freqEnd: 110, duration: 0.14, type: "sine", gain: 0.05 });
    } else {
      noise({ duration: 0.09, gain: 0.1, freq: 1200 });
      tone({ freq: 200, freqEnd: 100, duration: 0.12, type: "sine", gain: 0.07 });
    }
  }
}
