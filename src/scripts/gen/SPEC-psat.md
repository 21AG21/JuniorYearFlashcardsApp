# PSAT/NMSQT prep: spec

## The student

This is for one student, a junior, who scored **790 Math** and **730 Reading and Writing** on the September 12 SAT. The digital PSAT/NMSQT comes in October.

### What the numbers mean

- **Selection Index.** National Merit uses the Selection Index: 2 × (RW ÷ 10) + (Math ÷ 10). Each section is scored 160–760 on the PSAT, so the maximum is 228.
- **Math is already at the ceiling.** 790 on the SAT is above the PSAT's 760 cap. Math's job is to *stay* at 760, which means zero careless misses.
- **Reading and Writing counts double, and it is the room to grow.** 730 → 760 is +6 on the index; one RW question is worth about twice a math question.
  - A 730 means a handful of misses across two modules. They are almost always the hardest questions: a subtle inference, a cross-text relationship, a words-in-context with a rare sense of a common word, an evidence or quantitative question whose tempting choice is true but does not support the specific claim, and a punctuation question that hinges on what is or is not an independent clause.

So everything here is at **hard-module difficulty** (the second, harder module a strong scorer is routed to). Where the SAT has easy and hard versions of a question type, write the hard version.

Every question is critical thinking: the student has to read, reason and eliminate. There are no giveaways.

## The format you are imitating

The digital PSAT/NMSQT, in Bluebook, has two sections.

**Reading and Writing: 2 modules, 27 questions, 32 minutes each.**
- Every question has its own short passage (25–150 words; a cross-text pair can run to about 200), then one question with four choices.
- Within a module the order is:
  1. Craft and Structure: Words in Context, Text Structure and Purpose, Cross-Text Connections.
  2. Information and Ideas: Central Ideas and Details, Command of Evidence (textual, then quantitative), Inferences.
  3. Standard English Conventions: Boundaries, and Form, Structure, and Sense.
  4. Expression of Ideas: Transitions, then Rhetorical Synthesis.
- Rough shares of a module: Craft and Structure 28%, Information and Ideas 26%, Conventions 26%, Expression of Ideas 20%.

**Math: 2 modules, 22 questions, 35 minutes each.** A graphing calculator (Desmos) is built in, and a reference sheet is available.
- About 75% are four-choice multiple choice.
- About 25% are student-produced response ("SPR"): the student types the answer.
- Rough shares: Algebra 35%, Advanced Math 32.5%, Problem-Solving and Data Analysis 20%, Geometry and Trigonometry 12.5%.

Write every question as the real test writes it:
- Real stems: "Which choice completes the text with the most logical and precise word or phrase?", "Which choice completes the text so that it conforms to the conventions of Standard English?", "Which choice most effectively uses data from the table to complete the example?", "The student wants to emphasize... Which choice most effectively uses relevant information from the notes to accomplish this goal?", "Which finding, if true, would most directly support the researcher's hypothesis?", "Based on the texts, how would the author of Text 2 most likely respond to...?" and so on.
- Blanks are written as ______.
- Passages are about science, history, social science, the humanities and literature. Literature passages are either public-domain excerpts you know verbatim, with author and title, or passages written for practice.
- Invented passages about "a researcher" must not attribute invented findings to a real, named scientist or study. Use invented names, for example "ecologist Mara Levin and colleagues", and keep claims plausible.
- Real facts you state must be true.

## Files

**Tests.** A test is `out/test-psat-<id>.json`:

```
{"course": "psat", "id": "<id>", "unit": "<unit id>", "title": "<shown to the student>", "minutes": <int>,
 "mc": [Group, ...]}
```

No `fr`.

**Reading and Writing groups.** Each question is its own group:
- `"stem"` is the passage (and the notes, the table or the two texts)
- `"parts"` is that one question

**Math groups.** A math question is a group with `"stem": ""` and one part, unless it truly shares a figure or table with another. Describe any figure exactly in words. Write tables as ` · `-separated lines with a header.

**Q (multiple choice).**

```
{"l": "<number through the test>", "p": 1,
 "q": "<the question>\n(A) ...\n(B) ...\n(C) ...\n(D) ...",
 "a": "(B). <why B is right, in full; then why EACH other choice is wrong, naming its letter>",
 "n": "<Type: the question type. Rule or move: the one reusable idea this question teaches, in a sentence the student could put on an index card. Trap: which wrong choice most strong students pick, and why.>",
 "t": "<topic code, below>", "d": "hard" | "medium"}
```

**Q (math SPR).** There are no choice lines, and it has one more field, `x`:

```
{"l": "9", "p": 1, "q": "<the question>",
 "x": ["<every accepted entry, as Bluebook accepts it>"],
 "a": "<the answer>. <the worked solution, and the Desmos move if there is a faster one>",
 "n": "...", "t": "ADV", "d": "hard"}
```

`x` lists every form Bluebook would accept.
- Give a fraction and its decimal. A decimal that does not terminate is entered as many digits as fit, truncated or rounded: 2/3 is accepted as 2/3, .6666, .6667, 0.666 and 0.667.
- Positive answers are at most 5 characters and negative ones at most 6, counting the sign.
- A mixed number is not accepted.
- Where an answer can be any value in a range, or any one of several values, list each accepted exact value and say so in `a`.

**Topic codes (`t`), by unit.**

| Unit | Codes |
|---|---|
| `craft` | `WIC` Words in context, `TSP` Text structure and purpose, `CTC` Cross-text connections |
| `info` | `CID` Central ideas and details, `COET` Command of evidence: textual, `COEQ` Command of evidence: quantitative, `INF` Inferences |
| `conv` | `BND` Boundaries, `FSS` Form, structure, and sense |
| `expr` | `TRN` Transitions, `SYN` Rhetorical synthesis |
| `math` | `ALG` Algebra, `ADV` Advanced math, `PSD` Problem-solving and data analysis, `GEO` Geometry and trigonometry |
| `plan` | `PLAN` The Selection Index and the strategy, `DAY` Timing and test day |

**Cards.** Cards are `out/psat-<unit>.json`:

```
{"course": "psat", "unit": "conv", "title": "Standard English conventions",
 "blurb": "<one or two sentences>",
 "keys": ["<5-8 key ideas, one sentence each>"],
 "cards": [ {"t": "BND", "v": "FIX" | "EXPLAIN" | "DECIDE" | "CHOOSE" | "IDENTIFY" | "APPLY" | "CALCULATE" | "RECALL",
             "q": "...", "a": "...", "h": "→ <shape of the answer>", "n": "<the trap>", "c": 0|1, "x": null | ["short accepted alternates"]} ]}
```

A card is a single rule, a move, or a trap, tested on a fresh example. Examples:
- Q: "Fix it, or say it is right: 'The committee's findings, which surprised no one; were released Tuesday.'"
- A: "The semicolon must be a comma: it closes the nonessential clause that the first comma opened, and a semicolon needs a complete sentence on both sides…"

Cards teach the thing that separates 730 from 760, not the basics a 730 scorer already knows.

## Checks

Run `python3 tests.py check psat <id>` until it prints RESULT PASS with no warnings. Run `python3 psat_cards.py check <unit>` for cards.

Accuracy is the whole game. Each question needs exactly one defensible answer: an SAT question that has two defensible answers teaches the wrong lesson. For each question:
- Re-read the passage and try to argue for each wrong choice.
- If you can make a case for a wrong choice, change the passage or the choice.
- Compute every math answer, and each distractor's slip, with python. sympy, numpy and scipy are installed.
