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
    radial = np.stack([x, y, z], axis=-1)
    dirs_flat = radial.reshape(-1, 3)
    dots = dirs_flat @ pts.T
    dots = np.clip(dots, -1.0, 1.0)
    ang = np.arccos(dots)
    nearest = np.argmin(ang, axis=1)
    dist = ang[np.arange(ang.shape[0]), nearest].reshape(x.shape)
    nidx = nearest.reshape(x.shape)
    nearest_pt = pts[nearest].reshape(x.shape + (3,))
    tvec = tang[nearest].reshape(x.shape + (3,))
    side = np.cross(nearest_pt, tvec)
    side /= np.linalg.norm(side, axis=-1, keepdims=True) + 1e-8
    signed = np.arctan2(
        np.sum(radial * side, axis=-1),
        np.sum(radial * nearest_pt, axis=-1),
    ).astype(np.float32)
    phase = nidx % stitch_every
    along = np.minimum(phase, stitch_every - phase).astype(np.float32)
    return dist, along, side, signed, nidx


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
    """Two thick red rails and a continuous zigzag of V stitches."""
    pts, tang = curve_figure8(720, 0.52)
    _dist, _along, _side, signed, nidx = seam_field(x, y, z, pts, tang, 24)
    leather = rgb_of("#f7f4ee")
    grain = fbm(x * 1.6, y * 1.6, z * 1.6, 2)
    col = leather * (0.98 + 0.03 * (grain - 0.5))[..., None]
    gap = np.float32(0.046)
    rail = smoothstep(0.02, 0.007, np.minimum(np.abs(signed - gap), np.abs(signed + gap)))
    period = np.float32(26.0)
    phase = (nidx.astype(np.float32) % period) / period
    lean = (phase - 0.5) * 0.04
    active = smoothstep(0.08, 0.2, np.minimum(phase, 1.0 - phase))
    left = smoothstep(0.016, 0.005, np.abs(signed + gap - lean)) * active
    right = smoothstep(0.016, 0.005, np.abs(signed - gap + lean)) * active
    near = smoothstep(0.18, 0.08, _dist)
    red = np.clip(np.maximum(rail, np.maximum(left, right)), 0.0, 1.0) * near
    col = mix(col, rgb_of("#b10e18"), red * 0.55)
    col = mix(col, rgb_of("#e20d18"), red)
    height = red * 0.72 + (grain - 0.5) * 0.02
    rough = np.full(x.shape, 0.46, dtype=np.float32)
    rough = mix(rough, 0.34, red)
    return np.clip(col, 0, 1), height.astype(np.float32), np.clip(rough, 0.25, 0.6)


def paint_tennis(x, y, z):
    pts, tang = curve_figure8(480, 0.64)
    dist, *_rest = seam_field(x, y, z, pts, tang, 14)
    fuzz = wrap_blur(fbm(x * 14.0, y * 14.0, z * 14.0, 2), 2)
    optic = rgb_of("#d6f20c")
    col = optic * (0.97 + 0.05 * (fuzz - 0.5))[..., None]
    band = smoothstep(0.055, 0.022, dist)
    col = mix(col, rgb_of("#f7f8f2"), band)
    height = (fuzz - 0.5) * 0.06 + band * 0.12
    rough = np.full(x.shape, 0.9, dtype=np.float32)
    rough = mix(rough, 0.72, band)
    return np.clip(col, 0, 1), height, np.clip(rough, 0.6, 1.0)


def paint_melon(x, y, z, theta, phi):
    """Dark green ground, slightly irregular darker stripes, vivid yellow-green bands."""
    wobble = np.sin(theta) * 0.05 * np.sin(phi * 2.0 + 0.6)
    phase = phi + 0.55 + wobble
    wave = np.sin(phase * 8.0)
    dark_k = smoothstep(-0.08, 0.42, wave)
    cap = smoothstep(0.1, 0.38, theta) * smoothstep(0.1, 0.38, np.pi - theta)
    dark_k = dark_k * cap
    field = rgb_of("#7ed42a")
    stripe = rgb_of("#0c4a1e")
    col = mix(field, stripe, dark_k)
    stem = smoothstep(0.18, 0.03, theta)
    col = mix(col, rgb_of("#3a2414"), stem)
    height = dark_k * 0.05 + stem * 0.16
    rough = mix(np.float32(0.48), np.float32(0.4), dark_k)
    rough = mix(rough, np.float32(0.62), stem)
    return np.clip(col, 0, 1), height.astype(np.float32), np.clip(rough, 0.3, 0.7)


