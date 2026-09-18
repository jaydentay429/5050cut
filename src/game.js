import { CONFIG } from "./config.js";
import { haptic, isMuted, play, tickMusic, toggleMuted, unlockAudio } from "./audio.js";
import { evaluateCut } from "./cut.js";
import { displayLength, lengthForRound, pickObjectType, themeAt, themeIdForType, TYPE_LABELS, catalogTypes, themeTrail } from "./object.js";
import { volumeDeviationPlane, volumeSharePlane } from "./volume.js";
import {
  applyCut,
  comboTitle,
  createScoreState,
  gradeFromScore,
  rankFromRun,
  scoreFromDeviation,
} from "./score.js";
import { hitButton, layoutButtons, renderUI } from "./ui.js";
import { loadCodex, loadHighScore, saveHighScore, unlockCodexEntry } from "./storage.js";
import { onGameEnd, onGameStart, onHappyTime, onShowAd } from "./platform.js";

const MENU = "menu";
const CODEX = "codex";
const PLAYING = "playing";
const FEEDBACK = "feedback";
const GAMEOVER = "gameover";

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * 核心状态机。不碰 DOM / window / WebGL，只接收尺寸、时间和指针坐标。
 */
export class Game {
  constructor(scene) {
    this.scene = scene;
    this.width = 0;
    this.height = 0;
    this.state = MENU;
    this.scoreState = createScoreState();
    this.highScore = loadHighScore();
    this.round = 0;
    this.lastType = null;
    this.sliceObject = null;
    this.strokeStart = null;
    this.strokeCurrent = null;
    this.lastResult = null;
    this.feedbackTime = 0;
    this.hoverPos = null;
    this.pressedId = null;
    this.showHint = true;
    this.time = 0;
    this.bestCut = 0;
    this.pendingGameOver = false;
    this.runEnded = false;
    this.runSummary = null;
    this.muted = isMuted();
    this.landAt = Infinity;
    this.landPlayed = true;
    this.sessionStartHigh = this.highScore;
    this.sparks = [];
    this.themeIndex = 0;
    this.themeCuts = 0;
    this.objectLength = CONFIG.scene.baseLength;
    this.themeFlash = 0;
    this.codex = loadCodex();
    this.codexSelected = null;
    this.codexTheme = "fruit";
    this.menuCycleAt = 0;
    this.hideHud = false;
  }

  catalogTotal() {
    return catalogTypes().length;
  }

  unlockedCount() {
    return catalogTypes().filter((type) => this.codex[type]).length;
  }

  buttons() {
    return layoutButtons(this.width, this.height, this.state, this.muted, {
      unlockedCount: this.unlockedCount(),
      catalogTotal: this.catalogTotal(),
      codexTheme: this.codexTheme,
    });
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.refreshBounds();
  }

  refreshBounds() {
    this.sliceObject = this.scene.getScreenBounds(this.width, this.height);
  }

  spawnObject(round = this.round) {
    const theme = themeAt(this.themeIndex);
    if (this.activeTheme !== theme.id) {
      this.scene.setTheme(theme.id);
      this.activeTheme = theme.id;
    }
    const type = pickObjectType(theme.id, this.lastType);
    this.lastType = type;
    const length =
      this.state === MENU || this.state === CODEX
        ? displayLength(type) * 0.72
        : lengthForRound(type, round, this.scoreState.combo, this.themeIndex);
    this.objectLength = length;
    this.scene.spawn(type, length);
    this.scene.setHeat(this.scoreState.combo);
    this.refreshBounds();
    this.landAt = this.time + CONFIG.scene.dropDuration;
    this.landPlayed = false;
  }

  pointerDown(pos) {
    unlockAudio();
    this.hoverPos = pos;
    const hit = hitButton(this.buttons(), pos);
    if (hit) {
      this.pressedId = hit.id;
      this.strokeStart = null;
      return;
    }

    this.pressedId = null;
    if (this.state === PLAYING) {
      this.strokeStart = pos;
      this.strokeCurrent = pos;
      play("swipe");
      this.scene.setStrokeBlade({ start: pos, end: pos }, this.width, this.height);
    }
  }

  pointerMove(pos) {
    this.hoverPos = pos;
    if (this.strokeStart && this.state === PLAYING) {
      this.strokeCurrent = pos;
      this.scene.setStrokeBlade({ start: this.strokeStart, end: pos }, this.width, this.height);
    }
  }

