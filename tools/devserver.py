#!/usr/bin/env python3
# PAWNCH dev server: static files with no-cache headers so ES module edits
# always take effect on reload (plain `python -m http.server` caches modules).
#
# Also exposes a localhost-only POST /__save?file=screenshots/foo.png that writes
# the request body to that path (used by the sprite generator / screenshot grab).
# Dev-only convenience; path is restricted to png files under screenshots/.
import http.server, socketserver, sys, os, urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/__save':
            self.send_error(404); return
        q = urllib.parse.parse_qs(parsed.query)
        rel = (q.get('file', [''])[0])
        # safety: only png files under screenshots/, no traversal
        if not rel.startswith('screenshots/') or '..' in rel or not rel.endswith('.png'):
            self.send_error(400, 'bad path'); return
        length = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(length)
        os.makedirs(os.path.dirname(rel), exist_ok=True)
        with open(rel, 'wb') as f:
            f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

print(f'PAWNCH dev server (no-cache) on http://localhost:{PORT}')
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
