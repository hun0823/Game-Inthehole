#!/usr/bin/env python3

"""levels.json — BFS solvability (Unity GameSimulation rules, glass 2-hit)."""

import json

import sys

from collections import deque

from copy import deepcopy

from pathlib import Path



DIRS = {

    "up": (-1, 0),

    "down": (1, 0),

    "left": (0, -1),

    "right": (0, 1),

}





def build_walls(size, pillars):

    h = [[False] * size for _ in range(size - 1)]

    v = [[False] * (size - 1) for _ in range(size)]

    for p in pillars:

        r, c = p["row"], p["col"]

        if r > 0:

            h[r - 1][c] = True

        if r < size - 1:

            h[r][c] = True

        if c > 0:

            v[r][c - 1] = True

        if c < size - 1:

            v[r][c] = True

    return h, v





def build_glass(size, level):

    h = [[False] * size for _ in range(size - 1)]

    v = [[False] * (size - 1) for _ in range(size)]

    for e in level.get("glassH", []) or []:

        h[e["row"]][e["col"]] = True

    for e in level.get("glassV", []) or []:

        v[e["row"]][e["col"]] = True

    return h, v


def build_colored(size, level):

    h = [[None] * size for _ in range(size - 1)]

    v = [[None] * (size - 1) for _ in range(size)]

    for e in level.get("coloredH", []) or []:

        h[e["row"]][e["col"]] = e.get("color", "red")

    for e in level.get("coloredV", []) or []:

        v[e["row"]][e["col"]] = e.get("color", "red")

    return h, v


def build_buttons(level):

    out = []

    for b in level.get("buttons", []) or []:

        out.append((b["row"], b["col"], b.get("color", "red")))

    return out


def is_colored_blocked(r, c, direction, size, h_col, v_col, activated):

    dr, dc = DIRS[direction]

    nr, nc = r + dr, c + dc

    if nr < 0 or nc < 0 or nr >= size or nc >= size:

        return False

    color = None

    if direction == "right":

        color = v_col[r][c]

    elif direction == "left":

        color = v_col[r][nc]

    elif direction == "down":

        color = h_col[r][c]

    elif direction == "up":

        color = h_col[nr][c]

    return color is not None and color not in activated


def is_solid_blocked(r, c, direction, size, h, v):

    dr, dc = DIRS[direction]

    nr, nc = r + dr, c + dc

    if nr < 0 or nc < 0 or nr >= size or nc >= size:

        return True

    if direction == "right":

        return v[r][c]

    if direction == "left":

        return v[r][nc]

    if direction == "down":

        return h[r][c]

    if direction == "up":

        return h[nr][c]

    return True





def glass_edge(r, c, direction, size, h_glass, v_glass):

    dr, dc = DIRS[direction]

    nr, nc = r + dr, c + dc

    if nr < 0 or nc < 0 or nr >= size or nc >= size:

        return None

    if direction == "right" and v_glass[r][c]:

        return ("v", r, c)

    if direction == "left" and v_glass[r][nc]:

        return ("v", r, nc)

    if direction == "down" and h_glass[r][c]:

        return ("h", r, c)

    if direction == "up" and h_glass[nr][c]:

        return ("h", nr, c)

    return None





def glass_fingerprint(h_glass, v_glass, h_stress, v_stress):

    parts = []

    for r, row in enumerate(h_glass):

        for c, on in enumerate(row):

            if on:

                parts.append(f"H{r},{c}:{1 if h_stress[r][c] else 0}")

    for r, row in enumerate(v_glass):

        for c, on in enumerate(row):

            if on:

                parts.append(f"V{r},{c}:{1 if v_stress[r][c] else 0}")

    return ";".join(parts)





def activated_fingerprint(activated):

    if not activated:

        return ""

    return ",".join(sorted(activated))


def state_key(ball, h_glass, v_glass, h_stress, v_stress, activated=None):

    act = activated_fingerprint(activated or set())

    return f"{ball[0]},{ball[1]}|{glass_fingerprint(h_glass, v_glass, h_stress, v_stress)}|{act}"





def try_activate_button(ball, buttons, activated, h_col, v_col):

    for br, bc, color in buttons:

        if ball != (br, bc) or color in activated:

            continue

        activated.add(color)

        for r in range(len(h_col)):

            for c in range(len(h_col[0])):

                if h_col[r][c] == color:

                    h_col[r][c] = None

        for r in range(len(v_col)):

            for c in range(len(v_col[0])):

                if v_col[r][c] == color:

                    v_col[r][c] = None

        return True

    return False


