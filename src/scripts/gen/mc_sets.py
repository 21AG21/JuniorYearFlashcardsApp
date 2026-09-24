#!/usr/bin/env python3
"""mc_sets.py check <course>     — checks out/mc-<course>.json
   mc_sets.py merge <course>     — appends its sets to each unit's out/<course>-<unit>.json "frq" list (replacing
                                   any set with the same title), then validates each touched unit

out/mc-<course>.json maps a unit id to a list of stimulus-based multiple-choice sets in the exam's style:
  {"u3": [{"kind": "mc", "title": "...", "pts": 5, "b": "u2" (optional), "calc": false (Calculus only),
           "stem": "<the stimulus: a passage, a data table, a described graph, a scenario>",
           "parts": [{"l": "1", "p": 1,
                      "q": "<the question>\\n(A) ...\\n(B) ...\\n(C) ...\\n(D) ...",
                      "a": "(B). <why B is right, and why each other choice is wrong>",
                      "n": "<the CED code(s) and skill, then the trap the distractors set>"}, ...]}, ...]}
"""
import json, sys, os, re, subprocess
G = os.path.dirname(os.path.abspath(__file__))
cmd, course = sys.argv[1], sys.argv[2]
sets = json.load(open(f'{G}/out/mc-{course}.json', encoding='utf-8'))
E, W = [], []
TEXCMD = re.compile(r'\\([A-Za-z]+)')
titles = set()
for unit, lst in sets.items():
    if not os.path.exists(f'{G}/out/{course}-{unit}.json'): E.append(f'{unit}: no unit file'); continue
    for i, f in enumerate(lst):
        w = f'{unit} set {i + 1}'
        if f.get('kind') != 'mc': E.append(f'{w}: kind must be mc')
        if not f.get('title'): E.append(f'{w}: no title')
        if f.get('title') in titles: E.append(f'{w}: duplicate title')
        titles.add(f.get('title'))
        stem = f.get('stem') or ''
        if len(stem) < 150: E.append(f'{w}: stem too short to be a stimulus ({len(stem)})')
        parts = f.get('parts') or []
        if not 3 <= len(parts) <= 6: E.append(f'{w}: {len(parts)} questions (want 3 to 6)')
        if f.get('pts') != len(parts): E.append(f'{w}: pts {f.get("pts")} is not the number of questions {len(parts)}')
        for j, p in enumerate(parts):
            pw = f'{w} q{j + 1}'
            q, a = p.get('q') or '', p.get('a') or ''
            letters = re.findall(r'^\(([A-E])\) \S', q, re.M)
            if letters != ['A', 'B', 'C', 'D']: E.append(f'{pw}: choices must be lines (A) to (D), found {letters}')
            m = re.match(r'^\(([A-D])\)\. \S', a)
            if not m: E.append(f'{pw}: answer must open "(X). " and explain')
            if len(a) < 80: E.append(f'{pw}: explanation too short ({len(a)})')
            if not p.get('n'): E.append(f'{pw}: no note')
            if p.get('p') != 1: E.append(f'{pw}: a multiple-choice question is worth 1 point')
            if str(p.get('l')) != str(j + 1): E.append(f'{pw}: label should be {j + 1}')
            for s in (q, a, p.get('n') or '', stem):
                if s.count('$') % 2 and re.search(r'[\\^_]', s): E.append(f'{pw}: unbalanced $')
        # the right answers should not all sit on one letter
        keys = [re.match(r'^\(([A-D])\)', p.get('a') or '(?)') for p in parts]
        ks = [k.group(1) for k in keys if k]
        if ks and len(set(ks)) == 1 and len(ks) >= 3: W.append(f'{w}: every answer is {ks[0]}')
n = sum(len(v) for v in sets.values())
print(f'== mc/{course}: {n} sets, {sum(len(f.get("parts") or []) for v in sets.values() for f in v)} questions over {len(sets)} units')
for x in W: print('   W', x)
for x in E: print('   E', x)
print('RESULT', 'FAIL' if E else 'PASS')
if cmd == 'merge' and not E:
    for unit, lst in sets.items():
        p = f'{G}/out/{course}-{unit}.json'; d = json.load(open(p, encoding='utf-8'))
        keep = [f for f in d.get('frq') or [] if f.get('title') not in {x['title'] for x in lst}]
        d['frq'] = keep + lst
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        r = subprocess.run(['python3', f'{G}/validate.py', course, unit], capture_output=True, text=True).stdout.strip().splitlines()
        print(f'{course}/{unit}:', r[-1] if r else '?')
    print('now: python3 merge.py', course, ' '.join(sets))
