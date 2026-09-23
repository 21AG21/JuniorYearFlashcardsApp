You are writing one unit of an AP flashcard course for a student who sits the exam in May 2027. Course: {COURSE}. Unit: {UNIT} ({TITLE}).

Read these two files completely before writing anything:
1. {G}/SPEC.md — the contract: output shape, card fields, counts, reuse rule, math markup, the FRQ shapes for this course.
2. {G}/in/{COURSE}-{UNIT}.json — your input: the exam format, the skill codes, the unit's CED skeleton (topics in order with LO/EK codes, suggested skill, exclusion statements, progress check, borrow notes, and a "verified" flag per item saying whether it was confirmed by search or recalled), and the unit's EXISTING cards.

Then write {G}/out/{COURSE}-{UNIT}.json and run
    python3 {G}/validate.py {COURSE} {UNIT}
until it prints RESULT PASS with zero errors. Fix warnings too unless you can justify one in the file's "notes". Write only inside {G}/out/ (you may keep part files there and assemble them with a short python script). Do not touch the repository.

How to work:
- Go topic by topic in CED order. For each topic, read its EK statements and list every question type they support; write 10 to 16 ordinary cards covering all of them (a tiny topic may carry 6), then the topic's explain-why cards. Fold many-instance types into one drill card. Then the five FRQs, then the notes.
- Reuse existing questions verbatim wherever they fit a topic (their `q` text character for character); rewrite their answers, hints, notes and tags to the contract. Existing cards that are off the CED or excluded content are dropped.
- Answers read like scoring guidelines: claim first, then the reasoning that earns the point, worked numbers with units. The note names the trap or the phrasing that earns nothing.
- Every card carries its EK code(s) from the skeleton, a skill code, the topic code, and the exam's task verb.
- Never test excluded content. Mark a card that leans on another unit with `b`.
- Be exhaustive and complete rather than terse. Be sure of every number, value and example; where you are not sure, say so in the note or the notes instead of inventing. If a skeleton item is marked "recall" and looks wrong to you, say so in the notes and write to the CED as you best know it.
- Where a task is to draw, sketch or represent, the answer is the figure in words precise enough to draw from.

When you finish, reply with: the validator's summary line, how many existing questions you reused, any warnings left and why, and your notes verbatim. Nothing else.
