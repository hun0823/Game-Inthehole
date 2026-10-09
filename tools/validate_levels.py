#!/usr/bin/env python3
"""Validate shared/levels.json — edge walls, BFS par, glass and gates.

Walls are edges between cells (hWalls / vWalls), not blocked cells.
Rules live in js/game.js; tools/tilt_solver.py mirrors them.
"""

import json
import sys
from pathlib import Path

from tilt_solver import COLOR_IDS, color_id, play, solve

ROOT = Path(__file__).resolve().parents[1]


def build_walls(*_args, **_kwargs):
    raise RuntimeError("pillar build_walls was removed; walls are hWalls/vWalls edges")


def edge_pairs(items):
    return [(e["row"], e["col"]) for e in items or []]


def solve_level(level, max_moves=80, allow_button=True):
    mask = None if allow_button else 0
    moves = solve(level, max_moves=max_moves, allow_mask=mask)
    if moves is None:
        return False, -1
    return True, len(moves)


def find_solution_moves(level, max_moves=80, allow_button=True):
    mask = None if allow_button else 0
    return solve(level, max_moves=max_moves, allow_mask=mask)


def button_required(level, max_moves=80):
    if not level.get("buttons"):
        return True
    ok_with, _ = solve_level(level, max_moves=max_moves, allow_button=True)
    ok_without, _ = solve_level(level, max_moves=max_moves, allow_button=False)
    return ok_with and not ok_without


def layout_fingerprint(level):
    h = tuple(sorted(edge_pairs(level.get("hWalls"))))
    v = tuple(sorted(edge_pairs(level.get("vWalls"))))
    glass_h = tuple(sorted(edge_pairs(level.get("glassH"))))
    glass_v = tuple(sorted(edge_pairs(level.get("glassV"))))
    col_h = tuple(sorted((e["row"], e["col"], e.get("color", "red")) for e in level.get("coloredH") or []))
    col_v = tuple(sorted((e["row"], e["col"], e.get("color", "red")) for e in level.get("coloredV") or []))
    btns = tuple(sorted((b["row"], b["col"], b.get("color", "red")) for b in level.get("buttons") or []))
    ball = (level["ball"]["row"], level["ball"]["col"])
    hole = (level["hole"]["row"], level["hole"]["col"])
    return (level["size"], ball, hole, h, v, glass_h, glass_v, col_h, col_v, btns)


def _in_range(n, kind, r, c):
    if kind == "h":
        return 0 <= r < n - 1 and 0 <= c < n
    return 0 <= r < n and 0 <= c < n - 1


def _sealed_cells(n, h_set, v_set):
    bad = []
    for r in range(n):
        for c in range(n):
            up = r == 0 or (r - 1, c) in h_set
            down = r == n - 1 or (r, c) in h_set
            left = c == 0 or (r, c - 1) in v_set
            right = c == n - 1 or (r, c) in v_set
            if up and down and left and right:
                bad.append((r, c))
    return bad


def mechanics_label(level):
    glass = len(level.get("glassH") or []) + len(level.get("glassV") or [])
    colors = []
    for e in (level.get("coloredH") or []) + (level.get("coloredV") or []):
        name = e.get("color", "red")
        if name not in colors:
            colors.append(name)
    if glass and colors:
        return f"glass×{glass}, {('+'.join(colors))} gate"
    if glass:
        return f"glass×{glass}"
    if colors:
        return "+".join(colors) + " gate"
    return "walls"


