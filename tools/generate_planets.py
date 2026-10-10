#!/usr/bin/env python3
"""144 stages: 12 planets, 12 boards each, every featured mechanic required.

Wood is walls only. Later planets introduce one mechanic, then mixes.
Coins are not generated. Par and budget dead-ends both rise inside a planet,
and each planet opens harder than the one before it.
"""

import json
import random
import sys
from pathlib import Path

from hard_boards import build_hard
from necessity import Gallery, mechanic_names

ROOT = Path(__file__).resolve().parents[1]
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
# Wood starts at 3x3. Desert starts at 4x4. Every later planet starts at 5x5.
# None of them go past 7x7: the board, camera, and HUD already fit that size.
SIZES = {
    "wood": [3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7],
    "desert": [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7],
}
LATE_SIZES = [5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7]
# Stage-1 floors. Each is at least one tilt above the previous planet.
# Offsets then climb inside the planet until the size cap.
STAGE_ONE = {
    "wood": 4,
    "desert": 6,
    "ice": 7,
    "ocean": 8,
    "crystal": 9,
    "toy": 10,
    "mushroom": 11,
    "candy": 12,
    "lava": 13,
    "jungle": 14,
    "alien": 15,
    "machine": 16,
}
OFFSETS = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]
# Budget dead ends saturate on a small board. Ask for one more than the
# previous stage, but not more than that size has reliably produced.
# One-way mazes do not grow trap counts as fast as a locked stair.
DEAD_CAP = {
    "ocean": {3: 2, 4: 4, 5: 4, 6: 6, 7: 8},
}
DEAD_CAP_DEFAULT = {3: 2, 4: 4, 5: 6, 6: 8, 7: 10}


def dead_cap(planet, n):
    return DEAD_CAP.get(planet, DEAD_CAP_DEFAULT).get(n, DEAD_CAP_DEFAULT[n])
# Late planets share 5x5 openers, so their caps step up with the floor.
# A flat cap would pin every late planet on the same par.
CAP = {
    "wood": {3: 5, 4: 8, 5: 10, 6: 12, 7: 13},
    "desert": {3: 5, 4: 9, 5: 12, 6: 13, 7: 15},
    "ice": {5: 12, 6: 14, 7: 16},
    "ocean": {5: 12, 6: 14, 7: 16},
    "crystal": {5: 13, 6: 15, 7: 16},
    "toy": {5: 14, 6: 15, 7: 17},
    "mushroom": {5: 14, 6: 16, 7: 17},
    "candy": {5: 15, 6: 16, 7: 17},
    # 5x5 magma rarely has two different par-14 maps. Three par-13 openers
    # still leave the later sizes to carry the average above candy.
    "lava": {5: 13, 6: 16, 7: 16},
    # 6x6 vines at par 17 repeat the same stair. Par 16 still has several maps.
    "jungle": {5: 16, 6: 16, 7: 18},
    "alien": {5: 16, 6: 17, 7: 18},
    "machine": {5: 18, 6: 18, 7: 19},
}
# Alien and machine only remix tricks that already debuted on their own planet.
ALIEN_PAIRS = (
    ("ice", "smog"),
    ("sand", "smog"),
    ("glass", "smog"),
    ("teleport", "smog"),
    ("jelly", "smog"),
    ("gates", "smog"),
    ("movers", "smog"),
    ("ice", "glass"),
    ("sand", "glass"),
    ("jelly", "glass"),
    ("teleport", "glass"),
    ("gates", "glass"),
)
# The first three are the 5x5 openers. Each one actually lands on its par
# (16, then 17, then 18). The other mixes are for the larger boards.
# Only these mixes reliably produce a necessary triple. The list repeats
# them so a later stage can search that mix first instead of a dead end.
MACHINE_TRIOS = (
    ("movers", "sand", "smog"),
    ("movers", "smog", "glass"),
    ("gates", "glass", "smog"),
    ("movers", "smog", "glass"),
    ("gates", "glass", "smog"),
    ("movers", "sand", "smog"),
    ("sand", "glass", "smog"),
    ("gates", "glass", "smog"),
    ("movers", "smog", "glass"),
    ("sand", "glass", "smog"),
    ("gates", "glass", "smog"),
    ("movers", "smog", "glass"),
)
FALLBACK = {
    "alien": [("glass", "smog"), ("ice", "smog"), ("movers", "smog"), ("gates", "smog")],
    "machine": [
        ("movers", "ice", "smog"),
        ("gates", "glass", "smog"),
        ("sand", "glass", "smog"),
        ("movers", "smog", "glass"),
    ],
}


