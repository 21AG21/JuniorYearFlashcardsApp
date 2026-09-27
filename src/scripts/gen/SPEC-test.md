# Unit tests: spec

You are writing a full-length unit test for an AP study app. It should read the way a strong AP teacher writes a unit test. The test finds out whether a student can think with the unit, not whether they can remember it.

A student takes the test in the app. They answer every multiple-choice question and write every free response, then hand the test in. The app marks the multiple choice. The student scores their own free response against your model answers, part by part. The results page breaks the score down by section, by CED topic and by thinking level. Each missed question sends the student back to its topic.

## The one rule: every question is critical thinking

A test must not contain a question that can be answered from memory alone. Try it on every question you write. If a student who memorised the unit's flashcards, but cannot reason, could get it right, rewrite it.

Every question puts the student in front of something they have not seen and asks them to reason about it. That can be:
- data
- an experiment
- a graph or a table
- a document
- a passage
- a scenario
- a claim
- a student's worked answer or argument

Name, define and "which of the following is an example of" questions are out. So are questions whose stimulus is decoration, where you could delete the stem and still answer.

Each multiple-choice question carries two tags.

`lv` is the thinking level. It must be one of three values:
- `apply`: use a principle in a situation the student has not seen, usually in more than one step.
- `analyze`: interpret data, a source or a text, find a relationship or a pattern, infer, or compare.
- `evaluate`: judge a claim, an argument, a method, a source's reliability or a piece of student work. Decide what evidence would support or refute it, or find the flaw.

There is no `recall` level, and none is allowed. In each test:
- `evaluate` is at least 25% of the questions.
- `analyze` and `evaluate` together are at least 60%.

`ty` is the item type, the move a teacher uses. Each test uses at least 6 different types, and no type is more than 40% of the test.

| `ty` | What the question asks |
|---|---|
| `claim` | A student, a scientist or a historian claims X. Which best evaluates the claim, or which evidence best supports or refutes it? |
| `error` | A worked solution, lab procedure, argument or draft contains a flaw. Where is the first error, or what did it do to the result (too high, too low, no change)? |
| `design` | Which experiment, measurement, comparison or source would test the hypothesis or settle the question? |
| `predict` | What happens if…? The strongest form pairs a prediction with a reason: "(A) increases, because …". Exactly one pair must be right in both halves. |
| `data` | Which conclusion does the data, figure or source support, and which does it not? |
| `transfer` | An unfamiliar real-world context that the unit's ideas explain. |
| `synthesis` | The question needs two or more topics at once. |
| `compare` | Two models, interpretations, historians, arguments or texts, and what separates them. |
| `counter` | How would the result or outcome change if one condition were different? |
| `source` | Purpose, audience, point of view or context of a source, and how that limits what it shows. |
| `context` | The broader situation that explains the source or development. |
| `cause` | Causes and effects, or continuity and change. Which factor best explains it? |
| `purpose` | Why a writer made this choice: its function in the passage and its effect on the audience. |
| `revise` | Which revision best achieves a stated goal in a draft (the AP Lang writing questions). |
| `infer` | What the text implies but does not state. |
| `except` | "Which is NOT supported" or "LEAST likely". Use at most 2 in a test. |

The free response must also be critical thinking.

Every free-response question has at least one part that asks the student to justify, explain why, or argue from evidence. Across the test's free response there is also at least one of each of these:
- a part that asks the student to evaluate a claim, a method, or a student's answer (for example: "A student says …. Do you agree? Justify your answer.")
- a part where the student must design, critique, predict and justify, or reconcile conflicting evidence

## Distractors

Each wrong choice is a line of reasoning a real student follows. It can be:
- a misconception
- a half-right argument
- a true statement that does not answer the question
- the right prediction with the wrong reason
- a slip in a multi-step calculation (for example, the wrong coefficient, a flipped ratio, or forgetting to convert units)
- a source read out of its context

A distractor is never absurd.

The choices in a question are of similar length and grammatical shape. Across the test, the right answer may be the strictly longest choice in no more than 35% of questions, because test-wise students look for the longest choice. The checker enforces this.

"All of the above" and "none of the above" are never used.

Spread the correct letters. Each letter should be the key for 16% to 34% of the test.

## Format

Write one file per test: `out/test-<course>-<unit>.json`.

```
{
  "course": "chem", "unit": "u5",
  "minutes": 90,                       // the time a teacher would give: 75 to 100
  "calc": true,                        // Chemistry: true. Calculus: omit here; each group says. Others: omit.
  "intro": "<optional, one sentence shown on the cover, e.g. 'A periodic table and the AP equations sheet are allowed.'>",
  "mc": [ Group, ... ],
  "fr": [ FR, ... ]
}
```

