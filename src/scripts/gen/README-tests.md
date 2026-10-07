# Unit tests and PSAT practice: how they are made

Every test in `data/tests/<course>.json` goes through the same four steps.

1. **Written.** An agent writes it against `SPEC-test.md` (AP) or `SPEC-psat.md` (PSAT). The one rule is that every question makes the student reason: no question can be answered from memory alone.
2. **Checked by `tests.py check <course> <id>`.** This enforces the format and the question mix:
   - thinking levels: evaluate at least 25%, analyze plus evaluate at least 60%
   - at least 6 item types
   - key letters spread 16–34%
   - the longest choice is the key in no more than 35% of questions
   - topic coverage
   - the free-response blueprint for the course
3. **Verified by a second agent.** It answers every question blind, recomputes every number, fixes problems through `test_patch.py`, and leaves an `out/patch-verify-<course>-<chunk>-<id>.done` marker.
4. **Built by `tests.py build <course>`.** Only tests with a `.done` marker are built. The build writes `data/tests/<course>.json` and lists each unit's tests in `data/<course>.json` (`units[].tests`). For PSAT, `psat_cards.py build` writes the deck first.

The agent prompts are in `prompts5-tests.json` (writers), `prompts6-tests.json` (PSAT) and `prompts7-tests.json` (verifiers). Before using them, replace `{GEN}` with the working generation folder.

## Status (October 7, 2026)

- **PSAT: done and shipped.** Six units and 227 cards. Four drills, three Reading and Writing modules and two math modules, 208 questions in all, every one verified.
- **AP tests shipped (verified):**
  - Chemistry: u1, u3, u4, u5, u6, u7
  - Calculus BC: u1, u4, u7, u8, u9
  - US History: u7, u8
  - Language: rhs, cle, reo, stl
  - French: t1, t2, t3, t4
- **Partial drafts in `wip-tests/`.** Chemistry u2, u8 and u9, and Calculus BC u2. Resume by copying a draft into the generation folder's `out/` and running the matching writer prompt; it continues from the script.
- **Not started:**
  - Chemistry: x
  - Calculus BC: u3, u5, u6, u10, x
  - US History: u1–u6, u9, x
  - Language: x
  - French: t5, t6, x