def sizes_for(planet):
    return SIZES.get(planet, LATE_SIZES)


# Dead-end ask by stage. Early boards stay low so a later mix, which cannot
# grow traps as fast as a stair, can still finish the planet higher than it
# started. Ocean's last four stages are whirlpool + current, so the ask
# drops there on purpose.
DEAD_RISE = [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9]
OCEAN_RISE = [1, 1, 2, 2, 2, 3, 3, 4, 2, 3, 3, 4]


# Five identical par-18 7x7 vines are the same stair. Spread the par so each
# board is a different maze, and keep the sequence non-decreasing.
JUNGLE_7 = (16, 17, 17, 18, 18)
# 5x5 machine mixes each have one par they can hit. Keep those pars in order.
MACHINE_5 = (16, 17, 17)


def stage_targets(planet, s1):
    cap = CAP[planet]
    out = []
    seen7 = 0
    for si, n in enumerate(sizes_for(planet)):
        goal = min(cap[n], s1 + OFFSETS[si])
        if planet == "jungle" and n == 7:
            goal = min(goal, JUNGLE_7[seen7])
            seen7 += 1
        if planet == "machine" and n == 5:
            goal = MACHINE_5[si]
        out.append(goal)
    return out


def planned_avg(planet):
    return sum(stage_targets(planet, STAGE_ONE[planet])) / 12


