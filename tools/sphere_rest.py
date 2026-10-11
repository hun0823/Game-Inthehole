"""Equirectangular maps for the remaining balls and planets.

Same baker as tools/bake_sphere_maps.py. Patterns are functions of the
sphere direction, so the longitude seam is one point. Colors follow the
canvas materials in js/board3d.js and the approved collection sheets.
Gummy carries a freckle map so the jelly is not a flat hot-pink fill.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from bake_sphere_maps import (
    BALL_H,
    BALL_W,
    PLANET_H,
    PLANET_W,
    bake_one,
    dirs,
    fbm,
    lit_preview,
    mix,
    rgb_of,
    smoothstep,
    wrap_blur,
)

# Local direction that faces the asset-sheet camera after ballSpin
# rotation (0.16, 0.42, 0.02) and camera (0.02, 0.2, 1.55).
FRONT = np.array([-0.39035642, 0.2713097, 0.87978004], dtype=np.float32)
FRONT /= np.linalg.norm(FRONT)


def _basis(direction):
    d = np.asarray(direction, dtype=np.float32)
    d = d / (np.linalg.norm(d) + 1e-8)
    helper = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    if abs(float(d[1])) > 0.85:
        helper = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    tangent = np.cross(helper, d)
    tangent /= np.linalg.norm(tangent) + 1e-8
    bitangent = np.cross(d, tangent)
    return d, tangent.astype(np.float32), bitangent.astype(np.float32)


def _project(x, y, z, d, tangent, bitangent):
    lx = x * tangent[0] + y * tangent[1] + z * tangent[2]
    ly = x * bitangent[0] + y * bitangent[1] + z * bitangent[2]
    lz = x * d[0] + y * d[1] + z * d[2]
    return lx, ly, lz


def _ang(x, y, z, direction):
    d = np.asarray(direction, dtype=np.float32)
    d = d / (np.linalg.norm(d) + 1e-8)
    return np.arccos(np.clip(x * d[0] + y * d[1] + z * d[2], -1.0, 1.0))


def _disc(x, y, z, direction, radius, soft):
    return smoothstep(radius + soft, radius, _ang(x, y, z, direction))


def _fibonacci(n, phase=0.0):
    i = np.arange(n, dtype=np.float32)
    y = 1.0 - (i + 0.5) / n * 2.0
    radius = np.sqrt(np.maximum(0.0, 1.0 - y * y))
    gold = np.float32(np.pi * (3.0 - np.sqrt(5.0)))
    theta = gold * i + np.float32(phase)
    pts = np.stack([np.cos(theta) * radius, y, np.sin(theta) * radius], axis=1)
    pts /= np.linalg.norm(pts, axis=1, keepdims=True) + 1e-8
    return pts.astype(np.float32)


def _nearest(x, y, z, points):
    flat = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    dots = flat @ points.T
    nearest = np.argmax(dots, axis=1)
    order = np.partition(dots, -2, axis=1)
    gap = (order[:, -1] - order[:, -2]).reshape(x.shape)
    return nearest.reshape(x.shape), dots.max(axis=1).reshape(x.shape), gap


def _mean_rgb(color):
    mean = color.reshape(-1, 3).mean(axis=0)
    return tuple(int(round(float(v) * 255)) for v in mean)


def _cap_luma(color, limit):
    luma = color[..., 0] * 0.2126 + color[..., 1] * 0.7152 + color[..., 2] * 0.0722
    scale = np.ones(luma.shape, dtype=np.float32)
    hot = luma > limit
    scale[hot] = limit / luma[hot]
    return color * scale[..., None]


def paint_dune(x, y, z):
    phase = y * 9.0 + 0.22 * np.sin(np.arctan2(z, x) * 2.0)
    dune = np.power(0.5 + 0.5 * np.sin(phase), 1.6).astype(np.float32)
    valley = rgb_of("#c9964a")
    sand = rgb_of("#e6c27a")
    crest = rgb_of("#f6e2b0")
    col = mix(valley, sand, dune)
    col = mix(col, crest, np.clip((dune - 0.55) * 2.2, 0.0, 1.0))
    broad = fbm(x * 1.4, y * 0.6, z * 1.4, 2)
    col = col * (0.97 + 0.06 * (broad - 0.5))[..., None]
    height = (dune - 0.4) * 0.45
    rough = mix(np.float32(0.94), np.float32(0.82), dune)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_marble(x, y, z):
    flow = np.sin(np.arctan2(z, x) * 2.0 + y * 5.5 + 0.55 * np.sin(x * 3.0 + z))
    flow2 = np.sin(np.arctan2(z, x) * 3.0 - y * 4.0 + 1.4)
    white = rgb_of("#f4fbff")
    ice = rgb_of("#b7f3ff")
    cyan = rgb_of("#2f9ec8")
    deep = rgb_of("#1a6eb8")
    col = mix(white, ice, smoothstep(-0.2, 0.35, flow))
    col = mix(col, cyan, smoothstep(0.15, 0.55, flow))
    col = mix(col, deep, smoothstep(0.45, 0.85, flow2) * 0.85)
    vein = smoothstep(0.92, 0.98, np.abs(flow))
    col = mix(col, deep, vein * 0.65)
    height = vein * 0.12 + flow * 0.03
    rough = mix(np.float32(0.16), np.float32(0.08), smoothstep(0.0, 0.8, flow))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_soccer(x, y, z):
    phi = (1.0 + np.sqrt(5.0)) / 2.0
    raw = []
    for i in (-1.0, 1.0):
        for j in (-1.0, 1.0):
            raw.append((0.0, i, j * phi))
            raw.append((i, j * phi, 0.0))
            raw.append((j * phi, 0.0, i))
    pts = np.array(raw, dtype=np.float32)
    pts /= np.linalg.norm(pts, axis=1, keepdims=True)
    _idx, best, gap = _nearest(x, y, z, pts)
    # Neighbor vertices sit ~63° apart. The black pentagon fills the inner part.
    black = smoothstep(0.965, 0.988, best)
    edge = smoothstep(0.055, 0.012, gap) * (1.0 - black)
    leather = rgb_of("#f7f7f7")
    ink = rgb_of("#1a1a1a")
    seam = rgb_of("#c8c8c8")
    col = mix(leather, seam, edge * 0.55)
    col = mix(col, ink, black)
    height = black * 0.16 - edge * 0.05
    rough = mix(np.float32(0.58), np.float32(0.46), black)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_tire(x, y, z):
    """Black rubber with concentric tread rings. No yellow sidewall, no block tread."""
    axis = np.array([0.0, 0.62, 0.78], dtype=np.float32)
    axis /= np.linalg.norm(axis)
    along = x * axis[0] + y * axis[1] + z * axis[2]
    radial = np.sqrt(np.maximum(np.float32(0.0), 1.0 - along * along))
    wave = 0.5 + 0.5 * np.sin(radial * 36.0)
    groove = smoothstep(0.28, 0.62, wave)
    rubber = rgb_of("#2a2e34")
    ring = rgb_of("#8e969e")
    col = mix(rubber, ring, groove)
    height = groove * 0.55
    rough = mix(np.float32(0.9), np.float32(0.62), groove)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_slime(x, y, z):
    """Bright green with many small freckles, not large dark blotches."""
    base = rgb_of("#4ad85a")
    freckle = rgb_of("#146828")
    light = rgb_of("#d8ffb0")
    pts = _fibonacci(48, 0.7)
    spot = np.zeros(x.shape, dtype=np.float32)
    pale = np.zeros(x.shape, dtype=np.float32)
    for i, point in enumerate(pts):
        disc = _disc(x, y, z, point, 0.055, 0.016)
        if i % 5 == 0:
            pale = np.maximum(pale, disc)
        else:
            spot = np.maximum(spot, disc)
    col = mix(base, freckle, spot)
    col = mix(col, light, pale * 0.85)
    height = spot * 0.08 + pale * 0.04
    rough = mix(np.float32(0.32), np.float32(0.22), np.clip(spot + pale, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_snow(x, y, z):
    """Clean white. Bump stays, blue-gray stains do not."""
    lump = fbm(x * 2.2, y * 2.2, z * 2.2, 3)
    white = rgb_of("#f7fbff")
    shade = rgb_of("#e7eef6")
    col = mix(white, shade, smoothstep(0.62, 0.82, lump) * 0.18)
    height = wrap_blur(((lump - 0.5) * 0.35).astype(np.float32), 2)
    rough = np.full(x.shape, 0.72, dtype=np.float32)
    return np.clip(col, 0, 1), height.astype(np.float32), rough


def paint_basketball(x, y, z):
    tone = fbm(x * 2.0, y * 2.0, z * 2.0, 2)
    orange = mix(rgb_of("#c9440c"), rgb_of("#ef5a14"), 0.4 + 0.6 * tone)
    lon = np.arctan2(z, x)
    wavy = y + 0.06 * np.sin(lon * 2.0)
    width = np.float32(0.034)
    equator = smoothstep(width, width * 0.35, np.abs(wavy))
    meridian = smoothstep(width, width * 0.35, np.abs(x))
    smile = smoothstep(width, width * 0.35, np.abs(y - 0.42 * np.cos(lon)) * 0.75)
    seams = np.clip(np.maximum(np.maximum(equator, meridian), smile), 0.0, 1.0)
    col = mix(orange, rgb_of("#1a120c"), seams)
    height = (tone - 0.5) * 0.04 - seams * 0.22
    rough = mix(np.float32(0.66), np.float32(0.5), seams)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_beach(x, y, z):
    """Volleyball gores: colored slices that meet at the poles."""
    bands = ["#f7f7f7", "#ff5b9a", "#ffe14a", "#f7f7f7", "#3ec4ff", "#ff5b9a"]
    colors = np.stack([rgb_of(h) for h in bands], axis=0)
    lon = np.arctan2(z, x)
    # Half a gore past the longitude seam so the wrap sits inside one slice.
    t = np.mod(lon + np.pi + np.pi / 6.0, 2.0 * np.pi) / (2.0 * np.pi)
    idx = np.floor(t * 6.0).astype(np.int32) % 6
    col = colors[idx]
    edge = np.minimum(t * 6.0 % 1.0, 1.0 - (t * 6.0 % 1.0))
    seam = smoothstep(0.08, 0.015, edge)
    col = mix(col, rgb_of("#1a1a1a"), seam * 0.35)
    height = seam * 0.1
    rough = np.full(x.shape, 0.42, dtype=np.float32)
    return np.clip(col, 0, 1), height, rough


def paint_bowling(x, y, z):
    swirl = fbm(x * 1.6 + 0.4, y * 1.6, z * 1.6, 3)
    deep = rgb_of("#12121a")
    purple = rgb_of("#3a2468")
    glow = rgb_of("#6a3a90")
    col = mix(deep, purple, smoothstep(0.35, 0.7, swirl))
    col = mix(col, glow, smoothstep(0.62, 0.82, swirl) * 0.7)
    d, tangent, bitangent = _basis(FRONT)
    lx, ly, lz = _project(x, y, z, d, tangent, bitangent)
    holes = [(0.0, 0.07, 0.085), (-0.1, -0.06, 0.078), (0.105, -0.055, 0.075)]
    height = (swirl - 0.5) * 0.08
    cover = np.zeros(x.shape, dtype=np.float32)
    for cx, cy, radius in holes:
        dist = np.sqrt((lx - cx) ** 2 + (ly - cy) ** 2)
        rim = smoothstep(radius + 0.02, radius + 0.006, dist) * smoothstep(radius - 0.004, radius + 0.008, dist)
        pit = smoothstep(radius, radius * 0.55, dist)
        facing = smoothstep(0.05, 0.35, lz)
        col = mix(col, rgb_of("#ece8e0"), rim * facing)
        col = mix(col, rgb_of("#14141c"), pit * facing)
        height = height - pit * facing * 0.35
        cover = np.maximum(cover, pit * facing)
    rough = mix(np.float32(0.34), np.float32(0.55), cover)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_meteor(x, y, z):
    n = fbm(x * 2.2, y * 2.2, z * 2.2, 4)
    crack_d = np.abs(n - 0.5)
    crack = smoothstep(0.035, 0.0, crack_d)
    core = smoothstep(0.012, 0.0, crack_d)
    rock = mix(rgb_of("#2a120c"), rgb_of("#4a2820"), 0.35 + 0.4 * fbm(x * 3.0, y * 3.0, z * 3.0, 2))
    melt = rgb_of("#ff4a10")
    hot = rgb_of("#ffb020")
    col = mix(rock, melt, crack)
    col = mix(col, hot, core)
    height = (n - 0.5) * 0.1 - crack * 0.4
    rough = mix(np.float32(0.86), np.float32(0.32), crack)
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    emissive += melt * (crack * 0.55)[..., None]
    emissive += hot * core[..., None]
    return np.clip(col, 0, 1), height.astype(np.float32), np.clip(rough, 0.2, 1.0), np.clip(emissive, 0, 1)


def _star(lx, ly, lz, points, outer, inner):
    """Sharp star, not rounded petals."""
    ang = np.arctan2(ly, lx) + np.pi / points
    sector = (2.0 * np.pi) / points
    local = np.mod(ang, sector)
    tri = 1.0 - np.abs(local - sector * 0.5) / (sector * 0.5)
    bound = inner + (outer - inner) * tri
    radius = np.arccos(np.clip(lz, -1.0, 1.0))
    return smoothstep(bound, bound * 0.86, radius) * smoothstep(0.0, 0.2, lz)


def paint_toy(x, y, z):
    pink = rgb_of("#ff4d88")
    band = smoothstep(0.11, 0.07, np.abs(y))
    col = mix(pink, rgb_of("#fff7f2"), band)
    d, tangent, bitangent = _basis(FRONT)
    lx, ly, lz = _project(x, y, z, d, tangent, bitangent)
    star = _star(lx, ly, lz, 5, 0.34, 0.14)
    col = mix(col, rgb_of("#ffe14a"), star)
    height = band * 0.06 + star * 0.16
    rough = mix(np.float32(0.42), np.float32(0.32), np.clip(band + star, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_mushroom_ball(x, y, z):
    cap = smoothstep(-0.08, 0.08, y)
    stem = rgb_of("#f4f0ea")
    red = rgb_of("#e23b3b")
    col = mix(stem, red, cap)
    spots = _fibonacci(7, 0.6)
    spots[:, 1] = np.abs(spots[:, 1]) * 0.75 + 0.15
    spots /= np.linalg.norm(spots, axis=1, keepdims=True)
    spot = np.zeros(x.shape, dtype=np.float32)
    for point in spots:
        spot = np.maximum(spot, _disc(x, y, z, point, 0.16, 0.03))
    spot *= cap
    col = mix(col, rgb_of("#fff8ea"), spot)
    gill = smoothstep(0.16, 0.02, np.abs(y)) * (1.0 - cap * 0.3)
    line = smoothstep(0.25, 0.85, 0.5 + 0.5 * np.sin(np.arctan2(z, x) * 10.0))
    col = mix(col, rgb_of("#e7d3c0"), gill * line * 0.45)
    height = cap * 0.08 + spot * 0.12 - gill * 0.04
    rough = mix(np.float32(0.62), np.float32(0.48), cap)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_coco(x, y, z):
    """Hairy husk. Fibers run the long way; the three pores stay small."""
    lon = np.arctan2(z, x)
    warp = fbm(x * 3.0, y * 3.0, z * 3.0, 2)
    hair = 0.5 + 0.5 * np.sin(lon * 46.0 + y * 8.0 + warp * 5.0)
    hair = wrap_blur(hair.astype(np.float32), 1)
    husk = mix(rgb_of("#3a1c0c"), rgb_of("#8a5428"), smoothstep(0.25, 0.75, hair))
    husk = mix(husk, rgb_of("#c48a58"), smoothstep(0.72, 0.95, hair) * 0.7)
    height = (hair - 0.45) * 0.42
    rough = mix(np.float32(0.92), np.float32(0.7), hair)
    return np.clip(husk, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_alien_ball(x, y, z):
    band = smoothstep(0.22, 0.05, np.abs(y - 0.05))
    blobs = fbm(x * 2.1, y * 2.1, z * 2.1, 3)
    spots = smoothstep(0.62, 0.78, blobs)
    base = rgb_of("#9a6cff")
    deep = rgb_of("#5a38a8")
    pale = rgb_of("#d2c0ff")
    col = mix(base, pale, band * 0.55)
    col = mix(col, deep, spots)
    height = spots * 0.1 + band * 0.03
    rough = mix(np.float32(0.32), np.float32(0.18), band)
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    emissive += rgb_of("#b894ff") * (spots * 0.45 + band * 0.12)[..., None]
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32), np.clip(emissive, 0, 1)


def paint_gear(x, y, z):
    """Paneled steel sphere. Seams, not a hub and blades."""
    panels = [rgb_of("#d5dde6"), rgb_of("#b7c2ce"), rgb_of("#eef2f6")]
    palette = np.stack(panels, axis=0)
    dominant, iu, iv, edge = _cube_cells(x, y, z, 4)
    index = (dominant + iu + iv) % len(panels)
    col = palette[index]
    gap = smoothstep(0.1, 0.02, edge)
    col = mix(col, rgb_of("#3a424c"), gap)
    rivet = smoothstep(0.045, 0.09, edge) * smoothstep(0.16, 0.1, edge)
    col = mix(col, rgb_of("#f4f7fb"), rivet * 0.7)
    warm = np.clip(col[..., 0] - col[..., 2], 0.0, 1.0)
    col = col.copy()
    col[..., 0] -= warm * 0.85
    height = (1.0 - gap) * 0.16 + rivet * 0.05
    rough = mix(np.float32(0.34), np.float32(0.55), gap)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_golf(x, y, z):
    pts = _fibonacci(48, 0.2)
    _idx, best, _gap = _nearest(x, y, z, pts)
    dimple = smoothstep(0.975, 0.993, best)
    white = rgb_of("#f7f7f4")
    pit = rgb_of("#c8c8c0")
    col = mix(white, pit, dimple * 0.65)
    height = -dimple * 0.28
    rough = mix(np.float32(0.42), np.float32(0.55), dimple)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_yarn(x, y, z):
    """Beige thread wound in tight wraps. No pink."""
    axes = (
        np.array([0.08, 0.99, 0.08], dtype=np.float32),
        np.array([0.96, 0.12, 0.24], dtype=np.float32),
    )
    freqs = (34.0, 22.0)
    palette = (rgb_of("#f3e2c8"), rgb_of("#e4cba6"))
    col = np.broadcast_to(rgb_of("#d7b48a"), x.shape + (3,)).astype(np.float32).copy()
    height = np.zeros(x.shape, dtype=np.float32)
    cover = np.zeros(x.shape, dtype=np.float32)
    for axis, freq, color in zip(axes, freqs, palette):
        axis = axis / (np.linalg.norm(axis) + 1e-8)
        dot = x * axis[0] + y * axis[1] + z * axis[2]
        wave = np.abs(np.sin(dot * freq))
        fiber = smoothstep(0.12, 0.85, wave)
        col = mix(col, color, fiber * 0.8)
        height = height + fiber * 0.07
        cover = np.maximum(cover, fiber)
    crease = smoothstep(0.55, 0.12, cover)
    col = mix(col, rgb_of("#a8845c"), crease * 0.55)
    height = wrap_blur((height - crease * 0.06).astype(np.float32), 1)
    rough = mix(np.float32(0.92), np.float32(0.74), cover)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_donut(x, y, z):
    dough = rgb_of("#e7b07a")
    frost = smoothstep(0.02, 0.14, y) * smoothstep(0.82, 0.62, y)
    col = mix(dough, rgb_of("#f4a0c0"), frost)
    icing = smoothstep(0.55, 0.75, y)
    col = mix(col, rgb_of("#ffd0e0"), icing * 0.35)
    bits = [
        (0.02, 0.14, 0.4, "#ff4d6a"),
        (-0.16, 0.04, 0.1, "#7adf5a"),
        (0.15, 0.02, -0.5, "#ffd24a"),
        (-0.06, 0.2, 1.1, "#4ec8ff"),
        (0.18, -0.08, 0.8, "#ffffff"),
        (-0.18, 0.16, -0.3, "#ff4d6a"),
        (0.06, -0.02, 1.6, "#7adf5a"),
    ]
    height = frost * 0.08
    d, tangent, bitangent = _basis(FRONT)
    for ox, oy, spin, hex_color in bits:
        center = d + tangent * ox + bitangent * oy
        center = center / (np.linalg.norm(center) + 1e-8)
        cd, ct, cb = _basis(center)
        lx, ly, lz = _project(x, y, z, cd, ct, cb)
        cs, sn = np.cos(spin), np.sin(spin)
        rx = lx * cs - ly * sn
        ry = lx * sn + ly * cs
        dash = smoothstep(1.05, 0.65, np.sqrt((rx / 0.13) ** 2 + (ry / 0.045) ** 2))
        dash = dash * smoothstep(0.15, 0.45, lz)
        col = mix(col, rgb_of(hex_color), dash)
        height = height + dash * 0.12
    rough = mix(np.float32(0.55), np.float32(0.38), frost)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def _cube_cells(x, y, z, n):
    coords = np.stack([x, y, z], axis=-1)
    dominant = np.argmax(np.abs(coords), axis=-1)
    u = np.zeros(x.shape, dtype=np.float32)
    v = np.zeros(x.shape, dtype=np.float32)
    for axis, (ia, ib) in enumerate(((1, 2), (0, 2), (0, 1))):
        denom = np.abs(coords[..., axis]) + 1e-4
        uu = coords[..., ia] / denom
        vv = coords[..., ib] / denom
        mask = dominant == axis
        u = np.where(mask, uu, u)
        v = np.where(mask, vv, v)
    fu = (u * 0.5 + 0.5) * n
    fv = (v * 0.5 + 0.5) * n
    iu = np.clip(np.floor(fu).astype(np.int32), 0, n - 1)
    iv = np.clip(np.floor(fv).astype(np.int32), 0, n - 1)
    edge = np.minimum(np.minimum(fu % 1.0, 1.0 - (fu % 1.0)), np.minimum(fv % 1.0, 1.0 - (fv % 1.0)))
    return dominant, iu, iv, edge.astype(np.float32)


def paint_disco(x, y, z):
    """Fine silver mirror tiles. No gold, no blue panes."""
    tiles = ["#f7f8fa", "#d5dbe3", "#eef1f5", "#c3ccd6"]
    palette = np.stack([rgb_of(h) for h in tiles], axis=0)
    dominant, iu, iv, edge = _cube_cells(x, y, z, 8)
    index = (dominant * 3 + iu + iv * 2) % len(tiles)
    col = palette[index]
    gap = smoothstep(0.08, 0.015, edge)
    col = mix(col, rgb_of("#2a3038"), gap)
    height = (1.0 - gap) * 0.14
    rough = mix(np.float32(0.16), np.float32(0.5), gap)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_lucky(x, y, z):
    red = mix(rgb_of("#a82830"), rgb_of("#c4363a"), smoothstep(-0.2, 0.4, y))
    band = smoothstep(0.1, 0.055, np.abs(y - 0.02))
    col = mix(red, rgb_of("#f2c14a"), band)
    col = mix(col, rgb_of("#c47a20"), smoothstep(0.045, 0.09, np.abs(np.abs(y - 0.02) - 0.055)) * band)
    d, tangent, bitangent = _basis(FRONT)
    lx, ly, lz = _project(x, y, z, d, tangent, bitangent)
    # Coin sitting above the band, square hole in the middle.
    coin_y = ly - 0.02
    dist = np.sqrt(lx * lx + coin_y * coin_y)
    coin = smoothstep(0.16, 0.12, dist) * smoothstep(0.15, 0.45, lz)
    square = (np.abs(lx) < 0.045) & (np.abs(coin_y) < 0.045) & (lz > 0.2)
    col = mix(col, rgb_of("#f2c14a"), coin)
    col = mix(col, rgb_of("#c47a20"), coin * smoothstep(0.1, 0.15, dist))
    col = np.where(square[..., None], rgb_of("#a82830"), col)
    knot = smoothstep(0.05, 0.02, np.sqrt(lx * lx + (ly + 0.16) ** 2)) * smoothstep(0.2, 0.5, lz)
    col = mix(col, rgb_of("#f2c14a"), knot)
    height = band * 0.08 + coin * 0.12 + knot * 0.1
    rough = mix(np.float32(0.55), np.float32(0.38), np.clip(band + coin, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_cat(x, y, z):
    """Fluffy mottled fur, not smooth stripes."""
    blob = fbm(x * 2.6, y * 2.6, z * 2.6, 4)
    tuft = fbm(x * 9.0, y * 9.0, z * 9.0, 3)
    cream = rgb_of("#f3e6d4")
    tan = rgb_of("#c49a6a")
    brown = rgb_of("#7a5434")
    col = mix(cream, tan, smoothstep(0.38, 0.62, blob))
    col = mix(col, brown, smoothstep(0.62, 0.82, blob))
    col = col * (0.9 + 0.16 * (tuft - 0.5))[..., None]
    height = wrap_blur(((tuft - 0.5) * 0.55 + (blob - 0.5) * 0.2).astype(np.float32), 1)
    rough = np.full(x.shape, 0.94, dtype=np.float32)
    return np.clip(col, 0, 1), height.astype(np.float32), rough


def paint_gummy(x, y, z):
    """Hot-pink jelly with freckles big enough to read on the board."""
    base = rgb_of("#ff5a9a")
    dark = rgb_of("#e02870")
    light = rgb_of("#ffd0e6")
    pts = _fibonacci(28, 1.4)
    spot = np.zeros(x.shape, dtype=np.float32)
    pale = np.zeros(x.shape, dtype=np.float32)
    for i, point in enumerate(pts):
        disc = _disc(x, y, z, point, 0.09, 0.02)
        if i % 3 == 0:
            pale = np.maximum(pale, disc)
        else:
            spot = np.maximum(spot, disc)
    col = mix(base, dark, spot * 0.85)
    col = mix(col, light, pale * 0.9)
    height = spot * 0.06 + pale * 0.04
    rough = mix(np.float32(0.28), np.float32(0.18), np.clip(spot + pale, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_pixel(x, y, z):
    """Six faces, each split once. Four colors and a dark joint. No fine pixels."""
    colors = np.stack(
        [rgb_of(h) for h in ("#3a6cff", "#ffd24a", "#ff5a5a", "#6adf55")],
        axis=0,
    )
    ink = rgb_of("#1a2040")
    dominant, iu, iv, edge = _cube_cells(x, y, z, 2)
    index = (dominant + iu + iv * 2) % 4
    col = colors[index]
    joint = smoothstep(0.16, 0.05, edge)
    col = mix(col, ink, joint)
    height = (1.0 - joint) * 0.14
    rough = np.full(x.shape, 0.72, dtype=np.float32)
    return np.clip(col, 0, 1), height.astype(np.float32), rough


def paint_globe(x, y, z):
    land_n = fbm(x * 1.7 + 0.4, y * 1.5, z * 1.7, 4)
    land = smoothstep(0.52, 0.62, land_n)
    coast = smoothstep(0.48, 0.56, land_n) * (1.0 - land)
    ocean = mix(rgb_of("#1d5eae"), rgb_of("#3aa0e0"), smoothstep(-0.2, 0.55, y))
    green = mix(rgb_of("#2f7a3a"), rgb_of("#3d9a4a"), fbm(x * 3.0, y * 3.0, z * 3.0, 2))
    sand = rgb_of("#e6d09a")
    col = mix(ocean, sand, coast)
    col = mix(col, green, land)
    cap = smoothstep(0.72, 0.86, np.abs(y))
    col = mix(col, rgb_of("#f4f8ff"), cap)
    height = land * 0.22 + cap * 0.05
    rough = mix(np.float32(0.28), np.float32(0.62), np.clip(land + cap, 0, 1))
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_skull(x, y, z):
    bone = rgb_of("#efe8dc")
    shade = fbm(x * 1.5, y * 1.5, z * 1.5, 2)
    col = bone * (0.94 + 0.08 * (shade - 0.5))[..., None]
    d, tangent, bitangent = _basis(FRONT)
    lx, ly, lz = _project(x, y, z, d, tangent, bitangent)
    facing = smoothstep(0.0, 0.35, lz)
    def eye(cx, cy):
        dx = (lx - cx) / 0.09
        dy = (ly - cy) / 0.11
        return smoothstep(1.05, 0.78, np.sqrt(dx * dx + dy * dy)) * facing
    eyes = np.maximum(eye(-0.11, 0.05), eye(0.11, 0.05))
    nose = smoothstep(0.07, 0.03, np.sqrt((lx * 1.15) ** 2 + (ly + 0.08) ** 2)) * facing
    teeth = np.zeros(x.shape, dtype=np.float32)
    for cx in np.linspace(-0.12, 0.12, 4):
        gap = smoothstep(0.032, 0.012, np.abs(lx - cx)) * smoothstep(0.05, 0.02, np.abs(ly + 0.18))
        teeth = np.maximum(teeth, gap * facing)
    col = mix(col, rgb_of("#2a1838"), np.clip(eyes + nose * 0.85, 0, 1))
    col = mix(col, rgb_of("#d9cfc2"), teeth * 0.7)
    col = mix(col, rgb_of("#2a1838"), teeth * smoothstep(0.012, 0.004, np.abs(lx % 0.04 - 0.02)))
    height = eyes * -0.2 + nose * -0.08 + facing * 0.02
    rough = mix(np.float32(0.5), np.float32(0.4), eyes)
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    emissive += rgb_of("#9a5ae0") * (eyes * 0.85)[..., None]
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32), np.clip(emissive, 0, 1)


def paint_ice_planet(x, y, z):
    sheet = fbm(x * 1.6, y * 1.3, z * 1.6, 4)
    fine = fbm(x * 3.2 + 2.0, y * 2.4, z * 3.2, 2)
    crack = smoothstep(0.04, 0.0, np.abs(sheet - 0.48))
    cap = smoothstep(0.55, 0.78, np.abs(y))
    sea = mix(rgb_of("#7eb4dc"), rgb_of("#d7eef8"), 0.35 + 0.45 * fine)
    pack = rgb_of("#f3f9ff")
    col = mix(sea, pack, cap)
    col = mix(col, rgb_of("#3e6a90"), crack * (1.0 - cap * 0.7))
    col = mix(col, rgb_of("#e7f3fb"), smoothstep(0.62, 0.8, sheet) * (1.0 - cap) * 0.35)
    height = (sheet - 0.5) * 0.28 + cap * 0.12 - crack * 0.35
    rough = mix(np.float32(0.28), np.float32(0.18), cap)
    rough = mix(rough, np.float32(0.45), crack)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_crystal_planet(x, y, z):
    """Large facets in navy and deep purple. No white faces."""
    sites = _fibonacci(22, 0.35)
    nearest, _best, gap = _nearest(x, y, z, sites)
    palette = np.stack(
        [
            rgb_of("#1c2448"),
            rgb_of("#241850"),
            rgb_of("#2a3278"),
            rgb_of("#3a2870"),
            rgb_of("#342868"),
            rgb_of("#243868"),
        ],
        axis=0,
    )
    col = palette[nearest % len(palette)]
    edge = smoothstep(0.09, 0.015, gap)
    rim = rgb_of("#6a5c98")
    col = mix(col, rim, edge * 0.55)
    col = _cap_luma(col, 0.58)
    height = ((nearest % 5).astype(np.float32) - 2.0) * 0.06 - edge * 0.22
    rough = mix(np.float32(0.42), np.float32(0.3), edge)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_toy_planet(x, y, z):
    lon = np.arctan2(z, x)
    wavy = np.clip(y + 0.14 * np.sin(lon * 3.0 + 0.4), -1.0, 1.0)
    bands = np.stack(
        [rgb_of(h) for h in ("#ff4d88", "#ffe14a", "#3ec4ff", "#7adf5a")],
        axis=0,
    )
    t = np.clip((wavy + 1.0) * 0.5, 0.0, 0.999)
    idx = np.floor(t * 4.0).astype(np.int32)
    col = bands[idx]
    height = np.zeros(x.shape, dtype=np.float32)
    rough = np.full(x.shape, 0.48, dtype=np.float32)
    return col, height, rough


def paint_mushroom_planet(x, y, z):
    field = fbm(x * 1.5, y * 1.2, z * 1.5, 3)
    cap = mix(rgb_of("#a33a48"), rgb_of("#e23b3b"), smoothstep(0.35, 0.65, field))
    moss = smoothstep(0.22, 0.34, field)
    col = mix(rgb_of("#3d5a32"), cap, moss)
    spots = _fibonacci(9, 1.7)
    spot = np.zeros(x.shape, dtype=np.float32)
    for point in spots:
        spot = np.maximum(spot, _disc(x, y, z, point, 0.11, 0.02))
    col = mix(col, rgb_of("#f4efe6"), spot * moss)
    height = (field - 0.5) * 0.08 + spot * 0.03
    rough = mix(np.float32(0.78), np.float32(0.58), moss)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_candy_planet(x, y, z):
    lon = np.arctan2(z, x)
    swirl = np.sin(lon * 2.0 + y * 8.0)
    pink = rgb_of("#ff8ad0")
    deep = rgb_of("#e45aa8")
    col = mix(deep, pink, 0.5 + 0.5 * swirl)
    icing = smoothstep(0.35, 0.75, swirl)
    col = mix(col, rgb_of("#fff4f8"), icing)
    dots = _fibonacci(8, 2.2)
    for point in dots:
        col = mix(col, rgb_of("#ffe14a"), _disc(x, y, z, point, 0.05, 0.015))
    height = icing * 0.08
    rough = mix(np.float32(0.4), np.float32(0.24), icing)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_jungle_planet(x, y, z):
    canopy = fbm(x * 2.1, y * 1.6, z * 2.1, 4)
    clumps = smoothstep(0.4, 0.62, fbm(x * 3.4 + 1.0, y * 2.2, z * 3.4, 3))
    river_n = fbm(x * 1.15 + 3.0, y * 0.45, z * 1.15, 3)
    river = smoothstep(0.045, 0.0, np.abs(river_n - 0.5))
    dark = rgb_of("#0e3d1c")
    mid = rgb_of("#1d6b32")
    light = rgb_of("#3d9a48")
    col = mix(dark, mid, smoothstep(0.35, 0.6, canopy))
    col = mix(col, light, clumps * 0.75)
    col = mix(col, rgb_of("#2a8fb0"), river)
    col = mix(col, rgb_of("#7ec8c0"), smoothstep(0.02, 0.0, np.abs(river_n - 0.5)) * 0.7)
    height = (canopy - 0.45) * 0.4 + clumps * 0.08 - river * 0.18
    rough = mix(np.float32(0.86), np.float32(0.4), river)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32)


def paint_alien_planet(x, y, z):
    ground = fbm(x * 1.5, y * 1.4, z * 1.5, 3)
    base = mix(rgb_of("#4a28a8"), rgb_of("#6a3ad0"), ground)
    band = smoothstep(0.18, 0.05, np.abs(y))
    col = mix(base, rgb_of("#8a62e8"), band * 0.45)
    craters = _fibonacci(8, 0.9)
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    height = (ground - 0.5) * 0.16
    for i, point in enumerate(craters):
        ang = _ang(x, y, z, point)
        bowl = smoothstep(0.2, 0.06, ang)
        rim = smoothstep(0.22, 0.16, ang) * smoothstep(0.12, 0.17, ang)
        col = mix(col, rgb_of("#2a1468"), bowl * 0.85)
        col = mix(col, rgb_of("#c8b6ff"), rim * 0.7)
        height = height - bowl * 0.22 + rim * 0.08
        if i % 3 == 0:
            pool = smoothstep(0.12, 0.03, ang)
            col = mix(col, rgb_of("#c6f25a"), pool)
            emissive += rgb_of("#b6f25a") * pool[..., None]
    rough = mix(np.float32(0.62), np.float32(0.4), band)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32), np.clip(emissive, 0, 1)


def paint_machine_planet(x, y, z):
    dominant, iu, iv, edge = _cube_cells(x, y, z, 4)
    shade = ((dominant * 3 + iu * 5 + iv * 7) % 5).astype(np.float32) / 4.0
    steel = mix(rgb_of("#6a737e"), rgb_of("#b7c0ca"), shade)
    gap = smoothstep(0.1, 0.03, edge)
    col = mix(steel, rgb_of("#3a424c"), gap)
    rivet = smoothstep(0.08, 0.16, edge) * smoothstep(0.22, 0.12, edge)
    col = mix(col, rgb_of("#d5dde6"), rivet * 0.8)
    lights = _fibonacci(6, 2.8)
    light_cols = [rgb_of("#3ec4ff"), rgb_of("#ff5a5a"), rgb_of("#7adf5a")]
    emissive = np.zeros(x.shape + (3,), dtype=np.float32)
    height = (1.0 - gap) * 0.1 + rivet * 0.06
    for i, point in enumerate(lights):
        lamp = _disc(x, y, z, point, 0.035, 0.012)
        tint = light_cols[i % 3]
        col = mix(col, tint, lamp)
        emissive += tint * lamp[..., None]
        height = height + lamp * 0.05
    rough = mix(np.float32(0.4), np.float32(0.25), rivet)
    return np.clip(col, 0, 1), height.astype(np.float32), rough.astype(np.float32), np.clip(emissive, 0, 1)


BALLS = {
    "ball_dune": (paint_dune, 0.55, 82, False),
    "ball_marble": (paint_marble, 0.28, 84, False),
    "ball_soccer": (paint_soccer, 0.4, 84, False),
    "ball_tire": (paint_tire, 1.15, 82, False),
    "ball_slime": (paint_slime, 0.32, 82, False),
    "ball_snow": (paint_snow, 1.0, 80, False),
    "ball_basketball": (paint_basketball, 0.55, 84, False),
    "ball_beach": (paint_beach, 0.18, 86, False),
    "ball_bowling": (paint_bowling, 0.4, 82, False),
    "ball_meteor": (paint_meteor, 0.75, 82, True),
    "ball_toy": (paint_toy, 0.3, 84, False),
    "ball_mushroom": (paint_mushroom_ball, 0.4, 84, False),
    "ball_coco": (paint_coco, 0.7, 82, False),
    "ball_gummy": (paint_gummy, 0.28, 84, False),
    "ball_alien": (paint_alien_ball, 0.28, 82, True),
    "ball_gear": (paint_gear, 0.55, 82, False),
    "ball_golf": (paint_golf, 0.7, 82, False),
    "ball_yarn": (paint_yarn, 0.9, 82, False),
    "ball_donut": (paint_donut, 0.32, 84, False),
    "ball_disco": (paint_disco, 0.6, 82, False),
    "ball_lucky": (paint_lucky, 0.32, 84, False),
    "ball_cat": (paint_cat, 0.35, 80, False),
    "ball_pixel": (paint_pixel, 0.45, 86, False),
    "ball_globe": (paint_globe, 0.4, 82, False),
    "ball_skull": (paint_skull, 0.35, 84, True),
}

PLANETS = {
    "planet_ice": (paint_ice_planet, 0.6, 80, False),
    "planet_crystal": (paint_crystal_planet, 0.85, 82, False),
    "planet_toy": (paint_toy_planet, 0.2, 84, False),
    "planet_mushroom": (paint_mushroom_planet, 0.5, 80, False),
    "planet_candy": (paint_candy_planet, 0.35, 82, False),
    "planet_jungle": (paint_jungle_planet, 0.6, 80, False),
    "planet_alien": (paint_alien_planet, 0.55, 80, True),
    "planet_machine": (paint_machine_planet, 0.5, 80, True),
}


def _selected(name, only):
    if not only:
        return True
    short = name.split("_", 1)[1]
    return name in only or short in only


def bake_remaining(preview, only):
    previews = {}
    jobs = []
    for name, spec in {**BALLS, **PLANETS}.items():
        if _selected(name, only):
            jobs.append((name, spec))
    for name, (fn, strength, quality, emissive) in jobs:
        print(name)
        w, h = (BALL_W, BALL_H) if name.startswith("ball_") else (PLANET_W, PLANET_H)
        color, normal = bake_one(name, fn, w, h, strength, quality, with_emissive=emissive)
        mean = _mean_rgb(color)
        print(f"  mean rgb {mean[0]:02x}{mean[1]:02x}{mean[2]:02x}")
        previews[name] = (color, normal)
        if name == "ball_gear":
            r, g, b = (c / 255.0 for c in mean)
            if r > b + 0.06:
                raise SystemExit(f"gear reads warm (mean {mean})")
        if name == "ball_tire":
            luma = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
            if luma < 70:
                raise SystemExit(f"tire still too dark (mean {mean})")
        if name == "ball_snow":
            luma = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
            if luma < 180:
                raise SystemExit(f"snow lost its white (mean {mean})")
        if name == "planet_crystal":
            luma = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
            if luma > 150:
                raise SystemExit(f"crystal planet too light (mean {mean})")
    if preview:
        # Sheet camera: yaw/pitch that centers FRONT. See lit_preview's center ray.
        for name, (color, normal) in previews.items():
            if name.startswith("ball_"):
                lit_preview(color, normal, Path(preview) / f"{name}_sheet.png", yaw=-0.40, pitch=-0.30)
            else:
                lit_preview(color, normal, Path(preview) / f"{name}_sheet.png", yaw=0.55, pitch=0.35)
    return previews
