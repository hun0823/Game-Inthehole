#!/usr/bin/env python3
"""144 stages: 12 planets, 12 boards each, every featured mechanic required.

Wood is walls only. Later planets introduce one mechanic, then mixes.
Coins are not generated. Jelly replaces them. Magma is the lava trick;
a collapsing floor is added on lava only when it stays necessary.
"""

import json
import random
import sys
from pathlib import Path

from build_tricks import (
    _add_glass,
    _try_collapse,
    _try_movers,
    _try_smog,
    build_cut,
    build_jelly,
    build_magma,
    build_stop,
    fresh_wall,
    hunt_gates,
    hunt_glass,
    hunt_oneway,
)
from necessity import Gallery, all_necessary, mechanic_names, wall_edges
from tilt_solver import solve

ROOT = Path(__file__).resolve().parents[1]
SIZES = [3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7]
BASE = {3: 4, 4: 6, 5: 8, 6: 10, 7: 12}
CAP = {3: 6, 4: 10, 5: 13, 6: 15, 7: 17}
PLANETS = (
    "wood",
    "desert",
    "ice",
    "ocean",
    "crystal",
    "toy",
    "mushroom",
    "candy",
    "lava",
    "jungle",
    "alien",
    "machine",
)
LABEL = {
    "wood": "Wood",
    "desert": "Desert",
    "ice": "Ice",
    "ocean": "Ocean",
    "crystal": "Crystal",
    "toy": "Toy",
    "mushroom": "Mushroom",
    "candy": "Candy",
    "lava": "Lava",
    "jungle": "Jungle",
    "alien": "Alien",
    "machine": "Machine",
}


