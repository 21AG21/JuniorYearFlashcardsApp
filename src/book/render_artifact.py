"""Six Ladders: splice the rebuilt Build pages and the front-matter page into the
published artifact.

    python src/book/render_artifact.py TEMPLATE.html OUT.html

TEMPLATE is the artifact as published (Artifact read saves it); OUT is the page
to publish back. Everything on the template that is not a phase's Build page,
the "layout" page, the pager links around them, the contents entry, the page
count and the search index is left byte for byte as it was. The book comes from
data/sixladders.json, which src/book/export.py writes.
"""
import re, json, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
tpl_path, out_path = sys.argv[1], sys.argv[2]
h = open(tpl_path, encoding='utf-8').read()
book = json.load(open(ROOT / 'data' / 'sixladders.json', encoding='utf-8'))['book']

def esc(s): return html.escape(str(s or ''), quote=False)
def md(s):
    """the reader's inline markup: `code`, [text](url), **b**, _em_"""
    x = esc(s)
    x = re.sub(r'`([^`]+)`', lambda m: '<code>' + m.group(1) + '</code>', x)
    x = re.sub(r'\[([^\]]+)\]\((https?:[^)\s]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', x)
    x = re.sub(r'\*\*([^*<>]+)\*\*', r'<b>\1</b>', x)
    x = re.sub(r'(^|[\s(])_([^_<>]+)_(?=[\s.,;:)]|$)', r'\1<em>\2</em>', x)
    return x

def blocks(bs):
    out = []
    for b in bs or []:
        t = b.get('t')
        if t == 'p':
            if b.get('lead'): out.append('<p><b>' + esc(b['lead']) + '.</b>' + (' ' + md(b['s']) if b['s'] else '') + '</p>')
            else: out.append('<p>' + md(b['s']) + '</p>')
        elif t in ('ul', 'ol'):
            out.append('<' + t + ' class="learn">' + ''.join('<li>' + md(x) + '</li>' for x in b['items']) + '</' + t + '>')
        elif t == 'code':
            out.append('<pre><code>' + esc(b['s']) + '</code></pre>')
        elif t == 'qa':
            out.append('<details><summary>' + md(b['q']) + '</summary><div class="a">' + blocks(b['a']) + '</div></details>')
        elif t in ('h3', 'h4'):
            out.append('<div class="gk">' + md(b['s']) + '</div>')
        elif t == 'meta':
            out.append('<p class="note">' + md(b['s']) + '</p>')
        elif t == 'file':
            out.append('<div class="fb"><div class="fbh"><code class="fn">' + esc(b['name']) + '</code>' +
                       ('<span class="ft">' + esc(b['tag']) + '</span>' if b.get('tag') else '') + '</div>' + blocks(b['b']) + '</div>')
    return ''.join(out)

def section_span(id_):
    m = re.search(r'<section class="page sec" id="%s"[^>]*>' % re.escape(id_), h)
    if not m: raise SystemExit('no section ' + id_)
    e = h.find('</section>', m.end())
    return m.start(), m.end(), e

SECNAME = {'build': 'Build', 'done-when': 'Done when', 'pitfalls': 'Pitfalls'}
n_files = 0
def count_files(bs):
    global n_files
    for b in bs or []:
        if b.get('t') == 'file': n_files += 1; count_files(b['b'])

# ---- the twelve Build pages ---------------------------------------------------
for ph in book['phases']:
    sid = 'phase-%d-build' % ph['n']
    s, e0, e = section_span(sid)
    body = h[e0:e]
    nav = body[body.find('<nav class="pager"'):]
    lede = re.search(r'<p class="lede">(.*?)</p>', body).group(1)
    if 'href="#layout"' not in lede:
        lede += ' The page <a href="#layout">The project, laid out</a> holds the tree, the conventions and the constants every file below refers to.'
    rows = []
    for sec in ph['after']:
        cls = ' build' if sec['k'] == 'build' else ''
        rows.append('<div class="row' + cls + '"><h3>' + SECNAME.get(sec['k'], sec['k']) + '</h3>' + blocks(sec['b']) + '</div>')
        count_files(sec['b'])
    new_body = ('<div class="eyebrow">Phase %d · Build</div><h2>Build, done when, pitfalls</h2><p class="lede">%s</p>' % (ph['n'], lede)) + ''.join(rows) + nav
    h = h[:e0] + new_body + h[e:]

# ---- the front-matter page: The project, laid out ------------------------------
lay = next(a for a in book['about'] if a['id'] == 'layout')
for sec in lay['sections']: count_files(sec['b'])
parts = []
for sec in lay['sections']:
    if sec['k'] == 'h3': parts.append('<div class="row"><h3>' + md(sec.get('title', '')) + '</h3>' + blocks(sec['b']) + '</div>')
    else: parts.append(blocks(sec['b']).replace('<p>', '<p class="lede">', 1))
