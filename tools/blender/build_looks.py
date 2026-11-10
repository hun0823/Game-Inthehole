"""Author the Wood look kits and export uncompressed GLB.

Repro, from the repo root, with Blender 4.5 LTS (official build):

  blender -b -P tools/blender/build_looks.py -- --out assets/looks

Then meshopt-compress each GLB (gltfpack from meshoptimizer, MIT).
Quantized compression keeps node names (-kn) and vertex colors (-kv):

  gltfpack -c -kn -kv -i assets/looks/diorama.glb -o assets/looks/diorama.opt.glb

Lighting and AO are baked into vertex colors (upward-normal shade plus a
little per-face variation). The game draws these with MeshBasicMaterial, so
an iPhone does not pay for runtime lights on the kit.

Axis: Blender Z-up. glTF export uses Yup, so a vertex (x, y, z) becomes
(x, z, -y). Pieces sit with their play surface on Z = 0. Walls run along X.
Rim pieces run along X with the outward side toward -Y, which is +Z in glTF.

The camera sits at 82 degrees, so a standing mascot is only a scalp. Each
squirrel is laid out in the XY plane: nose toward -Y (the board, after
export), tail toward +Y (up the screen), eyes on the top face.
"""

import json
import math
import os
import random
import sys

import bmesh
import bpy

STEP = 1.16
OUT = 0.30

GRASS = (0.34, 0.62, 0.18)
GRASS_B = (0.28, 0.52, 0.14)
GRASS_C = (0.46, 0.68, 0.20)
DIRT = (0.42, 0.26, 0.13)
DIRT_D = (0.30, 0.17, 0.09)
BARK = (0.34, 0.20, 0.10)
FUR = (0.62, 0.36, 0.16)
FUR_D = (0.45, 0.24, 0.10)
BELLY = (0.93, 0.80, 0.64)
PINK = (0.86, 0.52, 0.46)
NOSE = (0.28, 0.12, 0.10)
EYE = (0.07, 0.05, 0.04)
EYE_W = (0.96, 0.94, 0.90)
NUT = (0.78, 0.48, 0.18)
CAP = (0.22, 0.42, 0.13)
AMBER = (0.86, 0.48, 0.12)
LEAF = (0.22, 0.55, 0.16)
LEAF_D = (0.12, 0.36, 0.12)

CLAY = (0.90, 0.58, 0.45)
CLAY_D = (0.70, 0.40, 0.32)
CLAY_L = (0.97, 0.80, 0.70)
CLAY_LEAF = (0.62, 0.78, 0.48)
CHEEK = (0.93, 0.48, 0.46)

PG = (0.13, 0.46, 0.14)
PG_L = (0.42, 0.74, 0.26)
PG_D = (0.07, 0.28, 0.08)
PB = (0.40, 0.22, 0.09)
PO = (0.92, 0.42, 0.10)
PSK = (0.84, 0.55, 0.28)

NEON_BG = (0.012, 0.016, 0.022)
CYAN = (0.15, 1.0, 0.72)
MAG = (1.0, 0.12, 0.52)
AMBER_N = (1.0, 0.72, 0.18)


def extra_args():
    argv = sys.argv
    if "--" not in argv:
        return []
    return argv[argv.index("--") + 1 :]


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def activate(ob):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_tf(ob, loc=False, rot=True, scale=True):
    activate(ob)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)


def ensure_color(mesh):
    if "Color" in mesh.color_attributes:
        attr = mesh.color_attributes["Color"]
    else:
        attr = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    mesh.color_attributes.active_color = attr
    return attr


def stable_hash(text):
    n = 0
    for ch in text:
        n = (n * 33 + ord(ch)) & 0xFFFFFFFF
    return n


def paint_fn(ob, fn, ao=0.2, noise=0.045, seed=1, wave=0.0):
    me = ob.data
    me.update()
    attr = ensure_color(me)
    rng = random.Random(seed + (stable_hash(ob.name) % 997))
    for poly in me.polygons:
        nz = poly.normal.z
        shade = 1.0 - ao * (1.0 - max(0.0, nz))
        if nz > 0.72:
            shade *= 1.14
        elif nz < -0.25:
            shade *= 0.55
        elif nz < 0.2:
            shade *= 0.78
        shade *= 1.0 + (rng.random() - 0.5) * 2.0 * noise
        if wave:
            c = poly.center
            shade *= 1.0 + wave * math.sin(c.x * 42.0 + c.y * 27.0)
        shade = max(0.05, min(1.4, shade))
        base = fn(poly.center, poly.normal, rng)
        col = (base[0] * shade, base[1] * shade, base[2] * shade, 1.0)
        for li in poly.loop_indices:
            attr.data[li].color = col


def paint(ob, color, **kw):
    paint_fn(ob, lambda co, n, rng: color, **kw)


def solid(ob, color, **kw):
    paint(ob, color, **kw)
    apply_tf(ob, loc=True, rot=False, scale=False)
    return ob


def fuse(parts, name):
    parts = [p for p in parts if p is not None]
    activate(parts[0])
    for p in parts:
        p.select_set(True)
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    return ob


def prim(kind, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    bpy.ops.object.select_all(action="DESELECT")
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=kw.get("verts", 8),
            radius=kw.get("radius", 0.5),
            depth=kw.get("depth", 1),
            location=loc,
            rotation=rot,
        )
    elif kind == "cone":
        bpy.ops.mesh.primitive_cone_add(
            vertices=kw.get("verts", 8),
            radius1=kw.get("radius", 0.5),
            depth=kw.get("depth", 1),
            location=loc,
            rotation=rot,
        )
    elif kind == "ico":
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=kw.get("sub", 1),
            radius=kw.get("radius", 1),
            location=loc,
            rotation=rot,
        )
    elif kind == "uv":
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=kw.get("seg", 8),
            ring_count=kw.get("rings", 6),
            radius=kw.get("radius", 1),
            location=loc,
            rotation=rot,
        )
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(
            major_segments=kw.get("major", 10),
            minor_segments=kw.get("minor", 5),
            major_radius=kw.get("major_r", 0.3),
            minor_radius=kw.get("minor_r", 0.08),
            location=loc,
            rotation=rot,
        )
    elif kind == "plane":
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    else:
        raise ValueError(kind)
    ob = bpy.context.active_object
    ob.name = name
    if isinstance(scale, (int, float)):
        ob.scale = (scale, scale, scale)
    else:
        ob.scale = scale
    apply_tf(ob, loc=False, rot=True, scale=True)
    return ob