  pointerUp(pos) {
    this.hoverPos = pos;
    const hit = hitButton(this.buttons(), pos);
    const pressedId = this.pressedId;
    this.pressedId = null;

    if (pressedId && hit && hit.id === pressedId) {
      this.strokeStart = null;
      this.strokeCurrent = null;
      this.scene.setStrokeBlade(null);
      this.handleButton(pressedId);
      return;
    }

    if (this.strokeStart && this.state === PLAYING) {
      const stroke = { start: this.strokeStart, end: pos };
      this.strokeStart = null;
      this.strokeCurrent = null;
      this.scene.setStrokeBlade(null);
      this.resolveStroke(stroke);
      return;
    }

    this.strokeStart = null;
    this.strokeCurrent = null;
    this.scene.setStrokeBlade(null);
  }

  handleButton(id) {
    if (id.startsWith("theme-")) {
      const themeId = id.slice(6);
      if (!CONFIG.themes[themeId]) return;
      play("button");
      this.codexTheme = themeId;
      const pick = CONFIG.themes[themeId].objects.find((type) => this.codex[type]);
      if (pick) this.inspectCodex(pick);
      else {
        this.codexSelected = null;
        this.scene.clearObject();
      }
      return;
    }
    if (id.startsWith("entry-")) {
      const type = id.slice(6);
      if (!this.codex[type]) return;
      play("button");
      this.inspectCodex(type);
      return;
    }
    play("button");
    if (id === "mute") {
      this.muted = toggleMuted();
      return;
    }
    if (id === "start" || id === "again") this.startRun();
    if (id === "restart" || id === "menu") this.returnToMenu();
    if (id === "codex") this.openCodex();
  }

  openCodex() {
    this.state = CODEX;
    this.scene.setInspect(true);
    const types = catalogTypes();
    this.codexSelected = types.find((type) => this.codex[type]) || null;
    this.codexTheme = this.codexSelected ? themeIdForType(this.codexSelected) : CONFIG.themes.order[0];
    this.showCodexObject();
  }

  inspectCodex(type) {
    if (!this.codex[type]) return;
    this.codexSelected = type;
    this.codexTheme = themeIdForType(type);
    this.showCodexObject();
  }

  showCodexObject() {
    if (!this.codexSelected) {
      this.scene.clearObject();
      return;
    }
    const type = this.codexSelected;
    this.scene.setInspect(true);
    this.scene.setTheme(themeIdForType(type));
    this.scene.spawn(type, displayLength(type) * 0.58);
    this.lastType = type;
    this.refreshBounds();
  }

  startRun() {
    onGameStart();
    this.scoreState = createScoreState();
    this.round = 0;
    this.lastType = null;
    this.lastResult = null;
    this.feedbackTime = 0;
    this.bestCut = 0;
    this.pendingGameOver = false;
    this.runEnded = false;
    this.runSummary = null;
    this.showHint = true;
    this.sessionStartHigh = this.highScore;
    this.sparks = [];
    this.themeIndex = 0;
    this.themeCuts = 0;
    this.themeFlash = 0;
    this.hideHud = false;
    this.state = PLAYING;
    this.scene.setInspect(false);
    this.spawnObject(0);
  }

  returnToMenu() {
    if ((this.state === PLAYING || this.state === FEEDBACK) && !this.runEnded) {
      onGameEnd(this.scoreState.total);
      onShowAd("return_to_menu");
      this.runEnded = true;
    }
    this.state = MENU;
    this.codexSelected = null;
    this.scene.setInspect(false);
    this.hideHud = false;
    this.lastResult = null;
    this.pendingGameOver = false;
    this.strokeStart = null;
    this.strokeCurrent = null;
    this.themeIndex = 0;
    this.themeCuts = 0;
    this.spawnObject(0);
  }

  enterGameOver() {
    if (this.runEnded) {
      this.state = GAMEOVER;
      return;
    }
    this.runEnded = true;
    const newRecord = this.scoreState.total > this.sessionStartHigh;
    this.runSummary = {
      score: this.scoreState.total,
      maxCombo: this.scoreState.maxCombo,
      bestCut: this.bestCut,
      rank: rankFromRun(this.scoreState.maxCombo, this.bestCut),
      newRecord,
      gap: Math.max(0, this.sessionStartHigh - this.scoreState.total),
      worlds: Math.min(CONFIG.themes.order.length, this.themeIndex + 1),
      worldTotal: CONFIG.themes.order.length,
      lastTheme: themeAt(this.themeIndex).name,
    };
    play("gameover");
    if (newRecord) {
      play("record");
      this.burstSparks("confetti");
      onHappyTime();
    }
    onGameEnd(this.scoreState.total);
    onShowAd("gameover");
    this.state = GAMEOVER;
  }

