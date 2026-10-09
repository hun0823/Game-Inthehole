#!/usr/bin/env python3
"""Author 50 edge-wall stages into shared/levels.json.

Every cell is floor. Walls, glass, and colored gates occupy edges between
adjacent cells. par is the BFS tilt count from tools/tilt_solver.py (js/game.js).
"""

import json
import random
import sys
import time
from pathlib import Path

from tilt_solver import edges_crossed, play, solve

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "shared/levels.json"

# id, size, par, kind, glass_n, colors
# kind: wall | glass | mixed
# Boards start at 3×3. Pars sit above the previous curve.
# 41–50 are mixed: glass panes and colored gates on the same board.
SPEC = [
    (1, 3, 4, "wall", 0, []),
    (2, 3, 4, "wall", 0, []),
    (3, 3, 5, "wall", 0, []),
    (4, 3, 5, "wall", 0, []),
    (5, 3, 6, "wall", 0, []),
    (6, 3, 6, "wall", 0, []),
    (7, 4, 7, "wall", 0, []),
    (8, 4, 7, "wall", 0, []),
    (9, 4, 8, "wall", 0, []),
    (10, 4, 8, "wall", 0, []),
    (11, 4, 8, "wall", 0, []),
    (12, 4, 9, "wall", 0, []),
    (13, 4, 9, "wall", 0, []),
    (14, 4, 9, "wall", 0, []),
    (15, 4, 10, "wall", 0, []),
    (16, 4, 10, "wall", 0, []),
    (17, 4, 10, "wall", 0, []),
    (18, 4, 11, "wall", 0, []),
    (19, 5, 11, "wall", 0, []),
    (20, 5, 11, "wall", 0, []),
    (21, 5, 12, "wall", 0, []),
    (22, 5, 12, "wall", 0, []),
    (23, 5, 13, "wall", 0, []),
    (24, 5, 13, "wall", 0, []),
    (25, 6, 13, "wall", 0, []),
    (26, 6, 14, "wall", 0, []),
    (27, 6, 14, "wall", 0, []),
    (28, 6, 15, "wall", 0, []),
    (29, 6, 15, "wall", 0, []),
    (30, 6, 16, "wall", 0, []),
    (31, 6, 15, "glass", 1, []),
    (32, 6, 15, "glass", 1, []),
    (33, 6, 16, "glass", 2, []),
    (34, 6, 16, "glass", 2, []),
    (35, 6, 17, "glass", 2, []),
    (36, 6, 17, "glass", 3, []),
    (37, 7, 17, "glass", 2, []),
    (38, 7, 18, "glass", 2, []),
    (39, 7, 18, "glass", 3, []),
    (40, 7, 19, "glass", 3, []),
    (41, 6, 18, "mixed", 1, ["red"]),
    (42, 6, 19, "mixed", 1, ["red"]),
    (43, 6, 19, "mixed", 2, ["red"]),
    (44, 6, 20, "mixed", 2, ["red"]),
    (45, 7, 19, "mixed", 1, ["red"]),
    (46, 7, 20, "mixed", 2, ["red"]),
    (47, 7, 20, "mixed", 2, ["red"]),
    (48, 7, 20, "mixed", 1, ["red", "blue"]),
    (49, 7, 21, "mixed", 1, ["red", "blue"]),
    (50, 7, 21, "mixed", 2, ["red", "blue"]),
]

NAMES = {
    1: "Corner", 2: "Side step", 3: "Switchback", 4: "Three turns", 5: "Pocket",
    6: "Zigzag", 7: "Elbow", 8: "Long slide", 9: "Wider board", 10: "Double bend",
    11: "Detour", 12: "S curve", 13: "Loop", 14: "Far hole", 15: "Tight lane",
    16: "Two elbows", 17: "Maze", 18: "Last lane", 19: "Five debut", 20: "Cross",
    21: "Long way", 22: "Center", 23: "Five clear", 24: "Deep five", 25: "Six debut",
    26: "Wide detour", 27: "Islands", 28: "Far corner", 29: "Six maze", 30: "Wall master",
    31: "First glass", 32: "Crack it", 33: "Two panes", 34: "Glass bend", 35: "Brittle lane",
    36: "Glass six", 37: "Seven glass", 38: "Thin pane", 39: "Three cracks", 40: "Glass master",
    41: "Glass gate", 42: "Crack and press", 43: "Red and glass", 44: "Two panes shut",
    45: "Locked glass", 46: "Seven mix", 47: "Shatter switch", 48: "Two colors",
    49: "Blue after red", 50: "Gate master",
}

