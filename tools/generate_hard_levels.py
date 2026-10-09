#!/usr/bin/env python3
"""
스테이지 생성 v5 — 30판
- 난이도 = BFS 최소 기울임 수
- 격자: 2→3×3(2~6)→4×4(7~19)→5×5(20~24)→6×6(25~30)
- 레이아웃·해답 경로 중복 금지
"""
import json
import random
from itertools import combinations
from pathlib import Path

from validate_levels import (
    find_solution_moves,
    layout_fingerprint,
    solve_level,
)

LEVEL_COUNT = 30

NAMES = {
    1: "튜토리얼",
    2: "첫 장애물",
    3: "우회 입문",
    4: "지그재그",
    5: "코너 샷",
    6: "3×3 숙련",
    7: "4×4 데뷔",
    8: "대각 우회",
    9: "긴 순환",
    10: "십자로",
    11: "양끝 트랩",
    12: "S 라인",
    13: "빽빽한 길",
    14: "4×4 숙련",
    15: "장거리",
    16: "이중 우회",
    17: "미로 입구",
    18: "최종 4×4",
    19: "악마의 코스",
    20: "5×5 데뷔",
    21: "대각 끝",
    22: "롱 코너",
    23: "중앙 돌파",
    24: "5×5 숙련",
    25: "6×6 데뷔",
    26: "와이드 보드",
    27: "역대각",
    28: "섬 우회",
    29: "최종 6×6",
    30: "그랜드 마스터",
}

BALL_HOLE = {
    1: ((0, 0), (1, 1)),
    2: ((0, 0), (2, 2)),
    3: ((2, 0), (0, 2)),
    4: ((0, 0), (0, 2)),
    5: ((0, 0), (2, 0)),
    6: ((2, 2), (0, 0)),
    7: ((0, 3), (3, 3)),
    8: ((3, 0), (0, 0)),
    9: ((0, 0), (3, 3)),
    10: ((0, 3), (3, 0)),
    11: ((3, 0), (0, 3)),
    12: ((0, 0), (3, 0)),
    13: ((3, 3), (0, 0)),
    14: ((2, 2), (0, 0)),
    15: ((0, 1), (3, 2)),
    16: ((3, 3), (1, 1)),
    17: ((1, 0), (3, 3)),
    18: ((0, 2), (2, 0)),
    19: ((3, 1), (0, 2)),
    20: ((0, 0), (0, 4)),
    21: ((4, 4), (0, 0)),
    22: ((0, 4), (4, 0)),
    23: ((2, 0), (2, 4)),
    24: ((4, 0), (0, 4)),
    25: ((0, 0), (5, 5)),
    26: ((5, 0), (0, 5)),
    27: ((0, 5), (5, 0)),
    28: ((2, 0), (4, 5)),
    29: ((5, 2), (0, 3)),
    30: ((3, 3), (5, 5)),
}

TARGET_MOVES = {
    1: 2,
    2: 3,
    3: 4,
    4: 4,
    5: 4,
    6: 4,
    7: 5,
    8: 5,
    9: 6,
    10: 6,
    11: 6,
    12: 7,
    13: 7,
    14: 7,
    15: 7,
    16: 8,
    17: 8,
    18: 8,
    19: 8,
    20: 9,
    21: 9,
    22: 9,
    23: 10,
    24: 10,
    25: 10,
    26: 10,
    27: 10,
    28: 11,
    29: 11,
    30: 12,
}

MAX_MOVES_CAP = {2: 2, 3: 5, 4: 8, 5: 11, 6: 13}

PILLAR_COUNT_HINT = {
    1: 0,
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 3,
    7: 3,
    8: 4,
    9: 4,
    10: 5,
    11: 4,
    12: 3,
    13: 4,
    14: 3,
    15: 4,
    16: 3,
    17: 4,
    18: 3,
    19: 5,
    20: 5,
    21: 5,
    22: 6,
    23: 5,
    24: 6,
    25: 6,
    26: 5,
    27: 6,
    28: 6,
    29: 7,
    30: 7,
}


def grid_size(level_id: int) -> int:
    if level_id <= 1:
        return 2
    if level_id <= 6:
        return 3
    if level_id <= 19:
        return 4
    if level_id <= 24:
        return 5
    return 6


def level_dict(level_id, size, pillars, ball, hole):
    return {
        "id": level_id,
        "name": NAMES[level_id],
        "size": size,
        "pillars": [{"row": r, "col": c} for r, c in pillars],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }


def is_unique(lv, used_layouts, used_solutions):
    layout = layout_fingerprint(lv)
    if layout in used_layouts:
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


def score_candidate(moves: int, target: int, pillar_count: int, hint: int) -> float:
    if moves < target:
        return moves - target * 100
    pillar_bonus = -abs(pillar_count - hint) * 2
    return moves * 1000 + pillar_bonus


