#!/usr/bin/env python3
"""Procedural Toy planet GLB kit for Rollin Board (headless Blender).

Usage:
  blender -b --python tools/blender/export_toy_planet.py -- --out assets/models/raw
"""
import math
import os
import sys

import bpy
from mathutils import Vector

# --- game constants (js/board3d.js) ---
STEP = 1.16
WALL_T = 0.52
WALL_H = 0.4
BOARD_TOP = 0.5
WALL_Y = BOARD_TOP + WALL_H * 0.42
INK = (0.082, 0.082, 0.082, 1.0)

GEM = {
    "red": (0.886, 0.231, 0.231, 1.0),
    "blue": (0.184, 0.490, 1.0, 1.0),
    "green": (0.118, 0.659, 0.353, 1.0),
    "purple": (0.643, 0.227, 0.875, 1.0),
}

BRICKS = [
    (242 / 255, 226 / 255, 196 / 255, 1.0),
    (244 / 255, 206 / 255, 214 / 255, 1.0),
    (196 / 255, 228 / 255, 210 / 255, 1.0),
    (244 / 255, 230 / 255, 176 / 255, 1.0),
    (216 / 255, 204 / 255, 232 / 255, 1.0),
    (196 / 255, 220 / 255, 236 / 255, 1.0),
]

FRAME_MID = (0.886, 0.357, 0.541, 1.0)  # #e25b8a
FRAME_HI = (0.98, 0.72, 0.82, 1.0)
FRAME_LOW = (0.62, 0.24, 0.36, 1.0)
PLATE = (0.98, 0.98, 0.98, 1.0)
STAR = (1.0, 0.757, 0.102, 1.0)
PEDESTAL = (0.886, 0.231, 0.231, 1.0)


def argv_out():
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]
    else:
        args = []
    out = "assets/models/raw"
    i = 0
    while i < len(args):
        if args[i] == "--out" and i + 1 < len(args):
            out = args[i + 1]
            i += 2
        else:
            i += 1
    return out


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.samples = 32
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def mat(name, rgba, rough=0.45):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    return m


def assign(obj, material):
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def bevel(obj, width=0.04, seg=3):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = seg
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def ink_hull(source, name, scale=1.08):
    hull = source.copy()
    hull.data = source.data.copy()
    hull.name = name
    bpy.context.collection.objects.link(hull)
    assign(hull, mat("ink", INK, 0.9))
    bpy.ops.object.select_all(action="DESELECT")
    hull.select_set(True)
    bpy.context.view_layer.objects.active = hull
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode="OBJECT")
    hull.scale = (scale, scale, scale)
    hull.parent = source
    hull.matrix_parent_inverse = source.matrix_world.inverted()
    return hull


def bake_ao(obj):
    mesh = obj.data
    if not mesh.color_attributes:
        mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    layer = mesh.color_attributes.active_color
    for i in range(len(layer.data)):
        co = mesh.vertices[i].co
        # soft cavity darkening (AO proxy when headless bake is flaky)
        t = max(0.0, min(1.0, (co.z + 0.2) * 0.55 + (abs(co.x) + abs(co.y)) * 0.08))
        shade = 0.72 + t * 0.28
        layer.data[i].color = (shade, shade, shade, 1.0)


def box(name, sx, sy, sz, material, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx * 0.5, sy * 0.5, sz * 0.5)
    bpy.ops.object.transform_apply(scale=True)
    assign(obj, material)
    bevel(obj, min(sx, sy, sz) * 0.12)
    bake_ao(obj)
    ink_hull(obj, f"{name}_ink")
    return obj


def cyl(name, r, h, material, loc=(0, 0, 0), seg=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, material)
    bevel(obj, r * 0.18, 2)
    bake_ao(obj)
    ink_hull(obj, f"{name}_ink")
    return obj


