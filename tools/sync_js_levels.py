#!/usr/bin/env python3
"""Write js/levels.js from shared/levels.json (edge walls, not pillars)."""

import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "shared/levels.json").read_text(encoding="utf-8"))

header = """/**
 * Auto-synced from shared/levels.json.
 * hWalls[r][c] is the edge between row r and r+1 in column c.
 * vWalls[r][c] is the edge between col c and c+1 in row r.
 * Glass and colored gates use the same edge coordinates.
 */
function levelFromEdges(
  id, name, size, hEdges, vEdges, ball, hole, glassH, glassV, coloredH, coloredV, buttons, par
) {
  const hWalls = Array.from({ length: size - 1 }, () => Array(size).fill(false));
  const vWalls = Array.from({ length: size }, () => Array(size - 1).fill(false));
  for (const [r, c] of hEdges || []) hWalls[r][c] = true;
  for (const [r, c] of vEdges || []) vWalls[r][c] = true;

  const hGlass = Array.from({ length: size - 1 }, () => Array(size).fill(false));
  const vGlass = Array.from({ length: size }, () => Array(size - 1).fill(false));
  for (const [r, c] of glassH || []) hGlass[r][c] = true;
  for (const [r, c] of glassV || []) vGlass[r][c] = true;

  const hColored = Array.from({ length: size - 1 }, () => Array(size).fill(null));
  const vColored = Array.from({ length: size }, () => Array(size - 1).fill(null));
  for (const [r, c, color] of coloredH || []) hColored[r][c] = color;
  for (const [r, c, color] of coloredV || []) vColored[r][c] = color;

  const btnList = (buttons || []).map(([row, col, color]) => ({ row, col, color }));
  return {
    id, name, size, par: par || 0,
    hWalls, vWalls, hGlass, vGlass, hColored, vColored,
    buttons: btnList, ball, hole,
  };
}

export const LEVELS = [
"""

lines = [header]
for lv in data["levels"]:
    h_edges = [[e["row"], e["col"]] for e in lv.get("hWalls") or []]
    v_edges = [[e["row"], e["col"]] for e in lv.get("vWalls") or []]
    glass_h = [[e["row"], e["col"]] for e in lv.get("glassH") or []]
    glass_v = [[e["row"], e["col"]] for e in lv.get("glassV") or []]
    col_h = [[e["row"], e["col"], e.get("color", "red")] for e in lv.get("coloredH") or []]
    col_v = [[e["row"], e["col"], e.get("color", "red")] for e in lv.get("coloredV") or []]
    btns = [[b["row"], b["col"], b.get("color", "red")] for b in lv.get("buttons") or []]
    ball = [lv["ball"]["row"], lv["ball"]["col"]]
    hole = [lv["hole"]["row"], lv["hole"]["col"]]
    lines.append(
        f'  levelFromEdges({lv["id"]}, "{lv["name"]}", {lv["size"]}, '
        f"{json.dumps(h_edges)}, {json.dumps(v_edges)}, {json.dumps(ball)}, {json.dumps(hole)}, "
        f"{json.dumps(glass_h)}, {json.dumps(glass_v)}, "
        f"{json.dumps(col_h)}, {json.dumps(col_v)}, {json.dumps(btns)}, {lv.get('par', 0)}),"
    )
lines[-1] = lines[-1][:-1]
lines.append("];\n")
(root / "js/levels.js").write_text("\n".join(lines), encoding="utf-8")
print("Updated js/levels.js")
