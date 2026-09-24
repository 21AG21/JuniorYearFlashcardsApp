# Unit generation spec

You are writing one unit of an AP flashcard course, grounded in the College Board Course and Exam Description (CED). Your input file (`in/<course>-<unit>.json`) holds: the course's exam format and skill list, the unit's CED skeleton (topics in order with LO and EK codes, suggested skill, exclusion statements, progress-check format, borrow notes, verification flags), and the unit's EXISTING cards. Your output is ONE file, `out/<course>-<unit>.json`, that passes `python3 validate.py <course> <unit>` with no errors.

## Output shape

```
{
  "course": "chem", "unit": "u1",
  "notes": "<3-8 lines: what you assumed, what you were unsure of, what you left out and why>",
  "check": "Progress check · 25 multiple choice · 2 free response",     // from the skeleton; keep this phrasing
  "topics": [ {"c":"1.1","t":"Moles and molar mass","s":"5.F","lo":["SPQ-1.A"],"ek":["SPQ-1.A.1","SPQ-1.A.2"]}, ... ],   // copied from the skeleton, CED order, titles in sentence case
  "excl":   [ {"c":"1.2","s":"<exclusion statement as the CED words it>"}, ... ],                                        // from the skeleton only; never invent one
  "cards":  [ Card, ... ],
  "frq":    [ FRQ, ... ]
}
```

### Card
```
{ "t":"1.1", "v":"CALCULATE", "q":"...", "a":"...", "h":"→ ...", "n":"...", "c":0|1, "x":[...]|null,
  "k":["SPQ-1.A.1"], "s":"5.F", "b":"u3"|absent, "y":"j"|"d"|absent, "o":[...], "w":[{"a":"...","why":"..."}] }
```
- `t` topic code, exactly one of `topics[].c`. Cards are listed in CED topic order.
- `v` the task verb, UPPERCASE, the exam's own: CALCULATE, IDENTIFY, EXPLAIN, JUSTIFY, PREDICT, DESCRIBE, DETERMINE, REPRESENT, DRAW, SKETCH, COMPARE, CONTRAST, ANALYZE, CONSTRUCT, ESTIMATE, INTERPRET, ARGUE, SUPPORT, WRITE, APPROXIMATE, FIND, SHOW, VERIFY, CLASSIFY, EVALUATE, DERIVE, STATE, DEFINE, NAME, RANK, BALANCE, DATE, DECIDE, APPLY, RECALL, COMPUTE, DIFFERENTIATE, INTEGRATE, TRANSLATE, CONJUGATE. The question's first word is that verb (or its imperative form).
- `q` the task. Self-contained: every number, table, description or short passage the task depends on is IN the question, in words (the app is text-only: describe a figure exactly — axes, labels, shape, key points, values — and write a table as lines of `x · y` pairs). No answer leakage. ≤ 600 characters (≤ 900 when it carries a table or passage).
- `a` the model answer, written the way a scoring guideline reads: THE CLAIM FIRST, then the reasoning that actually earns the point, 2 to 5 sentences, ≤ 480 characters. Every figure the question depends on is worked out; when the task is to draw, sketch or represent, the answer IS the figure, in words precise enough to draw from. Numbers carry units and sensible significant figures.
- `h` a hint of the answer's SHAPE, never its content: `→ two-line calculation`, `→ claim + Coulomb reasoning`. ≤ 60 characters. On an explain-why card (`y:"j"`) it is the cause-and-effect chain in one line: `→ more protons → stronger attraction → smaller radius`, ≤ 120 characters.
- `n` the trap: the phrasing or move that earns nothing, or the classic wrong turn. One sentence, ≤ 180 characters. Never empty.
- `c` 1 on the roughly 25% highest-yield cards, else 0.
- `x` short accepted alternates for type-in checking (a number, a formula, a name), or null.
- `k` one to three EK (or KC) codes from THIS topic in the skeleton. `s` one skill code from the course's skill list (the topic's suggested skill unless another fits the task better).
- `b` the unit id this question BORROWS from (another unit of the same course), when it leans on that unit's content; say what is borrowed in `n`. Absent otherwise.
- `y:"j"` marks an explain-why (justification) card, `y:"d"` a folded drill. Absent on an ordinary card.
- Explain-why cards (`y:"j"`) also carry `o` (one to three other valid ways to argue the same point, each one sentence) and `w` (two to four weak answers that lose credit, each `{"a": the weak answer as a student would write it, one confident sentence, "why": why it earns nothing, one clause}`). Keep the model answer of an explain-why ≤ 320 characters so it is not the longest option in a quiz.
- Drill cards (`y:"d"`): when one question type has many instances (name these 20 ions, classify these 15 reactions, give the derivative of each of these 18 functions), fold them into ONE card whose `q` lists the cases and whose `a` gives every answer in the same order, `case → answer` per line, ≤ 1100 characters. Never write fifteen near-duplicate cards instead.

