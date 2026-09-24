#!/usr/bin/env python3
"""add_skills.py  — writes each AP course's skill list (the codes its cards use, with the CED's wording and
practice or category) into data/<course>.json as "skills", for the practice-by-skill screen. Each skill
also carries "short", a label of a few words for lists where the CED sentence is too long to scan."""
import json, os, subprocess, re
# PDF extraction left the next heading on the end of a few skills
JUNK = [r'\s+Course$', r'\s+ILLUSTRATIVE EXAMPLES$', r'\s+Communication and Notation$', r'\s+This argument might:$']
SHORT = {
 'chem': {'1.A': 'Particle-level models', '1.B': 'Particle and bulk models', '2.A': 'A testable question',
  '2.B': 'Hypothesis and prediction', '2.C': 'Choosing the procedure', '2.D': 'Reading lab data', '2.E': 'Sources of error',
  '2.F': 'Changing the procedure', '3.A': 'Graphing data', '3.B': 'Diagrams and models', '3.C': 'Picturing across scales',
  '4.A': 'Explaining with theory', '4.B': 'Is the model consistent?', '4.C': 'Particles to properties', '4.D': 'Limits of a model',
  '5.A': 'Finding the given quantities', '5.B': 'Choosing the relationship', '5.C': 'How variables relate', '5.D': 'Reading a graph',
  '5.E': 'Balancing equations', '5.F': 'Calculating with care', '6.A': 'Making a claim', '6.B': 'Evidence from data',
  '6.C': 'Evidence from particle models', '6.D': 'Reasoning from principles', '6.E': 'Reasoning across scales',
  '6.F': 'Results to concepts', '6.G': 'How error changes results'},
 'calcbc': {'1.C': 'Choosing a rule by form', '1.D': 'Choosing a rule by concept', '1.E': 'Applying rules and procedures',
  '1.F': 'Approximate versus actual', '2.A': 'Same structure, new context', '2.B': 'Reading representations',
  '2.C': 'Re-expressing information', '2.D': 'Properties across representations', '2.E': 'Functions and their derivatives',
  '3.B': 'Choosing a theorem or test', '3.C': 'Checking the hypotheses', '3.D': 'Applying a theorem or test',
  '3.E': 'Justifying conclusions', '3.F': 'Meaning in context', '3.G': 'Checking the answer', '4.A': 'Precise language',
  '4.B': 'Units', '4.C': 'Notation', '4.D': 'Graphing', '4.E': 'Rounding'},
 'apush': {'1.A': 'Identifying a development', '1.B': 'Explaining a development', '2.A': 'Sourcing: identifying',
  '2.B': 'Sourcing: explaining', '2.C': 'Sourcing: significance and limits', '3.A': "A source's claim", '3.B': "A source's evidence",
  '3.C': 'Comparing two sources', '3.D': 'How evidence bears on an argument', '4.A': 'Identifying context', '4.B': 'Explaining context',
  '5.A': 'Spotting connections', '5.B': 'Explaining connections', '6.A': 'A defensible claim', '6.B': 'Supporting with evidence',
  '6.C': 'Reasoning with evidence', '6.D': 'Complex argument'},
 'lang': {'1.A': 'The rhetorical situation', '1.B': 'Reading for audience', '2.A': 'Introductions and conclusions',
  '2.B': 'Writing for an audience', '3.A': 'Claims and evidence', '3.B': 'Finding the thesis', '3.C': 'How claims are qualified',
  '4.A': 'Claim-and-evidence paragraphs', '4.B': 'Writing a thesis', '4.C': 'Qualifying a claim', '5.A': 'Line of reasoning',
  '5.B': 'Organization and coherence', '5.C': 'Methods of development', '6.A': 'Writing the line of reasoning', '6.B': 'Transitions',
  '6.C': 'Using methods of development', '7.A': 'Tone and style', '7.B': 'Clauses and ideas', '7.C': 'Grammar and effect',
  '8.A': 'Writing for tone and style', '8.B': 'Clear sentences', '8.C': 'Grammar and mechanics'},
 'french': {'1.A': 'Explicit meaning', '1.B': 'Interpreting meaning', '1.C': 'Synthesis and inference',
  '2.A': 'Purpose and context', '2.B': 'Being understood', '2.C': 'Sharing ideas and opinions',
  '2.D': 'Organization and rhetoric', '3.A': 'Cultural connections'},
}
G = os.path.dirname(os.path.abspath(__file__)); ROOT = '/home/user/JuniorYearFlashcardsApp'
for c in ['chem', 'calcbc', 'apush', 'lang', 'french']:
    sk = json.load(open(f'{G}/../ced/{c}.skeleton.json', encoding='utf-8'))
    path = f'{ROOT}/data/{c}.json'; d = json.load(open(path, encoding='utf-8'))
    used = {x.get('s') for x in d['cards'] if x.get('s')}
    out = []
    for s in sk.get('skills', []):
        if s['code'] not in used: continue
        name = re.sub(r'\s*\(not assessed\)\.?$', '.', s['name']).strip()
        for j in JUNK: name = re.sub(j, '', name)
        name = name.replace('offunctions', 'of functions')
        short = SHORT.get(c, {}).get(s['code'])
        assert short, f'no short label for {c} {s["code"]}'
        out.append({'code': s['code'], 'name': name, 'short': short, 'group': s.get('practice') or s.get('category') or ''})
    d['skills'] = out
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(c, len(out), 'skills')
print(subprocess.run(['python3', f'{ROOT}/src/scripts/stamp_index.py'], capture_output=True, text=True).stdout.strip())
