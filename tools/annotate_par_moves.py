#!/usr/bin/env python3
"""levels.json 각 스테이지에 BFS 최적 이동 수(par) 기록."""
import json
from pathlib import Path

from validate_levels import solve_level

ROOT = Path(__file__).resolve().parents[1]
PATHS = [
    ROOT / "shared/levels.json",
    ROOT / "unity/InTheHole/Assets/Resources/Levels/levels.json",
]


def main():
    for path in PATHS:
        data = json.loads(path.read_text(encoding="utf-8"))
        for lv in data["levels"]:
            ok, m = solve_level(lv, max_moves=120, allow_button=True)
            lv["par"] = m if ok else 0
            print(f"  id={lv['id']:2} par={lv['par']}")
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
