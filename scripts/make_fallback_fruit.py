#!/usr/bin/env python3
"""Build recognizable textured GLBs for fruits without a CC0 scan."""
from __future__ import annotations

import io
import json
import math
import random
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/models/fruit"


def pad4(data: bytes, fill: bytes = b"\x00") -> bytes:
    n = (4 - len(data) % 4) % 4
    return data + fill * n


def write_glb(path: Path, meshes: list[dict], image: bytes, roughness=0.45) -> None:
    blobs = []
    accessors = []
    views = []
    gl_meshes = []
    nodes = []
    offset = 0

    def add_view(buf: bytes, target: int | None = None) -> int:
        nonlocal offset
        buf = pad4(buf)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(buf)}
        if target:
            view["target"] = target
        views.append(view)
        blobs.append(buf)
        offset += len(buf)
        return len(views) - 1

    for i, mesh in enumerate(meshes):
        pos = mesh["pos"]
        nrm = mesh["nrm"]
        uv = mesh["uv"]
        idx = mesh["idx"]
        xs = [p[0] for p in pos]
        ys = [p[1] for p in pos]
        zs = [p[2] for p in pos]
        pos_b = b"".join(struct.pack("<3f", *p) for p in pos)
        nrm_b = b"".join(struct.pack("<3f", *n) for n in nrm)
        uv_b = b"".join(struct.pack("<2f", *t) for t in uv)
        idx_b = b"".join(struct.pack("<H", n) for n in idx)
        if len(idx_b) % 4:
            idx_b += b"\x00" * (4 - len(idx_b) % 4)
        pv = add_view(pos_b, 34962)
        nv = add_view(nrm_b, 34962)
        tv = add_view(uv_b, 34962)
        iv = add_view(idx_b, 34963)
        ia = len(accessors)
        accessors += [
            {
                "bufferView": pv,
                "componentType": 5126,
                "count": len(pos),
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            },
            {"bufferView": nv, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
            {"bufferView": tv, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": iv, "componentType": 5123, "count": len(idx), "type": "SCALAR"},
        ]
        gl_meshes.append(
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": ia, "NORMAL": ia + 1, "TEXCOORD_0": ia + 2},
                        "indices": ia + 3,
                        "material": 0,
                    }
                ]
            }
        )
        nodes.append({"mesh": i, "translation": mesh.get("trans", [0, 0, 0]), "rotation": mesh.get("rot", [0, 0, 0, 1])})

    img_view = add_view(image)
    bin_blob = b"".join(blobs)
    gltf = {
        "asset": {"version": "2.0", "generator": "small-games-fallback-fruit"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": 0,
                    "roughnessFactor": roughness,
                }
            }
        ],
        "textures": [{"source": 0}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    json_blob = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    glb = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(json_blob) + 8 + len(bin_blob))
    glb += struct.pack("<II", len(json_blob), 0x4E4F534A) + json_blob
    glb += struct.pack("<II", len(bin_blob), 0x004E4942) + bin_blob
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(glb)
    print("wrote", path, path.stat().st_size)


def sphere(seg_u=28, seg_v=20, rx=1, ry=1, rz=1, deform=None, uv_lock=None):
    pos, nrm, uv, idx = [], [], [], []
    for v in range(seg_v + 1):
        phi = math.pi * v / seg_v
        for u in range(seg_u + 1):
            th = 2 * math.pi * u / seg_u
            x = rx * math.sin(phi) * math.cos(th)
            y = ry * math.cos(phi)
            z = rz * math.sin(phi) * math.sin(th)
            if deform:
                x, y, z = deform(x, y, z, u / seg_u, v / seg_v)
            pos.append((x, y, z))
            L = math.sqrt(x * x + y * y + z * z) or 1
            nrm.append((x / L, y / L, z / L))
            uv.append(uv_lock if uv_lock else (u / seg_u, v / seg_v))
    cols = seg_u + 1
    for v in range(seg_v):
        for u in range(seg_u):
            a = v * cols + u
            b = a + 1
            c = a + cols
            d = c + 1
            idx += [a, c, b, b, c, d]
    return {"pos": pos, "nrm": nrm, "uv": uv, "idx": idx}


