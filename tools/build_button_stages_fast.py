#!/usr/bin/env python3
"""button_stages_41_50.json — 빨간 버튼으로 같은 색 벽 제거가 최적해에 필수인 스테이지."""
import json
import random
from copy import deepcopy
from pathlib import Path

from validate_levels import (
    build_walls,
    button_required,
    find_solution_moves,
    layout_fingerprint,
    level_arrays,
    simulate_tilt,
    solve_level,
    try_activate_button,
)

OUT = Path(__file__).resolve().parent / "button_stages_41_50.json"

NAMES = {
    41: "빨간 스위치", 42: "벽이 막는다", 43: "버튼 먼저", 44: "우회로",
    45: "이중 차단", 46: "6×6 스위치", 47: "7×7 버튼 데뷔", 48: "긴 우회",
    49: "스위치 연쇄", 50: "버튼 마스터",
}
BALL_HOLE = {
    41: ((0, 0), (5, 5)), 42: ((5, 0), (0, 5)), 43: ((0, 5), (5, 0)),
    44: ((2, 0), (3, 5)), 45: ((5, 5), (0, 0)), 46: ((1, 1), (4, 4)),
    47: ((0, 0), (6, 6)), 48: ((6, 0), (0, 6)), 49: ((3, 0), (3, 6)),
    50: ((6, 6), (0, 0)),
}
PILLAR_HINT = {41: 6, 42: 6, 43: 7, 44: 7, 45: 7, 46: 8, 47: 7, 48: 8, 49: 8, 50: 9}
COLOR_HINT = {41: 3, 42: 3, 43: 4, 44: 4, 45: 5, 46: 4, 47: 5, 48: 5, 49: 5, 50: 6}
MIN_EXTRA_MOVES = {41: 2, 42: 2, 43: 3, 44: 3, 45: 3, 46: 3, 47: 3, 48: 3, 49: 3, 50: 4}
TARGET_OPTIMAL = {
    41: 12, 42: 13, 43: 14, 44: 14, 45: 15,
    46: 15, 47: 16, 48: 16, 49: 17, 50: 18,
}


def grid_size(lid):
    return 6 if lid <= 46 else 7


def level_dict(lid, size, pillars, ball, hole, colored_h=None, colored_v=None, buttons=None):
    lv = {
        "id": lid,
        "name": NAMES[lid],
        "size": size,
        "pillars": [{"row": r, "col": c} for r, c in pillars],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }
    if colored_h:
        lv["coloredH"] = [{"row": r, "col": c, "color": "red"} for r, c in colored_h]
    if colored_v:
        lv["coloredV"] = [{"row": r, "col": c, "color": "red"} for r, c in colored_v]
    if buttons:
        lv["buttons"] = [{"row": r, "col": c, "color": "red"} for r, c in buttons]
    return lv


def strip_button_mechanic(lv):
    x = deepcopy(lv)
    x.pop("coloredH", None)
    x.pop("coloredV", None)
    x.pop("buttons", None)
    return x


def colored_candidates(size, pillars):
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


def apply_colored(base, edges):
    ch, cv = [], []
    for kind, r, c in edges:
        (ch if kind == "h" else cv).append((r, c))
    return level_dict(
        base["id"],
        base["size"],
        [(p["row"], p["col"]) for p in base["pillars"]],
        (base["ball"]["row"], base["ball"]["col"]),
        (base["hole"]["row"], base["hole"]["col"]),
        ch or None,
        cv or None,
        None,
    )


def color_activated_on_path(lv):
    moves = find_solution_moves(lv, max_moves=120, allow_button=True)
    if not moves:
        return 0
    size = lv["size"]
    ball = (lv["ball"]["row"], lv["ball"]["col"])
    hole = (lv["hole"]["row"], lv["hole"]["col"])
    _, h, v, hg, vg, hs, vs, hc, vc, buttons = level_arrays(lv)
    activated = set()
    for d in moves:
        if d is None:
            try_activate_button(ball, buttons, activated, hc, vc)
            continue
        path, moved, won, hg, vg, hs, vs, hc, vc, activated = simulate_tilt(
            ball, hole, size, h, v, hg, vg, hs, vs, d, hc, vc, activated, buttons,
            auto_activate=True,
        )
        ball = path[-1]
    return len(activated)


def path_edges_without_colored(size, pillars, ball, hole):
    """색상벽 없을 때 최적 경로가 지나는 칸 경계."""
    base = {
        "size": size,
        "pillars": [{"row": r, "col": c} for r, c in pillars],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }
    moves = find_solution_moves(base, max_moves=120, allow_button=True)
    if not moves:
        return set()
    _, h, v, hg, vg, hs, vs, _, _, _ = level_arrays(base)
    edges = set()
    pos = ball
    for d in moves:
        path, moved, won, *_ = simulate_tilt(
            pos, hole, size, h, v, hg, vg, hs, vs, d, auto_activate=True,
        )
        for i in range(len(path) - 1):
            r0, c0 = path[i]
            r1, c1 = path[i + 1]
            if r1 == r0 + 1:
                edges.add(("h", r0, c0))
            elif r1 == r0 - 1:
                edges.add(("h", r1, c1))
            elif c1 == c0 + 1:
                edges.add(("v", r0, c0))
            elif c1 == c0 - 1:
                edges.add(("v", r0, c1))
        pos = path[-1]
    return edges


