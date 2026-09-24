#!/usr/bin/env python3
"""add_skills.py  — writes each AP course's skill list (the codes its cards use, with the CED's wording and
practice or category) into data/<course>.json as "skills", for the practice-by-skill screen."""
import json, os, subprocess, re
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
for c in ['chem', 'calcbc', 'apush', 'lang', 'french']:
    sk = json.load(open(f'{G}/../ced/{c}.skeleton.json', encoding='utf-8'))
    path = f'{ROOT}/data/{c}.json'; d = json.load(open(path, encoding='utf-8'))
    used = {x.get('s') for x in d['cards'] if x.get('s')}
    out = []
    for s in sk.get('skills', []):
        if s['code'] not in used: continue
        name = re.sub(r'\s*\(not assessed\)\.?$', '.', s['name']).strip()
        out.append({'code': s['code'], 'name': name, 'group': s.get('practice') or s.get('category') or ''})
    d['skills'] = out
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(c, len(out), 'skills')
print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
