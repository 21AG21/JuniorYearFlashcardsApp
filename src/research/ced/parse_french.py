#!/usr/bin/env python3
"""parse_french.py — french.skeleton.json from the AP French Language and Culture CED (Effective Fall 2026) text."""
import re, json, collections, os
CED = os.environ.get('CED_DIR', os.path.dirname(os.path.abspath(__file__)))
raw = open(os.path.join(CED, 'french-language-and-culture.txt'), encoding='utf-8').read().replace('￾', '-').replace('﻿', '')
raw = re.sub(r'(?<=[A-Za-z])f f(?=[a-z])', 'ff', raw)
P = {int(p.split('>>>', 1)[0]): p.split('>>>', 1)[1] for p in raw.split('<<<PAGE ')[1:]}
def join(lines): return re.sub(r'\s+', ' ', ' '.join(x.strip() for x in lines if x.strip())).strip()
openers = [n for n in sorted(P) if re.search(r'^UNIT\n(\d)\b', P[n], re.M) and 'ESSENTIAL' in P[n] and 'RECOMMENDED INSTRUCTIONAL CONTEXTS' in P[n]]
LAST = min([n for n in P if P[n].lstrip().startswith('Exam Overview')] + [max(P)])
units = {}
def split_fr(s):
    m = re.match(r'^(.*?)\s+((?:Les|La|Le|Un|Une|Des)\s.*|L[’\']\S.*|Produits\b.*)$', s.strip())
    return {'en': m.group(1).strip(), 'fr': m.group(2).strip()} if m else {'en': s.strip(), 'fr': ''}
def bullets(block):
    return [re.split(r'\s+UNIT\s', join(x.split('\n')))[0] for x in re.split(r'\n?[§•]\s*', block) if x.strip()]
for idx, n in enumerate(openers):
    text = P[n]; u = int(re.search(r'^UNIT\n(\d)\b', text, re.M).group(1))
    end = openers[idx + 1] if idx + 1 < len(openers) else LAST
    title = re.search(r'CLASS PERIODS\n([\s\S]*?)\nESSENTIAL', text)
    eq = re.search(r'ESSENTIAL\s*\nQUESTIONS\s*\n([\s\S]*?)\nDeveloping Understanding', text)
    rc = re.search(r'RECOMMENDED INSTRUCTIONAL CONTEXTS\n([\s\S]*?)\nOTHER RECOMMENDED', text)
    oc = re.search(r'OTHER RECOMMENDED INSTRUCTIONAL CONTEXTS\n([\s\S]*?)\n(?:AP French|Return to|©)', text)
    du = re.search(r'Developing Understanding\n([\s\S]*?)\nRECOMMENDED', text)
    units[u] = {'n': u, 'title_en': join(title.group(1).split('\n')) if title else None, 'p': n, 'pages': [n, end - 1],
                'questions': [{'en': re.split(r'\s(?=(?:Qu|Quel|Quels|Quelle|Quelles|Comment|Pourquoi|Dans|Que|En|Est-ce|De|Quels|À|A)\b)', q, 1)[0], 'fr': (re.split(r'\s(?=(?:Qu|Quel|Quels|Quelle|Quelles|Comment|Pourquoi|Dans|Que|En|Est-ce|De|À|A)\b)', q, 1) + [''])[1]} for q in bullets(eq.group(1))] if eq else [],
                'contexts': [split_fr(x) for x in bullets(rc.group(1))] if rc else [],
                'other_contexts': [split_fr(x) for x in bullets(oc.group(1))] if oc else [],
                'intro': join(du.group(1).split('\n'))[:1200] if du else '', 'modes': [], 'lo': [], 'task_types': []}
    los = {}; modes = []; tts = set()
    for k in range(n, end):
        t = P[k]
        for m in re.finditer(r'^MODE\n([^\n]+(?:\n[^\n]+)?)\nTASK TYPES?:\s*([^\n]+)', t, re.M):
            modes.append(re.sub(r'\s+', ' ', m.group(1))); tts.update(x.strip() for x in m.group(2).split(','))
        for m in re.finditer(r'^(\d\.[A-Z]\.\d)\s*\n?([^\n]+)', t, re.M):
            los[m.group(1)] = m.group(2).strip()
    units[u]['modes'] = sorted(set(modes)); units[u]['task_types'] = sorted(x for x in tts if x); units[u]['lo'] = [{'code': c, 'text': los[c]} for c in sorted(los)]
