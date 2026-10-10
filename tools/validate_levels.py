#!/usr/bin/env python3
"""Validate shared/levels.json — edge walls, BFS par, glass and gates.

Walls are edges between cells (hWalls / vWalls), not blocked cells.
Rules live in js/game.js; tools/tilt_solver.py mirrors them.
"""

import json
import sys
from pathlib import Path

from necessity import CHECKS, Gallery, budget_dead_ends
from tilt_solver import COLOR_IDS, DIRS, color_id, play, prepare, solve, tilt

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
    sand = tuple(sorted(edge_pairs(level.get("sand"))))
    ice = tuple(sorted(edge_pairs(level.get("ice"))))
    smog = tuple(sorted(edge_pairs(level.get("smog"))))
    coins = tuple(sorted(edge_pairs(level.get("coins"))))
    collapse = tuple(sorted(edge_pairs(level.get("collapse"))))
    one = tuple(sorted((e["axis"], e["row"], e["col"], e["dir"]) for e in level.get("oneWay") or []))
    ports = tuple(sorted(
        (pair["a"]["row"], pair["a"]["col"], pair["b"]["row"], pair["b"]["col"])
        for pair in level.get("teleports") or []
    ))
    shifts = tuple(sorted(
        (
            s["home"]["axis"], s["home"]["row"], s["home"]["col"],
            s["alt"]["axis"], s["alt"]["row"], s["alt"]["col"],
        )
        for s in level.get("shifters") or []
    ))
    return (level["size"], ball, hole, h, v, glass_h, glass_v, col_h, col_v, btns, sand, ice, smog, coins, collapse, one, ports, shifts)


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
    parts = []
    glass = len(level.get("glassH") or []) + len(level.get("glassV") or [])
    if glass:
        parts.append(f"glass×{glass}")
    colors = []
    for e in (level.get("coloredH") or []) + (level.get("coloredV") or []):
        name = e.get("color", "red")
        if name not in colors:
            colors.append(name)
    if colors:
        parts.append("+".join(colors) + " gate")
    if level.get("sand"):
        parts.append("sand")
    if level.get("ice"):
        parts.append("ice")
    if level.get("oneWay"):
        parts.append("one-way")
    if level.get("teleports"):
        parts.append("teleport")
    if level.get("smog"):
        parts.append("smog")
    if level.get("coins"):
        parts.append("coins")
    if level.get("collapse"):
        parts.append("collapse")
    if level.get("jelly"):
        parts.append("jelly")
    if level.get("magma"):
        parts.append("magma")
    if level.get("shifters"):
        parts.append("moving wall")
    if level.get("planet"):
        parts.append(level["planet"])
    return ", ".join(parts) if parts else "walls"


def mechanic_names(level):
    names = []
    if level.get("sand"):
        names.append("sand")
    if level.get("ice"):
        names.append("ice")
    if level.get("oneWay"):
        names.append("oneway")
    if level.get("teleports"):
        names.append("teleport")
    if (level.get("glassH") or level.get("glassV")):
        names.append("glass")
    if level.get("buttons"):
        names.append("gates")
    if level.get("smog"):
        names.append("smog")
    if level.get("coins"):
        names.append("coins")
    if level.get("collapse"):
        names.append("collapse")
    if level.get("jelly"):
        names.append("jelly")
    if level.get("magma"):
        names.append("magma")
    if level.get("shifters"):
        names.append("movers")
    return names


def _band(i):
    bands = (
        (1, 16, set()),
        (17, 21, {"sand"}),
        (22, 26, {"ice"}),
        (27, 31, {"oneway"}),
        (32, 36, {"teleport"}),
        (37, 42, {"glass"}),
        (43, 48, {"gates"}),
        (49, 53, {"smog"}),
        (54, 58, {"coins"}),
        (59, 64, {"collapse"}),
        (65, 70, {"movers"}),
    )
    for start, end, names in bands:
        if start <= i <= end:
            return names
    return None


def _replay(level, moves):
    board = prepare(level)
    r, c = board["ball"]
    gstate = act = collapse = phase = 0
    allow = (1 << len(COLOR_IDS)) - 1
    paths = []
    for action in moves:
        if action == "press":
            continue
        dir_i = next(i for i, (name, _dr, _dc) in enumerate(DIRS) if name == action)
        r, c, gstate, act, _moved, _won, collapse, phase, path = tilt(
            board, r, c, dir_i, gstate, act, allow, collapse, phase
        )
        paths.append(path)
    return paths


def _shorter_without(level, key, par):
    bare = dict(level)
    bare[key] = []
    moves = solve(bare, max_moves=par)
    return moves is not None and len(moves) < par


def _coins_on_par(level, moves):
    flat = {cell for path in _replay(level, moves) for cell in path}
    coins = [(c["row"], c["col"]) for c in level.get("coins") or []]
    if len(coins) < 1:
        return False
    bare = dict(level)
    bare["coins"] = []
    same = solve(bare, max_moves=len(moves))
    return same is not None and len(same) == len(moves) and all(cell in flat for cell in coins)


def _jumps(level, moves):
    for path in _replay(level, moves):
        for a, b in zip(path, path[1:]):
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) > 1:
                return True
    return False


def _collapse_once(level, moves):
    cells = [(c["row"], c["col"]) for c in level.get("collapse") or []]
    if not cells:
        return False
    flat = [cell for path in _replay(level, moves) for cell in path]
    return all(flat.count(cell) == 1 for cell in cells)


def _shifter_matters(level, moves):
    bare = dict(level)
    bare["shifters"] = []
    other = solve(bare, max_moves=len(moves) + 6)
    return other is None or tuple(other) != tuple(moves)


