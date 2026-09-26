import { CONFIG } from "./config.js?v=105";
import { haptic, isMuted, play, tickMusic, toggleMuted, unlockAudio, setFocusMuted } from "./audio.js?v=67";
import { evaluateCut } from "./cut.js";
import { ensureFruitModel, ensureWorldBackdrop, isModelReady, prefetchTheme, retainMenuModels, retainPlayModels, warmupModel } from "./fruitAssets.js?v=118";
import { displayLength, pickObjectType, themeAt, themeIdForType, catalogTypes } from "./object.js?v=78";
import { dailyThemeId, getItem } from "./worlds.js?v=102";
import { volumeSharePlane } from "./volume.js?v=76";
import {
  applyCut,
  comboTitle,
  createScoreState,
  gradeFromScore,
  rankFromRun,
  scoreFromDeviation,
} from "./score.js?v=2";
import { collectionScore, hasGrandTrophy, stallStars, stallTrophy, unlockedStallIds } from "./progress.js";
import { hitButton, hitOrbitPad, layoutButtons, layoutOrbitPad, mergePromptButtons, renderUI } from "./ui.js?v=144";
import { ACHIEVEMENTS, achievementSnapshot, pendingAchievements } from "./achievements.js?v=139";
import { loadAchievements, loadCodex, loadEconomy, loadHighScore, saveAchievements, saveEconomy, saveHighScore, todayKey, unlockCodexEntry } from "./storage.js";
import { onGameEnd, onGameStart, onHappyTime, onRewardedAd, onVisibility, openShare, submitRunScore } from "./platform.js?v=15";
import { adHooks, adsStatus, isAdBusy, isRewardPending, noteMeaningfulRun, notePlayTime } from "./ads.js?v=6";
import { fetchBoard, isBoardOverlayOpen, loadBoardProfile, promptBoardName, promptBoardTitle, saveBoardProfile } from "./board.js?v=10";
import { achieveTitle, getLang, setLang, t, themeName, typeLabel } from "./i18n.js?v=141";

