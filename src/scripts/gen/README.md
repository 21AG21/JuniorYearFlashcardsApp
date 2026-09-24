# Generating a unit from its CED skeleton

    export GEN_DIR=/some/scratch/gen          # holds in/, out/
    python3 export_unit.py chem u1            # -> $GEN_DIR/in/chem-u1.json (skeleton + existing cards)
    # an agent or a person writes $GEN_DIR/out/chem-u1.json to SPEC.md (SPEC-french.md for French), from PROMPT.md
    python3 validate.py chem u1               # RESULT PASS with zero errors
    python3 review.py chem u1                 # a sample to read
    python3 merge.py chem u1 [u2 ...]         # replaces the unit's cards in data/chem.json, sets its frame, re-stamps index.json

`data/*.json` is what the app loads and is the source of truth for the decks; the
older chunk pipeline under `src/data` predates it and is no longer run.

## Recovering in a fresh container

The scratch directory (CED texts, part files, the working ledger) lives outside the
repository. If it is gone: download the five CED PDFs from apcentral.collegeboard.org,
extract them with pypdfium2 into `$CED_DIR/<name>.txt` (see src/research/ced/README.md),
re-run the parsers to get full skeletons (the committed ones leave out the exam text),
copy this directory to `$GEN_DIR`, run `export_unit.py` for every unit the ledger shows
as queued or running, and relaunch those units from `PROMPT2.md` with their course's
`BRIEF-*.md`. Merged units are already in `data/`.

## Connections units, corrections and skills (added after the rebuild)

- **Connections (`x`).** `export_links.py <course>` writes `in/<course>-x.json` (every CED topic, EK code and
  exclusion of the course); an agent follows `SPEC-links.md` (prompts in `prompts3.json`) to write
  `out/<course>-x.json`; `validate.py <course> x` accepts it with the one expected warning ("topic codes differ
  from skeleton"). `merge.py <course> x` inserts the unit after the last CED unit, moves the exam and table
  units down one place in both the course file and `index.json`, and takes the unit's title and blurb from the
  output. A card's `b` may list several units (`"u3,u9"`); the app reads it as "Links Units 3 and 9".
- **Corrections.** Audits write source-cited corrections to `out/patch-*.json` in the format documented at
  the top of `apply_patches.py`; run it with `--dry` first, then without, then `merge.py` the touched units.
  A card's question is never patched (its id follows the question).
- **Skills.** `add_skills.py` writes each course's skill list (the CED wording, grouped by practice) into
  `data/<course>.json` as `skills`, for the By skill screen. `merge.py` keeps it.
