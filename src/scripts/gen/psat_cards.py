#!/usr/bin/env python3
"""psat_cards.py check <unit>   — checks out/psat-<unit>.json (SPEC-psat.md, "Cards")
   psat_cards.py build          — writes data/psat.json from every unit file that passes and lists the course in
                                  data/index.json (after the SAT vocab deck), then stamps the index"""
import json, sys, os, re, hashlib, subprocess, collections
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
sys.path.insert(0, G)
from tests import PSAT_UNITS, tex_check
UNITS = [('plan', 'The plan and test day'), ('craft', 'Craft and structure'), ('info', 'Information and ideas'),
         ('conv', 'Standard English conventions'), ('expr', 'Expression of ideas'), ('math', 'Math: the last few points')]
TOPIC = {'WIC': 'Words in context', 'TSP': 'Text structure and purpose', 'CTC': 'Cross-text connections',
         'CID': 'Central ideas and details', 'COET': 'Command of evidence: textual', 'COEQ': 'Command of evidence: quantitative',
         'INF': 'Inferences', 'BND': 'Boundaries', 'FSS': 'Form, structure, and sense', 'TRN': 'Transitions',
         'SYN': 'Rhetorical synthesis', 'ALG': 'Algebra', 'ADV': 'Advanced math', 'PSD': 'Problem-solving and data analysis',
         'GEO': 'Geometry and trigonometry', 'PLAN': 'The Selection Index and the strategy', 'DAY': 'Timing and test day'}
VERBS = {'FIX', 'EXPLAIN', 'DECIDE', 'CHOOSE', 'IDENTIFY', 'APPLY', 'CALCULATE', 'RECALL'}


def norm(q): return re.sub(r'\s+', ' ', str(q).lower()).strip().rstrip('.?!:')


def check(unit):
    E, W = [], []
    p = f'{G}/out/psat-{unit}.json'
    if not os.path.exists(p): return [f'no file {p}'], W, None
    try: d = json.load(open(p, encoding='utf-8'))
    except Exception as x: return [f'bad JSON: {x}'], W, None
    if d.get('course') != 'psat' or d.get('unit') != unit: E.append('course/unit fields')
    for k in ('title', 'blurb'):
        if not d.get(k): E.append(f'no {k}')
    if not 5 <= len(d.get('keys') or []) <= 8: E.append('keys: 5 to 8')
    cards = d.get('cards') or []
    lo = 12 if unit == 'plan' else 25
    if not lo <= len(cards) <= 70: E.append(f'{len(cards)} cards (want {lo} to 70)')
    seen = set(); per = collections.Counter()
    for i, c in enumerate(cards):
        w = f'card {i + 1}'
        if c.get('t') not in PSAT_UNITS[unit]: E.append(f'{w}: t {c.get("t")!r} not in {PSAT_UNITS[unit]}')
        else: per[c['t']] += 1
        if c.get('v') not in VERBS: E.append(f'{w}: v {c.get("v")!r}')
        for k in ('q', 'a', 'h', 'n'):
            if not c.get(k): E.append(f'{w}: no {k}')
            tex_check(c.get(k), f'{w}.{k}', E)
        if len(c.get('q') or '') > 900: E.append(f'{w}: q over 900 characters')
        if len(c.get('a') or '') > 600: E.append(f'{w}: a over 600 characters')
        if c.get('c') not in (0, 1): E.append(f'{w}: c must be 0 or 1')
        if c.get('x') is not None and not (isinstance(c['x'], list) and all(isinstance(v, str) for v in c['x'])): E.append(f'{w}: x is null or a list of strings')
        k = norm(c.get('q'))
        if k in seen: E.append(f'{w}: duplicate question')
        seen.add(k)
    for tcode in PSAT_UNITS[unit]:
        if per[tcode] < (4 if unit != 'plan' else 3): E.append(f'topic {tcode} has {per[tcode]} cards')
    return E, W, {'cards': len(cards), 'per': dict(per)}


def build():
    ok = {}
    for u, _ in UNITS:
        E, W, s = check(u)
        if E: print(f'psat/{u}: FAIL {len(E)}, skipped'); continue
        ok[u] = json.load(open(f'{G}/out/psat-{u}.json', encoding='utf-8'))
    old = {}
    path = f'{ROOT}/data/psat.json'
    if os.path.exists(path): old = json.load(open(path, encoding='utf-8'))
    units, cards = [], []
    for n, (u, title) in enumerate(UNITS, 1):
        src = ok.get(u)
        if not src: continue
        ou = [x for x in old.get('units') or [] if x['id'] == u]
        unit = {'id': u, 'n': n, 'title': src.get('title') or title, 'count': len(src['cards']), 'blurb': src['blurb'],
                'keys': src['keys'], 'topics': [{'c': c, 't': TOPIC[c]} for c in PSAT_UNITS[u]]}
        if ou and ou[0].get('tests'): unit['tests'] = ou[0]['tests']
        units.append(unit)
        for c in src['cards']:
            card = {'i': hashlib.sha1(('psat|' + c['q']).encode('utf-8')).hexdigest()[:10], 'u': u, 't': c['t'], 'v': c['v'],
                    'q': c['q'], 'a': c['a'], 'h': c.get('h') or None, 'n': c.get('n') or None, 'c': 1 if c.get('c') else 0,
                    'x': c.get('x') or None}
            cards.append(card)
    ids = [c['i'] for c in cards]; assert len(ids) == len(set(ids))
    d = {'id': 'psat', 'name': 'PSAT/NMSQT', 'short': 'PSAT', 'abbr': 'PSAT',
         'blurb': 'Reading and Writing at the hard-module level, math with no careless misses, and timed modules',
         'units': units, 'cards': cards}
    if old.get('testsV'): d['testsV'] = old['testsV']
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    ixp = f'{ROOT}/data/index.json'; raw = open(ixp, encoding='utf-8').read(); ix = json.loads(raw)
    entry = {'id': 'psat', 'name': d['name'], 'short': d['short'], 'abbr': d['abbr'], 'blurb': d['blurb'], 'count': len(cards),
             'units': [{'id': u['id'], 'n': u['n'], 'title': u['title'], 'count': u['count']} for u in units]}
    have = [i for i, c in enumerate(ix['courses']) if c['id'] == 'psat']
    was = ix['courses'][have[0]]['count'] if have else 0
    if have: entry['v'] = ix['courses'][have[0]].get('v'); ix['courses'][have[0]] = entry
    else:
        at = [i for i, c in enumerate(ix['courses']) if c['id'] == 'sat'][0]
        ix['courses'].insert(at, entry)
    if isinstance(ix.get('total'), int): ix['total'] += len(cards) - was
    open(ixp, 'w', encoding='utf-8').write(json.dumps(ix, ensure_ascii=False, separators=(',', ':')) + ('\n' if raw.endswith('\n') else ''))
    print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
    print(f'psat: {len(units)} units, {len(cards)} cards')


if __name__ == '__main__':
    if sys.argv[1] == 'check':
        E, W, s = check(sys.argv[2])
        print(f'== psat/{sys.argv[2]}:', s)
        for x in W: print('   W', x)
        for x in E: print('   E', x)
        print('RESULT', 'FAIL' if E else 'PASS')
    elif sys.argv[1] == 'build': build()
