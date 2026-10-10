"""Construct and hunt stages whose featured mechanic is the trick.

Constructors seal a wing behind a stop the walls cannot make (sand, ice),
or behind a cut (teleport, glass, gates). Hunters search ordinary mazes for
one-ways, coins, smog, collapse, and moving walls. Every acceptance goes
through tools/necessity.py.
"""

import copy
import random

from generate_edge_levels import search_gate, search_glass, search_walls, seals
from necessity import (
    all_necessary,
    ahead_open,
    edge_of,
    interestingness,
    mechanic_names,
    par_moves,
    replay,
    shortest_visits,
    step_dir,
    wall_lookup,
)
from tilt_solver import solve

DIR_DELTA = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
OPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}


def _walls(level):
    h = {(e["row"], e["col"]) for e in level.get("hWalls") or []}
    v = {(e["row"], e["col"]) for e in level.get("vWalls") or []}
    return h, v


def _has(level, axis, r, c):
    h, v = _walls(level)
    return (r, c) in (h if axis == "h" else v)


def _add(level, axis, r, c):
    if _has(level, axis, r, c):
        return False
    n = level["size"]
    h, v = _walls(level)
    if seals(n, h, v, (axis, r, c)):
        return False
    key = "hWalls" if axis == "h" else "vWalls"
    level.setdefault(key, []).append({"row": r, "col": c})
    return True


def _drop(level, axis, r, c):
    key = "hWalls" if axis == "h" else "vWalls"
    level[key] = [e for e in level.get(key) or [] if (e["row"], e["col"]) != (r, c)]


def _open_edges(level, forbid):
    n = level["size"]
    h, v = _walls(level)
    out = []
    for r in range(n - 1):
        for c in range(n):
            if ("h", r, c) not in forbid and (r, c) not in h:
                out.append(("h", r, c))
    for r in range(n):
        for c in range(n - 1):
            if ("v", r, c) not in forbid and (r, c) not in v:
                out.append(("v", r, c))
    return out


def tune(level, target, rng, locked, forbid, rounds=90):
    """Add and remove solid walls until BFS par equals target. Sand/ice/etc. stay."""
    level = copy.deepcopy(level)
    locked = set(locked)
    forbid = set(forbid) | locked

    def removable():
        found = []
        for axis, key in (("h", "hWalls"), ("v", "vWalls")):
            for edge in level.get(key) or []:
                item = (axis, edge["row"], edge["col"])
                if item not in locked:
                    found.append(item)
        return found

    for _ in range(rounds):
        moves = solve(level, max_moves=max(target, 4) + 6)
        if moves is not None and len(moves) == target:
            level["par"] = target
            return level, moves
        if moves is None or len(moves) > target:
            opts = removable()
            rng.shuffle(opts)
            best = None
            for edge in opts[:16]:
                _drop(level, *edge)
                trial = solve(level, max_moves=target + 6)
                _add(level, *edge)
                if trial is not None and (best is None or len(trial) < best[0]):
                    best = (len(trial), edge)
                    if len(trial) == target:
                        break
            if best is None:
                if not opts:
                    return None
                _drop(level, *opts[0])
                continue
            _drop(level, *best[1])
            continue
        crossed = []
        seen = set()
        for action, path, _phase in replay(level, moves):
            for a, b in zip(path, path[1:]):
                edge = edge_of(a, b)
                if edge and edge not in seen and edge not in forbid:
                    seen.add(edge)
                    crossed.append(edge)
        rng.shuffle(crossed)
        placed = False
        for edge in crossed[:14]:
            if not _add(level, *edge):
                continue
            trial = solve(level, max_moves=target + 4)
            if trial is not None and len(moves) < len(trial) <= target:
                placed = True
                break
            _drop(level, *edge)
        if not placed:
            return None
    return None


def _blank(n, ball, hole):
    return {
        "id": 0,
        "name": "",
        "size": n,
        "hWalls": [],
        "vWalls": [],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
        "par": 0,
    }


def _finish(level, moves, gallery):
    if not moves or not all_necessary(level, moves):
        return None
    if gallery is not None and gallery.reject_reason(level):
        return None
    level = copy.deepcopy(level)
    level["par"] = len(moves)
    return level, moves


