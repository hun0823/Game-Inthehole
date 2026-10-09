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

    return {
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
    }


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


def tilt(board, r, c, dir_i, gstate, act, allow_mask):
    """One tilt. Returns (nr, nc, gstate, act, spent, won)."""
    n = board["n"]
    hole = board["hole"]
    dr, dc = DIRS[dir_i][1], DIRS[dir_i][2]
    table = board["leave"][dir_i]
    new_act = _activate(board, r, c, act, allow_mask)
    moved = False
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
        moved = True
        new_act = _activate(board, r, c, new_act, allow_mask)
        if (r, c) == hole:
            return r, c, gstate, new_act, True, True
    spent = moved or new_act != act
    return r, c, gstate, new_act, spent, False


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
    start = (br * n + bc, 0, 0)
    parent = {start: (None, None)}
    q = deque([(start, 0)])
    buttons = board["buttons"]
    while q:
        state, depth = q.popleft()
        if depth >= max_moves:
            continue
        pos, gstate, act = state
        r, c = divmod(pos, n)
        if buttons and allow_mask:
            for brr, bcc, bit in buttons:
                if r == brr and c == bcc and (bit & allow_mask) and not (act & bit):
                    nxt = (pos, gstate, act | bit)
                    if nxt not in parent:
                        parent[nxt] = (state, "press")
                        q.append((nxt, depth + 1))
        for dir_i, (name, _dr, _dc) in enumerate(DIRS):
            nr, nc, ng, na, spent, won = tilt(board, r, c, dir_i, gstate, act, allow_mask)
            if not spent:
                continue
            if won:
                # reconstruct including this tilt
                moves = [name]
                cur = state
                while parent[cur][0] is not None:
                    prev, action = parent[cur]
                    if action is not None:
                        moves.append(action)
                    cur = prev
                moves.reverse()
                return tuple(moves)
            nxt = (nr * n + nc, ng, na)
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
    broken = set()
    won = (r, c) == board["hole"] and not moves
    for action in moves:
        if won:
            break
        before = gstate
        if action == "press":
            act = _activate(board, r, c, act, allow_mask)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        r, c, gstate, act, _spent, won = tilt(board, r, c, dir_i, gstate, act, allow_mask)
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
    act = (1 << len(COLOR_IDS)) - 1
    # follow moves with buttons allowed
    allow = act
    act = 0
    broken = set()
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, allow)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        before = gstate
        r, c, gstate, act, spent, won = tilt(board, r, c, dir_i, gstate, act, allow)
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
    crossed = []
    n = board["n"]
    for action in moves:
        if action == "press":
            act = _activate(board, r, c, act, allow)
            continue
        dir_i = next(i for i, (name, _, _) in enumerate(DIRS) if name == action)
        dr, dc = DIRS[dir_i][1], DIRS[dir_i][2]
        table = board["leave"][dir_i]
        new_act = _activate(board, r, c, act, allow)
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
                        break
                    if st == 1:
                        gstate = _set_digit(gstate, gi, 2)
            crossed.append(edge)
            r += dr
            c += dc
            new_act = _activate(board, r, c, new_act, allow)
            if (r, c) == board["hole"]:
                act = new_act
                return crossed
        act = new_act
    return crossed
