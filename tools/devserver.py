#!/usr/bin/env python3
# PAWNCH dev server: static files with no-cache headers so ES module edits
# always take effect on reload (plain `python -m http.server` caches modules).
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

print(f'PAWNCH dev server (no-cache) on http://localhost:{PORT}')
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