page = ('<section class="page sec" id="layout" data-pos="The project" data-title="The project, laid out" hidden>'
        '<div class="eyebrow">Before you start</div><h2>' + esc(lay['title']) + '</h2>' + ''.join(parts) +
        '<nav class="pager" aria-label="Previous and next page"><a class="prev" href="#rules"><span class="n">Previous</span><span class="t">Six rules</span></a>'
        '<a class="next" href="#phase-0"><span class="n">Next</span><span class="t">Phase 0: Setup and habits</span></a></nav></section>')
if 'id="layout"' in h:
    s, e0, e = section_span('layout'); h = h[:s] + page + h[e + len('</section>'):]
else:
    s, e0, e = section_span('rules'); at = e + len('</section>'); h = h[:at] + page + h[at:]
# the pages on either side point at it
s, e0, e = section_span('rules')
h = h[:s] + h[s:e].replace('<a class="next" href="#phase-0"><span class="n">Next</span><span class="t">Phase 0: Setup and habits</span></a>',
                          '<a class="next" href="#layout"><span class="n">Next</span><span class="t">The project, laid out</span></a>') + h[e:]
s, e0, e = section_span('phase-0')
h = h[:s] + h[s:e].replace('<a class="prev" href="#rules"><span class="n">Previous</span><span class="t">Six rules</span></a>',
                          '<a class="prev" href="#layout"><span class="n">Previous</span><span class="t">The project, laid out</span></a>') + h[e:]
# the contents pane
misc_rules = '<li><a href="#rules"><span class="n">Rules</span><span>Six rules</span></a></li>'
misc_layout = '<li><a href="#layout"><span class="n">Project</span><span>The project, laid out</span></a></li>'
if misc_layout not in h: h = h.replace(misc_rules, misc_rules + misc_layout, 1)
# the start page: a line in "How to use this" and a fact
use_anchor = '<div class="k">Learn each resource from its study guide</div>'
if 'Every file, laid out' not in h:
    i = h.find(use_anchor); j = h.find('</div></div>', i)
    h = h[:j] + ('<div class="k">Every file, laid out</div><div class="d"><p>The page <a href="#layout">The project, laid out</a> lists every file the course asks you to write, '
                 'the folder it lives in, the phase that writes it, and the numbers every file shares; each phase\'s Build page then holds the contract for its files: '
                 'what each reads and writes, what it must contain, how to run it and how to prove it right.</p></div>') + h[j:]
fact = '<div class="fact"><span class="k">Files specified</span><span class="v">%d</span><span class="c">every script, module, test and document, with its contract</span></div>' % n_files
h = re.sub(r'<div class="fact"><span class="k">Files specified</span>.*?</div>', '', h, count=1)
h = h.replace('<span class="k">Words defined</span>', '__WORDS__', 1)
h = h.replace('<div class="fact">__WORDS__', fact + '<div class="fact"><span class="k">Words defined</span>', 1)
# the page count in the pane's eyebrow
n_pages = len(re.findall(r'<section class="page', h))
h = re.sub(r'(\d+) pages</div>', '%d pages</div>' % n_pages, h, count=1)
# search: file names are findable
h = h.replace("p.querySelectorAll('.gloss .k')", "p.querySelectorAll('.gloss .k, .fn')", 1)
# styles for file contracts, once
CSS = ('/* file contracts on the Build pages and the layout page */\n'
       '.fb{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--hair-soft);padding-top:16px}\n'
       '.fbh{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px}\n'
       '.fbh .fn{font:600 15px/1.35 ui-monospace,"SF Mono",Menlo,monospace;color:var(--ink);letter-spacing:0;overflow-wrap:anywhere}\n'
       '.fbh .ft{font-size:13px;font-weight:600;color:var(--ink-soft)}\n'
       '.fb p,.fb li,.row.build>p,.row .learn li{font-size:15.5px;line-height:1.5;max-width:72ch}\n'
       '.fb p+p{margin-top:2px}\n'
       '.fb .gk{margin-top:4px}\n'
       '.fb pre,#layout pre{white-space:pre-wrap;overflow-wrap:anywhere}\n'
       '#layout .row .learn li,#layout .row p{font-size:15.5px;line-height:1.5;max-width:72ch}\n'
       '@container pane (min-width:880px){.fb p,.fb li,.row.build>p,.row .learn li,#layout .row p,#layout .row .learn li{max-width:80ch}}\n')
if '/* file contracts' not in h:
    h = h.replace('</style>\n<div id="app">', CSS + '</style>\n<div id="app">', 1)
assert '<div id="app">' in h and h.count('id="layout"') == 1
open(out_path, 'w', encoding='utf-8').write(h)
print('pages', n_pages, 'file blocks', n_files, 'bytes', len(h.encode('utf-8')))