MIN_EDGES = {3: 2, 4: 4, 5: 5, 6: 6, 7: 7}
MAX_EDGES = {3: 8, 4: 16, 5: 22, 6: 28, 7: 34}


def edge_objs(pairs):
    return [{"row": r, "col": c} for r, c in sorted(pairs)]


def make_level(sid, n, name, par, ball, hole, H, V, glass=(), colored=(), buttons=()):
    lv = {
        "id": sid,
        "name": name,
        "size": n,
        "hWalls": edge_objs(H),
        "vWalls": edge_objs(V),
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
        "par": par,
    }
    gh = [{"row": r, "col": c} for axis, r, c in glass if axis == "h"]
    gv = [{"row": r, "col": c} for axis, r, c in glass if axis == "v"]
    ch = [{"row": r, "col": c, "color": col} for axis, r, c, col in colored if axis == "h"]
    cv = [{"row": r, "col": c, "color": col} for axis, r, c, col in colored if axis == "v"]
    if gh:
        lv["glassH"] = gh
    if gv:
        lv["glassV"] = gv
    if ch:
        lv["coloredH"] = ch
    if cv:
        lv["coloredV"] = cv
    if buttons:
        lv["buttons"] = [{"row": r, "col": c, "color": col} for r, c, col in buttons]
    return lv


def seals(n, H, V, edge):
    axis, r, c = edge
    H2, V2 = set(H), set(V)
    if axis == "h":
        H2.add((r, c))
        cells = [(r, c), (r + 1, c)]
    else:
        V2.add((r, c))
        cells = [(r, c), (r, c + 1)]
    for rr, cc in cells:
        up = rr == 0 or (rr - 1, cc) in H2
        down = rr == n - 1 or (rr, cc) in H2
        left = cc == 0 or (rr, cc - 1) in V2
        right = cc == n - 1 or (rr, cc) in V2
        if up and down and left and right:
            return True
    return False


def vertices(edge):
    axis, r, c = edge
    if axis == "h":
        return ((r + 1, c), (r + 1, c + 1))
    return ((r, c + 1), (r + 1, c + 1))


def turn_count(H, V):
    axes = {}
    for r, c in H:
        for v in vertices(("h", r, c)):
            axes.setdefault(v, set()).add("h")
    for r, c in V:
        for v in vertices(("v", r, c)):
            axes.setdefault(v, set()).add("v")
    return sum(1 for s in axes.values() if "h" in s and "v" in s)


def shape_ok(n, H, V, target, strict):
    count = len(H) + len(V)
    if count < MIN_EDGES[n] or count > MAX_EDGES[n]:
        return False
    if n >= 3 and strict and (not H or not V):
        return False
    if n >= 4 and target >= 6 and strict and turn_count(H, V) < 1:
        return False
    return True


def all_open(n, blocked):
    out = []
    for r in range(n - 1):
        for c in range(n):
            if ("h", r, c) not in blocked:
                out.append(("h", r, c))
    for r in range(n):
        for c in range(n - 1):
            if ("v", r, c) not in blocked:
                out.append(("v", r, c))
    return out


def touches(edge, H, V):
    vs = set(vertices(edge))
    for r, c in H:
        if vs.intersection(vertices(("h", r, c))):
            return True
    for r, c in V:
        if vs.intersection(vertices(("v", r, c))):
            return True
    return False


def pack(n, ball, hole, H, V, glass=(), colored=(), buttons=()):
    return make_level(0, n, "", 0, ball, hole, H, V, glass, colored, buttons)


