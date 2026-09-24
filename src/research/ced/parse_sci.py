#!/usr/bin/env python3
"""parse_sci.py chem|calcbc — builds <course>.skeleton.json from the CED text (Chemistry 2024 / Calculus 2020 layout)."""
import re, json, sys, os
CED = os.environ.get('CED_DIR', os.path.dirname(os.path.abspath(__file__)))
COURSE = sys.argv[1]
SRC = {'chem': 'chemistry', 'calcbc': 'calculus-ab-and-bc'}[COURSE]
NUNITS = {'chem': 9, 'calcbc': 10}[COURSE]
raw = open(os.path.join(CED, SRC + '.txt'), encoding='utf-8').read().replace('\ufffe', '-')
raw = re.sub(r'(?<=[A-Za-z])f f(?=[a-z])', 'ff', raw)
P = {int(p.split('>>>', 1)[0]): p.split('>>>', 1)[1] for p in raw.split('<<<PAGE ')[1:]}
if COURSE == 'chem':
    LO_RE = re.compile(r'^(\d+\.\d+\.[A-Z])\s*$'); EK_RE = re.compile(r'^(\d+\.\d+\.[A-Z]\.\d+)\s*$'); EU_RE = None
else:
    LO_RE = re.compile(r'^([A-Z]{3}-\d+\.[A-Z])\s*$'); EK_RE = re.compile(r'^([A-Z]{3}-\d+\.[A-Z]\.\d+)\s*$'); EU_RE = re.compile(r'^([A-Z]{3}-\d+)\s*$')
SK_RE = re.compile(r'^(\d\.[A-Z])\s*$')
# A skill-category label can share the heading line ("Justification TOPIC 4.7").
TOPIC_RE = re.compile(r'^(?:[A-Z][A-Za-z]+(?: [A-Za-z]+)* )?TOPIC (\d+\.\d+)\s*$')
STOP = ('SUGGESTED SKILL', 'AVAILABLE RESOURCE', 'Course Framework', 'Return to', 'RETURN TO', 'return to', '©', 'You can find', '§',
        'LEARNING OBJECTIVE', 'ESSENTIAL KNOWLEDGE', 'ENDURING UNDERSTANDING', 'Required Course Content', 'TOPIC ', 'UNIT',
        'AP Chemistry Course', 'AP Calculus AB and BC', 'EXCLUSION STATEMENT', 'X EXCLUSION', 'Exclusion Statement', 'Unit at a glance', 'UNIT AT A GLANCE')
def is_stop(l):
    s = l.strip()
    return (not s) or any(s.startswith(x) for x in STOP) or re.match(r'^\d+$', s) is not None
def is_code(l):
    s = re.sub(r'\s+(?=\.\d+$)', '', l.strip())
    return bool(LO_RE.match(s) or EK_RE.match(s) or SK_RE.match(s) or (EU_RE and EU_RE.match(s)) or TOPIC_RE.match(s))
def join(lines):
    t = ' '.join(x.strip() for x in lines if x.strip())
    t = re.sub(r'\s+', ' ', t).replace(' ,', ',').strip()
    return t

topics = {}; order = []; skills = {}; excl = []; units = {}
cur = None            # current topic code
mode = None; buf = []; target = None
def flush():
    global buf, target, mode
    if target is not None and buf:
        t = join(buf)
        if t and t not in target.get('text', ''): target['text'] = (target.get('text', '') + ' ' + t).strip()
    buf = []; target = None; mode = None

