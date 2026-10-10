"""Shared necessity, interestingness, and dihedral-uniqueness checks.

A featured mechanic is necessary when the optimal solution actually uses it
and neutralizing it changes the par by at least GAP, or makes the board
unsolvable. A change of 0 or 1 is decoration.

Enabling mechanics (sand stop, ice overshoot, teleport, glass, gates) become
worse when removed. Restrictive mechanics (collapse, and a one-way that is
also a passage) become easier when the restriction is lifted. Smog does not
change slide rules: the concealed walls are what must be load-bearing. Coins
do not change the hole race: the bonus is a real choice only when some par
path collects them and another misses one.

tools/generate_campaign.py and tools/validate_levels.py both call this module.
"""

import copy
from collections import deque

from tilt_solver import COLOR_IDS, DIRS, _activate, _bump_tilts, color_id, edges_crossed, play, prepare, solve, tilt

GAP = 3
DIR_INDEX = {name: i for i, (name, _dr, _dc) in enumerate(DIRS)}
DIR_DELTA = {name: (dr, dc) for name, dr, dc in DIRS}
DELTA_NAME = {(dr, dc): name for name, dr, dc in DIRS}
ALLOW = (1 << len(COLOR_IDS)) - 1


def cells_of(level, key):
    return [(e["row"], e["col"]) for e in level.get(key) or []]


def clone(level):
    return copy.deepcopy(level)


def par_moves(level, cap=42):
    return solve(level, max_moves=cap)


def changed(par, other, gap=GAP):
    """True when `other` is unsolvable or at least `gap` moves away from par."""
    if other is None:
        return True
    return abs(len(other) - par) >= gap


def worse(par, other, gap=GAP):
    if other is None:
        return True
    return len(other) >= par + gap


def better(par, other, gap):
    return other is not None and len(other) <= par - gap


def replay(level, moves):
    """Each tilt as (action, path, phase_before). Presses are omitted.

    Spent tilts and presses advance the magma counter the same way solve() does.
    """
    board = prepare(level)
    r, c = board["ball"]
    gstate = act = collapse = phase = tilts = 0
    out = []
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, ALLOW)
            tilts = _bump_tilts(board, tilts)
            continue
        before = phase
        res = tilt(board, r, c, DIR_INDEX[action], gstate, act, ALLOW, collapse, phase, tilts)
        r, c, gstate, act, moved, _won, collapse, phase, path = res
        if moved:
            tilts = _bump_tilts(board, tilts)
        out.append((action, path, before))
    return out


def visited_cells(parts):
    cells = []
    for _action, path, _phase in parts:
        for cell in path:
            if not cells or cells[-1] != cell:
                cells.append(cell)
    return cells


def step_dir(a, b):
    return DELTA_NAME.get((b[0] - a[0], b[1] - a[1]))


def edge_of(a, b):
    if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
        return None
    if a[0] != b[0]:
        return ("h", min(a[0], b[0]), a[1])
    return ("v", a[0], min(a[1], b[1]))


def wall_lookup(level):
    h = {(e["row"], e["col"]) for e in level.get("hWalls") or []}
    v = {(e["row"], e["col"]) for e in level.get("vWalls") or []}
    return h, v


def walled(level, edge):
    if edge is None:
        return True
    axis, r, c = edge
    h, v = wall_lookup(level)
    return (r, c) in (h if axis == "h" else v)


def ahead_open(level, cell, direction):
    """The next cell in `direction` is on the board and not blocked by a solid wall."""
    if direction not in DIR_DELTA:
        return False
    n = level["size"]
    dr, dc = DIR_DELTA[direction]
    nr, nc = cell[0] + dr, cell[1] + dc
    if nr < 0 or nc < 0 or nr >= n or nc >= n:
        return False
    return not walled(level, edge_of(cell, (nr, nc)))


def _strip(level, **keys):
    trial = clone(level)
    for key, value in keys.items():
        trial[key] = value
    return trial


def sand_ok(level, moves=None):
    sands = set(cells_of(level, "sand"))
    if not sands:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    used = False
    for _action, path, _phase in replay(level, moves):
        if len(path) < 2 or path[-1] not in sands:
            continue
        direction = step_dir(path[-2], path[-1])
        if ahead_open(level, path[-1], direction):
            used = True
            break
    if not used:
        return False
    bare = par_moves(_strip(level, sand=[]), cap=len(moves) + 16)
    return worse(len(moves), bare)