**Group.** Every question sits in a group. A group is a stimulus and the questions that use it, or a single standalone question.

```
{ "stem": "Questions 4-7 refer to the following.\n\n<the stimulus>",   // "" for a standalone question
  "calc": false,                                                      // Calculus only
  "parts": [ Q, ... ] }
```

- A group with a stem has 2 to 6 questions, and its stem is at least 150 characters.
- A standalone group has one question, and that question's own text carries its scenario: at least 100 characters before the choices.
- The first line of a stem is "Questions a-b refer to the following." In French it is "Questions a-b : …", or name the source's type as the existing sets do.
- Questions are numbered continuously through the whole test: `"l": "1"` to `"l": "25"`.

**Q.**

```
{ "l": "7", "p": 1,
  "q": "<the question>\n(A) ...\n(B) ...\n(C) ...\n(D) ...",       // French: "A. ...\nB. ...\nC. ...\nD. ..."
  "a": "(C). <why C is right, worked through; then why EACH other choice is wrong, naming its letter and the reasoning that leads a student to it>",
  "n": "<CED code(s) (topic x.y) and skill, then 'Thinking: ' one clause on the move this question tests, then 'Trap: ' the distractor most students pick>",
  "lv": "apply" | "analyze" | "evaluate",
  "ty": "<one of the item types above>",
  "t": "<one CED topic code, exactly as the course's unit topics list it (units[].topics[].c)>",
  "s": "<one skill code from the course's skills list>" }
```

**FR.** A free-response item uses the same shape as the course's existing free-response questions: kind, title, pts, stem, and either parts (`l`, `p`, `q`, `a`, `n`) or rubric rows (`r`, `p`, `earns`, `loses`). Load the unit's `out/<course>-<unit>.json` and print one of its non-mc `frq` entries to see the house style.

In a part:
- `a` is the model answer, written the way a scoring guideline reads. It opens with the claim, then gives the reasoning that earns each point. It says "(1 point)" where a part is worth more than one point.
- `n` says what earns nothing: the confident wrong answer and the vague answer.

In a rubric row, `earns` and `loses` are tailored to this prompt, with an example of a line that earns the point.

## Blueprint by course

| Course | Multiple choice | Free response | Minutes | Weights |
|---|---|---|---|---|
| Chemistry `chem` | 25 questions, mostly in stimulus groups: data tables, experiments, a particulate diagram or graph described in words, a titration or kinetics run. Give every constant a question needs. | 3: one `long` worth 8 to 10 points, and two `short` worth 4 points each. At least one part is experimental design or error analysis. At least one part evaluates a student's claim. | about 90 | MC 50%, FR 50% |
| Calculus BC `calcbc` | 24 questions. The first 16 are in groups with `"calc": false`. The last 8 are in groups with `"calc": true` and genuinely need a graphing calculator (a numerical integral, a root, a derivative at a point). Many are standalone. Tables of values and described graphs are welcome. | 3 `long` questions, each 9 points in 3 to 5 parts: one `"calc": true` and two `"calc": false`. Together they include at least one justify-with-a-theorem part (IVT, MVT, EVT, a derivative test, a convergence test, an error bound), and one "is the student's reasoning correct?" or "over- or under-estimate, and why?" part. | about 90 | MC 50%, FR 50% |
| US History `apush` | 25 questions in stimulus sets of 2 to 4. Each set is built on a primary-source excerpt, a secondary-source interpretation, a data table or a described image or map. Cover sourcing, contextualization, causation, comparison, continuity and change, and claim evaluation. | 2 `saq`, each 3 points in parts a to c at 1 point each. One uses two historians' interpretations, and one uses a primary source or has no stimulus. Plus 1 `leq` worth 6 points: rows Row A · Thesis/claim 1, Row B · Contextualization 1, Row C · Evidence 2, Row D · Analysis and reasoning 2. Each row's `earns` and `loses` is tailored to the prompt, as in the existing LEQs. | about 95 | MC 50%, FR 50% |
| Language `lang` | 25 questions. There are three reading sets on passages of 350 to 700 words, with numbered sentences or paragraphs, of 6 to 8 questions each. There is one writing set of 5 to 7 `revise` questions on a student's draft with numbered sentences. | 1 essay worth 6 points, of the unit's natural kind: `rhetorical`, `argument` or `synthesis`. Its rows are Row A · Thesis 1, Row B · Evidence and commentary 4, Row C · Sophistication 1, tailored to the prompt. Plus 2 `short` constructed responses worth 3 points each, in parts: close-reading or argument-craft questions on a passage from the test or a new short one. | about 90 | MC 45%, FR 55% |
| French `french` | 25 questions, in French, across 4 or 5 interpretive sources. Use an article, a literary excerpt, a table or infographic described in words, a letter or email, and a transcript of an interview or radio report ("Transcription d'un reportage"). The questions test inference, purpose, audience, tone, the comparison of two sources, and cultural products, practices and perspectives. Vocabulary is tested only as meaning in context. | 2 items. One is a written Project Q&A (`qa`), the exam's interpersonal task done in writing: a short project prompt on the theme, then four questions the student answers in 3 to 5 sentences each, at least one asking them to weigh two views and one asking for a cultural comparison; its rows mirror the course's existing qa rows. The other is an argumentative `essay` whose stem summarizes two or three short sources on the theme that disagree, so the student has to weigh them; its rows mirror the course's existing essay rows. Write the prompts in French. (The 2026 exam has no email reply; the two tests written before this change keep theirs.) | about 90 | MC 50%, FR 50% |

