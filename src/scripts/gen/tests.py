#!/usr/bin/env python3
"""tests.py check <course> <unit> [src]   — checks out/test-<course>-<unit>.json (or src) against SPEC-test.md
   tests.py check psat <id> [src]         — a PSAT test (SPEC-psat.md): ids craft info conv expr rw1 rw2 rw3 m1 m2
   tests.py build <course>                — writes data/tests/<course>.json from every out/test-<course>-*.json that
                                            passes, and lists each unit's tests (units[].tests) in data/<course>.json
   tests.py stats                         — one line per test on disk

A test is {"course","unit","minutes","calc"?,"intro"?,"mc":[{"stem","calc"?,"parts":[Q]}],"fr":[FR]}; see SPEC-test.md."""
import json, sys, os, re, math, collections, hashlib, glob
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
sys.path.insert(0, G)

TEX_OK = set('Bigl Bigr Delta Gamma Lambda Omega Phi Pi Rightarrow Sigma Theta alpha approx arcsin arctan ast beta bigl bigr cap cdot cdots chi circ cos cot csc cup deg degree delta dfrac displaystyle div dots ell emptyset epsilon equiv eta exists forall frac gamma ge geq gg iff implies in inf infty int kappa lambda ldots le left leftarrow leftrightarrow leq lim limits ll ln log longrightarrow mapsto mathit mathrm max min mp mu nabla ne neq notin nu omega operatorname partial phi pi pm prime propto psi rho right rightarrow rightleftharpoons sec sigma sim sin sqrt subset subseteq sum sup tan tau text tfrac therefore theta times to varepsilon varphi vdots xi zeta'.split()) | {',', ';'}
LV = {'apply', 'analyze', 'evaluate'}
TY = {'claim', 'error', 'design', 'predict', 'data', 'transfer', 'synthesis', 'compare', 'counter', 'source',
      'context', 'cause', 'purpose', 'revise', 'infer', 'except'}
MC_N = {'chem': (25, 25), 'calcbc': (24, 24), 'apush': (25, 25), 'lang': (25, 25), 'french': (25, 25)}
WEIGHTS = {'chem': (.5, .5), 'calcbc': (.5, .5), 'apush': (.5, .5), 'lang': (.45, .55), 'french': (.5, .5)}
STEM_ONLY = {'apush', 'lang', 'french'}      # every question sits in a stimulus set
BANNED = re.compile(r'all of the above|none of the above|both \(?[A-D]\)? and \(?[A-D]\)?|tous les précédents|aucune de ces réponses|toutes ces réponses', re.I)
FR_WORDS = re.compile(r'justif|explain why|explain how|agree|claim|evaluat|student|argue|support your|reasoning|critique|design|predict|'
                      r'à votre avis|expliquez|pourquoi|argument|défend', re.I)


def tex_check(s, where, E):
    if not isinstance(s, str): return
    if s.count('$') % 2 and re.search(r'[\\^_]', s): E.append(f'{where}: unbalanced $')
    for seg in re.findall(r'\$(.+?)\$', s):
        for cmd in re.findall(r'\\([A-Za-z]+|[,;])', seg):
            if cmd not in TEX_OK: E.append(f'{where}: tex command \\{cmd} not in subset')
    if re.search(r'\\(text|begin|mathrm|displaystyle|end)\b', s): E.append(f'{where}: forbidden tex')


def parse_q(q, french):
    lines = q.split('\n'); stem, ch = [], []
    for l in lines:
        m = re.match(r'^\(([A-E])\) (\S.*)$', l) if not french else (re.match(r'^([A-E])\. (\S.*)$', l) or re.match(r'^\(([A-E])\) (\S.*)$', l))
        if m and m.group(1) == 'ABCDE'[len(ch)]: ch.append([m.group(1), m.group(2)])
        elif ch: ch[-1][1] += ' ' + l
        else: stem.append(l)
    return '\n'.join(stem).strip(), ch


def key_of(a, french):
    m = re.match(r'^\(([A-D])\)\. \S', a) or (re.match(r'^([A-D])\. \S', a) if french else None)
    return m.group(1) if m else None


