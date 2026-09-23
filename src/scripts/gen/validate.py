#!/usr/bin/env python3
"""validate.py <course> <unit>  — checks out/<course>-<unit>.json against in/<course>-<unit>.json and the live deck."""
import json, re, sys, os, collections
G = os.environ.get('GEN_DIR', os.path.dirname(os.path.abspath(__file__)))
ROOT = os.environ.get('APP_ROOT', os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
course, unit = sys.argv[1], sys.argv[2]
E, W, I = [], [], []
def err(m): E.append(m)
def warn(m): W.append(m)

VERBS = set("""CALCULATE IDENTIFY EXPLAIN JUSTIFY PREDICT DESCRIBE DETERMINE REPRESENT DRAW SKETCH COMPARE CONTRAST ANALYZE
CONSTRUCT ESTIMATE INTERPRET ARGUE SUPPORT WRITE APPROXIMATE FIND SHOW VERIFY CLASSIFY EVALUATE DERIVE STATE DEFINE NAME RANK
BALANCE DATE DECIDE APPLY RECALL COMPUTE DIFFERENTIATE INTEGRATE TRANSLATE CONJUGATE""".split())
KINDS = {'long','short','saq','dbq','leq','synthesis','rhetorical','argument','presentation','qa','essay','mc'}
TEX_OK = set("frac sqrt int sum lim pi theta Delta infty to pm le ge ne cdot times approx ln log sin cos tan sec csc cot arcsin arctan left right , ;".split())
CARD_KEYS = {'t','v','q','a','h','n','c','x','k','s','b','y','o','w'}

try:
    inp = json.load(open(f'{G}/in/{course}-{unit}.json', encoding='utf-8'))
except Exception as e:
    print('FATAL input:', e); sys.exit(2)
try:
    out = json.load(open(f'{G}/out/{course}-{unit}.json', encoding='utf-8'))
except Exception as e:
    print('FATAL output does not parse:', e); sys.exit(2)

sk = inp['skeleton']
skills = {s['code'] for s in inp.get('skills', [])}
unit_ids = {u['id'] for u in inp['units']}
if out.get('course') != course or out.get('unit') != unit: err('course/unit mismatch')
topics = out.get('topics') or []
if not topics: err('no topics')
tcodes = [t.get('c') for t in topics]
sk_codes = [t.get('code') for t in sk.get('topics', [])]
if tcodes != sk_codes: warn(f'topic codes differ from skeleton: {tcodes} vs {sk_codes}')
ek_by_topic = {t['code']: {e['code'] for e in t.get('ek', [])} for t in sk.get('topics', [])}
all_ek = set().union(*ek_by_topic.values()) if ek_by_topic else set()
for t in topics:
    for k in ('c','t','s'):
        if not t.get(k): err(f'topic {t.get("c")} missing {k}')
    if t.get('s') and skills and t['s'] not in skills: warn(f'topic {t["c"]} skill {t["s"]} not in skill list')
for x in out.get('excl') or []:
    if not isinstance(x, dict) or not x.get('s'): err(f'bad excl entry {x}')
if not out.get('check'): warn('no check line')

def norm(q): return re.sub(r'\s+',' ', re.sub(r'[^\w\s]', '', str(q).lower())).strip()
def tex_check(s, where):
    if not isinstance(s, str): return
    if s.count('$') % 2: err(f'{where}: unbalanced $')
    for seg in re.findall(r'\$(.+?)\$', s):
        for cmd in re.findall(r'\\([A-Za-z]+|[,;])', seg):
            if cmd not in TEX_OK: err(f'{where}: tex command \\{cmd} not in subset')
    if re.search(r'\\(text|begin|mathrm|displaystyle|end)\b', s): err(f'{where}: forbidden tex')

cards = out.get('cards') or []
if not cards: err('no cards')
seen = {}
existing_q = {norm(c['q']): c['q'] for c in inp['existing']}
live = json.load(open(f'{ROOT}/data/{course}.json', encoding='utf-8'))
other_q = {norm(c['q']) for c in live['cards'] if c['u'] != unit}
reused = 0
per_topic = collections.Counter(); per_topic_j = collections.Counter()
nj = nd = 0
for i, c in enumerate(cards):
    w = f'card {i} ({str(c.get("q",""))[:50]!r})'
    if not isinstance(c, dict): err(f'{w}: not an object'); continue
    extra = set(c) - CARD_KEYS
    if extra: err(f'{w}: unknown keys {extra}')
    if c.get('t') not in tcodes: err(f'{w}: topic {c.get("t")!r} not in topics')
    if c.get('v') not in VERBS: err(f'{w}: verb {c.get("v")!r}')
    for k in ('q','a'):
        if not isinstance(c.get(k), str) or not c[k].strip(): err(f'{w}: empty {k}')
    if not isinstance(c.get('h'), str) or not c['h'].strip(): warn(f'{w}: no hint')
    if not isinstance(c.get('n'), str) or not c['n'].strip(): err(f'{w}: no note')
    if c.get('c') not in (0,1,True,False): err(f'{w}: c must be 0/1')
    if c.get('x') is not None and not (isinstance(c['x'], list) and all(isinstance(s,str) for s in c['x'])): err(f'{w}: x must be list of strings or null')
    k = c.get('k')
    if not (isinstance(k, list) and k and all(isinstance(s,str) for s in k)): err(f'{w}: k must be a nonempty list')
    else:
        for code in k:
            if all_ek and code not in all_ek: err(f'{w}: EK {code} not in unit skeleton')
            elif c.get('t') in ek_by_topic and ek_by_topic[c['t']] and code not in ek_by_topic[c['t']]: warn(f'{w}: EK {code} belongs to another topic than {c["t"]}')
    if not c.get('s'): err(f'{w}: no skill')
    elif skills and c['s'] not in skills: warn(f'{w}: skill {c["s"]} not in skill list')
    if c.get('b') is not None and (c['b'] not in unit_ids or c['b'] == unit): err(f'{w}: bad borrow {c["b"]}')
    y = c.get('y')
    if y not in (None, 'j', 'd'): err(f'{w}: y must be j or d')
    q, a = str(c.get('q','')), str(c.get('a',''))
    if len(q) > 900: err(f'{w}: q {len(q)} chars')
    elif len(q) > 600 and y != 'd' and '\n' not in q: warn(f'{w}: q {len(q)} chars')
    lim_a = {'j': (320, 420), 'd': (1100, 1400)}.get(y, (480, 600))
    if len(a) > lim_a[1]: err(f'{w}: a {len(a)} chars (limit {lim_a[1]})')
    elif len(a) > lim_a[0]: warn(f'{w}: a {len(a)} chars (aim {lim_a[0]})')
    if isinstance(c.get('h'), str):
        if not c['h'].startswith('→'): warn(f'{w}: hint should start with →')
        if len(c['h']) > (120 if y == 'j' else 60): warn(f'{w}: hint {len(c["h"])} chars')
    if isinstance(c.get('n'), str):
        if len(c['n']) > 260: err(f'{w}: note {len(c["n"])} chars')
        elif len(c['n']) > 180: warn(f'{w}: note {len(c["n"])} chars')
    if y == 'j':
        nj += 1; per_topic_j[c.get('t')] += 1
        o, ww = c.get('o'), c.get('w')
        if not (isinstance(o, list) and 1 <= len(o) <= 3 and all(isinstance(s,str) and s.strip() for s in o)): err(f'{w}: o must hold 1-3 sentences')
        if not (isinstance(ww, list) and 2 <= len(ww) <= 4 and all(isinstance(x,dict) and x.get('a') and x.get('why') for x in ww)): err(f'{w}: w must hold 2-4 {{a,why}} objects')
    else:
        if c.get('o') or c.get('w'): err(f'{w}: o/w only on explain-why cards')
        per_topic[c.get('t')] += 1
        if y == 'd': nd += 1
    for fld in ('q','a','h','n'):
        tex_check(c.get(fld), f'{w}.{fld}')
    for s in (c.get('o') or []): tex_check(s, f'{w}.o')
    for x in (c.get('w') or []):
        if isinstance(x, dict): tex_check(x.get('a'), f'{w}.w'); tex_check(x.get('why'), f'{w}.w')
    nq = norm(q)
    if nq in seen: err(f'{w}: duplicate question of card {seen[nq]}')
    seen[nq] = i
    if nq in other_q: err(f'{w}: same question exists in another unit of the course')
    if nq in existing_q: reused += 1

n_ord = len(cards) - nj
if n_ord < 60: err(f'only {n_ord} ordinary cards (need 80-140)')
elif not 80 <= n_ord <= 140: warn(f'{n_ord} ordinary cards (aim 80-140)')
if nj < 25: err(f'only {nj} explain-why cards (need 40-50)')
elif not 40 <= nj <= 50: warn(f'{nj} explain-why cards (aim 40-50)')
for t in tcodes:
    if per_topic[t] < 6: warn(f'topic {t}: only {per_topic[t]} ordinary cards')
    if per_topic_j[t] == 0: warn(f'topic {t}: no explain-why card')

frq = out.get('frq') or []
if len(frq) != 5: warn(f'{len(frq)} FRQs (aim 5)')
for i, f in enumerate(frq):
    w = f'frq {i} ({str(f.get("title",""))[:40]!r})'
    if f.get('kind') not in KINDS: err(f'{w}: kind {f.get("kind")!r}')
    for k in ('title','stem'):
        if not isinstance(f.get(k), str) or not f[k].strip(): err(f'{w}: empty {k}')
    if not isinstance(f.get('pts'), int) or f['pts'] <= 0: err(f'{w}: pts')
    if f.get('b') is not None and (f['b'] not in unit_ids or f['b'] == unit): err(f'{w}: bad borrow')
    parts, rows = f.get('parts') or [], f.get('rows') or []
    if not parts and not rows: err(f'{w}: no parts and no rows')
    for n, p in enumerate(parts):
        for k in ('l','q','a'):
            if not isinstance(p.get(k), str) or not p[k].strip(): err(f'{w} part {n}: empty {k}')
        if p.get('p') is not None and not isinstance(p['p'], int): err(f'{w} part {n}: p not int')
        for k in ('q','a','n'): tex_check(p.get(k), f'{w} part {n}.{k}')
    for n, r in enumerate(rows):
        if not r.get('r'): err(f'{w} row {n}: no name')
        if not isinstance(r.get('p'), int): err(f'{w} row {n}: p not int')
        for k in ('earns','loses'): tex_check(r.get(k), f'{w} row {n}.{k}')
    psum = sum(p.get('p') or 0 for p in parts)
    rsum = sum(r.get('p') or 0 for r in rows)
    if rows and rsum != f.get('pts'): err(f'{w}: rows sum {rsum} != pts {f.get("pts")}')
    elif not rows and parts and psum != f.get('pts'): err(f'{w}: parts sum {psum} != pts {f.get("pts")}')
    tex_check(f.get('stem'), f'{w}.stem')

if not out.get('notes'): warn('no notes')
dropped = [existing_q[k] for k in existing_q if k not in seen]
print(f'== {course}/{unit}: {n_ord} ordinary ({nd} drills) + {nj} explain-why = {len(cards)} cards · {len(frq)} FRQ · {len(topics)} topics · {len(out.get("excl") or [])} exclusions')
print(f'   reused {reused} of {len(inp["existing"])} existing questions; dropped {len(dropped)}')
print('   per topic:', ' '.join(f'{t}:{per_topic[t]}+{per_topic_j[t]}' for t in tcodes))
if W: print(f'-- {len(W)} warnings'); [print('   W', m) for m in W[:60]]
if E: print(f'-- {len(E)} ERRORS'); [print('   E', m) for m in E[:80]]
print('RESULT', 'FAIL' if E else 'PASS')
sys.exit(1 if E else 0)