def target_for(planet_index, stage_index, size):
    bonus = min(3, planet_index // 3)
    wobble = stage_index // 4
    return min(CAP[size], BASE[size] + bonus + wobble)


def walls_matter(level, moves):
    bare = {
        **level,
        "hWalls": [],
        "vWalls": [],
    }
    other = solve(bare, max_moves=len(moves))
    return other is not None and len(other) <= len(moves) - 2


def accept(level, moves, gallery, required):
    if not moves or len(moves) < 2:
        return False
    if level.get("coins"):
        return False
    names = set(mechanic_names(level))
    if required is not None and not set(required) <= names:
        return False
    if required is not None and names - set(required) - {"collapse"}:
        return False
    if not names and not walls_matter(level, moves):
        return False
    if names and not all_necessary(level, moves):
        return False
    if gallery.reject_reason(level):
        return False
    return True


def consume(pool, level):
    sig = wall_edges(level)
    pool[:] = [donor for donor in pool if wall_edges(donor) != sig]


def mint(pool, n, target, rng, rounds=6):
    used = set()
    attempts = 160 if n <= 4 else 280 if n <= 6 else 420
    for delta in (0, 1, -1, 2, 3, -2, 4):
        aim = target + delta
        if aim < 3 or aim > CAP[n] + 2:
            continue
        for _ in range(rounds):
            level = fresh_wall(n, aim, rng, used, attempts=attempts)
            if not level:
                continue
            moves = solve(level, max_moves=aim + 3)
            if moves and len(moves) >= 3:
                level["par"] = len(moves)
                pool.append(level)
                return level
    return None


def ensure_donors(pool, n, target, rng, count):
    have = [level for level in pool if level["size"] == n]
    while len(have) < count:
        made = mint(pool, n, target + 2, rng)
        if not made:
            break
        have.append(made)
    return [level for level in pool if level["size"] == n]


def finish(level, moves, planet, stage_index, gallery):
    level = dict(level)
    level["planet"] = planet
    level["name"] = f"{LABEL[planet]} {stage_index + 1}"
    level["par"] = len(moves)
    gallery.add(level)
    return level


def take_stop(kind, n, target, rng, gallery, required):
    for delta in (0, 1, -1, 2, -2):
        aim = max(3, min(CAP[n], target + delta))
        made = build_stop(n, aim, rng, kind, gallery, attempts=18)
        if made and accept(made[0], made[1], gallery, required):
            return made
    return None


def take_cut(kind, n, target, rng, gallery, required):
    for delta in (0, 1, -1, 2, -2, 3):
        aim = max(3, min(CAP[n], target + delta))
        if kind == "glass":
            made = hunt_glass(n, aim, rng, set(), gallery)
        elif kind == "gates":
            made = hunt_gates(n, aim, rng, set(), gallery)
        else:
            made = build_cut(n, aim, rng, kind, gallery, attempts=24)
        if made and accept(made[0], made[1], gallery, required):
            return made
    return None


def take_jelly(n, target, rng, gallery):
    for delta in (0, -1, 1, -2, 2, -3, -4, 3):
        aim = max(3, min(CAP[n], target + delta))
        made = build_jelly(n, aim, rng, gallery, attempts=16)
        if made and accept(made[0], made[1], gallery, ["jelly"]):
            return made
    return None


def take_magma(n, target, rng, gallery, with_collapse=False):
    from build_tricks import magma_from_maze
    if n >= 5:
        for _ in range(6):
            made = magma_from_maze(n, target, rng, gallery, attempts=2)
            if not made:
                continue
            level, moves = made
            if with_collapse:
                layered = _try_collapse(level, rng, max(3, len(moves) - 2), len(moves) + 3)
                if layered and accept(layered[0], layered[1], gallery, ["magma", "collapse"]):
                    return layered
            if accept(level, moves, gallery, ["magma"]):
                return level, moves
    for delta in (0, 1, -1, 2, -2, 3, 4):
        aim = max(2, min(CAP[n], target + delta))
        made = build_magma(n, aim, rng, gallery, attempts=16)
        if not made:
            continue
        level, moves = made
        if with_collapse:
            layered = _try_collapse(level, rng, max(3, len(moves) - 2), len(moves) + 3)
            if layered and accept(layered[0], layered[1], gallery, ["magma", "collapse"]):
                return layered
        if accept(level, moves, gallery, ["magma"]):
            return level, moves
    return None


def take_oneway(pool, n, target, rng, gallery):
    donors = ensure_donors(pool, n, max(target, 8), rng, 8)
    if not donors:
        return None
    lo = max(3, target - 4)
    hi = min(CAP[n] + 2, target + 4)
    made = hunt_oneway(donors, rng, lo, hi, gallery, attempts=16)
    if made and accept(made[0], made[1], gallery, ["oneway"]):
        consume(pool, made[0])
        return made
    return None


def take_smog(pool, n, target, rng, gallery):
    donors = ensure_donors(pool, n, target, rng, 6)
    rng.shuffle(donors)
    for base in donors[:8]:
        moves = solve(base, max_moves=base["par"] + 2)
        if not moves:
            continue
        made = _try_smog(base, len(moves))
        if made and accept(made[0], made[1], gallery, ["smog"]):
            consume(pool, made[0])
            return made
    return None


def take_movers(pool, n, target, rng, gallery):
    donors = ensure_donors(pool, n, max(4, min(target, CAP[n] - 1)), rng, 8)
    rng.shuffle(donors)
    lo = 3
    hi = CAP[n] + 2
    for base in donors[:10]:
        made = _try_movers(base, rng, lo, hi)
        if made and accept(made[0], made[1], gallery, ["movers"]):
            consume(pool, made[0])
            return made
    return None


def layer_extra(level, moves, kind, rng):
    par = len(moves)
    if kind == "smog":
        return _try_smog(level, par)
    if kind == "glass":
        return _add_glass(level, rng, par)
    if kind == "oneway":
        return hunt_oneway([level], rng, max(3, par - 3), par + 4, None, attempts=1)
    if kind == "movers":
        return _try_movers(level, rng, max(3, par - 3), par + 3)
    if kind == "collapse":
        return _try_collapse(level, rng, max(3, par - 3), par + 3)
    return None


def take_mix(kinds, n, target, rng, gallery, pool):
    primary = kinds[0]
    builders = {
        "sand": lambda aim: take_stop("sand", n, aim, rng, gallery, ["sand"]),
        "ice": lambda aim: take_stop("ice", n, aim, rng, gallery, ["ice"]),
        "teleport": lambda aim: take_cut("teleport", n, aim, rng, gallery, ["teleport"]),
        "glass": lambda aim: take_cut("glass", n, aim, rng, gallery, ["glass"]),
        "gates": lambda aim: take_cut("gates", n, aim, rng, gallery, ["gates"]),
        "jelly": lambda aim: take_jelly(n, aim, rng, gallery),
        "magma": lambda aim: take_magma(n, aim, rng, gallery),
        "oneway": lambda aim: take_oneway(pool, n, aim, rng, gallery),
        "movers": lambda aim: take_movers(pool, n, aim, rng, gallery),
    }
    build = builders.get(primary)
    if not build:
        return None
    for _ in range(14):
        made = build(max(3, target + rng.randint(-1, 2)))
        if not made:
            continue
        level, moves = made
        ok = True
        for kind in kinds[1:]:
            layered = layer_extra(level, moves, kind, rng)
            if not layered:
                ok = False
                break
            level, moves = layered
        if ok and accept(level, moves, gallery, kinds):
            return level, moves
    return None


def slot_kinds(planet, stage_index, size):
    if planet == "wood":
        return []
    if planet == "desert":
        return ["sand"]
    if planet == "ice":
        return ["ice"]
    if planet == "ocean":
        # A 3x3 board cannot hold an arrow that is both a passage and a stop
        # under the gap rule. Whirlpools introduce the planet; currents start
        # at 4x4, and the last four stages use both.
        if size <= 3:
            return ["teleport"]
        if stage_index < 8:
            return ["oneway"]
        return ["teleport", "oneway"]
    if planet == "crystal":
        return ["glass"]
    if planet == "toy":
        return ["gates"]
    if planet == "mushroom":
        return ["smog"]
    if planet == "candy":
        return ["jelly"]
    if planet == "lava":
        return ["magma", "collapse"] if stage_index >= 8 else ["magma"]
    if planet == "jungle":
        # Swinging vines need a 4x4 before the phase trick can change par by
        # the gap. The 3x3 boards are jungle-themed wall puzzles; the tutorial
        # opens on the first vine stage.
        if size <= 3:
            return []
        return ["movers"]
    if planet == "alien":
        pairs = (
            ("sand", "smog"),
            ("ice", "smog"),
            ("teleport", "smog"),
            ("glass", "smog"),
            ("gates", "smog"),
            ("jelly", "smog"),
            ("oneway", "smog"),
            ("magma", "smog"),
            ("movers", "smog"),
            ("sand", "glass"),
            ("ice", "oneway"),
            ("teleport", "glass"),
        )
        return list(pairs[stage_index % len(pairs)])
    triples = (
        ("sand", "smog", "glass"),
        ("teleport", "smog", "oneway"),
        ("ice", "smog", "movers"),
        ("gates", "smog", "glass"),
        ("jelly", "smog", "oneway"),
        ("magma", "smog", "glass"),
        ("sand", "glass", "smog"),
        ("teleport", "movers", "smog"),
        ("jelly", "smog", "movers"),
        ("gates", "oneway", "smog"),
        ("ice", "glass", "smog"),
        ("magma", "smog", "movers"),
    )
    return list(triples[stage_index % len(triples)])


def build_slot(planet, stage_index, size, target, rng, gallery, pool, prev):
    kinds = slot_kinds(planet, stage_index, size)
    lo = 2 if size == 3 else 3
    if prev:
        lo = max(lo, prev - 2)
    for _try in range(10):
        aim = target + (_try % 5) - 1
        made = None
        if planet == "wood" or (planet == "jungle" and not kinds):
            donors = []
            minted = mint(donors, size, aim, rng, rounds=3)
            if minted:
                moves = solve(minted, max_moves=aim + 3)
                if moves and accept(minted, moves, gallery, []):
                    made = minted, moves
        elif planet == "desert":
            made = take_stop("sand", size, aim, rng, gallery, ["sand"])
        elif planet == "ice":
            made = take_stop("ice", size, aim, rng, gallery, ["ice"])
        elif planet == "ocean" and kinds == ["oneway"]:
            made = take_oneway(pool, size, aim, rng, gallery)
        elif planet == "ocean" and kinds == ["teleport"]:
            made = take_cut("teleport", size, aim, rng, gallery, ["teleport"])
        elif planet == "ocean":
            made = take_mix(["teleport", "oneway"], size, aim, rng, gallery, pool)
        elif planet == "crystal":
            made = take_cut("glass", size, aim, rng, gallery, ["glass"])
        elif planet == "toy":
            made = take_cut("gates", size, aim, rng, gallery, ["gates"])
        elif planet == "mushroom":
            made = take_smog(pool, size, aim, rng, gallery)
        elif planet == "candy":
            made = take_jelly(size, aim, rng, gallery)
        elif planet == "lava":
            made = take_magma(size, aim, rng, gallery, with_collapse="collapse" in kinds)
            if made and "collapse" in kinds and "collapse" not in mechanic_names(made[0]):
                # Secondary crumble is optional. Magma alone still counts.
                if not accept(made[0], made[1], gallery, ["magma"]):
                    made = None
        elif planet == "jungle":
            made = take_movers(pool, size, aim, rng, gallery)
        else:
            made = take_mix(kinds, size, aim, rng, gallery, pool)
            if not made and planet == "alien":
                made = take_mix(["sand", "smog"], size, aim, rng, gallery, pool)
            if not made and planet == "machine":
                made = take_mix(["sand", "smog", "glass"], size, aim, rng, gallery, pool)
        if not made:
            continue
        level, moves = made
        if len(moves) < lo and _try < 8:
            continue
        return level, moves
    return None


def main():
    rng = random.Random(14401)
    gallery = Gallery()
    pool = []
    levels = []
    prev = {}
    for pi, planet in enumerate(PLANETS):
        prev[planet] = 0
        for si, size in enumerate(SIZES):
            target = target_for(pi, si, size)
            print(f"building {planet} {si + 1} {size}x{size} target {target}", flush=True)
            made = build_slot(planet, si, size, target, rng, gallery, pool, prev[planet])
            if not made:
                print(f"FAILED {planet} stage {si + 1}", flush=True)
                return 1
            level, moves = made
            level = finish(level, moves, planet, si, gallery)
            prev[planet] = len(moves)
            levels.append(level)
            names = ",".join(mechanic_names(level)) or "walls"
            print(f"  ok id-will-be {len(levels)} par {len(moves)} [{names}]", flush=True)
    for i, level in enumerate(levels, start=1):
        level["id"] = i
        level.pop("moves", None)
    payload = {"version": 11, "levels": levels}
    path = ROOT / "shared" / "levels.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(levels)} levels to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