def ice_ok(level, moves=None):
    ice = set(cells_of(level, "ice"))
    if not ice:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    used = False
    for _action, path, _phase in replay(level, moves):
        if len(path) < 2:
            continue
        if not any(cell in ice for cell in path[:-1]):
            continue
        if path[-1] in ice:
            continue
        direction = step_dir(path[-2], path[-1])
        if ahead_open(level, path[-1], direction):
            used = True
            break
    if not used:
        return False
    bare = par_moves(_strip(level, ice=[]), cap=len(moves) + 16)
    return worse(len(moves), bare)


def oneway_ok(level, moves=None):
    """The arrow is a real choice: opening it and walling it both change the par.

    Crossing forward means the passage itself is required. Stopping against
    the arrow means it cuts a slide a wall would also cut, so that only counts
    when walling the door still changes the line (the solution also needs the
    forward direction, or a later route the wall would ruin).
    """
    doors = level.get("oneWay") or []
    if not doors:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    crossed = []
    stops = []
    for action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            direction = step_dir(a, b)
            if edge and direction:
                crossed.append((edge, direction))
        if len(path) >= 1:
            stops.append((path[-1], action))
    forward = False
    stopped = False
    for door in doors:
        key = (door["axis"], door["row"], door["col"])
        if any(edge == key and direction == door["dir"] for edge, direction in crossed):
            forward = True
        against = {"up": "down", "down": "up", "left": "right", "right": "left"}[door["dir"]]
        for cell, action in stops:
            if action != against:
                continue
            if ahead_open(level, cell, action) and edge_of(cell, (
                cell[0] + DIR_DELTA[action][0], cell[1] + DIR_DELTA[action][1]
            )) == key:
                stopped = True
    if not (forward or stopped):
        return False
    opened = par_moves(_strip(level, oneWay=[]), cap=len(moves) + 14)
    walled = clone(level)
    walled["oneWay"] = []
    for door in doors:
        key = "hWalls" if door["axis"] == "h" else "vWalls"
        walled.setdefault(key, []).append({"row": door["row"], "col": door["col"]})
    blocked = par_moves(walled, cap=len(moves) + 14)
    # Either neutralization has to move the par by at least 2, and one of them
    # by the full gap, so a door that merely copies a wall or an open edge fails.
    open_delta = GAP + 1 if opened is None else abs(len(opened) - len(moves))
    wall_delta = GAP + 1 if blocked is None else abs(len(blocked) - len(moves))
    if max(open_delta, wall_delta) < GAP:
        return False
    if min(open_delta, wall_delta) < 2:
        return False
    return True


def teleport_ok(level, moves=None):
    if not level.get("teleports"):
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    jumped = False
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) > 1:
                jumped = True
    if not jumped:
        return False
    bare = par_moves(_strip(level, teleports=[]), cap=len(moves) + 16)
    return worse(len(moves), bare)


def glass_ok(level, moves=None):
    if not (level.get("glassH") or level.get("glassV")):
        return False
    moves = moves or par_moves(level)
    if not moves or glass_broken(level, moves) < 1:
        return False
    walled = clone(level)
    walled.setdefault("hWalls", [])
    walled.setdefault("vWalls", [])
    for edge in level.get("glassH") or []:
        walled["hWalls"].append({"row": edge["row"], "col": edge["col"]})
    for edge in level.get("glassV") or []:
        walled["vWalls"].append({"row": edge["row"], "col": edge["col"]})
    walled["glassH"] = []
    walled["glassV"] = []
    blocked = par_moves(walled, cap=len(moves) + 16)
    return worse(len(moves), blocked)


def glass_broken(level, moves):
    _won, broken = play(level, moves)
    return broken


def gates_ok(level, moves=None):
    if not level.get("buttons"):
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    if par_moves(level, cap=len(moves) + 4, ) is None:
        return False
    if solve(level, max_moves=len(moves) + 6, allow_mask=0) is not None:
        return False
    full = ALLOW
    bits = {1 << color_id(b.get("color")) for b in level["buttons"]}
    for bit in bits:
        if solve(level, max_moves=len(moves) + 6, allow_mask=full ^ bit) is not None:
            return False
    if not _pressed_then_crossed(level, moves):
        return False
    opened = clone(level)
    opened["coloredH"] = []
    opened["coloredV"] = []
    free = par_moves(opened, cap=len(moves) + 4)
    return better(len(moves), free, 2)