def build_stop(n, target, rng, kind, gallery=None, attempts=50):
    """Sand or ice: a wing whose only door is a stop walls cannot make.

    The corridor is open past the stop, so a solid wall cannot end the tilt
    on that square. Removing the mechanic lets the ball slide through, and the
    wing becomes unreachable (or the par jumps by at least 3).
    """
    if kind not in ("sand", "ice"):
        raise ValueError(kind)
    for _ in range(attempts):
        if n < 3:
            return None
        # One row of wing above the corridor and one row of approach below it.
        row = rng.randint(1, n - 2)
        if kind == "sand":
            col = rng.randint(0, n - 1)
            options = []
            if col + 1 < n:
                options.append(col + 1)
            if col - 1 >= 0:
                options.append(col - 1)
            if not options:
                continue
            turn = col
            travel_next = rng.choice(options)
        else:
            # Travel to the right: ice at `col`, stop on col+1, one open cell beyond.
            if n < 3:
                continue
            col = rng.randint(0, n - 3)
            turn = col + 1
            travel_next = col + 2
        entrance = rng.choice([c for c in range(n) if c != turn])
        wing = [(r, c) for r in range(row) for c in range(n)]
        approach = [(r, c) for r in range(row + 1, n) for c in range(n)]
        hole = rng.choice(wing)
        ball = rng.choice(approach)
        if abs(ball[0] - hole[0]) + abs(ball[1] - hole[1]) < 3:
            continue
        if (row, turn) in (ball, hole):
            continue
        level = _blank(n, ball, hole)
        locked = []
        for c in range(n):
            if c != turn:
                if _add(level, "h", row - 1, c):
                    locked.append(("h", row - 1, c))
            if c != entrance:
                if _add(level, "h", row, c):
                    locked.append(("h", row, c))
        forbid = set(locked)
        for c in range(n - 1):
            forbid.add(("v", row, c))
        # The wing door and the corridor entrance must stay open, and the
        # square past the stop must not grow a wall.
        forbid.add(("h", row - 1, turn))
        forbid.add(("h", row, entrance))
        if 0 <= min(turn, travel_next) < n - 1:
            forbid.add(("v", row, min(turn, travel_next)))
        if kind == "sand":
            level["sand"] = [{"row": row, "col": turn}]
        else:
            level["ice"] = [{"row": row, "col": col}]
        tuned = tune(level, target, rng, locked, forbid)
        if not tuned:
            continue
        level, moves = tuned
        # The stop cell's onward square has to stay open.
        direction = "right" if travel_next > turn else "left"
        if kind == "sand":
            if not ahead_open(level, (row, turn), direction):
                continue
        else:
            if not ahead_open(level, (row, turn), "right"):
                continue
        made = _finish(level, moves, gallery)
        if made:
            return made
    return None


def build_cut(n, target, rng, kind, gallery=None, attempts=40):
    """A full horizontal cut. The only crossing is a teleport, a glass gap, or a gate."""
    for _ in range(attempts):
        cut = rng.randint(1, n - 2)
        gap = rng.randrange(n)
        above = [(r, c) for r in range(cut + 1) for c in range(n)]
        below = [(r, c) for r in range(cut + 1, n) for c in range(n)]
        if rng.random() < 0.5:
            above, below = below, above
        ball = rng.choice(above)
        hole = rng.choice(below)
        level = _blank(n, ball, hole)
        locked = []
        for c in range(n):
            if c == gap and kind != "teleport":
                continue
            if _add(level, "h", cut, c):
                locked.append(("h", cut, c))
        forbid = set(locked)
        if kind == "teleport":
            # The cut is solid. Pads sit one on each side, not on the ball or hole.
            side_a = [cell for cell in above if cell != ball]
            side_b = [cell for cell in below if cell != hole]
            if not side_a or not side_b:
                continue
            a = rng.choice(side_a)
            b = rng.choice(side_b)
            level["teleports"] = [{"a": {"row": a[0], "col": a[1]}, "b": {"row": b[0], "col": b[1]}}]
        elif kind == "glass":
            level["glassH"] = [{"row": cut, "col": gap}]
            forbid.add(("h", cut, gap))
        elif kind == "gates":
            level["coloredH"] = [{"row": cut, "col": gap, "color": "red"}]
            forbid.add(("h", cut, gap))
            pocket = _button_pocket(level, above, ball, hole, rng, forbid_edges={("h", cut, gap)})
            if pocket is None:
                continue
            button, extra_locked = pocket
            level["buttons"] = [{"row": button[0], "col": button[1], "color": "red"}]
            locked.extend(extra_locked)
            forbid.update(extra_locked)
        else:
            raise ValueError(kind)
        tuned = tune(level, target, rng, locked, forbid)
        if not tuned:
            continue
        level, moves = tuned
        made = _finish(level, moves, gallery)
        if made:
            return made
    return None