def far_pairs(n, rng):
    cells = [(r, c) for r in range(n) for c in range(n)]
    pairs = []
    need = max(2, n - 1)
    for a in cells:
        for b in cells:
            if a[0] != b[0] and a[1] != b[1] and abs(a[0] - b[0]) + abs(a[1] - b[1]) >= need:
                pairs.append((a, b))
    rng.shuffle(pairs)
    return pairs or [((0, 0), (n - 1, n - 1))]


def seed_motifs(n, rng, H, V, forbid, motifs):
    def add(edge):
        axis, r, c = edge
        if edge in forbid:
            return False
        if axis == "h":
            if (r, c) in H or not (0 <= r < n - 1 and 0 <= c < n):
                return False
        else:
            if (r, c) in V or not (0 <= r < n and 0 <= c < n - 1):
                return False
        if seals(n, H, V, edge):
            return False
        (H if axis == "h" else V).add((r, c))
        return True

    for _ in range(motifs):
        kind = rng.choice(["L", "L", "line", "T"])
        if kind == "line":
            axis = rng.choice(["h", "v"])
            length = rng.randint(2, min(3, n - 1))
            if axis == "h":
                rr = rng.randrange(n - 1)
                cc = rng.randrange(0, n - length + 1)
                for k in range(length):
                    add(("h", rr, cc + k))
            else:
                cc = rng.randrange(n - 1)
                rr = rng.randrange(0, n - length + 1)
                for k in range(length):
                    add(("v", rr + k, cc))
        else:
            r = rng.randrange(n)
            c = rng.randrange(n)
            opts = []
            if r > 0:
                opts.append(("h", r - 1, c))
            if r < n - 1:
                opts.append(("h", r, c))
            if c > 0:
                opts.append(("v", r, c - 1))
            if c < n - 1:
                opts.append(("v", r, c))
            rng.shuffle(opts)
            if kind == "L" and len(opts) >= 2:
                add(opts[0])
                add(opts[1])
            elif kind == "T" and len(opts) >= 3:
                for e in opts[:3]:
                    add(e)


def climb(n, ball, hole, target, rng, H, V, locked, forbid, glass=(), colored=(), buttons=(), strict=True):
    """Add and remove solid edges until BFS par equals target and the shape is interesting."""
    H, V = set(H), set(V)
    locked_h = {(r, c) for axis, r, c in locked if axis == "h"}
    locked_v = {(r, c) for axis, r, c in locked if axis == "v"}

    def level():
        return pack(n, ball, hole, H, V, glass, colored, buttons)

    def removable():
        return [("h", r, c) for r, c in H if (r, c) not in locked_h] + [
            ("v", r, c) for r, c in V if (r, c) not in locked_v
        ]

    def add_edge(edge):
        axis, r, c = edge
        if edge in forbid or seals(n, H, V, edge):
            return False
        bag = H if axis == "h" else V
        if (r, c) in bag:
            return False
        bag.add((r, c))
        return True

    def drop(edge):
        axis, r, c = edge
        (H if axis == "h" else V).discard((r, c))

    for _ in range(70):
        if len(H) + len(V) > MAX_EDGES[n]:
            return None
        moves = solve(level(), max_moves=target)
        if moves is not None and len(moves) == target and shape_ok(n, H, V, target, strict):
            return H, V, moves
        if moves is not None and len(moves) == target:
            blocked = {("h", r, c) for r, c in H} | {("v", r, c) for r, c in V} | set(forbid)
            cands = [e for e in all_open(n, blocked) if touches(e, H, V)]
            rng.shuffle(cands)
            grew = False
            for e in cands[:12]:
                if not add_edge(e):
                    continue
                m2 = solve(level(), max_moves=target)
                if m2 is not None and len(m2) == target:
                    grew = True
                    if shape_ok(n, H, V, target, strict):
                        return H, V, m2
                    break
                drop(e)
            if not grew:
                return None
            continue
        if moves is None or len(moves) > target:
            opts = removable()
            rng.shuffle(opts)
            best = None
            for e in opts[:14]:
                drop(e)
                m2 = solve(level(), max_moves=target)
                add_edge(e)
                if m2 is not None and (best is None or len(m2) < best[0]):
                    best = (len(m2), e, m2)
                    if len(m2) == target:
                        break
            if best is None:
                if not opts:
                    return None
                drop(opts[0])
                continue
            drop(best[1])
            continue
        # Too short: wall an edge the ball currently crosses, preferring ones that grow an L/T.
        crossed = []
        seen = set()
        for e in edges_crossed(level(), moves):
            if e not in seen:
                seen.add(e)
                crossed.append(e)
        rng.shuffle(crossed)
        crossed.sort(key=lambda e: 0 if touches(e, H, V) else 1)
        placed = False
        for e in crossed:
            if not add_edge(e):
                continue
            m2 = solve(level(), max_moves=target)
            if m2 is not None and len(moves) < len(m2) <= target:
                placed = True
                break
            drop(e)
        if not placed:
            return None
    return None


