# Six Ladders → AP Decks: import spec

Written for the Traffic1 session. Everything here is live on this branch
(`claude/flashcards-settings-redesign-1wj8tl`) and on `main` once merged;
the site is https://myfleshcards.vercel.app.

## 1. What "only visible with my account ID" means in this app

There is no user database. An **account is a token**: a 16–128 character
string of `[A-Za-z0-9_-]`. The user pastes it once in *Settings → Sync*
(or opens the site as `https://myfleshcards.vercel.app/#t=TOKEN`). It lives
only in the device's localStorage (`apdecks.v1.tok`); the server's
`SYNC_TOKEN` env var allows it for progress sync. The token itself is never
committed anywhere.

A deck is made private with one field on its entry in `data/index.json`:

```json
"owner": "<16 lowercase hex digits>"
```

**Owner id** = the first 16 hex digits of `sha256("apdecks-owner:" + token)`.
A device whose token hashes to that id shelves the deck (deck list, review,
search, progress, card counts). Every other device never lists it, never
counts it, and never fetches it. Courses without `owner` are public as before.

This is a gate on the shelf, not encryption: `data/sixladders.json` is still
a static file anyone could open by URL. If real secrecy is ever needed, the
upgrade path is to serve the deck from `/api` behind the same Bearer token
(Vercel Blob), which the sync function already does for progress. Not built
now.

**How the user gets their ID.** Settings → Sync → paste the token → an
**ID** row appears under Sync showing the 16 hex digits; tapping it copies
them. Ask the user for the *ID*, never the token. If they have not set a
token yet, they invent one (any 16–128 chars of `[A-Za-z0-9_-]`), paste it,
and read the ID. That same token later becomes `SYNC_TOKEN` in Vercel for
cross-device sync.

Equivalent offline derivation (their machine, token never leaves it):

```sh
node -e 'console.log(require("crypto").createHash("sha256").update("apdecks-owner:"+process.argv[1]).digest("hex").slice(0,16))' TOKEN
```

## 2. Format and destination

Repository `21AG21/JuniorYearFlashcardsApp`. Cut a branch
`claude/six-ladders-deck` from `main` and push it; tell the user. The
flashcards session runs its harness and merges to `main` (Vercel deploys
`main` to production automatically). Push straight to `main` only if the
user says so.

Three files change:

1. **`data/sixladders.json`** — the deck (schema below). New file.
2. **`data/index.json`** — append one course object to `courses`. Leave
   `total` alone; the app recomputes it per device from what is shelved.
   The file is one long line today; pretty-printed is fine too.
3. **`sw.js`** — bump `VERSION` (`'apdecks-v40'` → `'apdecks-v41'`).
   `index.json` is precached, so installed PWAs never see the new entry
   without a bump. Do **not** add `./data/sixladders.json` to `ASSETS`
   (that would precache the private deck on every device).

Nothing else: no app code, no games (games are hand-written per deck).

### 2a. Index entry (`data/index.json` → `courses[]`)

```json
{
  "id": "sixladders",
  "name": "Six Ladders",
  "short": "Ladders",
  "abbr": "ML",
  "blurb": "Machine learning, six rungs up",
  "count": 420,
  "owner": "0123456789abcdef",
  "units": [
    { "id": "l1", "n": 1, "title": "Foundations", "weight": "Lessons 1–6", "count": 70 }
  ]
}
```

| field | type | rule |
|---|---|---|
| `id` | string | `sixladders`, lowercase, matches the file name |
| `name` | string | full name |
| `short` | string | the name shown in the deck list (≤ 10 chars) |
| `abbr` | string | 2–4 caps |
| `blurb` | string | one line, ≤ 40 chars |
| `count` | int | exact number of cards in the deck file |
| `owner` | string | the user's 16-hex ID |
| `units[]` | array | same objects as `units` in the deck file, same order |

### 2b. Deck file (`data/sixladders.json`)

```json
{
  "id": "sixladders",
  "name": "Six Ladders",
  "short": "Ladders",
  "abbr": "ML",
  "blurb": "Machine learning, six rungs up",
  "units": [
    { "id": "l1", "n": 1, "title": "Foundations", "weight": "Lessons 1–6", "count": 70 }
  ],
  "cards": [
    {
      "i": "3f9a1c07e2",
      "u": "l1",
      "t": "Gradient descent",
      "v": "DEFINE",
      "q": "Define the learning rate in gradient descent.",
      "a": "The step size that scales each update: $\\theta \\leftarrow \\theta - \\eta \\nabla L(\\theta)$. Too large diverges, too small crawls.",
      "h": "→ one sentence + the update rule",
      "n": "Most training failures are a learning-rate problem before they are a model problem.",
      "c": 1,
      "x": ["step size", "eta"]
    }
  ]
}
```

Unit object:

