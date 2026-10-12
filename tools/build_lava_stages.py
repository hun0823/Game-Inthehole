#!/usr/bin/env python3
"""Regenerate the 12 Lava stages for the crack-then-lava rule.

A stage is kept only when the shortest safe line has to use the timer:
stripping the vents shortens par by at least GAP, and either the winning
line crosses a cell before it becomes lava or the obvious (bare) line dies.
Rotations and mirrors are rejected against the whole campaign.
"""

import copy
import json
import random
import sys
from pathlib import Path

from generate_edge_levels import search_walls
from necessity import GAP, Gallery, budget_dead_ends, magma_ok, _replay_tilts
from tilt_solver import solve

ROOT = Path(__file__).resolve().parents[1]
LEVELS = ROOT / "shared/levels.json"

# Sizes from GAME_DESIGN_REFERENCE §9. Pars stay between candy and jungle:
# stage 1 is 13, the run does not fall, the mean stays under jungle's 16.17.
SIZES = [5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7]
# 5×5 wall mazes top out at par 13. The jump to 15 lands on the first 6×6.
PARS = [13, 13, 13, 15, 15, 16, 16, 16, 16, 17, 17, 17]


def _drop_edge(level, edge):
    axis, r, c = edge
    key = "hWalls" if axis == "h" else "vWalls"
    trial = copy.deepcopy(level)
    trial[key] = [e for e in trial.get(key) or [] if not (e["row"] == r and e["col"] == c)]
    return trial


def _walls(level):
    out = [("h", e["row"], e["col"]) for e in level.get("hWalls") or []]
    out += [("v", e["row"], e["col"]) for e in level.get("vWalls") or []]
    return out


def _entries(level, moves):
    """Cells the ball moves onto, with the uncapped tilt count at the start of that slide.

    Boards with no vents cap the counter at 0, so the campaign replay cannot
    be used to choose `at`. The count here is how many tilts were already spent.
    """
    from tilt_solver import prepare, tilt
    from necessity import DIR_INDEX, ALLOW

    board = prepare(level)
    r, c = board["ball"]
    gstate = act = collapse = phase = 0
    spent = 0
    found = []
    for action in moves:
        if action == "press":
            spent += 1
            continue
        res = tilt(board, r, c, DIR_INDEX[action], gstate, act, ALLOW, collapse, phase, spent)
        r, c, gstate, act, moved, _won, collapse, phase, path, lost = res
        for cell in path[1:]:
            found.append((cell, spent))
        if lost or not moved:
            break
        spent += 1
    return found


def _crosses_early(level, moves):
    schedule = {(v["row"], v["col"]): int(v["at"]) for v in level.get("magma") or []}
    for _action, path, tilts, lost in _replay_tilts(level, moves):
        if lost:
            return False
        for cell in path[1:]:
            at = schedule.get(cell)
            if at is not None and tilts < at:
                return True
    return False


def _stop_edges(level, moves):
    """Edges a tilt ends against. Removing one of these changes that slide."""
    from necessity import replay, DIR_DELTA

    n = level["size"]
    out = set()
    for action, path, _phase in replay(level, moves):
        if not path:
            continue
        r, c = path[-1]
        dr, dc = DIR_DELTA[action]
        nr, nc = r + dr, c + dc
        if not (0 <= nr < n and 0 <= nc < n):
            continue
        if dr == 1:
            out.add(("h", r, c))
        elif dr == -1:
            out.add(("h", nr, c))
        elif dc == 1:
            out.add(("v", r, c))
        else:
            out.add(("v", r, nc))
    return out


