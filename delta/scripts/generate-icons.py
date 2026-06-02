"""
Generates PWA icons (192x192 and 512x512) as PNG files.
Uses only Python stdlib — no Pillow or other packages needed.
Run: python3 scripts/generate-icons.py
"""

import struct
import zlib
import os
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), "../public/icons")
os.makedirs(OUT_DIR, exist_ok=True)


# ── Minimal PNG writer ────────────────────────────────────────────────────────

def png_chunk(name: bytes, data: bytes) -> bytes:
    c = zlib.crc32(name + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)

def write_png(path: str, pixels: list[list[tuple[int,int,int,int]]], size: int):
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type None
        for r, g, b, _ in row:
            raw.extend([r, g, b])

    idat = png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    iend = png_chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(sig + ihdr + idat + iend)


# ── Drawing helpers ───────────────────────────────────────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t

def gradient_bg(x, y, size):
    """Violet diagonal gradient: #6d28d9 → #4f46e5"""
    t = (x + y) / (2 * size)
    r = int(lerp(0x6d, 0x4f, t))
    g = int(lerp(0x28, 0x46, t))
    b = int(lerp(0xd9, 0xe5, t))
    return (r, g, b, 255)

def rounded_rect_mask(x, y, size, radius):
    """Returns True if pixel (x,y) is inside a rounded rectangle."""
    rx, ry = radius, radius
    cx = max(rx, min(x, size - 1 - rx))
    cy = max(ry, min(y, size - 1 - ry))
    dx, dy = x - cx, y - cy
    return (dx * dx + dy * dy) <= rx * rx

def point_in_polygon(px, py, poly):
    """Ray-casting inside-polygon test."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def zap_polygon(size):
    """
    Returns the lightning-bolt polygon scaled to the icon size.
    Original viewBox: 24x24
    Points: 13 2 | 3 14 | 12 14 | 11 22 | 21 10 | 12 10 | 13 2
    Padded 20% on each side.
    """
    pad = size * 0.18
    draw_size = size - 2 * pad
    scale = draw_size / 24

    raw = [(13,2),(3,14),(12,14),(11,22),(21,10),(12,10)]
    return [(x * scale + pad, y * scale + pad) for x, y in raw]


def generate_icon(size: int) -> list[list[tuple[int,int,int,int]]]:
    radius = int(size * 0.18)
    poly   = zap_polygon(size)
    pixels = []

    for y in range(size):
        row = []
        for x in range(size):
            # 1. Outside rounded rect → transparent
            if not rounded_rect_mask(x, y, size, radius):
                row.append((0, 0, 0, 0))
                continue

            # 2. Inside lightning bolt → white
            if point_in_polygon(x + 0.5, y + 0.5, poly):
                row.append((255, 255, 255, 255))
                continue

            # 3. Background gradient
            row.append(gradient_bg(x, y, size))

        pixels.append(row)

    return pixels


# ── Generate ──────────────────────────────────────────────────────────────────

for sz in [192, 512]:
    path = os.path.join(OUT_DIR, f"icon-{sz}.png")
    print(f"Generating {sz}x{sz}...", end=" ", flush=True)
    pixels = generate_icon(sz)
    write_png(path, pixels, sz)
    print(f"✅  saved → {path}")

print("\nAll PWA icons generated successfully.")