def glass_ok(level, target, glass_n):
    moves = solve(level, max_moves=target)
    if not moves or len(moves) != target:
        return False
    won, broken = play(level, moves)
    if not won or broken < glass_n:
        return False
    bare = dict(level)
    bare["glassH"] = []
    bare["glassV"] = []
    base = solve(bare, max_moves=target)
    return base is not None and len(base) < target


def search_walls(sid, n, target, rng, strict, used):
    motifs = 1 if n <= 3 else 2 if n <= 5 else 3
    attempts = 700 if n <= 4 else 1100 if n <= 5 else 1600
    for _ in range(attempts):
        ball, hole = far_pairs(n, rng)[0]
        H, V = set(), set()
        if rng.random() < 0.85:
            seed_motifs(n, rng, H, V, set(), motifs)
        found = climb(n, ball, hole, target, rng, H, V, set(), set(), strict=strict)
        if not found:
            continue
        H, V, moves = found
        if len(set(m for m in moves if m != "press")) < 2 and n > 2:
            continue
        fp = (n, ball, hole, tuple(sorted(H)), tuple(sorted(V)))
        if fp in used:
            continue
        used.add(fp)
        return make_level(sid, n, NAMES[sid], target, ball, hole, H, V), moves
    return None


def search_glass(sid, n, target, glass_n, rng, strict, used):
    wall_targets = [target - glass_n]
    if target - glass_n - 1 >= 2:
        wall_targets.append(target - glass_n - 1)
    for wall_tgt in wall_targets:
        for _ in range(500 if n <= 6 else 700):
            ball, hole = far_pairs(n, rng)[0]
            H, V = set(), set()
            seed_motifs(n, rng, H, V, set(), 2 if n < 7 else 3)
            found = climb(n, ball, hole, wall_tgt, rng, H, V, set(), set(), strict=strict)
            if not found:
                continue
            H, V, base_moves = found
            crossed = []
            seen = set()
            for e in edges_crossed(pack(n, ball, hole, H, V), base_moves):
                if e not in seen:
                    seen.add(e)
                    crossed.append(e)
            if len(crossed) < glass_n:
                continue
            rng.shuffle(crossed)
            tries = crossed[:18]
            # combinations of glass_n drawn from the path
            from itertools import combinations
            combos = list(combinations(tries, glass_n))
            rng.shuffle(combos)
            for combo in combos[:80]:
                lv = make_level(sid, n, NAMES[sid], target, ball, hole, H, V, glass=combo)
                if not glass_ok(lv, target, glass_n):
                    continue
                if strict and turn_count(H, V) < 1 and n >= 4:
                    continue
                fp = (n, ball, hole, tuple(sorted(H)), tuple(sorted(V)), tuple(sorted(combo)))
                if fp in used:
                    continue
                used.add(fp)
                return lv
    return None