### Counts
- Ordinary cards: 80 to 140 for the unit. The unit total rules: with 6 to 9 topics that is 10 to 16 per topic; with 10 to 16 topics, 6 to 12 per topic. A topic may exceed its share only to keep existing questions. Cover EVERY question type the EK statements support, topic by topic, not a sample.
- Explain-why cards: 40 to 50 for the unit (a small unit: at least 30), spread across topics, each `t` set to the topic it belongs to.
- Drill cards count as ordinary cards.

### Reuse
The existing cards are decent. Where an existing question fits a topic, REUSE ITS `q` TEXT VERBATIM (character for character), so the student's progress on it survives; rewrite its `a`, `h`, `n`, tags freely. Drop existing cards that are off the CED or duplicated. Aim to reuse most of them.

### Exclusions, borrowing, style
- Never write a card or a part that tests something an exclusion statement rules out. If a card sits near an exclusion, say so in `n`.
- Say when you are unsure instead of inventing a fact, a number or a scoring rule — in the card's `n` or in the file's `notes`.
- Math: prefer Unicode (² ³ ⁻ ⁺ × · ÷ √ π Δ → ⇌ ≈ ≤ ≥ ≠ ∞ ∫ Σ). For a real fraction, a bounded operator or a subscript expression use inline `$...$` with ONLY this subset: `\frac{a}{b} \sqrt{x} x^{2} a_{n} \int_{a}^{b} \sum_{n=1}^{\infty} \lim_{x \to a} \pi \theta \Delta \infty \to \pm \le \ge \ne \cdot \times \approx \ln \log \sin \cos \tan \sec \csc \cot \arcsin \arctan \left( \right) \, \; \rightleftharpoons \rightarrow \leftrightarrow`, plus the Greek letters and arrows tex.js renders (the validator knows the full list). Nothing else: no `\text`, no `\begin`, no `\mathrm`, no `\displaystyle`, no matrices.
- Plain ASCII quotes inside JSON strings, `\n` for a line break, valid UTF-8, no trailing commas.
- No two cards with the same question, in this unit or elsewhere in the course (the validator checks the other units).

### FRQ
```
{ "kind":"long"|"short"|"saq"|"dbq"|"leq"|"synthesis"|"rhetorical"|"argument"|"presentation"|"qa"|"essay"|"mc",
  "title":"...", "pts":10, "b":"u3"|absent, "calc":true|false|absent,
  "stem":"...",                                   // the full setup: data, the described figure or table, the passage, the documents
  "parts":[ {"l":"a","q":"...","p":2,"a":"...","n":"..."} ],   // point split per part (estimates), model answer per part, a note on what earns nothing
  "rows":[ {"r":"Row A · Thesis","p":1,"earns":"...","loses":"..."} ] }   // rubric-scored essays: one entry per rubric row, tailored to THIS prompt
```
Part points sum to `pts`. Model answers are complete and worked. Tabular data in a stem or a part goes one row per line (`\n`), the columns of a row joined with ` · `, with a header row; a figure is described in words precise enough to draw from. The course section below says which kinds and how many. Point splits are estimates: say so in `notes` if a split is a guess.

## Course sections

