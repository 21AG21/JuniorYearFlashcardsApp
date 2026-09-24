# Tell apart — confusable pairs

A discrimination game. The student sees two concepts that students confuse (the two labels as two buttons),
then one statement at a time, and taps the concept the statement is true of. After each tap the reason shows.
Telling two neighbours apart is a different skill from recalling either one, and it is the one the exam tests
when a multiple-choice distractor names the neighbour.

## Output
`out/tell-<course>.json`:

```json
{"course": "chem", "pairs": [
  {"id": "imf-bond", "u": "u3", "a": "Intermolecular forces", "b": "Covalent bonds",
   "items": [
     {"s": "Overcome when water boils", "k": "a", "why": "Boiling separates whole molecules; the O–H bonds inside each molecule stay intact."},
     {"s": "Broken when water is electrolysed", "k": "b", "why": "Electrolysis makes H₂ and O₂, so the O–H bonds themselves must break."}
   ]}
]}
```

- `id`: short kebab-case, unique in the course.
- `u`: the unit id where the pair is taught (the course's own ids: chem u1–u9, calcbc u1–u10, apush u1–u9,
  lang rhs/cle/reo/stl, french t1–t6, gr, vb). A pair spanning units uses a comma list: "u3,u5".
- `a`, `b`: the two labels, 1–5 words each, as a teacher would write them on the board. Never the same length
  pattern that gives the answer away ("X" vs "not X" is fine only when that is the real distinction).
- `items`: 6 to 8 statements. At least 2 true of each side; aim for a near-even split. Each statement is true of
  exactly one side and false of the other — never "both" or "neither". If a statement is true of both, cut it.
- `s`: at most 140 characters, a fact, example, property, use, symptom, date, quote or scenario. It must not
  contain either label's distinctive word (no "intermolecular" in an intermolecular statement). Vary the kind:
  some definitional, most applied (a scenario, a data point, an example the student must classify).
- `why`: at most 200 characters, the reason it belongs to that side (and, where useful, why not the other).
- Math: inline TeX between `$…$` exactly as the course's cards write it.

## What pairs to choose
20 to 30 pairs per course, spread across the units in proportion to the exam weight. Choose pairs that students
really confuse and the exam really tests: ones the CED's exclusion statements, the scoring guidelines, or the
Chief Reader reports name as common errors, or the classic textbook confusions. Examples of the kind:

- chem: intermolecular forces / covalent bonds; rate / equilibrium position; Q / K; strong acid / concentrated
  acid; buffer / neutralized solution; ΔH / Ea; London dispersion / dipole-dipole; galvanic / electrolytic.
- calcbc: IVT / MVT; average rate of change / average value; relative / absolute extremum; conditionally /
  absolutely convergent; ratio test / limit comparison; speed / velocity; left / right Riemann sum over- and
  under-estimates.
- apush: Federalists / Anti-Federalists; Progressives / Populists; containment / rollback; Jacksonian / Jeffersonian
  democracy; Plessy / Brown; Second Great Awakening / First Great Awakening.
- lang: claim / evidence; tone / mood... only if the CED uses the term; line of reasoning / organization;
  concession / qualification; exigence / purpose; ethos / pathos.
- french: imparfait / passé composé; depuis / pendant; savoir / connaître; c'est / il est; subjonctif /
  indicatif (after a trigger); tu / vous; DROM / COM; laïcité / tolérance religieuse.

French: statements for a language pair are French sentences (the student classifies the French); statements
for a cultural pair may be English or French as the course's cards are. `why` is English.

## Checks
Every fact must be right: verify anything beyond textbook-standard with WebSearch against a reliable source.
Run `python3 <gen>/tell_check.py <course>` until it prints PASS.
