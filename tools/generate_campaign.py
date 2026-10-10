#!/usr/bin/env python3
"""Build the 90-stage campaign so each featured mechanic is the trick.

Par is whatever tools/tilt_solver.py measures. Necessity and dihedral
uniqueness live in tools/necessity.py, which the validator imports too.
"""

import random
import sys
from pathlib import Path

from build_tricks import (
    build_cut,
    build_mix,
    build_stop,
    fresh_wall,
    hunt_gates,
    hunt_glass,
    hunt_oneway,
    _seek_window,
    hunt_from_walls,
)
from necessity import Gallery

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "shared/levels.json"

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

# Stage 71 is glass + gates. Every later pair keeps both mechanics necessary.
MIXES = [
    ("gates", "glass"),
    ("sand", "coins"),
    ("sand", "smog"),
    ("ice", "coins"),
    ("ice", "smog"),
    ("teleport", "coins"),
    ("teleport", "smog"),
    ("oneway", "coins"),
    ("oneway", "smog"),
    ("glass", "coins"),
    ("gates", "coins"),
    ("gates", "smog"),
    ("collapse", "coins"),
    ("collapse", "smog"),
    ("movers", "coins"),
    ("movers", "smog"),
    ("sand", "collapse"),
    ("ice", "movers"),
    ("glass", "smog"),
    ("teleport", "collapse"),
]


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


def curve_targets(prev):
    if not prev:
        return [4]
    return [prev + d for d in (0, 1, -1, 2, -2) if prev + d >= 4]


def commit(levels, gallery, made, prev):
    level, _moves = made
    par = level["par"]
    if prev and (par < prev - 2 or par > prev + 2):
        return None
    if gallery.reject_reason(level):
        return None
    gallery.add(level)
    levels.append(level)
    return par


def main():
    rng = random.Random(909)
    gallery = Gallery()
    levels = []
    used = set()
    donors = []

    wall_specs = [
        (3, 4), (3, 4), (3, 5), (3, 6), (3, 6), (3, 7),
        (4, 7), (4, 8), (4, 8), (4, 9), (4, 10), (4, 10),
        (5, 11), (5, 11), (5, 12), (5, 12),
    ]
    prev = 0
    for n, target in wall_specs:
        placed = None
        for aim in (target, target + 1, target - 1, target + 2):
            if aim < 4:
                continue
            for _ in range(6):
                level = fresh_wall(n, aim, rng, used)
                if not level:
                    continue
                level["par"] = aim
                reason = gallery.reject_reason(level)
                if reason:
                    continue
                if prev and (aim < prev - 2 or aim > prev + 2):
                    continue
                gallery.add(level)
                levels.append(level)
                placed = aim
                break
            if placed:
                break
        if not placed:
            print(f"FAILED wall {n} near {target}", file=sys.stderr)
            sys.exit(1)
        prev = placed
        print(f"wall {n}×{n} par {prev}", flush=True)

    donor_gallery = Gallery()
    for level in levels:
        donor_gallery.add(level)

    def mint_donor(n, target):
        for _ in range(8):
            level = fresh_wall(n, target, rng, used)
            if not level:
                continue
            level["par"] = target
            if donor_gallery.reject_reason(level):
                continue
            donor_gallery.add(level)
            donors.append(level)
            return level
        return None

    for _repeat in range(2):
        for n in (4, 5, 6):
            for target in range(7, 16):
                mint_donor(n, target)
    print(f"donors {len(donors)}", flush=True)

    def take(label, builder):
        nonlocal prev
        for aim in curve_targets(prev):
            made = builder(aim)
            if not made:
                continue
            got = commit(levels, gallery, made, prev)
            if got:
                prev = got
                print(f"{label} par {prev}", flush=True)
                return
        print(f"FAILED {label} near {prev}", file=sys.stderr)
        sys.exit(1)

    def take_span(label, builder):
        nonlocal prev
        lo = max(4, prev - 2)
        hi = prev + 2
        for _try in range(4):
            made = builder(lo, hi)
            if made:
                got = commit(levels, gallery, made, prev)
                if got:
                    prev = got
                    print(f"{label} par {prev}", flush=True)
                    return
            for n in (5, 6, 4):
                mint_donor(n, max(7, prev))
                mint_donor(n, max(7, prev - 1))
        print(f"FAILED {label} near {prev} span {lo}-{hi} donors {len(donors)}", file=sys.stderr)
        sys.exit(1)

    for _ in range(5):
        take("sand", lambda aim: build_stop(5, aim, rng, "sand", gallery, attempts=40))
    ice_sizes = [5, 5, 6, 5, 6]
    for n in ice_sizes:
        take("ice", lambda aim, n=n: build_stop(n, aim, rng, "ice", gallery, attempts=36))
    for _ in range(5):
        take_span("oneway", lambda lo, hi: hunt_oneway(donors, rng, lo, hi, gallery, attempts=18))
    for n in (5, 5, 6, 5, 6):
        take("teleport", lambda aim, n=n: build_cut(n, aim, rng, "teleport", gallery, attempts=30))
    for n in (5, 5, 6, 6, 6, 6):
        take("glass", lambda aim, n=n: hunt_glass(n, aim, rng, used, gallery, attempts=4))
    for n in (5, 5, 6, 6, 6, 6):
        take("gates", lambda aim, n=n: hunt_gates(n, aim, rng, used, gallery, attempts=4))
    for _ in range(5):
        take("smog", lambda aim: hunt_from_walls(donors, rng, aim, "smog", gallery, attempts=12))
    for _ in range(5):
        take("coins", lambda aim: hunt_from_walls(donors, rng, aim, "coins", gallery, attempts=12))
    for _ in range(6):
        take_span("collapse", lambda lo, hi: _seek_window(donors, rng, lo, hi, "collapse", gallery))
    for _ in range(6):
        take_span("movers", lambda lo, hi: _seek_window(donors, rng, lo, hi, "movers", gallery))

    mix_sizes = [5, 6, 5, 6] * 5
    for (kinds, n) in zip(MIXES, mix_sizes):
        label = "+".join(kinds)

        def builder(aim, kinds=kinds, n=n):
            return build_mix(kinds, n, aim, rng, gallery, donors)

        take(f"mix {label}", builder)

    if len(levels) != 90:
        print(f"FAILED count {len(levels)}", file=sys.stderr)
        sys.exit(1)
    for sid, (level, name) in enumerate(zip(levels, NAMES), start=1):
        level["id"] = sid
        level["name"] = mix_title(level) if sid > 70 else name
    import json
    data = {"version": 11, "levelCount": 90, "wallModel": "edges", "levels": levels}
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(levels)} stages")


if __name__ == "__main__":
    main()
