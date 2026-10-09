#!/usr/bin/env python3
"""Build the 90-stage campaign: walls, then one new mechanic at a time, then mixes.

Par is whatever tools/tilt_solver.py measures. Ice, sand, teleports, one-ways,
crumbling floors, and shifting walls follow js/game.js.
"""

import copy
import json
import random
import sys
from pathlib import Path

from generate_edge_levels import search_gate, search_glass, search_walls
from tilt_solver import DIRS, edges_crossed, play, prepare, solve, tilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "shared/levels.json"
DIR_INDEX = {name: i for i, (name, _dr, _dc) in enumerate(DIRS)}
ALLOW = (1 << 4) - 1

NAMES = [
    "Corner", "Side step", "Switchback", "Three turns", "Pocket", "Zigzag",
    "Elbow", "Long slide", "Wider board", "Double bend", "Detour", "S curve",
    "Five debut", "Cross", "Long way", "Center",
    "Soft stop", "Sand bar", "Stuck grain", "Drift", "Sand pocket",
    "Glide", "Ice run", "Skid", "Cold lane", "Slip",
    "One way", "Arrow lane", "No return", "Turnstile", "Only forward",
    "Warp", "Pair holes", "Jump cut", "Other side", "Ring pair",
    "First glass", "Crack it", "Two panes", "Glass bend", "Brittle lane", "Glass six",
    "Red gate", "Press first", "The button", "Around", "Locked lane", "Switch six",
    "Fog", "Hidden wall", "Smog lane", "Murk", "Clear sight",
    "Two coins", "Coin row", "Spare star", "Gold bend", "Pick up",
    "Crumble", "Once only", "Thin floor", "Give way", "No return path", "Sink cell",
    "Shift", "Moving bar", "Toggle", "Phase wall", "Slide aside", "After one",
    "Sand ice", "Arrow sand", "Warp fog", "Glass sand", "Glass coins",
    "Gate fog", "Gate coins", "Crumble sand", "Shift coins", "Ice arrow",
    "Glass gate", "Crumble arrow", "Warp coins", "Fog ice", "Shift sand",
    "Glass ice", "Gate arrow", "Coin fog", "Crumble coins", "Shift fog",
]


def replay(level, moves):
    board = prepare(level)
    r, c = board["ball"]
    gstate = act = collapse = phase = 0
    paths = []
    for action in moves:
        if action == "press":
            continue
        res = tilt(board, r, c, DIR_INDEX[action], gstate, act, ALLOW, collapse, phase)
        r, c, gstate, act, _moved, _won, collapse, phase, path = res
        paths.append(path)
    return paths


def visited(paths):
    cells = []
    for path in paths:
        cells.extend(path)
    return cells


def crossings(paths):
    found = []
    for path in paths:
        for a, b in zip(path, path[1:]):
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
                continue
            if a[0] != b[0]:
                found.append(("h", min(a[0], b[0]), a[1], "down" if b[0] > a[0] else "up"))
            else:
                found.append(("v", a[0], min(a[1], b[1]), "right" if b[1] > a[1] else "left"))
    return found


def wall_set(level):
    h = {("h", e["row"], e["col"]) for e in level.get("hWalls") or []}
    v = {("v", e["row"], e["col"]) for e in level.get("vWalls") or []}
    return h | v


def stamp(level, par, name, sid):
    level = copy.deepcopy(level)
    level["id"] = sid
    level["name"] = name
    level["par"] = par
    return level


def unwrap(level):
    return level[0] if isinstance(level, tuple) else level


def fresh_wall(n, target, rng, used):
    for strict in (True, False):
        level = unwrap(search_walls(1, n, target, rng, strict, used))
        if level:
            return level
    return None


def accept(level, prev, lo=4, drop=1, rise=2):
    moves = solve(level, max_moves=max(level.get("par", 8) + 10, 36))
    if not moves or len(moves) < lo:
        return None
    par = len(moves)
    if prev and (par < prev - drop or par > prev + rise):
        return None
    level = copy.deepcopy(level)
    level["par"] = par
    return level, moves