FIRST = min(n for n in P if re.search(r'^UNIT\n1\b', P[n], re.M) and 'UNIT AT A GLANCE' in P[n] and 'Using the Unit Guides' not in P[n] and 'TOPIC PAGES' not in P[n])
FIRST -= 1   # the unit opener sits one page before its table
LAST = max(n for n in P if re.search(r'^TOPIC \d+\.\d+', P[n], re.M)) + 2
for n in sorted(P):
    text = P[n]
    lines = text.split('\n')
    if n < FIRST or n >= LAST: continue
    if 'Using the Unit Guides' in text or 'TOPIC PAGES' in text: continue
    mt = re.search(TOPIC_RE.pattern, text, re.M)
    if mt:
        nz = [l.strip() for l in lines if l.strip()]
        if 'UNIT' in nz[:4]:
            tt = ' '.join(nz[:nz.index('UNIT')])
            if tt and len(tt) < 90 and not tt.startswith('AP '): units.setdefault(int(mt.group(1).split('.')[0]), {}).setdefault('titles', []).append(tt)
        flush(); cur = mt.group(1)
        if cur not in topics:
            topics[cur] = {'code': cur, 'title': '', 'skill': None, 'skill_text': None, 'lo': [], 'ek': [], 'bc': False, 'p': n}; order.append(cur)
    # unit opener: weighting + intro
    mu = re.search(r'^UNIT\n(\d+)\b', text, re.M)
    if mu and 'AP EXAM WEIGHTING' in text:
        u = int(mu.group(1))
        if COURSE == 'chem':
            mw = re.search(r'(\d+–\d+%)\s*\n?\s*AP EXAM WEIGHTING', text)
        else:
            mw = re.search(r'~?(\d+–\d+%)\s*BC\s*\n?\s*AP EXAM WEIGHTING', text)
        if units.get(u, {}).get('weight'): mw = None
        mi = re.search(r'Developing Understanding\s*\n([\s\S]*?)(?=\n(?:Building the|Building Course|Preparing for|UNIT|Course Framework|AP Calculus)|\Z)', text)
        if mw: units.setdefault(u, {})['weight'] = mw.group(1)
        if mi and not units.setdefault(u, {}).get('intro'): units[u]['intro'] = join(mi.group(1).split('\n'))[:900]; units[u]['p'] = n
    i = 0
    while i < len(lines):
        l = lines[i]; s = re.sub(r'\s+(?=\.\d+$)', '', l.strip())
        m = TOPIC_RE.match(s)
        if m:
            flush(); cur = m.group(1)
            if cur not in topics:
                topics[cur] = {'code': cur, 'title': '', 'skill': None, 'skill_text': None, 'lo': [], 'ek': [], 'bc': False, 'p': n}; order.append(cur)
            j = i + 1; tl = []
            while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]) and not lines[j].strip().lower() == 'bc only' and not (tl and re.match(r'^(For |This topic|§|Students |The |In this)', lines[j].strip())):
                tl.append(lines[j]); j += 1
            if not topics[cur]['title']:
                tt = re.sub(r'\s*continued on next page\s*', '', join(tl)).strip()
                if re.search(r'\bbc only\s*$', tt, re.I): topics[cur]['bc'] = True; tt = re.sub(r'\s*bc only\s*$', '', tt, flags=re.I)
                topics[cur]['title'] = tt
            if j < len(lines) and lines[j].strip().startswith('This topic'):
                nl = []
                while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]): nl.append(lines[j]); j += 1
                topics[cur]['note'] = join(nl)
            i = j; continue
        if s.lower() == 'bc only':
            if target is not None: target['bc'] = True
            elif cur: topics[cur]['bc'] = True
            i += 1; continue
        m2 = cur and re.match(r'^(\S+) (\S+)$', s)
        if m2 and LO_RE.match(m2.group(1)) and EK_RE.match(m2.group(2)):
            flush(); lo = {'code': m2.group(1), 'text': ''}; ek = {'code': m2.group(2), 'text': '', 'split': True}
            topics[cur]['lo'].append(lo); topics[cur]['ek'].append(ek); j = i + 1; tl = []
            while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]):
                tl.append(lines[j]); j += 1
                if lines[j-1].rstrip().endswith('.') and not lo['text']: lo['text'] = join(tl); tl = []
            if not lo['text']: lo['text'] = join(tl); tl = []
            ek['text'] = join(tl); i = j; continue
        if cur and LO_RE.match(s):
            flush(); have = [x for x in topics[cur]['lo'] if x['code'] == s]
            target = have[0] if have else {'code': s, 'text': ''}
            if not have: topics[cur]['lo'].append(target)
            mode = 'lo'; i += 1; continue
        if cur and EK_RE.match(s):
            flush(); have = [x for x in topics[cur]['ek'] if x['code'] == s]
            target = have[0] if have else {'code': s, 'text': ''}
            if not have: topics[cur]['ek'].append(target)
            mode = 'ek'; i += 1; continue
        if s.startswith('SUGGESTED SKILL'):
            flush(); j = i + 1; cat = []
            while j < len(lines) and not SK_RE.match(lines[j].strip()) and not is_stop(lines[j]): cat.append(lines[j]); j += 1
            if j < len(lines) and SK_RE.match(lines[j].strip()):
                code = lines[j].strip(); j += 1; tl = []
                while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]): tl.append(lines[j]); j += 1
                skills.setdefault(code, {'code': code, 'name': join(tl), 'practice': join(cat)})
                if cur and not topics[cur]['skill']: topics[cur]['skill'] = code; topics[cur]['skill_text'] = join(tl)
            i = j; continue
        if s.startswith('Exclusion Statement') or s.startswith('X EXCLUSION STATEMENT') or s.startswith('EXCLUSION STATEMENT'):
            flush(); tl = [re.sub(r'^(X\s+)?E(XCLUSION|xclusion) S(TATEMENT|tatement):?\s*', '', s)]; j = i + 1
            while j < len(lines) and not is_stop(lines[j]) and not is_code(lines[j]) and lines[j].strip().lower() != 'bc only': tl.append(lines[j]); j += 1
            excl.append({'text': join(tl), 'topic': cur, 'p': n, 'verified': 'ced'}); i = j; continue
        if target is not None:
            if is_stop(l) or is_code(l): flush()
            else: buf.append(l)
        i += 1
    flush()

