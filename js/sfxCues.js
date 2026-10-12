/**
 * Turn a move result into timed SFX ids.
 * Reads the board and the slide result. Does not change rules or state.
 */

const DIR_INDEX = { up: 0, down: 1, left: 2, right: 3 };
const STEP = 1.16;

function cellTimes(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const dr = Math.abs(path[i][0] - path[i - 1][0]);
    const dc = Math.abs(path[i][1] - path[i - 1][1]);
    const far = Math.max(dr, dc) > 1;
    cum.push(cum[i - 1] + (far ? STEP * 0.18 : STEP));
  }
  const total = cum[cum.length - 1] || 0;
  const dur = total > 0 ? Math.max(0.28, Math.min(0.8, 0.16 + total * 0.092)) : 0.16;
  const times = cum.map((dist) => (total > 0 ? (dist / total) * dur : 0));
  return { times, dur };
}

function actAlong(game, path) {
  let act = game.packAct();
  const buttons = game.board.buttons || [];
  for (const [r, c] of path) {
    for (const button of buttons) {
      if (button.row === r && button.col === c) act |= button.bit;
    }
  }
  return act;
}

function hitsHard(game, r, c, dir, phase, act) {
  const index = DIR_INDEX[dir];
  const table = index === undefined ? null : game.board.leave[index];
  if (!table) return true;
  const info = table[r * game.rows + c];
  if (!info || info.wall) return true;
  if (info.colorBit && (act & info.colorBit) === 0) return true;
  const allow = game.board.oneWays.get(info.edgeKey);
  if (allow && allow !== dir) return true;
  for (const shifter of game.board.shifters) {
    const spot = phase & 1 ? shifter.alt : shifter.home;
    if (`${spot.axis}:${spot.r}:${spot.c}` === info.edgeKey) return true;
  }
  const crumbled = game.board.collapseIndex.get(`${info.nr},${info.nc}`);
  if (crumbled && (game.collapse & crumbled)) return true;
  const at = game.board.magma.get(`${info.nr},${info.nc}`);
  if (at !== undefined && game.tilts >= at) return true;
  return false;
}

export function planTilt(game, detail) {
  const path = detail.path || [];
  if (!detail.moved) return [{ id: "bump", delay: 0 }];
  if (path.length < 2) {
    const cues = [{ id: "bump", delay: 0 }, { id: "stop", delay: 0.05 }];
    for (const ev of detail.events || []) {
      if (ev.type === "glassCrack") cues.push({ id: "glassCrack", delay: 0 });
      else if (ev.type === "glassShatter") cues.push({ id: "glass", delay: 0.04 });
    }
    return cues;
  }

  const board = game.board;
  const { times, dur } = cellTimes(path);
  const cues = [{ id: "roll", delay: 0 }];
  let iced = false;
  let hopped = false;
  let bounced = false;
  let switched = false;

  for (let i = 1; i < path.length; i++) {
    const [r, c] = path[i];
    const [pr, pc] = path[i - 1];
    const prevKey = `${pr},${pc}`;
    const hereKey = `${r},${c}`;
    if (!iced && (board.ice.has(hereKey) || board.ice.has(prevKey))) {
      iced = true;
      cues.push({ id: "ice", delay: Math.max(0.04, times[i] - 0.02) });
    }
    const hop = board.teleport.get(prevKey);
    if (!hopped && hop && hop[0] === r && hop[1] === c) {
      hopped = true;
      cues.push({ id: "teleport", delay: times[i] });
    }
    const dr = r - pr;
    const dc = c - pc;
    const axisJump = (dr === 0 || dc === 0) && Math.abs(dr) + Math.abs(dc) === 2;
    if (!bounced && axisJump && board.jelly.has(prevKey) && !(hop && hop[0] === r && hop[1] === c)) {
      bounced = true;
      cues.push({ id: "jelly", delay: times[i] });
    }
    if (!switched) {
      const button = (board.buttons || []).some((item) => (
        item.row === r && item.col === c && !game.activatedColors.has(item.color)
      ));
      if (button) {
        switched = true;
        cues.push({ id: "switch", delay: times[i] });
        cues.push({ id: "gate", delay: times[i] + 0.08 });
      }
    }
  }

  const endT = times[times.length - 1] || dur;
  for (const ev of detail.events || []) {
    if (ev.type === "glassCrack") {
      cues.push({ id: "glassCrack", delay: path.length < 2 ? 0 : endT });
    } else if (ev.type === "glassShatter") {
      cues.push({ id: "glass", delay: Math.max(0.06, Math.min(dur * 0.42, Math.max(0.06, dur - 0.05))) });
    }
  }

  const end = path[path.length - 1];
  if (detail.won) {
    cues.push({ id: "goal", delay: endT });
  } else if (board.sand.has(`${end[0]},${end[1]}`)) {
    cues.push({ id: "sand", delay: endT });
  } else {
    cues.push({ id: "stop", delay: endT });
    const act = actAlong(game, path);
    if (hitsHard(game, end[0], end[1], detail.dir, detail.phase, act)) {
      cues.push({ id: "bump", delay: endT });
    }
  }
  return cues;
}

export function planPress(ok) {
  if (!ok) return [{ id: "denied", delay: 0 }];
  return [
    { id: "switch", delay: 0 },
    { id: "gate", delay: 0.09 },
  ];
}

export function planMagma(game, tiltsAfter) {
  const vents = game.board && game.board.magma;
  if (!vents || vents.size === 0) return [];
  let warn = false;
  let erupt = false;
  for (const at of vents.values()) {
    if (tiltsAfter === at - 1) warn = true;
    if (tiltsAfter === at) erupt = true;
  }
  const cues = [];
  if (warn) cues.push({ id: "magma-warn", delay: 0.04 });
  if (erupt) cues.push({ id: "magma", delay: 0.02 });
  return cues;
}

export function planClear(gainedStars) {
  const cues = [{ id: "clear", delay: 0 }];
  const count = Math.max(0, Math.min(3, gainedStars | 0));
  for (let i = 0; i < count; i++) cues.push({ id: "star", delay: 0.16 + i * 0.14 });
  return cues;
}
