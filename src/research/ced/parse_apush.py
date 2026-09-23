#!/usr/bin/env python3
"""parse_apush.py — apush.skeleton.json from the AP U.S. History CED (Effective Fall 2026) text."""
import re, json, collections, os
CED = os.environ.get('CED_DIR', os.path.dirname(os.path.abspath(__file__)))
raw = open(os.path.join(CED, 'us-history.txt'), encoding='utf-8').read().replace('￾', '-')
raw = re.sub(r'(?<=[A-Za-z])f f(?=[a-z])', 'ff', raw)
P = {int(p.split('>>>', 1)[0]): p.split('>>>', 1)[1] for p in raw.split('<<<PAGE ')[1:]}
TOPIC_RE = re.compile(r'^TOPIC (\d+\.\d+)\s*$')
LO_RE = re.compile(r'^Unit (\d+): Learning Objective ([A-Z]+)\s*$')
KC_RE = re.compile(r'^(KC-\d+\.\d+(?:\.[IVX]+)?(?:\.[A-Z])?(?:\.[ivx]+)?)\s*$')
SK_RE = re.compile(r'^(\d\.[A-Z])\s*$')
STOP = ('SUGGESTED SKILL', 'AVAILABLE RESOURCE', 'LEARNING OBJECTIVE', 'HISTORICAL DEVELOPMENTS', 'THEMATIC FOCUS', 'Required Course Content',
        'Course Framework', 'Return to', '©', 'AP U.S. History Course', 'UNIT', 'TOPIC ', 'KEY CONCEPT', 'OPTIONAL', 'Optional', '§', 'REASONING PROCESS')
def is_stop(l):
    s = l.strip(); return (not s) or any(s.startswith(x) for x in STOP) or re.match(r'^\d+$', s) is not None
def is_code(l):
    s = l.strip(); return bool(TOPIC_RE.match(s) or LO_RE.match(s) or KC_RE.match(s) or SK_RE.match(s))
def join(lines): return re.sub(r'\s+', ' ', ' '.join(x.strip() for x in lines if x.strip())).strip()

FIRST = min(n for n in P if 'UNIT AT A GLANCE' in P[n])
LAST = min([n for n in P if 'Selecting and Using Course Materials' in P[n] and n > FIRST] or [max(P)])
topics = {}; order = []; skills = {}; themes = {}; units = {}
cur = None; target = None; buf = []
def flush():
    global buf, target
    if target is not None and buf:
        t = join(buf)
        if t and t not in target.get('text', ''): target['text'] = (target.get('text', '') + ' ' + t).strip()
    buf = []; target = None
for n in sorted(P):
    if n < FIRST or n >= LAST: continue
    text = P[n]; lines = text.split('\n')
    if re.search(r'OPTIONAL (ACTIVIT|SOURCE)|Optional (Activit|Source)', text[:500]) or 'Using the Unit Guides' in text: continue
    mp = re.search(r'^TOPIC (\d+\.\d+)\s*$', text, re.M)
    if mp:
        flush(); cur = mp.group(1)
        if cur not in topics: topics[cur] = {'code': cur, 'title': '', 'skill': None, 'skill_text': None, 'theme': [], 'lo': [], 'ek': [], 'p': n}; order.append(cur)
    if 'UNIT AT A GLANCE' in text:
        mu = re.search(r'^UNIT\n(\d+)\b', text, re.M); mt = re.search(r'(Period \d+: ?[^\n]+)', text); mw = re.search(r'(\d+–\d+%)\s*AP EXAM WEIGHTING', text)
        if mu and mt and mw:
            u = int(mu.group(1)); units.setdefault(u, {}); units[u]['title'] = re.sub(r'\s+', ' ', mt.group(1)).strip(); units[u]['weight'] = mw.group(1); units[u]['p'] = n
        # reasoning process per topic from the table
        for m in re.finditer(r'(\d+\.\d+) ((?:(?!\d+\.\d+ ).)+?)(Comparison|Causation|Continuity and\s+Change)\s+(\d\.[A-Z]) ', text, re.S):
            units.setdefault(int(m.group(1).split('.')[0]), {}).setdefault('reasoning', {})[m.group(1)] = re.sub(r'\s+', ' ', m.group(3))
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        m = TOPIC_RE.match(s)
        if m:
            flush(); cur = m.group(1)
            if cur not in topics:
                topics[cur] = {'code': cur, 'title': '', 'skill': None, 'skill_text': None, 'theme': [], 'lo': [], 'ek': [], 'p': n}; order.append(cur)
            j = i + 1; tl = []
            while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]) and not (tl and re.match(r'^(The final topic|The first topic|Spend a class|This topic|Students|In this|Each unit)', lines[j].strip())): tl.append(lines[j]); j += 1
            if not topics[cur]['title']: topics[cur]['title'] = re.sub(r'\s*continued on next page\s*', '', join(tl)).strip()
            i = j; continue
        ml = LO_RE.match(s)
        if cur and ml:
            flush(); code = f'LO {ml.group(1)}.{ml.group(2)}'; have = [x for x in topics[cur]['lo'] if x['code'] == code]
            target = have[0] if have else {'code': code, 'text': ''}
            if not have: topics[cur]['lo'].append(target)
            i += 1; continue
        mk = KC_RE.match(s)
        if cur and mk:
            flush(); have = [x for x in topics[cur]['ek'] if x['code'] == mk.group(1)]
            target = have[0] if have else {'code': mk.group(1), 'text': ''}
            if not have: topics[cur]['ek'].append(target)
            i += 1; continue
        if s.startswith('SUGGESTED SKILL'):
            flush(); j = i + 1; cat = []
            while j < len(lines) and not SK_RE.match(lines[j].strip()) and not is_stop(lines[j]): cat.append(lines[j]); j += 1
            if j < len(lines) and SK_RE.match(lines[j].strip()):
                code = lines[j].strip(); j += 1; tl = []
                while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]): tl.append(lines[j]); j += 1
                skills.setdefault(code, {'code': code, 'name': join(tl), 'category': join(cat)})
                if cur and not topics[cur]['skill']: topics[cur]['skill'] = code; topics[cur]['skill_text'] = join(tl)
            i = j; continue
        if s.startswith('THEMATIC FOCUS'):
            flush(); j = i + 1
            if j < len(lines):
                mt = re.match(r'^(.+?)\s+([A-Z]{3})\s*$', lines[j].strip())
                if mt:
                    code = mt.group(2); j += 1; tl = []
                    while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]): tl.append(lines[j]); j += 1
                    themes.setdefault(code, {'code': code, 'name': mt.group(1).strip(), 'text': join(tl)})
                    if cur and code not in topics[cur]['theme']: topics[cur]['theme'].append(code)
            i = j; continue
        if target is not None:
            if is_stop(lines[i]) or is_code(lines[i]): flush()
            else: buf.append(lines[i])
        i += 1
    flush()