def try_accept(lv, target, used_layouts, used_solutions):
    if not is_unique(lv, used_layouts, used_solutions):
        return None, -1, float("-inf")
    ok, m = solve_level(lv)
    if not ok:
        return None, -1, float("-inf")
    hint = PILLAR_COUNT_HINT.get(lv["id"], 3)
    sc = score_candidate(m, target, len(lv["pillars"]), hint)
    return lv, m, sc


def search_random(level_id, size, ball, hole, target, used_layouts, used_solutions, iterations):
    cells = [
        (r, c)
        for r in range(size)
        for c in range(size)
        if (r, c) != ball and (r, c) != hole
    ]
    hint = PILLAR_COUNT_HINT[level_id]
    lo = max(0, hint - 1)
    hi = min(len(cells), hint + 3)

    best = None
    best_score = float("-inf")
    best_m = -1

    rng = random.Random(1000 + level_id * 7919)
    for _ in range(iterations):
        n = rng.randint(lo, hi) if hi > lo else lo
        pillars = rng.sample(cells, n) if n else []
        lv = level_dict(level_id, size, pillars, ball, hole)
        cand, m, sc = try_accept(lv, target, used_layouts, used_solutions)
        if cand is None:
            continue
        if sc > best_score:
            best, best_score, best_m = cand, sc, m
        if m >= target:
            break

    return best, best_m


def search_exhaustive(level_id, size, ball, hole, target, used_layouts, used_solutions, max_pillars=7):
    cells = [
        (r, c)
        for r in range(size)
        for c in range(size)
        if (r, c) != ball and (r, c) != hole
    ]
    hint = PILLAR_COUNT_HINT[level_id]

    best = None
    best_score = float("-inf")
    best_m = -1

    for n in range(max(0, hint - 1), min(max_pillars, len(cells)) + 1):
        for pillars in combinations(cells, n):
            lv = level_dict(level_id, size, list(pillars), ball, hole)
            cand, m, sc = try_accept(lv, target, used_layouts, used_solutions)
            if cand is None:
                continue
            if sc > best_score:
                best, best_score, best_m = cand, sc, m

    return best, best_m


def iteration_budget(level_id: int, size: int) -> int:
    if size <= 3:
        return 0
    if size == 4:
        iters = 100000
    elif size == 5:
        iters = 180000
    else:
        iters = 280000
    if level_id >= 16:
        iters += 50000
    if level_id >= 25:
        iters += 80000
    return iters


def make_level(level_id: int, used_layouts, used_solutions):
    size = grid_size(level_id)
    target = min(TARGET_MOVES[level_id], MAX_MOVES_CAP[size])
    ball, hole = BALL_HOLE[level_id]

    if level_id == 1:
        lv = level_dict(1, 2, [], ball, hole)
        register(lv, used_layouts, used_solutions)
        return lv

    if level_id == 2:
        lv = level_dict(2, 3, [(1, 1)], ball, hole)
        if is_unique(lv, used_layouts, used_solutions):
            register(lv, used_layouts, used_solutions)
            return lv

    iters = iteration_budget(level_id, size)

    if size <= 3:
        best, best_m = search_exhaustive(
            level_id, size, ball, hole, target, used_layouts, used_solutions
        )
    else:
        best, best_m = search_random(
            level_id, size, ball, hole, target, used_layouts, used_solutions, iters
        )

    if best is None:
        relaxed = max(2, target - 1)
        if size <= 3:
            best, best_m = search_exhaustive(
                level_id, size, ball, hole, relaxed, used_layouts, used_solutions
            )
        else:
            best, best_m = search_random(
                level_id, size, ball, hole, relaxed, used_layouts, used_solutions, iters
            )

    if best is None:
        raise RuntimeError(f"Failed unique level {level_id}")

    register(best, used_layouts, used_solutions)
    return best


def main():
    used_layouts = set()
    used_solutions = set()
    levels = [make_level(i, used_layouts, used_solutions) for i in range(1, LEVEL_COUNT + 1)]

    data = {"version": 5, "levelCount": LEVEL_COUNT, "levels": levels}
    root = Path(__file__).resolve().parents[1]
    for path in [
        root / "shared/levels.json",
        root / "unity/InTheHole/Assets/Resources/Levels/levels.json",
    ]:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path}")

    print(f"\nReport ({LEVEL_COUNT} stages, unique layout + solution):")
    print("  id  grid  pillars  optimal  tgt  name")
    prev = 0
    for lv in levels:
        _, m = solve_level(lv)
        t = TARGET_MOVES[lv["id"]]
        band = ""
        if lv["size"] != prev:
            band = f"  [{lv['size']}x{lv['size']}]"
            prev = lv["size"]
        print(
            f"  {lv['id']:2}  {lv['size']}x{lv['size']}   {len(lv['pillars']):2}      "
            f"{m:2}    {t:2}   {lv['name']}{band}"
        )

    print(f"\nUnique layouts: {len(used_layouts)} / {LEVEL_COUNT}")
    print(f"Unique solutions: {len(used_solutions)} / {LEVEL_COUNT}")


if __name__ == "__main__":
    main()
