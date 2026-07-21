#!/usr/bin/env python3
"""Composite a transparent PNG onto a checkerboard so the Read tool shows the
real cutout (Read renders alpha as white and lies). Usage:
  tools/.venv/bin/python tools/check_alpha.py in.png out.png [--scale N]"""
import sys
from PIL import Image

def main():
    src = Image.open(sys.argv[1]).convert('RGBA')
    out_path = sys.argv[2]
    scale = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 2
    board = Image.new('RGBA', src.size)
    a, b = (255, 0, 255, 255), (140, 140, 140, 255)
    px = board.load()
    for y in range(src.height):
        for x in range(src.width):
            px[x, y] = a if ((x // 8 + y // 8) % 2 == 0) else b
    board.alpha_composite(src)
    board = board.resize((src.width * scale, src.height * scale), Image.NEAREST)
    board.convert('RGB').save(out_path)
    print(f'wrote {out_path} ({board.width}x{board.height})')

if __name__ == '__main__':
    main()