  resolveStroke(stroke) {
    if (!this.sliceObject) return;
    const screenCut = evaluateCut(stroke, this.sliceObject);
    if (screenCut.reason === "too_short") return;

    const worldCut = this.scene.evaluateScreenCut(stroke, this.width, this.height);
    if (worldCut.reason === "too_short") return;

    if (!worldCut.hit || !screenCut.hit) {
      this.registerMiss(stroke);
      return;
    }

    this.showHint = false;
    const hadCombo = this.scoreState.combo >= 1;
    const vol = volumeSharePlane(
      this.lastType,
      this.objectLength,
      worldCut.nx,
      worldCut.ny,
      worldCut.nz,
      worldCut.d,
    );
    const deviation = volumeDeviationPlane(
      this.lastType,
      this.objectLength,
      worldCut.nx,
      worldCut.ny,
      worldCut.nz,
      worldCut.d,
    );
    const baseScore = scoreFromDeviation(deviation);
    const next = applyCut(this.scoreState, baseScore);
    this.scoreState = {
      total: next.total,
      combo: next.combo,
      maxCombo: next.maxCombo,
    };
    this.bestCut = Math.max(this.bestCut, baseScore);
    this.pendingGameOver = hadCombo && next.combo === 0;

    const unlock = unlockCodexEntry(this.lastType, baseScore);
    this.codex = unlock.data;

    if (this.scoreState.total > this.highScore) {
      this.highScore = this.scoreState.total;
      saveHighScore(this.highScore);
    }

    const perfect = baseScore >= CONFIG.score.perfectScore;
    this.lastResult = {
      ...worldCut,
      miss: false,
      baseScore: next.baseScore,
      gained: next.gained,
      combo: next.combo,
      grade: gradeFromScore(next.baseScore),
      stroke,
      perfect,
      fatal: this.pendingGameOver,
      leftShare: vol.leftShare,
      rightShare: vol.rightShare,
      axis: "plane",
      nx: worldCut.nx,
      ny: worldCut.ny,
      nz: worldCut.nz,
      cutX: worldCut.cutX ?? screenCut.cutX,
      cutY: worldCut.cutY ?? screenCut.cutY,
      codexNew: unlock.first,
      comboTitle: comboTitle(next.combo),
    };
    this.scene.split(worldCut, perfect, this.pendingGameOver);
    this.scene.setHeat(next.combo);

    if (perfect) {
      play("perfect");
      haptic("perfect");
      this.burstSparks("perfect");
    } else {
      play("cut", this.lastType);
      haptic(this.pendingGameOver ? "break" : "cut");
      if (this.pendingGameOver) this.burstSparks("break");
    }
    if (next.combo >= 2) play("combo", next.combo);
    if (next.combo === 8 || next.combo === 16) onHappyTime();
    if (comboTitle(next.combo)) this.burstSparks("perfect");

    if (!this.pendingGameOver) this.themeCuts += 1;

    this.feedbackTime = 0;
    this.state = FEEDBACK;
  }

  registerMiss(stroke) {
    const hadCombo = this.scoreState.combo >= 1;
    this.pendingGameOver = hadCombo;
    this.lastResult = {
      miss: true,
      baseScore: 0,
      gained: 0,
      combo: this.scoreState.combo,
      grade: "没切到",
      stroke,
      cutX: this.sliceObject.x + this.sliceObject.width / 2,
      fatal: this.pendingGameOver,
    };
    play("miss");
    haptic(hadCombo ? "break" : "cut");
    if (hadCombo) this.burstSparks("break");
    this.feedbackTime = 0;
    this.state = FEEDBACK;
  }

  spawnNext() {
    this.round += 1;
    this.lastResult = null;
    if (this.themeCuts >= CONFIG.themes.cutsPerTheme) {
      this.themeCuts = 0;
      this.themeIndex += 1;
      this.themeFlash = this.time;
    }
    this.state = PLAYING;
    this.spawnObject(this.round);
  }

  previewItem(type) {
    const themeId = themeIdForType(type);
    this.scene.setTheme(themeId);
    this.activeTheme = themeId;
    this.lastType = type;
    this.objectLength = displayLength(type);
    this.scene.spawn(type, this.objectLength);
    this.scene.setShowcase(false);
    this.scene.setInspect(false);
    this.hideHud = true;
    this.refreshBounds();
  }

  feedbackDuration() {
    if (this.lastResult?.fatal) return CONFIG.feedback.breakDuration;
    if (this.lastResult?.perfect) return CONFIG.feedback.perfectDuration;
    return CONFIG.feedback.duration;
  }

