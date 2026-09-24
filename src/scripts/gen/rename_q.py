#!/usr/bin/env python3
"""rename_q.py <renames.json> — rewrites card questions that are wrong in themselves. Entries:
{"course", "unit", "old": "<the q exactly>", "new": "<the corrected q>", "why"}. A card's id follows its
question, so the card gets a new id (its study history starts over). Units with an out/ file are edited there
(merge.py re-derives ids); units without one are edited in data/<course>.json with the id recomputed."""
import json, sys, os, hashlib, subprocess
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
entries = json.load(open(sys.argv[1], encoding='utf-8')); datas = {}; outs = {}
for e in entries:
    c, u = e['course'], e['unit']; op = f'{G}/out/{c}-{u}.json'
    if os.path.exists(op):
        d = outs.setdefault(op, json.load(open(op, encoding='utf-8'))); cards = d['cards']
    else:
        d = datas.setdefault(c, json.load(open(f'{ROOT}/data/{c}.json', encoding='utf-8'))); cards = [x for x in d['cards'] if x['u'] == u]
    hits = [x for x in cards if x['q'] == e['old']]
    assert len(hits) == 1, f'{c}/{u}: {len(hits)} hits for {e["old"][:60]}'
    hits[0]['q'] = e['new']
    if 'i' in hits[0]: hits[0]['i'] = hashlib.sha1((c + '|' + e['new']).encode('utf-8')).hexdigest()[:10]
    print('renamed', c, u, '|', e['new'][:80])
for op, d in outs.items(): json.dump(d, open(op, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c, d in datas.items():
    ids = [x['i'] for x in d['cards']]; assert len(ids) == len(set(ids)), 'duplicate ids'
    json.dump(d, open(f'{ROOT}/data/{c}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
if datas: print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
print('out files touched:', ' '.join(os.path.basename(p) for p in outs))
