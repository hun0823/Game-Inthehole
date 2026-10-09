#!/usr/bin/env python3
"""기존 1~30 유지 + glass_stages_31_40.json 병합 (랜덤 탐색 없음, 즉시 완료)."""
import json
import sys
from pathlib import Path

from validate_levels import find_solution_moves, layout_fingerprint, solve_level

ROOT = Path(__file__).resolve().parents[1]
GLASS_FILE = Path(__file__).resolve().parent / "glass_stages_31_40.json"
OUT_PATHS = [
    ROOT / "shared/levels.json",
    ROOT / "unity/InTheHole/Assets/Resources/Levels/levels.json",
]


def main():
    base_path = ROOT / "shared/levels.json"
    data = json.loads(base_path.read_text(encoding="utf-8"))
    base = [lv for lv in data["levels"] if lv["id"] <= 30]
    if len(base) != 30:
        print(f"ERROR: expected 30 base levels, got {len(base)}", file=sys.stderr)
        sys.exit(1)

    glass = json.loads(GLASS_FILE.read_text(encoding="utf-8"))
    if len(glass) != 10:
        print(f"ERROR: expected 10 glass levels, got {len(glass)}", file=sys.stderr)
        sys.exit(1)

    used_layouts = {layout_fingerprint(lv) for lv in base}
    used_solutions = set()
    for lv in base:
        sol = find_solution_moves(lv)
        if sol:
            used_solutions.add(sol)

    for lv in glass:
        lid = lv["id"]
        if lid < 31 or lid > 40:
            print(f"ERROR: bad id {lid}", file=sys.stderr)
            sys.exit(1)
        fp = layout_fingerprint(lv)
        if fp in used_layouts:
            print(f"ERROR: duplicate layout id={lid}", file=sys.stderr)
            sys.exit(1)
        sol = find_solution_moves(lv)
        if sol and sol in used_solutions:
            print(f"ERROR: duplicate solution id={lid}", file=sys.stderr)
            sys.exit(1)
        ok, moves = solve_level(lv)
        if not ok:
            print(f"ERROR: unsolvable id={lid}", file=sys.stderr)
            sys.exit(1)
        used_layouts.add(fp)
        if sol:
            used_solutions.add(sol)
        g = len(lv.get("glassH", []) or []) + len(lv.get("glassV", []) or [])
        print(f"  OK id={lid:2} {lv['name']:14} optimal={moves:2} glass={g}")

    levels = base + sorted(glass, key=lambda x: x["id"])
    out = {"version": 6, "levelCount": 40, "levels": levels}
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    for p in OUT_PATHS:
        p.write_text(text, encoding="utf-8")
        print(f"Wrote {p}")
    print("Done - 40 stages.")


if __name__ == "__main__":
    main()