def _pressed_then_crossed(level, moves):
    """The solution goes through a gate, so the button was used and then crossed.

    Sliding onto a button opens it without a separate press action. The edge
    list only includes a colored edge when that color was already open.
    """
    board = prepare(level)
    for edge in edges_crossed(level, moves):
        if board["colored"].get(edge):
            return True
    return False


def smog_ok(level, moves=None):
    smog = cells_of(level, "smog")
    if len(smog) < 1:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    start = (level["ball"]["row"], level["ball"]["col"])
    flat = set(visited_cells(replay(level, moves)))
    entered = [cell for cell in smog if cell in flat and cell != start]
    if not entered:
        return False
    h, v = wall_lookup(level)
    touching = []
    for r, c in entered:
        for edge, bag, key in (
            (("h", r - 1, c), h, "hWalls"),
            (("h", r, c), h, "hWalls"),
            (("v", r, c - 1), v, "vWalls"),
            (("v", r, c), v, "vWalls"),
        ):
            axis, er, ec = edge
            if (er, ec) in bag and edge not in touching:
                touching.append(edge)
    if not touching:
        return False
    bare = clone(level)
    drop_h = {(r, c) for axis, r, c in touching if axis == "h"}
    drop_v = {(r, c) for axis, r, c in touching if axis == "v"}
    bare["hWalls"] = [e for e in bare.get("hWalls") or [] if (e["row"], e["col"]) not in drop_h]
    bare["vWalls"] = [e for e in bare.get("vWalls") or [] if (e["row"], e["col"]) not in drop_v]
    other = par_moves(bare, cap=len(moves) + 8)
    return better(len(moves), other, 2)


def coins_ok(level, moves=None):
    coins = set(cells_of(level, "coins"))
    if len(coins) < 1:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    bare = par_moves(_strip(level, coins=[]), cap=len(moves))
    if bare is None or len(bare) != len(moves):
        return False
    paths = shortest_visits(level, limit=10)
    if len(paths) < 2:
        return False
    hits = []
    for cells in paths:
        hits.append(coins <= cells)
    return any(hits) and not all(hits)


def collapse_ok(level, moves=None):
    spots = cells_of(level, "collapse")
    if not spots:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    flat = visited_cells(replay(level, moves))
    for cell in spots:
        if flat.count(cell) != 1:
            return False
        if flat[-1] == cell:
            return False
    bare = par_moves(_strip(level, collapse=[]), cap=len(moves) + 16)
    # Enabling: the crumble is a one-time barrier and the par gets worse
    # without it. Restrictive: the short line revisited the cell, so removing
    # the crumble opens a much shorter route.
    return changed(len(moves), bare, GAP)


def jelly_ok(level, moves=None):
    """The par line jumps off a jelly cushion, and without jelly the par collapses.

    A jump is a same-axis step of length 2 that leaves a jelly cell. Removing
    the cushions (the walls the jump ignored stay) must make the board
    unsolvable or at least GAP moves longer. A cushion the line never jumps
    from is decoration.
    """
    cushions = set(cells_of(level, "jelly"))
    if not cushions:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    used = False
    n = level["size"]
    for _action, path, _phase in replay(level, moves):
        for a, b in zip(path, path[1:]):
            dr, dc = b[0] - a[0], b[1] - a[1]
            if a in cushions and (dr == 0 or dc == 0) and abs(dr) + abs(dc) == 2:
                used = True
                break
        if used:
            break
        if len(path) >= 2 and path[-1] in cushions:
            direction = step_dir(path[-2], path[-1])
            if direction and ahead_open(level, path[-1], direction):
                dr, dc = DIR_DELTA[direction]
                lr = path[-1][0] + dr * 2
                lc = path[-1][1] + dc * 2
                if not (0 <= lr < n and 0 <= lc < n):
                    used = True
                    break
    if not used:
        return False
    bare = par_moves(_strip(level, jelly=[]), cap=len(moves) + 16)
    return worse(len(moves), bare)


def _replay_tilts(level, moves):
    """Slides as (action, path, tilts_before). Presses advance the counter."""
    board = prepare(level)
    r, c = board["ball"]
    gstate = act = collapse = phase = tilts = 0
    out = []
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, ALLOW)
            tilts = _bump_tilts(board, tilts)
            continue
        res = tilt(board, r, c, DIR_INDEX[action], gstate, act, ALLOW, collapse, phase, tilts)
        r, c, gstate, act, moved, _won, collapse, phase, path = res
        out.append((action, path, tilts))
        if moved:
            tilts = _bump_tilts(board, tilts)
    return out