def poison(base, target, rng, gallery):
    """Open a wall the par line never uses, then lava-time the shortcut it creates.

    The vent sits on a cell only the short line reaches, and only after that
    line has already spent `at` tilts (`at` >= 2, so the cell starts as floor).
    The original line never steps there, so par stays put. Stripping the vent
    restores the shortcut.
    """
    from tilt_solver import edges_crossed, play

    long = solve(base, max_moves=target)
    if not long or len(long) != target:
        return None
    hole = (base["hole"]["row"], base["hole"]["col"])
    start = (base["ball"]["row"], base["ball"]["col"])
    used = set(edges_crossed(base, long)) | _stop_edges(base, long)
    long_cells = {cell for cell, _tilts in _entries(base, long)}
    walls = [edge for edge in _walls(base) if edge not in used]
    rng.shuffle(walls)
    best = None
    for edge in walls:
        opened = _drop_edge(base, edge)
        if not play(opened, long)[0]:
            continue
        short = solve(opened, max_moves=target - GAP)
        if not short or len(short) > target - GAP:
            continue
        seen = set()
        cands = []
        for cell, tilts in _entries(opened, short):
            if tilts < 2 or cell in (hole, start) or cell in long_cells or cell in seen:
                continue
            seen.add(cell)
            cands.append((cell, tilts))
        rng.shuffle(cands)
        for cell, at in cands[:8]:
            trial = copy.deepcopy(opened)
            # Every shortcut-only cell entered at this same tilt dies together.
            vents = [{"row": cell[0], "col": cell[1], "at": int(at)}]
            for other, otilts in cands:
                if other == cell or otilts != at:
                    continue
                vents.append({"row": other[0], "col": other[1], "at": int(otilts)})
                if len(vents) >= 3:
                    break
            trial["magma"] = vents
            solved = solve(trial, max_moves=target)
            if not solved or len(solved) != target or not magma_ok(trial, solved):
                continue
            if gallery.reject_reason(trial):
                continue
            dead = budget_dead_ends(trial, solved)
            crossed = _crosses_early(trial, solved)
            # Prefer a line that also races a vent, then the trap count.
            rank = (1 if crossed else 0, dead["traps"], dead["deadEnds"], len(vents))
            if best is None or rank > best[0]:
                trial = copy.deepcopy(trial)
                trial["par"] = target
                trial["_deadEnds"] = dead["deadEnds"]
                trial["_traps"] = dead["traps"]
                best = (rank, trial, solved)
    if best is None:
        return None
    return best[1], best[2]


def hunt(n, target, rng, gallery, attempts=24):
    used = set()
    best = None
    for _ in range(attempts):
        found = search_walls(1, n, target, rng, False, used, attempts=60)
        if not found:
            continue
        base, _moves = found
        made = poison(base, target, rng, gallery)
        if not made:
            continue
        level, moves = made
        rank = (level["_traps"], level["_deadEnds"], 1 if _crosses_early(level, moves) else 0)
        if best is None or rank > best[0]:
            best = (rank, level, moves)
    if best is None:
        return None
    return best[1], best[2]


