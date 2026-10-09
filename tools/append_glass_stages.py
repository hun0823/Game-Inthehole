#!/usr/bin/env python3
"""
[느림 — 사용 비권장] 스테이지당 3만+ 회 BFS로 수십 분 걸려 Cursor/터미널이 중단됩니다.

대신:
  python tools/build_glass_stages_fast.py   # 수 초
  python tools/merge_glass_stages.py
  python tools/sync_js_levels.py
"""
import json
import random
from pathlib import Path

from validate_levels import (
    find_solution_moves,
    layout_fingerprint,
    solve_level,
    build_walls,
)

LEVEL_START = 31
LEVEL_END = 40

NAMES = {
    31: "유리 입문",
    32: "첫 균열",
    33: "두 번 밀기",
    34: "유리 지그재그",
    35: "취약한 길",
    36: "6×6 유리숙련",
    37: "7×7 유리 데뷔",
    38: "얇은 방벽",
    39: "연쇄 파쇄",
    40: "유리 그랜드마스터",
}

BALL_HOLE = {
    31: ((0, 0), (5, 5)),
    32: ((5, 0), (0, 5)),
    33: ((0, 5), (5, 0)),
    34: ((2, 0), (3, 5)),
    35: ((5, 5), (0, 0)),
    36: ((1, 1), (4, 4)),
    37: ((0, 0), (6, 6)),
    38: ((6, 0), (0, 6)),
    39: ((3, 0), (3, 6)),
    40: ((6, 6), (0, 0)),
}

TARGET_MOVES = {
    31: 11,
    32: 11,
    33: 12,
    34: 12,
    35: 12,
    36: 13,
    37: 13,
    38: 14,
    39: 14,
    40: 15,
}

PILLAR_HINT = {
    31: 5,
    32: 5,
    33: 6,
    34: 6,
    35: 6,
    36: 7,
    37: 6,
    38: 7,
    39: 7,
    40: 8,
}

GLASS_HINT = {
    31: 1,
    32: 1,
    33: 2,
    34: 2,
    35: 2,
    36: 2,
    37: 2,
    38: 3,
    39: 3,
    40: 4,
}

MAX_MOVES_CAP = {6: 14, 7: 16}


def grid_size(level_id: int) -> int:
    return 6 if level_id <= 36 else 7


def level_dict(level_id, size, pillars, ball, hole, glass_h=None, glass_v=None):
    lv = {
        "id": level_id,
        "name": NAMES[level_id],
        "size": size,
        "pillars": [{"row": r, "col": c} for r, c in pillars],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }
    if glass_h:
        lv["glassH"] = [{"row": r, "col": c} for r, c in glass_h]
    if glass_v:
        lv["glassV"] = [{"row": r, "col": c} for r, c in glass_v]
    return lv


def glass_candidates(size, pillars):
    h, v = build_walls(size, [{"row": r, "col": c} for r, c in pillars])
    edges = []
    for r in range(size - 1):
        for c in range(size):
            if not h[r][c]:
                edges.append(("h", r, c))
    for r in range(size):
        for c in range(size - 1):
            if not v[r][c]:
                edges.append(("v", r, c))
    return edges


def apply_glass(lv, glass_edges):
    gh, gv = [], []
    for kind, r, c in glass_edges:
        if kind == "h":
            gh.append((r, c))
        else:
            gv.append((r, c))
    return level_dict(
        lv["id"], lv["size"],
        [(p["row"], p["col"]) for p in lv["pillars"]],
        (lv["ball"]["row"], lv["ball"]["col"]),
        (lv["hole"]["row"], lv["hole"]["col"]),
        gh or None, gv or None,
    )


def is_unique(lv, used_layouts, used_solutions):
    if layout_fingerprint(lv) in used_layouts:
        return False
    sol = find_solution_moves(lv)
    if sol is not None and sol in used_solutions:
        return False
    return True


def register(lv, used_layouts, used_solutions):
    used_layouts.add(layout_fingerprint(lv))
    sol = find_solution_moves(lv)
    if sol is not None:
        used_solutions.add(sol)


def search_level(level_id, used_layouts, used_solutions, iterations):
    size = grid_size(level_id)
    target = min(TARGET_MOVES[level_id], MAX_MOVES_CAP[size])
    ball, hole = BALL_HOLE[level_id]
    cells = [
        (r, c)
        for r in range(size)
        for c in range(size)
        if (r, c) != ball and (r, c) != hole
    ]
    hint_p = PILLAR_HINT[level_id]
    hint_g = GLASS_HINT[level_id]
    rng = random.Random(31000 + level_id * 9973)

    best = None
    best_score = float("-inf")
    best_m = -1

    for _ in range(iterations):
        n_p = rng.randint(max(3, hint_p - 1), min(len(cells), hint_p + 2))
        pillars = rng.sample(cells, n_p) if n_p else []
        base = level_dict(level_id, size, pillars, ball, hole)
        edges = glass_candidates(size, pillars)
        if not edges:
            continue

        lo_g = max(1, hint_g - 1)
        hi_g = min(len(edges), hint_g + 1)
        n_g = rng.randint(lo_g, hi_g)
        glass_pick = rng.sample(edges, n_g) if n_g <= len(edges) else edges

        lv = apply_glass(base, glass_pick)
        if not is_unique(lv, used_layouts, used_solutions):
            continue
        ok, m = solve_level(lv)
        if not ok:
            continue
        sc = m * 1000 - abs(len(pillars) - hint_p) * 2 - abs(n_g - hint_g) * 5
        if m < target:
            sc -= (target - m) * 200
        if sc > best_score:
            best, best_score, best_m = lv, sc, m
        if m >= target:
            break

    return best, best_m


def make_level(level_id, used_layouts, used_solutions):
    iters = 35000 if grid_size(level_id) == 6 else 55000
    best, best_m = search_level(level_id, used_layouts, used_solutions, iters)
    if best is None:
        relaxed = TARGET_MOVES[level_id] - 2
        best, best_m = search_level(level_id, used_layouts, used_solutions, iters * 2)
        if best is None:
            raise RuntimeError(f"Failed glass level {level_id}")
    register(best, used_layouts, used_solutions)
    return best


def main():
    raise SystemExit("Retired pillar generator. Run tools/generate_edge_levels.py")
    root = Path(__file__).resolve().parents[1]
    src = root / "shared/levels.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    levels = [lv for lv in data["levels"] if lv["id"] <= 30]
    if len(levels) != 30:
        raise RuntimeError(f"Expected 30 base levels, got {len(levels)}")

    used_layouts = {layout_fingerprint(lv) for lv in levels}
    used_solutions = set()
    for lv in levels:
        sol = find_solution_moves(lv)
        if sol is not None:
            used_solutions.add(sol)

    for i in range(LEVEL_START, LEVEL_END + 1):
        print(f"Generating {i}...")
        levels.append(make_level(i, used_layouts, used_solutions))

    out = {"version": 6, "levelCount": 40, "levels": levels}
    for path in [
        root / "shared/levels.json",
        root / "unity/InTheHole/Assets/Resources/Levels/levels.json",
    ]:
        path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path}")

    print("\nReport (31-40 glass stages):")
    for lv in levels[30:]:
        _, m = solve_level(lv)
        g = len(lv.get("glassH", []) or []) + len(lv.get("glassV", []) or [])
        print(f"  {lv['id']:2}  {lv['size']}x{lv['size']}  pillars={len(lv['pillars']):2}  glass={g}  optimal={m:2}  {lv['name']}")


if __name__ == "__main__":
    main()