# global skills / LOs
cats = {}; skills = {}; los = {}
for m in re.finditer(r'^SKILL CATEGORY (\d)\s*\n([^\n]+(?:\n[^\n]+){0,2})', raw, re.M): cats.setdefault(m.group(1), join(m.group(2).split('\n')))
for m in re.finditer(r'^SKILL (\d\.[A-Z])\s*\n([^\n]+)', raw, re.M): skills.setdefault(m.group(1), m.group(2).strip())
for m in re.finditer(r'^(\d\.[A-Z]\.\d)\s*\n?([^\n]+)', raw, re.M): los.setdefault(m.group(1), m.group(2).strip())
# progress checks
checks = {}
for m in re.finditer(r'(?=Progress Check(?: Unit)? (\d)([\s\S]{0,260}))', raw):
    u = int(m.group(1)); b = m.group(2); mc = re.search(r'Multiple-choice:\s*~?(\d+)', b); fr = re.search(r'Free-response:\s*(\d+)', b)
    if (mc or fr) and u not in checks: checks[u] = 'Progress check · ' + ' · '.join(x for x in [mc and mc.group(1) + ' multiple choice', fr and fr.group(1) + ' free response'] if x)
e0 = [n for n in sorted(P) if P[n].lstrip().startswith('Exam Overview')][0]
exam_raw = '\n'.join(P[k] for k in range(e0, e0 + 6))
sg = [n for n in sorted(P) if n > e0 and ('Scoring Guidelines' in P[n] or 'SCORING GUIDELINES' in P[n]) and ('Project Presentation' in P[n] or 'Argumentative Essay' in P[n] or 'Project Q&A' in P[n])]
sg = [n for n in range(112, 121)] + [n for n in range(130, 139)]
sg_raw = '\n'.join(P[k][:5000] for k in sg if k in P)
proj = sorted(set([n for n in sorted(P) if 'Personalized Project Reference' in P[n]]))[:10]
manual = [n for n in sorted(P) if 'Project Manual' in P[n][:300] and n > e0]
proj = [98] + list(range(124, 130)) + list(range(152, 159))
proj_raw = '\n'.join(P[k][:5000] for k in proj if k in P)
EN_TITLES = {int(m.group(1)): m.group(2).strip() for m in re.finditer(r'UNIT (\d): ([^\n]+)', raw[:12000])}
FR_TITLES = {1: 'Les familles et les communautés', 2: 'La langue et la culture', 3: "L'art et la créativité", 4: 'La science et la technologie', 5: 'La vie contemporaine', 6: 'Les contextes mondiaux'}
out = {'course': 'french', 'edition': 'AP French Language and Culture Course and Exam Description, Effective Fall 2026',
       'exam': {'format': re.sub(r'\n{2,}', '\n', exam_raw).strip(), 'scoring': re.sub(r'\n{2,}', '\n', sg_raw).strip(), 'project': re.sub(r'\n{2,}', '\n', proj_raw).strip(), 'verified': 'ced'},
       'skills': [{'code': c, 'name': cats[c], 'kind': 'category'} for c in sorted(cats)] + [{'code': c, 'name': skills[c], 'kind': 'skill'} for c in sorted(skills)] + [{'code': c, 'name': los[c], 'kind': 'lo'} for c in sorted(los)],
       'units': []}
for u in range(1, 7):
    ui = units.get(u, {})
    out['units'].append({'id': f't{u}', 'n': u, 'title': FR_TITLES[u], 'en': EN_TITLES.get(u) or ui.get('title_en'), 'weight': 'no unit weighting; every unit feeds all three free-response tasks and both multiple-choice parts',
        'check': checks.get(u), 'pages': ui.get('pages'), 'questions': ui.get('questions', []), 'contexts': ui.get('contexts', []), 'other_contexts': ui.get('other_contexts', []),
        'intro': ui.get('intro', ''), 'modes': ui.get('modes', []), 'task_types': ui.get('task_types', []), 'lo': ui.get('lo', []),
        'topics': [{'code': f't{u}-' + re.sub(r'[^a-z]+', '-', c['en'].lower()).strip('-')[:24], 'title': c['fr'] or c['en'], 'en': c['en'], 'skill': 'Interpretive', 'lo': ui.get('lo', []), 'ek': ui.get('lo', []), 'verified': 'ced'} for c in ui.get('contexts', [])],
        'excl': [], 'borrow': [], 'notes': '', 'verified': 'ced'})
json.dump(out, open(os.path.join(CED, 'french.skeleton.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out['edition'], '· categories', len(cats), '· skills', len(skills), '· LOs', len(los), '· checks', checks, '· scoring pages', sg[:8], '· project pages', proj, manual[:5])
for U in out['units']:
    print(f"\nt{U['n']} {U['en']!r} pages {U['pages']} · {len(U['questions'])} questions · {len(U['contexts'])} contexts + {len(U['other_contexts'])} other · modes {U['modes']} · task types {U['task_types']} · LOs {[l['code'] for l in U['lo']]}")
    for c in U['contexts']: print('   ', c)
    for q in U['questions'][:3]: print('   Q', q)
