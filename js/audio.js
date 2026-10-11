/**
 * One Web Audio graph for BGM and SFX.
 *
 * iOS Safari silent switch:
 * Web Audio joins the page's audio session. The default session is "ambient",
 * so the hardware silent switch mutes the game and there is no older API to
 * change that. Safari 17+ exposes navigator.audioSession; when it exists we
 * ask for "playback" so a puzzle can be heard with the switch on. If that
 * assignment is rejected, output stays ambient and the switch still mutes it.
 * Flip the switch off on those devices. This file cannot override that.
 *
 * iOS Safari also has no navigator.vibrate. Haptics no-op there. They follow
 * the SFX bus: mute, or an effects volume of 0, skips them.
 *
 * The AudioContext is created and resumed on the first pointerup, touchend,
 * or keydown. Missing BGM files are silent. Playback never awaits on the
 * frame loop; buffers are decoded ahead of time.
 */
import { planClear, planMagma, planPress, planTilt } from "./sfxCues.js";

const STORAGE_KEY = "inthehole_audio";
const MAX_VOICES = 8;
const FADE = 0.7;
const DEFAULTS = { bgm: 0.7, sfx: 0.8, mute: false };

const HAPTIC = {
  roll: 8,
  bump: 14,
  stop: 6,
  goal: [12, 36, 18],
  clear: [12, 40, 16],
  star: 10,
  switch: 8,
  gate: 12,
  glass: [6, 24, 8],
  ice: 8,
  sand: 16,
  teleport: [8, 28, 10],
  jelly: [12, 32, 14],
  "magma-warn": [18, 40, 18],
  magma: [16, 28, 20],
  ui: 6,
  buy: [8, 30, 12],
  denied: [14, 46, 14],
};

