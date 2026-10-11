#!/usr/bin/env node
/**
 * Re-bake Rollin' Board SFX from tools/sfx/params.json.
 *
 *   node tools/sfx/bake.mjs
 *
 * Reads jsfxr parameters, synthesizes with the vendored jsfxr
 * (tools/sfx/vendor, public domain), trims and soft-limits, then writes
 * AAC (.m4a, Safari) and Vorbis (.ogg) under assets/audio/sfx/.
 * Updates the "sfx" map in assets/audio/manifest.json and leaves "bgm" alone.
 * Fails if the baked files together exceed 150KB.
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const paramsPath = path.join(root, "tools/sfx/params.json");
const manifestPath = path.join(root, "assets/audio/manifest.json");
const outDir = path.join(root, "assets/audio/sfx");
const BUDGET = 150 * 1024;
const PEAK = 0.62;

const require = createRequire(path.join(root, "tools/sfx/vendor/sfxr.js"));
const { SoundEffect } = require(path.join(root, "tools/sfx/vendor/sfxr.js"));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shape(samples, rate) {
  let end = samples.length - 1;
  while (end > rate * 0.02 && Math.abs(samples[end]) < 0.008) end -= 1;
  const tail = Math.floor(rate * 0.018);
  end = Math.min(samples.length - 1, end + tail);
  const cut = samples.slice(0, Math.max(1, end + 1));
  let peak = 0;
  for (const sample of cut) peak = Math.max(peak, Math.abs(sample) || 0);
  const gain = peak > 0.0001 ? Math.min(1, PEAK / peak) : 1;
  const fade = Math.max(1, Math.min(Math.floor(rate * 0.006), Math.floor(cut.length / 4)));
  for (let i = 0; i < cut.length; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    if (i > cut.length - fade) g *= (cut.length - i) / fade;
    const value = cut[i] * g;
    cut[i] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  }
  return cut;
}

function wavBytes(samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return buf;
}

function encode(wav, dest, args) {
  const result = spawnSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", wav,
    ...args,
    dest,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed for ${dest}`);
  }
}

const spec = JSON.parse(fs.readFileSync(paramsPath, "utf8"));
const defaults = spec.defaults || {};
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rollin-sfx-"));
const sfx = {};
const rows = [];

try {
  for (const [id, sound] of Object.entries(spec.sounds || {})) {
    Math.random = mulberry32(hash(id));
    const params = { ...defaults, ...(sound.params || {}) };
    const rate = params.sample_rate || 22050;
    const rendered = new SoundEffect(params).getRawBuffer();
    const samples = shape(rendered.normalized, rate);
    if (!samples.length) throw new Error(`${id} rendered empty`);
    const wav = path.join(tmp, `${id}.wav`);
    fs.writeFileSync(wav, wavBytes(samples, rate));
    const m4a = path.join(outDir, `${id}.m4a`);
    const ogg = path.join(outDir, `${id}.ogg`);
    encode(wav, m4a, ["-c:a", "aac", "-b:a", "40k", "-ac", "1", "-ar", String(rate)]);
    encode(wav, ogg, ["-c:a", "libvorbis", "-q:a", "0", "-ac", "1", "-ar", String(rate)]);
    sfx[id] = [`sfx/${id}.m4a`, `sfx/${id}.ogg`];
    rows.push({
      id,
      label: sound.label || id,
      ms: Math.round((samples.length / rate) * 1000),
      m4a: fs.statSync(m4a).size,
      ogg: fs.statSync(ogg).size,
    });
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

let manifest = {
  notes: "Paths are relative to this file. BGM sources stay empty until a track is chosen. Drop a loop in assets/audio/bgm/ and list it, for example [\"bgm/menu.m4a\", \"bgm/menu.ogg\"]. The first source that decodes is used. Empty or missing files stay silent. SFX entries are rewritten by tools/sfx/bake.mjs.",
  bgm: {
    menu: { loop: true, sources: [] },
    game: { loop: true, sources: [] },
  },
  sfx: {},
};
if (fs.existsSync(manifestPath)) {
  const prev = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest = { ...manifest, ...prev, sfx };
  if (!manifest.bgm) manifest.bgm = { menu: { loop: true, sources: [] }, game: { loop: true, sources: [] } };
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

let total = 0;
const lines = ["id            ms   m4a    ogg   label"];
for (const row of rows) {
  total += row.m4a + row.ogg;
  lines.push(
    `${row.id.padEnd(12)} ${String(row.ms).padStart(4)} ${String(row.m4a).padStart(6)} ${String(row.ogg).padStart(6)}   ${row.label}`
  );
}
lines.push(`total ${total} bytes (${rows.length} sounds, m4a+ogg)`);
console.log(lines.join("\n"));
if (total > BUDGET) {
  console.error(`SFX bake is ${total} bytes, over the ${BUDGET} byte budget`);
  process.exit(1);
}
