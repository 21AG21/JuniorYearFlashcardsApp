# Source

The cards live here, not in `/data`. `/data` is generated.

```
src/data/chunks/*.json     the decks as written, 14 files
src/data/courses.json      course + unit metadata, weightings, titles
src/data/SCHEMA.md         the card contract every chunk file follows
src/scripts/build_data.py  merge + validate + dedupe  -> src/build/data/
src/scripts/publish.py     build, then copy to /data   (what the app loads)
src/scripts/apply_fixes.py apply src/qa/fix-*.json corrections back to the chunks
src/qa/*.js                lint + 28 Playwright assertions + screenshot runs
src/research/CED-NOTES.md  the CED unit structures the decks were written against
```

## Adding or editing cards

1. Edit a file in `src/data/chunks/` — follow `src/data/SCHEMA.md` exactly.
2. `python3 src/scripts/publish.py`
3. `node src/qa/lint.js`
4. Commit. Pages redeploys on push.

Card ids are `sha1(course + '|' + question)[:10]`, so a student's progress
survives a rebuild as long as the **question text** does not change. Editing an
answer is free; editing a question resets that one card.

## Running the tests

```
npm i -D playwright && npx playwright install chromium
python3 -m http.server 8899          # from the repo root
node src/qa/lint.js
node src/qa/functional.js
node src/qa/functional2.js
```