def fence_layout(n, colors, rng):
    """A full cut: a short colored gate segment, the rest of the cut solid."""
    orient = rng.choice(["h", "v"])
    colored = []
    locked = []
    buttons = []
    if len(colors) == 1:
        cuts = [rng.randint(0, n - 2)]
    else:
        c1 = rng.randint(0, n - 3)
        c2 = rng.randint(c1 + 1, n - 2)
        cuts = [c1, c2]
    regions = []
    prev = 0
    for cut in cuts:
        regions.append((prev, cut))
        prev = cut + 1
    regions.append((prev, n - 1))
    for cut, color in zip(cuts, colors):
        length = rng.randint(2, min(3, n))
        start = rng.randint(0, n - length)
        gates = set(range(start, start + length))
        for i in range(n):
            edge = (orient, cut, i) if orient == "h" else (orient, i, cut)
            if i in gates:
                colored.append((*edge, color))
            else:
                locked.append(edge)
    # regions: index 0 ball+first button, middle buttons, last hole
    def cell(lo, hi):
        return rng.randint(lo, hi), rng.randint(0, n - 1)

    if orient == "h":
        ball = cell(*regions[0])
        hole = cell(*regions[-1])
        for (lo, hi), color in zip(regions[:-1], colors):
            spot = cell(lo, hi)
            guard = 0
            while spot == ball and guard < 8:
                spot = cell(lo, hi)
                guard += 1
            buttons.append((spot[0], spot[1], color))
    else:
        ball = (cell(*regions[0])[1], cell(*regions[0])[0])
        # cell() returns (along, across) — rebuild clearly
        def vcell(lo, hi):
            return rng.randint(0, n - 1), rng.randint(lo, hi)

        ball = vcell(*regions[0])
        hole = vcell(*regions[-1])
        for (lo, hi), color in zip(regions[:-1], colors):
            spot = vcell(lo, hi)
            guard = 0
            while spot == ball and guard < 8:
                spot = vcell(lo, hi)
                guard += 1
            buttons.append((spot[0], spot[1], color))
    if ball[0] == hole[0] or ball[1] == hole[1]:
        return None
    return orient, colored, locked, buttons, ball, hole


def gates_required(level, colors):
    from tilt_solver import COLOR_IDS, color_id

    full = (1 << len(COLOR_IDS)) - 1
    if solve(level, max_moves=level["par"], allow_mask=0) is not None:
        return False
    for color in colors:
        bit = 1 << color_id(color)
        if solve(level, max_moves=level["par"], allow_mask=full ^ bit) is not None:
            return False
    return True


def search_gate(sid, n, target, colors, rng, strict, used):
    for _ in range(700 if n <= 6 else 900):
        built = fence_layout(n, colors, rng)
        if not built:
            continue
        _orient, colored, locked, buttons, ball, hole = built
        H = {(r, c) for axis, r, c in locked if axis == "h"}
        V = {(r, c) for axis, r, c in locked if axis == "v"}
        forbid = {(axis, r, c) for axis, r, c, _col in colored}
        seed_motifs(n, rng, H, V, forbid | set(locked), 2)
        found = climb(
            n, ball, hole, target, rng, H, V, locked, forbid,
            colored=colored, buttons=buttons, strict=strict,
        )
        if not found:
            continue
        H, V, _moves = found
        lv = make_level(sid, n, NAMES[sid], target, ball, hole, H, V, colored=colored, buttons=buttons)
        if not gates_required(lv, colors):
            continue
        won, _broken = play(lv, solve(lv, max_moves=target))
        if not won:
            continue
        fp = (
            n, ball, hole, tuple(sorted(H)), tuple(sorted(V)),
            tuple(sorted(forbid)), tuple(sorted(buttons)),
        )
        if fp in used:
            continue
        used.add(fp)
        return lv
    return None


def mixed_ok(level, target, glass_n, colors):
    moves = solve(level, max_moves=target)
    if not moves or len(moves) != target:
        return False
    won, broken = play(level, moves)
    if not won or broken < glass_n:
        return False
    bare = dict(level)
    bare["glassH"] = []
    bare["glassV"] = []
    base = solve(bare, max_moves=target)
    if base is None or len(base) >= target:
        return False
    return gates_required(level, colors)