def dead_goal(planet, si, n, deads):
    rise = OCEAN_RISE if planet == "ocean" else DEAD_RISE
    goal = min(dead_cap(planet, n), rise[si])
    if si == 11 and deads:
        need = max(deads[0] + 1, sum(deads[:6]) - sum(deads[6:]) + 1)
        goal = max(goal, need)
    elif si >= 9 and deads:
        remaining = 12 - si
        need = sum(deads[:6]) - sum(deads[6:]) + 1
        if need > 0:
            goal = max(goal, (need + remaining - 1) // remaining)
    return max(1, min(dead_cap(planet, n), goal))


def projected_avg(pars, par, schedules):
    """Average if every later stage is at least this par and its own target."""
    carry = par
    rest = []
    for sch in schedules[len(pars) + 1:]:
        carry = max(carry, sch)
        rest.append(carry)
    return (sum(pars) + par + sum(rest)) / 12


def slot_kinds(planet, stage_index):
    if planet == "wood":
        return []
    if planet == "desert":
        return ["sand"]
    if planet == "ice":
        return ["ice"]
    if planet == "ocean":
        # Whirlpools open the planet. Currents start on stage 3. The last four
        # stages use both, which is where the mixed-trick lesson debuts.
        if stage_index < 2:
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
        # Magma on every stage. Crumbling floors join on stage 9.
        if stage_index >= 8:
            return ["collapse", "magma"]
        return ["magma"]
    if planet == "jungle":
        return ["movers"]
    if planet == "alien":
        return list(ALIEN_PAIRS[stage_index % len(ALIEN_PAIRS)])
    return list(MACHINE_TRIOS[stage_index % len(MACHINE_TRIOS)])


def _attempts(kinds):
    names = set(kinds)
    if names == {"oneway", "teleport"}:
        # One donor pass hits about two times in three. Three passes make a
        # par-15 finale reliable without walking the par up to an unfindable 16.
        return 3
    if "oneway" in names:
        return 6
    if "movers" in names:
        # Moving walls repeat a few corridor shapes. Extra tries are what
        # keep a 6x6 par-17 vine off the previous board's walls.
        return 8
    if "collapse" in names:
        return 8
    if not names:
        # Wall puzzles need several stair lengths before the dead-end count
        # lands in the narrow band the ramp asked for.
        return 16
    if "sand" in names or "ice" in names:
        return 12
    if names == {"magma"}:
        return 14
    return 12


def _clean(level):
    drop = {"moves", "_deadEnds", "_traps"}
    cleaned = {}
    for key, value in level.items():
        if key in drop:
            continue
        if value in ([], {}, None) and key not in ("hWalls", "vWalls"):
            continue
        cleaned[key] = value
    return cleaned


def _obtain(n, target, kinds, rng, gallery, min_dead, trap_bias, attempts, prefer_high=False, max_par=None):
    """Search until par is at least `target` and dead ends clear `min_dead`."""
    best = None
    schedules = (
        (min_dead, attempts, trap_bias),
        (min_dead, attempts + 2, trap_bias + 2),
        (max(0, min_dead - 1), attempts, max(2, trap_bias - 1)),
    )
    # One whirlpool-plus-current search already covers several donors.
    if set(kinds) == {"oneway", "teleport"}:
        schedules = ((min_dead, attempts, trap_bias),)
    for dead_floor, tries, bias in schedules:
        made = build_hard(
            n, target, kinds, rng, gallery,
            trap_bias=max(2, bias), attempts=tries, min_dead=dead_floor,
            prefer_high=prefer_high, max_par=max_par,
        )
        if not made:
            continue
        level, moves = made
        dead = level["_deadEnds"]
        if dead < min_dead:
            if best is None or dead > best[0]["_deadEnds"]:
                best = made
            continue
        # Closest to the floor, then closest to the par target.
        rank = (-(dead - min_dead), -abs(len(moves) - target), dead)
        if best is None or best[0].get("_deadEnds", 0) < min_dead or rank > (
            -(best[0]["_deadEnds"] - min_dead),
            -abs(len(best[1]) - target),
            best[0]["_deadEnds"],
        ):
            best = made
        if dead <= min_dead + 1:
            return made
    return best


def _machine_one(stage_index, n, target, rng, gallery, min_dead, max_par, prefer_high=False):
    """Several independent seeds. One stream often misses a par the next hits."""
    kinds = slot_kinds("machine", stage_index)
    options = [kinds]
    for extra in FALLBACK["machine"]:
        alt = list(extra)
        if alt not in options:
            options.append(alt)
    hi = max_par if max_par is not None else target
    best = None
    for choice in options:
        # Gates and vines land one tilt above the corridor they are aimed at.
        aim = target - 1 if target >= 17 and any(k in choice for k in ("gates", "movers")) else target
        quiet = 0
        for _ in range(8):
            sub = random.Random(rng.randrange(1_000_000_000))
            made = build_hard(
                n, aim, choice, sub, gallery,
                trap_bias=4, attempts=4, min_dead=min_dead,
                prefer_high=False, max_par=hi,
            )
            if not made or not (target <= len(made[1]) <= hi) or made[0]["_deadEnds"] < 1:
                continue
            dead = made[0]["_deadEnds"]
            if best is None:
                best = made
            elif prefer_high and dead > best[0]["_deadEnds"]:
                best = made
            elif not prefer_high and dead < best[0]["_deadEnds"]:
                best = made
            quiet += 1
            # The first half of a planet must not open with a dead-end spike.
            if not prefer_high and best[0]["_deadEnds"] <= 4:
                return best
            if prefer_high and quiet >= 2 and best[0]["_deadEnds"] >= 8:
                return best
        if best is not None:
            return best
    return best


def build_one(planet, stage_index, n, target, rng, gallery, min_dead, prefer_high=False, max_par=None):
    if planet == "machine":
        return _machine_one(
            stage_index, n, target, rng, gallery, min_dead, max_par, prefer_high
        )
    kinds = slot_kinds(planet, stage_index)
    options = [kinds]
    if planet in FALLBACK:
        for extra in FALLBACK[planet]:
            alt = list(extra)
            if alt not in options:
                options.append(alt)
    # Shift the stair length by stage so consecutive maps are not the same trap.
    bias = max(2, min_dead + (stage_index % 3) - 1)
    attempts = _attempts(kinds)
    best = None
    for choice in options:
        made = _obtain(
            n, target, choice, rng, gallery, min_dead, bias, attempts, prefer_high, max_par
        )
        if not made:
            continue
        level, moves = made
        rank = (
            1 if level["_deadEnds"] >= min_dead else 0,
            level["_deadEnds"],
            -abs(len(moves) - target),
        )
        if best is None or rank > best[0]:
            best = (rank, made, choice)
        if level["_deadEnds"] >= min_dead and abs(len(moves) - target) <= 1:
            break
        # A failed exotic mix should not burn the same budget again.
        if planet in ("alien", "machine") and level["_deadEnds"] >= min_dead:
            break
    if best is None:
        return None
    return best[1]


def main():
    rng = random.Random(20261010)
    print("planned averages:", flush=True)
    for name in PLANETS:
        sched = stage_targets(name, STAGE_ONE[name])
        print(f"  {name}: {sched} avg {sum(sched) / 12:.2f}", flush=True)
    gallery = Gallery()
    levels = []
    report = []
    prev_s1 = 0
    prev_avg = 0.0
    for planet in PLANETS:
        sizes = sizes_for(planet)
        s1 = max(STAGE_ONE[planet], prev_s1 + 1)
        cap = CAP[planet]
        schedules = stage_targets(planet, s1)
        nxt = PLANETS[PLANETS.index(planet) + 1] if planet != "machine" else None
        avg_limit = planned_avg(nxt) if nxt else 99.0
        prev_par = 0
        planet_rows = []
        deads_so_far = []
        pars_so_far = []
        for si, n in enumerate(sizes):
            floor = prev_par if si else prev_s1 + 1
            target = max(schedules[si], floor)
            # One tilt of slack, and never a jump that the next planet's
            # planned average cannot beat. Crumbling floors land a few tilts
            # high; allow that slack while the projection stays under the limit.
            if planet == "lava" and si >= 8:
                # The first crumble may sit two tilts above the schedule.
                # Later crumbles stay on that par instead of climbing again.
                if floor > schedules[si]:
                    ceiling = floor
                else:
                    ceiling = schedules[si] + 2
                    while ceiling > floor and projected_avg(pars_so_far, ceiling, schedules) >= avg_limit:
                        ceiling -= 1
            elif planet == "machine" and n >= 6:
                # Cap above is the planned par. Two extra tilts are allowed
                # when that exact par has no unique map left.
                ceiling = min(target + 2, 20 if n == 6 else 21)
            elif planet == "jungle" or (planet == "machine" and n == 5 and si == 0):
                # These maps only exist at the planned par. One extra tilt
                # either repeats a wall set or skips a par nobody can build.
                ceiling = target
            elif planet == "machine" and n == 5:
                # Later 5x5 mixes land at 17 or 18 from the same search.
                ceiling = max(target, 18)
            else:
                ceiling = min(cap[n], target + 1)
            cap_dead = dead_cap(planet, n)
            # Magma's tilt clock makes almost every state a dead end. The
            # first half takes the quietest boards and the second half the
            # busiest, so the count still rises inside the planet.
            prefer_high = (planet == "lava" and si >= 6) or (planet == "machine" and si >= 6)
            min_dead = 1 if prefer_high else dead_goal(planet, si, n, deads_so_far)
            print(
                f"building {planet} {si + 1} {n}x{n} target {target} "
                f"ceiling {ceiling} dead>={min_dead}",
                flush=True,
            )
            made = None
            fallback = None
            ask = target
            while ask <= ceiling and made is None:
                if projected_avg(pars_so_far, ask, schedules) >= avg_limit:
                    print(
                        f"  skip par {ask}: projected avg would pass {avg_limit:.2f}",
                        flush=True,
                    )
                    break
                # Search this par exactly. A higher result would become the
                # next stage's floor. The 5x5 button mix is the exception:
                # aiming at 17 is what produces the par-18 board.
                par_cap = max(ask, 18) if planet == "machine" and n == 5 and si >= 1 else ask
                candidate = build_one(
                    planet, si, n, ask, rng, gallery, min_dead, prefer_high, par_cap
                )
                if candidate is None:
                    ask += 1
                    continue
                dead_now = candidate[0]["_deadEnds"]
                par_now = len(candidate[1])
                if par_now < floor or par_now > ceiling or dead_now < 1:
                    ask += 1
                    continue
                if projected_avg(pars_so_far, par_now, schedules) >= avg_limit:
                    ask += 1
                    continue
                if fallback is None:
                    fallback = candidate
                elif prefer_high and dead_now > fallback[0]["_deadEnds"]:
                    fallback = candidate
                elif not prefer_high and (
                    fallback[0]["_deadEnds"] < min_dead
                    and dead_now > fallback[0]["_deadEnds"]
                    or min_dead <= dead_now < fallback[0]["_deadEnds"]
                ):
                    fallback = candidate
                band_hi = max(cap_dead, min_dead)
                if min_dead <= dead_now <= band_hi or prefer_high:
                    made = candidate
                    break
                # A miss on the trap count must not walk the par up.
                break
            if made is None:
                made = fallback
            if made is None:
                print(f"FAILED {planet} stage {si + 1}", flush=True)
                return 1
            level, moves = made
            par = len(moves)
            dead = level["_deadEnds"]
            traps = level["_traps"]
            if par < floor:
                print(f"FAILED {planet} stage {si + 1} par {par} below floor {floor}", flush=True)
                return 1
            level = _clean(level)
            level["planet"] = planet
            level["name"] = f"{LABEL[planet]} {si + 1}"
            level["par"] = par
            gallery.add(level)
            levels.append(level)
            planet_rows.append((n, par, dead, traps, ",".join(mechanic_names(level)) or "walls"))
            prev_par = par
            pars_so_far.append(par)
            deads_so_far.append(dead)
            print(
                f"  ok par {par} dead {dead} traps {traps} [{planet_rows[-1][4]}]",
                flush=True,
            )
        pars = [row[1] for row in planet_rows]
        deads = [row[2] for row in planet_rows]
        avg = sum(pars) / len(pars)
        if deads[-1] <= deads[0] or sum(deads[6:]) <= sum(deads[:6]):
            print(f"FAILED {planet} dead ends {deads[0]} → {deads[-1]} halves {sum(deads[:6])} / {sum(deads[6:])}", flush=True)
            return 1
        if pars[-1] <= pars[0]:
            print(f"FAILED {planet} par {pars[0]} → {pars[-1]}", flush=True)
            return 1
        if pars[0] <= prev_s1 or avg <= prev_avg:
            print(
                f"FAILED ramp {planet} s1 {pars[0]} avg {avg:.2f} after {prev_s1} / {prev_avg:.2f}",
                flush=True,
            )
            return 1
        prev_s1 = pars[0]
        prev_avg = avg
        report.append((planet, planet_rows, avg))
    for i, level in enumerate(levels, start=1):
        level["id"] = i
    payload = {"version": 12, "levels": levels}
    path = ROOT / "shared" / "levels.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(levels)} levels to {path}")
    for planet, rows, avg in report:
        pars = [row[1] for row in rows]
        deads = [row[2] for row in rows]
        sizes = [row[0] for row in rows]
        print(
            f"{planet}: sizes {sizes} par {pars} min {min(pars)} avg {avg:.2f} max {max(pars)} "
            f"dead {deads} avgDead {sum(deads)/len(deads):.1f}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
