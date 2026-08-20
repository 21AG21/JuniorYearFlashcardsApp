# Junior Year Flashcards

A home-screen web app for five AP courses. **2,277 cards**, written unit by unit
against the current College Board Course and Exam Descriptions.

**Live:** https://21ag21.github.io/JuniorYearFlashcardsApp/

| Deck | Cards | Organised by |
|---|---|---|
| AP English Language | 320 | the four Big Ideas + exam craft |
| AP Chemistry | 434 | Units 1–9 |
| AP French | 572 | the six 2026–27 themes + grammar, verbs, exam |
| AP Calculus BC | 435 | Units 1–10 |
| AP U.S. History | 516 | Periods 1–9 |

## Turning on the site

Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
A minute later the URL above is live. Nothing else to configure — there is no
build step, no framework, and no dependency to install.

## Putting it on a phone

Open the URL in Safari on the iPhone → **Share → Add to Home Screen**.

It launches full-screen with no browser chrome, works with no signal (a service
worker caches the whole app and all five decks on first visit), and every
student on the device gets their own profile under Settings.

## Accounts (optional)

By default progress never leaves the phone. An **account** is a token: open a
magic link (`…/#t=YOURTOKEN`) once — or paste the token under Settings →
Account — and that profile's progress syncs through a small Cloudflare Worker
(`worker/`), so a phone and a laptop stay in step. Tokens are provisioned by
hand: generate one, then register its hash so the Worker will accept it —

```
TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
HASH=$(node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$TOKEN")
cd worker && npx wrangler kv key put "tok:$HASH" 1 --namespace-id <CARDS_KV_ID> --remote
```

The worker stores one JSON blob per account; the app merges per card, so two
devices reviewing offline both keep their work.

## How studying works

- Tap the card to reveal. **Again / Good / Easy** schedules it — SM-2 style,
  with the next interval printed on each button.
- **Swipe** left for Again, right for Good, up to star.
- **Keyboard**: space reveals, `1` `2` `3` grade, `s` stars.
- **Review** mixes everything due across all five decks.
- **Multiple choice** builds distractors from other answers in the same unit.
- **Typing mode** (Settings) makes you write the answer first, graded leniently —
  case, accents, and punctuation are ignored.
- **High-yield only** filters to the ~30% of each deck marked core.
- **Trouble spots** collects whatever has been missed twice or more.
- Search runs over all 2,277 cards; any unit can be browsed with tap-to-peek.

Progress lives in the phone's local storage. No account, no server, nothing
uploaded. Settings → *Copy backup to clipboard* exports it as JSON; *Restore*
takes it back.

## The cards

Each card carries a verb (DEFINE, CONTRAST, DATE, CONJUGATE, INTEGRATE…), a
prompt, an answer, an optional hint at the *shape* of the answer, an exam note
naming the classic trap, and its CED topic code.

Two things here are newer than most study material:

- **AP Chemistry** uses the 2024+ unit names — Unit 3 *Properties of Substances
  and Mixtures* at 18–22%, Unit 6 *Thermochemistry*, Unit 9 *Thermodynamics and
  Electrochemistry*.
- **AP French** uses the 2026–27 redesign: six new themes, and the new exam —
  free response 50% (Project Presentation 20%, Project Q&A 15%, Argumentative
  Essay 15%) and multiple choice 50% (Listening 25%, Reading 25%), with the
  Personalized Project Reference due 30 April and Bluebook from May 2027.

Every card was fact-checked after writing. That pass found 11 real errors and 27
minor issues out of 2,284 cards, and 7 duplicates; all were fixed or removed.
The corrections are recorded in `src/qa/fix-*.json`.

## Design

Monochrome throughout — hierarchy is size, weight, and shade, never colour —
with Apple's Liquid Glass material carrying the card, the tab bar, and the
controls. Light and dark both follow the phone.

## What's in here

```
index.html  app.css  app.js  store.js  tex.js     the app
liquid-glass.css  liquid-glass.js                 the material
sw.js  manifest.webmanifest  icon-*.png           the install
data/                                             the cards, generated
src/                                              the cards, as written  (see src/README.md)
ap-decks-standalone.html                          the whole thing in one file
```

No framework, no CDN, no build step. `tex.js` is a ~4 KB math typesetter written
for this app so formulas render offline with no webfont to download.
