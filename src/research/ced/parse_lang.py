#!/usr/bin/env python3
"""parse_lang.py — lang.skeleton.json from the AP English Language and Composition CED (Effective Fall 2024) text."""
import re, json, collections, os
CED = os.environ.get('CED_DIR', os.path.dirname(os.path.abspath(__file__)))
raw = open(os.path.join(CED, 'english-language-and-composition.txt'), encoding='utf-8').read().replace('￾', '-').replace('﻿', '')
raw = re.sub(r'(?<=[A-Za-z])f f(?=[a-z])', 'ff', raw)
P = {int(p.split('>>>', 1)[0]): p.split('>>>', 1)[1] for p in raw.split('<<<PAGE ')[1:]}
EU_RE = re.compile(r'^([A-Z]{3}-\d)\s*$'); EK_RE = re.compile(r'^([A-Z]{3}-\d\.[A-Z])\s*$'); SK_RE = re.compile(r'^(\d\.[A-Z])\s*$')
STOP = ('~', 'UNIT OVERVIEW', 'Return to', '©', 'Course Framework', 'AP English', 'continued on next page', 'INSTRUCTIONAL PLANNING', 'Enduring', 'Understanding', 'Skill', 'Essential', 'Knowledge', 'UNIT', 'Unit ')
def is_stop(l):
    s = l.strip(); return (not s) or any(s.startswith(x) for x in STOP) or re.match(r'^\d+$', s) is not None or s == '|'
def is_code(l):
    s = l.strip(); return bool(EU_RE.match(s) or EK_RE.match(s) or SK_RE.match(s))
def join(lines): return re.sub(r'\s+', ' ', ' '.join(x.strip() for x in lines if x.strip())).strip()
# skills table
skills = {}
sk_pages = [n for n in sorted(P) if 'Skill Category 8' in P[n] or ('SKILLS' in P[n] and re.search(r'^\d\.[A-Z] ', P[n], re.M) and n < 40)]
sk_text = '\n'.join(P[k] for k in sk_pages)
sk_text = re.sub(r'\s+', ' ', sk_text)
for m in re.finditer(r'(\d\.[A-Z]) ((?:(?!\d\.[A-Z] ).)+?) (Units? \d[\d, ]*?(?: and \d)?)(?= \d\.[A-Z] |$| [A-Z])', sk_text):
    skills.setdefault(m.group(1), {'code': m.group(1), 'name': m.group(2).strip(), 'units': re.sub(r'\s+\d{2,}$', '', m.group(3).strip().rstrip(','))})
CATS = {'1': 'Rhetorical Situation – Reading', '2': 'Rhetorical Situation – Writing', '3': 'Claims and Evidence – Reading', '4': 'Claims and Evidence – Writing',
        '5': 'Reasoning and Organization – Reading', '6': 'Reasoning and Organization – Writing', '7': 'Style – Reading', '8': 'Style – Writing'}
CATTEXT = {'1': 'Explain how writers’ choices reflect the components of the rhetorical situation.', '2': 'Make strategic choices in a text to address a rhetorical situation.',
           '3': 'Identify and describe the claims and evidence of an argument.', '4': 'Analyze and select evidence to develop and refine a claim.',
           '5': 'Describe the reasoning, organization, and development of an argument.', '6': 'Use organization and commentary to illuminate the line of reasoning in an argument.',
           '7': 'Explain how writers’ stylistic choices contribute to the purpose of an argument.', '8': 'Select words and use elements of composition to advance an argument.'}
for k, v in skills.items(): v['category'] = CATS[k[0]]; v['category_text'] = CATTEXT[k[0]]
# unit overview pages: EU, skill, EK
eus = {}; eks = {}; ek_cands = collections.defaultdict(list); ek_units = collections.defaultdict(set); ek_skill = {}; unit_skills = collections.defaultdict(set)
FIRST = min(n for n in P if 'UNIT OVERVIEW' in P[n] and 'Enduring' in P[n] and re.search(r'^UNIT\n1$', P[n], re.M) and 'Using the Unit Guides' not in P[n]); LAST = min([n for n in P if 'Selecting and Using Course Materials' in P[n] and n > FIRST] or [max(P)])
for n in range(FIRST, LAST):
    text = P[n]; lines = text.split('\n')
    mu = re.search(r'^UNIT\n(\d)$', text, re.M) or re.search(r'^Unit (\d):', text, re.M)
    unit = int(mu.group(1)) if mu else None
    cur_sk = None; row = []; last = None; target = None; buf = []; kind = None
    def flush():
        global target, buf
        if target is not None and buf:
            t = join(buf)
            if kind == 'eu': eus.setdefault(target, t)
            elif kind == 'ek': ek_cands[target].append((t, n))
        target = None; buf = []
    if 'Using the Unit Guides' in text: continue
    for l in lines:
        s = l.strip()
        if EU_RE.match(s): flush(); target = s; kind = 'eu'; continue
        mS = re.match(r'^(\d\.[A-Z])(?:\s+(Reading|Writing) –.*)?$', s)
        if mS:
            flush(); cur_sk = mS.group(1); target = None
            if last == 'ek': row = []
            row.append(cur_sk); last = 'sk'
            if unit: unit_skills[unit].add(cur_sk)
            continue
        if EK_RE.match(s):
            flush(); target = s; kind = 'ek'; last = 'ek'
            if unit: ek_units[s].add(unit)
            if row: ek_skill.setdefault(s, list(row))
            continue
        if target is not None:
            if is_code(l): flush()
            elif is_stop(l) or (not buf and len(l.strip()) <= 4):
                if buf: flush()
            else: buf.append(l)
    flush()
