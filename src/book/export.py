"""Six Ladders: markdown -> lossless block structure for the AP Decks reader.

    python src/book/export.py            # rebuilds the `book` inside data/sixladders.json

Source of truth: src/book/24_APPRENTICESHIP_SIX_LEVELS.md (the course), plus
extra-terms.json, term-levels/*.json (six-level explanations of every term) and
edits.json (reviewer rewrites applied to the built book). The parser is lossless
for the markdown the course uses: headings, paragraphs, lists, fenced code,
`**Name.**` section marks, `_Lead._` paragraphs, <details> question blocks —
and, inside a phase's Build / Done when / Pitfalls and inside the front-matter
pages, `#### \`path\` · kind · status` file blocks that hold a file's contract.
"""
import re, json, hashlib, sys, os
import glob as _glob
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = HERE / '24_APPRENTICESHIP_SIX_LEVELS.md'
DECK = ROOT / 'data' / 'sixladders.json'
OUT = HERE / 'build' / 'book.json'
LEVELS = ['Age 5', 'Middle school', 'High school', 'Stanford undergrad', 'Stanford grad', 'PhD at Apple']
# the pages before Phase 0 and after Phase 11 that are not phases: their ids in the reader
ABOUT = {'Six rules': 'rules', 'The project, laid out': 'layout', 'How to study so it sticks': 'habits'}
lines = open(SRC, encoding='utf-8').read().split('\n')

# ---- pass 1: tokens (fence-aware) ------------------------------------------
# token kinds: h1/h2/h3/h4 (text), code (lang, text), blank, line (text)
toks = []
i = 0
while i < len(lines):
    ln = lines[i]
    if ln.startswith('```'):
        lang = ln[3:].strip(); buf = []; i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            buf.append(lines[i]); i += 1
        toks.append(('code', lang, '\n'.join(buf))); i += 1; continue
    m = re.match(r'^(#{1,4}) (.*)$', ln)
    if m: toks.append(('h%d' % len(m.group(1)), m.group(2).strip()))
    elif ln.strip() == '': toks.append(('blank',))
    elif re.match(r'^\s*<!--.*-->\s*$', ln): toks.append(('blank',))      # a splice marker is not text
    else: toks.append(('line', ln))
    i += 1

# ---- pass 2: group lines into blocks within a flat stream --------------------
# block kinds: p (text), ul (items), ol (items), code (lang,text), mark (name, text)
# where mark is a bold-line section marker **Name.** optional text, and
# italic-lead paragraphs (_Try this._ text) become p with lead.
MARK = re.compile(r'^\*\*([^*]+?)\.\*\*\s*(.*)$')
LEAD = re.compile(r'^_([A-Z][^_]{2,40}?)\._\s*(.*)$')
def flush_para(buf, out):
    if not buf: return
    text = ' '.join(s.strip() for s in buf).strip()
    m = LEAD.match(text)
    if m: out.append({'t': 'p', 'lead': m.group(1), 's': m.group(2)})
    else: out.append({'t': 'p', 's': text})
    buf.clear()

