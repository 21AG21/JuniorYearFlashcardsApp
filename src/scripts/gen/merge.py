#!/usr/bin/env python3
"""merge.py <course> <unit> [<unit> ...]  — replaces each unit's cards in data/<course>.json with out/<course>-<unit>.json, sets the unit's CED frame, re-counts, re-stamps."""
import json, sys, os, re, hashlib, subprocess
G = os.environ.get('GEN_DIR', os.path.dirname(os.path.abspath(__file__))); ROOT = os.environ.get('APP_ROOT', os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
course = sys.argv[1]; units = sys.argv[2:]
sk = json.load(open(os.path.join(os.environ.get('CED_DIR', os.path.join(ROOT, 'src', 'research', 'ced')), f'{course}.skeleton.json'), encoding='utf-8'))
path = f'{ROOT}/data/{course}.json'
d = json.load(open(path, encoding='utf-8'))
order = [u['id'] for u in d['units']]
by_unit = {uid: [] for uid in order}
for c in d['cards']: by_unit.setdefault(c['u'], []).append(c)
for unit in units:
    out = json.load(open(f'{G}/out/{course}-{unit}.json', encoding='utf-8'))
    assert out['course'] == course and out['unit'] == unit
    new = []
    for c in out['cards']:
        card = {'i': hashlib.sha1((course + '|' + c['q']).encode('utf-8')).hexdigest()[:10], 'u': unit,
                't': c['t'], 'v': c['v'], 'q': c['q'], 'a': c['a'], 'h': c.get('h') or None, 'n': c.get('n') or None,
                'c': 1 if c.get('c') else 0, 'x': c.get('x') or None, 'k': c['k'], 's': c['s']}
        for k in ('b','y','o','w'):
            if c.get(k): card[k] = c[k]
        new.append(card)
    by_unit[unit] = new
    u = [x for x in d['units'] if x['id'] == unit][0]
    u['topics'] = out['topics']; u['excl'] = out.get('excl') or []; u['check'] = out.get('check') or ''
    u['frq'] = out.get('frq') or []; u['count'] = len(new)
    u['ced'] = sk.get('edition') or ''
    su = [x for x in sk['units'] if x['id'] == unit]
    if su and su[0].get('weight') and re.match(r'^\d+–\d+%$', su[0]['weight']): u['weight'] = su[0]['weight']
    print(f'{course}/{unit}: {len(new)} cards, {len(u["frq"])} FRQ')
d['cards'] = [c for uid in order for c in by_unit.get(uid, [])]
ids = [c['i'] for c in d['cards']]
assert len(ids) == len(set(ids)), 'duplicate ids across the deck'
json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
ix_path = f'{ROOT}/data/index.json'; raw = open(ix_path, encoding='utf-8').read(); ix = json.loads(raw)
for c in ix['courses']:
    if c['id'] == course:
        c['count'] = len(d['cards'])
        for iu in c['units']:
            du = [x for x in d['units'] if x['id'] == iu['id']][0]; iu['count'] = du['count']
            if du.get('weight'): iu['weight'] = du['weight']
open(ix_path, 'w', encoding='utf-8').write(json.dumps(ix, ensure_ascii=False, separators=(',', ':')) + ('\n' if raw.endswith('\n') else ''))
print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
