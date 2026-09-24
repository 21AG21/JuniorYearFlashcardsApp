#!/usr/bin/env python3
"""ledger.py [set <unit> <state>] — the rebuild's unit ledger. States: queued, running, passed, merged."""
import json, sys, os, subprocess, datetime, collections
G = os.path.dirname(os.path.abspath(__file__)); P = f'{G}/ledger.json'
L = json.load(open(P))
if len(sys.argv) >= 4 and sys.argv[1] == 'set':
    L[sys.argv[2]] = {'state': sys.argv[3], 'since': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')}
    json.dump(L, open(P, 'w'), indent=1)
# a unit whose output passes is 'passed' unless merged
for k, v in L.items():
    if v['state'] in ('running', 'queued') and os.path.exists(f'{G}/out/{k}.json'):
        c, u = k.split('-', 1)
        r = subprocess.run(['python3', f'{G}/validate.py', c, u], capture_output=True, text=True).stdout
        if 'RESULT PASS' in r and v['state'] == 'running': v['note'] = 'output passes; awaiting report'
print(dict(collections.Counter(v['state'] for v in L.values())))
for s in ('running', 'queued', 'passed'):
    print(s + ':', ' '.join(k for k, v in L.items() if v['state'] == s))