def magma_ok(level, moves=None):
    """Timing is the trick: pass a vent before it erupts, or stop on the new crust.

    Pass-before: the line enters the cell while tilts < at. Forcing at=0 (the
    cell is crust from the start) must raise par by GAP or make it unsolvable.
    Deleting the vent can leave that early path intact, so par may not change.
    That is expected. The binding test is the closed vent.

    Stopper: a tilt ends with the next cell erupted, and that edge is not a
    wall. Removing the vents must raise par by GAP or make it unsolvable.
    A vent the line can never reach before `at` is just a wall and fails.
    A level may use either kind. Each kind that appears must pass its test.
    """
    vents = level.get("magma") or []
    if not vents:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    schedule = {(v["row"], v["col"]): int(v["at"]) for v in vents}
    entered = set()
    stopped = False
    for action, path, tilts in _replay_tilts(level, moves):
        for cell in path:
            at = schedule.get(cell)
            if at is not None and tilts < at:
                entered.add(cell)
        if not path:
            continue
        dr, dc = DIR_DELTA[action]
        ahead = (path[-1][0] + dr, path[-1][1] + dc)
        at = schedule.get(ahead)
        if at is None or tilts < at:
            continue
        if ahead_open(level, path[-1], action):
            stopped = True
    if not entered and not stopped:
        return False
    if entered:
        closed = clone(level)
        closed["magma"] = [{**v, "at": 0} for v in vents]
        if not worse(len(moves), par_moves(closed, cap=len(moves) + 16)):
            return False
    if stopped:
        bare = par_moves(_strip(level, magma=[]), cap=len(moves) + 16)
        if not worse(len(moves), bare):
            return False
    return True


def movers_ok(level, moves=None):
    shifters = level.get("shifters") or []
    if not shifters:
        return False
    moves = moves or par_moves(level)
    if not moves:
        return False
    if not _crosses_open_shifter(level, moves):
        return False
    bare = par_moves(_strip(level, shifters=[]), cap=len(moves) + 16)
    return changed(len(moves), bare)


def _crosses_open_shifter(level, moves):
    pairs = []
    for shifter in level.get("shifters") or []:
        home = (shifter["home"]["axis"], shifter["home"]["row"], shifter["home"]["col"])
        alt = (shifter["alt"]["axis"], shifter["alt"]["row"], shifter["alt"]["col"])
        pairs.append((home, alt))
    for _action, path, phase in replay(level, moves):
        active = [alt if phase & 1 else home for home, alt in pairs]
        idle = [home if phase & 1 else alt for home, alt in pairs]
        for a, b in zip(path, path[1:]):
            edge = edge_of(a, b)
            if edge is None:
                continue
            for block, free in zip(active, idle):
                if edge == free and edge != block:
                    return True
    return False


CHECKS = {
    "sand": sand_ok,
    "ice": ice_ok,
    "oneway": oneway_ok,
    "teleport": teleport_ok,
    "glass": glass_ok,
    "gates": gates_ok,
    "smog": smog_ok,
    "coins": coins_ok,
    "collapse": collapse_ok,
    "jelly": jelly_ok,
    "magma": magma_ok,
    "movers": movers_ok,
}


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
    if level.get("glassH") or level.get("glassV"):
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


def all_necessary(level, moves=None):
    moves = moves or par_moves(level)
    if not moves:
        return False
    return all(CHECKS[name](level, moves) for name in mechanic_names(level))