def _button_pocket(level, region, ball, hole, rng, forbid_edges=()):
    """Wall a side cell so the button is a detour, not a square you already cross."""
    n = level["size"]
    candidates = [cell for cell in region if cell not in (ball, hole)]
    rng.shuffle(candidates)
    for cell in candidates[:8]:
        r, c = cell
        # Three sides walled, one side left open toward the region.
        sides = []
        if r > 0:
            sides.append(("h", r - 1, c))
        if r < n - 1:
            sides.append(("h", r, c))
        if c > 0:
            sides.append(("v", r, c - 1))
        if c < n - 1:
            sides.append(("v", r, c))
        if len(sides) < 3:
            continue
        forbidden = set(forbid_edges)
        if any(edge in forbidden for edge in sides) and all(edge in forbidden or _has(level, *edge) for edge in sides):
            continue
        sides = [edge for edge in sides if edge not in forbidden]
        if len(sides) < 2:
            continue
        rng.shuffle(sides)
        added = []
        fresh = []
        ok = True
        for edge in sides[1:]:
            if _has(level, *edge):
                added.append(edge)
                continue
            if not _add(level, *edge):
                ok = False
                break
            added.append(edge)
            fresh.append(edge)
        if not ok:
            for edge in fresh:
                _drop(level, *edge)
            continue
        return cell, added
    return None


def hunt_oneway(donors, rng, lo, hi, gallery, attempts=24):
    pool = list(donors)
    rng.shuffle(pool)
    best = None
    best_score = -1
    for base in pool[:attempts]:
        if base["size"] < 3:
            continue
        h, v = wall_lookup(base)
        n = base["size"]
        edges = [("h", r, c) for r in range(n - 1) for c in range(n) if (r, c) not in h]
        edges += [("v", r, c) for r in range(n) for c in range(n - 1) if (r, c) not in v]
        rng.shuffle(edges)
        for edge in edges[:24]:
            for allow in ("up", "down") if edge[0] == "h" else ("left", "right"):
                trial = copy.deepcopy(base)
                trial["oneWay"] = [{"axis": edge[0], "row": edge[1], "col": edge[2], "dir": allow}]
                solved = solve(trial, max_moves=hi + 8)
                if not solved or not (lo <= len(solved) <= hi):
                    continue
                trial["par"] = len(solved)
                made = _finish(trial, solved, gallery)
                if not made:
                    continue
                score = interestingness(made[0], made[1])
                if score > best_score:
                    best, best_score = made, score
    return best


def hunt_from_walls(donors, rng, target, kind, gallery, attempts=20):
    pool = list(donors)
    rng.shuffle(pool)
    best = None
    best_score = -1
    for base in pool[:attempts]:
        if base.get("sand") or base.get("ice") or base.get("oneWay"):
            continue
        if kind == "smog":
            made = _try_smog(base, target)
        elif kind == "coins":
            made = _try_coins(base, rng, target)
        elif kind == "collapse":
            made = _try_collapse(base, rng, target, target)
        elif kind == "movers":
            made = _try_movers(base, rng, target, target)
        else:
            made = None
        if not made:
            continue
        level, moves = made
        if gallery is not None and gallery.reject_reason(level):
            continue
        score = interestingness(level, moves)
        if score > best_score:
            best, best_score = made, score
    return best