def course_meta(course):
    d = json.load(open(f'{ROOT}/data/{course}.json', encoding='utf-8'))
    topics = {}
    for u in d['units']:
        for t in u.get('topics') or []: topics[t['c']] = u['id']
    return d, topics, {s['code'] for s in d.get('skills') or []}


def check(course, unit, src=None, quiet=False):
    E, W = [], []
    path = src or f'{G}/out/test-{course}-{unit}.json'
    if not os.path.exists(path): return [f'no file {path}'], [], None
    try: t = json.load(open(path, encoding='utf-8'))
    except Exception as x: return [f'bad JSON: {x}'], [], None
    d, topics, skills = course_meta(course)
    units = {u['id']: u for u in d['units']}
    if unit not in units: E.append(f'no unit {unit} in {course}')
    u = units.get(unit) or {}
    french = course == 'french'
    if t.get('course') != course or t.get('unit') != unit: E.append('course/unit fields do not match the file name')
    if not isinstance(t.get('minutes'), int) or not 60 <= t['minutes'] <= 110: E.append(f'minutes {t.get("minutes")} (want 75 to 100)')
    if t.get('intro') and len(t['intro']) > 240: E.append('intro longer than 240 characters')
    groups = t.get('mc') or []
    qs = []
    for gi, g in enumerate(groups):
        w = f'group {gi + 1}'
        stem = g.get('stem') or ''
        parts = g.get('parts') or []
        tex_check(stem, f'{w}.stem', E)
        if stem:
            if len(stem) < 150: E.append(f'{w}: stem too short to be a stimulus ({len(stem)})')
            if not 2 <= len(parts) <= 8: E.append(f'{w}: {len(parts)} questions on one stimulus (want 2 to 6; 8 for a Lang passage)')
            if course == 'lang' and len(stem) < 1200 and not all(p.get('ty') == 'revise' for p in parts):
                W.append(f'{w}: a Lang reading passage of {len(stem)} characters is short (want 350 to 700 words)')
        else:
            if course in STEM_ONLY: E.append(f'{w}: every {course} question belongs to a stimulus set')
            if len(parts) != 1: E.append(f'{w}: a standalone group has exactly one question')
        if course == 'calcbc' and not isinstance(g.get('calc'), bool): E.append(f'{w}: Calculus groups say "calc": true or false')
        for p in parts: qs.append((g, p))
    lo, hi = MC_N[course]
    if not lo <= len(qs) <= hi: E.append(f'{len(qs)} multiple-choice questions (want {lo}' + (f' to {hi}' if hi != lo else '') + ')')
    if course == 'calcbc':
        flags = [g.get('calc') for g, p in qs]
        first = flags.index(True) if True in flags else len(flags)
        if any(flags[first:]) and not all(flags[first:]): E.append('Calculus: every calculator question comes after the last no-calculator one')
        if not 6 <= len(flags) - first <= 10: E.append(f'Calculus: {len(flags) - first} calculator questions (want 8)')
    keys, lvs, tys, tps, longest = [], collections.Counter(), collections.Counter(), collections.Counter(), 0
    for i, (g, p) in enumerate(qs):
        w = f'Q{i + 1}'
        if str(p.get('l')) != str(i + 1): E.append(f'{w}: label is {p.get("l")!r}, want "{i + 1}" (numbered through the test)')
        if p.get('p') != 1: E.append(f'{w}: a multiple-choice question is worth 1 point')
        q, a, n = p.get('q') or '', p.get('a') or '', p.get('n') or ''
        body, ch = parse_q(q, french)
        if [c[0] for c in ch] != ['A', 'B', 'C', 'D']: E.append(f'{w}: choices must be lines ' + ('A. to D.' if french else '(A) to (D)') + f', found {[c[0] for c in ch]}')
        if not body: E.append(f'{w}: no question text before the choices')
        if not (g.get('stem') or '') and len(body) < 100: E.append(f'{w}: a standalone question carries its own scenario (at least 100 characters; has {len(body)})')
        for c in ch:
            if BANNED.search(c[1]): E.append(f'{w}: choice {c[0]} uses an all/none/both-of-the-above form')
        k = key_of(a, french)
        if not k: E.append(f'{w}: answer must open "(X). " ' + ('or "X. " ' if french else '') + 'and explain')
        else:
            keys.append(k)
            rest = a[4 if a.startswith('(') else 3:]
            for L in 'ABCD':
                if L == k: continue
                if not re.search(r'(\(' + L + r'\)|\b' + L + r'\b)', rest): E.append(f'{w}: the explanation never says why {L} is wrong')
            if len(ch) == 4:
                lens = {c[0]: len(c[1]) for c in ch}
                if lens[k] > max(v for L, v in lens.items() if L != k): longest += 1
        if len(a) < 160: E.append(f'{w}: explanation too short ({len(a)}) to show the reasoning and every trap')
        if len(n) < 40: E.append(f'{w}: note too short')
        if 'Thinking:' not in n and 'Réflexion' not in n: W.append(f'{w}: note has no "Thinking:" clause')
        if p.get('lv') not in LV: E.append(f'{w}: lv {p.get("lv")!r} (want apply, analyze or evaluate)')
        else: lvs[p['lv']] += 1
        if p.get('ty') not in TY: E.append(f'{w}: ty {p.get("ty")!r} not an item type')
        else: tys[p['ty']] += 1
        if p.get('t') not in topics: E.append(f'{w}: t {p.get("t")!r} is not a topic code of {course}')
        else: tps[p['t']] += 1
        if unit != 'x' and p.get('t') in topics and topics[p['t']] != unit: E.append(f'{w}: t {p["t"]} belongs to unit {topics[p["t"]]}, not {unit}')
        if unit == 'x' and str(p.get('t', '')).startswith('X'): E.append(f'{w}: a cumulative question is tagged with the unit it draws on, not {p["t"]}')
        if p.get('s') not in skills: E.append(f'{w}: s {p.get("s")!r} not a skill code of {course}')
        for s, f in ((q, 'q'), (a, 'a'), (n, 'n')): tex_check(s, f'{w}.{f}', E)
    N = len(qs) or 1
    if lvs['evaluate'] / N < .25: E.append(f'evaluate is {lvs["evaluate"]} of {N} questions (want at least 25%)')
    if (lvs['analyze'] + lvs['evaluate']) / N < .6: E.append(f'analyze + evaluate is {lvs["analyze"] + lvs["evaluate"]} of {N} (want at least 60%)')
    if len(tys) < 6: E.append(f'{len(tys)} item types (want at least 6): {dict(tys)}')
    for ty, c in tys.items():
        if c / N > .4: E.append(f'item type {ty} is {c} of {N} (want at most 40%)')
    if tys['except'] > 2: E.append(f'{tys["except"]} NOT/LEAST questions (want at most 2)')
    kc = collections.Counter(keys)
    for L in 'ABCD':
        if not math.floor(.16 * N) <= kc[L] <= math.ceil(.34 * N): E.append(f'key {L} is the answer {kc[L]} times of {N} (want 16% to 34%)')
    if longest / N > .35: E.append(f'the key is the strictly longest choice in {longest} of {N} questions (want at most 35%)')
    elif longest / N > .3: W.append(f'the key is the strictly longest choice in {longest} of {N}')
    # coverage
    if unit == 'x':
        us = {topics[c] for c in tps}
        need = {'chem': 6, 'calcbc': 6, 'apush': 6, 'lang': 4, 'french': 5}[course]
        if len(us) < need: E.append(f'cumulative test draws on {len(us)} units {sorted(us)} (want at least {need})')
    else:
        ut = [x['c'] for x in u.get('topics') or []]
        need = min(len(ut), max(3, math.ceil(.6 * len(ut))))
        if len(tps) < need: E.append(f'multiple choice covers {len(tps)} of the unit\'s {len(ut)} topics (want at least {need})')
    # free response
    fr = t.get('fr') or []
    kinds = collections.Counter(f.get('kind') for f in fr)
    want = {'chem': {'long': 1, 'short': 2}, 'calcbc': {'long': 3}, 'apush': {'saq': 2, 'leq': 1},
            'french': {'email': 1, 'essay': 1}}.get(course)
    if course == 'lang':
        ess = sum(kinds[k] for k in ('rhetorical', 'argument', 'synthesis'))
        if ess != 1 or kinds['short'] != 2 or len(fr) != 3: E.append(f'Lang free response wants 1 essay and 2 short, found {dict(kinds)}')
    elif course == 'french':
        if len(fr) != 2 or kinds['essay'] != 1 or kinds['qa'] + kinds['email'] != 1: E.append(f'French free response wants an essay and a qa (or email), found {dict(kinds)}')
    elif dict(kinds) != want: E.append(f'free response wants {want}, found {dict(kinds)}')
    fr_words = 0
    titles = set()
    for fi, f in enumerate(fr):
        w = f'FR{fi + 1}'
        if not f.get('title'): E.append(f'{w}: no title')
        if f.get('title') in titles: E.append(f'{w}: duplicate title')
        titles.add(f.get('title'))
        if re.match(r'^(question|frq|free response)\s*\d', f.get('title') or '', re.I): E.append(f'{w}: the title should name the task')
        parts, rows = f.get('parts') or [], f.get('rows') or []
        if not parts and not rows: E.append(f'{w}: no parts or rows')
        tex_check(f.get('stem'), f'{w}.stem', E)
        if not f.get('stem') or len(f['stem']) < 60: E.append(f'{w}: stem too short')
        pts = f.get('pts')
        scored = parts or rows
        tot = sum(x.get('p') or 0 for x in scored)
        if parts and rows:
            # an essay with a model plan: the plan's parts are scored, the rows are the reference
            if sum(r.get('p') or 0 for r in rows) != pts: E.append(f'{w}: rows add to {sum(r.get("p") or 0 for r in rows)}, pts is {pts}')
        if tot != pts: E.append(f'{w}: parts/rows add to {tot}, pts is {pts}')
        for j, x in enumerate(parts):
            pw = f'{w} part {x.get("l")}'
            if not x.get('q') or not x.get('a'): E.append(f'{pw}: needs q and a')
            if not isinstance(x.get('p'), int) or x['p'] < 1: E.append(f'{pw}: p must be a whole number of points')
            if len(x.get('a') or '') < 60: E.append(f'{pw}: model answer too short')
            if not x.get('n'): E.append(f'{pw}: no note on what earns nothing')
            if FR_WORDS.search(x.get('q') or ''): fr_words += 1
            for k in ('q', 'a', 'n'): tex_check(x.get(k), f'{pw}.{k}', E)
        for j, r in enumerate(rows):
            rw = f'{w} row {j + 1}'
            if not r.get('r') or not r.get('earns') or not r.get('loses'): E.append(f'{rw}: needs r, earns, loses')
            for k in ('earns', 'loses'): tex_check(r.get(k), f'{rw}.{k}', E)
        if rows and not parts and FR_WORDS.search(f.get('stem') or ''): fr_words += 1
        if course == 'chem':
            if f.get('kind') == 'long' and not 8 <= (pts or 0) <= 10: E.append(f'{w}: a long question is worth 8 to 10 points')
            if f.get('kind') == 'short' and pts != 4: E.append(f'{w}: a short question is worth 4 points')
        if course == 'calcbc':
            if pts != 9: E.append(f'{w}: worth {pts}, want 9')
            if not isinstance(f.get('calc'), bool): E.append(f'{w}: say "calc": true or false')
            if not 3 <= len(parts) <= 5: E.append(f'{w}: {len(parts)} parts (want 3 to 5)')
        if course == 'apush':
            if f.get('kind') == 'saq' and (pts != 3 or [x.get('p') for x in parts] != [1, 1, 1]): E.append(f'{w}: an SAQ is parts a-c at 1 point each')
            if f.get('kind') == 'leq' and (pts != 6 or [r.get('p') for r in rows] != [1, 1, 2, 2]): E.append(f'{w}: an LEQ has rows 1, 1, 2, 2 = 6')
        if course == 'lang':
            if f.get('kind') in ('rhetorical', 'argument', 'synthesis') and (pts != 6 or [r.get('p') for r in rows] != [1, 4, 1]): E.append(f'{w}: the essay has rows 1, 4, 1 = 6')
            if f.get('kind') == 'short' and pts != 3: E.append(f'{w}: a short response is worth 3 points')
        if course == 'french' and not 4 <= (pts or 0) <= 12: E.append(f'{w}: worth {pts}, want 4 to 12')
    if course == 'calcbc' and sum(1 for f in fr if f.get('calc') is True) != 1: E.append('Calculus: exactly one free-response question is calculator-active')
    if fr and fr_words < len(fr): W.append(f'only {fr_words} free-response parts ask to justify, explain, evaluate or argue')
    summ = {'mc': len(qs), 'fr': len(fr), 'lv': dict(lvs), 'ty': len(tys), 'keys': dict(kc), 'longest': longest,
            'topics': len(tps), 'frpts': sum(f.get('pts') or 0 for f in fr), 'min': t.get('minutes')}
    return E, W, summ


