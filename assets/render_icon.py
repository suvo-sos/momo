#!/usr/bin/env python3
"""Render Momo's logo to an .icns without any external SVG tooling.

Geometry mirrors assets/logo.svg exactly (512-unit design space):
rounded background + the two quadrants of ▞. Anti-aliased by supersampling.
"""

import os, struct, zlib, subprocess, sys

BG = (0x00, 0x70, 0xF3)
FG = (0xFA, 0xFA, 0xFA)


def rounded_rect_cov(x, y, rx, ry, w, h, r):
    """1.0 if point inside the rounded rect, else 0. Point in 0..1 space."""
    if x < rx or x > rx + w or y < ry or y > ry + h:
        return 0.0
    cx = min(max(x, rx + r), rx + w - r)
    cy = min(max(y, ry + r), ry + h - r)
    dx, dy = x - cx, y - cy
    return 1.0 if dx * dx + dy * dy <= r * r else 0.0


def render(size, ss=4):
    """Return RGBA bytes for one square size."""
    px = []
    inv = 1.0 / 512.0
    for j in range(size):
        for i in range(size):
            bg_acc = fg_acc = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    # sample point in 512-unit design space
                    x = (i + (sx + 0.5) / ss) / size * 512.0
                    y = (j + (sy + 0.5) / ss) / size * 512.0
                    if rounded_rect_cov(x, y, 0, 0, 512, 512, 112):
                        bg_acc += 1
                    if rounded_rect_cov(
                        x, y, 266, 140, 106, 106, 6
                    ) or rounded_rect_cov(x, y, 140, 266, 106, 106, 6):
                        fg_acc += 1
            n = ss * ss
            bg = bg_acc / n
            fg = fg_acc / n
            a = bg
            if a <= 0:
                px.extend((0, 0, 0, 0))
                continue
            # composite fg over bg
            r = BG[0] * (1 - fg) + FG[0] * fg
            g = BG[1] * (1 - fg) + FG[1] * fg
            b = BG[2] * (1 - fg) + FG[2] * fg
            px.extend((int(r + 0.5), int(g + 0.5), int(b + 0.5), int(a * 255 + 0.5)))
    return bytes(px)


def write_png(path, size, rgba):
    raw = b"".join(
        b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size)
    )

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AppIcon.iconset")
    os.makedirs(out, exist_ok=True)
    cache = {}
    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            size = base * scale
            if size not in cache:
                cache[size] = render(size)
            name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
            write_png(os.path.join(out, name), size, cache[size])
            print("wrote", name, f"{size}px")

    icns = os.path.join(os.path.dirname(out), "AppIcon.icns")
    subprocess.run(["iconutil", "-c", "icns", out, "-o", icns], check=True)
    print("wrote", icns)


if __name__ == "__main__":
    main()
