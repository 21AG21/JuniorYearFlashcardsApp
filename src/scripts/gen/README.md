# Generating a unit from its CED skeleton

    export GEN_DIR=/some/scratch/gen          # holds in/, out/
    python3 export_unit.py chem u1            # -> $GEN_DIR/in/chem-u1.json (skeleton + existing cards)
    # an agent or a person writes $GEN_DIR/out/chem-u1.json to SPEC.md (SPEC-french.md for French), from PROMPT.md
    python3 validate.py chem u1               # RESULT PASS with zero errors
    python3 review.py chem u1                 # a sample to read
    python3 merge.py chem u1 [u2 ...]         # replaces the unit's cards in data/chem.json, sets its frame, re-stamps index.json

`data/*.json` is what the app loads and is the source of truth for the decks; the
older chunk pipeline under `src/data` predates it and is no longer run.
