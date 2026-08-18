#!/usr/bin/env python3
"""Merge chunk files into per-course decks. Validate. Emit build/data/*.json"""
import json, glob, os, re, hashlib, sys, collections, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'build', 'data')
os.makedirs(OUT, exist_ok=True)

VERBS = set("""DEFINE IDENTIFY STATE EXPLAIN CONTRAST RECALL TRANSLATE CONJUGATE DIFFERENTIATE
INTEGRATE EVALUATE COMPUTE DERIVE PREDICT BALANCE RANK DATE NAME DECIDE APPLY""".split())

courses = {c['id']: c for c in json.load(open(os.path.join(ROOT,'data','courses.json')))}
buckets = collections.defaultdict(list)
problems = []

for path in sorted(glob.glob(os.path.join(ROOT,'data','chunks','*.json'))):
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        problems.append(f"{os.path.basename(path)}: UNPARSEABLE {e}"); continue
    cid = d.get('course')
    if cid not in courses:
        problems.append(f"{os.path.basename(path)}: unknown course {cid!r}"); continue
    unit_ids = {u['id'] for u in courses[cid]['units']}
    for i, c in enumerate(d.get('cards', [])):
        src = f"{os.path.basename(path)}#{i}"
        if c.get('u') not in unit_ids:
            problems.append(f"{src}: bad unit {c.get('u')!r}"); continue
        if c.get('v') not in VERBS:
            problems.append(f"{src}: bad verb {c.get('v')!r}"); c['v'] = 'RECALL'
        for k in ('q','a'):
            if not isinstance(c.get(k), str) or not c[k].strip():
                problems.append(f"{src}: empty {k}"); break
        else:
            c['q'] = unicodedata.normalize('NFC', c['q'].strip())
            c['a'] = unicodedata.normalize('NFC', c['a'].strip())
            c['hint'] = (c.get('hint') or None)
            c['note'] = (c.get('note') or None)
            c['core'] = bool(c.get('core'))
            alt = c.get('alt') or None
            if alt and not isinstance(alt, list): alt = None
            c['alt'] = alt
            c['t'] = (c.get('t') or '').strip()
            c['src'] = src
            buckets[cid].append(c)

manifest = []
for cid, course in courses.items():
    cards = buckets.get(cid, [])
    seen, out = {}, []
    for c in cards:
        key = re.sub(r'\s+', ' ', c['q'].lower()).strip().rstrip('.?!:')
        if key in seen:
            problems.append(f"dup front in {cid}: {c['q'][:60]!r} ({c['src']} ~ {seen[key]})")
            continue
        seen[key] = c['src']
        cid_hash = hashlib.sha1((cid + '|' + c['q']).encode('utf-8')).hexdigest()[:10]
        out.append({
            'i': cid_hash, 'u': c['u'], 't': c['t'], 'v': c['v'],
            'q': c['q'], 'a': c['a'], 'h': c['hint'], 'n': c['note'],
            'c': 1 if c['core'] else 0, 'x': c['alt'],
        })
    counts = collections.Counter(c['u'] for c in out)
    units = [dict(u, count=counts.get(u['id'], 0)) for u in course['units']]
    deck = {'id': cid, 'name': course['name'], 'short': course['short'],
            'abbr': course['abbr'], 'blurb': course['blurb'],
            'units': units, 'cards': out}
    with open(os.path.join(OUT, f'{cid}.json'), 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, separators=(',', ':'))
    manifest.append({'id': cid, 'name': course['name'], 'short': course['short'],
                     'abbr': course['abbr'], 'blurb': course['blurb'],
                     'count': len(out), 'units': [{'id':u['id'],'n':u['n'],'title':u['title'],
                                                   'weight':u['weight'],'count':u['count']} for u in units]})

with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump({'courses': manifest, 'total': sum(m['count'] for m in manifest)}, f, ensure_ascii=False, separators=(',',':'))

print(f"TOTAL {sum(m['count'] for m in manifest)} cards")
for m in manifest:
    empty = [u['title'] for u in m['units'] if u['count'] == 0]
    print(f"  {m['id']:7s} {m['count']:5d}" + (f"  EMPTY UNITS: {empty}" if empty else ""))
    sizes = os.path.getsize(os.path.join(OUT, m['id']+'.json'))
    print(f"          {sizes/1024:.0f} KB")
if problems:
    print(f"\n{len(problems)} problems:")
    for p in problems[:40]: print("  -", p)
    if len(problems) > 40: print(f"  ... and {len(problems)-40} more")
