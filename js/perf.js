/**
 * Opt-in frame overlay. Off unless ?fps=1 (remembered) or a previous
 * visit left inthehole_fps=1. ?fps=0 turns it off and remembers that.
 * When off, this module does not build DOM and does not schedule a frame.
 */

const KEY = "inthehole_fps";

function remember(search, storage) {
  let params;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    params = new URLSearchParams();
  }
  if (params.has("fps")) {
    const on = params.get("fps") !== "0";
    try {
      storage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* this visit still follows the query */
    }
    return on;
  }
  try {
    return storage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function formatTris(count) {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function bootPerf(sources) {
  const enabled = remember(location.search, localStorage);
  if (!enabled) return;

  for (const source of sources) {
    if (source && source.watch) source.watch();
  }

  const el = document.createElement("div");
  el.id = "perf-overlay";
  el.setAttribute("aria-hidden", "true");
  el.textContent = "… fps";
  document.body.append(el);

  const frames = [];
  let windowStart = performance.now();
  let last = windowStart;
  let calls = 0;
  let triangles = 0;

  const loop = (now) => {
    const dt = now - last;
    last = now;
    if (dt > 0 && dt < 1000) frames.push(dt);
    let nextCalls = 0;
    let nextTris = 0;
    for (const source of sources) {
      const info = source && source.read ? source.read() : null;
      if (!info) continue;
      nextCalls += info.calls || 0;
      nextTris += info.triangles || 0;
    }
    calls = nextCalls;
    triangles = nextTris;
    if (now - windowStart >= 1000) {
      const elapsed = now - windowStart;
      const fps = frames.length * 1000 / elapsed;
      const sorted = frames.slice().sort((a, b) => a - b);
      const p50 = percentile(sorted, 0.5);
      const p95 = percentile(sorted, 0.95);
      el.textContent = `${fps.toFixed(0)} fps\n${p50.toFixed(1)} / ${p95.toFixed(1)} ms\n${calls} draws · ${formatTris(triangles)} tris`;
      frames.length = 0;
      windowStart = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
