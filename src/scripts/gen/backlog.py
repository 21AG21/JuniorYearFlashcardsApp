#!/usr/bin/env python3
"""backlog.py                      — prints the autonomous backlog's state
   backlog.py set <id> <status>    — sets an agent item's status (queued, running, done, applied)
   backlog.py me <id> <status>     — sets a self item's status (todo, doing, done)
Copies BACKLOG.json to the repository (src/scripts/gen/) on every change."""
import json, sys, os, shutil
G = os.path.dirname(os.path.abspath(__file__)); P = f'{G}/BACKLOG.json'
B = json.load(open(P))
if len(sys.argv) >= 4 and sys.argv[1] == 'set': B['items'][sys.argv[2]]['status'] = sys.argv[3]
elif len(sys.argv) >= 4 and sys.argv[1] == 'me':
    for m in B['me']:
        if m['id'] == sys.argv[2]: m['status'] = sys.argv[3]
if len(sys.argv) >= 4:
    json.dump(B, open(P, 'w'), indent=1)
    shutil.copy(P, '/home/user/JuniorYearFlashcardsApp/src/scripts/gen/BACKLOG.json')
by = {}
for k, v in B['items'].items(): by.setdefault(v['status'], []).append(k)
for s in ('running', 'done', 'queued', 'applied'): print(f'{s}:', ' '.join(by.get(s, [])))
print('me:', ' · '.join(f"{m['id']} ({m['status']})" for m in B['me']))
