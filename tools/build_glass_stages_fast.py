#!/usr/bin/env python3
"""glass_stages_31_40.json — 유리가 최적해에 필수(추가 기울임)인 스테이지만 채택."""
import json
import random
from copy import deepcopy
from pathlib import Path

from validate_levels import find_solution_moves, layout_fingerprint, solve_level, build_walls

OUT = Path(__file__).resolve().parent / "glass_stages_31_40.json"

NAMES = {
    31: "유리 입문", 32: "첫 균열", 33: "두 번 밀기", 34: "유리 지그재그",
    35: "취약한 길", 36: "6×6 유리숙련", 37: "7×7 유리 데뷔", 38: "얇은 방벽",
    39: "연쇄 파쇄", 40: "유리 그랜드마스터",
}
BALL_HOLE = {
    31: ((0, 0), (5, 5)), 32: ((5, 0), (0, 5)), 33: ((0, 5), (5, 0)),
    34: ((2, 0), (3, 5)), 35: ((5, 5), (0, 0)), 36: ((1, 1), (4, 4)),
    37: ((0, 0), (6, 6)), 38: ((6, 0), (0, 6)), 39: ((3, 0), (3, 6)),
    40: ((6, 6), (0, 0)),
}
PILLAR_HINT = {31: 5, 32: 5, 33: 6, 34: 6, 35: 6, 36: 7, 37: 6, 38: 7, 39: 7, 40: 8}
GLASS_HINT = {31: 1, 32: 1, 33: 2, 34: 2, 35: 2, 36: 2, 37: 2, 38: 3, 39: 3, 40: 4}
MIN_EXTRA_MOVES = {31: 1, 32: 1, 33: 2, 34: 2, 35: 2, 36: 2, 37: 2, 38: 2, 39: 2, 40: 3}


def grid_size(lid):
    return 6 if lid <= 36 else 7


def level_dict(lid, size, pillars, ball, hole, gh=None, gv=None):
    lv = {
        "id": lid, "name": NAMES[lid], "size": size,
        "pillars": [{"row": r, "col": c} for r, c in pillars],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }
    if gh:
        lv["glassH"] = [{"row": r, "col": c} for r, c in gh]
    if gv:
        lv["glassV"] = [{"row": r, "col": c} for r, c in gv]
    return lv


def strip_glass(lv):
    x = deepcopy(lv)
    x.pop("glassH", None)
    x.pop("glassV", None)
    return x


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


def apply_glass(base, edges):
    gh, gv = [], []
    for kind, r, c in edges:
        (gh if kind == "h" else gv).append((r, c))
    return level_dict(
        base["id"], base["size"],
        [(p["row"], p["col"]) for p in base["pillars"]],
        (base["ball"]["row"], base["ball"]["col"]),
        (base["hole"]["row"], base["hole"]["col"]),
        gh or None, gv or None,
    )


def glass_broken_on_path(lv):
    from validate_levels import level_arrays, simulate_tilt, DIRS

    moves = find_solution_moves(lv)
    if not moves:
        return 0
    size = lv["size"]
    ball = (lv["ball"]["row"], lv["ball"]["col"])
    hole = (lv["hole"]["row"], lv["hole"]["col"])
    _, h, v, hg, vg, hs, vs, _, _, _ = level_arrays(lv)
    start = sum(sum(r) for r in hg) + sum(sum(r) for r in vg)
    for d in moves:
        path, moved, won, hg, vg, hs, vs, *_ = simulate_tilt(
            ball, hole, size, h, v, hg, vg, hs, vs, d
        )
        ball = path[-1]
    end = sum(sum(r) for r in hg) + sum(sum(r) for r in vg)
    return start - end


def glass_adds_difficulty(lv, lid):
    """유리 없을 때보다 최적 기울임이 더 많아야 함."""
    ok1, m1 = solve_level(lv)
    ok2, m2 = solve_level(strip_glass(lv))
    if not ok1 or not ok2:
        return False
    extra = MIN_EXTRA_MOVES[lid]
    broken = glass_broken_on_path(lv)
    return broken >= 1 and m1 >= m2 + extra


def search_one(lid, used_layouts, used_solutions, iters):
    size = grid_size(lid)
    ball, hole = BALL_HOLE[lid]
    cells = [(r, c) for r in range(size) for c in range(size) if (r, c) not in (ball, hole)]
    rng = random.Random(31000 + lid * 9973)
    hint_p, hint_g = PILLAR_HINT[lid], GLASS_HINT[lid]
    best = None
    best_score = -1

    for _ in range(iters):
        n_p = rng.randint(max(3, hint_p - 1), min(len(cells), hint_p + 2))
        pillars = rng.sample(cells, n_p)
        base = level_dict(lid, size, pillars, ball, hole)
        edges = glass_candidates(size, pillars)
        if not edges:
            continue
        n_g = rng.randint(max(1, hint_g), min(len(edges), hint_g + 1))
        lv = apply_glass(base, rng.sample(edges, n_g))
        if layout_fingerprint(lv) in used_layouts:
            continue
        if not glass_adds_difficulty(lv, lid):
            continue
        sol = find_solution_moves(lv)
        if sol and sol in used_solutions:
            continue
        ok, m = solve_level(lv)
        if not ok:
            continue
        br = glass_broken_on_path(lv)
        sc = m * 100 + br * 50
        if sc > best_score:
            best_score, best = sc, lv
            if sol:
                best_sol = sol
        if m >= MIN_EXTRA_MOVES[lid] + 8:
            break

    if best is None:
        return None, None
    return best, find_solution_moves(best)


def main():
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "shared/levels.json").read_text(encoding="utf-8"))
    used_layouts = {layout_fingerprint(lv) for lv in data["levels"] if lv["id"] <= 30}
    used_solutions = set()
    for lv in data["levels"]:
        if lv["id"] <= 30:
            s = find_solution_moves(lv)
            if s:
                used_solutions.add(s)

    result = []
    for lid in range(31, 41):
        lv, sol = search_one(lid, used_layouts, used_solutions, 6000)
        if lv is None:
            lv, sol = search_one(lid, used_layouts, used_solutions, 20000)
        if lv is None:
            raise RuntimeError(f"Failed id={lid}")
        used_layouts.add(layout_fingerprint(lv))
        if sol:
            used_solutions.add(sol)
        _, m = solve_level(lv)
        _, m0 = solve_level(strip_glass(lv))
        br = glass_broken_on_path(lv)
        g = len(lv.get("glassH", []) or []) + len(lv.get("glassV", []) or [])
        print(f"  id={lid} opt={m} no_glass={m0} broken={br} glass={g}")
        result.append(lv)

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