PSAT_UNITS = {'craft': ['WIC', 'TSP', 'CTC'], 'info': ['CID', 'COET', 'COEQ', 'INF'], 'conv': ['BND', 'FSS'],
              'expr': ['TRN', 'SYN'], 'math': ['ALG', 'ADV', 'PSD', 'GEO'], 'plan': ['PLAN', 'DAY']}
PSAT_T = {c: u for u, cs in PSAT_UNITS.items() for c in cs}
RW_ORDER = ['craft', 'info', 'conv', 'expr']
# id -> (unit, questions, minutes, kind)
PSAT_TESTS = {'craft': ('craft', 20, 24, 'rw'), 'info': ('info', 20, 24, 'rw'), 'conv': ('conv', 20, 24, 'rw'),
              'expr': ('expr', 20, 24, 'rw'), 'rw1': ('plan', 27, 32, 'rwmod'), 'rw2': ('plan', 27, 32, 'rwmod'),
              'rw3': ('plan', 27, 32, 'rwmod'), 'm1': ('math', 22, 35, 'math'), 'm2': ('math', 22, 35, 'math')}


def check_psat(tid, src=None):
    E, W = [], []
    path = src or f'{G}/out/test-psat-{tid}.json'
    if not os.path.exists(path): return [f'no file {path}'], [], None
    try: t = json.load(open(path, encoding='utf-8'))
    except Exception as x: return [f'bad JSON: {x}'], [], None
    if tid not in PSAT_TESTS: return [f'unknown PSAT test id {tid}'], [], None
    unit, want_n, want_min, kind = PSAT_TESTS[tid]
    if t.get('course') != 'psat' or t.get('id') != tid or t.get('unit') != unit: E.append(f'course/id/unit must be psat/{tid}/{unit}')
    if t.get('minutes') != want_min: E.append(f'minutes {t.get("minutes")} (want {want_min})')
    if not t.get('title'): E.append('no title')
    if t.get('fr'): E.append('a PSAT test has no free response')
    qs = []
    for gi, g in enumerate(t.get('mc') or []):
        stem, parts = g.get('stem') or '', g.get('parts') or []
        tex_check(stem, f'group {gi + 1}.stem', E)
        if kind != 'math':
            if len(parts) != 1: E.append(f'group {gi + 1}: a Reading and Writing question has its own passage (1 question per group)')
            if len(stem) < 80: E.append(f'group {gi + 1}: passage too short ({len(stem)})')
            if len(stem) > 1500: W.append(f'group {gi + 1}: passage of {len(stem)} characters is long for the PSAT')
        for p in parts: qs.append((g, p))
    if len(qs) != want_n: E.append(f'{len(qs)} questions (want {want_n})')
    keys, tc, dc, longest, spr, seq = [], collections.Counter(), collections.Counter(), 0, 0, []
    for i, (g, p) in enumerate(qs):
        w = f'Q{i + 1}'
        if str(p.get('l')) != str(i + 1): E.append(f'{w}: label is {p.get("l")!r}, want "{i + 1}"')
        if p.get('p') != 1: E.append(f'{w}: worth 1 point')
        q, a, n = p.get('q') or '', p.get('a') or '', p.get('n') or ''
        body, ch = parse_q(q, False)
        tt = p.get('t')
        if tt not in PSAT_T: E.append(f'{w}: t {tt!r} is not a PSAT topic code')
        else:
            tc[tt] += 1; seq.append(PSAT_T[tt])
            if kind in ('rw', 'rwmod') and PSAT_T[tt] == 'math': E.append(f'{w}: a math topic in a Reading and Writing test')
            if kind == 'math' and PSAT_T[tt] != 'math': E.append(f'{w}: a Reading and Writing topic in a math test')
            if kind == 'rw' and PSAT_T[tt] != unit: E.append(f'{w}: topic {tt} is not in unit {unit}')
        if p.get('d') not in ('hard', 'medium'): E.append(f'{w}: d must be hard or medium')
        else: dc[p['d']] += 1
        if not body: E.append(f'{w}: no question text')
        if p.get('x') is not None:
            spr += 1
            if kind != 'math': E.append(f'{w}: only math has student-produced responses')
            if ch: E.append(f'{w}: an SPR question has no choices')
            xs = p.get('x')
            if not isinstance(xs, list) or not xs or not all(isinstance(v, str) and v.strip() for v in xs): E.append(f'{w}: x must list the accepted entries')
            else:
                for v in xs:
                    lim = 6 if v.startswith('-') else 5
                    if len(v) > lim: E.append(f'{w}: accepted entry {v!r} is longer than Bluebook allows ({lim})')
                    if not re.match(r'^-?(\d+|\d*\.\d+|\d+/\d+)$', v): E.append(f'{w}: accepted entry {v!r} is not a number Bluebook takes')
            if len(a) < 80: E.append(f'{w}: worked solution too short')
        else:
            if [c[0] for c in ch] != ['A', 'B', 'C', 'D']: E.append(f'{w}: choices must be lines (A) to (D), found {[c[0] for c in ch]}')
            for c in ch:
                if BANNED.search(c[1]): E.append(f'{w}: choice {c[0]} uses an all/none/both-of-the-above form')
            k = key_of(a, False)
            if not k: E.append(f'{w}: answer must open "(X). " and explain')
            else:
                keys.append(k)
                rest = a[4:]
                for L in 'ABCD':
                    if L != k and not re.search(r'(\(' + L + r'\)|\b' + L + r'\b)', rest): E.append(f'{w}: the explanation never says why {L} is wrong')
                if len(ch) == 4:
                    lens = {c[0]: len(c[1]) for c in ch}
                    if lens[k] > max(v for L, v in lens.items() if L != k): longest += 1
            if len(a) < 140: E.append(f'{w}: explanation too short ({len(a)}) to show the reasoning and every trap')
        if len(n) < 40 or 'Trap' not in n: E.append(f'{w}: note needs the type, the rule or move, and "Trap:"')
        for s_, f_ in ((q, 'q'), (a, 'a'), (n, 'n')): tex_check(s_, f'{w}.{f_}', E)
    N = len(qs) or 1
    if kind == 'rwmod':
        order = [RW_ORDER.index(u_) for u_ in seq if u_ in RW_ORDER]
        if order != sorted(order): E.append('a module runs Craft and Structure, Information and Ideas, Conventions, then Expression of Ideas')
        dom = collections.Counter(seq)
        for u_, lo_, hi_ in (('craft', 6, 9), ('info', 6, 9), ('conv', 6, 9), ('expr', 4, 7)):
            if not lo_ <= dom[u_] <= hi_: E.append(f'{u_} has {dom[u_]} questions in a 27-question module (want {lo_} to {hi_})')
        if tc['COEQ'] < 1 or tc['CTC'] < 1 or tc['SYN'] < 2: E.append('a module has at least one quantitative evidence, one cross-text and two rhetorical synthesis questions')
    if kind == 'rw':
        for c_ in PSAT_UNITS[unit]:
            if tc[c_] < 3: E.append(f'{c_} has {tc[c_]} questions (want at least 3)')
    if kind == 'math':
        if not 4 <= spr <= 7: E.append(f'{spr} student-produced responses (want 4 to 7)')
        for c_, lo_ in (('ALG', 5), ('ADV', 5), ('PSD', 3), ('GEO', 2)):
            if tc[c_] < lo_: E.append(f'{c_} has {tc[c_]} questions (want at least {lo_})')
    hard_share = dc['hard'] / N
    if hard_share < (.6 if kind == 'math' else .7): E.append(f'{dc["hard"]} of {N} are hard (want at least {"60" if kind == "math" else "70"}%)')
    M = len(keys) or 1
    kc = collections.Counter(keys)
    for L in 'ABCD':
        if not math.floor(.16 * M) <= kc[L] <= math.ceil(.34 * M): E.append(f'key {L} is the answer {kc[L]} times of {M} (want 16% to 34%)')
    if longest / M > .35: E.append(f'the key is the strictly longest choice in {longest} of {M} (want at most 35%)')
    summ = {'mc': len(qs), 'fr': 0, 'lv': dict(dc), 'ty': len(tc), 'keys': dict(kc), 'longest': longest, 'topics': len(tc),
            'frpts': 0, 'min': t.get('minutes'), 'spr': spr}
    return E, W, summ