def shortest_visits(level, limit=8, cap=42):
    """Up to `limit` distinct shortest solutions, as sets of visited cells."""
    board = prepare(level)
    n = board["n"]
    br, bc = board["ball"]
    hole = board["hole"]
    start = (br * n + bc, 0, 0, 0, 0, 0)
    dist = {start: 0}
    prevs = {start: []}
    q = deque([start])
    winning = []
    best = None
    while q:
        state = q.popleft()
        depth = dist[state]
        if best is not None and depth > best:
            break
        if depth >= cap:
            continue
        pos, gstate, act, collapse, phase, tilts = state
        r, c = divmod(pos, n)
        if board["buttons"]:
            new_act = _activate(board, r, c, act, ALLOW)
            if new_act != act:
                nxt = (pos, gstate, new_act, collapse, phase, _bump_tilts(board, tilts))
                _link(dist, prevs, q, state, nxt, "press", depth)
        for dir_i, (name, _dr, _dc) in enumerate(DIRS):
            nr, nc, ng, na, moved, won, ncoll, nphase, _path = tilt(
                board, r, c, dir_i, gstate, act, ALLOW, collapse, phase, tilts
            )
            if not moved:
                continue
            if won:
                if best is None:
                    best = depth + 1
                if depth + 1 == best:
                    winning.append((state, name))
                continue
            nxt = (nr * n + nc, ng, na, ncoll, nphase, _bump_tilts(board, tilts))
            _link(dist, prevs, q, state, nxt, name, depth)
    if best is None:
        return []
    # Reconstruct a handful of move lists, then their cell sets.
    found = []
    seen = set()
    steps = [0]

    def walk(state, actions):
        steps[0] += 1
        if steps[0] > 2500 or len(found) >= limit:
            return
        if state == start:
            moves = tuple(reversed(actions))
            if moves in seen:
                return
            seen.add(moves)
            found.append(set(visited_cells(replay(level, moves))) | {(br, bc)})
            return
        for parent, action in prevs.get(state, [])[:3]:
            actions.append(action)
            walk(parent, actions)
            actions.pop()

    for state, action in winning:
        if len(found) >= limit:
            break
        walk(state, [action])
    return found


def _link(dist, prevs, q, state, nxt, action, depth):
    nd = depth + 1
    if nxt not in dist:
        dist[nxt] = nd
        prevs[nxt] = [(state, action)]
        q.append(nxt)
    elif dist[nxt] == nd and len(prevs[nxt]) < 4:
        prevs[nxt].append((state, action))


def state_count(level, cap_states=80, cap_moves=42):
    board = prepare(level)
    n = board["n"]
    br, bc = board["ball"]
    start = (br * n + bc, 0, 0, 0, 0, 0)
    dist = {start: 0}
    q = deque([start])
    while q and len(dist) < cap_states:
        state = q.popleft()
        depth = dist[state]
        if depth >= cap_moves:
            continue
        pos, gstate, act, collapse, phase, tilts = state
        r, c = divmod(pos, n)
        for dir_i, _dir in enumerate(DIRS):
            nr, nc, ng, na, moved, won, ncoll, nphase, _path = tilt(
                board, r, c, dir_i, gstate, act, ALLOW, collapse, phase, tilts
            )
            if not moved or won:
                continue
            nxt = (nr * n + nc, ng, na, ncoll, nphase, _bump_tilts(board, tilts))
            if nxt not in dist:
                dist[nxt] = depth + 1
                q.append(nxt)
    return len(dist)


def interestingness(level, moves):
    interactions = len(mechanic_names(level)) or 1
    extra = 0
    if level.get("sand") or level.get("ice") or level.get("oneWay") or level.get("teleports"):
        extra += 2
    branches = len(shortest_visits(level, limit=4, cap=len(moves) + 2))
    branch_bonus = 3 if 2 <= branches <= 3 else 0
    return len(moves) * 3 + interactions * 4 + extra + min(state_count(level), 80) / 10 + branch_bonus


# --- dihedral gallery -------------------------------------------------------

def _rot90(r, c, n):
    return c, n - 1 - r


def _mirror(r, c, n):
    return r, n - 1 - c


def map_cell(sym, r, c, n):
    if sym >= 4:
        r, c = _mirror(r, c, n)
        sym -= 4
    for _ in range(sym):
        r, c = _rot90(r, c, n)
    return r, c


def map_edge(sym, axis, r, c, n):
    if axis == "h":
        a, b = (r, c), (r + 1, c)
    else:
        a, b = (r, c), (r, c + 1)
    a = map_cell(sym, a[0], a[1], n)
    b = map_cell(sym, b[0], b[1], n)
    if a[0] == b[0]:
        return ("v", a[0], min(a[1], b[1]))
    return ("h", min(a[0], b[0]), a[1])


def map_dir(sym, direction, n):
    dr, dc = DIR_DELTA[direction]
    # (1, 1) stays in range for every symmetry when n >= 3.
    p = map_cell(sym, 1, 1, n)
    q = map_cell(sym, 1 + dr, 1 + dc, n)
    return DELTA_NAME[(q[0] - p[0], q[1] - p[1])]


def _edge_tuples(level, key, sym):
    n = level["size"]
    out = []
    for edge in level.get(key) or []:
        axis = "h" if key.lower().endswith("h") or key in ("hWalls", "glassH", "coloredH") else "v"
        if key in ("hWalls", "glassH", "coloredH"):
            axis = "h"
        elif key in ("vWalls", "glassV", "coloredV"):
            axis = "v"
        mapped = map_edge(sym, axis, edge["row"], edge["col"], n)
        color = edge.get("color")
        out.append(mapped if not color else (*mapped, color))
    return tuple(sorted(out))


