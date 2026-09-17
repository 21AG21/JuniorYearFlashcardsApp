"""Stamp every course in data/index.json with a version of its deck file.

    python src/scripts/stamp_index.py

`v` is the first 8 hex of sha1 of data/<id>.json. The app compares it when a
new service worker takes control: a deck whose stamp moved is fetched again
and the shelf repainted, even when its card count did not change (a book
that grew, a fix to an answer). Run after any deck file changes; the Six
Ladders exporter runs it itself.
"""
import json, hashlib, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def stamp(root=ROOT):
    p = root / 'data' / 'index.json'
    raw = p.read_text(encoding='utf-8')
    ix = json.loads(raw)
    moved = []
    for c in ix['courses']:
        f = root / 'data' / (c['id'] + '.json')
        v = hashlib.sha1(f.read_bytes()).hexdigest()[:8]
        if c.get('v') != v: moved.append(c['id'])
        c['v'] = v
    pretty = raw.lstrip().startswith('{\n')
    out = json.dumps(ix, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (',', ':'))
    p.write_text(out + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return moved

if __name__ == '__main__':
    m = stamp()
    print('stamped', m if m else 'nothing moved')