# progress checks from the course-at-a-glance pages
checks = {}
for n in sorted(P):
    for m in re.finditer(r'(?=(?:Personal )?Progress Check (\d+)([\s\S]{0,260}))', P[n]):
        u = int(m.group(1)); blk = m.group(2)
        mc = re.search(r'Multiple-choice:\s*~?(?:Tilde)?\s*(\d+)', blk); fr = re.search(r'Free-response:\s*(\d+)', blk)
        if mc and fr and u not in checks:
            kinds = re.findall(r'\b(Short|Long)\b', blk[:fr.end() + 80])
            checks[u] = 'Progress check · ' + mc.group(1) + ' multiple choice · ' + fr.group(1) + ' free response' + (' (' + ', '.join(k.lower() for k in kinds) + ')' if kinds else '')
# practice names
practices = {}
for m in re.finditer(r'Practice (\d): ([A-Z][A-Za-z ,&]+?) \d+–\d+%', raw):
    practices.setdefault(m.group(1), m.group(2).strip())
if not practices:
    for m in re.finditer(r'Practice (\d)\s*\n([A-Z][A-Za-z ,&]+?)\s*\n', raw):
        practices.setdefault(m.group(1), m.group(2).strip())
for code, sk in skills.items():
    sk['practice'] = practices.get(code[0], sk.get('practice'))
# skills never suggested on a topic page: pull from the practices tables
for m in re.finditer(r'(?m)^(\d\.[A-Z])\s+([^\n]+(?:\n(?![\d]\.[A-Z]\s|Practice|[A-Z ]{6,}$)[^\n]+){0,4})', raw):
    code = m.group(1)
    if code not in skills:
        t = join(m.group(2).split('\n'))
        if 20 < len(t) < 400: skills[code] = {'code': code, 'name': t, 'practice': practices.get(code[0])}
# exam pages
exam_pages = [n for n in sorted(P) if P[n].lstrip().startswith('Exam Overview')]
exam_raw = ''
if exam_pages:
    e0 = exam_pages[0]; exam_raw = '\n'.join(P[k] for k in range(e0, e0 + 4))
tv = [n for n in sorted(P) if 'Task Verbs' in P[n][:200]]
task_verbs = '\n'.join(P[k] for k in tv[:2])
edition = re.search(r'Effective\s*\n?\s*Fall\s*(\d{4})', raw[:20000])
edition = f'AP {"Chemistry" if COURSE=="chem" else "Calculus AB and BC"} Course and Exam Description, Effective Fall {edition.group(1) if edition else "?"}'
if COURSE == 'calcbc': edition += ', with the Clarifications and Corrections to be implemented for Fall 2026'

out = {'course': COURSE, 'edition': edition, 'exam': {'format': re.sub(r'\n{2,}', '\n', exam_raw).strip(), 'task_verbs': re.sub(r'\n{2,}', '\n', task_verbs).strip(), 'verified': 'ced'},
       'skills': [skills[k] for k in sorted(skills)], 'units': []}
for u in range(1, NUNITS + 1):
    ui = units.get(u, {})
    ts = [topics[c] for c in order if int(c.split('.')[0]) == u]
    import collections
    title = collections.Counter(ui.get('titles', [])).most_common(1)
    if COURSE == 'calcbc' and u == 9: title = [('Parametric Equations, Polar Coordinates, and Vector-Valued Functions', 1)]
    if COURSE == 'calcbc' and u >= 9:
        for t in ts: t['bc'] = True
    out['units'].append({'id': f'u{u}', 'n': u, 'title': title[0][0] if title else None, 'weight': ui.get('weight'), 'check': checks.get(u), 'intro': ui.get('intro', ''),
        'topics': [{**t, 'verified': 'ced'} for t in ts],
        'excl': [e for e in excl if e['topic'] and int(e['topic'].split('.')[0]) == u],
        'borrow': [], 'notes': ''})
json.dump(out, open(os.path.join(CED, f'{COURSE}.skeleton.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# summary
print(edition); print('skills:', len(out['skills']), 'practices:', practices)
for U in out['units']:
    nlo = sum(len(t['lo']) for t in U['topics']); nek = sum(len(t['ek']) for t in U['topics'])
    print(f"\nU{U['n']} {U['title']!r} {U['weight']} · {U['check']} · {len(U['topics'])} topics · {nlo} LO · {nek} EK · {len(U['excl'])} excl")
    for t in U['topics']:
        flag = ' [BC]' if t['bc'] or any(x.get('bc') for x in t['lo'] + t['ek']) else ''
        miss = ' NO-SKILL' if not t['skill'] else ''; nolo = ' NO-LO' if not t['lo'] else ''; noek = ' NO-EK' if not t['ek'] else ''
        print(f"   {t['code']:6} {t['title'][:58]:58} {t['skill'] or '?':4} LO{len(t['lo'])} EK{len(t['ek'])} p{t['p']}{flag}{miss}{nolo}{noek}")
