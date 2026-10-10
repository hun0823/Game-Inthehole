#!/usr/bin/env python3
"""Bake equirectangular sphere maps for Rollin' Board.

Original procedural textures. No third-party images.
Balls are 512x256, planets 1024x512 (2:1 equirectangular). North pole is the
top row, matching Three.js SphereGeometry with Texture.flipY = true.

    python3 tools/bake_sphere_maps.py
    python3 tools/bake_sphere_maps.py --preview /tmp/sphere_preview

Directions use the Three.js sphere:
    X = -cos(phi) * sin(theta)
    Y = cos(theta)
    Z = sin(phi) * sin(theta)
so a feature painted here lands on the same texel the game samples.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "textures"

BALL_W, BALL_H = 512, 256
PLANET_W, PLANET_H = 1024, 512


def hash3(ix, iy, iz):
    n = ix.astype(np.uint32) * np.uint32(374761393)
    n ^= iy.astype(np.uint32) * np.uint32(668265263)
    n ^= iz.astype(np.uint32) * np.uint32(2147483647)
    n = (n ^ (n >> np.uint32(13))) * np.uint32(1274126177)
    n ^= n >> np.uint32(16)
    return n.astype(np.float32) * np.float32(1.0 / 4294967295.0)


def noise3(x, y, z):
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    z0 = np.floor(z).astype(np.int32)
    xf = (x - x0).astype(np.float32)
    yf = (y - y0).astype(np.float32)
    zf = (z - z0).astype(np.float32)
    u = xf * xf * (3.0 - 2.0 * xf)
    v = yf * yf * (3.0 - 2.0 * yf)
    w = zf * zf * (3.0 - 2.0 * zf)

    def h(dx, dy, dz):
        return hash3(x0 + dx, y0 + dy, z0 + dz)

    c00 = h(0, 0, 0) * (1 - u) + h(1, 0, 0) * u
    c10 = h(0, 1, 0) * (1 - u) + h(1, 1, 0) * u
    c01 = h(0, 0, 1) * (1 - u) + h(1, 0, 1) * u
    c11 = h(0, 1, 1) * (1 - u) + h(1, 1, 1) * u
    c0 = c00 * (1 - v) + c10 * v
    c1 = c01 * (1 - v) + c11 * v
    return c0 * (1 - w) + c1 * w


def fbm(x, y, z, octaves=5, lac=2.03):
    amp = 0.5
    freq = 1.0
    total = np.zeros_like(x, dtype=np.float32)
    norm = 0.0
    for _ in range(octaves):
        total += amp * noise3(x * freq, y * freq, z * freq)
        norm += amp
        amp *= 0.5
        freq *= lac
    return total / norm


def dirs(w, h):
    xs = (np.arange(w, dtype=np.float32) + 0.5) / w
    ys = (np.arange(h, dtype=np.float32) + 0.5) / h
    u, v = np.meshgrid(xs, ys)
    theta = v * np.pi
    phi = u * (2.0 * np.pi)
    st = np.sin(theta)
    x = -np.cos(phi) * st
    y = np.cos(theta)
    z = np.sin(phi) * st
    return x, y, z, theta, phi


def smoothstep(edge0, edge1, t):
    x = np.clip((t - edge0) / (edge1 - edge0 + 1e-8), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def wrap_blur(img, radius, passes=1):
    """Separable box blur. Horizontal wraps (seam), vertical clamps (poles)."""
    out = img.astype(np.float32)
    r = int(radius)
    if r < 1:
        return out
    k = r * 2 + 1
    for _ in range(passes):
        pad = np.concatenate([out[:, -r:], out, out[:, :r]], axis=1)
        c = np.pad(np.cumsum(pad, axis=1), ((0, 0), (1, 0)), mode="constant")
        out = (c[:, k:] - c[:, :-k]) / k
        pad = np.pad(out, ((r, r), (0, 0)), mode="edge")
        c = np.pad(np.cumsum(pad, axis=0), ((1, 0), (0, 0)), mode="constant")
        out = (c[k:, :] - c[:-k, :]) / k
    return out


def height_to_normal(height, strength):
    """Tangent-space normal. +Y in the map points toward the north pole (up in the image)."""
    h = height.astype(np.float32)
    h_w, w = h.shape
    left = np.roll(h, 1, axis=1)
    right = np.roll(h, -1, axis=1)
    up = np.empty_like(h)
    down = np.empty_like(h)
    up[0] = h[0]
    up[1:] = h[:-1]
    down[-1] = h[-1]
    down[:-1] = h[1:]
    rows = (np.arange(h_w, dtype=np.float32) + 0.5) / h_w
    theta = rows * np.pi
    sin_t = np.maximum(np.sin(theta), 0.12).astype(np.float32)
    du = sin_t[:, None] * (2.0 * np.pi / w)
    dv = np.float32(np.pi / h_w)
    dhdu = (right - left) * 0.5
    # Image down is south, which is -v in Three.js (v increases north).
    dhdv = (up - down) * 0.5
    nx = -dhdu / du * strength
    ny = -dhdv / dv * strength
    nz = np.ones_like(h)
    # Fade bumps out at the poles so the projection does not spike.
    fade = np.clip((sin_t - 0.04) / 0.42, 0.0, 1.0).astype(np.float32)
    nx *= fade[:, None]
    ny *= fade[:, None]
    n = np.stack([nx, ny, nz], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-8
    return np.clip(n * 0.5 + 0.5, 0.0, 1.0)


def curve_figure8(n, amp):
    t = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False).astype(np.float32)
    x = np.cos(t)
    z = np.sin(t)
    y = amp * np.sin(2.0 * t)
    length = np.sqrt(x * x + y * y + z * z)
    pts = np.stack([x / length, y / length, z / length], axis=1)
    tang = np.roll(pts, -1, axis=0) - np.roll(pts, 1, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-8
    return pts, tang


def seam_field(x, y, z, pts, tang, stitch_every=7):
    dirs_flat = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    dots = dirs_flat @ pts.T
    dots = np.clip(dots, -1.0, 1.0)
    ang = np.arccos(dots)
    nearest = np.argmin(ang, axis=1)
    dist = ang[np.arange(ang.shape[0]), nearest]
    dist = dist.reshape(x.shape)
    nidx = nearest.reshape(x.shape)
    tvec = tang[nearest].reshape(x.shape + (3,))
    # Perpendicular on the sphere, used only to keep the stitch mask stable.
    radial = np.stack([x, y, z], axis=-1)
    side = np.cross(radial, tvec)
    side /= np.linalg.norm(side, axis=-1, keepdims=True) + 1e-8
    phase = nidx % stitch_every
    along = np.minimum(phase, stitch_every - phase).astype(np.float32)
    return dist, along, side


def mix(a, b, t):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    t = np.asarray(t, dtype=np.float32)
    color = a.ndim == 1 or b.ndim == 1 or a.ndim == 3 or b.ndim == 3
    if a.ndim == 1:
        a = a.reshape((1, 1, -1))
    if b.ndim == 1:
        b = b.reshape((1, 1, -1))
    if color and t.ndim == 2:
        t = t[..., None]
    return a * (1.0 - t) + b * t


def rgb_of(hex_color):
    h = hex_color.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def paint_baseball(x, y, z):
    pts, tang = curve_figure8(480, 0.52)
    dist, along, _side = seam_field(x, y, z, pts, tang, 16)
    grain = fbm(x * 2.4, y * 2.4, z * 2.4, 3)
    pebble = wrap_blur(fbm(x * 9.0, y * 9.0, z * 9.0, 2), 2)
    col = rgb_of("#f6f1e6") * (0.97 + 0.06 * (grain - 0.5))[..., None]
    groove = smoothstep(0.034, 0.012, dist)
    along_n = along / 3.2
    dist_n = dist / 0.05
    stitch = smoothstep(1.05, 0.45, np.sqrt(along_n * along_n + dist_n * dist_n))
    gap = 1.0 - stitch
    col = mix(col, rgb_of("#ddd4c4"), groove * gap * 0.7)
    col = mix(col, rgb_of("#a31824"), stitch * 0.75)
    col = mix(col, rgb_of("#e02632"), stitch)
    height = (pebble - 0.5) * 0.06 + stitch * 1.15 - groove * gap * 0.18
    rough = np.full(x.shape, 0.48, dtype=np.float32)
    rough = mix(rough, 0.32, stitch)
    rough += (pebble - 0.5) * 0.04
    return np.clip(col, 0, 1), height, np.clip(rough, 0.2, 0.7)


def paint_tennis(x, y, z):
    pts, tang = curve_figure8(480, 0.64)
    dist, _along, _side = seam_field(x, y, z, pts, tang, 14)
    fuzz = wrap_blur(fbm(x * 26.0, y * 26.0, z * 26.0, 3), 2)
    nap = fbm(x * 7.0, y * 4.0, z * 7.0, 3)
    optic = rgb_of("#d4ee14")
    col = optic * (0.94 + 0.1 * fuzz + 0.05 * (nap - 0.5))[..., None]
    band = smoothstep(0.055, 0.022, dist)
    col = mix(col, rgb_of("#f5f6f0"), band)
    height = (fuzz - 0.5) * 0.14 + (nap - 0.5) * 0.05 + band * 0.18
    rough = np.full(x.shape, 0.93, dtype=np.float32)
    rough = mix(rough, 0.74, band)
    return np.clip(col, 0, 1), height, np.clip(rough, 0.6, 1.0)


def paint_melon(x, y, z, theta, phi):
    wobble = np.sin(theta) * (
        0.22 * np.sin(theta * 3.0 + 1.7)
        + 0.12 * np.sin(phi * 2.0 + theta * 2.0)
        + 0.08 * (fbm(x * 2.0, y * 2.0, z * 2.0, 3) - 0.5)
    )
    phase = phi + wobble
    stripes = 10.0
    wave = np.sin(phase * stripes + 0.35 * np.sin(phase * 3.0 + 0.6))
    thresh = -0.08 + 0.18 * np.sin(phase * 2.0)
    dark_k = smoothstep(thresh - 0.12, thresh + 0.16, wave)
    cap = smoothstep(0.05, 0.48, theta) * smoothstep(0.05, 0.48, np.pi - theta)
    dark_k = dark_k * cap + (1.0 - cap) * 0.62
    mottled = fbm(x * 4.5, y * 4.5, z * 4.5, 3)
    speckle = smoothstep(0.82, 0.93, fbm(x * 20.0, y * 20.0, z * 20.0, 2))
    dark = rgb_of("#127338")
    light = rgb_of("#c6d86a")
    col = mix(light, dark, dark_k)
    col = col * (0.95 + 0.1 * (mottled - 0.5))[..., None]
    col = mix(col, rgb_of("#e7eeb0"), speckle * 0.22 * cap)
    stem = smoothstep(0.22, 0.04, theta)
    blossom = smoothstep(0.2, 0.04, np.pi - theta)
    col = mix(col, rgb_of("#3a2414"), stem)
    col = mix(col, rgb_of("#d5e4a0"), blossom * 0.4)
    wax = fbm(x * 8.0, y * 8.0, z * 8.0, 3)
    height = (1.0 - dark_k) * 0.1 * cap + (wax - 0.5) * 0.1 + stem * 0.22
    rough = mix(np.float32(0.5), np.float32(0.36), 1.0 - dark_k)
    rough = mix(rough, np.float32(0.66), stem)
    return np.clip(col, 0, 1), height, np.clip(rough, 0.22, 0.75)


def paint_oak(x, y, z):
    radial = np.sqrt(x * x + z * z)
    angle = np.arctan2(z, x)
    end = smoothstep(0.62, 0.9, np.abs(y))
    warp = fbm(x * 2.0, y * 2.0, z * 2.0, 4)
    rings = np.sin(radial * 30.0 + warp * 2.4)
    side = np.sin(angle * 11.0 + 0.45 * np.sin(y * 6.0) + warp * 1.3)
    fine = np.sin(angle * 24.0 + y * 1.1 + warp)
    grain = end * rings + (1.0 - end) * (0.82 * side + 0.18 * fine)
    rays = smoothstep(0.74, 0.9, fbm(x * 5.5, y * 2.2, z * 5.5, 3)) * (1.0 - end)
    pores = smoothstep(0.82, 0.93, fbm(x * 12.0, y * 30.0, z * 12.0, 2)) * (1.0 - end)
    tone = np.clip(grain * 0.5 + 0.5, 0.0, 1.0)
    col = mix(rgb_of("#8a4e22"), rgb_of("#e2b56e"), tone)
    col = mix(col, rgb_of("#f4e0b4"), rays * 0.7)
    col = mix(col, rgb_of("#5a3012"), np.clip(-grain, 0, 1) * 0.35)
    col = mix(col, rgb_of("#4a2810"), pores * 0.55)
    knot_dir = np.array([0.2, 0.08, 0.97], dtype=np.float32)
    knot_dir /= np.linalg.norm(knot_dir)
    knot = x * knot_dir[0] + y * knot_dir[1] + z * knot_dir[2]
    knot_m = smoothstep(0.972, 0.996, knot)
    ring = smoothstep(0.955, 0.972, knot) * (1.0 - knot_m)
    col = mix(col, rgb_of("#6a3a16"), ring * 0.7)
    col = mix(col, rgb_of("#3e220e"), knot_m)
    height = grain * 0.16 + rays * 0.28 - pores * 0.2 - knot_m * 0.15
    rough = mix(np.float32(0.64), np.float32(0.5), tone)
    rough = mix(rough, np.float32(0.74), pores + knot_m)
    return np.clip(col, 0, 1), height.astype(np.float32), np.clip(rough, 0.35, 0.85)


def paint_wood_planet(x, y, z):
    shape = fbm(x * 1.35, y * 1.35, z * 1.35, 5)
    groves = smoothstep(0.56, 0.66, fbm(x * 2.7, y * 2.7, z * 2.7, 4))
    forest = np.clip(smoothstep(0.4, 0.5, shape) * 0.9 + groves, 0.0, 1.0)
    tone = fbm(x * 3.0, y * 3.0, z * 3.0, 3)
    canopy = fbm(x * 6.0, y * 6.0, z * 6.0, 3)
    clearing = smoothstep(0.72, 0.86, fbm(x * 1.8 + 5.0, y * 0.7, z * 1.8, 3)) * (1.0 - forest * 0.55)
    meadow = mix(rgb_of("#9ec85a"), rgb_of("#e4eda4"), tone)
    trees = mix(rgb_of("#145c28"), rgb_of("#2f8a3c"), tone * 0.6 + canopy * 0.4)
    col = mix(meadow, trees, forest)
    col = mix(col, rgb_of("#c6a25a"), clearing * 0.85)
    height = (shape - 0.5) * 0.55 + (canopy - 0.5) * 0.1 * forest + groves * 0.08
    rough = mix(np.float32(0.9), np.float32(0.74), forest)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_desert(x, y, z):
    warp = fbm(x * 1.5, y * 1.5, z * 1.5, 4)
    phase = fbm(x * 2.1 + 3.2, y * 2.1, z * 2.1, 5) * 6.2 + warp * 2.4
    dune = np.power(0.5 + 0.5 * np.sin(phase), 1.85)
    grit = fbm(x * 9.0, y * 9.0, z * 9.0, 3)
    rock = smoothstep(0.76, 0.88, fbm(x * 3.4 + 8.0, y * 3.4, z * 3.4, 3))
    valley = rgb_of("#a86a28")
    sand = rgb_of("#e4bc78")
    crest = rgb_of("#f8e8c4")
    stone = rgb_of("#8d6844")
    col = mix(valley, sand, dune)
    col = mix(col, crest, np.clip((dune - 0.35) * 1.5, 0.0, 1.0))
    col = col * (0.95 + 0.1 * (grit - 0.5))[..., None]
    col = mix(col, stone, rock * 0.75)
    height = (dune - 0.35) * 0.85 + (grit - 0.5) * 0.06 + rock * 0.28
    rough = mix(np.float32(0.95), np.float32(0.82), dune)
    rough = mix(rough, np.float32(0.7), rock)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_ocean(x, y, z):
    warp_x = fbm(x * 1.2, y * 1.2, z * 1.2, 4)
    warp_z = fbm(x * 1.2 + 4.0, y * 1.2, z * 1.2, 4)
    elev = fbm(x * 1.5 + warp_x, y * 1.35, z * 1.5 + warp_z, 5)
    land = smoothstep(0.56, 0.64, elev)
    coast = smoothstep(0.52, 0.58, elev) * (1.0 - land)
    depth = np.clip((0.56 - elev) / 0.56, 0, 1)
    deep = rgb_of("#08325f")
    mid = rgb_of("#1a6ea8")
    shallow = rgb_of("#2eaaa8")
    sand = rgb_of("#e6d09a")
    green = rgb_of("#2f8a44")
    dark_g = rgb_of("#1a5c30")
    canopy = fbm(x * 7.0, y * 7.0, z * 7.0, 3)
    water = mix(shallow, mid, smoothstep(0.15, 0.45, depth))
    water = mix(water, deep, smoothstep(0.4, 0.85, depth))
    ground = mix(green, dark_g, canopy)
    col = mix(water, sand, coast)
    col = mix(col, ground, land)
    waves = np.sin((x * 10.0 + z * 4.0) + warp_x * 3.0)
    height = (1.0 - depth) * 0.1 + land * (0.4 + canopy * 0.18) + waves * 0.045 * (1.0 - land)
    rough = mix(0.28, 0.16, depth) 
    rough = mix(rough, 0.78, np.clip(land + coast, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_lava(x, y, z):
    n = fbm(x * 2.4, y * 2.4, z * 2.4, 5)
    fine = fbm(x * 8.0, y * 8.0, z * 8.0, 3)
    crack_d = np.abs(n - 0.52)
    crack = smoothstep(0.045, 0.0, crack_d)
    core = smoothstep(0.018, 0.0, crack_d)
    rock_a = rgb_of("#4a4038")
    rock_b = rgb_of("#241e1a")
    hot = rgb_of("#ffb020")
    melt = rgb_of("#ff4a10")
    col = mix(rock_b, rock_a, fine)
    col = mix(col, melt, crack)
    col = mix(col, hot, core)
    height = fine * 0.22 + (n - 0.5) * 0.18 - crack * 0.7
    rough = np.full(x.shape, 0.88, dtype=np.float32)
    rough = mix(rough, 0.28, np.clip(crack, 0, 1))
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    emissive += melt * crack[..., None] * 0.65
    emissive += hot * core[..., None]
    return np.clip(col, 0, 1), height.astype(np.float32), np.clip(rough, 0.15, 1.0), np.clip(emissive, 0, 1)


def to_u8(img):
    return np.clip(np.round(img * 255.0), 0, 255).astype(np.uint8)


def save_webp(path, rgb, quality, lossless=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(to_u8(rgb), "RGB")
    if lossless:
        image.save(path, "WEBP", lossless=True, quality=100, method=6)
    else:
        image.save(path, "WEBP", quality=quality, method=6)


def rough_rgb(rough):
    g = np.clip(rough, 0, 1).astype(np.float32)
    return np.repeat(g[..., None], 3, axis=2)


def save_set(name, color, height, rough, strength, albedo_q=84, normal_q=80):
    save_webp(OUT / f"{name}_albedo.webp", color, albedo_q)
    save_webp(OUT / f"{name}_normal.webp", height_to_normal(height, strength), normal_q)
    save_webp(OUT / f"{name}_rough.webp", rough_rgb(rough), 70)


def seam_report(color, label):
    jump = np.mean(np.abs(color[:, 0].astype(np.float32) - color[:, -1].astype(np.float32)))
    neighbor = np.mean(np.abs(color[:, 1:-1].astype(np.float32) - color[:, 0:-2].astype(np.float32)))
    print(f"  {label}: seam Δ {jump:.4f}  neighbor Δ {neighbor:.4f}")


def lit_preview(color, normal, path, yaw=0.55, pitch=0.28):
    """Front-hemisphere preview with a simple Blinn highlight, to judge the maps."""
    size = 420
    ys, xs = np.mgrid[0:size, 0:size]
    nx = (xs + 0.5) / size * 2.0 - 1.0
    ny = 1.0 - (ys + 0.5) / size * 2.0
    r2 = nx * nx + ny * ny
    mask = r2 <= 1.0
    nz = np.zeros_like(nx)
    nz[mask] = np.sqrt(np.maximum(0.0, 1.0 - r2[mask]))
    # Yaw around Y, then pitch around X. Camera looks from +Z.
    cy, sy = np.cos(yaw), np.sin(yaw)
    x1 = nx * cy + nz * sy
    z1 = -nx * sy + nz * cy
    y1 = ny
    cp, sp = np.cos(pitch), np.sin(pitch)
    y2 = y1 * cp - z1 * sp
    z2 = y1 * sp + z1 * cp
    x2 = x1
    theta = np.arccos(np.clip(y2, -1, 1))
    phi = np.mod(np.arctan2(z2, -x2), 2.0 * np.pi)
    u = phi / (2.0 * np.pi)
    v = theta / np.pi
    h, w = color.shape[:2]
    px = u * (w - 1)
    py = v * (h - 1)
    x0 = np.floor(px).astype(np.int32) % w
    y0 = np.clip(np.floor(py).astype(np.int32), 0, h - 1)
    x1i = (x0 + 1) % w
    y1i = np.clip(y0 + 1, 0, h - 1)
    tx = (px - np.floor(px)).astype(np.float32)[..., None]
    ty = (py - np.floor(py)).astype(np.float32)[..., None]

    def sample(img):
        c00 = img[y0, x0].astype(np.float32)
        c10 = img[y0, x1i].astype(np.float32)
        c01 = img[y1i, x0].astype(np.float32)
        c11 = img[y1i, x1i].astype(np.float32)
        return (c00 * (1 - tx) + c10 * tx) * (1 - ty) + (c01 * (1 - tx) + c11 * tx) * ty

    albedo = sample(color)
    ntex = sample(normal) * 2.0 - 1.0
    # Rebuild tangent frame from the rotated direction (x2, y2, z2).
    st = np.sin(theta) + 1e-4
    t_x = z2 / st
    t_y = np.zeros_like(z2)
    t_z = -x2 / st
    # +v is north = -dP/dtheta
    b_x = np.cos(phi) * np.cos(theta)
    b_y = np.sin(theta)
    b_z = -np.sin(phi) * np.cos(theta)
    # Our phi definition: X = -cos(phi) sin, so dX/dtheta = -cos(phi) cos
    # -dX/dtheta = cos(phi) cos(theta). phi = atan2(Z, -X), cos(phi) = -X/sin
    b_x = (-x2 / st) * np.cos(theta)
    b_z = (z2 / st) * np.cos(theta)
    wn_x = t_x * ntex[..., 0] + b_x * ntex[..., 1] + x2 * ntex[..., 2]
    wn_y = t_y * ntex[..., 0] + b_y * ntex[..., 1] + y2 * ntex[..., 2]
    wn_z = t_z * ntex[..., 0] + b_z * ntex[..., 1] + z2 * ntex[..., 2]
    ln = np.sqrt(wn_x * wn_x + wn_y * wn_y + wn_z * wn_z) + 1e-8
    wn_x, wn_y, wn_z = wn_x / ln, wn_y / ln, wn_z / ln
    lx, ly, lz = 0.35, 0.72, 0.6
    ll = np.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ll, ly / ll, lz / ll
    ndl = np.clip(wn_x * lx + wn_y * ly + wn_z * lz, 0, 1)
    hx, hy, hz = lx + 0, ly + 0, lz + 1
    hl = np.sqrt(hx * hx + hy * hy + hz * hz)
    hx, hy, hz = hx / hl, hy / hl, hz / hl
    spec = np.power(np.clip(wn_x * hx + wn_y * hy + wn_z * hz, 0, 1), 48.0)
    shade = albedo * (0.22 + 0.78 * ndl[..., None]) + spec[..., None] * 0.28
    rgb = np.zeros_like(shade)
    rgb[mask] = np.clip(shade[mask], 0, 1)
    # Soft rim so the sphere edge is readable on a dark page.
    rim = np.clip(1.0 - nz, 0, 1) ** 1.6
    rgb[mask] += rim[mask, None] * 0.08
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(to_u8(np.clip(rgb, 0, 1)), "RGB").save(path)


def bake_one(label, painter, w, h, strength, albedo_q, with_emissive=False):
    x, y, z, theta, phi = dirs(w, h)
    painted = painter(x, y, z) if painter.__code__.co_argcount == 3 else painter(x, y, z, theta, phi)
    if with_emissive:
        color, height, rough, emissive = painted
    else:
        color, height, rough = painted
        emissive = None
    color = np.clip(color, 0, 1).astype(np.float32)
    seam_report(color, label)
    normal_q = 86 if label.startswith("ball_") else 74
    save_set(label, color, height, rough, strength, albedo_q=albedo_q, normal_q=normal_q)
    if emissive is not None:
        save_webp(OUT / f"{label}_emissive.webp", emissive, 82)
    return color, height_to_normal(height, strength)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, default=None)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    balls = {
        "ball_baseball": (paint_baseball, 1.15, 86),
        "ball_tennis": (paint_tennis, 0.55, 84),
        "ball_oak": (paint_oak, 1.15, 86),
    }
    previews = {}
    for name, (fn, strength, quality) in balls.items():
        print(name)
        color, normal = bake_one(name, fn, BALL_W, BALL_H, strength, quality)
        previews[name] = (color, normal)
    print("ball_melon")
    color, normal = bake_one("ball_melon", paint_melon, BALL_W, BALL_H, 0.85, 84)
    previews["ball_melon"] = (color, normal)

    planets = {
        "planet_wood": (paint_wood_planet, 0.85, 82),
        "planet_desert": (paint_desert, 1.25, 82),
        "planet_ocean": (paint_ocean, 0.9, 82),
    }
    for name, (fn, strength, quality) in planets.items():
        print(name)
        color, normal = bake_one(name, fn, PLANET_W, PLANET_H, strength, quality)
        previews[name] = (color, normal)
    print("planet_lava")
    color, normal = bake_one("planet_lava", paint_lava, PLANET_W, PLANET_H, 1.25, 82, with_emissive=True)
    previews["planet_lava"] = (color, normal)

    if args.preview:
        for name, (color, normal) in previews.items():
            lit_preview(color, normal, args.preview / f"{name}.png", yaw=0.65, pitch=0.22)
            lit_preview(color, normal, args.preview / f"{name}_top.png", yaw=0.2, pitch=1.15)
        print(f"previews in {args.preview}")


if __name__ == "__main__":
    main()