def blocks_from(tokens):
    out = []; para = []; lst = None
    for tk in tokens:
        k = tk[0]
        if k == 'blank':
            flush_para(para, out); lst = None; continue
        if k == 'code':
            flush_para(para, out); lst = None
            out.append({'t': 'code', 'lang': tk[1], 's': tk[2]}); continue
        if k.startswith('h'):
            flush_para(para, out); lst = None
            out.append({'t': k, 's': tk[1]}); continue
        s = tk[1]
        mm = MARK.match(s.strip())
        if mm:
            flush_para(para, out); lst = None
            out.append({'t': 'mark', 'name': mm.group(1), 's': mm.group(2).strip()}); continue
        mu = re.match(r'^\s*[-*] (.*)$', s); mo = re.match(r'^\s*(\d+)\. (.*)$', s)
        if mu or mo:
            flush_para(para, out)
            kind = 'ul' if mu else 'ol'
            item = (mu or mo).group(2 if mo else 1) if mo else mu.group(1)
            if lst is None or lst['t'] != kind:
                lst = {'t': kind, 'items': []}; out.append(lst)
            lst['items'].append(item.strip()); continue
        if lst is not None and s.startswith('  '):      # continuation of a list item
            lst['items'][-1] += ' ' + s.strip(); continue
        lst = None
        if s.strip().startswith('<details>') or s.strip().startswith('</details>'):
            flush_para(para, out); out.append({'t': 'html', 's': s.strip()}); continue
        ms = re.match(r'^\s*<summary>(.*)</summary>\s*$', s)
        if ms:
            flush_para(para, out); out.append({'t': 'summary', 's': ms.group(1).strip()}); continue
        st = s.strip()
        if not para and re.fullmatch(r'_[^_].*_', st) and not LEAD.match(st):
            out.append({'t': 'meta', 's': st[1:-1].strip()}); continue
        para.append(s)
    flush_para(para, out)
    return out

blocks = blocks_from(toks)

# ---- pass 3: fold <details> into q/a blocks ---------------------------------
folded = []
j = 0
while j < len(blocks):
    b = blocks[j]
    if b['t'] == 'html' and b['s'] == '<details>':
        q = None; a = []
        j += 1
        while j < len(blocks) and not (blocks[j]['t'] == 'html' and blocks[j]['s'] == '</details>'):
            bb = blocks[j]
            if bb['t'] == 'summary': q = bb['s']
            else: a.append(bb)
            j += 1
        if any(x['t'] == 'mark' for x in a): folded.extend(a)      # a study guide, opened flat
        else: folded.append({'t': 'qa', 'q': q, 'a': a})
        j += 1; continue
    folded.append(b); j += 1
blocks = folded

# ---- pass 4: build the book --------------------------------------------------
book = {'about': [], 'phases': []}
phase = None; sec = None; holder = None   # holder: dict receiving 'sections'
cur_file = None                           # an open `#### file` block, if any
def new_section(name, first_text=None):
    s = {'k': name, 'b': []}
    if first_text: s['b'].append({'t': 'p', 's': first_text})
    return s

def push_block(b):
    global sec
    if holder is None: return
    if cur_file is not None: cur_file['b'].append(b); return
    if sec is None:
        sec = new_section('intro'); holder['sections'].append(sec)
    sec['b'].append(b)

def in_after():
    """inside a phase's Build / Done when / Pitfalls"""
    return phase is not None and holder is phase and sec is not None and any(sec is s for s in phase['after'])
def in_about():
    """inside one of the front-matter pages"""
    return phase is None and holder is not None

def file_block(text):
    """`path` · kind · status  ->  {'t':'file','name':path,'tag':'kind · status'}
    A heading may name two files (`.env` and `.env.example`): the name keeps
    the words, the backticks go."""
    parts = [p.strip() for p in text.split('·')]
    return {'t': 'file', 'name': parts[0].replace('`', '').strip(), 'tag': ' · '.join(parts[1:]), 'b': []}

