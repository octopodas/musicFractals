#!/usr/bin/env python3
"""Static server for the Fractal Glass Cube visualizer.

Serves this folder AND auto-generates the track list: GET /tracks/tracks.json
returns whatever audio files are currently in tracks/ (no manual editing).

    python3 server.py [port]      # default 8000

ponytail: stdlib http.server only, no deps. Run `python3 server.py --selftest`
to check the listing logic.
"""
import json, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
AUDIO_EXT = ('.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus')


def list_tracks(folder):
    """Sorted audio filenames in `folder` (empty list if missing)."""
    try:
        return sorted(f for f in os.listdir(folder)
                      if f.lower().endswith(AUDIO_EXT) and not f.startswith('.'))
    except FileNotFoundError:
        return []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
        if self.path.split('?')[0] == '/tracks/tracks.json':
            body = json.dumps(list_tracks(os.path.join(ROOT, 'tracks'))).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        for n in ('b.mp3', 'a.wav', 'note.txt', '.hidden.mp3'):
            open(os.path.join(d, n), 'w').close()
        assert list_tracks(d) == ['a.wav', 'b.mp3'], list_tracks(d)
        assert list_tracks(os.path.join(d, 'nope')) == []
    print('selftest ok')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
        sys.exit(0)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Fractal Glass Cube → http://localhost:{port}/  (Ctrl+C to stop)')
    try:
        ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
