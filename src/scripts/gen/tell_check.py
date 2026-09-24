#!/usr/bin/env python3
"""tell_check.py <course> [merge] — validates out/tell-<course>.json against SPEC-tell.md; with merge, writes the
pairs into data/<course>.json as "pairs" and re-stamps the index."""
import json, sys, os, re, subprocess
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
c = sys.argv[1]; merge = 'merge' in sys.argv
d = json.load(open(f'{G}/out/tell-{c}.json', encoding='utf-8'))
data = json.load(open(f'{ROOT}/data/{c}.json', encoding='utf-8')); units = {u['id'] for u in data['units']}
errs, warns, ids = [], [], set()
def err(m): errs.append(m)
def warn(m): warns.append(m)
pairs = d.get('pairs') or []
if not 20 <= len(pairs) <= 30: err(f'{len(pairs)} pairs (want 20-30)')
STOP = {'the','a','an','of','and','or','to','in','on','de','la','le','les','du','des','et','un','une','à','en','vs','versus'}
for n, p in enumerate(pairs):
    tag = f'pair {n} {p.get("id")}'
    for k in ('id','u','a','b','items'):
        if not p.get(k): err(f'{tag}: missing {k}')
    if p.get('id') in ids: err(f'{tag}: duplicate id')
    ids.add(p.get('id'))
    for uu in str(p.get('u','')).split(','):
        if uu not in units: err(f'{tag}: unknown unit {uu}')
    for k in ('a','b'):
        if len(str(p.get(k,'')).split()) > 5: err(f'{tag}: label {k} over 5 words')
    items = p.get('items') or []
    if not 6 <= len(items) <= 8: err(f'{tag}: {len(items)} items (want 6-8)')
    ka = sum(1 for x in items if x.get('k') == 'a'); kb = sum(1 for x in items if x.get('k') == 'b')
    if ka < 2 or kb < 2: err(f'{tag}: split {ka}/{kb} (need 2+ each)')
    if ka + kb != len(items): err(f'{tag}: an item has k other than a/b')
    seen = set()
    for m, x in enumerate(items):
        s, w = x.get('s',''), x.get('why','')
        if not s or not w: err(f'{tag} item {m}: missing s or why')
        if len(s) > 140: err(f'{tag} item {m}: s {len(s)} chars')
        if len(w) > 200: err(f'{tag} item {m}: why {len(w)} chars')
        if s in seen: err(f'{tag} item {m}: duplicate statement')
        seen.add(s)
        for fld in (s, w):
            if fld.count('$') % 2: err(f'{tag} item {m}: odd $ count')
        own = p.get(x.get('k'), '') or ''
        words = [t for t in re.findall(r"[A-Za-zÀ-ÿ']{5,}", own.lower()) if t not in STOP]
        if any(t in s.lower() for t in words): warn(f'{tag} item {m}: statement contains a word of its own label: {s[:60]}')
print('\n'.join('ERR  ' + e for e in errs)); print('\n'.join('warn ' + w for w in warns))
print(f'{c}: {len(pairs)} pairs, {sum(len(p.get("items") or []) for p in pairs)} statements —', 'PASS' if not errs else 'FAIL')
if merge and not errs:
    data['pairs'] = pairs
    json.dump(data, open(f'{ROOT}/data/{c}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