def validate(data):
    errors = []
    rows = []
    if "pillars" in json.dumps(data):
        errors.append("pillar field still present")
    levels = data.get("levels") or []
    planets = (
        "wood", "desert", "ice", "ocean", "crystal", "toy",
        "mushroom", "candy", "lava", "jungle", "alien", "machine",
    )
    # Wood 3→7, desert 4→7, every later planet 5→7. Never above 7.
    size_curve = {
        "wood": [3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7],
        "desert": [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7],
    }
    late_sizes = [5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7]
    planet_pars = {name: [] for name in planets}
    planet_deads = {name: [] for name in planets}
    if len(levels) != 144:
        errors.append(f"expected 144 levels, got {len(levels)}")
    seen = set()
    gallery = Gallery()
    prev_par = {}
    prev_dead = {}
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
        dup = gallery.reject_reason(lv)
        if dup:
            errors.append(f"id {i} {dup}")
        else:
            gallery.add(lv)
        for e in lv.get("oneWay") or []:
            edge = (e["axis"], e["row"], e["col"])
            if not _in_range(n, e["axis"], e["row"], e["col"]):
                errors.append(f"id {i} one-way out of range {edge}")
            elif edge in occupied:
                errors.append(f"id {i} one-way overlaps {edge}")
        for shifter in lv.get("shifters") or []:
            for spot in (shifter["home"], shifter["alt"]):
                edge = (spot["axis"], spot["row"], spot["col"])
                if not _in_range(n, spot["axis"], spot["row"], spot["col"]):
                    errors.append(f"id {i} shifter out of range {edge}")
                elif edge in occupied:
                    errors.append(f"id {i} shifter overlaps {edge}")
        moves = solve(lv, max_moves=60)
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
            if n < 3:
                errors.append(f"id {i} board is smaller than 3×3")
            if par < 2:
                errors.append(f"id {i} trivial par {par}")
            if lv.get("coins"):
                errors.append(f"id {i} still uses coins")
            names = set(mechanic_names(lv))
            planet_i = (i - 1) // 12
            stage_i = (i - 1) % 12
            dead = budget_dead_ends(lv, moves)["deadEnds"]
            if planet_i < len(planets):
                planet = planets[planet_i]
                expect_n = size_curve.get(planet, late_sizes)[stage_i]
                if lv.get("planet") != planet:
                    errors.append(f"id {i} planet {lv.get('planet')} expected {planet}")
                if n != expect_n:
                    errors.append(f"id {i} size {n} expected {expect_n}")
                if planet == "wood" and names:
                    errors.append(f"id {i} wood stage should be walls only")
                if planet == "desert" and names != {"sand"}:
                    errors.append(f"id {i} desert stage should be sand only")
                if planet == "ice" and names != {"ice"}:
                    errors.append(f"id {i} ice stage should be ice only")
                if planet == "ocean" and stage_i < 2 and names != {"teleport"}:
                    errors.append(f"id {i} ocean opener should be a whirlpool only")
                if planet == "ocean" and 2 <= stage_i < 8 and names != {"oneway"}:
                    errors.append(f"id {i} ocean currents should be one-way only")
                if planet == "ocean" and stage_i >= 8 and names != {"teleport", "oneway"}:
                    errors.append(f"id {i} ocean finale should mix whirlpool and current")
                if planet == "crystal" and "glass" not in names:
                    errors.append(f"id {i} crystal stage has no glass")
                if planet == "toy" and "gates" not in names:
                    errors.append(f"id {i} toy stage has no gates")
                if planet == "mushroom" and "smog" not in names:
                    errors.append(f"id {i} mushroom stage has no smog")
                if planet == "candy" and "jelly" not in names:
                    errors.append(f"id {i} candy stage has no jelly")
                if planet == "lava" and "magma" not in names:
                    errors.append(f"id {i} lava stage has no magma")
                if planet == "lava" and stage_i >= 8 and "collapse" not in names:
                    errors.append(f"id {i} late lava stage has no collapsing floor")
                if planet == "jungle" and "movers" not in names:
                    errors.append(f"id {i} jungle stage has no moving walls")
                if planet == "alien" and len(names) != 2:
                    errors.append(f"id {i} alien mix needs exactly two mechanics")
                if planet == "machine" and len(names) < 3:
                    errors.append(f"id {i} machine mix needs three mechanics")
                if stage_i and par < prev_par.get(planet, 0):
                    errors.append(f"id {i} par {par} drops from {prev_par.get(planet)}")
                prev_par[planet] = par
                prev_dead[planet] = dead
                planet_pars[planet].append(par)
                planet_deads[planet].append(dead)
            for name in names:
                if not CHECKS[name](lv, moves):
                    errors.append(f"id {i} {name} is decorative")
        rows.append((i, n, lv.get("par"), mechanics_label(lv)))
    prev_open = 0
    prev_avg = 0.0
    for planet in planets:
        pars = planet_pars[planet]
        deads = planet_deads[planet]
        if len(pars) != 12:
            continue
        if pars[-1] <= pars[0]:
            errors.append(f"{planet} par does not rise ({pars[0]} → {pars[-1]})")
        if deads[-1] <= deads[0] or sum(deads[6:]) <= sum(deads[:6]):
            errors.append(
                f"{planet} dead ends do not rise ({deads[0]} → {deads[-1]}, "
                f"halves {sum(deads[:6])} / {sum(deads[6:])})"
            )
        avg = sum(pars) / len(pars)
        if pars[0] <= prev_open:
            errors.append(f"{planet} stage 1 par {pars[0]} is not above {prev_open}")
        if avg <= prev_avg:
            errors.append(f"{planet} average par {avg:.2f} is not above {prev_avg:.2f}")
        prev_open = pars[0]
        prev_avg = avg
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
