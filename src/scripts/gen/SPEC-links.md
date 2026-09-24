# The Connections unit (unit id `x`)

Every other unit of the course is built one CED unit at a time, so each card lives inside one unit. The exam does not: its hardest multiple-choice sets and nearly every free-response question make the student carry an idea from one unit into another, pick which of several look-alike tools applies, or spot what a weak answer got wrong. This unit trains exactly that, and nothing a single unit already covers.

Everything in SPEC.md and the course BRIEF still holds (fields, verbs, answer style, trap notes, explain-why rules, lengths, TeX subset, "be sure of every fact"). This file says only what differs.

## Input

`in/<course>-x.json` holds the whole course: every CED topic with its unit, learning objectives and essential-knowledge (EK) codes and text, every exclusion statement, the skills and the exam format. There are no existing cards, so nothing is reused. Do not duplicate a question an ordinary unit already asks; `validate.py` checks the live deck for duplicates. To see the house style, run `python3 review.py <course> <unit> 3` on two or three units (never open out/ files whole).

## What the unit holds

**Strands (topics).** Choose 6 to 10 strands, each a big cross-unit idea of the course (Chemistry: "structure explains properties", "energy decides direction, kinetics decides speed", "one equilibrium idea, many K's"; Calculus: "choosing the tool", "rates and accumulation are one idea", "the theorems and their hypotheses"; US History: a course theme traced across periods, or a comparison the LEQ asks; English Language: how a rhetorical choice serves situation, claim, reasoning and style at once; French: the same cultural product or practice seen through two themes, and the comparisons the presentation asks for). Code them `X1`, `X2`, … in order; `t` is a short title; `s` is the skill code the strand exercises most; `lo` and `ek` list the codes it draws on.

**Cards.** 80 to 110 ordinary cards and 40 to 50 explain-why cards, spread over the strands. Four kinds, and each strand should hold at least two of them:

1. *Bridge* — a question that cannot be answered from one unit: it needs an idea from unit A applied inside unit B (why a buffer's pH barely moves, in terms of Le Chatelier and Ka; why a particle's speed is the length of its velocity vector and how that reuses arc length; how Reconstruction's failures set up the Progressive Era's agenda; how a concession changes both the claim and the tone).
2. *Which tool* — discrimination. Give a situation and ask which idea, test, rule, theorem, technique, historical development or rhetorical move applies, and why the look-alike does not. Drills that sort six to eight mixed situations are welcome here (`y: "d"`).
3. *Spot the error* — quote a short piece of invented student work (a step of a calculation, an explanation, a thesis, a line of commentary, a French sentence), say it is invented, and ask the student to identify the error and correct it. The answer names the error in one clause, then gives the corrected version; the note says why the error is tempting. Aim for 15 to 25 of these across the unit. They are ordinary cards (verb IDENTIFY), not explain-whys.
4. *Confusable pairs* — two things students mix up that live in different units (Kc/Ksp/Ka/Kb, ΔG°/ΔG/E°, the ratio test/the limit comparison test, implicit differentiation/related rates, the Second Great Awakening/the Social Gospel, pathos/tone, un souvenir/une mémoire). Verb CONTRAST, or DECIDE with a case.

**Codes.** Every card's `k` must cite EK (or, for French, objective) codes from at least two different units, except a spot-the-error card, which may cite one unit when the error is local. Set `b` to the unit ids the card links, comma-separated in course order (`"u3,u9"`; French theme ids such as `"t2,t5"`). `t` is the strand code (`X1` …). `s` is the skill the card exercises, from the skill list.

**Exclusions.** The exclusion statements of every unit still apply. Never test excluded content.

**Explain-why cards** follow SPEC.md exactly (`y: "j"`, the ≤320-character model, `o` other valid arguments, `w` weak answers with why each loses). Here the reason must cross units: the weak answers should include the one-unit answer that misses the link.

**Free response.** Five questions, each in the exam's real format and each spanning at least two units, the way the real exam's questions do (a Calculus table question that needs a Riemann sum, the Mean Value Theorem and a particle's motion; a Chemistry question that runs from structure to equilibrium to thermodynamics; a US History LEQ or SAQ that compares two periods; an English Language essay whose rubric rewards choices from several big ideas; a French presentation or essay that draws on two themes). Say in each stem which units it draws on (`b` on the FRQ may list several, comma-separated). Match the exam's point values and rubric rows as the per-unit FRQs do. For Calculus mark calculator-active questions (`calc: true`) in the exam's proportion; for Chemistry use the long (10-point) and short (4-point) formats.

**Title and blurb.** Set top-level `"title"` to the unit title in the input and `"blurb"` to one sentence saying what the unit trains.

**Notes.** As in SPEC.md: counts, the strands and why, anything unsure, anything invented.

## Output

`out/<course>-x.json`, with the same top-level keys as any unit (`course`, `unit: "x"`, `title`, `blurb`, `topics`, `excl` (usually empty), `check` (write "Across units · no CED progress check"), `cards`, `frq`, `notes`). Work in part files `<course>-x-p1.py` … and a build file, as for any unit. Run `python3 validate.py <course> x` until RESULT PASS. The warning "topic codes differ from skeleton" is expected here; justify nothing else.