def layout_tuple(level, sym):
    n = level["size"]
    ball = map_cell(sym, level["ball"]["row"], level["ball"]["col"], n)
    hole = map_cell(sym, level["hole"]["row"], level["hole"]["col"], n)
    one = []
    for edge in level.get("oneWay") or []:
        mapped = map_edge(sym, edge["axis"], edge["row"], edge["col"], n)
        one.append((*mapped, map_dir(sym, edge["dir"], n)))
    ports = []
    for pair in level.get("teleports") or []:
        a = map_cell(sym, pair["a"]["row"], pair["a"]["col"], n)
        b = map_cell(sym, pair["b"]["row"], pair["b"]["col"], n)
        ports.append(tuple(sorted((a, b))))
    shifts = []
    for shifter in level.get("shifters") or []:
        home = map_edge(sym, shifter["home"]["axis"], shifter["home"]["row"], shifter["home"]["col"], n)
        alt = map_edge(sym, shifter["alt"]["axis"], shifter["alt"]["row"], shifter["alt"]["col"], n)
        shifts.append(tuple(sorted((home, alt))))
    buttons = []
    for button in level.get("buttons") or []:
        cell = map_cell(sym, button["row"], button["col"], n)
        buttons.append((*cell, button.get("color", "red")))
    return (
        n,
        ball,
        hole,
        _edge_tuples(level, "hWalls", sym),
        _edge_tuples(level, "vWalls", sym),
        _edge_tuples(level, "glassH", sym),
        _edge_tuples(level, "glassV", sym),
        _edge_tuples(level, "coloredH", sym),
        _edge_tuples(level, "coloredV", sym),
        tuple(sorted(buttons)),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "sand"))),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "ice"))),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "smog"))),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "coins"))),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "collapse"))),
        tuple(sorted(map_cell(sym, r, c, n) for r, c in cells_of(level, "jelly"))),
        tuple(sorted(
            (*map_cell(sym, v["row"], v["col"], n), int(v["at"]))
            for v in level.get("magma") or []
        )),
        tuple(sorted(one)),
        tuple(sorted(ports)),
        tuple(sorted(shifts)),
    )


def canonical(level):
    return min(layout_tuple(level, sym) for sym in range(8))


def wall_edges(level, sym=0):
    n = level["size"]
    edges = []
    for edge in level.get("hWalls") or []:
        edges.append(map_edge(sym, "h", edge["row"], edge["col"], n))
    for edge in level.get("vWalls") or []:
        edges.append(map_edge(sym, "v", edge["row"], edge["col"], n))
    return frozenset(edges)


def ball_hole(level, sym=0):
    n = level["size"]
    ball = map_cell(sym, level["ball"]["row"], level["ball"]["col"], n)
    hole = map_cell(sym, level["hole"]["row"], level["hole"]["col"], n)
    return ball, hole


def near_duplicate(level, other):
    """Same size and, under some symmetry, nearly the same walls.

    Jaccard >= 0.85, or at most two wall edges differ while the ball and hole
    land on the same squares.
    """
    if level["size"] != other["size"]:
        return False
    # 3x3 and 4x4 have too few distinct shapes for a fuzzy wall match
    # across a dozen planets. Exact dihedral duplicates are still rejected.
    if level["size"] < 5:
        return False
    other_walls = wall_edges(other, 0)
    other_ends = ball_hole(other, 0)
    for sym in range(8):
        mine = wall_edges(level, sym)
        union = mine | other_walls
        if not union:
            jaccard = 1.0
        else:
            jaccard = len(mine & other_walls) / len(union)
        hamming = len(mine ^ other_walls)
        if jaccard >= 0.85:
            return True
        if hamming <= 2 and ball_hole(level, sym) == other_ends:
            return True
    return False


class Gallery:
    def __init__(self):
        self.sigs = set()
        self.levels = []

    def reject_reason(self, level):
        sig = canonical(level)
        if sig in self.sigs:
            return "dihedral duplicate"
        for prev in self.levels:
            if near_duplicate(level, prev):
                return "near-duplicate walls"
        return None

    def add(self, level):
        self.sigs.add(canonical(level))
        self.levels.append(clone(level))