def paint_oak(x, y, z):
    """Warm oak with fine, soft fibers along the axis. One or two knots.

    Color varies around the log, not along it, so the ball is not a few wide
    latitude bands. Contrast stays low and the bump stays small.
    """
    radial = np.sqrt(x * x + z * z + np.float32(1e-6))
    # Long soft fibers: high frequency around the log, low frequency along it.
    fiber = fbm(x * 14.0 + y * 0.4, y * 1.6, z * 14.0, 3)
    fiber = wrap_blur(fiber, 2)
    vein = smoothstep(0.58, 0.82, fbm(x * 7.0, y * 0.8, z * 7.0, 2))
    shadow = rgb_of("#b87432")
    light = rgb_of("#e6c08a")
    col = mix(shadow, light, 0.42 + 0.36 * fiber)
    col = mix(col, rgb_of("#8d5528"), vein * 0.16)
    warmth = fbm(x * 0.6, y * 0.25, z * 0.6, 2)
    col = mix(col, rgb_of("#d7a45c"), np.clip(warmth - 0.35, 0, 1) * 0.18)
    end = smoothstep(0.78, 0.97, np.abs(y))
    rings = 0.5 + 0.5 * np.sin(radial * 28.0)
    end_col = mix(rgb_of("#a86a32"), rgb_of("#f0d2a4"), 0.35 + 0.4 * rings)
    col = mix(col, end_col, end * 0.82)

    def knot_mask(dx, dy, dz, edge):
        direction = np.array([dx, dy, dz], dtype=np.float32)
        direction /= np.linalg.norm(direction)
        dot = x * direction[0] + y * direction[1] + z * direction[2]
        core = smoothstep(edge, edge + 0.01, dot)
        halo = smoothstep(edge - 0.018, edge, dot) * (1.0 - core)
        return core, halo

    core_a, halo_a = knot_mask(0.12, 0.02, 0.99, 0.986)
    core_b, halo_b = knot_mask(-0.62, 0.28, 0.62, 0.993)
    col = mix(col, rgb_of("#6a3c18"), np.clip(halo_a * 0.85 + halo_b * 0.65, 0, 1))
    col = mix(col, rgb_of("#3e2412"), np.clip(core_a + core_b * 0.8, 0, 1))
    height = (fiber - 0.5) * 0.012 + vein * 0.008 - core_a * 0.04 - core_b * 0.025
    rough = np.full(x.shape, 0.9, dtype=np.float32)
    rough = mix(rough, np.float32(0.84), end)
    return np.clip(col, 0, 1), height.astype(np.float32), rough