def _try_smog(base, target):
    moves = solve(base, max_moves=target + 6)
    if not moves or len(moves) != target:
        return None
    start = (base["ball"]["row"], base["ball"]["col"])
    flat = []
    for _action, path, _phase in replay(base, moves):
        flat.extend(path)
    visited = set(flat)
    h, v = wall_lookup(base)
    for axis, bag in (("h", h), ("v", v)):
        for r, c in list(bag):
            trial = copy.deepcopy(base)
            _drop(trial, axis, r, c)
            other = solve(trial, max_moves=target)
            if other is None or len(other) > target - 2:
                continue
            touched = []
            if axis == "h":
                touched = [(r, c), (r + 1, c)]
            else:
                touched = [(r, c), (r, c + 1)]
            smog = [cell for cell in touched if cell in visited and cell != start]
            if not smog:
                continue
            # Cover the concealed corner with the cells the line actually enters.
            extra = [cell for cell in touched if cell != start]
            chosen = smog or extra
            if not any(cell != start for cell in chosen):
                continue
            made = copy.deepcopy(base)
            made["smog"] = [{"row": rr, "col": cc} for rr, cc in chosen[:3]]
            made["par"] = target
            if _finish(made, moves, None):
                return made, moves
    return None


def _open_a_branch(base, target):
    """Drop one wall when that keeps par and creates a second shortest route."""
    paths = shortest_visits(base, limit=4, cap=target)
    if len(paths) >= 2:
        return base
    h, v = wall_lookup(base)
    edges = [("h", r, c) for r, c in h] + [("v", r, c) for r, c in v]
    for edge in edges:
        trial = copy.deepcopy(base)
        _drop(trial, *edge)
        solved = solve(trial, max_moves=target)
        if not solved or len(solved) != target:
            continue
        if len(shortest_visits(trial, limit=4, cap=target)) >= 2:
            trial["par"] = target
            return trial
    return None


def _try_coins(base, rng, target):
    branched = _open_a_branch(base, target)
    if branched is None:
        return None
    base = branched
    moves = solve(base, max_moves=target + 4)
    if not moves or len(moves) != target:
        return None
    paths = shortest_visits(base, limit=8, cap=target)
    if len(paths) < 2:
        return None
    start = (base["ball"]["row"], base["ball"]["col"])
    hole = (base["hole"]["row"], base["hole"]["col"])
    counts = {}
    for cells in paths:
        for cell in cells:
            if cell in (start, hole):
                continue
            counts[cell] = counts.get(cell, 0) + 1
    partial = [cell for cell, count in counts.items() if 0 < count < len(paths)]
    if not partial:
        return None
    rng.shuffle(partial)
    # One coin on the branch, and if possible a second that the same minority path picks up.
    chosen = partial[:1]
    for cell in partial[1:]:
        together = [cells for cells in paths if chosen[0] in cells and cell in cells]
        missed = [cells for cells in paths if chosen[0] not in cells or cell not in cells]
        if together and missed:
            chosen.append(cell)
            break
    made = copy.deepcopy(base)
    made["coins"] = [{"row": r, "col": c} for r, c in chosen]
    made["par"] = target
    solved = solve(made, max_moves=target)
    if not solved or len(solved) != target:
        return None
    if _finish(made, solved, None):
        return made, solved
    return None


def _try_collapse(base, rng, lo, hi):
    bare = solve(base, max_moves=max(hi, 8) + 6)
    if not bare:
        return None
    n = base["size"]
    start = (base["ball"]["row"], base["ball"]["col"])
    hole = (base["hole"]["row"], base["hole"]["col"])
    cells = [(r, c) for r in range(n) for c in range(n) if (r, c) not in (start, hole)]
    rng.shuffle(cells)
    for cell in cells:
        trial = copy.deepcopy(base)
        trial["collapse"] = [{"row": cell[0], "col": cell[1]}]
        solved = solve(trial, max_moves=hi + 4)
        if not solved or not (lo <= len(solved) <= hi):
            continue
        if abs(len(solved) - len(bare)) < 3:
            continue
        trial["par"] = len(solved)
        if _finish(trial, solved, None):
            return trial, solved
    return None


