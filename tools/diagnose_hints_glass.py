#!/usr/bin/env python3
import json
import time
from collections import deque
from copy import deepcopy
from pathlib import Path

from validate_levels import (
    DIRS,
    find_solution_moves,
    level_arrays,
    simulate_tilt,
    solve_level,
    state_key,
)

ROOT = Path(__file__).resolve().parents[1]


def bfs_states(level, max_moves=80):
    size = level["size"]
    ball = (level["ball"]["row"], level["ball"]["col"])
    hole = (level["hole"]["row"], level["hole"]["col"])
    _, h, v, hg, vg, hs, vs = level_arrays(level)
    q = deque([(ball, hg, vg, hs, vs, 0)])
    vis = {state_key(ball, hg, vg, hs, vs)}
    expanded = 0
    found = False
    while q:
        pos, hg, vg, hs, vs, depth = q.popleft()
        expanded += 1
        if depth >= max_moves:
            continue
        for d in DIRS:
            path, moved, won, nhg, nvg, nhs, nvs = simulate_tilt(
                pos, hole, size, h, v, hg, vg, hs, vs, d
            )
            if not moved:
                continue
            end = path[-1]
            if won:
                found = True
                continue
            k = state_key(end, nhg, nvg, nhs, nvs)
            if k not in vis:
                vis.add(k)
                q.append((end, nhg, nvg, nhs, nvs, depth + 1))
    return expanded, len(vis), found


def glass_broken_on_optimal(level):
    moves = find_solution_moves(level)
    if not moves:
        return 0, 0
    size = level["size"]
    ball = (level["ball"]["row"], level["ball"]["col"])
    hole = (level["hole"]["row"], level["hole"]["col"])
    _, h, v, hg, vg, hs, vs = level_arrays(level)
    start = sum(sum(r) for r in hg) + sum(sum(r) for r in vg)
    for d in moves:
        path, moved, won, hg, vg, hs, vs = simulate_tilt(
            ball, hole, size, h, v, hg, vg, hs, vs, d
        )
        ball = path[-1]
    end = sum(sum(r) for r in hg) + sum(sum(r) for r in vg)
    return start - end, len(moves)


def main():
    data = json.loads((ROOT / "shared/levels.json").read_text(encoding="utf-8"))
    print("id  sol  opt  ms_find  states  vis  glass  broken  note")
    for lv in data["levels"]:
        t0 = time.time()
        sol = find_solution_moves(lv)
        t1 = (time.time() - t0) * 1000
        ok, opt = solve_level(lv)
        exp, vis, found = bfs_states(lv, 80)
        g = len(lv.get("glassH", []) or []) + len(lv.get("glassV", []) or [])
        br, ml = glass_broken_on_optimal(lv) if g else (0, len(sol) if sol else 0)
        note = ""
        if not sol:
            note = "NO_HINT"
        elif g and br == 0:
            note = "GLASS_UNUSED"
        elif exp > 50000:
            note = "BFS_HEAVY"
        print(
            f"{lv['id']:3}  {'Y' if sol else 'N':3}  {opt:3}  {t1:6.0f}  {exp:7}  {vis:6}  "
            f"{g:5}  {br:7}  {note}"
        )


if __name__ == "__main__":
    main()