def search_mixed(sid, n, target, glass_n, colors, rng, strict, used):
    """A colored-gate puzzle whose optimal path also has to break glass."""
    from itertools import combinations

    gate_targets = [target - glass_n]
    if target - glass_n - 1 >= 6:
        gate_targets.append(target - glass_n - 1)
    for gate_tgt in gate_targets:
        tries = 240 if n <= 6 else 320
        for _ in range(tries):
            built = fence_layout(n, colors, rng)
            if not built:
                continue
            _orient, colored, locked, buttons, ball, hole = built
            H = {(r, c) for axis, r, c in locked if axis == "h"}
            V = {(r, c) for axis, r, c in locked if axis == "v"}
            forbid = {(axis, r, c) for axis, r, c, _col in colored}
            seed_motifs(n, rng, H, V, forbid | set(locked), 2)
            found = climb(
                n, ball, hole, gate_tgt, rng, H, V, locked, forbid,
                colored=colored, buttons=buttons, strict=strict,
            )
            if not found:
                continue
            H, V, base_moves = found
            gate_lv = make_level(
                sid, n, NAMES[sid], gate_tgt, ball, hole, H, V,
                colored=colored, buttons=buttons,
            )
            if not gates_required(gate_lv, colors):
                continue
            crossed = []
            seen_e = set()
            for edge in edges_crossed(gate_lv, base_moves):
                if edge and edge not in seen_e and edge not in forbid:
                    seen_e.add(edge)
                    crossed.append(edge)
            if len(crossed) < glass_n:
                continue
            rng.shuffle(crossed)
            combos = list(combinations(crossed[:12], glass_n))
            rng.shuffle(combos)
            for combo in combos[:36]:
                lv = make_level(
                    sid, n, NAMES[sid], target, ball, hole, H, V,
                    glass=combo, colored=colored, buttons=buttons,
                )
                if not mixed_ok(lv, target, glass_n, colors):
                    continue
                fp = (
                    n, ball, hole, tuple(sorted(H)), tuple(sorted(V)),
                    tuple(sorted(combo)), tuple(sorted(forbid)), tuple(sorted(buttons)),
                )
                if fp in used:
                    continue
                used.add(fp)
                return lv
    return None


def build_one(spec, rng, used):
    sid, n, target, kind, glass_n, colors = spec
    if kind == "wall":
        lv = search_walls(sid, n, target, rng, True, used)
        if lv is None:
            lv = search_walls(sid, n, target, rng, False, used)
        return lv[0] if isinstance(lv, tuple) else lv
    if kind == "glass":
        lv = search_glass(sid, n, target, glass_n, rng, True, used)
        if lv is None:
            lv = search_glass(sid, n, target, glass_n, rng, False, used)
        return lv
    if kind == "mixed":
        lv = search_mixed(sid, n, target, glass_n, colors, rng, True, used)
        if lv is None:
            lv = search_mixed(sid, n, target, glass_n, colors, rng, False, used)
        return lv
    lv = search_gate(sid, n, target, colors, rng, True, used)
    if lv is None:
        lv = search_gate(sid, n, target, colors, rng, False, used)
    return lv


def main():
    rng = random.Random(520)
    used = set()
    levels = []
    for spec in SPEC:
        started = time.time()
        lv = build_one(spec, rng, used)
        if lv is None:
            print(f"FAILED stage {spec[0]} after {time.time() - started:.1f}s", file=sys.stderr)
            sys.exit(1)
        # par is what the solver measured; keep the authored target only if it matched
        moves = solve(lv, max_moves=lv["par"])
        if not moves or len(moves) != lv["par"]:
            print(f"par drift stage {spec[0]}", file=sys.stderr)
            sys.exit(1)
        levels.append(lv)
        glass = len(lv.get("glassH") or []) + len(lv.get("glassV") or [])
        print(
            f"  {lv['id']:2}  {lv['size']}×{lv['size']}  par={lv['par']:2}  "
            f"walls={len(lv['hWalls'])+len(lv['vWalls']):2}  glass={glass}  "
            f"btn={len(lv.get('buttons') or [])}  {lv['name']}  {time.time() - started:.1f}s",
            flush=True,
        )
    data = {"version": 9, "levelCount": 50, "wallModel": "edges", "levels": levels}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
