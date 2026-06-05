#!/usr/bin/env python3
"""Clean the chess-piece sprite PNGs for on-board clarity.

The hand-painted source sprites are large (~250-310 px) but render small
(~80-90 px tall) with nearest-neighbour scaling, so two things hurt clarity:

  1. Anti-aliased, semi-transparent EDGE pixels let the chessboard bleed
     through the silhouette.
  2. Where the dark outline is thin or missing (e.g. the white king's crown
     cross), the heavy downscale samples right past it, exposing the board.

This tool fixes both, with zero third-party deps (stdlib zlib + struct only):

  * alpha-harden  — every pixel becomes fully opaque or fully transparent
    (threshold ALPHA_T), killing the soft fade.
  * dark border   — the silhouette is wrapped in a solid ring, sampled from
    each piece's OWN darkest edge colour, thick enough to survive the
    downscale so every piece reads with a defined border.

Originals are copied once into assets/sprites/_orig/ and every run reprocesses
FROM that backup, so re-running (e.g. with a different --thickness) is
idempotent and never compounds.

Usage:
  python3 tools/clean-sprites.py                 # defaults
  python3 tools/clean-sprites.py --thickness 4   # thinner border
  python3 tools/clean-sprites.py --alpha 110     # looser alpha cut
"""
import os, sys, zlib, struct, shutil, argparse

PIECES = [c + t for c in ('w', 'b') for t in ('p', 'n', 'b', 'r', 'q', 'k')]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES = os.path.join(HERE, 'assets', 'sprites')
BACKUP = os.path.join(SPRITES, '_orig')
NEIGH8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]


# ---- minimal PNG codec (8-bit RGBA, non-interlaced) --------------------
def read_rgba(path):
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('%s is not a PNG' % path)
    off, idat = 8, bytearray()
    w = h = bd = ct = inter = None
    while off < len(data):
        ln = struct.unpack('>I', data[off:off + 4])[0]
        typ = data[off + 4:off + 8]
        payload = data[off + 8:off + 8 + ln]
        off += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ct, _comp, _filt, inter = struct.unpack('>IIBBBBB', payload)
        elif typ == b'IDAT':
            idat += payload
        elif typ == b'IEND':
            break
    if not (bd == 8 and ct == 6 and inter == 0):
        raise ValueError('%s: expected 8-bit RGBA non-interlaced (got bd=%s ct=%s inter=%s)'
                         % (path, bd, ct, inter))
    raw = zlib.decompress(bytes(idat))
    return w, h, defilter(w, h, raw)


def defilter(w, h, raw):
    bpp, stride = 4, w * 4
    out = bytearray(h * stride)
    pos = 0
    for y in range(h):
        ft = raw[pos]; pos += 1
        o = y * stride
        for x in range(stride):
            v = raw[pos + x]
            a = out[o + x - bpp] if x >= bpp else 0
            b = out[o - stride + x] if y > 0 else 0
            if ft == 0:
                r = v
            elif ft == 1:
                r = v + a
            elif ft == 2:
                r = v + b
            elif ft == 3:
                r = v + ((a + b) >> 1)
            elif ft == 4:
                c = out[o - stride + x - bpp] if (y > 0 and x >= bpp) else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                r = v + (a if (pa <= pb and pa <= pc) else b if pb <= pc else c)
            else:
                raise ValueError('unsupported filter %d' % ft)
            out[o + x] = r & 255
        pos += stride
    return out


def write_rgba(path, w, h, px):
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)                       # filter: None
        raw += px[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ, payload):
        crc = zlib.crc32(typ + payload) & 0xffffffff
        return struct.pack('>I', len(payload)) + typ + payload + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', comp) + chunk(b'IEND', b''))
    open(path, 'wb').write(blob)


# ---- cleanup ------------------------------------------------------------
def clean(w, h, px, alpha_t, thickness):
    n = w * h
    opaque = bytearray(1 if px[i * 4 + 3] >= alpha_t else 0 for i in range(n))

    # ring colour = average of the darkest ~6% of ALL opaque pixels, i.e. the
    # piece's own dark outline/shadow tone. (Sampling only the *outermost* edge
    # would grab the dark pieces' soft purple glow instead of the navy outline,
    # fattening the glow rather than giving a defined border.) Each piece keeps
    # its own near-black hue; fall back to a deep navy if nothing is dark.
    darks = sorted(
        (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2],
         px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
        for i in range(n) if opaque[i])
    if darks:
        k = max(1, len(darks) * 6 // 100)
        ring = (sum(e[1] for e in darks[:k]) // k,
                sum(e[2] for e in darks[:k]) // k,
                sum(e[3] for e in darks[:k]) // k)
    else:
        ring = (26, 28, 74)

    # hardened output: opaque pixels stay (full alpha), the rest go transparent
    out = bytearray(n * 4)
    for i in range(n):
        if opaque[i]:
            out[i * 4:i * 4 + 4] = bytes((px[i * 4], px[i * 4 + 1], px[i * 4 + 2], 255))

    # grow a solid dark border outward, one ring per step. A frontier keeps it
    # O(painted px) instead of rescanning the whole image each pass.
    painted = bytearray(opaque)
    frontier = [i for i in range(n) if opaque[i]]
    rb = bytes(ring) + b'\xff'
    for _ in range(thickness):
        nxt = []
        for i in frontier:
            x, y = i % w, i // w
            for dx, dy in NEIGH8:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    j = yy * w + xx
                    if not painted[j]:
                        painted[j] = 1
                        out[j * 4:j * 4 + 4] = rb
                        nxt.append(j)
        frontier = nxt

    before = sum(opaque)
    after = sum(painted)
    return out, ring, before, after


def main():
    ap = argparse.ArgumentParser(description='Alpha-harden + re-outline the piece sprites.')
    ap.add_argument('--alpha', type=int, default=128,
                    help='alpha cut 0-255: pixels below go transparent (default 128)')
    ap.add_argument('--thickness', type=int, default=5,
                    help='base border thickness in source px at the king height (default 5); '
                         'scaled per-piece by image height so the on-screen border is even')
    args = ap.parse_args()

    os.makedirs(BACKUP, exist_ok=True)
    print('cleaning %d sprites (alpha>=%d, border~%dpx)\n' % (len(PIECES), args.alpha, args.thickness))
    for name in PIECES:
        src_live = os.path.join(SPRITES, name + '.png')
        src_bak = os.path.join(BACKUP, name + '.png')
        if not os.path.exists(src_bak):                 # back up the true original once
            shutil.copy2(src_live, src_bak)
        w, h, px = read_rgba(src_bak)                   # always process from the original
        thick = max(2, round(args.thickness * h / 376)) # even border regardless of source size
        out, ring, before, after = clean(w, h, px, args.alpha, thick)
        write_rgba(src_live, w, h, out)
        print('  %s  %3dx%-3d  ring=#%02x%02x%02x  border=%dpx  opaque %d -> %d'
              % (name, w, h, ring[0], ring[1], ring[2], thick, before, after))
    print('\ndone. originals preserved in assets/sprites/_orig/ (re-run any time to retune).')


if __name__ == '__main__':
    main()