| field | type | rule |
|---|---|---|
| `id` | string | short lowercase, unique in the deck (`l1` … `l9`) |
| `n` | int | 1-based order |
| `title` | string | ≤ 60 chars |
| `weight` | string | small caption under the title; lesson range or share |
| `count` | int | exact number of cards with this `u` |

Card object (every key present on every card; use `null` for an empty `x`):

| field | type | rule |
|---|---|---|
| `i` | string | **10 lowercase hex, unique across the whole app** (4 097 ids exist). Derive: `sha256("sixladders|" + u + "|" + q).hexdigest()[:10]` |
| `u` | string | a unit `id` from `units` |
| `t` | string | topic label shown with the card (lesson short name, ≤ 30 chars) |
| `v` | string | one of `DEFINE STATE EXPLAIN IDENTIFY NAME RECALL CONTRAST APPLY DECIDE` (caps) |
| `q` | string | the prompt, ≤ 200 chars |
| `a` | string | the answer, ≤ 400 chars (over 360 renders tiny) |
| `h` | string | hint shown before reveal on request; starts with `→ ` and names the shape of the answer |
| `n` | string | note shown after reveal (why it matters, the trap); also the "why" line in games. ≤ 200 chars |
| `c` | 0 or 1 | 1 = core / high-yield (the app's "core first" and high-yield filters use it) |
| `x` | array or null | alternate acceptable answers for typed mode (short strings) |

Text rules: plain text only. No markdown, no `**bold**`, no bullet markers,
no code blocks, no HTML. Unicode is fine (→ ≤ ≈ ∞ subscripts). Inline math
goes in `$…$` and is rendered by a 4 KB in-house renderer that supports only:
`\frac \sqrt ^ _ \int \sum \prod \lim \left \right`, Greek letters, function
names (`\sin \ln \log \max …`), and common symbols (`\to \le \ge \ne \approx
\cdot \times \pm \partial \nabla \infty \in`). No `\begin`, no matrices, no
display math, no `\text{}`. Anything unknown renders literally. Keep
formulas short; prefer words when a formula would need a matrix.

Validation to run before pushing (Python 3, from the repo root):

```python
import json, re, glob
d = json.load(open('data/sixladders.json'))
ix = json.load(open('data/index.json'))
ent = [c for c in ix['courses'] if c['id'] == 'sixladders'][0]
seen = set()
for f in glob.glob('data/*.json'):
    j = json.load(open(f))
    if isinstance(j, dict) and 'cards' in j and j['id'] != 'sixladders':
        seen |= {c['i'] for c in j['cards']}
units = {u['id'] for u in d['units']}
V = {'DEFINE','STATE','EXPLAIN','IDENTIFY','NAME','RECALL','CONTRAST','APPLY','DECIDE'}
for c in d['cards']:
    assert re.fullmatch(r'[0-9a-f]{10}', c['i']) and c['i'] not in seen, c['i']; seen.add(c['i'])
    assert c['u'] in units and c['v'] in V, c
    assert set(c) == {'i','u','t','v','q','a','h','n','c','x'}, c
    assert c['c'] in (0, 1) and (c['x'] is None or isinstance(c['x'], list))
    assert '**' not in c['q'] + c['a'] and '\n' not in c['q']
for u in d['units']:
    assert u['count'] == sum(c['u'] == u['id'] for c in d['cards']), u
assert ent['count'] == len(d['cards']) and ent['units'] == d['units']
assert re.fullmatch(r'[0-9a-f]{16}', ent['owner'])
print('ok', len(d['cards']), 'cards')
```

## 3. Which content makes the best cards

The app is a spaced-repetition prompt → answer engine with a hint, a
post-reveal note, and typed-answer alternates. Best fit, in order:

1. **The ~125 check-yourself questions** — already Q→A. `v` from the
   question's verb; the answer's key phrase in `x`.
2. **The 125-term glossary** — one `DEFINE` card each ("Define X."), the
   term's aliases in `x`, `c: 1` for terms the course leans on.
3. **Study-guide takeaways and formulas** — for each resource, three
   `RECALL`/`STATE` cards ("State the first takeaway of X", or better,
   rephrase each takeaway as its own question); every formula as a `STATE`
   card with the formula in `$…$` as the answer.
4. **Six-level explanations** — prose, not cards. At most one `EXPLAIN` card
   per lesson: the high-school-level explanation as `a`, the undergrad level
   condensed to one sentence as `n`. Skip the age-5 and PhD levels.
5. **Walkthrough code steps** — skip. There is no code rendering.

Aim for **350–500 cards**. Units: **6–9**, mirroring the course's own
sections (not one per lesson — 39 units makes a long list). Set `t` to the
lesson's short name so a card says where it came from.

## 4. What happens after the push

The flashcards session validates (script above plus its Playwright harness),
merges to `main`, and confirms the Vercel deployment is READY. On the user's
devices with the token set, "Ladders" appears in the deck list on the next
open; everyone else sees exactly what they see today.