def wall_block(name, color_key, long_x=True):
    long = STEP * 0.98
    thick = WALL_T
    bw = long if long_x else thick
    bd = thick if long_x else long
    body_h = WALL_H * 0.7
    rgba = GEM[color_key]
    m = mat(f"toon_wall_{color_key}", rgba, 0.38)
    m_hi = mat(f"toon_wall_{color_key}_hi", tuple(min(1, c + 0.18) for c in rgba[:3]) + (1,), 0.25)
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    grp.location = (0, WALL_Y, 0)
    body = box(f"{name}_body", bw, body_h, bd, m, (0, 0.03, 0))
    body.parent = grp
    cap = box(f"{name}_cap", bw * 0.9, WALL_H * 0.22, bd * 0.72, m_hi, (0, WALL_H * 0.32, 0))
    cap.parent = grp
    shine = box(f"{name}_shine", bw * 0.42, 0.035, bd * 0.28, m_hi, (0, WALL_H * 0.44, 0))
    shine.parent = grp
    return grp


def gate_block(name, color_key="red"):
    grp = wall_block(name, color_key, True)
    m = mat("toon_gate_lens", (1, 1, 1, 1), 0.2)
    lens = cyl(f"{name}_lens", 0.09, 0.02, m, (0, WALL_H * 0.36, WALL_T * 0.42), 20)
    lens.parent = grp
    return grp


def button_proto(color_key="red"):
    name = f"proto_button_{color_key}"
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    grp.location = (0, BOARD_TOP + 0.055, 0)
    plate = cyl(f"{name}_plate", 0.34, 0.05, mat("toon_button_plate", PLATE, 0.55), (0, -0.012, 0))
    plate.parent = grp
    gem = GEM[color_key]
    side = cyl(f"{name}_side", 0.28, 0.08, mat(f"toon_button_side_{color_key}", tuple(c * 0.65 for c in gem[:3]) + (1,), 0.5), (0, 0.055, 0))
    side.scale = (1.05, 0.58, 1.05)
    bpy.ops.object.select_all(action="DESELECT")
    side.select_set(True)
    bpy.context.view_layer.objects.active = side
    bpy.ops.object.transform_apply(scale=True)
    side.parent = grp
    dome = cyl(f"{name}_dome", 0.26, 0.08, mat(f"toon_button_dome_{color_key}", gem, 0.35), (0, 0.1, 0))
    dome.scale = (0.92, 0.62, 0.92)
    bpy.ops.object.select_all(action="DESELECT")
    dome.select_set(True)
    bpy.context.view_layer.objects.active = dome
    bpy.ops.object.transform_apply(scale=True)
    dome.parent = grp
    return grp


def floor_tile(name, rgba):
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    grp.location = (0, BOARD_TOP + 0.004, 0)
    tile = box(f"{name}_tile", STEP - 0.06, 0.08, STEP - 0.06, mat(name.replace("proto_", "toon_"), rgba, 0.62))
    tile.parent = grp
    stud = cyl(f"{name}_stud", STEP * 0.075, 0.035, mat(f"{name}_stud", rgba, 0.5), (0, 0.05, 0), 12)
    stud.parent = grp
    return grp