def button_adds_difficulty(lv, lid, min_optimal=None):
    """버튼으로 색상벽을 없애야만 해결 가능 + 목표 최적 이동 수."""
    need = min_optimal if min_optimal is not None else TARGET_OPTIMAL.get(lid, 12)
    ok1, m1 = solve_level(lv, max_moves=120, allow_button=True)
    if not ok1 or m1 < need:
        return False, m1
    ok0, _ = solve_level(lv, max_moves=120, allow_button=False)
    if ok0:
        return False, m1
    ok2, m2 = solve_level(strip_button_mechanic(lv), max_moves=120, allow_button=True)
    if not ok2 or m1 < m2 + MIN_EXTRA_MOVES[lid]:
        return False, m1
    return True, m1


def search_one(lid, used_layouts, used_solutions, iters, min_optimal=None):
    size = grid_size(lid)
    ball, hole = BALL_HOLE[lid]
    cells = [(r, c) for r in range(size) for c in range(size) if (r, c) not in (ball, hole)]
    rng = random.Random(41000 + lid * 9973)
    hint_p, hint_c = PILLAR_HINT[lid], COLOR_HINT[lid]
    best = None
    best_score = -1

    for _ in range(iters):
        n_p = rng.randint(max(3, hint_p - 1), min(len(cells), hint_p + 2))
        pillars = rng.sample(cells, n_p)
        base = level_dict(lid, size, pillars, ball, hole)
        edges = colored_candidates(size, pillars)
        if len(edges) < 2:
            continue
        n_c = rng.randint(max(2, hint_c), min(len(edges), hint_c + 2))
        lv = apply_colored(base, rng.sample(edges, n_c))
        btn_cells = [c for c in cells if c not in pillars]
        if not btn_cells:
            continue
        btn = rng.choice(btn_cells)
        lv["buttons"] = [{"row": btn[0], "col": btn[1], "color": "red"}]
        if layout_fingerprint(lv) in used_layouts:
            continue
        ok, m = button_adds_difficulty(lv, lid, min_optimal)
        if not ok:
            continue
        sol = find_solution_moves(lv, max_moves=120)
        if sol and sol in used_solutions:
            continue
        sc = m * 100 + n_c * 15
        if sc > best_score:
            best_score, best = sc, lv
        need = min_optimal if min_optimal is not None else TARGET_OPTIMAL.get(lid, 12)
        if m >= need + 2:
            break

    return best, find_solution_moves(best, max_moves=120) if best else None


def search_batches(lid, need):
    batches = ((600, need), (1500, need), (3000, need), (5000, max(10, need - 2)))
    if lid >= 49:
        batches = batches + ((8000, max(8, need - 4)), (12000, max(6, need - 6)))
    return batches


def write_stages(stages):
    OUT.write_text(json.dumps(stages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=41, help="first stage id (default 41)")
    ap.add_argument("--end", type=int, default=50, help="last stage id (default 50)")
    args = ap.parse_args()

    used_layouts = set()
    used_solutions = set()
    stages = []
    if args.start > 41 and OUT.exists():
        for lv in json.loads(OUT.read_text(encoding="utf-8")):
            if lv["id"] < args.start:
                stages.append(lv)
                used_layouts.add(layout_fingerprint(lv))
                sol = find_solution_moves(lv, max_moves=120)
                if sol:
                    used_solutions.add(sol)

    for lid in range(args.start, args.end + 1):
        print(f"Searching stage {lid}...", flush=True)
        lv, sol = None, None
        need = TARGET_OPTIMAL.get(lid, 12)
        for batch, min_opt in search_batches(lid, need):
            lv, sol = search_one(lid, used_layouts, used_solutions, batch, min_opt)
            if lv:
                if min_opt < need:
                    print(f"  (relaxed par>={min_opt})", flush=True)
                break
        if not lv:
            print(f"FAILED id={lid}", flush=True)
            if stages:
                write_stages(stages)
                print(f"Wrote partial {len(stages)} stages to {OUT}", flush=True)
            raise SystemExit(1)
        used_layouts.add(layout_fingerprint(lv))
        if sol:
            used_solutions.add(sol)
        stages.append(lv)
        _, m = solve_level(lv, max_moves=120, allow_button=True)
        col = len(lv.get("coloredH", []) or []) + len(lv.get("coloredV", []) or [])
        print(f"  OK id={lid} {lv['name']} optimal={m} colored={col} btn=1", flush=True)
        write_stages(stages)

    print(f"Wrote {OUT} ({len(stages)} stages)", flush=True)


if __name__ == "__main__":
    main()