def _try_movers(base, rng, lo, hi):
    moves = solve(base, max_moves=hi + 4)
    if not moves:
        return None
    n = base["size"]
    h, v = wall_lookup(base)
    opens = [("h", r, c) for r in range(n - 1) for c in range(n) if (r, c) not in h]
    opens += [("v", r, c) for r in range(n) for c in range(n - 1) if (r, c) not in v]
    crossings = []
    for _action, path, _phase in replay(base, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge:
                crossings.append(edge)
    rng.shuffle(crossings)
    rng.shuffle(opens)
    for home in crossings[:8]:
        for alt in opens[:5]:
            if alt == home:
                continue
            trial = copy.deepcopy(base)
            trial["shifters"] = [{
                "home": {"axis": home[0], "row": home[1], "col": home[2]},
                "alt": {"axis": alt[0], "row": alt[1], "col": alt[2]},
            }]
            solved = solve(trial, max_moves=hi + 6)
            if not solved or not (lo <= len(solved) <= hi):
                continue
            if abs(len(solved) - len(moves)) < 3:
                continue
            trial["par"] = len(solved)
            if _finish(trial, solved, None):
                return trial, solved
    return None


def fresh_wall(n, target, rng, used, attempts=None):
    for strict in (True, False):
        found = search_walls(1, n, target, rng, strict, used, attempts=attempts)
        if found:
            level, _moves = found
            return copy.deepcopy(level)
    return None


def build_jelly(n, target, rng, gallery=None, attempts=36):
    """A wing whose only door is a jelly jump, or a failed jump that stops the ball.

    On n >= 4 the ball rolls into jelly and jumps a locked wall, landing on the
    wing door. On 3x3 there is no room for a side-entry jump that stays on the
    board, so the cushion is a stop: the landing cell is off the board while
    the next cell is open, which a wall cannot do.
    """
    if n < 3:
        return None
    for _ in range(attempts):
        if n == 3:
            made = _jelly_stop(n, target, rng, gallery)
        else:
            made = _jelly_jump(n, target, rng, gallery)
        if made:
            return made
    return None


def _jelly_jump(n, target, rng, gallery):
    row = rng.randint(1, n - 2)
    direction = rng.choice(("right", "left"))
    if direction == "right":
        if n < 4:
            return None
        jelly_c = rng.randint(1, n - 3)
        land_c = jelly_c + 2
        wall = ("v", row, jelly_c)
        incoming = list(range(0, jelly_c))
    else:
        if n < 4:
            return None
        jelly_c = rng.randint(2, n - 2)
        land_c = jelly_c - 2
        wall = ("v", row, jelly_c - 1)
        incoming = list(range(jelly_c + 1, n))
    if not incoming:
        return None
    entrance = rng.choice(incoming)
    wing = [(r, c) for r in range(row) for c in range(n)]
    approach = [(r, c) for r in range(row + 1, n) for c in range(n)]
    if not wing or not approach:
        return None
    hole = rng.choice([cell for cell in wing if cell != (row - 1 if False else (row, land_c))])
    ball_cells = [cell for cell in approach if cell != (row, jelly_c)]
    if not ball_cells:
        return None
    ball = rng.choice(ball_cells)
    if abs(ball[0] - hole[0]) + abs(ball[1] - hole[1]) < 2:
        return None
    level = _blank(n, ball, hole)
    locked = []
    for c in range(n):
        if c != land_c and _add(level, "h", row - 1, c):
            locked.append(("h", row - 1, c))
        if c != entrance and _add(level, "h", row, c):
            locked.append(("h", row, c))
    if not _add(level, *wall):
        return None
    locked.append(wall)
    forbid = set(locked)
    for c in range(n - 1):
        forbid.add(("v", row, c))
    forbid.add(("h", row - 1, land_c))
    forbid.add(("h", row, entrance))
    level["jelly"] = [{"row": row, "col": jelly_c}]
    lo = max(3, target - 4)
    hi = target + 2
    tuned = tune(level, target, rng, locked, forbid, rounds=30)
    if tuned and lo <= len(tuned[1]) <= hi:
        made = _finish(tuned[0], tuned[1], gallery)
        if made:
            return made
    solved = solve(level, max_moves=hi + 6)
    if solved and lo <= len(solved) <= hi:
        return _finish(level, solved, gallery)
    return None


def _jelly_stop(n, target, rng, gallery):
    """Failed jump used as a stop. The next cell is open and the landing cell is off the board.

    Same wing seal as sand: you can end a tilt on the cushion only because the
    jump fails. Sliding without jelly runs through that square.
    """
    row = rng.randint(1, n - 2)
    # Landing +2 must leave the board; the skipped cell must stay on it.
    candidates = []
    for col in range(n):
        for dc in (-1, 1):
            nxt = col + dc
            land = col + dc * 2
            if 0 <= nxt < n and not (0 <= land < n):
                candidates.append((col, nxt))
    if not candidates:
        return None
    turn, travel_next = rng.choice(candidates)
    entrance = rng.choice([c for c in range(n) if c != turn])
    wing = [(r, c) for r in range(row) for c in range(n)]
    approach = [(r, c) for r in range(row + 1, n) for c in range(n)]
    if not wing or not approach:
        return None
    hole = rng.choice(wing)
    ball = rng.choice(approach)
    if (row, turn) in (ball, hole):
        return None
    level = _blank(n, ball, hole)
    locked = []
    for c in range(n):
        if c != turn and _add(level, "h", row - 1, c):
            locked.append(("h", row - 1, c))
        if c != entrance and _add(level, "h", row, c):
            locked.append(("h", row, c))
    forbid = set(locked)
    for c in range(n - 1):
        forbid.add(("v", row, c))
    forbid.add(("h", row - 1, turn))
    forbid.add(("h", row, entrance))
    if 0 <= min(turn, travel_next) < n - 1:
        forbid.add(("v", row, min(turn, travel_next)))
    level["jelly"] = [{"row": row, "col": turn}]
    tuned = tune(level, target, rng, locked, forbid, rounds=40)
    if not tuned:
        solved = solve(level, max_moves=max(target, 4) + 6)
        if not solved or abs(len(solved) - target) > 2:
            return None
        tuned = (level, solved)
    level, moves = tuned
    direction = "right" if travel_next > turn else "left"
    if not ahead_open(level, (row, turn), direction):
        return None
    return _finish(level, moves, gallery)


def magma_from_maze(n, target, rng, gallery=None, attempts=8):
    """Mark a cell on the first tilt of a real maze as magma at=1.

    The opening slide still crosses it. Closing the vent from the start
    (at=0) removes that line. Par stays near the maze, so large boards do
    not collapse into a two-move bridge.
    """
    used = set()
    attempts_wall = 180 if n <= 5 else 260
    for _ in range(attempts):
        aim = max(4, target + rng.choice((0, -1, 1, -2, 2)))
        base = fresh_wall(n, aim, rng, used, attempts=attempts_wall)
        if not base:
            continue
        moves = solve(base, max_moves=aim + 3)
        if not moves:
            continue
        parts = replay(base, moves)
        if not parts:
            continue
        hole = (base["hole"]["row"], base["hole"]["col"])
        cells = [cell for cell in parts[0][1][1:] if cell != hole]
        rng.shuffle(cells)
        for cell in cells[:6]:
            trial = copy.deepcopy(base)
            trial["magma"] = [{"row": cell[0], "col": cell[1], "at": 1}]
            solved = solve(trial, max_moves=aim + 4)
            if not solved or abs(len(solved) - len(moves)) > 2:
                continue
            made = _finish(trial, solved, gallery)
            if made:
                return made
    return None


def build_magma(n, target, rng, gallery=None, attempts=28):
    """A bridge cell the first tilt must cross. It erupts once that tilt is spent.

    The ball starts on the open column, so the crossing is tilt 1 while
    `at` is still 1 (the cell is only telegraphed). Afterward the wing is
    sealed behind crust. Forcing at=0 removes that only door. Setup tilts
    before the crossing would close it too soon, so the approach stays aimed
    at the gap and tune only lengthens the wing.
    """
    if n < 3:
        return None
    for _ in range(attempts):
        bridge = rng.randint(1, n - 2)
        gap = rng.randrange(n)
        wing = [(r, c) for r in range(bridge) for c in range(n) if c != gap]
        if not wing:
            continue
        hole = rng.choice(wing)
        # Sit on the gap column, one row below the bridge, so tilt 1 can enter.
        ball = (bridge + 1, gap)
        if ball[0] >= n or ball == hole:
            continue
        level = _blank(n, ball, hole)
        locked = []
        for c in range(n):
            if c == gap:
                continue
            if _add(level, "h", bridge - 1, c):
                locked.append(("h", bridge - 1, c))
            if _add(level, "h", bridge, c):
                locked.append(("h", bridge, c))
        forbid = set(locked)
        forbid.add(("h", bridge - 1, gap))
        forbid.add(("h", bridge, gap))
        # Keep the approach column open so the first slide is the crossing.
        for r in range(bridge, n - 1):
            forbid.add(("h", r, gap))
        level["magma"] = [{"row": bridge, "col": gap, "at": 1}]
        lo = max(3 if n > 3 else 2, target - 6)
        hi = target + 2
        tuned = tune(level, target, rng, locked, forbid, rounds=24)
        if tuned and lo <= len(tuned[1]) <= hi:
            made = _finish(tuned[0], tuned[1], gallery)
            if made:
                return made
        solved = solve(level, max_moves=hi + 6)
        if solved and lo <= len(solved) <= hi:
            made = _finish(level, solved, gallery)
            if made:
                return made
    return None


def hunt_glass(n, target, rng, used, gallery, attempts=8):
    made = build_cut(n, target, rng, "glass", gallery, attempts=30)
    if made:
        return made
    for panes in (1, 2):
        level = search_glass(1, n, target, panes, rng, False, used)
        if not level:
            continue
        moves = solve(level, max_moves=target + 4)
        if moves and len(moves) == target:
            made = _finish(level, moves, gallery)
            if made:
                return made
    return None


def hunt_gates(n, target, rng, used, gallery, attempts=8):
    made = build_cut(n, target, rng, "gates", gallery, attempts=48)
    if made:
        return made
    colors = ["red"]
    level = search_gate(1, n, target, colors, rng, False, used)
    if not level:
        return None
    moves = solve(level, max_moves=target + 6)
    if moves and len(moves) == target:
        return _finish(level, moves, gallery)
    return None


def layer(base, kind, rng, gallery, slack=2):
    """Add `kind` onto a board that already has a necessary mechanic.

    The result must keep every mechanic necessary, including the new one,
    and the par may move by at most `slack`.
    """
    target = base["par"]
    n = base["size"]
    if kind in ("sand", "ice", "teleport", "glass", "gates"):
        # Rebuild is safer than decorating a finished trick. Callers that
        # want a mix of two structural mechanics use build_mix.
        return None
    donors = [base]
    # Allow the layered par to land on target, target+1, or target-1.
    for aim in (target, min(40, target + 1), max(4, target - 1)):
        made = hunt_from_walls(donors, rng, aim, kind, None, attempts=1)
        if not made:
            continue
        level, moves = made
        if abs(len(moves) - target) > slack:
            continue
        if not all_necessary(level, moves):
            continue
        if gallery is not None and gallery.reject_reason(level):
            continue
        return level, moves
    # Coins and smog can be dropped onto the existing solution in place.
    if kind == "smog":
        made = _try_smog(base, target)
        if made and all_necessary(made[0], made[1]) and not (gallery and gallery.reject_reason(made[0])):
            return made
    if kind == "coins":
        made = _try_coins(base, rng, target)
        if made and all_necessary(made[0], made[1]) and not (gallery and gallery.reject_reason(made[0])):
            return made
    if kind == "collapse":
        made = _try_collapse(base, rng, max(4, target - slack), target + slack)
        if made and all_necessary(made[0], made[1]) and not (gallery and gallery.reject_reason(made[0])):
            return made
    if kind == "movers":
        made = _try_movers(base, rng, max(4, target - slack), target + slack)
        if made and all_necessary(made[0], made[1]) and not (gallery and gallery.reject_reason(made[0])):
            return made
    if kind == "oneway":
        made = hunt_oneway([base], rng, max(4, target - slack), target + slack, gallery, attempts=1)
        if made and all_necessary(made[0], made[1]):
            return made
    return None


def build_mix(kinds, n, target, rng, gallery, donors):
    """A board where each named mechanic passes its own necessity check."""
    kinds = list(kinds)
    structural = [k for k in kinds if k in ("sand", "ice", "teleport", "glass", "gates", "oneway", "collapse", "movers")]
    soft = [k for k in kinds if k in ("smog", "coins")]
    primary = structural[0] if structural else soft[0]
    made = _make_one(primary, n, target, rng, gallery, donors)
    if not made:
        return None
    level, moves = made
    for kind in kinds:
        if kind == primary:
            continue
        # Try an in-place layer. Gallery is checked at the end so a rejected
        # intermediate does not poison the search.
        layered = _layer_unchecked(level, kind, rng)
        if not layered:
            return None
        level, moves = layered
    if not all_necessary(level, moves):
        return None
    if gallery is not None and gallery.reject_reason(level):
        return None
    level["par"] = len(moves)
    return level, moves


def _layer_unchecked(level, kind, rng):
    target = level["par"]
    if kind == "smog":
        made = _try_smog(level, target)
    elif kind == "coins":
        made = _try_coins(level, rng, target)
    elif kind == "collapse":
        made = _try_collapse(level, rng, max(4, target - 1), target + 2)
    elif kind == "movers":
        made = _try_movers(level, rng, max(4, target - 1), target + 2)
    elif kind == "oneway":
        made = hunt_oneway([level], rng, max(4, target - 1), target + 2, None, attempts=1)
    elif kind == "glass":
        made = _add_glass(level, rng, target)
    elif kind == "gates":
        made = None
    elif kind in ("sand", "ice", "teleport"):
        made = None
    else:
        made = None
    if not made:
        return None
    if not all_necessary(made[0], made[1]):
        return None
    return made


def _occupied_edges(level):
    taken = set()
    for key, axis in (
        ("hWalls", "h"), ("vWalls", "v"),
        ("glassH", "h"), ("glassV", "v"),
        ("coloredH", "h"), ("coloredV", "v"),
    ):
        for edge in level.get(key) or []:
            taken.add((axis, edge["row"], edge["col"]))
    for edge in level.get("oneWay") or []:
        taken.add((edge["axis"], edge["row"], edge["col"]))
    for shifter in level.get("shifters") or []:
        for spot in (shifter["home"], shifter["alt"]):
            taken.add((spot["axis"], spot["row"], spot["col"]))
    return taken


def _add_glass(level, rng, target):
    moves = solve(level, max_moves=target + 4)
    if not moves:
        return None
    taken = _occupied_edges(level)
    edges = []
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge and edge not in taken:
                edges.append(edge)
    rng.shuffle(edges)
    for edge in edges[:8]:
        trial = copy.deepcopy(level)
        key = "glassH" if edge[0] == "h" else "glassV"
        trial.setdefault(key, []).append({"row": edge[1], "col": edge[2]})
        for aim in (target, target + 1, target + 2):
            solved = solve(trial, max_moves=aim + 2)
            if solved and len(solved) == aim and _finish(trial, solved, None):
                trial["par"] = aim
                return trial, solved
    return None


def _seek_window(donors, rng, lo, hi, kind, gallery):
    pool = list(donors)
    rng.shuffle(pool)
    best = None
    best_score = -1
    for base in pool[:16]:
        if kind == "collapse":
            made = _try_collapse(base, rng, lo, hi)
        else:
            made = _try_movers(base, rng, lo, hi)
        if not made:
            continue
        if gallery is not None and gallery.reject_reason(made[0]):
            continue
        score = interestingness(made[0], made[1])
        if score > best_score:
            best, best_score = made, score
    return best


def _make_one(kind, n, target, rng, gallery, donors):
    used = set()
    if kind == "sand":
        return build_stop(n, target, rng, "sand", gallery)
    if kind == "ice":
        return build_stop(n, target, rng, "ice", gallery)
    if kind == "teleport":
        return build_cut(n, target, rng, "teleport", gallery)
    if kind == "glass":
        return hunt_glass(n, target, rng, used, gallery)
    if kind == "gates":
        return hunt_gates(n, target, rng, used, gallery)
    if kind == "oneway":
        return hunt_oneway(donors, rng, target, target, gallery)
    if kind == "collapse":
        return _seek_window(donors, rng, target, target, "collapse", gallery)
    if kind == "movers":
        return _seek_window(donors, rng, target, target, "movers", gallery)
    if kind in ("smog", "coins"):
        return hunt_from_walls(donors, rng, target, kind, gallery)
    if kind == "jelly":
        return build_jelly(n, target, rng, gallery)
    if kind == "magma":
        return build_magma(n, target, rng, gallery)
    return None