def frame_for_n(n=7):
    unit = n / 6.0
    frame_t = 0.4 * unit
    frame_h = 0.3 * unit
    span = n * STEP
    inner = span / 2 - 0.01
    outer = inner + frame_t
    outer_w = outer * 2
    hole_w = inner * 2
    name = f"proto_frame_n{n}"
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    mid = mat("toon_frame_mid", FRAME_MID, 0.42)
    hi = mat("toon_frame_hi", FRAME_HI, 0.28)
    low = mat("toon_frame_low", FRAME_LOW, 0.55)

    def ring(label, ow, iw, height, material, y):
        ow_i = ow
        iw_i = iw
        thick = (ow_i - iw_i) * 0.5
        outer_cube = box(f"{name}_{label}_o", ow_i, height, ow_i, material)
        inner_cube = box(f"{name}_{label}_i", iw_i, height * 1.05, iw_i, mat("toon_void", (0, 0, 0, 0), 1))
        inner_cube.location = (0, 0, 0)
        bpy.context.view_layer.objects.active = outer_cube
        mod = outer_cube.modifiers.new("Bool", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = inner_cube
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(inner_cube, do_unlink=True)
        outer_cube.location = (0, y, 0)
        outer_cube.parent = grp
        return outer_cube

    ring("mid", outer_w, hole_w, frame_h, mid, 0.02)
    ring("hi", outer_w - 0.01 * unit, outer_w - frame_t * 0.38, frame_h * 0.12, hi, 0.02 + frame_h * 0.9)
    ring("low", hole_w + 0.045 * unit * 2.1, hole_w + 0.006 * unit, frame_h * 0.1, low, 0.025 + frame_h * 0.86)
    return grp


def star_goal():
    name = "proto_goal_toy_star"
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    z = -0.48
    grp.location = (0, 0, z)
    h = 0.32 * 1.32
    base = box(f"{name}_base", 0.44, h * 0.84, 0.32, mat("toon_goal_pedestal", PEDESTAL, 0.48), (0, BOARD_TOP + h * 0.42, 0))
    base.parent = grp
    lid = box(f"{name}_lid", 0.46, 0.05, 0.34, mat("toon_goal_lid", STAR, 0.42), (0, BOARD_TOP + h * 0.84, 0.14))
    lid.name = "goal_lid"
    lid.parent = grp
    star = box(f"{name}_star", 0.22, 0.08, 0.22, mat("toon_goal_star", STAR, 0.35), (0, BOARD_TOP + h * 0.55 + 0.16, 0))
    star.name = "goal_star"
    star.parent = grp
    return grp


def deco_robot():
    name = "proto_deco_robot"
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    body = box(f"{name}_body", 0.28, 0.28, 0.44, mat("toon_deco_orange", (1.0, 0.55, 0.2, 1), 0.45), (0, 0.14, 0))
    body.parent = grp
    head = box(f"{name}_head", 0.22, 0.18, 0.18, mat("toon_deco_grey", (0.55, 0.57, 0.62, 1), 0.5), (0, 0.34, 0.02))
    head.parent = grp
    return grp


def deco_stack(name, colors):
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    y = 0.08
    for i, rgba in enumerate(colors):
        cube = box(f"{name}_c{i}", 0.18, 0.18, 0.18, mat(f"toon_deco_stack_{i}", rgba, 0.42), (0, y + i * 0.17, 0))
        cube.parent = grp
    return grp


def deco_balloon():
    name = "proto_deco_balloon"
    grp = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(grp)
    for i, rgba in enumerate([(1, 0.55, 0.75, 1), (0.24, 0.77, 1, 1), (1, 0.88, 0.29, 1)]):
        b = cyl(f"{name}_b{i}", 0.11, 0.22, mat(f"toon_balloon_{i}", rgba, 0.35), (i * 0.14 - 0.14, 0.28 + i * 0.04, 0), 14)
        b.scale = (1, 1.35, 1)
        bpy.ops.object.select_all(action="DESELECT")
        b.select_set(True)
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.transform_apply(scale=True)
        b.parent = grp
    return grp


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_image_format="NONE",
    )


def main():
    out_dir = argv_out()
    if not os.path.isabs(out_dir):
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        out_dir = os.path.join(root, out_dir)
    reset_scene()
    col = bpy.context.collection

    for c in ["red", "blue", "green", "purple"]:
        wall_block(f"proto_wall_{c}", c, True)
        wall_block(f"proto_wall_{c}_v", c, False)
    gate_block("proto_gate_red")
    for c in ["red", "blue", "green", "purple"]:
        button_proto(c)
    floor_tile("proto_floor_a", BRICKS[0])
    floor_tile("proto_floor_b", BRICKS[3])
    frame_for_n(7)
    star_goal()
    deco_robot()
    deco_stack("proto_deco_stack", [(0.24, 0.77, 1, 1), (1, 0.88, 0.29, 1), (1, 0.55, 0.2, 1)])
    deco_stack("proto_deco_stack_b", [(0.48, 0.87, 0.35, 1), (0.89, 0.23, 0.23, 1)])
    deco_balloon()

    raw = os.path.join(out_dir, "toy_planet.glb")
    export_glb(raw)
    print(f"Wrote {raw}")


if __name__ == "__main__":
    main()