def lathe(profile, seg_u=28):
    pos, nrm, uv, idx = [], [], [], []
    for v, (y, r) in enumerate(profile):
        for u in range(seg_u + 1):
            th = 2 * math.pi * u / seg_u
            x = r * math.cos(th)
            z = r * math.sin(th)
            pos.append((x, y, z))
            nrm.append((math.cos(th), 0, math.sin(th)))
            uv.append((u / seg_u, v / (len(profile) - 1)))
    cols = seg_u + 1
    for v in range(len(profile) - 1):
        for u in range(seg_u):
            a = v * cols + u
            b = a + 1
            c = a + cols
            d = c + 1
            idx += [a, c, b, b, c, d]
    return {"pos": pos, "nrm": nrm, "uv": uv, "idx": idx}


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def jpeg_from_image(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def paint_swatch(img: Image.Image, box, color):
    draw = ImageDraw.Draw(img)
    draw.rectangle(box, fill=color)


def make_orange_tex():
    size = 1024
    img = Image.new("RGB", (size, size))
    px = img.load()
    rnd = random.Random("orange-peel")
    for y in range(size):
        for x in range(size):
            n = ((x * 17 + y * 29) % 87) / 87
            pit = 1 if ((x * 3 + 7) % 11 == 0 and (y * 5 + 3) % 9 == 0) else 0
            base = mix((232, 118, 28), (255, 168, 42), 0.35 + 0.4 * n)
            if pit:
                base = mix(base, (168, 72, 16), 0.55)
            k = 0.9 + 0.12 * rnd.random()
            px[x, y] = tuple(min(255, int(c * k)) for c in base)
    paint_swatch(img, (0, 0, 48, 48), (72, 48, 22))
    return jpeg_from_image(img.filter(ImageFilter.GaussianBlur(0.4)))


def make_strawberry_tex():
    size = 1024
    img = Image.new("RGB", (size, size), (214, 38, 52))
    px = img.load()
    rnd = random.Random("strawberry-skin")
    for y in range(size):
        for x in range(size):
            n = ((x * 11 + y * 19) % 63) / 63
            px[x, y] = mix((196, 28, 44), (240, 70, 78), n)
    for _ in range(520):
        cx, cy = rnd.randint(40, size - 40), rnd.randint(40, size - 40)
        for dy in range(-4, 5):
            for dx in range(-3, 4):
                if dx * dx + dy * dy * 1.4 < 12:
                    px[cx + dx, cy + dy] = (246, 204, 72) if dx * dx + dy * dy < 5 else (168, 48, 36)
    paint_swatch(img, (0, 0, 96, 96), (42, 122, 48))
    return jpeg_from_image(img)


def make_mango_tex():
    size = 1024
    img = Image.new("RGB", (size, size))
    px = img.load()
    rnd = random.Random("mango-skin")
    for y in range(size):
        for x in range(size):
            t = x / size
            blush = max(0, 1 - abs(t - 0.28) * 2.4)
            base = mix((255, 196, 48), (255, 140, 28), t)
            if blush > 0:
                base = mix(base, (232, 72, 36), blush * 0.72)
            speckle = 1 if rnd.random() > 0.985 else 0
            if speckle:
                base = mix(base, (120, 64, 24), 0.35)
            px[x, y] = base
    return jpeg_from_image(img.filter(ImageFilter.GaussianBlur(0.6)))


def make_peach_tex():
    size = 1024
    img = Image.new("RGB", (size, size))
    px = img.load()
    rnd = random.Random("peach-fuzz")
    for y in range(size):
        for x in range(size):
            t = (x / size) * 0.55 + (y / size) * 0.45
            blush = max(0.0, 1 - abs((x / size) - 0.62) * 2.2)
            base = mix((255, 196, 110), (255, 168, 88), t)
            base = mix(base, (255, 118, 96), blush * 0.55)
            n = rnd.random()
            base = mix(base, (230, 150, 90), n * 0.12)
            px[x, y] = base
    return jpeg_from_image(img.filter(ImageFilter.GaussianBlur(0.8)))


def make_grape_tex():
    size = 512
    img = Image.new("RGB", (size, size), (118, 28, 72))
    px = img.load()
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            dx, dy = (x - cx) / cx, (y - cy) / cy
            r = math.sqrt(dx * dx + dy * dy)
            shade = max(0, 1 - r * 0.85)
            hi = max(0, 1 - math.sqrt((dx + 0.28) ** 2 + (dy + 0.32) ** 2) * 1.8)
            base = mix((72, 16, 48), (168, 52, 96), shade)
            if hi > 0:
                base = mix(base, (230, 180, 200), hi * 0.55)
            bloom = 1 if r < 0.92 else 0
            px[x, y] = mix(base, (90, 24, 58), 0.15 * bloom)
    paint_swatch(img, (0, 0, 40, 40), (62, 42, 22))
    return jpeg_from_image(img.filter(ImageFilter.GaussianBlur(0.7)))


def make_orange():
    def deform(x, y, z, uu, vv):
        n = 0.016 * math.sin(uu * 56) * math.sin(vv * 40)
        n += 0.01 * math.sin(uu * 88 + 1.7) * math.sin(vv * 62)
        s = 1 + n
        y *= 0.94
        return x * s, y * s, z * s

    body = sphere(48, 32, 0.5, 0.48, 0.5, deform)
    stem = lathe([(0.46, 0.018), (0.52, 0.014), (0.58, 0.01)], 10)
    for i, _ in enumerate(stem["uv"]):
        stem["uv"][i] = (0.02, 0.02)
    return [body, stem]


def make_strawberry():
    prof = []
    for i in range(40):
        t = i / 39
        y = -0.42 + t * 0.92
        # point at the bottom, fat shoulders under the calyx
        belly = math.sin(math.pi * min(1, t * 1.05)) ** 0.72
        r = 0.02 + 0.38 * belly * (0.55 + 0.45 * t)
        if t < 0.08:
            r = 0.004 + t * 0.9
        if t > 0.92:
            r *= max(0.12, (1 - t) / 0.08)
        if i in (0, 39):
            r = 0.004
        prof.append((y, r))
    body = lathe(prof, 48)
    leaves = []
    for k in range(6):
        a = k / 6 * math.pi * 2
        leaf = sphere(8, 6, 0.2, 0.028, 0.1, uv_lock=(0.04, 0.04))
        leaf["trans"] = [math.cos(a) * 0.14, 0.48, math.sin(a) * 0.14]
        leaves.append(leaf)
    return [body, *leaves]


def make_mango():
    def deform(x, y, z, uu, vv):
        # kidney / cheek: long, flat, fat bottom, hooked shoulder
        z *= 0.52
        fat = 0.72 + 0.38 * ((y + 0.5) ** 2)
        x *= fat
        y = y * 1.22 + 0.16 * x * abs(x)
        if y > 0.35:
            y += 0.08 * (y - 0.35)
        return x, y, z

    return [sphere(48, 36, 0.42, 0.5, 0.38, deform)]


def make_peach():
    def deform(x, y, z, uu, vv):
        y *= 0.92
        # suture / crease on the front
        crease = math.exp(-(x * x) / 0.01) * max(0.0, z)
        z -= crease * 0.22
        s = 0.98 + 0.04 * math.sin(vv * math.pi)
        return x * s, y * s, z

    return [sphere(48, 36, 0.5, 0.46, 0.5, deform)]


def make_grape():
    meshes = []
    # hanging bunch, wider at top
    rows = [
        [(0.0, 0.22, 0.0)],
        [(-0.13, 0.12, 0.04), (0.13, 0.12, -0.03), (0.0, 0.14, -0.12)],
        [(-0.18, 0.0, 0.02), (0.18, 0.02, 0.04), (-0.04, 0.02, 0.14), (0.06, -0.01, -0.14)],
        [(-0.12, -0.14, 0.08), (0.12, -0.14, -0.06), (0.0, -0.16, 0.02), (-0.16, -0.12, -0.08)],
        [(-0.06, -0.28, 0.04), (0.08, -0.3, -0.02), (0.0, -0.38, 0.0)],
    ]
    for row in rows:
        for ox, oy, oz in row:
            g = sphere(16, 12, 0.11, 0.11, 0.11, uv_lock=(0.5, 0.42))
            g["trans"] = [ox, oy, oz]
            meshes.append(g)
    stem = lathe([(0.28, 0.014), (0.4, 0.012), (0.55, 0.01)], 8)
    for i, _ in enumerate(stem["uv"]):
        stem["uv"][i] = (0.02, 0.02)
    meshes.append(stem)
    return meshes


def main():
    jobs = [
        ("orange", make_orange, make_orange_tex, 0.52),
        ("strawberry", make_strawberry, make_strawberry_tex, 0.42),
        ("mango", make_mango, make_mango_tex, 0.48),
        ("peach", make_peach, make_peach_tex, 0.7),
        ("grape", make_grape, make_grape_tex, 0.26),
    ]
    for name, mesh_fn, tex_fn, rough in jobs:
        dest = OUT / name / f"{name}.glb"
        write_glb(dest, mesh_fn(), tex_fn(), roughness=rough)


if __name__ == "__main__":
    main()