def with_sand(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    paths = replay(base, moves)
    hole = (base["hole"]["row"], base["hole"]["col"])
    cands = []
    for path in paths:
        if len(path) >= 3:
            cands.extend(cell for cell in path[1:-1] if cell != hole)
    rng.shuffle(cands)
    for cell in cands[:10]:
        trial = copy.deepcopy(base)
        trial["sand"] = [{"row": cell[0], "col": cell[1]}]
        trial["par"] = base["par"] + 3
        got = accept(trial, prev)
        if not got:
            continue
        trial, solved = got
        if len(solved) <= len(moves):
            continue
        if any(cell in path for path in replay(trial, solved)):
            return trial
    return None


def with_ice(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    paths = replay(base, moves)
    hole = (base["hole"]["row"], base["hole"]["col"])
    cands = []
    for path in paths:
        if len(path) >= 4:
            cands.extend(cell for cell in path[1:-2] if cell != hole)
    rng.shuffle(cands)
    for cell in cands[:10]:
        trial = copy.deepcopy(base)
        trial["ice"] = [{"row": cell[0], "col": cell[1]}]
        trial["par"] = base["par"] + 3
        got = accept(trial, prev)
        if not got:
            continue
        trial, solved = got
        if len(solved) <= len(moves):
            continue
        if any(cell in path for path in replay(trial, solved)):
            return trial
    return None


def with_oneway(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    found = crossings(replay(base, moves))
    rng.shuffle(found)
    for axis, r, c, direction in found[:12]:
        trial = copy.deepcopy(base)
        trial["oneWay"] = [{"axis": axis, "row": r, "col": c, "dir": direction}]
        trial["par"] = base["par"] + 3
        got = accept(trial, prev)
        if not got:
            continue
        trial, solved = got
        walled = copy.deepcopy(base)
        key = "hWalls" if axis == "h" else "vWalls"
        walled.setdefault(key, []).append({"row": r, "col": c})
        blocked = solve(walled, max_moves=base["par"] + 8)
        if blocked is not None and len(blocked) <= len(solved):
            continue
        if any((axis, r, c, direction) == item for item in crossings(replay(trial, solved))):
            return trial
    return None


def with_teleport(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    cells = []
    for cell in visited(replay(base, moves)):
        if cell not in cells:
            cells.append(cell)
    hole = (base["hole"]["row"], base["hole"]["col"])
    start = (base["ball"]["row"], base["ball"]["col"])
    picks = [cell for cell in cells if cell not in (hole, start)]
    rng.shuffle(picks)
    for i, a in enumerate(picks[:8]):
        for b in picks[i + 1:i + 6]:
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) < 2:
                continue
            trial = copy.deepcopy(base)
            trial["teleports"] = [{
                "a": {"row": a[0], "col": a[1]},
                "b": {"row": b[0], "col": b[1]},
            }]
            trial["par"] = max(4, base["par"])
            got = accept(trial, prev, lo=max(4, prev or 4), drop=0, rise=1)
            if not got:
                continue
            trial, solved = got
            if len(solved) > len(moves):
                continue
            paths = replay(trial, solved)
            flat = visited(paths)
            if a in flat or b in flat:
                jumped = any(abs(p[i][0] - p[i + 1][0]) + abs(p[i][1] - p[i + 1][1]) > 1
                             for p in paths for i in range(len(p) - 1))
                if jumped:
                    return trial
    return None


def with_smog(base, rng, prev):
    n = base["size"]
    walls = wall_set(base)
    near = []
    for r in range(n):
        for c in range(n):
            if (r, c) == (base["ball"]["row"], base["ball"]["col"]):
                continue
            touches = any(edge in walls for edge in (
                ("h", r - 1, c), ("h", r, c), ("v", r, c - 1), ("v", r, c),
            ))
            if touches:
                near.append((r, c))
    if len(near) < 3:
        return None
    rng.shuffle(near)
    trial = copy.deepcopy(base)
    trial["smog"] = [{"row": r, "col": c} for r, c in near[:4]]
    got = accept(trial, prev)
    if not got:
        return None
    trial, solved = got
    if len(solved) != base["par"]:
        return None
    return trial


def with_coins(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    cells = []
    start = (base["ball"]["row"], base["ball"]["col"])
    hole = (base["hole"]["row"], base["hole"]["col"])
    for cell in visited(replay(base, moves)):
        if cell not in cells and cell not in (start, hole):
            cells.append(cell)
    if len(cells) < 2:
        return None
    rng.shuffle(cells)
    chosen = cells[:2]
    trial = copy.deepcopy(base)
    trial["coins"] = [{"row": r, "col": c} for r, c in chosen]
    got = accept(trial, prev)
    if not got:
        return None
    trial, solved = got
    if len(solved) != len(moves):
        return None
    flat = set(visited(replay(trial, solved)))
    if all(cell in flat for cell in chosen):
        return trial
    return None


def with_collapse(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    start = (base["ball"]["row"], base["ball"]["col"])
    hole = (base["hole"]["row"], base["hole"]["col"])
    cells = []
    for cell in visited(replay(base, moves)):
        if cell not in cells and cell not in (start, hole):
            cells.append(cell)
    rng.shuffle(cells)
    for cell in cells[:12]:
        trial = copy.deepcopy(base)
        trial["collapse"] = [{"row": cell[0], "col": cell[1]}]
        trial["par"] = base["par"] + 4
        got = accept(trial, prev)
        if not got:
            continue
        trial, solved = got
        flat = visited(replay(trial, solved))
        if flat.count(cell) == 1 and len(solved) >= len(moves):
            return trial
    return None


def with_glass(base, rng, prev):
    if base.get("glassH") or base.get("glassV"):
        return None
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    found = []
    seen = set()
    for edge in edges_crossed(base, moves):
        if edge in seen:
            continue
        seen.add(edge)
        found.append(edge)
    rng.shuffle(found)
    for axis, r, c in found[:8]:
        trial = copy.deepcopy(base)
        key = "glassH" if axis == "h" else "glassV"
        trial.setdefault(key, []).append({"row": r, "col": c})
        trial["par"] = base["par"] + 2
        got = accept(trial, prev, drop=2, rise=2)
        if not got:
            continue
        trial, solved = got
        won, broken = play(trial, solved)
        if won and broken >= 1 and len(solved) > len(moves):
            return trial
    return None


def with_shifter(base, rng, prev):
    moves = solve(base, max_moves=base["par"] + 2)
    if not moves:
        return None
    n = base["size"]
    blocked = wall_set(base)
    found = crossings(replay(base, moves))
    rng.shuffle(found)
    opens = []
    for r in range(n - 1):
        for c in range(n):
            if ("h", r, c) not in blocked:
                opens.append(("h", r, c))
    for r in range(n):
        for c in range(n - 1):
            if ("v", r, c) not in blocked:
                opens.append(("v", r, c))
    for axis, r, c, _direction in found[:10]:
        alts = [edge for edge in opens if edge[0] == axis and edge[1:] != (r, c)]
        rng.shuffle(alts)
        for alt in alts[:6]:
            trial = copy.deepcopy(base)
            trial["shifters"] = [{
                "home": {"axis": axis, "row": r, "col": c},
                "alt": {"axis": alt[0], "row": alt[1], "col": alt[2]},
            }]
            trial["par"] = base["par"] + 4
            got = accept(trial, prev)
            if not got:
                continue
            trial, solved = got
            if len(solved) < len(moves):
                continue
            bare = copy.deepcopy(trial)
            bare.pop("shifters", None)
            bare_moves = solve(bare, max_moves=len(solved) + 4)
            if bare_moves is not None and tuple(bare_moves) == tuple(solved):
                continue
            return trial
    return None


DECORATORS = {
    "sand": with_sand,
    "ice": with_ice,
    "oneway": with_oneway,
    "teleport": with_teleport,
    "smog": with_smog,
    "coins": with_coins,
    "collapse": with_collapse,
    "movers": with_shifter,
    "glass": with_glass,
}


def decorate(kind, donors, rng, prev, used_fp, commit=True):
    order = list(donors)
    rng.shuffle(order)
    for base in order:
        made = DECORATORS[kind](base, rng, prev)
        if not made:
            continue
        fp = json.dumps({k: v for k, v in made.items() if k not in ("id", "name")}, sort_keys=True)
        if fp in used_fp:
            continue
        if commit:
            used_fp.add(fp)
        return made
    return None


def mix_title(level):
    bits = []
    if level.get("sand"):
        bits.append("Sand")
    if level.get("ice"):
        bits.append("Ice")
    if level.get("oneWay"):
        bits.append("Arrow")
    if level.get("teleports"):
        bits.append("Warp")
    if level.get("glassH") or level.get("glassV"):
        bits.append("Glass")
    if level.get("buttons"):
        bits.append("Gate")
    if level.get("smog"):
        bits.append("Fog")
    if level.get("coins"):
        bits.append("Coins")
    if level.get("collapse"):
        bits.append("Crumble")
    if level.get("shifters"):
        bits.append("Shift")
    return " + ".join(bits[:3]) or "Mix"


def hunt_exact(search, n, extra, prev, rng, used):
    for delta in (0, 1, -1, 2):
        target = prev + delta
        if target < 8:
            continue
        for strict in (True, False):
            level = search(1, n, target, extra, rng, strict, used)
            if not level:
                continue
            if level["par"] < prev - 1:
                continue
            return level
    return None


def main():
    rng = random.Random(909)
    used = set()
    used_fp = set()
    levels = []
    donors = []

    wall_specs = [
        (3, 4), (3, 4), (3, 5), (3, 5), (3, 6), (3, 6),
        (4, 7), (4, 7), (4, 8), (4, 8), (4, 9), (4, 9),
        (5, 10), (5, 11), (5, 12), (5, 12),
    ]
    for n, target in wall_specs:
        level = fresh_wall(n, target, rng, used)
        if not level:
            print(f"FAILED wall {n} par {target}", file=sys.stderr)
            sys.exit(1)
        levels.append(level)
        donors.append(copy.deepcopy(level))
        print(f"wall {n}×{n} par {level['par']}", flush=True)

    for n, target in ((4, 8), (4, 10), (5, 11), (5, 13), (6, 12), (6, 14), (5, 9), (6, 13)):
        level = fresh_wall(n, target, rng, used)
        if level:
            donors.append(level)

    schedule = (
        [("sand", donors)] * 5
        + [("ice", donors)] * 5
        + [("oneway", donors)] * 5
        + [("teleport", donors)] * 5
    )
    built = []
    prev = levels[-1]["par"]
    for kind, pool in schedule:
        made = decorate(kind, pool, rng, prev, used_fp)
        if not made:
            print(f"retry {kind} from a fresh wall near {prev}", flush=True)
            for n in (5, 6, 4, 6, 5):
                base = fresh_wall(n, max(prev, 4), rng, used)
                if not base and prev > 4:
                    base = fresh_wall(n, prev - 1, rng, used)
                if not base:
                    continue
                made = decorate(kind, [base], rng, prev, used_fp)
                if made:
                    break
        if not made:
            print(f"FAILED {kind}", file=sys.stderr)
            sys.exit(1)
        built.append(made)
        prev = made["par"]
        print(f"{kind} par {made['par']}", flush=True)
    levels.extend(built)

    glass_levels = []
    for n, panes in ((5, 1), (5, 1), (6, 2), (6, 2), (6, 2), (6, 3)):
        level = hunt_exact(search_glass, n, panes, prev, rng, used)
        if not level:
            print(f"FAILED glass {n} panes {panes} near {prev}", file=sys.stderr)
            sys.exit(1)
        glass_levels.append(level)
        levels.append(level)
        prev = level["par"]
        print(f"glass {n} par {level['par']}", flush=True)

    gate_levels = []
    for n, colors in (
        (5, ["red"]), (5, ["red"]), (6, ["red"]),
        (6, ["red"]), (6, ["red"]), (6, ["red", "blue"]),
    ):
        level = hunt_exact(search_gate, n, colors, prev, rng, used)
        if not level:
            print(f"FAILED gate {n} {colors} near {prev}", file=sys.stderr)
            sys.exit(1)
        gate_levels.append(level)
        levels.append(level)
        prev = level["par"]
        print(f"gate {n} par {level['par']}", flush=True)

    def close_pool(slack):
        pool = [lv for lv in levels if abs(lv["par"] - prev) <= slack and lv["size"] >= 4]
        return pool or levels[-8:]

    def wall_pool(slack):
        pool = [lv for lv in donors if abs(lv["par"] - prev) <= slack]
        return pool or donors

    for kind, count, slack in (
        ("smog", 5, 2),
        ("coins", 5, 2),
        ("collapse", 6, 3),
        ("movers", 6, 3),
    ):
        for _ in range(count):
            made = decorate(kind, wall_pool(slack), rng, prev, used_fp)
            if not made:
                print(f"FAILED {kind} near {prev} pool {len(wall_pool(slack))}", file=sys.stderr)
                sys.exit(1)
            levels.append(made)
            prev = made["par"]
            print(f"{kind} par {made['par']}", flush=True)

    def has_kind(level, kind):
        if kind == "glass":
            return bool(level.get("glassH") or level.get("glassV"))
        if kind == "gates":
            return bool(level.get("buttons"))
        if kind == "movers":
            return bool(level.get("shifters"))
        if kind == "oneway":
            return bool(level.get("oneWay"))
        if kind == "teleport":
            return bool(level.get("teleports"))
        return bool(level.get(kind))

    def mix_count(level):
        kinds = ("sand", "ice", "oneway", "teleport", "smog", "coins", "collapse", "movers", "glass", "gates")
        return sum(1 for kind in kinds if has_kind(level, kind))

    mix_adds = [
        "glass", "sand", "ice", "oneway", "teleport", "smog", "coins", "collapse", "movers",
        "sand", "ice", "coins", "smog", "oneway", "teleport",
        "collapse", "movers", "sand", "coins", "ice",
    ]
    for kind in mix_adds:
        made = None
        for _try in range(6):
            pool = [
                lv for lv in close_pool(2)
                if mix_count(lv) >= 1 and not has_kind(lv, kind)
            ]
            if kind == "glass":
                pool = [lv for lv in gate_levels if not has_kind(lv, "glass")] or pool
            made = decorate(kind, pool, rng, prev, used_fp, commit=False)
            if made and mix_count(made) >= 2:
                used_fp.add(json.dumps({k: v for k, v in made.items() if k not in ("id", "name")}, sort_keys=True))
                break
            made = None
        if not made:
            print(f"FAILED mix +{kind} near {prev}", file=sys.stderr)
            sys.exit(1)
        levels.append(made)
        prev = made["par"]
        print(f"mix +{kind} par {made['par']}", flush=True)

    if len(levels) != 90:
        print(f"FAILED count {len(levels)}", file=sys.stderr)
        sys.exit(1)
    if len(NAMES) != 90:
        print(f"FAILED names {len(NAMES)}", file=sys.stderr)
        sys.exit(1)
    for sid, (level, name) in enumerate(zip(levels, NAMES), start=1):
        level["id"] = sid
        level["name"] = mix_title(level) if sid > 70 else name
    data = {"version": 10, "levelCount": 90, "wallModel": "edges", "levels": levels}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(levels)} stages")


if __name__ == "__main__":
    main()