def bevel(ob, width, segs=2):
    activate(ob)
    mod = ob.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segs
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(35)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def empty(name, loc=(0, 0, 0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.empty_display_size = 0.12
    return ob


def parent_to(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def origin_at(ob, loc):
    bpy.context.scene.cursor.location = loc
    activate(ob)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def look_eye(root, name, loc, radius, white, pupil):
    """Disc on the top of the head. Local Y is up after export, so a Y scale blinks."""
    x, y, z = loc
    disc = prim("ico", name + "_w", loc=(x, y, z), radius=radius, sub=1, scale=(1, 0.86, 0.48))
    dot = prim(
        "ico", name + "_p",
        loc=(x, y - radius * 0.2, z + radius * 0.28),
        radius=radius * 0.46, sub=1, scale=(0.85, 0.75, 0.5),
    )
    glint = prim(
        "ico", name + "_s",
        loc=(x + radius * 0.26, y + radius * 0.05, z + radius * 0.42),
        radius=radius * 0.16, sub=0,
    )
    paint(disc, white, ao=0.02, noise=0.0, seed=2)
    paint(dot, pupil, ao=0.0, noise=0.0, seed=3)
    paint(glint, (1, 1, 1), ao=0.0, noise=0.0, seed=4)
    apply_tf(dot, loc=True, rot=False, scale=False)
    apply_tf(glint, loc=True, rot=False, scale=False)
    fused = fuse([disc, dot, glint], name)
    parent_to(fused, root)
    return fused


def ribbon(name, profile, length, segs, jag, seed, color_fn, ao=0.22):
    bm = bmesh.new()
    rng = random.Random(seed)
    rings = []
    for i in range(segs + 1):
        x = -length / 2 + length * (i / segs)
        ring = []
        for pi, (y, z) in enumerate(profile):
            outer = pi / max(1, len(profile) - 1)
            jy = jag * outer * rng.uniform(-1, 1)
            jz = jag * outer * 0.4 * rng.uniform(-1, 1)
            ring.append(bm.verts.new((x, y + jy, z + jz)))
        rings.append(ring)
    for i in range(segs):
        for p in range(len(profile) - 1):
            a = rings[i][p]
            b = rings[i + 1][p]
            c = rings[i + 1][p + 1]
            d = rings[i][p + 1]
            try:
                bm.faces.new((a, d, c, b))
            except ValueError:
                pass
    try:
        bm.faces.new(list(rings[0]))
        bm.faces.new(list(reversed(rings[-1])))
    except ValueError:
        pass
    bm.normal_update()
    if sum(f.normal.z for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    paint_fn(ob, color_fn, ao=ao, noise=0.04, seed=seed)
    return ob


def gray(level):
    return (level, level, level)


# --- diorama -----------------------------------------------------------------

def diorama_tiles():
    specs = (
        ("tile_a", 0.46, GRASS, False),
        ("tile_b", 0.40, GRASS_B, True),
        ("tile_c", 0.48, GRASS_C, False),
    )
    for name, radius, color, pebble in specs:
        dirt = prim("cube", name + "_d", loc=(0, 0, -0.04), scale=(1.02, 1.02, 0.06))
        grass = prim("cyl", name + "_g", loc=(0, 0, -0.015), radius=radius, depth=0.05, verts=10)
        parts = [solid(dirt, DIRT, ao=0.16, seed=3), solid(grass, color, ao=0.14, seed=5)]
        if pebble:
            pebble_m = prim("ico", name + "_p", loc=(0.16, -0.12, 0.02), radius=0.045, sub=1, scale=(1.1, 0.8, 0.55))
            parts.append(solid(pebble_m, (0.55, 0.52, 0.46), ao=0.3, seed=8))
        fuse(parts, name)


def diorama_wall():
    body = prim(
        "cyl", "w_body",
        loc=(0, 0, 0.12), rot=(0, math.pi / 2, 0),
        radius=0.115, depth=1.08, verts=8,
    )
    parts = [solid(body, gray(0.72), ao=0.28, seed=2)]
    for x in (-0.46, 0.0, 0.46):
        ring = prim(
            "cyl", "w_ring",
            loc=(x, 0, 0.12), rot=(0, math.pi / 2, 0),
            radius=0.132, depth=0.06, verts=8,
        )
        parts.append(solid(ring, gray(0.42), ao=0.2, seed=4))
    for x in (-0.54, 0.54):
        cap = prim(
            "cyl", "w_cap",
            loc=(x, 0, 0.12), rot=(0, math.pi / 2, 0),
            radius=0.118, depth=0.035, verts=8,
        )
        parts.append(solid(cap, gray(0.92), ao=0.12, seed=6))
    fuse(parts, "wall")


def diorama_edges():
    profile = [
        (0.00, 0.000),
        (-0.025, 0.018),
        (-0.07, 0.012),
        (-0.11, -0.04),
        (-0.17, -0.14),
        (-0.23, -0.24),
        (-0.28, -0.32),
        (-OUT, -0.34),
    ]

    def color_fn(co, normal, rng):
        if co.z > -0.02 and co.y > -0.09:
            return GRASS if rng.random() > 0.35 else GRASS_B
        if co.z > -0.16:
            return DIRT
        return DIRT_D

    for name, seed, jag in (("edge_a", 11, 0.045), ("edge_b", 29, 0.02)):
        edge = ribbon(name, profile, STEP, 7, jag, seed, color_fn)
        if name == "edge_a":
            roots = [edge]
            for i, x in enumerate((-0.32, 0.24)):
                root = prim(
                    "cyl", "root",
                    loc=(x, -0.20, -0.16),
                    rot=(math.radians(68), 0, math.radians(18 if i == 0 else -22)),
                    radius=0.028, depth=0.28, verts=6,
                )
                roots.append(solid(root, DIRT_D, ao=0.25, seed=15 + i))
            fuse(roots, name)
    rock = prim("ico", "corner_r", loc=(0.10, -0.16, -0.02), radius=0.09, sub=1, scale=(1.2, 0.9, 0.7))
    rock2 = prim("ico", "corner_r2", loc=(0.02, -0.08, 0.02), radius=0.055, sub=1, scale=(0.8, 1.1, 0.6))
    fuse([solid(rock, (0.40, 0.38, 0.34), ao=0.3, seed=3), solid(rock2, DIRT, ao=0.25, seed=4)], "corner")


def diorama_squirrel():
    root = empty("squirrel")
    parts = []
    body = prim("ico", "sq_body", loc=(0, 0.02, 0.11), radius=0.16, sub=1, scale=(1.35, 2.15, 0.62))
    parts.append(solid(body, FUR, ao=0.18, seed=1))
    belly = prim("ico", "sq_belly", loc=(0, -0.02, 0.15), radius=0.11, sub=1, scale=(1.05, 1.55, 0.42))
    parts.append(solid(belly, BELLY, ao=0.12, seed=2))
    head = prim("ico", "sq_head", loc=(0, -0.40, 0.13), radius=0.155, sub=1, scale=(1.12, 0.92, 0.72))
    parts.append(solid(head, FUR, ao=0.14, seed=3))
    snout = prim("ico", "sq_snout", loc=(0, -0.54, 0.12), radius=0.07, sub=1, scale=(0.85, 1.15, 0.55))
    parts.append(solid(snout, BELLY, ao=0.1, seed=4))
    nose = prim("ico", "sq_nose", loc=(0, -0.62, 0.145), radius=0.028, sub=1)
    parts.append(solid(nose, NOSE, ao=0.06, seed=5))
    for sx in (-1, 1):
        ear = prim("ico", "sq_ear", loc=(sx * 0.13, -0.44, 0.24), radius=0.07, sub=1, scale=(0.55, 0.42, 1.15))
        parts.append(solid(ear, FUR, ao=0.12, seed=6))
        inner = prim("ico", "sq_ein", loc=(sx * 0.125, -0.45, 0.26), radius=0.038, sub=1, scale=(0.45, 0.35, 0.9))
        parts.append(solid(inner, PINK, ao=0.08, seed=7))
        paw = prim("ico", "sq_paw", loc=(sx * 0.16, -0.16, 0.05), radius=0.045, sub=1, scale=(0.85, 1.15, 0.45))
        parts.append(solid(paw, FUR_D, ao=0.16, seed=8))
        cheek = prim("ico", "sq_ch", loc=(sx * 0.10, -0.50, 0.14), radius=0.038, sub=1)
        parts.append(solid(cheek, PINK, ao=0.08, seed=9))
    fuse(parts, "squirrel_body")
    parent_to(bpy.data.objects["squirrel_body"], root)
    look_eye(root, "squirrel_eye_l", (-0.065, -0.38, 0.24), 0.048, EYE_W, EYE)
    look_eye(root, "squirrel_eye_r", (0.065, -0.38, 0.24), 0.048, EYE_W, EYE)
    puffs = []
    curve = (
        ((0.0, 0.28, 0.12), 0.10),
        ((0.05, 0.42, 0.16), 0.14),
        ((0.02, 0.56, 0.18), 0.16),
        ((-0.06, 0.70, 0.16), 0.13),
        ((0.0, 0.82, 0.13), 0.08),
    )
    for i, ((x, y, z), radius) in enumerate(curve):
        puff = prim("ico", f"puff{i}", loc=(x, y, z), radius=radius, sub=1)
        col = FUR if i % 2 == 0 else FUR_D
        paint(puff, col, ao=0.16, seed=20 + i)
        puffs.append(puff)
    tail = fuse(puffs, "squirrel_tail")
    origin_at(tail, (0.0, 0.22, 0.12))
    parent_to(tail, root)


def diorama_trees():
    def oak(name, leaf):
        trunk = prim("cyl", name + "_t", loc=(0, 0, 0.22), radius=0.055, depth=0.44, verts=6)
        parts = [solid(trunk, BARK, ao=0.25, seed=1)]
        for loc, rad, sc in (
            ((0.0, 0.0, 0.62), 0.24, (1.05, 1.0, 0.85)),
            ((0.12, -0.06, 0.74), 0.16, (1, 1, 0.9)),
            ((-0.10, 0.05, 0.70), 0.15, (0.9, 1.1, 0.8)),
        ):
            canopy = prim("ico", name + "_c", loc=loc, radius=rad, sub=1, scale=sc)
            parts.append(solid(canopy, leaf, ao=0.18, seed=4))
        fuse(parts, name)

    oak("tree_a", LEAF)
    trunk = prim("cyl", "pine_t", loc=(0, 0, 0.16), radius=0.045, depth=0.32, verts=6)
    parts = [solid(trunk, BARK, ao=0.25, seed=2)]
    for i, (z, rad, depth) in enumerate(((0.42, 0.22, 0.28), (0.62, 0.16, 0.24), (0.80, 0.10, 0.20))):
        cone = prim("cone", "pine_c", loc=(0, 0, z), radius=rad, depth=depth, verts=7)
        parts.append(solid(cone, LEAF if i != 1 else LEAF_D, ao=0.16, seed=5 + i))
    fuse(parts, "tree_b")
    trunk = prim("cyl", "birch_t", loc=(0, 0, 0.28), radius=0.035, depth=0.56, verts=6)
    parts = [solid(trunk, (0.78, 0.74, 0.66), ao=0.18, seed=3)]
    band = prim("cyl", "birch_b", loc=(0, 0, 0.30), radius=0.04, depth=0.04, verts=6)
    parts.append(solid(band, (0.25, 0.18, 0.12), ao=0.1, seed=4))
    for loc, rad in (((0.0, 0.0, 0.70), 0.16), ((0.06, -0.04, 0.82), 0.11)):
        canopy = prim("ico", "birch_c", loc=loc, radius=rad, sub=1, scale=(1, 1, 0.75))
        parts.append(solid(canopy, (0.40, 0.62, 0.28), ao=0.16, seed=6))
    fuse(parts, "tree_c")


def diorama_props():
    stump_b = prim("cyl", "st", loc=(0, 0, 0.09), radius=0.16, depth=0.18, verts=8)
    top = prim("cyl", "stt", loc=(0, 0, 0.175), radius=0.15, depth=0.03, verts=8)
    ring = prim("cyl", "str", loc=(0, 0, 0.12), radius=0.17, depth=0.035, verts=8)
    fuse(
        [
            solid(stump_b, BARK, ao=0.24, seed=1),
            solid(top, (0.62, 0.46, 0.28), ao=0.12, seed=2),
            solid(ring, DIRT_D, ao=0.2, seed=3),
        ],
        "stump",
    )
    rock = prim("ico", "rk", loc=(0, 0, 0.07), radius=0.12, sub=1, scale=(1.3, 1.0, 0.7))
    rock2 = prim("ico", "rk2", loc=(0.12, 0.04, 0.05), radius=0.07, sub=1, scale=(1, 0.8, 0.6))
    fuse(
        [solid(rock, (0.42, 0.40, 0.36), ao=0.28, seed=4), solid(rock2, (0.34, 0.32, 0.30), ao=0.28, seed=5)],
        "rock",
    )
    nut = prim("ico", "nut", loc=(0, 0, 0.07), radius=0.07, sub=1, scale=(0.85, 0.85, 1.15))
    cap = prim("ico", "cap", loc=(0, 0, 0.12), radius=0.055, sub=1, scale=(1.05, 1.05, 0.45))
    fuse([solid(nut, NUT, ao=0.16, seed=6), solid(cap, CAP, ao=0.12, seed=7)], "acorn")


def diorama_ball_goal():
    nut = prim("uv", "ball_n", radius=0.30, seg=10, rings=7, scale=(1.0, 1.0, 0.92))
    cap = prim("uv", "ball_c", loc=(0, 0, 0.15), radius=0.20, seg=8, rings=4, scale=(1.15, 1.15, 0.48))
    stem = prim("cyl", "ball_s", loc=(0, 0, 0.26), radius=0.022, depth=0.07, verts=5)
    fuse(
        [
            solid(nut, NUT, ao=0.2, seed=1),
            solid(cap, (0.55, 0.74, 0.24), ao=0.08, seed=2),
            solid(stem, BARK, ao=0.1, seed=3),
        ],
        "ball",
    )
    mouth = prim("cyl", "g_mouth", loc=(0, 0, -0.02), radius=0.30, depth=0.08, verts=12)
    lip = prim("torus", "g_lip", loc=(0, 0, 0.02), major_r=0.34, minor_r=0.055, major=12, minor=5)
    bark = prim("cyl", "g_bark", loc=(0, 0, -0.01), radius=0.50, depth=0.06, verts=10)
    fuse(
        [
            solid(bark, BARK, ao=0.22, seed=4),
            solid(mouth, (0.05, 0.03, 0.02), ao=0.05, seed=5),
            solid(lip, AMBER, ao=0.12, seed=6),
        ],
        "goal",
    )


def diorama_ground():
    ground = prim("plane", "ground", loc=(0, 0, -0.045))
    solid(ground, DIRT_D, ao=0.05, noise=0.02, seed=1)


def build_diorama():
    diorama_tiles()
    diorama_wall()
    diorama_edges()
    diorama_ground()
    diorama_ball_goal()
    diorama_squirrel()
    diorama_trees()
    diorama_props()


# --- clay --------------------------------------------------------------------

def clay_tiles():
    specs = (
        ("tile_a", 1.00, 0.11, 0.055, CLAY),
        ("tile_b", 0.94, 0.10, 0.04, CLAY_L),
        ("tile_c", 1.02, 0.12, 0.065, CLAY_D),
    )
    for name, size, height, width, color in specs:
        ob = prim("cube", name, loc=(0, 0, -height / 2), scale=(size, size, height))
        bevel(ob, width, segs=2)
        solid(ob, color, ao=0.16, wave=0.05, seed=3)


def clay_wall():
    body = prim(
        "cyl", "cw",
        loc=(0, 0, 0.13), rot=(0, math.pi / 2, 0),
        radius=0.13, depth=0.86, verts=10,
    )
    bevel(body, 0.02, segs=1)
    parts = [solid(body, gray(0.9), ao=0.18, wave=0.06, seed=2)]
    for x in (-0.48, 0.48):
        cap = prim("ico", "cwc", loc=(x, 0, 0.13), radius=0.13, sub=1)
        parts.append(solid(cap, gray(0.82), ao=0.16, wave=0.05, seed=3))
    fuse(parts, "wall")


def clay_edges():
    profile = [
        (0.00, -0.02),
        (-0.04, 0.03),
        (-0.09, 0.09),
        (-0.14, 0.125),
        (-0.19, 0.09),
        (-0.24, 0.02),
        (-OUT, -0.06),
    ]

    def color_fn(co, normal, rng):
        if co.z > 0.08:
            return CLAY_L
        if co.z > 0.0:
            return CLAY
        return CLAY_D

    ribbon("edge_a", profile, STEP, 8, 0.012, 4, color_fn, ao=0.16)
    ribbon("edge_b", profile, STEP, 6, 0.028, 9, color_fn, ao=0.16)
    bead = prim("ico", "bead", loc=(0.08, -0.14, 0.04), radius=0.10, sub=1)
    solid(bead, CLAY_L, ao=0.14, wave=0.04, seed=2)
    bead.name = "corner"
    bead.data.name = "corner"


def clay_squirrel():
    root = empty("squirrel")
    parts = []
    body = prim("ico", "c_body", loc=(0, 0.10, 0.11), radius=0.15, sub=1, scale=(1.15, 1.35, 0.58))
    parts.append(solid(body, CLAY, ao=0.14, wave=0.03, seed=1))
    head = prim("ico", "c_head", loc=(0, -0.28, 0.15), radius=0.24, sub=1, scale=(1.08, 0.92, 0.62))
    parts.append(solid(head, CLAY_L, ao=0.1, wave=0.025, seed=2))
    for sx in (-1, 1):
        ear = prim("ico", "c_ear", loc=(sx * 0.20, -0.34, 0.28), radius=0.09, sub=1, scale=(0.85, 0.7, 0.7))
        parts.append(solid(ear, CLAY, ao=0.1, seed=3))
        inner = prim("ico", "c_ein", loc=(sx * 0.19, -0.36, 0.30), radius=0.05, sub=1)
        parts.append(solid(inner, CHEEK, ao=0.06, seed=4))
        cheek = prim("ico", "c_ch", loc=(sx * 0.14, -0.40, 0.16), radius=0.055, sub=1)
        parts.append(solid(cheek, CHEEK, ao=0.06, seed=5))
        foot = prim("ico", "c_ft", loc=(sx * 0.12, -0.02, 0.04), radius=0.05, sub=1, scale=(1.15, 1.3, 0.45))
        parts.append(solid(foot, CLAY_D, ao=0.12, seed=6))
    nose = prim("ico", "c_nose", loc=(0, -0.48, 0.16), radius=0.035, sub=1)
    parts.append(solid(nose, (0.55, 0.24, 0.22), ao=0.06, seed=7))
    fuse(parts, "squirrel_body")
    parent_to(bpy.data.objects["squirrel_body"], root)
    look_eye(root, "squirrel_eye_l", (-0.09, -0.26, 0.30), 0.058, EYE_W, EYE)
    look_eye(root, "squirrel_eye_r", (0.09, -0.26, 0.30), 0.058, EYE_W, EYE)
    puffs = []
    for i, (loc, rad) in enumerate((((0, 0.36, 0.13), 0.13), ((0.02, 0.52, 0.16), 0.16), ((-0.02, 0.66, 0.14), 0.12))):
        puff = prim("ico", f"ct{i}", loc=loc, radius=rad, sub=1)
        paint(puff, CLAY_D if i != 1 else CLAY, ao=0.12, wave=0.03, seed=8 + i)
        puffs.append(puff)
    tail = fuse(puffs, "squirrel_tail")
    origin_at(tail, (0.0, 0.28, 0.12))
    parent_to(tail, root)


def clay_trees():
    def blob(name, trunk_h, canopy_r, leaf):
        trunk = prim("cyl", name + "_t", loc=(0, 0, trunk_h * 0.5), radius=0.07, depth=trunk_h, verts=8)
        canopy = prim("ico", name + "_c", loc=(0, 0, trunk_h + canopy_r * 0.65), radius=canopy_r, sub=1)
        fuse([solid(trunk, CLAY_D, ao=0.18, seed=1), solid(canopy, leaf, ao=0.14, wave=0.03, seed=2)], name)

    blob("tree_a", 0.28, 0.30, CLAY_LEAF)
    parts = [solid(prim("cyl", "top_t", loc=(0, 0, 0.08), radius=0.06, depth=0.16, verts=8), CLAY_D, ao=0.16, seed=1)]
    z = 0.22
    rad = 0.16
    for i in range(4):
        ball = prim("ico", f"top{i}", loc=(0, 0, z), radius=rad, sub=1)
        parts.append(solid(ball, CLAY_LEAF if i % 2 == 0 else (0.78, 0.86, 0.58), ao=0.12, seed=3 + i))
        z += rad * 1.15
        rad *= 0.72
    fuse(parts, "tree_b")
    bush = prim("ico", "bush", loc=(0, 0, 0.16), radius=0.20, sub=1, scale=(1.2, 1.15, 0.75))
    solid(bush, CLAY_LEAF, ao=0.14, wave=0.04, seed=4)
    bush.name = "tree_c"
    bush.data.name = "tree_c"


def clay_props():
    stump = prim("cyl", "cst", loc=(0, 0, 0.08), radius=0.15, depth=0.16, verts=10)
    bevel(stump, 0.02, 1)
    top = prim("cyl", "cstt", loc=(0, 0, 0.15), radius=0.13, depth=0.03, verts=10)
    fuse([solid(stump, CLAY_D, ao=0.16, wave=0.04, seed=1), solid(top, CLAY_L, ao=0.1, seed=2)], "stump")
    rock = prim("ico", "crk", loc=(0, 0, 0.08), radius=0.12, sub=1, scale=(1.25, 1.05, 0.75))
    solid(rock, (0.78, 0.64, 0.58), ao=0.2, wave=0.03, seed=3)
    rock.name = "rock"
    rock.data.name = "rock"
    nut = prim("ico", "cn", loc=(0, 0, 0.06), radius=0.065, sub=1)
    cap = prim("ico", "cc", loc=(0, 0, 0.10), radius=0.05, sub=1, scale=(1.1, 1.1, 0.45))
    fuse([solid(nut, CLAY, ao=0.12, seed=4), solid(cap, CLAY_D, ao=0.1, seed=5)], "acorn")


def clay_ball_goal():
    ball = prim("ico", "cball", radius=0.32, sub=1)
    bump = prim("ico", "cbump", loc=(0.12, -0.08, 0.18), radius=0.08, sub=1)
    bump2 = prim("ico", "cbump2", loc=(-0.10, 0.12, 0.08), radius=0.06, sub=1)
    fuse(
        [
            solid(ball, CLAY, ao=0.18, wave=0.045, seed=1),
            solid(bump, CLAY_L, ao=0.12, seed=2),
            solid(bump2, CLAY_D, ao=0.12, seed=3),
        ],
        "ball",
    )
    base = prim("cyl", "gb", loc=(0, 0, -0.02), radius=0.50, depth=0.08, verts=12)
    bevel(base, 0.02, 1)
    mouth = prim("cyl", "gm", loc=(0, 0, 0.01), radius=0.28, depth=0.05, verts=12)
    lip = prim("torus", "gl", loc=(0, 0, 0.04), major_r=0.32, minor_r=0.05, major=12, minor=5)
    fuse(
        [
            solid(base, CLAY_D, ao=0.16, wave=0.03, seed=4),
            solid(mouth, (0.28, 0.12, 0.10), ao=0.05, seed=5),
            solid(lip, (0.86, 0.42, 0.32), ao=0.1, seed=6),
        ],
        "goal",
    )


def clay_ground():
    ground = prim("plane", "ground", loc=(0, 0, -0.05))
    solid(ground, (0.62, 0.40, 0.34), ao=0.04, seed=1)


def build_clay():
    clay_tiles()
    clay_wall()
    clay_edges()
    clay_ground()
    clay_ball_goal()
    clay_squirrel()
    clay_trees()
    clay_props()


# --- pixel -------------------------------------------------------------------

def pixel_tiles():
    def tile(name, body, top, stud=None):
        base = prim("cube", name + "_b", loc=(0, 0, -0.06), scale=(1.08, 1.08, 0.12))
        cap = prim("cube", name + "_c", loc=(0, 0, 0.015), scale=(0.86, 0.86, 0.03))
        parts = [solid(base, body, ao=0.08, noise=0.0, seed=1), solid(cap, top, ao=0.04, noise=0.0, seed=2)]
        if stud:
            bit = prim("cube", name + "_s", loc=(0.28, -0.28, 0.02), scale=(0.22, 0.22, 0.04))
            parts.append(solid(bit, stud, ao=0.0, noise=0.0, seed=3))
        fuse(parts, name)

    tile("tile_a", PG, PG_L)
    tile("tile_b", PG_D, PG)
    tile("tile_c", PG, PG_L, stud=(0.95, 0.86, 0.35))


def pixel_wall():
    parts = []
    base = prim("cube", "pw", loc=(0, 0, 0.11), scale=(1.08, 0.30, 0.22))
    parts.append(solid(base, gray(0.62), ao=0.12, noise=0.0, seed=1))
    top = prim("cube", "pwt", loc=(0, 0, 0.23), scale=(1.02, 0.22, 0.06))
    parts.append(solid(top, gray(0.95), ao=0.04, noise=0.0, seed=2))
    for x in (-0.42, 0.42):
        post = prim("cube", "pwp", loc=(x, 0, 0.16), scale=(0.16, 0.34, 0.32))
        parts.append(solid(post, gray(0.5), ao=0.1, noise=0.0, seed=3))
    fuse(parts, "wall")


def pixel_edges():
    def blocks(name, studs):
        step1 = prim("cube", name + "_1", loc=(0, -0.07, 0.05), scale=(STEP, 0.14, 0.10))
        step2 = prim("cube", name + "_2", loc=(0, -0.20, 0.10), scale=(STEP, 0.16, 0.20))
        parts = [
            solid(step1, PG, ao=0.06, noise=0.0, seed=1),
            solid(step2, PG_D, ao=0.06, noise=0.0, seed=2),
        ]
        if studs:
            for x in (-0.38, 0.38):
                stud = prim("cube", name + "_s", loc=(x, -0.20, 0.22), scale=(0.18, 0.16, 0.08))
                parts.append(solid(stud, PG_L, ao=0.0, noise=0.0, seed=3))
        fuse(parts, name)

    blocks("edge_a", True)
    blocks("edge_b", False)
    post = prim("cube", "corner", loc=(0.10, -0.12, 0.12), scale=(0.24, 0.24, 0.28))
    cap = prim("cube", "corner_c", loc=(0.10, -0.12, 0.28), scale=(0.28, 0.28, 0.08))
    fuse(
        [solid(post, PG_D, ao=0.06, noise=0.0, seed=1), solid(cap, PG_L, ao=0.0, noise=0.0, seed=2)],
        "corner",
    )


def pixel_squirrel():
    root = empty("squirrel")
    parts = []

    def box(name, loc, scale, color):
        ob = prim("cube", name, loc=loc, scale=scale)
        return solid(ob, color, ao=0.06, noise=0.0, seed=1)

    parts.append(box("b", (0, 0.02, 0.10), (0.42, 0.48, 0.18), PSK))
    parts.append(box("h", (0, -0.36, 0.12), (0.38, 0.30, 0.20), PSK))
    parts.append(box("el", (-0.16, -0.44, 0.24), (0.12, 0.12, 0.14), PSK))
    parts.append(box("er", (0.16, -0.44, 0.24), (0.12, 0.12, 0.14), PSK))
    parts.append(box("sn", (0, -0.52, 0.12), (0.18, 0.12, 0.10), (0.55, 0.28, 0.16)))
    parts.append(box("ns", (0, -0.58, 0.16), (0.08, 0.06, 0.06), NOSE))
    parts.append(box("fl", (-0.12, -0.16, 0.04), (0.12, 0.16, 0.08), PB))
    parts.append(box("fr", (0.12, -0.16, 0.04), (0.12, 0.16, 0.08), PB))
    fuse(parts, "squirrel_body")
    parent_to(bpy.data.objects["squirrel_body"], root)

    def eye_build(name, x):
        white = prim("cube", name + "_w", loc=(x, -0.34, 0.24), scale=(0.11, 0.09, 0.05))
        pupil = prim("cube", name + "_p", loc=(x, -0.36, 0.27), scale=(0.05, 0.05, 0.035))
        paint(white, EYE_W, ao=0.0, noise=0.0, seed=1)
        paint(pupil, EYE, ao=0.0, noise=0.0, seed=2)
        apply_tf(pupil, loc=True, rot=False, scale=False)
        fused = fuse([white, pupil], name)
        parent_to(fused, root)

    eye_build("squirrel_eye_l", -0.09)
    eye_build("squirrel_eye_r", 0.09)
    specs = (
        ((0.0, 0.32, 0.12), (0.22, 0.22, 0.14), PO),
        ((0.10, 0.50, 0.14), (0.26, 0.22, 0.16), (0.55, 0.24, 0.08)),
        ((-0.08, 0.68, 0.15), (0.28, 0.22, 0.16), PO),
        ((0.04, 0.84, 0.13), (0.18, 0.16, 0.12), (0.98, 0.62, 0.18)),
    )
    chunks = []
    for i, (loc, scale, col) in enumerate(specs):
        ob = prim("cube", f"t{i}", loc=loc, scale=scale)
        paint(ob, col, ao=0.04, noise=0.0, seed=3)
        chunks.append(ob)
    tail = fuse(chunks, "squirrel_tail")
    origin_at(tail, (0.0, 0.24, 0.12))
    parent_to(tail, root)


def pixel_trees():
    def tree(name, woods, leafs):
        parts = []
        for loc, scale, color in woods + leafs:
            ob = prim("cube", name + "_p", loc=loc, scale=scale)
            parts.append(solid(ob, color, ao=0.06, noise=0.0, seed=1))
        fuse(parts, name)

    tree(
        "tree_a",
        [((0, 0, 0.16), (0.12, 0.12, 0.32), PB)],
        [
            ((0, 0, 0.46), (0.36, 0.36, 0.16), PG),
            ((0, 0, 0.62), (0.26, 0.26, 0.14), PG_L),
            ((0, 0, 0.76), (0.16, 0.16, 0.12), PG),
        ],
    )
    tree(
        "tree_b",
        [((0, 0, 0.18), (0.14, 0.14, 0.36), PB)],
        [
            ((0, 0, 0.48), (0.42, 0.36, 0.28), PG_D),
            ((0.1, 0, 0.62), (0.18, 0.16, 0.16), PG_L),
            ((-0.08, 0.04, 0.58), (0.16, 0.14, 0.14), PG),
        ],
    )
    tree(
        "tree_c",
        [((0, 0, 0.20), (0.08, 0.08, 0.40), (0.62, 0.50, 0.32))],
        [((0, 0, 0.50), (0.22, 0.20, 0.18), PG_L)],
    )


def pixel_props():
    stump = prim("cube", "ps", loc=(0, 0, 0.1), scale=(0.32, 0.32, 0.2))
    top = prim("cube", "pst", loc=(0, 0, 0.2), scale=(0.28, 0.28, 0.06))
    fuse(
        [solid(stump, PB, ao=0.06, noise=0.0, seed=1), solid(top, (0.72, 0.52, 0.28), ao=0.0, noise=0.0, seed=2)],
        "stump",
    )
    rock = prim("cube", "pr", loc=(0, 0, 0.08), scale=(0.26, 0.20, 0.16))
    rock2 = prim("cube", "pr2", loc=(0.12, 0.04, 0.06), scale=(0.14, 0.12, 0.12))
    fuse(
        [
            solid(rock, (0.35, 0.38, 0.42), ao=0.08, noise=0.0, seed=3),
            solid(rock2, (0.22, 0.24, 0.28), ao=0.06, noise=0.0, seed=4),
        ],
        "rock",
    )
    nut = prim("cube", "pn", loc=(0, 0, 0.05), scale=(0.12, 0.12, 0.14))
    cap = prim("cube", "pc", loc=(0, 0, 0.12), scale=(0.14, 0.14, 0.06))
    fuse(
        [solid(nut, PO, ao=0.04, noise=0.0, seed=5), solid(cap, PG_D, ao=0.04, noise=0.0, seed=6)],
        "acorn",
    )


def pixel_ball_goal():
    ball = prim("uv", "pball", radius=0.32, seg=8, rings=5)

    def bands(co, normal, rng):
        if abs(co.z) < 0.08:
            return (0.55, 0.22, 0.08)
        if co.z > 0.18:
            return (0.98, 0.72, 0.28)
        return PO

    paint_fn(ball, bands, ao=0.1, noise=0.0, seed=1)
    apply_tf(ball, loc=True, rot=False, scale=False)
    ball.name = "ball"
    ball.data.name = "ball"
    mouth = prim("cube", "pm", loc=(0, 0, -0.01), scale=(0.52, 0.52, 0.08))
    bars = [
        prim("cube", "pn", loc=(0, -0.36, 0.045), scale=(0.92, 0.14, 0.10)),
        prim("cube", "ps", loc=(0, 0.36, 0.045), scale=(0.92, 0.14, 0.10)),
        prim("cube", "pe", loc=(0.36, 0, 0.045), scale=(0.14, 0.58, 0.10)),
        prim("cube", "pw", loc=(-0.36, 0, 0.045), scale=(0.14, 0.58, 0.10)),
    ]
    studs = [
        prim("cube", "pc", loc=(x, y, 0.09), scale=(0.16, 0.16, 0.05))
        for x in (-0.36, 0.36)
        for y in (-0.36, 0.36)
    ]
    fuse(
        [solid(mouth, (0.04, 0.03, 0.03), ao=0.0, noise=0.0, seed=1)]
        + [solid(bar, PO, ao=0.02, noise=0.0, seed=2) for bar in bars]
        + [solid(stud, (0.98, 0.78, 0.28), ao=0.0, noise=0.0, seed=3) for stud in studs],
        "goal",
    )


def pixel_ground():
    ground = prim("plane", "ground", loc=(0, 0, -0.04))
    solid(ground, (0.04, 0.10, 0.05), ao=0.0, noise=0.0, seed=1)


def build_pixel():
    pixel_tiles()
    pixel_wall()
    pixel_edges()
    pixel_ground()
    pixel_ball_goal()
    pixel_squirrel()
    pixel_trees()
    pixel_props()


# --- neon --------------------------------------------------------------------

def neon_tiles():
    glows = (("tile_a", CYAN), ("tile_b", MAG), ("tile_c", AMBER_N))
    for name, glow in glows:
        base = prim("cube", name + "_b", loc=(0, 0, -0.02), scale=(1.06, 1.06, 0.04))
        parts = [solid(base, NEON_BG, ao=0.02, noise=0.0, seed=1)]
        span = 0.86
        t = 0.045
        z = 0.012
        for loc, scale in (
            ((0, span / 2 - 0.02, z), (span, t, 0.025)),
            ((0, -(span / 2 - 0.02), z), (span, t, 0.025)),
            ((span / 2 - 0.02, 0, z), (t, span, 0.025)),
            ((-(span / 2 - 0.02), 0, z), (t, span, 0.025)),
        ):
            bar = prim("cube", name + "_bar", loc=loc, scale=scale)
            parts.append(solid(bar, glow, ao=0.0, noise=0.0, seed=2))
        fuse(parts, name)


def neon_wall():
    base = prim("cube", "nw", loc=(0, 0, 0.03), scale=(1.08, 0.10, 0.06))
    rail = prim("cube", "nwr", loc=(0, 0, 0.075), scale=(1.08, 0.035, 0.025))
    parts = [
        solid(base, gray(0.16), ao=0.04, noise=0.0, seed=1),
        solid(rail, gray(1.0), ao=0.0, noise=0.0, seed=2),
    ]
    for x in (-0.50, 0.50):
        post = prim("cube", "nwp", loc=(x, 0, 0.07), scale=(0.06, 0.06, 0.14))
        parts.append(solid(post, gray(0.85), ao=0.0, noise=0.0, seed=3))
    fuse(parts, "wall")


def neon_edges():
    profile = [
        (0.00, 0.00),
        (-0.08, 0.00),
        (-0.08, 0.04),
        (-0.18, 0.04),
        (-0.18, 0.075),
        (-0.26, 0.075),
        (-0.26, 0.03),
        (-OUT, -0.02),
        (-OUT, -0.08),
    ]

    def color_fn(glow):
        def fn(co, normal, rng):
            if co.z > 0.055:
                return glow
            return NEON_BG

        return fn

    ribbon("edge_a", profile, STEP, 4, 0.0, 1, color_fn(CYAN), ao=0.02)
    ribbon("edge_b", profile, STEP, 4, 0.0, 2, color_fn(MAG), ao=0.02)
    post = prim("ico", "np", loc=(0.08, -0.16, 0.06), radius=0.07, sub=0)
    solid(post, CYAN, ao=0.0, noise=0.0, seed=1)
    post.name = "corner"
    post.data.name = "corner"


def neon_squirrel():
    root = empty("squirrel")
    parts = []
    body = prim("cube", "nb", loc=(0, 0.02, 0.08), scale=(0.36, 0.50, 0.12))
    parts.append(solid(body, NEON_BG, ao=0.04, noise=0.0, seed=1))
    stripe = prim("cube", "ns", loc=(0, 0.02, 0.15), scale=(0.12, 0.42, 0.045))
    parts.append(solid(stripe, CYAN, ao=0.0, noise=0.0, seed=2))
    head = prim("cube", "nh", loc=(0, -0.34, 0.10), scale=(0.32, 0.28, 0.14))
    parts.append(solid(head, (0.03, 0.04, 0.06), ao=0.04, noise=0.0, seed=3))
    for sx in (-1, 1):
        ear = prim("cube", "ne", loc=(sx * 0.14, -0.42, 0.20), scale=(0.10, 0.10, 0.12))
        parts.append(solid(ear, MAG, ao=0.0, noise=0.0, seed=4))
    nose = prim("cube", "nn", loc=(0, -0.50, 0.16), scale=(0.08, 0.06, 0.05))
    parts.append(solid(nose, AMBER_N, ao=0.0, noise=0.0, seed=5))
    fuse(parts, "squirrel_body")
    parent_to(bpy.data.objects["squirrel_body"], root)
    look_eye(root, "squirrel_eye_l", (-0.08, -0.32, 0.20), 0.05, CYAN, (0.01, 0.04, 0.05))
    look_eye(root, "squirrel_eye_r", (0.08, -0.32, 0.20), 0.05, CYAN, (0.01, 0.04, 0.05))
    specs = (
        ((0.0, 0.26, 0.11), (0.18, 0.28, 0.07), CYAN),
        ((0.10, 0.46, 0.12), (0.16, 0.24, 0.07), MAG),
        ((-0.08, 0.64, 0.12), (0.16, 0.22, 0.07), CYAN),
        ((0.05, 0.78, 0.11), (0.14, 0.16, 0.06), AMBER_N),
    )
    segs = []
    for i, (loc, scale, col) in enumerate(specs):
        ob = prim("cube", f"nt{i}", loc=loc, scale=scale)
        paint(ob, col, ao=0.0, noise=0.0, seed=6)
        segs.append(ob)
    tail = fuse(segs, "squirrel_tail")
    origin_at(tail, (0.0, 0.26, 0.10))
    parent_to(tail, root)


def neon_trees():
    trunk = prim("cube", "nta", loc=(0, 0, 0.18), scale=(0.06, 0.06, 0.36))
    canopy = prim("cone", "nta_c", loc=(0, 0, 0.55), radius=0.20, depth=0.36, verts=4)
    fuse(
        [solid(trunk, NEON_BG, ao=0.02, noise=0.0, seed=1), solid(canopy, CYAN, ao=0.0, noise=0.0, seed=2)],
        "tree_a",
    )
    parts = [solid(prim("cube", "ntb", loc=(0, 0, 0.16), scale=(0.05, 0.05, 0.32)), NEON_BG, ao=0.0, noise=0.0, seed=1)]
    for i, (z, rad, col) in enumerate(((0.40, 0.12, MAG), (0.55, 0.09, CYAN), (0.68, 0.06, AMBER_N))):
        ring = prim("torus", f"ring{i}", loc=(0, 0, z), major_r=rad, minor_r=0.012, major=8, minor=3)
        parts.append(solid(ring, col, ao=0.0, noise=0.0, seed=2))
    fuse(parts, "tree_b")
    shard = prim("ico", "shard", loc=(0, 0, 0.16), radius=0.13, sub=0, scale=(1.05, 1.05, 1.25))
    solid(shard, MAG, ao=0.05, seed=3)
    shard.name = "tree_c"
    shard.data.name = "tree_c"


def neon_props():
    stump = prim("cyl", "nst", loc=(0, 0, 0.07), radius=0.12, depth=0.14, verts=6)
    ring = prim("torus", "nstr", loc=(0, 0, 0.13), major_r=0.12, minor_r=0.012, major=8, minor=3)
    fuse(
        [solid(stump, NEON_BG, ao=0.04, noise=0.0, seed=1), solid(ring, CYAN, ao=0.0, noise=0.0, seed=2)],
        "stump",
    )
    rock = prim("ico", "nrk", loc=(0, 0, 0.07), radius=0.10, sub=0, scale=(1.3, 1.0, 0.7))
    solid(rock, (0.05, 0.07, 0.09), ao=0.1, seed=3)
    rock.name = "rock"
    rock.data.name = "rock"
    nut = prim("ico", "nnut", loc=(0, 0, 0.05), radius=0.055, sub=0)
    cap = prim("cone", "ncap", loc=(0, 0, 0.10), radius=0.05, depth=0.06, verts=5)
    fuse([solid(nut, AMBER_N, ao=0.0, noise=0.0, seed=4), solid(cap, MAG, ao=0.0, noise=0.0, seed=5)], "acorn")


def neon_ball_goal():
    ball = prim("uv", "nball", radius=0.30, seg=10, rings=6)
    ring = prim("torus", "nring", major_r=0.30, minor_r=0.035, major=12, minor=4)
    cap = prim("ico", "nspot", loc=(0, -0.05, 0.22), radius=0.08, sub=1)
    fuse(
        [
            solid(ball, (0.03, 0.035, 0.05), ao=0.12, seed=1),
            solid(ring, MAG, ao=0.0, noise=0.0, seed=2),
            solid(cap, CYAN, ao=0.0, noise=0.0, seed=3),
        ],
        "ball",
    )
    mouth = prim("cyl", "ngm", loc=(0, 0, -0.01), radius=0.30, depth=0.04, verts=12)
    lip = prim("torus", "ngl", loc=(0, 0, 0.02), major_r=0.36, minor_r=0.03, major=14, minor=4)
    plate = prim("cyl", "ngp", loc=(0, 0, -0.02), radius=0.50, depth=0.035, verts=12)
    fuse(
        [
            solid(plate, NEON_BG, ao=0.02, noise=0.0, seed=4),
            solid(mouth, (0.01, 0.0, 0.015), ao=0.0, noise=0.0, seed=5),
            solid(lip, MAG, ao=0.0, noise=0.0, seed=6),
        ],
        "goal",
    )


def neon_ground():
    ground = prim("plane", "ground", loc=(0, 0, -0.035))
    solid(ground, (0.008, 0.01, 0.014), ao=0.0, noise=0.0, seed=1)


def build_neon():
    neon_tiles()
    neon_wall()
    neon_edges()
    neon_ground()
    neon_ball_goal()
    neon_squirrel()
    neon_trees()
    neon_props()


BUILDERS = (
    ("diorama", build_diorama),
    ("pixel", build_pixel),
    ("clay", build_clay),
    ("neon", build_neon),
)


def tri_count(obj, seen):
    if obj in seen:
        return 0
    seen.add(obj)
    total = 0
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    for child in obj.children:
        total += tri_count(child, seen)
    return total


def collect_stats():
    seen = set()
    rows = {}
    for ob in bpy.context.scene.objects:
        if ob.parent is not None:
            continue
        rows[ob.name] = tri_count(ob, seen)
    return rows


def export(path):
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        attr = ob.data.color_attributes.get("Color")
        if attr is not None:
            ob.data.color_attributes.active_color = attr
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="NONE",
        export_vertex_color="ACTIVE",
        export_animations=False,
        export_skins=False,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=False,
    )


def main():
    argv = extra_args()
    out = "assets/looks"
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    os.makedirs(out, exist_ok=True)
    report = {"outward": OUT, "step": STEP, "looks": {}}
    only = None
    if "--only" in argv:
        only = argv[argv.index("--only") + 1]
    for name, fn in BUILDERS:
        if only and name != only:
            continue
        fresh()
        fn()
        stats = collect_stats()
        report["looks"][name] = {"tris": stats, "total": sum(stats.values())}
        export(os.path.join(out, name + ".glb"))
        print(name, "tris", report["looks"][name]["total"], stats)
    manifest = os.path.join(out, "manifest.json")
    with open(manifest, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    main()