def paint_wood_planet(x, y, z):
    shape = fbm(x * 1.35, y * 1.35, z * 1.35, 5)
    groves = smoothstep(0.56, 0.66, fbm(x * 2.7, y * 2.7, z * 2.7, 4))
    forest = np.clip(smoothstep(0.4, 0.5, shape) * 0.9 + groves, 0.0, 1.0)
    tone = fbm(x * 3.0, y * 3.0, z * 3.0, 3)
    canopy = fbm(x * 6.0, y * 6.0, z * 6.0, 3)
    clearing = smoothstep(0.72, 0.86, fbm(x * 1.8 + 5.0, y * 0.7, z * 1.8, 3)) * (1.0 - forest * 0.55)
    meadow = mix(rgb_of("#7ec84a"), rgb_of("#d6ee78"), tone)
    trees = mix(rgb_of("#0f6a28"), rgb_of("#2f9a40"), tone * 0.6 + canopy * 0.4)
    col = mix(meadow, trees, forest)
    col = mix(col, rgb_of("#d6b25a"), clearing * 0.45)
    height = (shape - 0.5) * 0.32 + groves * 0.04
    rough = mix(np.float32(0.9), np.float32(0.74), forest)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_desert(x, y, z):
    warp = fbm(x * 1.5, y * 1.5, z * 1.5, 4)
    phase = fbm(x * 2.1 + 3.2, y * 2.1, z * 2.1, 5) * 6.2 + warp * 2.4
    dune = np.power(0.5 + 0.5 * np.sin(phase), 1.85)
    grit = fbm(x * 6.0, y * 6.0, z * 6.0, 2)
    rock = smoothstep(0.78, 0.9, fbm(x * 3.4 + 8.0, y * 3.4, z * 3.4, 3))
    valley = rgb_of("#c47a28")
    sand = rgb_of("#f0c46a")
    crest = rgb_of("#ffe6b0")
    stone = rgb_of("#a07848")
    col = mix(valley, sand, dune)
    col = mix(col, crest, np.clip((dune - 0.35) * 1.5, 0.0, 1.0))
    col = col * (0.97 + 0.05 * (grit - 0.5))[..., None]
    col = mix(col, stone, rock * 0.55)
    height = (dune - 0.35) * 0.62 + rock * 0.16
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
    deep = rgb_of("#06306c")
    mid = rgb_of("#1484c8")
    shallow = rgb_of("#22c4c0")
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
    height = (1.0 - depth) * 0.08 + land * (0.36 + canopy * 0.12) + waves * 0.03 * (1.0 - land)
    rough = mix(0.28, 0.16, depth) 
    rough = mix(rough, 0.78, np.clip(land + coast, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_lava(x, y, z):
    n = fbm(x * 2.4, y * 2.4, z * 2.4, 5)
    fine = fbm(x * 8.0, y * 8.0, z * 8.0, 3)
    crack_d = np.abs(n - 0.52)
    crack = smoothstep(0.045, 0.0, crack_d)
    core = smoothstep(0.018, 0.0, crack_d)
    rock_a = rgb_of("#4e4036")
    rock_b = rgb_of("#221c18")
    hot = rgb_of("#ffb018")
    melt = rgb_of("#ff4a10")
    col = mix(rock_b, rock_a, 0.35 + 0.3 * fine)
    col = mix(col, melt, crack)
    col = mix(col, hot, core)
    height = (n - 0.5) * 0.12 - crack * 0.55
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


# The first eight maps shipped in the arcade pass. Leave those files byte-for-byte
# alone unless --rebuild is set, so a later bake does not touch the oak ball.
SHIPPED = {
    "ball_baseball",
    "ball_tennis",
    "ball_melon",
    "ball_oak",
    "planet_wood",
    "planet_desert",
    "planet_ocean",
    "planet_lava",
}


def _wanted(name, only):
    if not only:
        return True
    short = name.split("_", 1)[1]
    return name in only or short in only


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, default=None)
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Also rewrite the eight maps that already shipped (baseball, tennis, melon, oak, wood, desert, ocean, lava).",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        default=None,
        help="Bake just these ids (ball_soccer or soccer).",
    )
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    # Oak bump stays small (0.16) so a --rebuild keeps the soft grain.
    balls = {
        "ball_baseball": (paint_baseball, 0.85, 84, False),
        "ball_tennis": (paint_tennis, 0.4, 82, False),
        "ball_oak": (paint_oak, 0.16, 82, False),
        "ball_melon": (paint_melon, 0.4, 82, False),
    }
    planets = {
        "planet_wood": (paint_wood_planet, 0.55, 80, False),
        "planet_desert": (paint_desert, 0.9, 80, False),
        "planet_ocean": (paint_ocean, 0.7, 80, False),
        "planet_lava": (paint_lava, 0.95, 80, True),
    }
    previews = {}
    for name, (fn, strength, quality, emissive) in {**balls, **planets}.items():
        if not _wanted(name, args.only):
            continue
        if name in SHIPPED and not args.rebuild:
            print(f"skip {name} (shipped)")
            continue
        print(name)
        w, h = (BALL_W, BALL_H) if name.startswith("ball_") else (PLANET_W, PLANET_H)
        color, normal = bake_one(name, fn, w, h, strength, quality, with_emissive=emissive)
        previews[name] = (color, normal)

    from sphere_rest import bake_remaining

    previews.update(bake_remaining(args.preview, args.only))

    if args.preview:
        for name, (color, normal) in previews.items():
            lit_preview(color, normal, args.preview / f"{name}.png", yaw=0.65, pitch=0.22)
            lit_preview(color, normal, args.preview / f"{name}_top.png", yaw=0.2, pitch=1.15)
        print(f"previews in {args.preview}")


if __name__ == "__main__":
    main()