for c, cands in ek_cands.items():
    good = [x for x in cands if re.match(r'^[A-Z“"(]', x[0])] or cands
    t, n = max(good, key=lambda x: len(x[0])); eks[c] = {'code': c, 'text': t, 'p': n}
# progress checks
checks = {}
for m in re.finditer(r'(?=Progress Check (\d)([\s\S]{0,200}))', raw):
    u = int(m.group(1)); b = m.group(2)
    mc = re.search(r'Multiple-choice:\s*~?(?:Tilde)?\s*(\d+)', b); fr = re.search(r'Free-response:\s*(\d+)', b)
    if mc and fr and u not in checks: checks[u] = f'Progress check · {mc.group(1)} multiple choice · {fr.group(1)} free response'
e0 = [n for n in sorted(P) if P[n].lstrip().startswith('Exam Overview')][0]
exam_raw = '\n'.join(P[k] for k in range(e0, e0 + 4))
rub = [n for n in sorted(P) if n > e0 and 'Row A' in P[n]]
rub_raw = '\n'.join(P[k][:7000] for k in rub[:6])
BIG = [('rhs', 'RHS', 'Rhetorical Situation'), ('cle', 'CLE', 'Claims and Evidence'), ('reo', 'REO', 'Reasoning and Organization'), ('stl', 'STL', 'Style')]
def ekkey(c): return (c.split('-')[0], int(c.split('-')[1].split('.')[0]), c.split('.')[1])
out = {'course': 'lang', 'edition': 'AP English Language and Composition Course and Exam Description, Effective Fall 2024',
       'exam': {'format': re.sub(r'\n{2,}', '\n', exam_raw).strip(), 'rubrics': re.sub(r'\n{2,}', '\n', rub_raw).strip(), 'verified': 'ced'},
       'skills': [skills[k] for k in sorted(skills)], 'units': []}
for i, (uid, pre, title) in enumerate(BIG, 1):
    codes = sorted([c for c in eks if c.startswith(pre + '-')], key=ekkey)
    cats = [str(2 * i - 1), str(2 * i)]
    topics = [{'code': c, 'title': eks[c]['text'][:70].rstrip(' ,.;') + '…', 'skill': (ek_skill.get(c) or [None])[0], 'skill_text': skills.get((ek_skill.get(c) or [None])[0], {}).get('name'),
               'lo': [{'code': k, 'text': skills.get(k, {}).get('name')} for k in ek_skill.get(c, [])],
               'ek': [{'code': c, 'text': eks[c]['text']}], 'ced_units': sorted(ek_units[c]), 'p': eks[c]['p'], 'verified': 'ced'} for c in codes]
    out['units'].append({'id': uid, 'n': i, 'title': title, 'weight': 'no per-unit weighting; skill categories ' + ' and '.join(cats) + ' in the multiple-choice section',
        'check': 'Progress checks belong to the nine CED units: ' + '; '.join(f'Unit {u}: {checks[u]}' for u in sorted(checks)),
        'eu': [{'code': k, 'text': eus[k]} for k in sorted(eus) if k.startswith(pre)],
        'skills': [skills[k] for k in sorted(skills) if k[0] in cats],
        'topics': topics, 'ced_units': sorted({u for c in codes for u in ek_units[c]}),
        'excl': [{'text': 'The CED names no required texts and no required literary or grammatical terminology; the exam assesses the skills and essential knowledge, not term recall.', 'verified': 'recall'}],
        'borrow': [], 'notes': ''})
json.dump(out, open(os.path.join(CED, 'lang.skeleton.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out['edition'], '· skills', len(skills), '· EUs', sorted(eus), '· EKs', len(eks), '· checks', checks)
for U in out['units']:
    print(f"\n{U['id']} {U['title']} · {len(U['topics'])} EK topics · CED units {U['ced_units']} · skills {[s['code'] for s in U['skills']]}")
    for t in U['topics']: print(f"   {t['code']:8} skill {t['skill'] or '?':4} units {t['ced_units']} p{t['p']}  {t['ek'][0]['text'][:80]}")
missing = [k for k in skills if not any(k == t['skill'] for U in out['units'] for t in U['topics'])]
print('skills never paired with an EK:', missing)
