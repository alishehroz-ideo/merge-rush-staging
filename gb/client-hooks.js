// GameBull hooks into the client's page. A classic script the build puts right AFTER their last script
// (title-effects.js), so their files stay exactly as delivered: their top-level functions (start, setupRound, tick,
// finish, showResults, pause, resetMenu, shoot...) are globals this file wraps, and their top-level consts / lets
// (state, sound, festival, cubes, dragId...) are shared with every classic script. The GameBull shell (main.tsx, a
// module) talks only to window.MRClient below.
//
// A GameBull run (tournament / Score Challenge / solo / room), the client's design kept:
//  - their own START: start('normal') = their 通常合体 (their board of 3 cubes, their 3-2-1 START, their 120 s clock,
//    their music); a Score Challenge also starts with their own 3-2-1 (user's choice 2026-10-27: no GameBull 5..1 GO);
//  - a challenge time limit shorter than their 120 s starts their clock with the difference already used (their
//    timer bar and music offset follow, as on their own resume path);
//  - their random launch numbers (2..64, 1/6 each) are kept; the GameBull seed is only logged;
//  - no pause during a run (GameBull run rule): their gear button is hidden for the run and their pause() (Esc,
//    leaving the tab) opens nothing; the clock keeps running;
//  - clock at 0: locked at once (their finish(): no new shots, merges in flight do not land, their time-up sound),
//    "0" held 0.7 s by the shell, then the GameBull board replaces their result screen (so nothing is written to
//    their local TOP10). Challenge target: locked when their total reaches it, board 0.9 s later;
//  - score = their CompetitionScore result: 合体基本点 + 連鎖加点 + 到達ボーナス + 成功率ボーナス = their total.
(function () {
  "use strict";
  var hooks = { onLock: null, onZero: null, onPlaying: null, onEnd: null };   // set by the shell
  var RUN = 120;           // their clock (setupRound: time 120)
  var R = null;            // the current GameBull run, null under the lobby
  var last = null;         // the last run's facts
  var now = function () { return performance.now(); };

  function live() { return !!R && !R.locked && state.phase === "playing"; }
  function result() { return state.competition ? state.competition.result() : null; }
  function liveTotal() { var r = R && result(); return r ? r.total : 0; }

  // ---- their functions, wrapped ----
  // Their round set-up: a challenge limit (or ?devSeconds) shorter than their 120 s uses the difference up front.
  var clientSetupRound = setupRound;
  setupRound = function (mode) {
    clientSetupRound(mode);
    if (!R) return;
    if (R.seconds < RUN) { state.time = R.seconds; lastUiSecond = -1; sync(); }
    console.log("[MR-GB] Their round is set up (" + mode + "): " + Math.ceil(state.time) + " s on their clock" + (R.seconds < RUN ? " (" + (RUN - R.seconds) + " s of their 120 s used up front)." : "."));
  };
  // Their music is 120 s long and follows their clock: with a shorter run it starts at the same offset.
  var clientBgmStart = sound.bgmStart.bind(sound);
  sound.bgmStart = function (offset) {
    if (R && R.seconds < RUN && !(offset > 0)) offset = RUN - R.seconds;
    return clientBgmStart(offset);
  };
  // Their frame loop calls tick() every frame: the run starts (for GameBull) when their 3-2-1 turns into play.
  var clientTick = tick;
  tick = function (dt) {
    var before = state.phase;
    clientTick(dt);
    if (!R) return;
    if (before === "countdown" && state.phase === "playing" && R.startedAt < 0) {
      R.startedAt = now();
      console.log("[MR-GB] Their 3-2-1 START is over: the run is live, " + Math.ceil(state.time) + " s on their clock.");
      hooks.onPlaying && hooks.onPlaying();
    }
    if (R.target > 0 && live()) {
      var t = liveTotal();
      if (t >= R.target) {
        lockBoard();
        R.locked = true; hooks.onLock && hooks.onLock("target");
        console.log("[MR-GB] Challenge target " + R.target + " reached at " + t + "; ending in 0.9 s.");
        setTimeout(function () { end("target"); }, 900);
      }
    }
  };
  // Freeze the board where it is: their 'ending' phase stops their physics, so nothing merges or scores any more.
  function lockBoard() {
    state.phase = "ending"; state.endRemaining = Infinity; dragId = null;
    state.flash = 0; state.shake = 0; $("countdown").textContent = "";
  }
  // Their clock at 0 calls finish(): in a run, lock now (as theirs does), their time-up sound, hold "0", then the board.
  var clientFinish = finish;
  finish = function () {
    if (!R) return clientFinish();
    if (state.phase !== "playing" || R.locked) return;
    R.locked = true; R.zero = true;
    state.time = 0; lockBoard();
    $("endBanner").hidden = true; festival.reset();
    sound.endRound();                                  // their stop + time_up
    if (sound.speech) sound.speech.gameOver();          // their game-over voice (their voice setting)
    sync();
    console.log("[MR-GB] Their clock is at 0: run locked at " + liveTotal() + ".");
    hooks.onLock && hooks.onLock("clock");
    var after = function () { end("time"); };
    if (hooks.onZero) hooks.onZero(after); else setTimeout(after, 700);
  };
  // Their result screen (and their local TOP10 save) is replaced by the GameBull board during a run.
  var clientShowResults = showResults;
  showResults = function () { if (R) return; return clientShowResults(); };
  // GameBull run rule: no pause and no in-game menu during a run. Their gear button is hidden for the run (its
  // place holds the GameBull mute) and their pause() (Esc, the window losing focus, the tab hidden) opens nothing.
  var clientPause = pause, pauseLogged = false;
  pause = function () {
    if (R) { if (!pauseLogged) { pauseLogged = true; console.log("[MR-GB] Their pause is off during a run (GameBull run rule); the clock keeps running."); } return; }
    return clientPause();
  };
  function gearButton(show) { var b = $("pause"); if (b) b.style.visibility = show ? "" : "hidden"; }

  function end(reason) {
    if (!R || R.ended) return;
    R.ended = true; R.locked = true;
    sound.stopBgm(); sound.scheduled = [];
    var r = result() || { base: 0, chain: 0, growth: 0, precision: 0, total: 0, shots: 0, hits: 0, rate: 0, merges: 0, createdMax: 0 };
    last = { reason: reason, total: r.total, base: r.base, chain: r.chain, growth: r.growth, precision: r.precision,
      merges: r.merges, shots: r.shots, hits: r.hits, rate: r.rate, createdMax: r.createdMax, createdLabel: r.createdMax ? numberText(r.createdMax) : "—",
      maxChain: state.maxChain, max: state.max, hud: state.score, playMs: R.startedAt > 0 ? Math.round(now() - R.startedAt) : 0 };
    var check = r.base + r.chain === state.score ? "HUD score = base + chain" : "HUD " + state.score + " != base + chain " + (r.base + r.chain);
    console.log("[MR-GB] Run end '" + reason + "': base " + r.base + " (" + r.merges + " merges), chain " + r.chain + " (max chain " + state.maxChain +
      "), reach " + r.growth + " (made " + last.createdLabel + "), hit rate " + r.precision + " (" + r.hits + "/" + r.shots + " shots), their total " + r.total + "; " + check + ".");
    hooks.onEnd && hooks.onEnd(last);
  }

  // ---- sound ----
  // The GameBull mute = their own music + effects + voice mute (their settings and key, mergeRushAudioSettingsV1).
  // Their delivery starts their female voice (Let's go! / Nice! / Amazing! / Awesome! / New best! / Game over!) muted
  // (作業中のため初期状態はミュート), and the only way to turn it on is their settings panel, which the GameBull build never
  // shows. The client asked for the voice in the GameBull build (2026-10-27): so here their voice follows the GameBull
  // sound switch, ON whenever the game's sound is ON, from the first visit. Their files and their own site are unchanged.
  function muted() { return !!(sound.settings.bgmMuted && sound.settings.sfxMuted); }
  function syncBoxes() { ["bgm", "sfx", "voice"].forEach(function (b) { var m = $(b + "Mute"); if (m) m.checked = !!sound.settings[b + "Muted"]; }); }
  function setMuted(v) {
    v = !!v;
    sound.setSetting("bgmMuted", v); sound.setSetting("sfxMuted", v); sound.setSetting("voiceMuted", v);
    syncBoxes();
  }
  if (!muted() && sound.settings.voiceMuted) {
    sound.settings.voiceMuted = false; sound.applySettings(); syncBoxes();
    console.log("[MR-GB] Their voice ON with the game's sound (their default is muted; the client asked for it in the GameBull build).");
  }
  // iPhone / Safari: Web Audio starts only inside a tap, and Safari does not count an earlier tap once a server call
  // has run. Their own unlock runs on their board taps; here it also runs on every tap in the GameBull screens (the
  // lobby's Join, the challenge's Start), so their context is already running when their 3-2-1 plays. One silent
  // sample primes iOS; the audio session is "playback" (iOS 16.4+), so the silent switch does not mute the game.
  try { if (navigator.audioSession) { navigator.audioSession.type = "playback"; console.log("[MR-GB] Audio session set to playback."); } } catch (e) { /* n/a */ }
  var primedFor = null, unlocked = false;
  function unlockTap() {
    var s = sound.settings;
    if (s.bgmMuted && s.sfxMuted && s.voiceMuted) return;
    try {
      sound.unlock().catch(function () {});                  // their own: creates their context, resume() inside the tap
      var c = sound.ctx; if (!c) return;
      if (primedFor !== c) { primedFor = c; var b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, 22050); b.connect(c.destination); b.start(0); }
      var ok = function () { if (!unlocked && c.state === "running") { unlocked = true; console.log("[MR-GB] Game sound unlocked by a tap (Web Audio running)."); } };
      if (c.state === "running") ok(); else c.resume().then(ok).catch(function () {});
    } catch (e) { /* no Web Audio */ }
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(function (t) { document.addEventListener(t, unlockTap, { capture: true, passive: true }); });

  window.MRClient = {
    hooks: hooks,
    // Under the lobby: their own TOP state (their resetMenu(): sounds stopped, no run); their title screen and menu
    // overlay are never shown (gamebull.css).
    park: function () {
      R = null;
      resetMenu();
      gearButton(true);
    },
    // A run = their own START (start('normal'), as their START button does). opt.seconds = the run length (their
    // 120 s, or a shorter challenge limit / ?devSeconds); opt.target = challenge target (0 = none).
    start: function (opt) {
      opt = opt || {};
      var secs = opt.seconds > 0 ? Math.min(RUN, opt.seconds) : RUN;
      if (opt.seconds > RUN) console.log("[MR-GB] Run length " + opt.seconds + " s is longer than their 120 s clock; their 120 s is kept.");
      R = { seconds: secs, target: opt.target || 0, locked: false, zero: false, ended: false, startedAt: -1 };
      last = null;
      $("titleScreen").hidden = true;      // their start() waits 0.65 s for the title animation only when it is shown
      gearButton(false);
      start("normal");
    },
    totalScore: function () { return R && !R.ended ? liveTotal() : last ? last.total : 0; },
    hudScore: function () { return state.score; },
    // Every sound their sound.load() fetches when a run starts (their music, effects and voice), for the preload.
    audioFiles: function () { return Object.keys(sound.files).map(function (k) { return sound.files[k]; }); },
    remaining: function () { return R && !R.ended && (state.phase === "playing" || state.phase === "ending") ? state.time : 0; },
    isRunning: live,
    muted: muted,
    setMuted: setMuted,
    // Localhost autoplay only (gamebull/ui/DevAuto.tsx): aims at a cube with the same number as theirs (else at
    // random) and fires through their own shoot(), so their rules decide everything.
    autoStep: function () {
      if (!live() || state.clock < state.ready) return;
      var n = state.power || state.current, same = cubes.filter(function (c) { return c.n === n && !c.merging && !c.shot; });
      var aim = same.length ? same.sort(function (a, b) { return a.z - b.z; })[0].x : (Math.random() * 2 - 1) * 2.4;
      state.aim = Math.max(-2.8, Math.min(2.8, aim));
      shoot();
    },
  };
  window.dispatchEvent(new Event("mrclient-ready"));
})();
