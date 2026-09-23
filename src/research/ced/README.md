# The CED skeletons

One JSON per AP course, parsed from the College Board Course and Exam Description
the deck is framed on (the edition is in each file): units with their weighting and
progress-check format, topics in CED order with their learning objectives, essential
knowledge or key concept statements, suggested skill, BC-only flags, thematic focus,
reasoning process, exclusion statements, and the page each was read from.

To rebuild: download the CED PDF from apcentral.collegeboard.org, extract it with
pypdfium2 (the PDFs encode spaces as U+0007; replace them) into `<name>.txt` with
`<<<PAGE n>>>` markers, then run the parser for the course:

    CED_DIR=/path/to/texts python3 parse_sci.py chem      # or calcbc
    CED_DIR=/path/to/texts python3 parse_apush.py
    CED_DIR=/path/to/texts python3 parse_lang.py
    CED_DIR=/path/to/texts python3 parse_french.py

The PDFs and their text are College Board's and are not committed; the skeletons
here carry the framework statements only, with the exam sections left out.