def validate(data):
    errors = []
    rows = []
    if "pillars" in json.dumps(data):
        errors.append("pillar field still present")
    levels = data.get("levels") or []
    if len(levels) != 50:
        errors.append(f"expected 50 levels, got {len(levels)}")
    seen = set()
    prev_par = 0
    for i, lv in enumerate(levels, start=1):
        if lv.get("id") != i:
            errors.append(f"id sequence broken at {lv.get('id')}")
        if "pillars" in lv:
            errors.append(f"id {i} still has pillars")
        n = lv["size"]
        h_set = set(edge_pairs(lv.get("hWalls")))
        v_set = set(edge_pairs(lv.get("vWalls")))
        for r, c in h_set:
            if not _in_range(n, "h", r, c):
                errors.append(f"id {i} hWall out of range {(r, c)}")
        for r, c in v_set:
            if not _in_range(n, "v", r, c):
                errors.append(f"id {i} vWall out of range {(r, c)}")
        occupied = {("h", r, c) for r, c in h_set} | {("v", r, c) for r, c in v_set}
        for kind, key in (("h", "glassH"), ("v", "glassV"), ("h", "coloredH"), ("v", "coloredV")):
            for e in lv.get(key) or []:
                rc = (e["row"], e["col"])
                if not _in_range(n, kind, *rc):
                    errors.append(f"id {i} {key} out of range {rc}")
                edge = (kind, rc[0], rc[1])
                if edge in occupied:
                    errors.append(f"id {i} overlapping edge {edge}")
                occupied.add(edge)
        sealed = _sealed_cells(n, h_set, v_set)
        if sealed:
            errors.append(f"id {i} sealed floor cells {sealed[:4]}")
        ball = (lv["ball"]["row"], lv["ball"]["col"])
        hole = (lv["hole"]["row"], lv["hole"]["col"])
        if ball == hole:
            errors.append(f"id {i} ball is on the hole")
        fp = layout_fingerprint(lv)
        if fp in seen:
            errors.append(f"id {i} duplicates an earlier layout")
        seen.add(fp)
        moves = solve(lv, max_moves=40)
        if not moves:
            errors.append(f"id {i} unsolvable")
            par = -1
        else:
            par = len(moves)
            won, broken = play(lv, moves)
            if not won:
                errors.append(f"id {i} recorded solution does not reach the hole")
            if par != lv.get("par"):
                errors.append(f"id {i} par {lv.get('par')} != BFS {par}")
            if i <= 30 and (lv.get("glassH") or lv.get("glassV") or lv.get("buttons")):
                errors.append(f"id {i} should be walls only")
            if 31 <= i <= 40:
                glass_n = len(lv.get("glassH") or []) + len(lv.get("glassV") or [])
                if glass_n < 1 or lv.get("buttons"):
                    errors.append(f"id {i} expected glass and no buttons")
                if broken < 1:
                    errors.append(f"id {i} optimal path never breaks glass")
                bare = dict(lv)
                bare["glassH"] = []
                bare["glassV"] = []
                bare_moves = solve(bare, max_moves=40)
                if bare_moves is None or len(bare_moves) >= par:
                    errors.append(f"id {i} glass does not add tilts")
            if 41 <= i <= 50:
                if not lv.get("buttons") or lv.get("glassH") or lv.get("glassV"):
                    errors.append(f"id {i} expected colored gates and no glass")
                if not button_required(lv, max_moves=40):
                    errors.append(f"id {i} solvable without its button")
                full = (1 << len(COLOR_IDS)) - 1
                bits = {1 << color_id(b.get("color")) for b in lv["buttons"]}
                for bit in bits:
                    if solve(lv, max_moves=40, allow_mask=full ^ bit) is not None:
                        errors.append(f"id {i} color bit {bit} is not required")
            if i > 1 and par < 3:
                errors.append(f"id {i} trivial par {par}")
            if prev_par and par + 2 < prev_par:
                errors.append(f"id {i} par {par} drops more than 1 from {prev_par}")
            prev_par = par
        rows.append((i, n, lv.get("par"), mechanics_label(lv)))
    return errors, rows


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "shared/levels.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    errors, rows = validate(data)
    print("| Stage | Size | Par | Mechanics |")
    print("|------:|:----:|----:|:----------|")
    for sid, n, par, mech in rows:
        print(f"| {sid} | {n}×{n} | {par} | {mech} |")
    if errors:
        print(f"\n{len(errors)} error(s):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    print(f"\nOK — {len(rows)} stages solvable, par matches BFS")


if __name__ == "__main__":
    main()
