"""Hard campaign boards: long corridors, fatal side traps, necessary gadgets.

Par comes from tools/tilt_solver.py. A featured mechanic has to pass
tools/necessity.py. Dead ends are budget traps from necessity.budget_dead_ends:
states you can reach and still not finish before the par+3 fail limit.
"""

import copy
import random

from necessity import (
    all_necessary,
    budget_dead_ends,
    edge_of,
    mechanic_names,
    replay,
)
from tilt_solver import solve

DIRS = ((-1, 0), (1, 0), (0, -1), (0, 1))
DIR_NAME = {(-1, 0): "up", (1, 0): "down", (0, -1): "left", (0, 1): "right"}
NAME_DELTA = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}


def _runs(path):
    if len(path) < 2:
        return 0
    count = 1
    prev = (path[1][0] - path[0][0], path[1][1] - path[0][1])
    for i in range(2, len(path)):
        step = (path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
        if step != prev:
            count += 1
            prev = step
    return count


def _path_moves(path):
    if len(path) < 2:
        return []
    prev = DIR_NAME[(path[1][0] - path[0][0], path[1][1] - path[0][1])]
    out = []
    for i in range(2, len(path)):
        step = (path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
        name = DIR_NAME[step]
        if name != prev:
            out.append(prev)
            prev = name
    out.append(prev)
    return out


def _fill(cells, rng, want_runs, trials=250):
    """Hamilton path on `cells` whose slide-run count is near `want_runs`."""
    cells = list(cells)
    if len(cells) < 2:
        return None
    cellset = set(cells)
    best = None
    best_key = None
    for _ in range(trials):
        start = cells[rng.randrange(len(cells))]
        path = [start]
        seen = {start}
        last = None
        while len(path) < len(cells):
            r, c = path[-1]
            opts = []
            run_len = 1
            if len(path) >= 2 and last is not None:
                i = len(path) - 1
                while i > 0 and (
                    path[i][0] - path[i - 1][0],
                    path[i][1] - path[i - 1][1],
                ) == last:
                    run_len += 1
                    i -= 1
            for dr, dc in DIRS:
                nr, nc = r + dr, c + dc
                nxt = (nr, nc)
                if nxt not in cellset or nxt in seen:
                    continue
                exits = 0
                for adr, adc in DIRS:
                    probe = (nr + adr, nc + adc)
                    if probe in cellset and probe not in seen:
                        exits += 1
                straight = 1 if last == (dr, dc) else 0
                opts.append((exits, straight, rng.random(), (dr, dc), nxt))
            if not opts:
                break
            runs_now = _runs(path)
            left = len(cells) - len(path)
            # Spend turns while the remaining cells can still finish the quota.
            need_turns = 0 if want_runs is None else max(0, want_runs - max(runs_now, 1))
            if want_runs is None or (need_turns > 0 and left <= need_turns + 1):
                opts.sort(key=lambda item: (item[0], item[1], item[2]))
            elif need_turns <= 0:
                opts.sort(key=lambda item: (-item[1], item[0], item[2]))
            else:
                ideal = max(1, left // max(1, need_turns))
                if run_len < ideal:
                    opts.sort(key=lambda item: (-item[1], item[0], item[2]))
                else:
                    opts.sort(key=lambda item: (item[0], item[1], item[2]))
            pick = opts[0]
            last = pick[3]
            path.append(pick[4])
            seen.add(pick[4])
        if len(path) != len(cells):
            continue
        runs = _runs(path)
        key = abs(runs - want_runs) if want_runs is not None else -runs
        if best_key is None or key < best_key:
            best_key = key
            best = path
            if want_runs is not None and runs == want_runs:
                break
    return best


def _split(n, trap_n):
    """Corner trap that can turn, plus the connected complement as the solution.

    A straight row never turns, so a one-tilt slide escapes it and it is not a
    budget dead end. Rectangles and L shapes force a second tilt.
    """
    trap_n = max(3, min(trap_n, n * n - 4))
    best = None
    for height in range(2, n):
        for width in range(2, n):
            area = height * width
            if n * n - area < 4:
                continue
            key = (abs(area - trap_n), -min(height, width))
            if best is None or key < best[0]:
                best = (key, height, width)
    if trap_n <= 3 or best is None:
        trap = [(n - 1, 0), (n - 1, min(1, n - 1)), (n - 2, 0)][:trap_n]
    else:
        _key, height, width = best
        # If the rectangle is much larger than requested, keep an L of trap_n
        # when the caller asked for a small bait and the board is tiny.
        if height * width > trap_n + 2 and trap_n < 2 * n:
            trap = []
            for c in range(min(width, trap_n)):
                trap.append((n - 1, c))
            for r in range(n - 2, n - 1 - height, -1):
                if len(trap) >= trap_n:
                    break
                trap.append((r, 0))
            trap = trap[:trap_n]
        else:
            trap = [
                (n - 1 - r, c)
                for r in range(height)
                for c in range(width)
            ]
    trapset = set(trap)
    sol = [(r, c) for r in range(n) for c in range(n) if (r, c) not in trapset]
    return sol, trap


def _edges(path):
    used = set()
    for a, b in zip(path, path[1:]):
        if a[0] == b[0]:
            used.add(("v", a[0], min(a[1], b[1])))
        else:
            used.add(("h", min(a[0], b[0]), a[1]))
    return used


def _stoppers(path, n):
    stops = set()
    index = 0
    for name in _path_moves(path):
        dr, dc = NAME_DELTA[name]
        while index + 1 < len(path) and (
            path[index + 1][0] - path[index][0],
            path[index + 1][1] - path[index][1],
        ) == (dr, dc):
            index += 1
        r, c = path[index]
        nr, nc = r + dr, c + dc
        if 0 <= nr < n and 0 <= nc < n:
            if dr:
                stops.add(("h", min(r, nr), c))
            else:
                stops.add(("v", r, min(c, nc)))
    return stops


def _level(n, used, ball, hole, extra=None):
    level = {
        "size": n,
        "hWalls": [
            {"row": r, "col": c}
            for r in range(n - 1)
            for c in range(n)
            if ("h", r, c) not in used
        ],
        "vWalls": [
            {"row": r, "col": c}
            for r in range(n)
            for c in range(n - 1)
            if ("v", r, c) not in used
        ],
        "ball": {"row": ball[0], "col": ball[1]},
        "hole": {"row": hole[0], "col": hole[1]},
    }
    if extra:
        level.update(extra)
    return level


def _sealed(n, level):
    h = {(e["row"], e["col"]) for e in level["hWalls"]}
    v = {(e["row"], e["col"]) for e in level["vWalls"]}
    for r in range(n):
        for c in range(n):
            up = r == 0 or (r - 1, c) in h
            down = r == n - 1 or (r, c) in h
            left = c == 0 or (r, c - 1) in v
            right = c == n - 1 or (r, c) in v
            if up and down and left and right:
                return True
    return False


def _assemble(n, sol, trap, rng):
    if not sol or not trap or len(sol) < 2:
        return None
    stops = _stoppers(sol, n)
    sol_edges = _edges(sol)
    trapset = set(trap)
    bridges = []
    for r, c in sol:
        for dr, dc, axis, er, ec in (
            (1, 0, "h", r, c),
            (-1, 0, "h", r - 1, c),
            (0, 1, "v", r, c),
            (0, -1, "v", r, c - 1),
        ):
            nr, nc = r + dr, c + dc
            if (nr, nc) not in trapset:
                continue
            edge = (axis, er, ec)
            if er < 0 or ec < 0:
                continue
            if axis == "h" and er >= n - 1:
                continue
            if axis == "v" and ec >= n - 1:
                continue
            if edge in stops or edge in sol_edges:
                continue
            bridges.append(edge)
    if not bridges:
        return None
    rng.shuffle(bridges)
    used = sol_edges | _edges(trap)
    expect = _runs(sol)
    for edge in bridges[:8]:
        trial_used = set(used)
        trial_used.add(edge)
        level = _level(n, trial_used, sol[0], sol[-1])
        if _sealed(n, level):
            continue
        moves = solve(level, max_moves=expect + 3)
        if moves and len(moves) == expect:
            return level, moves, sol
    return None


def _region_edges(cells):
    cellset = set(cells)
    used = set()
    for r, c in cells:
        if (r + 1, c) in cellset:
            used.add(("h", r, c))
        if (r, c + 1) in cellset:
            used.add(("v", r, c))
    return used


def _stair_traps(n, length):
    """Turning corner corridors. Every step changes direction, so the far cells
    take two or more tilts to enter and the same to leave."""
    if length < 2:
        return []
    specs = []
    for corner in ("bl", "br", "tl", "tr"):
        for swap in (False, True):
            specs.append((corner, swap))
    traps = []
    for corner, swap in specs:
        if corner == "bl":
            r, c = n - 1, 0
            along, inward = ((0, 1), (-1, 0))
        elif corner == "br":
            r, c = n - 1, n - 1
            along, inward = ((0, -1), (-1, 0))
        elif corner == "tl":
            r, c = 0, 0
            along, inward = ((0, 1), (1, 0))
        else:
            r, c = 0, n - 1
            along, inward = ((0, -1), (1, 0))
        if swap:
            along, inward = inward, along
        cells = [(r, c)]
        use_along = True
        ok = True
        while len(cells) < length:
            dr, dc = along if use_along else inward
            nr, nc = cells[-1][0] + dr, cells[-1][1] + dc
            if not (0 <= nr < n and 0 <= nc < n) or (nr, nc) in cells:
                ok = False
                break
            # Keep a one-cell margin so the solution region stays connected.
            if swap and len(cells) > 1 and (nr in (0, n - 1) and nc in (0, n - 1)):
                ok = False
                break
            cells.append((nr, nc))
            use_along = not use_along
        if ok and len(cells) == length and len(set(cells)) == length:
            traps.append(cells)
    # Unique shapes only.
    seen = set()
    out = []
    for cells in traps:
        key = tuple(cells)
        if key in seen:
            continue
        seen.add(key)
        out.append(cells)
    return out


def _strip_traps(n, length):
    """A two-row zigzag along one edge. Different footprint from a corner stair,
    so later planets are not rotations of the earlier ones."""
    if length < 4 or n < 4:
        return []
    traps = []
    for flip in (False, True):
        for vertical in (False, True):
            cells = []
            for i in range(length):
                major = i // 2
                minor = i % 2
                if vertical:
                    r = minor if not flip else n - 1 - minor
                    c = major if not flip else n - 1 - major
                else:
                    r = major if not flip else n - 1 - major
                    c = minor if not flip else n - 1 - minor
                if not (0 <= r < n and 0 <= c < n):
                    cells = []
                    break
                cells.append((r, c))
            if len(cells) == length and len(set(cells)) == length:
                # Keep one row of the board free so the solution stays connected.
                rows = {r for r, _c in cells}
                cols = {c for _r, c in cells}
                if len(rows) <= n - 2 and len(cols) <= n - 1:
                    traps.append(cells)
    return traps


def _edge_between(a, b):
    if a[0] == b[0]:
        return ("v", a[0], min(a[1], b[1]))
    return ("h", min(a[0], b[0]), a[1])


def forced_corridor(n, target, rng, trap_len):
    """Exact-par board whose corner trap is a staircase of `trap_len` cells.

    The staircase is locked, so climbing the open solution cannot flatten it
    into a one-tilt pocket. Cells two tilts down the stair are budget dead ends.
    """
    from generate_edge_levels import climb, pack

    shapes = _stair_traps(n, trap_len) + _strip_traps(n, trap_len)
    rng.shuffle(shapes)
    if len(shapes) > 4:
        shapes = shapes[:4]
    all_edges = [("h", r, c) for r in range(n - 1) for c in range(n)]
    all_edges += [("v", r, c) for r in range(n) for c in range(n - 1)]
    for trap in shapes:
        trapset = set(trap)
        sol = [(r, c) for r in range(n) for c in range(n) if (r, c) not in trapset]
        if len(sol) < max(4, target):
            continue
        solset = set(sol)
        # Solution cells must stay in one orthogonal component.
        seen = {sol[0]}
        stack = [sol[0]]
        while stack:
            r, c = stack.pop()
            for dr, dc in DIRS:
                nxt = (r + dr, c + dc)
                if nxt in solset and nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        if len(seen) != len(sol):
            continue
        t_edges = {_edge_between(a, b) for a, b in zip(trap, trap[1:])}
        s_edges = set()
        for r, c in sol:
            if (r + 1, c) in solset:
                s_edges.add(("h", r, c))
            if (r, c + 1) in solset:
                s_edges.add(("v", r, c))
        first = (trap[1][0] - trap[0][0], trap[1][1] - trap[0][1])
        bridges = []
        r0, c0 = trap[0]
        for dr, dc in DIRS:
            nb = (r0 + dr, c0 + dc)
            if nb not in solset:
                continue
            # Entering the stair must stop on the first cell, not slide down it.
            if (-dr, -dc) == first:
                continue
            bridges.append(_edge_between((r0, c0), nb))
        rng.shuffle(bridges)
        pairs = [
            (a, b)
            for a in sol
            for b in sol
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) >= 2
        ]
        rng.shuffle(pairs)
        for bridge in bridges[:3]:
            open_edges = s_edges | t_edges | {bridge}
            walls = [e for e in all_edges if e not in open_edges]
            from generate_edge_levels import MAX_EDGES

            if len(walls) > MAX_EDGES[n]:
                continue
            walls_h = {(r, c) for axis, r, c in walls if axis == "h"}
            walls_v = {(r, c) for axis, r, c in walls if axis == "v"}
            locked = list(walls)
            forbid = set(locked) | {bridge} | t_edges
            for ball, hole in pairs[:12]:
                found = climb(
                    n, ball, hole, target, rng,
                    set(walls_h), set(walls_v), locked, forbid, strict=False,
                )
                if not found:
                    continue
                got_h, got_v, moves = found
                level = pack(n, ball, hole, got_h, got_v)
                if _sealed(n, level):
                    continue
                return level, moves, sol
    return None


def corridor(n, target, rng, trap_n):
    """Solution tuned to `target` tilts, with a turning side-corridor as bait.

    The trap is walled off except one door. Climbing walls on the solution
    side raises par without opening a shortcut through the trap. Cells two
    tilts into the trap are budget dead ends: the way back costs more than
    the par+3 fail limit allows.
    """
    from generate_edge_levels import climb, pack

    min_sol = target + 1
    spare = n * n - min_sol
    trap_n = max(3, min(trap_n, spare))
    if trap_n < 3 or min_sol > n * n - 3:
        return None
    sol_cells, trap_cells = _split(n, trap_n)
    if len(sol_cells) < min_sol or len(trap_cells) < 3:
        return None
    want = min(len(trap_cells) - 1, 2 + trap_n // 3)
    trap = _fill(trap_cells, rng, want, trials=40)
    if not trap or _runs(trap) < 2:
        return None
    trapset = set(trap_cells)
    bridges = []
    for r, c in sol_cells:
        for dr, dc, axis, er, ec in (
            (1, 0, "h", r, c),
            (-1, 0, "h", r - 1, c),
            (0, 1, "v", r, c),
            (0, -1, "v", r, c - 1),
        ):
            nr, nc = r + dr, c + dc
            if (nr, nc) not in trapset or er < 0 or ec < 0:
                continue
            if axis == "h" and er >= n - 1:
                continue
            if axis == "v" and ec >= n - 1:
                continue
            bridges.append((axis, er, ec))
    if not bridges:
        return None
    rng.shuffle(bridges)
    pairs = [
        (a, b)
        for a in sol_cells
        for b in sol_cells
        if a != b and abs(a[0] - b[0]) + abs(a[1] - b[1]) >= 2
    ]
    rng.shuffle(pairs)
    for bridge in bridges[:3]:
        open_edges = _region_edges(sol_cells) | _edges(trap) | {bridge}
        walls_h = {
            (r, c)
            for r in range(n - 1)
            for c in range(n)
            if ("h", r, c) not in open_edges
        }
        walls_v = {
            (r, c)
            for r in range(n)
            for c in range(n - 1)
            if ("v", r, c) not in open_edges
        }
        locked = [("h", r, c) for r, c in walls_h] + [("v", r, c) for r, c in walls_v]
        forbid = set(locked) | {bridge}
        for ball, hole in pairs[:14]:
            found = climb(
                n, ball, hole, target, rng, set(walls_h), set(walls_v), locked, forbid, strict=False
            )
            if not found:
                continue
            got_h, got_v, moves = found
            level = pack(n, ball, hole, got_h, got_v)
            if _sealed(n, level):
                continue
            return level, moves, sol_cells
    return None


def _open_beyond(level, cell, action, blocked):
    n = level["size"]
    dr, dc = NAME_DELTA[action]
    nr, nc = cell[0] + dr, cell[1] + dc
    if not (0 <= nr < n and 0 <= nc < n) or (nr, nc) in blocked:
        return None
    if dr:
        edge = ("h", min(cell[0], nr), cell[1])
    else:
        edge = ("v", cell[0], min(cell[1], nc))
    key = "hWalls" if edge[0] == "h" else "vWalls"
    if not any(e["row"] == edge[1] and e["col"] == edge[2] for e in level[key]):
        return None
    return edge, key


def _drop_edge(level, edge):
    key = "hWalls" if edge[0] == "h" else "vWalls"
    level[key] = [e for e in level[key] if not (e["row"] == edge[1] and e["col"] == edge[2])]


def _visited(level, moves):
    cells = []
    for _action, path, _phase in replay(level, moves):
        cells.extend(path)
    return cells


def graft_trap(level, moves):
    """Rewire spare cells into a turning dead-end corridor.

    The shortest solution does not use those cells, so par stays put while the
    side stair becomes a wrong-turn trap. Returns the graft with the most
    budget dead ends, or None when no graft keeps the puzzle necessary.
    """
    n = level["size"]
    visited = set(_visited(level, moves))
    spare = [(r, c) for r in range(n) for c in range(n) if (r, c) not in visited]
    if len(spare) < 2:
        return None
    spare_set = set(spare)
    seen = set()
    comps = []
    for cell in spare:
        if cell in seen:
            continue
        stack = [cell]
        seen.add(cell)
        comp = []
        while stack:
            cur = stack.pop()
            comp.append(cur)
            r, c = cur
            for dr, dc in DIRS:
                nxt = (r + dr, c + dc)
                if nxt in spare_set and nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        if len(comp) >= 2:
            comps.append(comp)
    comps.sort(key=len, reverse=True)

    def cover(cells):
        cellset = set(cells)
        best = None
        best_runs = -1
        for start in cells:
            path = [start]
            used = {start}
            last = None
            while len(path) < len(cells):
                r, c = path[-1]
                opts = []
                for dr, dc in DIRS:
                    nxt = (r + dr, c + dc)
                    if nxt in cellset and nxt not in used:
                        turn = 0 if last == (dr, dc) else 1
                        opts.append((turn, nxt, (dr, dc)))
                if not opts:
                    break
                opts.sort(key=lambda item: -item[0])
                last = opts[0][2]
                path.append(opts[0][1])
                used.add(opts[0][1])
            runs = _runs(path)
            if len(path) == len(cells) and (best is None or runs > best_runs):
                best = path
                best_runs = runs
                if runs >= 2 and runs >= len(cells) - 2:
                    break
        # A straight spare line is not a trap: the fail budget absorbs one
        # extra tilt. Only a path that turns at least twice is fatal.
        if best is None or len(best) != len(cells) or _runs(best) < 2:
            return None
        return best

    best = None
    best_dead = -1
    for comp in comps[:3]:
        path = cover(comp)
        if not path or len(path) < 2:
            continue
        pset = set(path)
        path_edges = {_edge_between(a, b) for a, b in zip(path, path[1:])}
        ends = []
        step0 = (path[1][0] - path[0][0], path[1][1] - path[0][1])
        step1 = (path[-2][0] - path[-1][0], path[-2][1] - path[-1][1])
        ends.append((path[0], step0))
        if path[-1] != path[0]:
            ends.append((path[-1], step1))
        bridges = []
        for end, step in ends:
            for dr, dc in DIRS:
                nb = (end[0] + dr, end[1] + dc)
                if nb not in visited:
                    continue
                if (-dr, -dc) == step:
                    continue
                bridges.append(_edge_between(end, nb))
        for bridge in bridges[:4]:
            trial = copy.deepcopy(level)
            for key, axis in (("hWalls", "h"), ("vWalls", "v")):
                trial[key] = [
                    e
                    for e in trial.get(key) or []
                    if (axis, e["row"], e["col"]) not in path_edges
                    and (axis, e["row"], e["col"]) != bridge
                ]
            have = {("h", e["row"], e["col"]) for e in trial["hWalls"]}
            have |= {("v", e["row"], e["col"]) for e in trial["vWalls"]}

            def touches(edge):
                axis, r, c = edge
                if axis == "h":
                    return (r, c) in pset or (r + 1, c) in pset
                return (r, c) in pset or (r, c + 1) in pset

            for r in range(n - 1):
                for c in range(n):
                    edge = ("h", r, c)
                    if edge in path_edges or edge == bridge or edge in have or not touches(edge):
                        continue
                    trial["hWalls"].append({"row": r, "col": c})
                    have.add(edge)
            for r in range(n):
                for c in range(n - 1):
                    edge = ("v", r, c)
                    if edge in path_edges or edge == bridge or edge in have or not touches(edge):
                        continue
                    trial["vWalls"].append({"row": r, "col": c})
                    have.add(edge)
            if _sealed(n, trial):
                continue
            solved = solve(trial, max_moves=len(moves) + 2)
            if not solved or len(solved) != len(moves):
                continue
            if not all_necessary(trial, solved) and mechanic_names(trial):
                continue
            if not mechanic_names(trial) and not _walls_matter(trial, solved):
                continue
            report = budget_dead_ends(trial, solved)
            if report["deadEnds"] > best_dead:
                best_dead = report["deadEnds"]
                best = (trial, solved, report)
    return best


def _walls_matter(level, moves):
    bare = copy.deepcopy(level)
    bare["hWalls"] = []
    bare["vWalls"] = []
    other = solve(bare, max_moves=len(moves))
    return other is not None and len(other) <= len(moves) - 2


def _accept(level, moves, kinds, gallery):
    if not moves or len(moves) < 2:
        return False
    if level.get("coins"):
        return False
    names = mechanic_names(level)
    if set(names) != set(kinds):
        return False
    if kinds:
        if not all_necessary(level, moves):
            return False
    elif not _walls_matter(level, moves):
        return False
    if gallery is not None and gallery.reject_reason(level):
        return False
    if _sealed(level["size"], level):
        return False
    return True


def _decorate_sand(level, moves, sol):
    blocked = set(sol)
    for action, path, _phase in replay(level, moves):
        if len(path) < 2:
            continue
        opened = _open_beyond(level, path[-1], action, blocked)
        if not opened:
            continue
        edge, _key = opened
        trial = copy.deepcopy(level)
        _drop_edge(trial, edge)
        trial["sand"] = [{"row": path[-1][0], "col": path[-1][1]}]
        solved = solve(trial, max_moves=len(moves) + 6)
        if solved and all_necessary(trial, solved):
            return trial, solved
    return None


def _decorate_ice(level, moves, sol):
    blocked = set(sol)
    for action, path, _phase in replay(level, moves):
        if len(path) < 2:
            continue
        opened = _open_beyond(level, path[-1], action, blocked)
        if not opened:
            continue
        edge, _key = opened
        ice_cell = path[-2]
        trial = copy.deepcopy(level)
        _drop_edge(trial, edge)
        trial["ice"] = [{"row": ice_cell[0], "col": ice_cell[1]}]
        solved = solve(trial, max_moves=len(moves) + 6)
        if solved and all_necessary(trial, solved):
            return trial, solved
    return None


def _decorate_glass(level, moves):
    crossed = []
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge and edge not in crossed:
                crossed.append(edge)
    reserved = set()
    for shifter in level.get("shifters") or []:
        for spot in (shifter.get("home"), shifter.get("alt")):
            if spot:
                reserved.add((spot["axis"], spot["row"], spot["col"]))
    for edge in crossed:
        if edge in reserved:
            continue
        trial = copy.deepcopy(level)
        key = "glassH" if edge[0] == "h" else "glassV"
        trial[key] = [{"row": edge[1], "col": edge[2]}]
        solved = solve(trial, max_moves=len(moves) + 4)
        if solved and all_necessary(trial, solved):
            return trial, solved
    return None


def _decorate_smog(level, moves):
    from necessity import smog_ok

    flat = set()
    for _action, path, _phase in replay(level, moves):
        flat.update(path)
    start = (level["ball"]["row"], level["ball"]["col"])
    n = level["size"]
    for r, c in flat:
        if (r, c) == start:
            continue
        neighbors = []
        if r > 0:
            neighbors.append(("hWalls", r - 1, c))
        if r < n - 1:
            neighbors.append(("hWalls", r, c))
        if c > 0:
            neighbors.append(("vWalls", r, c - 1))
        if c < n - 1:
            neighbors.append(("vWalls", r, c))
        for key, er, ec in neighbors:
            if not any(e["row"] == er and e["col"] == ec for e in level.get(key) or []):
                continue
            trial = copy.deepcopy(level)
            trial[key] = [e for e in trial[key] if not (e["row"] == er and e["col"] == ec)]
            other = solve(trial, max_moves=len(moves))
            if other is None or len(other) > len(moves) - 2:
                continue
            made = copy.deepcopy(level)
            made["smog"] = [{"row": r, "col": c}]
            if smog_ok(made, moves):
                return made, moves
    return None


def _decorate_magma(level, moves):
    hole = (level["hole"]["row"], level["hole"]["col"])
    cells = []
    for _action, path, _phase in replay(level, moves):
        cells.extend(path[1:])
    cells = [cell for cell in cells if cell != hole]
    if not cells:
        return None
    # Crossing late in the solution still happens before `at`.
    cell = cells[len(cells) // 2]
    trial = copy.deepcopy(level)
    trial["magma"] = [{"row": cell[0], "col": cell[1], "at": len(moves) + 1}]
    solved = solve(trial, max_moves=len(moves) + 4)
    if solved and all_necessary(trial, solved):
        return trial, solved
    return None


def _decorate_jelly(level, moves, lo, hi):
    parts = replay(level, moves)
    seen = set()
    for _action, path, _phase in parts:
        for i in range(len(path) - 2):
            a, b, c = path[i], path[i + 1], path[i + 2]
            step = (b[0] - a[0], b[1] - a[1])
            if step != (c[0] - b[0], c[1] - b[1]):
                continue
            if abs(step[0]) + abs(step[1]) != 1:
                continue
            edge = edge_of(a, b)
            if edge in seen:
                continue
            seen.add(edge)
            trial = copy.deepcopy(level)
            key = "hWalls" if edge[0] == "h" else "vWalls"
            trial.setdefault(key, []).append({"row": edge[1], "col": edge[2]})
            trial["jelly"] = [{"row": a[0], "col": a[1]}]
            solved = solve(trial, max_moves=hi + 4)
            if solved and lo <= len(solved) <= hi and all_necessary(trial, solved):
                return trial, solved
    return None


def _decorate_gates(level, moves, sol, rng, lo, hi):
    """One-cell button alcove off the solution, gate further along the path."""
    n = level["size"]
    solset = set(sol)
    # A trap cell beside an early solution cell becomes the button room.
    pockets = []
    trap_cells = [
        (r, c)
        for r in range(n)
        for c in range(n)
        if (r, c) not in solset
    ]
    for r, c in sol[: max(2, len(sol) // 3)]:
        for dr, dc, axis, er, ec in (
            (1, 0, "h", r, c),
            (-1, 0, "h", r - 1, c),
            (0, 1, "v", r, c),
            (0, -1, "v", r, c - 1),
        ):
            nr, nc = r + dr, c + dc
            if (nr, nc) not in trap_cells:
                continue
            edge = (axis, er, ec)
            if er < 0 or ec < 0:
                continue
            pockets.append(((r, c), (nr, nc), edge))
    rng.shuffle(pockets)
    crossed = []
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge and edge not in crossed:
                crossed.append((a, b, edge))
    for anchor, pocket, bridge in pockets[:6]:
        # Gate must be crossed after the solver can already reach the button.
        for a, b, edge in crossed:
            if a == anchor or b == anchor:
                continue
            trial = copy.deepcopy(level)
            # Close every trap edge except the button door, so the press is a
            # one-tilt alcove rather than a march through the whole side maze.
            # The existing trap bridge stays; we only color a later solution edge.
            key = "coloredH" if edge[0] == "h" else "coloredV"
            trial[key] = [{"row": edge[1], "col": edge[2], "color": "red"}]
            trial["buttons"] = [{"row": pocket[0], "col": pocket[1], "color": "red"}]
            solved = solve(trial, max_moves=hi + 8)
            if solved and lo <= len(solved) <= hi and all_necessary(trial, solved):
                return trial, solved
    return None


def _decorate_teleport(level, moves):
    """Replace one straight slide with a hop across a newly walled gap.

    The pads are two cells apart, so the recorded step is a jump. Walling the
    gap makes the board unsolvable once the pads are removed.
    """
    parts = replay(level, moves)
    triples = []
    for _action, path, _phase in parts:
        for i in range(len(path) - 2):
            a, b, c = path[i], path[i + 1], path[i + 2]
            step = (b[0] - a[0], b[1] - a[1])
            if step == (c[0] - b[0], c[1] - b[1]) and abs(step[0]) + abs(step[1]) == 1:
                triples.append((a, b, c))
    for a, b, _c in triples:
        edge = edge_of(a, b)
        if not edge:
            continue
        trial = copy.deepcopy(level)
        key = "hWalls" if edge[0] == "h" else "vWalls"
        trial.setdefault(key, []).append({"row": edge[1], "col": edge[2]})
        trial["teleports"] = [{
            "a": {"row": a[0], "col": a[1]},
            "b": {"row": _c[0], "col": _c[1]},
        }]
        if _sealed(trial["size"], trial):
            continue
        solved = solve(trial, max_moves=len(moves) + 6)
        if solved and all_necessary(trial, solved):
            return trial, solved
    return None


def _maze_kind(kind, n, target, rng, gallery, rounds=6):
    """Hunters that need a branching maze rather than a single corridor."""
    from build_tricks import (
        _try_collapse,
        _try_movers,
        build_cut,
        build_jelly,
        fresh_wall,
        hunt_gates,
        hunt_oneway,
    )

    if kind == "jelly":
        for aim in (target, target + 1, target + 2, target - 1):
            if aim < 3:
                continue
            made = build_jelly(n, aim, rng, None, attempts=16)
            if made and target <= len(made[1]) <= target + 2:
                return made
        return None
    if kind == "teleport":
        for aim in (target, target + 1, target - 1):
            made = build_cut(n, aim, rng, "teleport", None, attempts=16)
            if made and target <= len(made[1]) <= target + 2:
                return made
        return None
    if kind == "gates":
        for aim in (target, target + 1, target - 1):
            made = build_cut(n, aim, rng, "gates", None, attempts=12)
            if made and target <= len(made[1]) <= target + 2:
                return made
            made = hunt_gates(n, aim, rng, set(), None, attempts=3)
            if made and target <= len(made[1]) <= target + 2:
                return made
        return None
    donors = []
    for _ in range(rounds):
        aim = max(4, target + rng.choice((0, -1, 1, -2, 2)))
        base = fresh_wall(n, aim, rng, set(), attempts=24 if n <= 5 else 36)
        if not base:
            continue
        moves = solve(base, max_moves=aim + 4)
        if moves:
            base["par"] = len(moves)
            donors.append(base)
    if kind == "oneway":
        made = hunt_oneway(donors, rng, target, target + 2, gallery, attempts=max(4, len(donors)))
        return made
    lo, hi = target, target + 3
    rng.shuffle(donors)
    hunt = _try_movers if kind == "movers" else _try_collapse
    for base in donors:
        made = hunt(base, rng, lo, hi)
        if made and (gallery is None or not gallery.reject_reason(made[0])):
            return made
    # One more pass aimed above the target. Movers and crumble often land high.
    for _ in range(4):
        aim = target + rng.choice((0, 1, 2))
        base = fresh_wall(n, aim, rng, set(), attempts=20)
        if not base:
            continue
        made = hunt(base, rng, lo, hi + 2)
        if made and (gallery is None or not gallery.reject_reason(made[0])):
            return made
    return None


DECORATE = {
    "sand": lambda level, moves, sol, rng, lo, hi: _decorate_sand(level, moves, sol),
    "ice": lambda level, moves, sol, rng, lo, hi: _decorate_ice(level, moves, sol),
    "glass": lambda level, moves, sol, rng, lo, hi: _decorate_glass(level, moves),
    "smog": lambda level, moves, sol, rng, lo, hi: _decorate_smog(level, moves),
    "magma": lambda level, moves, sol, rng, lo, hi: _decorate_magma(level, moves),
    "jelly": lambda level, moves, sol, rng, lo, hi: _decorate_jelly(level, moves, lo, hi),
    "teleport": lambda level, moves, sol, rng, lo, hi: _decorate_teleport(level, moves),
    "gates": lambda level, moves, sol, rng, lo, hi: _decorate_gates(level, moves, sol, rng, lo, hi),
}

# Gadgets that usually change the tilt count, so the corridor aims lower.
SLACK = {"glass": 1, "gates": 3, "jelly": 1, "movers": 4, "collapse": 3}
STRUCTURAL = ("oneway", "movers", "collapse")


def _apply_kinds(level, moves, sol, kinds, rng, lo, hi):
    for kind in kinds:
        fn = DECORATE.get(kind)
        if fn is None:
            return None
        made = fn(level, moves, sol, rng, lo, hi)
        if not made:
            return None
        level, moves = made
    if not (lo <= len(moves) <= hi):
        return None
    return level, moves


def _trap_lengths(n, trap_bias):
    cap = max(2, min(n * 2 - 3, n * n - 4))
    base = min(cap, max(2, trap_bias))
    raw = [base, base + 1, base - 1, base + 2, max(2, base - 2), cap, 2, 3]
    out = []
    for length in raw:
        if 2 <= length <= cap and length not in out:
            out.append(length)
    return out


def _search_structural(kind, n, target, rng, lo, hi, gallery=None):
    """One-way, vines, or crumbling floors. Stairs first, then branching mazes."""
    from build_tricks import fresh_wall, hunt_oneway

    if kind == "oneway":
        donors = []
        used = set()
        for aim in (target, target + 1, target + 2, max(4, target - 1), max(4, target - 2)):
            for _ in range(4):
                base = fresh_wall(n, aim, rng, used, attempts=50 if n <= 5 else 70)
                if not base:
                    continue
                moves = solve(base, max_moves=aim + 5)
                if moves and len(moves) >= max(3, lo - 2):
                    base["par"] = len(moves)
                    donors.append(base)
            if len(donors) >= 16:
                break
        if not donors:
            return None
        return hunt_oneway(donors, rng, lo, hi, None, attempts=len(donors))

    if kind == "movers":
        lengths = _trap_lengths(n, max(3, n // 2 + 2))
        rng.shuffle(lengths)
        for delta in (2, 3, 4, 1, 5):
            aim = max(4, target - delta)
            for length in lengths[:2]:
                made = forced_corridor(n, aim, rng, length)
                if not made:
                    continue
                found = _search_movers(made[0], made[1], rng, lo, hi, gallery)
                if found:
                    return found
        # Stairs repeat. A branching maze is a different wall set, so a second
        # vine at the same par can still clear the duplicate check.
        from build_tricks import fresh_wall
        used = set()
        for aim in (max(4, target - 3), max(4, target - 5), max(4, target - 1), target):
            for _ in range(4):
                base = fresh_wall(n, aim, rng, used, attempts=20)
                if not base:
                    continue
                moves = solve(base, max_moves=aim + 6)
                if not moves:
                    continue
                found = _search_movers(base, moves, rng, lo, hi, gallery)
                if found:
                    return found
        return None

    # Collapse wants a maze whose short line revisits a cell.
    donors = []
    used = set()
    for aim in (max(4, target - 2), target, max(4, target - 4), target + 1):
        for _ in range(6):
            base = fresh_wall(n, aim, rng, used, attempts=36)
            if not base:
                continue
            moves = solve(base, max_moves=aim + 5)
            if moves:
                base["par"] = len(moves)
                donors.append(base)
        if len(donors) >= 18:
            break
    rng.shuffle(donors)
    for base in donors[:28]:
        found = _search_collapse(base, rng, lo, hi, gallery)
        if found:
            return found
    return None


def _search_movers(level, moves, rng, lo, hi, gallery=None):
    from necessity import movers_ok

    n = level["size"]
    h = {(e["row"], e["col"]) for e in level.get("hWalls") or []}
    v = {(e["row"], e["col"]) for e in level.get("vWalls") or []}
    opens = [("h", r, c) for r in range(n - 1) for c in range(n) if (r, c) not in h]
    opens += [("v", r, c) for r in range(n) for c in range(n - 1) if (r, c) not in v]
    crossings = []
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge and edge not in crossings:
                crossings.append(edge)
    rng.shuffle(crossings)
    rng.shuffle(opens)
    best = None
    best_key = None
    pairs = [(home, alt) for home in crossings for alt in opens if alt != home]
    rng.shuffle(pairs)
    for home, alt in pairs[:220]:
            trial = copy.deepcopy(level)
            trial["shifters"] = [{
                "home": {"axis": home[0], "row": home[1], "col": home[2]},
                "alt": {"axis": alt[0], "row": alt[1], "col": alt[2]},
            }]
            solved = solve(trial, max_moves=hi + 4)
            if not solved or not (lo <= len(solved) <= hi):
                continue
            if abs(len(solved) - len(moves)) < 3:
                continue
            if not movers_ok(trial, solved):
                continue
            if gallery is not None and gallery.reject_reason(trial):
                continue
            return trial, solved
    return best


def _search_collapse(level, rng, lo, hi, gallery=None):
    from necessity import collapse_ok

    bare = solve(level, max_moves=hi + 4)
    if not bare:
        return None
    n = level["size"]
    start = (level["ball"]["row"], level["ball"]["col"])
    hole = (level["hole"]["row"], level["hole"]["col"])
    cells = [(r, c) for r in range(n) for c in range(n) if (r, c) not in (start, hole)]
    rng.shuffle(cells)
    best = None
    best_key = None
    for cell in cells:
        trial = copy.deepcopy(level)
        trial["collapse"] = [{"row": cell[0], "col": cell[1]}]
        solved = solve(trial, max_moves=hi + 4)
        if not solved or not (lo <= len(solved) <= hi):
            continue
        if abs(len(solved) - len(bare)) < 3:
            continue
        if not collapse_ok(trial, solved):
            continue
        if gallery is not None and gallery.reject_reason(trial):
            continue
        report = budget_dead_ends(trial, solved)
        # Closest to the asked par. A longer crumble becomes the next
        # stage's floor, so an exact hit wins over a busier one.
        key = (-abs(len(solved) - lo), report["deadEnds"])
        if best_key is None or key > best_key:
            best_key = key
            best = (trial, solved)
            if len(solved) == lo and report["deadEnds"] >= 4:
                return best
    return best


def _search_oneway_teleport(n, target, rng, lo, hi, min_dead):
    """Current first, then a whirlpool on that route.

    The hop shortens a one-way maze, so the donor aims a little above `target`
    and only a result inside [lo, hi] is kept.
    """
    best = None
    best_key = None
    for aim in (target + 1, target + 2, target, target + 3):
        if aim < 4:
            continue
        made = _search_structural("oneway", n, aim, rng, max(4, aim - 1), aim + 1)
        if not made:
            continue
        dec = _decorate_teleport(made[0], made[1])
        if not dec:
            continue
        level, moves = dec
        if not (lo <= len(moves) <= hi):
            continue
        if not all_necessary(level, moves):
            continue
        report = budget_dead_ends(level, moves)
        over = report["deadEnds"] - min_dead
        # Closest trap count at or above the ask, otherwise the richest miss.
        key = (
            1 if over >= 0 else 0,
            -over if over >= 0 else report["deadEnds"],
            -abs(len(moves) - target),
        )
        if best_key is None or key > best_key:
            best_key = key
            best = (level, moves)
        if 0 <= over <= 1:
            break
    return best


def build_hard(n, target, kinds, rng, gallery, trap_bias, attempts=8, min_dead=0, prefer_high=False, max_par=None):
    """Best necessary board near `target`, scored by dead ends then trap edges."""
    kinds = list(kinds)
    lo = max(2, target)
    # Vines and gates usually add one tilt. Crumble adds a couple. Every
    # other trick has to land on the par we asked for, or the next planet's
    # average cannot stay ahead.
    if "collapse" in kinds:
        # A crumble usually lands a couple of tilts off the maze it was cut
        # from. The caller caps how far that may go.
        hi = target + 2
    elif any(kind in ("movers", "gates") for kind in kinds):
        hi = target + 2
    else:
        hi = target
    if max_par is not None:
        hi = min(hi, max_par)
    best = None
    best_key = None
    satisfied = 0

    def consider(level, moves, do_graft=True):
        nonlocal best, best_key, satisfied
        if not moves:
            return
        candidates = [(level, moves)]
        # The stair already counts as a trap. Grafting is only worth the
        # extra solves when this board is still short of the dead-end ask.
        if do_graft and len(moves) <= hi + 2 and "magma" not in kinds:
            pre = budget_dead_ends(level, moves)
            if pre["deadEnds"] < min_dead:
                boosted = graft_trap(level, moves)
                if boosted:
                    candidates.append((boosted[0], boosted[1]))
        for cand_level, cand_moves in candidates:
            if not (lo <= len(cand_moves) <= hi):
                continue
            if not _accept(cand_level, cand_moves, kinds, gallery):
                continue
            report = budget_dead_ends(cand_level, cand_moves)
            # Stay just above the dead-end floor. A huge jump makes the next
            # stage's floor impossible, so extra traps only win inside a
            # narrow band over the asked depth. Magma's tilt clock inflates
            # the count; those stages ask for the richest board instead.
            over = report["deadEnds"] - min_dead
            if prefer_high:
                key = (report["deadEnds"], report["traps"], -abs(len(cand_moves) - target))
            elif over >= 0:
                key = (1, -over, report["traps"], -abs(len(cand_moves) - target))
            else:
                key = (0, report["deadEnds"], report["traps"], -abs(len(cand_moves) - target))
            if best_key is None or key > best_key:
                best_key = key
                best = (cand_level, cand_moves, report)
                if not prefer_high and 0 <= over <= 1 and len(cand_moves) == target:
                    satisfied += 1

    structural = [kind for kind in kinds if kind in STRUCTURAL]
    lengths = _trap_lengths(n, max(2, trap_bias))

    for attempt in range(attempts):
        if set(kinds) == {"oneway", "teleport"}:
            made = _search_oneway_teleport(n, target, rng, lo, hi, min_dead)
            if made:
                consider(made[0], made[1])
            if best is not None and best[2]["deadEnds"] >= min_dead:
                break
            continue
        if structural:
            primary = structural[0]
            made = _search_structural(primary, n, target, rng, lo, hi, gallery)
            if not made:
                continue
            level, moves = made
            rest = structural[1:] + [kind for kind in kinds if kind not in STRUCTURAL]
            if rest:
                sol = _visited(level, moves)
                layered = _apply_kinds(level, moves, sol, rest, rng, lo, hi)
                if not layered:
                    continue
                level, moves = layered
            consider(level, moves)
        else:
            slack = sum(SLACK.get(kind, 0) for kind in kinds)
            base_target = max(3 if n >= 4 else 2, target - slack)
            length = lengths[attempt % len(lengths)]
            made = forced_corridor(n, base_target, rng, length)
            if not made:
                made = corridor(n, base_target, rng, max(3, length))
            if not made and slack:
                made = forced_corridor(n, max(3, base_target - 1), rng, max(2, length - 1))
            if not made:
                continue
            level, moves, sol = made
            if kinds:
                layered = _apply_kinds(level, moves, sol, kinds, rng, lo, hi)
                if not layered:
                    if set(kinds) <= {"jelly", "teleport", "gates"}:
                        hunted = _maze_kind(kinds[0], n, target, rng, None, rounds=2)
                        if hunted:
                            consider(hunted[0], hunted[1])
                    continue
                level, moves = layered
            consider(level, moves)
        if satisfied >= 2 and best is not None and best[2]["deadEnds"] >= min_dead:
            break
    if best is None:
        return None
    level, moves, report = best
    level = copy.deepcopy(level)
    level["par"] = len(moves)
    level["_deadEnds"] = report["deadEnds"]
    level["_traps"] = report["traps"]
    return level, moves