# skills table
for m in re.finditer(r'(?m)^(\d\.[A-Z]) ([^\n]+(?:\n(?!\d\.[A-Z] |Bullet|SKILLS)[^\n]+)*)', P[23] if 23 in P else ''):
    skills.setdefault(m.group(1), {'code': m.group(1), 'name': join(m.group(2).split('\n')), 'category': None})
CATS = {'1': 'Developments and Processes', '2': 'Sourcing and Situation', '3': 'Claims and Evidence in Sources', '4': 'Contextualization', '5': 'Making Connections', '6': 'Argumentation'}
for k, v in skills.items(): v['category'] = CATS.get(k[0], v.get('category'))
# progress checks
checks = {}
for m in re.finditer(r'(?=Progress Check Unit (\d+)([\s\S]{0,320}))', raw):
    u = int(m.group(1)); b = m.group(2)
    mc = re.search(r'Multiple-choice:\s*~?(\d+)', b); sa = re.search(r'Short-answer:\s*(\d+)', b); fr = re.search(r'Free-?response:\s*(\d+)', b)
    if mc and sa and fr and u not in checks:
        seen = set(); bullets = []
        for x in re.findall(r'[§•]\s*([^\n]+)', b[:fr.end() + 200]):
            x = x.strip()
            if x and x not in seen: seen.add(x); bullets.append(x)
        checks[u] = f'Progress check · {mc.group(1)} multiple choice · {sa.group(1)} short answer · {fr.group(1)} free response' + (' (' + ', '.join(bullets) + ')' if bullets else '')
# exam and rubrics
e0 = [n for n in sorted(P) if P[n].lstrip().startswith('Exam Overview')][0]
exam_raw = '\n'.join(P[k] for k in range(e0, e0 + 5))
rub = [n for n in sorted(P) if n > e0 and ('Rubric' in P[n] or 'Reporting Category' in P[n])]
rub_raw = '\n'.join(P[k] for k in rub[:8])
reason = [n for n in sorted(P) if n < FIRST and 'Reasoning Processes' in P[n] and 'Comparison' in P[n]]
reason_raw = '\n'.join(P[k] for k in reason[:2])
note_opt = 'Optional Sources pages offer examples of sources appropriate for a college-level course. None of the AP Exam questions require students to have studied these specific sources.'
out = {'course': 'apush', 'edition': 'AP United States History Course and Exam Description, Effective Fall 2026',
       'exam': {'format': re.sub(r'\n{2,}', '\n', exam_raw).strip(), 'rubrics': re.sub(r'\n{2,}', '\n', rub_raw).strip(), 'reasoning': re.sub(r'\n{2,}', '\n', reason_raw).strip(), 'verified': 'ced'},
       'skills': [skills[k] for k in sorted(skills)] + [{'code': t, 'name': themes[t]['name'], 'category': 'Theme', 'text': themes[t]['text']} for t in sorted(themes)],
       'units': []}
for u in range(1, 10):
    ui = units.get(u, {}); ts = [topics[c] for c in order if int(c.split('.')[0]) == u]
    for t in ts: t['reasoning'] = ui.get('reasoning', {}).get(t['code'])
    out['units'].append({'id': f'u{u}', 'n': u, 'title': ui.get('title'), 'weight': ui.get('weight'), 'check': checks.get(u),
        'topics': [{**t, 'verified': 'ced'} for t in ts],
        'excl': [{'text': note_opt, 'topic': None, 'verified': 'ced'}], 'borrow': [], 'notes': ''})
json.dump(out, open(os.path.join(CED, 'apush.skeleton.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out['edition'], '· skills', len(skills), '· themes', sorted(themes))
for U in out['units']:
    print(f"\nU{U['n']} {U['title']!r} {U['weight']} · {U['check']} · {len(U['topics'])} topics · {sum(len(t['lo']) for t in U['topics'])} LO · {sum(len(t['ek']) for t in U['topics'])} KC")
    for t in U['topics']:
        print(f"   {t['code']:5} {t['title'][:52]:52} {t['skill'] or '?':4} {','.join(t['theme']):8} {t['reasoning'] or '':22} LO{len(t['lo'])} KC{len(t['ek'])} p{t['p']}" + ('' if t['lo'] else ' NO-LO'))