cur_h2 = None
for b in blocks:
    t = b['t']
    if t == 'h1': continue
    if t == 'h2':
        cur_file = None
        cur_h2 = b['s']
        m = re.match(r'^Phase (\d+): (.*)$', cur_h2)
        if m:
            phase = {'n': int(m.group(1)), 'title': m.group(2), 'meta': '', 'sections': [], 'items': [], 'resources': [], 'after': []}
            book['phases'].append(phase); holder = phase; sec = None
        elif cur_h2 in ABOUT:
            holder = {'sections': []}; sec = None; phase = None
            book['about'].append({'title': cur_h2, 'id': ABOUT[cur_h2], 'holder': holder})
        else:
            holder = None; sec = None; phase = None
        continue
    if holder is None and phase is None: continue
    if t == 'h3':
        cur_file = None
        s = b['s']
        if phase is None:
            # inside a front-matter page: "What really good looks like", "The tree"
            sec = new_section('h3', None); sec['title'] = s; holder['sections'].append(sec); continue
        mi = re.match(r'^(Lesson (\d+)|Topic): (.*)$', s)
        if mi:
            item = {'id': None, 'kind': 'lesson' if mi.group(2) else 'topic', 'n': int(mi.group(2)) if mi.group(2) else None,
                    'title': mi.group(3), 'sections': []}
            phase['items'].append(item); holder = item; sec = None; continue
        if s.startswith('Read and watch'):
            holder = {'sections': []}; sec = None; phase['_readwatch'] = holder; continue
        if s in ('Build', 'Done when', 'Pitfalls', 'What you need to learn'):
            sec = new_section(s.lower().replace(' ', '-')); phase['after' if s != 'What you need to learn' else 'sections'].append(sec)
            holder = phase; continue
        sec = new_section('h3'); sec['title'] = s; holder['sections'].append(sec); continue
    if t == 'h4':
        if in_after() or in_about():
            # a file's contract: everything up to the next heading belongs to it
            fb = file_block(b['s'])
            cur_file = None; push_block(fb); cur_file = fb; continue
        cur_file = None
        ml = re.match(r'^\[(.*)\]\((.*)\)$', b['s'])
        res = {'id': None, 'title': ml.group(1) if ml else b['s'], 'url': ml.group(2) if ml else '', 'sections': []}
        phase['resources'].append(res); holder = res; sec = None; continue
    if t == 'meta':
        if cur_file is not None: push_block({'t': 'p', 's': b['s']}); continue
        if holder is phase and not phase['meta']: phase['meta'] = b['s']
        elif 'title' in holder and not holder.get('lives'): holder['lives'] = b['s']
        else: push_block({'t': 'p', 's': b['s']})
        continue
    if t == 'mark':
        name = b['name']
        if cur_file is not None or in_after():
            # a bold lead inside a file contract or a build list is a label, not a new section
            push_block({'t': 'h4', 's': name})
            if b['s']: push_block({'t': 'p', 's': b['s']})
            continue
        if name in LEVELS: sec = new_section('level'); sec['name'] = name
        elif re.match(r'^Step \d+$', name): sec = new_section('step'); sec['n'] = int(name.split()[1])
        else: sec = new_section(name.lower().replace(' ', '-').replace(',', ''))
        holder['sections'].append(sec)
        if b['s']: sec['b'].append({'t': 'p', 's': b['s']})
        continue
    push_block(b)

# ids, unit mapping, card links
deck = json.load(open(DECK, encoding='utf-8'))
unit_of_phase = {}
for u in deck['units']:
    for n in re.findall(r'\d+', u['weight']): unit_of_phase[int(n)] = u['id']
by_q = {}
for c in deck['cards']: by_q.setdefault(c['q'].strip().rstrip('.').lower(), c['i'])
def cid(u, q): return hashlib.sha256(('sixladders|' + u + '|' + q).encode()).hexdigest()[:10]
card_ids = {c['i'] for c in deck['cards']}
matched = total_q = 0
for ph in book['phases']:
    ph['u'] = unit_of_phase[ph['n']]
    for k, it in enumerate(ph['items']):
        it['id'] = 'p%d-%s' % (ph['n'], ('l%d' % it['n']) if it['n'] else 't%d' % (k + 1))
        it['u'] = ph['u']; it['pn'] = ph['n']
        ids = []
        for s in it['sections']:
            if s['k'] == 'check-yourself':
                for b in s['b']:
                    if b['t'] == 'qa':
                        total_q += 1
                        q = b['q']
                        i1 = cid(ph['u'], q)
                        if i1 in card_ids: b['card'] = i1
                        else:
                            i2 = by_q.get(q.strip().rstrip('.').lower())
                            if i2: b['card'] = i2
                        if b.get('card'): matched += 1; ids.append(b['card'])
        it['cards'] = ids
    for k, r in enumerate(ph['resources']):
        r['id'] = 'p%d-r%d' % (ph['n'], k + 1)
    ph.pop('_readwatch', None)