The weights are set by the build and are not written in the file.

**Connections unit (`x`).** Its test is a cumulative exam across the whole course, on the same blueprint. Every question should need content from at least two units where it can. The `t` tags spread across many units:
- at least 6 units for Chemistry, Calculus and US History
- all four big ideas for Language (`rhs`, `cle`, `reo`, `stl`)
- at least 5 themes for French

`t` is a topic code from the unit the question mostly draws on, for example `5.3`. It is never `X1`.

## Sources and facts

- **Chemistry and Calculus.** Compute every number with python, including each distractor's slip. Where you are unsure of a fact or a constant, change the question rather than guess.
- **US History.**
  - A primary-source excerpt is paraphrased and condensed from a real document. It is labelled, as the existing sets do: "Paraphrased and condensed for this exercise from … The wording is not a direct quotation."
  - A secondary-source excerpt either paraphrases a real historian's well-known argument accurately (labelled as a paraphrase), or is written for practice and labelled so, attributed to "Historian A" or "Historian B".
  - Never put invented words in a real person's mouth as a quotation.
  - Every date, name and causal claim is one you are certain of.
- **Language and French.** Passages and drafts are written for this test and labelled "(written for practice; the writer and publication are invented)", as the existing sets do. Or they are public-domain texts you know verbatim, with author and date. Invented passages must be good writing, with real rhetorical choices to analyze.
- **Exclusions.** Never test content the unit's exclusion statements rule out. They are in `/home/user/JuniorYearFlashcardsApp/data/<course>.json`, at `units[].excl`.
- **No duplicates.** Do not reuse the unit's existing multiple-choice sets or free-response questions, or its cards' questions. Load `out/<course>-<unit>.json` to see them. A test should feel new.

## House style

- **Math.** Prefer Unicode. Inline `$...$` may use only the TeX subset in `SPEC.md`. There is no `\text` and no `\begin`.
- **Figures and tables.** The app is text only.
  - Describe a figure exactly: its axes, labels, shape, key points and values.
  - Write a table as lines of `x · y`, with a header line. For a table in a stem, use one row per line, cells separated by ` · `.
- **Text.** Use plain ASCII quotes inside JSON strings and `\n` for a line break. Sentence case throughout.
- **Titles.** An FR item's `title` is short and names the task, for example "Buffer design: choosing the acid". It is not a label like "Question 2".

## Working method

1. Load `in/<course>-<unit>.json` with python to get the unit's topics, LOs, EK statements and skills. For a Connections test, load every unit's file. Also load `out/<course>-<unit>.json` to see the house style and what already exists.
2. Plan the test before you write it:
   - which topics each group covers, so the test covers the unit (at least 60% of its topics, and the high-weight topics more than once)
   - the `lv` and `ty` mix
   - the key letters
3. Write the test in a python file, `out/test-<course>-<unit>.py`, that builds the JSON and writes `out/test-<course>-<unit>.json`. Add a group at a time and re-run the file after each, so an interruption loses little. If the file exists, read it and continue.
4. Run `python3 tests.py check <course> <unit>` until it prints RESULT PASS with no warnings.
5. Re-read every question as the student would see it. Is exactly one choice right? Is it answerable from what is on the screen, plus what the unit teaches? Does it make the student think?