def can_press_button(ball, buttons, activated):

    for br, bc, color in buttons:

        if ball == (br, bc) and color not in activated:

            return True

    return False


def simulate_tilt(
    ball, hole, size, h, v, h_glass, v_glass, h_stress, v_stress, direction,
    h_col=None, v_col=None, activated=None, buttons=None, auto_activate=True,
):

    h_glass = deepcopy(h_glass)

    v_glass = deepcopy(v_glass)

    h_stress = deepcopy(h_stress)

    v_stress = deepcopy(v_stress)

    h_col = deepcopy(h_col) if h_col is not None else None

    v_col = deepcopy(v_col) if v_col is not None else None

    activated = set(activated) if activated is not None else set()

    buttons = buttons or []



    dr, dc = DIRS[direction]

    path = [ball]

    r, c = ball

    moved = False

    if auto_activate and try_activate_button(ball, buttons, activated, h_col, v_col):

        moved = True

    while True:

        if is_solid_blocked(r, c, direction, size, h, v):

            break

        if h_col is not None and is_colored_blocked(r, c, direction, size, h_col, v_col, activated):

            break



        edge = glass_edge(r, c, direction, size, h_glass, v_glass)

        if edge:

            kind, er, ec = edge

            if kind == "h":

                if h_stress[er][ec]:

                    h_glass[er][ec] = False

                    h_stress[er][ec] = False

                else:

                    h_stress[er][ec] = True
                    moved = True
                    break

            else:

                if v_stress[er][ec]:

                    v_glass[er][ec] = False

                    v_stress[er][ec] = False

                else:

                    v_stress[er][ec] = True
                    moved = True
                    break



        r += dr

        c += dc

        path.append((r, c))

        moved = True

        if auto_activate and try_activate_button((r, c), buttons, activated, h_col, v_col):

            moved = True

        if (r, c) == hole:

            return path, moved, True, h_glass, v_glass, h_stress, v_stress, h_col, v_col, activated



    return path, moved, False, h_glass, v_glass, h_stress, v_stress, h_col, v_col, activated





def level_arrays(level):

    size = level["size"]

    pillars = level.get("pillars", [])

    h, v = build_walls(size, pillars)

    h_glass, v_glass = build_glass(size, level)

    h_col, v_col = build_colored(size, level)

    buttons = build_buttons(level)

    h_stress = [[False] * size for _ in range(size - 1)]

    v_stress = [[False] * (size - 1) for _ in range(size)]

    return size, h, v, h_glass, v_glass, h_stress, v_stress, h_col, v_col, buttons





def solve_level(level, max_moves=80, allow_button=True):

    size = level["size"]

    ball = (level["ball"]["row"], level["ball"]["col"])

    hole = (level["hole"]["row"], level["hole"]["col"])

    if ball == hole:

        return False, -1



    _, h, v, h_glass, v_glass, h_stress, v_stress, h_col, v_col, buttons = level_arrays(level)

    has_colored = any(
        row for row in (h_col or []) for c in row if c is not None
    ) or any(row for row in (v_col or []) for c in row if c is not None)

    if not has_colored and not allow_button:

        return False, -1

    start_act = set()

    q = deque([(ball, h_glass, v_glass, h_stress, v_stress, h_col, v_col, start_act, 0)])

    visited = {state_key(ball, h_glass, v_glass, h_stress, v_stress, start_act)}



    while q:

        pos, hg, vg, hs, vs, hc, vc, act, depth = q.popleft()

        if depth >= max_moves:

            continue

        if allow_button and can_press_button(pos, buttons, act):

            nhc, nvc = deepcopy(hc), deepcopy(vc)

            nact = set(act)

            if try_activate_button(pos, buttons, nact, nhc, nvc):

                if pos == hole:

                    return True, depth + 1

                key = state_key(pos, hg, vg, hs, vs, nact)

                if key not in visited:

                    visited.add(key)

                    q.append((pos, hg, vg, hs, vs, nhc, nvc, nact, depth + 1))

        for d in DIRS:

            path, moved, won, nhg, nvg, nhs, nvs, nhc, nvc, nact = simulate_tilt(

                pos, hole, size, h, v, hg, vg, hs, vs, d, hc, vc, act, buttons,
                auto_activate=allow_button,

            )

            if not moved:

                continue

            end = path[-1]

            if won:

                return True, depth + 1

            key = state_key(end, nhg, nvg, nhs, nvs, nact)

            if key not in visited:

                visited.add(key)

                q.append((end, nhg, nvg, nhs, nvs, nhc, nvc, nact, depth + 1))

    return False, -1