def cmd_check(course, unit, src=None):
    E, W, s = check_psat(unit, src) if course == 'psat' else check(course, unit, src)
    if s: print(f'== test/{course}/{unit}: {s["mc"]} MC ({s["lv"]}, {s["ty"]} types, keys {s["keys"]}, longest-is-key {s["longest"]}, {s["topics"]} topics) · {s["fr"]} FR ({s["frpts"]} pts) · {s["min"]} min')
    for x in W: print('   W', x)
    for x in E: print('   E', x)
    print('RESULT', 'FAIL' if E else 'PASS')
    return not E


def cmd_build(course):
    d = json.load(open(f'{ROOT}/data/{course}.json', encoding='utf-8'))
    files = sorted(glob.glob(f'{G}/out/test-{course}-*.json'))
    tests = {}
    for p in files:
        tid = os.path.basename(p)[len(f'test-{course}-'):-5]
        E, W, s = check_psat(tid) if course == 'psat' else check(course, tid)
        if E: print(f'{course}/{tid}: FAIL, skipped ({len(E)} errors)'); continue
        # a test ships only once an independent verifier has finished it
        if not glob.glob(f'{G}/out/patch-verify-{course}-*-{tid}.done'):
            print(f'{course}/{tid}: not verified yet, skipped'); continue
        t = json.load(open(p, encoding='utf-8'))
        t.pop('course', None); t.setdefault('unit', tid); t.pop('id', None)
        tests[tid] = t
    wm, wf = WEIGHTS.get(course, (1, 0))
    out = {'course': course, 'w': {'mc': wm, 'fr': wf}, 'tests': tests}
    os.makedirs(f'{ROOT}/data/tests', exist_ok=True)
    raw = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    tp = f'{ROOT}/data/tests/{course}.json'
    if tests: open(tp, 'w', encoding='utf-8').write(raw)
    elif os.path.exists(tp): os.remove(tp)
    ver = hashlib.sha1(raw.encode('utf-8')).hexdigest()[:8]
    order = list(PSAT_TESTS) if course == 'psat' else None
    for u in d['units']:
        u.pop('test', None)
        mine = [k for k, t in tests.items() if t['unit'] == u['id']]
        if order: mine.sort(key=lambda k: order.index(k) if k in order else 99)
        if mine:
            u['tests'] = [{'id': k, 'title': tests[k].get('title') or '', 'mc': sum(len(g['parts']) for g in tests[k]['mc']),
                           'fr': len(tests[k].get('fr') or []), 'min': tests[k]['minutes'],
                           'calc': bool(tests[k].get('calc')) or any(g.get('calc') for g in tests[k]['mc'])} for k in mine]
        else: u.pop('tests', None)
    if tests: d['testsV'] = ver
    else: d.pop('testsV', None)
    json.dump(d, open(f'{ROOT}/data/{course}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    import subprocess
    print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
    print(f'{course}: {len(tests)} tests built, {len(raw) // 1024} KB, version {ver}')


def cmd_stats():
    for p in sorted(glob.glob(f'{G}/out/test-*-*.json')):
        b = os.path.basename(p)[5:-5]; course, unit = b.split('-', 1)
        E, W, s = check_psat(unit) if course == 'psat' else check(course, unit)
        print(f'{course:7} {unit:4}', 'PASS' if not E else f'FAIL {len(E)}', s and f'{s["mc"]} MC {s["fr"]} FR lv {s["lv"]}' or '')


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'check': sys.exit(0 if cmd_check(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None) else 1)
    elif c == 'build': cmd_build(sys.argv[2])
    elif c == 'stats': cmd_stats()
