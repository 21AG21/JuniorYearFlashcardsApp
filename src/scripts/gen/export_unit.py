#!/usr/bin/env python3
"""export_unit.py <course> <unit>  — writes in/<course>-<unit>.json for a generation agent."""
import json, sys, os
G = os.environ.get('GEN_DIR', os.path.dirname(os.path.abspath(__file__))); ROOT = os.environ.get('APP_ROOT', os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
course, unit = sys.argv[1], sys.argv[2]
sk = json.load(open(os.path.join(os.environ.get('CED_DIR', os.path.join(ROOT, 'src', 'research', 'ced')), f'{course}.skeleton.json'), encoding='utf-8'))
d = json.load(open(f'{ROOT}/data/{course}.json', encoding='utf-8'))
u = [x for x in d['units'] if x['id'] == unit][0]
su = [x for x in sk['units'] if x['id'] == unit][0]
existing = [{k: c[k] for k in ('t','v','q','a','h','n','c','x') if k in c} for c in d['cards'] if c['u'] == unit]
out = {'course': course, 'unit': {k: u.get(k) for k in ('id','n','title','weight','blurb')},
       'units': [{'id': x['id'], 'n': x['n'], 'title': x['title']} for x in d['units']],
       'edition': sk.get('edition'), 'exam': sk.get('exam'), 'skills': sk.get('skills'),
       'skeleton': su, 'existing': existing}
json.dump(out, open(f'{G}/in/{course}-{unit}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'in/{course}-{unit}.json: {len(existing)} existing cards, {len(su.get("topics", []))} topics')