  burstSparks(kind) {
    const confetti = kind === "confetti";
    const n = confetti ? 52 : 26;
    const cx = this.width / 2;
    const cy = this.height * (confetti ? 0.26 : 0.36);
    const colors =
      kind === "break"
        ? ["#d42a3b", "#e07a3d", "#f3e6d0"]
        : [CONFIG.ui.accent, CONFIG.ui.cream, "#f6c56a", "#d42a3b"];
    for (let i = 0; i < n; i += 1) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const speed = (confetti ? 90 : 140) + Math.random() * (confetti ? 260 : 220);
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 36,
        y: cy,
        vx: Math.cos(angle) * speed * (confetti ? 0.85 : 0.55),
        vy: -Math.abs(Math.sin(angle) * speed) - 30,
        life: 0.55 + Math.random() * 0.55,
        age: 0,
        color: colors[i % colors.length],
        w: 2.5 + Math.random() * 4,
      });
    }
  }

  updateSparks(dt) {
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 620 * dt;
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
  }

  update(dt) {
    this.time += dt;
    const fatalSlow = this.state === FEEDBACK && this.lastResult?.fatal;
    this.scene.update(dt, { slowMo: fatalSlow });
    this.scene.setShowcase(this.state === MENU || this.state === CODEX);
    this.updateSparks(dt);
    tickMusic({
      mood: this.state === MENU || this.state === CODEX ? "menu" : this.state === GAMEOVER ? "over" : "play",
      combo: this.scoreState.combo,
      theme: this.activeTheme || "fruit",
    });
    if (this.state === MENU && !this.hideHud && this.time - this.menuCycleAt > 2.8) {
      this.menuCycleAt = this.time;
      const types = catalogTypes();
      const idx = Math.max(0, types.indexOf(this.lastType));
      const nextType = types[(idx + 1) % types.length];
      this.scene.setTheme(themeIdForType(nextType));
      this.activeTheme = themeIdForType(nextType);
      this.lastType = nextType;
      this.scene.spawn(nextType, displayLength(nextType));
      this.refreshBounds();
    }
    if (this.scene.consumeThud()) play("thud");
    if (!this.landPlayed && this.time >= this.landAt) {
      this.landPlayed = true;
      play("land");
    }
    if (this.state !== FEEDBACK) return;

    this.feedbackTime += dt;
    const duration = this.feedbackDuration();
    const t = Math.min(1, this.feedbackTime / duration);
    if (this.lastResult && !this.lastResult.miss) {
      this.scene.setSplitProgress(easeOut(t));
    }
    if (this.feedbackTime >= duration) {
      if (this.pendingGameOver) {
        this.enterGameOver();
        return;
      }
      if (this.lastResult?.miss) {
        this.lastResult = null;
        this.state = PLAYING;
      } else {
        this.spawnNext();
      }
    }
  }

  render(ctx) {
    if (this.hideHud) return;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.state === MENU) {
      ctx.fillStyle = CONFIG.ui.menuOverlay;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.drawVignette(ctx);

    const buttons = this.buttons();
    const hovered = hitButton(buttons, this.hoverPos);

    renderUI(ctx, {
      width: this.width,
      height: this.height,
      state: this.state,
      score: this.scoreState.total,
      combo: this.scoreState.combo,
      highScore: this.highScore,
      lastResult: this.lastResult,
      feedbackT: Math.min(1, this.feedbackTime / this.feedbackDuration()),
      liveStroke:
        this.strokeStart && this.strokeCurrent
          ? { start: this.strokeStart, end: this.strokeCurrent }
          : null,
      cutStroke: this.lastResult?.stroke ?? null,
      buttons,
      hoveredId: hovered?.id ?? null,
      pressedId: this.pressedId,
      showHint: this.showHint && this.state === PLAYING,
      time: this.time,
      runSummary: this.runSummary,
      muted: this.muted,
      typeLabel: TYPE_LABELS[this.lastType] || "",
      themeName: themeAt(this.themeIndex).name,
      themeTrail: themeTrail(),
      themeIndex: this.themeIndex,
      themeCount: CONFIG.themes.order.length,
      themeJustChanged: this.time - this.themeFlash < 2.2,
      centerScreen: this.scene.getCenterScreen(this.width, this.height),
      sparks: this.sparks,
      catalog: this.codex,
      catalogTotal: this.catalogTotal(),
      unlockedCount: this.unlockedCount(),
      codexSelected: this.codexSelected,
      codexTheme: this.codexTheme,
    });
  }

  drawVignette(ctx) {
    const fatal = this.state === FEEDBACK && this.lastResult?.fatal;
    const gradient = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) * 0.18,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.72,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(
      1,
      fatal
        ? "rgba(90, 12, 8, 0.42)"
        : this.state === MENU
          ? "rgba(0, 0, 0, 0.18)"
          : this.state === CODEX
            ? "rgba(0, 0, 0, 0.08)"
            : "rgba(0, 0, 0, 0.14)",
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