const PITCH = {
  clear: 0.012,
  star: 0.012,
  goal: 0.02,
  ui: 0.03,
};

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    return {
      bgm: clamp01(raw.bgm === undefined ? DEFAULTS.bgm : raw.bgm),
      sfx: clamp01(raw.sfx === undefined ? DEFAULTS.sfx : raw.sfx),
      mute: !!raw.mute,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function manifestUrl() {
  return new URL("../assets/audio/manifest.json", import.meta.url);
}

function resolveSource(relative) {
  return new URL(relative, manifestUrl()).href;
}

export function createAudio() {
  const settings = loadSettings();
  const sfxBuffers = new Map();
  const bgmBuffers = new Map();
  const played = [];
  let manifest = null;
  let ctx = null;
  let master = null;
  let bgmBus = null;
  let sfxBus = null;
  let unlocked = false;
  let hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  let wanted = "menu";
  let generation = 0;
  let current = null;
  let playing = false;
  let missing = true;
  let preloaded = false;
  const voices = [];

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* private mode keeps the session mix */
    }
  }

  function preferPlaybackSession() {
    const session = typeof navigator !== "undefined" ? navigator.audioSession : null;
    if (!session) return;
    try {
      session.type = "playback";
    } catch {
      /* ambient session: the iOS silent switch keeps muting output */
    }
  }

  function ensureGraph() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    bgmBus = ctx.createGain();
    sfxBus = ctx.createGain();
    bgmBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    applyGains();
    return ctx;
  }

  function applyGains() {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.setValueAtTime(settings.mute ? 0 : 1, now);
    bgmBus.gain.setValueAtTime(settings.bgm, now);
    sfxBus.gain.setValueAtTime(settings.sfx, now);
  }

  function sfxOff() {
    return settings.mute || settings.sfx <= 0;
  }

  function bgmAudible() {
    return unlocked && ctx && !hidden && !settings.mute && settings.bgm > 0;
  }

  function note(id) {
    played.push(id);
    if (played.length > 64) played.shift();
  }

  function haptic(id) {
    if (sfxOff()) return;
    const pattern = HAPTIC[id];
    if (pattern == null || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* a denied vibration permission is not a game error */
    }
  }

  async function fetchManifest() {
    try {
      const response = await fetch(manifestUrl());
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async function decodeFirst(sources) {
    for (const relative of sources || []) {
      if (!relative) continue;
      try {
        const response = await fetch(resolveSource(relative));
        if (!response.ok) continue;
        const bytes = await response.arrayBuffer();
        const buffer = await decodeBytes(bytes);
        if (buffer) return buffer;
      } catch {
        /* try the next source; a missing file stays silent */
      }
    }
    return null;
  }

  async function decodeBytes(bytes) {
    const attempts = [];
    if (ctx) attempts.push(ctx);
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (Offline) {
      try {
        attempts.push(new Offline(1, 1, 22050));
      } catch {
        /* this browser only decodes on a live context */
      }
    }
    for (const audioCtx of attempts) {
      try {
        return await audioCtx.decodeAudioData(bytes.slice(0));
      } catch {
        /* try the next context or source */
      }
    }
    return null;
  }

  async function preload() {
    manifest = await fetchManifest();
    const entries = Object.entries((manifest && manifest.sfx) || {});
    await Promise.all(entries.map(async ([id, sources]) => {
      const buffer = await decodeFirst(sources);
      sfxBuffers.set(id, buffer);
    }));
    preloaded = true;
  }

  const readyPromise = preload().catch(() => {
    preloaded = true;
    manifest = manifest || { bgm: {}, sfx: {} };
  });

  function play(id, opts = {}) {
    if (!id || sfxOff()) return;
    const buffer = sfxBuffers.get(id);
    if (!buffer) {
      if (!opts._once) {
        readyPromise.then(async () => {
          if (!sfxBuffers.get(id) && ctx && manifest && manifest.sfx) {
            const again = await decodeFirst(manifest.sfx[id]);
            if (again) sfxBuffers.set(id, again);
          }
          play(id, { ...opts, _once: true });
        }).catch(() => {});
      }
      return;
    }
    if (!ctx) return;
    note(id);
    haptic(id);
    const now = ctx.currentTime;
    const delay = Math.max(0, opts.delay || 0);
    const when = now + delay;
    const pitch = PITCH[id] === undefined ? 0.045 : PITCH[id];
    const rate = 1 + (Math.random() * 2 - 1) * pitch;
    const volume = (0.94 + Math.random() * 0.08);
    for (let i = voices.length - 1; i >= 0; i--) {
      if (voices[i].until <= now) voices.splice(i, 1);
    }
    if (voices.length >= MAX_VOICES) {
      const oldest = voices.shift();
      try { oldest.source.stop(); } catch { /* already ended */ }
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.connect(sfxBus);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, when);
    source.connect(gain);
    try {
      source.start(when);
    } catch {
      return;
    }
    const until = when + buffer.duration / rate + 0.05;
    voices.push({ source, until });
    source.onended = () => {
      const index = voices.findIndex((voice) => voice.source === source);
      if (index >= 0) voices.splice(index, 1);
      try {
        gain.disconnect();
      } catch {
        /* node already gone */
      }
    };
  }

  function playCues(cues) {
    for (const cue of cues) play(cue.id, cue);
  }

  function safe(work) {
    try {
      work();
    } catch {
      /* sound must not break a move */
    }
  }

  function captureOffset(entry) {
    if (!entry || !entry.buffer) return 0;
    if (!entry.source || !ctx) return entry.offset || 0;
    const elapsed = Math.max(0, ctx.currentTime - entry.startedAt);
    const duration = entry.buffer.duration || 0;
    if (duration <= 0) return 0;
    return (entry.offset + elapsed) % duration;
  }

  function stopSource(entry, fade) {
    if (!entry || !entry.source || !ctx) return;
    const now = ctx.currentTime;
    const gain = entry.gain;
    try {
      gain.gain.cancelScheduledValues(now);
      const from = gain.gain.value;
      gain.gain.setValueAtTime(from, now);
      if (fade > 0) gain.gain.linearRampToValueAtTime(0, now + fade);
    } catch {
      /* gain node already closed */
    }
    const source = entry.source;
    entry.source = null;
    try {
      source.stop(now + fade + 0.03);
    } catch {
      /* already stopped */
    }
  }

  async function ensureBgm(id) {
    if (bgmBuffers.has(id)) return bgmBuffers.get(id);
    await readyPromise;
    const spec = manifest && manifest.bgm && manifest.bgm[id];
    const sources = (spec && spec.sources) || [];
    if (!sources.length) {
      bgmBuffers.set(id, null);
      return null;
    }
    const buffer = await decodeFirst(sources);
    bgmBuffers.set(id, buffer);
    return buffer;
  }

  function startBgm(id) {
    wanted = id || wanted;
    const token = ++generation;
    if (!bgmAudible()) return;
    ensureBgm(wanted).then((buffer) => {
      if (token !== generation || !bgmAudible()) return;
      const same = current && current.id === wanted && current.source && current.buffer === buffer;
      if (same) return;
      if (!buffer) {
        missing = true;
        playing = false;
        if (current) {
          current.offset = captureOffset(current);
          stopSource(current, FADE);
          current = current.id === wanted ? current : null;
        }
        return;
      }
      missing = false;
      const spec = manifest && manifest.bgm && manifest.bgm[wanted];
      const loop = !spec || spec.loop !== false;
      const offset = current && current.id === wanted ? (current.offset || 0) : 0;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.connect(bgmBus);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(gain);
      const startAt = buffer.duration > 0 ? offset % buffer.duration : 0;
      try {
        source.start(now, startAt);
      } catch {
        missing = true;
        playing = false;
        return;
      }
      gain.gain.linearRampToValueAtTime(1, now + FADE);
      if (current && current.source) stopSource(current, FADE);
      current = {
        id: wanted,
        buffer,
        source,
        gain,
        offset: startAt,
        startedAt: now,
      };
      playing = true;
    }).catch(() => {
      missing = true;
      playing = false;
    });
  }

  function suspendBgm() {
    generation += 1;
    if (!current) {
      playing = false;
      return;
    }
    current.offset = captureOffset(current);
    stopSource(current, hidden ? 0.08 : 0.2);
    playing = false;
  }

  function unlock() {
    preferPlaybackSession();
    const live = ensureGraph();
    if (!live) return;
    unlocked = true;
    if (live.state !== "running") {
      live.resume().then(() => {
        if (!preloaded) return;
        if (bgmAudible()) startBgm(wanted);
      }).catch(() => {});
    }
    if (!preloaded) {
      readyPromise.then(() => {
        if (bgmAudible()) startBgm(wanted);
      });
    } else if (bgmAudible()) {
      startBgm(wanted);
    }
  }

  function onGesture() {
    unlock();
  }

  for (const type of ["pointerup", "touchend", "keydown"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hidden = true;
      suspendBgm();
      return;
    }
    hidden = false;
    if (!unlocked || !ctx) return;
    const go = () => {
      if (bgmAudible()) startBgm(wanted);
    };
    if (ctx.state === "suspended") ctx.resume().then(go).catch(() => {});
    else go();
  });

  preferPlaybackSession();

  return {
    settings() {
      return { bgm: settings.bgm, sfx: settings.sfx, mute: settings.mute };
    },
    setBgm(value) {
      settings.bgm = clamp01(value);
      save();
      applyGains();
      if (settings.bgm <= 0) suspendBgm();
      else if (bgmAudible()) startBgm(wanted);
    },
    setSfx(value) {
      settings.sfx = clamp01(value);
      save();
      applyGains();
    },
    setMute(on) {
      settings.mute = !!on;
      save();
      applyGains();
      if (!bgmAudible()) suspendBgm();
      else startBgm(wanted);
    },
    setScene(scene) {
      const next = scene === "game" ? "game" : "menu";
      if (next === wanted && current && current.source) return;
      wanted = next;
      if (bgmAudible()) startBgm(next);
    },
    play(id, opts) {
      safe(() => play(id, opts));
    },
    playTilt(game, detail) {
      safe(() => {
        const cues = planTilt(game, detail);
        if (detail.moved) cues.push(...planMagma(game, detail.tilts + 1));
        playCues(cues);
      });
    },
    playPress(game, ok) {
      safe(() => {
        playCues(planPress(ok));
        if (ok) playCues(planMagma(game, game.tilts));
      });
    },
    playClear(gainedStars) {
      safe(() => playCues(planClear(gainedStars)));
    },
    whenReady() {
      return readyPromise.then(() => true, () => false);
    },
    played() {
      return played.slice();
    },
    sceneState() {
      const spec = manifest && manifest.bgm && manifest.bgm[wanted];
      const sources = (spec && spec.sources) || [];
      const decoded = bgmBuffers.has(wanted) ? bgmBuffers.get(wanted) : undefined;
      const missing = sources.length === 0 || decoded === null;
      return { scene: wanted, playing, missing };
    },
  };
}