def main():
    rng = random.Random(20261012)
    data = json.loads(LEVELS.read_text(encoding="utf-8"))
    gallery = Gallery()
    for lv in data["levels"]:
        if lv.get("planet") != "lava":
            gallery.add(lv)
    made = []
    for si, (n, target) in enumerate(zip(SIZES, PARS)):
        print(f"lava {si + 1} {n}x{n} par {target}", flush=True)
        if si >= 8:
            made.append(None)
            continue
        slot = None
        for _try in range(3):
            slot = hunt(n, target, rng, gallery, attempts=20 if n >= 7 else 16)
            if slot is not None:
                break
        if slot is None:
            print(f"  FAILED to build lava {si + 1}", flush=True)
            sys.exit(1)
        level, moves = slot
        level["id"] = 97 + si
        level["name"] = f"Lava {si + 1}"
        level["planet"] = "lava"
        level["par"] = len(moves)
        if si < 8:
            gallery.add(level)
        print(
            f"  par {level['par']} traps {level['_traps']} dead {level['_deadEnds']} "
            f"vents {len(level['magma'])} early {_crosses_early(level, moves)}",
            flush=True,
        )
        made.append(level)
    # Stages 9–12 keep a crumbling floor. Start from the shipped wall+collapse
    # layout (already necessary) and retime the vents on a shortcut.
    from necessity import collapse_ok

    shipped = {
        lv["name"]: lv
        for lv in data["levels"]
        if lv.get("planet") == "lava" and lv.get("collapse")
    }
    for si in range(8, 12):
        name = f"Lava {si + 1}"
        base = copy.deepcopy(shipped[name])
        base.pop("magma", None)
        target = PARS[si]
        grafted = None
        for _try in range(6):
            made_poison = poison(base, target, rng, gallery)
            if not made_poison:
                continue
            trial, solved = made_poison
            if collapse_ok(trial, solved) and magma_ok(trial, solved):
                grafted = trial
                break
        if grafted is None:
            print(f"  FAILED collapse retiming on {name}", flush=True)
            sys.exit(1)
        grafted["id"] = 97 + si
        grafted["name"] = name
        grafted["planet"] = "lava"
        grafted["par"] = target
        gallery.add(grafted)
        made[si] = grafted
        print(
            f"  {name} collapse par {grafted['par']} "
            f"traps {grafted.get('_traps')} dead {grafted.get('_deadEnds')} "
            f"vents {len(grafted['magma'])}",
            flush=True,
        )

    fresh = []
    for lv in data["levels"]:
        if lv.get("planet") == "lava":
            continue
        fresh.append(lv)
    # Insert lava back in campaign order (after candy, before jungle).
    out = []
    inserted = False
    for lv in fresh:
        if not inserted and lv.get("planet") == "jungle":
            for made_lv in made:
                clean = {k: v for k, v in made_lv.items() if not k.startswith("_")}
                out.append(clean)
            inserted = True
        out.append(lv)
    if not inserted:
        print("jungle planet missing; cannot splice", flush=True)
        sys.exit(1)
    for i, lv in enumerate(out, start=1):
        lv["id"] = i
    data["version"] = 13
    data["levels"] = out
    LEVELS.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} levels", flush=True)


def graft_collapse(level, target, rng, gallery):
    """Open an unused wall, then crumble a cell the shortcut has to reuse.

    The winning line still crosses that floor exactly once. Without the
    crumble the shortcut is at least GAP tilts shorter.
    """
    from necessity import collapse_ok, replay
    from tilt_solver import edges_crossed, play

    moves = solve(level, max_moves=target)
    if not moves or len(moves) != target:
        return None
    start = (level["ball"]["row"], level["ball"]["col"])
    hole = (level["hole"]["row"], level["hole"]["col"])
    magma = {(v["row"], v["col"]) for v in level.get("magma") or []}
    used = set(edges_crossed(level, moves)) | _stop_edges(level, moves)
    long_flat = []
    for _action, path, _phase in replay(level, moves):
        long_flat.extend(path)
    long_count = {}
    for cell in long_flat:
        long_count[cell] = long_count.get(cell, 0) + 1
    once = {
        cell for cell, n in long_count.items()
        if n == 1 and cell not in (start, hole) and cell not in magma and cell != long_flat[-1]
    }
    walls = [edge for edge in _walls(level) if edge not in used]
    rng.shuffle(walls)
    best = None
    for edge in walls:
        opened = _drop_edge(level, edge)
        if not play(opened, moves)[0]:
            continue
        short = solve(opened, max_moves=target - GAP)
        if not short or len(short) > target - GAP:
            continue
        tally = {}
        repeats = []
        for _action, path, _phase in replay(opened, short):
            for cell in path:
                tally[cell] = tally.get(cell, 0) + 1
                if tally[cell] == 2 and cell in once:
                    repeats.append(cell)
        rng.shuffle(repeats)
        for cell in repeats[:5]:
            trial = _drop_edge(level, edge)
            trial["collapse"] = [{"row": cell[0], "col": cell[1]}]
            solved = solve(trial, max_moves=target)
            if not solved or len(solved) != target:
                continue
            if not collapse_ok(trial, solved) or not magma_ok(trial, solved):
                continue
            if gallery.reject_reason(trial):
                continue
            dead = budget_dead_ends(trial, solved)
            rank = (dead["traps"], dead["deadEnds"])
            if best is None or rank > best[0]:
                trial = copy.deepcopy(trial)
                trial["par"] = target
                trial["_traps"] = dead["traps"]
                trial["_deadEnds"] = dead["deadEnds"]
                best = (rank, trial)
    if best is None:
        return None
    return best[1]


if __name__ == "__main__":
    main()