### chem
The 2024 CED codes: learning objectives read 1.1.A, essential knowledge 1.1.A.1 (the old SPQ/TRA codes are gone); `k` uses the 1.1.A.1 form. The input's exam section quotes the CED's task-verb list (Calculate, Describe, Determine, Estimate, Explain, Identify, Justify, Predict, Represent/Draw, ...): use those verbs. Units 1–9 are weighted as the input says. Five FRQs: 3 `long` (10 points, 6 to 8 parts: a calculation chain, a particulate or graphical representation described in words, a justification with Coulomb's law / IMF / equilibrium reasoning as the unit allows) and 2 `short` (4 points, 2 to 4 parts). Calculator allowed throughout. Cards may use the AP equations sheet values; state constants you use.

### calcbc
Codes read LIM-1.A (learning objective) and LIM-1.A.1 (essential knowledge); `k` uses the LIM-1.A.1 form. A topic marked `bc: true` (all of units 9 and 10, and the flagged topics elsewhere) is BC-only: say so in the note of a card that would not be on the AB exam. A topic with a `note` and no EK ("This topic is intended to focus on the skill of selecting...") still gets cards: procedure-selection drills, tagged with the EK codes of the topics it draws on (anywhere in the unit). The BC exam weightings in the input are the document's. Five FRQs: 3 `long` (9 points, 4 parts, in the exam's standard shapes: a table of values, a graph of f′ described, area/volume, a differential equation, particle motion or parametric/polar, a series — whichever the unit supports) and 2 `short` (4 to 5 points, 2 parts). Mark each `calc` true or false. Justifications name the theorem and check its hypotheses; the trap notes name the missing hypothesis, the wrong notation, the unlabelled units.

### apush
Codes: learning objectives read "LO 1.B" (the CED's "Unit 1: Learning Objective B"); key concepts read KC-1.1.I.A; `k` uses the KC codes (a contextualizing or reasoning topic whose KCs are unit-level summaries like KC-1.1 may use those). Each topic carries its thematic focus codes and its reasoning process (Comparison, Causation, Continuity and Change): the explain-why cards should exercise that process. The exam draws its DBQ from 1754 to 1980 (Periods 3 to 8): for Periods 2 and 9, still write the DBQ, but open its stem with "Practice. The exam draws its DBQ from 1754 to 1980, so none comes from Period N; this one practises the same seven-point skills on Period N content." The long essay covers about half the course's chronology, so any period can supply it; the three short-answer questions span 1491 to 2001. Rubric rows are the CED's: DBQ A Thesis 1 · B Contextualization 1 · C Evidence 3 (from the documents 2, beyond 1) · D Analysis and reasoning 2 (sourcing 1, complexity 1); LEQ A Thesis 1 · B Contextualization 1 · C Evidence 2 · D Analysis and reasoning 2. Documents you write are labelled paraphrases or composites, never presented as quotations. Five FRQs in the May 2027 format: 3 `saq` (3 points, parts a b c; SAQ 1 with a secondary-source excerpt you write and attribute as a fictional historian's argument, SAQ 2 with a primary-source excerpt you write and label as a described period document, SAQ 3 with a non-text source described in words), 1 `dbq` (7 points; write 7 short documents, each with a source line, then `rows` for Thesis 1 · Contextualization 1 · Evidence from documents 2 · Evidence beyond 1 · Sourcing 1 · Complexity 1, and `parts` holding a model plan labelled by row), 1 `leq` (6 points; `rows` Thesis 1 · Contextualization 1 · Evidence 2 · Analysis and reasoning 2, plus `parts` with a model plan). Topics use the CED topic codes (1.1 ...), the EK field carries KC codes.

### lang
The topics are the essential-knowledge statements themselves (RHS-1.A ...), 14 to 26 per Big Idea, so the per-topic count is 3 to 8 ordinary cards (80 to 140 for the Big Idea in all) and the explain-why cards spread across them; `k` is the EK code, `s` the skill code from the topic's `lo` list (the reading skill for a reading task, the writing skill for a writing task). Your `existing` list may include cards moved in from another Big Idea (tone and diction into Style, argument moves into Claims and Evidence); reuse them verbatim like your own. There is no REVISE verb: a revision task is WRITE (produce it) or DECIDE (choose between versions). Every passage, speaker and figure you write is invented and says so. Cards quote or closely paraphrase the EK's own terms (exigence, line of reasoning, commentary, method of development, coordination) and ask the exam's moves: identify the claim, explain how the evidence supports it, describe the line of reasoning, explain the effect of a choice. Five FRQs per Big Idea: 1 `rhetorical` (a passage you write, 300 to 450 words, attributed as a described speech or essay, not to a real person), 1 `argument`, 1 `synthesis` (six sources summarised, each with a source line, one visual described in words), each with `rows` A Thesis 1 · B Evidence and commentary 4 · C Sophistication 1 tailored to the prompt and `parts` holding a model plan by row; and 2 `mc` (a passage of 200 to 300 words you write, then 5 four-choice questions of the exam's reading or writing types, each part's `a` naming the letter and the reasoning, `p` 1 each). Topic codes are the EK codes (RHS-1.A ...); the skill field carries the 1.A–8.C skill.

### french
See SPEC-french.md.
