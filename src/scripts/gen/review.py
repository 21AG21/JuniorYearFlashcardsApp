#!/usr/bin/env python3
"""review.py <course> <unit> [n] — prints a sample of an out file for a human read: n ordinary cards, 3 explain-whys, a drill, the FRQ shapes, the notes."""
import json, random, sys, textwrap, os
G = os.environ.get('GEN_DIR', os.path.dirname(os.path.abspath(__file__)))
course, unit = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 6
o = json.load(open(f'{G}/out/{course}-{unit}.json', encoding='utf-8'))
random.seed(7)
def show(c):
    print(f"\n[{c['t']} · {c['v']} · k={c.get('k')} · s={c.get('s')} · c={c.get('c')} · y={c.get('y','')} · b={c.get('b','')}]")
    print('Q:', textwrap.fill(c['q'], 110)); print('A:', textwrap.fill(c['a'], 110)); print('h:', c.get('h')); print('n:', textwrap.fill(str(c.get('n')), 110))
    if c.get('o'): print('o:', ' | '.join(c['o']))
    if c.get('w'): print('w:', ' | '.join(x['a'] + ' — ' + x['why'] for x in c['w']))
    if c.get('x'): print('x:', c['x'])
ord_ = [c for c in o['cards'] if not c.get('y')]; js = [c for c in o['cards'] if c.get('y') == 'j']; ds = [c for c in o['cards'] if c.get('y') == 'd']
print('NOTES:', o.get('notes')); print('CHECK:', o.get('check')); print('EXCL:', [(x.get('c'), x['s'][:50]) for x in o.get('excl', [])])
print('\n===== ordinary sample'); [show(c) for c in random.sample(ord_, min(n, len(ord_)))]
print('\n===== explain-why sample'); [show(c) for c in random.sample(js, min(3, len(js)))]
print('\n===== drills'); [show(c) for c in ds[:2]]
print('\n===== FRQ')
for f in o.get('frq', []):
    print(f"\n{f['kind']} · {f['pts']} pts · {f['title']} · b={f.get('b','')} · calc={f.get('calc','')}")
    print('  stem:', textwrap.shorten(f['stem'], 300))
    for p in f.get('parts', []): print(f"  ({p['l']}) {p.get('p')} pt · {textwrap.shorten(p['q'], 120)}\n      → {textwrap.shorten(p['a'], 160)}")
    for r in f.get('rows', []): print(f"  row {r['r']} · {r.get('p')} pt · earns: {textwrap.shorten(r.get('earns',''), 100)}")
