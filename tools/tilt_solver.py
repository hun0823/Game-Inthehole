"""Edge-wall tilt solver. Rules match js/game.js (slide, 2-hit glass, colored gates).

Walls, glass, and colored gates are edges between adjacent cells:
  h edge (r, c) sits between row r and r+1 in column c   (r < size-1, c < size)
  v edge (r, c) sits between col c and c+1 in row r      (r < size, c < size-1)
A tilt slides until a border, a solid wall, a closed colored gate, or an
intact glass pane (first hit cracks and stops; second hit breaks and continues).
Standing on a button and spending a move opens that color. A tilt that starts
on a button opens it before the slide, so one move can open and then pass a gate.
"""

from collections import deque

DIRS = (
    ("up", -1, 0),
    ("down", 1, 0),
    ("left", 0, -1),
    ("right", 0, 1),
)

COLOR_IDS = {"red": 0, "blue": 1, "green": 2, "purple": 3}


def color_id(name):
    return COLOR_IDS.get(name or "red", 0)


def _bit(edges, key_fn):
    mask = 0
    for edge in edges:
        mask |= 1 << key_fn(edge)
    return mask


def prepare(level):
    n = level["size"]
    h_edges = [(e["row"], e["col"]) for e in level.get("hWalls") or []]
    v_edges = [(e["row"], e["col"]) for e in level.get("vWalls") or []]
    h_mask = 0
    for r, c in h_edges:
        h_mask |= 1 << (r * n + c)
    v_mask = 0
    for r, c in v_edges:
        v_mask |= 1 << (r * (n - 1) + c)

    glass = []
    glass_index = {}
    for e in level.get("glassH") or []:
        key = ("h", e["row"], e["col"])
        glass_index[key] = len(glass)
        glass.append(key)
    for e in level.get("glassV") or []:
        key = ("v", e["row"], e["col"])
        glass_index[key] = len(glass)
        glass.append(key)

    colored = {}
    for e in level.get("coloredH") or []:
        colored[("h", e["row"], e["col"])] = 1 << color_id(e.get("color"))
    for e in level.get("coloredV") or []:
        colored[("v", e["row"], e["col"])] = 1 << color_id(e.get("color"))

    buttons = []
    for b in level.get("buttons") or []:
        buttons.append((b["row"], b["col"], 1 << color_id(b.get("color"))))

    # dir slot -> for each cell, (blocked_by_border, edge_key or None)
    # precomputed edge crossed when leaving (r, c) in that direction
    leave = []
    for dr, dc, name in ((-1, 0, "up"), (1, 0, "down"), (0, -1, "left"), (0, 1, "right")):
        table = [None] * (n * n)
        for r in range(n):
            for c in range(n):
                nr, nc = r + dr, c + dc
                if nr < 0 or nc < 0 or nr >= n or nc >= n:
                    table[r * n + c] = None  # border
                elif name == "right":
                    table[r * n + c] = ("v", r, c)
                elif name == "left":
                    table[r * n + c] = ("v", r, nc)
                elif name == "down":
                    table[r * n + c] = ("h", r, c)
                else:
                    table[r * n + c] = ("h", nr, c)
        leave.append(table)

    def cells(key):
        return [(e["row"], e["col"]) for e in level.get(key) or []]

    ice = set(cells("ice"))
    sand = set(cells("sand"))
    collapse = cells("collapse")
    one_ways = {}
    for edge in level.get("oneWay") or []:
        one_ways[(edge["axis"], edge["row"], edge["col"])] = edge["dir"]
    teleport = {}
    for pair in level.get("teleports") or []:
        a = (pair["a"]["row"], pair["a"]["col"])
        b = (pair["b"]["row"], pair["b"]["col"])
        teleport[a] = b
        teleport[b] = a
    shifters = []
    for shifter in level.get("shifters") or []:
        home = shifter["home"]
        alt = shifter["alt"]
        shifters.append((
            (home["axis"], home["row"], home["col"]),
            (alt["axis"], alt["row"], alt["col"]),
        ))
    board = {
        "n": n,
        "h_mask": h_mask,
        "v_mask": v_mask,
        "glass": glass,
        "glass_index": glass_index,
        "colored": colored,
        "buttons": buttons,
        "leave": leave,
        "ball": (level["ball"]["row"], level["ball"]["col"]),
        "hole": (level["hole"]["row"], level["hole"]["col"]),
        "gcount": len(glass),
        "ice": ice,
        "sand": sand,
        "collapse_index": {cell: 1 << i for i, cell in enumerate(collapse)},
        "one_ways": one_ways,
        "teleport": teleport,
        "shifters": shifters,
        "jelly": set(cells("jelly")),
        "magma": {(vent["row"], vent["col"]): int(vent["at"]) for vent in level.get("magma") or []},
    }
    board["magma_cap"] = max(board["magma"].values()) if board["magma"] else 0
    board["special"] = bool(
        ice or sand or collapse or one_ways or teleport or shifters or board["jelly"] or board["magma"]
    )
    return board


