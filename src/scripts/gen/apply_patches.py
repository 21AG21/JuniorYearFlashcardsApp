#!/usr/bin/env python3
"""apply_patches.py <patch.json> [--dry]

Applies corrections to out/<course>-<unit>.json. A patch file is a JSON list of entries:

  {"course": "chem", "unit": "u1",
   "card": "<the card's q, exactly>"            -- or --   "frq": 0, "part": "a"   (or "row": 2, or neither for the stem)
   "field": "a" | "n" | "h" | "x" | "o" | "w" | "q" (FRQ part text) | "p" | "stem" | "title" | "earns" | "loses",
   "old": "<exact substring now in that field>", "new": "<its replacement>",
   "why": "<one sentence: what was wrong>", "source": "<URL or 'computed'>"}

A card's q is never patched (its id follows the question). Each entry must match its substring exactly once
inside the named field; --dry reports every entry without writing. After writing, each touched unit is
re-validated."""
import json, sys, os, subprocess, collections
G = os.path.dirname(os.path.abspath(__file__))
patch_path = sys.argv[1]; dry = '--dry' in sys.argv
entries = json.load(open(patch_path, encoding='utf-8'))
units = {}
def load(c, u):
    k = (c, u)
    if k not in units: units[k] = json.load(open(f'{G}/out/{c}-{u}.json', encoding='utf-8'))
    return units[k]

def count_in(v, old):
    if isinstance(v, str): return v.count(old)
    if isinstance(v, list): return sum(count_in(x, old) for x in v)
    if isinstance(v, dict): return sum(count_in(x, old) for x in v.values())
    return 0
def repl(v, old, new):
    if isinstance(v, str): return v.replace(old, new)
    if isinstance(v, list): return [repl(x, old, new) for x in v]
    if isinstance(v, dict): return {k: repl(x, old, new) for k, x in v.items()}
    return v

ok = bad = 0; touched = set(); problems = collections.Counter()
for i, e in enumerate(entries):
    tag = f'#{i} {e.get("course")}/{e.get("unit")}'
    try:
        d = load(e['course'], e['unit'])
    except Exception as x:
        print(tag, 'NO UNIT', x); bad += 1; continue
    if e.get('field') == 'q' and 'card' in e:
        print(tag, 'REFUSED: a card question is never patched'); bad += 1; continue
    if 'card' in e:
        hits = [c for c in d['cards'] if c['q'] == e['card']]
        if len(hits) != 1: print(tag, f'card not found exactly once ({len(hits)}): {e["card"][:70]}'); bad += 1; continue
        holder = hits[0]
    elif 'frq' in e:
        try:
            f = d['frq'][e['frq']]
            if 'part' in e: holder = [p for p in f.get('parts') or [] if p.get('l') == e['part']][0]
            elif 'row' in e: holder = (f.get('rows') or [])[e['row']]
            else: holder = f
        except Exception as x:
            print(tag, 'FRQ target not found', x); bad += 1; continue
    else:
        print(tag, 'no card or frq target'); bad += 1; continue
    fld = e['field']
    if fld not in holder: print(tag, f'field {fld} absent'); bad += 1; continue
    n = count_in(holder[fld], e['old'])
    if n != 1: print(tag, f'old text found {n} times in {fld}: {e["old"][:70]}'); bad += 1; continue
    if not dry: holder[fld] = repl(holder[fld], e['old'], e['new'])
    touched.add((e['course'], e['unit'])); ok += 1
print(f'{ok} applicable, {bad} not' + (' (dry run, nothing written)' if dry else ''))
if not dry:
    for (c, u) in sorted(touched):
        json.dump(units[(c, u)], open(f'{G}/out/{c}-{u}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        r = subprocess.run(['python3', f'{G}/validate.py', c, u], capture_output=True, text=True).stdout.strip().splitlines()
        print(f'{c}/{u}:', r[-1] if r else '?')
    print('touched:', ' '.join(f'{c}-{u}' for c, u in sorted(touched)))