for a in book['about']:
    a['sections'] = a.pop('holder')['sections']

# ---- the term book: the glossary, plus extra terms, matched into every page ----
g0 = next(i for i, l in enumerate(lines) if l.startswith('## Glossary'))
terms = []; group = None
for l in lines[g0:]:
    if l.startswith('### '): group = l[4:].strip(); continue
    mg = re.match(r'^- \*\*(.+?)\.\*\* (.*)$', l)
    if mg: terms.append({'raw': mg.group(1), 'def': mg.group(2).strip(), 'group': group})
EXTRA = HERE / 'extra-terms.json'
if EXTRA.exists():
    for e in json.load(open(EXTRA, encoding='utf-8')):
        terms.append({'raw': e['term'], 'def': e.get('def', ''), 'group': e.get('group', 'More words'), 'names': e.get('names'),
                      **({'phases': e['phases']} if e.get('phases') else {})})
def tnames(raw):
    raw = raw.replace('`', '')
    parts = re.split(r'\s*/\s*|\s*\(|\)|,\s*', raw)
    out = []
    for q in parts:
        q = q.strip().rstrip('.')
        q = re.sub(r'\([^)]*\)$', '', q).strip()
        if len(q) >= 2 or q in ('τ', '|'): out.append(q)
    return out or [raw]
def slug(x): return re.sub(r'[^a-z0-9]+', '-', x.lower()).strip('-')[:40]
seen_ids = set()
for t in terms:
    t['names'] = t.get('names') or tnames(t['raw'])
    t['term'] = t['raw'].replace('`', '')
    base = slug(t['names'][0]) or 'term'; tid = base; k = 2
    while tid in seen_ids: tid = base + '-' + str(k); k += 1
    seen_ids.add(tid); t['id'] = tid
    t['levels'] = t.get('levels', [])
lv = {}
for f in sorted(_glob.glob(str(HERE / 'term-levels' / 'term-levels-*.json'))):
    try: lv.update(json.load(open(f, encoding='utf-8')))
    except Exception as ex: print('skipped', os.path.basename(f), ex)
for t in terms:
    e2 = lv.get(t['id'])
    if not e2: continue
    ls = [s for s in (e2.get('levels') or []) if isinstance(s, str) and s.strip()]
    if len(ls) == 6: t['levels'] = ls
    if e2.get('def') and not t['def']: t['def'] = e2['def'].strip()
# Two entries for one word would both claim it in the text and both appear in the
# list. The first one wins and takes the other's aliases.
kept, alias_of, merged = [], {}, 0
for t in terms:
    hit = None
    for n in t['names']:
        k = n.lower().strip()
        if k in alias_of: hit = alias_of[k]; break
    if hit is not None and (t.get('phases') or hit.get('phases')): hit = None    # different senses, both stay
    if hit is None:
        kept.append(t)
        for n in t['names']: alias_of.setdefault(n.lower().strip(), t)
    else:
        merged += 1
        for n in t['names']:
            if n.lower() not in [x.lower() for x in hit['names']]: hit['names'].append(n)
            alias_of.setdefault(n.lower().strip(), hit)
        if not hit.get('levels') and t.get('levels'): hit['levels'] = t['levels']
        if not hit.get('def') and t.get('def'): hit['def'] = t['def']
terms = kept
if merged: print('merged duplicate term entries:', merged)

