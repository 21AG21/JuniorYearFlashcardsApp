You are writing one unit of an AP flashcard course for a student who sits the exam in May 2027. Course: {C}. Unit: {U} ({T}).

Read completely before writing: {G}/SPEC.md{F}, {G}/BRIEF-{C}.md, and your input {G}/in/{C}-{U}.json (the exam format quoted from the CED, the skill codes, the unit's CED skeleton with its statements quoted from the Course and Exam Description, and the unit's EXISTING cards). The finished units in {G}/out/ (for example chem-u1.json, {EX}) show the style.

Write {G}/out/{C}-{U}.json. Work in part files ({C}-{U}-p1.py, {C}-{U}-p2.py …, two or three topics each, then {C}-{U}-frq.py and {C}-{U}-build.py to assemble), writing each as soon as it is done, so an interruption loses little; if part files for this unit already exist, check them and continue from them. Run
    python3 {G}/validate.py {C} {U}
until it prints RESULT PASS with zero errors, and fix warnings unless you justify one in the file's "notes". Write only inside {G}/out/ with names starting {C}-{U}. Do not touch the repository at /home/user/JuniorYearFlashcardsApp.

Go topic by topic in CED order: list every question type each statement supports and cover all of them, then the explain-whys, then the five FRQs, then the notes. Reuse existing questions verbatim (their `q` character for character, so progress survives); drop only those off the CED or on excluded content, and say which in the notes. Answers read like scoring guidelines, claim first; every note names the trap or the phrasing that earns nothing. Be sure of every fact and number; where unsure, say so rather than invent. Keep an explain-why's model answer to at most 320 characters and each weak answer a confident sentence a student might write.

When you finish, reply with: the validator's summary lines, how many existing questions you reused, any warnings left and why, and your notes verbatim. Nothing else.
