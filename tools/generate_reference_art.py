#!/usr/bin/env python3
"""Generate placeholder art for Unity Resources/Art/. Run: python tools/generate_reference_art.py"""
from pathlib import Path
import struct
import zlib
import math
import random

OUT = Path(__file__).resolve().parents[1] / "unity" / "InTheHole" / "Assets" / "Resources" / "Art"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def write_png(path, w, h, pixels):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = b""
    for y in range(h):
        raw += b"\x00"
        for x in range(w):
            r, g, b, a = pixels[y * w + x]
            raw += bytes((r, g, b, a))
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.write_bytes(png)


def perlin(x, y, seed=0):
    return (math.sin(x * 12.7 + seed) + math.cos(y * 9.3 + seed * 2)) * 0.25 + 0.5


def rounded_alpha(x, y, w, h, r):
    dx = min(x, w - 1 - x)
    dy = min(y, h - 1 - y)
    return max(0, min(dx, dy) - r)


def make_wood(size, seed):
    px = []
    for y in range(size):
        for x in range(size):
            n = perlin(x * 0.12 + seed, y * 0.08)
            c = lerp(hex_rgb("#8b5e3c"), hex_rgb("#c49262"), n)
            if perlin(x * 0.4, y * 0.05) > 0.6:
                c = lerp(c, hex_rgb("#6e4a30"), 0.25)
            a = 255 if rounded_alpha(x, y, size, size, 10) >= 0 else int(255 * max(0, 1 + rounded_alpha(x, y, size, size, 10) * 4))
            px.append((*c, a))
    return size, size, px


def make_ball(size):
    px = []
    cx = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cx) / cx
            if d > 1:
                px.append((0, 0, 0, 0))
                continue
            base = lerp(hex_rgb("#9a4e22"), hex_rgb("#e88b4a"), 1 - d)
            spec = math.exp(-((x - cx * 1.15) ** 2 + (y - cx * 1.2) ** 2) / (size * 8))
            base = lerp(base, hex_rgb("#ffe8c8"), min(1, spec * 0.85))
            a = 255 if d < 0.92 else int(255 * max(0, (1 - d) / 0.08))
            px.append((*base, a))
    return size, size, px


def make_hole_ring(size):
    px = []
    cx = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cx) / cx
            if 0.45 < d < 0.9:
                t = 1 - abs(d - 0.65) / 0.25
                c = lerp(hex_rgb("#18c8e8"), hex_rgb("#9dfff0"), t)
                a = int(255 * min(1, t * 1.5))
                px.append((*c, a))
            else:
                px.append((0, 0, 0, 0))
    return size, size, px


def main():
    random.seed(42)
    w, h, p = make_wood(128, 0)
    write_png(OUT / "wood_a.png", w, h, p)
    w, h, p = make_wood(128, 1)
    write_png(OUT / "wood_b.png", w, h, p)
    w, h, p = make_ball(256)
    write_png(OUT / "ball.png", w, h, p)
    w, h, p = make_hole_ring(256)
    write_png(OUT / "hole_ring.png", w, h, p)
    # minimal placeholders for rest
    for name, color in [
        ("frame_mint", "#7ee8c8"),
        ("hole_core", "#001018"),
        ("wall_coral", "#ff6b6b"),
        ("wall_blue", "#5b9dff"),
        ("wall_purple", "#b47aff"),
        ("wall_green", "#5dd68a"),
        ("bg_gradient", "#0c1628"),
        ("star", "#ffffff"),
        ("ui_panel", "#1a2840"),
        ("ball_shadow", "#000000"),
    ]:
        c = hex_rgb(color)
        write_png(OUT / f"{name}.png", 64, 64, [(*c, 255)] * 4096)
    print(f"Wrote art to {OUT}")


if __name__ == "__main__":
    main()