def _wall_at(board, edge):
    if edge is None:
        return True
    axis, r, c = edge
    n = board["n"]
    if axis == "h":
        return (board["h_mask"] >> (r * n + c)) & 1
    return (board["v_mask"] >> (r * (n - 1) + c)) & 1


def _glass_digit(state, index):
    return (state // (3**index)) % 3


def _set_digit(state, index, val):
    base = 3**index
    cur = (state // base) % 3
    return state + (val - cur) * base


def _activate(board, r, c, act, allow_mask):
    for br, bc, bit in board["buttons"]:
        if r == br and c == bc and (bit & allow_mask) and not (act & bit):
            act |= bit
    return act


def _magma_blocks(board, cell, tilts):
    """Erupted magma cannot be entered. The cell under the ball is not re-checked."""
    at = board["magma"].get(cell)
    return at is not None and tilts >= at


def _bump_tilts(board, tilts):
    cap = board["magma_cap"]
    return tilts if tilts >= cap else tilts + 1


def _shifter_blocks(board, edge, phase):
    if edge is None:
        return False
    for home, alt in board["shifters"]:
        if (alt if phase & 1 else home) == edge:
            return True
    return False


def tilt(board, r, c, dir_i, gstate, act, allow_mask, collapse=0, phase=0, tilts=0):
    """One tilt.

    Returns (nr, nc, gstate, act, spent, won, collapse, phase, path).
    `spent` is true when the ball moved or glass took a hit. A button that
    opens only because the ball is carried onto it is included in `act`;
    opening a button without moving does not spend the tilt (press does that).
    `tilts` is the count of spent tilts already completed BEFORE this one.
    The slide uses that count for the whole move; callers increment it after
    a spent tilt or a press. Behavior is identical once tilts reaches magma_cap.

    Jelly: rolling INTO a jelly cell (not starting a tilt already on one)
    jumps two cells ahead in the travel direction and keeps sliding. The jump
    ignores every edge between the jelly and the landing cell (walls, glass,
    gates, one-ways, shifting walls). Glass on a jumped edge does not crack.
    The skipped cell is not entered. If the landing cell is out of bounds,
    erupted magma, or a crumbled floor, the ball stops on the jelly and the
    tilt ends, even on ice. Landing on jelly jumps again (bounded). After a
    successful landing, the hole wins, sand stops, and ice applies to that
    landing cell.

    Magma: a vent {row, col, at} is blocked once completed spent tilts >= at.
    The ball cannot enter it. Standing on it when it erupts does not bury the
    ball; leaving is allowed and re-entry is not. Telegraph (tilts == at-1)
    is visual only.

    Ice, sand, teleports, one-ways, crumbling floors, and shifting walls match
    the comments on slide() in js/game.js. Boards without those use the
    original slide-until-blocked rule.
    """
    n = board["n"]
    hole = board["hole"]
    name, dr, dc = DIRS[dir_i]
    table = board["leave"][dir_i]
    new_act = _activate(board, r, c, act, allow_mask)
    path = [(r, c)]
    moved = False

    def done(won):
        next_phase = phase ^ 1 if board["shifters"] and moved else phase
        return r, c, gstate, new_act, moved, won, collapse, next_phase, path

    if not board["special"]:
        while True:
            edge = table[r * n + c]
            if _wall_at(board, edge):
                break
            bit = board["colored"].get(edge) if edge is not None else None
            if bit and not (new_act & bit):
                break
            if edge is not None:
                gi = board["glass_index"].get(edge)
                if gi is not None:
                    st = _glass_digit(gstate, gi)
                    if st == 0:
                        gstate = _set_digit(gstate, gi, 1)
                        moved = True
                        break
                    if st == 1:
                        gstate = _set_digit(gstate, gi, 2)
            r += dr
            c += dc
            path.append((r, c))
            moved = True
            new_act = _activate(board, r, c, new_act, allow_mask)
            if (r, c) == hole:
                return done(True)
        return done(False)

    ice_run = (r, c) in board["ice"]
    limit = n * n * 6

    def jelly_chain():
        """Jump from a jelly cell just entered. Returns 'won', 'stop', or 'go'."""
        nonlocal r, c, new_act, collapse, moved
        guard = 0
        while (r, c) in board["jelly"] and guard < n * 2:
            guard += 1
            lr, lc = r + dr * 2, c + dc * 2
            if lr < 0 or lc < 0 or lr >= n or lc >= n:
                return "stop"
            if _magma_blocks(board, (lr, lc), tilts):
                return "stop"
            land_bit = board["collapse_index"].get((lr, lc))
            if land_bit and collapse & land_bit:
                return "stop"
            prev_bit = board["collapse_index"].get((r, c))
            if prev_bit:
                collapse |= prev_bit
            r, c = lr, lc
            path.append((r, c))
            moved = True
            new_act = _activate(board, r, c, new_act, allow_mask)
            if (r, c) == hole:
                return "won"
            if (r, c) in board["sand"]:
                return "stop"
        return "go"

    for _ in range(limit):
        edge = table[r * n + c]
        if _wall_at(board, edge):
            break
        bit = board["colored"].get(edge) if edge is not None else None
        if bit and not (new_act & bit):
            break
        if edge is not None and board["one_ways"].get(edge) not in (None, name):
            break
        if _shifter_blocks(board, edge, phase):
            break
        nr, nc = r + dr, c + dc
        cell_bit = board["collapse_index"].get((nr, nc))
        if cell_bit and collapse & cell_bit:
            break
        if _magma_blocks(board, (nr, nc), tilts):
            break
        if edge is not None:
            gi = board["glass_index"].get(edge)
            if gi is not None:
                st = _glass_digit(gstate, gi)
                if st == 0:
                    gstate = _set_digit(gstate, gi, 1)
                    moved = True
                    if (r, c) not in board["ice"]:
                        break
                elif st == 1:
                    gstate = _set_digit(gstate, gi, 2)
        hop = board["teleport"].get((nr, nc))
        dest_r, dest_c = nr, nc
        via = None
        if hop:
            exit_bit = board["collapse_index"].get(hop)
            if exit_bit and collapse & exit_bit:
                break
            if _magma_blocks(board, hop, tilts):
                break
            via = (nr, nc)
            dest_r, dest_c = hop
        prev_bit = board["collapse_index"].get((r, c))
        if prev_bit:
            collapse |= prev_bit
        moved = True
        if via:
            path.append(via)
        r, c = dest_r, dest_c
        path.append((r, c))
        new_act = _activate(board, r, c, new_act, allow_mask)
        if (r, c) == hole:
            return done(True)
        if (r, c) in board["sand"]:
            break
        if (r, c) in board["jelly"]:
            outcome = jelly_chain()
            if outcome == "won":
                return done(True)
            if outcome == "stop":
                break
        now_ice = (r, c) in board["ice"]
        if ice_run and not now_ice:
            break
        if now_ice:
            ice_run = True
    if moved:
        rest_bit = board["collapse_index"].get((r, c))
        if rest_bit:
            collapse |= rest_bit
    return done(False)


def solve(level, max_moves=40, allow_mask=None):
    """Shortest move list (tilt names and 'press') or None if unsolvable within cap.

    allow_mask: bit mask of colors the ball is allowed to open. None = all.
    0 = gates stay shut (button presses do nothing).
    """
    board = prepare(level)
    if allow_mask is None:
        allow_mask = (1 << len(COLOR_IDS)) - 1
    return _solve_board(board, max_moves, allow_mask)


def _solve_board(board, max_moves, allow_mask):
    n = board["n"]
    br, bc = board["ball"]
    hole_r, hole_c = board["hole"]
    if (br, bc) == (hole_r, hole_c):
        return ()
    start = (br * n + bc, 0, 0, 0, 0, 0)
    parent = {start: (None, None)}
    q = deque([(start, 0)])
    buttons = board["buttons"]
    while q:
        state, depth = q.popleft()
        if depth >= max_moves:
            continue
        pos, gstate, act, collapse, phase, tilts = state
        r, c = divmod(pos, n)
        if buttons and allow_mask:
            for brr, bcc, bit in buttons:
                if r == brr and c == bcc and (bit & allow_mask) and not (act & bit):
                    nxt = (pos, gstate, act | bit, collapse, phase, _bump_tilts(board, tilts))
                    if nxt not in parent:
                        parent[nxt] = (state, "press")
                        q.append((nxt, depth + 1))
        for dir_i, (name, _dr, _dc) in enumerate(DIRS):
            nr, nc, ng, na, moved, won, ncoll, nphase, _path = tilt(
                board, r, c, dir_i, gstate, act, allow_mask, collapse, phase, tilts
            )
            if not moved:
                continue
            if won:
                moves = [name]
                cur = state
                while parent[cur][0] is not None:
                    prev, action = parent[cur]
                    if action is not None:
                        moves.append(action)
                    cur = prev
                moves.reverse()
                return tuple(moves)
            nxt = (nr * n + nc, ng, na, ncoll, nphase, _bump_tilts(board, tilts))
            if nxt not in parent:
                parent[nxt] = (state, name)
                q.append((nxt, depth + 1))
    return None


def par_of(level, max_moves=40, allow_mask=None):
    moves = solve(level, max_moves=max_moves, allow_mask=allow_mask)
    if moves is None:
        return None
    return len(moves)


def play(level, moves, allow_mask=None):
    """Replay a move list. Returns (won, glass_broken_count)."""
    board = prepare(level)
    if allow_mask is None:
        allow_mask = (1 << len(COLOR_IDS)) - 1
    r, c = board["ball"]
    gstate = 0
    act = 0
    collapse = 0
    phase = 0
    tilts = 0
    broken = set()
    won = (r, c) == board["hole"] and not moves
    for action in moves:
        if won:
            break
        before = gstate
        if action == "press":
            act = _activate(board, r, c, act, allow_mask)
            tilts = _bump_tilts(board, tilts)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        r, c, gstate, act, moved, won, collapse, phase, _path = tilt(
            board, r, c, dir_i, gstate, act, allow_mask, collapse, phase, tilts
        )
        if moved:
            tilts = _bump_tilts(board, tilts)
        for i in range(board["gcount"]):
            if _glass_digit(before, i) != 2 and _glass_digit(gstate, i) == 2:
                broken.add(i)
    return won, len(broken)


def glass_broken_on(level, moves):
    """How many glass panes the move list shatters (reach state 2)."""
    board = prepare(level)
    if not board["gcount"]:
        return 0
    r, c = board["ball"]
    gstate = 0
    act = 0
    allow = (1 << len(COLOR_IDS)) - 1
    collapse = 0
    phase = 0
    tilts = 0
    broken = set()
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, allow)
            tilts = _bump_tilts(board, tilts)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        before = gstate
        r, c, gstate, act, moved, won, collapse, phase, _path = tilt(
            board, r, c, dir_i, gstate, act, allow, collapse, phase, tilts
        )
        if moved:
            tilts = _bump_tilts(board, tilts)
        for i in range(board["gcount"]):
            if _glass_digit(before, i) != 2 and _glass_digit(gstate, i) == 2:
                broken.add(i)
        if won:
            break
    return len(broken)


def edges_crossed(level, moves):
    """Open edges the ball actually travels across (not borders, not stops on intact glass)."""
    board = prepare(level)
    r, c = board["ball"]
    gstate = 0
    act = 0
    allow = (1 << len(COLOR_IDS)) - 1
    collapse = 0
    phase = 0
    tilts = 0
    crossed = []
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, allow)
            tilts = _bump_tilts(board, tilts)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        _nr, _nc, gstate, act, moved, won, collapse, phase, path = tilt(
            board, r, c, dir_i, gstate, act, allow, collapse, phase, tilts
        )
        if moved:
            tilts = _bump_tilts(board, tilts)
        for i in range(1, len(path)):
            a = path[i - 1]
            b = path[i]
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
                continue
            if a[0] != b[0]:
                crossed.append(("h", min(a[0], b[0]), a[1]))
            else:
                crossed.append(("v", a[0], min(a[1], b[1])))
        r, c = path[-1]
        if won:
            break
    return crossed
