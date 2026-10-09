#!/usr/bin/env python3
"""1~40 유지 + button_stages_41_50.json 병합 → version 7."""
import json
import sys
from pathlib import Path

from validate_levels import button_required, find_solution_moves, layout_fingerprint, solve_level

ROOT = Path(__file__).resolve().parents[1]
BUTTON_FILE = Path(__file__).resolve().parent / "button_stages_41_50.json"
OUT_PATHS = [
    ROOT / "shared/levels.json",
    ROOT / "unity/InTheHole/Assets/Resources/Levels/levels.json",
]


def main():
    raise SystemExit("Retired pillar generator. Run tools/generate_edge_levels.py")
    base_path = ROOT / "shared/levels.json"
    data = json.loads(base_path.read_text(encoding="utf-8"))
    base = [lv for lv in data["levels"] if lv["id"] <= 40]
    if len(base) != 40:
        print(f"ERROR: expected 40 base levels, got {len(base)}", file=sys.stderr)
        sys.exit(1)

    button = json.loads(BUTTON_FILE.read_text(encoding="utf-8"))
    if len(button) != 10:
        print(f"ERROR: expected 10 button levels, got {len(button)}", file=sys.stderr)
        sys.exit(1)

    used_layouts = {layout_fingerprint(lv) for lv in base}
    used_solutions = set()
    for lv in base:
        sol = find_solution_moves(lv, max_moves=120)
        if sol:
            used_solutions.add(sol)

    for lv in button:
        lid = lv["id"]
        if lid < 41 or lid > 50:
            print(f"ERROR: bad id {lid}", file=sys.stderr)
            sys.exit(1)
        fp = layout_fingerprint(lv)
        if fp in used_layouts:
            print(f"ERROR: duplicate layout id={lid}", file=sys.stderr)
            sys.exit(1)
        sol = find_solution_moves(lv, max_moves=120)
        if sol and sol in used_solutions:
            print(f"ERROR: duplicate solution id={lid}", file=sys.stderr)
            sys.exit(1)
        ok, moves = solve_level(lv, max_moves=120)
        if not ok:
            print(f"ERROR: unsolvable id={lid}", file=sys.stderr)
            sys.exit(1)
        if not button_required(lv, max_moves=120):
            print(f"ERROR: clearable without button id={lid}", file=sys.stderr)
            sys.exit(1)
        used_layouts.add(fp)
        if sol:
            used_solutions.add(sol)
        col = len(lv.get("coloredH", []) or []) + len(lv.get("coloredV", []) or [])
        print(f"  OK id={lid:2} {lv['name']:14} optimal={moves:2} colored={col}")

    levels = base + sorted(button, key=lambda x: x["id"])
    out = {"version": 7, "levelCount": 50, "levels": levels}
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    for p in OUT_PATHS:
        p.write_text(text, encoding="utf-8")
        print(f"Wrote {p}")
    print("Done - 50 stages.")


if __name__ == "__main__":
    main()
