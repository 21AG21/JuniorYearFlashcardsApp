# Junior Year Flashcards

A home-screen web app for five AP courses. **2,277 cards**, written unit by unit
against the current College Board Course and Exam Descriptions.

**Live:** https://myfleshcards.vercel.app  (Vercel — the same project serves the app and the account API)

| Deck | Cards | Organised by |
|---|---|---|
| AP English Language | 320 | the four Big Ideas + exam craft |
| AP Chemistry | 434 | Units 1–9 |
| AP French | 572 | the six 2026–27 themes + grammar, verbs, exam |
| AP Calculus BC | 435 | Units 1–10 |
| AP U.S. History | 516 | Periods 1–9 |

## Deploying

Push to `main`. Vercel's GitHub integration deploys every push: the app is
served as static files from this folder, and `/api/state` runs
`api/state.js` as a serverless function. No build step, no framework.

## Putting it on a phone

Open the URL in Safari on the iPhone → **Share → Add to Home Screen**.

It launches full-screen with no browser chrome, works with no signal (a service
worker caches the whole app and all five decks on first visit), and every
student on the device gets their own profile under Settings.

## Accounts (optional)

By default progress never leaves the phone. An **account** is a token: paste
it under Settings → Sync and progress syncs through `/api/state`
(`api/state.js`, a Vercel function storing one JSON blob per account in
Vercel Blob), so a phone and a laptop stay in step. The app merges per card,
so two devices reviewing offline both keep their work.

Setting it up once, in the Vercel dashboard:

1. **Storage → Create → Blob**, connected to this project for Production.
   The connection injects `BLOB_STORE_ID`, and the function authenticates
   with the deployment's own OIDC token (a `BLOB_READ_WRITE_TOKEN`, if one
   is set, is used instead). Without a connected store the API answers 503
   and the app shows *Sync is off: no storage linked*.
2. Decide which tokens are allowed. Any one of these works:
   - the token's **owner id** (`sha256("apdecks-owner:" + token)` first 16
     hex digits, shown under Settings → Sync → ID) appears as an `owner`
     on a deck in `data/index.json` — whoever owns a private deck syncs
     with no extra setup;
   - `SYNC_TOKEN` (Settings → Environment Variables) lists the token itself,
     comma-separated for more than one (16–128 characters of `A–Z a–z 0–9 _ -`;
     generate one with
     `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`);
   - `SYNC_TOKEN_HASH` lists sha256 hex of it, if you'd rather not store the
     token itself.
3. Redeploy after adding the store or a variable: Vercel bakes the
   environment into each deployment.

Every other token gets `401 bad token` — an account still IS a token,
provisioned by hand or by owning a deck.

## How studying works

The app explains itself on its **How it works** page (from the deck list or
Settings), with the numbers read from your own Settings. In short:

- Open a deck and tap **Study**. The deal is what is due today, then new
  cards; the line under the button counts the two halves.
- Tap the card to reveal. **Again / Hard / Good / Easy** schedules it, SM-2
  style, with the next interval printed on each button; under the answer the
  card's note names the trap, and a line says the card's own history (first
  time, 3 in a row, missed twice).
- **Swipe** left for Again, right for Good, up to star.
- **Keyboard**: space or → reveals, `1` `2` `3` `4` grade, ← undoes, `s`
  stars, `n` opens your note, `/` searches, esc goes back.
- Every way into a deck says what it deals: **High-yield**, **Quiz**,
  **Trouble spots**, **Shuffle**, **Catch up**, and on a unit **Cram** and
  **Print**. **Plan** lays a course's unseen cards across the weeks to its exam.
- A course page shows each unit's blurb; a unit page opens with its **key
  ideas** and lists its cards under their topics, each topic a session of its
  own.
- **Review** mixes everything due across every deck on the shelf; **Quick ten** is the
  same deal cut to ten.
- **Multiple choice** builds distractors from other answers in the same unit.
- **Typing mode** (Settings) makes you write the answer first, graded leniently.
- After a session, **Coming back** says how many cards return tomorrow and
  within the week.
- Search runs over all 4,726 cards; any unit can be browsed with tap-to-peek.

A course that carries its book (the Six Ladders) adds: a **Reading** block
with Continue to the next unread lesson, lessons-read counts, each phase's
**Done when** as tickable lines, an **Every word, explained** glossary of all
its terms at six reading levels, an on-this-page jumps line on long pages,
and on every lesson what it builds on, where it comes up again, and how long
it reads at the chosen level. Lesson ticks and Done-when ticks sync with the
rest of your progress.

Progress lives in the phone's local storage until an account token is pasted
under Settings → Sync (see *Accounts*). Settings → *Backup* exports it as
JSON; *Restore* takes it back.

## The cards

Each card carries a verb (DEFINE, CONTRAST, DATE, CONJUGATE, INTEGRATE…), a
prompt, an answer, a hint at the *shape* of the answer, an exam note naming
the classic trap, and its topic. Each unit carries a blurb and five to eight
key ideas, drawn from its own cards, in teaching order.

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