def button_required(level, max_moves=120):
    """색상벽을 없애지 않으면 불가능·없애면 가능 (구멍 도달이 클리어, 버튼 탭 자체는 필수 아님)."""
    if not level.get("buttons"):
        return True
    ok_with, _ = solve_level(level, max_moves=max_moves, allow_button=True)
    ok_without, _ = solve_level(level, max_moves=max_moves, allow_button=False)
    return ok_with and not ok_without


def find_solution_moves(level, max_moves=80, allow_button=True):

    size = level["size"]

    ball = (level["ball"]["row"], level["ball"]["col"])

    hole = (level["hole"]["row"], level["hole"]["col"])

    if ball == hole:

        return None



    _, h, v, h_glass, v_glass, h_stress, v_stress, h_col, v_col, buttons = level_arrays(level)

    start_act = set()

    parent = {state_key(ball, h_glass, v_glass, h_stress, v_stress, start_act): (None, None)}

    q = deque([(ball, h_glass, v_glass, h_stress, v_stress, h_col, v_col, start_act)])



    while q:

        pos, hg, vg, hs, vs, hc, vc, act = q.popleft()

        sk = state_key(pos, hg, vg, hs, vs, act)

        depth = 0

        cur = sk

        while parent[cur][0] is not None:

            depth += 1

            cur = parent[cur][0]

        if depth >= max_moves:

            continue

        if allow_button and can_press_button(pos, buttons, act):

            nhc, nvc = deepcopy(hc), deepcopy(vc)

            nact = set(act)

            if try_activate_button(pos, buttons, nact, nhc, nvc):

                ek = state_key(pos, hg, vg, hs, vs, nact)

                if ek not in parent:

                    parent[ek] = (sk, None)

                    if pos == hole:

                        return reconstruct_moves(parent, ek)

                    q.append((pos, hg, vg, hs, vs, nhc, nvc, nact))

        for d in DIRS:

            path, moved, won, nhg, nvg, nhs, nvs, nhc, nvc, nact = simulate_tilt(

                pos, hole, size, h, v, hg, vg, hs, vs, d, hc, vc, act, buttons,
                auto_activate=allow_button,

            )

            if not moved:

                continue

            end = path[-1]

            ek = state_key(end, nhg, nvg, nhs, nvs, nact)

            if ek not in parent:

                parent[ek] = (sk, d)

                if won:

                    return reconstruct_moves(parent, ek)

                q.append((end, nhg, nvg, nhs, nvs, nhc, nvc, nact))

    return None


def reconstruct_moves(parent, goal):

    moves = []

    cur = goal

    while parent[cur][0] is not None:

        d = parent[cur][1]

        if d is not None:

            moves.append(d)

        cur = parent[cur][0]

    moves.reverse()

    return tuple(moves)





def layout_fingerprint(level):

    pillars = tuple(sorted((p["row"], p["col"]) for p in level["pillars"]))

    glass_h = tuple(sorted((e["row"], e["col"]) for e in level.get("glassH", []) or []))

    glass_v = tuple(sorted((e["row"], e["col"]) for e in level.get("glassV", []) or []))

    col_h = tuple(sorted((e["row"], e["col"], e.get("color", "red")) for e in level.get("coloredH", []) or []))

    col_v = tuple(sorted((e["row"], e["col"], e.get("color", "red")) for e in level.get("coloredV", []) or []))

    btns = tuple(sorted((b["row"], b["col"], b.get("color", "red")) for b in level.get("buttons", []) or []))

    ball = (level["ball"]["row"], level["ball"]["col"])

    hole = (level["hole"]["row"], level["hole"]["col"])

    return (level["size"], ball, hole, pillars, glass_h, glass_v, col_h, col_v, btns)





def main():

    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "shared/levels.json"

    data = json.loads(path.read_text(encoding="utf-8"))

    ok = True

    for lv in data["levels"]:

        solvable, moves = solve_level(lv)

        status = "OK" if solvable else "FAIL"

        glass_n = len(lv.get("glassH", []) or []) + len(lv.get("glassV", []) or [])

        btn_n = len(lv.get("buttons", []) or [])

        col_n = len(lv.get("coloredH", []) or []) + len(lv.get("coloredV", []) or [])

        if not solvable:

            ok = False

        req = "walls" if btn_n > 0 and button_required(lv) else ("opt" if btn_n > 0 else "-")

        print(f"  [{status}] id={lv['id']:2} {lv['name']:14} optimal={moves} glass={glass_n} btn={btn_n} col={col_n} {req}")

    sys.exit(0 if ok else 1)





if __name__ == "__main__":

    main()

