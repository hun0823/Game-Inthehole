#!/usr/bin/env python3
"""Print PNG dimensions for art folders."""
import struct
import sys
from pathlib import Path


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not png: {path}")
    return struct.unpack(">II", data[16:24])


def main() -> None:
    roots = sys.argv[1:] or [
        r"C:\Users\ckdgn\Desktop\Rollin' Board\game_asset2",
        Path(__file__).resolve().parents[1] / "unity" / "InTheHole" / "Assets" / "Resources" / "Art",
    ]
    for root in roots:
        p = Path(root)
        print(f"\n== {p} ==")
        if not p.exists():
            print("  (missing)")
            continue
        for f in sorted(p.glob("*.png")):
            try:
                w, h = png_size(f)
                print(f"  {f.name:20} {w:5}x{h:<5}  {f.stat().st_size // 1024:5} KB")
            except Exception as e:
                print(f"  {f.name:20} ERROR {e}")


if __name__ == "__main__":
    main()
