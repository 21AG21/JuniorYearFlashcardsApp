#!/usr/bin/env python3
"""export_links.py <course>  — writes in/<course>-x.json for the Connections unit: every CED topic and
essential-knowledge code of the course (so a card may cite any of them), every exclusion statement, the
skills, the exam format, and no existing cards."""
import json, sys, os
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
course = sys.argv[1]
sk = json.load(open(f'{G}/../ced/{course}.skeleton.json', encoding='utf-8'))
d = json.load(open(f'{ROOT}/data/{course}.json', encoding='utf-8'))
TITLE = {'french': 'Liens entre les thèmes'}.get(course, 'Connections')
topics, excl = [], []
for su in sk['units']:
    for t in su.get('topics', []):
        topics.append({'unit': su['id'], 'code': t['code'], 'title': t.get('title'), 'skill': t.get('skill'),
                       'lo': t.get('lo'), 'ek': t.get('ek')})
    for x in su.get('excl', []) or []:
        excl.append({'unit': su['id'], **x})
out = {'course': course, 'unit': {'id': 'x', 'n': None, 'title': TITLE, 'weight': '', 'blurb': ''},
       'units': [{'id': x['id'], 'n': x['n'], 'title': x['title']} for x in d['units']],
       'edition': sk.get('edition'), 'exam': sk.get('exam'), 'skills': sk.get('skills'),
       'skeleton': {'id': 'x', 'title': TITLE, 'topics': topics, 'excl': excl}, 'existing': []}
json.dump(out, open(f'{G}/in/{course}-x.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'in/{course}-x.json: {len(topics)} course topics, {len(excl)} exclusions')