const MENU = "menu";
const CODEX = "codex";
const SHOP = "shop";
const ACHIEVE = "achieve";
const BOARD = "board";
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
    this.economy = loadEconomy();
    this.achieve = loadAchievements();
    this.streak98 = 0;
    this.streak100 = 0;
    this.guideArmed = false;
    this.retryMustSave = false;
    this.forcedType = null;
    this.summonPicker = false;
    this.summonScroll = 0;
    this.summonDrag = null;
    this.tokenToast = null;
    this.prompt = null;
    this.spawnToken = 0;
    this.paused = false;
    this.focusMuted = false;
    this.rotating = false;
    this.orbitLast = null;
    this.orbitNudge = { x: 0, y: 0 };
    this.orbitPadLocked = null;
    this.cursor = "default";
    this.perfectRun = 0;
    this.adLeaving = false;
    this.adBusyUi = false;
    this.itemLoading = false;
    this.boardScope = "home";
    this.boardRows = [];
    this.boardMe = null;
    this.boardCountry = "";
    this.boardCountryName = "";
    this.boardLoading = false;
    this.boardError = "";
    this.boardProfile = loadBoardProfile();
    if (this.boardProfile.titleId && !this.achieve.unlocked[this.boardProfile.titleId]) {
      this.boardProfile = { ...this.boardProfile, titleId: "" };
      saveBoardProfile(this.boardProfile);
    }
    this.revokeUnearnedScoreUnlocks();
    adHooks({
      pause: () => {
        this.adBusyUi = true;
      },
      resume: () => {
        this.adBusyUi = false;
      },
    });
    this.flushAchievements();
  }

  previewFullCodex() {
    const next = { ...this.codex };
    for (const type of catalogTypes()) {
      if (!next[type]) next[type] = { cuts: 1, best: 85 };
    }
    this.codex = next;
  }

  persistEconomy() {
    saveEconomy(this.economy);
  }

  persistAchieve() {
    saveAchievements(this.achieve);
  }

  revokeUnearnedScoreUnlocks() {
    const snap = this.achieveSnapshot();
    let tokens = 0;
    for (const row of ACHIEVEMENTS) {
      if (!row.id.startsWith("score_")) continue;
      if (this.achieve.unlocked[row.id] && !row.test(snap)) {
        delete this.achieve.unlocked[row.id];
        tokens += row.tokens;
      }
    }
    if (!tokens) return;
    this.economy.tokens = Math.max(0, this.economy.tokens - tokens);
    this.persistEconomy();
    this.persistAchieve();
    if (this.boardProfile.titleId && !this.achieve.unlocked[this.boardProfile.titleId]) {
      this.boardProfile = { ...this.boardProfile, titleId: "" };
      saveBoardProfile(this.boardProfile);
    }
  }

  achieveSnapshot() {
    return achievementSnapshot({
      highScore: this.highScore,
      runScore: this.scoreState.total,
      bestCombo: Math.max(this.achieve.stats.bestCombo, this.scoreState.maxCombo || 0),
      worlds: Math.max(this.achieve.stats.maxWorlds, Math.min(CONFIG.themes.order.length, this.themeIndex + 1)),
      unlockedCount: this.unlockedCount(),
      catalogTotal: this.catalogTotal(),
      codex: this.codex,
      perfects: Math.max(
        this.achieve.stats.perfects,
        catalogTypes().filter((type) => (this.codex[type]?.best || 0) >= 100).length,
      ),
      highPerfect: Math.max(this.achieve.stats.highPerfect || 0, this.perfectRun || 0),
    });
  }

  flushAchievements() {
    this.achieve.stats.bestCombo = Math.max(this.achieve.stats.bestCombo, this.scoreState.maxCombo || 0);
    this.achieve.stats.maxWorlds = Math.max(
      this.achieve.stats.maxWorlds,
      Math.min(CONFIG.themes.order.length, this.themeIndex + 1),
    );
    const fresh = pendingAchievements(this.achieve.unlocked, this.achieveSnapshot());
    if (!fresh.length) {
      this.persistAchieve();
      return;
    }
    let tokens = 0;
    for (const row of fresh) {
      this.achieve.unlocked[row.id] = Date.now();
      tokens += row.tokens;
    }
    this.persistAchieve();
    const reason = fresh.length === 1 ? achieveTitle(fresh[0].id) : t("achieveN", { n: fresh.length });
    this.grantTokens(tokens, reason);
    if (this.time > 0) play("record");
  }

  catalogTotal() {
    return catalogTypes().length;
  }

  unlockedCount() {
    return catalogTypes().filter((type) => this.codex[type]).length;
  }

  grantTokens(amount, reason) {
    if (amount <= 0) return;
    this.economy.tokens += amount;
    this.persistEconomy();
    this.tokenToast = { amount, reason, at: this.time };
  }

  grantRetry(reason) {
    this.economy.inventory.retry += 1;
    this.persistEconomy();
    this.tokenToast = { amount: 0, reason, at: this.time };
  }

  collection() {
    return collectionScore(this.codex);
  }

  shareReady(channel) {
    return this.economy.lastShareByChannel[channel] !== todayKey();
  }

  buttons() {
    const buttons = mergePromptButtons(
      layoutButtons(this.width, this.height, this.state, this.muted, {
      unlockedCount: this.unlockedCount(),
      catalogTotal: this.catalogTotal(),
      codexTheme: this.codexTheme,
      paused: this.paused,
      summonPicker: this.summonPicker,
      summonTypes: this.summonPicker ? this.summonableTypes() : [],
      summonScroll: this.summonScroll,
      inventory: this.economy.inventory,
      tokens: this.economy.tokens,
      prices: CONFIG.economy.prices,
      shareReady: {
        fb: this.shareReady("fb"),
        x: this.shareReady("x"),
        threads: this.shareReady("threads"),
      },
      shareTokens: CONFIG.economy.shareTokens,
      adTokens: CONFIG.economy.adTokens,
      adsStatus: adsStatus(),
      pendingPrompt: this.prompt,
      fatalBreak: this.pendingGameOver,
      canRetry: Boolean(this.pendingGameOver && this.economy.inventory.retry > 0),
      canGuide: (this.state === PLAYING || this.state === FEEDBACK) && this.economy.inventory.guide > 0,
      canSummon: (this.state === PLAYING || this.state === FEEDBACK) && this.economy.inventory.summon > 0 && this.summonableTypes().length > 0,
      boardScope: this.boardScope,
      boardLoading: this.boardLoading,
      boardName: this.boardProfile?.name || "",
      boardTitle: achieveTitle(this.boardProfile?.titleId),
      achieveList: ACHIEVEMENTS,
      achieveUnlocked: this.achieve.unlocked,
    }),
      this.width,
      this.height,
      this.prompt,
    );
    const ad = buttons["ad-token"];
    if (ad && (isRewardPending() || isAdBusy() || this.adBusyUi)) ad.disabled = true;
    return buttons;
  }

  summonableTypes() {
    const stalls = unlockedStallIds(this.codex);
    const list = [];
    for (const id of stalls) {
      for (const type of CONFIG.themes[id].objects) {
        if (this.codex[type] && !list.includes(type)) list.push(type);
      }
    }
    return list;
  }

  orbitPad() {
    if (this.paused) return null;
    if (this.pendingGameOver) return null;
    if (this.state !== PLAYING && this.state !== FEEDBACK) return null;
    return this.orbitPadLocked || this.lockOrbitPad();
  }

  lockOrbitPad() {
    this.orbitPadLocked = layoutOrbitPad(
      this.width,
      this.height,
      this.scene.getOrbitAnchor(this.width, this.height),
    );
    return this.orbitPadLocked;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.refreshBounds();
    if (this.state === PLAYING || this.state === FEEDBACK) this.lockOrbitPad();
  }

  refreshBounds() {
    this.sliceObject = this.scene.getScreenBounds(this.width, this.height);
  }

  setPaused(on) {
    const allow = this.state === PLAYING || this.state === FEEDBACK;
    this.paused = Boolean(on) && allow;
    if (this.paused) {
      this.strokeStart = null;
      this.strokeCurrent = null;
      this.rotating = false;
      this.orbitLast = null;
      this.scene.setStrokeBlade(null);
    }
  }

  setSuspended(hidden) {
    onVisibility(hidden);
    if (hidden) {
      this.setPaused(true);
      if (!this.muted && !this.focusMuted) {
        this.focusMuted = true;
        setFocusMuted(true);
      }
    } else if (this.focusMuted) {
      this.focusMuted = false;
      setFocusMuted(false);
    }
  }

  async readyModel(type) {
    if (getItem(type)?.model) await ensureFruitModel(type);
    await ensureWorldBackdrop(themeIdForType(type) || themeAt(this.themeIndex).id);
  }

  async spawnObject(round = this.round) {
    const theme = themeAt(this.themeIndex);
    const preferReady = this.themeCuts < 2 || this.round === 0;
    const type = pickObjectType(theme.id, this.lastType, this.forcedType, preferReady && isModelReady("apple"));
    this.forcedType = null;
    this.lastType = type;
    const length = displayLength(type);
    this.objectLength = length;
    const token = ++this.spawnToken;
    this.itemLoading = this.state === PLAYING;
    await this.readyModel(type);
    if (token !== this.spawnToken) return;
    retainPlayModels(theme.id, themeAt(this.themeIndex + 1).id, type);
    this.itemLoading = false;
    if (this.activeTheme !== theme.id) {
      this.scene.setTheme(theme.id);
      this.activeTheme = theme.id;
    }
    this.scene.spawn(type, length);
    this.scene.setCutGuide?.(this.guideArmed && this.state === PLAYING);
    const rarity = getItem(type).rarity || "common";
    if (this.state === PLAYING && rarity === "secret") {
      this.scene.flashStall?.();
      play("combo", 8);
    }
    if (this.state === PLAYING && this.round === 0) this.showHint = true;
    this.scene.setHeat(this.scoreState.combo);
    this.refreshBounds();
    this.orbitPadLocked = null;
    if (this.state === PLAYING) this.lockOrbitPad();
    this.landAt = this.time + CONFIG.scene.dropDuration;
    this.landPlayed = false;
    if (this.state === PLAYING) {
      warmupModel(pickObjectType(theme.id, type));
      const nextStall = themeAt(this.themeIndex + 1).id;
      if (nextStall !== theme.id) {
        ensureWorldBackdrop(nextStall);
        prefetchTheme(nextStall);
      }
    }
  }

  pointerDown(pos) {
    if (isAdBusy() || this.adLeaving) return;
    unlockAudio();
    if (this.paused) {
      this.hoverPos = pos;
      const hit = hitButton(this.buttons(), pos);
      if (hit) this.pressedId = hit.id;
      return;
    }
    this.hoverPos = pos;
    if (this.prompt) {
      const hit = hitButton(this.buttons(), pos);
      if (hit) this.pressedId = hit.id;
      this.strokeStart = null;
      this.rotating = false;
      this.orbitLast = null;
      return;
    }
    if (this.summonPicker) {
      this.strokeStart = null;
      this.rotating = false;
      this.orbitLast = null;
      const buttons = this.buttons();
      const hit = hitButton(buttons, pos);
      if (hit?.id === "summon-cancel" || hit?.id === "mute") {
        this.pressedId = hit.id;
        this.summonDrag = null;
        return;
      }
      this.pressedId = null;
      this.summonDrag = {
        y: pos.y,
        scroll: this.summonScroll,
        hitId: hit?.id || null,
        moved: false,
      };
      return;
    }
    const hit = hitButton(this.buttons(), pos);
    if (hit) {
      this.pressedId = hit.id;
      this.strokeStart = null;
      this.rotating = false;
      this.orbitLast = null;
      return;
    }

    this.pressedId = null;
    const pad = this.orbitPad();
    if (this.state === PLAYING && hitOrbitPad(pad, pos) && this.scene.rotateItem) {
      this.rotating = true;
      this.orbitLast = pos;
      this.orbitNudge = { x: 0, y: 0 };
      this.strokeStart = null;
      this.strokeCurrent = null;
      return;
    }
    if (this.state === PLAYING) {
      if (this.itemLoading) return;
      this.strokeStart = pos;
      this.strokeCurrent = pos;
      play("swipe");
      return;
    }
    const canRotate = this.state === CODEX;
    if (canRotate) {
      this.rotating = true;
      this.orbitLast = pos;
    }
  }

  pointerMove(pos) {
    this.hoverPos = pos;
    if (this.summonPicker && this.summonDrag) {
      const dy = this.summonDrag.y - pos.y;
      if (Math.abs(dy) > 10) this.summonDrag.moved = true;
      this.summonScroll = this.clampSummonScroll(this.summonDrag.scroll + dy);
      return;
    }
    if (this.rotating && this.orbitLast && this.scene.rotateItem) {
      const dx = pos.x - this.orbitLast.x;
      const dy = pos.y - this.orbitLast.y;
      this.scene.rotateItem(dx, dy, this.state === PLAYING);
      this.orbitLast = pos;
      return;
    }
    if (this.strokeStart && this.state === PLAYING) {
      this.strokeCurrent = pos;
    }
  }

  pointerUp(pos) {
    this.hoverPos = pos;
    const hit = hitButton(this.buttons(), pos);
    const pressedId = this.pressedId;
    this.pressedId = null;
    const wasRotating = this.rotating;
    this.rotating = false;
    this.orbitLast = null;
    this.orbitNudge = { x: 0, y: 0 };

    if (this.summonPicker && this.summonDrag) {
      const drag = this.summonDrag;
      this.summonDrag = null;
      this.strokeStart = null;
      this.strokeCurrent = null;
      if (!drag.moved && drag.hitId && hit?.id === drag.hitId) {
        this.handleButton(drag.hitId);
      }
      return;
    }

    if (pressedId && hit && hit.id === pressedId) {
      this.strokeStart = null;
      this.strokeCurrent = null;
      this.scene.setStrokeBlade(null);
      this.handleButton(pressedId);
      return;
    }

    if (wasRotating) {
      this.refreshBounds();
      this.strokeStart = null;
      this.strokeCurrent = null;
      this.scene.setStrokeBlade(null);
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
    if (this.prompt) {
      if (id === "lang-hans") {
        play("button");
        setLang("zh-Hans");
        this.prompt = null;
        return;
      }
      if (id === "lang-hant") {
        play("button");
        setLang("zh-Hant");
        this.prompt = null;
        return;
      }
      if (id === "lang-cancel" || id === "cancel-buy") {
        play("button");
        this.prompt = null;
        return;
      }
      if (id === "confirm-buy") {
        this.confirmPrompt();
        return;
      }
      if (id === "cancel-buy") {
        play("button");
        this.prompt = null;
        return;
      }
      if (id === "mute") {
        play("button");
        this.muted = toggleMuted();
        return;
      }
      if (id === "menu") {
        play("button");
        this.prompt = null;
        this.returnToMenu();
        return;
      }
      return;
    }
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
        ensureWorldBackdrop(themeId).then(() => {
          if (this.codexTheme === themeId) this.scene.setTheme(themeId);
        });
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
    if (id.startsWith("share-")) {
      this.claimShare(id.slice(6));
      return;
    }
    if (id.startsWith("buy-")) {
      this.askBuy(id.slice(4));
      return;
    }
    if (id === "confirm-buy") {
      this.confirmPrompt();
      return;
    }
    if (id === "cancel-buy") {
      play("button");
      this.prompt = null;
      return;
    }
    if (id === "summon-cancel") {
      this.summonPicker = false;
      this.summonScroll = 0;
      this.summonDrag = null;
      play("button");
      return;
    }
    if (id.startsWith("summon-")) {
      this.confirmSummon(id.slice(7));
      return;
    }
    if (id === "slice" || id === "aim") return;
    play("button");
    if (id === "mute") {
      this.muted = toggleMuted();
      return;
    }
    if (id === "lang") {
      if (getLang() === "en") this.prompt = { mode: "lang" };
      else setLang("en");
      return;
    }
    if (id === "start") this.startRun();
    if (id === "again") {
      this.leaveWithAd("again");
      return;
    }
    if (id === "restart" || id === "menu") {
      if (this.state === GAMEOVER) {
        this.leaveWithAd("menu");
        return;
      }
      this.returnToMenu();
    }
    if (id === "codex") this.openCodex();
    if (id === "shop") this.openShop();
    if (id === "board") this.openBoard();
    if (id === "board-home") this.setBoardScope("home");
    if (id === "board-global") this.setBoardScope("global");
    if (id === "board-rename") this.renameBoard();
    if (id === "board-title") this.pickBoardTitle();
    if (id.startsWith("wear-")) this.setBoardTitle(id.slice(5));
    if (id === "achieve") this.openAchieve();
    if (id === "resume") this.setPaused(false);
    if (id === "use-retry") this.tryUseOrBuy("retry");
    if (id === "skip-retry") this.enterGameOver();
    if (id === "use-guide") this.tryUseOrBuy("guide");
    if (id === "use-summon") this.tryUseOrBuy("summon");
    if (id === "ad-token") this.tryRewardedAd();
  }

  openShop() {
    this.state = SHOP;
    this.summonPicker = false;
    this.prompt = null;
    this.showCover();
  }

  openAchieve() {
    this.state = ACHIEVE;
    this.summonPicker = false;
    this.prompt = null;
    this.showCover();
  }

  openBoard() {
    this.state = BOARD;
    this.summonPicker = false;
    this.prompt = null;
    this.showCover();
    this.refreshBoard();
  }

  setBoardScope(scope) {
    this.boardScope = scope === "global" ? "global" : "home";
    play("button");
    this.refreshBoard();
  }

  renameBoard() {
    if (isBoardOverlayOpen()) return;
    play("button");
    const current = this.boardProfile.name;
    window.setTimeout(() => {
      if (isBoardOverlayOpen()) return;
      promptBoardName(current).then(async (name) => {
        if (!name) return;
        if (name === this.boardProfile.name) {
        this.tokenToast = { amount: 0, reason: t("nickSame"), at: this.time };
          return;
        }
        this.boardProfile = { ...this.boardProfile, name };
        saveBoardProfile(this.boardProfile);
        this.tokenToast = { amount: 0, reason: t("nickTo", { name }), at: this.time };
        if (this.highScore > 0) await submitRunScore(this.highScore);
        this.refreshBoard();
      });
    }, 40);
  }

  pickBoardTitle() {
    if (isBoardOverlayOpen()) return;
    play("button");
    const choices = ACHIEVEMENTS.filter((row) => this.achieve.unlocked[row.id]).map((row) => ({
      id: row.id,
      title: achieveTitle(row.id),
    }));
    promptBoardTitle(choices, this.boardProfile.titleId).then((titleId) => {
      if (titleId === null) return;
      this.setBoardTitle(titleId);
    });
  }

  setBoardTitle(titleId) {
    const next = titleId && this.achieve.unlocked[titleId] ? titleId : "";
    if (next === (this.boardProfile.titleId || "")) {
      if (next) this.tokenToast = { amount: 0, reason: t("titleOn", { name: achieveTitle(next) }), at: this.time };
      return;
    }
    this.boardProfile = { ...this.boardProfile, titleId: next };
    saveBoardProfile(this.boardProfile);
    play("button");
    this.tokenToast = {
      amount: 0,
      reason: next ? t("titleShow", { name: achieveTitle(next) }) : t("titleOff"),
      at: this.time,
    };
    const sync = this.highScore > 0 ? submitRunScore(this.highScore) : Promise.resolve();
    sync.finally(() => {
      if (this.state === BOARD) this.refreshBoard();
    });
  }

  refreshBoard() {
    this.boardLoading = true;
    this.boardError = "";
    fetchBoard(this.boardScope, this.boardProfile.id)
      .then((data) => {
        this.boardLoading = false;
        this.boardRows = data.rows || [];
        this.boardMe = data.me;
        this.boardCountry = data.country || "";
        this.boardCountryName = data.countryName || "";
        if (data.country) {
          this.boardProfile = { ...this.boardProfile, country: data.country };
          saveBoardProfile(this.boardProfile);
        }
      })
      .catch(() => {
        this.boardLoading = false;
        this.boardError = t("boardFail");
      });
  }

  leaveWithAd(kind) {
    if (this.adLeaving || isAdBusy()) return;
    if (kind === "again") this.startRun();
    else this.returnToMenu();
  }

  showCover() {
    this.spawnToken += 1;
    this.lastType = null;
    this.activeTheme = "fruit";
    this.scene.setInspect(false);
    this.scene.setCutGuide?.(false);
    this.scene.setTheme("fruit");
    this.scene.clearObject();
    this.itemLoading = false;
    this.landAt = Infinity;
    this.landPlayed = true;
    this.sliceObject = null;
    this.orbitPadLocked = null;
  }

  askBuy(item, useAfter = false) {
    if (!["retry", "guide", "summon"].includes(item)) return;
    const cost = CONFIG.economy.prices[item];
    if (this.economy.tokens < cost) {
      this.tokenToast = { amount: 0, reason: t("noTokens"), at: this.time };
      play("miss");
      return;
    }
    play("button");
    this.prompt = { mode: "buy", item, useAfter: Boolean(useAfter) };
  }

  askUse(item) {
    if (!["retry", "guide", "summon"].includes(item)) return;
    play("button");
    this.prompt = { mode: "use", item, useAfter: false };
  }

  confirmPrompt() {
    const prompt = this.prompt;
    this.prompt = null;
    if (!prompt?.item) return;
    if (prompt.mode === "use") {
      this.applyItem(prompt.item);
      return;
    }
    const before = this.economy.inventory[prompt.item] || 0;
    this.buyItem(prompt.item);
    if (!prompt.useAfter || (this.economy.inventory[prompt.item] || 0) <= before) return;
    this.applyItem(prompt.item);
  }

  applyItem(item) {
    if (item === "retry") this.useRetry();
    else if (item === "guide") this.useGuide();
    else if (item === "summon") this.openSummonPicker();
  }

  buyItem(item) {
    if (!["retry", "guide", "summon"].includes(item)) return;
    const cost = CONFIG.economy.prices[item];
    if (this.economy.tokens < cost) return;
    play("button");
    this.economy.tokens -= cost;
    this.economy.inventory[item] += 1;
    this.persistEconomy();
  }

  claimShare(channel) {
    if (!["fb", "x", "threads"].includes(channel)) return;
    openShare(channel, {
      title: t("title"),
      text: `${t("title")} — ${t("hintCut")}`,
    });
    if (!this.shareReady(channel)) return;
    this.economy.lastShareByChannel[channel] = todayKey();
    this.grantTokens(CONFIG.economy.shareTokens, t("share"));
  }

  tryRewardedAd() {
    if (isAdBusy() || isRewardPending()) return;
    onRewardedAd((ok, status) => {
      if (ok) this.grantTokens(CONFIG.economy.adTokens ?? CONFIG.economy.shareTokens, t("ad"));
      else if (status === "no_fill") this.tokenToast = { amount: 0, reason: t("noAd"), at: this.time };
      else if (status === "closed") this.tokenToast = { amount: 0, reason: t("adSkip"), at: this.time };
    });
  }

  tryUseOrBuy(item) {
    if (item === "retry") {
      if (!this.pendingGameOver) return;
      if (this.economy.inventory.retry > 0) {
        this.askUse("retry");
        return;
      }
      this.askBuy("retry", true);
      return;
    }
    if (item === "guide") {
      if (this.state !== PLAYING && this.state !== FEEDBACK) return;
      if (this.guideArmed) {
        this.tokenToast = { amount: 0, reason: t("guideOn"), at: this.time };
        play("button");
        return;
      }
      if (this.economy.inventory.guide > 0) {
        this.askUse("guide");
        return;
      }
      this.askBuy("guide", true);
      return;
    }
    if (item === "summon") {
      if (this.pendingGameOver) return;
      if (this.state !== PLAYING && this.state !== FEEDBACK) return;
      if (!this.summonableTypes().length) {
        this.tokenToast = { amount: 0, reason: t("summonNeed"), at: this.time };
        play("miss");
        return;
      }
      if (this.economy.inventory.summon > 0) {
        this.askUse("summon");
        return;
      }
      this.askBuy("summon", true);
    }
  }

  useRetry() {
    if (!this.pendingGameOver || this.economy.inventory.retry <= 0) return;
    this.economy.inventory.retry -= 1;
    this.persistEconomy();
    this.pendingGameOver = false;
    this.retryMustSave = true;
    this.lastResult = null;
    this.feedbackTime = 0;
    this.state = PLAYING;
    this.forcedType = this.lastType;
    this.lastType = null;
    this.spawnObject(this.round);
  }

  useGuide() {
    if ((this.state !== PLAYING && this.state !== FEEDBACK) || this.economy.inventory.guide <= 0) return;
    if (this.guideArmed) return;
    this.economy.inventory.guide -= 1;
    this.guideArmed = true;
    this.persistEconomy();
    this.scene.setCutGuide?.(this.state === PLAYING);
  }

  openSummonPicker() {
    if ((this.state !== PLAYING && this.state !== FEEDBACK) || this.pendingGameOver) return;
    if (this.economy.inventory.summon <= 0) return;
    if (!this.summonableTypes().length) return;
    this.summonPicker = true;
    this.summonScroll = 0;
    this.summonDrag = null;
  }

  clampSummonScroll(value) {
    const max = this.buttons()._summon?.maxScroll || 0;
    return Math.max(0, Math.min(max, value));
  }

  pointerWheel(deltaY) {
    if (!this.summonPicker) return;
    this.summonScroll = this.clampSummonScroll(this.summonScroll + deltaY);
  }

  confirmSummon(type) {
    if (!this.summonableTypes().includes(type)) return;
    const rarity = getItem(type).rarity || "common";
    if (rarity === "secret") {
      if (this.economy.lastSummonSecretDay === todayKey()) return;
      const extra = CONFIG.economy.prices.summonSecret - CONFIG.economy.prices.summon;
      if (this.economy.tokens < extra) return;
      this.economy.tokens -= extra;
      this.economy.lastSummonSecretDay = todayKey();
    }
    this.economy.inventory.summon -= 1;
    this.persistEconomy();
    this.summonPicker = false;
    this.pendingGameOver = false;
    this.lastResult = null;
    this.feedbackTime = 0;
    this.state = PLAYING;
    this.forcedType = type;
    this.lastType = null;
    this.spawnObject(this.round);
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

  async showCodexObject() {
    if (!this.codexSelected) {
      this.spawnToken += 1;
      this.scene.clearObject();
      return;
    }
    const type = this.codexSelected;
    const token = ++this.spawnToken;
    this.scene.setInspect(true);
    await this.readyModel(type);
    if (token !== this.spawnToken || this.codexSelected !== type) return;
    retainPlayModels(themeIdForType(type), themeIdForType(type), type);
    this.scene.setTheme(themeIdForType(type));
    this.scene.spawn(type, displayLength(type));
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
    this.themeFlash = this.time;
    this.hideHud = false;
    this.streak98 = 0;
    this.streak100 = 0;
    this.perfectRun = 0;
    this.guideArmed = false;
    this.retryMustSave = false;
    this.forcedType = null;
    this.summonPicker = false;
    this.prompt = null;
    this.paused = false;
    this.state = PLAYING;
    this.scene.setInspect(false);
    retainPlayModels("fruit", themeAt(1).id, "apple");
    this.spawnObject(0);
  }

  async returnToMenu() {
    if ((this.state === PLAYING || this.state === FEEDBACK) && !this.runEnded) {
      onGameEnd(this.scoreState.total);
      this.runEnded = true;
    }
    this.state = MENU;
    this.codexSelected = null;
    this.scene.setInspect(false);
    this.hideHud = false;
    this.lastResult = null;
    this.pendingGameOver = false;
    this.retryMustSave = false;
    this.strokeStart = null;
    this.strokeCurrent = null;
    this.themeIndex = 0;
    this.themeCuts = 0;
    this.summonPicker = false;
    this.prompt = null;
    this.guideArmed = false;
    this.scene.setCutGuide?.(false);
    retainMenuModels();
    this.showCover();
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
      collection: this.collection(),
      collectionMax: CONFIG.economy.collectionMax,
    };
    play("gameover");
    if (newRecord) {
      play("record");
      this.burstSparks("confetti");
      onHappyTime();
    }
    onGameEnd(this.scoreState.total);
    submitRunScore(this.scoreState.total);
    noteMeaningfulRun();
    this.flushAchievements();
    this.state = GAMEOVER;
  }

  resolveStroke(stroke) {
    const worldCut = this.scene.evaluateScreenCut(stroke, this.width, this.height);
    if (worldCut.reason === "too_short") return;

    const screenCut = this.sliceObject ? evaluateCut(stroke, this.sliceObject) : { hit: false };
    if (!worldCut.hit) {
      this.registerMiss(stroke);
      return;
    }

    this.showHint = false;
    let vol =
      this.scene.volumeShares(worldCut) ||
      volumeSharePlane(
        this.lastType,
        this.objectLength,
        worldCut.nx,
        worldCut.ny,
        worldCut.nz,
        worldCut.d,
      );
    if (this.guideArmed && vol) {
      const guide = this.scene.getGuideScreen?.(this.width, this.height);
      const nearLine =
        guide &&
        Number.isFinite(guide.x) &&
        (Math.abs(stroke.start.x - guide.x) + Math.abs(stroke.end.x - guide.x)) / 2 <= 16;
      if (nearLine || Math.abs(vol.leftShare - 0.5) <= 0.025) {
        vol = { ...vol, leftShare: 0.5, rightShare: 0.5 };
      }
    }
    const deviation = Math.abs(vol.leftShare - 0.5);
    const baseScore = scoreFromDeviation(deviation);
    const next = applyCut(this.scoreState, baseScore);
    this.scoreState = {
      total: next.total,
      combo: next.combo,
      maxCombo: next.maxCombo,
    };
    this.bestCut = Math.max(this.bestCut, baseScore);
    this.pendingGameOver = next.combo === 0;
    if (next.combo >= 1) this.retryMustSave = false;
    if (this.pendingGameOver) {
      this.retryMustSave = false;
      this.streak98 = 0;
      this.streak100 = 0;
    }

    const unlock = unlockCodexEntry(this.lastType, baseScore);
    this.codex = unlock.data;

    if (baseScore >= 98) this.streak98 += 1;
    else this.streak98 = 0;
    if (baseScore >= 100) this.streak100 += 1;
    else this.streak100 = 0;
    if (this.streak98 > 0 && this.streak98 % CONFIG.economy.tokenStreak98 === 0) {
      this.grantTokens(CONFIG.economy.tokenStreak98Reward, t("streak"));
    }
    if (this.streak100 > 0 && this.streak100 % CONFIG.economy.tokenStreak100 === 0) {
      this.grantRetry(t("hundred"));
      this.grantTokens(CONFIG.economy.tokenStreak100Reward, t("hundred"));
    }

    if (this.guideArmed) {
      this.guideArmed = false;
      this.scene.setCutGuide?.(false);
    }

    if (this.scoreState.total > this.highScore) {
      this.highScore = this.scoreState.total;
      saveHighScore(this.highScore);
    }
    if (baseScore >= 100) {
      this.achieve.stats.perfects += 1;
      this.perfectRun = (this.perfectRun || 0) + 100;
      this.achieve.stats.highPerfect = Math.max(this.achieve.stats.highPerfect || 0, this.perfectRun);
    }
    this.flushAchievements();

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
      shielded: false,
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
    this.scene.split(worldCut, perfect, this.pendingGameOver, Boolean(comboTitle(next.combo)), {
      leftShare: vol.leftShare,
      rightShare: vol.rightShare,
    });
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
    this.pendingGameOver = true;
    this.retryMustSave = false;
    this.streak98 = 0;
    this.streak100 = 0;
    if (this.guideArmed) {
      this.guideArmed = false;
      this.scene.setCutGuide?.(false);
    }
    this.lastResult = {
      miss: true,
      baseScore: 0,
      gained: 0,
      combo: this.scoreState.combo,
      grade: t("missCut"),
      stroke,
      cutX: this.sliceObject.x + this.sliceObject.width / 2,
      fatal: this.pendingGameOver,
    };
    play("miss");
    haptic(this.pendingGameOver ? "break" : "cut");
    if (this.pendingGameOver) this.burstSparks("break");
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
    retainPlayModels(themeAt(this.themeIndex).id, themeAt(this.themeIndex + 1).id, this.lastType);
    this.spawnObject(this.round);
  }

  async previewItem(type) {
    const themeId = themeIdForType(type);
    const token = ++this.spawnToken;
    await this.readyModel(type);
    if (token !== this.spawnToken) return;
    retainPlayModels(themeId, themeId, type);
    this.lastType = type;
    this.objectLength = displayLength(type);
    this.scene.setTheme(themeId);
    this.activeTheme = themeId;
    this.scene.spawn(type, this.objectLength);
    this.scene.setShowcase(false);
    this.scene.setInspect(false);
    this.hideHud = true;
    this.refreshBounds();
  }

  waitingRetry() {
    return this.pendingGameOver && this.state === FEEDBACK;
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
    if (isAdBusy() || this.adLeaving) return;
    if (this.paused) return;
    this.time += dt;
    if (this.state === PLAYING) notePlayTime(dt);
    const fatalSlow = this.state === FEEDBACK && this.lastResult?.fatal;
    this.scene.update(dt, { slowMo: fatalSlow });
    this.scene.setShowcase(this.state === MENU || this.state === CODEX || this.state === SHOP || this.state === ACHIEVE || this.state === BOARD);
    this.updateSparks(dt);
    tickMusic({
      mood: this.state === MENU || this.state === CODEX || this.state === SHOP || this.state === ACHIEVE || this.state === BOARD ? "menu" : this.state === GAMEOVER ? "over" : "play",
      combo: this.scoreState.combo,
      theme: this.activeTheme || "fruit",
    });
    if (this.scene.consumeThud()) play("thud");
    if (!this.landPlayed && this.time >= this.landAt) {
      this.landPlayed = true;
      play("land");
    }
    if (this.state !== FEEDBACK) return;

    this.feedbackTime += dt;
    const duration = this.feedbackDuration();
    const t = this.waitingRetry()
      ? Math.min(0.7, this.feedbackTime / duration)
      : Math.min(1, this.feedbackTime / duration);
    if (this.lastResult && !this.lastResult.miss) {
      this.scene.setSplitProgress(this.waitingRetry() && this.feedbackTime >= duration ? 1 : easeOut(t));
    }
    if (this.feedbackTime >= duration) {
      if (this.waitingRetry()) return;
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

  cursorFor(hovered) {
    if (isAdBusy() || this.adLeaving) return "wait";
    if (this.summonPicker) {
      if (this.summonDrag) return "grabbing";
      if (hovered) return "pointer";
      return "grab";
    }
    if (hovered) return "pointer";
    if (this.paused) return "default";
    if (this.state === PLAYING || this.state === FEEDBACK) {
      if (hitOrbitPad(this.orbitPad(), this.hoverPos)) return "grab";
      return "crosshair";
    }
    return "default";
  }

  render(ctx) {
    const buttons = this.buttons();
    const hovered = hitButton(buttons, this.hoverPos);
    this.cursor = this.cursorFor(hovered);
    if (this.hideHud) return;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.state === MENU || this.state === SHOP || this.state === ACHIEVE || this.state === BOARD) {
      ctx.fillStyle = CONFIG.ui.menuOverlay;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.drawVignette(ctx);

    renderUI(ctx, {
      width: this.width,
      height: this.height,
      state: this.state,
      score: this.scoreState.total,
      combo: this.scoreState.combo,
      highScore: this.highScore,
      lastResult: this.lastResult,
      feedbackT: this.waitingRetry()
        ? Math.min(0.7, this.feedbackTime / this.feedbackDuration())
        : Math.min(1, this.feedbackTime / this.feedbackDuration()),
      liveStroke:
        this.strokeStart && this.strokeCurrent
          ? { start: this.strokeStart, end: this.strokeCurrent }
          : null,
      cutStroke: this.lastResult?.stroke ?? null,
      itemBounds: this.sliceObject,
      buttons,
      orbitPad: this.orbitPad(),
      orbitActive: this.rotating && this.state === PLAYING,
      orbitHover: hitOrbitPad(this.orbitPad(), this.hoverPos),
      orbitNudge: this.orbitNudge,
      hoveredId: hovered?.id ?? null,
      pressedId: this.pressedId,
      showHint: this.showHint && this.state === PLAYING,
      time: this.time,
      runSummary: this.runSummary,
      muted: this.muted,
      typeLabel: typeLabel(this.lastType),
      themeName: themeName(themeAt(this.themeIndex).id),
      themeIndex: this.themeIndex,
      themeCount: CONFIG.themes.order.length,
      themeFlashAge: this.time - this.themeFlash,
      themeJustChanged: this.time - this.themeFlash < 1.8,
      centerScreen: this.scene.getCenterScreen(this.width, this.height),
      guideLine:
        this.guideArmed && this.state === PLAYING
          ? this.scene.getGuideScreen?.(this.width, this.height)
          : null,
      guideArmed: this.guideArmed && this.state === PLAYING && !this.paused,
      sparks: this.sparks,
      catalog: this.codex,
      catalogTotal: this.catalogTotal(),
      unlockedCount: this.unlockedCount(),
      codexSelected: this.codexSelected,
      codexTheme: this.codexTheme,
      paused: this.paused,
      tokens: this.economy.tokens,
      inventory: this.economy.inventory,
      collection: this.collection(),
      collectionMax: CONFIG.economy.collectionMax,
      stallTrophy: stallTrophy(this.codex, this.codexTheme),
      stallStars: stallStars(this.codex, this.codexTheme),
      grandTrophy: hasGrandTrophy(this.codex),
      trophyLabel: {
        seen: t("stallSeen"),
        bronze: t("bronze"),
        gold: t("gold"),
        grand: t("grandTrophy"),
      },
      dailyTheme: themeName(dailyThemeId()),
      shareReady: {
        fb: this.shareReady("fb"),
        x: this.shareReady("x"),
        threads: this.shareReady("threads"),
      },
      summonPicker: this.summonPicker,
      tokenToast: this.tokenToast && this.time - this.tokenToast.at < 3.2 ? this.tokenToast : null,
      achieveUnlocked: this.achieve.unlocked,
      achieveList: ACHIEVEMENTS,
      prices: CONFIG.economy.prices,
      shareTokens: CONFIG.economy.shareTokens,
      adTokens: CONFIG.economy.adTokens,
      adsStatus: adsStatus(),
      pendingPrompt: this.prompt,
      canRetry: Boolean(this.pendingGameOver && this.economy.inventory.retry > 0),
      boardRows: this.boardRows,
      boardMe: this.boardMe,
      boardScope: this.boardScope,
      boardCountryName: this.boardCountryName,
      boardLoading: this.boardLoading,
      boardError: this.boardError,
      boardName: this.boardProfile?.name || "",
      boardTitle: achieveTitle(this.boardProfile?.titleId),
      boardTitleId: this.boardProfile?.titleId || "",
      itemLoading: this.itemLoading,
      adBusy: this.adBusyUi || isAdBusy(),
    });
    if (isAdBusy() || this.adLeaving) {
      ctx.fillStyle = "rgba(12, 9, 7, 0.62)";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = CONFIG.ui.cream;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 18px 'PingFang TC','Noto Sans TC',system-ui,sans-serif";
      ctx.fillText(t("adPlaying"), this.width / 2, this.height * 0.48);
    }
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
            : this.state === CODEX || this.state === SHOP || this.state === ACHIEVE || this.state === BOARD
            ? "rgba(0, 0, 0, 0.08)"
            : "rgba(0, 0, 0, 0.14)",
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
