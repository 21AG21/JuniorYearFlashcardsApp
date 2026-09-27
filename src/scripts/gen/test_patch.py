#!/usr/bin/env python3
"""test_patch.py <patch.json> [--dry]

Applies corrections to out/test-<course>-<unit>.json. A patch file is a JSON list of entries, each addressing
one place in one test:

  {"course": "chem", "unit": "u5",
   "q": 7                       -- a multiple-choice question, by its number in the test ("l")
   | "group": 3                 -- a group's stem (1-based group index), field "stem"
   | "fr": 2, "part": "b"       -- a free-response part (1-based item index, the part's "l")
   | "fr": 2, "row": 1          -- a free-response rubric row (1-based)
   | "fr": 2                    -- the item itself: field "stem", "title" or "pts"
   "field": "q" | "a" | "n" | "stem" | "earns" | "loses" | "title" | "r",   -- text fields: old is an exact
                                  substring that must occur exactly once in the field
          | "lv" | "ty" | "t" | "s" | "p" | "pts",                         -- short fields: old is the whole value
   "old": "...", "new": "...",
   "why": "<one sentence: what was wrong>"}

or replaces a whole question or part (for a question that has to be rewritten, not mended):

  {"course", "unit", "q": 7, "set": {<the full question object, same "l">}, "why"}
  {"course", "unit", "fr": 2, "part": "b", "set": {<the full part object>}, "why"}

--dry reports every entry without writing. After writing, each touched test is re-checked with tests.py."""
import json, sys, os, subprocess
G = os.path.dirname(os.path.abspath(__file__))
entries = json.load(open(sys.argv[1], encoding='utf-8')); dry = '--dry' in sys.argv
SHORT = {'lv', 'ty', 't', 's', 'p', 'pts'}
tests = {}
def load(c, u):
    k = (c, u)
    if k not in tests: tests[k] = json.load(open(f'{G}/out/test-{c}-{u}.json', encoding='utf-8'))
    return tests[k]
def target(t, e):
    if 'q' in e:
        for g in t['mc']:
            for i, p in enumerate(g['parts']):
                if str(p.get('l')) == str(e['q']): return g['parts'], i
        raise KeyError(f'no question {e["q"]}')
    if 'group' in e: return t['mc'], e['group'] - 1
    if 'fr' in e:
        f = t['fr'][e['fr'] - 1]
        if 'part' in e:
            for i, p in enumerate(f.get('parts') or []):
                if str(p.get('l')) == str(e['part']): return f['parts'], i
            raise KeyError(f'no part {e["part"]} in fr {e["fr"]}')
        if 'row' in e: return f['rows'], e['row'] - 1
        return t['fr'], e['fr'] - 1
    raise KeyError('entry names no q, group or fr')
ok = bad = 0; touched = set()
for n, e in enumerate(entries):
    tag = f'#{n} {e.get("course")}/{e.get("unit")} ' + ' '.join(f'{k}={e[k]}' for k in ('q', 'group', 'fr', 'part', 'row') if k in e)
    try:
        t = load(e['course'], e['unit']); lst, i = target(t, e); obj = lst[i]
        if 'set' in e:
            new = e['set']
            if 'q' in e and str(new.get('l')) != str(e['q']): raise ValueError('a replacement question keeps its number')
            lst[i] = new
        else:
            fld = e['field']
            if fld in SHORT:
                if obj.get(fld) != e['old']: raise ValueError(f'{fld} is {obj.get(fld)!r}, not {e["old"]!r}')
                obj[fld] = e['new']
            else:
                v = obj.get(fld) or ''
                c = v.count(e['old'])
                if c != 1: raise ValueError(f'old text found {c} times in {fld}')
                obj[fld] = v.replace(e['old'], e['new'])
        ok += 1; touched.add((e['course'], e['unit']))
        if dry: print(tag, 'ok')
    except Exception as x:
        bad += 1; print(tag, 'FAIL', x)
print(f'{ok} apply, {bad} fail')
if not dry:
    for (c, u) in sorted(touched):
        json.dump(tests[(c, u)], open(f'{G}/out/test-{c}-{u}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        r = subprocess.run(['python3', f'{G}/tests.py', 'check', c, u], capture_output=True, text=True).stdout.strip().splitlines()
        print(f'{c}/{u}:', r[-1] if r else '?', *[l for l in r if l.strip().startswith('E')][:5], sep='\n  ')