def term_rx(t):
    alts = []
    for n in t['names']:
        e = re.escape(n)
        if len(n) <= 3 or (n.upper() == n and re.search('[A-Z]{2}', n)):
            alts.append('(?-i:' + e + ')')          # AP, WHERE, GPU: their own case only
        else: alts.append(e + '(?:s|es)?')
    return re.compile(r'(?<![\w.])(?:' + '|'.join(alts) + r')(?![\w])', re.I)
NOMARK = {'mean', 'for', 'while', 'if', 'else', 'break', 'def', 'return', 'none', 'zip', 'enumerate',
          'range', 'sorted', 'len', 'sum', 'map', 'filter', 'format', 'class', 'apply', 'forward',
          'backward', 'index', 'over', 'try', 'except', 'linear', 'unit', 'token', 'free flow', 'prior'}
for t in terms:
    t['_rx'] = term_rx(t)
    if t['names'][0].lower() in NOMARK: t['nomark'] = 1
def texts_of(secs):
    out = []
    def w(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('id', 'u', 'k', 't', 'kind', 'card', 'lang', 'name', 'lead', 'tag'): continue
                if isinstance(v, str): out.append(v)
                else: w(v)
        elif isinstance(o, list):
            for v in o: out.append(v) if isinstance(v, str) else w(v)
    w(secs); return out
def match_terms(obj, keys, phase_n=None):
    blob = '\n'.join(texts_of([obj.get(k) for k in keys if obj.get(k)]))
    # "for", "if", "mean": only the code on the page means the keyword
    code = '\n'.join(re.findall(r'`([^`]+)`', blob)) + '\n' + '\n'.join(
        b['s'] for k in keys for s in (obj.get(k) or []) if isinstance(s, dict)
        for b in s.get('b', []) if b.get('t') == 'code')
    found = []
    for t in terms:
        if t.get('phases') and phase_n is not None and phase_n not in t['phases']: continue
        m = t['_rx'].search(code if t.get('nomark') else blob)
        if m: found.append((m.start(), t))
    # one word, two senses: on a phase a scoped term names, it takes the word
    scoped = set()
    for _, t in found:
        if t.get('phases'): scoped |= {n.lower() for n in t['names']}
    out = []
    for at, t in sorted(found, key=lambda x: x[0]):
        if not t.get('phases') and {n.lower() for n in t['names']} & scoped: continue
        out.append(t['id'])
    obj['terms'] = out
n_links = 0
for ph in book['phases']:
    match_terms(ph, ['sections', 'after', 'title'], ph['n']); n_links += len(ph['terms'])
    for it in ph['items']: match_terms(it, ['sections', 'title', 'lives'], ph['n']); n_links += len(it['terms'])
    for r in ph['resources']: match_terms(r, ['sections', 'title'], ph['n']); n_links += len(r['terms'])
for a in book['about']:
    match_terms(a, ['sections', 'title']); n_links += len(a['terms'])
book['terms'] = [{k: v for k, v in t.items() if k not in ('_rx', 'raw')} for t in terms]
print('terms', len(terms), 'with levels', sum(1 for t in terms if t['levels']), 'term links across pages', n_links)

# ---- the reviewers' rewrites, applied to the built book ------------------------
EDITS = HERE / 'edits.json'
applied = missed = 0
if EDITS.exists():
    ed = json.load(open(EDITS, encoding='utf-8'))
    index = {}
    for ph in book['phases']:
        index['phase-%d' % ph['n']] = ph
        for it in ph['items']: index[it['id']] = it
        for r in ph['resources']: index[r['id']] = r
    tindex = {t['id']: t for t in terms}
    def norm(x):
        x = re.sub(r'^\s*\[[^\]]{2,40}\]\s*', '', x.strip())   # a lead label from the reading dump
        x = re.sub(r'^\s*[-*]\s+', '', x)                        # a list bullet
        x = re.sub(r'^\s*Q:\s*', '', x)
        return re.sub(r'\s+', ' ', x).strip()
    def edit_blocks(bs, old, new):
        n = 0
        for b in bs:
            if b['t'] == 'p' and norm(b['s']) == old: b['s'] = new; n += 1
            elif b['t'] in ('ul', 'ol'):
                for i, x in enumerate(b['items']):
                    if norm(x) == old: b['items'][i] = new; n += 1
            elif b['t'] == 'qa':
                if norm(b['q']) == old: b['q'] = new; n += 1
                n += edit_blocks(b['a'], old, new)
            elif b['t'] == 'file':
                n += edit_blocks(b['b'], old, new)
        return n
    LNAMES = ['Age 5', 'Middle school', 'High school', 'Stanford undergrad', 'Stanford grad', 'PhD at Apple']
    for e2 in ed:
        n = 0
        e2 = dict(e2); e2['old'] = norm(e2['old']); e2['new'] = norm(e2['new'])
        t = tindex.get(e2['where'])
        if t and e2.get('level') in LNAMES:                     # a rung of a term
            i = LNAMES.index(e2['level'])
            if len(t['levels']) == 6 and norm(t['levels'][i]) == e2['old']: t['levels'][i] = e2['new']; n = 1
        elif t and norm(t.get('def', '')) == e2['old']: t['def'] = e2['new']; n = 1
        else:
            o = index.get(e2['where'])
            if o:
                for s in o.get('sections', []) + o.get('after', []):
                    n += edit_blocks(s['b'], e2['old'], e2['new'])
        if not n:
            # a reviewer may quote one sentence out of a paragraph: replace it in
            # place, but only where the page carries that sentence exactly once
            rx = re.compile(r'\s+'.join(re.escape(w) for w in e2['old'].split()))
            o = index.get(e2['where'])
            if o:
                spots = []
                def scan(bs):
                    for b in bs:
                        if b['t'] == 'p' and rx.search(b['s']): spots.append((b, 's', None))
                        elif b['t'] in ('ul', 'ol'):
                            for i2, x in enumerate(b['items']):
                                if rx.search(x): spots.append((b, 'items', i2))
                        elif b['t'] == 'qa': scan(b['a'])
                        elif b['t'] == 'file': scan(b['b'])
                for s in o.get('sections', []) + o.get('after', []): scan(s['b'])
                if len(spots) == 1:
                    b, key, i2 = spots[0]
                    if key == 's': b['s'] = rx.sub(e2['new'], b['s'], count=1)
                    else: b['items'][i2] = rx.sub(e2['new'], b['items'][i2], count=1)
                    n = 1
        if not n:
            # the text may live on a neighbouring page (a phase's build list, say):
            # take it only when exactly one page in the whole book carries it
            hits = []
            for key, o in index.items():
                for s in o.get('sections', []) + o.get('after', []):
                    if edit_blocks([b for b in s['b']], e2['old'], e2['old']): hits.append((o, s))
            if len(hits) == 1:
                n = edit_blocks(hits[0][1]['b'], e2['old'], e2['new'])
        applied += 1 if n else 0
        missed += 0 if n else 1
        if not n: print('  edit missed:', e2['where'], '|', e2['old'][:60])
    print('edits applied', applied, 'missed', missed)
    book['edited'] = [e2['old'] for e2 in ed]

# ---- audit --------------------------------------------------------------------
probs = []
n_items = sum(len(p['items']) for p in book['phases']); n_res = sum(len(p['resources']) for p in book['phases'])
n_steps = n_try = n_misc = 0
def level_names(x): return [s['name'] for s in x['sections'] if s['k'] == 'level']
for ph in book['phases']:
    if not ph['meta']: probs.append(('phase meta', ph['n']))
    if not any(s['k'] == 'goal' for s in ph['sections']): probs.append(('phase goal', ph['n']))
    if not any(s['k'] == 'what-you-need-to-learn' for s in ph['sections']): probs.append(('phase learn', ph['n']))
    for need in ('build', 'done-when', 'pitfalls'):
        if not any(s['k'] == need and s['b'] for s in ph['after']): probs.append(('phase after', ph['n'], need))
    for it in ph['items'] + ph['resources']:
        ln = level_names(it)
        if ln != LEVELS: probs.append(('levels', it['id'], ln))
        kinds = [s['k'] for s in it['sections']]
        if 'level' in kinds:
            last_level = max(i for i, k in enumerate(kinds) if k == 'level')
            first_do = min([i for i, k in enumerate(kinds) if k in ('guided-walkthrough', 'step', 'check-yourself', 'practice')] or [len(kinds)])
            if first_do < last_level: probs.append(('order', it['id']))
        for s in it['sections']:
            if s['k'] == 'level':
                if not any(b['t'] == 'p' and not b.get('lead') for b in s['b']): probs.append(('empty level', it['id'], s['name']))
                n_try += sum(1 for b in s['b'] if b.get('lead') == 'Try this')
            if s['k'] == 'step':
                n_steps += 1
                leads = [b.get('lead') for b in s['b']]
                if 'Before you do this' not in leads or 'Do this' not in leads: probs.append(('step leads', it['id'], s['n'], leads))
            if s['k'] == 'misconceptions': n_misc += 1
    for r in ph['resources']:
        ks = [s['k'] for s in r['sections']]
        for need in ('what-it-covers', 'key-ideas-in-order', 'formulas-and-commands-to-remember', 'three-takeaways', 'practice'):
            if need not in ks: probs.append(('resource field', r['id'], need))
# every file block has a name and something in it
n_files = 0
def walk_files(bs, where):
    global n_files
    for b in bs:
        if b['t'] == 'file':
            n_files += 1
            if not b['name'] or not b['b']: probs.append(('empty file block', where, b['name']))
            walk_files(b['b'], where)
        elif b['t'] == 'qa': walk_files(b['a'], where)
for ph in book['phases']:
    for s in ph['after']: walk_files(s['b'], 'phase-%d' % ph['n'])
for a in book['about']:
    for s in a['sections']: walk_files(s['b'], a['id'])
# coverage: characters of prose in source phase span vs extracted
start = next(i for i, l in enumerate(lines) if l.startswith('## Phase 0')); end = next(i for i, l in enumerate(lines) if l.startswith('## How to study'))
src_chars = sum(len(l.strip()) for l in lines[start:end] if l.strip() and not l.startswith('```'))
def walk(o):
    if isinstance(o, dict): return sum(walk(v) for k, v in o.items() if k not in ('id', 'u', 'k', 't', 'kind', 'card', 'cards', 'n', 'lang'))
    if isinstance(o, list): return sum(walk(v) for v in o)
    if isinstance(o, str): return len(o)
    return 0
out_chars = walk(book['phases'])
print('items', n_items, 'resources', n_res, 'steps', n_steps, 'try-this', n_try, 'misconceptions', n_misc, 'check Qs', total_q, 'linked to cards', matched, 'file blocks', n_files)
print('source prose chars', src_chars, 'extracted chars', out_chars, 'ratio %.3f' % (out_chars / src_chars))
print('PROBLEMS', len(probs)); [print(' ', p) for p in probs[:25]]
OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(book, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
if probs or n_items != 39 or n_res != 145 or n_steps < 60 or n_try != 234 or len(book['about']) != 3:
    print('NOT MERGED'); sys.exit(1)
deck['book'] = book
json.dump(deck, open(str(DECK) + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('items with no matched terms:', [i['id'] for p in book['phases'] for i in p['items'] if not i['terms']])
os.replace(str(DECK) + '.tmp', DECK)
print('merged into', DECK)
sys.path.insert(0, str(ROOT / 'src' / 'scripts'))
from stamp_index import stamp
print('index stamps moved:', stamp(ROOT))
print('wrote', OUT, len(json.dumps(book, ensure_ascii=False)) // 1024, 'KB')
