#!/usr/bin/env python3
"""Apply audit corrections to the chunk files (the source of truth)."""
import json, glob, os, hashlib, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIELD = {'a': 'a', 'q': 'q', 'h': 'hint', 'n': 'note'}

# id -> (path, card dict)
chunks = {}
lookup = {}
for path in sorted(glob.glob(os.path.join(ROOT, 'data', 'chunks', '*.json'))):
    d = json.load(open(path, encoding='utf-8'))
    chunks[path] = d
    for card in d['cards']:
        q = unicodedata.normalize('NFC', card['q'].strip())
        cid = hashlib.sha1((d['course'] + '|' + q).encode('utf-8')).hexdigest()[:10]
        lookup[cid] = (path, card)

applied, missed, deleted = 0, [], 0
for fpath in sorted(glob.glob(os.path.join(ROOT, 'qa', 'fix-*.json'))):
    fx = json.load(open(fpath, encoding='utf-8'))
    for f in fx.get('fixes', []):
        hit = lookup.get(f['i'])
        if not hit:
            missed.append((f['i'], 'no such card', fpath)); continue
        path, card = hit
        if f['field'] == 'DELETE':
            chunks[path]['cards'] = [c for c in chunks[path]['cards'] if c is not card]
            deleted += 1; continue
        key = FIELD.get(f['field'])
        if not key:
            missed.append((f['i'], 'bad field ' + f['field'], fpath)); continue
        cur = card.get(key)
        if cur is None:
            missed.append((f['i'], 'field empty: ' + key, fpath)); continue
        old, new = f['old'], f['new']
        if unicodedata.normalize('NFC', cur) == unicodedata.normalize('NFC', old):
            card[key] = new; applied += 1
        elif old and old in cur:
            card[key] = cur.replace(old, new, 1); applied += 1
        else:
            missed.append((f['i'], 'old text did not match ' + key, fpath))
    # duplicate pairs: drop the second card of each pair
    for pair in fx.get('dupes', []):
        dup_id = pair[1]
        hit = lookup.get(dup_id)
        if not hit:
            missed.append((dup_id, 'dupe not found', fpath)); continue
        path, card = hit
        chunks[path]['cards'] = [c for c in chunks[path]['cards'] if c is not card]
        deleted += 1

for path, d in chunks.items():
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)

print(f"applied {applied} · deleted {deleted} · missed {len(missed)}")
for m in missed: print("  MISS", m)
