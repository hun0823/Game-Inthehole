#!/usr/bin/env python3
"""스테이지가 버튼 없이 클리어 가능한지 검사."""
import json
from pathlib import Path

from validate_levels import solve_level

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "shared/levels.json").read_text(encoding="utf-8"))

for lv in data["levels"]:
    if lv["id"] < 41:
        continue
    ok_no_btn, m = solve_level(lv, max_moves=120, allow_button=False)
    ok_full, mf = solve_level(lv, max_moves=120, allow_button=True)
    print(f"id={lv['id']:2} no_button={ok_no_btn} m={m}  with_button={ok_full} m={mf}")
